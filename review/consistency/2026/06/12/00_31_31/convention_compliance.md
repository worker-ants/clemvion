# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/cafe24-api-catalog/` (신규 field-level 상세 레이어 + index 파일)
검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/conventions/, diff-base=origin/main)

---

## 발견사항

### 1. **[CRITICAL]** `appstore-orders.md` — 응답 wrapper 필드 설명 규약 위반

- target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 49행, 97행
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
- 상세: GET/POST appstore/orders 두 operation 모두 응답 표에서 `order` wrapper 필드의 설명이 `"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"` 로 채워져 있다. `order` 는 응답 객체 wrapper 이며 property list 에 등재되지 않은 필드이므로 규약상 `(응답 객체)` 를 써야 한다. 현재 값은 sort 파라미터의 설명(별도 API 의 `order` 쿼리 파라미터 값)이 잘못 주입된 것으로, §7.3 "추측 주입 금지" 원칙에도 위배된다.
- 제안: 두 operation 의 `| \`order\` | | 정렬 순서 … |` 행을 `| \`order\` | | (응답 객체) |` 로 수정한다.

---

### 2. **[WARNING]** field-level entity 파일명·frontmatter `entity` 값이 규약 명시 `snake_case` 와 불일치

- target 위치: `spec/conventions/cafe24-api-catalog/application/` 하위 `appstore-orders.md`, `appstore-payments.md`, `databridge-logs.md`, `webhooks-logs.md`, `webhooks-setting.md` 및 `category/` 하위 `categories__decorationimages.md`, `categories__seo.md` 등 다수
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — "`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (snake_case)"
- 상세: 규약 텍스트는 `snake_case` 를 명시하지만 실제 파일명·frontmatter `entity:` 값은 Cafe24 docs URL 앵커에 맞춘 kebab-case (`appstore-orders`, `webhooks-logs`) 또는 double-underscore (`categories__decorationimages`) 를 사용한다. 18개 resource 전반에 걸쳐 kebab-case 가 일관 적용되어 있으므로 이것이 사실상의 구현 컨벤션이다.
- 제안: 파일명 변경보다 규약 갱신이 적절하다. `_overview.md §7.1` 의 `(snake_case)` 를 `(kebab-case, Cafe24 docs URL 앵커 기반. 복합 sub-resource path 의 `/` 는 `__` 로 대체)` 로 수정한다.

---

### 3. **[WARNING]** `application.md`, `category.md` — `## Rationale` 섹션 부재

- target 위치: `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/category.md`
- 위반 규약: CLAUDE.md "정보 저장 위치 — 결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"; 동일 디렉토리의 `store.md`, `mileage.md`, `notification.md`, `privacy.md` 는 `## Rationale` 을 보유
- 상세: `application.md` 는 `docs 부재 seed` 에 대한 상당한 설계 근거(⚠ 블록)가 포함되어 있음에도 Rationale 섹션으로 분리되지 않았다. `category.md` 는 `[^seed]`, `[^display-no]` 각주가 설계 결정을 담고 있어 Rationale 에 넣을 내용이 있다. 동일 디렉토리의 일부 resource 파일에는 존재하는 섹션이 누락된 상태는 문서 구조 일관성 규약에 어긋난다.
- 제안: `application.md` 와 `category.md` 말미에 `## Rationale` 섹션을 추가하고 기존 각주·⚠ 블록의 설계 근거를 이관한다. 또는 `_overview.md §6` 에 "설계 근거가 있는 경우에만 Rationale 섹션 추가" 를 명시하여 비일관성을 공식화한다.

---

### 4. **[WARNING]** `appstore-orders.md` — operation heading 타이포 (`Retreive`) 및 index 와 heading 불일치

- target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 30행
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — "출처는 Cafe24 공식 Admin API Documentation 의 결정적(deterministic) 파싱"; 내부 일관성
- 상세: `### \`GET …\` — Retreive a Cafe24 Store order` 의 `Retreive` 는 `Retrieve` 의 오타다. Cafe24 공식 docs URL 앵커 자체가 `#retreive-a-cafe24-store-order` 로 오기되어 있어 URL 앵커는 그대로 유지해야 하나, heading 텍스트는 자체 오타다. 또한 index `application.md` 의 `English title` 컬럼은 `Retrieve a Cafe24 store order` (정상 철자, lowercase 's') 를 사용하여 field-level heading 과 철자·대소문자 모두 불일치한다.
- 제안: `appstore-orders.md` 30행 heading 을 `Retrieve a Cafe24 Store order` 로 수정한다. Cafe24 docs URL 앵커(`#retreive-…`)는 외부 URL 이므로 현행 유지.

---

### 5. **[INFO]** `_overview.md` — `## Rationale` 섹션 부재

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md`
- 위반 규약: CLAUDE.md "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" (권장)
- 상세: `_overview.md` 는 밑줄 prefix 로 frontmatter 가드 면제 대상이나, field-level 레이어 도입 근거·sync 정책·상태 enum·restricted 컬럼 직교성 등 상당한 설계 결정이 본문에 산재해 있음에도 `## Rationale` 이 없다. 관련 설계 근거는 `spec-impl-evidence.md §Rationale R-7` 에 일부 존재하지만 `_overview.md` 자체에는 없다.
- 제안: 장기 개선 사항으로 `## Rationale` 섹션을 추가하고 카탈로그 설계 결정을 집약한다.

---

## 요약

`spec/conventions/cafe24-api-catalog/` 전반에 걸쳐 신규 field-level 레이어는 `_overview.md §7` 이 정의한 구조(frontmatter `resource`/`entity`/`cafe24_docs`/`source`, 응답 속성 + Operations 섹션, wrapper 표기)를 대체로 잘 따른다. 다만 `appstore-orders.md` 의 응답 wrapper 필드 설명 오류는 `(응답 객체)` 규약을 직접 위반하는 CRITICAL 사안이며 수정이 필요하다. entity 파일명 규약 텍스트(`snake_case`)와 실제 구현(`kebab-case`) 사이의 괴리는 규약 갱신이 필요한 WARNING 이고, `application.md`·`category.md` 의 Rationale 부재는 같은 디렉토리 내 일관성 측면에서 주목해야 할 WARNING 이다. Cafe24 index 파일의 frontmatter(`id`/`status: implemented`)와 field-level 파일의 frontmatter(`resource`/`entity`/`cafe24_docs`/`source`)는 `spec-impl-evidence.md §1 R-7` 규약에 따른 면제 대상 구분이 정확히 적용되어 있다.

## 위험도

MEDIUM
