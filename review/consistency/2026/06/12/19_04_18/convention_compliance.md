# Convention Compliance Review — `spec/conventions/`

검토 범위: `spec/conventions/**` (--impl-done, diff-base=origin/main)
검토 일시: 2026-06-12

---

## 발견사항

### [WARNING] `_overview.md §7.1` entity_id 명명 규약이 실제 파일명과 불일치 — snake_case vs kebab-case
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 (line ~142)
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` 자체 및 `spec/conventions/spec-impl-evidence.md §1` (naming convention SoT)
- **상세**: `_overview.md §7.1` 은 `<entity_id>` 를 "Cafe24 docs 의 sub-resource 식별자 (snake_case)" 라고 명시한다. 그러나 실제 파일 명 및 frontmatter `entity:` 필드 모두 kebab-case(하이픈)를 사용한다 — `appstore-orders.md`(`entity: appstore-orders`), `appstore-payments.md`, `databridge-logs.md`, `webhooks-logs.md`, `webhooks-setting.md`, `automessages-arguments.md` (store 하위) 등. §7.3 에서는 오히려 "entity id 의 hyphen 을 underscore 로 치환" 이라고 서술하여 entity id 가 hyphen 을 포함할 수 있음을 전제한다. 규약 텍스트와 실제 운용 관행 및 생성기 동작이 모순된다.
- **제안**: `_overview.md §7.1` 의 "(snake_case)" 를 "(kebab-case — Cafe24 docs anchor 식별자와 동일 형식, 단어 간 하이픈 구분)" 으로 수정한다. 또는 "snake_case 또는 kebab-case (Cafe24 docs sub-resource 식별자 그대로)" 로 완화한다. 규약 갱신이 적절하다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/` 내 resource index 파일들에 `## Rationale` 섹션 부재
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` (및 18개 resource index 파일 전체)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 해당 spec 문서 끝의 `## Rationale`" 권장
- **상세**: 각 resource index 파일(`application.md`, `category.md`, …)은 `## 표` / `## Field-level 상세 카탈로그` 두 섹션만 갖고 Rationale 섹션이 없다. 이 파일들은 endpoint enumeration index 이므로 design decision 이 상대적으로 적지만, 예를 들어 `application.md` 의 미문서화 seed (`applications_list`, `webhooks_list`) 에 대한 주의 사항이 본문 note 에만 산재한다. 그 결정 배경을 Rationale 로 정리하면 후속 참조자가 맥락을 파악하기 쉽다.
- **제안**: 결정 배경이 있는 resource index 파일(특히 `application.md`)에 `## Rationale` 섹션을 추가하는 것을 고려한다. 단, 엄격 의무(CRITICAL)는 아니므로 우선순위가 낮다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` 에 `## Rationale` 섹션 부재
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` (전체)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — Rationale 섹션 권장
- **상세**: `_overview.md` 는 카탈로그 구조·동기 계약·field-level 레이어 정책 등 다수의 design decision 을 담고 있으나 `## Rationale` 섹션이 없다. 이미 `§7 Field-level 레이어` 끝에 "본 레이어는 ... 선행 데이터 확보로 생성됐다" 는 맥락 문장이 있지만, 정식 Rationale 절은 부재한다. 단, `_*.md` 파일은 frontmatter 의무 면제 대상이므로 Rationale 부재가 가드 실패를 일으키지는 않는다.
- **제안**: `_overview.md` 끝에 `## Rationale` 을 추가해 field-level 레이어 도입 배경, 생성기 채택 이유, sync 테스트 범위 결정 근거 등을 집약한다.

---

### [INFO] `appstore-orders.md` operation 제목 typo — 상위 index 와 불일치
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `### GET /api/v2/admin/appstore/orders/{order_id}` 헤더
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "Operation 별 …Docs anchor" 및 §2 "English title … Cafe24 공식 docs 의 영문 제목"
- **상세**: field-level 파일의 operation 헤더는 "Retreive a Cafe24 Store order"(오탈자·대소문자)로 Cafe24 공식 docs 의 오탈자를 그대로 복사했다. 반면 상위 index `application.md` 는 "Retrieve a Cafe24 store order"(수정된 형태)를 사용한다. `_overview.md §7.2` 는 operation 헤더 표기 규칙을 명시적으로 정의하지 않으나, 일관성 면에서 두 레이어가 다른 제목을 갖는 것은 혼란을 줄 수 있다. 단, field-level 파일은 생성기 산출물(외부 docs 충실 복사)이므로 Cafe24 docs 오탈자를 보존하는 것이 §7.3 "출처는 … 결정적 파싱" 원칙에 부합하기도 한다.
- **제안**: field-level 파일이 Cafe24 docs 오탈자를 보존하는 것은 정책상 허용이지만, `_overview.md §7.2` 에 "operation 헤더는 Cafe24 docs 원문 그대로 (오탈자 포함)" 임을 한 줄 명시해 상위 index 와의 의도적 차이를 문서화한다.

---

## 요약

`spec/conventions/` 전반에 걸쳐 정식 규약의 핵심 invariant — frontmatter `id`/`status` 의무(resource index 파일), 생성기 산출물 field-level 파일의 frontmatter 면제, `pending_plans` 실존 — 는 모두 준수되고 있다. 발견된 문제는 두 가지 범주로 나뉜다: (1) `_overview.md §7.1` 의 "snake_case" 기술이 실제 kebab-case 운용 관행과 모순되는 **규약 텍스트 오류**(WARNING — 규약 자체 갱신 필요), (2) Rationale 섹션 부재 및 field-level typo 메모 불재 등 형식 일관성 수준의 **INFO** 사항들. CRITICAL 위반은 없다.

## 위험도

LOW
