# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
검토 모드: `--spec`
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] `spec/data-flow/3-execution.md` Rationale 역전 갱신 누락

- **target 위치**: 변경 4 — `spec/data-flow/3-execution.md §1.1 시퀀스 다이어그램`
- **관련 plan**: 해당 spec 파일의 현행 Rationale 섹션 (line 232–237)
- **상세**: `spec/data-flow/3-execution.md` 의 `### Continuation bus = Redis pub/sub` 절이 "BullMQ 가 아닌 이유: 1회성 신호이고 durable 가 필요 없으며, 모든 인스턴스가 동시에 받아 자기 것이면 처리하는 fan-out 패턴이 더 적합" 이라는 이유로 Redis pub/sub 을 명시적으로 채택한 근거를 남기고 있다. 목표 변경(변경 4)은 시퀀스 다이어그램 주석 (line 52) 과 ASCII/mermaid 다이어그램의 표기만 갱신하고 이 Rationale 절 자체를 역전·교체하는 지침을 포함하지 않는다. 이 섹션이 그대로 남으면 spec 에 "BullMQ 가 아닌 이유"를 명시한 채 다이어그램만 BullMQ 로 바뀐 모순 상태가 발생한다.
- **제안**: 변경 4 범위에 `### Continuation bus = Redis pub/sub` Rationale 절 전체 교체(예: `### Continuation queue = BullMQ 영속 큐` + 기존 채택 이유 반전·보강)를 명시적으로 추가. 혹은 spec 적용 phase PR checklist 에 해당 절 갱신을 명시.

---

### [WARNING] `retry-handler-followup.md` WARNING #2의 continuation bus 언어가 target 변경 후 스탈 표현이 됨

- **target 위치**: 변경 2 §2.2 — "execution.retry_last_turn 는 적용 대상 아님" 주석
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` — WARNING #2 "Continuation Bus(`execution:continuation` 채널) 경유 여부가 미명시"
- **상세**: retry-handler-followup 의 WARNING #2 가 아직 미해소 상태이며 "execution:continuation 채널" 이라는 구체적 표기를 포함한다. target plan 이 해당 채널을 폐기하고 BullMQ continuation-queue 로 교체하면, WARNING #2 의 질문 자체("이 채널을 통해야 하는가?")가 지칭하는 대상이 사라진다. target 이 §2.2 에서 "retry_last_turn 는 직교"라고 서술하지만 이것이 WARNING #2 의 원래 질문 — "retry_last_turn 이 어떤 continuation path 를 타야 하는가" — 에 대한 완전한 답은 아니다. target spec 이 main 에 합류한 뒤 retry-handler-followup 담당자가 WARNING #2 를 작업하면 이미 없어진 채널명을 참조하게 된다.
- **제안**: target plan 의 `다음 단계 3` 에 이미 "retry-handler-followup.md 에 BullMQ continuation-queue 기준으로 §4.2 / §7 추가 작성 주석" 이 포함되어 있으나, WARNING #2 의 "continuation:continuation 채널" 표기를 "BullMQ continuation-queue" 로 명시적으로 갱신하는 action 도 함께 명시 권장. retry-handler-followup 자체를 plan 담당자가 갱신해야 한다는 점을 `다음 단계` 항목에 구체화.

---

### [WARNING] `0-unimplemented-overview.md` 인덱스 등재 — 후속 plan 생성 전 임시 미등재 상태 주의

- **target 위치**: `다음 단계 3` — "plan/in-progress/0-unimplemented-overview.md 인덱스에 본 작업 등재"
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md`
- **상세**: spec draft 검토 통과 후 implementation plan (`workflow-resumable-execution.md`) 생성 시점까지, workflow-resumable-execution 항목이 인덱스에 없는 상태가 지속된다. 이 gap 은 운영 회귀 (WAITING_FOR_INPUT 일괄 FAIL) 대응을 위한 hotfix phase 를 다른 기여자가 발견하지 못할 리스크를 만든다. 해결을 "다음 단계 3"으로 미루는 것은 현 흐름 상 납득 가능하지만, spec 통과 직후 누락 가능성을 추적할 장치가 없다.
- **제안**: `다음 단계 3` 에 "0-unimplemented-overview.md 등재를 implementation plan 생성과 동시에 처리" 조건을 명시하거나, 본 spec draft plan 의 다음 단계 체크박스에 등재 시점을 명확히 기술.

---

### [INFO] `spec/0-overview.md §2.6` 표현 갱신 범위 — line 83 의 "분산 continuation bus" 참조 누락 가능성

- **target 위치**: 변경 5 — `spec/0-overview.md §2.4 / §2.6 / §6.1`
- **관련 plan**: 해당 없음 (spec 내부 표현 정합)
- **상세**: target 변경 5 는 §2.4 / §2.6 / §6.1 세 위치를 명시하나, `spec/0-overview.md` line 83 ("실행 엔진(Redis 큐 + 워커 풀, **분산 continuation bus**)") 도 동일하게 stale 표기가 된다. 또한 Rationale §trade-off (line 389) 의 "continuation bus·BullMQ 기반 cron·Cafe24 cross-pod refresh 직렬화 등 다른 시스템도 같은 Redis 를 재사용" 문장에서 "continuation bus" 가 Redis 재사용 사례로 묘사되어 있어 BullMQ 교체 후 맥락이 달라진다.
- **제안**: spec 적용 phase 에서 line 83 과 Rationale §trade-off 도 함께 갱신 대상에 포함. target 변경 5 에 이 두 위치를 추가 명시하면 spec draft 단계에서 누락 없이 처리 가능.

---

### [INFO] `retry-handler-followup.md` 의 worktree 필드가 `multiturn-error-preserve` 를 가리키나 해당 worktree 는 미존재

- **target 위치**: 해당 없음 (plan 메타 정보 문제)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` (frontmatter `worktree: multiturn-error-preserve`)
- **상세**: retry-handler-followup.md 의 frontmatter `worktree: multiturn-error-preserve` 가 가리키는 worktree 가 `git worktree list` 에 없고, `claude/multiturn-error-preserve` branch 에 해당하는 open PR 도 없다. target plan 과 worktree 충돌 여부 검사 대상에서 제외되지만, plan frontmatter 와 실제 worktree 상태 불일치로 다음 담당자가 혼동할 수 있다. multiturn-error-preserve plan 은 완료되어 worktree 가 정리되었으나 retry-handler-followup 이 같은 worktree 필드를 공유한 채 남아있는 것으로 추정.
- **제안**: retry-handler-followup.md 의 `worktree` 필드를 `TBD` 또는 실제 작업 worktree 로 갱신 필요 (본 검토 범위 밖, 별도 처리).

---

## Stale 으로 skip 한 worktree (의무 항목)

worktree 충돌 후보로 식별되어 stale 판정 cascade 를 수행한 항목:

| worktree | branch | step 1 (ancestor) | step 2 (PR state) | 판정 |
|---|---|---|---|---|
| `ai-agent-formdata-size-limit-2ad8ff` | `claude/ai-agent-formdata-size-limit-2ad8ff` | ACTIVE (non-ancestor) | PR #305 MERGED | **stale skip** |
| `chat-channel-dispatcher-split-impl-d7c3ea` | `claude/chat-channel-dispatcher-split-impl-d7c3ea` | ACTIVE | PR #310 MERGED | **stale skip** |
| `chat-channel-e2e-hardening-5ff799` | `claude/chat-channel-e2e-hardening-5ff799` | ACTIVE | PR #303 MERGED | **stale skip** |
| `chat-channel-unverified-owner-e2e-d74fda` | `claude/chat-channel-unverified-owner-e2e-d74fda` | ACTIVE | PR #306 MERGED | **stale skip** |
| `chat-channel-validation-constants-e9e037` | `claude/chat-channel-validation-constants-e9e037` | ACTIVE | PR #309 MERGED | **stale skip** |
| `chore-stale-plan-cleanup-c7e170` | `claude/chore-stale-plan-cleanup-c7e170` | ACTIVE | PR #302 MERGED | **stale skip** |
| `fix-frontend-dockerfile-chat-channel-validation-04fe3e` | `claude/fix-frontend-dockerfile-chat-channel-validation-04fe3e` | ACTIVE | PR #311 MERGED | **stale skip** |
| `fix-secret-store-root-entities-6aa869` | `claude/fix-secret-store-root-entities-6aa869` | ACTIVE | PR #304 MERGED | **stale skip** |
| `password-hash-format-guard-60f7f2` | `claude/password-hash-format-guard-60f7f2` | ACTIVE | PR #307 MERGED | **stale skip** |
| `test-stages-docker-build-guard-fcb7cc` | `claude/test-stages-docker-build-guard-fcb7cc` | ACTIVE | PR #312 MERGED | **stale skip** |
| `trigger-create-multi-provider-ui-plan-677f12` | `claude/trigger-create-multi-provider-ui-plan-677f12` | ACTIVE | PR #308 MERGED | **stale skip** |

stale skip 대상 11개 worktree 모두 squash merge (Step 1 ACTIVE, Step 2 MERGED) 로 확인. `cleanup-worktree-all.sh --yes --force` 실행 권장.

`ai-agent-formdata-size-limit-2ad8ff` worktree (PR #305 MERGED) 가 `spec/4-nodes/6-presentation/0-common.md` 를 수정했으나, 변경한 row 는 §10.9 표의 (4) LLM tool_result content layer (formData cap 추가) 이며 target plan 이 변경하려는 row (2) internal continuation bus payload 와 별개 행이다. spec apply 단계에서 두 변경이 충돌하지 않는다.

---

## 요약

target spec draft (`spec-draft-workflow-resumable-execution.md`) 는 전반적으로 in-progress plan 들과 정합하게 설계되어 있다. `retry-handler-followup.md` 와의 순서 의존성을 명시하고 ("본 작업 먼저 → retry-handler-followup 이 BullMQ 기준으로 작성"), 직교 plan 들 (`multiturn-error-preserve`, `self-hosting-deployment`, `replay-rerun`) 과의 경계도 명확하다. active worktree 충돌 후보 11건은 모두 stale 판정(PR MERGED)으로 실질 충돌 없음. 발견된 WARNING 2건은 충돌이 아니라 spec 적용 phase 에서 처리해야 할 갱신 범위의 누락(spec/data-flow/3-execution.md Rationale 역전 미명시, retry-handler-followup WARNING #2 표기 갱신 action 구체화)이다. CRITICAL 항목 없음. worktree 충돌 후보 11건 중 stale 11건 skip, active 0건 분석.

---

## 위험도

LOW
