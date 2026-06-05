# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후 검토 — `--impl-done`, diff-base=origin/main)
검토 대상 문서: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
검토 기준: `spec/conventions/` (error-codes.md, node-output.md, swagger.md, spec-impl-evidence.md, cafe24-api-catalog/_overview.md 등)

---

## 발견사항

### [WARNING] `11-mcp-client.md` §6.2 `skipReason` — lower_snake_case 의도적 일탈에 대한 규약 근거 표기 방식

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 `skipReason vocabulary` 블록 (명명 규칙 분리 주석)
- **위반 규약**: `spec/conventions/error-codes.md §1` + `spec/conventions/node-output.md Principle 3.2`
- **상세**: `skipReason` 값이 `lower_snake_case` 인 점은 "에러 코드가 아닌 운영 진단용 enum" 이라는 이유로 명시적 근거와 함께 문서화되어 있다. 이 자체는 규약 위반이 아니나, `spec/conventions/error-codes.md §3 historical-artifact 레지스트리`에 이 예외가 등재되어 있지 않다. `invitation_*` 코드들은 §3에 등재되어 있는 반면, `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed` 등)은 error code가 아닌 진단 enum으로 명확히 구분되어 별도 등재가 불필요하다는 주장도 가능하다. 그러나 `skipReason` 값이 외부에 surface 되는 string 리터럴이고, `lower_snake_case` 로 고정된다는 사실은 future contributor가 혼동할 수 있는 영역이다. `error-codes.md §3` 레지스트리가 "error code 문자열" 한정이라는 scope 구분이 현재 문서에 명시되어 있지 않다.
- **제안**: `spec/conventions/error-codes.md §3` 의 소개 문구에 "본 레지스트리는 `error.code` surface 의 string 리터럴에 한정하며, 운영 진단 enum (`skipReason` 등)은 별도 규약의 적용 범위"임을 한 줄 추가하거나, `11-mcp-client.md` 의 해당 주석에 `error-codes.md §3 등재 불필요` 명시. 현재 상태로 규약 의도 자체가 깨지지는 않으나 규약 경계가 모호하다.

---

### [WARNING] `10-graph-rag.md` — `## Overview` 섹션 구성: Overview / 본문 / Rationale 3섹션 권장에서 `## Overview` 가 이중 구조

- **target 위치**: `spec/5-system/10-graph-rag.md` — 최상단에 `## Overview (제품 정의)` 라는 헤딩 아래 구현 상태 표시 블록이 있고, 이어서 `### 1. 목표` ~ `### 8. 미결 / 후속 검토` 까지 numbered 섹션으로 이어진 뒤, 별도로 `## 1. 개요` 섹션이 존재하고, 마지막에 `## Rationale` 가 나온다.
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`", "기술 명세: `spec/<영역>/*.md` 본문", "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 3섹션 권장
- **상세**: `## Overview (제품 정의)` 하위에 numbered 1~8절이 포함되어 있는데, 그 뒤에 다시 `## 1. 개요`, `## 2. 데이터 모델`, ... `## 8. 비-목표` 의 본문 섹션이 이어진다. 이로 인해 `## Overview` 아래의 numbered 섹션(§1 목표, §2 범위, ... §8 미결)과 그 뒤의 `## 1. 개요` 가 중복/이중 구조처럼 보여 독자가 "Overview 안의 §1~8" 과 "본문 §1~8" 의 경계를 혼동할 수 있다. 다른 spec 문서들은 대체로 `## Overview` 한 절 뒤에 바로 본문 (`## 1.`, `## 2.`, ...) 으로 가거나 Overview 안에 numbered 절을 넣지 않는 패턴이다.
- **제안**: `## Overview (제품 정의)` 하위의 `### 1. 목표` ~ `### 8. 미결 / 후속 검토` 를 Overview 안에 두는 현재 구조를 유지하되, 이후 이어지는 `## 1. 개요`, `## 2. 데이터 모델` 등을 `## 기술 명세` 혹은 `## 구현 상세` 로 묶거나, Overview 내 numbered 절을 `##` 레벨로 올려서 Overview와 명확히 분리하는 것이 가독성을 높인다. 규약 자체를 갱신해야 할 사안은 아니며, target 문서의 구조 정리 수준 제안이다.

---

### [INFO] `1-auth.md` §1.5.4 에러 응답 — `lower_snake_case` historical-artifact 예외 인라인 주석과 `error-codes.md §3` 레지스트리 상호 참조가 정합

- **target 위치**: `spec/5-system/1-auth.md §1.5.4` 표 아래 주석 블록
- **위반 규약**: 없음 (정합 확인)
- **상세**: `1-auth.md §1.5.4` 는 `invitation_not_found` 등이 `lower_snake_case` 인 점을 "historical-artifact 예외"로 명시하고 `error-codes.md §3` 레지스트리에 등재 안내까지 인라인 주석으로 달고 있다. 실제로 `error-codes.md §3 historical-artifact 레지스트리` 에 해당 코드들이 등재되어 양방향 참조가 완성되어 있다. 이 패턴은 규약 준수의 모범 사례다.
- **제안**: 없음. 확인 차원의 INFO.

---

### [INFO] `11-mcp-client.md` `##` 구조 — Overview / 본문 / Rationale 3섹션 권장 미준수 (Overview 섹션 없음)

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: CLAUDE.md §정보 저장 위치 3섹션 권장 (`## Overview` / 본문 / `## Rationale`)
- **상세**: `11-mcp-client.md` 는 `## 1. 개요` 로 시작하고 별도의 `## Overview` 섹션이 없다. `1-auth.md` 도 동일하게 `## Overview` 없이 바로 `## 1. 인증` 으로 시작한다. 반면 `10-graph-rag.md` 는 `## Overview (제품 정의)` 가 있다. CLAUDE.md 는 "각 SKILL.md 참고" 로 미루고 있어 spec 파일 자체에 Overview 섹션이 강제되는지는 명확하지 않다. 3섹션은 "권장"이며 CRITICAL이 아니다.
- **제안**: 규약 문서 자체를 갱신해 "spec 본문에 `## Overview` 섹션이 있을 때 Rationale 이 분리되어야 하는 경우" 조건을 명확히 하거나, 현재 "권장" 수준을 유지하는 선에서 다음 작업 시 Overview 섹션 추가를 고려.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 응답 wrapper 필드 설명 오류

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` §Operations `GET /api/v2/admin/appstore/orders/{order_id}` 응답 파라미터 표
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
- **상세**: 응답 파라미터 표의 `order` wrapper 행 설명이 `(응답 객체)` 대신 `정렬 순서 asc : 순차정렬 · desc : 역순 정렬` 로 채워져 있다. 이는 `order` (주문 객체)가 아닌 `order` (정렬 파라미터) 의 설명이 잘못 매핑된 것으로, field-level 카탈로그 생성 규칙(`_overview.md §7.2`)에서 wrapper 의 설명은 `(응답 객체)` 를 쓰도록 규정하고 있다. `POST /api/v2/admin/appstore/orders` 응답에도 동일하게 `order` wrapper 에 `정렬 순서 asc...` 설명이 달려 있다.
- **제안**: `application/appstore-orders.md` 의 두 operation 응답 파라미터 표에서 `order` 행의 설명을 `(응답 객체)` 로 수정. 이는 생성기 파싱 오류로 추정되며, 재생성 또는 수동 수정으로 해결 가능. 단, field-level 카탈로그는 `catalog-sync.spec.ts` 검증 대상이 아니므로 CI는 차단되지 않는다(`_overview.md §7.4`).

---

## 요약

검토 대상 `spec/5-system/` 문서들(1-auth, 10-graph-rag, 11-mcp-client)과 `spec/conventions/cafe24-api-catalog/application/` 파일들은 전반적으로 정식 규약을 준수하고 있다. 에러 코드 명명(`UPPER_SNAKE_CASE`)은 역사적 예외가 `error-codes.md §3` 에 올바르게 등재되어 양방향 참조가 완성되어 있고, frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)도 각 spec 파일에 올바르게 적용되어 있다. 주요 지적은 두 가지 WARNING 수준으로 한정된다: (1) `skipReason` lower_snake_case 예외의 규약 경계가 `error-codes.md` 에서 명시되지 않아 경계 모호성이 존재하고, (2) `10-graph-rag.md` 의 `## Overview` 내 numbered 섹션과 이후 본문의 이중 구조가 독자 혼동을 유발할 수 있다. 두 사안 모두 채택 시 다른 시스템의 invariant를 깨는 수준(CRITICAL)은 아니며, 문서 정교화 또는 규약 경계 명시로 해결 가능하다.

## 위험도

LOW
