### 발견사항

---

**[WARNING] `buildGenerationConfig`가 `Record<string, unknown>` 반환 — 타입 정보 소실**
- 위치: `google.client.ts` — `buildGenerationConfig` 메서드
- 상세: 반환 타입이 `Record<string, unknown>`으로 선언되어 있어 실질적으로 `any`와 같다. `config` 객체를 `ai.models.generateContent()`에 넘길 때 컴파일러가 잘못된 필드명이나 타입 불일치를 잡아주지 못한다.
- 제안: `@google/genai` SDK가 노출하는 `GenerateContentConfig` 타입(혹은 그 서브셋을 직접 정의한 인터페이스)으로 반환 타입을 구체화한다.

---

**[WARNING] 스트림 청크를 익명 인라인 타입으로 캐스팅**
- 위치: `google.client.ts` — `stream()` 내부 `for await` 루프
- 상세: `const chunk = raw as { candidates?: ...; usageMetadata?: ... }`처럼 중첩 익명 타입을 루프 바디 안에 인라인으로 선언하고 있다. 향후 SDK가 업데이트되어 필드가 바뀔 때 이 타입을 찾아 수정하기 어렵고, `chat()` 응답 파싱 코드와 구조가 중복된다.
- 제안: 파일 상단에 `interface GeminiChunk` 등 네임드 인터페이스를 추출한다.

---

**[WARNING] 타임아웃 매직 넘버 `30_000` 중복**
- 위치: `llm.service.ts` — `listModels`(line ~202)와 `previewModels`(line ~270) 두 곳
- 상세: 동일한 30초 타임아웃 값이 하드코딩되어 두 곳에 반복된다. 하나만 변경하면 불일치가 생긴다.
- 제안: `private static readonly LIST_MODELS_TIMEOUT_MS = 30_000;` 상수로 추출한다.

---

**[WARNING] `isPrivateHost` 함수가 import 블록 사이에 끼어 있음**
- 위치: `llm.service.ts` — 파일 상단 구조
- 상세: diff 기준으로 `import { LLMClientFactory }` 이후에 `isPrivateHost` 함수 정의가 나오고, 그 다음에 다시 `import { LLMClient, ... }`가 이어진다. import 블록 중간에 함수가 삽입된 구조는 가독성을 해친다.
- 제안: 모든 import를 파일 최상단에 모으고, `isPrivateHost`는 클래스 정의 바로 앞 또는 클래스 내 private static 메서드로 이동한다.

---

**[WARNING] Gemini API 제약 이유를 설명하는 주석 다수 삭제**
- 위치: `google.client.ts` — `buildToolConfig`, `sanitizeGeminiSchema`, `buildContents` 주변
- 상세: "Gemini는 `responseMimeType: 'application/json'`과 function calling을 동시에 전달하면 400을 반환", "ObjectSchema.properties가 비어 있으면 거부", "ArraySchema는 items가 필수" 등 **왜** 이런 처리를 해야 하는지 설명하는 주석이 일괄 제거됐다. 이 제약은 Google 공식 문서에 명시되지 않거나 찾기 어려운 런타임 동작이므로, 향후 리팩터링 시 동일한 실수를 유발할 위험이 있다.
- 제안: `// WHY:` 스타일로 핵심 제약 이유만 간결하게 남긴다 (구현 설명이 아닌 이유 설명).

---

**[INFO] API 응답 이중 언래핑 `data?.data ?? data`**
- 위치: `frontend/src/lib/api/llm-configs.ts` — `listModels`, `previewModels`
- 상세: `listModels`는 기존에 `data as ModelInfo[]`였다가 `data?.data ?? data`로 변경됐다. 이는 일부 엔드포인트가 `{ data: [...] }` 래퍼를 쓰고 일부는 배열을 직접 반환한다는 의미다. API 응답 구조의 불일치를 클라이언트에서 방어적으로 흡수하는 것은 임시 해결책이며 장기적으로 혼란을 유발한다.
- 제안: 백엔드 응답 구조를 `TransformInterceptor`가 일관되게 래핑하는지 확인하고, 프론트 API 레이어는 단일 경로로만 처리한다.

---

**[INFO] `package.json` 정규식 변경에 설명 없음**
- 위치: `backend/package.json` — `transformIgnorePatterns`
- 상세: pnpm 호환 경로를 처리하는 보다 복잡한 정규식으로 바뀌었는데, 변경 이유(pnpm의 `.pnpm/` 구조)가 코드나 주석에 전혀 남지 않았다. 나중에 패키지 추가 시 이 패턴을 이해하지 못한 채 잘못 수정될 수 있다.
- 제안: 정규식 위에 한 줄 주석으로 pnpm 심볼릭 링크 구조에 대응하기 위한 패턴임을 명시한다.

---

**[INFO] `misplacedComment` — `withTimeout` 위 SSRF 주석**
- 위치: `llm.service.ts` — `withTimeout` 메서드 바로 위
- 상세: `// SSRF 완화 — non-local 프로바이더가 loopback/link-local/RFC1918 주소를 가리키는...` 주석이 `withTimeout` 앞에 붙어 있으나 내용은 `isPrivateHost` 함수와 관련된다. 맥락이 틀린 위치의 주석은 독자를 혼란스럽게 한다.
- 제안: 해당 주석을 `isPrivateHost` 정의 바로 위로 이동한다.

---

### 요약

이번 변경의 핵심인 타입 단언 제거(`as unknown as`, `as any`, `as never`)는 테스트 코드 전반의 타입 안정성과 가독성을 실질적으로 높인 긍정적 개선이다. Google AI SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)도 필요한 작업이나, 마이그레이션 과정에서 Gemini API의 비명시적 제약을 설명하던 주석이 대거 삭제되고 `buildGenerationConfig` 반환 타입이 `Record<string, unknown>`으로 약화되어 미래 수정자를 위한 안전망이 줄었다. `previewModels` 기능 자체는 SSRF 방어·타임아웃·레이트리밋을 갖추어 설계가 견고하지만, `30_000` 상수 중복과 `isPrivateHost` 함수의 파일 내 위치가 구조적 노이즈를 남긴다.

### 위험도

**LOW**