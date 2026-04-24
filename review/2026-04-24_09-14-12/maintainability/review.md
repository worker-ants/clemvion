## 발견사항

---

**[WARNING] 동일 이슈가 3개 라운드에 걸쳐 미조치 상태로 반복 지적**
- 위치: `useSavedConfig && configId` (라운드 1·2·3), `as never` 타입 단언 (라운드 1·2·3), `setErrorMessage(null)` 중복 호출 (라운드 2·3), `afterEach(vi.restoreAllMocks)` 무효 호출 (라운드 1·2·3)
- 상세: 위 4건은 각각 경중은 다르지만 WARNING 또는 INFO로 꾸준히 재등장한다. 리뷰 문서 간 RESOLUTION.md가 없고, 후속 라운드의 리뷰어가 이전 라운드 결과를 읽지 않고 독립적으로 동일한 발견을 반복하는 구조다. 리뷰 비용은 누적되지만 코드는 개선되지 않아 리뷰 프로세스 자체의 유지보수성이 낮다.
- 제안: 각 라운드 종료 후 RESOLUTION.md에 "완료/보류/기각" 상태를 기록하고, 다음 라운드 리뷰어는 보류 항목을 건너뛰도록 체계화한다.

---

**[WARNING] `model-combobox.tsx`의 상태 관리 로직이 단일 컴포넌트에 집중 — 수정 비용 선형 증가**
- 위치: `model-combobox.tsx` — `loadMutation`, `onMutate`/`onSuccess`/`onError`, `models` state, `useSavedConfig`
- 상세: Architecture·Side Effect·Concurrency·Performance·Maintainability 5개 전문가 리뷰가 모두 이 컴포넌트의 복잡도를 독립적으로 지적한다. 동일 근원(SRP 위반)에서 파생된 문제가 5개 범주에 걸쳐 WARNING으로 나타나는 것 자체가 컴포넌트 복잡도의 지표다. 현재 핸들러 3개(`onMutate`·`onSuccess`·`onError`)가 `errorMessage`와 `models` 두 state를 서로 다른 방식으로 초기화하는 패턴은 새 state 추가 시 실수의 온상이다.
- 제안: `useModelLoader(provider, apiKey, baseUrl, configId)` 훅으로 네트워크·상태 로직을 분리하면 컴포넌트는 렌더링에만 집중하고, 훅 단위 테스트가 로직을 독립 검증할 수 있다.

---

**[WARNING] `google.client.ts` Gemini API 제약 주석 대량 삭제 — 비자명 WHY 소실**
- 위치: `google.client.ts` — `buildToolConfig`, `sanitizeGeminiSchema`, `buildContents`, `stream()` 전반 (Scope·Documentation·Maintainability 리뷰 3건 공통 지적)
- 상세: `functionResponse`에 `role:'user'`를 사용하는 이유, `thoughtSignature` echo 요구사항, `ObjectSchema.properties` 빈 배열 거부 이유 등은 Gemini 공식 문서에 없거나 찾기 어려운 런타임 제약이다. CLAUDE.md 컨벤션("WHY가 비자명한 경우에만 주석")에 정확히 해당하는 사례임에도 SDK 마이그레이션 과정에서 일괄 삭제됐다. 향후 리팩터링 시 동일한 시행착오가 반복될 가능성이 높다.
- 제안: `// WHY:` 접두사로 핵심 제약 이유만 1줄씩 복원한다. 구현 설명이 아닌 이유 설명이므로 CLAUDE.md 컨벤션에 부합한다.

---

**[WARNING] `isPrivateHost` 함수가 import 블록 사이에 위치**
- 위치: `llm.service.ts` — 파일 상단 구조 (Architecture·Scope·Maintainability·Requirement 리뷰 4건 공통 지적)
- 상세: `import { ... } from '@nestjs/common'` 이후, `import { LLMClient, ... }` 이전에 함수 정의가 끼어 있다. TypeScript 실행에는 문제없으나 lint 규칙(`import/first`) 위반이고, 독자가 파일 구조를 파악하는 비용을 높인다. 같은 파일 내에서 SSRF 관련 주석이 `withTimeout` 위에 오인 배치된 것도 동일한 구조적 혼란에서 비롯된다.
- 제안: 모든 import를 파일 최상단에 모은 후 `isPrivateHost`를 클래스 정의 직전이나 `private static` 메서드로 이동한다.

---

**[WARNING] `30_000` 타임아웃 매직 넘버 두 곳에 하드코딩**
- 위치: `llm.service.ts` — `listModels`(~L202)와 `previewModels`(~L270)
- 상세: 동일 값이 두 곳에 반복돼 하나만 수정하면 불일치가 발생한다. 타임아웃 정책 변경 시 찾아야 할 위치가 코드에 드러나지 않는다.
- 제안: `private static readonly LIST_MODELS_TIMEOUT_MS = 30_000;` 상수로 추출한다.

---

**[INFO] `buildGenerationConfig` 반환 타입 `Record<string, unknown>` — 실질적 `any`**
- 위치: `google.client.ts` — `buildGenerationConfig` 메서드
- 상세: `GenerateContentConfig`로 타입을 구체화하면 SDK 호출 시 잘못된 필드명·타입을 컴파일 단계에서 잡을 수 있다. 현재 구조는 `any`와 동일하게 타입 검사를 우회한다.
- 제안: `@google/genai`의 `GenerateContentConfig` 타입 또는 최소한 `Partial<GenerateContentConfig>`로 반환 타입을 좁힌다.

---

**[INFO] `PROVIDERS_REQUIRING_BASE_URL` 프론트·백엔드 이중 정의**
- 위치: `model-combobox.tsx:34`, `preview-llm-models.dto.ts:12`
- 상세: `azure`나 `local` 식별자가 바뀌면 두 곳을 별도로 수정해야 하며 컴파일 타임에 불일치를 감지할 방법이 없다. 단기 수정 없이 방치하면 프론트가 버튼을 활성화하지만 백엔드가 거부하는 silent mismatch가 발생한다.
- 제안: `@/lib/constants/llm-providers.ts` 공유 상수 파일에 프론트엔드 상수를 추출하고 "백엔드 DTO와 동기화 필요" 주석을 남긴다.

---

**[INFO] 라운드 3 `testing/review.md`가 이미 해결된 WARNING 6건을 미조치로 표시**
- 위치: `review/2026-04-24_08-20-33/testing/review.md` — `model-combobox.test.tsx` 섹션
- 상세: `mockRejectedValue` 미사용, `isPending` UI 미검증, 빈 배열 메시지 미검증, `disabled` prop 미검증 4건이 실제 코드에는 이미 구현되어 있다. 리뷰 문서가 구 버전 기준으로 작성되어 후속 독자가 잘못된 판단을 내릴 수 있다.
- 제안: 리뷰 라운드 시작 전 이전 라운드 RESOLUTION.md를 참조해 이미 조치된 항목을 필터링하는 절차를 프로세스에 추가한다.

---

## 요약

이번 변경 세트에서 유지보수성 위험의 최우선 우려는 두 가지다. 첫째, 동일 이슈(`useSavedConfig && configId`, `as never`, `afterEach(vi.restoreAllMocks)`)가 3개 라운드에 걸쳐 반복 지적되었음에도 코드에 반영되지 않아 리뷰 비용이 낭비되고 있으며, 이는 RESOLUTION 추적 체계 부재에서 기인한다. 둘째, `model-combobox.tsx`가 네트워크 요청, 상태 초기화, 에러 처리를 단일 컴포넌트에 혼재시킨 구조적 복잡도가 5개 전문가 리뷰에서 동시에 지적될 만큼 집중적인 유지보수 부채로 남아 있다. `google.client.ts`의 Gemini API 제약 주석 삭제는 향후 동일한 시행착오를 유발할 수 있는 WHY 소실이며, `isPrivateHost` 함수의 파일 내 위치와 `30_000` 상수 중복은 저비용으로 즉시 개선 가능한 구조적 노이즈다.

## 위험도

**LOW**