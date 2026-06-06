# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system` (구현 완료 후 검토 --impl-done, diff-base=origin/main)
검토 기준: `spec/conventions/**` 정식 규약 전체

---

## 발견사항

### [INFO] `1-auth.md` — `10-graph-rag.md` 문서 구조: Overview 섹션 위치 불일치

- **target 위치**: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 섹션 (파일 내 첫 본문 섹션)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- **상세**: `10-graph-rag.md` 는 단일 파일 안에 Overview (제품 정의) + 본문 기술 명세 + Rationale 3섹션을 모두 포함하고 있어 CLAUDE.md 권장 구조를 준수한다. 다만 Overview 섹션 하위에 `### 1. 목표` `### 2. 범위` 등이 위치해 있고, 이어서 `## 1. 개요` `## 2. 데이터 모델` 등 본문 섹션이 별도로 시작한다. Overview 와 본문이 같은 파일 안에서 heading 체계가 혼용되어 약간의 중복 구조가 있다 (`## Overview` 하위 `### 3. 요구사항` 과 `## 3. 그래프 추출 파이프라인` 이 의미상 인접하나 섹션 위계가 다름).
- **제안**: 현재 구조는 허용 범위 내이며 가드 위반은 없다. 필요하다면 Overview 는 `_product-overview.md` 로 분리하거나, `### 요구사항` 을 본문 섹션(`## 3.`) 에 통합하여 Overview / 본문 / Rationale 3-tier 를 명확히 할 수 있다. 현 상태로 두어도 규약 위반은 아님.

---

### [INFO] `11-mcp-client.md` — `skipReason` 명명 규약 예외 자기 선언 문서화 양호 (참고)

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 진단 누적
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`) · `spec/conventions/error-codes.md §1`
- **상세**: `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed`, …)이 `lower_snake_case` 로 정의되어 있다. 이에 대해 spec 본문이 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` 의 `code` UPPER_SNAKE_CASE 규약과 구분된다" 고 명시적으로 근거를 밝히고 있다. 이 설명은 conventions 의 적용 범위(`code` 필드)와 `skipReason` 필드(진단 enum)를 올바르게 구분한다. 단, `error-codes.md §1` 의 "프로젝트 전체 에러 코드 문자열"이라는 적용 범위 선언이 `skipReason` 을 포함하는지 경계가 다소 불명확하다.
- **제안**: 현재 spec 본문의 자기 선언(근거 명시)이 충분하고, `error-codes.md §3 historical-artifact` 에 등재할 필요는 없다(에러 코드가 아닌 진단 enum 이므로). INFO 수준으로 충분.

---

### [WARNING] `1-auth.md §1.5.4` — historical-artifact 예외 레지스트리 자기 선언은 spec 과 conventions 양쪽에 올바르게 등재되었으나, spec 본문 설명 표현 일부가 conventions 원문과 미묘하게 다름

- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 주석 블록
- **위반 규약**: `spec/conventions/error-codes.md §3` historical-artifact 예외 레지스트리
- **상세**: `1-auth.md §1.5.4` 는 초대 에러 코드 `lower_snake_case` 예외에 대해 "v1 출하 시 이 형태로 정착했고 프론트엔드가 `code` 값으로 직접 분기하므로, rename 은 API breaking change 가 된다(`error-codes.md §2` 「이름 정확성 향상만을 위한 rename 은 하지 않는다」). 따라서 `error-codes.md §3` historical-artifact 레지스트리에 등재해 유지한다" 고 명시한다. `error-codes.md §3` 실제 레지스트리에도 동일 코드 목록이 등재되어 있다. 그러나 `1-auth.md` 에서 `forbidden` 과 `rate_limited` 를 "초대 흐름 전용"이라고 설명하는 반면, `error-codes.md §3` 의 레지스트리 "진실(의미)" 항에는 "초대 API 한정 — 본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다"라고 명시되어 있어 내용은 일치한다. 다만 `1-auth.md` 본문 주석에서는 `forbidden`/`rate_limited` 의 "초대 전용" 성격을 명시적으로 언급하지 않아 독자가 같은 레지스트리 항목임을 파악하기 위해 conventions 파일을 참조해야 한다.
- **제안**: 경미한 문서 완결성 이슈. `1-auth.md §1.5.4` 주석에 `forbidden` / `rate_limited` 의 "초대 흐름 전용 historical artifact" 임을 한 문장으로 추가하면 conventions 레지스트리와 완전히 동기화된다. 규약 위반은 아니나 일관성 향상 권장.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — `applications_list` / `webhooks_list` seed row 에서 `paginated` 컬럼 불일치 가능성

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 표, `applications_list` / `webhooks_list` 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §4` 동기 정책 규칙 3 (`paginated` 일치)
- **상세**: `applications_list` / `webhooks_list` 는 "cafe24 admin docs 에 노출되지 않는 미문서화 endpoint" 라는 주석이 있다. 해당 행의 `paginated` 컬럼이 공란인데, 미문서화 endpoint 의 경우 공식 docs 대조 없이 메타데이터의 `paginated: boolean` 값과 실제 일치하는지 확인이 불가하다. `catalog-sync.spec.ts` 규칙 3이 `status: supported` 행에 대해 `paginated` 일치를 강제하므로 테스트가 통과한다면 현재 메타데이터와 일치하는 것이지만, 미문서화 seed 는 wire 검증이 안 된 상태다.
- **제안**: 현재 catalog-sync 테스트가 통과하면 규약 위반은 없다. 미문서화 seed 의 `paginated` 미확인 상태는 `plan/in-progress/cafe24-backlog-residual.md §G-2` 의 운영 검증 트랙으로 추적하는 것이 적절하며, 이미 그렇게 되어 있다. INFO 유지.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — Operation 제목 오타 (docs URL 과 다름)

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `### GET /api/v2/admin/appstore/orders/{order_id}` 섹션 제목 및 Docs URL
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` 출처와 정확성 원칙 ("출처는 Cafe24 공식 Admin API Documentation 의 결정적 파싱")
- **상세**: 섹션 제목이 "Retreive a Cafe24 Store order" 로 되어 있고 (`Retrieve` → `Retreive` 오타), Docs URL 도 `#retreive-a-cafe24-store-order` 를 가리킨다. 이는 Cafe24 공식 docs 자체의 오타를 그대로 복사한 것으로, 생성기 산출물 원칙(docs 파싱 결정론적 재현)에는 부합하나 표기 부정확함이 있다.
- **제안**: 생성기 산출물이므로 doc 원문 오타를 그대로 보존하는 것이 올바른 정책(§7.3 "추측·날조로 field·샘플을 채우지 않는다"). 가드 대상도 아님. INFO.

---

### [WARNING] `10-graph-rag.md §Overview` — `## Overview (제품 정의)` 와 `## 1. 개요` 의 이중 도입부 구조

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: 파일 안에 `## Overview (제품 정의)` (요구사항·범위·Phase Plan·의존성·미결 포함) 와 별도로 `## 1. 개요` (기술 개요) 가 존재한다. 이 구조는 CLAUDE.md 권장 3섹션(Overview → 본문 → Rationale)과 맞지 않게 도입부가 두 개다. `## Overview` 가 §1~§3 요구사항 + §6 Phase Plan + §7 의존성 + §8 미결을 포함하고, `## 1. 개요` 가 별도 기술 서술로 시작해 섹션 중복 인상을 준다. 또한 `Rationale` 섹션이 파일 말미에 있어 3섹션 구조 자체는 유지하나, Overview 가 본문 분량에 근접해 경계가 불명확하다.
- **제안**: 규약 위반 자체라기보다 일관성 이슈. `## Overview` 는 제품 목적·범위·요구사항을 담고, `## 1. 개요` 를 제거하거나 본문 첫 섹션으로 흡수하는 것이 3섹션 구조에 더 부합한다. 현 diff 에서 신규 변경분이 없다면 수정 강제는 불필요.

---

### [INFO] `11-mcp-client.md §1` — 문서 구조: Overview/본문/Rationale 3섹션 중 Rationale 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 파일 구조
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 파일 내에 `## Rationale` 섹션이 없다. 기술 결정 배경은 본문 내 인라인 주석·설명(예: §2.2 stdio 미지원 사유, §3.2 URL 검증 §SSRF 정책, §5 메타도구 선택 이유)으로 분산되어 있다. CLAUDE.md 는 "각 SKILL.md 참고"라고 하며 Rationale 3섹션을 권장 구조로 명시한다.
- **제안**: 권장 구조이므로 CRITICAL/WARNING 은 아니다. 향후 spec 갱신 시 기술 결정의 배경 근거를 `## Rationale` 로 모아 3섹션 구조를 완성하면 일관성이 높아진다. INFO 수준.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — `_overview.md` 와의 섹션 제목 패턴 차이 (`## 표` vs 권장 없음)

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` `## 표` 섹션
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 표 컬럼 정의 (섹션 제목 형식 미지정)
- **상세**: `_overview.md` 는 각 resource 파일이 "다음 컬럼의 표를 가진다"고 명시하나 섹션 제목은 규정하지 않는다. `application.md` 는 `## 표` 로 지정하고 있는데, 다른 resource 파일(예: `product.md`, `order.md`)도 동일 패턴을 쓰는지 확인이 필요하다. 일관성 가드는 없으므로 INFO.
- **제안**: `_overview.md` 에 `## 표` (또는 다른 섹션 제목) 를 권장 패턴으로 명시하거나, 현재처럼 생략해도 무방. 기능적 문제 없음.

---

## 요약

`spec/5-system` 영역의 문서들은 전반적으로 정식 규약을 준수하고 있다. 가장 중요한 규약인 frontmatter 스키마(`id`/`status`/`code:`/`pending_plans:`)는 검토 대상 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)에서 올바르게 선언되어 있으며, `spec-impl-evidence.md` 의 가드를 통과한다. `_product-overview.md` 는 밑줄 prefix 로 frontmatter 면제 대상이며 올바르게 적용되어 있다. 에러 코드 규약(`error-codes.md`) 관련으로는 초대 흐름의 `lower_snake_case` historical-artifact 예외가 spec 본문과 conventions 레지스트리 양쪽에 등재되어 정합하다. `skipReason` enum 의 `lower_snake_case` 는 spec 본문에서 근거를 명시하여 `node-output.md` Principle 3.2 와의 구분을 적절히 설명하고 있다. `cafe24-api-catalog` 의 field-level 파일들은 생성기 산출물 규칙에 따라 frontmatter 면제가 올바르게 적용되며, 카탈로그 최상위 인덱스(`application.md`)는 `id`/`status: implemented` 를 보유하여 가드를 충족한다. 발견된 WARNING 2건은 모두 문서 구조의 일관성 이슈(Overview/본문 이중 구조, historical-artifact 인접 설명 누락)이며, 다른 시스템의 invariant 를 깨는 CRITICAL 위반은 없다.

## 위험도

LOW

STATUS: SUCCESS
