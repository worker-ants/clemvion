# 정식 규약 준수 검토 — spec/conventions/ (--impl-prep)

## 검토 범위 참고
`_prompts/convention_compliance.md` 는 `spec/conventions/` 전체 파일 목록 중 아래 파일들만 **본문 전체**를 제공하고
(나머지는 경로만 나열된 manifest), 나머지 ~470개 cafe24 field-level 문서는 제목/구조 유추만 가능했다:
`audit-actions.md`, `cafe24-api-catalog/_overview.md`, `cafe24-api-catalog/application.md`(+ 하위 8개 entity 문서),
`cafe24-api-catalog/category.md`(+ `category/autodisplay.md`, `category/categories.md`).
본 검토는 실제 리포지토리(`node-cancel-signal-b4d1` worktree)의 `spec/conventions/` 를 직접 열어 교차검증했으며,
`product.md`/`order.md`/`customer.md`/`store.md`/`privacy.md` 등 manifest-only 파일도 명명 패턴 비교를 위해 추가로 열람했다.

## 발견사항

### [WARNING] 카탈로그 `id` 컬럼 명명 규칙이 리소스 파일마다 다르게 적용됨
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 `표 컬럼 정의` — `id` 행 (`<resource>_<verb>` 또는 `<resource>_<sub>_<verb>`, 예시 `product_list`/`product_options_create`)
- 위반 규약: 동일 문서 §2 자체가 선언한 id 명명 규칙 (다른 `spec/conventions/*` 파일이 아니라 검토 대상 문서 스스로의 규칙과 실제 카탈로그 표기 사이 불일치)
- 상세: 규칙 문언은 "resource" 자리에 **카탈로그 최상위 리소스명**(파일명, 예 `product`)이 항상 들어가는 것으로 읽힌다. 실제로 `product.md`/`order.md`/`customer.md` 는 sub-resource 가 있어도 전 항목이 최상위 리소스명으로 시작한다 (`product_variants_list`, `product_options_create`, `order_buyer_get`, `customer_memos_list` …). 그러나 `application.md`/`category.md`/`store.md` 는 **최상위 리소스명을 생략**하고 sub-resource 이름만으로 시작한다 — `scripttags_list`/`apps_update`/`appstore_orders_get`/`databridge_logs_list`(application.md, 최상위 `application_` 없음), `mains_list`/`autodisplay_list`(category.md, `category_` 없음 — 단 `category_list`/`category_get` 등 core 서브만 예외적으로 `category_` prefix 사용), `shops_list`/`activitylogs_list`/`benefits_setting_get`/`currency_get`(store.md, 대다수가 `store_` 없음). 즉 같은 컨벤션 문서 §2 예시 하나(`product`)가 마침 "최상위=유일 sub-resource" 케이스라 두 관행(① 항상 최상위 prefix, ② sub-resource 자체를 prefix)의 차이를 감춘다. `catalog-sync.spec.ts` §4 규칙6 은 "파일 내 unique" 만 강제하고 prefix 패턴 자체는 검증하지 않아, 이 drift 를 잡아낼 자동 가드가 없다.
- 제안: (a) §2 규칙 문언에 "복수 sub-resource 를 가진 리소스 파일은 `<resource>` 자리에 **해당 operation 이 속한 sub-resource 이름**을 쓴다 (카탈로그 최상위 리소스명이 아님)" 문장을 예시(`scripttags_list`, `mains_list` 등)와 함께 추가해 실제 관행을 문서화하거나, (b) 반대로 문서 규칙대로 전 리소스 파일의 id 를 항상 최상위 리소스명으로 시작하도록 재정렬한다. (b)는 485개 supported row + backend 메타데이터 + `catalog-sync.spec.ts` 동시 갱신이 필요한 대규모 변경이라 (a) 쪽이 현실적. 결정은 project-planner 판단 필요.

### [INFO] 중첩 sub-resource 의 `__`(이중 언더스코어) 표기가 §7.1 문서에 미기재
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 (`<entity_id>` 는 kebab-case, 예시 `appstore-orders` 만 제시)
- 위반 규약: 같은 문서 §7.1 자체 — 서술된 규칙(단일 세그먼트 kebab-case)이 실제 파일명 관행을 다 담지 못함
- 상세: 실제 카탈로그 하위에는 부모-자식 sub-resource 관계를 `parent__child` 형태로 표기하는 파일이 카탈로그 전체에 69개 존재한다 (`category/categories__decorationimages.md`, `community/boards__articles__comments.md`, `order/orders__items__history.md`, `store/paymentgateway__paymentmethods.md` 등). `_overview.md` §7.1 은 이 `__` 표기 규칙을 전혀 언급하지 않고 단일 세그먼트 예시(`appstore-orders`)만 제시해, 신규 기여자가 두 세그먼트 이상인 entity 를 명명할 때 참고할 명문 규칙이 없다.
- 제안: §7.1 에 "부모 sub-resource 아래 중첩된 entity 는 `parent__child`(`__` 구분자)로 잇는다 — 3단 중첩은 `a__b__c`" 문장과 실제 예시 1~2개를 추가.

### [INFO] `store.md` `privacy_*` id 와 별도 `privacy` 리소스 간 명명 유사성 — 이미 문서가 인지한 open follow-up
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §5 각주 ("store.md 의 privacy_* id 명명 우려 … 별 트랙으로 follow-up 가능")
- 상세: 실측 결과 현재는 문자열 충돌은 없다 (`store.md`: `privacy_boards_get`/`privacy_join_get`/`privacy_orders_get` 등, `privacy.md`: `customers_privacy_get`/`products_wishlist_customers_list` 등 —겹치지 않음). 다만 위 첫 번째 WARNING(리소스별 prefix 관행 불일치)의 근본 원인과 동일한 뿌리이며, 문서가 이미 스스로 "follow-up" 으로 표시해 둔 상태라 새 위반으로 재분류하지 않고 교차 참조만 남긴다.
- 제안: 위 WARNING 항목 해결 시(§2 규칙 명문화) 함께 재검토하면 자연히 정리됨.

### [INFO] `_overview.md` 본문에 명시적 `## Overview` 헤딩 부재 (구조 규약 권장 사항)
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 (제목 다음 서문 문단, `## Rationale` 은 말미에 존재)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 사항 (각 SKILL.md 참고)
- 상세: 서문 문단이 사실상 Overview 역할을 하고 있고 `## Rationale` 섹션은 문서 말미에 정상 존재하지만, 명시적 `## Overview` 헤딩이 없다. frontmatter 부재는 `spec-impl-evidence.md` §1 의 밑줄(`_*.md`) prefix 면제 규칙에 정확히 해당해 **위반 아님** (오탐 방지 차 명기).
- 제안: 경미한 사안이며 강제 대상 아님. 일관성을 위해 서문 앞에 `## Overview` 헤딩만 추가하는 정도로 충분.

### [INFO] `catalog-sync.spec.ts` 헤더 주석과 `_overview.md` §4 규칙 번호가 1칸 어긋남 — 문서가 이미 자각
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §4 규칙8 서술 말미 괄호 각주
- 상세: 문서 자체가 "테스트 헤더 주석은 이를 '규칙7' 로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의" 라고 명시하고 있어 새 결함이 아니다. 코드 쪽 주석 번호를 갱신하는 후속 정리 정도로 남겨도 됨.

## 준수 확인 (참고 — 위반 아님)
- `spec/conventions/audit-actions.md`: frontmatter(`id`/`status`/`code`) 정상, Overview/본문(§1~3)/Rationale 3섹션 구성 완전 준수. `<resource>.<verb>` 구조·verb 3분류 taxonomy·레지스트리 표기(언더스코어 토큰 구분)가 자체 규칙과 정합하며, `workspace` 의 이중 분류(§2.1+§2.3)와 `workspace.deleted` 배제는 Rationale 로 근거가 명시돼 모순이 아님.
- `cafe24-api-catalog/application/*.md`, `category/*.md` 등 field-level 문서: frontmatter(`resource`/`entity`/`cafe24_docs`/`source`) 가 `spec-impl-evidence.md` §1 의 `<name>-api-catalog/<resource>/**/*.md` 면제 규칙과 정확히 일치 — lifecycle frontmatter(`id`/`status`) 부재는 규약 위반이 아니라 의도된 예외.
- `application.md`/`category.md` 최상위 인덱스: `id`/`status`/`code` frontmatter 보유, 링크된 field-level 하위 문서 경로 전부 실존 확인(누락 없음).

## 요약
검토 대상으로 전달된 표본(`audit-actions.md`, `cafe24-api-catalog/_overview.md` 및 하위 application/category 문서)은 frontmatter 면제 규칙·3섹션 구조·토큰 명명 규칙을 대체로 준수한다. 다만 카탈로그 SoT 전체를 리포지토리에서 직접 대조한 결과, `_overview.md` §2 가 선언한 `id` prefix 규칙(`<resource>_<verb>`)이 `product`/`order`/`customer` 계열과 `application`/`category`/`store` 계열 사이에서 실제로 다르게 적용되고 있으며 이는 자동 가드(`catalog-sync.spec.ts`)가 포착하지 못하는 문서-실무 간극이다. 이 외에는 중첩 entity `__` 표기 미문서화, 이미 자각된 소소한 번호 어긋남 등 INFO 수준 보완 제안에 그친다. Critical 급 위반(빌드 invariant 파괴)은 발견되지 않았다.

## 위험도
LOW
