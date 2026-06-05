# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (구현 착수 전 —impl-prep)
검토 대상: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`
검토 규약: `spec/conventions/` 전체

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md` — Overview 섹션 누락

- target 위치: `spec/5-system/1-auth.md` 전체 구조 (파일 상단 — `## 1. 인증` 바로 시작)
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: 파일은 `# Spec: 인증/인가 시스템` 제목 뒤 바로 `## 1. 인증 (Authentication)` 으로 진입한다. `## Overview` 섹션이 없다. 반면 `## Rationale` 는 파일 말미(라인 412)에 존재한다. 3섹션 중 Overview 만 빠진 형태.
- 제안: 파일 상단 frontmatter 아래, 관련 문서 링크 블록과 `## 1. 인증` 사이에 `## Overview` 섹션을 추가해 제품 정의·목적 요약을 담는다 (인증 시스템 전체 범위·지원 방식 개요 1~2 문단). CLAUDE.md 권장 구조에 맞춘다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — Overview 섹션 누락 및 Rationale 섹션 부재

- target 위치: `spec/5-system/11-mcp-client.md` 전체 구조
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: 파일은 `## 1. 개요`(한국어 제목 혼용)로 시작하며 `## Overview` 표준 헤딩이 없다. 더 중요하게, 12개 섹션(§1~§12) 을 거쳐도 `## Rationale` 섹션이 전혀 없다. 본문 내 설계 결정 근거가 inline 산재(예: §2.2 stdio 미지원 사유, §4.3 세션 비풀링 근거)되어 있으나 공식 Rationale 섹션으로 집약되지 않는다.
- 제안:
  1. `## 1. 개요` 앞에 `## Overview` 섹션 추가(또는 `## 1. 개요`를 `## Overview`로 리네임) — MCP Client 의 목적·범위·MVP 경계 요약.
  2. 파일 말미에 `## Rationale` 섹션 추가 — stdio 미지원 결정, Internal Bridge vs 외부 HTTP 분리 구조, 세션 비풀링 정책, `skipReason` lower_snake_case 선택 등 현재 inline 에 흩어진 핵심 결정 근거를 집약.

---

### [INFO] `spec/5-system/10-graph-rag.md` — Overview 헤딩에 불필요한 parenthetical

- target 위치: `spec/5-system/10-graph-rag.md` 라인 29: `## Overview (제품 정의)`
- 위반 규약: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" — 헤딩 표준은 `## Overview`
- 상세: `## Overview (제품 정의)` 형태로 헤딩에 parenthetical suffix 가 붙어 있다. 이 파일은 세 섹션을 모두 갖추고 있어 구조적으로 준수하지만, `## Overview` 가 아닌 변형 헤딩을 쓰면 자동 파싱·cross-reference 시 불일치가 발생할 수 있다.
- 제안: `## Overview (제품 정의)` → `## Overview` 로 단순화. 내용은 그대로 유지.

---

### [INFO] `spec/5-system/1-auth.md §1.5.4` — lower_snake_case 에러 코드 (historical-artifact, 이미 등재)

- target 위치: `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 및 해당 주석 블록
- 위반 규약: `spec/conventions/error-codes.md §1` `UPPER_SNAKE_CASE` 의미 기반 명명 원칙
- 상세: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 는 모두 `lower_snake_case`. 그러나 `1-auth.md §1.5.4` 주석이 이미 "historical-artifact 예외" 임을 명시하고, `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 정확히 등재되어 있다. 규약 위반이 아닌 관리된 예외 상태.
- 제안: 추가 조치 불필요. 신규 초대 관련 에러 코드를 추가할 경우 반드시 `UPPER_SNAKE_CASE` 를 사용해야 함을 팀이 인지하고 있는지 확인 권장 (spec 주석이 이를 명시하므로 현재 양호).

---

### [INFO] `spec/5-system/11-mcp-client.md §6.2` — `skipReason` lower_snake_case (의도적 명명 분리, 문서화됨)

- target 위치: `spec/5-system/11-mcp-client.md §6.2` `skipReason vocabulary` 표
- 위반 규약: `spec/conventions/node-output.md §3.2` `code` 필드 `UPPER_SNAKE_CASE` 규약
- 상세: `expired_install_timeout`, `expired_refresh_failed`, `pending_install`, `lookup_failed`, `not_capable` 등이 `lower_snake_case`. 단, §6.2 의 명명 규칙 분리 주석 ("skipReason 값은 모두 lower_snake_case 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum") 이 이 선택을 명시적으로 정당화하고 있다. `code` 필드(예: `MCP_AUTH_FAILED`, `MCP_TIMEOUT`)와 `skipReason` 필드를 구분하는 의도적 설계.
- 제안: 현재 문서 내 주석이 명확히 설명하고 있으므로 추가 조치 불필요. 단, `spec/conventions/node-output.md §3.2` 또는 `spec/conventions/error-codes.md` 에 "운영 진단용 식별자(skipReason 류) 는 lower_snake_case 허용" 이라는 명시적 패턴을 한 줄 추가하면 향후 유사 판단을 일관되게 만들 수 있다.

---

### [INFO] `spec/5-system/10-graph-rag.md §6` — `document:graph_error` dead-declared 이벤트

- target 위치: `spec/5-system/10-graph-rag.md §6` WebSocket 이벤트 표 하단 주석
- 위반 규약: 직접적 정식 규약 위반 없음
- 상세: `document:graph_error` 가 `websocket.service.ts` 타입 union 에만 존재하고 실제 emit 되지 않는다는 사실이 spec 에 주석으로 기록되어 있다. spec 이 dead-declared 심볼을 사실 기반으로 문서화하고 있어 spec 자체는 정확하다. 그러나 구현 코드의 타입 union 에 미사용 이벤트 타입이 남아 있는 상태를 spec 이 "정상"으로 용인하는 구조가 되어 있음.
- 제안: `plan/in-progress/` 에 해당 dead-declared 이벤트 정리(타입 union 에서 제거 또는 emit 경로 추가)를 추적하는 항목을 추가하는 것을 권장. Spec 문서 자체는 현재 상태를 정확히 기술하고 있으므로 수정 불필요.

---

## 요약

`spec/5-system/` 의 세 파일 중 `10-graph-rag.md` 는 Overview / 본문 / Rationale 3섹션 구조를 대체로 준수하고 에러 코드·출력 포맷 규약 위반이 없다. `1-auth.md` 는 Rationale 을 갖추었으나 Overview 섹션이 누락되어 있다. `11-mcp-client.md` 는 Overview 와 Rationale 섹션이 모두 부재하며, 이는 CLAUDE.md 의 권장 문서 구조에서 가장 크게 이탈한 파일이다. 에러 코드 표기와 API endpoint 명명은 정식 규약을 준수하거나 historical-artifact 예외로 명시 등재되어 있어 Critical 위반이 없다. 전반적으로 구조 규약 미준수(WARNING 2건)가 핵심 발견이며, INFO 3건은 기존에 의도적으로 처리된 사항이다.

## 위험도

LOW
