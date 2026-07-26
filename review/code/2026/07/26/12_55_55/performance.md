# 성능(Performance) Review — linear-cancel-mechanism §2.3 확장 (컨테이너/Parallel)

대상: `assertExecutionNotCancelled` 노드 경계 cancel 가드가 (1) 직전 라운드 WARNING(W1, 전체 row SELECT)
컬럼 투영으로 해소됐는지, (2) 이번 라운드에 컨테이너(ForEach/Loop/Map) 아이템 경계·Parallel 브랜치
노드 경계로 확장되며 호출 빈도가 어떻게 늘었는지를 정량 평가한다.

## 발견사항

- **[INFO]** 직전 라운드 WARNING(전체 row SELECT)이 실제로 컬럼 투영으로 해소됨 — 확인 완료.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7850-7853`
  - 상세: `assertExecutionNotCancelled` 구현이 `this.executionRepository.findOneBy({ id: executionId })`
    (엔티티 전체 컬럼, JSONB 6개 포함)에서 `this.executionRepository.findOne({ where: { id: executionId },
    select: { id: true, status: true } })` 로 바뀌었다. TypeORM `select` 옵션으로 실제 `status`(+PK)
    컬럼만 왕복하므로, W1 이 지적한 "JSDoc은 단일 컬럼이라 주장하지만 실제로는 전체 row" 불일치가
    해소됐고 JSDoc(`:7834-7839`)의 "status 단일 컬럼" 서술과 구현이 이제 일치한다. 이 라운드의 신규
    호출부(컨테이너/Parallel, 아래 WARNING)도 동일 메서드를 재사용하므로 이 최적화 혜택을 그대로
    받는다.

- **[WARNING]** 컨테이너(ForEach/Loop) 아이템 경계로 확장된 cancel 체크가 **아이템 수에 비례한 순차 DB
  라운드트립**을 추가하며, ForEach 는 아이템 수에 상한이 없고 Loop·중첩 컨테이너는 곱셈적으로 늘어난다 —
  대량 반복 시 체감 가능한 지연으로 이어질 수 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6473-6480`
    (`executeContainerBody` 진입 직후 `await this.assertExecutionNotCancelled(executionId);`) ·
    `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts` 의
    `ForEachExecutor.execute`(순차 `for` 루프가 아이템마다 `executeBody` 를 await — 병렬화 없음, diff
    밖의 기존 구조) · `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts`
    (`DEFAULT_MAX_ITERATIONS = 1000`, 파일 상단, diff 밖 — Read 로 확인)
  - 상세:
    1. **호출 빈도 모델이 바뀌었다.** `executeContainerBody` 는 컨테이너 본문에 노드가 몇 개든 **아이템당
       1회만** 호출된다(내부 `for (const nodeId of sortedNodeIds)` 루프 진입 *전에* 가드가 있음, 코드
       주석도 "노드 경계마다가 아니라 아이템 경계마다"라고 명시). 즉 비용 모델은 "노드 수" 가 아니라
       "아이템 수" 에 선형 비례한다. 그런데 이 아이템 수는 선형 dispatch 루프의 `MAX_NODE_ITERATIONS`
       (기본 100, cyclic back-edge 재방문 상한)처럼 상한이 강제되는 값이 아니다 — `LoopExecutor` 는
       `DEFAULT_MAX_ITERATIONS = 1000` 이 있지만, `ForEachExecutor`/`foreach.handler.ts`/
       `spec/4-nodes/1-logic/9-foreach.md` 어디에도 입력 배열 길이 상한이 없다(데이터 소스에서 뽑아온
       임의 길이 배열을 그대로 순회). 데이터 기반 대량 처리(CSV import, DB 조회 결과 fan-out, bulk
       webhook/email 발송 등)에서 수천~수만 아이템은 현실적인 워크로드다.
    2. **순차 실행이라 지연이 그대로 누적된다.** `ForEachExecutor.execute`/`LoopExecutor.execute` 는
       `context.itemContext`/`context.loopContext` 를 공유 mutate 하는 기존 설계상 아이템을 병렬로 돌리지
       않고 `for` 루프에서 매번 `await executeBody(...)` 한다(diff 가 만든 구조는 아니고 기존 설계 — 이
       PR 은 그 순차 루프 매 회전 진입부에 DB round-trip 을 하나 추가할 뿐이다). PK 인덱스 SELECT 1건이
       개별로는 저렴해도(동일 AZ 기준 통상 1~3ms), 아이템 1만 건이면 이 가드만으로 순수 직렬 지연이
       추가로 10~30초 발생할 수 있다 — 실행 시작~종료 사이에 사용자가 체감하는 전체 소요 시간에 그대로
       더해진다.
    3. **본문이 가벼운 노드일수록 상대 비용이 커진다.** 새 메서드의 JSDoc(`:7834-7839`, "같은 경계에서
       이미 NodeExecution INSERT + Execution UPDATE + 이벤트 emit 이 일어나므로 상대 비용은 무시할 만
       하다")은 원래 **선형 dispatch 루프**(`runExecution`/`runNodeDispatchLoop`/`executeInline`)의 노드
       경계를 근거로 쓴 정당화인데, 컨테이너 아이템 경계에는 그대로 적용되지 않는다 — 아이템 경계에서는
       (a) `Execution` 테이블 UPDATE 가 애초에 매 아이템마다 일어나지 않고(상태 전이 시점에만 발생), (b)
       본문이 "변수 설정"·"조건 분기" 류의 외부 I/O 없는 가벼운 노드 1개뿐이면 그 노드의
       INSERT+UPDATE+emit 비용 자체도 함께 작다. 즉 "가벼운 본문을 가진 대량 ForEach" 시나리오에서는
       신규 SELECT 가 아이템당 지배적 비용에 가까워질 수 있어(체감상 아이템 처리 시간을 최대 2배 가까이
       늘릴 수 있음), 정당화 근거로 인용된 "상대 비용 무시할 만함"이 이 호출부에는 약하게 적용된다.
    4. **중첩 컨테이너는 곱셈적으로 늘어난다.** `ForEachExecutor`(`prevItemContext` 저장/복원 주석 —
       "nested ForEach containers restore outer state")·`LoopExecutor`(`prevLoopContext`)가 중첩을 명시
       지원하므로, 예를 들어 바깥 ForEach 100건 × 안쪽 Loop 100회전이면 `assertExecutionNotCancelled`
       호출이 outer 100 + (outer×inner) 10,000 = 총 10,100회까지 늘어난다 — 단일 컨테이너 노드 기준
       분석보다 실제 최악 케이스는 더 나쁠 수 있다.
    5. **직전 라운드 INFO 관측이 이번 확장으로 뒤집혔다.** 이전 성능 리뷰(`review/code/2026/07/26/11_48_55/performance.md`)는 "컨테이너 본문 루프는 이 취소 체크를 상속하지 않는다"를 누적 비용의 상한을 낮춰주는 **완화 요인**으로 기록했다. 이번 커밋(C3)이 그 갭을 정확히 메웠으므로 그 전제가 더 이상 성립하지 않는다 — 재평가가 필요했고, 위 1~4 가 그 재평가 결과다.
  - 제안: 정확성(모든 아이템에서 즉시 감지)을 완전히 포기하지 않는 선에서 폴링 빈도를 낮추는 절충을
    권장한다.
    - **카운트 기반 스로틀**: `executeContainerBody` 호출 시 전달되는 iteration 카운터를 이용해 N 회(예:
      10~20회)마다 1회만 `assertExecutionNotCancelled` 를 실제로 호출하고, 그 사이는 in-memory 로 skip.
      "Stop 이후 최대 N 개 아이템의 부수효과가 더 발생할 수 있다"는 트레이드오프가 생기지만, 원래도
      "노드 경계에서만 관측"이라는 best-effort 계약(spec §2.2/§2.3)이므로 정합성 손상은 크지 않다.
    - **시간 기반 TTL 캐시**: 마지막 조회 이후 경과 시간이 짧으면(예: 200~300ms) 캐시된 "취소 아님" 결과를
      재사용. 아이템 처리가 빠른 워크로드(가벼운 본문)일수록 효과가 크고, 아이템 처리가 느린 워크로드
      (외부 I/O 위주)에서는 어차피 매번 실제 조회가 일어나 기존 동작과 차이가 없다.
    - 둘 중 하나를 채택하면 대량 아이템 시나리오의 순차 DB 라운드트립을 크게 줄이면서도 "Stop 이 유한한
      시간 내에 부수효과를 멈춘다"는 이번 PR 의 핵심 목표는 유지할 수 있다. 최소한 이 트레이드오프(즉시
      감지 vs 대량 반복 비용)를 `assertExecutionNotCancelled` JSDoc 과
      `plan/in-progress/node-cancellation-residual-signal-propagation.md` 에 알려진 한계로 명시해 두는
      것을 권장한다(현재는 언급 없음).

- **[INFO]** Parallel 브랜치 노드 경계 확장(`executeParallelBranchBody`)은 컨테이너/ForEach 와 달리
  비용 모델이 선형 dispatch 루프와 동일해 별도 조치가 급하지 않다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7117-7120`
  - 상세: 이 호출은 "아이템 경계"가 아니라 브랜치 내부의 **정적 노드 그래프**를 순회하며 **노드 경계마다**
    1회 호출된다(주석도 "메인 루프와 동일하게 노드 경계마다 체크"라고 명시). 브랜치당 호출 수는 그
    브랜치의 노드 개수로 상한이 걸리며, 이는 이미 허용 가능하다고 평가된 선형 dispatch 루프의 비용
    모델과 동일하다(직전 라운드 performance.md 의 LOW 판정 근거 그대로 적용 가능). 다만 여러 브랜치가
    동시에(Promise.all 류로) 실행되면 브랜치 수만큼 SELECT 가 동시에 DB 커넥션 풀에 몰릴 수 있으므로,
    Parallel 브랜치 수가 큰 워크플로우(예: 수십 개 브랜치)가 다수 동시 실행되는 상황에서는 커넥션 풀
    포화 여부를 실측(APM)으로 확인해 두는 것을 권장한다 — 다만 이는 노드 수 기반이라 위 컨테이너
    아이템 수 기반 위험보다 한 단계 낮은 우선순위다.

- **[INFO]** `assertExecutionNotCancelled` JSDoc(`:7819-7846`)의 "비용" 단락이 여전히 선형 dispatch 루프
  전용 서술("dispatch loop 가 노드 사이마다 호출한다", "같은 경계에서 이미 NodeExecution INSERT +
  Execution UPDATE + 이벤트 emit 이 일어나므로")로만 쓰여 있고, 이번 라운드에 추가된 아이템 경계
  (`executeContainerBody`) 호출부의 다른 비용 프로필(위 WARNING 3번)은 반영하지 않는다. 문서 정확성
  이슈이며 documentation reviewer 영역과 겹치지만, 성능 판단의 근거로 재사용되는 문구라 여기서도
  기록한다 — 위 WARNING 의 제안대로 트레이드오프를 명시할 때 이 JSDoc 도 함께 갱신하면 된다.

## 요약

직전 라운드 W1(전체 row SELECT)은 컬럼 투영(`select:{id:true,status:true}`)으로 실제로 해소됐다 —
`assertExecutionNotCancelled` 를 호출하는 모든 지점(선형 3곳 + 이번에 확장된 컨테이너/Parallel 2곳)이
그 최적화 혜택을 공유한다. 다만 이번 라운드의 핵심 변화인 "컨테이너/Parallel 범위 확장" 은 두 콜사이트의
성격이 달라 위험도가 다르다. `executeParallelBranchBody`(노드 경계)는 선형 dispatch 루프와 동일한 비용
모델(브랜치 노드 수로 상한)이라 기존 LOW 판정을 그대로 유지할 수 있다. 반면 `executeContainerBody`(아이템
경계)는 "노드 수" 대신 "아이템 수" 에 선형 비례하는 새로운 비용 축을 만들었는데, `ForEachExecutor` 는
아이템 수 상한이 아예 없고(`LoopExecutor` 는 기본 1000), 중첩 컨테이너는 곱셈적으로 늘어나며, 실행은
순차(non-parallel)라 지연이 그대로 누적된다. 대량 아이템(수천~수만 건)을 가벼운 본문 노드로 처리하는
현실적인 워크플로우에서는 이 가드만으로 아이템당 처리 시간이 체감 가능하게 늘어날 수 있다 — 직전 라운드
성능 리뷰가 "컨테이너는 이 체크를 상속하지 않는다"를 완화 요인으로 기록했던 전제가 이번 확장으로 깨졌으므로,
재평가 결과를 WARNING 으로 기록한다. 정확성을 완전히 포기하지 않는 카운트/시간 기반 스로틀 절충을
권장하며, 최소한 이 트레이드오프를 문서(JSDoc·plan)에 남길 것을 제안한다.

## 위험도

MEDIUM
