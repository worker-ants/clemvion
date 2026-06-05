# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target 범위: `spec/5-system` (전체)
검토 기준 branch: `claude/exec-park-pr-b2` (exec-park-durable-resume worktree)

---

## 발견사항

### [WARNING] exec-park D6 미구현 상태가 spec 에 "설계 확정" 으로 기술됨
- target 위치: `spec/5-system/4-execution-engine.md` §6.2 (waiting_for_input 진입 시 표 (e) 항목), §7.5 "중첩 sub-workflow 재개" 절, §Rationale "exec-park D6"
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` Phase B (PR-B2 미완료)
- 상세: target 이 추가한 `Execution.resume_call_stack jsonb`(V087) 컬럼·타입·`CALL_STACK_SCHEMA_VERSION` 은 DB 에 추가됐으나, 실제 park 시 stage 로직과 §7.5 재귀 재진입 로직은 "PR-B2 후속 커밋에서 구현" 으로 미완이다. spec 본문이 이 사실을 "(구현 상태 2026-06-06: ... stage 와 재귀 재진입은 PR-B2 후속 커밋에서 구현 — 그 전까지 NULL 유지)" 로 명시하고 있어 plan 과 충돌은 아니나, `--impl-done` 체크포인트에서 spec 이 미구현 설계를 "확정" 으로 선언한 채 PR-B2 착수를 기다리는 상태다. exec-park-durable-resume plan 의 Phase 0 미해소 항목("(A2/B2 착수 전) PR3 의 rehydration 일반화... 직렬화 순서 확정") 이 여전히 미체크이며, D6 의 "재귀 재진입" 은 PR-B2 와 결합된다.
- 제안: exec-park-durable-resume plan 의 Phase B 미완 항목(PR-B2, B3 정리, Phase 0 미체크)을 plan 에 명기하고, V087 컬럼이 이미 main 에 머지되었는지(migration 격리 여부) 확인 필요. spec 은 적절히 "(구현 예정)" 를 표기하고 있으므로 spec 자체의 즉각 수정보다는 plan 의 PR-B2 착수조건(Phase 0 체크박스) 완결을 선행해야 한다.

### [WARNING] impl-concurrency-cap-pr2b (PR2b) 의 spec/5-system/4-execution-engine.md 덮어쓰기 위험 — plan 이 인지하나 미해소
- target 위치: `spec/5-system/4-execution-engine.md` 전반 (Phase B 서술, §4.x, §7.4, §7.5, §Rationale)
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §"진행 메모" W4; `plan/in-progress/exec-intake-queue-impl.md` PR2b
- 상세: exec-park plan 의 W4 에 "impl-concurrency-cap-pr2b worktree 가 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 모델로 수정 중 → PR-B1 머지 후 그 브랜치가 spec push 시 Phase B 서술 덮어쓰기 위험" 이 기록되어 있다. stale cascade 검사 결과 `claude/impl-concurrency-cap-pr2b` 는 Step 1(ancestor 검사) ACTIVE, Step 2(GitHub PR) empty — Step 3 fallback으로 ACTIVE 처리됨. 해당 branch 의 `git diff origin/main...claude/impl-concurrency-cap-pr2b` 결과는 `plan/in-progress/exec-intake-queue-impl.md` 수정만 있어 현재로서는 spec 파일을 직접 손대고 있지 않으나, PR2b 착수 시 spec 수정이 예정되어 있다. exec-park plan 이 "PR-B1 머지 후 PR2b rebase 선행을 착수조건에 명기하라" 고 요구했지만, exec-intake-queue-impl plan 에는 아직 해당 착수조건 명기가 없다 (PR2b 체크박스만 있고 rebase 선행 문구 없음).
- 제안: `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목에 "착수 전 origin/main(PR-B1 포함)으로 rebase 선행" 조건을 planner 가 명기한다.

### [WARNING] Phase 0 미해소 항목이 PR-B2 착수 선행조건임에도 plan 에 미체크 상태
- target 위치: `spec/5-system/4-execution-engine.md` (target 의 PR-B2 예정 구현 전제)
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` Phase 0 체크박스 3개 모두 미체크
- 상세: exec-park plan §Phase 0 의 세 항목(① PR3 rehydration 일반화 직접 구현, ② node-cancellation §2 직렬화 순서 확정, ③ 출처 plan 항목 이관 표기)이 "A2/B2 착수 전 선행" 으로 기재되었으나 세 항목 모두 미체크. PR-B2 가 §7.5 재귀 재진입(D6)·멀티턴 turn-park(B3)·pendingContinuations 제거를 담는다면 이 선행항목 완결 여부가 중요하다. target 의 §7.5 중첩 재개 설계가 PR-B2 구현을 전제로 하므로, Phase 0 미완은 곧 PR-B2 착수 차단 조건의 미해소다.
- 제안: exec-park-durable-resume plan Phase 0 각 항목의 현행 상태를 업데이트하거나(A3/B1 완료로 PR3 일반화 기반은 생겼으므로), 해당 항목이 실질적으로 해소되었다면 체크 처리. 미해소라면 PR-B2 착수 전 완료해야 함을 plan 에 명시.

### [INFO] spec-sync-execution-engine-gaps.md worktree 가 spec-sync-audit 으로 남아있음 — active worktree 디렉토리 없음
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에 `plan/in-progress/spec-sync-execution-engine-gaps.md` 등재
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree: spec-sync-audit) — 디렉토리 `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit` 미존재
- 상세: spec-sync-execution-engine-gaps plan 의 모든 항목이 완료/forwarding 처리됐고 "비고" 에 최종 정리 완료 메모가 있다. pending_plans 에 등재는 유지되나 실질 미해소 항목이 없는 상태. worktree 도 cleanup 된 것으로 보인다. 완료 처리 또는 `plan/complete/` 이동을 고려할 수 있음.
- 제안: spec-sync-execution-engine-gaps.md 가 실질 완료라면 plan-lifecycle 규칙에 따라 complete 폴더로 이동하고 spec frontmatter `pending_plans` 에서 제거. 아니면 현 상태 유지 가능 (추적 가드로서 의미 있음).

### [INFO] 1-auth.md pending_plans 에 등재된 auth-config-webhook-followups.md 가 unstarted 상태
- target 위치: `spec/5-system/1-auth.md` frontmatter `pending_plans`
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` (worktree: unstarted, status: backlog)
- 상세: auth-config-webhook-followups plan 의 미구현 항목(AuthConfig CRUD audit 기록, chatChannel 비활성 트리거 순서, spec 보완 3종)이 미착수 백로그로 남아있다. target spec 변경과 직접 충돌은 없다. spec 이 약속한 감사 로그(auth_config.create/update/delete/regenerate) 가 여전히 미구현이므로 1-auth.md 의 `status: partial` 은 유효.
- 제안: 변경 없음. 현행 partial 상태와 plan 추적이 정합하다.

### [INFO] ai-agent-tool-connection-rewrite.md 가 spec/5-system/14-external-interaction-api.md 에 cross-ref 를 갖고 미착수 (worktree: unstarted, 결정 TBD)
- target 위치: `spec/5-system/14-external-interaction-api.md` §5.2 (SSE payload name 필드)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (worktree: unstarted) — 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅·ND-AG-21 우선순위 모두 TBD
- 상세: 해당 plan 이 EIA §5.2 의 `execution.tool_call_started/completed` payload `name` 필드 namespace 를 "본 plan 의 도구 이름 규칙 결정 후 동기화" 로 지정했으나 plan 자체가 미착수·결정 TBD다. 현재 target spec 은 이 미결 사항과 충돌하는 결정을 내리지 않고 있다 — 단순히 해당 plan 이 확정되기 전에는 EIA §5.2 의 tool 이름 규칙 서술이 잠재적 drift 상태다.
- 제안: 추적 메모로 충분. ai-agent-tool-connection-rewrite plan 이 활성화될 때 EIA spec 동기화 필요함을 현행 plan 에 명기하는 수준이면 됨.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`)

- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE (HEAD 가 origin/main 의 조상 아님), Step 2 GitHub PR empty (PR 미등록), Step 3 fallback active 처리. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장. 현재 branch 의 diff 는 plan 파일 1개만 수정이라 spec 파일 직접 충돌 없음(worktree 경합 위험은 PR2b 착수 시점에 현실화).

stale skip 건수: 0건 (위 후보는 stale 비해당 → active 로 분류).

---

## 요약

`spec/5-system` 전체를 대상으로 한 --impl-done 관점 Plan 정합성 검토 결과, CRITICAL 발견사항은 없다. 주요 발견은 두 WARNING이다: (1) exec-park PR-B2 가 구현 예정인 중첩 sub-workflow 재개(D6) 설계가 spec 에 "설계 확정·미구현" 으로 기술되어 있어 Phase 0 선행항목 3건이 미체크인 채 PR-B2 착수 진입이 가능한 상황이고, (2) impl-concurrency-cap-pr2b 브랜치가 PR2b 착수 시 `spec/5-system/4-execution-engine.md` 의 Phase B 서술을 덮어쓸 위험이 있으나 exec-intake-queue-impl plan 에 rebase 선행 착수조건이 미명기 상태다. 미해결 결정 일방 우회나 active worktree 간 즉각적 파일 충돌은 없다. worktree 충돌 후보 1건을 stale cascade 로 검사했으나 stale 미해당으로 active 처리했으며, 현시점 spec 파일 직접 충돌은 없다.

---

## 위험도

MEDIUM
