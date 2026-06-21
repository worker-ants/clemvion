### 발견사항

- **[INFO] 프롬프트 인젝션 — KB 가이던스·Presentation 가이던스 상수 노출**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `KB_TOOL_GUIDANCE`, `PRESENTATION_TOOLS_GUIDANCE` (라인 624~660)
  - 상세: 두 가이던스 상수는 하드코딩 문자열이며 `systemPrompt` 뒤에 append된다. 사용자가 `systemPrompt` 필드에 `]\n\n[Knowledge Base]...` 형태의 입력을 넣어 추가된 가이던스처럼 보이는 가이던스를 삽입하는 것은 구조적으로 가능하나, 이 값은 이미 workflow config에서 engine이 제어하는 값이므로 일반 최종 사용자가 직접 조작할 수 없다. 실질 위험도는 낮다.
  - 제안: 우선순위는 낮으나, 향후 systemPrompt 필드가 외부 입력에서 직접 채워지는 경로가 추가될 경우 newline 기반 인젝션 방어 로직을 추가할 것.

- **[INFO] `userMessage`가 LLM 컨텍스트에 새니타이징 없이 직접 삽입됨**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `processMultiTurnMessage` (라인 2289)
  - 상세: `messages.push({ role: 'user', content: userMessage })` — 최종 사용자 입력이 검증 없이 LLM chat messages에 직접 삽입된다. LLM 자체가 대화 입력으로 처리하므로 이는 의도된 동작이지만, 극히 긴 메시지(토큰 폭주)나 특수 제어 시퀀스에 대한 길이 제한이 없다. `formData` 에는 `FORM_SUBMITTED_MAX_BYTES` cap이 적용되나(라인 693), 일반 `userMessage`에는 동일한 길이 제한이 없다.
  - 제안: 일반 chat 메시지에도 최대 길이(예: 32KB) cap을 적용해 토큰 비용 폭주를 방어할 것.

- **[INFO] `form_submitted` 경로 — JSON 파싱 후 `formData`가 LLM tool_result에 그대로 노출**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (라인 2183~2216)
  - 상세: 사용자가 제출한 form 데이터는 `FORM_SUBMITTED_MAX_BYTES`(10KB) cap 후 LLM context에 삽입된다. 코드 주석(라인 671~677)에서 "message 필드는 하드코딩 상수만 허용 (프롬프트 인젝션 회피)" 라고 명시하며 `data` 필드에만 사용자 입력이 들어가는 구조는 올바르다. cap 로직도 구현됨. 설계는 안전하다.
  - 제안: 현 설계 유지. INFO 수준으로 기록.

- **[INFO] `normalToolCalls` — `tc.arguments`가 tool_result에 echo됨**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 1738~1744 (single-turn), 라인 2637~2643 (multi-turn)
  - 상세: 일반 도구(stub) 처리 시 `JSON.stringify({ result: \`Tool ${tc.name} executed\`, arguments: tc.arguments })` 형태로 LLM이 보낸 `arguments` 원문을 그대로 tool_result에 재삽입한다. `tc.arguments`는 LLM이 생성한 값이므로 사용자 입력이 아니지만, LLM hallucination으로 대형 JSON이 arguments에 삽입될 경우 tool_result 크기가 비제한으로 커질 수 있다.
  - 제안: stub tool_result에도 arguments echo 크기를 cap하거나, arguments 자체를 echo하지 않는 방향을 검토.

- **[INFO] `sanitizeToolError` — 200자 truncate 보호가 있으나 첫 줄에 민감 정보 포함 가능성**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 534~542
  - 상세: 예외 메시지의 첫 줄만 추출하고 200자로 제한하여 WS/UI에 노출한다. DB 연결 문자열, 내부 호스트명 등이 포함된 긴 스택 트레이스는 차단된다. 다만 첫 줄 자체에 민감 정보(예: `Connection refused to postgres://user:pass@host`)가 포함될 가능성은 여전히 존재한다.
  - 제안: 첫 줄에서도 URL 형태(`://` 포함 문자열) 또는 자격증명 패턴을 regex로 추가 마스킹할 것.

- **[INFO] `_retryState` — 자격증명 필드 의도적 제외, 설계 양호**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `buildRetryState` (라인 3096~3151)
  - 상세: `llmConfigId`, `workspaceId`, `executionId`, `conditions`, `maxTurns` 등 자격증명·컨텍스트 바인딩 필드는 의도적으로 allow-list 방식으로 제외된다. 테스트 코드(라인 315~316)도 `retryState.llmConfigId === undefined` 를 검증한다. 설계가 올바르다.

- **[INFO] `process.env.AI_RETRY_STATE_TTL_MINUTES` 환경변수 직접 읽기 — 상한 없음**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `resolveRetryStateTtlMinutes` (라인 614~622)
  - 상세: 잘못된 값(음수, 매우 큰 값)에 대해 default fallback이 있으나 상한이 없어 극단적으로 긴 TTL(예: 수년)이 설정될 수 있다.
  - 제안: 상한 clamp(예: `Math.min(parsed, 1440)`)를 추가할 것.

- **[INFO] LLM 최종 응답(`lastResponse`)이 필터링 없이 output에 노출됨**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `buildMultiTurnFinalOutput` (라인 3008~3010)
  - 상세: LLM 최종 응답이 `output.result.response`에 그대로 내보내진다. 이는 설계 의도이나, 프론트엔드에서 HTML 렌더링 시 XSS 위험이 있다. 백엔드 코드 범위 밖이나 전체 보안 체인 관점에서 언급.
  - 제안: 프론트엔드에서 LLM 응답 렌더링 시 HTML escaping 적용 여부를 확인할 것.

### 요약

이 변경은 `AiAgentHandler`의 turn 실행 로직을 무상태 collaborator `AiTurnExecutor`로 추출한 리팩토링이다. 기능 코드가 verbatim 이동되었으므로 새로운 보안 취약점이 도입된 가능성은 낮으며, 오히려 코드 분리로 감사 가능성이 향상되었다. 주요 보안 설계(credential allow-list 기반 `_retryState`, `sanitizeToolError`, formData cap, tool_result preview cap, `message` 필드 하드코딩)는 모두 올바르게 구현되어 있고 테스트로 검증된다. 발견된 항목들은 모두 INFO 수준으로, 일반 사용자 메시지의 길이 제한 부재와 tool error 첫 줄의 잠재적 민감 정보 노출이 가장 주목할 항목이다. SQL 인젝션, XSS(백엔드 레이어), 커맨드 인젝션, 하드코딩 시크릿, 인증 우회, 안전하지 않은 암호화 알고리즘은 발견되지 않았다.

### 위험도

LOW
