# 동시성(Concurrency) 리뷰 — `updateReturningRows` 튜플 shape 수정 라운드 (`23_07_11`)

## 개요

이번 라운드의 diff 는 이전 두 라운드(`20_36_35`, `22_45_24`)에 걸쳐 만들어진 결과물이 누적된
것이다 — TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` 이 행 배열이 아니라
`[rows, rowCount]` 튜플을 돌려준다는 실측을 반영해, CAS 락·admission 게이트·상태 전이 가드 등
**동시성 프리미티브 8곳**(execution-engine 2, knowledge-base 5, auth-oauth 1)이 그 튜플을 행
배열로 오인해 조건 판정이 항상 한 방향으로만 평가되던 결함을 `updateReturningRows()` 헬퍼로
정정한다. 신규 커밋(`08d3c7fa3` auth-oauth 수정, `443dd91a6` `updateExecutionStatus` 판별
테스트, `assert-row-array.spec.ts` 가드 카운트 갱신)까지 실제 소스(`git diff
origin/main...HEAD`)를 열어 대조했다.

## 확인한 내용 (핵심 로직 검증)

- **`updateReturningRows` 튜플 판별 휴리스틱** (`codebase/backend/src/common/utils/update-returning-rows.ts:52` `Array.isArray(result[0])`): pg 드라이버가 SELECT/INSERT 행을 항상 일반 객체로 반환하는 한(행 자체가 배열인 경우가 없음) 오판 경로가 없다. 빈 튜플(`[[], 0]`)도 `result[0]=[]`(배열)로 판별돼 0행 CAS 거절 분기가 정상 트리거된다. 헬퍼 자체는 동기 순수 함수라 이벤트 루프 블로킹·새 비동기 경계 없음.
- **KB CAS 락 2곳** (`codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:346` `reExtractAll`, `:729` `reEmbedAll`): 수정 전 `acquired.length===0` 이 튜플이라 항상 거짓 → 동시 재추출/재임베딩 요청 상호배제가 전혀 동작하지 않던 진짜 경쟁 조건이었다. 헬퍼 적용으로 거절 분기가 실제로 작동한다. 대칭 테스트(`reExtractAll` 0행 케이스)가 이번 라운드에 추가돼 두 CAS 락이 모두 판별 테스트로 고정됐다(`knowledge-base.service.spec.ts`).
- **execution admission** (`execution-engine.service.ts:2913`~`2953`): `pg_advisory_xact_lock(hashtext($1))` 로 workspace 단위 admission 을 트랜잭션 내 직렬화한 뒤 조건부 UPDATE 로 COUNT-체크-전이하는 구조 자체는 이번 diff 의 범위 밖(변경 없음). 튜플 오판 때문에 `rows.length===1` 이 항상 거짓이라 admission 성공이 매번 `deferred` 로 오판돼 2초 재큐+rehydration 우회 경로로만 동작해 왔다. 헬퍼 적용으로 정상 경로가 복원된다. 락은 트랜잭션당 1회, 다른 락과 중첩되지 않아 데드락 경로 없음.
- **`updateExecutionStatus`** (`execution-engine.service.ts:8511`~`8553`): `WHERE status IN (non-terminal)` guarded UPDATE 로 "동시 취소/완료 레이스에서 진 트랜잭션이 실제로 DB 를 갱신 못 했다" 를 감지해 중복 종결 이벤트 emit 을 막는 CAS 가드. 튜플 오판으로 `updated.length>0` 이 항상 참이라 이 가드가 무력화돼 있었다 — 레이스 패자도 스스로 승자로 오인해 종결 메트릭/이벤트를 중복 낼 수 있었다. 이번 라운드에 추가된 판별 테스트(`실측 shape: 1행 튜플…persisted=true` / `0행 튜플…persisted=false`, `execution-engine.service.spec.ts:4599`~`4625`)가 "가드는 통과하되 의미만 되돌리는" 뮤턴트로 실제로 갈린다는 것까지 `RESOLUTION.md`(`22_45_24`)가 뮤테이션으로 확인해 뒀다 — 앞선 라운드에서 이 부분이 비배열 가드에만 기대 커버리지를 과대 주장했던 CRITICAL 이 이번엔 실제로 닫혀 있다.
- **OAuth state 소비** (`auth-oauth.service.ts:146`~`151`): `DELETE ... RETURNING *` 은 state 를 원자적으로 "1회 소비" 시켜 재사용/만료 상태를 거절하는 CAS 성격의 문장이다. 튜플 오판으로 `consumed.length===0` 이 항상 거짓이라 만료·재사용 state 검증이 전혀 동작하지 않았고, `consumed[0]` 이 행이 아니라 행 배열이라 `record.provider` 가 `undefined` → 정상 콜백까지 전부 실패하던 CRITICAL 이었다. 이번 수정으로 원자적 단일 소비(replay 방지) 가 실제로 복원된다.
- 8개 호출부 모두 `updateReturningRows` 로 일관 전환됐음을 `update-returning-rows.spec.ts` 의 구조적 grep 가드(파일별 호출 수 고정: execution-engine 2 / knowledge-base 5 / auth-oauth 1)와 실제 소스 grep 대조로 확인. `assert-row-array.spec.ts` 의 `execution-engine.service.ts` guards 카운트가 `3→1` 로 내려간 것도 실제와 일치한다(SELECT 지점 `lockNonTerminalExecutionRow` 1곳만 `assertRowArray` 유지, 나머지 2곳은 `updateReturningRows` 로 이관).

## 발견사항

- **[INFO]** `retryFailedDocuments` 의 embedding 분기만 `query<{ id: string }[]>()` 타입 제네릭을 그대로 유지해, "shape 은 오직 `updateReturningRows` 가 판별한다" 는 파일 전체의 불변식이 이 한 곳에서 시각적으로 깨진다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:533` (`const rows = await this.dataSource.query<{ id: string }[]>(`) — 33줄 아래 짝인 graph 분기(`:569`, `const rows: unknown = await this.dataSource.query(`)는 이미 `unknown` 으로 전환됨.
  - 상세: 런타임 동작에는 영향 없음 — `updateReturningRows<{ id: string }>(rows, ...)` 가 실제 shape 을 판별해 정정하므로 기능 결함은 아니다. 다만 이번 결함의 근본 원인이 "선언 타입이 실제 shape 을 보장한다는 잘못된 믿음"이었던 만큼, 같은 파일의 자매 지점 하나가 그 거짓 주장을 그대로 남겨두면 다음 리팩터링에서 컴파일러가 오용을 잡아주지 못하는 사각이 남는다. 이 항목은 이전 라운드(`22_45_24` concurrency.md INFO 1)에서 이미 지적됐고 우선순위 낮음으로 넘겨진 채 이번 라운드에서도 그대로다 — 새로 생긴 문제는 아니다.
  - 제안: `unknown` 으로 통일. 필수 아님, 저비용 정리.

- **[INFO]** `KnowledgeBaseService.reEmbedAll` 의 CAS 락 UPDATE(`:729`)와 후속 reset UPDATE(`:746`)가 여전히 트랜잭션 밖의 별도 두 문장이다 (이 diff 로 도입된 구조 아님).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:717`~`754` (`reEmbedAll`)
  - 상세: `reExtractAll` 은 CAS 락+DELETE+reset 을 `dataSource.transaction()` 하나로 묶는 반면(`:334`), `reEmbedAll` 은 CAS 락 성공(`reembed_status='in_progress'` 커밋) 후 reset UPDATE 사이에 크래시하면 KB 가 `in_progress` 로 좌초하고 문서 status 는 리셋되지 않은 채 남는 좁은 창이 있다. 이번 diff 가 건드린 것은 각 UPDATE 결과의 shape 해석뿐이라 새로 만든 문제는 아니지만, CAS 락이 이제 실제로 동작하게 된 만큼(위 발견사항 참고) 이 비-원자적 2단계 구조의 실질적 노출 빈도도 함께 올라간다 — 종전엔 CAS 락 자체가 무력화돼 있어 "락을 잡은 뒤 크래시" 시나리오가 드물게만 관측됐을 수 있다.
  - 제안: 이번 PR 범위 밖. `reEmbedAll` 의 CAS+reset 원자화(트랜잭션 래핑)를 후속 검토 후보로 남길 만하다.

- **[INFO]** admission·CAS 락·상태 전이 가드 세 곳 모두 "죽어 있던 분기가 이번에 처음 실제로 라이브"되는 성격이라, 배포 직후 이벤트 발생 패턴(admission 즉시 승인, KB 재추출/재임베딩 409, 동시-cancel 종결 이벤트 억제)이 프로덕션에서 처음 관측된다.
  - 위치: `execution-engine.service.ts:2944`(admission), `:8553`(`updateExecutionStatus`), `knowledge-base.service.ts:346`,`:729`(CAS 락)
  - 상세: 동시성 관점에서는 이 변화 자체가 결함이 아니라 의도된 정상화이지만, 배포 전 관측 계획이 없으면 "새로 생긴 지연/거부"로 오인될 수 있다. `plan/in-progress/update-returning-tuple-shape.md` 에 이미 배포 후 관측 항목으로 등재돼 있음을 확인했다.
  - 제안: 조치 불요(이미 plan 에 등재). 배포 시 참고용으로만 남긴다.

## 요약

이 변경은 신규 경쟁 조건을 들여오는 것이 아니라, 이미 존재하던 진짜 동시성 결함(KB 재추출/재임베딩 CAS 락이 튜플 오판으로 상호배제를 전혀 못 하던 문제, execution admission cap 이 실제로 강제되지 않던 문제, 동시 취소/완료 레이스에서 진 쪽이 스스로 승자로 오인해 종결 이벤트를 중복 낼 수 있던 문제, OAuth state 재사용/만료 검증이 전혀 동작하지 않던 문제)를 실측·판별 테스트·구조적 grep 가드와 함께 정확히 바로잡는다. 8개 호출부 전부가 공유 헬퍼로 일관 전환됐고, 튜플 판별 휴리스틱은 pg 드라이버의 실제 반환 형태 하에서 안전하며, 데드락·이벤트 루프 블로킹·await 누락은 관찰되지 않는다. 앞선 두 라운드(`20_36_35`, `22_45_24`)의 concurrency 리뷰가 지적한 항목(비배열 가드만으로 판별 커버리지를 과대 주장했던 CRITICAL, `reExtractAll` 대칭 테스트 누락)은 이번 라운드에 판별 테스트 추가와 뮤테이션 확인으로 실제로 닫혀 있음을 소스 대조로 확인했다. 남은 항목은 전부 INFO 수준(한 지점의 잔존 거짓 타입 제네릭, `reEmbedAll` 의 pre-existing 비-원자적 2단계 구조, 배포 후 행동 변화 관측 필요성)이며 신규로 생긴 문제가 아니다.

## 위험도

LOW
