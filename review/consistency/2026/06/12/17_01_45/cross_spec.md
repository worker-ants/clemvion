# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target 범위**: `spec/conventions/` (cafe24-api-catalog `_overview.md` §7 신설 + application/category resource 인덱스 + 하위 field-level entity 파일군)
**검토 기준 브랜치**: origin/main 대비 diff

---

## 발견사항

### 1. [INFO] `webhooks-setting` 엔티티 파일이 `webhooks_list` (GET `/webhooks`) 가 아닌 `webhooks_update` (PUT `/webhooks/setting`) 를 주로 커버함

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/webhooks-setting.md` — Operations 섹션의 두 operation: `GET /api/v2/admin/webhooks/setting` 과 `PUT /api/v2/admin/webhooks/setting`
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/application.md` index 표 — `webhooks_list` row 의 path = `webhooks` (= `GET /webhooks`, docs 부재 seed), `webhooks_update` row 의 path = `webhooks/setting` (= `PUT /webhooks/setting`)
- **상세**: field-level 엔티티 파일 이름 `webhooks-setting` 은 index 표의 `webhooks_list` (`GET webhooks`) 가 아닌 `webhooks_update`/해당 sub-resource(`webhooks/setting`)에 대응한다. `GET /webhooks/setting` (operation id: `webhooks_get`에 상당) 은 index 표에 별도 row 가 없고 `webhooks-setting.md` 가 그 역할을 field-level 에서 처리하는 구조다. `_overview.md §7.1` 규약은 "파일 1개 = entity 1개, entity id = Cafe24 docs sub-resource 식별자"를 명시하므로 패턴 자체는 합법이나, 이름이 `webhooks_list` (docs 부재 seed, path=`webhooks`)와 혼동될 수 있다. 실제 field-level 파일이 docs 에서 `webhooks/setting` entity 를 기반으로 생성됐고 index 표의 `webhooks_list` 와 field-level 대응 entity 파일이 없는 상황.
- **제안**: `application.md` index 의 ⚠ 주석(`applications_list`, `webhooks_list` docs 부재 안내) 에 `webhooks-setting.md` 가 field-level entity 를 커버하는 path 는 `webhooks/setting` 임을 간략히 언급하거나, `webhooks-setting.md` 의 서문에 "index row `webhooks_list` (path=`webhooks`)의 field-level 파일은 별도 제공되지 않음" 을 명시하여 독자 혼동을 방지. 모순은 아니며 sync 테스트도 field-level 을 대상 외로 처리하므로 빌드 영향 없음.

---

### 2. [INFO] `cafe24-api-catalog/_overview.md` §7 신설로 `spec-impl-evidence.md` R-7 제외 규칙과의 연동 정합성 — 명시적 확인 권장

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §7 (Field-level 상세 레이어 — `<resource>/<entity>.md`)
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md` §1 제외 규칙 — "`spec/conventions/<name>-api-catalog/<resource>/**/*.md` … 생성기 산출물, frontmatter 가 `resource`/`entity`/`cafe24_docs`/`source` 인 lifecycle 비추적 레퍼런스" + Rationale R-7
- **상세**: target 의 §7.1 은 "frontmatter 가드 제외: 본 field-level 파일은 생성기 산출물이라 spec-impl-evidence.md §1 의 lifecycle frontmatter(`id`/`status`) 의무에서 제외 (근거 §Rationale R-7)" 라고 자기-참조로 선언한다. `spec-impl-evidence.md` §1 의 해당 제외 항은 동일 내용을 이미 담고 있다. 두 문서가 동일 정책을 양쪽에서 선언하는 구조는 교차 일관성 관점에서 문제는 아니지만, `_overview.md` 의 §Rationale R-7 참조(`근거 §Rationale R-7`)는 `_overview.md` 자체의 Rationale 섹션으로의 self-ref처럼 읽힌다. 실제 Rationale R-7 은 `spec-impl-evidence.md` 에 있으므로 링크가 없으면 독자가 찾기 어렵다.
- **제안**: `_overview.md §7.1` 의 "(근거 §Rationale R-7)" 를 `[(근거 spec-impl-evidence §Rationale R-7)](../spec-impl-evidence.md#r-7--api-레퍼런스-카탈로그-필드-파일-제외-name-api-catalogresource)` 로 앵커 링크화. 자기 참조 오해 방지.

---

### 3. [INFO] `_overview.md` §4 검증규칙 번호 vs. 테스트 파일 내부 주석 번호 어긋남 — 기존 문제, target 이 신규 도입한 것은 아님

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §4 검증 규칙 8 (`planned ↔ planned.ts` 양방향 동기)
- **충돌 대상**: `catalog-sync.spec.ts` 테스트 헤더 주석 ("규칙7" 로 칭함)
- **상세**: `_overview.md` §4 규칙 8 이 `catalog-sync.spec.ts` 안에서는 "규칙7" 로 표기된다는 점을 `_overview.md` 가 스스로 "(테스트 헤더 주석은 이를 '규칙7' 로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의.)" 라고 이미 명시하고 있다. target 문서가 새로 도입한 문제가 아니며 기존 acknowledged 비일관성이다.
- **제안**: 현 상태 유지 가능. 향후 테스트 주석을 규칙 8 로 정정하거나, spec 번호를 7 로 재조정하는 후속 작업이 생기면 양쪽을 함께 갱신.

---

### 4. [INFO] MakeShop API Catalog 에는 field-level 상세 레이어가 없으며 `_overview.md §7` 패턴이 cafe24 전용임

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §7 (Field-level 상세 레이어 신설)
- **충돌 대상**: `spec/conventions/makeshop-api-catalog/_overview.md` — `openapi/<section>.openapi.json` 이 field-level SoT, 별도 `<resource>/<entity>.md` 층 없음
- **상세**: cafe24 catalog 의 §7 은 field-level `<resource>/<entity>.md` 층을 정의하지만, 동형 설계를 공유하는 MakeShop catalog 에는 이 레이어가 없고 `openapi/` JSON 파일이 그 역할을 한다. 두 카탈로그의 `_overview.md` 서두에서 "패턴이 다름"을 명시하지 않아, 독자가 makeshop catalog 에도 `<resource>/<entity>.md` 레이어를 기대할 수 있다. 실제 빌드·동기 테스트 영향은 없다 (`spec-impl-evidence.md §1` 제외 정의가 `<name>-api-catalog/<resource>/**/*.md` 로 이미 양쪽을 커버).
- **제안**: `makeshop-api-catalog/_overview.md` 에 "field-level 상세 레이어는 제공하지 않으며, 필드 SoT 는 `openapi/<section>.openapi.json`" 임을 명시하는 한 줄 추가 권장 (sync 기피). 모순 없음, INFO 수준.

---

## 요약

target 범위(`spec/conventions/cafe24-api-catalog/` — `_overview.md` §7 신설과 application/category 하위 field-level entity 파일군)는 기존 spec 과 직접 모순을 일으키는 항목이 없다. `spec-impl-evidence.md` R-7 제외 규칙, `cafe24-api-metadata.md` 의 field-level SoT 정의, `catalog-sync.spec.ts` 동기 정책 모두와 정합한다. 발견된 항목은 모두 명명 혼동 가능성(webhooks-setting vs webhooks_list), 문서 내 앵커 링크 누락, acknowledged 번호 어긋남, MakeShop catalog 와의 구조 비교 명시 부재 수준이며, 어느 영역도 작동 불가 또는 구현 충돌을 야기하지 않는다.

---

## 위험도

NONE
