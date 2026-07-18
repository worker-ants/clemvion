STATUS=success testing review complete

### 발견사항

- **[WARNING]** 리팩터링의 핵심 변경(메시지 생성 로직)이 실제로는 어떤 테스트로도 검증되지 않음
  - 위치: `codebase/frontend/eslint.config.mjs` (`STATIC_IMPORT_MSG` / `DYNAMIC_IMPORT_MSG` / `REQUIRE_MSG`, `LAYERS_LABEL`, `RESOLUTION_HINT`), `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (`layeringErrors`, `errorsAt`)
  - 상세: 이번 diff 의 실질 내용은 하드코딩된 3개 메시지 문자열을 `LOWER_LAYERS.join(" · ")` 로 파생되는 `LAYERS_LABEL` + 공용 `RESOLUTION_HINT` 로 재구성한 것이다. 그런데 두 스위트 모두 `errors.length` / `errors.every(m => m.severity === 2)` 만 검증하고 `m.message` 내용은 어디서도 assertion 하지 않는다 (`grep -n "\.message"` 결과 fatal 파싱에러 처리 1건뿐, 실제 lint 메시지 텍스트 비교는 0건). 템플릿 리터럴 변수 오타(`${LAYERS_LABEL}` ↔ `${RESOLUTION_HINT}` 뒤바뀜, 계층 라벨 누락 등)가 나도 config import 자체는 여전히 성공하므로 47개 테스트가 그대로 초록으로 남는다. 이 메시지는 위반 시 개발자에게 노출되는 유일한 해소 안내문이라 텍스트 정확성이 기능적으로 중요한데, 방어선이 코드 리뷰(사람 눈)뿐이다.
  - 제안: 최소 1개 케이스에서 `errorsAt(...)`/`layeringErrors(...)` 결과의 `.message` 가 `LAYERS_LABEL`(예: `"src/lib/** · src/types/**"`)과 `spec/conventions/frontend-layering.md §3` 링크 문자열을 포함하는지 `toContain` 으로 고정할 것.

- **[INFO]** 스코프 스위트에 `src/types` 근접 오탐(near-miss) 경계 케이스 부재
  - 위치: `eslint-layering-guard.test.ts` `describe("가드 스코프 — 실제 ESLint 경로 매칭", ...)`
  - 상세: 기존 콘텐츠 스위트는 `@/components-legacy` 같은 접두어만 공유하는 근접 오탐을 명시적으로 고정해 정규식 앵커 완화 mutation 을 잡는다. 반면 새 스코프 스위트는 `src/lib/**` · `src/types/**` 가 실제로 차단되는지와 `src/components`/`src/app` 이 차단되지 않는지만 확인할 뿐, `src/types-legacy/**` 나 `src/typescript/**` 같은 인접 디렉터리가 오인 매칭되지 않는지는 검증하지 않는다. glob 리터럴 매칭이라 현재 위험은 낮지만, 이 PR 이 다른 축(문자열/백틱, severity, 파서)에서는 근접 오탐까지 챙기는 수준의 엄격함을 보이는 것과 비교하면 비대칭이다.
  - 제안: `it.each`에 `"src/types-legacy/probe.ts"` / `"src/typescript/probe.ts"` 같은 근접 디렉터리를 "차단되지 않아야 한다" 케이스로 추가.

- **[INFO]** spec 이 명시한 `src/lib/types/` vs `src/types/` 혼동 지점에 대한 회귀 고정 테스트 없음
  - 위치: `spec/conventions/frontend-layering.md` §1 ("`src/lib/types/` (예: `trigger.ts`) 는 `src/types/` 와 별개다"), `eslint-layering-guard.test.ts`
  - 상세: spec 이 스스로 헷갈리기 쉬운 지점이라고 지목한 케이스인데도, 이를 코드로 고정한 테스트가 없다. 예컨대 향후 누군가 `LOWER_LAYERS` 를 정규식/glob 으로 리팩터링하다 `src/*/types/**` 식으로 잘못 일반화해도 잡을 케이스가 없다.
  - 제안: 스코프 스위트에 `"src/lib/types/probe.ts"` 가 (types 블록이 아니라) `src/lib/**` 블록으로만 차단되는지 확인하는 케이스를 추가하면 spec 의 경고를 코드 레벨로 고정할 수 있다.

### 검증 메모 (직접 실행)

- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → 47/47 통과 (1.7s), 회귀 유효함을 확인.
- plan 문서가 주장하는 "mutation 검증" 3종 중 2종을 직접 재현해 실측 확인: `LOWER_LAYERS` 에서 `"src/types/**"` 제거 → 6 fail / `"src/types/**"` → `"src/types"` (trailing `/**` 누락, 중첩 미매칭) → 6 fail. 두 경우 모두 새로 추가된 "가드 스코프" 스위트만 실패하고 기존 콘텐츠 스위트는 그대로 통과 — 관심사 분리(내용 vs 경로)가 실제로 작동함을 확인. 원복 후 `git status --porcelain` 클린 확인.
- 이 스코프 스위트는 실제 `ESLint({ cwd })` 로 `eslint.config.mjs` 를 resolve 하는 통합 테스트에 가깝다 — 이전 SUMMARY(WARNING#1·#2, 2026-07-17 16:33 리뷰)가 지적한 "합성 config 가 `files:` glob 매칭을 우회해 스코프를 증명 못한다"는 gap 을 정확히 겨냥해 메운 것으로 확인된다. mock 을 추가한 게 아니라 오히려 기존의 과도한 합성(mock 유사) config 의존을 실제 API 호출로 대체한 방향이라 타당하다.
- `EXPECTED_LOWER_LAYERS` 를 config 에서 가져오지 않고 독립적으로 하드코딩해 `CONFIG_LOWER_LAYERS` 와 대조하는 방식은, config 의 glob 배열 자체가 삭제되는 mutation 이 기대값까지 함께 지워 false green 이 되는 것을 정확히 방지한다 — 잘 설계된 패턴.
- `conversation-utils.ts`, `rag-types.ts`, `plan/*.md`, `spec/conventions/frontend-layering.md` 변경은 주석/문서 전용이라 별도 테스트 필요 없음.

### 요약

핵심 코드 변경(`eslint.config.mjs` 의 `LOWER_LAYERS` 도입 + 메시지 상수화)은 새로 추가된 "가드 스코프" 스위트가 실제 ESLint API 로 경로 매칭을 직접 검증하면서 이전 리뷰가 지적했던 "합성 config 가 스코프 검증을 우회한다"는 근본적 gap 을 정확하게 메웠고, 직접 재현한 mutation 테스트(2종)로 그 실효성도 확인했다. 기존 콘텐츠 스위트(문자열/백틱/severity/파서 정합)도 회귀 없이 47/47 그대로 통과한다. 다만 이번 diff 의 실질적 변경분인 메시지 텍스트 생성 로직 자체는 어떤 테스트도 내용을 검증하지 않아 조용히 깨질 수 있는 gap 이 남아 있고, `src/types` 근접 오탐·`src/lib/types` 혼동 지점처럼 spec 이 스스로 경고한 엣지 케이스가 테스트로 고정되지 않은 점은 이 PR 의 다른 부분에서 보이는 엄격함과 비교하면 아쉬운 비대칭이다. 전체적으로 구조/설계는 견고하고 회귀 위험은 낮다.

### 위험도
LOW
