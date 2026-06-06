# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
검토 규약: `spec/conventions/` 전체 (node-output.md, error-codes.md, swagger.md, cafe24-api-catalog/_overview.md)

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — Overview 섹션 헤더 없음
- **target 위치**: `spec/5-system/1-auth.md` 파일 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: `1-auth.md` 는 `## 1. 인증`, `## 2. 세션 관리`, `## 3. 인가` 등 본문이 바로 시작되며 `## Overview` 섹션이 없다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 명시적으로 보유한다. 권장 3섹션(Overview / 본문 / Rationale) 중 Overview 가 누락된 점은 사소한 형식 불일치다. Rationale 은 파일 끝에 정상 존재.
- **제안**: 파일 상단에 `## Overview` 섹션을 추가하거나(현재 RBAC·JWT·세션 정책의 제품 목적을 1~2문단으로 요약), 혹은 규약이 "1-auth.md 는 이미 `_product-overview.md` 에 Overview 대리를 두므로 생략 허용"임을 명시한다면 INFO 로 관리해도 무방.

---

### [WARNING] `spec/5-system/1-auth.md §1.5.4` — 초대 에러 코드 lower_snake_case 가 `historical-artifact 레지스트리`에만 등재, 본문 안내가 자기참조로 순환
- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표 + 하단 주석 박스
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 UPPER_SNAKE_CASE 원칙) + `§3` (historical-artifact 레지스트리)
- **상세**: 표에 `invitation_not_found` 등 6개 `lower_snake_case` 코드가 등재되어 있으며, 주석 박스가 스스로 `error-codes.md §3 historical-artifact 레지스트리에 등재해 유지한다`고 명시한다. `error-codes.md §3` 테이블을 확인하면 6개 코드 모두 실제로 등재되어 있어 규약 절차는 준수된다. 다만 주석 박스의 `forbidden` / `rate_limited` (lower_snake_case 초대 전용)와 다른 API 의 범용 `FORBIDDEN` / `RATE_LIMITED` (UPPER_SNAKE_CASE) 가 혼동될 위험성이 있다. 이 점은 `error-codes.md §3` 주석에 "본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact"임을 명시했으므로 규약적으로는 처리됐다. 그러나 구현 담당자가 새 초대 관련 에러를 추가할 때 lowercase 선례를 오용하는 리스크가 있다.
- **제안**: `1-auth.md §1.5.4` 주석 박스 끝에 "**신규 추가 코드는 본 예외를 선례로 삼지 않고 UPPER_SNAKE_CASE 를 사용한다**" 경고를 더 눈에 띄게 강조한다(현재 `error-codes.md §3` 에는 있으나 `auth.md` 에는 누락).

---

### [INFO] `spec/5-system/10-graph-rag.md` — Overview 와 본문 섹션 순서 불일치
- **target 위치**: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 이후 `### 1. 목표` ~ `### 8. 미결 / 후속 검토` 가 있고, 그 다음 `## 1. 개요` 가 다시 시작됨
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `## Overview (제품 정의)` 섹션 안에 `### 1. 목표` ~ `### 8. 미결` 까지 상세 요구사항이 전부 포함되어 있고, 이후 `## 1. 개요`, `## 2. 데이터 모델` 등의 본문 섹션이 이어진다. 이는 Overview 섹션이 사실상 PRD + 요구사항 전체를 흡수하는 구조여서 Overview / 본문 경계가 모호하다. 기능적으로는 완전하나, 규약상 Overview 는 "제품 정의 요약"이고 본문이 "기술 명세"여야 하므로 현 구조는 두 레이어가 뒤섞인 형태다.
- **제안**: 현행 구조를 유지하되, Overview 내의 `### 3. 요구사항` ~ `### 8. 미결` 을 본문 섹션(혹은 별도 `## 요구사항` 섹션)으로 이동하거나, 또는 현 형태를 팀 내 관례로 수용하여 spec 문서 3섹션 설명에 "대형 spec 문서의 경우 Overview 가 PRD 를 포함할 수 있다"는 예외 주석을 추가한다. 구현 착수에 차단 요소는 아님.

---

### [INFO] `spec/5-system/11-mcp-client.md §6.2` — `skipReason` lower_snake_case 명명이 자체 문서 내 근거 명시 있으나 위치 기술이 혼동 가능
- **target 위치**: `spec/5-system/11-mcp-client.md §6.2 진단 누적 — skipReason vocabulary` 표 위 주석 박스
- **위반 규약**: `spec/conventions/node-output.md §3.2` (`code` 는 UPPER_SNAKE_CASE) + `spec/conventions/error-codes.md §1`
- **상세**: `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed` 등)이 모두 `lower_snake_case` 이며, 문서 내 주석 박스가 "본 필드는 에러 코드가 아닌 운영 진단용 enum이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"고 명시한다. 에러 코드가 아닌 진단용 enum 임을 근거로 lower_snake_case 를 택한 결정이 문서에 명시되어 있어 `error-codes.md §1` 적용 대상에서 자체 제외했다. 규약 적용 범위 경계 판단이 올바르고, 결정 근거도 충분히 명시됨. 다만 `error-codes.md §1` 은 "프로젝트 전체 에러 코드 문자열"에 적용된다고 선언하며, `skipReason` 이 에러 코드가 아님을 `error-codes.md` 측에서도 명시적으로 언급하지 않으므로 독립적인 코드 읽기 시 혼동 가능성 있음.
- **제안**: 현재 처리 수준(자체 주석 박스에 근거 명시)은 INFO 수준으로 충분. 추가로 `error-codes.md §1` 적용 범위 설명에 "진단용 enum(`skipReason` 등) 은 에러 코드로 분류되지 않으므로 제외" 와 같은 한 줄을 추가하면 양쪽 문서에서 완결된다.

---

### [INFO] `spec/5-system/11-mcp-client.md §3.1` — Internal Bridge service_type 표의 `makeshop` 미등재
- **target 위치**: `spec/5-system/11-mcp-client.md §3.1 Internal Bridge 적용 service_type` 표
- **위반 규약**: 문서 자체의 단일 진실 원칙 (CLAUDE.md "정보 저장 위치")
- **상세**: §2.3 본문에서 "현재 `cafe24`, `makeshop`"이라고 명시하나 §3.1 표에는 `cafe24` 만 등재되어 있고 `makeshop` 은 누락되어 있다. 이는 스펙 내부 일관성 불일치이나, 구현을 지시하는 코드 경로에는 영향이 없다(makeshop 관련 spec 링크가 §2.3 본문에 존재).
- **제안**: §3.1 표에 `makeshop` 행 추가: `| makeshop | MakeshopMcpToolProvider | [Spec MakeShop 노드 §8](../4-nodes/4-integration/5-makeshop.md#8-ai-agent-노출-internal-mcp-bridge) |`

---

### [INFO] `spec/5-system/10-graph-rag.md §7` — 에러 처리 표의 에러 코드가 `UPPER_SNAKE_CASE` 아닌 영문 설명으로만 표기
- **target 위치**: `spec/5-system/10-graph-rag.md §7 에러 처리` 표 + `§7.1 Retry & Failure 정책`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 에러 코드 + UPPER_SNAKE_CASE 원칙)
- **상세**: §7 표의 "처리" 열은 상태 필드명(예: `graph_extraction_status = 'failed'`)과 동작 설명만 기술하고, 클라이언트/API 에 노출될 에러 코드 (`UPPER_SNAKE_CASE`) 를 별도로 명시하지 않는다. 단, `§7 "re-extract 동시 호출"` 행에서는 `409 KB_REEXTRACT_IN_PROGRESS` 코드를 올바르게 UPPER_SNAKE_CASE 로 명시하고 있어 일관성이 부분적으로만 유지된다. Graph RAG 추출 실패는 주로 내부 큐 처리이고 HTTP API 에러 코드 대신 WebSocket 이벤트로 클라이언트에 전달되므로, API 에러 코드 부재가 직접적인 규약 위반은 아니다. 다만 `§5 API` 에 정의된 엔드포인트(예: `POST .../re-extract`)의 에러 응답 코드가 스펙에 없는 점은 잠재적 gap.
- **제안**: `§5 API` 표에 각 엔드포인트별 에러 응답 코드 열 또는 주석을 추가한다(예: re-extract 충돌 → 409 `KB_REEXTRACT_IN_PROGRESS`, graph 모드 아닌 KB → 400 `INVALID_KB_MODE`). 구현 시 에러 코드를 처음부터 UPPER_SNAKE_CASE 로 정의하도록 안내.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 응답 파라미터 표 첫 행 설명 오기입
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `GET /api/v2/admin/appstore/orders/{order_id}` 응답 파라미터 표, 첫 번째 행 (`order`)
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "응답 파라미터 표: 대표 응답 샘플에 나타난 필드를 정리"
- **상세**: 응답 파라미터 표 첫 행의 `order` 필드에 `제약` 없음, `설명` = "정렬 순서 asc : 순차정렬 · desc : 역순 정렬"이 기재되어 있다. 이는 응답 `order` 객체(주문 정보 wrapper)의 설명이 아니라 쿼리 파라미터 `order`(정렬 방향)의 설명이 잘못 복사된 것으로 보인다. `POST /api/v2/admin/appstore/orders` 응답 파라미터 표에서도 동일한 오기입이 반복된다. Cafe24 공식 docs 기준으로는 해당 `order` 는 wrapper 객체이므로 `(응답 객체)` 로 표기되어야 한다.
- **제안**: `order` 행의 설명을 `(응답 객체)` 로 교정한다. `_overview.md §7.2` 에 "wrapper 행은 `(응답 객체)` 또는 `(목록)` 으로 표기" 규칙이 명시되어 있음.

---

## 요약

`spec/5-system/` 대상 문서들은 전반적으로 정식 규약을 잘 따르고 있다. 에러 코드 규약(`error-codes.md`)의 경우, lower_snake_case 예외 코드는 모두 `historical-artifact 레지스트리`에 적절히 등재되어 있으며, `node-output.md §3.2` 의 UPPER_SNAKE_CASE 요건도 에러 코드가 아닌 필드(`skipReason`)에 대한 자체 근거 명시를 통해 처리됐다. 문서 구조(Overview / 본문 / Rationale) 측면에서는 `1-auth.md` 의 Overview 섹션 부재, `10-graph-rag.md` 의 Overview ↔ 본문 경계 혼재가 경미한 형식 불일치로 존재한다. `11-mcp-client.md §3.1` 의 makeshop 미등재와 `cafe24-api-catalog` 필드 오기입은 사소한 내부 일관성 문제다. 구현 착수를 차단할 CRITICAL 위반 사항은 없다.

## 위험도

LOW
