# Database Review — node-cancellation §2.3/§5.1 후속 (ai-review C1-C4/W1-W8 조치 검증)

이번 diff 는 직전 리뷰 라운드(`review/code/2026/07/26/11_48_55`)의 SUMMARY 조치 결과다. DB 관점에서
직전 라운드가 남긴 유일한 실질 항목은 **W1(`findOneBy` 전체 row SELECT)** 이며, 나머지는 컨테이너/
Parallel 범위로의 취소 가드 확장(C3)이 DB 쿼리 빈도에 미치는 영향이다. 둘 다 실제 코드를 열어
확인했다.

## 발견사항

- **[INFO]** W1(직전 WARNING) 해소 확인 — `findOneBy` 전체 row SELECT → `findOne({select})` 컬럼
  투영으로 실제로 교체됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7850-7853`
    (`assertExecutionNotCancelled` 본문)
  - 상세: 현재 코드는
    ```ts
    const row = await this.executionRepository.findOne({
      where: { id: executionId },
      select: { id: true, status: true },
    });
    ```
    이다. `Execution` 엔티티(`codebase/backend/src/modules/executions/entities/execution.entity.ts`)에는
    `select: false` 마킹이 없는 `input_data`/`output_data`/`error`/`conversation_thread`/
    `user_variables`/`resume_call_stack` 6개 `jsonb` 컬럼이 있어, 직전 라운드의 `findOneBy({id})`
    는 이 전부를 매 노드 경계마다 왕복시켰다. 현재는 `select` 로 `id`/`status` 두 컬럼만 투영하므로
    실제 SQL 이 `SELECT id, status FROM execution WHERE id = $1` 수준으로 좁혀진다(TypeORM 0.3.x
    `FindOptionsSelect` 는 명시한 컬럼만 `SELECT` 절에 넣는다). 조회 대상 `id` 는
    `@PrimaryGeneratedColumn('uuid')`(PK, `execution.entity.ts:25`)라 인덱스 스캔이며, 직전
    라운드의 지적("§7.5 durable resume 이후 큰 JSONB 스냅샷 왕복")이 실제로 사라졌다. JSDoc(gate
    7834-7839)도 이제 실제 동작과 일치한다. **W1 완전 해소로 판정.**
  - 제안: 없음(추가 조치 불요).

- **[INFO]** 컨테이너/Parallel 확장(C3)으로 늘어난 쿼리 빈도 — 커넥션 풀·DB 부하 관점에서 문제 아님
  - 위치: `executeContainerBody` 내 신규 호출(`execution-engine.service.ts:6480`), `executeParallelBranchBody`
    내 신규 호출(`:7120`)
  - 상세:
    - `executeContainerBody` 는 ForEach/Loop/Map 의 **iteration 진입마다 1회만** 호출된다(내부 body
      노드 순회 `for` 루프 진입 *전*, gate 6480, `for (const nodeId of sortedNodeIds)` 루프는
      6498줄부터 시작). 즉 body 가 노드 K 개를 가진 컨테이너를 N 개 아이템에 반복해도 쿼리는
      `N`회이지 `N×K`회가 아니다 — 직전 리뷰의 INFO(폴링이 대량 아이템 반복에 곱해지지 않음)가 실제
      구현으로 그대로 실현됐다.
    - `executeParallelBranchBody` 는 반대로 **브랜치 내부 노드 경계마다**(gate 7120, `for (const nodeId
      of plan.sortedNodeIds)` 루프 안) 호출된다 — 이는 메인 dispatch 루프(`runExecution`/
      `runNodeDispatchLoop`)와 동일한 세분화 수준으로, 정적 노드 그래프(대량 아이템 반복이 아님)이므로
      설계상 타당하다.
    - Parallel 브랜치는 `parallelExecutor.execute` 를 통해 `maxConcurrency`(노드 설정, 0~16 클램프 —
      `containers/parallel-executor.ts:148`, 중첩 시 외부×내부 곱도 클램프됨, `:97` 주석) 만큼
      **동시에** 실행되므로, 최악의 경우 동일 시점에 최대 16개의 `assertExecutionNotCancelled` 쿼리가
      서로 다른 커넥션을 동시에 점유할 수 있다. 기본 커넥션 풀 크기는 `DB_POOL_MAX`(기본값 10,
      `common/config/database.config.ts:14`, 인스턴스당)로, 이론상 브랜치 팬아웃(≤16)이 풀 크기(10)를
      순간적으로 초과할 수 있다.
    - 다만 이 쿼리는 PK 인덱스 단일-컬럼 SELECT 로 매우 짧게 커넥션을 점유하고(같은 노드 경계에서
      이미 `NodeExecution` INSERT + `Execution` UPDATE + 이벤트 emit 이 함께 일어나므로 상대적 추가
      비용은 무시할 만함), TypeORM/`pg-pool` 은 풀 초과 시 **에러가 아니라 대기 큐잉**이라 커넥션
      고갈로 인한 실패(exhaustion)로는 이어지지 않는다 — 지연이 소폭 늘어날 뿐이다. 브랜치당
      body 노드 수가 많지 않은 한(Parallel 은 통상 얕은 브랜치를 병렬화하는 용도) 정상 부하 범위로
      판단한다.
  - 제안: 현재로선 조치 불요. 다만 브랜치 body 가 깊은 노드 그래프를 갖는 워크로드가 실측되면
    (a) `DB_POOL_MAX` 조정, 또는 (b) 브랜치 팬아웃 시나리오의 커넥션 대기시간 지표를 관찰 대상으로
    추가하는 것을 고려할 것.

- **[INFO]** 트랜잭션·SQL 인젝션·마이그레이션 관점은 이전과 동일하게 안전
  - 위치: `execution-engine.service.ts` 의 `updateExecutionStatus`(C4 조치, guarded UPDATE 부분 —
    함수 정의는 `:7959`, raw UPDATE 문은 `status IN ('pending','running','waiting_for_input')` 조건과
    `RETURNING id` 를 사용하는 파라미터화 쿼리)
  - 상세: C4 조치로 `runExecution`/`finalizeResumedExecutionOutcome` 의 `ExecutionCancelledError`
    catch 가 무조건 `save()` 대신 이 guarded UPDATE 로 전환됐다. WHERE 절이 비-terminal 상태만
    매칭하므로(M-3 규약) `stop()` 이 이미 커밋한 `finishedAt`/`durationMs` 를 늦은 시각으로 재마킹하지
    않는다 — lost-update 를 막는 정합성 보강이며 DB 관점에서 긍정적. 파라미터는 전부 `$1`..`$7`
    플레이스홀더(raw query 관용)라 SQL 인젝션 위험 없음. 이번 diff 에 스키마/마이그레이션 파일은
    없어 무중단 배포 영향도 없음.
  - 제안: 없음.

## 요약

직전 라운드가 지적한 유일한 database WARNING(`findOneBy` 로 인한 Execution 전체 row + 6개 JSONB
컬럼 SELECT)은 `findOne({select:{id:true,status:true}})` 컬럼 투영으로 실제 코드에서 해소됐음을
직접 확인했다(`execution-engine.service.ts:7850-7853`). 컨테이너/Parallel 로의 취소 가드 확장(C3)은
쿼리 빈도를 늘리지만, ForEach/Loop/Map 은 아이템 경계당 1회로 설계돼 대량 반복에 곱해지지 않고,
Parallel 브랜치는 노드 경계당 1회이나 PK 인덱스 단일-컬럼 SELECT 라 커넥션 점유 시간이 매우 짧아
기본 풀 크기(10)와 브랜치 동시성 상한(≤16)을 감안해도 커넥션 고갈이 아닌 경미한 대기 지연 수준에
그친다. C4 의 guarded UPDATE 전환도 파라미터화·비-terminal WHERE 가드를 갖춰 정합성·인젝션 양쪽에서
안전하다. 이번 diff 에 마이그레이션/스키마 변경은 없다.

## 위험도

NONE — 직전 WARNING 은 해소, 신규 도입된 항목은 모두 INFO 수준.
