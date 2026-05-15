## 발견사항

### [INFO] `tool_call_budget_exceeded` tool_result 메시지가 대화 이력에 노출
- **위치**: `ai-agent.handler.ts` - `providerTruncated` 처리 블록 (단일턴 ~L586, 멀티턴 ~L994)
- **상세**: `output.result.messages` 배열(멀티턴 공개 응답에 포함됨)에 `{ error: 'tool_call_budget_exceeded' }` content를 담은 `role: 'tool'` 메시지가 포함된다. 이 메시지는 LLM 프로토콜 내부용이지만, 멀티턴 종료 시 `messages` 필드가 그대로 API 소비자에게 노출된다. 대화 이력을 파싱하거나 화면에 표시하는 클라이언트가 예상치 못한 role/content 형식을 만날 수 있다.
- **제안**: 스펙 문서처럼 이 에러 코드(`tool_call_budget_exceeded`)를 공개 계약에 명시적으로 문서화하거나, `messages` 배열을 소비자에게 반환하기 전 `role: 'tool'`인 내부 프로토콜 메시지를 필터링하는 레이어를 도입하는 방안 검토.

### [WARNING] batch 내 tool 실행 개수 시맨틱 변경 — `meta.toolCalls` 카운팅 동작 변화
- **위치**: `ai-agent.handler.ts` — `providerBatchResults` 루프 vs 구 직렬 for 루프
- **상세**: 구 코드에서는 while 루프 가드(`toolCallCount < maxToolCalls`)가 배치 진입 여부만 제어했고, 진입 후에는 해당 배치 내 모든 tool_use를 초과분 포함하여 실행했다 (예: 잔여 한도 1인데 3개 emit → 3개 모두 실행, toolCallCount=3). 신규 코드는 배치 내에서 정확히 잔여 한도만큼만 실행하고 나머지는 truncate한다. `meta.toolCalls`가 실제 실행 건수만 반영하는 방향으로 의미가 명확해지지만, 구 동작에 의존하던 소비자(과금, 감사 로그, 분석)는 숫자 차이를 인지해야 한다.
- **제안**: CHANGELOG 또는 API 릴리스 노트에 "동일 배치 내 잔여 한도 초과 시 실행 건수 감소 가능" 내용을 명시.

### [INFO] KB tool description 변경 — LLM tool 스키마는 계약 표면에 해당
- **위치**: `kb-tool-provider.ts` L126–137
- **상세**: `buildTools()`가 반환하는 ToolDef의 `description`과 `query` 파라미터 설명이 변경됐다. 해당 tools 배열은 `llmService.chat()` 호출의 `tools` 파라미터로 전달되는 내부 LLM 프로토콜이므로 외부 REST API 계약과는 직접 무관하다. 단, `_turnDebugHistory` / `llmCalls[].requestPayload` 내부에 tool 정의가 그대로 직렬화되어 노출되므로, 디버그 API 응답에서 description 문자열을 파싱하는 소비자가 있다면 영향받는다.
- **제안**: 현재 대응 불필요. 디버그 전용 필드이며 스펙에 파싱 의존 금지 사항이 명시된 경우 INFO 수준 유지.

### [INFO] e2e placeholder 스킵 — 공개 API 계약과 무관
- **위치**: `backend/test/app.e2e-spec.ts`, `jest-e2e.json`
- **상세**: `GET /` 라우트가 없는 scaffold e2e를 `describe.skip`으로 처리하고 `transformIgnorePatterns`를 추가한 것으로, 외부 API 계약에 영향 없음.

---

## 요약

이번 변경의 핵심은 provider tool 병렬 실행(Promise.all)과 배치 truncate 도입이다. 외부 REST API의 최상위 응답 구조(`config`, `output`, `meta`, `port`, `status`)는 동일하게 유지되므로 주요 breaking change는 없다. 다만 멀티턴 `output.result.messages`에 내부 프로토콜 메시지(`tool_call_budget_exceeded`)가 그대로 노출되는 점, 그리고 배치 내 실행 건수 시맨틱이 변경되어 `meta.toolCalls`가 기존보다 보수적으로 카운팅되는 점은 API 소비자 측에서 인지해야 할 동작 변화이며, 스펙 문서(`spec/4-nodes/3-ai-nodes.md`, `spec/5-system/9-rag-search.md`)는 이를 이미 반영하여 갱신되어 있다.

## 위험도

**LOW**