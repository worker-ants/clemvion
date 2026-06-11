# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — active worktree `unified-model-mgmt-5af7ee` 가 현재 브랜치가 구현한 기능의 spec 근거(§2.4.1 + R-3)를 삭제하는 변경을 포함하고 있어, 병합 순서에 따라 역커버리지 위반이 발생한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | active worktree `unified-model-mgmt-5af7ee` 가 `spec/2-navigation/5-knowledge-base.md` §2.4.1 "검색 불가 배너" bullet 전체 + Rationale §R-3 전체를 삭제 — kb-banner-refactor-76a800 이 구현 완료한 `UnsearchableBanner` 컴포넌트의 spec 근거가 사라져 역커버리지 위반 | `spec/2-navigation/5-knowledge-base.md` §2.4.1 및 Rationale §R-3 | branch `claude/unified-model-mgmt-5af7ee` | (a) unified-model-mgmt-5af7ee 브랜치에서 배너 관련 삭제 변경을 되돌리고 배너 spec·R-3 를 보존한 채 임베딩 모델 변경만 적용. 또는 (b) kb-banner 를 먼저 머지한 뒤 unified-model-mgmt 가 머지될 때 R-2/R-3 를 명시적으로 유지. 구현 코드가 살아있는 한 §2.4.1 및 R-3 는 삭제 불가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | unified-model-mgmt-5af7ee 가 `5-knowledge-base.md` R-2 링크를 `plan/complete/kb-model-change-reembed-followup.md` 로 변경했으나 해당 plan 은 아직 `plan/in-progress/` 에 있고 체크리스트 5개 미완료 → dead link 위험 | `spec/2-navigation/5-knowledge-base.md` Rationale §R-2 링크 | `plan/in-progress/kb-model-change-reembed-followup.md` | unified-model-mgmt 브랜치에서 링크를 `plan/in-progress/` 경로로 복원하거나, kb-banner 구현 완료를 확정한 뒤 plan 을 `plan/complete/` 로 이동하고 unified-model-mgmt 브랜치를 업데이트 |
| 2 | Convention Compliance | `spec/2-navigation/14-execution-history.md` — 권장 3섹션의 `## Rationale` 누락. N+1 회피 배치 집계 선택, LLM 탭 평탄화, chain badge 표기 결정 등이 인라인에 산재 | `spec/2-navigation/14-execution-history.md` 전체 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | `## Rationale` 섹션을 파일 끝에 추가하고 본문의 결정 근거를 이동·교차 참조 |
| 3 | Convention Compliance | `spec/2-navigation/7-statistics.md` — `## Rationale` 누락. LLM usage timeseries/summary 분리 결정, camelCase 쿼리 파라미터 선택 근거 미기록 | `spec/2-navigation/7-statistics.md` 전체 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | `## Rationale` 섹션 추가. 쿼리 파라미터 camelCase 선택 근거, LLM usage API 분리 이유 최소 기록 |
| 4 | Convention Compliance | `spec/2-navigation/8-marketplace.md` — `## Rationale` 누락 (status: backlog). "왜 아직 미구현인가" 맥락 미기록 | `spec/2-navigation/8-marketplace.md` 전체 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | 간략한 `## Rationale` 섹션 추가, backlog 결정 배경 기록 |
| 5 | Convention Compliance | `spec/2-navigation/16-agent-memory.md` — frontmatter `id: nav-agent-memory` 가 basename 패턴(`agent-memory`)과 불일치. 이 파일만 `nav-` prefix 를 추가하는 예외적 패턴 사용. `spec-frontmatter.test.ts` 오진 위험 | `spec/2-navigation/16-agent-memory.md` frontmatter 2번째 줄 | `spec/conventions/spec-impl-evidence.md §2.1` (basename 기반 권장) | `id: agent-memory` 로 변경해 basename 패턴에 맞추거나, `nav-` prefix 의도가 있다면 `spec-impl-evidence.md` 에 해당 패턴을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `spec/2-navigation/10-auth-flow.md` — OAuth callback `error=` query param 값이 `lower_snake_case` 이나 `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 미등록. `4-integration.md` Rationale 에는 의도적 분리가 명시돼 있으나 검토자 혼란 가능 | `spec/2-navigation/10-auth-flow.md §5.4` | `spec/conventions/error-codes.md §3` | OAuth callback URL `error=` param 을 예외 레지스트리에 등록하거나 `§0 적용 범위` 에 "URL-level signal" 제외를 명시. 또는 `4-integration.md` 의 의도 분리 Rationale 를 `10-auth-flow.md §5.4` 에 cross-link |
| 2 | Convention Compliance | `spec/2-navigation/6-config.md` — 최상위 `## Overview` 없이 `## Part A` 로 바로 시작. 세 Part 의 공통 목적·맥락 단락 부재 | `spec/2-navigation/6-config.md` H1 직후 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | `## Overview` 또는 최상위 개요 단락(1~3문장) 추가 |
| 3 | Convention Compliance | `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)` 와 `## 1. 개요` 가 중복 존재. 독자 혼동 가능 | `spec/2-navigation/14-execution-history.md` 줄 18, 92 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | `## Overview` 하위 PRD 내용을 `_product-overview.md` 로 이동하거나 `## 1. 개요` 와 통합. 또는 역할을 Product Requirements / Technical Spec 으로 명확히 분리 |
| 4 | Plan Coherence | `auth-refresh-rotation-atomic` 브랜치도 `5-knowledge-base.md` 를 수정하나 `status: partial` 변경·`pending_plans` 추가 수준으로 실질적 충돌 없음. 머지 시 자연 해소 | `spec/2-navigation/5-knowledge-base.md` frontmatter | branch `claude/auth-refresh-rotation-atomic` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·RBAC·계층 책임 6개 관점 모두 이상 없음. `reembedStatus` 타입 파생으로 컴파일 타임 보호 강화 |
| Rationale Continuity | NONE | R-2·R-3·`§3.4 Inline Alert 생존 주기` 모두 준수. auto-dismiss·RoleGate·CTA 숨김 정책 불변 |
| Convention Compliance | LOW | CRITICAL 없음. Rationale 누락(3파일) + frontmatter id 불일치(1파일) + OAuth error param 미등록(INFO) |
| Plan Coherence | CRITICAL | unified-model-mgmt-5af7ee 브랜치가 구현 완료된 배너 기능의 spec 근거(§2.4.1+R-3) 전체 삭제 예정 — 역커버리지 위반 |
| Naming Collision | NONE | 도입된 4개 신규 식별자(`UnsearchableBannerProps`, `ReembedStatus`, `STATE_CONFIG`, 파일 경로 변경 없음) 모두 충돌 없음. export 없음 |

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `unified-model-mgmt-5af7ee` 브랜치 담당자에게 `spec/2-navigation/5-knowledge-base.md` §2.4.1 "검색 불가 배너" bullet 전체 및 Rationale §R-3 삭제 변경을 되돌리도록 요청. kb-banner-refactor-76a800 이 먼저 머지된 뒤 unified-model-mgmt 가 진행하도록 머지 순서를 조율하거나, unified-model-mgmt 작업 범위에서 배너 관련 spec 삭제를 명시적으로 제외.
2. **(BLOCK 해소 연동)** unified-model-mgmt 브랜치의 `5-knowledge-base.md` R-2 링크가 `plan/complete/kb-model-change-reembed-followup.md` 를 가리키는 변경도 함께 복원. plan 이 `plan/complete/` 로 이동하기 전까지 `plan/in-progress/` 경로 유지.
3. **(WARNING 해소 — 권장)** `spec/2-navigation/16-agent-memory.md` frontmatter `id` 를 `agent-memory` 로 수정해 basename 패턴에 맞춤 (또는 `nav-` prefix 의도를 규약 문서에 명시).
4. **(WARNING 해소 — 권장)** `spec/2-navigation/14-execution-history.md`, `7-statistics.md`, `8-marketplace.md` 에 `## Rationale` 섹션 추가. project-planner 역할로 위임 수행.
5. **(INFO 해소 — 선택)** `spec/conventions/error-codes.md §3` 에 OAuth callback URL `error=` param 을 historical-artifact 로 등록하거나 적용 범위에 명시적 제외 조항 추가.
---

## 호출자(main Claude) 사후 판정 — 2026-06-11

**본 리팩토링 PR(#535) 자체는 spec 정합 — Critical 은 cross-branch 조율 사안으로 본 PR 에서 해소 불가/불요.**

- **본 branch 의 실제 변경(page.tsx·unsearchable-banner.tsx)은 완전 정합**: Cross-Spec NONE, Rationale Continuity NONE, Naming NONE. Convention 은 LOW 이나 findings 가 **전부 다른 파일**(14-execution-history·7-statistics·8-marketplace `## Rationale` 누락, 16-agent-memory id, 6-config Overview 등 — `--impl-done` scope=`spec/2-navigation/` 전체 스캔이라 인접 파일 pre-existing 이슈가 함께 잡힘). 본 리팩토링이 도입한 게 아니며 본 PR 범위 밖(B-그룹 백로그).
- **Critical #1 (BLOCK 사유)**: active worktree `unified-model-mgmt-5af7ee` 가 §2.4.1·R-3 를 삭제하는 cross-branch diff. 본 PR 은 spec 을 **건드리지 않으며**(코드 리팩토링만), §2.4.1·R-3 는 이미 main(#529)에 존재. 따라서 이 BLOCK 은 본 PR 의 결함이 아니라 **다른 branch 의 의도된 삭제가 #534 머지(배너 코드 main 진입) 이후 역커버리지 위반으로 격상**된 것. **본 PR 에서 해결 불가** — 조치는 unified-model-mgmt 조율(사용자 surface 완료, #534·#535 PR 본문 기재). 머지 순서: kb-banner 계열 먼저 머지됨(#534 완료) → unified-model-mgmt 가 rebase 시 §2.4.1·R-3 **보존 필수**.
- WARNING #1(R-2 링크): 동일 unified-model-mgmt cross-branch 사안.

**결론**: 본 리팩토링 PR 은 정합. BLOCK 은 cross-branch 조율 항목으로 본 PR blocker 아님 — push 진행, unified-model-mgmt 조율을 사용자에게 재차 surface.
