# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-auth-errorcode-drift.md`

## 검토 범위

target 은 `spec/5-system/3-error-handling.md` 를 향한 spec draft(`--spec` 모드)다. 두 처방:

1. `ACCOUNT_LOCKED` 카탈로그 HTTP 값 423 → 401 정정 (§1.2)
2. `ALERT_RULE_NOT_FOUND` 신규 등재, §1.3, 404 (`*_NOT_FOUND` 계열)

대조한 정식 규약: `spec/conventions/error-codes.md` (명명·rename 안정성·historical-artifact 규약, 번들 전문 확보) +
target 이 편집 대상으로 지목한 `spec/5-system/3-error-handling.md` 실제 본문(§1.2/§1.3 구조, Overview 의
"도메인 spec 참조 vs 카탈로그-SoT" 분기 서술) + `.claude/skills/project-planner/SKILL.md` (draft 문서 구조 규약).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `ALERT_RULE_NOT_FOUND` 명명 — 규약 부합 확인
  - target 위치: `## ② ALERT_RULE_NOT_FOUND` 처방 절
  - 대조 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명 + `<DOMAIN>_<CONDITION>` 권장), §1.3 기존 행
    `MODEL_CONFIG_NOT_FOUND`/`RESOURCE_NOT_FOUND` 선례
  - 상세: `ALERT_RULE_NOT_FOUND` 는 `UPPER_SNAKE_CASE` + `<RESOURCE>_NOT_FOUND` 패턴으로, §1.3 에 이미 있는
    `MODEL_CONFIG_NOT_FOUND` 계열과 동형이다. target 문서 자체가 이 선례를 명시 인용한다("`MODEL_CONFIG_NOT_FOUND`
    등 `*_NOT_FOUND` 계열의 자리다"). 위반 없음 — 참고로 기록.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** "카탈로그를 SoT 로 추가한다" 표현 — 재검토 결과 규약과 정합
  - target 위치: `## ② ALERT_RULE_NOT_FOUND` § 처방, 마지막 문장
  - 대조 규약: `spec/5-system/3-error-handling.md` Overview 의 분기 서술 — "정의·트리거 조건의 상세 SoT 가
    도메인 spec 에 있는 코드(2FA/WebAuthn §1.2.1·WS commands §1.5·EIA REST §1.6·webhook §1.7·KB/Graph RAG
    §1.8·워크스페이스 멤버 직접추가 §1.9)는 해당 도메인 spec 을 SoT 로 참조하고 본 §1 에는 **공용 카탈로그
    가시성을 위해 등재만** 한다"
  - 상세: 처음엔 이 문구가 "카탈로그는 등재만, 도메인 spec 이 SoT" 원칙과 어긋나 보였으나, 위 열거 목록에
    **§1.3 은 포함돼 있지 않다** — 즉 §1.3 행(`RESOURCE_NOT_FOUND`/`MODEL_CONFIG_NOT_FOUND` 등)은 애초에
    카탈로그 자체가 SoT 로 취급되는 절이다. `ALERT_RULE_NOT_FOUND` 를 §1.3 에 두는 target 의 처방과, 그
    행을 "카탈로그가 SoT" 라고 서술하는 것 둘 다 이 기존 분기와 정합한다. 위반 아님 — 확인 차 기록.
  - 제안: 없음.

## 요약

target(spec draft)은 정식 규약 관점에서 위반이 확인되지 않았다. ① `ACCOUNT_LOCKED` 처방은 코드명 유지 +
HTTP 값만 구현치(401)로 정정하는 것으로, `error-codes.md §2` 의 "이름 정확성 향상만을 위한 rename 은
하지 않는다" 원칙과 무관하며(rename 이 아니라 문서-구현 drift 정정), target 이 인용한 "§1.2 는
401/403/423 을 담는 절" 서술도 `3-error-handling.md` 자체의 기존 Rationale(#882/#887 라인)과 실측 일치한다.
② `ALERT_RULE_NOT_FOUND` 신규 등재는 `UPPER_SNAKE_CASE` + `<RESOURCE>_NOT_FOUND` 명명 패턴과 §1.3 배치
관행(카탈로그-as-SoT 절)에 부합하며, `3-error-handling.md` 컬럼 포맷(코드/설명/HTTP)도 그대로 따른다.
문서 구조 측면에서도 draft 는 `project-planner/SKILL.md` 가 명시한 draft 전용 규약("본문 끝에 `## Rationale`
로 결정 근거 명시")을 정확히 따르며, CLAUDE.md 의 전체 spec 3섹션(Overview/본문/Rationale) 요구는 최종
spec 문서에 적용되는 것으로 SKILL.md 가 이를 draft 단계에서 오버라이드하므로 미해당이다. frontmatter
(`worktree`/`started`/`owner`/`spec_impact`)·파일명(`spec-draft-<name>.md`)도 `plan-lifecycle.md` 스키마와
기존 선례(`spec-draft-web-chat-console.md`)에 부합한다.

## 위험도

NONE
