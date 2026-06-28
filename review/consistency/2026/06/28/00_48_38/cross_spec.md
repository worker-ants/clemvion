# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=37230c91f)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
참조 spec: `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/6-config.md`, `spec/5-system/16-system-status-api.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`

---

## 발견사항

### [WARNING] 멤버 관리 Delete 권한 — auth spec vs user-profile spec 불일치

- **target 위치**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스 + §6.1 API 표
- **상세**:
  - auth spec §3.2: `멤버 관리 | CRUD | CRU | R | R` — Admin 은 Create·Read·Update 만 허용, **Delete 없음**.
  - user-profile spec §4.2: `멤버 관리 | ✅ | ✅ | ❌ | ❌` — Admin 에 ✅ 부여 (CRUD 전체 암묵 허용).
  - user-profile spec §6.1 API: `DELETE /api/workspaces/:id/members/:memberId | 멤버 제거 (Admin+)` — Admin 포함 삭제 허용.
  - auth spec §3.1 역할 설명 `Admin | 관리자. 멤버 관리 + 설정 변경 + 모든 리소스 CRUD` 와도 부분 모순: 역할 요약은 "멤버 관리" 를 무조건 부여하나 §3.2 매트릭스에서 D 를 뺀다.
  - RBAC 의 단일 진실은 auth spec §3.2 다. user-profile spec API 가 "Admin+" 로 정의한 DELETE 엔드포인트는 Owner 전용이어야 하거나, auth spec §3.2 의 "CRU" 를 "CRUD" 로 정정해야 한다.
- **제안**: 두 spec 중 하나를 정합화해야 한다. Admin 이 멤버 삭제 가능 여부를 의도적으로 결정한 뒤, auth spec §3.2 와 §3.1 설명, user-profile spec §4.2 행렬 및 §6.1 DELETE 엔드포인트 가드 설명을 동시에 갱신한다.

---

### [WARNING] Entity.type 필드 타입 표기 불일치 (String vs Enum)

- **target 위치**: `spec/5-system/10-graph-rag.md §2.3 Entity` 데이터 모델 표 (`type | String | entity 타입. P0 enum: ...`)
- **충돌 대상**: `spec/1-data-model.md §2.12.2 Entity` 표 (`type | Enum | person / organization / concept / location / event / other`)
- **상세**:
  - graph-rag spec 은 `type` 을 **String** 으로 표기하고 "P0 enum:" 으로 허용 값을 주석 기술한다.
  - data-model spec 은 동일 필드를 **Enum** 으로 표기한다.
  - 실제 DB 마이그레이션 `V025__graph_rag.sql` 은 `type TEXT NOT NULL` + `chk_entity_type CHECK (type IN (...))` 로 정의돼 있어, **graph-rag spec 의 "String" 표기가 구현 사실과 일치**한다.
  - data-model spec 의 "Enum" 표기는 PostgreSQL 네이티브 enum 타입이 아닌 TEXT+CHECK 구현과 불일치하며, ORM 엔티티·DTO 타입 정의에 오해를 줄 수 있다.
- **제안**: `spec/1-data-model.md §2.12.2` 의 `type | Enum` 을 `type | String` 으로 수정하고 "CHECK constraint: `person / organization / concept / location / event / other`" 등으로 명시한다. 혹은 data-model spec 의 타입 표기 컨벤션이 "DB 구현 enum 이 아닌 허용 값 집합 Enum" 임을 명확히 정의할 경우 그에 맞춰 graph-rag spec 쪽 설명을 통일한다.

---

### [INFO] Auth spec §2.1 JWT 토큰 표 — rememberMe 30일 variant 미기술

- **target 위치**: `spec/5-system/1-auth.md §2.1 JWT 토큰 구조` 표 (`Refresh Token | … | 7일 | …`)
- **충돌 대상**: `spec/1-data-model.md §2.18.1 RefreshToken` (`expires_at | Timestamp | 만료 시각 (7일 기본, rememberMe 시 30일)`)
- **상세**:
  - data-model spec 은 RefreshToken 의 만료를 "7일 기본, rememberMe 시 30일" 로 명시한다.
  - auth spec §2.1 JWT 토큰 구조 표는 Refresh Token 유효기간을 "7일" 로만 표기하며 rememberMe=30일 옵션을 누락한다.
  - auth spec Rationale §2.3.C 에서 "직전 세션의 remember-me(30일) 여부를 승계할 수 없다" 라는 언급이 있어 기능은 인지되나, 기본 spec 표에서는 빠져 있어 "rememberMe" 파라미터 존재 자체가 auth spec §2.1 만 보면 불명확하다.
- **제안**: `spec/5-system/1-auth.md §2.1` Refresh Token 행의 유효기간 셀을 "7일 (기본) / 30일 (rememberMe=true)" 로 갱신해 data-model spec 과 동기화한다.

---

### [INFO] Graph-RAG spec KB-GR-EX-11 — `document:` prefix 누락 표기

- **target 위치**: `spec/5-system/10-graph-rag.md §3.2 요구사항 KB-GR-EX-11` (`WS 이벤트 (document:graph_retry·graph_failed) 로 실시간 반영`)
- **충돌 대상**: 동일 파일 §6 WebSocket 이벤트 표 (`document:graph_failed`)
- **상세**: KB-GR-EX-11 요구사항 셀에서 `graph_failed` 앞에 `document:` prefix 가 빠져 있다. §6 표는 `document:graph_failed` 로 올바르게 기재한다. 구현 사실 (`graph-extraction.service.ts` 의 emit 이름) 과도 `document:graph_failed` 가 일치한다고 기술됨. 오타 수준의 문서 노이즈이나 요구사항 셀이 공식 ref 로 인용될 경우 혼란이 생길 수 있다.
- **제안**: KB-GR-EX-11 요구사항 셀의 `graph_failed` 를 `document:graph_failed` 로 수정한다.

---

## 검증된 일관성 (충돌 없음)

- **auth spec §3.2 Model Config CRUD (Editor+)** — `spec/2-navigation/6-config.md §3` 의 Editor+ mutation 가드, 그리고 `POST :id/test` / `POST preview-models` 의 Editor+ action-POST 게이트 (Rationale R-7) 와 일치한다.
- **auth spec §3.2 System Status R (전 역할)** — `spec/5-system/16-system-status-api.md §2` 의 "admin role 가드 없음" 및 워크스페이스 스코핑 예외와 일치한다.
- **auth spec §3.2 Auth Config (Admin+ CRUD, Editor=R)** — `spec/2-navigation/6-config.md §A.4` API 표 (mutation Admin+, 조회 Viewer+) 및 `spec/1-data-model.md §2.17.2` 마스킹 정책과 일치한다.
- **auth spec §4.1 model_config.* 감사 액션 (미구현 Planned)** — `spec/conventions/audit-actions.md §2.2` 및 `spec/data-flow/1-audit.md §1.1` 의 "미구현" 상태 표기와 일치한다.
- **auth spec §1.5.1 초대 Rate Limit 10건/min** — `spec/data-flow/12-workspace.md §1.2` rate limit 선언과 일치한다.
- **graph-rag spec §6 WebSocket 채널 `kb:{documentId}`** — `spec/5-system/8-embedding-pipeline.md §8` 의 채널 명명 규약과 일치한다.
- **graph-rag spec §2.3 Entity, §2.4 Relation, §2.5 ChunkEntity** — `spec/1-data-model.md §2.12.2–2.12.4` 의 필드 정의 및 제약조건과 type 표기 제외하면 일치한다.
- **graph-rag spec §2.1 KnowledgeBase 추가 컬럼** — `spec/1-data-model.md §2.11` 의 rag_mode, extraction_llm_config_id, max_hops, vector_seed_top_k, expanded_chunk_limit, entity_count, relation_count, reextract_status 모두 일치한다.
- **auth spec §2.3 이메일 변경 세션 처리** — `spec/2-navigation/9-user-profile.md §6.1` 의 email-change/verify 엔드포인트 동작 설명과 일치한다.
- **auth spec §1.1.B 이메일 변경 흐름** — `spec/2-navigation/9-user-profile.md §6.1` 의 /email-change/* 4개 엔드포인트 정의와 일치한다.

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 의 주요 정의들은 대부분 다른 영역 spec 과 정합하다. 단, 두 가지 WARNING 이 발견됐다. 첫째, **멤버 관리 Delete 권한**에서 auth spec §3.2 (Admin = CRU) 와 user-profile spec §4.2/§6.1 API (Admin+ = 삭제 허용) 사이에 명시적 충돌이 있어, 어느 쪽이 의도인지 확정 후 양쪽을 함께 갱신해야 한다. 둘째, **Entity.type 타입 표기** 에서 graph-rag spec (String) 과 data-model spec (Enum) 이 불일치하며, 실제 마이그레이션은 TEXT+CHECK 방식을 사용해 graph-rag spec 쪽이 구현과 일치하므로 data-model spec 을 수정해야 한다. 나머지 INFO 항목은 문서 보완 수준이며 구현 차단이 아니다.

---

## 위험도

**MEDIUM**

(WARNING 2건: 멤버 관리 RBAC 불일치 — 구현 시 어느 spec 을 따를지 혼란 유발 가능; Entity.type 타입 불일치 — ORM 엔티티/마이그레이션 작성 시 오해 가능)
