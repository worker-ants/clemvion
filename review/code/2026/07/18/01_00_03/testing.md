# 테스트(Testing) 리뷰 — 레이어 가드 메시지 뒤바뀜 탐지 완결 + JSDoc 스코프 갱신

## 검증 방법

정적 리뷰에 더해 실측으로 확인했다.

- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → 51/51 통과.
- **직접 mutation 재현**: `eslint.config.mjs` 의 `message: STATIC_IMPORT_MSG` → `message: DYNAMIC_IMPORT_MSG` 로 변조 후 재실행 → 신규 negative 단언(`absent: [DYNAMIC_MARK]`)이 정확히 실패로 잡음(`AssertionError: expected ... not to contain '동적 import() 로도'`). 원복 후 51/51 재확인.
- **두 번째 mutation 재현**: `message: REQUIRE_MSG` → `message: DYNAMIC_IMPORT_MSG` (require↔dynamic 뒤바뀜) 로 변조 후 재실행 → 동일하게 즉시 실패로 잡음. 원복 확인.
- `RESOLUTION_HINT` 상수 원문을 직접 확인해 `DYNAMIC_MARK`(`"동적 import() 로도"`)·`REQUIRE_MARK`(`"require() 로도"`) 가 공통 힌트 문구에 우연히 포함돼 있지 않음을 확인(negative 단언의 false-positive 위험 없음).
- frontend 전체 회귀: `npx vitest run` → 280 파일 / 5578 테스트 통과 (1 skipped, 사전부터 skip). 이번 diff 로 인한 회귀 없음.
- `npx eslint`, `npx prettier --check` 로 diff 대상 테스트 파일 스타일 확인(prettier 경고는 프로젝트가 lint=eslint 만 게이트로 쓰는 기존 관례상 실제 게이트 아님 — 조치 불필요).

## 발견사항

- **[INFO]** mutation 검증이 RESOLUTION.md 상의 수동 프로즈 기록에만 의존, 자동화된 mutation-testing 하네스는 없음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:119-147` (신규 `present`/`absent` 단언), `review/code/2026/07/18/00_33_58/RESOLUTION.md` 의 "재검증 4종" 서술
  - 상세: 이번 fix 가 주장하는 "상수 뒤바뀜 4종 전부 탐지"는 이번 리뷰에서 2종(STATIC→DYNAMIC, REQUIRE→DYNAMIC)을 직접 재현해 실측 확인했고, 나머지 2종(STATIC→REQUIRE, DYNAMIC→STATIC)도 `present`/`absent` 설계가 세 상수를 "마크 유무 조합"으로 상호 배타 식별하는 구조라 수학적으로 동일하게 잡힘(각 상수의 지문이 서로 다름: static=두 마크 모두 없음, dynamic=DYNAMIC_MARK 만, require=REQUIRE_MARK 만). 다만 이 보장이 코드 자체의 자동 검증이 아니라 이번 리뷰·직전 리뷰의 사람 수행 mutation 재현에 의존한다 — 향후 세 번째 진입점이 추가되거나 마크 문구가 서로 겹치게 바뀌면 이 성질이 조용히 깨질 수 있고, 그 회귀를 잡는 유일한 방법은 다시 사람이 mutation 을 수행하는 것뿐이다.
  - 제안: 조치 불필요(현재 스코프에선 과설계). 다만 이 파일이 향후 진입점을 추가한다면(예: `export =` 형태), 신규 마크가 기존 두 마크와 겹치지 않는지 확인하는 절차를 헤더 주석에 명시해 두면 다음 리뷰어의 재현 비용을 줄일 수 있다.

- **[INFO]** `GUARD_BLOCK_KEY` 단일 블록 가정이 향후 블록 분리 시 "에러 없는 조용한 커버리지 손실"로 이어질 수 있음 (architecture 리뷰와 동일 코드 대상, 테스트 관점에서 재확인)
  - 위치: `eslint-layering-guard.test.ts:26-38`
  - 상세: architecture 리뷰어가 이미 지적한 것과 같은 지점이지만, 테스트 관점에서 구체화하면: `eslint.config.mjs` 가 향후 `src/lib/**` 전용 블록과 `src/types/**` 전용 블록으로 분리될 경우, `layeringBlocks` 필터는 `CONFIG_LOWER_LAYERS[0]`(`"src/lib/**"`) 를 포함하는 블록만 매칭해 `src/types/**` 전용 블록의 규칙 변경(예: `src/types` 블록만 severity 를 `warn` 으로 낮추는 회귀)을 **첫 번째 describe 스위트가 감지하지 못한다** — `mergedRules` 가 여전히 비어있지 않아(67행 fail-open 에러 미발동) 테스트는 계속 초록으로 남는다. 다만 두 번째 스위트("가드 스코프 — 실제 ESLint 경로 매칭")는 실제 `ESLint` API 로 `src/types/**` 파일에 대해 severity 와 무관하게 "에러 발생 여부"만 확인하므로(코드 226행대 `expect(await errorsAt(...)).not.toHaveLength(0)`), severity 강등(error→warn)은 이 스위트도 못 잡는다 — `errorsAt` 은 `no-restricted-imports`/`no-restricted-syntax` ruleId 로만 필터링하고 severity 값 자체는 검증하지 않는다. 즉 "두 계층이 분리된 블록으로 리팩터되고 그 중 하나만 severity 가 약화되는" 복합 시나리오는 현재 두 스위트 어느 쪽도 잡지 못하는 조합형 커버리지 갭이다.
  - 제안: 즉시 조치 불필요(현재 단일 블록 구조에선 실제 도달 불가능한 시나리오). 다만 블록을 분리하는 리팩터가 실제로 일어난다면, 두 번째 스위트의 `errorsAt` 결과에서도 severity(`m.severity === 2`)를 검증하도록 함께 확장해야 이 조합형 갭이 재발하지 않는다 — 첫 스위트의 severity 단언(`ruleSeverity` 기반, L166-170)이 config 파생 `mergedRules` 에만 적용되고 실제 ESLint 실행 결과(`errorsAt`)에는 적용되지 않는다는 점을 리팩터 체크리스트에 남겨둘 가치가 있다.

## 확인된 양호 사항

- **테스트 용이성**: 프로덕션 메시지 상수(`STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`)를 복제하지 않고 실제 `eslint.config.mjs` 를 import 해 검증하는 기존 SoT 결합 패턴을 유지 — 테스트가 프로덕션 로직과 독립적으로 드리프트할 위험이 낮다.
- **엣지 케이스 설계**: `present`/`absent` 구조가 "공통 부분 문자열" 함정(static 메시지가 dynamic·require 메시지의 부분 문자열)을 정확히 겨냥 — 세 진입점을 "마크 유무의 조합"으로 상호 배타 식별하는 설계는 견고하며, 직접 재현한 2가지 mutation 모두 즉시 실패로 잡혔다.
- **회귀 테스트**: 51개 케이스(bare·alias·상대경로·백틱·`import type`·re-export·근접 오탐·`src/lib/types` vs `src/types` 혼동)가 여전히 유효하며, 이번 diff 로 인한 실패나 스킵 없음. frontend 전체 스위트(5578 테스트) 회귀 없음.
- **테스트 격리**: 두 describe 스위트 모두 파일시스템 쓰기·전역 상태 변경이 없고, `beforeAll` 로 스코프 내 `ESLint` 인스턴스를 생성해 순서 의존성 없이 독립 실행 가능. `Linter#verify` 는 호출마다 순수하게 동작해 공유 `linter` 인스턴스를 여러 케이스가 재사용해도 상호 오염이 없음(직접 확인: `it.each` 반복 실행에서 상태 누수 징후 없음).
- **Mock 적절성**: 이 테스트는 mock/stub 을 전혀 쓰지 않고 실제 `Linter`/`ESLint` API 로 검증한다 — 실제 동작과의 괴리 위험이 구조적으로 없음.

## 요약

이번 diff 의 핵심(파일 1)은 직전 라운드(00_33_58)가 지적한 테스트 관점 WARNING#1(static 진입점 메시지 뒤바뀜 미탐지)을 겨냥한 fix 이며, `present`/`absent` negative 단언 재설계로 실제 문제를 해결했음을 직접 mutation 재현(STATIC→DYNAMIC, REQUIRE→DYNAMIC 2종)으로 확인했다. RESOLUTION.md 가 주장하는 나머지 2종(STATIC→REQUIRE, DYNAMIC→STATIC)도 세 메시지 상수의 "마크 유무 지문"이 상호 배타적으로 설계돼 동일 논리로 탐지됨을 구조적으로 확인했다. frontend 전체 회귀(5578 테스트)도 통과해 부수 피해 없음. 새로 식별한 갭은 모두 INFO 수준으로, (1) mutation 검증 자체가 자동화되지 않고 사람 수행 재현에 의존한다는 점, (2) 향후 `eslint.config.mjs` 블록이 계층별로 분리되면 severity 강등이 두 스위트 어느 쪽에서도 잡히지 않는 조합형 커버리지 갭이 생길 수 있다는 점이며, 둘 다 현재 구조에서는 실제 도달 불가능하거나 즉시 조치가 필요한 수준이 아니다. Critical/Warning 급 테스트 갭 없음.

## 위험도
NONE
