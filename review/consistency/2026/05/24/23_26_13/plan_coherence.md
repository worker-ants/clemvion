# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] retry-handler-followup plan 과의 `spec/5-system/6-websocket-protocol.md §4.2` 동시 수정 충돌 위험

- **target 위치**: 변경 2 §2.1 — `§4.2` 공통 에러 코드 표에 `RESUME_QUEUED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 4개 행 추가
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #2 / #3 — "Continuation Bus 경유 여부와 `FAILED` 상태 검증 주체를 `spec/5-system/6-websocket-protocol.md §4.2` 에 명시. `project-planner` 위임." + WARNING #3 "에러 코드 표에 `INVALID_EXECUTION_STATE` 추가 ... `project-planner` 위임."
- **상세**: 두 plan 모두 `spec/5-system/6-websocket-protocol.md §4.2` 의 에러 코드 표를 직접 수정한다. `retry-handler-followup` 은 `INVALID_EXECUTION_STATE` / `EXECUTION_NOT_FAILED` 행 추가, 본 target 은 `RESUME_*` 4종 행 추가다. 동일 표에 대한 병렬 수정이므로 spec 파일 편집 충돌 위험이 있다. 또한 `retry-handler-followup` WARNING #2 는 "Continuation Bus 경유 여부" 결정을 아직 미해소로 남겨두었는데, 본 target 은 §7.4 에서 Redis pub/sub → BullMQ 로의 전환을 이미 결정·기술하고 있다. `execution.retry_last_turn` 이 기존 Continuation Bus 경유 패턴을 따르는지 여부는 이 결정과 맞물린다 — BullMQ 전환 후에도 `retry_last_turn` 은 별도 경로인지, 동일 `execution-continuation` 큐를 쓰는지가 §4.2 명시 전에 합의되어야 한다.
- **제안**: 두 spec 작업을 같은 project-planner 사이클에서 순차 처리하거나, `retry-handler-followup` WARNING #2/3 의 §4.2 추가 내용을 먼저 확정한 뒤 본 target 의 §4.2 수정을 뒤에 붙이는 순서를 plan 에 명시. `retry-handler-followup.md` 에 "본 plan 의 §4.2 수정은 `spec-draft-workflow-resumable-execution` 이 §7.4 BullMQ 전환을 적용한 뒤에 맞춰 작성할 것" 주석 추가 권장.

---

### [WARNING] retry-handler-followup plan 과의 `spec/5-system/4-execution-engine.md` 동시 수정 충돌 위험

- **target 위치**: 변경 1 §1.1~§1.8 — `spec/5-system/4-execution-engine.md` 전반 수정 (§7.4 / §7.5 / §7.2 / §7.4 Recovery / §11 신설)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1 / #5 — `spec/5-system/4-execution-engine.md §8 또는 §7` 에 `_retryState.expiresAt` TTL 기본값 / 환경변수 / cleanup 정책 추가. WARNING #1 은 같은 파일의 "보존 예외 섹션" 추가 요청.
- **상세**: 두 plan 이 모두 `spec/5-system/4-execution-engine.md §7` 영역을 수정한다. target 은 §7.2 / §7.4 / §7.5 를 수정하고, `retry-handler-followup` 은 §7 또는 §8 에 새 절을 추가한다. 충돌 심각도는 낮으나 (절 범위가 다름), 단일 spec 파일에 병렬 편집이 발생하면 리뷰 단계에서 머지 충돌이 생길 수 있다. 선행·후속 관계를 plan 에 명시하지 않으면 한쪽이 다른 쪽의 편집 내용을 덮을 위험.
- **제안**: target plan 의 "다음 단계" §3 에 "Phase 0 spec 반영 후, `retry-handler-followup.md` 의 WARNING #1/#5 §4-execution-engine 추가 작업은 별 commit 으로 이어서 진행" 명시. `retry-handler-followup.md` 에도 "§4-execution-engine 수정은 `workflow-resumable-execution` spec 반영 이후 착수" 주석 권장.

---

### [WARNING] `self-hosting-deployment.md` 에 `terminationGracePeriodSeconds` 연동 cross-link 누락

- **target 위치**: 변경 1 §1.6 신규 §11 Graceful Shutdown — "k8s 측 설정: `terminationGracePeriodSeconds` 를 `SIGTERM_GRACE_MS / 1000 + 5` 이상으로 둔다" + 영향받지 않는 영역 표의 `self-hosting-deployment.md` "보완적 — cross-link 필요" 표기
- **관련 plan**: `plan/in-progress/self-hosting-deployment.md` §4 Kubernetes Helm Chart 작업 단위 — Deployment template 의 `terminationGracePeriodSeconds` 값 설정 항목이 아직 없음. 해당 plan 에 frontmatter `worktree` 필드가 없어 어느 worktree 가 담당하는지 추적 불가.
- **상세**: target 이 "cross-link 필요"라고 자인하면서도 실제 `self-hosting-deployment.md` 에 추가 사항을 반영하지 않았다. Helm Chart 작업자가 본 spec §11 의 공식 `terminationGracePeriodSeconds` 공식을 놓칠 위험이 있다. `self-hosting-deployment.md` 에 worktree 가 배정되면 그 작업자가 이 변경을 인지하지 못할 수 있다.
- **제안**: target plan 의 "다음 단계" 또는 별도 행동 항목으로 "`plan/in-progress/self-hosting-deployment.md §4` 에 `terminationGracePeriodSeconds = SIGTERM_GRACE_MS/1000 + 5` 설정 항목 및 `spec/5-system/4-execution-engine.md §11` cross-link 추가" 를 포함. `self-hosting-deployment.md` 에도 동일 내용 직접 추가 권장.

---

### [WARNING] `retry-handler-followup` 이 가정하는 Continuation Bus 가 BullMQ 전환 이후에도 유효한지 명시 필요

- **target 위치**: 변경 1 §1.4 — 기존 Redis pub/sub (`execution:continuation` 채널) 을 BullMQ `execution-continuation` 큐로 **단일 배포에서 완전 교체**. 레거시 pub/sub 은 "단일 phase 에서 제거".
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #2 — "Continuation Bus(`execution:continuation` 채널) 경유 여부" 라는 표현이 아직 Redis pub/sub 채널명을 SoT 로 인식. 이 plan 의 spec 추가는 "교체 전 버전" 기준으로 작성될 위험.
- **상세**: `retry-handler-followup` WARNING #2 가 spec 에 추가될 내용의 기준점이 BullMQ 전환 이전의 Redis pub/sub 모델이면, 본 target 적용 후 이중 아키텍처 설명이 spec 에 혼재하게 된다. target 은 "이행 정책" 에서 dual-write 없이 단일 배포 교체를 명시했으나, `retry-handler-followup` 에는 이 전제가 없다.
- **제안**: `retry-handler-followup.md` WARNING #2 설명을 업데이트하여 "Continuation Bus 는 BullMQ `execution-continuation` 큐로 교체된 이후 기준으로 spec 작성" 임을 명시. 본 target 의 §1.4 에 "후속 plan `retry-handler-followup` WARNING #2 가 이 절을 기반으로 §4.2 를 작성해야 함" cross-reference 추가.

---

### [INFO] `0-unimplemented-overview.md` plan 목록에 본 작업 미등재

- **target 위치**: target frontmatter `worktree: workflow-resumable-execution` + 다음 단계 §3 "정식 plan 문서 생성 예정"
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` — plan 목록 (§plan 문서 목록) 에 `workflow-resumable-execution` / `spec-draft-workflow-resumable-execution` 항목 없음.
- **상세**: target 은 pre-consistency-check draft 상태이므로 정식 plan 이 아직 생성되지 않은 것은 의도적이다. 다만 consistency-check 통과 후 정식 plan 생성 시 `0-unimplemented-overview.md` 의 목록 갱신도 함께 수행해야 한다.
- **제안**: target 의 "다음 단계 §3" 에 "`0-unimplemented-overview.md` plan 목록 갱신" 항목 추가 권장.

---

### [INFO] `spec/1-data-model.md §2.13` Execution.error 설명 보강 — 별도 plan 연계 확인 권장

- **target 위치**: 변경 3 — "Execution.error JSONB 에 새 code 값 4종 추가 — spec 본문 §2.13 설명 한 줄 보강만 필요"
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` (data-model 관련 후속이 있을 수 있음) — 직접 충돌 확인 필요하지 않으나, `spec/1-data-model.md` 를 편집하는 다른 진행 중 plan 이 있는지 착수 전 재확인 권장.
- **상세**: 현재 active worktree 들은 모두 MERGED PR 상태(stale)이므로 파일 경합 위험은 없으나, spec 편집 시 항상 동시 편집 가능성을 점검해야 한다.
- **제안**: target 의 Phase 0 spec 반영 착수 직전, `spec/1-data-model.md` 를 수정 중인 다른 plan 이 없는지 재확인.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 Step 2 (GitHub PR state) 로 stale 판정된 항목:

- `ai-agent-formdata-size-limit-2ad8ff` (branch `claude/ai-agent-formdata-size-limit-2ad8ff`) — Step 1: ACTIVE (squash merge), Step 2: PR MERGED
- `chat-channel-dispatcher-split-impl-d7c3ea` (branch `claude/chat-channel-dispatcher-split-impl-d7c3ea`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-e2e-hardening-5ff799` (branch `claude/chat-channel-e2e-hardening-5ff799`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-unverified-owner-e2e-d74fda` (branch `claude/chat-channel-unverified-owner-e2e-d74fda`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-validation-constants-e9e037` (branch `claude/chat-channel-validation-constants-e9e037`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chore-stale-plan-cleanup-c7e170` (branch `claude/chore-stale-plan-cleanup-c7e170`) — Step 1: ACTIVE, Step 2: PR MERGED
- `fix-frontend-dockerfile-chat-channel-validation-04fe3e` (branch `claude/fix-frontend-dockerfile-chat-channel-validation-04fe3e`) — Step 1: ACTIVE, Step 2: PR MERGED
- `fix-secret-store-root-entities-6aa869` (branch `claude/fix-secret-store-root-entities-6aa869`) — Step 1: ACTIVE, Step 2: PR MERGED
- `password-hash-format-guard-60f7f2` (branch `claude/password-hash-format-guard-60f7f2`) — Step 1: ACTIVE, Step 2: PR MERGED
- `test-stages-docker-build-guard-fcb7cc` (branch `claude/test-stages-docker-build-guard-fcb7cc`) — Step 1: ACTIVE, Step 2: PR MERGED
- `trigger-create-multi-provider-ui-plan-677f12` (branch `claude/trigger-create-multi-provider-ui-plan-677f12`) — Step 1: ACTIVE, Step 2: PR MERGED

11건 모두 squash merge 완료 (Step 1 에서 ancestor 검사 통과 못 함 + Step 2 에서 MERGED 확인). 이 worktree 들은 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec-draft-workflow-resumable-execution` 은 전반적으로 정합하게 설계되어 있다. 상태 enum 불변, DB migration 없음, BullMQ 기존 인프라 재사용 등의 결정은 기존 plan 과 충돌하지 않는다. 다만 `retry-handler-followup` plan 이 동일 두 파일(`spec/5-system/4-execution-engine.md §7`, `spec/5-system/6-websocket-protocol.md §4.2`)에 대해 아직 미해소 spec 추가 작업을 `project-planner` 위임으로 남겨두고 있어, 병렬 편집 및 아키텍처 기준점 불일치 위험이 WARNING 2건으로 식별되었다. `self-hosting-deployment` cross-link 누락도 WARNING 이다. worktree 충돌 후보 11건 전부가 Step 2 에서 MERGED 로 stale 판정되어 active 충돌 없음.

---

## 위험도

MEDIUM
