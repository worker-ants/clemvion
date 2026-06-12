# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 파일: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
적용 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### [INFO] `1-auth.md` §1.5.4 에러 코드 표 — historical-artifact 예외 명시가 충분함

- target 위치: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 하단 주석
- 위반 규약: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE` 의무), `§3` (historical-artifact 예외 레지스트리)
- 상세: `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` 여섯 코드가 `lower_snake_case` 다. 그러나 §1.5.4 하단 주석이 `error-codes.md §3` 예외 레지스트리 등재를 명시적으로 언급하고 있고, `error-codes.md §3` 표에도 이미 등재되어 있어 규약 위반 artifact 로 공식 처리된 상태다.
- 제안: 현행 유지. `lower_snake_case` 가 breaking 이유로 유지된다는 설명이 양쪽 문서에 일관하게 있어 추가 조치 불필요.

### [INFO] `10-graph-rag.md` — `## Overview` 섹션이 권장 3섹션(Overview / 본문 / Rationale) 구조를 부분적으로 변형

- target 위치: `spec/5-system/10-graph-rag.md` 최상단 `## Overview (제품 정의)` 블록
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 패턴
- 상세: `## Overview (제품 정의)` → 본문 섹션들(`## 1. 개요`, `## 2. 데이터 모델`, ...) → `## Rationale` 순서로 구성되어 있다. CLAUDE.md 는 "Overview / 본문 / Rationale 3섹션 권장" 이라고만 명시하며, Overview 헤딩에 `(제품 정의)` 접미어를 붙이거나 별도 `## 1. 개요` 섹션을 두는 것을 금지하지 않는다. 완전한 위반이 아니라 스타일 편차 수준이다.
- 제안: 불일치가 기능적 문제를 유발하지 않으므로 INFO 수준으로 처리. 향후 spec 작성 시 Overview 헤딩 표기를 `## Overview` 단독으로 통일하면 가독성이 더 높아진다.

### [INFO] `10-graph-rag.md` Rationale 섹션 — 하위 제목 구조가 다른 spec 과 다름

- target 위치: `spec/5-system/10-graph-rag.md` `## Rationale` 내부
- 위반 규약: CLAUDE.md 3섹션 구성 권장 (Rationale 섹션 하위 구조에 대한 명시적 규칙 없음)
- 상세: `## Rationale` 아래 `### Graph RAG 기획 결정` / `#### 도메인 용어` / `#### 사용자 결정` / `#### 결정 근거` / `#### 비-목표` 로 구성되어 있다. `1-auth.md` 는 `### 1.4.A — ...` 와 같이 번호+ID 패턴을 사용하는데 `10-graph-rag.md` 는 설명형 제목만 사용한다. 규약이 특정 패턴을 강제하지 않으므로 INFO 수준.
- 제안: 영역 내 일관성을 위해 `### GR-R-01 — Graph RAG 기획 결정` 형태를 고려할 수 있으나, conventions 에 명시된 강제 항목이 아니므로 필수 수정 아님.

### [INFO] `11-mcp-client.md` — `## 1. 개요` 로 시작하고 Overview 섹션이 없음

- target 위치: `spec/5-system/11-mcp-client.md` 문서 시작부
- 위반 규약: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- 상세: `1-auth.md` 와 `10-graph-rag.md` 와 달리 `11-mcp-client.md` 는 별도 `## Overview` 섹션 없이 바로 `## 1. 개요` 로 시작한다. CLAUDE.md 는 "권장" 이라고 표현하므로 강제 위반이 아니며, 구조 자체에 기능적 문제는 없다. 단, 영역 내 스타일 비일관성이 있다.
- 제안: 현재 구조를 `## Overview` + 기존 `## 1. 개요` 통합으로 정비하면 `10-graph-rag.md` 와 형식이 맞춰진다. 단, 강제 수정 대상이 아님.

### [INFO] `1-auth.md` §4.3 LoginHistory 이벤트 이름 — error-code 규약 적용 범위 외

- target 위치: `spec/5-system/1-auth.md` §4.3 LoginHistory 이벤트 목록
- 위반 규약: `spec/conventions/error-codes.md §1` (UPPER_SNAKE_CASE) — 단, §1 적용 범위는 "에러 코드 문자열"
- 상세: `login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected` 는 에러 코드가 아닌 이벤트 타입 값이다. `error-codes.md §1` 의 적용 범위는 `error.code` 및 유사 에러 코드 문자열이며 이벤트 분류 enum 을 명시적으로 포함하지 않는다. 따라서 규약 직접 위반이 아니다.
- 제안: 현행 유지. 이벤트 타입 명명 규약이 별도로 없으므로 추가 지적 불필요.

### [INFO] `10-graph-rag.md` §7 에러 처리 — 신규 에러 코드 정의 시 UPPER_SNAKE_CASE 준수 필요

- target 위치: `spec/5-system/10-graph-rag.md` §7 에러 처리 표
- 위반 규약: `spec/conventions/error-codes.md §1` (에러 코드 UPPER_SNAKE_CASE 의무)
- 상세: `KB_REEXTRACT_IN_PROGRESS` (§7)는 `UPPER_SNAKE_CASE` 로 올바르게 표기되어 있다. 내부 LLM timeout/5xx 등 에러 상황은 코드 이름 없이 설명만 제공하는데, 아직 코드를 정의하지 않은 상태는 위반이 아니다.
- 제안: 구현 시 신규 에러 코드를 추가할 경우 `UPPER_SNAKE_CASE` 와 의미 기반 명명(`error-codes.md §1`)을 준수할 것.

---

## 요약

검토 대상 `spec/5-system` 영역의 세 파일(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`)은 정식 규약(`spec/conventions/**`)을 전반적으로 잘 준수하고 있다. `lower_snake_case` 에러 코드가 포함된 초대 API 흐름은 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 이미 정식 등재되어 있어 규약 위반이 아니다. 문서 구조 측면에서 Overview / 본문 / Rationale 3섹션 권장 패턴을 `11-mcp-client.md` 가 부분적으로 따르지 않으나, CLAUDE.md 가 "권장" 으로 표현하고 있어 CRITICAL/WARNING 수준이 아닌 INFO 수준의 스타일 편차다. CRITICAL 또는 WARNING 등급의 규약 직접 위반은 발견되지 않았다.

---

## 위험도

NONE
