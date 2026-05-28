# Plan 정합성 검토 결과

- 검토 모드: `--impl-prep` (구현 착수 전, scope=`spec/`)
- target plan: `plan/in-progress/integration-activity-api-label.md` (worktree `integration-activity-api-label-ed0a6e`)
- 검토 시각: 2026-05-28
- 대상 spec 변경 파일 (unstaged):
  - `spec/1-data-model.md` — `IntegrationUsageLog` 엔티티에 `api_label/api_method/api_path` 3컬럼 추가
  - `spec/2-navigation/4-integration.md` — §4.6 Recent activity 탭 표 재정의 + §9.3 ActivityItem shape + catalog endpoint 신설 + Rationale 추가
  - `spec/4-nodes/4-integration/0-common.md` — logUsage `api` 파라미터 의무화
  - `spec/4-nodes/4-integration/_product-overview.md` — INT-US-05 요구사항 추가 + 통합별 채우기 정책 표
  - `spec/4-nodes/4-integration/1-http-request.md` — §4.3 활동 로그 API 식별 정보 추가
  - `spec/4-nodes/4-integration/2-database-query.md` — §8 logUsage 인자 확장
  - `spec/4-nodes/4-integration/3-send-email.md` — §7 logUsage 인자 확장
  - `spec/4-nodes/4-integration/4-cafe24.md` — §11 Usage 로깅 api 식별 정보 추가
  - `spec/conventions/cafe24-api-metadata.md` — §7.5 catalog key 형식 신설

---

## 발견사항

발견한 CRITICAL/WARNING 항목 없음.

### [INFO] `node-output-redesign` 계획의 `4-cafe24.md` 오픈 항목 — 대상 파일 동일, 섹션 직교

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md §11 Usage 로깅`
- 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` 미완료 4건 (§1 pagination cursor 제거, 테스트 2건, 선택 spec 보완 1건)
- 상세: `node-output-redesign` 계획의 오픈 항목은 §1 표의 `cursor?: string` 제거, `meta.callUsage` 4xx 회귀 테스트, `sanitizeConfigEcho` 회귀 테스트, `meta.callRemain` 선택 보완이다. 이번 target spec 변경은 §11 Usage 로깅 절에 api 식별 정보 텍스트를 추가하는 것으로, 두 변경이 다루는 섹션이 겹치지 않는다. 실제 spec 충돌 없음.
- 제안: 별도 조치 불필요. `node-output-redesign` 계획의 §1 cursor 제거는 본 PR 머지 후 독립적으로 진행 가능.

### [INFO] `frontend-csr-only-a985da` active worktree — `codebase/` 단의 `integrations/[id]/page.tsx` 동시 수정 (spec/ 범위 외)

- target 위치: 본 검토 scope(`spec/`) 밖이나 Phase 6 구현 착수 시 연관
- 관련 worktree: `frontend-csr-only-a985da` (branch `claude/frontend-csr-only-a985da` — active, PR 미생성)
- 상세: `frontend-csr-only` 워크트리는 `spec/0-overview.md`와 `spec/conventions/frontend-rendering.md`만 변경하므로 spec/ 영역 충돌 없음. 그러나 `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`의 820줄 내용을 `integration-detail-content.tsx`로 분리 이동하였다. target plan Phase 6가 `page.tsx:670~712` (`ActivityTab`) 수정을 예정하므로, `frontend-csr-only`가 먼저 머지되면 ActivityTab 구현 위치가 `integration-detail-content.tsx`로 바뀐다. spec/ 충돌은 없으나 구현 착수 전 `frontend-csr-only` 의 머지 순서를 확인할 것.
- 제안: Phase 6 착수 직전 `frontend-csr-only` PR 상태 확인 — 머지 완료 시 ActivityTab 수정 대상 파일을 `integration-detail-content.tsx`로 조정.

### [INFO] `spec-overview-followups-2026-05-18.md` — completed 마킹이지만 `plan/complete/` 미이동

- target 위치: 해당 없음 (target spec 파일과 무관)
- 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` (frontmatter `completed: 2026-05-21`, PR #256 MERGED)
- 상세: 본 검토 대상 spec 파일과 겹치지 않음. 다만 해당 plan이 완료됐음에도 `plan/in-progress/`에 남아있어 plan lifecycle 위반 상태. 본 검토와 무관하나 cleanup 권장.
- 제안: `git mv plan/in-progress/spec-overview-followups-2026-05-18.md plan/complete/spec-overview-followups-2026-05-18.md` 실행.

### [INFO] `spec-followup-cron-7d-statemachine.md` — PR #216 MERGED, plan 미이동

- target 위치: 해당 없음 (target spec 파일과 무관)
- 관련 plan: `plan/in-progress/spec-followup-cron-7d-statemachine.md` (PR #216 MERGED)
- 상세: 동 plan이 `spec/2-navigation/4-integration.md` 의 §10.5/§11.1 cron 정책을 수정했으나 이미 main에 반영 완료. target 변경의 §9.3/§4.6 섹션과 충돌 없음.
- 제안: `git mv plan/in-progress/spec-followup-cron-7d-statemachine.md plan/complete/` 실행.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 (§5번 기준, target과 동일 spec 파일을 다루는 계획의 worktree):

| worktree 후보 | branch | 판정 |
|---|---|---|
| `spec-followup-cron-7d-statemachine-868886` | `claude/spec-followup-cron-7d-statemachine-868886` | Step 1 ancestor: ACTIVE_or_MISSING → Step 2 PR: `MERGED` → **stale** (PR #216) |
| `cafe24-backlog-residual-batch` | `claude/cafe24-backlog-residual-batch` | Step 1 ancestor: ACTIVE_or_MISSING → Step 2 PR: empty (PR 미생성) → Step 3 fallback: active. 단 branch 자체가 repo에 미존재 (`git worktree list` 에 부재) — 물리 worktree 없으므로 실질 충돌 없음. plan frontmatter 의 worktree 명칭만 잔존. |

`spec-followup-cron-7d-statemachine-868886` 는 stale — cleanup-worktree-all.sh 대상이 될 수 있으나 이미 branch 자체가 삭제되어 cleanup 스크립트 불필요. plan 파일만 `plan/complete/`로 이동하면 됨.

`cafe24-backlog-residual-batch` 는 Step 2 PR이 없어 Step 3 fallback으로 active 처리했으나 실제 물리 worktree가 없으므로 spec 파일 동시 수정 위험 없음 — stale worktree false-negative 가능성 있으나 worktree 경합 실체 없음.

---

## 요약

target 변경(integration-activity-api-label plan)이 수정하는 spec 파일 9종(`spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/{0-common,_product-overview,1-http-request,2-database-query,3-send-email,4-cafe24}.md`, `spec/conventions/cafe24-api-metadata.md`)과 현재 active worktree(`frontend-csr-only-a985da`)가 수정하는 spec 파일(`spec/0-overview.md`, `spec/conventions/frontend-rendering.md`) 사이에 겹침 없음. 기존 in-progress plan 중 동일 spec 영역(특히 `4-integration.md`, `_product-overview.md`)을 수정하는 plan들은 모두 PR MERGED 완료(#216, #256)되어 main에 반영된 stale 상태이며, 미해결 결정이 target 변경과 충돌하는 항목은 발견되지 않음. `node-output-redesign` 계획의 `4-cafe24.md` 오픈 항목은 target 변경과 섹션이 직교해 무해함. 전체 CRITICAL/WARNING 0건. worktree 충돌 후보 2건 중 1건 Step 2 MERGED(stale) skip, 1건 Step 3 active 처리이나 물리 worktree 부재로 실질 경합 없음.

---

## 위험도

NONE

STATUS: OK
