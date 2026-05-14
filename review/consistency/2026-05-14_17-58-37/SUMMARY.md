# Consistency Check 통합 보고서

**BLOCK: YES** — Cross-Spec CRITICAL 2건이 해소되기 전까지 spec write 및 구현 착수를 차단한다.

---

## 전체 위험도
**HIGH** — CRITICAL 2건(동일 draft 내 스펙 직접 모순)·WARNING 6건 확인. CRITICAL 해소 후 WARNING 보완 시 진행 가능.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| C1 | Cross-Spec / Naming Collision / Rationale / Convention | `resource_not_found` status_reason 포함 여부 — draft 내부 4곳 직접 모순 | DRAFT 1C (`§2.10` 후보값 **제외** 명시) / DRAFT 2G (§10.4 "변경 불가") vs DRAFT 3B (data-flow §3.2 **포함**) / DRAFT 2D (§6 전이 표 **포함**) | 동일 컬럼 유효값을 두 spec이 정반대로 선언 — row가 사라진 케이스에서 DB UPDATE 불가이므로 DRAFT 1C·2G 입장이 의미론적으로 옳음 | DRAFT 3B의 `pending_install` status_reason 목록에서 `resource_not_found` 제거. DRAFT 2D §6 전이 표에서도 동일 제거. `resource_not_found`는 §10.4 "변경 불가" 행으로만 문서화 |
| C2 | Cross-Spec | `connected` 재인증 실패 시 status 전이 — 동일 파일 두 섹션 정반대 기술 | DRAFT 2G §10.2 step 6 신규 추가: "connected 유지" vs DRAFT 2G §10.4 표: `error(auth_failed)` + `last_error` 기록 | 동일 시나리오에서 status 처리가 공존 불가능 — 개발자가 어느 섹션을 따를지 결정 불가 | §10.4 표("error(auth_failed)")를 정의로 확정. §10.2 step 6 해당 구문을 "`pending_install` 은 pending_install 유지 — `connected` 재인증 실패는 §10.4 기준으로 `error(auth_failed)` 전이"로 교정. 또는 step 6이 state mismatch 계열(토큰 교환 이전 단계)만 가리킨다면 조건 범위를 명시적으로 한정 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | Cross-Spec / Naming Collision / Convention | BullMQ `integration-expiry` 큐 메시지 스키마 확장 — 하위 호환성 미명시 | DRAFT 3C-bis (`spec/data-flow/integration.md §1.4`) — `{ integrationId, reason: 'token_expiring' \| 'pending_install_timeout' }` | 기존 소비자가 처리하는 `{ integrationId }` 단일 필드 스키마 | spec §1.4에 "기존 소비자는 `reason` 미포함 메시지를 `token_expiring` 으로 간주(하위 호환 보장)" 한 줄 추가. 또는 구현 spec에 `reason ?? 'token_expiring'` 기본값 처리 명시 |
| W2 | Convention Compliance | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — HTTP 400 사용, swagger 규약은 409 | DRAFT 2F / DRAFT 2F-bis (`spec/2-navigation/4-integration.md §9.4`) | `spec/conventions/swagger.md §2-4` "중복/충돌 → ApiConflictResponse(409)" 및 기존 `INTEGRATION_IN_USE(409)` 선례 | 해당 에러 코드를 400 → **409** 로 변경 |
| W3 | Rationale Continuity | Cafe24 Private 전체 reauthorize 비활성 — `connected → expired(token_expired)` 복구 경로가 Rationale에 누락 | DRAFT 2K (§4.2 비활성 조건) / DRAFT 2I Rationale | DRAFT 3A 상태 다이어그램 `expired → connected: reauthorize` 일반 경로(Cafe24 Private 예외 미표기) | DRAFT 2I Rationale에 "Cafe24 Private `connected → expired(token_expired)` 케이스의 유일한 복구 경로는 삭제 후 재등록이며, Private 앱은 우리 서버에서 OAuth를 시작할 수 없는 구조적 제약의 당연한 귀결" 추가. DRAFT 3A 다이어그램에 Private 앱 예외 노트 추가 또는 DRAFT 2D 전이 표의 `expired → connected` 행에 "단, Cafe24 Private 제외" 병기 |
| W4 | Cross-Spec | §2.3 상태 필터 칩 — `pending_install` 의도적 제외가 본문에 미반영 | DRAFT 2I Rationale에만 서술 | `spec/2-navigation/4-integration.md §2.3` 현행 필터 칩 본문(변경 없음) | §2.3 설명 끝에 "※ `pending_install`은 외부 흐름 진행 중 정상 전환 상태로 필터 칩에 포함하지 않는다" 한 줄 추가. "영향받는 연관 문서" 목록에 §2.3 추가 |
| W5 | Plan Coherence | Legacy path 폐기 후속 항목 — spec draft 약속 vs plan 미등재 | DRAFT 2I Rationale "영구 폐기 시점은 `cafe24-pending-polish.md` 후속 항목으로 추가" | `plan/in-progress/cafe24-pending-polish.md` 체크리스트 (해당 항목 없음) | spec draft 적용 직후 `cafe24-pending-polish.md`에 `[ ] legacy path CAFE24_INSTALL_LEGACY_PATH(410) 영구 폐기 시점 확인 — 운영 데이터·외부 등록 URL 잔존 여부 확인 후 처리` 추가 |
| W6 | Plan Coherence | V041 migration 의존성 — 구현 plan 미명시 | DRAFT 3D (`spec/data-flow/integration.md §2.1`) — `provider_meta` 컬럼 (V041 migration) | `plan/in-progress/cafe24-pending-polish.md` 변경 2/3 체크리스트 | 변경 2 첫 항목 앞에 `[ ] 선행 확인: integration_oauth_state.provider_meta (V041 migration) 적용 여부` 항목 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Rationale Continuity | `expired → [*]` 다이어그램 어노테이션 과도한 한정 — "install_timeout 케이스만 삭제 가능"으로 오독 가능 | DRAFT 3A (`data-flow §3.1` stateDiagram-v2) | `expired --> [*]: manual delete (install_timeout 케이스)` → `manual delete` 로 범용화하고 install_timeout 케이스는 별도 노트로 분리 |
| I2 | Cross-Spec | Reauthorize 비활성 조건 ①②가 ③에 완전 포함 — 구현자 오독 가능 | DRAFT 2K §4.2 조건 열거 | "① ②는 ③의 특수 케이스 — 사용자 메시지 분기용 예시"임을 주석으로 명시하거나, ③만으로 단순화 |
| I3 | Cross-Spec | `credentials_unreadable` — DRAFT 3B data-flow에 추가되나 DRAFT 1C §2.10 `error` 목록 명시 여부 불명확 | DRAFT 1C (`spec/1-data-model.md §2.10`) | DRAFT 1C 적용 결과 `error` 케이스 목록에 `credentials_unreadable` 포함 여부 최종 확인, 누락 시 명시적으로 추가 |
| I4 | Cross-Spec | `spec/0-overview.md §6.3` Cafe24 행 — "spec 완료(2026-05-13)" 표기 구식화 | 적용 후 `spec/0-overview.md §6.3` | 적용 후 "(2026-05-14 추가 갱신 — pending_install 흐름 정비, install_token App URL 도입)" 병기 |
| I5 | Convention Compliance | `cafe24-api-metadata.md §6` "문맥에 따라 혼용한다" — 자유 혼용으로 오독 가능 | DRAFT 2H | `"문맥에 따라 혼용한다"` → `"목적별로 구분 사용한다"` 로 교체 |
| I6 | Convention Compliance | HTTP 410(`CAFE24_INSTALL_LEGACY_PATH`) — swagger 규약 표준 데코레이터 표에 미등재 | DRAFT 2E / DRAFT 2F | spec 본문에 `(구현 시 @ApiResponse({ status: 410 }) 사용)` parenthetical 추가 |
| I7 | Plan Coherence | `spec-update-cafe24-pending-polish.md` 위임 항목 A–D 커버리지 확인 완료 | DRAFT 1A–1D / 2D / 2C / 2E / 2K / 2G / 3B / 2I | 이상 없음 |
| I8 | Plan Coherence | `node-output-redesign` plan — cafe24.md §9.4/§9.8/§10 수정과 내용 상 경합 없음 | DRAFT 2J | 이상 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **HIGH** | CRITICAL 2건 — `resource_not_found` 4곳 모순, `connected` 재인증 실패 status 2곳 모순 |
| Rationale Continuity | **MEDIUM** | WARNING 2건 — `resource_not_found` 내부 불일치(C1과 중복), Cafe24 Private `token_expired` 복구 경로 Rationale 공백 |
| Convention Compliance | **LOW** | WARNING 2건 — `resource_not_found` 내부 불일치(C1과 중복), `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 400→409 규약 위반 |
| Plan Coherence | **LOW** | WARNING 2건 — legacy path 폐기 후속 항목 plan 미등재, V041 의존성 미명시. 최신 check(17-49-11) BLOCK:NO 확인 |
| Naming Collision | **LOW** | 외부 충돌 0건. 내부 `resource_not_found` 불일치(C1과 중복) 1건만 |

---

## 권장 조치사항

1. **[BLOCK 해소 필수 — C1]** DRAFT 3B(`data-flow §3.2`)의 `pending_install` status_reason 목록에서 `resource_not_found` 제거. DRAFT 2D §6 전이 표에서도 동일 제거. `resource_not_found`는 §10.4 "변경 불가" 행으로만 문서화.

2. **[BLOCK 해소 필수 — C2]** DRAFT 2G §10.2 step 6을 교정 — "`pending_install`은 pending_install 유지, `connected` 재인증 실패는 §10.4 기준 `error(auth_failed)` 전이"로 통일. 또는 step 6이 state mismatch 계열만 가리킨다면 조건 범위를 명시적으로 한정.

3. **[W2 — 규약 위반]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 400 → **409** 로 변경 (swagger 규약 및 `INTEGRATION_IN_USE` 선례 준수).

4. **[W3 — Rationale 보완]** DRAFT 2I Rationale에 "Cafe24 Private `connected → expired(token_expired)` 유일한 복구 경로는 삭제 후 재등록" 명시. DRAFT 3A 다이어그램에 Cafe24 Private 예외 노트 추가 또는 DRAFT 2D 전이 표에 "단, Cafe24 Private 제외" 병기.

5. **[W4 — spec 본문 보완]** `spec/2-navigation/4-integration.md §2.3` 끝에 `pending_install` 필터 칩 제외 사유 한 줄 추가.

6. **[W1 — 구현 안전]** DRAFT 3C-bis spec §1.4에 BullMQ `reason` 필드 기본값 fallback(`'token_expiring'`) 처리 명시.

7. **[W5·W6 — plan 보완]** C1·C2 해소 후 spec 적용 직전 또는 직후, `cafe24-pending-polish.md`에 legacy path 폐기 후속 항목과 V041 migration 선행 확인 항목 추가.

8. **[I1~I6 — 선택적 보완]** `expired → [*]` 다이어그램 어노테이션 범용화, `credentials_unreadable` §2.10 포함 최종 확인, `spec/0-overview.md §6.3` 적용 후 갱신, 기타 표현 개선은 BLOCK 해소 후 일괄 처리 가능.