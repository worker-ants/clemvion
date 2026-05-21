# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 모드: 구현 착수 전 (--impl-prep)
대상: `spec/conventions/cafe24-api-catalog`
검토 일시: 2026-05-21T07:31:53

---

## 전체 위험도
**MEDIUM** — Critical 3건 존재 (구 토큰 잔존, Rationale 섹션 순서 역전, privacy_* id rename 미결 결정 우회). Batch 1-G 진입 전 선결 조건 존재. 나머지 230건은 즉시 진행 가능.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Convention Compliance | `cafe24-restricted-scopes.md §2` 32행에 drift-fix 로 폐기된 구 토큰 `restricted: op` 잔존 — 같은 섹션 내에 `op` / `operation` 혼재 | `spec/conventions/cafe24-restricted-scopes.md` 32행 | `_overview.md` §2 (허용값: `scope`/`operation`/빈칸), `cafe24-api-metadata.md` CHANGELOG drift-fix | 32행의 `restricted: op` → `restricted: operation` 으로 단순 수정 |
| C-2 | Convention Compliance (+ Cross-Spec INFO) | `store.md` 의 `## Rationale` 섹션이 `## 표` 앞에 배치 — CLAUDE.md "문서 끝 Rationale" 규약 위반 | `spec/conventions/cafe24-api-catalog/store.md` 9행(`## Rationale`), 15행(`## 표`) | `CLAUDE.md` 정보 저장 위치 규약, `mileage.md`/`notification.md`/`privacy.md` 구조 | `## Rationale` 블록 전체(Rationale 본문 + `> ※ paymentmethods...` 주석)를 `## 표` 섹션 뒤로 이동 |
| C-3 | Plan Coherence (+ Cross-Spec WARNING) | `privacy_*` 6 row (`privacy_boards_get/update`, `privacy_join_get/update`, `privacy_orders_get/update`) 의 id prefix rename 결정이 `cafe24-restricted-scopes-followups.md §3` 에서 미해결(`[ ] prefix 결정`)인 채로 Batch 1-G 가 현 id 그대로 backend metadata `supported` 등록을 시도 — rename 결정을 일방 우회하게 되며 이후 rename 시 catalog-sync 동기 테스트 파편화 불가피 | `plan/in-progress/cafe24-planned-implementation.md` §Phase 1 Batch 1-G | `plan/in-progress/cafe24-restricted-scopes-followups.md §3` (prefix 결정 체크박스 미해소), `spec/conventions/cafe24-api-catalog/store.md` privacy_* 6 row | Batch 1-G 진입 전 `cafe24-restricted-scopes-followups.md §3` 의 prefix 결정 합의 → `store.md` row id 갱신 → 이후 Batch 1-G 진행. 대안: Batch 1-G 에서 privacy_* 6건을 scope 밖으로 분리하고 rename 완료 후 별도 batch 처리 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `_overview.md` §4 검증 규칙 8에 `planned` 행 예외 미명시 — `paymentgateway_paymentmethods_create/update/delete` 가 `status=planned + restricted=operation` 조합이나 `planned` 행에 규칙 8 적용 여부가 모호 | `spec/conventions/cafe24-api-catalog/_overview.md` §4 규칙 8 | `spec/conventions/cafe24-api-catalog/store.md` paymentgateway 3행 | §4 규칙 8에 "`planned` 행은 backend 메타데이터 row 가 없으므로 본 검증 대상에서 제외" 명시 |
| W-2 | Plan Coherence | Batch 1-G 의 privacy_* 6 row 의 `restricted` 분류(`scope` 여부)가 Cafe24 공식 docs 미확인 상태 — plan 자체에 "cafe24-restricted-scopes.md 확인" 주석이 달려 있으나 미이행 | `plan/in-progress/cafe24-planned-implementation.md` Batch 1-G 비고 컬럼 | `spec/conventions/cafe24-restricted-scopes.md §1` | Batch 1-G 진입 전 해당 6 endpoint 의 실제 Cafe24 scope 값 확인 → §1 대조 결과를 plan 결정 로그에 기록 |
| W-3 | Plan Coherence | Phase 1 (store.md 98행 대규모 편집) 과 `cafe24-restricted-scopes-followups.md §3` (동일 파일 6행 rename pending) 의 worktree 간 경합 가능성 | `plan/in-progress/cafe24-planned-implementation.md` Phase 1 전체 | `plan/in-progress/cafe24-restricted-scopes-followups.md §3` | C-3 해소 시 자연 해소. restricted-scopes-followups §3 를 Phase 1 merge 이전/이후 어느 시점에 처리할지 plan 에 명시 |
| W-4 | Convention Compliance (+ Rationale Continuity) | 대부분의 catalog resource 파일(14개) 에 `## Rationale` 섹션 없음 — `_overview.md` 위임 패턴이 공식화되지 않아 CLAUDE.md 3섹션 규약 미달 | `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md`, `promotion.md`, `salesreport.md`, `shipping.md`, `supply.md`, `translation.md` | CLAUDE.md 3섹션 구성 권장 | 각 파일에 `## Rationale\n설계 근거는 [_overview.md](./_overview.md) §2·§4·§7 참조` 한 줄 추가, 또는 `_overview.md` 에 위임 패턴 공식화 |
| W-5 | Convention Compliance (+ Rationale Continuity) | `_overview.md` 에 `## Rationale` 섹션 없음 — 설계 결정이 CHANGELOG(§7)에 날짜별로 분산, 통합 Rationale 헤더 미존재 | `spec/conventions/cafe24-api-catalog/_overview.md` | CLAUDE.md 정식 규약 문서 3섹션 권장; `cafe24-api-metadata.md` 는 Rationale 보유 | `_overview.md` 끝에 `## Rationale` 섹션 추가 — 핵심 설계 결정 위임형으로 요약 |
| W-6 | Convention Compliance (+ Naming Collision) | operation id 가 `<resource>_<verb>` 규약을 따르지 않고 Cafe24 endpoint path prefix 를 직접 사용 — 다수 파일에 걸쳐 광범위 | `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `product.md` 등 | `_overview.md` §2 id 컬럼 정의, `cafe24-api-metadata.md` §6 step 3 | (A) 규약 갱신: "Cafe24 endpoint path prefix 허용" 문구 추가 (현실적). (B) 카탈로그 전체 id 정정 (비용 높음, 비권장) |
| W-7 | Naming Collision | `boards_setting_get/update` (store, planned) vs `boards_settings_get/update` (community, supported) — 1글자 차이 유사 ID, cross-resource 중복 검증 부재 | `spec/conventions/cafe24-api-catalog/store.md` planned 행 | `spec/conventions/cafe24-api-catalog/community.md` supported 행 | store.md planned ID 를 `store_boards_setting_get/update` 또는 구현 시점 docs 검증 후 구체적 명칭으로 승격 |
| W-8 | Naming Collision | `orders_status_get/update` (store, planned) vs `order_status_update/order_status_update_multiple` (order, supported) — 단수/복수 1자 차이, 표시 레이블 설정 vs 실제 주문 상태 변경으로 의미 완전 상이 | `spec/conventions/cafe24-api-catalog/store.md` planned 행 | `spec/conventions/cafe24-api-catalog/order.md` supported 행 | 구현 시 `store_order_status_label_get/update` 등 store scope + "표시 설정" 의미를 포함한 명칭으로 재명명 |
| W-9 | Cross-Spec | `_overview.md` §5 Coverage Matrix 의 store planned `50+` (실제 98개), order planned `30+` (실제 89개) 불일치 | `spec/conventions/cafe24-api-catalog/_overview.md` §5 | `plan/in-progress/cafe24-planned-implementation.md` ("store 98, order 89" 명시) | 즉시 정정하거나, Phase 4 일괄 갱신 계획을 plan 에 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Rationale Continuity | `order.md` planned 행 5건에 `paginated: ✓` 미검증 기재 — `planned` paginated 는 테스트 미검증 사각 | `spec/conventions/cafe24-api-catalog/order.md` | `_overview.md` §2 에 "planned 행 paginated 는 잠정값 — 구현 시점 재검증 필수" 메모 추가 |
| I-2 | Naming Collision | `notification` — Cafe24 resource vs 우리 서비스 `Notification` DB 엔티티 — 문맥으로 구분되나 신규 개발자 혼선 가능 | `spec/conventions/cafe24-api-catalog/notification.md` | `notification.md` 상단에 `application.md` 와 동일 패턴의 주의 노트 추가 |
| I-3 | Naming Collision | `personal` — Cafe24 resource vs `Integration.scope=personal` — 코드/spec 문맥으로 충분히 구분 | `spec/conventions/cafe24-api-catalog/personal.md` | 저위험. 선제적 명확화 원하면 상단 구분 노트 추가 |
| I-4 | Convention Compliance | `store.md` `## Rationale` 내부의 `> ※` blockquote 주석이 C-2 구조 문제와 맞물려 Rationale/표 주석 판단 불분명 | `spec/conventions/cafe24-api-catalog/store.md` 12~13행 | C-2 해소 시 함께 재배치 |
| I-5 | Plan Coherence | `cafe24-bg-refresh-tuning.md` §후속 의 spec 갱신 위임 항목 장기 미처리 — `spec/2-navigation/4-integration.md` 코드 불일치 방치 위험 | `plan/in-progress/cafe24-bg-refresh-tuning.md` §후속 | target plan 착수와 직접 무관. project-planner 위임 항목 조속 처리 권장 |
| I-6 | Plan Coherence | `cafe24-test-spec-guard-cleanup-followups.md §W-8` 의 `translation/` vs `translations/` 경로 불일치 spec 결정 선행 조건 미완 | `plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md §W-8` | target plan 진행과 병행 또는 완료 후 별도 처리 명시 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `privacy_*` 혼동(W), `_overview.md` §4 규칙 8 `planned` 예외 미명시(W), Coverage Matrix 불일치(W) |
| Rationale Continuity | LOW | 기각 대안 재도입 없음. 합의 원칙 전부 준수. Rationale 섹션 구조 미흡(INFO 3건) |
| Convention Compliance | MEDIUM | 구 토큰 `op` 잔존(CRITICAL), `store.md` Rationale 섹션 순서 역전(CRITICAL), operation id 규약 이탈(WARNING) |
| Plan Coherence | MEDIUM | `privacy_*` id rename 미결 결정 우회(CRITICAL), store.md 경합 위험(WARNING), restricted scope 미확인(WARNING) |
| Naming Collision | MEDIUM | `boards_setting_*` vs `boards_settings_*` 유사 ID(WARNING), `orders_status_*` vs `order_status_*` 유사 ID(WARNING) |

---

## 권장 조치사항

1. **[BLOCK 해소 — C-1]** `spec/conventions/cafe24-restricted-scopes.md` 32행의 `restricted: op` → `restricted: operation` 으로 단순 1줄 수정.

2. **[BLOCK 해소 — C-2]** `spec/conventions/cafe24-api-catalog/store.md` 에서 `## Rationale` 블록 전체(Rationale 본문 + `> ※ paymentmethods...` 주석)를 `## 표` 섹션 뒤로 이동. I-4 도 함께 해소됨.

3. **[BLOCK 해소 — C-3]** Batch 1-G 진입 전 `plan/in-progress/cafe24-restricted-scopes-followups.md §3` 의 `[ ] prefix 결정` 체크박스를 project-planner 와 합의하여 닫고, `store.md` 의 privacy_* 6 row id 를 결정된 prefix 로 갱신. 이후 Batch 1-G 에서 supported 승격 진행. W-2(restricted scope 분류 확인) 와 W-3(worktree 경합) 도 이 과정에서 함께 해소.

4. **[WARNING 해소 — W-1]** `_overview.md` §4 검증 규칙 8 에 "`planned` 행은 backend 메타데이터 row 가 없으므로 본 검증 대상에서 제외" 문구 추가.

5. **[WARNING 해소 — W-6]** `_overview.md` §2 와 `cafe24-api-metadata.md` §6 step 3 에 "Cafe24 endpoint path prefix 를 id 접두로 허용" 문구 추가. W-7, W-8 의 유사 ID 는 구현 시점에 구체적 명칭으로 재명명.

6. **[권장 — W-4/W-5]** 14개 resource 파일에 최소 한 줄 Rationale 위임 문장 추가. `_overview.md` 끝에 `## Rationale` 섹션 신설.

7. **[권장 — W-9]** `_overview.md` §5 Coverage Matrix 의 store `50+` → `98`, order `30+` → `89` 로 갱신하거나 Phase 4 일괄 갱신을 plan 에 명시.
