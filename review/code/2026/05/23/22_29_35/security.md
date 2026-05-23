# Security Review

리뷰 대상 커밋: `d607c9ec` — `feat(ai-agent): render_form 활성 form 의 timeline 인라인 통합 + form bypass`

---

## 발견사항

### [INFO] form 데이터의 JSON.parse — 비정상 입력에 대한 방어 처리 존재

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `form_submitted` 분기 (변경 전부터 존재, 이번 변경에서 분기 조건이 명시화됨)
- 상세: `JSON.parse(userMessage)` 시 try-catch 로 감싸져 있고, parse 실패 시 `formData = {}` 로 fallback 처리된다. 이번 변경은 해당 경로를 `messageSource === 'form_submitted'` 조건으로 더 명확히 제한하여 이전보다 오히려 공격 면적을 줄였다.
- 제안: 현행 방어 수준 충분. 별도 조치 불필요.

### [INFO] cancelled tool_result 주입 — LLM 컨텍스트 조작 가능성 검토

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `ai_message` bypass 분기 (신규)
- 상세: 사용자가 form 활성 중 일반 메시지를 보내면 서버가 `{type:'cancelled', reason:'user_sent_message_instead'}` 를 tool_result 로 LLM 메시지 히스토리에 주입한다. 이 값은 코드에 하드코딩된 서버 생성 문자열이며, 사용자 입력에서 직접 파생되지 않는다. LLM 프롬프트 인젝션 가능성이 없다.
- 제안: 현행 방어 수준 충분.

### [INFO] `source` 파라미터 타입 안전성

- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableMessageSource` 타입 정의
- 상세: `'ai_message' | 'form_submitted'` 로 타입이 유니언 리터럴로 정의되어 있어 런타임에 임의 문자열 주입이 불가능하다. 엔진이 직접 리터럴 값을 하드코딩하여 전달하므로 (파일 2 참조) 사용자가 이 값을 제어할 경로가 없다.
- 제안: 현행 방어 수준 충분.

### [INFO] 프론트엔드 — `pendingFormToolCallId` 매칭을 통한 interactive form 활성화

- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `PresentationItem` case "form" 분기
- 상세: `isActive` 판정 조건이 `pendingFormToolCallId === p.toolCallId` 로 엄격하게 일치 비교한다. 단순 존재 여부가 아닌 값 비교이므로 다른 form payload 가 interactive 로 잘못 활성화되는 케이스가 방지된다. `onSubmitForm` 미전달 시 fallback 하는 defensive guard 도 존재한다.
- 제안: 현행 방어 수준 충분.

### [INFO] 프론트엔드 — `sanitizeUserMessage` 위험 URI 스킴 필터링

- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `sanitizeUserMessage` 함수 (변경 전부터 존재)
- 상세: `javascript:`, `data:`, `vbscript:` 스킴을 정규표현식으로 차단하고 500자 길이 제한을 적용한다. 이번 변경에서 이 함수가 수정되지 않았고, form bypass 경로의 사용자 메시지(`userMessage`)는 버튼 합성 경로가 아닌 별도의 chat input 전송 경로를 따르므로 본 함수의 적용 범위와 관계없다.
- 제안: form bypass 로 전달되는 일반 채팅 메시지(ai_message source)에 대해 서버 측 길이 검증이 별도로 존재하는지 확인 권고 (이번 diff 범위 밖).

### [INFO] `waitingConversationConfig` unsafe cast — 클라이언트 신뢰 경계

- 위치: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` 및 `executions/[id]/page.tsx`
- 상세: `(waitingConversationConfig as | { pendingFormToolCall?: { toolCallId?: string } | null } | null)?.pendingFormToolCall?.toolCallId` 패턴으로 optional chaining 을 사용해 안전하게 추출한다. 예상치 못한 형태여도 `null` 로 fallback 된다.
- 제안: 현행 방어 수준 충분.

### [INFO] 하드코딩된 시크릿 — 없음

- 상세: 전체 diff 에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 존재하지 않는다.

### [INFO] 인증/인가 변경 — 없음

- 상세: 이번 변경은 form 제출 경로의 source 신호 전달 및 UI 렌더링 리팩터링이며, 인증·인가 로직에 변경이 없다. `processMultiTurnMessage` 접근 자체는 기존 엔진의 authorization gate 를 통과한 후에만 호출된다.

---

## 요약

이번 변경(d607c9ec)은 AI Agent `render_form` 활성 form 의 UI 단일화 및 form bypass 분기 신설로 이루어져 있다. 보안 관점에서 신규 위험 요소가 발견되지 않았다. `source` 파라미터는 서버 내부에서 리터럴로 하드코딩되어 사용자가 제어할 수 없고, cancelled tool_result 도 서버 생성 문자열이므로 LLM 프롬프트 인젝션 경로가 없다. 프론트엔드의 `pendingFormToolCallId` 매칭은 값 동등 비교로 엄격하게 제한되어 있으며, `onSubmitForm` 미전달 시 defensive fallback 이 존재한다. form 데이터의 JSON.parse 경로에는 기존과 동일하게 try-catch 방어가 적용되어 있다. 전체적으로 이번 변경은 기존 보안 수준을 유지하거나 소폭 강화(source 조건 명시화로 오분기 방지)한 수준이다.

---

## 위험도

NONE
