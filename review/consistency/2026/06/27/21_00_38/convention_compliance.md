# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/` (--impl-done, diff-base=origin/main)
검토 일시: 2026-06-27

---

## 발견사항

### 발견사항 1
- **[WARNING]** `application.md` 의 operation id 명명 — 카탈로그 내 resource 명 적용 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` — `## 표` 전체 (ids: `applications_list`, `apps_update`, `webhooks_list`, `webhooks_update`, `webhooks_logs_list`)
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §2` — id 컬럼 설명: "`<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique"
  - 상세: `_overview.md §2` 예시(`product_list`)는 catalog resource 이름 단수형을 id 의 resource 파트로 사용한다. `category.md` 는 이 패턴을 일관되게 따른다 (`category_list`, `category_get`, `category_create` 등 — catalog resource 이름 `category` 를 prefix 로 사용). 그러나 `application.md` 는 Cafe24 API path segment 이름을 그대로 사용한다:
    - `applications_list` (catalog 이름 `application` → API path `applications`)
    - `apps_update` (API path `apps`)
    - `webhooks_list`, `webhooks_update`, `webhooks_logs_list` (API path `webhooks`)
  - 같은 catalog 시스템 내 두 파일이 다른 규칙으로 id 를 구성하면, 신규 resource 추가 시 어느 쪽을 따라야 하는지 ambiguity 가 생긴다. backend 메타데이터 SoT 에 이미 반영돼 있어 수정 범위가 크므로, 규약을 갱신하거나 `_overview.md §2` 예시에 "API path 명 사용도 허용" 을 명시해 기존 패턴을 정식화하는 것이 현실적이다.
  - 제안: `_overview.md §2` id 컬럼 설명에 "Cafe24 API path segment 이름을 resource 파트로 사용할 수 있다" 주를 추가하거나, `application.md` 에 기존 id 가 path-literal 명명 이유를 footnote 로 달아 의도를 명시화한다.

### 발견사항 2
- **[INFO]** `_overview.md §4` 동기 규칙 번호 — spec 문서와 테스트 헤더 주석 간 1-off 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §4`, 규칙 8 설명 괄호 주석
  - 위반 규약: CLAUDE.md 단일 진실 원칙 (spec 이 SoT)
  - 상세: `_overview.md §4` 는 planned ↔ planned.ts mirror 양방향 동기를 "규칙8" 로 번호를 매기나, 파일 자체에 "(테스트 헤더 주석은 이를 '규칙7' 로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의.)" 라고 적혀 있다. 이 1-off 는 자기 인식적으로 문서화돼 있으나, 유지보수 시 테스트 파일을 읽는 개발자가 매번 수동으로 +1 변환을 해야 한다. SoT 인 spec 이 자신의 번호와 구현 번호 사이의 divergence 를 내재화하는 것은 장기 drift 위험이 있다.
  - 제안: `catalog-sync.spec.ts` 의 테스트 헤더 주석을 spec 번호(1-9)로 맞춰 수정하거나, spec `§4` 서두에 "본 spec 번호는 SoT; 테스트 주석과 1-off" 경고를 추가해 의도를 한 곳에만 두는 것이 낫다. (현재는 규칙 8 설명 내부에만 있음)

### 발견사항 3
- **[INFO]** `appstore-orders.md` H3 제목 "Retreive" (Cafe24 docs 오타 충실 미러) vs `application.md` 인덱스의 "Retrieve" (정정 표기) 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `### \`GET /api/v2/admin/appstore/orders/{order_id}\`` 헤더 (line ~471), 그리고 `spec/conventions/cafe24-api-catalog/application.md` 인덱스 표 row `appstore_orders_get` `English title` 컬럼
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §2` — `English title`: "Cafe24 공식 docs 의 영문 제목"; `§7.3` — "출처는 Cafe24 공식 Admin API Documentation 의 결정적(deterministic) 파싱이다"
  - 상세: Cafe24 공식 docs 의 anchor 는 `#retreive-a-cafe24-store-order` (오타 "Retreive"). `_overview.md §7.3` 에 따라 field-level 파일 헤더는 원문 그대로 "Retreive a Cafe24 Store order" 를 사용한다. 그러나 인덱스 파일 `application.md` 의 `English title` 컬럼에는 정정된 "Retrieve a Cafe24 store order" 가 들어 있고, 대문자 'S' 도 다르다("Store" vs "store"). `§2` 는 `English title` 을 "Cafe24 공식 docs 의 영문 제목" 으로 정의하므로, 인덱스 표도 공식 docs 기준인 "Retreive a Cafe24 Store order" 를 사용해야 일관성이 맞다.
  - 제안: `application.md` 인덱스 표 `appstore_orders_get` 행의 `English title` 을 Cafe24 공식 docs 원문(오타 포함 + 대문자 일치) 으로 맞춘다. 또는 `_overview.md §2` 에 "인덱스 `English title` 은 가독성을 위해 교정 표기 허용" 예외를 명시한다.

### 발견사항 4
- **[INFO]** `application.md`·`category.md` 에 `## Overview` 및 `## Rationale` 섹션 없음
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` 전체, `spec/conventions/cafe24-api-catalog/category.md` 전체
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
  - 상세: 두 파일은 `id`/`status` frontmatter 를 보유한 정식 spec(`spec/conventions/**.md`)이지만, 섹션 구성이 `## 표` + `## Field-level 상세 카탈로그` 만으로 이뤄져 있고 Overview 와 Rationale 이 없다. `audit-actions.md` 는 동일한 conventions 폴더 내 파일로서 3섹션을 완전히 갖추고 있다.
  - 단, `_overview.md` 가 catalog resource index 파일 형식을 "표 + field-level 목록" 으로 명시적으로 정의하고 있어, 이 형식 자체는 하위 규약으로 정당화된다. 그럼에도 frontmatter 가 있는 정식 spec 으로서의 역할과 표만 있는 레퍼런스 형식 사이의 긴장이 남아 있다.
  - 제안: `_overview.md §1` 또는 §7 에 "resource index 파일(`<resource>.md`)은 `## 표` + `## Field-level 상세 카탈로그` 형식만 포함하며 Overview/Rationale 섹션은 `_overview.md` 에 위임한다" 와 같은 형식 면제 사유를 명시해 이 긴장을 해소한다.

---

## 요약

검토된 `spec/conventions/` 문서들은 대체로 정식 규약을 준수하고 있다. `audit-actions.md` 는 frontmatter, 3섹션 구성(Overview/본문/Rationale), id 명명까지 완전히 준수한다. 필드 레벨 카탈로그 파일들(`application/*.md`, `category/*.md`)은 `spec-impl-evidence.md §1` 의 frontmatter 의무 면제 대상으로 올바르게 처리됐다. 다만 `application.md` 에서 operation id 가 Cafe24 API path 이름 그대로(복수형, 다중 경로 prefix)를 사용하는 반면 `category.md` 는 catalog resource 이름 단수형을 일관되게 사용한다는 점에서 동일 catalog 시스템 내 명명 규약 적용 불일치가 관찰된다(WARNING). 이는 backend 메타데이터에 이미 반영돼 있으므로 규약 문서(`_overview.md §2`)를 현실에 맞춰 갱신해 명시적으로 정식화하는 것이 바람직하다. 나머지 발견사항(규칙 번호 1-off 자기 인식, 인덱스 vs 필드 파일 제목 오타 불일치, 카탈로그 인덱스 파일의 3섹션 면제 근거 미명시)은 모두 INFO 수준이다.

---

## 위험도

LOW
