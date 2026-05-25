# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 기준일**: 2026-05-25

---

## 발견사항

### [INFO] target 이 상위 plan 의 spec-fix draft 위임 흐름을 정확히 따르고 있음

- target 위치: 전체 문서 (목적 및 제안 변경 섹션)
- 관련 plan: `plan/in-progress/workflow-resumable-execution.md` §Phase 1 line 49
- 상세: `workflow-resumable-execution.md` Phase 1.2 가 "spec §11 clarification → spec-fix draft 예정" 이라고 명시했고, target 은 정확히 그 spec-fix draft 역할을 수행한다. target 이 제안하는 §11 step 1 과 step 4 의 Phase scope 명시 방향이 상위 plan 의 의도와 일치한다.
- 제안: 별도 조치 불요.

### [INFO] Phase 1.3 (skip 가능 여부) 미결 결정이 target 과 직접 충돌하지 않음

- target 위치: 없음 (target 은 Phase 1.3 을 다루지 않음)
- 관련 plan: `plan/in-progress/workflow-resumable-execution.md` §Phase 1, line 53 — "본 단계는 Phase 2 가 같은 sprint 안에 진행될 경우 skip 가능. 사용자 영향 분석 후 결정."
- 상세: Phase 1.3 (`SESSION_INTERRUPTED` 임시 마킹) 은 아직 열린 결정이다. target 은 §11 step 4 의 spec 텍스트를 `failed` 일괄 마킹으로 단순화하는 안을 제안하는데, Phase 1.3 이 구현되면 `cancelled` 코드 경로가 추가된다. 두 변경이 같은 §11 step 4 공간에 영향을 주므로 상호 인지가 필요하다. 다만 target 의 제안이 Phase 1.3 을 막거나 번복하지는 않는다.
- 제안: target 의 `## 주의사항` 에 "Phase 1.3 (`SESSION_INTERRUPTED`) 구현 결정 시 step 4 주석에 `cancelled` 경로 추가 필요" 한 줄 보완 권장.

### [WARNING] `WORKER_HEARTBEAT_TIMEOUT` 추가 — 상위 plan 및 spec 의 기존 W-21 항목 연결 명시 미흡

- target 위치: `spec/1-data-model.md §2.13 error.code 어휘 보완 (W-21 연관)` 섹션
- 관련 plan: `plan/in-progress/workflow-resumable-execution.md` §Phase 0 — Phase 0 checklist 의 `spec/1-data-model.md §2.13` 항목은 "신규 5종 코드 노트 추가" 라고 되어 있으나, 실제 worktree 의 현행 `spec/1-data-model.md §2.13` 에는 `WORKER_HEARTBEAT_TIMEOUT` 가 포함되지 않은 상태임. 즉 Phase 0 이 이미 완료 체크됐음에도 해당 코드가 누락된 채 있는 불일치가 있다.
- 상세: `workflow-resumable-execution.md` Phase 0 은 모두 `[x]` 완료 처리되어 있다. 그러나 현재 worktree 의 `spec/1-data-model.md §2.13` 을 확인하면 `SERVER_INTERRUPTED / RESUME_FAILED / RESUME_CHECKPOINT_MISSING / RESUME_INCOMPATIBLE_STATE` 는 등재되어 있으나 `WORKER_HEARTBEAT_TIMEOUT` 은 없다. target 은 이 누락을 메우려는 제안인데, Phase 0 완료 표시와의 불일치에 대한 설명이 없다.
- 제안: target 의 `## 원본 발견사항` 에 "W-21 은 Phase 0 이후 발견된 누락이므로 Phase 0 체크리스트와 별도로 처리" 임을 명시. 상위 plan `workflow-resumable-execution.md` 의 Phase 0 체크리스트에 `spec/1-data-model.md §2.13 WORKER_HEARTBEAT_TIMEOUT` 추가 항목으로 기재하거나, 미반영 여부를 별도 sub-task 로 추적.

### [WARNING] `retry-handler-followup.md` 의 WARNING #2 — Continuation Bus 교체 연동 업데이트 미반영

- target 위치: target 문서 전체 (간접 관련)
- 관련 plan: `plan/in-progress/retry-handler-followup.md` WARNING #2 (line 21) — "`execution.retry_last_turn` 이 Continuation Bus (`execution:continuation` 채널) 경유 여부가 미명시"
- 상세: `workflow-resumable-execution.md` Phase 2 (§2.6) 는 Redis pub/sub `execution:continuation` 채널을 BullMQ `execution-continuation` 큐로 교체한다. 상위 plan 의 "다음 단계" (line 94) 는 `retry-handler-followup.md` 에 "WARNING #2 는 BullMQ 기준으로 작성하라" 한 줄 추가를 명시했다. 이 업데이트가 아직 `retry-handler-followup.md` 에 반영되지 않았다. target plan 이 spec-fix 단계를 완료하고 spec 이 업데이트되면, `retry-handler-followup.md` 의 WARNING #2 가 가리키는 `execution:continuation` 채널 표기도 함께 시대착오가 된다.
- 제안: `workflow-resumable-execution.md` 의 "다음 단계" 에서 지시한 `retry-handler-followup.md` 갱신이 아직 미실행이므로, spec-fix 가 merge 되기 전 또는 동시에 `retry-handler-followup.md` WARNING #2 에 "NOTE: `execution:continuation` 채널은 Phase 2 (BullMQ) 로 교체 예정 — 본 WARNING 의 §4.2 명시는 BullMQ `execution-continuation` 큐 기준으로 작성" 을 추가해야 한다.

### [INFO] `parallel-p2.md` 의 errorPolicy 영역이 target 과 개념적으로 겹치나 충돌하지 않음

- target 위치: `spec/5-system/4-execution-engine.md §11 step 4` 제안 (errorPolicy 분기 삭제)
- 관련 plan: `plan/in-progress/parallel-p2.md` — Parallel 노드의 `errorPolicy` schema 노출 작업 진행 중
- 상세: target 은 graceful shutdown 에서의 errorPolicy 분기를 Phase 1 에서는 제거(일괄 stop 처리)하겠다는 제안이다. `parallel-p2.md` 의 errorPolicy 는 노드 실행 분기 정책(Parallel 내 노드 단위 에러 처리)이며, graceful shutdown 컨텍스트와 의미가 다르다. worktree 도 미정 상태여서 병렬 충돌 없음.
- 제안: 별도 조치 불요. 단 Phase 2 에서 `continue` 분기 재도입 시 두 영역의 errorPolicy 의미를 명확히 구분하는 주석 추가 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토: target 이 수정하는 spec 파일은 `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`. 이 파일들을 보유한 다른 worktree 중 active 여부를 확인한 결과:

| worktree | branch | Step 1 결과 | Step 2 결과 | 판정 |
|---|---|---|---|---|
| `ai-agent-formdata-size-limit-2ad8ff` | `claude/ai-agent-formdata-size-limit-2ad8ff` | ACTIVE (step 1 통과 못함) | PR MERGED | **stale skip** |
| `chat-channel-dispatcher-split-impl-d7c3ea` | `claude/chat-channel-dispatcher-split-impl-d7c3ea` | ACTIVE | PR MERGED | **stale skip** |
| `chat-channel-e2e-hardening-5ff799` | `claude/chat-channel-e2e-hardening-5ff799` | ACTIVE | PR MERGED | **stale skip** |
| `chat-channel-unverified-owner-e2e-d74fda` | `claude/chat-channel-unverified-owner-e2e-d74fda` | ACTIVE | PR MERGED | **stale skip** |
| `chat-channel-validation-constants-e9e037` | `claude/chat-channel-validation-constants-e9e037` | ACTIVE | PR MERGED | **stale skip** |
| `chore-stale-plan-cleanup-c7e170` | `claude/chore-stale-plan-cleanup-c7e170` | ACTIVE | PR MERGED | **stale skip** |
| `fix-frontend-dockerfile-chat-channel-validation-04fe3e` | `claude/fix-frontend-dockerfile-chat-channel-validation-04fe3e` | ACTIVE | PR MERGED | **stale skip** |
| `fix-secret-store-root-entities-6aa869` | `claude/fix-secret-store-root-entities-6aa869` | ACTIVE | PR MERGED | **stale skip** |
| `password-hash-format-guard-60f7f2` | `claude/password-hash-format-guard-60f7f2` | ACTIVE | PR MERGED | **stale skip** |
| `test-stages-docker-build-guard-fcb7cc` | `claude/test-stages-docker-build-guard-fcb7cc` | ACTIVE | PR MERGED | **stale skip** |
| `trigger-create-multi-provider-ui-plan-677f12` | `claude/trigger-create-multi-provider-ui-plan-677f12` | ACTIVE | PR MERGED | **stale skip** |

11개 worktree 모두 squash-merge 된 PR 로 stale 확인 (Step 1: git ancestor 검사 음성 — squash merge 이므로 hash 불일치. Step 2: GitHub PR state = MERGED). 이들은 이미 머지됐으나 worktree 디렉토리가 정리되지 않은 상태.

해당 worktree 들은 `./cleanup-worktree-all.sh --yes --force` 실행으로 정리 권장.

`retry-handler-followup.md` 가 가리키는 `multiturn-error-preserve` worktree 는 git worktree list 에 미등록 상태 — 이미 제거되었거나 등록 해제됨. spec 파일 경합 위험 없음.

---

## 요약

target `spec-fix-graceful-shutdown-phase-scope.md` 는 상위 plan `workflow-resumable-execution.md` 가 Phase 1.2 완료 후 명시적으로 예고한 spec-fix draft 역할을 충실히 수행하고 있어 미해결 결정과의 직접 충돌은 없다. 주요 주의사항 두 가지: (1) `WORKER_HEARTBEAT_TIMEOUT` 어휘 추가가 Phase 0 완료 체크 이후에 발견된 누락임이 plan 에 명확히 기재되어 있지 않아 Phase 0 완료 표시와 불일치하는 외관이 있다 (WARNING). (2) `workflow-resumable-execution.md` 가 "다음 단계" 에서 지시한 `retry-handler-followup.md` WARNING #2 갱신이 아직 미실행 상태이며, spec-fix 가 확정되면 해당 plan 도 동시에 업데이트해야 한다 (WARNING). CRITICAL 급 충돌 또는 active worktree 경합은 발견되지 않았다. worktree 충돌 후보 11건 중 stale 11건 skip, active 0건 분석.

---

## 위험도

LOW
