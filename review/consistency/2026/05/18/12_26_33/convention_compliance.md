# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/conventions/cafe24-api-catalog/` 전체 (19개 파일: `_overview.md` + 18 resource 카탈로그)
검토 기준: `spec/conventions/` 정식 규약 + CLAUDE.md 명명·문서 구조 규약

---

## 발견사항

### 1
- **[WARNING]** `store.md` — `Rationale` 섹션이 `표` 섹션 앞에 위치
  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` §Rationale (표 헤더 이전, 파일 9~13행)
  - 위반 규약: CLAUDE.md `§프로젝트 스펙 문서` — 권장 3섹션 구성 순서는 "Overview → 본문(스펙) → Rationale". Rationale 은 본문 **끝**에 두도록 권장
  - 상세: `store.md` 는 `Rationale` 섹션(9~13행)이 `## 표` 섹션(15행~) 앞에 선행한다. 다른 resource 파일(`mileage.md`, `notification.md`, `privacy.md`)은 `Rationale` 을 `표` 뒤에 두어 일관성이 깨진다.
  - 제안: `## Rationale` 블록을 `## 표` 뒤로 이동. `mileage.md`·`notification.md`·`privacy.md` 의 배치(표 → Rationale)를 기준으로 통일.

### 2
- **[WARNING]** `_overview.md` — `spec/conventions/` 파일에 CLAUDE.md 가 규정한 `0-` prefix 컨벤션 적용 불가 상황이나, 현행 `_overview.md` 파일명이 CLAUDE.md 표의 "영역 진입 문서" 패턴과 혼용될 수 있음
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` (파일명)
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` 는 "제품 정의(옛 PRD)". `spec/<영역>/0-overview.md` 는 "기술 아키텍처 개요". `_overview.md` 는 두 패턴 중 어느 것도 아닌 이름
  - 상세: `_overview.md` 는 언더스코어 prefix 이지만 내용은 "제품 정의"가 아닌 기술 아키텍처·컬럼 정의·동기 정책이다. 반면 `0-overview.md` 패턴과도 일치하지 않는다. `spec/conventions/` 하위는 CLAUDE.md 가 "평문" 명명으로 규정(표의 마지막 행)하지만, 서브디렉토리(`cafe24-api-catalog/`) 안의 인덱스 파일에 대해서는 명시적 규정이 없어 잠재적 혼란이 있다.
  - 제안: 규약 자체를 갱신하여 `spec/conventions/<sub>/` 하위의 인덱스 파일에 적합한 패턴(`_overview.md` 또는 `0-overview.md`)을 CLAUDE.md 표에 명시하는 것이 적절하다. 현행 `_overview.md` 는 기능 상 문제없으므로 즉시 변경보다 규약 갱신 우선 권장.

### 3
- **[INFO]** `community.md`, `application.md`, `category.md`, `collection.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md`, `salesreport.md`, `shipping.md`, `supply.md`, `translation.md` — `Rationale` 섹션 부재
  - target 위치: 위 13개 resource 파일 전체
  - 위반 규약: CLAUDE.md `§프로젝트 스펙 문서` — "본문 끝에 `## Rationale` 섹션을 **권장**"
  - 상세: `mileage.md`, `notification.md`, `privacy.md`, `store.md` 4개 파일은 `Rationale` 섹션을 가지고 있지만, 나머지 13개 파일은 해당 섹션이 없다. 규약은 강제가 아닌 권장이나 일관성 측면에서 갭이 존재한다.
  - 제안: 각 resource 파일 말미에 간단한 `## Rationale` 섹션을 추가하거나, `_overview.md` 가 공통 Rationale 을 대신한다고 명시하여 개별 파일의 생략을 정당화하는 주석을 두는 방식 중 하나를 선택한다.

### 4
- **[INFO]** `community.md` — `board_article_get` 의 `English title` 이 단건 조회임에도 복수형 제목을 재사용
  - target 위치: `spec/conventions/cafe24-api-catalog/community.md` `board_article_get` 행
  - 위반 규약: `_overview.md` §2 컬럼 정의 — `English title` 은 "Cafe24 공식 docs 의 영문 제목"이어야 함
  - 상세: `board_article_get` 의 `English title` 이 `"Retrieve a list of posts for a board (single)"` 로 표기되어 있어 공식 docs 제목에 `(single)` 이라는 비공식 접미어가 추가되어 있다. 실제로 Cafe24 공식 docs 에서 단건 조회 endpoint 는 별도 제목을 가질 가능성이 높다.
  - 제안: 공식 Cafe24 docs 에서 단건 조회(`GET boards/{board_no}/articles/{article_no}`)의 실제 영문 제목을 확인하여 정정.

### 5
- **[INFO]** `_overview.md` §7 CHANGELOG 섹션 — 규약 파일(`spec/conventions/`)에 CHANGELOG 를 두는 패턴이 CLAUDE.md 에서 명시적으로 안내되지 않음
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7
  - 위반 규약: CLAUDE.md `§정보 저장 위치` — "아키텍처 결정의 배경·근거"는 `## Rationale` 섹션에, 규약 변경 이력은 별도 명시 없음
  - 상세: `_overview.md` 내 `## 7. CHANGELOG` 섹션은 규약 변경 이력을 날짜별로 상세히 기록한다. 이는 살아있는 문서(latest state)를 권장하는 프로젝트 원칙과 약간 거리감이 있다. 단, 규약 파일 특성상 변경 추적이 유용하므로 허용 가능한 예외 케이스다.
  - 제안: 현행 유지 허용. 다만 CLAUDE.md 에 "정식 규약(`spec/conventions/`) 파일의 변경 이력은 `## CHANGELOG` 섹션으로 선택적 허용"을 명시하면 규약 갱신이 적절하다.

---

## 요약

`spec/conventions/cafe24-api-catalog/` 카탈로그는 전반적으로 자체 정의한 컨벤션(`_overview.md` §2 컬럼 정의, §3 status enum, §4 동기 정책)을 충실히 따르고 있다. 표 헤더 순서(`id → 라벨(한) → English title → method → path → scope → restricted → paginated → status → docs`)가 모든 파일에서 일관되고, `restricted` 컬럼의 값도 `scope`/`operation`/빈칸으로 규약 토큰과 일치한다. 주요 문제는 `store.md` 의 `Rationale` 위치가 `표` 앞에 선행하여 다른 파일(`mileage.md` 등)과 배치 순서가 다른 점(WARNING), 그리고 `_overview.md` 파일명이 CLAUDE.md 명명 컨벤션 표의 어느 패턴과도 명확히 대응되지 않는 점(WARNING)이다. 13개 resource 파일의 `Rationale` 섹션 부재와 `community.md` 의 영문 제목 비공식 접미어는 경미한 형식 일관성 문제다. 전체적으로 규약 직접 위반 수준의 CRITICAL 항목은 없으며, 규약 자체를 소폭 갱신하면 해소될 WARNING 2건이 주된 과제다.

---

## 위험도

LOW
