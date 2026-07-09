# 정식 규약 준수 검토 — spec/5-system/ (1-auth.md · 10-graph-rag.md)

## 검토 방법 메모

- target 은 `spec/5-system/1-auth.md`(status: partial) · `spec/5-system/10-graph-rag.md`(status: implemented) 전문.
- 대조 대상 정식 규약: prompt payload 에 포함된 `spec/conventions/audit-actions.md` + repo 원본 `spec/conventions/{error-codes,node-output,secret-store,migrations,spec-impl-evidence,swagger}.md` (payload 미포함분은 절대경로로 직접 대조).
- `git diff origin/main...HEAD --stat -- spec/5-system/` 결과 **변경 없음** — 이 브랜치(`expression-enricher-dry-fbb5ce`)의 실제 diff 는 `codebase/frontend/src/components/workflow-editor/editor/expression/**` 로, `spec/5-system/` 과 무관하다. 즉 본 검토는 해당 브랜치 diff 에 대한 리뷰가 아니라 `spec/5-system/` 영역 자체의 standing 규약 준수 점검으로 수행했다. 스코프 지정(브랜치와 target 영역의 불일치) 자체는 orchestrator 쪽에서 재확인이 필요할 수 있다.

## 발견사항

- **[WARNING]** 에러 코드 카탈로그 SoT(`3-error-handling.md §1`)에 auth/graph-rag 도메인 코드가 반영되지 않음
  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 (`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `REAUTH_NOT_AVAILABLE`, `NOT_A_MEMBER`) · `spec/5-system/10-graph-rag.md` §7 에러 처리 (`KB_REEXTRACT_IN_PROGRESS`)
  - 위반 규약: `spec/conventions/error-codes.md` Overview "책임 경계 — 카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)" 및 "적용 범위: 프로젝트 전체의 에러 코드 문자열에 적용된다"
  - 상세: `error-codes.md` 는 `3-error-handling.md §1` 을 프로젝트 전체 에러 코드의 카탈로그 SoT로 명시한다. 그러나 실제로 `3-error-handling.md §1.2 인증/인가 에러`는 `AUTH_REQUIRED`/`TOKEN_EXPIRED`/`TOKEN_INVALID`/`FORBIDDEN`/`ADMIN_REQUIRED`/`LOGIN_FAILED`/`ACCOUNT_LOCKED` 만 나열하고, `1-auth.md` §5 에서 실제 발행되는 WebAuthn/2FA/재인증/워크스페이스 전환 관련 코드는 전혀 등재돼 있지 않다(직접 확인: `grep WEBAUTHN\|REAUTH_NOT_AVAILABLE\|CHALLENGE_INVALID\|NOT_A_MEMBER 3-error-handling.md` → 0건). `10-graph-rag.md` 의 `KB_REEXTRACT_IN_PROGRESS` 도 동일하게 미등재다. 반면 같은 문서의 §1.5~§1.7(WS commands·EIA REST·Webhook)은 "도메인 spec 참조" 로 명시적으로 표기해 카탈로그 책임을 도메인 spec 에 위임한다는 것을 독자에게 알린다. §1.2·§1.3(ModelConfig 코드는 §1.3 에 실제로 인라인됨)은 그런 위임 표기가 없어, 독자가 §1.2 를 auth 도메인의 완전한 카탈로그로 오인할 수 있다.
  - 제안: (a) `3-error-handling.md §1.2` 제목을 `§1.5~§1.7` 과 동일하게 "(도메인 spec 참조)" 로 표기하고 `1-auth.md §5`/`10-graph-rag.md §7` 링크를 추가하거나, (b) 카탈로그 SoT 원칙을 지키려면 WebAuthn/2FA/KB 관련 코드를 `3-error-handling.md §1.2`(또는 신설 §1.2.1)에 백필한다. 어느 쪽이든 `spec/conventions/error-codes.md` 의 "책임 경계" 문구가 실제 문서 구조와 어긋나지 않게 한 쪽을 갱신 대상으로 택해야 한다.

## 준수 확인 (참고 — 위반 아님, 검증 과정에서 확인한 양호 사례)

- `1-auth.md §4.1` 감사 액션 카탈로그(구현/`Planned` 전량)는 `spec/conventions/audit-actions.md` §1(dot-prefix)·§2(시제 3분류)·§3(도메인별 레지스트리)과 완전히 일치 (`integration.*`/`user.*`/`auth_config.*`/`execution.re_run`/`workspace.*`/`member.*`/Planned `workflow.*`·`trigger.*`·`schedule.*`·`model_config.*` 전 항목 대조 완료).
- `1-auth.md §1.5.4` 의 `lower_snake_case` 에러 코드(`invitation_not_found`·`forbidden`·`rate_limited` 등)는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 정확히 동일 항목·근거로 등재돼 있어 규약과 정합.
- frontmatter: `1-auth.md`(`id: auth`, `status: partial` + `pending_plans`), `10-graph-rag.md`(`id: graph-rag`, `status: implemented`)는 `spec/conventions/spec-impl-evidence.md` §2~§3 스키마·5-값 enum·basename→id 축약 규칙 준수. `code:` glob 경로 표본 점검(`webauthn.config.ts`, `graph.controller.ts`, `graph-3d-renderer.tsx` 등) 실제 파일 존재 확인.
- Rationale 1.4.G 가 인용하는 `codebase/backend/migrations/README.md §1` NOT VALID+VALIDATE 기본 패턴, `V058` 마이그레이션 실재(`V058__login_history_webauthn_failed_event.sql`) 확인 — `spec/conventions/migrations.md` 의 SoT 분리(버전 정책은 conventions, 작성 가이드는 README) 원칙과 정합.
- 문서 구조: 두 파일 모두 `## Overview`(auth) / `## Overview (제품 정의)`(graph-rag) → 번호 본문 → `## Rationale` 3섹션 준수. 파일명 `N-name.md` 패턴(`1-auth.md`, `10-graph-rag.md`) 및 `id:` 축약(`auth`, `graph-rag`) 모두 `.claude/skills/project-planner/SKILL.md` §명명 컨벤션과 일치.
- 교차 링크 표본 점검(`plan/in-progress/spec-sync-auth-gaps.md`, `plan/complete/refactor-auth-reverify-unify.md`, `spec/5-system/_product-overview.md#2-보안`, `2-api-convention.md §5/§5.2/§5.3`) 모두 실재.

## 요약

target(`spec/5-system/1-auth.md`, `10-graph-rag.md`)은 감사 액션 명명(`audit-actions.md`), 에러 코드 historical-artifact 예외(`error-codes.md §3`), frontmatter/status lifecycle(`spec-impl-evidence.md`), 마이그레이션 정책(`migrations.md`), 문서 3섹션 구조·명명 컨벤션(SKILL.md) 등 다수 축에서 정식 규약을 정밀하게 준수하며 교차 링크도 대부분 실재해 정합성이 높다. 유일하게 확인된 이슈는 `error-codes.md` 가 선언한 "`3-error-handling.md §1` = 프로젝트 전체 에러 코드 카탈로그 SoT" 원칙과 실제 문서 구조 사이의 괴리로, `1-auth.md`(WebAuthn/2FA/재인증 계열)와 `10-graph-rag.md`(`KB_REEXTRACT_IN_PROGRESS`)가 정의하는 에러 코드가 그 카탈로그에 반영되거나 도메인-참조로 명시되지 않은 상태다. 이는 target 문서 자체의 결함이라기보다 카탈로그 SoT(`3-error-handling.md`) 쪽 구조 갱신으로 해소하는 편이 자연스럽다. 또한 이번 브랜치(`expression-enricher-dry-fbb5ce`)의 실제 코드 diff 는 `spec/5-system/`과 무관한 프론트엔드 expression enricher 리팩터로, 본 target 스코프 지정 자체가 이 브랜치의 diff-base 검토와 맞지 않을 수 있다는 점은 orchestrator 확인이 필요하다.

## 위험도

LOW
