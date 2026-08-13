# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `assertRowArray` 의 JSDoc 이 "튜플도 배열이라 이 가드로는 못 걸렀다" 는, 바로 이 PR 이 겪은 결함 클래스를 언급하지 않는다 — 사각지대가 자매 헬퍼(`updateReturningRows`)의 JSDoc·테스트 주석에만 적혀 있다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:1-15` (파일 전체가 이번 PR diff 대상 밖 — 즉 이 결함 수정 PR 이 손대지 않았다)
  - 상세: 이번 PR 의 핵심 서사는 "`assertRowArray` 는 배열인가만 묻는데 `UPDATE/DELETE RETURNING` 튜플도 배열이라 가드가 통과하고 의미는 계속 틀렸다"(`update-returning-rows.ts` 의 Rationale, `assert-row-array.spec.ts:74-78` 주석)이다. 그런데 정작 `assertRowArray` 자신의 JSDoc 은 이 한계를 전혀 언급하지 않는다. 다음에 새 raw SQL 소비 지점을 추가하는 엔지니어가 `codebase/backend/src/common/utils/` 를 훑다가 `assertRowArray` 를 먼저 발견하면(이름이 더 일반적이다), "배열인지 확인해 주는 헬퍼구나" 라고 판단해 UPDATE/DELETE 지점에도 그대로 재사용할 위험이 남는다 — 이는 이 PR 이 "지식이 지점에 갇히면 재발한다" 고 명시적으로 경고한 바로 그 실패 양상이다. 현재는 `update-returning-rows.spec.ts`/`assert-row-array.spec.ts` 의 구조적 가드가 이 회귀를 잡아주지만, 그건 **사후 감지**고 최초 판단을 돕는 문서는 아니다.
  - 제안: `assertRowArray` JSDoc 에 한 줄 교차 참조를 추가한다. 예: "**UPDATE/DELETE 의 RETURNING 결과에는 쓰지 말 것** — TypeORM 이 `[rows, rowCount]` 튜플로 돌려주고 이것도 배열이라 이 가드를 통과한다. 그 경우엔 `updateReturningRows` 를 쓴다."

- **[WARNING]** `updateReturningRows` 자신의 JSDoc 이 "반환 행의 컬럼명은 raw SQL 이라 snake_case 이고 제네릭 `T` 는 검증이 아니라 단언" 이라는, 이 PR 이 실제로 8곳 중 한 곳에서 겪은 2차 결함 교훈을 담지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:1-35`
  - 상세: `auth-oauth.service.ts:25-40` 의 `AuthOAuthStateRow` docstring 은 "앞서 `updateReturningRows<AuthOAuthState>` 로 단언했더니 타입이 거짓말을 했다 — `record.rememberMe` 는 컴파일은 통과하지만 런타임엔 항상 `undefined`" 라는, 실제로 발생했던 결함을 상세히 기록한다. 이 지식은 정확히 `updateReturningRows` 를 호출하는 모든 지점에 적용되는 일반 규칙(raw `.query()` 결과는 ORM 매핑을 안 타 컬럼명이 snake_case)인데, 헬퍼 자신의 JSDoc 에는 이 caveat 이 없다 — `execution-engine.service.ts`·`knowledge-base.service.ts` 의 나머지 7개 호출부는 `<{ id: string }>` 처럼 대소문자 차이가 없는 필드만 써서 우연히 이 함정을 안 밟았을 뿐이다. plan 문서(`update-returning-tuple-shape.md` §후속)는 이 caveat 을 "raw `.query()` 결과의 컬럼명은 snake_case" 규약으로 **spec/conventions 에 승격할 planner 위임 항목**으로 이미 등재했지만, 그 승격을 기다리는 동안에도 이 헬퍼 자체의 JSDoc 에 caveat 한 줄을 남겨 두지 않으면 다음 신규 호출부가 같은 실수를 반복할 표면이 열려 있다. 이는 "처방이 지점마다 흩어져 있던 것이 결함이 계속 재발한 이유" 라는 이 PR 자신의 진단과 정확히 같은 패턴이다.
  - 제안: `updateReturningRows` JSDoc 에 짧게 추가: "**주의**: 반환 행의 키는 raw SQL 그대로의 snake_case 다. entity 타입을 제네릭으로 넘기면 컴파일은 통과하지만 필드가 조용히 `undefined` 가 된다 — 필요하면 snake_case 전용 로컬 인터페이스를 만들 것 (`AuthOAuthStateRow` 참조)."

## 요약

이번 diff(`8332d9a20` 이후 UPDATE/DELETE RETURNING 튜플 shape 결함 수정 + 그 후속 라운드들)는 문서화 관점에서 매우 높은 수준이다 — CHANGELOG 는 신규 결함·소급 영향 두 축을 모두 정확히 기록했고, 4개의 plan 문서(`exec-intake-followups.md`·`ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md`·`spec-update-node-cancellation-shutdown-classification.md`)에 붙은 소급 정정 배너는 이전 라운드의 잘못된 "닫혔다" 선언을 근거·타임스탬프·링크와 함께 정확히 되돌렸고, 인라인 주석은 실측값·왜 그런지·이전엔 왜 못 봤는지를 모두 담아 이후 독자가 같은 오해를 반복하지 않도록 설계돼 있다(`assert-row-array.spec.ts`·`update-returning-rows.spec.ts`·`auth-oauth.service.ts`·`execution-engine.service.ts`·`knowledge-base.service.ts` 전부 동일 수준). 새 테스트 헬퍼(`__testing__/source-scan.ts`)도 존재 이유·설계 근거·사각지대를 JSDoc 에 명시했고 `tsconfig.build.json` 제외 규칙과의 연결(dist 미포함)도 그 안에서 자체적으로 설명된다. 유일하게 남는 갭은 이 PR 이 스스로 경고한 "지식이 한 지점에 갇히면 재발한다" 는 패턴이 신규 헬퍼(`updateReturningRows`)와 그 자매(`assertRowArray`) 자신의 JSDoc 수준에서는 완전히 닫히지 않았다는 점이다 — 교차 참조·caveat 이 개별 호출부(`auth-oauth.service.ts`)나 테스트 주석에만 적혀 있고, 다음 엔지니어가 헬퍼를 고를 때 가장 먼저 읽을 그 헬퍼 자신의 문서에는 없다. 둘 다 한두 줄 추가로 닫히는 낮은 비용의 개선이며, README·API 문서·환경변수 문서 갱신은 이번 변경 성격상 해당 사항이 없다(공개 API·엔드포인트·설정 변경 없음).

## 위험도

LOW
