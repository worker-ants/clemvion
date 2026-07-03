# Cross-Spec 일관성 검토 결과

- 검토 모드: --impl-prep
- Target: `spec/5-system/` (본 배치에서 실제 분석 대상 파일: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)
- 비교 대상: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/15-system-status.md`, `spec/5-system/16-system-status-api.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/data-flow/6-knowledge-base.md`, `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, 코드베이스(`integrations.controller.ts` 등)

## 발견사항

### [WARNING] `document:graph_error` WebSocket 이벤트 emit 여부 — 이웃 spec(8-embedding-pipeline.md)과 불일치

- **target 위치**: `spec/5-system/10-graph-rag.md` §6 (WebSocket 이벤트 표) — "`document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 `graph-extraction.service.ts` 에서 실제로 emit 하지 않는다 (dead-declared)."
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md` §8.2 — "`rag_mode = 'graph'` KB 의 문서에 대해 동일 채널로 **6개 이벤트가 추가 emit 된다** — `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`."
- **상세**: `8-embedding-pipeline.md` 는 graph 이벤트가 6개(`_error` 포함) 모두 실제로 emit 된다고 서술하지만, target(`10-graph-rag.md`)은 `_error` 가 타입 union 에만 존재하고 실제 emit 경로가 없는 "dead-declared" 라고 명시한다. 제3의 문서인 `spec/data-flow/6-knowledge-base.md` §2.5 는 이 문제를 더 강하게 확정한다 — "`KbEventType` union 총 11개(embedding 6 + graph 5)" 이며 "`document:graph_error` 는 emit 경로가 없어 union 에서 **제거됨** (#443)" 이라고 명시(과거 서술 정정 이력에도 동일 결정 기록). 즉 target·data-flow 두 문서는 5-이벤트·union-제거로 최신 사실이 정합하지만, `8-embedding-pipeline.md` 만 "6개 이벤트 emit" 이라는 stale 서술을 유지하고 있어 **동일 `spec/5-system/` 영역 내 인접 문서 간 사실 불일치**다. 신규로 이 spec 을 읽는 개발자가 `8-embedding-pipeline.md` 만 참조하면 `document:graph_error` 를 실제 신호로 오인해 미구현 emit 을 구현 대상으로 착각하거나, 프론트엔드가 해당 이벤트를 구독하도록 잘못 안내될 수 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §8.2` 를 "5개 이벤트(`_error` 는 union 에 선언되어 있으나 emit 경로 없음 — dead-declared, 상세는 `10-graph-rag.md §6` 및 `data-flow/6-knowledge-base.md §2.5` 참조)" 형태로 정정 권고. `project-planner` 가 `10-graph-rag.md`/`data-flow` 갱신과 함께 `8-embedding-pipeline.md §8.2` 도 동기화 대상에 포함시킬 것.

### [INFO] Auth Config Reveal 권한 분리 — 인접 문서(설정 spec)와의 관계 명시 재확인 (실질 충돌 아님)

- **target 위치**: `spec/5-system/1-auth.md` §3.2 하단 주석("Auth Config Reveal 권한 분리 근거") 및 Overview 포인터("AuthConfig 엔드포인트 SoT 는 설정 spec §A.4")
- **충돌 대상**: `spec/2-navigation/6-config.md` §A.4 (확인 대상 외부 — 본 검토 범위 payload 에는 미포함)
- **상세**: target 자체가 "중복 정의 금지" 원칙을 명시하고 SoT 를 `2-navigation/6-config.md §A.4` 로 포인터링하고 있어 설계상 의도된 분리다. 실제 충돌 여부는 `6-config.md` 원문 대조가 필요하나, 본 payload 범위에서는 대조 대상 원문이 제공되지 않아 직접 검증하지 못했다. 신규 지식이나 모순은 발견되지 않았고, target 문서 내부에서 일관되게 "권한·감사만 다룬다"는 경계를 지키고 있어 등급은 INFO 로 낮춘다.
- **제안**: 조치 불요. 향후 `6-config.md §A.4` 갱신 시 본 문서의 RBAC 서술(§3.2, "Auth Config Reveal → Admin+ 로 제한")과의 동기화만 관행적으로 확인.

### [NONE] RBAC 매트릭스 (Integration Org/Workflow) — user-profile.md·integration.md 와 정합

- **위치**: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스
- **비교 대상**: `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스, `spec/2-navigation/4-integration.md` §8 권한 규칙, 코드 `integrations.controller.ts` (`@Roles('editor')` route floor)
- **상세**: 최초 검토 시 auth.md §3.2 의 "Integration (Org) | CRUD | CRUD | R | R" 행이 Editor 에 CRUD 를 부여하는 것처럼 보여 user-profile.md §4.2("Integration 생성(Org): Editor=❌")·integration.md §8("생성: Admin 이상")과 충돌 가능성을 의심했으나, 재확인 결과 auth.md 자체가 Editor 컬럼에 `R` (읽기 전용)을 명시하고 있어 실제로는 세 문서 모두 "Editor 는 Org-scope Integration 생성 불가, 라우트 가드는 `editor` floor + 서비스 레이어에서 Admin+ 세부 검증"이라는 동일한 설계를 공유한다. `0-overview.md` §6.1 이 이 이중 계층(route floor vs 세부 RBAC)을 "상보 관계, 모순 아님"으로 이미 명시적으로 조정해두었다. Workflow CRUD/실행 행도 user-profile.md 와 일치.
- **결론**: 충돌 없음. 오탐 방지를 위해 기록만 남김.

### [NONE] WebAuthnCredential 데이터 모델·counter 역행 정책 — 데이터 모델 §2.21 과 완전 정합

- **위치**: `spec/5-system/1-auth.md` §1.4.1, §1.4.4, Rationale 1.4.E
- **비교 대상**: `spec/1-data-model.md` §2.21 WebAuthnCredential
- **상세**: counter 역행 시 "suspend 컬럼 대신 즉시 삭제" 정책, 복구 코드 SHA-256 해시 별도 컬럼(`totp_recovery_codes`/`webauthn_recovery_codes`) 분리, challenge stateless JWT(별도 테이블 없음) 설계가 데이터 모델 문서와 필드 단위로 정확히 일치한다.
- **결론**: 충돌 없음.

### [NONE] 초대 토큰 에러 코드 lower_snake_case 예외 — error-codes.md 레지스트리와 정합

- **위치**: `spec/5-system/1-auth.md` §1.5.4 각주(historical-artifact 예외)
- **비교 대상**: `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리
- **상세**: `invitation_not_found`/`invitation_expired`/`invitation_already_used`/`invitation_email_mismatch`/`forbidden`/`rate_limited` 의 lowercase 예외가 error-codes.md §3 레지스트리에 "초대 API 한정"으로 정확히 등재되어 있고, target 각주와 문구·근거가 일치한다.
- **결론**: 충돌 없음.

### [NONE] Graph RAG 데이터 모델(Entity/Relation/ChunkEntity, KnowledgeBase/Document 추가 컬럼) — data-model.md 와 완전 정합

- **위치**: `spec/5-system/10-graph-rag.md` §2 (데이터 모델), §3.1~3.4 (파이프라인), §4 (검색 흐름)
- **비교 대상**: `spec/1-data-model.md` §2.11(KnowledgeBase), §2.12(Document), §2.12.2(Entity), §2.12.3(Relation), §2.12.4(ChunkEntity — 확인 범위 밖이나 §2.12.2/.3 패턴과 일치)
- **상세**: `rag_mode`/`extraction_llm_config_id`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count` 컬럼, Entity/Relation UNIQUE 제약, 인덱스 정의가 필드명·타입·제약조건 수준까지 두 문서에서 동일하다. `graph_extraction_status` enum 값(pending/processing/completed/error/failed)도 Document 정의와 일치.
- **결론**: 충돌 없음.

### [NONE] Graph RAG 검색 흐름의 "rerank" 용어 disambiguation — RAG 검색 spec(9-rag-search.md)과의 경계 명확

- **위치**: `spec/5-system/10-graph-rag.md` §1 상단 disambiguation 노트, §3.4.KB-GR-SR-05
- **상세**: target 은 "centrality-weighted score blending" (graph 내부 1차 정렬)과 `9-rag-search.md §3.3` cross-encoder 후처리 reranking(2차, 선택적)을 명시적으로 구분하고 최종 주입 개수는 `9-rag-search.md §3.4` 의 동적 점수 컷이 결정한다고 포인터링한다. 계층 책임 분할이 명확하며 중복 정의가 없다.
- **결론**: 충돌 없음.

## 요약

Target 문서(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)는 자체적으로 SoT 경계·포인터링 원칙을 철저히 지키고 있으며, RBAC 매트릭스·데이터 모델·에러 코드·감사 액션 명명 등 이미 존재하는 cross-cutting 규약(`spec/1-data-model.md`, `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/4-integration.md`)과 필드·문구 단위로 정합했다. 유일하게 확인된 실질적 불일치는 Graph RAG WebSocket 이벤트 개수(`document:graph_error` emit 여부)에 대해 같은 `spec/5-system/` 영역 내 인접 문서(`8-embedding-pipeline.md`)가 stale 서술("6개 이벤트 emit")을 유지하고 있다는 점이다 — target 및 `spec/data-flow/6-knowledge-base.md` 는 이미 최신 사실(`_error` 는 union 에서 제거/미emit)로 정정되어 있으므로, 이번 target 자체의 결함이 아니라 이웃 문서 쪽의 동기화 누락이다. 구현 착수를 막을 CRITICAL 은 없다.

## 위험도

LOW
