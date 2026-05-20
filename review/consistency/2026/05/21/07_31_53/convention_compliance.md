# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 범위: `spec/conventions/cafe24-api-catalog` (모든 파일)
참조 규약: `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/cafe24-restricted-scopes.md`, `CLAUDE.md`

---

## 발견사항

### [CRITICAL] cafe24-restricted-scopes.md §2 본문에 구 토큰 `op` 잔존

- **target 위치**: `spec/conventions/cafe24-restricted-scopes.md` 32행 — §2 첫 문단
  ```
  카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
  ```
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 — `restricted` 컬럼 허용 값은 `scope` / `operation` / 빈칸. `spec/conventions/cafe24-api-metadata.md` 2026-05-17 drift-fix CHANGELOG — "`op` → `operation` 으로 통일"
- **상세**: 같은 §2 의 나중 문단(표 하단 note)에서는 `restricted: operation` 으로 올바르게 표기하여, 같은 섹션 안에 두 토큰이 혼재한다. catalog-sync.spec.ts 는 실제 catalog MD 파일을 파싱하여 `restricted` 컬럼 값을 검증하는데, 이 spec 문서를 참조하는 구현자가 `op` 를 유효 토큰으로 오해할 경우 catalog-sync 테스트 fail 또는 메타데이터 `restrictedApproval.level` 과의 불일치가 발생한다. `cafe24-restricted-scopes.md` 가 명단의 SoT 이므로 본 문서의 잘못된 기술은 invariant 를 직접 오염시킨다.
- **제안**: 32행의 `restricted: op` → `restricted: operation` 으로 수정.

---

### [CRITICAL] store.md — `## Rationale` 이 `## 표` 앞에 위치 (섹션 순서 역전)

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` 9행 (`## Rationale`), 15행 (`## 표`)
- **위반 규약**: `CLAUDE.md` — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`". spec 3섹션 구성 권장: Overview / 본문 / Rationale 순
- **상세**: Rationale 이 본문(`## 표`) 보다 앞에 배치되어 있다. 문서를 읽는 구현자가 표를 찾기 전에 Rationale 을 만나 혼란을 줄 수 있으며, 파싱 스크립트나 문서 생성 도구가 섹션 순서에 의존할 경우 오작동 가능성이 있다. 다른 제한 scope 파일(mileage.md, notification.md, privacy.md)은 `## 표` 뒤에 `## Rationale` 을 올바르게 배치하고 있어 일관성도 깨진다.
- **제안**: store.md 의 `## Rationale` 블록(`## Rationale` + 본문 + `> ※ paymentmethods...` 주석)을 `## 표` 섹션 전체 뒤로 이동.

---

### [WARNING] cafe24-api-catalog 다수 파일 — operation id 가 `<resource>_<verb>` 규약을 따르지 않음

- **target 위치**: 아래 나열한 파일의 표 id 컬럼
  - `application.md`: `applications_list`, `scripttags_list`, `webhooks_list`, `apps_update`, `appstore_orders_get` 등 — resource 이름 `application` 으로 시작하는 id 없음
  - `category.md`: `mains_add`, `mains_update`, `mains_delete`, `mains_list`, `autodisplay_create` 등
  - `collection.md`: `brands_*`, `manufacturers_*`, `trends_*`, `classifications_*`, `origin_list` — 모두 resource `collection` 접두 없음
  - `community.md`: `boards_*`, `commenttemplates_*`, `financials_monthlyreviews_count`, `urgentinquiry_*`
  - `customer.md`: `customergroups_*`, `customers_properties_*`, `social_list`
  - `product.md`: `bundleproducts_*`, `categories_products_*`, `mains_products_*`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 — id 는 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` 형식. `spec/conventions/cafe24-api-metadata.md` §6 step 3 — "id 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`)"
- **상세**: 규약 예시(`product_list`, `product_options_create`)는 id 가 catalog resource 이름으로 시작함을 명시하지만, 실제 catalog 파일 다수는 Cafe24 API 의 실제 endpoint path prefix(예: `brands`, `commenttemplates`, `urgentinquiry`)를 id 접두로 그대로 사용한다. 이는 catalog-sync 테스트의 unique 검증에는 문제없지만, 구현자가 spec 의 id 규약을 보고 resource 이름 접두를 기대할 때 혼란을 야기한다. `application` resource 의 경우 단 하나의 id 도 `application_` 로 시작하지 않는다.
- **제안**: 두 선택지 중 하나를 명확히 결정하여 규약 또는 카탈로그를 정렬한다.
  - (A) **규약 갱신**: `_overview.md` §2 와 `cafe24-api-metadata.md` §6 step 3 에 "id 는 실제 Cafe24 endpoint path prefix 를 사용할 수 있다 (예: `brands_list`, `commenttemplates_get`)" 문구를 추가하여 현재 실제 패턴을 규약으로 수용.
  - (B) **카탈로그 정정**: 모든 id 를 `<resource>_<sub>_<verb>` 형식으로 갱신 (예: `application_scripttags_list`, `category_mains_list`). 단 이 경우 backend 메타데이터와 catalog-sync 테스트도 동시 갱신 필요.
  - 구현 착수 전이므로 (A)가 현실적이다 — catalog 과 메타데이터가 이미 이 패턴으로 수십 개 built-up 됐기 때문.

---

### [WARNING] 대부분의 catalog resource 파일에 `## Rationale` 섹션 없음

- **target 위치**: `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md`, `promotion.md`, `salesreport.md`, `shipping.md`, `supply.md`, `translation.md` — 14개 파일
- **위반 규약**: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고". 정식 규약의 단일 진실 원칙상 설계 근거는 문서 끝 `## Rationale` 에 기록
- **상세**: 제한 scope 파일 4개(mileage, notification, privacy, store)는 Rationale 이 있으나, 나머지 14개는 없다. Rationale 이 없는 경우 "왜 이 컬럼 구조인가", "왜 이 id 패턴을 선택했는가" 등의 설계 근거를 추적하기 어렵다. 다만 이들 파일은 `_overview.md` 를 Rationale 위임처로 쓰고 있으므로 완전한 규약 위반은 아니나, 3섹션 권장을 명시적으로 충족하지 않는다.
- **제안**: 최소한 "설계 근거는 [`_overview.md`](./_overview.md) §2·§4·§7 참조" 한 줄짜리 `## Rationale` 을 각 파일에 추가하거나, `_overview.md` 에 "개별 resource 파일은 Rationale 위임 가능" 문구를 추가하여 이 패턴을 공식화한다.

---

### [WARNING] `_overview.md` 에 `## Rationale` 섹션 없음

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` — 전체 문서
- **위반 규약**: `CLAUDE.md` — 정식 규약 문서 3섹션 권장 (Overview / 본문 / Rationale)
- **상세**: `_overview.md` 는 이 카탈로그 전체의 SoT 이며 컬럼 정의·status enum·동기 정책·등재 절차를 모두 담고 있다. 이 설계 결정들(18개 resource 분리,양방향 동기 테스트, planned/supported/deprecated status enum 선택 등)의 배경이 CHANGELOG 에 날짜별로 흩어져 있을 뿐, 통합 Rationale 섹션이 없다. 참고로 `cafe24-api-metadata.md` 는 Rationale 섹션이 있다.
- **제안**: `_overview.md` 끝에 `## Rationale` 섹션을 추가하여 카탈로그 도입의 핵심 설계 근거(단일 진실 목적, 양방향 동기 테스트 선택, status enum 3값 설계 등)를 기술한다.

---

### [INFO] store.md 의 `## Rationale` 본문에 `>` blockquote 주석이 Rationale 본문과 혼재

- **target 위치**: `spec/conventions/cafe24-api-catalog/store.md` 12~13행
  ```
  설계 근거 … 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. …
  >
  > ※ `paymentmethods_list` / … 는 사용자 자료에 명시되지 않아 빈칸 유지. …
  ```
- **위반 규약**: 명시적 금지 항목 없음. 포맷 일관성 관점
- **상세**: `> ※` blockquote 는 Rationale 섹션 안에 있으나 `## 표` 앞에 위치하는 구조적 문제(위 CRITICAL C-2)와 맞물려 이 주석이 Rationale 의 일부인지, 표에 대한 주석인지 판단하기 어렵다. `mains_products_*` 등 다른 카탈로그 파일에서는 이러한 인라인 메모 패턴을 쓰지 않는다.
- **제안**: 섹션 순서 수정(C-2) 후, 이 주석은 `## 표` 섹션 바로 위 (또는 표 아래 별도 `> **주의**` 블록으로) 이동하거나 Rationale 마지막에 명확히 재배치한다.

---

## 요약

`spec/conventions/cafe24-api-catalog` 전체의 규약 준수 수준은 **중간**이다. 가장 심각한 문제는 두 가지다. 첫째, `cafe24-restricted-scopes.md` §2 본문에 drift-fix 로 폐기된 구 토큰 `op` 가 잔존하여, 해당 문서를 단독으로 읽는 구현자가 잘못된 컬럼 값을 사용할 가능성이 있다(CRITICAL). 둘째, `store.md` 의 Rationale 섹션이 주요 본문(`## 표`) 앞에 위치하여 CLAUDE.md 의 "문서 끝 Rationale" 규약을 어기고 있다(CRITICAL). 반면 컬럼 정의, status enum, `restricted` 컬럼 실제 값, coverage matrix 수치는 규약과 일치한다. operation id 명명 규약의 실제 적용 패턴이 규약 텍스트와 상당히 다르다는 점(WARNING)은 규약 문서 자체를 갱신하여 현실을 수용하는 방향이 실용적이다.

---

## 위험도

**MEDIUM**

두 CRITICAL 항목 모두 이미 구현된 코드나 catalog row 값 자체에는 영향이 없고(실제 store.md catalog 표의 `restricted` 컬럼 값은 `operation` 으로 올바름), spec 문서의 서술 오류다. 그러나 구현 착수(`--impl-prep`) 시점에 새 endpoint 추가 작업자가 `cafe24-restricted-scopes.md §2` 의 `restricted: op` 를 참조하여 catalog MD 를 작성하면 catalog-sync.spec.ts 가 fail 하므로 즉각적 블로커가 될 수 있다.
