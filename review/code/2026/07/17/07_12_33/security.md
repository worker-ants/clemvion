# 보안(Security) 코드 리뷰

리뷰 대상: `handleNodeFailed` 가 `payload.output`(엔진이 보낸 대화형 노드의 outputData 전체)을
`NodeResult.outputData` 에 싣고, `result-detail.tsx` / `output-shape.ts` / `conversation-inspector.tsx`
가 `status` 게이트 없이 이를 Preview 탭에 렌더링하도록 확장한 변경 (13개 파일, frontend 7 + plan 1 + spec 5).

## 조사 방법

diff 에 포함되지 않은 배경 코드(백엔드 `ai-turn-orchestrator.service.ts`, `ai-turn-executor.ts`,
`sanitize-error-message.ts`, `thread-renderer.ts` 의 `redactThreadForPublic`/`deepRedactSecrets`)를
함께 열람해 (a) 이 경로에 기존 redaction 정책이 적용되는지, (b) §9.4/§9.5 LLM-facing 마커 strip 이
새 경로에서도 유지되는지 실측했다.

## 발견사항

- **[WARNING]** 대화형 노드의 실패 종결 output(`output.result.messages` — tool-call arguments/결과 포함)에는 egress 마스킹이 적용되지 않으며, 이번 변경으로 노출 도달 경로가 "completed 전용"에서 "completed+failed"로 넓어진다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:871` (`outputData: payload.output ?? null`), `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3267-3279`(`buildMultiTurnFinalOutput` — `output.result.messages = messages` 그대로, redaction 호출 없음), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1296-1314`(`NODE_FAILED` emit 이 `output: nodeExec.outputData` 를 그대로 동봉)
  - 상세: 프로젝트에는 이미 명확한 egress 마스킹 계층이 있다 — `EXECUTION_WAITING_FOR_INPUT` emit 은 `redactThreadForPublic(context.conversationThread)` / `deepRedactSecrets({...initialConv})` 를 명시적으로 통과시키고, spec(`conversation-thread.md` §8.4 diff)도 "SSE emit 과 REST `getStatus` 가 공유하는 단일 helper `redactThreadForPublic`" 을 "공개 표면 한정" 으로 명시한다. 반면 `NODE_FAILED`/`NODE_COMPLETED` 이벤트의 `output` 필드(즉 `nodeExec.outputData` 전체 — `output.result.messages`, tool-call `arguments`/결과 포함)는 **어느 경로에서도 masking 을 거치지 않는다.** `errorPayload.message`/`details` 는 `AiTurnOrchestrator.extractAiTurnErrorPayload` 가 `sanitizeLastErrorMessage` 로 이미 살균하지만(`ai-turn-orchestrator.service.ts:1148, 1178`), 대화 본문(`messages`)에는 그 함수가 적용되지 않는다. spec `ED-AI-37`(`_product-overview.md` §10.9 — "inputData·outputData·error 의 민감 필드(apiKey, token, password, secret 등)는 서버가 자동 마스킹 후 반환")는 AI 어시스턴트의 별도 read-only 조회 도구(§10.9)에 대한 요구사항이고, run-results 패널(Output/Preview 탭)에는 대응하는 masking 요구사항이나 구현이 확인되지 않는다.
    이 gap 자체는 이번 diff 가 만든 것이 아니다 — `completed` 상태의 대화형 노드는 이미 동일한 raw `output.result.messages` 를 Output 탭(JSON viewer, 항상 노출)과 Preview 탭(`isCompletedConversation` 게이트)에 노출해왔다. 이번 diff 는 그 기존 패턴을 `node.completed`↔`node.failed` 사이에서 **대칭화**(`outputData: null` 하드코딩 제거)했을 뿐이며, 새 종류의 취약점을 도입하지 않는다. 다만 (1) 이전에는 실패 노드에서 `outputData` 가 항상 `null` 이었으므로 이 gap 이 실질적으로 도달 불가였는데, 이제는 실패 노드에서도 도달 가능해져 **노출 표면이 넓어졌고**, (2) 실패 종결은 정확히 LLM 호출/도구 호출이 비정상 종료된 turn 이라 예외적인 provider 응답(예: 인증 실패 직전에 부분 전송된 헤더 echo, tool 호출이 반환한 원문 API 응답 등)이 섞여 들어올 가능성이 완료 turn 대비 상대적으로 높다.
    이 프로젝트의 실질적 방어선은 "노드 핸들러가 turn 텍스트에 민감 중간결과를 남기지 않는다는 제약"(spec 인용, egress 계층이 아니라 **소스 계층**의 계약)이며, 이는 검증되지 않은 전제다 — 예: Cafe24/Makeshop MCP tool 이 토큰/세션 정보를 포함한 원문 응답을 tool_result 로 반환하면 그대로 `messages[].content` 에 실려 이 경로로 노출된다.
  - 제안: (1) 이 판단이 팀의 의도된 스코프 결정(인증된 에디터 표면은 redaction 대상 밖)이라면 `conversation-thread.md` §8.4/§8.5 Rationale 에 "run-results 패널(Output/Preview)은 egress 마스킹 대상이 아니며, 방어선은 핸들러 계약이다" 를 명시적으로 기록해 향후 동일 질문 반복을 막을 것. (2) 방어 종심(defense-in-depth) 관점에서 최소한 `output.result.messages`/tool 결과에도 `deepRedactSecrets` 적용을 검토할 것 — 비용이 크지 않고(`waiting_for_input` 경로에는 이미 존재하는 helper 재사용) "실패 turn"이라는, 정상 경로보다 예외적 데이터가 섞이기 쉬운 경우를 우선 커버할 수 있음.

- **[INFO]** §9.5 LLM-facing 마커(`[user-input]…[/user-input]`) strip 은 새 경로에서 유지됨 — 확인 완료, 회귀 없음
  - 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts:627-743`(`parseHistoryMessages` → 내부에서 `messagesToConversationItems` 호출), `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:862-871`
  - 상세: `parseHistoryMessages` 는 spec §9.5 가 명시한 4개 strip 진입점 중 하나이며, 내부적으로 `messagesToConversationItems`(`USER_INPUT_MARKER_RE = /\[\/?user-input\]/g` 적용)를 호출해 `output.result.messages` 의 user/assistant content 를 정규 변환한다. `conversation-inspector.tsx` 의 신규 early-return(`if (conversationMessages.length > 0) return conversationMessages;`)은 caller 가 이미 이 strip-적용 변환을 거친 결과(`historyMessages`/`effectiveConversationMessages`, 둘 다 `parseHistoryMessages` 또는 store 의 strip-적용 ingestion 을 거침)를 신뢰하는 것이므로 우회 경로가 아니다. `parseHistoryMessages` 가 신규로 합성하는 `system_error` 항목(`errorObj.message`)은 strip 을 거치지 않지만, 이는 백엔드가 생성한 시스템 에러 메시지(`sanitizeLastErrorMessage` 를 이미 거침)이지 LLM raw payload 의 user-input 마커를 포함할 수 있는 필드가 아니므로 §9.5 위반이 아니다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 신규 노출 경로에 XSS 위험 추가 없음 — React 텍스트 노드 렌더링, `dangerouslySetInnerHTML` 미사용
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`, `result-detail.tsx`
  - 상세: 이번 diff 가 새로 노출하는 `messages`/`system_error` 콘텐츠는 기존 conversation 렌더 파이프라인(React JSX 텍스트 바인딩, 자동 이스케이프)을 그대로 재사용한다. `dangerouslySetInnerHTML` 은 이 디렉터리에서 `renderers/presentation-renderers.tsx` 의 별도(변경 없음) 경로에만 존재하며 `sanitizeHtml` 을 이미 거친다 — 이번 diff 와 무관.
  - 제안: 없음.

- **[INFO]** 테스트 fixture 에 실제 시크릿 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts` (`"Invalid API key."`, `nodeExecutionId: "11111111-1111-4111-8111-111111111111"`)
  - 상세: `"Invalid API key."` 는 LLM_AUTH_FAILED 에러 메시지 텍스트(실제 키 값 아님)이고, UUID 는 고정 테스트 fixture로 실제 자격증명이 아니다. grep(`sk-`, `AKIA`, `BEGIN PRIVATE KEY`, 하드코딩 password/apiKey 패턴)로 diff 전체를 확인했으나 매치 없음.
  - 제안: 없음.

- **[INFO]** 인증/인가·인젝션·암호화·의존성 영역 — 해당 없음
  - 상세: 이번 diff 는 WS 이벤트 payload 의 필드 하나(`output`)를 타입 선언·전달 경로에 추가하고, 프론트 렌더 게이트 조건을 `status` 기반에서 `outputData` 존재 기반으로 바꾸는 순수 프론트/스펙 변경이다. 새로운 API 엔드포인트, 권한 체크 분기, SQL/커맨드 실행, 암호화 로직, 신규 의존성이 없다. WS 룸/구독 권한 모델 자체는 변경되지 않았다(같은 execution 스코프 내 authenticated client 만 소비).
  - 제안: 없음.

## 요약

이번 변경은 백엔드가 이미 실패 노드에도 영속·emit 하던 `outputData`(대화 전체)를 프론트가 버리지 않고 저장·렌더링하도록 대칭화한 것으로, WS 프로토콜이나 인증/인가 모델을 확장하지 않는 순수 표시-계층 변경이다. §9.5 LLM-facing 마커 strip 은 기존 변환 함수(`parseHistoryMessages`/`messagesToConversationItems`)를 그대로 재사용해 유지되며 새 우회 경로는 없다. 다만 (a)에서 조사한 대로, `output.result.messages`(tool-call 원문 포함)에는 프로젝트가 공개 표면(EIA/위젯)용으로 이미 갖춘 `redactThreadForPublic`/`deepRedactSecrets` 마스킹이 이 인증된 에디터 표면에는 적용되지 않는다 — 이는 `completed` 대화 노드에는 이미 존재하던 gap이고 이번 diff 가 신규로 만든 것은 아니지만, 실패 노드까지 도달 가능해지며 노출 표면이 실질적으로 넓어졌다. 이는 명확한 인젝션·인증 우회·하드코딩 시크릿류의 CRITICAL 결함은 아니고, "핸들러가 turn 텍스트에 민감정보를 남기지 않는다"는 소스단 계약에 의존하는 기존 설계 판단의 연장선이므로 WARNING 으로 기록해 팀의 의도적 스코프 결정인지 확인·문서화(또는 방어 종심 보강)를 권고한다.

## 위험도

LOW
