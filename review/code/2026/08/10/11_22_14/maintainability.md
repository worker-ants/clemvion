# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `_shared.ts` 로 이관된 `listAtPath`/`blockRange`/`findKeyLine` 은 `repoRoot` 와 달리 소유 모듈 자체의 직접 테스트가 없다 — 정확히 이 PR 이 `repoRoot` 에 대해 고쳤다고 명시한 바로 그 위험 패턴이 옆 심볼들엔 남아 있다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:74`(`blockRange`), `:87`(`findKeyLine`), `:104`(`listAtPath`) / `codebase/frontend/src/lib/repo-guards/__tests__/shared.test.ts:8-10`(헤더 주석)
  - 상세: `shared.test.ts` 헤더는 "소유 모듈에 회귀 테스트가 없고 한 소비자 스위트(`internal-package-registration.test.ts`)에만 간접 커버리지가 있는 상태였다"·"소비자가 자기 사정으로 그 단언을 줄이면 공유 프리미티브가 조용히 무방비가 된다" 는 근거로 `repoRoot` 를 위해 신설됐다. 그런데 같은 이관 대상인 `listAtPath`/`blockRange`/`findKeyLine` 은 이 새 파일에서 다뤄지지 않고, 여전히 `internal-package-registration-guard.ts` 의 재export 를 거쳐 `internal-package-registration.test.ts` 가 (소비자 관점에서) 간접 검증하는 구조 그대로다. 특히 `listAtPath` 는 한때 그 파일이 직접 소유·직접 export 하던 함수였으나 지금은 소유권만 `_shared.ts` 로 옮겨졌을 뿐 테스트는 그대로 소비자 스위트에 남아 있다. 미래에 등록 가드에서 `listAtPath` 재export 줄이 "쓰지도 않는데 왜 여기 있나" 로 정리되면, 그 순간 소비자 테스트도 같이 지워질 개연성이 높고 `_shared.ts` 의 YAML 서브셋 파서 전체가 무방비가 된다 — 이 PR 이 `repoRoot` 에서 막으려던 것과 동일한 실패 형태다.
  - 제안: `listAtPath`(및 필요하면 `blockRange`/`findKeyLine`)의 최소 회귀 테스트를 `shared.test.ts` 로 옮기거나 추가해, `_shared.ts` 의 모든 공개 심볼이 소유 모듈 안에서 자기 완결적으로 방어되게 한다. 최소한 `shared.test.ts` 헤더 주석에 "listAtPath 커버리지는 의도적으로 소비자 스위트에 남겨둔다" 는 판단 근거를 남겨, 나중에 이 비대칭이 실수인지 의도인지 구분 가능하게 한다.

- **[INFO]** `loadTypescriptFrom` 위에 JSDoc 블록과 `//` 라인 주석 블록이 분리돼 이어진다 — 반환 타입 선택 근거가 JSDoc 밖에 있어 IDE hover 로는 드러나지 않는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:201-208`
  - 상세: `/** ... */` JSDoc 이 203번 줄에서 닫힌 직후 204~207번 줄에 `// 반환 타입은 unknown 이다...` 로 시작하는 별도의 `//` 주석 블록이 이어지고, 그다음 208번 줄에 `export function loadTypescriptFrom` 이 온다. 이 파일의 다른 함수들은 함수 바로 위 주석이 전부 단일 JSDoc 블록으로 통합돼 있는데(예: `missingCompilerApi`, `parseMajor`), 여기만 "동작 설명(JSDoc)"과 "타입 선택 근거(라인 주석)"가 다른 스타일로 나뉘어 함수를 hover 했을 때 반환 타입에 대한 근거가 보이지 않는다.
  - 제안: 반환 타입 근거 문단을 JSDoc 블록 안으로 합치거나(`@returns` 절 활용 등), 최소한 같은 파일의 다른 함수처럼 하나의 주석 블록으로 통일한다.

## 요약

이번 변경은 `internal-package-registration-guard.ts` 와 `typescript-toolchain-guard.ts` 가 서로 무관한 책임까지 끌어다 쓰던 결합을 끊고, 실제로 두 가드가 공유하는 것(`repoRoot`/`ROOT`/YAML 서브셋 파서/`PackageManifest`)만 중립 모듈 `_shared.ts` 로 옮긴 잘 설계된 리팩터다. 소비처 계약을 재export 로 유지하면서 소유권만 이전하고, "무엇을 공유 모듈에 둘지"의 기준을 파일 헤더에 명문화했으며, fail-closed 검증(`validateWorkspacePatterns`)과 루트 탐색(`repoRoot`)을 각각 순수 함수·주입 가능한 시그니처로 뽑아 종전 "합성 입력으로 겨냥 불가능"했던 사각을 실제 테스트로 메웠다. 함수 길이·중첩·네이밍·매직 넘버 처리 모두 기존 컨벤션과 일관되고, 각 설계 결정에 대한 근거 주석이 촘촘해 가독성도 높다. 유일하게 지적할 만한 것은 이번 리팩터가 스스로 세운 "공유 프리미티브는 소유 모듈 안에서 직접 테스트돼야 한다"는 원칙을 `repoRoot` 에만 적용하고 함께 이관된 `listAtPath`/`blockRange`/`findKeyLine` 에는 적용하지 않은 비대칭(WARNING)과, 한 함수의 주석 스타일이 파일 내 다른 함수와 다르게 쪼개진 사소한 일관성 흠(INFO)뿐이다.

## 위험도

LOW
