# 정식 규약 준수 검토 결과

## 메타
- target: `spec/5-system/`(첨부 본문 기준 `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)
- 검토 모드: --impl-done, diff-base=origin/main
- 참고: 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/mystifying-hertz-3736ba`)에서 `git diff origin/main --stat -- spec/5-system/1-auth.md spec/5-system/10-graph-rag.md` 는 **빈 결과**다 — 이번 브랜치(`claude/refactor-06-c2-atomic-claim`)의 실제 diff 는 `spec/5-system/4-execution-engine.md` 등 execution-engine 관련이며, 첨부된 두 target 파일은 origin/main 대비 변경되지 않았다. 아래 발견사항은 두 문서의 **기존 상태**에 대한 정식 규약 준수 여부이며, "이번 PR 이 새로 도입한 위반"은 아니다.

## 발견사항

- **[WARNING] WebAuthn 관련 에러 코드 7종이 카탈로그 SoT(`3-error-handling.md §1.2`)에 미등재**
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` (`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `REAUTH_NOT_AVAILABLE`)
  - 위반 규약: `spec/conventions/error-codes.md` Overview — "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)". `3-error-handling.md` Overview 도 자신을 "에러 코드 분류 체계... 단일 진실"로 선언한다.
  - 상세: 위 7개 코드는 실제 구현에 존재하고(`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`, `webauthn.controller.ts`, `sessions.service.ts`, `auth.service.ts`) `1-auth.md §5` API 표에도 문서화돼 있으나, `3-error-handling.md §1.2 인증/인가 에러` 카탈로그 표에는 하나도 등재되어 있지 않다(`AUTH_REQUIRED`/`TOKEN_EXPIRED`/`FORBIDDEN`/`ADMIN_REQUIRED`/`LOGIN_FAILED`/`ACCOUNT_LOCKED` 만 있음). 표기(`UPPER_SNAKE_CASE`)는 전부 규약을 준수하나, "카탈로그·분류는 §1이 SoT" 라는 책임 분리 원칙 자체가 이 7개 코드에 대해서는 지켜지지 않고 있다.
  - 제안: `3-error-handling.md §1.2`에 WebAuthn 관련 행을 추가해 카탈로그를 완전하게 만들거나(권장 — SoT 원칙 유지), 또는 WebAuthn 에러가 §1.2 범위 밖(예: §1.4 노드 레벨처럼 별도 서브카테고리)이라는 의도라면 그 경계를 §1.2 서두에 명시. target(`1-auth.md`) 자체의 수정이 아니라 `3-error-handling.md`(카탈로그 SoT) 쪽 갱신이 적절.

- **[INFO] `error-codes.md §3` historical-artifact 예외 등재는 정확히 인용됨**
  - target 위치: `spec/5-system/1-auth.md §1.5.4` 각주
  - 위반 규약: 해당 없음(준수 확인)
  - 상세: `1-auth.md`는 초대 흐름의 `invitation_not_found` 등 `lower_snake_case` 코드가 `node-output.md §3.2`·`error-codes.md §1`의 `UPPER_SNAKE_CASE` 규약과 다름을 스스로 명시하고, `error-codes.md §3` historical-artifact 레지스트리를 정확히 인용해 예외 근거를 제공한다. 실제 `error-codes.md §3`에도 동일 코드 세트(`invitation_not_found`·`forbidden`·`rate_limited` 등)가 "초대 API 한정" 조건과 함께 등재돼 있어 상호 정합성이 확인된다. 규약을 어기지 않고 정식 예외 경로를 통해 이탈을 문서화한 모범 사례.

- **[INFO] frontmatter 스키마 — `spec-impl-evidence.md` 준수 확인**
  - target 위치: `1-auth.md`(`id: auth`, `status: partial`, `pending_plans: [plan/in-progress/spec-sync-auth-gaps.md]`), `10-graph-rag.md`(`id: graph-rag`, `status: implemented`)
  - 위반 규약: 해당 없음(준수 확인)
  - 상세: `spec-impl-evidence.md §2/§3`의 필드 의무(`status: partial` 시 `pending_plans` 필수, `status: implemented` 시 `code:` ≥1)를 두 문서 모두 충족한다. `id` 도 kebab-case, basename 기반.

- **[INFO] 문서 구조(Overview/본문/Rationale) 준수**
  - target 위치: `1-auth.md`(`## Overview` → §1~§5 → `## Rationale`), `10-graph-rag.md`(`## Overview (제품 정의)` → §1~§8 → `## Rationale`)
  - 위반 규약: 해당 없음(준수 확인)
  - 상세: CLAUDE.md·SKILL.md 가 권장하는 Overview / 본문 / Rationale 3섹션 구성을 두 문서 모두 따른다. `10-graph-rag.md` 는 PRD형 Overview(제품 정의, §1~§8)와 기술 spec 본문(§1 개요~§8 비-목표)이 한 파일에 이어지는 이중 레이어 구조이나, 이는 문서 자체가 채택한 명시적 관례(제품요구사항 + 기술설계 병합형 spec)로 위반이 아니다.

- **[INFO] 감사 액션 명명 — `audit-actions.md` 규약과 `1-auth.md §4.1` 카탈로그 정합**
  - target 위치: `1-auth.md §4.1`
  - 위반 규약: 해당 없음(준수 확인)
  - 상세: `user.password_changed`/`user.2fa_enabled`/`user.2fa_disabled`/`user.email_changed` 는 `audit-actions.md §2.1`(과거분사 기본)·§3 레지스트리(`user` → 과거분사)와 일치한다. dot-prefix(`<resource>.<verb>`)·언더스코어 토큰 구분자 규칙도 준수. `workspace.transfer_ownership`(도메인 고유 동사, §2.3)도 레지스트리와 일치. 두 문서 간 SoT 책임 분리(카탈로그=1-auth.md, taxonomy=audit-actions.md)도 문서 상호 참조로 명확히 유지되고 있다.

## 요약

첨부된 target 두 문서(`spec/5-system/1-auth.md`, `10-graph-rag.md`)는 명명 규약(dot-prefix 감사 액션, UPPER_SNAKE_CASE 에러 코드, kebab-case frontmatter id), 문서 구조 규약(Overview/본문/Rationale), historical-artifact 예외 처리 절차를 대체로 충실히 준수한다. 유일하게 발견된 이탈은 WebAuthn 관련 에러 코드 7종이 `3-error-handling.md §1.2`(카탈로그 SoT)에 등재되지 않은 커버리지 갭으로, 이는 `1-auth.md` 자체의 위반이라기보다 카탈로그 SoT 문서 쪽의 최신화 누락이다. 또한 이번 브랜치의 실제 diff 는 `spec/5-system/4-execution-engine.md` 등 별도 영역이며 검토 대상으로 지정된 두 파일은 origin/main 대비 변경이 없어, 금번 PR 이 신규로 발생시킨 정식 규약 위반은 없다.

## 위험도
LOW
