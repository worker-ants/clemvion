# Cross-Spec 일관성 검토 결과

## 검토 범위

- target: `spec/5-system/` (본 payload 상 `1-auth.md` 전문 + `10-graph-rag.md` 전문 포함, --impl-done 모드)
- 대조군(payload 에 함께 첨부된 "관련 spec 본문"): `spec/0-overview.md`, `spec/1-data-model.md` (§2.1~§2.22, WebAuthnCredential·SecretStore 포함)
- 추가로 실제 워킹트리에서 직접 확인: `spec/conventions/audit-actions.md`, `spec/2-navigation/6-config.md` §A.4, `spec/2-navigation/9-user-profile.md` §4.2/§4.3, `spec/5-system/9-rag-search.md` §2.2/§4.1, `spec/5-system/12-webhook.md`

## 발견사항

없음 — CRITICAL/WARNING 등급 발견 없음.

### 확인한 정합성 지점 (참고용, 문제 없음)

- **데이터 모델**: `1-auth.md` §1.1/§1.1.B/§1.4/§1.4.1/§2.18.2 이 서술하는 User 필드(`password_hash`, `email_verify_token`, `pending_email`, `email_change_token`, `totp_recovery_codes`, `webauthn_recovery_codes`, `two_factor_enabled` 등), LoginHistory(`event` enum, `failure_reason`), RefreshToken(`family_id`) 은 `1-data-model.md` §2.1/§2.18.1/§2.18.2 와 필드명·의미 모두 일치. `10-graph-rag.md` §2 의 KnowledgeBase 추가 컬럼(`rag_mode`/`extraction_llm_config_id`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count`)·Document(`graph_extraction_status`)·Entity/Relation/ChunkEntity 는 `1-data-model.md` §2.11/§2.12/§2.12.2~§2.12.4 와 완전히 동형.
- **WebAuthnCredential**: `1-auth.md` §1.4.4·Rationale 1.4.E(counter 역행 시 즉시 삭제, suspend 컬럼 미도입)가 `1-data-model.md` §2.21 의 `counter` 필드 설명과 정확히 일치.
- **API 계약**: `1-auth.md` §5 엔드포인트 표가 AuthConfig CRUD(`/api/auth-configs/*`)·사용자 세션(`/api/users/me/*`)·초대(`/api/workspaces/:id/invitations`)를 각각 `2-navigation/6-config.md` §A.4, `2-navigation/9-user-profile.md` §6.1 로 포인터 위임하고 중복 정의하지 않음. `2-navigation/6-config.md` 의 엔드포인트 표(§A.4, 라인 261-268)와 RBAC(mutation=Admin+, 조회=Viewer+)가 `1-auth.md` §3.2 RBAC 매트릭스(Auth Config: Owner/Admin=CRUD, Editor/Viewer=R, Reveal=Admin+)와 정합.
- **Graph RAG 검색 출력 shape**: `10-graph-rag.md` §4.3 의 `ragSources[]` (`chunkId`/`documentId`/`documentName`/`content`/`score`/`origin: 'seed'|'expanded'`) 가 `9-rag-search.md` §4.1 의 vector 모드 `origin: 'cosine'|'reranked'` 와 동일 스키마를 공유하며 값만 모드별로 분기 — 필드 충돌 없음.
- **요구사항 ID**: `KB-GR-*` (MD/EX/DM/SR/PA/UI/OB) 네임스페이스는 auth 도메인 ID 와 겹치지 않으며, 데이터 모델·Rationale 어디에도 재사용 흔적 없음.
- **RBAC**: `1-auth.md` §3.2 매트릭스(System Status = 전 역할 R)가 `5-system/16-system-status-api.md` §4 "admin role 가드 없음" 서술과 일치. `2-navigation/9-user-profile.md` §4.2 매트릭스(워크플로우/멤버/설정 부분집합)도 값 충돌 없음.
- **감사 액션 명명**: `1-auth.md` §4.1/§4.1.A(`user.*` dot-prefix·과거분사, `workspace.transfer_ownership` 도메인 고유 동사 분류)가 `conventions/audit-actions.md` §2.1~§2.3 규약과 정확히 정합 — 동일 근거를 상호 포인터로 참조.
- **클라이언트 IP 신뢰 정책**: `1-auth.md` §2.3/Rationale 2.3.B (세션·감사 경로는 `extractClientIp` req.ip 폴백 포함, webhook/rate-limit/ip_whitelist 경로는 `extractClientIpFromHeaders` 헤더 전용·폴백 없음)이 `5-system/12-webhook.md` §6/§7 의 서술과 동일 문구·동일 근거로 일치.
- **초대 에러 코드 lower_snake_case 예외**: `1-auth.md` §1.5.4 가 `conventions/error-codes.md §3` historical-artifact 레지스트리를 명시적으로 참조하며 자기 스스로 규약 이탈을 예외로 등재 — 은닉된 충돌 아님.

## 요약

target(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)을 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점에서 대조군(0-overview.md, 1-data-model.md, 2-navigation/6-config.md, 2-navigation/9-user-profile.md, 5-system/9-rag-search.md, 5-system/12-webhook.md, conventions/audit-actions.md, conventions/error-codes.md)과 교차 검증한 결과, 명시적 모순이나 잠재 충돌을 발견하지 못했다. 두 문서 모두 다른 영역 spec 을 인용할 때 일관되게 SoT 포인터를 명시하고("본 문서는 권한·감사만 다룬다", "단일 SoT 는 …") 필드·enum·RBAC 값을 반복 정의 대신 참조로 위임하는 패턴을 철저히 지키고 있어, cross-spec 정합성 리스크가 구조적으로 낮게 유지되고 있다.

## 위험도

NONE
