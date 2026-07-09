# 정식 규약 준수 검토 — spec/2-navigation/ (editor-slug-phase2, impl-done)

검토 대상: `spec/2-navigation/0-dashboard.md` · `1-workflow-list.md` · `10-auth-flow.md` · `11-error-empty-states.md` · `13-user-guide.md` · `14-execution-history.md` · `15-system-status.md` (+ 참조 SoT `_layout.md`/`_product-overview.md` 확인).

방법론 노트: 호출 payload 에 번들된 "정식 규약 모음" 은 `audit-actions.md`·`cafe24-api-catalog/**` 만 포함하고 있었으나, 이 두 문서는 spec/2-navigation 내용과 직접 관련이 없다. 따라서 실제로 관련 있는 `spec/conventions/` 항목(`error-codes.md`·`swagger.md`·`spec-impl-evidence.md`·`user-guide-evidence.md`·`i18n-userguide.md`)은 워크트리에서 직접 Read 하여 대조했다. (이 payload 구성 자체는 target 문서의 결함이 아니라 오케스트레이터 선택의 문제이므로 별도 CRITICAL/WARNING 항목으로 세우지 않고 여기 방법론 노트로만 남긴다.)

## 발견사항

- **[WARNING]** 14-execution-history.md 만 영역 내에서 유일하게 PRD 스타일 Overview 섹션을 중복 보유
  - target 위치: `spec/2-navigation/14-execution-history.md` `## Overview (제품 정의)` 섹션 (EH-LIST-01~08 / EH-DETAIL-01~11 / EH-NAV-01~04 요구사항 매트릭스)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 — "`## Overview (제품 정의)` … 다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" (CLAUDE.md 최상위에서도 동일 원칙을 "각 SKILL.md 참고"로 인용)
  - 상세: `spec/2-navigation/` 은 이미 다중 파일 영역이라 공용 `_product-overview.md` 를 보유하고 있고, 같은 폴더의 형제 파일들(`0-dashboard.md`·`1-workflow-list.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`15-system-status.md`)은 전부 PRD 성격 서술 없이 `## 1. 개요`(기술 본문)로 바로 시작해 Overview 책임을 `_product-overview.md` 에 위임하는 2섹션(본문/Rationale) 패턴을 따른다. `14-execution-history.md` 만 유일하게 우선순위·상태(✅) 열이 있는 요구사항 ID 표(EH-*)를 포함한 별도 "## Overview (제품 정의)" 절을 문서 내부에 직접 갖고 있어, 같은 영역 안에서 구조가 이질적이다. (`spec-impl-evidence.md` 관점에서는 위반이 아니며, 이 구조는 이번 슬러그 라우팅 diff 로 새로 생긴 것이 아니라 기존부터 있던 것으로 보인다 — impl-done 검토 대상 diff 로 인한 신규 위반은 아님.)
  - 제안: 즉시 차단 사유는 아님. 후속 정리 시 EH-* 요구사항 매트릭스를 `_product-overview.md` 로 이관하고 본 파일은 형제 파일과 동일하게 `## 1. 개요`부터 시작하는 2섹션 구조로 정리할 것을 권장. (규약 갱신이 아니라 target 정리가 맞는 방향 — 형제 파일들이 이미 그 패턴을 증명한다.)

- **[INFO]** `11-error-empty-states.md` frontmatter `code:` 가 본문이 인용한 구현 파일과 정확히 일치하지 않음
  - target 위치: `spec/2-navigation/11-error-empty-states.md` frontmatter `code:` 목록 vs §1.3 "무효/비멤버 워크스페이스 slug" 행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 (`code:` = "본 spec 이 약속한 surface 의 구현 경로", 특히 §2.1 필드 정의)
  - 상세: §1.3 은 "`codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`(`resolveFallbackWorkspace`)" 라고 인용하지만, 실제로 `resolveFallbackWorkspace` 함수는 `layout.tsx` 안에 없다. `git -C <worktree> grep -n resolveFallbackWorkspace` 로 확인한 결과 함수 정의는 `codebase/frontend/src/lib/workspace/resolve-fallback.ts` 이고, 이를 소비하는 곳은 `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`(`layout.tsx` 가 렌더하는 `<WorkspaceSlugGate>`)다. frontmatter `code:` 목록에도 이 두 파일이 없다. 가드(`spec-code-paths.test.ts`)는 glob ≥1 매치만 요구하므로 현재도 통과하지만(다른 `w/[slug]/*.tsx` 경로들로), 본문이 특정 함수를 지목한 정밀도에 비해 frontmatter evidence 가 그 정확한 위치를 반영하지 않는다.
  - 제안: frontmatter `code:` 에 `codebase/frontend/src/lib/workspace/resolve-fallback.ts` · `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx` 추가하고, 본문 인용을 실제 정의 위치(`resolve-fallback.ts`)로 정정. 규약 위반이라기보다 evidence 정밀도 개선 제안(INFO).

## 확인 완료 (위반 없음, 근거 남김)

- **에러 코드 명명/안정성** (`spec/conventions/error-codes.md`): `10-auth-flow.md` §5.4 의 OAuth callback `error=` lowercase 값(`invalid_state`/`token_exchange_failed`/`email_required`/`server_error`)은 §3 historical-artifact 레지스트리에 이미 정식 등재되어 있고, target 문서(§5.4 하단 각주)도 정확히 그 레지스트리를 인용한다 — 일치.
- **응답 봉투/페이지네이션 포맷** (`spec/conventions/swagger.md` §2-5·§5): `0-dashboard.md` §7 의 `{ "data": ... }` 공통 래퍼 서술, `1-workflow-list.md` §3 의 "페이지네이션 응답 형식은 API 규약 §5.2 준수" 인용 모두 swagger.md 의 single-wrap/`ApiOkPaginatedResponse` 규약과 모순 없음.
- **frontmatter 스키마** (`spec/conventions/spec-impl-evidence.md` §2-3): 검토 대상 7개 파일 모두 `id`/`status`/`code` 필드를 규약대로 갖추고 있고, `status: partial` 인 `1-workflow-list.md` 만 `pending_plans:` 를 동반하는 등 §3 라이프사이클 규칙과 정합. `code:` 경로(`codebase/frontend/src/app/(main)/w/[slug]/**`, `[...rest]` 등)는 실제 워크트리에 전부 존재함을 `git -C <worktree>`/파일 존재 확인으로 재검증함(슬러그 라우팅 phase 2 반영 확인).
- **User-Guide Evidence / i18n** (`spec/conventions/user-guide-evidence.md`, `i18n-userguide.md`): `13-user-guide.md` §4(프론트매터 스키마)·§6(딥링크 규약)·§8(`<ImplAnchor>`) 서술이 실제 `_i18n-conventions.md`·`user-guide-evidence.md` 규약과 문구 단위로 일치. `13-user-guide.md` 의 code: 경로(`docs/layout.tsx`·`docs/page.tsx`·`docs/[...slug]/page.tsx`)가 의도대로 `w/[slug]/` 밖에 위치함을 확인(워크스페이스 무관 규칙 준수).

## 요약

spec/2-navigation 영역의 슬러그 라우팅 반영 문서들은 `spec/conventions/` 의 실질적으로 관련된 규약(에러 코드 명명/안정성, swagger 응답 포맷, frontmatter evidence 스키마, user-guide evidence/i18n)을 문구 수준까지 정확히 인용·준수하고 있으며 CRITICAL 급 위반은 발견되지 않았다. 유일한 구조적 이슈는 `14-execution-history.md` 가 영역 내에서 유일하게 PRD 요구사항 매트릭스를 자체 "Overview" 섹션으로 중복 보유하는 것(WARNING, 기존 구조로 추정·이번 diff 신규 아님)과, `11-error-empty-states.md` 의 frontmatter `code:` 가 본문이 지목한 정확한 구현 파일(`resolve-fallback.ts`/`workspace-slug-gate.tsx`)을 누락한 evidence 정밀도 이슈(INFO) 뿐이다. 둘 다 즉시 차단 사유는 아니다.

## 위험도

LOW
