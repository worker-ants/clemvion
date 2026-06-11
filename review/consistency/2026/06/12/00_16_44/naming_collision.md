# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### [WARNING] `document:graph_error` 이벤트 — 네비게이션 spec 잔류 참조

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` 는 `document:graph_error` 를 "dead-declared — 실제로 emit 하지 않는다" 고 명시하고, 활성 이벤트 목록에서 제외함
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md:182` — "WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / **`_error`** / `_retry` / `_failed`) 로 실시간 갱신" 이라고 여전히 `_error` 를 나열
- **상세**: `10-graph-rag.md` 와 `data-flow/6-knowledge-base.md:289` 는 모두 `document:graph_error` 가 제거됐다고 기술하나, `5-knowledge-base.md` 는 아직 해당 이벤트를 활성 목록으로 기재한다. 구현자가 `5-knowledge-base.md` 만 보면 `document:graph_error` 를 구현해야 하는 이벤트로 오인할 수 있다.
- **제안**: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md:182` 에서 `/ _error` 를 제거하고 `data-flow/6-knowledge-base.md` 의 삭제 경위 주석(#443)을 참조하도록 수정.

---

### [INFO] `WEBAUTHN_COUNTER_REGRESSION` — 동일 의미, 일관된 다중 참조

- **target 신규 식별자**: `spec/5-system/1-auth.md §4.4.4` 가 `failure_reason='WEBAUTHN_COUNTER_REGRESSION'` 을 도입
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md:661`, `:714` 및 `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md:90`
- **상세**: 모두 같은 의미(counter 역행 LoginHistory failure_reason)로 사용 — 충돌 없음. cross-reference 가 정확히 정렬되어 있다.
- **제안**: 변경 불필요.

---

### [INFO] `KB_REEXTRACT_IN_PROGRESS` — 기존 `KB_REEMBED_IN_PROGRESS` 패턴과 대칭, 충돌 없음

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §7` 가 `KB_REEXTRACT_IN_PROGRESS` 를 409 에러 코드로 사용
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md:268`, `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md:221` 은 동일 코드를 이미 참조
- **상세**: 이미 다른 spec 파일이 `KB_REEXTRACT_IN_PROGRESS` 를 사용 중이며, `10-graph-rag.md` 의 정의와 의미가 일치한다 — 충돌 없음.
- **제안**: 변경 불필요.

---

### [INFO] WebAuthn 에러 코드들(`WEBAUTHN_DISABLED`, `CHALLENGE_INVALID`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`) — spec/5-system 외부에서 참조 없음

- **target 신규 식별자**: `spec/5-system/1-auth.md §5` API 엔드포인트 표에 나열된 WebAuthn 전용 에러 코드들
- **기존 사용처**: 검색 결과 `spec/` 내 타 파일에서 충돌하는 동일 이름 없음
- **상세**: 모두 `spec/5-system/1-auth.md` 및 연관된 `spec/2-navigation/10-auth-flow.md` 에서만 참조되며 다른 도메인에서 같은 이름을 다른 의미로 사용하는 경우 없음.
- **제안**: 변경 불필요.

---

### [INFO] `MCP_ALLOW_INSECURE_URL` 환경변수 — 다중 spec 파일에서 교차 참조, 의미 일관

- **target 신규 식별자**: `spec/5-system/11-mcp-client.md §3.2` 가 `MCP_ALLOW_INSECURE_URL` 을 정의
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md:249,580` 및 `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md:361`, `/Volumes/project/private/clemvion/spec/conventions/secret-store.md:326`
- **상세**: 모두 동일한 "production fail-closed 가드" 맥락에서 같은 의미(MCP SSRF escape hatch 환경변수)로 참조 — 충돌 없음. SoT 는 `11-mcp-client.md` 이고 나머지는 참조 형태.
- **제안**: 변경 불필요.

---

### [INFO] 요구사항 ID `KB-GR-*`, `NF-GR-*` — spec/5-system 내 단일 문서에만 존재

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §3` 의 `KB-GR-MD-*`, `KB-GR-EX-*`, `KB-GR-DM-*`, `KB-GR-SR-*`, `KB-GR-PA-*`, `KB-GR-UI-*`, `KB-GR-OB-*`, `NF-GR-*` 시리즈
- **기존 사용처**: 검색 결과 해당 ID 가 타 spec 파일에서 정의 또는 충돌하는 경우 없음
- **상세**: KB-GR prefix 는 이 문서에서만 사용되며 다른 요구사항 ID 네임스페이스(`NAV-*`, `ED-*`, `ND-*`, `INT-*` 등)와 겹치지 않는다.
- **제안**: 변경 불필요.

---

## 요약

`spec/5-system` 의 세 파일(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)이 도입하는 신규 식별자는 대부분 기존 사용처와 의미가 일치하거나 독립적 네임스페이스를 사용한다. 유일한 실질적 불일치는 `document:graph_error` 이벤트로, `10-graph-rag.md` 와 `data-flow/6-knowledge-base.md` 는 이 이벤트가 dead-declared/제거됐다고 명시하지만 `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md:182` 는 여전히 활성 이벤트로 나열하고 있다. 이 불일치는 구현자가 없는 이벤트를 구현해야 하는 것으로 오인할 수 있어 WARNING 수준이다. 나머지 식별자(WebAuthn 에러 코드·환경변수·요구사항 ID·에러 코드·API 경로)는 충돌 없음.

---

## 위험도

LOW
