# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target scope: 승인 백로그 묶음 구현 — 03 M-6·m-2 (dead code 제거), 06 M-5 (parallel branch nodeOutputCache dev/test deep freeze), 04 m-4 (integration credential 회전 pub/sub Pool 무효화), 06 M-1 (WS resumed ack spec 문구 정리 — planner), review_guard _porcelain_path off-by-one fix
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] 06 M-1 (WS resumed ack spec 정정) — spec-sync-websocket-protocol-gaps.md 의 worktree 값이 stale worktree 참조
- **target 위치**: `plan/in-progress/refactor/06-concurrency.md` §M-1 및 README §spec 갱신 필요 목록
- **관련 plan**: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (frontmatter `worktree: spec-sync-audit`)
- **상세**: `spec-sync-websocket-protocol-gaps.md` 의 `worktree: spec-sync-audit` 는 PR #516 (claude/spec-sync-audit-998544, MERGED) 로 이미 종결된 stale worktree를 가리킨다. 06 M-1 이 수정 대상으로 삼는 `spec/5-system/6-websocket-protocol.md` 는 PR #516 에서 이미 수정됐고(§7.5 단락 갱신 등), spec-sync 계획 W1 항목도 [x]로 체크 완료 상태다. 따라서 06 M-1 (planner 문구 정정 — `resumed` 의미 재정의 + §7.5 문장 §7.5.1 정합화)이 PR #516 과 **내용 중복·충돌 없이 병렬 진행 가능**한지 확인 후 착수하면 된다. 충돌 가능성은 낮지만 PR #516 이 이미 §7.5 를 수정했으므로 현재 main 의 websocket-protocol.md 를 기준으로 문구 위치를 재확인해야 한다.
- **제안**: 착수 전 main 의 `spec/5-system/6-websocket-protocol.md` §4.2·§7.5 현행 문구를 확인하고, `resumed` 재정의 지점이 PR #516 과 겹치지 않는지 검증. `spec-sync-websocket-protocol-gaps.md` 의 `worktree` 값은 정리 권장.

---

### [INFO] 04 m-4 (DB Pool pub/sub evict) — spec 갱신 책임 분리가 plan 에 미반영
- **target 위치**: `plan/in-progress/refactor/04-security.md` §m-4 "spec 갱신: §2 에 멀티 인스턴스 무효화 + Rationale(MTTR 트레이드오프) 추가 필요 (planner)"
- **관련 plan**: `plan/in-progress/refactor/README.md` §spec 갱신 필요 항목 (목록에 `2-database-query.md` 미등재)
- **상세**: 04 m-4 의 spec 갱신(`spec/4-nodes/4-integration/2-database-query.md §2` 멀티 인스턴스 무효화 + Rationale)이 developer 착수 전 planner 위임 대상으로 기술돼 있으나, README 의 "spec 갱신 필요 항목 (project-planner 위임 대기)" 목록에는 해당 항목이 누락됐다. 또한 `refactor/04-security.md` 자체에는 frontmatter 가 없어 worktree 가 지정되지 않았고, 본 구현 배치를 담당하는 worktree(현재 `plan-complete-turn-timing-aa533b` 기반의 `refactor-approved-batch` 브랜치)가 refactor 하위 plan 들에 명시되지 않은 상태다. 구현은 developer 가 수행하되 `spec/4-nodes/4-integration/2-database-query.md` 편집은 planner 경로를 타야 하는데, 현재 어느 plan 에도 그 planner 작업이 정식 phase 로 등재되지 않았다.
- **제안**: README §spec 갱신 필요 항목 목록에 `2-database-query.md §2 멀티 인스턴스 무효화 + Rationale (04 m-4)` 를 추가하거나, 04 m-4 구현 착수 plan 에 "spec 갱신 phase" 를 명시적으로 포함시킨다. developer 구현과 planner spec 갱신을 같은 PR 에 묶으려면 CLAUDE.md 규칙 상 planner 위임이 선행 또는 병행돼야 함을 plan 에 기록.

---

### [INFO] review_guard _porcelain_path off-by-one fix — 관련 plan 문서 없음
- **target 위치**: 승인 배치 scope 항목 5번째 ("review_guard _porcelain_path off-by-one fix")
- **관련 plan**: 해당하는 in-progress plan 없음
- **상세**: `.claude/` 내 review guard 스크립트의 off-by-one 수정은 소범위 버그 수정으로, 어떤 in-progress plan 과도 충돌하지 않는다. 단 수정 대상 파일이 명시되지 않아 다른 worktree 가 동일 파일을 수정 중인지 확인하기 어렵다. 현재 active worktree 들(kb-unsearchable-warning, trigger-schedule-sync-f88604, unified-model-mgmt-5af7ee)은 `.claude/tools/` 파일을 건드리지 않는다(각 diff 확인 완료).
- **제안**: 수정 파일명을 배치 착수 기록에 명시. 문서화 불필요 수준의 단건 수정이면 현재 구현 PR 에 포함해 종결.

---

### [INFO] 03 M-6·m-2 (dead code 제거) — continuation-bus 관련 spec-sync 계획과 방향 일치 확인
- **target 위치**: `plan/in-progress/refactor/03-maintainability.md` §M-6·§m-2
- **관련 plan**: `plan/in-progress/spec-sync-resume-dispatch-registry.md` (worktree: unstarted), `plan/in-progress/execution-engine-residual-gaps.md`
- **상세**: M-6 는 `continuation-bus.service.ts` 의 `registerContinuationHandlers`/`on()` 제거를 포함한다. `spec-sync-resume-dispatch-registry.md` 는 W2 항목(`interaction-type-registry.md` §1.2 매트릭스 갱신)이 미완료 상태이나, 이는 resume dispatch registry 추가 기술 작업이지 `continuation-bus` dead code 와 직접 충돌하지 않는다. `execution-engine-residual-gaps.md` 는 G1/G2 가 blocked 상태이고 `continuation-bus` 를 직접 수정하지 않는다. 따라서 M-6·m-2 제거는 어떤 in-progress plan 과도 충돌하지 않는다.
- **제안**: 특이사항 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree | branch | Step | 판정 근거 |
| --- | --- | --- | --- |
| `kb-lifecycle-groom-57cc46` | claude/kb-lifecycle-groom-57cc46 | Step 2 | PR MERGED |
| `kb-unsearchable-warning-b47e20` | claude/kb-unsearchable-warning-b47e20 | Step 2 | PR MERGED |
| `plan-complete-ai-review-backlog-85f80a` | claude/plan-complete-ai-review-backlog-85f80a | Step 2 | PR MERGED |
| `spec-sync-audit-998544` | claude/spec-sync-audit-998544 | Step 2 | PR #516 MERGED |
| `trigger-schedule-sync-f88604` | claude/trigger-schedule-sync-f88604 | Step 2 | PR MERGED |

`unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) 는 Step 1 ACTIVE, Step 2 PR 없음(empty) → Step 3 fallback: **active 로 처리**. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장. 해당 worktree 는 `model-config/llm-config/rerank-config` 모듈만 수정하며 target 범위(execution-engine, continuation-bus, parallel-executor, database-query.handler, websocket-protocol spec)와 **교집합 없음** — worktree 충돌 해당 없음.

stale skip 개수: 5건 skip, 1건 active 분석.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

승인된 5개 배치 항목(03 M-6·m-2, 06 M-5, 04 m-4, 06 M-1, review_guard fix)은 현재 in-progress plan 들과 CRITICAL 또는 WARNING 수준의 충돌이 없다. 미해결 결정 우회 없음(5건 모두 2026-06-10 사용자 승인 완료). active worktree(unified-model-mgmt)는 대상 파일 영역과 교집합 없음. 유일한 주의 사항은 (1) 06 M-1 planner 작업 시 PR #516 이 이미 수정한 `spec/5-system/6-websocket-protocol.md` 기준 문구 확인 필요(INFO), (2) 04 m-4 의 spec 갱신 phase 가 어떤 plan 에도 정식 등재되지 않은 추적 공백(INFO), (3) review_guard fix 대상 파일 미명시(INFO) — 세 가지 모두 착수 차단 수준이 아니다. worktree 충돌 후보 6건 중 stale 5건 skip, active 1건 분석(충돌 없음).

## 위험도

LOW
