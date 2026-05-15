---

## 발견사항

### **[WARNING]** 스키마 `.passthrough()` — 임의 필드가 검증 없이 통과
- **위치**: `ai-agent.schema.ts:326`
- **상세**: `aiAgentNodeConfigSchema.passthrough()`는 스키마에 정의되지 않은 모든 키를 검증·거부 없이 그대로 통과시킨다. 핸들러가 `toolNodeIds`/`toolOverrides`를 읽지 않더라도, 악의적인 사용자가 `__proto__`, `constructor` 등의 키를 포함한 객체를 config로 주입할 경우 DB 저장→복원 사이클에서 prototype pollution 벡터가 될 수 있다.
- **제안**: `.passthrough()` 대신 `.strip()` 사용을 검토하거나, 허용 키 목록(`allowlist`)을 명시한 후 `passthrough()`를 제거한다. legacy `toolNodeIds`/`toolOverrides`는 스키마에 `.optional()`로 명시적으로 정의하고 무시 처리하는 것이 더 안전하다.

---

### **[WARNING]** LLM 툴콜 arguments 원문이 WebSocket 이벤트로 브로드캐스트
- **위치**: `ai-agent.handler.ts:271–282`
- **상세**: `tool_call_started` 이벤트의 `arguments` 필드에 LLM이 생성한 원본 문자열이 그대로 포함된다. KB 검색 쿼리, 사용자 발화 내용 등 민감 데이터가 해당 execution의 모든 WS 구독자에게 노출된다. 툴 결과는 `TOOL_RESULT_PREVIEW_CHARS(200)` 캡이 있는 반면 인자는 무제한이다.
- **제안**: `tool_call_started` payload의 `arguments`에도 동일한 `previewContent()` 또는 별도 길이 제한을 적용한다. 민감 KB 쿼리 포함 여부에 따라 전송 자체를 선택적으로 생략하는 옵션도 고려한다.

---

### **[WARNING]** `maxToolCalls` / `maxTurns` 상한 없음 — 리소스 고갈 가능
- **위치**: `ai-agent.schema.ts:263–275`, `311–324`
- **상세**: `maxToolCalls`와 `maxTurns` 모두 스키마에서 하한(≥0 수준)만 부분 검증하고 상한이 없다. 워크플로 편집 권한을 가진 사용자가 `maxToolCalls: 100000`을 설정하면 단일 실행에서 LLM API를 과도하게 호출해 비용 폭발/서비스 저하를 유발할 수 있다. `maxTurns: 0` (unlimited)도 의도치 않은 무한 대화를 허용한다.
- **제안**: 스키마에 `.max(100)` / `.max(200)` 수준의 상한을 추가한다. `maxTurns: 0` unlimited 허용 정책이 필요하다면 별도 boolean 필드(`unlimitedTurns`)로 분리하는 것이 명시적이다.

---

### **[WARNING]** Condition ID 충돌 — `sanitizeId`로 인한 라우팅 오작동
- **위치**: `ai-agent.handler.ts:105–111`, `ai-agent.schema.ts:432–448`
- **상세**: `sanitizeId`는 비영숫자/언더스코어 문자를 `_`로 치환하므로 `a-b`와 `a_b` 두 condition ID가 모두 `cond_a_b`로 동일한 툴명을 생성한다. `validateAiAgentConfig`에서 reserved port 충돌은 검사하지만 이 ID 정규화 충돌은 검사하지 않는다. 동일 툴명이 LLM에 등록되면 LLM이 어느 조건인지 구분하지 못하고 잘못된 포트로 라우팅될 수 있다.
- **제안**: `validateAiAgentConfig`에서 정규화 후(`sanitizeId`) 중복을 검사하는 로직을 추가한다.

---

### **[WARNING]** `sanitizeToolError` — 첫 줄 노출 범위가 넓음
- **위치**: `ai-agent.handler.ts:64–72`
- **상세**: 멀티라인 예외 메시지의 첫 줄을 200자 내에서 그대로 노출한다. DB 연결 문자열이나 내부 호스트명이 줄바꿈 없이 단일 줄로 들어올 경우 필터링되지 않는다. `err.message`가 `postgres://user:password@host/db`처럼 생성되는 경우 클라이언트에 전달된다.
- **제안**: 첫 줄 길이 제한에 더해 URL-형태 패턴(`://`), 비밀번호처럼 보이는 긴 랜덤 문자열에 대한 추가 필터를 적용하거나, provider별로 알려진 안전한 오류 코드만 반환하는 구조적 에러 타입으로 전환한다.

---

### **[INFO]** `ragThreshold` 범위 검증 없음
- **위치**: `ai-agent.schema.ts:193–204`
- **상세**: 0~1 사이의 유사도 임계값으로 문서화되어 있으나 스키마에 `.min(0).max(1)` 제약이 없다. 음수 또는 1 초과 값이 KB 검색 로직에 예상치 못한 동작을 유발할 수 있다.
- **제안**: `.min(0).max(1)` 추가.

---

### **[INFO]** `normalToolCalls` stub — LLM 생성 arguments가 툴 결과로 반영됨
- **위치**: `ai-agent.handler.ts:582–592`, `969–980`
- **상세**: 현재 `normalToolCalls`(외부 노드 stub)은 LLM이 요청한 `tc.arguments`를 그대로 도구 결과 메시지에 포함시켜 다음 LLM 호출에 전달한다. LLM이 의도적으로 조작된 arguments를 생성해 도구 결과처럼 보이게 만들어 후속 LLM 판단을 유도하는 간접 prompt injection 가능성이 있다. 이 경로는 아직 stub 상태라 실제 노출은 제한적이지만, tool connection 재작성 시 이 패턴을 유지하면 위험해진다.
- **제안**: 재작성 시 tool 결과에 LLM 생성 arguments를 포함하지 않거나, 포함 시 LLM이 생성한 부분임을 명확히 레이블링한다.

---

### **[INFO]** condition `reason` 필드 — UI 렌더링 시 XSS 잠재 위험
- **위치**: `ai-agent.handler.ts:1282–1287`
- **상세**: LLM이 생성한 `reason` 문자열이 500자 내로 잘려 `output.result.condition.reason`에 저장된다. 백엔드 자체는 안전하지만, 이 값을 프론트엔드에서 `innerHTML` 등으로 렌더링할 경우 LLM이 `<script>` 같은 페이로드를 생성해 XSS를 유발할 수 있다. 프론트엔드의 처리 방식에 의존하는 위험이다.
- **제안**: 백엔드에서 `reason` 저장 시 HTML 엔티티 이스케이프를 추가하거나, 프론트엔드에서 반드시 텍스트 렌더링(textContent)을 사용함을 spec/문서로 명시한다.

---

### **[INFO]** 하드코딩된 시크릿 없음 확인
- 코드 내 API 키, 비밀번호, 토큰 하드코딩 없음. `llmConfigId`로 간접 참조하는 구조는 적절하다.

---

## 요약

AI Agent 핸들러는 에러 메시지 sanitization, 툴 결과 preview cap, 조건 reason 500자 제한 등 보안을 고려한 설계가 다수 반영되어 있다. 그러나 스키마의 `.passthrough()` 사용으로 인한 임의 필드 통과, WS 이벤트에 LLM 인자가 무제한 포함되는 문제, `maxToolCalls`/`maxTurns`의 상한 부재(비용 폭발/DoS 가능성), 그리고 `sanitizeId` 정규화로 인한 condition ID 충돌이 중간 우선순위 이슈로 확인된다. 하드코딩 시크릿이나 직접적인 인젝션 취약점은 없으며, 인증·인가 로직은 상위 레이어에 위임된 구조이다.

## 위험도

**MEDIUM**