## 발견사항

### [WARNING] `google.client.ts` — `buildGenerationConfig` 반환 타입이 `Record<string, unknown>`
- **위치**: `google.client.ts`, `buildGenerationConfig` 메서드
- **상세**: 핵심 설정 객체를 `Record<string, unknown>`으로 반환해 SDK에 넘기기 전 타입 안전성이 소실됨. `ai.models.generateContent({ config })` 호출 시 오타나 잘못된 필드를 컴파일 시점에 잡을 수 없음
- **제안**: `@google/genai` SDK가 제공하는 `GenerateContentConfig` 인터페이스로 반환 타입 지정. 없다면 로컬 인터페이스 정의

---

### [WARNING] `google.client.ts` — 스트림 루프 내 대형 인라인 타입 캐스트
- **위치**: `google.client.ts`, `stream()` 메서드, `for await (const raw of stream)` 블록
- **상세**: `raw`를 candidates/usageMetadata 필드를 담은 익명 객체 타입으로 즉석 캐스팅함. 같은 형태가 `chat()`에서도 암묵적으로 쓰이므로 중복이며, 타입 이름이 없어 IDE 힌트 없이 읽기 불편함
- **제안**: `GoogleStreamChunk` 같은 모듈-레벨 인터페이스로 추출

---

### [WARNING] `google.client.ts` — 비-자명한 Gemini 동작 설명 주석 일괄 삭제
- **위치**: `sanitizeGeminiSchema`, `buildContents`, 스트림 루프 내 여러 곳
- **상세**: 삭제된 주석 중 일부는 "왜 이렇게 했는가"를 설명하는 핵심 맥락이었음
  - `responseMimeType`과 function calling 도구를 동시에 전달하면 Gemini가 400을 반환한다는 설명
  - `ObjectSchema.properties`가 비어 있으면 Gemini가 거부한다는 설명
  - `ArraySchema.items`가 없으면 드랍해야 한다는 설명
  - 빈 assistant 턴도 model turn으로 유지해야 alternation이 보전된다는 설명
- 이 제약사항들은 SDK 문서나 코드만 봐서는 알기 어렵고, 향후 수정자가 재현하기 어려운 버그를 만들 수 있음
- **제안**: 비-자명한 외부 API 제약(에러 코드 포함)에 대한 주석은 유지. 코드의 "무엇"이 아닌 "왜"를 설명하는 주석은 남길 것

---

### [WARNING] `llm.service.ts` — `withTimeout`이 원본 Promise를 취소하지 않음
- **위치**: `llm.service.ts`, `withTimeout` 메서드
- **상세**: timeout 후 reject하지만 `client.listModels()` Promise는 계속 실행됨. previewModels는 per-config 캐시에 들어가지 않으므로 실제 connection leak 가능성이 있으며, 특히 `local` 프로바이더처럼 느린 엔드포인트에서 문제가 될 수 있음
- **제안**: `AbortController`를 `LLMClient.listModels(signal?)` 시그니처로 전달하거나, 최소한 timeout 동작을 주석으로 문서화

---

### [WARNING] `execution-engine.service.spec.ts` — 동일한 노드 픽스처 패턴 20회 이상 반복
- **위치**: `execution-engine.service.spec.ts` 전반
- **상세**: 이번 PR의 변경은 `as unknown as string` → `undefined`로의 정제였으나, `containerId: undefined, toolOwnerId: undefined`를 포함한 거의 동일한 노드 객체 리터럴이 파일 전체에 산재. 하나의 타입 변경이 생기면 수십 곳을 고쳐야 하는 구조
- **제안**: `makeNode(partial?)` 테스트 팩토리 함수로 공통 노드 픽스처를 생성하도록 리팩토링

---

### [INFO] `preview-llm-models.dto.ts` — DTO와 서비스 간 검증 책임 분산
- **위치**: `preview-llm-models.dto.ts`, `llm.service.ts`
- **상세**: `apiKey`는 DTO에서 `@IsString()` + `@MaxLength(500)`만 검사하므로 빈 문자열도 통과함. `local` 외 프로바이더에서 빈 apiKey를 거부하는 로직이 서비스 레이어에 있음. DTO만 보면 규칙을 파악할 수 없음
- **제안**: DTO JSDoc 또는 `@ApiProperty.description`에 "local 프로바이더 이외에는 서비스 레이어에서 빈 값을 거부한다"는 설명 추가. 또는 커스텀 validator로 DTO 레이어에서 처리

---

### [INFO] 긍정적 변경 — `as unknown as T` / `as any` / `as never` 일괄 제거
- **위치**: 테스트 파일 전반 및 프로덕션 코드 일부
- **상세**: 실제로 타입이 이미 호환되었음을 증명하는 변경. 불필요한 타입 단언 제거로 코드의 의도가 더 명확해지고, 타입 시스템이 런타임 버그를 잡을 여지가 늘어남. 특히 `@IsIn(AUTH_CONFIG_TYPES as unknown as string[])` → `@IsIn(AUTH_CONFIG_TYPES)` 패턴은 `validator.js`가 `readonly` 배열을 허용함을 올바르게 표현

---

### [INFO] `google.client.ts` — `fnCallToToolCall` 함수 분리
- **위치**: `google.client.ts` 파일 하단
- **상세**: `chat()`과 `stream()` 양쪽에서 동일한 변환 로직을 쓰던 것을 공유 함수로 추출한 것은 DRY 원칙에 부합하는 개선

---

## 요약

이번 변경의 대부분(파일 1~9, 11~16 등)은 불필요했던 `as unknown as T`/`as any` 타입 단언을 제거한 정제 작업으로, 전반적인 유지보수성을 개선한다. 주요 기능 변경인 Google 클라이언트의 신 SDK 마이그레이션과 `previewModels` 엔드포인트 추가는 구조적으로 잘 분리되어 있으나, `buildGenerationConfig`의 `Record<string, unknown>` 반환 타입, 스트림 루프 내 인라인 타입 캐스트, 그리고 Gemini 특유의 API 제약 사항을 설명하던 비-자명한 주석의 삭제가 향후 버그 재발 및 유지보수 비용을 높이는 요소로 남는다. 테스트 코드의 중복 픽스처 문제는 이번 변경 전부터 존재하나 이번 기회에 팩토리 함수로 개선할 여지가 있다.

## 위험도

**LOW**