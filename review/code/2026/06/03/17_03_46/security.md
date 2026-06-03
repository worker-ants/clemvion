# 보안(Security) 리뷰

## 발견사항

### [INFO] 새 타임스탬프 필드(startedAt/finishedAt)는 기존 llmCalls strip 정책 아래 간접 보호됨
- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` — `EXTERNAL_STRIPPED_FIELDS`, `stripExternalOnlyFields`
- **상세**: `startedAt`/`finishedAt`은 `llmCalls[]` 배열 요소의 내부 필드로 추가되었다. `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`는 top-level `llmCalls` 키 전체를 fanout envelope에서 제거하므로, 그 안에 포함된 `startedAt`/`finishedAt`도 함께 제거된다. 즉 이 타임스탬프들은 SSE/webhook/채널 수신자에게 도달하지 않는다. 코드 주석도 이를 명확히 설명하고 있다. strip 함수는 shallow(top-level only)임을 문서화하고 있으며, 해당 함수 설계상 `llmCalls` 전체가 제거되는 구조이므로 내부 중첩 필드까지 별도로 strip할 필요가 없다.
- **제안**: 현재 구현은 올바르다. 향후 `llmCalls` 없이 `startedAt`/`finishedAt`을 top-level 필드로 직접 emit하는 코드 경로가 추가될 경우, 해당 필드도 `EXTERNAL_STRIPPED_FIELDS`에 추가하거나 별도 가드가 필요함을 문서화해 두길 권장한다.

---

### [INFO] tool_call_started / tool_call_completed 이벤트의 startedAt/finishedAt은 외부 fanout에 포함됨 — 설계 의도이나 인지 요망
- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` `emitExecutionEvent`, `ToolCallStartedPayload`, `ToolCallCompletedPayload`; `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- **상세**: `tool_call_started` 및 `tool_call_completed` 이벤트는 `llmCalls` 필드를 포함하지 않으므로 `stripExternalOnlyFields`가 적용되어도 이 이벤트들의 `startedAt`/`finishedAt`은 제거되지 않는다. 즉 SSE 구독자 및 채널 수신자(webhook, ChatChannel)도 tool 실행의 절대 시각을 수신한다. 이는 민감 정보(시스템 프롬프트, 대화 기록 등)가 아닌 단순 타임스탬프이며, spec에서 `llmCalls`와 달리 tool 타임스탬프를 external strip 대상으로 명시하지 않은 것이 의도적 설계임을 확인했다. 단, 절대 시각 노출은 외부 공격자가 서버의 처리 지연을 추론하는 타이밍 오라클로 활용할 가능성을 이론적으로 가지며, 서버 인프라 정보를 미약하게 누출할 수 있다.
- **제안**: 현재 운용 위협 모델에서 tool 타임스탬프 노출이 수용 가능한 범위라면 현재 구현은 적절하다. 향후 외부 채널 수신자의 범위가 확대될 경우 이 판단을 재검토하고 결정을 스펙에 명시적으로 기록해 두길 권장한다.

---

### [INFO] 프론트엔드에서 startedAt/finishedAt을 formatDate로 렌더링 — XSS 위험 없음
- **위치**: `codebase/frontend/src/lib/utils/date.ts` `formatDate`; 다수 TSX 렌더링 컴포넌트
- **상세**: `formatDate`는 `new Date(input)` 파싱 후 `toLocaleString`/`toLocaleTimeString`/`toLocaleDateString`을 사용하고, 파싱 실패 시 정적 문자열 `"—"`를 반환한다. ISO8601 문자열이 날짜 파싱에 실패해도 Raw 값이 아닌 대체 문자열이 렌더링되므로 XSS 경로가 없다. React JSX 바인딩을 통한 렌더링이므로 기본 HTML 이스케이프도 적용된다.
- **제안**: 현재 구현은 안전하다.

---

### [INFO] 백엔드에서 startedAt/finishedAt은 서버 자체 생성값 — 외부 입력 없음
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- **상세**: 모든 `startedAt`/`finishedAt`은 `new Date(Date.now()).toISOString()` 또는 `new Date().toISOString()` 형태로 서버 내부에서 생성된다. 사용자 입력값이 이 필드로 유입될 수 없으므로 인젝션이나 조작 위험이 없다. `callStartedAt`은 `Date.now()`(정수)를 포획한 뒤 `new Date(callStartedAt).toISOString()`으로 문자열화하는 패턴이 일관되게 사용되어 있어 타임스탬프 위조 경로도 없다.
- **제안**: 현재 구현은 안전하다.

---

### [INFO] 프론트엔드 WS payload 타입 inline 선언에서 startedAt을 string으로만 선언 — 런타임 검증 없음
- **위치**: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (라인 618, 646 등 inline 타입 선언)
- **상세**: WS 이벤트 핸들러에서 `payload` 타입을 inline으로 `startedAt?: string`으로 선언하지만, 실제 수신값에 대한 런타임 형식 검증(ISO8601 패턴 확인 등)은 없다. 악의적이거나 손상된 WS 서버가 `startedAt`에 비정상 값(예: 매우 긴 문자열, 특수문자)을 전달해도 그대로 `timestamp` 필드에 할당된다. 단, 최종 렌더링 단계에서 `formatDate`가 파싱 실패 시 `"—"`를 반환하므로 렌더링 수준의 방어는 있다. 위협 시나리오는 WS 서버 자체가 침해된 경우이며, 그 경우 본 필드 외에도 더 심각한 공격 벡터가 존재한다.
- **제안**: 현재 위협 수준은 낮다. defense-in-depth 차원에서 `startedAt`을 store에 저장하기 전 ISO8601 정규식(예: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/`)으로 검증하는 것을 선택적으로 고려할 수 있다.

---

### [INFO] 하드코딩된 시크릿·인증/인가·암호화 취약점 없음
- **위치**: 변경된 파일 전체
- **상세**: 변경된 파일 어디에도 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. 인증 우회 가능성, 권한 검증 누락, 세션 관리 문제도 발견되지 않았다. SQL/커맨드/경로/LDAP 인젝션 가능성 없음. 안전하지 않은 해시·암호화 알고리즘 사용 없음. 에러 메시지에 민감 정보가 노출되는 구조도 없다. OWASP Top 10 해당 항목이 관찰되지 않았다.
- **제안**: 해당 없음.

---

## 요약

이번 변경(LLM 호출 및 tool 실행에 `startedAt`/`finishedAt` ISO8601 타임스탬프 추가)은 보안 관점에서 전반적으로 안전하다. 가장 민감한 경로인 `llmCalls`(시스템 프롬프트·대화 기록·tool 정의 포함)는 기존 `EXTERNAL_STRIPPED_FIELDS` 정책에 의해 이미 외부 fanout에서 제거되고 있으며, 신규 `startedAt`/`finishedAt` 필드도 `llmCalls` 배열 내부에 위치하므로 같은 정책의 보호를 받는다. `tool_call_*` 이벤트의 타임스탬프는 외부로 노출되지만 이는 설계 의도이며 민감 정보가 아니다. 모든 타임스탬프는 서버 자체 생성값으로 인젝션 경로가 없고, 프론트엔드 렌더링 계층에서 `formatDate`가 비정상 입력을 대체 문자열로 처리해 XSS 가능성이 없다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 등 OWASP Top 10 항목의 취약점은 발견되지 않았다. 프론트엔드에서 타임스탬프 필드에 대한 런타임 ISO8601 검증이 없는 점은 낮은 수준의 개선 권고사항으로 남는다.

## 위험도

LOW
