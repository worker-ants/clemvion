## Scope Code Review

### 발견사항

---

**[WARNING]** 비관련 파일 전반에 걸친 TypeScript 타입 단언 일괄 정리
- **위치**: `transform.interceptor.spec.ts`, `alerts-evaluator.service.spec.ts`, `auth.controller.spec.ts`, `auth.service.spec.ts`, `jwt.strategy.spec.ts`, `users.controller.spec.ts`, `websocket.gateway.spec.ts`, `schedule-runner.service.spec.ts`, `zod-validator.spec.ts`, `parallel.schema.spec.ts`, `chart.handler.spec.ts`, `send-email.handler.spec.ts`, `knowledge-base.service.spec.ts`, `integrations.service.spec.ts`
- **상세**: `as unknown as X`, `as any`, `as never`, `as AlertRule`, `as Schedule` 등의 불필요한 타입 단언을 제거하는 정리 작업이 이번 feature(preview-models)와 전혀 무관한 파일 14개 이상에 산재되어 있음. 각각의 변경은 무해하지만, PR 의도와 무관한 변경이 git history를 오염시키고 리뷰 부담을 높임.
- **제안**: 별도 "type assertion cleanup" 커밋 또는 별도 PR로 분리

---

**[WARNING]** `execution-engine.service.ts` 소스 파일 변경 (비관련 정리)
- **위치**: `execution-engine.service.ts:1306`, `1542–1546`, `1716–1720`
- **상세**: `as unknown as Record<string, unknown>` 및 `as Record<string, unknown>` 캐스팅 제거가 execution engine 소스 파일에 포함됨. 실행 엔진은 이번 preview-models 기능과 무관하며, 소스 파일의 런타임 동작에 영향을 주는 변경이 섞여 있으면 회귀 위험 추적이 어려워짐.
- **제안**: 소스 파일 타입 정리는 별도 PR로 분리 권장

---

**[WARNING]** `execution-engine.service.spec.ts` 대규모 단언 제거 (비관련)
- **위치**: 30개 이상의 `containerId: undefined as unknown as string` / `toolOwnerId: undefined as unknown as string` 변경
- **상세**: 이 파일은 LLM preview 기능과 무관. 변경량이 크기 때문에 실제 기능 변경(execution engine source 변경)이 이 노이즈에 묻힐 위험이 있음.
- **제안**: 별도 PR로 분리

---

**[WARNING]** `ai-agent.handler.ts` 소스 파일 타입 단언 제거 (비관련)
- **위치**: `ai-agent.handler.ts:219, 229, 511, 521, 736, 746`
- **상세**: `result.toolCalls as ToolCall[]` → `result.toolCalls` 변경 6건. 이 파일은 이번 기능 범위 밖임. `result.toolCalls`의 타입이 `ToolCall[]`로 추론되도록 상위 타입이 수정된 것인지 확인 필요.
- **제안**: 타입 호환성 확인 후 별도 PR로 분리

---

**[WARNING]** `http-request.handler.spec.ts` 대규모 `as unknown as typeof fetch` 제거 (비관련)
- **위치**: 15건 이상
- **상세**: HTTP request 핸들러 테스트는 이번 기능과 무관. 변경 자체는 안전하나 PR scope를 벗어남.
- **제안**: 별도 PR로 분리

---

**[WARNING]** `condition-eval.util.ts` 소스 파일 타입 단언 제거 (비관련)
- **위치**: `condition-eval.util.ts:116`
- **상세**: `String(fieldValue as string | number | boolean)` → `String(fieldValue)` 변경. 로직 조건 유틸리티 소스 파일을 이번 PR에서 건드리는 것은 범위 초과. 런타임 동작은 동일하나 추적 어려움.
- **제안**: 별도 PR로 분리

---

**[INFO]** `google.client.ts` 내 유용한 주석 대거 삭제
- **위치**: `google.client.ts` 전반
- **상세**: SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)과 함께 Gemini 역할 규칙, `thoughtSignature` echo 이유, `sanitizeGeminiSchema` 동작 원리, `result.response` fallback 이유 등 non-obvious 기술적 설명 주석이 대량 삭제됨. 일부는 이전된 것이지만 다수는 단순 삭제.
- **제안**: SDK 마이그레이션에 필수적인 동작 변경 이유는 주석 혹은 커밋 메시지로 보존 권장. 특히 `thoughtSignature`, sanitize 로직, role 규칙에 대한 설명은 향후 디버깅에 가치가 있음.

---

**[INFO]** `openai.client.ts` 비관련 타입 캐스팅 제거
- **위치**: `openai.client.ts:51, 198`
- **상세**: `as OpenAI.Chat.ChatCompletionMessageParam[]` 제거. OpenAI 클라이언트는 preview-models 기능과 직접 무관. 단, OpenAI는 `listModels()` 구현체이므로 간접 연관성은 있음.
- **제안**: 허용 범위 내이나, 가능하면 분리 권장

---

**[INFO]** `workflow-assistant-stream.service.spec.ts` 비관련 정리
- **위치**: 6건의 `as never` 제거 + `asyncIter` 반환값 정리
- **상세**: 워크플로우 어시스턴트 스트림 테스트는 이번 기능과 무관.
- **제안**: 별도 PR로 분리

---

### 요약

이번 변경의 핵심 기능(preview-models 엔드포인트, Google SDK 마이그레이션, Anthropic 실시간 listModels, ModelCombobox 컴포넌트, 관련 DTO/서비스/스펙 문서)은 명확하게 의도된 범위 내에 있다. 그러나 **이번 기능과 직접 무관한 23개 이상의 파일에 걸쳐 `as unknown as X`, `as any`, `as never` 등 TypeScript 타입 단언 일괄 제거 작업이 혼재**되어 있으며, 그 중 일부는 소스 파일(`execution-engine.service.ts`, `ai-agent.handler.ts`, `condition-eval.util.ts`)까지 포함한다. 변경 자체의 안전성은 높지만 PR 범위가 산만해져 리뷰 비용이 상승하고, 회귀 발생 시 원인 추적이 어려워진다. Google 클라이언트의 기술 설명 주석 대량 삭제도 유지보수성 관점에서 아쉬운 부분이다.

### 위험도

**LOW**