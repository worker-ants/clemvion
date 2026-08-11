# 테스트(Testing) Review

## 대상

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts`
- `plan/in-progress/typescript-toolchain-followups.md`

실측: `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts src/lib/repo-guards/__tests__/typescript-toolchain.test.ts` → 2 test files / 76 tests 전부 통과. `npx tsc --noEmit -p .` → exit 0. plan 의 "양쪽 가드 통과" · "`tsc --noEmit` 통과" 주장은 재현됨.

## 발견사항

- **[WARNING]** `repoRoot()` 의 fail-closed throw 분기(마커를 `MAX_DEPTH`=12 이내에 못 찾을 때)가 테스트되지 않고, 현재 구조로는 테스트가 불가능하다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:25-38` (함수 `repoRoot`)
  - 상세: `repoRoot()`는 시작 디렉터리를 `__dirname` 으로 하드코딩하고 위로 12단계까지 `fs.existsSync` 로 탐색하다 못 찾으면 throw 한다. 시작 디렉터리나 존재성 검사 함수를 주입받을 파라미터가 없어 이 throw 분기를 합성 입력으로 겨냥할 방법이 없다. 실측(`grep -rn "repoRoot" src/lib/repo-guards/__tests__/*.test.ts`) 결과 0건 — 두 테스트 파일 어디에서도 `repoRoot` 를 직접 호출하지 않는다. 현재는 `_shared.ts` 의 `export const ROOT = repoRoot()` 가 import 시점에 평가되므로, 저장소가 정상인 한 happy path 만 매 테스트 실행마다 부수효과로 검증될 뿐이고, MAX_DEPTH 소진 시 정확한 경계·에러 메시지는 어떤 assertion 으로도 고정돼 있지 않다. 같은 PR 에서 `discoverWorkspaceDirs` 는 정확히 이런 이유(합성 입력으로 fail-closed 를 겨냥할 수 없었던 문제, plan §2)로 `readLines` 를 주입 가능하게 바꿨는데, 동일한 패턴이 `repoRoot` 에는 비대칭적으로 적용되지 않았다.
  - 제안: `repoRoot(startDir: string = __dirname, exists = fs.existsSync)` 형태로 주입점을 열고, marker 가 없는 합성 디렉터리 체인을 넣어 throw 메시지를 단언하는 테스트를 추가한다. 최소 대안으로 `validateWorkspacePatterns` 처럼 "탐색"과 "검증"을 분리해 검증부만이라도 순수 함수로 뽑는 방법도 있다.

- **[INFO]** plan 체크리스트의 "뮤테이션 8종 전부 RED" 주장이 diff 만으로는 재현·검증 불가능한 자기보고 증거다.
  - 위치: `plan/in-progress/typescript-toolchain-followups.md` — 체크리스트 §TEST WORKFLOW 항목("뮤테이션 8종 전부 RED (fail-closed 3축 · 통과 경로 · 호출부 · 공유 파서 인라인 주석 · repoRoot marker · readLines 기본값)")
  - 상세: 어떤 변형을 어디에 가했는지 코드나 문서에 흔적이 남아 있지 않다. 특히 "repoRoot marker" 항목은 위 WARNING 처럼 스위트 안에 전용 assertion 이 없으므로, 이 주장이 "ROOT 계산이 깨지면 import 자체가 죽어 전체 스위트가 실패한다"는 간접 효과에 의존했을 가능성이 있다 — 그 자체는 fail-closed 로 유효하지만, 다음 사람이 재현할 수 있는 형태로 남아 있지 않다.
  - 제안: 최소한 각 뮤테이션이 무엇이었는지 plan 문서에 1줄씩 남기거나, 재현 가능한 회귀 테스트(위 WARNING 해소분 포함)로 스위트에 편입시킬 것.

## 긍정적으로 확인된 부분

- `validateWorkspacePatterns` 분리는 `null`(키 부재)·`[]`(항목 부재)·정상 통과 세 경우를 모두 갈라 단언하고, 호출부(`discoverWorkspaceDirs`)에서 실제로 그 검증을 태우는지까지 `readLines` 주입으로 별도 테스트했다(plan 이 명시한 "헬퍼 테스트 ≠ 호출부 테스트" 교훈을 실제로 적용). `?? []` 류 뮤턴트를 헬퍼 테스트만으로는 못 잡는다는 근거도 타당하다.
- `listAtPath` 의 인라인 주석 제거 테스트 추가는 실측 뮤테이션으로 드러난 실제 커버리지 공백(주석 제거 로직을 지워도 기존 스위트가 초록이었음)을 정확히 겨냥한다.
- `_shared.ts` 분리로 `internal-package-registration-guard.ts` 는 재export 로 기존 소비처 계약을 유지했고, 실측상 기존 테스트(내부 패키지 등록 가드) 회귀 없이 통과함을 확인했다. `blockRange`/`findKeyLine` 은 별도 export 표면을 늘리지 않고 `listAtPath`/`blockScalarAtPath` 를 통해서만 간접 커버되는데, 이는 기존 관례(비공개 헬퍼는 소비 함수를 통해 간접 검증)와 일관돼 문제로 보지 않는다.
- mock 사용은 없고 전부 리터럴 값 주입(순수 함수 DI) 또는 실제 파일시스템 실측이며, 실제 동작과의 괴리가 없다. 테스트 간 상태 공유는 read-only 상수뿐이라 격리 문제도 없다.

## 요약

이번 변경은 순수 리팩터(공유 프리미티브 `_shared.ts` 분리, `validateWorkspacePatterns` 추출 + DI, JSDoc/타입 정리)이며 테스트 커버리지는 순감소가 아니라 순증가다 — 새 synthetic 테스트가 실측 뮤테이션으로 확인된 실제 공백(listAtPath 인라인 주석, discoverWorkspaceDirs 의 검증 우회)을 정확히 메웠고, 기존 스위트는 리팩터 후에도 그대로(오히려 확장된 채) 통과함을 실측으로 확인했다. 유일한 남은 갭은 새로 옮겨진 `repoRoot()` 자신의 fail-closed throw 분기로, 이 PR 이 도입한 DI 패턴(readLines)과 대칭을 이루지 못해 테스트도 없고 현재 시그니처로는 테스트도 불가능하다 — 이 파일이 두 가드의 공용 기반(`ROOT`)이 되므로 조용히 깨지면 파급이 크다는 점에서 WARNING 으로 판단했다.

## 위험도

LOW
