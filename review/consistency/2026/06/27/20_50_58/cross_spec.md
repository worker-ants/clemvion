# Cross-Spec 일관성 검토 결과

**대상**: `spec/conventions/cafe24-api-catalog` (모드: `--impl-done`, diff-base: `origin/main`)
**변경 요약**: docs 에 없는 9개 seed 연산(`customer_get/update`, `coupon_get/delete`, `applications_list`, `webhooks_list`, `mains_update/delete`, `socials_apple_settings_get`)을 metadata · catalog index · i18n dict · test fixture 전범위에서 제거.

---

## 발견사항

### [INFO] "~180 endpoint" 근사치 — 실제 지원 수(485)와의 괴리 (pre-existing)

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §5` coverage matrix → 485 (정확 수치)
- 충돌 대상:
  - `spec/4-nodes/4-integration/4-cafe24.md` §Overview: "카테고리당 평균 ~10 operation = 총 ~180 endpoint"
  - `spec/4-nodes/4-integration/4-cafe24.md` §Rationale: "endpoint 당 도메인 노드 (~180개)"
  - `spec/4-nodes/3-ai/0-common.md` line 65: "Cafe24 의 경우 도구 수가 많아(~180)"
  - `spec/2-navigation/4-integration.md` line 1106: "Resource × Operation = ~180"
- 상세: 이들 4곳의 "~180"은 18 resource × ~10 op 의 개략 산출로 실제 지원 수 485(이번 변경 전 494)와 3배 가까이 차이난다. 이번 PR이 494→485로 줄였으나 이미 기존에도 잘못된 근사치였다.
- 제안: `_overview.md §5` 주석("endpoint 합계는 ~500")과 통일해 4 파일의 "~180"을 "~500" 또는 "485+" 로 일괄 동기. 이번 변경에서 도입된 문제는 아니므로 별 트랙(spec 수정 PR)에서 처리 가능.

### [INFO] `plan/in-progress/cafe24-backlog-residual.md §G-2` — 의사결정 이력 불일치 (plan 내부)

- target 위치: `plan/in-progress/cafe24-backlog-residual.md §G-2` (결정: "현행 유지" 2026-06-02)
- 충돌 대상: 동일 파일 §G-3l (결정: "전부 제거" 2026-06-27) — spec 파일 아님
- 상세: §G-2 본문과 체크박스는 "현행 유지"(미제거) 결정이 유효한 것처럼 보이는 상태로 남아 있고, §G-3l이 새 결정(제거)을 포함해 [x] 완료 처리되어 있다. §G-2 자체에 "→ G-3l 에서 해소됨" 같은 명시가 없어 차후 독자가 G-2 를 읽으면 의사결정 맥락을 놓칠 수 있다. spec 파일이 아니라 plan 파일 내부 이력 추적의 문제이므로 spec 간 충돌은 아님.
- 제안: §G-2 bullet 목록 위에 "→ G-3l (2026-06-27) 에서 제거 결정으로 해소" 한 줄 추가.

### [INFO] `plan/in-progress/cafe24-backlog-residual.md §G-1-remaining` — stale store 카운트

- target 위치: `plan/in-progress/cafe24-backlog-residual.md §G-1-remaining` line 45: "store 106 endpoint docs field 비교 audit 미수행"
- 충돌 대상: `spec/conventions/cafe24-api-catalog/store.md` → 이번 변경으로 `socials_apple_settings_get` 제거 후 105 op
- 상세: plan 파일의 과거 수치가 스테일 상태다. spec 문서 자체의 충돌은 아님.
- 제안: §G-1-remaining 의 "store 106" → "store 105" 로 갱신.

---

## 일관성 확인 사항 (이상 없음)

| 검토 항목 | 결과 |
|---|---|
| `_overview.md §5` coverage matrix (494→485) | ✓ 5개 resource 변경 합계(-9) 정확 |
| `application/category/customer/promotion/store.md` row 제거 | ✓ 각 resource count 와 일치 |
| `spec/4-nodes/4-integration/4-cafe24.md` §8.1 예시 (`customer_update`→`customer_delete`) | ✓ customer 에서 제거된 op 반영 |
| `spec/conventions/cafe24-api-metadata.md` §7.5 예시 동기 | ✓ 동일 방향 갱신 |
| `catalog-docs-drift.spec.ts` `KNOWN_DOCS_ABSENT` 빈 set (size=0) | ✓ 9→0 정합 |
| `frontend/i18n/dict/{ko,en}/cafe24Catalog.ts` 9개 catalog key 제거 | ✓ spec catalog 과 parity |
| `cafe24-restricted-scopes.md` 충돌 | 없음 — 제거된 ops 중 restricted 대상 없음 |
| `spec-impl-evidence.md §1` 제외 규칙 (field-level 파일) | 없음 — field-level 파일은 적용 대상 제외 |
| 다른 spec 영역(`2-navigation`, `5-system`)의 제거 op ID 직접 참조 | 없음 |

---

## 요약

이번 변경(`spec/conventions/cafe24-api-catalog` + 동반 spec 파일)은 docs 에 없는 9개 seed 연산을 catalog index · backend metadata · i18n dict · 테스트 fixture 전범위에서 일관되게 제거했다. 영향받는 모든 spec 파일(`4-cafe24.md`, `cafe24-api-metadata.md`, `_overview.md`)의 예시·카운트가 동기되어 있고, `cafe24-restricted-scopes.md` / `spec-impl-evidence.md` 의 규칙과도 충돌이 없다. 발견된 이슈 3건은 모두 INFO 등급으로, (1) 기존부터 존재하는 "~180" 근사치 4곳의 동기 권장, (2) plan 파일 내부 §G-2 의사결정 이력 명시 보완, (3) plan 파일 §G-1-remaining의 stale 수치 갱신이다. 이 중 어느 것도 spec 간 직접 모순을 일으키지 않는다.

## 위험도

LOW
