# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. spec write 차단 사유 미발생.

---

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 6건(구현 단계 직접 위험 포함), INFO 11건. WARNING W1·W2·W3 해소 후 적용 권장.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec **+** Plan Coherence | `4-cafe24.md` §9.4 App URL 경로 미갱신 — install_token path segment 교체가 "영향받는 연관 문서"에서 누락됨 | DRAFT 2E (§9.2 endpoint 교체) | `spec/4-nodes/4-integration/4-cafe24.md §9.4` step 3의 `GET /api/integrations/oauth/install/cafe24?...` | §9.4를 "영향받는 연관 문서"에 추가하고, URL을 `GET .../install/cafe24/<installToken>?...` 로 교체 |
| W2 | Cross-Spec **+** Plan Coherence | `4-cafe24.md` §9.8 HMAC 검증 알고리즘 미갱신 — `mall_id` 기반 O(N) 스캔 → `install_token` 단일 row 1회 검증으로 변경됐으나 §9.8 미포함 | DRAFT 2E (신규 install endpoint), `cafe24-pending-polish.md` 변경 2 TODO | `spec/4-nodes/4-integration/4-cafe24.md §9.8` HMAC 검증 알고리즘 정의 | §9.8을 "영향받는 연관 문서"에 추가; 신규 단일-row 조회 + 1회 HMAC 검증 알고리즘으로 섹션 교체 |
| W3 | Cross-Spec | `data-flow/integration.md` §1.4 만료 스캐너 쿼리 미갱신 — `pending_install` TTL 처리 조건 누락 | DRAFT 3A (§3.1 전이), DRAFT 3C (§1.2 sub-diagram note) | `spec/data-flow/integration.md §1.4` 스캐너 쿼리 (`status='connected'` 조건만 존재) | §1.4를 "영향받는 연관 문서"에 추가; 두 번째 스캔 조건 `created_at < now-24h AND status='pending_install' → status='expired', status_reason='install_timeout', install_token=NULL` 명시 |
| W4 | Rationale Continuity | `install timeout → 삭제` 결정을 `install timeout → expired(보존)` 으로 번복했으나 Rationale 내 "기존 결정 번복" 명시 부재 | DRAFT 2D §6 전이 표, DRAFT 2I Rationale | `spec/2-navigation/4-integration.md:565` — 현행 spec의 `install timeout / manual delete → (삭제)` | Rationale "install_token TTL 24h" 항목 첫 단락에 "기존 spec §6는 삭제를 명시했으며 본 개정에서 expired 전이로 번복한다 — 이유: 데이터 분석·감사 보존" 한 문장 추가 |
| W5 | Rationale Continuity | `install_timeout` 으로 expired된 Cafe24 Private 행에서 reauthorize 버튼 비활성 규칙 미명시 | DRAFT 2A §2.2 더보기(⋮) 메뉴, DRAFT 2D 전이 표 주석 | `spec/2-navigation/4-integration.md §6` — `expired → reauthorize → connected` 전이 정의 | §2.2 더보기(⋮) 정의 또는 §6 노트에 "`status_reason='install_timeout'` 인 expired 행은 reauthorize 버튼 비활성 (Private 앱 재인증 진입점 없음)" 명시 |
| W6 | Convention Compliance | `pending_install` status_reason 저장값에 `UPPER_SNAKE_CASE` 사용 — 기존 구현 전체(`auth_failed`, `token_expired` 등)가 `snake_case`인 필드에 케이스 불일치 도입 | DRAFT 1C, 2D 전이 표, 2G §10.4, 3B 매핑 표, 3C 시퀀스 다이어그램 | `cafe24-api.client.ts:354`, `integrations.service.ts:576`, `data-flow/integration.md §3.2` — 모두 `snake_case` 리터럴 | 5개 위치 일괄 교정: `OAUTH_TOKEN_EXCHANGE_FAILED` → `oauth_token_exchange_failed`, `OAUTH_STATE_MISMATCH` → `oauth_state_mismatch`, `OAUTH_STATE_EXPIRED` → `oauth_state_expired`, `RESOURCE_NOT_FOUND` → `resource_not_found`. API 응답 에러 코드(`CAFE24_INSTALL_*`)는 `UPPER_SNAKE_CASE` 유지 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Plan Coherence | `data-flow §1.2·§2.1` 변경이 plan 실행 순서 0 명시 범위 초과 (enrichment) | DRAFT 3C (§1.2 sub-diagram), DRAFT 3D (§2.1 스키마) | 차단 불필요. `cafe24-pending-polish.md` 실행 순서 0에 §1.2·§2.1 추가하거나 draft에 "plan 범위 외 enrichment" 주석 명시 |
| I2 | Plan Coherence | `spec/conventions/cafe24-api-metadata.md#6-도구-allowlist` 앵커 존재 여부 미검증 | DRAFT 2H (§14.2), `4-cafe24.md:337` 패치 | 적용 전 파일·앵커 존재 확인. 없으면 해당 파일 먼저 생성하거나 링크 제거 |
| I3 | Rationale Continuity | `credentials_unreadable` status_reason 발급 조건 설명 부재 — 에러 코드 목록(§9.4)에도 미포함 | DRAFT 1C status_reason 표 | 1C 또는 §9.4에 발급 조건(예: 암호화된 credentials 복호화 실패) 한 줄 추가 |
| I4 | Rationale Continuity | 구 경로(`/oauth/install/cafe24`) 영구 폐기 시점 추적 경로 미명시 | DRAFT 2E Deprecated 행 끝 "영구 폐기 시점은 별도 plan" | "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 에 후속 항목으로 추가" 등 구체적 파일명 명시 |
| I5 | Rationale Continuity **+** Cross-Spec | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 고유성을 DB 유니크 인덱스로 강제할지 앱 레벨 체크로만 유지할지 미명시 — 동시 요청 race condition 위험 | DRAFT 2F §9.4, DRAFT 3D Postgres schema, `spec/1-data-model.md §2.10` | `1D` 또는 `3D`에 "app-level check only (이유: …)" 또는 "DB 유니크 인덱스 V043 추가" 중 하나를 명시. §9.2 oauth/begin 설명에 선행 조건 추가 권장 |
| I6 | Convention Compliance | `last_error.code` ↔ `status_reason` 동일 문자열 공유 설계 의도 불명확 | DRAFT 3C 시퀀스 다이어그램, DRAFT 2G | Rationale §2I에 "TTL 만료 후 last_error 소거 가능성 때문에 status_reason에도 중복 보존" 설계 근거 한 줄 추가 |
| I7 | Naming Collision | `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 — "token 미존재 → 403" 케이스가 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리되는 breaking semantic change | DRAFT 2E §9.2 | §2E replace diff에 "기존 HMAC 에러의 pending-미발견 케이스를 분리" 임을 주석 명시. 내부 e2e 테스트 404 응답 대응 필요 |
| I8 | Naming Collision **+** Convention | `OAUTH_TOKEN_EXCHANGE_FAILED`가 API 에러 코드(§9.4)와 DB `status_reason` 양쪽에 동일 string 사용 — 의도가 spec 어디에도 미명시 | DRAFT 1C, 2D, 3B, 3C | §1C 또는 §2D에 "status_reason 값은 callback 에러 코드 string을 그대로 사용한다" 한 문장 추가 (W6 적용 시 `snake_case` 교정과 함께 처리) |
| I9 | Naming Collision *(해소됨)* | V042 마이그레이션 번호 정합성 — `install_token` 컬럼이 V042 이전에 추가됐을 가능성 제기 | DRAFT 3D | Convention Compliance에서 `backend/migrations/V042__cafe24_private_app_pending_install.sql` 존재 및 컬럼 추가 확인 완료. 이슈 없음 |
| I10 | Naming Collision **+** Cross-Spec | "카테고리" / "Resource" 이중 용어 — UI 레이어 vs 백엔드 메타데이터 레이어 구분이 문서 간 미명시 | DRAFT 2H (§14.2), `cafe24-api-metadata.md §6` | `cafe24-api-metadata.md §6`에 "UI grouping 단위 = 카테고리, 백엔드 메타데이터 파일 단위 = Resource — 동일 범위, 문맥에 따라 혼용" 한 문장 추가 |
| I11 | Cross-Spec | §9.2 `oauth/begin` 응답의 `appUrl` 형식 변경(install_token path segment 포함) 미명시 — §3.2 예시에서만 확인 가능 | DRAFT 2C §3.2 응답 예시 | §9.2 Cafe24 Private 설명에 "appUrl 형식: `.../install/cafe24/<installToken>`" 한 줄 추가 |
| I12 | Cross-Spec | §2.3 필터 칩에 `Pending Install` 옵션 미추가 — 의도적 제외라면 Rationale 미명시 | DRAFT 2A §2.2 (pending_install 목록 표시), DRAFT 2B (배너 제외) | Rationale에 "pending_install은 정상 전환 상태이므로 필터 칩 미추가" 결정 명시. 또는 필터 칩 추가 여부 결정 후 반영 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | `4-cafe24.md` §9.4·§9.8 및 `data-flow` §1.4 누락 — 구현자가 구버전 URL·HMAC 알고리즘으로 구현하거나 pending_install 행 누적 가능 |
| Rationale Continuity | **LOW** | install timeout 처리 번복 acknowledgment 부재, expired 행 reauthorize UI 비활성 규칙 미명시 |
| Convention Compliance | **LOW** | `pending_install` status_reason 케이스 불일치(UPPER_SNAKE_CASE) — 수정 범위 5~6곳으로 제한적 |
| Plan Coherence | **LOW** | §9.8 plan-draft 불일치, §1.2·§2.1 enrichment 범위 초과 — 내용 정합은 문제없음 |
| Naming Collision | **LOW** | 명명 직접 충돌 없음. HMAC 의미 축소·V042 정합성·이중 용어 명확화 필요 |

---

## 권장 조치사항

> BLOCK 없으므로 spec write를 진행할 수 있으나, **W1·W2·W3는 구현 단계 직접 위험**이므로 draft에 반영 후 적용을 강권한다.

1. **[W1·W2 우선]** `spec/4-nodes/4-integration/4-cafe24.md` §9.4 App URL 및 §9.8 HMAC 알고리즘을 "영향받는 연관 문서"에 추가하고 해당 섹션 패치를 draft에 포함.
2. **[W3]** `spec/data-flow/integration.md` §1.4 스캐너 쿼리에 `pending_install` TTL 처리 조건을 "영향받는 연관 문서"에 추가하고 섹션 갱신 포함.
3. **[W6]** `pending_install` status_reason 저장값 5개 위치를 `snake_case`로 일괄 교정 (I8의 명시 추가와 함께 처리).
4. **[W4]** Rationale `install_token TTL 24h` 항목에 기존 spec 삭제 정책 번복 명시.
5. **[W5]** §2.2 또는 §6에 `status_reason='install_timeout'` expired 행의 reauthorize 버튼 비활성 규칙 추가.
6. **[I2]** `cafe24-api-metadata.md#6-도구-allowlist` 앵커 존재 확인 후 draft 적용.
7. **[I10·I11·I12]** 낮은 비용 명확화 항목 — draft 주석 또는 Rationale에 한 줄씩 추가.
8. **[I3·I4·I5·I6·I7·I8]** 나머지 INFO 항목은 해당 섹션 Rationale·설명문에 한 문장씩 보완.