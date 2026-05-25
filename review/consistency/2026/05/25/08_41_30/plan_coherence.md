# Plan 정합성 검토 결과

> 검토 모드: `--impl-prep`, scope=`spec/5-system/`
> 검토 worktree: `workflow-resumable-execution-phase2-cont-64f537`
> 검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] retry-handler-followup 의 미결 spec 항목과 동일 섹션 편집 — 후속 작업자 충돌 위험

- **target 위치**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표 (`INVALID_EXECUTION_STATE` 행 확장 + `RESUME_*` 3개 코드 추가)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1 / #2 / #3
  - WARNING #1: `_retryState` 소비 4단계를 단일 트랜잭션으로 묶는 요건을 `spec/5-system/6-websocket-protocol.md §4.2` 에 명시 (project-planner 위임 미처리)
  - WARNING #2: `execution.retry_last_turn` 이 Continuation Bus 경유하는지 여부 및 게이트웨이 vs 엔진 검증 주체를 `spec/5-system/6-websocket-protocol.md §4.2` 에 명시 (project-planner 위임 미처리)
  - WARNING #3: `execution.retry_last_turn` 에 `INVALID_EXECUTION_STATE` 적용 요건 명시 (project-planner 위임 미처리)
- **상세**: 현재 target 이 `§4.2` 에 `INVALID_EXECUTION_STATE` 확장 설명 (`retry_last_turn` 의 `failed` 기대 포함) 과 `RESUME_*` 3개 코드를 추가한다. retry-handler-followup WARNING #3 은 이 변경으로 사실상 해소(주석: `실행이 기대 상태가 아님 — submit_*/end_conversation 의 waiting_for_input 기대 또는 retry_last_turn 의 failed 기대`)된다. 그러나 WARNING #2 (bus routing 명시) 는 current target 에서 간접적으로 언급("retry_last_turn 은 rehydration 경로를 타지 않는다") 되었지만 "게이트웨이 vs 엔진 검증 주체" 는 미명시 상태다. WARNING #1 (_retryState 트랜잭션 요건) 도 미반영. retry-handler-followup PR 이 동일 §4.2 에 텍스트를 추가할 때 현재 target 이 추가한 내용(특히 `INVALID_EXECUTION_STATE` 설명)을 재정의하지 않도록 주의가 필요하다.
- **제안**:
  1. `plan/in-progress/retry-handler-followup.md` 에 현재 target 이 WARNING #3 을 사실상 해소했음을 체크박스 주석으로 기록.
  2. WARNING #2 의 "게이트웨이 vs 엔진 검증 주체" 는 별도 항목으로 retry-handler-followup PR 에서 추가. 현재 target 의 §4.2 설명과 모순되지 않으므로 additive 편집으로 충분.
  3. `spec/5-system/4-execution-engine.md §7.5.1` 마지막 NOTE 에 이미 "retry-handler-followup 작업이 별 PR 로 spec 추가 시 §7.5.1 참조하여 사용" 안내가 기재되어 있어 재정의 방지는 어느 정도 확보됨.

---

### [WARNING] retry-handler-followup 의 spec/5-system/4-execution-engine.md 미결 편집 항목

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5.1`, §9.3 (task-queue 삭제), §11 (task-queue 토큰 제거)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1 / #5
  - WARNING #1: `_retryState` 소비 원자성 (SELECT FOR UPDATE) 을 `spec/5-system/4-execution-engine.md` 보존 예외 섹션에 추가 (project-planner 미처리)
  - WARNING #5: `_retryState.expiresAt` TTL 기본값을 `spec/5-system/4-execution-engine.md §8 or §7` 에 단일 진실로 명시 (project-planner 미처리)
- **상세**: 현재 target 이 편집하는 섹션(§7.5.1 신설, §9.3 task-queue 삭제, §11 정정)은 retry-handler-followup 이 편집하려는 §7 또는 §8 의 `_retryState` 서브섹션과 물리적으로 다른 섹션이므로 직접 충돌은 없다. 그러나 spec/5-system/4-execution-engine.md §1.3 에 이미 `_retryState` shape + TTL(60분) 이 기술되어 있으며(commit `d109dbd3`/multiturn-error-preserve 작업 반영), WARNING #5 가 원하는 "단일 진실 위치" 가 기실 §1.3 임을 명시하는 작업이 여전히 미결이다. target 변경이 이 결정을 내리지는 않으므로 충돌은 아니지만, target 이 merge 된 후에도 retry-handler-followup 이 §7 또는 §8 에 중복 TTL 정의를 만들 위험이 있다.
- **제안**: `plan/in-progress/retry-handler-followup.md` WARNING #5 에 "§1.3 이 이미 60분 TTL SoT 로 기술됨 — §7/§8 신규 정의 대신 §1.3 cross-link 로 충분할 수 있음" 주석 추가. target PR merge 후 retry-handler-followup 착수 전 §1.3 내용 확인 권장.

---

### [INFO] spec/5-system/1-auth.md — 2fa-webauthn-followups 미완료 항목은 spec 무관

- **target 위치**: `spec/5-system/1-auth.md` (impl-prep 검토 대상에 포함)
- **관련 plan**: `plan/in-progress/2fa-webauthn-followups.md` — 항목 2(e2e 테스트), 3(mobile Safari 검증), 10(login_history 1M row 모니터링) 미완료
- **상세**: 미완료 항목 3건 모두 테스트/검증/모니터링 작업이며 spec/5-system/1-auth.md 에 추가 편집을 요하지 않는다. 현재 target 이 spec/5-system/1-auth.md 를 직접 수정하지 않으므로 충돌 없음.
- **제안**: 추적 불필요.

---

### [INFO] spec/5-system/10-graph-rag.md — 전체 frontmatter 갱신이 모든 세 predecessor 브랜치에 공통 포함

- **target 위치**: `spec/5-system/10-graph-rag.md` (frontmatter `status`/`code:` 갱신)
- **관련 plan**: 현재 없음 (이미 Phase 0 시점에 반영됨)
- **상세**: `workflow-resumable-execution-6b105e`, `phase2-a6b133`, `phase2-cont-64f537` 세 브랜치 모두 동일 파일을 수정하나 이는 stacked PR chain 의 동일 변경이 전파된 것. 충돌 없음.
- **제안**: 추적 불필요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 중 stale 판정으로 제외된 항목:

- `ai-agent-formdata-size-limit-2ad8ff` (branch `claude/ai-agent-formdata-size-limit-2ad8ff`) — Step 2 PR MERGED
- `chat-channel-e2e-hardening-5ff799` (branch `claude/chat-channel-e2e-hardening-5ff799`) — Step 2 PR MERGED
- `chat-channel-unverified-owner-e2e-d74fda` (branch `claude/chat-channel-unverified-owner-e2e-d74fda`) — Step 2 PR MERGED
- `chat-channel-validation-constants-e9e037` (branch `claude/chat-channel-validation-constants-e9e037`) — Step 2 PR MERGED
- `chore-stale-plan-cleanup-c7e170` (branch `claude/chore-stale-plan-cleanup-c7e170`) — Step 2 PR MERGED
- `fix-secret-store-root-entities-6aa869` (branch `claude/fix-secret-store-root-entities-6aa869`) — Step 2 PR MERGED
- `password-hash-format-guard-60f7f2` (branch `claude/password-hash-format-guard-60f7f2`) — Step 2 PR MERGED
- `trigger-create-multi-provider-ui-plan-677f12` (branch `claude/trigger-create-multi-provider-ui-plan-677f12`) — Step 2 PR MERGED
- `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` (branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`) — Step 2 PR MERGED
- `fix-frontend-dockerfile-chat-channel-validation-04fe3e` (branch `claude/fix-frontend-dockerfile-chat-channel-validation-04fe3e`) — Step 2 PR MERGED
- `spec-followup-cron-7d-statemachine-868886` (branch 미등록 — plan frontmatter `worktree: spec-followup-cron-7d-statemachine-868886`) — Step 2 PR #216 MERGED

위 11개 worktree 는 모두 이미 main 에 머지된 branch 의 정리되지 않은 worktree 디렉터리 또는 plan 항목이다. `./cleanup-worktree-all.sh --yes --force` 실행으로 물리적 디렉터리 정리 권장.

**ACTIVE 로 처리한 predecessor worktree** (스택형 PR chain — 충돌 아님):
- `workflow-resumable-execution-6b105e` — Step 1/2 모두 음성. 그러나 phase2-cont-64f537 의 직접 ancestor (8 commits < 20 commits). 현재 target 이 이 브랜치의 모든 spec 변경을 포함함. 병렬 편집 경합 없음.
- `workflow-resumable-execution-phase2-a6b133` — Step 1/2 모두 음성. 동일하게 direct ancestor. 병렬 경합 없음.

---

## 요약

현재 target(`spec/5-system/` impl-prep)은 `workflow-resumable-execution-phase2-cont-64f537` 의 spec-update 작업으로, `spec/5-system/4-execution-engine.md` §7.5.1 신설 / §9.3 정정 / §11 정정 및 `spec/5-system/6-websocket-protocol.md` §4.2 `queued` 필드 + `RESUME_*` 코드 추가 / `INVALID_EXECUTION_STATE` 확장이 핵심이다. 미해결 결정을 일방적으로 override 하거나 active parallel worktree 와 진짜 경합하는 CRITICAL 충돌은 없다. 다만 `plan/in-progress/retry-handler-followup.md` 의 WARNING #1/#2/#5 가 동일 spec 파일 `spec/5-system/4-execution-engine.md` + `spec/5-system/6-websocket-protocol.md §4.2` 에 additive 편집을 예정하고 있어 해당 PR 이 착수 전 현재 target 의 변경 내용을 참조해야 한다는 WARNING 2건이 식별됨. worktree 충돌 후보 13건 중 stale 11건 skip (8개 MERGED PR + 2개 plan-only 미등록 + 1개 PR #216 MERGED), active 2건(predecessor stacked PR)은 충돌 아님으로 판정.

---

## 위험도

LOW
