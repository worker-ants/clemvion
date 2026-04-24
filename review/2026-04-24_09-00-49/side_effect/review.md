## 발견사항

---

### [CRITICAL] Google SDK 마이그레이션 — 전체 diff 확인 불가
- **위치**: `google.client.ts` (diff 말미 truncated)
- **상세**: `@google/generative-ai` → `@google/genai` 전면 교체. 스트리밍 API(`sendMessageStream` → `generateContentStream`)·메시지 변환(`buildChatInputs` → `buildContents`)·채팅 세션 모델(`startChat` → `ai.models.generateContent`) 모두 변경됨. diff가 잘려 스트림 후반부 처리, `fnCallToToolCall` 함수 정의, 에러 형식 매핑 등이 미확인 상태.
- **제안**: 잘린 diff를 별도로 검토하고, 스트리밍 툴콜 처리·에러코드 분기·`thoughtSignature` echo 경로를 통합 테스트로 확인할 것.

---

### [WARNING] `AnthropicClient.listModels()` — 정적 반환에서 실시간 API 호출로 변경
- **위치**: `anthropic.client.ts` L132–151
- **상세**: 이전에는 즉시 resolve되는 하드코딩 목록을 반환했으나 이제 `client.models.list()` 네트워크 호출을 수행. `testConnection()`이 내부적으로 `listModels()`를 사용할 경우, 네트워크 단절·인증 실패 상황에서 이전과 다른 실패 모드가 발생. 또한 하드코딩 목록에 의존하던 기존 테스트 픽스처가 있으면 mock 없이 실제 네트워크를 호출하게 됨.
- **제안**: `testConnection()` 구현을 확인하고, 해당 메서드가 `listModels`에 의존하는지 검토. 단위 테스트에서 `client.models.list` stub 여부 확인.

---

### [WARNING] `previewModels()` — Factory 에러 메시지 직접 노출
- **위치**: `llm.service.ts` L299–310
- **상세**: Factory 초기화 실패 시 `error.message`를 그대로 클라이언트에 반환. 현재 Factory 구현이 에러 메시지에 apiKey를 포함하지 않는다는 가정에 의존하지만, 향후 Factory 변경 시 정보 노출 경로가 될 수 있음.
- **제안**: Factory 에러 메시지를 화이트리스트 패턴으로 sanitize하거나, 적어도 `apiKey` 값이 에러 경로에 포함되지 않도록 Factory 계층에서 보장.

---

### [WARNING] `withTimeout` — abort 이후 SDK reject 묵살
- **위치**: `llm.service.ts`, `withTimeout` 메서드
- **상세**: `inner.catch(() => undefined)` 로 timeout 후 SDK가 reject하는 에러를 전부 삼킴. 현재는 의도된 설계이나, 일부 SDK가 `AbortError`가 아닌 다른 에러(예: 커넥션 에러, 인증 에러)를 abort 후에 throw하는 경우 실제 원인을 알 수 없게 됨.
- **제안**: `AbortError` 계열만 catch하고 그 외 에러는 logger에 warn 수준으로 기록 후 삼키는 방식으로 개선 고려.

---

### [WARNING] `update()` 트랜잭션 — entity 선변경 후 트랜잭션
- **위치**: `llm-config.service.ts` L167–175
- **상세**: `config.isDefault = true` 로 엔티티를 뮤테이션한 후 트랜잭션을 시작. 트랜잭션이 실패할 경우 in-memory entity가 `isDefault=true` 상태로 남음. 이 객체가 이후 로직에서 재사용되면 불일치 발생 가능.
- **제안**: 트랜잭션 내부에서만 `isDefault` 값을 설정하도록 순서 조정 (단, 현재 코드 구조에서 `config` 가 트랜잭션 밖에서 fetch 되므로 실제 재사용 여부 확인 필요).

---

### [INFO] `llm-config.controller.ts` delete 순서 수정
- **위치**: `llm-config.controller.ts` L227–231
- **상세**: 캐시 제거를 DB 삭제 성공 이후로 이동한 것은 올바른 수정. 단, `clearClientCache(id)` 가 예외를 throw하면 캐시에 삭제된 config에 대한 client가 잔류할 수 있으나, 해당 client를 이후 호출하면 DB에서 config 조회 실패 에러가 발생하므로 실질적 위험은 낮음.

---

### [INFO] `LlmClient.listModels()` 인터페이스 시그니처 변경
- **위치**: `llm-client.interface.ts`
- **상세**: `signal?: AbortSignal` 파라미터 추가. Optional이므로 기존 구현·호출부 호환성 유지. 현재 구현체 3종(OpenAI·Anthropic·Google) 모두 signal 수용 코드 포함 확인됨.

---

### [INFO] `IsIn()` 데코레이터 타입 캐스트 제거 (DTOs)
- **위치**: `create-auth-config.dto.ts`, `update-auth-config.dto.ts`, `create-llm-config.dto.ts` 등
- **상세**: `as unknown as string[]` 캐스트 제거. 런타임 동작은 동일하며 TypeScript 컴파일러가 readonly 배열을 직접 수용하도록 타입 정합성이 개선됨.

---

### [INFO] `package.json` `transformIgnorePatterns` pnpm 호환 수정
- **위치**: `backend/package.json`
- **상세**: pnpm의 `.pnpm/<pkg>/node_modules/<pkg>/` 경로를 Jest transform 예외 목록에 포함시키는 수정. 런타임 부작용 없음.

---

### [INFO] `listModels` 응답 정규화 (`frontend`)
- **위치**: `frontend/src/lib/api/llm-configs.ts`
- **상세**: `(data?.data ?? data)` 추가로 transform interceptor가 `{ data: [...] }` 로 wrapping한 응답과 배열 직접 반환을 모두 처리. 버그 수정에 해당하며 부작용 없음.

---

## 요약

대부분의 변경은 TypeScript 타입 캐스트 정리(런타임 영향 없음), Jest 설정 수정, 트랜잭션 경쟁 조건 수정 등 긍정적인 변경이다. 주요 부작용 위험은 두 곳에 집중된다: (1) Google SDK 전면 교체—diff가 잘려 후반부 스트리밍·에러 처리 경로를 확인할 수 없어 실제 동작 변화 범위가 불확실하며, (2) `AnthropicClient.listModels()`의 하드코딩 → 실시간 API 호출 전환—`testConnection()` 등 기존 호출자의 실패 모드가 바뀔 수 있다. `previewModels()`의 SSRF 가드와 timeout 처리는 설계가 적절하나, factory 에러 메시지의 직접 노출 경로는 향후 정보 유출 가능성을 남긴다.

## 위험도

**MEDIUM** (Google SDK 마이그레이션 diff 미확인 영역으로 인해 국소적으로 HIGH)