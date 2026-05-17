# Convention Compliance Check

대상: `spec/conventions/` (cafe24-restricted-scopes 작업 — worktree `cafe24-restricted-scopes-a1b2c3`)
검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/conventions/)

---

### 발견사항

- **[CRITICAL]** `_overview.md` §2 컬럼 정의 순서와 실제 카탈로그 파일 컬럼 순서 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 "표 컬럼 정의" 정의 표 vs `mileage.md`, `notification.md`, `privacy.md`, `store.md` 표 헤더 행
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §2 (catalog 파일의 표준 컬럼 순서를 단일 진실로 정의)
  - 상세: `_overview.md` §2 정의 표는 컬럼을 `... scope | paginated | restricted | status | docs` 순서로 열거한다 (`paginated` 다음에 `restricted` 가 온다). 그러나 이번 PR 에서 갱신된 4개 카탈로그 파일(mileage.md / notification.md / privacy.md / store.md) 은 모두 헤더를 `... scope | restricted | paginated | status | docs` 로 구현했다 (`restricted` 가 `paginated` 앞에 위치). `catalog-sync.spec.ts` 가 MD 표를 파싱하므로, 컬럼 순서가 두 곳에서 다르면 파서 구현 시 정의 표를 기준으로 삼을 것인지 실제 파일을 기준으로 삼을 것인지 혼동이 생기고, 향후 다른 resource 에 `restricted` 컬럼을 추가할 때 어느 순서를 따라야 할지 알 수 없다. _overview.md 가 single source of truth 임에도 실제 파일과 어긋나 있다.
  - 제안: 정의 표와 실제 파일 중 하나를 기준으로 통일한다. 현재 4개 파일이 `scope | restricted | paginated` 순서를 사용하고 있으므로, `_overview.md` §2 의 정의 표에서 `paginated` 행과 `restricted` 행의 순서를 뒤바꿔 `scope → restricted → paginated → status → docs` 로 맞추는 것이 최소 수정이다. 변경 후 CHANGELOG에도 기록한다.

- **[WARNING]** `_overview.md` §5 Coverage Matrix 기준 날짜가 갱신되지 않음
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §5 "Coverage Matrix" 첫 줄
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §5 자체 규칙 — "row 추가/삭제 시 본 표도 손으로 갱신한다"
  - 상세: §5 에 "2026-05-16 기준" 이라고 명시되어 있으나, 이번 PR(2026-05-17) 에서 `restricted` 컬럼을 mileage / notification / privacy / store 4개 파일의 헤더에 추가했다. row 수는 변동이 없더라도 표의 의미론적 내용(restricted 컬럼 추가)은 변경되었으므로 기준 날짜를 2026-05-17 로 갱신하는 것이 일관성에 부합한다. 기준 날짜가 오래된 상태로 남으면 독자가 매트릭스의 최신성을 신뢰할 수 없다.
  - 제안: `_overview.md` §5 첫 줄의 "2026-05-16 기준" 을 "2026-05-17 기준" 으로 갱신한다.

- **[WARNING]** `cafe24-restricted-scopes.md` 에 `## Overview` 섹션 없음
  - target 위치: `spec/conventions/cafe24-restricted-scopes.md` 문서 전체 구조
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview(제품 정의) 2. 본문(스펙) 3. Rationale"
  - 상세: 본 문서는 `## Rationale` 섹션(§110)과 `## CHANGELOG` 는 존재하지만 `## Overview` 섹션이 없다. 대신 도입부 단락이 제목 바로 아래에 비섹션화된 채 놓여 있다. 정식 규약 문서(`spec/conventions/*.md`)에 대해 CLAUDE.md 의 3섹션 권장은 규범적으로 적용되므로, 도입부를 `## Overview` 로 명시하거나 단일 파일 영역에서 본문 상단에 `## Overview` 를 두는 패턴을 따라야 한다.
  - 제안: 도입부 단락(Cafe24 Admin API 설명 + "본 컨벤션은..." 문장)을 `## Overview` 섹션으로 감싼다. 단, `spec/conventions/*.md` 가 일반적으로 Overview 섹션 없이 바로 본문 번호 섹션으로 시작하는 기존 관례(node-output.md, swagger.md 등)를 따르고 있다면, 규약 자체를 갱신해 conventions 파일의 3섹션 의무를 명시적으로 면제하는 것도 대안이다.

- **[WARNING]** 갱신된 resource 카탈로그 파일들에 `## Rationale` 섹션 없음
  - target 위치: `spec/conventions/cafe24-api-catalog/mileage.md`, `notification.md`, `privacy.md`, `store.md` 의 전체 구조
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다 ... 3. Rationale — 결정의 배경·근거·폐기된 대안"
  - 상세: 이번 PR 에서 4개 카탈로그 파일에 `restricted` 컬럼이 추가됐다. 해당 결정의 배경(왜 별도 컬럼인가, 왜 `status` enum 확장이 아닌가)은 `_overview.md` 와 `cafe24-restricted-scopes.md` Rationale 에 분산되어 있으나, 각 resource 파일 자체에는 없다. CLAUDE.md 권장 구조상 `## Rationale` 섹션을 두는 것이 바람직하다. 다만 resource 파일은 표(SoT) 자체가 본문의 전부인 성격이므로 `_overview.md` 의 Rationale 로 위임하는 구조도 허용될 수 있다 — 그 경우 각 resource 파일 상단에 "결정 근거: `_overview.md` §Rationale 참고" 형태의 주석이라도 두는 것이 권장된다.
  - 제안: 각 resource 파일에 `## Rationale` 섹션을 추가하거나, 대신 "설계 근거는 [`_overview.md`](./_overview.md) 참고" 주석을 명시한다. 혹은 `_overview.md` 에 `## Rationale` 섹션(현재 없음)을 신설하고 resource 파일에서 참조한다.

- **[INFO]** `_overview.md` 파일명이 CLAUDE.md 명명 컨벤션 표의 exact 패턴과 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
  - 위반 규약: CLAUDE.md "명명 컨벤션" — 언더스코어 prefix 파일은 `_product-overview.md` (영역의 제품 정의) 또는 `_layout.md` (영역 공통 레이아웃)만 예시로 명시
  - 상세: `_overview.md` 는 CLAUDE.md 명명 규약 표에서 예시로 등장하는 `_product-overview.md` 나 `_layout.md` 와 다른 이름이다. 카탈로그 개요 문서이므로 `_product-overview.md` 보다는 `0-overview.md` (기술 아키텍처 개요) 패턴에 더 가깝다. 그러나 이 파일은 이번 PR 이전부터 존재하며, 파일명 변경 시 기존 참조 링크 전체를 갱신해야 하는 부담이 크다. 또한 기존 일관성 검토 세션(12_12_46) 에서 이미 허용된 패턴일 수 있다.
  - 제안: 현재 파일명을 유지하되, CLAUDE.md 명명 컨벤션 표에 `spec/conventions/<하위폴더>/_overview.md` 패턴을 카탈로그형 conventions 의 허용 예외로 명시하거나, 향후 신설 시 `0-overview.md` 패턴을 따르도록 주석을 남긴다.

- **[INFO]** `_overview.md` 에 `## Rationale` 섹션 없음 (CHANGELOG 만 존재)
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 섹션 구조
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — 권장 3섹션 중 Rationale 포함
  - 상세: `_overview.md` 는 `## 7. CHANGELOG` 를 보유하나 `## Rationale` 이 없다. 설계 결정 근거(왜 18 resource 분리인지, 왜 양방향 동기 테스트인지 등)는 CHANGELOG 안에 일부 서술되어 있으나 전용 Rationale 섹션으로 구분되어 있지 않다.
  - 제안: 기존 CHANGELOG 직전에 `## Rationale` 섹션을 신설하고, CHANGELOG 에 산재된 결정 배경 서술을 이동하거나 요약한다. 또는 `cafe24-restricted-scopes.md` 의 Rationale 에서 이미 충분히 다뤄진 내용은 링크로 위임해도 무방하다.

---

### 요약

`spec/conventions/cafe24-restricted-scopes.md` (신규) 와 `spec/conventions/cafe24-api-catalog/` 4개 파일 갱신은 전반적으로 conventions 구조(SoT 분리, catalog-sync 연계, `restricted` 컬럼 도입)를 올바르게 따르고 있으나, **CRITICAL 1건**: `_overview.md` §2 의 컬럼 정의 순서(`paginated → restricted`)와 실제 4개 파일의 헤더 순서(`restricted → paginated`)가 역전되어 있어 single source of truth 원칙이 깨진다. 이 불일치는 `catalog-sync.spec.ts` 파서 구현 시 혼동을 야기하고 향후 다른 resource 파일에 `restricted` 컬럼 추가 시 어느 순서를 따라야 할지 명확하지 않게 만든다. WARNING 3건(Coverage Matrix 날짜 미갱신, cafe24-restricted-scopes.md 의 Overview 섹션 누락, 갱신된 resource 파일의 Rationale 섹션 부재)은 규약 준수 의도가 명확하므로 빠른 보정이 가능하다. INFO 2건은 기존 관행과의 minor 불일치로 긴급도 낮음.

---

### 위험도

MEDIUM
