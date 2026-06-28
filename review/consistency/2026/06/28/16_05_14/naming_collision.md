# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` (`1-auth.md`, `10-graph-rag.md` 등), diff-base `origin/main`, 검토 모드 `impl-done`

---

## 발견사항

### **[WARNING]** `document:graph_error` 이벤트명 — spec 간 상충

- **target 신규 식별자**: `document:graph_error` (10-graph-rag.md §6 이벤트 표 하단 주석에서 "dead-declared, 미emit" 명시)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/2-navigation/5-knowledge-base.md:182` — `document:graph_started / _progress / _completed / _error / _retry / _failed` 로 나열하며 `_error` 를 유효 이벤트로 열거
  - `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/6-websocket-protocol.md:739` — "임베딩 이벤트와 1:1 대응" 으로 `_error` 를 포함한 6개 이벤트 목록을 기재
- **상세**: `10-graph-rag.md §6` 주석은 `document:graph_error` 가 `websocket.service.ts` 의 `KbEventType` union 에 dead-declared 되어 있으나 실제로 emit 하지 않는다고 명시한다. 그러나 `5-knowledge-base.md` 와 `6-websocket-protocol.md` 는 이 이벤트를 여전히 유효한 이벤트 목록에 열거한다. 독자가 두 spec 을 동시에 참고하면 이벤트 존재 여부가 불일치하여 혼동된다. `plan/in-progress/spec-sync-structural-followups.md:224-226` 에서도 동일 문제가 이미 추적 중(`(3) document:graph_error 를 union 에서 제거하거나 실제로 emit 하도록 구현`)이나 spec 문서들은 아직 정합화되지 않았다.
- **제안**: `spec/2-navigation/5-knowledge-base.md:182` 와 `spec/5-system/6-websocket-protocol.md:739` 에서 `_error` 를 목록에서 제거하거나 `(dead-declared, 미emit)` 주석을 추가하여 `10-graph-rag.md §6` 의 기술과 일치시킨다. 또는 `graph-extraction.service.ts` 에서 `document:graph_error` 를 실제로 emit 하도록 구현해 모든 spec 을 현실에 맞게 통일한다.

---

### **[INFO]** `GraphTraversalSummary` vs `GraphTraversalService` — 동일 "graph traversal" 네임스페이스의 이중 의미

- **target 신규 식별자**: `GraphTraversalSummary` (10-graph-rag.md §3.4 KB-GR-SR-06 — KB RAG 그래프 순회 요약 타입)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/graph/graph-traversal.service.ts:18` — `GraphTraversalService`: 워크플로 노드 실행 그래프 reachability/propagation 전용 클래스
  - `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts:23` — `ExecutionGraphState` JSDoc 주석에서 "**`GraphTraversalSummary` (knowledge-base RAG) 와 의미 분리**" 를 명시하며 이미 잠재적 혼동을 인지
- **상세**: `GraphTraversalService`(execution-engine 워크플로 노드 그래프 순회)와 `GraphTraversalSummary`(knowledge-base RAG 그래프 순회 메타 타입)는 "graph traversal" 이라는 동일한 어휘 영역을 공유한다. 둘은 다른 모듈에 위치하고 코드 계층적 충돌은 없으나, spec 문서(`10-graph-rag.md`)에서 `GraphTraversalSummary` 를 언급할 때 `GraphTraversalService` 와의 의미 분리를 명시하지 않아 독자가 동일 개념으로 오독할 수 있다. 코드 주석은 이미 분리를 기술했으나 spec 은 없다.
- **제안**: `10-graph-rag.md §3.4` 또는 `§4.3` 의 `GraphTraversalSummary` 언급 시, "execution-engine 의 `GraphTraversalService`(워크플로 노드 그래프)와 무관한 KB RAG 전용 출력 타입" 이라는 1줄 disambiguation 주석을 추가한다. 충돌 심각도는 낮으며 코드 동작에는 영향 없다.

---

### **[INFO]** 요구사항 ID `KB-GR-*` — 교차 spec 참조 일관성

- **target 신규 식별자**: `KB-GR-MD-*`, `KB-GR-EX-*`, `KB-GR-DM-*`, `KB-GR-SR-*`, `KB-GR-PA-*`, `KB-GR-UI-*`, `KB-GR-OB-*` (10-graph-rag.md §3)
- **기존 사용처**: `spec/2-navigation/5-knowledge-base.md`, `spec/0-overview.md` 가 동일 기능을 설명하나 이 요구사항 ID 를 참조하지 않는다
- **상세**: ID 자체의 충돌은 없다. 단, `spec/2-navigation/5-knowledge-base.md` 가 동일 기능(재추출 API, entity/relation 목록, 그래프 통계 등)을 기술하면서 `KB-GR-*` ID 를 역참조하지 않아 두 문서의 추적성이 단절된다. 기능 요구사항 충돌 가능성보다는 문서 간 추적 누락의 INFO 수준이다.
- **제안**: 조치 불요 (INFO 수준). 추후 `5-knowledge-base.md` 정비 시 해당 기능 설명에 `(KB-GR-EX-05)`, `(KB-GR-UI-04)` 등 역참조를 추가하면 추적성이 향상된다.

---

## 충돌 없음 확인 항목

다음 신규 식별자는 기존 사용처와 충돌하지 않음을 확인하였다:

- **환경변수**: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_ALLOW_FALLBACK`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP` — 모두 `spec/5-system/1-auth.md` 와 `codebase/backend/.env.example`/`webauthn.config.ts` 에서 동일 의미로 일치 사용
- **에러 코드 (UPPER_SNAKE_CASE)**: `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `REAUTH_NOT_AVAILABLE`, `WEBAUTHN_COUNTER_REGRESSION` — 기존 코드와 spec 간 의미 일치
- **에러 코드 (lower_snake_case, historical-artifact)**: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch` — spec §1.5.4 에서 historical-artifact 예외로 명시되고 `error-codes.md §3` 레지스트리에 등재됨; 다른 도메인에서 동일 코드 재사용 없음
- **API 엔드포인트**: `/api/auth/2fa/webauthn/*`, `/api/knowledge-bases/:id/entities`, `/api/knowledge-bases/:id/relations`, `/api/knowledge-bases/:id/graph/*`, `/api/knowledge-bases/:id/re-extract`, `/api/knowledge-bases/:id/retry-failed` — 기존 spec 및 코드에서 동일 경로로 일관 정의; 중복 정의 없음
- **WebSocket 이벤트 (정상 emit 되는 것들)**: `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_retry`, `document:graph_failed` — `spec/5-system/6-websocket-protocol.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/8-embedding-pipeline.md` 에서 일관 기재
- **DB 필드명**: `emailChangeToken`, `pendingEmail`, `email_change_token`, `pending_email`, `email_change_expires_at` — V100 마이그레이션과 spec §1.1.B 간 일치; 타 도메인 중복 없음
- **LoginHistory 이벤트**: `login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected` — spec 과 코드 간 일치
- **파일 경로**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` — 기존 명명 컨벤션(`N-name.md`) 준수; 기존 파일과 중복 없음
- **그래프 엔티티 타입명**: `Entity`, `Relation`, `ChunkEntity` (DB 테이블) — `spec/1-data-model.md` §2.23~2.25 에서 동일 정의; 타 도메인 중복 없음

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 가 도입하는 신규 식별자 대부분은 기존 코드·spec 과 충돌 없이 일관되게 사용된다. 주요 발견은 `document:graph_error` 이벤트명의 spec 간 상충 (WARNING)으로, `10-graph-rag.md §6` 은 dead-declared 임을 명시하나 `5-knowledge-base.md` 와 `6-websocket-protocol.md` 는 유효 이벤트로 계속 열거해 독자 혼동을 유발할 수 있다. `GraphTraversalSummary` 와 `GraphTraversalService` 의 네임스페이스 공유는 코드 동작에는 무해하나 spec 내 disambiguation 주석 부재가 INFO 수준 위험이다. CRITICAL 충돌은 없다.

---

## 위험도

**LOW**
