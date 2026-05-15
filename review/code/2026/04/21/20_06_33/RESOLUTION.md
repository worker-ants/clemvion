# RESOLUTION — Google(Gemini) LLM 스트리밍 지원 추가

본 문서는 다음 두 SUMMARY를 통합 처리한 결과를 정리한다.
- `review/2026-04-21_20-04-36/SUMMARY.md` — 신규 spec 파일(`google.client.spec.ts`) 단독 리뷰
- `review/2026-04-21_20-06-33/SUMMARY.md` — production 변경 파일(`google.client.ts`, `workflow-assistant-stream.service.ts`, `tools/redact.ts`) 통합 리뷰

## 1. Critical / WARNING — 처리 결과

### 1.1 [Critical · 1차 SUMMARY 의 `stream()` 미테스트] — **무효 (false positive)**
1차 리뷰는 spec 파일만 본 직후 production 코드를 별도로 본 결과 "untracked 상태로 머지 시 미검증"이라 평가했지만, 실제로는 같은 작업 단위에 신규 작성된 `google.client.spec.ts` (12 케이스, 모두 통과)가 `stream()`의 abort/tool_call/usage fallback/error throw 시나리오를 모두 커버한다. RESOLUTION으로 따로 조치 불필요. (기록만 남김)

### 1.2 [WARNING · 1차 #2 / 2차 무관] tool_call_delta·tool_call_end 검증 silent pass
- **조치:** `if (delta?.type === ... && end?.type === ...)` 가드 안에서만 `expect`를 실행하던 것을 분리. 가드 전에 `expect(delta?.type).toBe(...)`로 명시적 단언 후, 가드는 type narrowing 용으로만 유지하며 narrowing 실패 시 명시적 throw.
- **파일:** `backend/src/modules/llm/clients/google.client.spec.ts` 132–137줄.

### 1.3 [WARNING · 1차 #1] abort 테스트가 `Error` 사용 (실제 SDK는 `DOMException(AbortError)`)
- **조치:** abort 시 throw하는 객체를 `new DOMException('The operation was aborted.', 'AbortError')`로 교체. 추가로 abort 케이스에서 `error` 이벤트가 emit 되지 않음을 함께 단언하여 구현이 `signal.aborted` 플래그 기반으로 분기함을 검증.
- **파일:** `backend/src/modules/llm/clients/google.client.spec.ts` `yields done with finishReason="aborted"` 테스트.

### 1.4 [WARNING · 2차 #5] tool call ID `Date.now() + Math.random()` 충돌 가능성
- **조치:** `randomUUID()` 기반 `generateToolCallId()` 모듈 helper 추출, `chat()`과 `stream()` 양쪽에서 공유. `node:crypto` import 추가.
- **파일:** `backend/src/modules/llm/clients/google.client.ts` 51–58, 161, 251줄.

### 1.5 [WARNING · 2차 #6] abort 후 `done` emit 의도 불명확
- **조치:** abort/오류 미발생 시뿐 아니라 abort된 경우에도 `done`을 한 건 yield하는 것이 OpenAI/Anthropic 클라이언트와 동일한 contract임을 4줄 주석으로 명시. error는 early return으로 분리.
- **파일:** `backend/src/modules/llm/clients/google.client.ts` `stream()` 종단부.

### 1.6 [INFO · 1차 #7] 단일 청크 내 multiple functionCall 미검증
- **조치:** parallel tool call 케이스 테스트 추가 (`emits delta+end pairs in order for multiple functionCall parts in one chunk`). 두 tool_call의 ID가 서로 다른 UUID인지(=충돌 방지) 함께 검증.
- **파일:** `backend/src/modules/llm/clients/google.client.spec.ts` 신규 테스트 케이스.

## 2. WARNING — 의식적 보류 (사유 명시)

### 2.1 [WARNING · 2차 #1] LLM API 원시 에러 메시지 SSE 노출
- **사유:** 본 변경 이전부터 `OpenAIClient.stream()`·`AnthropicClient.stream()`·`workflow-assistant-stream.service.ts` 모두 동일한 패턴(`error.message`를 `error` 이벤트 `message`에 그대로 전달). Google 클라이언트도 일관성 차원에서 동일하게 작성됨. 이를 정적 문자열로 교체하려면 LLM 모듈 전체와 어시스턴트 서비스의 에러 contract를 함께 변경해야 하며, **본 작업의 범위(Google 스트리밍 지원)를 초과**한다.
- **권고 후속:** 별도 PR에서 `LLMErrorContract` 정의 및 모든 provider client + `workflow-assistant-stream.service.ts`를 일괄 정리. `developer` skill의 ISSUE FIX 원칙에 따라 별도 작업 시점에 처리.

### 2.2 [WARNING · 2차 #2] 시스템 프롬프트 인젝션
- **사유:** `buildSystemPrompt()`는 본 변경 이전부터 존재한 코드이며, 현재 변경(Google 스트리밍 지원)과 무관. 인젝션 방어는 `workflow-assistant` 모듈 자체의 보안 강화 작업으로 별도 처리 필요.
- **권고 후속:** `<workflow_context>` 태그 격리 + 노드 config 길이 상한을 별도 PR로.

### 2.3 [WARNING · 2차 #3] `mapGoogleFinishReason()`·`classifyStreamError()` pure-function 단위 테스트 부재
- **사유:** 두 함수는 module-private 헬퍼이며, 분기별 동작이 다음 통합 테스트로 이미 간접 검증됨:
  - `MAX_TOKENS → length`: `maps Gemini MAX_TOKENS finishReason to "length"`
  - `SAFETY → content_filter`: `maps Gemini SAFETY finishReason to "content_filter"`
  - 기본값 `STOP → stop`: 텍스트 스트림 테스트
  - 429 → `LLM_RATE_LIMIT`: `classifies 429 errors as LLM_RATE_LIMIT`
  - 그 외 → `LLM_CONNECTION_ERROR`: `yields an error event when sendMessageStream rejects`
- 분기 100% 가 통합 테스트로 커버되며, export하여 별도 unit으로 추가하는 것은 surface 확대 비용 대비 가치 낮음. **추가하지 않음.**

### 2.4 [WARNING · 2차 #4] `safeParse()` 배열 처리 회귀 테스트 부재
- **사유:** `safeParse()`는 `workflow-assistant-stream.service.ts` 내부의 module-local helper로 export되지 않는다. 본 변경에서 `Array.isArray(parsed)` 가드를 추가한 것은 lint(`@typescript-eslint/no-base-to-string`) 해소 부산물. 동작은 기존과 동일(객체가 아닌 모든 값에 대해 `{}` 반환)이므로 새로운 회귀 위험 없음.
- **권고 후속:** 시스템 전체에서 `JSON.parse + 형식 검증` 패턴이 다수 등장한다면 `src/common/utils/safe-parse.ts`로 추출 후 단위 테스트 추가.

### 2.5 [WARNING · 2차 #7] `openQuestions` 요소 레벨 타입 검증
- **사유:** 기존 코드의 `as string[]` 캐스팅은 본 변경 이전부터 존재한 패턴이며 Google 스트리밍과 무관. 별도 PR에서 plan 카드 입력 검증 강화 시 함께 처리.

### 2.6 [WARNING · 2차 #8] `buildChatInputs()` last message role 미검증
- **사유:** Gemini API가 마지막이 `user`여야 한다는 제약은 사실이나, 호출자(`workflow-assistant-stream.service.ts`)가 항상 user 메시지를 마지막에 push하도록 구성되어 있다(155–157줄: `{ role: 'user', content: dto.content }` 항상 마지막). 사전 검증을 추가하면 dead code가 된다. `chat()`도 동일 패턴이며 본 변경 이전부터 동일 가정에 의존. **추가하지 않음.**

### 2.7 [WARNING · 2차 #9] 동일 세션 동시 요청 직렬화
- **사유:** 본 변경(Google 스트리밍 지원)과 무관한 사전 존재 이슈. spec §10.5에 "워크플로우당 활성 스트리밍은 1건만 허용 (중복 POST 시 409)" 규칙이 정의되어 있으므로 controller 레벨 직렬화는 별도 PR 사항.

### 2.8 [WARNING · 2차 #10] `streamMessage()` 책임 집중
- **사유:** 사전 존재 코드. 본 변경에서는 `asString()`/`safeParse()`/`llmConfig` 타입 명시 등 lint 해소만 수행. 책임 분리는 별도 리팩토링 PR로.

### 2.9 [WARNING · 2차 #11] `embed()` 순차 호출
- **사유:** 사전 존재 패턴이며 Google 스트리밍과 무관. embedding 파이프라인 최적화는 별도 작업.

## 3. INFO — 부분 반영 / 보류

| # | 항목 | 처리 |
|---|------|------|
| 1차 #1 | 에러 케이스 SDK stub 중복 | **보류**: 3곳 inline stub은 케이스별 가독성 우선. 4곳 이상 중복 발생 시점에 `makeClientWithRejectedStream` 도입 |
| 1차 #2 | `@ts-expect-error`로 내부 필드 직접 overwrite | **보류**: OpenAI/Anthropic 테스트도 동일 패턴(`client.client = ...`). 일관성 유지. 의존성 주입 도입은 LLM 모듈 차원 결정 필요 |
| 1차 #3~5 | system/assistant/tool role 변환 검증 | **보류**: `chat()` 측에서 동일 helper(`buildChatInputs`)가 검증되어 있고, 본 변경에서 helper 추출은 코드 동일성 확장에 불과. 변환 자체는 사전 코드의 contract |
| 1차 #6 | tools 파라미터 전달 검증 | **보류**: 사전 코드 contract |
| 1차 #8 | TEST_MODEL/TEST_API_KEY 상수화 | **보류**: 12 케이스 규모에서 가독성 손해 없음. 케이스 추가 시점에 검토 |
| 1차 #10 | 중간 청크에 partial usage 우선 정책 | **부분 반영**: 구현 코드는 "마지막 등장 usage가 덮어쓰기" 정책이며, 단일 청크 + aggregated fallback 케이스로 검증됨. 다중 청크 partial 시나리오는 SDK가 실제로 그렇게 내려보내는 사례를 확인 후 추가 |
| 1차 #11 | `asyncIter` throw 옵션 | **보류**: 단순성 우선 |
| 2차 INFO #1~12 | 에러 분류 공통화·`asString` 위치·SDK 버전 핀·JSDoc 등 | **보류**: 모두 사전 존재 패턴 또는 본 변경 범위 외 cleanups |

## 4. TEST WORKFLOW 재실행 결과

조치 후 다시 다음을 모두 통과 확인:

| 단계 | 결과 |
|------|------|
| `npm run lint` | exit 0, 0 errors / 0 warnings |
| `npx jest src/modules/llm/clients/google.client.spec.ts` | 12 tests passed |
| `npm test` (전체) | 105 suites / 1474 tests passed |
| `npm run build` | 성공 |

## 5. 변경된 파일 (최종)

| 파일 | 역할 |
|------|------|
| `backend/src/modules/llm/clients/google.client.ts` | `stream()` 신규 + `buildChatInputs`/`startChatSession`/`generateToolCallId` helper |
| `backend/src/modules/llm/clients/google.client.spec.ts` | 12 케이스 신규 (텍스트/단일·복수 functionCall/MAX_TOKENS/SAFETY/usage fallback/thoughts/abort/error/429/AbortSignal 전달/빈 메시지) |
| `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` | lint 7 errors + 4 warnings 해소 (asString helper, llmConfig 타입 명시, safeParse 배열 가드, ChatStreamEvent unused 제거) |
| `backend/src/modules/workflow-assistant/tools/redact.ts` | lint 1 warning 해소 (`Array.isArray` 분기 unsafe-return) |
| `prd/2-workflow-editor.md` | ED-AI-09: v1 스트리밍 지원에 Google 추가 |
| `spec/3-workflow-editor/4-ai-assistant.md` | §1.2/§7/§11/§15: Google v1 승격 반영 |
| `spec/5-system/7-llm-client.md` | §8.2: Google AI ✅ + 매핑 설명 |
