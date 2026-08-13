# 동시성(Concurrency) 리뷰 결과

## 개요

이번 변경의 핵심은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아니라
`[rows, rowCount]` **튜플**을 돌려준다는 실측 사실을 반영해, 그동안 이를 행 배열로 오인해 결과가
상시 고정값(`length` 항상 2)으로 평가되던 8개 지점을 `updateReturningRows()` 헬퍼로 정정한 것이다.
대상 지점 대부분이 CAS(compare-and-swap) 락·admission 직렬화·상태 전이 가드라 동시성 리뷰의
핵심 표면과 정확히 겹친다. 소스(`update-returning-rows.ts`, `auth-oauth.service.ts`,
`execution-engine.service.ts`, `knowledge-base.service.ts`)를 직접 열어 대조했다.

## 발견사항

- **[WARNING]** 이번 수정으로 되살아난 "동시 cancel 방어" 분기(`persisted=false`)가, retry-turn
  경로에서는 여전히 mock 경계 안쪽에서만 검증됐고 실제 코드로 재검증되지 않은 채 남아 있다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:46-52` (신규 소급 재검증 체크리스트,
    `[ ]` 미완료), 같은 파일 `:26-43`(소급 정정 배너). 근거 코드는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8549-8553`
    (`updateExecutionStatus` 의 `persisted` 계산)와 `retry-turn.service.spec.ts:101` 의
    `updateExecutionStatus: jest.fn().mockResolvedValue(true)` boundary mock.
  - 상세: `updateExecutionStatus` 는 `WHERE status IN (non-terminal)` guarded UPDATE 결과를
    `persisted` 로 반환해 "동시 cancel/완료 레이스에서 진 쪽" 을 판별하는 CAS 성격의 가드다.
    이번 수정 전에는 `updated.length > 0` 이 튜플이라 **항상 참**이었고, `retry-turn.service.spec.ts`
    는 이 경계를 애초에 `true` 로 고정한 mock 을 쓰고 있어 — 정확히 그 버그 상태와 동일한 동작을
    "정상" 으로 검증해 온 셈이다. 이번 diff 로 `persisted` 가 실제 DB 매치 여부를 반영하게
    됐으므로, `failRetryExecution`/`completeRetryExecution` 이 `persisted=false` 를 실제로 받는
    경로(동시 Stop 이 retry-turn 종결과 경합하는 경우)가 있는지, 있다면 어떤 부작용이 있는지는
    **아직 mock 밖에서 한 번도 실행된 적이 없다.** plan 문서 스스로 "이 항목이 열려 있는 한 위
    라운드들의 종결은 mock 안쪽 한정" 이라고 명시하고 있어, 새 결함이라기보다 **정직하게 등재된
    미검증 갭**이지만 동시성 정합성 주장의 신뢰 범위에 직접 영향을 주므로 WARNING 으로 남긴다.
  - 제안: `plan/complete/` 이동 전, `retry-turn.service.spec.ts:101` 의 boundary mock 을 `false`
    로도 세워 양방향(성공 저장 vs 레이스 패배)을 실제로 관측하는 테스트를 추가할 것 — plan 이
    이미 이 절차를 명시했으므로 그대로 수행하면 된다.

- **[INFO]** `updateReturningRows` 의 튜플/행-배열 판별 휴리스틱은 안전하다 — 검증 완료.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:36-57`
  - 상세: `Array.isArray(result[0])` 로 튜플(`[rows, rowCount]`, `result[0]` = 행 배열)과 직접
    행 배열(`result[0]` = 평범한 행 객체)을 가른다. pg 드라이버가 행을 배열이 아닌 일반 객체로
    반환하는 한(코드베이스 전역에서 row-mode array 사용 없음) 오판 경로가 없고, 빈 튜플도
    `[[], 0]`(길이 2, `result[0]=[]`→배열)로 정확히 처리돼 0행 CAS 거절 분기가 트리거된다.
    `detail` 매개변수를 필수(`detail: string`, optional 아님)로 강제해 8개 호출부(execution-engine
    2, knowledge-base 5, auth-oauth 1) 전부가 문맥 문자열을 전달하도록 강제했음을 grep 으로 확인
    (`updateReturningRows(` 전수 호출부 대조, 누락 없음).
  - 제안: 없음(정상).

- **[INFO]** 3개 소비 지점(KB 재추출/재임베딩 CAS 락, admission gate)의 락·직렬화 구조 자체는
  이번 diff 로 변경되지 않았다 — 결과 해석만 정정됐다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:333-350`(재추출 CAS,
    `WHERE ... AND reextract_status = 'idle'`), `:717-734`(재임베딩 CAS),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2904-2953`
    (`pg_advisory_xact_lock` 기반 admission 직렬화, 조건부 UPDATE).
  - 상세: 수정 전에는 CAS 락의 `acquired.length === 0` 판정이 튜플 때문에 **항상 거짓**이라 거절
    분기가 한 번도 타지 않았다(동시 재추출/재임베딩이 잠금 없이 통과). admission 쪽은
    `rows.length === 1` 이 **항상 거짓**이라 매번 `deferred` 로 오판, 재큐된 job 을
    `runExecutionFromQueue` 의 RUNNING arm 이 "stalled 재배달" 로 오인해 §7.5 rehydration
    우회 경로로 재구동해 왔다(결과만 맞고 경로가 틀림, 매 실행 2s 지연). 이번 수정은 SQL·락
    범위·트랜잭션 경계를 바꾸지 않고 오직 반환값 해석만 바로잡아, 이미 존재하던 락/직렬화
    설계가 실제로 작동하게 만든다 — 새로운 락 순서·중첩이 도입되지 않아 데드락 위험도 늘지
    않는다. (배포 시 "죽어 있던 분기가 처음 라이브가 되는" 행동 변화는 side_effect 리뷰 영역이라
    여기서는 중복 기재하지 않는다.)
  - 제안: 없음(설계 변경 없음, correctness 개선).

- **[INFO]** 신규/변경 테스트가 튜플-vs-행배열을 뮤테이션으로 실제 판별하는지 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    (admission 2건 — `admitted` 방향/`not.toBe('admitted')` 방향; `updateExecutionStatus`
    `persisted=true`/`persisted=false` 2건), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts`
    (재추출/재임베딩 CAS 0행 거절 2건, embedding/graph 재큐·reset 의 실제 documentId 값 단언 3건).
  - 상세: 0행 튜플(`[[], 0]`)을 판별자로 쓰는 테스트가 양쪽 CAS 락·admission·`updateExecutionStatus`
    전부에 대칭으로 존재하고, KB 재큐 테스트는 단순 개수가 아니라 **큐에 실린 documentId 값**까지
    단언해 "언랩이 깨지면 `[undefined, undefined]`" 같은 조용한 회귀를 잡는다. RESOLUTION 문서들의
    기록(뮤테이션으로 헬퍼 호출을 제거/의미만 되돌리는 두 종류 뮤턴트 모두 사살)과 직접 대조한
    소스 코드가 일치한다.
  - 제안: 없음(양호).

- **[INFO]** `async`/`await` 누락·이벤트 루프 블로킹 없음 — 확인.
  - 위치: 리뷰 대상 소비 지점 전체(`update-returning-rows.ts`, `auth-oauth.service.ts:146-152`,
    `execution-engine.service.ts:2920,8512`, `knowledge-base.service.ts:333-351,530-586,717-751`).
  - 상세: 모든 `.query()` 호출은 `await` 로 소비된 뒤 그 결과(`unknown`)가 `updateReturningRows`
    로 전달된다. 헬퍼 자체는 동기 순수 함수(I/O·네트워크·전역 상태 없음)라 새로운 비동기 경계나
    Promise 체인을 추가하지 않는다. 스레드 풀·커넥션 풀 크기 설정도 이번 diff 의 범위 밖이며
    변경되지 않았다.
  - 제안: 없음.

## 요약

이 변경은 새로운 동시성 결함을 들여오지 않고, 이미 존재하던 진짜 경쟁 조건(KB 재추출/재임베딩
CAS 락이 튜플 오판으로 상호배제를 전혀 하지 못하던 문제)과 상태 전이 가드 무력화(admission 카운트
체크가 항상 실패로 오판되고, 동시 cancel 선점 판정이 항상 성공으로 오판되던 문제)를 정확한 실측·
뮤테이션 검증 테스트·구조적 회귀 가드와 함께 바로잡는다. 판별 휴리스틱은 Postgres 드라이버의 실제
반환 형태 하에서 안전하고, 8개 호출부 전부가 헬퍼로 일관 전환됐으며(직접 grep 대조로 누락 없음
확인), 락·advisory lock 범위·트랜잭션 경계는 변경되지 않아 데드락 위험이 늘지 않는다. 유일하게
남은 항목은 새 결함이 아니라 **plan 문서가 스스로 등재한 미검증 갭**이다 — `updateExecutionStatus`
의 `persisted=false` 분기가 retry-turn 경로에서 여전히 mock 경계 안쪽(하드코딩된 `true`)에서만
검증되고 있어, 그 경로의 동시-cancel 방어 주장은 아직 코드로 재확인되지 않았다.

## 위험도

LOW
