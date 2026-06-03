# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Integration RBAC 3-way 불일치(Critical 1건) + 캔버스 요약 포맷 미동기화(WARNING) + active worktree 동시 spec 수정(WARNING ×2) + Template Rationale 누락(WARNING) 포함

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Integration RBAC 3-way 불일치 — `spec/0-overview.md §6.1` 은 `@Roles('editor')` (Editor+) 가드를 코드 레퍼런스로 인용, `spec/2-navigation/4-integration.md §8` 은 "Admin 이상", `spec/2-navigation/9-user-profile.md §4.2` 매트릭스도 Editor ❌ — 세 문서가 동시에 canonical 이면 구현·UI 분기 불가피 | `spec/0-overview.md §6.1` (워크스페이스 단위 Integration 공유·RBAC 행) | `spec/2-navigation/4-integration.md §8` + `spec/2-navigation/9-user-profile.md §4.2` | `codebase/backend/src/modules/integrations/integrations.controller.ts` `@Roles` 데코레이터를 확인해 실제 구현 기준 결정. 구현이 editor 허용이면 `4-integration.md §8` + `9-user-profile.md §4.2` 를 Editor✅ 로 통일. Admin 이상이면 `0-overview.md §6.1` 의 `@Roles('editor')` → `@Roles('admin')` 으로 수정. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/0-overview.md` 내부 — Parallel 노드가 §6.1(완료 ✅ 목록)과 §6.2(부분구현 🚧) 양쪽에 동시 등장, 독자가 구현 상태 확정 불가 | `spec/0-overview.md §6.1` "노드 시스템" Parallel 포함 + §6.2 "Parallel 노드 (P1+P2)" 행 | 동일 문서 §6.1 ↔ §6.2 | §6.1 의 Parallel 에 "노드 타입 존재" 주석 추가 + §6.2 가 "UI 미노출 등 부분 상태"임을 명시하거나, §6.1 에서 Parallel 제거 후 §6.2 로 단일화 |
| 2 | Rationale Continuity | Template 캔버스 요약 포맷 변경("버튼 없음 = N lines" 제거) — inline 근거만 있고 `## Rationale` 섹션 없음 | `spec/4-nodes/6-presentation/5-template.md §7` + `spec/4-nodes/6-presentation/0-common.md §5` | `spec/4-nodes/6-presentation/5-template.md` 기존 두 가지 Template 상태(버튼 유무) 분리 명세 | `spec/4-nodes/6-presentation/5-template.md` 에 `## Rationale` 섹션 추가: (a) DSL 개행 카운트 미지원으로 `N lines` 표현 불가, (b) 버튼 0개 시 `0 buttons` 가 차선임 명시. `0-common.md` inline 노트와 동기화 |
| 3 | Convention Compliance | orchestrator 페이로드에 `spec/conventions/` 문서가 로드되지 않음 — 검토 커버리지 제한 발생 가능 | 페이로드 말미 `## 정식 규약 모음` 섹션 (`(없음)` 기재) | 규약 원문 미포함 | orchestrator 페이로드 빌드 시 `spec/conventions/` 핵심 파일(node-output.md, error-codes.md, swagger.md, spec-impl-evidence.md) 포함하도록 빌드 로직 점검 |
| 4 | Plan Coherence | `spec-sync-structural-followups.md` 가 명시적으로 "스킵" 결정한 `spec/4-nodes/0-overview.md` frontmatter 추가를 target 이 Plan 갱신 없이 번복 | `spec/4-nodes/0-overview.md` 상단 신규 YAML frontmatter (`id: nodes-overview`, `pending_plans: [marketplace-and-plugin-sdk.md]`) | `plan/in-progress/spec-sync-structural-followups.md §A` "보류" 결정 | `spec-sync-structural-followups.md §A` 해당 항목을 "[x] — frontmatter 추가 완료" 로 flip 하거나 "보류 유지이나 marketplace pending_plans 는 등록함" 으로 주석 갱신 |
| 5 | Plan Coherence | `ai-context-memory-9c7e6e` worktree 와 동일 spec 파일(4개) 동시 수정 — merge 시 3-way conflict 가능성 | `spec/4-nodes/0-overview.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/5-expression-language.md`, `spec/5-system/8-embedding-pipeline.md` | `ai-context-memory-9c7e6e` worktree (PR 없음, ACTIVE) | 이 worktree 먼저 머지 후 ai-context-memory rebase, 또는 머지 시 수동 3-way merge. `8-embedding-pipeline.md` 는 target 이 `status: implemented` 승격, ai-context-memory 는 본문 수정 — 합산 최종본 논리 일관성 확인 필요 |
| 6 | Plan Coherence | `makeshop-api-catalog-730deb` worktree 와 동일 spec 파일(5개) 동시 수정 — `0-common.md §5` summaryTemplate 표 충돌 위험 | `spec/4-nodes/0-overview.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/5-expression-language.md`, `spec/5-system/8-embedding-pipeline.md` | `makeshop-api-catalog-730deb` worktree (PR 없음, ACTIVE) — `0-common.md` 에 "Integration 5종" + MakeShop 행 추가 예정 | 머지 순서 조율. target 의 summaryTemplate `downscope 근거` 주석이 MakeShop 행 추가 후 올바른 위치에 남는지 확인 |
| 7 | Naming Collision | `config.errorHandling.policy` (범용, 5값) 와 `config.errorPolicy` (컨테이너 전용, 3값) 가 이름 유사·동일 JSONB 컬럼 공유 — spec 내 명시적 구분 설명 단편화 | `spec/3-workflow-editor/1-node-common.md §2.4` (`config.errorHandling` nested 구조 신규 정의) | `spec/4-nodes/1-logic/10-parallel.md`, `spec/4-nodes/1-logic/7-map.md`, `spec/4-nodes/1-logic/9-foreach.md` (`config.errorPolicy` 사용) | `spec/4-nodes/1-logic/0-common.md §4` 또는 `spec/4-nodes/0-overview.md` 에 "컨테이너 전용 `config.errorPolicy` 와 범용 `config.errorHandling.policy` 는 별개 레이어, 동일 노드에서 동시 사용 안 함" 명시 |
| 8 | Naming Collision | 캔버스 요약 포맷 변경 후 `spec/3-workflow-editor/0-canvas.md §5.3.4` 미갱신 — 동일 포맷 식별자가 두 문서에서 다른 값으로 기술 | `spec/3-workflow-editor/0-canvas.md §5.3.4` (Code: `{language}·{N} lines`, Template: `{format}·{N} lines` 등 옛 포맷 유지) | `spec/4-nodes/6-presentation/0-common.md §5`, `spec/4-nodes/5-data/0-common.md §5`, `spec/4-nodes/4-integration/0-common.md §5` (갱신된 포맷) | `spec/3-workflow-editor/0-canvas.md §5.3.4` 표를 target spec 의 갱신 포맷(Code:`{{language\|upper}}`, Template:`{{outputFormat}}·{{buttons.length}} buttons`, DB Query:`{{queryType\|upper}}·{{query}}`, Send Email:`{{to.length}} recipients·{{subject}}`)으로 동기화 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §6.1` "노드 시스템" Integration 노드 열거에 `cafe24` 누락 — `spec/1-data-model.md §2.6` Node.type 목록과 불일치 | `spec/0-overview.md §6.1` "노드 시스템" 행 | Integration 노드 열거에 `Cafe24` 추가 |
| 2 | Cross-Spec | `spec/2-navigation/9-user-profile.md §5.1` 알림 설정 표에 `background_failed`·`integration_action_required` 두 타입 누락 | `spec/2-navigation/9-user-profile.md §5.1` | 두 타입 채널 정책(사용자 변경 가능 여부) 추가 또는 "항상 in_app 발송" 명시 |
| 3 | Rationale Continuity | ForEach `$itemIsFirst`/`$itemIsLast` 노출 — 결정 번복이나 Rationale 정상 작성됨 | `spec/4-nodes/1-logic/9-foreach.md §3` + `## Rationale R-1` | 추가 조치 불필요 |
| 4 | Rationale Continuity | `Use Default Output` 타입별 기본값 "Planned" 강등 — 근거 Rationale 정상 작성됨 | `spec/3-workflow-editor/1-node-common.md §2.5.2` + `## Rationale R-1` | 추가 조치 불필요 |
| 5 | Rationale Continuity | Database Query / Send Email summaryTemplate downscope — inline 근거만, `## Rationale` 없음 | `spec/4-nodes/4-integration/2-database-query.md §7`, `spec/4-nodes/4-integration/3-send-email.md §7` | Rationale 로 격상하거나 `0-common.md` inline 노트를 단일 진입점으로 명확히 지정 |
| 6 | Rationale Continuity | Code 노드 캔버스 요약 downscope — inline 노트만 | `spec/4-nodes/5-data/0-common.md §5` | Template·DB Query·Send Email 과 동일 패턴. INFO 수준 |
| 7 | Convention Compliance | `spec/1-data-model.md` — `## Overview` 섹션 부재 | `spec/1-data-model.md` 최상단 | 명시적 `## Overview (제품 정의)` 섹션 추가 또는 예외 규약 명시 |
| 8 | Convention Compliance | `spec/2-navigation/1-workflow-list.md` — Rationale 섹션 말미 잘려 확인 불가 | `spec/2-navigation/1-workflow-list.md` 말미 | 말미 `## Rationale` 존재 여부 확인 + 파라미터 불일치 결정 근거 이동 검토 |
| 9 | Convention Compliance | `spec/1-data-model.md §2.10` `status_reason` — DB `snake_case` vs API `UPPER_SNAKE_CASE` 이중성 SoT 미명시 | `spec/1-data-model.md §2.10` Integration 테이블 `status_reason` 필드 | `spec/conventions/error-codes.md` 또는 `spec/5-system/2-api-convention.md` 에 두 케이스 규칙 명시 |
| 10 | Plan Coherence | `spec-sync-integration-common-gaps.md` `⚠ 재분류` 섹션에 send-email downscope 결정 주석 미갱신 | `plan/in-progress/spec-sync-integration-common-gaps.md` `⚠ 재분류` 섹션 | "send-email 은 2026-06-03 downscope 로 결정 완료" 주석 추가 |
| 11 | Plan Coherence | `spec-sync-audit` worktree (PR MERGED) 가 물리 디렉토리에 잔존 | `.claude/worktrees/spec-sync-audit` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 12 | Naming Collision | `spec/4-nodes/0-overview.md` frontmatter `id: nodes-overview` 신규 도입 — 기존 사용처 없음(충돌 없음) | `spec/4-nodes/0-overview.md` | `spec-frontmatter.test.ts` `collectApplicableSpecs` 범위 포함 여부 확인 |
| 13 | Naming Collision | `$itemIsFirst`/`$itemIsLast` — `$loop.isFirst` 와 이름 근접하나 네임스페이스 분리, 런타임 충돌 없음 | `spec/5-system/5-expression-language.md §4` | 변수 표에 "ForEach 컨텍스트에서만 주입" 구분 표기. `1-node-common.md §4.1` 자동완성 표 동기화 여부 확인 |
| 14 | Naming Collision | `id: common` 중복 — 6개 파일이 동일 ID 사용, pre-existing 이슈 (본 diff 미도입) | `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` | 별도 정리 트랙 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **HIGH** | Integration RBAC 3-way 불일치(Critical) + Parallel 노드 §6.1/§6.2 이중 등장(Warning) |
| Rationale Continuity | **LOW** | Template summaryTemplate 포맷 변경 Rationale 누락(Warning). 결정 번복 2건은 적정 Rationale 갖춤 |
| Convention Compliance | **LOW** | Critical/Warning 없음. orchestrator 페이로드 규약 로드 누락(Warning — target 문서 위반 아님) |
| Plan Coherence | **MEDIUM** | spec-sync-structural-followups "스킵" 번복 미문서화(Warning) + active worktree 2개 동시 spec 수정(Warning ×2) |
| Naming Collision | **MEDIUM** | `config.errorHandling.policy` vs `config.errorPolicy` 혼동 위험(Warning) + `0-canvas.md` 포맷 미동기화(Warning) |

---

## 권장 조치사항

1. **(BLOCK 해소 — Critical)** `codebase/backend/src/modules/integrations/integrations.controller.ts` 의 `@Roles` 데코레이터를 확인해 실제 구현 기준을 결정하고, `spec/0-overview.md §6.1` / `spec/2-navigation/4-integration.md §8` / `spec/2-navigation/9-user-profile.md §4.2` 세 문서를 동일 기준으로 통일한다.
2. `spec/3-workflow-editor/0-canvas.md §5.3.4` 캔버스 요약 포맷 표를 갱신된 4개 노드(Code / Template / Database Query / Send Email) 포맷으로 동기화한다.
3. `spec/4-nodes/6-presentation/5-template.md` 에 `## Rationale` 섹션을 추가해 "버튼 없음 = N lines" 제거 근거(DSL 한계, 단일 정적 summaryTemplate 제약)를 기록한다.
4. `plan/in-progress/spec-sync-structural-followups.md §A` 의 `0-overview.md` frontmatter 항목을 "[x] 완료" 또는 "보류 유지·이유" 로 갱신해 plan 결정 번복을 문서화한다.
5. `ai-context-memory-9c7e6e` 및 `makeshop-api-catalog-730deb` 와의 머지 순서를 조율하거나, 이 worktree 먼저 머지 후 rebase 전략을 수립한다.
6. `spec/4-nodes/1-logic/0-common.md §4` 또는 `spec/4-nodes/0-overview.md` 에 `config.errorPolicy`(컨테이너 전용) 와 `config.errorHandling.policy`(범용) 분리 설명을 추가한다.
7. `spec/0-overview.md §6.1` "노드 시스템" Integration 노드 열거에 `Cafe24` 를 추가한다.
8. `spec/2-navigation/9-user-profile.md §5.1` 알림 설정 표에 `background_failed`·`integration_action_required` 채널 정책을 추가하거나 설정 불가 이유를 명시한다.