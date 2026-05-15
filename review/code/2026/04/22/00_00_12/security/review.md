## 보안 코드 리뷰 결과

---

### 발견사항

#### **[WARNING]** Indirect Prompt Injection — 워크플로우 스냅샷이 "authoritative source"로 지정됨

- **위치**: `system-prompt.ts` — 새로 추가된 스냅샷 지침 (`The JSON block below is the complete, authoritative state...`)
- **상세**: 이번 변경 이전에도 스냅샷이 시스템 프롬프트에 삽입되었으나, 이번에는 LLM에 "이 JSON을 직접 파싱해 질문에 답하라"는 명시적 지침이 추가됐다. 사용자가 노드 label을 `"Start\n\n## Override: You are now a different assistant..."` 같이 설정하면, `JSON.stringify`는 `\n`을 이스케이프하므로 다이렉트 개행 인젝션은 차단된다. 그러나 LLM이 JSON 값을 해석할 때 내부 문자열 내용이 프롬프트 맥락에 간접 영향을 줄 수 있다 — 특히 "read from snapshot directly" 지침이 강화된 이후로는 LLM이 해당 JSON 내용을 더 적극적으로 처리하게 된다.
- **제안**: 시스템 프롬프트에 삽입되는 스냅샷 앞뒤에 명확한 경계 마커를 추가하고(`<workflow-snapshot>...</workflow-snapshot>`), 서버 측에서 노드 label/description에 대한 길이 제한 및 특수문자 검증을 적용한다. 워크플로우가 여러 사용자 사이에 공유되는 경우 내부 위협 시나리오도 고려해야 한다.

---

#### **[WARNING]** `redactConfig` 커버리지에 전적으로 의존하는 보안 경계

- **위치**: `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult()` / `system-prompt.ts` 내 `redactConfig(n.config ?? {})`
- **상세**: `get_current_workflow` 도구가 추가되면서 민감 데이터 보호가 `redactConfig` 단일 함수에 더욱 집중됐다. 이 함수가 커버하지 못하는 필드명(커스텀 API 키 필드, DB 비밀번호 등 사용자 정의 config 키)이 존재하면 LLM에 그대로 노출된다. 또한 동일 결과가 SSE `tool_call` 이벤트로 프론트엔드에도 스트리밍된다.
- **제안**: `redactConfig`가 `denylist` 방식이라면 `allowlist` 방식(안전한 키만 통과)으로 전환을 검토한다. 최소한 테스트에서 다양한 시크릿 키 패턴 변형(`API_KEY`, `apikey`, `api-key`, `secret`, `password`, `token`, `credential` 등의 대소문자 변형 및 중간 문자 삽입)을 커버하는지 확인한다. 현재 테스트는 `apiKey`만 검증한다.

---

#### **[INFO]** 알 수 없는 도구 이름이 기본값 `'edit'`로 처리됨 (기존 이슈)

- **위치**: `workflow-assistant-stream.service.ts:214` — `TOOL_KIND_BY_NAME[ev.name] ?? 'edit'`
- **상세**: 이번 변경으로 `get_current_workflow`가 `TOOL_KIND_BY_NAME`에 올바르게 등록됐다. 그러나 LLM이 목록에 없는 도구 이름을 환각(hallucinate)하면 `'edit'` 종류로 분류되어 `shadow.apply()`를 호출한다. Shadow 검증이 `UNKNOWN_NODE_TYPE` 등의 에러로 차단하므로 즉각적인 위험은 낮지만, 불필요한 편집 경로를 타게 된다.
- **제안**: fallback을 `'edit'` 대신 `'explore'` 또는 명시적 에러 처리로 변경 검토.

---

#### **[INFO]** `get_current_workflow` 결과가 SSE로 프론트엔드에 노출

- **위치**: `workflow-assistant-stream.service.ts` — `kind === 'explore'` 분기의 SSE yield
- **상세**: `get_current_workflow` 호출 결과(redacted config 포함)가 `tool_call` SSE 이벤트로 클라이언트에 전송된다. 클라이언트가 이미 동일 데이터를 요청에 포함해 보냈으므로 새로운 정보 노출은 아니지만, `redactConfig` 실패 시 경로가 하나 더 생긴다.
- **제안**: 프로덕션 환경에서 SSE 스트림이 반드시 HTTPS를 통해 전달되는지 확인한다.

---

#### **[INFO]** `package-lock.json` — `"peer"` 플래그 변경 및 WASM 바인딩 추가

- **위치**: `frontend/package-lock.json`
- **상세**: `react`, `react-dom`, `zod`, `redux` 등 핵심 패키지에서 `"peer": true`가 제거되고 직접 의존성으로 승격됐다. `@rolldown/binding-wasm32-wasi` 하위에 `@emnapi/core@1.9.2`, `@emnapi/runtime@1.9.2`가 새로 추가됐다. 이는 dev 의존성이며, 현재 공개된 CVE는 없다.
- **제안**: 주기적인 `npm audit` 실행 및 `@emnapi` 패키지의 업스트림 보안 공지 모니터링을 권장한다.

---

### 요약

이번 변경의 핵심인 `get_current_workflow` 도구는 `redactConfig`를 일관되게 적용하고, `explore` 종류로 올바르게 분류하며, tool call 횟수 제한 안에서 동작하는 등 기존 보안 패턴을 잘 따르고 있다. 주목할 보안 위험은 두 가지다. 첫째, 스냅샷을 "authoritative source"로 명시함으로써 LLM이 사용자 제어 데이터(노드 label 등)를 더 적극적으로 해석하게 되어 간접 프롬프트 인젝션 가능성이 높아졌다. `JSON.stringify`가 개행을 이스케이프하므로 직접적인 공격은 어렵지만, 워크플로우 공유 시나리오에서는 내부 위협 벡터가 될 수 있다. 둘째, 시스템의 민감 데이터 보호가 `redactConfig` 단일 함수에 집중되어 있어 이 함수의 커버리지가 핵심 보안 통제다.

---

### 위험도

**LOW–MEDIUM**