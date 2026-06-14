# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: 구현 착수 전 (--impl-prep)

---

## 발견사항

### [INFO] 문서 구조 — 최상위 섹션 번호 혼재
- **target 위치**: `spec/2-navigation/6-config.md` L28 (Part A), L128 (Part B), L252 (`## 3. API`), L287 (`## Rationale`)
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- **상세**: 본문이 "Part A"·"Part B" 로 구분되고 API 절이 `## 3. API` (숫자 prefix) 로 명명돼 있어, 섹션 번호 체계가 Part A/B(알파벳) ↔ `3.`(숫자) 혼재한다. 규약 위반 수준은 아니지만 일관성이 낮다.
- **제안**: `## 3. API` 를 `## API` 로 숫자 prefix 제거하거나, Part A/B 도 `## 1. Authentication` / `## 2. Models` 형태로 통일한다. 규약 자체는 섹션 번호 스타일을 강제하지 않으므로 INFO 수준.

---

### [INFO] audit 액션 표기 방식 — 단일따옴표 문자열 리터럴 직접 사용
- **target 위치**: `spec/2-navigation/6-config.md` L119: `action='auth_config.reveal'`
- **위반 규약**: `spec/conventions/audit-actions.md §1` — "새 action 은 반드시 `AUDIT_ACTIONS` union 에 추가한 뒤 사용한다 (인라인 문자열 금지)"
- **상세**: spec 서술 본문 산문 안에서 audit 액션을 `action='auth_config.reveal'` 식의 인라인 문자열로 표기하고 있다. 이는 spec 설명을 위한 산문 표기이므로 실제 코드 인라인 문자열 금지(구현 레이어 제약)와 직접 충돌하지는 않는다. 단 `auth_config.reveal` 자체의 표기는 `spec/conventions/audit-actions.md §3` 레지스트리(`auth_config | 현재형 §2.2 | create, update, delete, regenerate, reveal | 구현`)와 정확히 일치하므로 내용상 문제 없음.
- **제안**: spec 산문 표기 방식 자체는 허용 범위이나, `code 블록` 또는 인라인 코드(backtick)로 표기하는 편이 "이것은 구현 표기"임을 명확히 한다. 기존 다른 액션 참조는 이미 backtick 사용 중이므로 `action='auth_config.reveal'` 도 `action=\`auth_config.reveal\`` 형태가 일관적이다.

---

### [INFO] 에러 코드 표기 — `FORBIDDEN` 대문자 코드 직접 인용
- **target 위치**: `spec/2-navigation/6-config.md` L124: `403 \`FORBIDDEN\``
- **위반 규약**: `spec/conventions/error-codes.md §3` historical-artifact 등록부
- **상세**: `FORBIDDEN` 은 error-codes 규약의 §3 예외 레지스트리에 등재된 `forbidden` (lower_snake_case, 초대 흐름 전용 historical artifact)과 다른 별도 코드다. 대문자 `FORBIDDEN` 을 규약 §1 의 `UPPER_SNAKE_CASE` 코드로 볼 경우 적법하나, 이 코드가 `spec/conventions/error-codes.md` 의 카탈로그(`spec/5-system/3-error-handling.md` SoT)에 공식 등재된 코드인지 spec 본문에서 확인 가능한 근거가 없다. 단 LLM Client §5.5 참조로 충분히 추적 가능하므로 INFO 수준.
- **제안**: 에러 코드 참조 시 `[LLM Client §5.5]` 처럼 SoT 링크가 있는 `RERANK_CONFIG_INVALID` 의 패턴을 따라 `FORBIDDEN` 도 `([Spec 인증 §3.2](../5-system/1-auth.md#…) 참고)` 형식의 SoT 참조를 추가하면 추적 완결성이 높아진다. 현재 동 라인에 `([Spec 인증 §3.2](../5-system/1-auth.md#3-인가-authorization).)` 가 이미 붙어 있으므로 사실상 충분히 처리된 상태.

---

## 요약

`spec/2-navigation/6-config.md` 는 `spec/conventions/` 의 정식 규약을 전반적으로 잘 준수하고 있다. frontmatter 가 `spec/conventions/spec-impl-evidence.md` 스키마(`id`, `status: partial`, `code:`, `pending_plans:`)를 정확히 이행하며, `pending_plans` 경로(`plan/in-progress/spec-sync-config-gaps.md`)도 실존한다. audit 액션 표기(`auth_config.reveal`)는 `spec/conventions/audit-actions.md §3` 레지스트리와 일치하고, 에러 코드(`RERANK_CONFIG_INVALID` 등)는 `UPPER_SNAKE_CASE` 규약을 따른다. Overview / 본문(Part A·B) / Rationale 3섹션 구조도 준수한다. 발견된 사항은 모두 INFO 수준의 형식 일관성 제안이며, 규약 직접 위반(CRITICAL) 또는 규약 거리감(WARNING)에 해당하는 항목은 없다.

## 위험도

NONE
