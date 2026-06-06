# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system` (구현 완료 후 검토, --impl-done, diff-base=origin/main)
검토 범위: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`
검토 기준: `spec/conventions/**`

---

## 발견사항

### [INFO] `10-graph-rag.md` — Overview 섹션 구조 혼재

- target 위치: `spec/5-system/10-graph-rag.md` 상단 (## Overview (제품 정의) → ## 1. 개요)
- 위반 규약: CLAUDE.md 문서 구조 권장 ("Overview / 본문 / Rationale 3섹션 권장")
- 상세: `10-graph-rag.md`는 `## Overview (제품 정의)` 라는 제목으로 시작하는 상위 섹션이 있고 그 안에 §1 목표·§2 범위·§3 요구사항·§4 기술결정·§5 비기능·§6 Phase·§7 의존성·§8 미결 전체를 포함한다. 이후 다시 `## 1. 개요`·`## 2. 데이터 모델` 등 본문 기술 섹션이 이어진다. 3섹션 구조(Overview / 본문 / Rationale)의 Overview와 본문이 이중으로 병렬 존재하는 형태로, 문서 내 계층이 비직관적이다.
- 제안: `## Overview (제품 정의)` 아래의 §1~§8 중 제품 정의에 해당하는 부분을 Overview로 압축하고, `## 1. 개요` 이후를 단일 본문으로 통합하거나 두 섹션을 구분 의도에 맞게 재편 — 또는 현행 구조가 의도된 것이라면 CLAUDE.md 권장 사항 미준수를 주석으로 명시. 규약 갱신보다는 target 정리 권장.

---

### [WARNING] `1-auth.md §1.5.4` — 에러 코드 `lower_snake_case` historical-artifact 주석이 규약 SoT를 제대로 참조하나, 코드 표에 `forbidden`·`rate_limited` 도메인 한정임을 충분히 명시하지 않음

- target 위치: `spec/5-system/1-auth.md §1.5.4 에러 응답`, `>` 블록 아트
- 위반 규약: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 + `node-output.md §3.2` (`code`는 `UPPER_SNAKE_CASE`)
- 상세: §1.5.4 표 안의 `forbidden`, `rate_limited` 두 코드는 `lower_snake_case`다. 이는 `error-codes.md §3` 레지스트리에 등재되어 있고, 바로 아래 `>` note 블록에 이 사실과 역사적 근거, `error-codes.md §3` 참조를 명시하고 있다. 따라서 규약 위반이 **아님** — 레지스트리 등재가 정당화한다.
  - 단, `forbidden`·`rate_limited` 두 코드는 **"초대 API 한정 historical artifact"** 라고 `error-codes.md §3` 에 명시되어 있는데, auth spec §1.5.4 의 note 블록도 "초대 흐름 전용"이라고 맥락을 적어 둔다. 다만 표 자체의 `forbidden` / `rate_limited` 행에 "이 컨텍스트에서만 유효한 historical artifact" 인라인 마커가 없어 표를 읽을 때 다른 도메인에서도 같은 코드를 쓰는 것으로 오해할 수 있다.
- 제안: 표의 `forbidden`·`rate_limited` 행 설명 셀에 `(historical-artifact, 초대 API 한정)` 인라인 주석을 추가해 표 맥락에서도 예외 여부가 즉시 드러나도록 함. WARNING 수준: 규약 자체는 충족(레지스트리 등재)했으나 표 단독 가독성의 문서 일관성 이슈.

---

### [INFO] `11-mcp-client.md §6.2` — `skipReason` vocabulary의 `lower_snake_case` 사용이 규약과의 관계를 설명하나 위치가 이상함

- target 위치: `spec/5-system/11-mcp-client.md §6.2 진단 누적` 아래 "명명 규칙 분리" 인라인 박스
- 위반 규약: `spec/conventions/node-output.md §3.2` (`code` 필드는 `UPPER_SNAKE_CASE`)
- 상세: `skipReason` 값이 `lower_snake_case` (`expired_install_timeout`, `expired_refresh_failed` 등)인 이유를 "운영 진단용 enum이라 에러 코드 UPPER_SNAKE_CASE 규약과 구분된다"고 문서 내부에서 명시 설명하고 있다. 이 자체 설명은 충분하며 규약 정책과 충돌하지 않는다 — `node-output.md §3.2`의 `UPPER_SNAKE_CASE`는 `output.error.code` 필드에 적용되고, `skipReason`은 `meta.mcpDiagnostics.serverSummaries[].skipReason`으로 별도 진단 필드다.
- 제안: 현재 설명 자체로 충분하나, `error-codes.md §1`의 "의미 기반 명명" 취지까지 `skipReason` enum에 적용했는지 향후 검토 시 참고할 만하다. INFO 수준.

---

### [INFO] `11-mcp-client.md §8.1` — `tool_result.error` 필드의 구조가 `node-output.md §3.2` 표준 형태와 상이함

- target 위치: `spec/5-system/11-mcp-client.md §8.1` 표의 `tools/call 실패` 처리 설명: `{ "error": "<code>", "message": "..." }`
- 위반 규약: `spec/conventions/node-output.md §3.2` `output.error` 표준 형태 (`{ code, message, details }`)
- 상세: `tool_result`는 MCP 프로토콜의 `tool_result` 객체이며, 이는 노드 핸들러의 `NodeHandlerOutput.output.error`와 다른 레이어다. MCP `tool_result` 는 MCP 표준 형식을 따르는 것이 맞고, `node-output.md`의 규약은 노드 핸들러 출력 레이어에 적용된다. 따라서 직접 위반은 아니다. 단, 독자가 두 레이어의 에러 포맷을 혼동할 수 있다.
- 제안: `tool_result.error`가 노드 output.error 표준이 아닌 MCP 프로토콜 레이어 표현임을 brief 주석으로 명시하면 독자 혼동 방지에 도움. 규약 갱신 불필요, 문서 명확화만으로 해결.

---

### [INFO] `10-graph-rag.md` — `spec/conventions/spec-impl-evidence.md` frontmatter의 `id` 값이 파일명과 일치

- target 위치: `spec/5-system/10-graph-rag.md` frontmatter `id: graph-rag`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` ("파일 basename 기반 권장")
- 상세: 파일명은 `10-graph-rag.md`이고 `id: graph-rag`다. `10-` prefix 숫자는 id에 포함되지 않는다. `spec-impl-evidence.md §2.1`은 "파일 basename 기반 권장"이라 하며, `basename(확장자 제외) = 10-graph-rag`와 `id = graph-rag`는 엄밀히 다르다. 다만 해당 가드 테스트(`spec-frontmatter-parse.ts`)의 검증이 `id`가 고유하고 유효한 kebab-case인지만 보는 것으로 보이며 파일명 1:1 매칭을 강제하지 않는다. "권장" 수준이므로 현행 방식(prefix 숫자 제외)이 일관되게 사용되고 있다면 INFO.
- 제안: 현행 패턴(`id`에서 숫자 prefix 제외)이 `spec/5-system/` 내 모든 파일에서 일관하게 사용되고 있다면 문제없음. 향후 가드 확장 시 `id` = `basename-without-numeric-prefix` 패턴을 명시적으로 허용으로 문서화 권장.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 응답 필드 설명에 상위 `order` wrapper 설명이 잘못됨

- target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `GET` 응답 표의 첫 번째 행 `order` 필드 설명: "정렬 순서 asc : 순차정렬 · desc : 역순 정렬"
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` ("wrapper는 `(응답 객체)` / `(목록)` 으로 표기")
- 상세: `order` wrapper 행의 `설명` 셀이 "정렬 순서 asc : 순차정렬..."로 채워져 있는데, 이는 다른 API에서 쿼리 파라미터 `order`의 설명이 잘못 복사된 것으로 보인다. `_overview.md §7.2`는 wrapper 행은 `(응답 객체)`로 표기하도록 규정한다. `POST /api/v2/admin/appstore/orders`의 같은 `order` wrapper 행도 동일하게 잘못된 설명을 갖는다.
- 제안: `order` wrapper 행의 설명을 `(응답 객체)`로 수정. 이는 카탈로그 생성기 산출물이므로 재생성하거나 수동 교정 필요.

---

## 요약

`spec/5-system` 하위 3개 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)와 `spec/conventions/cafe24-api-catalog/application/` 하위 파일에서 정식 규약을 **직접 위반(CRITICAL)**하는 항목은 발견되지 않았다. 에러 코드 대소문자(`invitation_*`, `forbidden`, `rate_limited`)는 `error-codes.md §3` historical-artifact 레지스트리에 적법하게 등재되어 있어 규약 예외로 정당화된다. 발견된 항목들은 문서 구조의 가독성 이슈(INFO 3건), 레지스트리 등재 사실을 표 내부에서 더 명확히 표시할 필요(WARNING 1건), 그리고 생성기 산출물의 wrapper 행 설명 오기재(INFO 1건)에 그친다. 전반적으로 규약 준수 수준이 양호하며, WARNING 1건은 신규 코드 추가 시 선례 오독 위험이 있으므로 단기 수정이 권장된다.

## 위험도

LOW
