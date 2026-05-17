# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 범위: `spec/2-navigation/` 전체 (0-dashboard.md, 1-workflow-list.md, 10-auth-flow.md, 11-error-empty-states.md, 12-workflow-version-history.md, 13-user-guide.md, 14-execution-history.md, 2-trigger-list.md, 3-schedule.md, 4-integration.md, _layout.md, _product-overview.md)

---

## 발견사항

### 1. **[CRITICAL]** `14-execution-history.md` 자기 자신으로의 순환 참조 링크

- **target 위치**: `spec/2-navigation/14-execution-history.md` 헤더 관련 문서 라인 1
  ```
  > 관련 문서: [PRD 실행 내역](./14-execution-history.md) · ...
  ```
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항(옛 PRD)은 `spec/<영역>/_product-overview.md` 또는 영역 진입 문서의 `## Overview (제품 정의)` 섹션"
- **상세**: 관련 문서 링크의 "PRD 실행 내역"이 `./14-execution-history.md` 즉 자기 자신을 가리키고 있다. docs-consolidation 이후 PRD 가 본 파일에 흡수(§"Overview (제품 정의)" 섹션으로 통합)되었음에도 헤더 링크를 갱신하지 않아, 링크가 의미 없는 순환 참조가 되었다. 다른 파일들(예: 0-dashboard.md의 `[PRD 내비게이션](./_product-overview.md)`)은 `_product-overview.md` 를 올바르게 참조하는데 이 파일만 다르다.
- **제안**: 해당 링크를 `[_product-overview.md](./_product-overview.md)` 또는 제거하고, `## Overview (제품 정의)` 섹션에 이미 흡수된 사실(현행 `출처: prd/7-execution-history.md` 안내)로 대체.

---

### 2. **[WARNING]** `14-execution-history.md` 문서 구조 — Overview 안에 중첩된 번호 헤딩이 본문의 번호 헤딩과 충돌

- **target 위치**: `spec/2-navigation/14-execution-history.md`, `## Overview (제품 정의)` 섹션 내부의 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` vs. 본문 `## 1. 개요`, `## 2. 실행 내역 목록 페이지`
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — "권장 3섹션 구성(1. Overview(제품 정의), 2. 본문(스펙), 3. Rationale)"
- **상세**: 권장 구성은 Overview / 본문 / Rationale 의 3개 최상위 섹션으로 나뉘어야 한다. 그런데 이 파일은 `## Overview (제품 정의)` 안에 `### 1. 개요 ~ ### 3. 요구사항` 을 두고, 이어서 `## 1. 개요 ~ ## 7. 라우팅` 으로 본문을 별도 반복하고 있다. 결과적으로 "개요" 라는 동일 제목이 두 번 등장하고, Overview 섹션 안에 제품 정의와 기술 명세가 혼재하는 구조가 되어 있다. 다른 파일들(0-dashboard.md 등)은 섹션 구분 없이 바로 `## 1.`, `## 2.` 로 시작하는 본문 중심 구조를 사용하는데, 이 파일만 두 단계를 중첩 반복하고 있어 일관성이 떨어진다.
- **제안**: `## Overview (제품 정의)` 안의 `### 1. 개요(배경·목표)`, `### 2. 페이지 구조`, `### 3. 요구사항`을 최상위 Overview 섹션에만 두고, 본문(`## 1. 개요`부터)에서는 요구사항 반복 없이 기술 명세로 바로 진입하는 형태로 재구조화 권장. 또는, Overview 섹션을 제거하고 단일 본문 구조로 합치고 Rationale 섹션을 추가하는 것도 가능.

---

### 3. **[WARNING]** `14-execution-history.md` — `prd/` 경로 출처 표기

- **target 위치**: `spec/2-navigation/14-execution-history.md`, `## Overview (제품 정의)` 내부
  ```
  > 출처: `prd/7-execution-history.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.
  ```
- **위반 규약**: CLAUDE.md §폴더 구조 명명 컨벤션 — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/`로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
- **상세**: 흡수 이력 표기 목적으로 `prd/7-execution-history.md` 를 언급하고 있는 것은 역사 기록으로 이해되나, 살아있는 spec 문서 본문에 존재하지 않는 옛 경로를 backtick 코드 형태로 명시적으로 남기는 것은 미래 작업자에게 혼란을 줄 수 있다. 규약상 "신규 문서를 옛 경로 컨벤션으로 만들지 않는다"는 지침은 생성 금지이지, 역사 표기 자체를 금지하지는 않으나 문서에서 돋보이는 위치에 두는 것은 불필요하다.
- **제안**: `출처: prd/7-execution-history.md` 표기를 문서 맨 아래 `## Rationale` 섹션이나 인라인 주석 수준으로 이동하거나, 단순히 제거 권장. 아니면 Rationale 섹션에 "docs-consolidation 이전 prd/ 구조를 흡수했음" 정도로 기술.

---

### 4. **[WARNING]** `0-dashboard.md` — `## Rationale` 섹션 없음

- **target 위치**: `spec/2-navigation/0-dashboard.md` 전체 문서
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다. ... 3. Rationale — 결정의 배경·근거·폐기된 대안"
- **상세**: `0-dashboard.md` 는 Overview / 본문으로 구성되지만 `## Rationale` 섹션이 전혀 없다. "권장" 사항이라 CRITICAL이 아닌 WARNING 수준이나, `1-workflow-list.md` 는 `## Rationale` 섹션을 보유하고 있고, `10-auth-flow.md` 도 Rationale(`R-1`, `R-2`) 를 보유하고 있어 내부 일관성이 낮다.
- **제안**: 향후 대시보드 구성·API endpoint 선택·레이아웃 결정 등 근거가 생기면 `## Rationale` 섹션 추가. 지금 내용이 없다면 최소한 섹션 자체라도 빈 상태로 추가하여 권장 구조 준수.

---

### 5. **[WARNING]** `11-error-empty-states.md` — `## Rationale` 섹션 없음

- **target 위치**: `spec/2-navigation/11-error-empty-states.md` 전체 문서
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션 중 Rationale 결여
- **상세**: 에러 페이지 5종 설계, 빈 상태 패턴, 사이드바 표시 규칙 등 아키텍처 결정이 다수 있으나 Rationale 섹션이 없다.
- **제안**: `## Rationale` 섹션을 추가하고 에러 페이지 유형 선택 근거나 사이드바 숨김 정책 등을 기록.

---

### 6. **[WARNING]** `12-workflow-version-history.md` — `## Rationale` 섹션 없음

- **target 위치**: `spec/2-navigation/12-workflow-version-history.md` 전체 문서
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션 중 Rationale 결여
- **상세**: "버전 생성 실패 시 다음 저장에서 자동 따라잡힘", "복원 동작 자체를 새 버전으로 기록", "페이지 리로드 방식" 등 비자명한 설계 결정이 있으나 Rationale 섹션이 없다.
- **제안**: `## Rationale` 섹션 추가 권장.

---

### 7. **[WARNING]** `13-user-guide.md` — `## Rationale` 섹션 없음

- **target 위치**: `spec/2-navigation/13-user-guide.md` 전체 문서
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션 중 Rationale 결여
- **상세**: `/docs` 경로 선택, FAQ 섹션에 `99-` 프리픽스 배정, 외부 문서 사이트 대신 내장 선택 등의 결정에 대한 근거가 없다.
- **제안**: `## Rationale` 섹션 추가 권장.

---

### 8. **[INFO]** `0-dashboard.md` — 파일명이 `0-` 프리픽스이나 내용은 Overview가 아닌 상세 spec

- **target 위치**: `spec/2-navigation/0-dashboard.md`
- **위반 규약**: CLAUDE.md §명명 컨벤션 — "`spec/<영역>/0-overview.md` — `0-` prefix: 영역 안의 기술 아키텍처 개요"
- **상세**: `0-` 프리픽스는 관례적으로 "영역의 기술 아키텍처 개요" 문서에 사용한다. `0-dashboard.md` 는 실제로는 대시보드 화면 전체 spec 이지 2-navigation 영역 아키텍처 개요가 아니다. 다만 `0-` 가 대시보드 화면의 고유 파일명으로 사용되는 것이 해당 영역의 관행으로 정착되어 있다면(즉, `0-overview.md` 가 별도로 없고 대시보드가 첫 번째 기능이라 관례적으로 0 번을 부여한 것이라면) 규약 위반보다는 관행으로 볼 수 있다. 그러나 다른 영역의 `0-` 파일과 의미가 달라 혼동 가능성이 있다.
- **제안**: 현행 유지가 실용적이라면 규약 테이블의 `0-` prefix 설명에 "단, 영역 진입 feature 파일의 index 번호로도 허용" 같은 예외 주석을 추가하여 규약을 갱신하거나, `0-dashboard.md` 를 `1-dashboard.md` 로 변경하고 `0-overview.md` 를 신설하거나 `_product-overview.md` 가 역할을 대신한다고 명시.

---

### 9. **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — 파일명 언더스코어 prefix 패턴

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md`
- **위반 규약**: CLAUDE.md §명명 컨벤션 — 언더스코어 prefix(`_`)는 "영역의 제품 정의(`_product-overview.md`)" 또는 "영역 공통 레이아웃(`_layout.md`)"에 사용. `spec/conventions/*.md` 는 "평문" 네이밍.
- **상세**: `spec/conventions/cafe24-api-catalog/_overview.md` 는 `_` prefix를 사용하고 있으나, 이 파일은 제품 정의나 레이아웃이 아니라 카탈로그 인덱스 문서다. 규약표에서 `_` prefix의 의미는 `_product-overview.md` 와 `_layout.md` 두 케이스만 명시되어 있고, conventions 디렉토리 자체는 "평문" 네이밍을 사용한다. 다만 `cafe24-api-catalog/` 서브디렉토리 안에서 인덱스 파일임을 명시하는 관행(`_index.md` 류)으로 해석할 수 있어 심각도는 낮다.
- **제안**: 카탈로그 인덱스 파일을 `overview.md`(언더스코어 없이) 또는 `README.md` 로 변경하거나, CLAUDE.md 규약에 "서브디렉토리 인덱스 파일에도 `_` prefix 허용" 항목을 추가하여 명문화.

---

### 10. **[INFO]** `spec/2-navigation/` — `0-overview.md` 가 없고 `_product-overview.md` 만 존재

- **target 위치**: `spec/2-navigation/` 디렉토리
- **위반 규약**: CLAUDE.md §명명 컨벤션 — "`spec/<영역>/0-overview.md` — 영역 안의 기술 아키텍처 개요(제품 정의와 별개)"
- **상세**: `spec/2-navigation/` 에는 `_product-overview.md` 와 `_layout.md` 는 있지만, 기술 아키텍처 개요를 담는 `0-overview.md` 가 없다. `0-dashboard.md` 가 그 자리를 차지하고 있는 상황이다. 영역에 기술 아키텍처 개요 문서가 필요하지 않다면 문제가 없으나, `spec/0-overview.md`(루트), `spec/3-workflow-editor/0-canvas.md` 등 다른 영역들은 `0-` 개요 파일을 보유하고 있어 패턴 불일치가 있다.
- **제안**: 해당 영역의 기술 아키텍처 개요(라우트 목록, 레이아웃 전략, 전반적인 구조 결정)가 `_layout.md` 에 충분히 기술되어 있다면 현행 유지도 가능. 그렇지 않다면 `0-overview.md` 신설하여 영역 기술 아키텍처 개요를 분리 작성.

---

## 요약

`spec/2-navigation/` 문서들은 전반적으로 파일 명명 컨벤션(`_product-overview.md`, `_layout.md`, 숫자 prefix)을 잘 준수하고 있으며, API endpoint 형식과 응답 구조도 `spec/conventions/swagger.md` 의 래퍼 패턴(`{ data: ..., pagination: ... }`)을 따르고 있다. 그러나 **`14-execution-history.md`** 에서 자기 자신을 "PRD" 링크로 가리키는 순환 참조가 CRITICAL 위반으로 발견되었다. 이 파일은 docs-consolidation 으로 PRD 를 흡수했음에도 헤더 참조를 정리하지 않아 링크가 무의미해졌다. 그 외 WARNING 수준으로는 `14-execution-history.md` 의 구조적 이중 반복(Overview 안에 본문과 중복되는 섹션들), `prd/` 경로 출처 표기, 다수 파일(`0-dashboard.md`, `11-error-empty-states.md`, `12-workflow-version-history.md`, `13-user-guide.md`)의 `## Rationale` 섹션 결여가 있다. `1-workflow-list.md`, `10-auth-flow.md`, `3-schedule.md`, `4-integration.md` 는 Rationale 섹션을 보유하여 규약을 잘 따르고 있다.

## 위험도

MEDIUM
