# 정식 규약 준수 검토 결과

검토 범위: `spec/conventions/cafe24-api-catalog/` (신규 생성된 문서들)
검토 모드: `--impl-done` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-12

---

## 발견사항

### [INFO] `_overview.md` — `## Rationale` 섹션 부재

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` 전체
- **위반 규약**: CLAUDE.md §정보 저장 위치 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `_overview.md` 는 `_` prefix 로 인해 `spec-impl-evidence.md §1` 의 frontmatter 의무에서 면제되지만, CLAUDE.md 는 spec 문서 끝에 `## Rationale` 섹션 권장을 명시한다. 본 파일에는 §7 (Field-level 상세 레이어)로 끝나며 Rationale 섹션이 없다. `_generator.py` 도입·field-level 레이어 추가 같은 설계 결정의 배경이 본문에 산문으로 분산돼 있다.
- **제안**: 본 파일 끝에 `## Rationale` 섹션을 추가하고 "(R-7) field-level 파일 frontmatter 면제 근거", "two-layer 설계 선택 이유", "_generator.py 결정적 파이프라인 채택 배경" 등을 이전한다. 단, `_overview.md` 는 index 성격이라 규약 갱신 쪽이 더 자연스럽다면 "index/layout 파일은 Rationale 면제" 를 CLAUDE.md 에 명시하는 것도 유효하다.

---

### [INFO] `_overview.md` §4 규칙 번호와 테스트 주석 번호 어긋남 (자기문서화 주의 사항)

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §4 규칙8 설명 끝 주석 "(테스트 헤더 주석은 이를 '규칙7' 로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의.)"
- **위반 규약**: 직접 위반 규약은 없으나 `spec/conventions/cafe24-api-metadata.md` §5 의 "카탈로그와 메타데이터 정합 원칙" 과 같이 SoT 내 숫자가 두 곳(spec vs 테스트 주석)에서 다른 값을 가리키는 상황.
- **상세**: 규약 파일 자체에 "숫자가 다르다" 고 명시적으로 경고하고 있어 혼란이 문서화돼 있다는 점에서 진단 등급은 INFO 에 머문다. 그러나 카탈로그를 처음 읽는 기여자가 spec §4 규칙9 를 테스트 `describe()` 에서 찾을 때 off-by-one 오해가 발생할 수 있다.
- **제안**: `catalog-sync.spec.ts` 의 테스트 헤더 주석을 "규칙7" → "규칙8" 로 정정하거나, spec 에서 해당 경고 주석을 제거하여 두 문서가 동일 번호를 가리키도록 통일한다.

---

### [WARNING] `application.md` 인덱스 표 — `restricted` 컬럼 누락

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` §표
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 표 컬럼 정의 — `restricted` 컬럼이 필수는 아니나 "컬럼 설명" 자체는 모든 resource 파일의 표에 선택적으로 포함될 수 있음. 그러나 `_overview.md` §2 의 컬럼 정의에 `restricted` 는 명시되어 있고, `store.md` 등 다른 resource 파일에서는 `restricted` 컬럼이 포함되어 있을 가능성이 있다.
- **상세**: `application.md` 의 표 헤더는 `| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |` 로 `restricted` 컬럼이 없다. `_overview.md` §2 는 `restricted` 컬럼을 "—" (선택) 으로 표기하므로 생략 자체는 허용된다. 단, `applications_list`, `webhooks_list` 두 row 는 ⚠ 주석으로 "미문서화 seed" 임을 별도 설명하고 있는데, 이 경우 `restricted` 와 유사한 수준의 "비정상 상태" 를 표 컬럼으로 포착하지 못하고 footnote 에만 의존한다.
- **제안**: 현재 상태는 규약상 허용 범위이므로 위반은 아니다. 다만 `applications_list`, `webhooks_list` 의 "미검증 seed" 상태를 `restricted` 와 같은 별도 컬럼이나 `status` 값의 확장으로 표현하는 방안을 향후 규약 갱신 시 고려할 수 있다.

---

### [INFO] `application/appstore-orders.md` — Operation 제목 오탈자 ("Retreive" vs "Retrieve")

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` line — `### \`GET /api/v2/admin/appstore/orders/{order_id}\` — Retreive a Cafe24 Store order`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §7.3 "출처는 Cafe24 공식 Admin API Documentation 의 결정적(deterministic) 파싱이다 — 추측·날조로 field·샘플 을 채우지 않는다"
- **상세**: 헤더 제목이 "Retreive" (오탈자) 인데, 이는 Cafe24 공식 docs anchor 자체(`#retreive-a-cafe24-store-order`)가 오탈자를 가지고 있는 것으로 추정된다. `application.md` 인덱스의 `docs` 컬럼도 동일 anchor(`#retreive-a-cafe24-store-order`)를 사용하고 있어 공식 docs 원본의 오탈자를 충실하게 반영한 것이다. 이는 _overview.md §7.3 원칙("추측 없이 docs 원본 그대로")에 따른 정상 동작이다.
- **제안**: 변경 불필요. 단, Cafe24 공식 docs 에서 오탈자가 수정되면 카탈로그도 재생성해야 하므로 `cafe24-backlog-residual.md` §G-2 의 검증 트랙에 "docs anchor 오탈자 확인" 을 포함시키는 것을 권장한다.

---

### [INFO] `category/categories__decorationimages.md` 등 — 이중 밑줄(`__`) 파일명이 규약에 미정의

- **target 위치**: `spec/conventions/cafe24-api-catalog/category/categories__decorationimages.md`, `category/categories__seo.md`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 "경로: `spec/conventions/cafe24-api-catalog/<resource>/<entity_id>.md` (`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (snake_case))"
- **상세**: `_overview.md` §7.1 은 `<entity_id>` 를 "snake_case" 라고 정의하나, `categories__decorationimages` 처럼 이중 밑줄(`__`)을 허용하는지는 명시하지 않는다. 이중 밑줄은 snake_case 의 변형으로 해석 가능하나, Cafe24 docs 의 sub-resource 식별자가 실제 `categories/decorationimages` 처럼 계층형 경로인 경우 파일명에서 `/` 를 `__` 로 치환한 것으로 보인다. 이는 _overview.md §7.1 의 "한 resource 내 unique" 요건을 만족하기 위한 선택이다.
- **제안**: `_overview.md` §7.1 에 "Cafe24 docs 의 sub-resource 가 다단계 경로인 경우 `/` → `__` 로 치환한다 (예: `categories/decorationimages` → `categories__decorationimages.md`)" 를 한 줄 추가하여 패턴을 명시적으로 문서화한다.

---

### [INFO] field-level 파일 frontmatter `source` 필드 — 규약에 컬럼명만 나열하고 형식 미정의

- **target 위치**: 모든 field-level 파일 frontmatter (예: `application/apps.md` line 4)
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 "frontmatter: `resource`, `entity`, `cafe24_docs`, `source`"
- **상세**: `_overview.md` §7.1 은 frontmatter 필드를 나열하지만 각 필드의 값 형식(타입·예시)을 정의하지 않는다. 실제 파일들은 `source: "Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json"` 처럼 고정된 산문을 사용하고 있어 de facto 표준이 존재하나 규약에는 누락됐다. 생성기가 일관되게 출력하므로 실질적 문제는 없다.
- **제안**: `_overview.md` §7.1 에 각 frontmatter 필드의 예시값 또는 허용 형식을 한 줄씩 추가한다 (예: `source: "Cafe24 REST API Documentation (admin) — ..."` 의 형식 예시).

---

## 요약

`spec/conventions/cafe24-api-catalog/` 의 신규 문서들(`_overview.md`, `application.md`, `category.md`, 및 field-level 하위 파일들)은 정식 규약(`spec-impl-evidence.md` frontmatter 의무, `_overview.md` 에서 자체 정의한 카탈로그 컨벤션)을 전반적으로 잘 준수하고 있다. 인덱스 파일(`application.md`, `category.md`)은 `id`/`status`/`code:` frontmatter 를 보유하고 있고, field-level 파일들은 frontmatter 가드 면제 대상으로 올바르게 분류된다(`spec-impl-evidence.md §1` R-7). CRITICAL 위반은 없으며, WARNING 1건은 `restricted` 컬럼 미포함으로 규약상 허용이지만 "미검증 seed" 상태 표현 방법에 개선 여지가 있다. 나머지는 규약 문서 자체에 이중 밑줄 파일명 패턴·frontmatter `source` 형식이 미정의된 INFO 수준의 문서화 보완 제안이다.

## 위험도

LOW

---

STATUS: OK
