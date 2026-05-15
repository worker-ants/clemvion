# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. spec 적용 가능하나 WARNING 6건 보완 권장.

## 전체 위험도
**MEDIUM** — Critical 차단 사항 없음. WARNING 6건 중 2건(인덱스 부재·상태 전이 불일치)이 구현 단계에서 동작 오해·성능 회귀를 유발할 수 있어 spec 적용 전 보완 권장.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W-1 | cross_spec | Reauthorize 비활성 조건 범위 불일치 — DRAFT 2A는 2개 케이스만 열거, DRAFT 2K는 `connected` Cafe24 Private도 포괄하는 제3 조건 추가 | DRAFT 2A §2.2 더보기 메뉴 / DRAFT 2K §4.2 Reauthorize 행 | 동일 target 내 두 섹션 간 내부 불일치 | DRAFT 2A §2.2를 DRAFT 2K §4.2의 포괄 조건(`service_type='cafe24' AND app_type='private'` 전체)으로 통일하거나, DRAFT 2K에서 `connected` Cafe24 Private 재인증 활성 여부를 명시 |
| W-2 | cross_spec | `install_token` 단일 row 조회용 인덱스 부재 — 성능 개선 근거인 "단일 row 조회"를 전제하나 DRAFT 1D는 §3 "변경 없음" 처리, 실제 full table scan 발생 | DRAFT 1D (§3 변경 없음) / DRAFT 2J-2 §9.8 식별 전략 / DRAFT 3C-bis §1.4 스캐너 쿼리 | `spec/1-data-model.md §3 인덱스 전략` 표 | `spec/1-data-model.md §3`에 `install_token` UNIQUE 부분 인덱스(`WHERE install_token IS NOT NULL`) 및 TTL 스캐너용 `(status, created_at)` 인덱스를 추가하거나, DRAFT 1D에 deferred 사유를 명시 |
| W-3 | cross_spec | `spec/1-data-model.md §3` 인덱스 목적 설명 미갱신 — DRAFT 3D는 data-flow spec의 `(workspace_id, status)` 인덱스 설명을 "배지 카운트 + TTL 스캐너 겸용"으로 확장하나 data model spec은 구버전 설명으로 잔존 | DRAFT 1D §3 "변경 없음" / DRAFT 3D `spec/data-flow/integration.md §2.1` | `spec/1-data-model.md §3` `(workspace_id, status)` 행 목적 설명 | DRAFT 1D에 `spec/1-data-model.md §3` 해당 행 설명을 "만료/에러 상태 배지 카운트 + pending_install TTL 스캐너 조회"로 동기화하는 패치 항목 추가 |
| W-4 | rationale_continuity | `spec/4-nodes/4-integration/4-cafe24.md §6` 상태 전이 `install timeout → (삭제)`가 패치 대상에서 누락 — 적용 후 `spec/2-navigation/4-integration.md`(→ expired)와 `4-cafe24.md`(→ 삭제)가 동일 전이를 다른 결론으로 묘사 | DRAFT의 "영향받는 연관 문서" 목록 (`4-cafe24.md §9.4, §9.8, §337, §10`) — §6 없음 | `spec/4-nodes/4-integration/4-cafe24.md §6` 현행 `install timeout / manual delete ──▶ (삭제)` 전이 | 영향받는 연관 문서에 `4-cafe24.md §6` 추가, DRAFT 2J에 §6 상태 전이 다이어그램 및 전이 표 갱신 항목 포함 |
| W-5 | rationale_continuity | `spec/4-nodes/4-integration/4-cafe24.md`에 Rationale 섹션 부재 — 식별 전략 번복 근거가 `spec/2-navigation/4-integration.md`에만 신설되어 `4-cafe24.md` 단독 참조 시 추적 불가 | DRAFT 2J-2 (`4-cafe24.md §9.8` 갱신) | CLAUDE.md 공통 규약 — "아키텍처 결정 배경은 해당 spec 문서 끝 `## Rationale` 섹션" | DRAFT 2J에 `4-cafe24.md` `## Rationale` 섹션 신설 추가. 최소한 "식별 전략 변경 이유는 `spec/2-navigation/4-integration.md` ## Rationale '식별 키 승격' 항목 참조" cross-reference 포함 |
| W-6 | naming_collision | `CAFE24_INSTALL_INVALID_HMAC` 의미 범위 축소 — 기존 "HMAC 불일치 OR pending 미발견" 합산 → Draft에서 HMAC 불일치(403)와 토큰 미존재(404, `CAFE24_INSTALL_INVALID_TOKEN`) 분리. 기존 테스트가 미발견 케이스에 이 코드를 assert하면 회귀 발생 | Draft 변경 2 (callback handler error code 분리) | 기존 테스트 코드 내 `CAFE24_INSTALL_INVALID_HMAC` assert 위치 | 구현 착수(변경 2) 전 관련 테스트에서 `CAFE24_INSTALL_INVALID_HMAC`를 "token not found" 경로에서 assert하는 코드 grep 확인 필수 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | plan_coherence | 위임 출처 `spec-update-cafe24-pending-polish.md`가 in-progress 목록에서 확인 불가 | target draft 서두 참조 | 해당 파일 존재 확인 후 없으면 서두를 `cafe24-pending-polish.md §Consistency-check 결과` 직접 참조로 수정 |
| I-2 | plan_coherence | legacy path 영구 폐기 후속 항목이 `cafe24-pending-polish.md`에 미반영 | DRAFT 2I Rationale "install_token path 식별 키 승격" — "영구 폐기 시점은 plan 후속 항목으로 추가" | spec 적용 후 `cafe24-pending-polish.md`에 `[ ] legacy install 경로 영구 제거 — 운영 데이터 잔존 URL 확인 후 별도 PR` 체크박스 추가 |
| I-3 | plan_coherence | `node-output-redesign` plan의 `4-cafe24.md` 포함 여부 완전 확인 불가 (truncated) | DRAFT 2J — `4-cafe24.md` §9.4·§9.8 수정 | `node-output-redesign` README 전체 노드 목록 확인으로 Cafe24 노드 포함 여부 검증 |
| I-4 | convention_compliance | DRAFT 2I Rationale 내 review session 참조 경로 오기 (`2026-05-14_16-48-25` 디렉토리 미존재) | DRAFT 2I `## Rationale` "callback 실패 status 보존" 단락 끝 참조 | 실제 세션 타임스탬프로 경로 갱신 또는 참조 삭제 |
| I-5 | convention_compliance | spec 내 TypeScript 스니펫에 중복 주석 추가 — 상단 식별 전략 단락이 이미 동일 내용 서술 | DRAFT 2J-2 `verifyHmac` 함수 직전 주석 줄 | 해당 주석 줄 제거 또는 "위 단락 참고" 한 줄로 대체 |
| I-6 | cross_spec | DRAFT 2D §6 mermaid 다이어그램에 `pending_install` 자기 루프 전이 누락 (전이 표 텍스트에는 포함) | DRAFT 2D §6 flowchart 다이어그램 vs DRAFT 3A §3.1 stateDiagram | 다이어그램에 `pending_install --> pending_install: callback 실패 (status 보존, last_error/status_reason 갱신)` 자기 루프 추가 |
| I-7 | cross_spec | `integration_oauth_state.mode='reauthorize'`가 초기 install에도 사용 — 동일 값이 두 의미를 가짐 | DRAFT 3C §1.2.1 시퀀스 / DRAFT 2G §10.4 에러 표 | 현행 설계 수용 시 §10.4에 mode 값 재사용 이유를 명시하거나, 향후 확장 대비 별도 mode 값 검토 여부 결정 |
| I-8 | cross_spec | `expired → [*]: manual delete (install_timeout 케이스)` 한정자가 일반 expired 행의 삭제 가능 여부를 모호하게 함 | DRAFT 3A §3.1 상태 다이어그램 | 일반 expired 행도 UI 삭제 가능하다면 `(install_timeout 케이스)` 한정자를 제거하고 일반화 |
| I-9 | rationale_continuity | `install_token` 평문 저장 근거가 Rationale에 미언급 — 구현자가 기존 암호화 정책을 기계적으로 적용할 가능성 | DRAFT 1B / DRAFT 2I Rationale / DRAFT 3D | DRAFT 2I 또는 DRAFT 3D에 "`install_token`은 App URL path에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님" 한 줄 추가 |
| I-10 | rationale_continuity | `status_reason` 평문 저장 이유와 `last_error` 암호화 정책의 대비 미언급 | DRAFT 1C / DRAFT 2I Rationale | DRAFT 2I Rationale의 중복 보존 이유 단락에 "status_reason은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장" 한 줄 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | Reauthorize 비활성 조건 불일치(W-1), install_token 인덱스 부재(W-2), data model 인덱스 설명 미갱신(W-3) — 구현 시 동작 분기·성능 오해 유발 가능 |
| Rationale Continuity | **MEDIUM** | `4-cafe24.md §6` 상태 전이 누락(W-4)으로 spec 간 동일 전이 결론 불일치, `4-cafe24.md` Rationale 부재(W-5) |
| Convention Compliance | **LOW** | review 세션 경로 오기(I-4), 중복 주석(I-5) — spec 채택 차단 없음 |
| Plan Coherence | **LOW** | 위임 출처 확인 불가(I-1), legacy path 후속 항목 미반영(I-2) — 추적 보완 수준 |
| Naming Collision | **LOW** | `CAFE24_INSTALL_INVALID_HMAC` 의미 축소(W-6) — Draft Rationale에서 이미 명시적으로 인정, 구현 착수 전 테스트 grep 확인으로 해소 가능 |

---

## 권장 조치사항

> BLOCK 없음. 아래는 spec 적용 품질 향상을 위한 우선순위 순 보완 권장사항.

1. **[W-4] `4-cafe24.md §6` 상태 전이 패치 추가** — spec 적용 즉시 두 문서가 동일 전이를 다른 결론으로 묘사하게 되므로, DRAFT 2J에 `4-cafe24.md §6` 갱신 항목을 포함시킨 뒤 spec 적용.
2. **[W-1] DRAFT 2A §2.2 재인증 비활성 조건 통일** — DRAFT 2K §4.2의 포괄 조건(`service_type='cafe24' AND app_type='private'`)으로 DRAFT 2A를 맞추거나, `connected` 케이스 처리를 명시.
3. **[W-2 + W-3] `spec/1-data-model.md §3` 인덱스 보완** — `install_token` 부분 인덱스와 `(status, created_at)` 인덱스를 추가하고, `(workspace_id, status)` 행 목적 설명을 data-flow spec과 동기화. 두 항목이 동일 파일·동일 섹션 수정이므로 단일 DRAFT 1D 패치로 묶어 처리.
4. **[W-5] `4-cafe24.md` Rationale 섹션 신설** — DRAFT 2J에 최소 cross-reference 형태의 `## Rationale` 섹션 추가.
5. **[W-6] 구현 착수 전 테스트 grep 확인** — 변경 2 착수 전 `CAFE24_INSTALL_INVALID_HMAC` assert 코드를 grep하여 "미발견" 케이스 assert 여부 검증.
6. **[I-9] `install_token` 평문 저장 근거 명시** — DRAFT 2I 또는 DRAFT 3D에 한 줄 추가. 구현자 오적용 예방.
7. **[I-2] `cafe24-pending-polish.md` 후속 항목 추가** — spec 적용 완료 후 legacy path 영구 제거 체크박스 추가.
8. **[I-4] review session 경로 오기 수정** — DRAFT 2I Rationale 내 `2026-05-14_16-48-25` 참조를 실제 존재하는 세션 타임스탬프로 교체.