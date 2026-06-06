# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)
검토 대상: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md) + `spec/conventions/cafe24-api-catalog/` (application.md, application/apps.md, application/appstore-orders.md, _overview.md)

---

## 발견사항

### 1. **[INFO]** `spec/5-system/1-auth.md` — Rationale 섹션 내 numbered label이 순서 없음
- target 위치: `spec/5-system/1-auth.md` `## Rationale` 섹션 — 라벨이 `1.5.A`, `1.5.B`, `1.5.C`, `1.4.A`, `1.4.B`, `1.4.C`, `1.4.E`, `1.4.D`, `1.4.F`, `1.4.G`, `1.4.H`, `1.4.I` 순서 (1.5.* 다음 1.4.* 로 역방향)
- 위반 규약: `CLAUDE.md` — 문서 구조 규약(Overview / 본문 / Rationale 3섹션)에서 섹션 자체는 준수되나, Rationale 항목이 본문 참조 순서와 역방향 배치됨
- 상세: 본문에서 1.4.* 섹션이 1.5.* 보다 앞에 나오지만, Rationale 은 1.5.A~C → 1.4.A~I 순으로 역순 배치됨. 가독성·참조 추적 시 혼란 유발. 규약 파괴는 아니나 일관성 권장.
- 제안: Rationale 항목을 본문 섹션 번호 오름차순(1.4.* → 1.5.*)으로 재정렬하거나, 본문 Rationale 참조 링크가 올바르게 anchor 를 가리키는지 확인.

---

### 2. **[WARNING]** `spec/5-system/1-auth.md §1.5.4` — 에러 코드 `lower_snake_case` 예외가 historical-artifact 레지스트리에 이중 정의됨
- target 위치: `spec/5-system/1-auth.md §1.5.4` 각주 블록 (라인 258 근방)
- 위반 규약: `spec/conventions/error-codes.md §3` — historical-artifact 예외 레지스트리는 `error-codes.md` 가 단일 SoT 임을 선언. `1-auth.md §1.5.4` 각주가 "historical-artifact 레지스트리에 등재해 유지한다" 고 기술하며, `error-codes.md §3` 표에도 동일 코드 목록이 등재되어 있음. 두 곳에 동시 정의가 있으면 갱신 시 동기 누락 위험 있음.
- 상세: `invitation_not_found` 외 5개 코드에 대한 예외 근거 설명이 `1-auth.md §1.5.4` 각주와 `error-codes.md §3` 표에 중복 존재. `error-codes.md` 가 SoT 임을 `error-codes.md §Overview` 가 명시하므로, `1-auth.md` 의 각주는 "레지스트리에 등재됨 — 상세는 [`error-codes.md §3`](../conventions/error-codes.md#3-historical-artifact-예외-레지스트리) 참조" 한 줄로 줄이는 것이 규약 일치.
- 제안: `spec/5-system/1-auth.md §1.5.4` 각주를 `error-codes.md §3` 링크 참조 한 줄로 단축. 현재 두 곳 모두 동일 내용이므로 breaking 변경 없음.

---

### 3. **[INFO]** `spec/5-system/10-graph-rag.md` — 최상위 `## Overview` 섹션이 `---` 구분자로 중첩됨
- target 위치: `spec/5-system/10-graph-rag.md` 라인 589 — `## Overview (제품 정의)` 아래 `---` 로 구분된 블록, 이후 `### 1. 목표`, `### 2. 범위` 등이 `## 1. 개요` 와 별도로 존재
- 위반 규약: `CLAUDE.md` 문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장. `spec/5-system/10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션 안에 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항` 등이 포함되어 있고, 이후 별도로 `## 1. 개요`, `## 2. 데이터 모델` 등이 이어짐 — Overview 섹션이 지나치게 비대하고 본문과 구분이 불명확
- 상세: Overview 섹션이 요구사항 전체를 포함하여 "제품 정의" 라는 명칭과 달리 기술 명세 영역까지 흡수함. `## 1. 개요` 가 뒤에 별도로 존재해 독자가 두 개의 "개요" 섹션을 마주함. 규약 직접 위반은 아니나 3섹션 권장 구조와 거리 있음.
- 제안: `## Overview (제품 정의)` 내부의 `### 3.~7.` (요구사항, 기술결정, 비기능, 단계별도입, 의존성, 미결) 은 본문 레벨(h2)로 승격하여 Overview 는 `### 1. 목표`와 `### 2. 범위` 만 유지. 또는 현재 구조가 의도적이라면 규약 갱신에서 "Overview 가 PRD 전체를 포함할 수 있는 예외" 를 명시.

---

### 4. **[INFO]** `spec/5-system/11-mcp-client.md` — `## 1. 개요` 로 시작(Overview 섹션 미사용)
- target 위치: `spec/5-system/11-mcp-client.md` 전체 구조 — `## 1. 개요` 로 시작하고 `## Overview` 섹션 없음
- 위반 규약: `CLAUDE.md` 문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장. `1-auth.md` 는 섹션 번호로 구성, `10-graph-rag.md` 는 `## Overview` 섹션 존재. `11-mcp-client.md` 는 `## 1. 개요` 로 Overview 역할을 대체
- 상세: `## Rationale` 섹션 없음 (섹션 구조상 누락). 개요(`## 1. 개요`)는 존재하나 `## Overview` 표준 명칭 미사용. 문서 간 구조 일관성 부재. Rationale 전무는 여러 설계 결정(transport 선택, tool naming, skip/error 분리 등)이 본문에 분산되어 있음을 의미.
- 제안: 본문 내 각 섹션의 "이유" 설명을 `## Rationale` 에 집약하거나, 현재 구조가 의도적이라면 `spec/5-system/` 내 문서 구조 규약 예외를 명시.

---

### 5. **[WARNING]** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 응답 파라미터 표의 `order` wrapper 설명 오류
- target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `GET /api/v2/admin/appstore/orders/{order_id}` 및 `POST /api/v2/admin/appstore/orders` 응답 파라미터 표의 첫 행: `| \`order\` | | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |`
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "응답 파라미터 표 첫 행의 wrapper 는 `(응답 객체)` 로 표기한다" (`property list 에 없는 wrapper 는 \`(응답 객체)\`/\`(목록)\``). 또한 §7.3 의 "추측·날조로 field·샘플을 채우지 않는다" 원칙
- 상세: `order` wrapper row 의 `설명` 컬럼에 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 이 기재됨 — 이는 `order` 필드(주문 객체)의 설명이 아니라 `order` 쿼리 파라미터(정렬 방향)의 설명이 잘못 복사된 것으로 보임. `_overview.md §7.2` 에 따르면 wrapper row 설명은 `(응답 객체)` 가 되어야 함.
- 제안: 두 operation 의 `order` wrapper row 설명을 `(응답 객체)` 로 교체. 생성기 재실행(`_generator.py`) 보다는 수동 수정이 안전 (샘플 JSON 과 응답 파라미터 설명 불일치는 생성기 아티팩트일 가능성).

---

### 6. **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — `_overview.md` 파일에 frontmatter `id`/`status` 없음 (면제 확인)
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` — frontmatter 없음 (h1 제목만 있음)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — `spec/conventions/**.md` 는 frontmatter 의무 대상. 단, `spec/<영역>/_*.md` (밑줄 prefix) 는 면제됨.
- 상세: `_overview.md` 의 basename 이 `_overview.md` 로 밑줄 prefix 이므로 `spec-impl-evidence.md §1` 의 `spec/_*.md` 및 `spec/<영역>/_*.md` 면제 규칙에 해당. 위반 없음 — 확인 목적 INFO 기재.
- 제안: 없음 (면제 정상 적용).

---

### 7. **[INFO]** `spec/conventions/cafe24-api-catalog/application.md` — `## 표` 섹션명이 비표준
- target 위치: `spec/conventions/cafe24-api-catalog/application.md` — 섹션명 `## 표`
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §1` — overview 가 카탈로그 파일 구조를 정의하나, 섹션 명칭(`## 표`)에 대한 특정 명명 규칙을 강제하지 않음
- 상세: 카탈로그 인덱스 파일들이 `## 표` 라는 간결한 섹션명을 공통 사용하는지 불명. 다른 resource.md 파일들(product.md, order.md 등)과의 일관성 확인 필요. `_overview.md` 가 컬럼 정의는 명시하나 섹션 h2 명칭은 명세하지 않음.
- 제안: `_overview.md §1` 또는 §2 에 "각 resource 파일의 표 섹션 h2 명칭은 `## 표` 로 통일한다" 한 줄 추가하면 일관성 강제가 명문화됨.

---

### 8. **[INFO]** `spec/5-system/11-mcp-client.md §6.2` — `skipReason` vocabulary 의 `lower_snake_case` 사용이 자체 선언으로 처리되었으나 error-codes.md 레지스트리에 미등재
- target 위치: `spec/5-system/11-mcp-client.md §6.2` — "`skipReason` 값은 모두 `lower_snake_case` 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md Principle 3.2` 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"
- 위반 규약: `spec/conventions/error-codes.md §Overview` — "본 규율은 프로젝트 전체의 에러 코드 문자열에 적용된다". `error-codes.md §3` — `lower_snake_case` 예외는 historical-artifact 레지스트리에 등재해야 함.
- 상세: `skipReason` 의 `lower_snake_case` 값들(`expired_install_timeout`, `expired_refresh_failed` 등)이 "에러 코드가 아니라 운영 진단용 enum" 이라는 이유로 `node-output.md Principle 3.2` 규약 대상에서 제외된다고 자체 선언함. 이는 `error-codes.md §Overview` 의 적용 범위(API·통합·OAuth 등 인라인 문자열 리터럴 포함) 와 경계가 모호. `skipReason` 이 실제로 에러 코드 규약 적용 범위 밖이라면, 그 근거를 `error-codes.md` 에 명시(또는 §3 예외 등재)하지 않으면 일관성 불확실.
- 제안: `error-codes.md §3` 에 `skipReason` 항목을 "에러 코드가 아닌 진단 enum — 명명 규약 적용 제외, SoT: mcp-client.md §6.2" 로 명시적으로 등재. 또는 `error-codes.md §Overview` 에 "운영 진단용 enum(`skipReason` 등)은 에러 코드 명명 규약 적용 범위 밖임" 예외 경계를 한 줄 추가.

---

## 요약

`spec/5-system/` 문서 3종 및 `spec/conventions/cafe24-api-catalog/` 문서들은 전체적으로 정식 규약을 잘 준수하고 있다. Critical 위반은 발견되지 않았다. 주요 관찰사항은 두 가지다: (1) `spec/5-system/1-auth.md §1.5.4` 의 invitation 에러 코드 lower_snake_case 예외가 `error-codes.md §3` (SoT)와 본문 양쪽에 중복 정의되어 갱신 시 동기 누락 위험이 있는 WARNING 수준 이중 정의; (2) `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 의 응답 파라미터 wrapper row 설명이 `_overview.md §7.2` 규약(`(응답 객체)`)을 따르지 않고 정렬 파라미터 설명이 오기재된 WARNING 수준 오류. 나머지는 문서 구조 일관성·명문화 부재 수준의 INFO 항목으로, 기존 규약을 직접 파괴하지는 않는다.

## 위험도

LOW

---

STATUS: OK
