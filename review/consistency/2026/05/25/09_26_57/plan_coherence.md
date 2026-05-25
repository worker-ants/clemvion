# Plan 정합성 검토 결과

> 검토 모드: `--impl-prep` (scope: `spec/5-system/`)
> 검토 대상 worktree: `workflow-resumable-execution-phase2-cont-64f537`
> 검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md` frontmatter 가 구현 현황과 불일치

- **target 위치**: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`, `code: []`)
- **관련 plan**: `plan/in-progress/2fa-webauthn-followups.md` — 항목 1·4·5·6·7·8·9가 이미 완료(`[x]`)이며, 특히 §1.1.A·§1.4.2·§1.4.4·§1.4.H 등 광범위한 spec 갱신이 완료됨. WebAuthn 2FA 본 구현(`plan/complete/2fa-webauthn.md`)도 머지 완료.
- **상세**: `1-auth.md` 의 frontmatter `status: spec-only`, `code: []` 는 실제로 WebAuthn + TOTP 인증이 모두 구현된 현황과 맞지 않는다. 이 불일치는 구현 착수 전 검토자가 "구현되지 않은 spec" 으로 오인할 수 있다. 단, 본 target worktree(`phase2-cont`)는 `1-auth.md` 를 직접 수정하지 않으므로 `phase2-cont` 의 작업과 충돌은 아니다. `2fa-webauthn-followups.md` 잔여 미완료 항목(e2e, mobile 검증, 1M row 모니터링)이 향후 해당 spec 파일을 다시 편집할 수 있으나 `code:` 필드 갱신은 명시되어 있지 않음.
- **제안**: `2fa-webauthn-followups.md` 의 다음 작업 pick-up 시 `spec/5-system/1-auth.md` frontmatter 를 `status: implemented` + `code:` 필드에 실제 구현 경로 추가하도록 해당 plan 에 항목 추가. 본 worktree 의 `--impl-prep` 진행 자체는 차단하지 않음.

---

### [WARNING] `spec/5-system/4-execution-engine.md` 에 미결 spec 편집 항목을 보유한 plan 2개 존재

- **target 위치**: `spec/5-system/4-execution-engine.md` 전반 (§1.3 보존 예외 절, §7/§8 _retryState TTL 정책)
- **관련 plan 1**: `plan/in-progress/multiturn-error-preserve.md` (worktree: `multiturn-error-preserve`)
  - §1.3 "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다" 문장을 `_retryState` 보존 예외로 조건부 갱신 예정. OQ1 결정 완료 (R1 채택).
- **관련 plan 2**: `plan/in-progress/retry-handler-followup.md` (worktree: `multiturn-error-preserve`)
  - WARNING #1: `_retryState` 소비 원자성을 §보존 예외 섹션에 명시 예정.
  - WARNING #5: `_retryState.expiresAt` TTL 기본값을 §8 또는 §7 에 SoT 추가 예정.
- **상세**: 위 두 plan 은 동일 worktree(`multiturn-error-preserve`)에서 진행 중이며, `spec/5-system/4-execution-engine.md` 에 아직 적용되지 않은 spec 추가를 예정하고 있다. 현재 `phase2-cont` worktree 는 이미 `§7.5.1`, `§9.3 task-queue 삭제`, `§11` 등을 변경했다. 두 plan 이 이후 같은 파일에서 §1.3·§7·§8 구역을 편집할 때, `phase2-cont` 의 기존 변경과 내용 충돌이 아닌 구역이므로 직접 충돌은 없다. 단, `multiturn-error-preserve` worktree 의 project-planner 가 본 `phase2-cont` 의 `§7.5.1 INVALID_EXECUTION_STATE` 정의를 인지하고 재정의하지 않아야 한다는 요건이 `spec-update-workflow-resumable-execution-phase2-followup.md §"권고 후속 흐름" 4번`에 이미 명시되어 있다.
- **제안**: `retry-handler-followup.md` WARNING #2 관련 `execution.retry_last_turn` 경유 여부 (`execution:continuation` 채널 → BullMQ 큐 전환) 는 `workflow-resumable-execution.md §"다음 단계" 3번` 에 이미 "한 줄 추가" 위임 항목으로 기록되어 있으나, 실제 `retry-handler-followup.md` 에는 해당 한 줄이 아직 추가되지 않은 것으로 확인됨. `phase2-cont` PR 머지 전에 해당 한 줄 추가 권장.

---

### [WARNING] `workflow-resumable-execution-6b105e` 및 `workflow-resumable-execution-phase2-a6b133` 두 worktree 가 동일 spec 파일을 수정 — 직렬 체인 구조이나 정리 필요

- **target 위치**: `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/10-graph-rag.md`
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` (frontmatter `worktree: workflow-resumable-execution-phase2-a6b133`)
- **상세**: `workflow-resumable-execution-6b105e` (Phase 0/1) 와 `workflow-resumable-execution-phase2-a6b133` (Phase 2 WIP) 두 worktree 모두 `spec/5-system/` 내 파일을 수정한 상태로 남아있다. `phase2-cont-64f537` 은 이 두 브랜치 위에 쌓인 최신 상태이며 Phase 2 cont 완료 표시가 되어있다. 세 브랜치는 순서가 있는 직렬 체인 (`6b105e` ⊂ `phase2-a6b133` ⊂ `phase2-cont-64f537`) 으로, 동시 경합이 아니라 순차적 진화이다. 그러나 `plan/in-progress/workflow-resumable-execution.md` 의 frontmatter `worktree:` 필드가 여전히 `workflow-resumable-execution-phase2-a6b133` 를 가리키고 있어 현재 active worktree 가 `phase2-cont-64f537` 임을 명시하지 않고 있다. 또한 `6b105e` 와 `phase2-a6b133` 두 worktree 는 `phase2-cont` 에 흡수되어 별도 PR 로 제출될 가능성이 없지만 계속 디렉토리가 존재한다.
- **제안**: `workflow-resumable-execution.md` frontmatter 의 `worktree:` 를 `workflow-resumable-execution-phase2-cont-64f537` 으로 갱신. `6b105e` 와 `phase2-a6b133` 는 `phase2-cont` PR 머지 후 `./cleanup-worktree-all.sh --yes --force` 로 정리.

---

### [INFO] `spec/5-system/1-auth.md` 구현 상태 표기 미갱신 (frontmatter `status: spec-only`)

- **target 위치**: `spec/5-system/1-auth.md` 전체
- **관련 plan**: `plan/in-progress/2fa-webauthn-followups.md` 잔여 미완료 (항목 2: e2e, 항목 3: mobile 검증, 항목 10: 모니터링 open follow-up)
- **상세**: 위 WARNING 에서 설명한 바와 동일. 잔여 항목이 code 영역만이고 spec 파일 편집을 포함하지 않으므로 `phase2-cont` 의 `--impl-prep` 진행은 차단되지 않는다.

---

### [INFO] `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` worktree 가 `spec/5-system/11-mcp-client.md` 를 `related_specs` 에 등록했으나 stale (MERGED)

- **관련 plan**: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md`
- **상세**: Step 2 확인 결과 `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` 브랜치의 PR 이 MERGED 상태. 해당 worktree 는 실제 `spec/5-system/` 파일을 diff 에 보유하지 않으나 frontmatter `related_specs` 에 `spec/5-system/11-mcp-client.md` 를 참조. 이미 머지된 작업이므로 현재 impl-prep 에 영향 없음.

---

## Stale 으로 skip 한 worktree

worktree 충돌 후보 중 `§worktree stale 판정` 으로 skip 된 항목:

- `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` (branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`) — Step 1: ACTIVE (not ancestor), Step 2: PR MERGED → **stale 확정**. `spec/5-system/11-mcp-client.md` 충돌 후보에서 제외.
- `harness-spec-impl-coverage-befc2f` (plan frontmatter 에서 언급, branch `claude/harness-spec-impl-coverage-befc2f`) — Step 2: PR MERGED → **stale 확정**. 물리 worktree 디렉토리 이미 부재 확인. `spec/5-system/` 충돌 후보에서 제외.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장. `workflow-resumable-execution-6b105e` 와 `workflow-resumable-execution-phase2-a6b133` 도 `phase2-cont` PR 머지 이후 같이 정리 대상.

---

## 요약

`spec/5-system/` 에 대한 `--impl-prep` 검토에서 CRITICAL 등급의 미해결 결정 충돌이나 active worktree 동시 편집 경합은 발견되지 않았다. 주요 관찰: (1) `1-auth.md` frontmatter 가 WebAuthn 구현 완료 이후에도 `status: spec-only` 로 미갱신 상태이나 현재 worktree 와 직접 충돌은 없다. (2) `multiturn-error-preserve` worktree 의 두 plan 이 `spec/5-system/4-execution-engine.md` 의 §1.3·§7·§8 구역에 미결 spec 편집 항목을 보유하며, 현재 `phase2-cont` 가 편집한 §7.5.1·§9.3·§11 구역과 구역이 달라 병렬 편집 충돌 위험은 낮다. (3) `workflow-resumable-execution` 계열 세 worktree 는 순차 체인이며 plan frontmatter `worktree:` 필드가 현행 worktree 를 미반영 중이다. `plan/in-progress/retry-handler-followup.md` 에 BullMQ 기준 명시 한 줄 추가가 `workflow-resumable-execution.md §"다음 단계"` 에 위임 항목으로 기록되어 있으나 아직 미적용 상태이다. worktree 충돌 후보 2건 중 stale 2건 skip, active 0건 분석.

---

## 위험도

LOW
