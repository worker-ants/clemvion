## 발견사항

### [HIGH] Google 임베딩: N회 순차 호출 → 1회 배치 호출로 동작 변경
- **위치**: `google.client.ts`, `embed()` 메서드
- **상세**: 구 `@google/generative-ai` SDK는 텍스트당 `embedContent(text)` 1회씩 N회 호출했으나, 신 `@google/genai` SDK에서는 `contents: texts`로 배치 1회 호출로 바뀜. 신 SDK가 배치 임베딩을 지원하지 않거나 `response.embeddings` 길이가 `texts.length`와 다를 경우, Knowledge Base 기능 전체가 잘못된 벡터를 저장하거나 빈 배열을 반환할 수 있음. 기존 호출자는 texts:results 1:1 보장을 기대함
- **제안**: 신 SDK 문서에서 `embedContent`의 배치 입력 지원 여부 및 반환 순서를 확인하고, 단위 테스트에서 `texts.length === result.length`를 어서트할 것

### [HIGH] 스트림 사용량 메타데이터 폴백 제거
- **위치**: `google.client.ts`, `stream()` 메서드 하단
- **상세**: 구 코드에는 스트림 청크에 `usageMetadata`가 없을 경우 `result.response`(집계된 응답)에서 토큰 수를 재조회하는 폴백 로직이 있었으나 이 변경에서 완전히 제거됨. Gemini 일부 모델/설정에서는 마지막 청크에만 usageMetadata가 실리거나 아예 없는 경우, `done` 이벤트의 `usage`가 항상 `{0, 0, 0}`을 보고하게 됨. 과금 추적·사용량 모니터링에 영향
- **제안**: 신 SDK에서 스트림 청크에 항상 usageMetadata가 포함되는지 문서 또는 실측으로 검증하고, 포함되지 않을 경우 폴백 로직 복원

### [MEDIUM] `listModels()` 하드코딩 → 라이브 API 호출 (Anthropic, Google 모두)
- **위치**: `anthropic.client.ts:132~`, `google.client.ts:490~`
- **상세**: 두 클라이언트 모두 `listModels()`가 하드코딩된 목록을 동기적으로 반환하던 것에서 실시간 네트워크 호출로 변경됨. 이 메서드를 호출하는 컨텍스트(예: `testConnection`, `LlmService.listModels`, 새 `previewModels`)에서 네트워크 불가 상황이나 API 키 미제공 시 즉각 예외가 발생함. 기존 테스트 환경에서 이 호출을 mock하지 않으면 테스트가 실제 API를 호출할 수 있음
- **제안**: 호출자 측에서 에러 핸들링이 이미 갖춰진지 확인; CI/CD 환경에서 Anthropic/Google API 키 없이 관련 테스트가 통과하는지 점검

### [MEDIUM] `POST /llm-configs/preview-models` 라우트 순서 의존
- **위치**: `llm-config.controller.ts`
- **상세**: NestJS + Express에서 `@Post(':id/test')` 같은 파라미터 라우트보다 `@Post('preview-models')` 정적 라우트가 먼저 선언되어야 함. 현재 diff 순서는 올바르게 `:id/test` 앞에 위치하지만, 향후 컨트롤러에 `@Post(':id/...')` 형태 라우트가 preview-models 위에 삽입되면 `preview-models`가 `:id`로 캡처됨
- **제안**: NestJS 라우트 순서에 주석으로 명시하거나, 경로를 `/preview-models`가 아닌 `/-/preview-models`처럼 파라미터와 충돌하지 않는 prefix로 설계할 것

### [MEDIUM] `ThrottlerModule` 전역 설정 여부 미확인
- **위치**: `llm-config.controller.ts`, `@Throttle` 데코레이터
- **상세**: `@Throttle({ default: { limit: 10, ttl: 60_000 } })`가 동작하려면 앱 모듈에 `ThrottlerModule`이 등록되어 있고 `ThrottlerGuard`가 전역 또는 해당 컨트롤러에 적용되어 있어야 함. 설정이 없으면 데코레이터가 무시되어 rate limit 없이 엔드포인트가 열림
- **제안**: `AppModule` 또는 `LlmConfigModule`에 `ThrottlerModule.forRoot` 설정이 있는지 확인

### [WARNING] `sanitizeErrorMessage` 메서드 참조 불확인
- **위치**: `llm.service.ts:previewModels()`
- **상세**: `this.sanitizeErrorMessage(raw)` 를 호출하지만 해당 메서드가 이 diff에 추가되지 않음. 기존 서비스에 이미 존재해야 하며 없으면 런타임 `TypeError` 발생
- **제안**: `llm.service.ts` 전체 파일에서 `sanitizeErrorMessage` 존재 여부 확인

### [WARNING] `listModels` API 응답 언래핑 변경 (frontend)
- **위치**: `frontend/src/lib/api/llm-configs.ts`, `listModels()`
- **상세**: 구 코드 `return data as ModelInfo[]`는 axios 응답의 `data`를 직접 반환했으나, transform interceptor가 `{ data: [...] }` 형태로 감싸는 경우 기존 코드는 이미 깨져 있었음. 신 코드 `data?.data ?? data`는 올바르지만, 만약 일부 엔드포인트가 이중 래핑 (`{ data: { data: [...] } }`)되어 있다면 `data.data`가 배열이 아닌 객체를 반환할 수 있음
- **제안**: `listModels` 응답 구조를 실 서버 응답과 대조하여 단계별 언래핑 검증

### [INFO] 테스트 파일 `as any`/`as unknown as T`/`as never` 제거 (Files 2~9, 11~12, 15~16, 28~39)
- 런타임 영향 없음. TypeScript가 타입을 직접 수용하므로 동작 동일
- 제거 후 TypeScript 컴파일이 통과한다면 안전한 정리

### [INFO] `@IsIn()` 타입 캐스트 제거 (Files 4, 5, 13, 17, 18, 29)
- `class-validator`의 `@IsIn()`은 `any[]`를 받으므로 readonly tuple을 직접 전달해도 런타임 동작 동일
- 영향 없음

---

## 요약

이번 변경의 핵심은 LLM 클라이언트의 SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)과 preview-models 신규 엔드포인트 추가이다. 테스트/DTO에서의 불필요한 타입 캐스트 제거는 안전하다. 그러나 두 가지 실질적인 행동 변경이 잠재적 부작용을 가진다: Google `embed()` 메서드가 N회 순차 → 1회 배치 호출로 바뀌어 Knowledge Base의 임베딩 정확성이 신 SDK의 배치 지원 여부에 달려 있으며, 스트리밍 usage 폴백 제거로 일부 Gemini 설정에서 사용량이 항상 0으로 보고될 수 있다. 또한 Anthropic·Google 모두 `listModels()`가 라이브 API 호출로 바뀌어 네트워크 장애나 키 부재 시 새로운 실패 경로가 생긴다.

## 위험도

**MEDIUM**