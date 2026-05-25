# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/5-system/` (구현 착수 전 --impl-prep)
**검토 문서**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, 동반 corpus (`spec/0-overview.md`, `spec/1-data-model.md`)

---

## 발견사항

### [WARNING] `INVALID_EXECUTION_STATE` vs `INVALID_STATE` 동일 의미 상이한 이름 — 이미 명시됨

- **target 신규 식별자**: `INVALID_EXECUTION_STATE` (WS ack 에러 코드, `spec/5-system/4-execution-engine.md §7.5.1`)
- **기존 사용처**: `spec/5-system/3-error-handling.md:42` — `INVALID_STATE` (REST 422 에러 코드, "상태 전이 불가")
- **상세**: 두 코드는 동일한 의미(실행이 기대 상태가 아님)를 WS와 REST layer에서 다른 이름으로 표현한다. 의도적 분리임은 `spec/5-system/4-execution-engine.md §7.5.1 Rationale` 과 `spec/5-system/3-error-handling.md:44` 의 cross-link 주석에 명시되어 있어 충돌보다는 혼동 가능성이다.
- **평가**: 이미 spec 본문에서 cross-link 와 근거로 의도를 명시했으므로 현재 상태가 충분히 관리됨. 충돌 아님.
- **제안**: 해당 없음 (기각된 통일 대안 및 분리 근거가 §7.5.1 Rationale 에 이미 기술됨).

---

### [INFO] `webauthn_failed` LoginHistory 이벤트 — 기존 `totp_failed` 와 일관된 패턴 확인

- **target 신규 식별자**: `webauthn_failed` (LoginHistory.event enum 값, `spec/5-system/1-auth.md §4.3`)
- **기존 사용처**: `spec/1-data-model.md §2.18.2` — `login_history` 테이블의 `event` Enum. 기존 값: `login_success`, `login_failed`, `totp_failed`, `logout`, `session_revoked`, `token_reuse_detected`
- **상세**: `webauthn_failed` 는 `totp_failed` 와 동일한 네이밍 패턴(`{method}_failed`)으로 추가되며 기존 값과 의미 충돌 없음. `spec/1-data-model.md §2.18.2` 에 이미 등재되어 있고, V058 마이그레이션(CHECK 제약 `chk_login_history_event`)에 포함됨이 `spec/5-system/1-auth.md §Rationale 1.4.G` 에 기술됨.
- **평가**: 충돌 없음. 패턴 일관성 유지.
- **제안**: 해당 없음.

---

### [INFO] WebAuthn 에러 코드 신규 도입 — 기존 에러 카탈로그와 분리됨

- **target 신규 식별자**: `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`, `RECOVERY_CODE_INVALID` (`spec/5-system/1-auth.md §5`)
- **기존 사용처**: `spec/5-system/3-error-handling.md` — 공용 에러 카탈로그. WebAuthn 관련 코드는 해당 파일에 등재되지 않음.
- **상세**: 이 에러 코드들은 `/api/auth/2fa/webauthn/**` 엔드포인트 전용이며 `spec/5-system/1-auth.md §5` API 표에만 정의. `spec/5-system/3-error-handling.md` 의 공용 카탈로그에는 미등재. 공용 카탈로그와 이름 충돌은 없음. 다만 `WEBAUTHN_VERIFY_FAILED` 가 일반 `VALIDATION_ERROR`(spec/5-system/3-error-handling.md:41)와 의미 중복 여부 검토가 필요.
- **평가**: 충돌 없음. 에러 코드 이름이 도메인 prefix(`WEBAUTHN_`)로 격리되어 있어 기존 코드와 혼동 없음. 공용 카탈로그 미등재는 별도 이슈(정보 분산)지만 충돌은 아님.
- **제안**: INFO 수준. 추후 WebAuthn 에러 코드를 `spec/5-system/3-error-handling.md` 에 도메인별 섹션으로 등재하면 검색성이 향상됨.

---

### [INFO] `execution-continuation` BullMQ 큐 이름 — 기존 `execution:continuation` Redis pub/sub 채널과의 폐기 관계

- **target 신규 식별자**: BullMQ 큐 `execution-continuation` (`spec/5-system/4-execution-engine.md §7.4`, §9.3)
- **기존 사용처**: 옛 Redis pub/sub 채널 `execution:continuation` (폐기됨) — `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation (2026-05-24)"`, `spec/4-nodes/6-presentation/0-common.md §10.9`에 폐기 기록
- **상세**: 이름이 유사하지만 (하이픈 vs 콜론) spec 전체에서 Redis 채널은 이미 폐기 처리되고 BullMQ 큐로 교체됨이 명확히 기술됨. 혼동 가능성이 낮음. `spec/0-overview.md §2.6` 에서도 BullMQ 큐 기준으로 정정됨.
- **평가**: 충돌 없음. 폐기된 식별자가 잔여 문서에 명시적으로 "폐기" 표시됨.
- **제안**: 해당 없음.

---

### [INFO] `RESUME_BULLMQ_ATTEMPTS` 환경변수/상수 — 기존 상수명 패턴 확인

- **target 신규 식별자**: `RESUME_BULLMQ_ATTEMPTS` (상수명, `spec/5-system/4-execution-engine.md §7.4`, §9.4)
- **기존 사용처**: `spec/5-system/4-execution-engine.md §9.4` 환경변수 표에 등재됨. 기존 패턴 상수는 `background-execution` 큐의 `attempts`와 동일한 관리 방식.
- **상세**: 이름이 유일하며 기존 식별자와 충돌 없음. BullMQ 재시도 횟수를 의미하는 명확한 네이밍.
- **평가**: 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] `SIGTERM_GRACE_MS` 환경변수 — 기존 ENV 패턴과의 일관성

- **target 신규 식별자**: `SIGTERM_GRACE_MS` 환경변수 (`spec/5-system/4-execution-engine.md §11`, §9.4)
- **기존 사용처**: 기존 ENV var 카탈로그에 없음. 프로젝트의 다른 ENV 변수들은 `FRONTEND_URL`, `WEBAUTHN_RP_ID`, `MCP_MAX_CONCURRENT_CONNECTIONS` 등 UPPER_SNAKE_CASE.
- **상세**: 이름 충돌 없음. SIGTERM은 Unix 신호 이름이므로 `SIGTERM_GRACE_MS` 네이밍이 의미를 잘 전달함. 기존 `WEBAUTHN_ALLOW_FALLBACK` 과 같이 단순 기능 이름(`ALLOW_FALLBACK`)보다 신호명(`SIGTERM`)을 사용한 점이 특이하나 충돌은 아님.
- **평가**: 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] `MCP_ALLOW_INSECURE_URL` 환경변수 — `WEBAUTHN_ALLOW_FALLBACK` 과 패턴 일관성

- **target 신규 식별자**: `MCP_ALLOW_INSECURE_URL` 환경변수 (`spec/5-system/11-mcp-client.md §3.2`)
- **기존 사용처**: `WEBAUTHN_ALLOW_FALLBACK` — 유사한 "개발/로컬 환경 escape hatch" 목적
- **상세**: 두 변수 모두 escape hatch 성격이지만 `WEBAUTHN_ALLOW_FALLBACK`은 값이 `1`/`0`이고, `MCP_ALLOW_INSECURE_URL`은 `true`/`false`를 암시. 이름 충돌 없음. 값 형식의 비일관성이 있으나 기능 충돌 아님.
- **평가**: 충돌 없음. INFO 수준 일관성 제안.
- **제안**: `MCP_ALLOW_INSECURE_URL=1` vs `=true` 값 형식을 `WEBAUTHN_ALLOW_FALLBACK=1` 패턴으로 통일하면 env 파일 관리 일관성 향상.

---

### [INFO] `WebAuthnModule` / `WebAuthnController` 신규 NestJS 모듈 — 기존 Auth 모듈 구조 내 위치

- **target 신규 식별자**: `WebAuthnModule`, `WebAuthnController`, `WebAuthnService` (NestJS 모듈, `spec/5-system/1-auth.md §Rationale 1.4.H`)
- **기존 사용처**: `AuthModule` — 기존 인증 모듈
- **상세**: `WebAuthnModule`은 `AuthModule`의 하위 모듈로 명시됨(`AuthModule → WebAuthnModule` 단방향 의존). 이름 충돌 없음. `WebAuthnService`는 spec 전체에서 단일 의미로 일관되게 사용됨.
- **평가**: 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] `StuckDocumentRecoveryService` — 임베딩·그래프 양쪽 회수를 단일 서비스에서 처리

- **target 신규 식별자**: `StuckDocumentRecoveryService` (서비스명, `spec/5-system/10-graph-rag.md §3.2` KB-GR-EX-10)
- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md §4` — `StuckDocumentRecoveryService` (동일 이름, 임베딩 stuck 회수 담당)
- **상세**: 같은 서비스 이름이 임베딩 파이프라인 spec과 Graph RAG spec 양쪽에 등장. `spec/5-system/8-embedding-pipeline.md §4`에서 이미 정의된 서비스가 Graph RAG 기능(그래프 추출 stuck 회수)을 추가로 담당하는 것으로 해석됨. 두 spec 간 동일 이름이 동일 서비스를 가리키는지, 별도 서비스인지 명시적 cross-link가 없음.
- **평가**: 잠재적 혼동 가능성. 동일 서비스가 두 역할을 겸하는지(확장) vs 별도 인스턴스인지(충돌) spec에서 명시적으로 서술되지 않음.
- **제안**: `spec/5-system/10-graph-rag.md §3.2` KB-GR-EX-10의 `StuckDocumentRecoveryService` 언급에 `spec/5-system/8-embedding-pipeline.md §4`로 cross-link를 추가하거나, "기존 `StuckDocumentRecoveryService` 에 그래프 회수 로직 추가" 임을 명시하면 혼동 없음.

---

### [INFO] `GraphTraversalSummary` 타입명 — 기존 타입 네임스페이스와 충돌 없음

- **target 신규 식별자**: `GraphTraversalSummary` (응답 DTO 타입, `spec/5-system/10-graph-rag.md §3.4` KB-GR-SR-06)
- **기존 사용처**: `spec/` 전체에서 `GraphTraversalSummary` 와 동일하거나 유사한 타입명 미발견
- **상세**: `spec/data-flow/6-knowledge-base.md §1.3` 에 `seedChunkIds` 필드가 등장하나 타입명은 미사용. 충돌 없음.
- **평가**: 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] `login_history_pruner_service` 서비스 참조명 — 임베딩 pruner 패턴과 일관성

- **target 신규 식별자**: `login_history_pruner_service` (서비스 참조명, `spec/5-system/1-auth.md §Rationale 1.4.G`)
- **기존 사용처**: 없음. 유사 패턴으로 cron 서비스명이 `snake_case`로 언급되는 방식은 `StuckDocumentRecoveryService`(PascalCase)와 혼재.
- **상세**: Rationale 본문에서 소문자 snake_case로 언급하는 방식이 코드 상 NestJS 서비스명(PascalCase)와 달라 혼동 가능. 충돌은 아님.
- **평가**: INFO 수준 일관성 이슈.
- **제안**: 코드 서비스명을 `LoginHistoryPrunerService`(PascalCase) 또는 cron 큐명으로 통일 표기 권장.

---

## 요약

`spec/5-system/` 의 신규 식별자(WebAuthn 에러 코드·환경변수·모듈명, Graph RAG 엔티티·DTO·API·이벤트명, MCP 에러코드·환경변수, Durable Continuation BullMQ 큐·에러코드) 전반에 걸쳐 기존 식별자와의 의미 충돌은 발견되지 않았다. `INVALID_EXECUTION_STATE`(WS) vs `INVALID_STATE`(REST) 동의 코드 분리는 이미 spec 본문에서 의도 설명과 cross-link가 완비된 상태다. `StuckDocumentRecoveryService`가 임베딩과 그래프 회수 양쪽 spec에 동일 이름으로 등장하는데 동일 인스턴스 확장인지 명확한 cross-link가 없어 INFO 수준의 보완이 권장된다. `MCP_ALLOW_INSECURE_URL`의 값 형식이 `WEBAUTHN_ALLOW_FALLBACK`의 `1`/`0` 패턴과 비일관하나 충돌은 아니다.

## 위험도

LOW
