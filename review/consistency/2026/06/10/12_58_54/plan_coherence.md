## 발견사항

### [WARNING] ai-context-memory-followup-v2 open SPEC-DRIFT item 무통보 해소
- **target 위치**: `spec/5-system/17-agent-memory.md §3` (큐 토폴로지 확정 Rationale 섹션 + 본문 "전용 BullMQ 큐 `agent-memory-extraction`" 표현)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` line 71
  ```
  - [ ] SPEC-DRIFT: `17-agent-memory.md §3 AGM-04` "scheduleBackgroundBody snapshot" 표현 → 전용 BullMQ 큐(`agent-memory-extraction`, concurrency=2) 로 갱신(I1).
  ```
- **상세**: target 브랜치가 `17-agent-memory.md §3` 의 큐 표현("scheduleBackgroundBody snapshot 격리 준수") 을 전용 큐(`agent-memory-extraction`, concurrency 2, scope-단위 jobId 직렬화) 로 정확히 교정하고 Rationale 섹션까지 추가했다. 이 항목은 `ai-context-memory-followup-v2.md` 에서 명시적으로 "SPEC-DRIFT I1" 로 열어둔 플래너 트랙 작업이다. target 이 그 내용을 완수하고 있지만 plan 의 체크박스는 여전히 `[ ]` 로 남아 있어 plan 상태와 실제 spec 상태가 분리된다.
- **제안**: target 브랜치 PR 병합 후 (또는 병합 전에라도) `ai-context-memory-followup-v2.md` line 71 을 `[x]` 로 표기하고 완료 커밋 참조를 추가한다. 해당 plan 의 나머지 open 항목(line 64·65·67·68·72~76·80~84)은 target 브랜치 범위 밖이므로 plan 유지.

---

### [WARNING] spec-sync-resume-dispatch-registry W1 open item 무통보 해소
- **target 위치**: `spec/5-system/4-execution-engine.md` §7.5 다이어그램 + §4.x 이력 노트 (3곳에서 `dispatchResumeTurn`·`resumeTurnRegistry`·`resume-turn-dispatch.ts` 명시 추가)
- **관련 plan**: `plan/in-progress/spec-sync-resume-dispatch-registry.md` W1
  ```
  - [ ] W1 spec/5-system/4-execution-engine.md §7.5 다이어그램·§6.2 서술에 dispatchResumeTurn
        (ordered resumeTurnRegistry, resume-turn-dispatch.ts) 단일 진입점 한 줄 반영.
  ```
- **상세**: target 브랜치가 `spec/5-system/4-execution-engine.md` 를 수정하면서 `§7.5 rehydration 경로 서술`, 다이어그램 주석, 이력 노트에 `dispatchResumeTurn`/`resumeTurnRegistry`/`resume-turn-dispatch.ts` 를 다수 추가했다. 이는 `spec-sync-resume-dispatch-registry.md` W1 이 요구하는 내용을 실질적으로 충족한다. 그러나 plan 의 W1 체크박스는 미갱신이다. W2(interaction-type-registry.md 갱신)는 target 에 포함되지 않아 여전히 open 상태다.
- **제안**: target 브랜치 병합 후 `spec-sync-resume-dispatch-registry.md` 의 W1 을 `[x]` 로 표기(실제 완료 커밋 등재). W2 는 별도 작업으로 유지. 모든 항목이 처리되면 plan 을 `plan/complete/` 로 이동.

---

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md 수정과 ai-agent-tool-connection-rewrite TBD 결정의 직교성 확인
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7 waiting 출력 표 + config echo 정책 단락
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 (도구 등록 모델 TBD 결정 5건)
- **상세**: target 브랜치가 `1-ai-agent.md` 를 수정하지만 변경 범위는 §7 의 `_resumeState`/`_resumeCheckpoint` 생명주기 서술(turn-단위 park rehydration 경로 일원화 반영) 이고, `ai-agent-tool-connection-rewrite` 가 "결정 필요" 로 남긴 §6.1 dispatcher 표·Tool Area 섹션·`toolNodeIds` 스키마는 전혀 건드리지 않는다. 충돌 없음. (추적 메모 목적으로만 기록)

---

### [INFO] 17-agent-memory.md 신규 추가 항목(scope-key 정규화 W-1, data-fence W-2) — plan 결정 항목 아님
- **target 위치**: `spec/5-system/17-agent-memory.md §3·§4`
- **상세**: target 이 `scope_key` SHA-256 정규화(512자 상한)와 `[memory]…[/memory]` data-fence 를 spec 에 추가했다. 이 두 사항은 기존 어떤 plan 의 "결정 필요" 항목에도 포함되지 않는 신규 구현 사항의 역방향 drift 반영이다. `ai-context-memory-followup-v2.md` 에 동명의 W-1·W-2 항목이 있으나 그것들은 전혀 다른 리뷰 아이디(meta.memory/config echo)를 가리킨다. 미해결 결정과의 충돌 없음. (추적 메모)

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검사 결과, 물리적으로 현존하는 worktree 4개(+ target 자신)를 확인했다. target 브랜치와 spec 파일이 겹치는 후보 3건에 대해 stale 판정:

| worktree | branch | Step 1 결과 | Step 2 결과 | 판정 |
|---|---|---|---|---|
| `kb-lifecycle-groom-57cc46` | `claude/kb-lifecycle-groom-57cc46` | ACTIVE (squash) | PR #508 → MERGED | stale skip |
| `kb-unsearchable-warning-b47e20` | `claude/kb-unsearchable-warning-b47e20` | ACTIVE (squash) | PR #508 → MERGED | stale skip |
| `plan-complete-ai-review-backlog-85f80a` | `claude/plan-complete-ai-review-backlog-85f80a` | ACTIVE (squash) | PR #514 → MERGED | stale skip |

위 3개 worktree 는 이미 머지된 PR 의 잔여 checkout 이다. 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

추가로, disk 에는 없지만 local branch 만 남아 있는 stale branch 후보:
- `exec-park-durable-resume` — PR #470 MERGED
- `impl-exec-concurrency-cap` — PR #469 MERGED
- `exec-park-followup-272c4f` — PR #507 MERGED
- `followup-conversation-reconcile` — PR #429 MERGED
- `rag-rerank-impl` — PR #465 MERGED
- `spec-drift-gates-b26bce` — PR #449 MERGED
- `fix-spec-frontmatter-catalog` — PR #453 MERGED

이 branch 들은 worktree 로 체크아웃되지 않아 spec 파일 경합 위험은 없으나, local branch 정리 권장.

`plan-complete-turn-timing-aa533b` (branch `refactor-backlog-audit`) 는 PR OPEN (active) — spec 변경 없음, 충돌 없음.

---

## 요약

target 브랜치(`claude/spec-sync-audit-998544`)의 spec 변경 ~60파일은 기존 plan 의 미해결 결정(TBD)을 우회하거나 active worktree 와 충돌하는 항목 없음. CRITICAL 위험 없음. 발견된 WARNING 2건은 모두 "target 이 plan open 항목을 완수하면서 plan 체크박스 미갱신" 패턴이다 — (1) `ai-context-memory-followup-v2.md` I1 (17-agent-memory §3 queue spec-drift), (2) `spec-sync-resume-dispatch-registry.md` W1 (execution-engine §7.5 dispatchResumeTurn). 두 항목 모두 target 병합 후 해당 plan 의 체크박스를 갱신하면 해소된다. worktree 충돌 후보 3건은 모두 squash-merge 완료된 stale worktree 로 판정해 skip, INFO 로만 기록. 전체 위험도 LOW.

---

## 위험도

LOW

STATUS: OK
