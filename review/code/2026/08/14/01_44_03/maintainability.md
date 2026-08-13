# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 신규 테스트 전용 폴더명 `__testing__` 이 이미 존재하는 동일 목적 컨벤션(`__test-utils__`)을 재사용하지 않고 네 번째 변종을 만들었다.
  - 위치: `codebase/backend/src/common/utils/__testing__/source-scan.ts` (신규 디렉토리). 비교 대상: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts`, `codebase/backend/src/modules/integrations/__test-utils__/`, `codebase/backend/src/repo-guards/__tests__/`, `codebase/backend/src/modules/execution-engine/__test__/`.
  - 상세: 저장소에는 이미 "테스트 전용·dist 미포함 헬퍼" 를 담는 디렉토리 이름이 `__test-utils__`/`__tests__`/`__test__` 세 가지로 흩어져 있었다. 이번 PR 은 정확히 같은 목적(`source-scan.ts` 자신의 docstring: "테스트 전용이다(`tsconfig.build.json` 이 `__testing__` 을 제외해 dist 에 실리지 않는다)")으로 `__testing__` 이라는 다섯 번째... 아니 네 번째 변종을 새로 만들었고, 그 결과 `tsconfig.build.json:7` 에 `**/__testing__/**` 전용 exclude 항목을 추가로 넣어야 했다. 반대로 이미 있던 `common/__test-utils__/workspace-id-fixtures.ts` 같은 비-spec `.ts` 헬퍼는 `tsconfig.build.json` 의 exclude 목록(`node_modules`/`test`/`dist`/`**/*spec.ts`/`**/__testing__/**`)에 걸리지 않아 여전히 `src/**/*` 에 포함돼 `dist` 빌드에 실릴 수 있는 상태로 남아 있다 — 즉 "테스트 전용 폴더는 빌드에서 빠진다" 는 이번 PR 이 세운 전제가 기존 세 변종에는 적용되지 않는다.
  - 제안: 새 폴더를 만들기 전에 기존 `__test-utils__` 컨벤션을 재사용하거나(가능하면 `common/utils/__test-utils__/source-scan.ts`), 최소한 "네 변종이 공존하고 그중 셋은 build exclude 밖" 이라는 사실을 후속 정리 항목으로 plan 에 남겨 언젠가 하나로 통일한다.

- **[INFO]** `countCalls` 가 호출자 제공 `name` 문자열을 이스케이프 없이 그대로 `RegExp` 리터럴에 삽입한다.
  - 위치: `codebase/backend/src/common/utils/__testing__/source-scan.ts:47-49` (`export function countCalls`, `const pattern = new RegExp(\`\\b${name}[<(]\`, 'g')`)
  - 상세: 이 헬퍼는 자신의 docstring에서 "세 번째 가드가 생겨도 여기만 고치면 되도록" 이라고 스스로를 향후 재사용을 전제한 단일 출처(SoT)로 선언한다. 현재 호출부(`assertRowArray`, `updateReturningRows`, 테스트의 `'a'`/`'foo'`)는 전부 정규식 특수문자가 없는 평범한 식별자라 당장 문제는 없지만, 함수 시그니처만 보고 재사용하는 다음 호출자가 `.`·`(`·`$` 등이 섞인 이름(예: 네임스페이스가 붙은 심벌)을 넘기면 그 문자가 리터럴이 아니라 정규식 메타문자로 해석돼 카운트가 조용히 틀어질 수 있다 — 이 파일 전체가 "가드가 약해지는 방향을 막는다" 는 취지로 하드닝돼 온 것과 결이 다르다.
  - 제안: `name` 을 `RegExp` 에 넣기 전 `name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 류로 이스케이프하거나, 최소한 JSDoc 에 "호출자는 정규식 안전 식별자만 넘길 것" 이라는 계약을 명시.

- **[INFO]** 두 "자매 지점 전수" 구조적 회귀 가드가 여전히 파일 로딩 보일러플레이트를 각자 인라인으로 반복한다 — 이미 직전 라운드(`22_45_24`)에서 INFO로 지적·"급하지 않음"으로 유예된 항목이 이번 diff에도 그대로 남아 있다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:55` (`const SRC = join(__dirname, '..', '..')`) / `codebase/backend/src/common/utils/update-returning-rows.spec.ts:51` (동일한 `const SRC = join(__dirname, '..', '..')`)
  - 상세: `countCalls`/`stripComments` 추출로 "주석 처리 방식" 의 중복은 이번에 해소됐지만, `SRC` 계산·`readFileSync(join(SRC, rel), 'utf8')` 루프·결과 비교 자료구조(한쪽은 `{rel,queries,guards}` 객체 배열 `toEqual`, 다른 쪽은 `it.each` 2-tuple + 별도 `it()`)는 여전히 각자 다시 구현돼 있다. 새로운 결함은 아니고 이미 유예 처리된 항목이라 이번 라운드에서 강제할 사안은 아니다.
  - 제안: 세 번째 유사 가드가 생기는 시점에 `SRC`/`readFileSync` 조합만이라도 공유 유틸로 뽑는 것을 고려 (기존 처분 그대로 유지).

- **[INFO]** e2e 헬퍼 `seedState` 의 SQL 파라미터가 `VALUES` 컬럼 순서와 다르게 바인딩된다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:34-46` (`async function seedState`, `VALUES ($1, $2, 'login', $4, NOW() + ($3::text || ...)::interval)`)
  - 상세: `values` 배열은 `[state, provider, String(expiresInMs), rememberMe]` 순서($1~$4)인데, VALUES 절에서는 `$1, $2, 'login', $4, …$3…` 순으로 등장해 `$3`(만료 간격)이 `$4`(remember_me) 뒤에서 참조된다. Postgres 는 위치 번호로 바인딩하므로 동작은 정확하지만, 다음에 컬럼을 하나 추가·재배열하는 사람이 번호와 등장 순서가 어긋난 상태에서 실수하기 쉽다.
  - 제안: `values` 배열 순서를 SQL 등장 순서(`state, provider, remember_me, expiresInMs`)에 맞추거나, 최소 한 줄 주석으로 "`$3` 은 간격 계산에만 쓰여 뒤에 나온다" 를 명시.

## 요약

이번 diff 는 이미 3차례(`20_36_35`→`22_45_24`→`23_07_11`)의 리뷰-조치 라운드를 거친 뒤의 최종 형태로, 신규 헬퍼(`updateReturningRows`)와 그 자매(`assertRowArray`)는 각각 짧고 단일 책임이며 "왜 이 방식인가" 를 근거·실측과 함께 상세히 문서화해 가독성이 높다. 소비 지점 변경(execution-engine·knowledge-base·auth-oauth)도 기존 패턴(`assertRowArray` 호출 대체)을 그대로 계승해 컨벤션 일관성을 지켰고, 함수 길이·중첩·매직 넘버 측면에서 새로 도입된 문제는 없다(`retryFailedDocuments` 등 기존의 얕지 않은 중첩은 이 PR 이 만든 것이 아니라 손대지 않은 채 상속됨). 다만 (1) 새 테스트 전용 폴더 `__testing__` 이 기존 세 변종(`__test-utils__`/`__tests__`/`__test__`)과 통일되지 않은 채 추가돼 네이밍 일관성이 흔들리고 그 부수 효과로 build-exclude 규칙의 비대칭이 드러났으며, (2) 공유 유틸 `countCalls` 가 향후 재사용을 전제로 문서화됐음에도 입력 이스케이프를 하지 않는 점, (3) 이미 유예된 두 스펙 파일 간 사소한 구조 중복이 지속되는 점, (4) e2e 헬퍼의 SQL 파라미터 순서 가독성은 눈에 띄는 개선 여지다. 전부 INFO~WARNING 수준으로 기능적 위험은 없다.

## 위험도

LOW
