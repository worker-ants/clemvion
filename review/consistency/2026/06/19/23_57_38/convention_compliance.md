# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/` (audit-actions.md, cafe24-api-catalog/_overview.md, application.md, category.md, 및 field-level entity 파일 일부)
검토 모드: --impl-done, scope=spec/conventions/, diff-base=origin/main

---

## 발견사항

### 1. **[WARNING]** `categories__decorationimages.md` / `categories__seo.md` 엔티티 ID가 docs anchor 형식과 불일치

- **target 위치**: `spec/conventions/cafe24-api-catalog/category/categories__decorationimages.md` frontmatter `entity: categories__decorationimages`, 동일하게 `categories__seo.md`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — `<entity_id>` 는 "Cafe24 docs 의 sub-resource 식별자 (kebab-case — docs anchor 식별자와 동일 형식, 예: `appstore-orders`)"
- **상세**: Cafe24 공식 docs anchor 는 `#categories--decorationimages` (이중 하이픈 `--`) 이지만 entity 파일명과 frontmatter `entity:` 값은 `categories__decorationimages` (이중 언더스코어 `__`) 를 사용한다. 규약이 명시한 "docs anchor 식별자와 동일 형식" 을 따르지 않는다. `_overview.md §7.3` 의 `<data-resource>` 치환 규칙("entity id 의 hyphen 을 underscore 로 치환")이 이 경우에 어떻게 적용되는지도 명시되어 있지 않아 모호하다.
- **제안**: `_overview.md §7.1` 에 계층 경로(`<parent>--<child>`) 를 파일명에서 이중 언더스코어(`__`) 로 표현하는 것에 대한 명시적 예외·규칙을 추가하거나, 또는 entity 파일명을 kebab-case 형식으로 통일한다. 어느 쪽이든 규약에 명시하여 향후 생성기(`_generator.py`) 가 일관된 형식을 출력하도록 한다.

---

### 2. **[WARNING]** `appstore-orders.md` operation 헤더 제목에 오타 ("Retreive")

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `### \`GET /api/v2/admin/appstore/orders/{order_id}\` — Retreive a Cafe24 Store order` 및 Docs URL `#retreive-a-cafe24-store-order`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — "출처는 Cafe24 공식 Admin API Documentation 의 결정적 파싱. 추측·날조로 field·샘플을 채우지 않는다". 또한 `application.md` 인덱스 표의 `English title` 열("Retrieve a Cafe24 store order") 과 field-level 파일 operation 헤더 제목이 불일치한다.
- **상세**: 공식 docs 제목은 "Retrieve a Cafe24 store order" 이지만 `appstore-orders.md` 의 GET operation 헤더 제목이 "Retreive a Cafe24 Store order" (오타 + 대소문자 불일치) 로 표기되어 있다. 이 오타는 Cafe24 공식 docs 자체의 URL anchor(`#retreive-a-cafe24-store-order`) 오타가 그대로 전이된 것이나, 제목 텍스트의 스펠링은 정확하게 유지해야 한다. `application.md` 의 `English title` 열은 "Retrieve a Cafe24 store order" (정상) 이므로 field-level 파일 헤더가 인덱스 표와 불일치한 상태다.
- **제안**: `appstore-orders.md` GET operation 헤더를 `— Retrieve a Cafe24 store order` 로 수정. URL anchor 는 공식 docs 의 실제 anchor 가 오타 상태이므로 그대로 유지한다. `_overview.md §7.3` 에 "공식 docs 의 오타 anchor 는 URL 에서 그대로 유지하되 제목 텍스트는 정상 스펠링으로 표기한다" 는 방침을 명시해 혼동을 방지한다.

---

### 3. **[INFO]** `application.md` / `category.md` 인덱스 파일에 Overview 및 Rationale 섹션 부재

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` (##표, ##Field-level 상세 카탈로그만 있음), `spec/conventions/cafe24-api-catalog/category.md` (동일)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 및 `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview·Rationale 권장
- **상세**: `spec/conventions/<resource>.md` 에 해당하는 정식 spec 이지만 카탈로그 표 중심 형식을 따라 Overview·Rationale 섹션 없이 구성되어 있다. `_overview.md` 가 resource 인덱스 파일 형식을 별도로 정의하나, 3섹션 면제에 대한 명시적 규약이 없다.
- **제안**: `_overview.md §6` 또는 §1 에 "resource index 파일(`<resource>.md`)은 표+Field-level 목록 형식을 취하며 Overview/Rationale 섹션은 생략 가능하다" 는 한 줄을 추가해 내부 규약 충돌을 해소한다. INFO 수준이므로 즉각 차단 사항은 아니다.

---

### 4. **[INFO]** `cafe24-api-catalog/_overview.md` 에 Rationale 섹션 없음

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` — §1~§7 본문만 있고 `## Rationale` 없음
- **위반 규약**: CLAUDE.md "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 권장
- **상세**: `_overview.md` 는 `_` prefix 로 frontmatter 의무에서 면제되나, 중요 설계 결정(field-level 파일 sync 테스트 제외 이유, 이중 언더스코어 entity 파일명 선택 이유 등)이 본문 안에 분산되어 있고 Rationale 섹션으로 통합되어 있지 않다. 이는 발견사항 1 의 `__` 명명 결정 근거 부재와도 연결된다.
- **제안**: `_overview.md` 말미에 `## Rationale` 을 추가하고, 계층 경로 entity 파일명(`__` 사용 이유), sync 테스트 제외 결정 등의 설계 근거를 옮긴다.

---

### 5. **[INFO]** conventions 파일 간 H1 제목 형식 불일치

- **target 위치**: `spec/conventions/audit-actions.md` — `# 감사 액션 명명 규약 (Conventions)` vs `spec/conventions/cafe24-api-metadata.md` — `# CONVENTION: Cafe24 API Metadata` vs `spec/conventions/swagger.md` — `# Swagger 문서화 일관된 패턴 가이드`
- **위반 규약**: 정식 규약 없음 (conventions 파일 제목 형식에 대한 명시적 규칙 부재)
- **상세**: `spec/conventions/` 파일의 H1 제목 형식이 `# CONVENTION: ...`, `# ... 규약 (Conventions)`, `# ... 가이드` 등으로 혼재한다. 어떤 가드도 이를 검증하지 않으나, 검색 및 일관성 측면에서 통일 형식이 있으면 유용하다.
- **제안**: 규약 자체를 갱신하는 것이 적절하다면 `spec/conventions/` 파일의 H1 을 `# CONVENTION: <설명>` 으로 통일하는 명명 규칙을 `spec/conventions/` 에 추가한다. 단 현재는 어떤 가드도 강제하지 않는 INFO 수준이다.

---

## 요약

전반적으로 `spec/conventions/` 대상 문서들은 정식 규약의 핵심 요구사항(frontmatter id/status 의무, 카탈로그 표 컬럼 정의, sync 테스트 계약, 생성기 산출물 frontmatter 면제 규칙)을 잘 준수하고 있다. CRITICAL 위반은 없다. 주요 이슈는 두 가지 WARNING 이다: (1) `categories__decorationimages` / `categories__seo` entity 파일명이 `_overview.md §7.1` 의 "docs anchor 식별자와 동일 형식(kebab-case)" 규약에서 이중 언더스코어(`__`)로 벗어나 있고 이 예외에 대한 명시가 없다. (2) `appstore-orders.md` GET operation 헤더에 "Retreive" 오타가 있어 인덱스 표의 English title 과 불일치한다. 두 INFO 항목은 선택 권장 사항인 3섹션 구조 및 제목 형식 일관성에 관한 것이다.

## 위험도

MEDIUM
