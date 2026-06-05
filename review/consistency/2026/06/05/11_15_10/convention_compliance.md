# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (검토 범위: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` — 페이로드에 포함된 문서)
검토 기준: `spec/conventions/` 정식 규약 전체

---

## 발견사항

### [INFO] `1-auth.md` — Overview 섹션 누락
- **target 위치**: `spec/5-system/1-auth.md` 상단 (frontmatter 직후)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". 개별 spec 파일의 3섹션 권장 구조는 각 SKILL.md 참조
- **상세**: `1-auth.md` 는 `## 1. 인증 (Authentication)` 으로 본문이 곧바로 시작한다. `## Overview` 섹션이 없어 제품 정의(이 spec 이 무엇을 다루는가)와 기술 본문의 경계가 명확하지 않다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 로 정상 분리돼 있다.
- **제안**: `## Overview` 섹션(1~3 문장, 이 spec 의 범위·목적 요약)을 frontmatter 아래에 추가한다. 또는 현행 상태가 의도적이라면 (짧은 인증 spec 에서 Overview 가 불필요하다고 판단) 규약 문서에 예외 기준을 명시한다.

---

### [INFO] `11-mcp-client.md` — Rationale 섹션 누락
- **target 위치**: `spec/5-system/11-mcp-client.md` 끝부분 (§12 확장 포인트 이후)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `11-mcp-client.md` 는 §12 확장 포인트로 끝나며 `## Rationale` 섹션이 없다. `1-auth.md` · `10-graph-rag.md` 는 모두 문서 끝에 `## Rationale` 를 보유한다. MCP 클라이언트 설계에는 transport 선택(Streamable HTTP only, stdio 미지원), Internal Bridge 패턴, skipReason 명명 분리 등 다수의 설계 결정이 본문 인라인 주석으로 흩어져 있다.
- **제안**: `## Rationale` 섹션을 추가하고, 본문 인라인으로 설명된 설계 결정(transport 선택 §2.2, skipReason `lower_snake_case` 분리 §6.2, 세션 per-execution 정책 §4.3 등)의 근거를 통합 이전한다. 또는 인라인 근거가 충분하고 별도 섹션이 불필요하다는 판단이면 규약 문서에 "인라인 Rationale 허용 조건"을 명시한다.

---

### [WARNING] `11-mcp-client.md §6.2` — `skipReason` `lower_snake_case` 사용이 명시 규약과 다름
- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 (`mcpDiagnostics` 섹션, `skipReason vocabulary` 표)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`"; `spec/conventions/error-codes.md §1` — 프로젝트 전체 에러 코드 문자열에 적용
- **상세**: `skipReason` 값(`expired_install_timeout`, `expired_refresh_failed` 등)이 `lower_snake_case` 로 정의된다. spec 본문에서 "에러 코드가 아닌 운영 진단용 enum 이라 `UPPER_SNAKE_CASE` 규약과 구분된다"고 명시해 의도적인 이탈임을 밝히고 있다. 그러나 `error-codes.md §1` 의 "적용 범위" 조항은 "API·통합 등에서 인라인 문자열 리터럴로 발행되는 코드(`CAFE24_*`, `OAUTH_*` 등)를 포함한다"고 하며, 본 필드는 API 응답(`meta.mcpDiagnostics`)의 일부로 외부에 노출된다.
- **제안**: 두 가지 해소 경로 중 하나를 선택한다.
  1. `skipReason` 값을 `UPPER_SNAKE_CASE` 로 변경하고 `Integration.status_reason` 과의 정렬이 필요하면 매핑 레이어를 둔다. 이 경로는 신규 정의이므로 breaking change 없이 처음부터 일관성을 확보한다.
  2. `skipReason` 이 "에러 코드가 아닌 운영 진단 내부 enum"임을 `error-codes.md §3 historical-artifact 레지스트리` 에 등재하거나, `error-codes.md §1 적용 범위` 조항에 "운영 진단 내부 enum(`skipReason` 등)은 제외"를 명시해 규약을 갱신한다.

---

### [INFO] `1-auth.md §1.5.4` — `lower_snake_case` 초대 에러 코드의 `error-codes.md §3` 레지스트리 등재 확인
- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 + 주석
- **위반 규약**: `spec/conventions/error-codes.md §3 historical-artifact 예외 레지스트리`
- **상세**: `1-auth.md §1.5.4` 본문 주석이 "historical-artifact 예외 레지스트리에 등재해 유지한다"고 명시한다. 실제로 `error-codes.md §3` 레지스트리에 해당 6개 코드(`invitation_not_found` 등)가 등재돼 있어 규약 준수 상태다. 이 항목은 현재 문제가 없으나, `lower_snake_case` 패턴이 `skipReason` 와 중복될 경우 레지스트리 운영 원칙("신규 코드는 예외를 선례로 삼지 않는다")이 재확인 필요하다.
- **제안**: 현행 유지 (이미 규약 준수). 다만 `skipReason` 처리(위 WARNING) 를 선례로 해석해 새 `lower_snake_case` 코드를 추가하는 상황을 방지하기 위해 레지스트리 주석에 "진단 enum 은 별도 처리" 방침을 추가하면 명확해진다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 응답 `order` wrapper 설명 오류
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` §Operations `GET` 및 `POST` 응답 파라미터 표의 첫 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
- **상세**: `GET /api/v2/admin/appstore/orders/{order_id}` 응답의 최상위 `order` 필드 설명이 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 로 기재돼 있다. 이는 응답 wrapper 설명이 아닌 다른 필드(`sort_order` 계열)의 설명이 잘못 삽입된 것이다. `_overview.md §7.2` 규약에 따르면 wrapper row 의 설명은 `(응답 객체)` 이어야 한다. `POST /api/v2/admin/appstore/orders` 응답도 동일하게 오기재됐다.
- **제안**: 두 operation 의 `order` wrapper row 설명을 `(응답 객체)` 로 수정한다. 이는 생성기 파싱 버그로 보이며, 재생성 시 동일 오류가 재현될 가능성이 있으므로 `_generator.py` 의 wrapper row 설명 추출 로직을 확인한다.

---

## 요약

`spec/5-system/` 의 검토 대상 3개 파일(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)은 전반적으로 정식 규약을 준수한다. frontmatter(`id`/`status`/`code`/`pending_plans`) 는 `spec-impl-evidence.md §2` 요건을 충족하고, 에러 코드 naming 의 `lower_snake_case` 예외는 `error-codes.md §3` 에 적법하게 등재되어 있다. 주요 미흡점은 두 가지다: `1-auth.md` 의 `## Overview` 섹션 부재와, `11-mcp-client.md` 의 `## Rationale` 섹션 부재. 이 두 항목은 CLAUDE.md 권장 3섹션 구조(Overview / 본문 / Rationale)에서 벗어나지만 내용 자체의 정확성을 해치지는 않는다(INFO 등급). 더 주목할 점은 `11-mcp-client.md §6.2` 의 `skipReason` `lower_snake_case` 사용으로, 본문 내에서 규약 이탈 근거를 설명하고 있으나 `error-codes.md §1`·`node-output.md` 의 적용 범위와 충돌하며 `error-codes.md §3` 레지스트리에도 등재되지 않은 상태여서(WARNING) 규약 갱신 또는 레지스트리 등재가 필요하다. `cafe24-api-catalog` 의 `appstore-orders.md` wrapper 설명 오류는 생성기 산출물의 파싱 버그로 확인된 INFO 사항이다.

## 위험도

LOW
