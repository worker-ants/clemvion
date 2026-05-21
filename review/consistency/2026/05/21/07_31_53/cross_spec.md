# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상: `spec/conventions/cafe24-api-catalog` (전 디렉토리)
검토 일시: 2026-05-21

---

## 발견사항

### [WARNING] store resource 의 `privacy_*` operation 이 `cafe24-restricted-scopes.md §1` 의 `mall.read_privacy` scope 와 혼동될 위험

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` — `privacy_boards_get/update`, `privacy_join_get/update`, `privacy_orders_get/update` 6개 행 (모두 `planned`, scope = `?`)
- **충돌 대상**: `spec/conventions/cafe24-restricted-scopes.md §1` — `mall.read_privacy` / `mall.write_privacy` 를 별도 승인 필요 scope 로 명시. `spec/conventions/cafe24-api-catalog/privacy.md` — 별도 resource 로 `privacy` catalog 파일 존재
- **상세**: `store.md` 의 `privacy_boards_*` / `privacy_join_*` / `privacy_orders_*` 는 상점의 개인정보 정책 설정 API 이며 `mall.read_store` / `mall.write_store` scope 를 사용한다. 반면 `cafe24-restricted-scopes.md §1` 의 `mall.read_privacy` / `mall.write_privacy` 는 별도 resource `privacy.md` (회원 개인정보 CRUD) 의 scope 다. 두 개념이 이름("privacy")을 공유하면서 구현 시점에 `store.md` 의 해당 6개 row 를 구현하는 개발자가 `restricted: scope` 로 잘못 분류할 위험이 있다. 특히 plan 파일 (`plan/in-progress/cafe24-planned-implementation.md`) 의 Batch 1-G 항목에 "privacy = scope (cafe24-restricted-scopes.md 확인)" 이라는 메모가 있어 혼동이 이미 기록된 상태다.
- **제안**: 구현 착수 전에 `store.md` 의 해당 6개 `privacy_*` row 에 주석 또는 별도 컬럼 값으로 "scope = `mall.read/write_store`, NOT `mall.read/write_privacy` — 별도 승인 불필요" 를 명시한다. `plan/in-progress/cafe24-planned-implementation.md` Batch 1-G 의 메모도 "store 내 privacy 정책 설정 API — `mall.read_store` / `mall.write_store` scope 사용, `restricted` 컬럼 빈칸" 으로 정정한다. `store.md` 문서 상단의 별도 승인 안내에도 `privacy_*` 그룹이 제외 대상임을 명시하면 drift 방지에 효과적이다.

---

### [WARNING] `_overview.md` §5 Coverage Matrix 의 `store` planned 카운트(50+)가 실제 `store.md` 행 수(98)와 불일치

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §5 Coverage Matrix — store 행: `Planned = 50+`
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/store.md` — planned 행을 직접 세면 98개. `plan/in-progress/cafe24-planned-implementation.md` — "store 98 planned" 로 명시
- **상세**: `_overview.md` §5 Coverage Matrix 의 store planned 수는 `50+` (initial estimate) 로 남아 있으나, `store.md` 의 현재 상태는 98개 planned 행이다 (plan 파일이 정확한 카운트를 별도로 추적하고 있음). CHANGELOG §7 의 Phase 6b entry 는 store supported 8로 갱신되었으나, planned 수는 갱신되지 않았다. 이는 `_overview.md` §5 의 matrix 와 실제 catalog 파일 간의 불일치다.
- **제안**: Phase 1 전체 구현이 완료되면 store planned → 0 으로 갱신되므로 Phase 1 완료 시 matrix 를 일괄 갱신하는 것이 plan 상 Phase 4 의 의도와 일치한다. 단, 현재 상태에서도 `50+` 는 outdated 이므로 Plan 착수 전에 `98` 로 정정하거나, 이미 outdated 임을 아는 경우 Phase 4 일괄 갱신을 명시적으로 계획에 기술하면 혼란을 줄일 수 있다.

---

### [WARNING] `cafe24-restricted-scopes.md §2` 의 `paymentgateway_paymentmethods_create/update/delete` 가 `store.md` 에서 `planned` 상태인데 restricted 컬럼이 `operation` 으로 이미 표기됨

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` — `paymentgateway_paymentmethods_create` / `paymentgateway_paymentmethods_update` / `paymentgateway_paymentmethods_delete` 3개 행: `status=planned`, `restricted=operation`
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/_overview.md` §4 동기 정책 검증 규칙 8 — "`planned` 행은 backend 메타데이터 row 가 없는 것이 정상"이며, `catalog-sync.spec.ts` 의 검증 규칙 8은 `supported` row 의 `restricted` 컬럼과 backend 메타데이터 `restrictedApproval` 의 동기를 검증한다
- **상세**: `_overview.md` §4 검증 규칙 8 은 "`restricted` 컬럼이 `scope` 또는 `operation` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고, 그 역도 동일" 이라고 명시한다. 그런데 `paymentgateway_paymentmethods_create/update/delete` 는 `status=planned` (backend 메타데이터 row 없음이 정상) 이면서 동시에 `restricted=operation` 으로 표기되어 있다. `catalog-sync.spec.ts` 가 `planned` 행에 대해 이 검증을 수행하는지 여부가 spec 에서 명확하지 않다. 만약 테스트가 `planned` 행에도 규칙 8 을 적용하면 메타데이터 row 없이 `restricted=operation` 인 행이 fail 을 유발할 수 있다.
- **제안**: `_overview.md` §4 검증 규칙 8 에 "`planned` 행은 backend 메타데이터 row 가 없으므로 본 검증 대상에서 제외" 임을 명시적으로 기술한다. 현재는 `level='program'` 만 예외로 명시되어 있고 `planned` status 에 대한 예외 기술이 없다. 이 ambiguity 는 `catalog-sync.spec.ts` 구현 시 버그로 이어질 수 있다.

---

### [INFO] `store.md` 에 `Rationale` 섹션이 `## 표` 이전에 배치됨 (컨벤션 비일관성)

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` — 파일 구조: `> **일부 operation...` 안내 블록 → `## Rationale` → `## 표` 순서
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/mileage.md`, `notification.md`, `privacy.md` — 모두 `## 표` 이후에 `## Rationale` 배치. `spec/0-overview.md` §8 문서 컨벤션 — "본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: 모든 다른 restricted resource 카탈로그 파일 (`mileage.md`, `notification.md`, `privacy.md`) 은 `## 표` → `## Rationale` 순으로 구성된다. `store.md` 만 Rationale 이 표 앞에 위치한다. 이는 사람이 읽을 때 혼란을 줄 수 있고, 향후 MD 파서가 섹션 순서를 가정한다면 문제가 될 수 있다.
- **제안**: `store.md` 의 `## Rationale` 섹션을 `## 표` 이후로 이동시켜 다른 resource catalog 파일과 일관된 구조를 유지한다.

---

### [INFO] `_overview.md` §5 Coverage Matrix 의 `order` Planned 수 불일치

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §5 — order planned = `30+`
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/order.md` — 실제 planned 행 수는 89개. `plan/in-progress/cafe24-planned-implementation.md` — "order 89 planned" 명시
- **상세**: store 와 마찬가지로 `_overview.md` §5 의 order planned 는 `30+` (초기 추정치) 이며, 현재 실제 89개와 크게 차이난다. CHANGELOG §7 의 Phase 6a entry 는 order supported 17로 갱신되어 있으나 planned 수는 `30+` 그대로다.
- **제안**: store 와 동일하게 Phase 4 일괄 갱신 계획에 포함되어 있으므로 구현 완료 후 자동으로 해결된다. 단, 현재 matrix 가 크게 outdated (30+ vs 89) 임을 plan 에 기록해두면 혼란이 줄어든다.

---

### [INFO] `store.md` 의 `store_get` · `shops_list` 행에 `restricted` 컬럼이 없음 (헤더 컬럼 수와 불일치)

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` 표 헤더: `| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |` (10컬럼). `store_get` / `shops_list` 행: `restricted` 컬럼 값이 빈칸 — 이는 정상이나, 현재 표 구조상 빈칸이 맞게 렌더되는지 확인 필요
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 컬럼 정의 — restricted 컬럼은 "빈칸 = 일반 사용 가능" 이 정상
- **상세**: 실제 충돌은 아니나, `store_get` / `shops_list` / `paymentmethods_list` / `paymentmethods_paymentproviders_list` 등의 supported 행이 restricted 컬럼이 있는 10컬럼 헤더 아래에서 빈칸으로 올바르게 표현되고 있는지 MD 파서 관점에서 점검이 필요하다. `catalog-sync.spec.ts` 의 MD 파서가 컬럼 수 불일치로 파싱 오류를 일으키면 즉시 fail 이 발생하므로 실제 위험보다는 낮은 INFO 수준이다.
- **제안**: `catalog-sync.spec.ts` 를 구현할 때 MD 표 파서가 10컬럼 헤더 + 9컬럼 데이터 행(restricted 빈칸 생략)을 올바르게 처리하는지 단위 테스트로 확인한다.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/conventions/cafe24-api-catalog` 는 전반적으로 `cafe24-api-metadata.md` · `cafe24-restricted-scopes.md` · `spec/1-data-model.md` 와 직접적인 모순(CRITICAL)이 없다. 가장 실질적인 위험은 두 가지다: (1) `store.md` 의 `privacy_*` store policy 행이 `privacy.md` 의 restricted scope 와 이름 충돌로 구현자가 `restricted=operation` 또는 `restricted=scope` 를 잘못 부여할 가능성이 있으며 이미 plan 파일에서 혼동 표지가 발견된다. (2) `_overview.md` §4 검증 규칙 8 이 `planned` 행에도 `restricted` 컬럼 ↔ 메타데이터 양방향 동기를 요구하는지 명시하지 않아 `catalog-sync.spec.ts` 구현 시 `paymentgateway_paymentmethods_create/update/delete` 처럼 `planned + restricted=operation` 조합의 행이 ambiguous 하게 처리될 수 있다. 두 WARNING 을 해소한 뒤 구현에 착수하는 것이 권장된다.

---

## 위험도

**MEDIUM**

STATUS: OK
