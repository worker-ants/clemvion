# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` — 구현 착수 전 검토 (--impl-prep)
검토 대상 문서: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`
검토 기준: `spec/conventions/` 정식 규약 전체

---

## 발견사항

### [INFO] `1-auth.md` §1.5.4 에러 코드 `lower_snake_case` — historical-artifact 등재 확인됨, 신규 구현 시 준수 의무 재확인
- target 위치: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표 및 하단 명명 주석
- 위반 규약: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE` 의무)
- 상세: `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` 는 `lower_snake_case` 로 `UPPER_SNAKE_CASE` 규약을 위반한다. 단, 해당 코드 전체가 `error-codes.md §3 Historical-artifact 예외 레지스트리`에 "초대 API 한정" 으로 정식 등재되어 있고, 문서 자체에도 이를 명시하는 주석이 포함되어 있다 (`"명명 — historical-artifact 예외"` 블록). 따라서 기존 코드 자체는 허용 예외이며, **신규 구현 시 이 패턴을 선례로 삼지 말 것** (`error-codes.md §3` "신규 코드는 본 예외를 선례로 삼지 않는다" 명시)이 구현팀에 전달되어야 한다.
- 제안: 현행 표기는 규약상 적법한 예외이므로 변경 불요. 구현 착수 시 신규 에러 코드는 반드시 `UPPER_SNAKE_CASE` 로 작성. `forbidden`·`rate_limited` lowercase 가 **초대 흐름 전용** 예외임을 구현 코드 주석에도 명시 권장.

### [INFO] `1-auth.md` — Swagger/DTO 패턴 명시 없음 (API 문서 규약)
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- 위반 규약: `spec/conventions/swagger.md §5-4 새 엔드포인트 체크리스트`
- 상세: spec 문서 자체가 Swagger 데코레이터를 직접 기술할 의무는 없으나, WebAuthn 관련 신규 엔드포인트 7개 (`/auth/2fa/webauthn/*`) 가 이번 구현 착수 대상이다. 이 엔드포인트들에 대한 응답 DTO 위치(`dto/responses/`) 및 `writeOnly`/`readOnly` 처리 대상 필드(예: `optionsToken`, `code`, 복구 코드 평문) 가 spec 본문에서 언급만 되고 Swagger 규약과의 정합이 명시되지 않아 구현자가 `swagger.md §1-5` (`writeOnly: true`) 를 독립적으로 찾아야 한다.
- 제안: spec 내 변경은 불요. 구현 시 `swagger.md §1-5` 에 따라 `botToken`·복구 코드 plaintext 필드에 `writeOnly: true`, 서버 발급 `optionsToken`·`challengeToken` 응답 필드에 `readOnly: true` 적용을 확인한다.

### [INFO] `10-graph-rag.md` — 문서 3섹션 구조 일부 비표준 순서
- target 위치: `spec/5-system/10-graph-rag.md` 전체 구조
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- 상세: 이 문서는 `## Overview (제품 정의)` 섹션을 `### 1. 목표` 앞에 두어 3섹션 권장 구조를 대체로 준수한다. 다만 `## 1. 개요` 절이 Overview 섹션과 분리되어 본문 앞부분에 별도로 등장한다 (`Overview` 후 `### 2. 범위`/`### 3. 요구사항` … `## 1. 개요`). 이는 Overview 내부에서 요구사항과 범위를 포함하고 기술 개요를 본문 섹션으로 분리한 패턴으로, CLAUDE.md 권장 3섹션 경계가 다소 불분명하다.
- 제안: 기능적 문제는 없으므로 CRITICAL/WARNING 은 아니다. 향후 편집 시 `## Overview` → 본문(§1~§8) → `## Rationale` 구조가 명확하게 드러나도록 `## 1. 개요` 를 Overview 절 안으로 병합하거나 삭제를 고려할 수 있다. 강제 변경은 불요.

### [INFO] `11-mcp-client.md` — `status: partial` 이나 일부 Planned 기능의 `pending_plans` 항목이 존재함 — 확인 필요
- target 위치: `spec/5-system/11-mcp-client.md` frontmatter `pending_plans`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status: partial` 시 `pending_plans` 의무)
- 상세: frontmatter에 `pending_plans: - plan/in-progress/spec-sync-mcp-client-gaps.md` 가 선언되어 있고, 이는 `spec-impl-evidence.md §3` 의 `partial` 상태 의무를 충족한다. `spec-pending-plan-existence.test.ts` 가 그 plan 파일 실존을 강제하므로 구현 착수 전에 해당 plan 이 `plan/in-progress/` 에 실존하는지 확인한다.
- 제안: 빌드 가드가 이미 강제하므로 spec 수정 불요. 착수 전 `plan/in-progress/spec-sync-mcp-client-gaps.md` 실존 확인.

### [INFO] `10-graph-rag.md` § `KB_REEXTRACT_IN_PROGRESS` 에러 코드 — UPPER_SNAKE_CASE 준수 확인
- target 위치: `spec/5-system/10-graph-rag.md §7 에러 처리` 표 (`re-extract` 동시 호출 row)
- 위반 규약: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE` 의무)
- 상세: `409 KB_REEXTRACT_IN_PROGRESS` 는 `UPPER_SNAKE_CASE` 규약을 준수한다. 문제 없음.
- 제안: 없음.

### [INFO] `1-auth.md` — `node-output.md §3.2` `output.error` 형태와 API 에러 응답 봉투 구분
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` — WebAuthn 엔드포인트 실패 코드 (`WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_DISABLED`)
- 위반 규약: `spec/conventions/error-codes.md §1` + `spec/conventions/node-output.md §3.2`
- 상세: WebAuthn 에러 코드들(`WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_DISABLED`)은 모두 `UPPER_SNAKE_CASE` 를 준수한다. `node-output.md §3.2` 의 `code` 필드 규약과 일치. 문제 없음.
- 제안: 없음.

---

## 요약

검토 대상인 `spec/5-system/` 의 `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` 세 문서는 정식 규약 준수 수준이 전반적으로 양호하다. 에러 코드 명명은 `UPPER_SNAKE_CASE` 규약을 준수하고 있으며, `lower_snake_case` 초대 흐름 코드는 `error-codes.md §3` 에 historical-artifact 예외로 정식 등재되어 있다. `spec-impl-evidence.md` frontmatter 의무(`id`, `status`, `code`, `pending_plans`)도 세 문서 모두 충족한다. 발견된 모든 사항은 INFO 등급으로, 기존 약속 이탈이나 타 시스템 invariant 를 깨는 CRITICAL/WARNING 위반은 없다. 구현 착수 전 추가 주의가 필요한 사항은 신규 초대 흐름 코드에 `UPPER_SNAKE_CASE` 적용, WebAuthn 관련 응답 DTO 에 `swagger.md §1-5` `writeOnly`/`readOnly` 적용, 그리고 `spec-sync-mcp-client-gaps.md` plan 파일 실존 확인이다.

---

## 위험도

NONE
