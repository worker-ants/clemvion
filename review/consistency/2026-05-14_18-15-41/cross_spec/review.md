충분한 데이터를 수집했습니다. 분석을 시작합니다.

---

## 발견사항

### [WARNING] `spec/4-nodes/4-integration/4-cafe24.md §9.4` step 4 설명 미갱신 — cross-file 불일치 발생

- **target 위치**: Draft 2J-1 (§9.4 step 3 갱신), Draft 2J-2 (§9.8 식별 전략 갱신)
- **충돌 대상**: `spec/2-navigation/4-integration.md §3.2 step 4` (Draft 2C 에서 갱신 예정)
- **상세**: Draft 2C 에서 `spec/2-navigation/4-integration.md §3.2 step 4` 는 "path 의 `install_token` 으로 단일 `pending_install` Integration 을 조회하고, 그 row 의 `client_secret` 으로 HMAC 을 1회 검증한다"로 명확히 갱신된다. 반면 `spec/4-nodes/4-integration/4-cafe24.md §9.4`(Rationale — Public + Private 앱 동시 지원)의 step 4는 Draft 2J-1 이 step 3 만 갱신하고 step 4 는 그대로 두어, draft 적용 후 **동일한 흐름을 설명하는 두 spec 파일에서 step 4 내용이 불일치**가 생긴다.
  - `spec/2-navigation/4-integration.md §3.2 step 4` (draft 후): install_token 단일 조회 → client_secret HMAC 1회 검증
  - `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` (변경 없음): "HMAC 검증(§9.8) → OAuthState 생성" (mall_id 스캔 방식 암시)
- **제안**: Draft 2J-1 에 step 4 갱신 diff 를 추가하거나, Draft 2J-ter 의 §9.4 inline note 에 step 4 를 명시적으로 rewrite. `spec/2-navigation/4-integration.md §3.2 step 4` 와 동일한 문구로 정렬.

---

### [WARNING] `spec/data-flow/integration.md §1.2` OAuth 시퀀스 — 구 API 경로 잔존

- **target 위치**: Draft 3C (§1.2.1 sub-diagram 신설, forward-ref 추가)
- **충돌 대상**: `spec/data-flow/integration.md §1.2` 현재 다이어그램 + `spec/2-navigation/4-integration.md §9.2`
- **상세**: 현재 `spec/data-flow/integration.md §1.2` 시퀀스 다이어그램은 `GET /api/integrations/oauth/:service/start` 경로를 participant `Svc` 의 첫 호출로 표기하는데, `spec/2-navigation/4-integration.md §9.2` 의 실제 정의는 `POST /api/integrations/oauth/begin` 이다. Draft 3C 는 §1.2.1 Cafe24 Private sub-diagram 을 추가하고 "부모 다이어그램의 `GET /oauth/:service/start` 는 일반 OAuth 의 표현" 이라는 forward-ref 를 달지만, **기존 §1.2 다이어그램의 잘못된 경로 자체는 수정하지 않는다**. draft 적용 후에도 data-flow §1.2 ↔ integration spec §9.2 간의 API 경로 불일치가 잔존한다.
- **제안**: Draft 3C 범위를 확장하여 기존 §1.2 다이어그램의 `GET /api/integrations/oauth/:service/start` 를 `POST /api/integrations/oauth/begin` 으로 수정하거나, forward-ref 에 "기존 §1.2 다이어그램의 경로 표기는 구 버전으로 §9.2 의 `POST /oauth/begin` 이 정확한 경로" 임을 명시.

---

### [INFO] V042 마이그레이션이 이미 `install_token` + `pending_install` status를 DB에 반영함

- **target 위치**: Draft 1A (status enum), Draft 1B (install_token 컬럼)
- **충돌 대상**: `backend/migrations/V042__cafe24_private_app_pending_install.sql` (이미 적용됨)
- **상세**: `V042` 파일이 이미 `ALTER TABLE integration ADD COLUMN install_token VARCHAR(64) NULL` 과 `CHECK (status IN ('connected', 'expired', 'error', 'pending_install'))` 제약을 적용함. Draft 1A/1B 는 이를 spec 에 뒤늦게 반영하는 것으로, spec-code 간 기존 격차를 해소하는 정당한 작업이다. `spec/1-data-model.md §2.10` 의 status enum과 Install_token 컬럼 기술이 구현보다 뒤처져 있었음을 확인.
- **제안**: 해소 방향 적절함. 단, Draft 1B 에서 컬럼 타입을 `String?` 으로만 기술하는데, V042 에서 `VARCHAR(64)` 로 정의되어 있으므로 spec 에도 길이 힌트 (`VARCHAR(64)` 또는 "32바이트 hex = 64자") 를 추가하면 data-model 명세와 실제 DDL 의 일관성이 높아짐.

---

### [INFO] `spec/data-flow/integration.md §2.1` — `integration_oauth_state` 스키마 기존 누락 항목 보완

- **target 위치**: Draft 3D (integration_oauth_state 행 갱신)
- **충돌 대상**: `spec/2-navigation/4-integration.md §10.2 step 4` (reauthorize 분기에서 `integrationId` 컨텍스트 전제)
- **상세**: 현재 `data-flow §2.1` 의 `integration_oauth_state` INSERT 컬럼 목록(`state, service_type, workspace_id, user_id, expires_at`)은 §10.2 step 4 의 reauthorize 분기가 전제하는 `integration_id` 컬럼을 포함하지 않는다. Draft 3D 에서 `integration_id`, `mode`, `requested_scopes`, `provider_meta` 를 추가하는 것은 이미 구현된 V041/V009 의 컬럼들을 spec 에 기재하는 보완 작업이다. 충돌이 아닌 기존 누락 해소.
- **제안**: 적절. Draft 3D 에서 `integration_id FK → integration ON DELETE CASCADE (V009)` 라고 밝히는 것처럼 각 컬럼의 마이그레이션 버전을 함께 명시하면 추적성이 높아짐.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md §6` "카테고리" vs "Resource" 용어 — 해소 방향 정합

- **target 위치**: Draft 2H (§14.2 Resource → 카테고리 교정), Draft 2H-inline (cafe24-api-metadata.md §6 보강)
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md §6` (이미 "UI 는 카테고리 단위 grouping" 표현 사용), `spec/4-nodes/4-integration/4-cafe24.md §8.3` (현재 "Resource 단위 grouping" 표현)
- **상세**: `cafe24-api-metadata.md §6` 는 이미 "카테고리" 용어로 grouping 을 표현하는 반면, `4-cafe24.md §8.3` 과 `4-integration.md §14.2` 는 "Resource 단위" 로 표현한다. Draft 2H 가 두 곳을 "카테고리" 로 통일하고 cafe24-api-metadata.md §6 에 용어 정의를 명시하는 것은 기존 불일치 해소로 적절하다. 단, `spec/4-nodes/4-integration/4-cafe24.md §8.3` 의 갱신이 Draft 2H 의 적용 범위에 포함되는지 draft 본문(`spec/4-nodes/4-integration/4-cafe24.md:337 줄`)에 명시되어 있으나, §8.3 전체가 아닌 해당 줄만 갱신하는 방식이므로 문맥 유지를 확인 요망.

---

## 요약

draft 는 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md` 의 관련 섹션들을 포괄적으로 갱신하여 cross-spec 정합성을 잘 유지하고 있다. Critical 위배는 없다. 핵심 WARNING 은 두 가지다: (1) `4-cafe24.md §9.4 step 4` 설명이 Draft 2J-1 에서 갱신되지 않아 `4-integration.md §3.2 step 4` 와 동일 흐름을 다르게 기술하게 되는 것, (2) `data-flow §1.2` 의 기존 구 API 경로가 이 draft 후에도 잔존한다는 점이다. 두 WARNING 모두 draft 에 소규모 diff 를 추가하여 해소 가능하며, 구현 착수를 차단할 수준은 아니다.

## 위험도

**LOW**