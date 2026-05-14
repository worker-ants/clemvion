# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능하나 아래 WARNING 7건을 착수 전/중에 조치 권장.

---

## 전체 위험도

**MEDIUM** — Critical 충돌은 없으나, plan 상태 코드 오기재 및 spec 내 누락·불일치 항목이 Cafe24 Private 앱 흐름 구현 시 오구현을 유발할 수 있다.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | cross_spec | `§11.1` 스캐너 pseudo-code에 `pending_install` TTL 만료 처리(2번째 쿼리) 누락 — 구현자가 §11.1만 읽으면 24h timeout 로직을 빠뜨릴 수 있음 | `spec/2-navigation/4-integration.md §11.1` | `spec/data-flow/integration.md §1.4` | §11.1 pseudo-code에 `pending_install` 대상 쿼리 + `expired(install_timeout)` 전이 블록 추가 |
| 2 | cross_spec | `mall_id` 저장 위치 불일치 — §10.3은 callback **이전** `oauth_preview`에 저장이라 기술하나, data-flow §2.1(V041)은 `integration_oauth_state.provider_meta`(encrypted JSONB)에 캐리한다고 정의 | `spec/2-navigation/4-integration.md §10.3` | `spec/data-flow/integration.md §2.1` | §10.3의 "oauth_preview 임시 저장소" → `integration_oauth_state.provider_meta` (V041)로 수정; `oauth_preview`는 callback 이후 token 저장 용도로만 기술 |
| 3 | cross_spec | Rate Limit 429 sleep 공식 불일치 — §5.8은 `X-Cafe24-Call-Remain`만, 4-cafe24.md §4.1은 `max(Call-Remain, Time-Remain)`을 사용 | `spec/2-navigation/4-integration.md §5.8` | `spec/4-nodes/4-integration/4-cafe24.md §4.1` | §5.8을 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 으로 동기화 (4-cafe24.md §4.1을 권위 소스로) |
| 4 | cross_spec | §13 데이터 모델 영향 요약에 `install_token` 필드 및 부분 인덱스 누락 | `spec/2-navigation/4-integration.md §13` | `spec/1-data-model.md §2.10, §3`, `spec/data-flow/integration.md §2.1 V042` | §13에 `install_token (String?, Cafe24 private 전용)` 필드 + `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스 추가 |
| 5 | plan_coherence | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 상태 코드 오기재 — plan 변경 3: **400**, spec §9.4: **409** | `plan/in-progress/cafe24-pending-polish.md 변경 3` | `spec/2-navigation/4-integration.md §9.4` | plan 변경 3의 `(400)` → `(409)` 로 정정 |
| 6 | plan_coherence | uniqueness 조건 범위 불일치 — plan 변경 3: `(workspaceId, mall_id)`, spec §9.2: `(workspaceId, mall_id, app_type='private')` | `plan/in-progress/cafe24-pending-polish.md 변경 3` | `spec/2-navigation/4-integration.md §9.2` | plan 변경 3의 유일성 조건을 `(workspaceId, mall_id, app_type='private')`로 동기화 |
| 7 | naming_collision | `CAFE24_*` prefix 에러 코드의 API 에러 코드 공간 일관성 문서화 누락 — 기존 `OAUTH_*` 계열과 같은 레이어에서 prefix 구분 영역이 spec §9.4에 명시되지 않음 | `spec/2-navigation/4-integration.md §9.4` | `spec/1-data-model.md §2.10` note | §9.4 에러 매핑 테이블 또는 note에 `CAFE24_*` prefix가 `OAUTH_*`와 구분되는 에러 코드 공간임을 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `pending_install → pending_install` 전이에서 `install_token` 보존 여부 미명시 | `spec/2-navigation/4-integration.md §6` | 해당 전이 설명에 "`install_token` 유지 (Cafe24 재시도를 위해 소거하지 않음)" 문구 추가 |
| 2 | plan_coherence | 변경 2가 spec 갱신 근거로 "§9.8" 참조하나 해당 섹션 없음 (§9.2에 통합) | `plan/in-progress/cafe24-pending-polish.md 변경 2` | `§9.8` 참조를 `§9.2`로 정정 또는 삭제 |
| 3 | plan_coherence | 변경 0/2 spec 갱신 체크박스가 미체크이나 spec 내용은 이미 반영 완료 | `plan/in-progress/cafe24-pending-polish.md 변경 0, 2` | 두 체크박스를 `[x]`로 처리하여 plan 상태를 실제와 동기화 |
| 4 | convention_compliance | §9.4에서 인용하는 `spec/conventions/swagger.md` 실존 여부 미확인 | `spec/2-navigation/4-integration.md §9.4` | 구현 전 파일 실존 확인 + §2-4 조항이 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 와 정합하는지 검증 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | §11.1 pending_install 스캔 누락, §10.3 mall_id 저장 위치 불일치, §5.8 rate-limit 공식 불일치, §13 install_token 누락 |
| Rationale Continuity | **NONE** | 모든 과거 결정이 본문·Rationale에 정합하게 반영됨 |
| Convention Compliance | **NONE** | cafe24-api-metadata·migrations·node-output 3개 규약 준수. swagger.md 실존 확인만 남음 |
| Plan Coherence | **MEDIUM** | plan 변경 3의 HTTP 상태 코드(400→409)·uniqueness 조건 오기재로 API Contract 불일치 위험 |
| Naming Collision | **LOW** | CAFE24_* prefix 에러 코드의 API 에러 코드 공간 문서화 권장 (의미 충돌 없음) |

---

## 권장 조치사항

> WARNING 5·6은 **구현 착수 전** plan 문서 정정이 필수. 나머지는 착수 후 병행 가능.

1. **(착수 전 필수)** `plan/in-progress/cafe24-pending-polish.md` 변경 3 정정
   - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)` → `(409)`
   - uniqueness 조건: `(workspaceId, mall_id)` → `(workspaceId, mall_id, app_type='private')`

2. **(spec 수정 — project-planner 위임)** `spec/2-navigation/4-integration.md` 4곳 수정
   - §10.3: `oauth_preview` → `integration_oauth_state.provider_meta`
   - §11.1: `pending_install` TTL 만료 스캔 블록 추가
   - §5.8: 429 sleep 공식 → `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)`
   - §13: `install_token` 필드 + 부분 인덱스 추가

3. **(권장)** §6 `pending_install → pending_install` 전이에 `install_token` 보존 명시 추가

4. **(권장)** §9.4 note에 `CAFE24_*` / `OAUTH_*` prefix 구분 설명 추가

5. **(plan 유지보수)** 변경 0·2 체크박스 `[x]` 처리, 변경 2의 `§9.8` 참조 정정

6. **(확인)** `spec/conventions/swagger.md` 파일 실존 및 §2-4 조항 내용 검증