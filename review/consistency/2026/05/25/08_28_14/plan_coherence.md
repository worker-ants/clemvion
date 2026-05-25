# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] INVALID_EXECUTION_STATE 코드 spec 등재가 `retry-handler-followup.md` WARNING #3 와 의미론적으로 중복

- **target 위치**: target plan §"변경 2 — `INVALID_EXECUTION_STATE` 코드 spec 등재" — 변경 2.2 (`spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표에 주석 추가) 및 변경 2.1 (§7.5.1 신설)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` (worktree `multiturn-error-preserve`) WARNING #3 — "에러 코드 표에 `INVALID_EXECUTION_STATE`(또는 `EXECUTION_NOT_FAILED`) 추가 또는 소비 설명에 문구 명시"
- **상세**: retry-handler-followup WARNING #3 는 `execution.retry_last_turn` 컨텍스트에서 `INVALID_EXECUTION_STATE` (또는 `EXECUTION_NOT_FAILED`) 를 `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표에 추가하도록 project-planner 에 위임해 둔 미해결 항목이다. target plan 의 변경 2.2 는 기존 `INVALID_EXECUTION_STATE` 행에 "WS 전용 코드 — REST 공용 422 `INVALID_STATE` 와 별개" 주석을 추가하는 내용이다. 두 변경이 §4.2 에러 코드 표의 같은 행 또는 인접 행을 조작하므로, 두 plan 이 각각 별 PR 로 진행될 경우 편집 충돌이 발생하거나, 한 쪽이 다른 쪽의 의도를 override 할 위험이 있다.

  구체적으로:
  - target plan (변경 2.2): `waiting_for_input` 컨텍스트에서 `INVALID_EXECUTION_STATE` 가 WS 전용임을 명시.
  - retry-handler WARNING #3: `retry_last_turn` 컨텍스트에서 execution 이 `failed` 상태가 아닐 때의 에러 코드를 `INVALID_EXECUTION_STATE` 또는 `EXECUTION_NOT_FAILED` 중 선택해 §4.2 에 추가하는 사항이 미결정.
  - target plan 이 `INVALID_EXECUTION_STATE` 를 `waiting_for_input` 컨텍스트 전용 코드처럼 정의하면, retry-handler plan 이 같은 코드를 `retry_last_turn` 용도로 재사용할 수 있는지 여부가 불명확해진다.

- **제안**: target plan 변경 2.1 (§7.5.1) 및 변경 2.2 (§4.2 주석) 를 확정하기 전에 retry-handler-followup WARNING #3 의 처리 방향을 동시에 결정. 선택지:
  1. `INVALID_EXECUTION_STATE` 를 `waiting_for_input` 과 `retry_last_turn` 두 컨텍스트 모두 포괄하는 범용 "execution 상태 불일치" 코드로 정의하고, §4.2 에 용도 범위를 명시.
  2. `retry_last_turn` 용도에는 별도 코드 (`EXECUTION_NOT_FAILED`) 를 신설.
  결정 내용을 target plan 본문에 명시하거나, retry-handler-followup WARNING #3 의 결정과 동기화한 후 target plan 을 진행.

---

### [WARNING] `retry-handler-followup.md` WARNING #1/#2 — `spec/5-system/6-websocket-protocol.md §4.2` 추가 편집 대기 중이나 target plan 에 반영 없음

- **target 위치**: target plan 전체 (spec/5-system/6-websocket-protocol.md §4.2 편집 포함)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1 (spec/5-system/4-execution-engine.md + 6-websocket-protocol.md §4.2 에 `_retryState` 소비 원자성 요건 명시), WARNING #2 (`spec/5-system/6-websocket-protocol.md §4.2` 에 `retry_last_turn` Continuation Bus 경유 여부 명시)
- **상세**: retry-handler-followup 은 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/6-websocket-protocol.md §4.2` 에 대한 미해결 spec 추가 사항(WARNING #1/#2/#3/#4/#5) 을 project-planner 위임으로 보유하고 있다. target plan 도 동일한 두 파일을 편집한다. 두 편집이 별 PR 로 진행될 경우 §4.2 테이블 및 §7.x 절의 연속 편집이 발생하며, 공통 SoT 에 대한 변경 조율이 필요하다. 현재 target plan 은 retry-handler-followup 의 미해결 항목을 인지하지 않고 있다.
- **제안**: target plan §"권고 후속 흐름" 에 "retry-handler-followup.md WARNING #1/#2/#3 와의 조율" 항목을 추가. 또는 project-planner 가 두 plan 을 동일 PR 스코프 또는 연속 PR 로 처리.

---

### [WARNING] `workflow-resumable-execution.md` §"다음 단계" 3번 항목 — 동반 plan 업데이트가 target plan 에 반영되지 않음

- **target 위치**: target plan 전체
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` §"다음 단계" 3번 (`retry-handler-followup.md` 에 "WARNING #2 의 `execution:continuation` 채널 표기는 본 작업으로 채널이 BullMQ 큐로 교체됨. §4.2 작성 시 BullMQ `execution-continuation` 기준으로 작성" 추가 요구)
- **상세**: `workflow-resumable-execution.md` 의 다음 단계 3번은 `retry-handler-followup.md` 에 WARNING #2 관련 한 줄 추가를 요구하고 있다. 이 요구사항은 아직 retry-handler-followup.md 에 반영되지 않은 미해결 상태다. target plan (spec-update plan) 은 §7.5.1 신설과 §4.2 주석 추가를 제안하는데, 이 작업이 완료되면 retry-handler-followup.md 에 대한 동반 업데이트도 함께 이루어져야 한다. target plan 에 이 후속 항목이 누락되어 있다.
- **제안**: target plan §"권고 후속 흐름" 에 "3a. `plan/in-progress/retry-handler-followup.md` 에 WARNING #2 BullMQ 기준 명시 한 줄 추가 (workflow-resumable-execution.md §'다음 단계' 3번 이행)" 를 추가.

---

### [INFO] `workflow-resumable-execution.md` (worktree `workflow-resumable-execution-phase2-a6b133`) 와 target plan (worktree `workflow-resumable-execution-phase2-cont-64f537`) 이 동일 spec 파일 편집 — 단 현재 동일 상태

- **target 위치**: target plan §"영향 범위" (spec/5-system/4-execution-engine.md, spec/5-system/6-websocket-protocol.md)
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` (worktree `workflow-resumable-execution-phase2-a6b133`)
- **상세**: `workflow-resumable-execution.md` Phase 0 에서 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/6-websocket-protocol.md` 를 이미 편집 완료 ([x] 표기). target plan 은 같은 파일의 후속 정합화를 제안한다. diff 확인 결과 두 worktree 의 해당 spec 파일은 현재 내용이 동일하여 실제 경합 충돌은 없다. 단, `workflow-resumable-execution-phase2-a6b133` 은 Phase 2 WIP 커밋(`edc7f68b`) 을 보유한 active 브랜치이며 PR 미생성 상태다 (Step 1 ACTIVE, Step 2 빈 결과, Step 3 fallback: active). 두 브랜치가 동시에 PR open 될 때 spec 파일 편집 충돌 가능성을 확인해야 한다.
- **제안**: `workflow-resumable-execution-phase2-a6b133` 의 PR 이 먼저 merge 된 후 target plan PR 을 open 하거나, 두 PR 의 spec 파일 편집 범위를 사전 조율.

---

### [INFO] `workflow-resumable-execution-6b105e` 브랜치 — stale 판정 cascade Step 1/2 모두 음성, active 처리

- `workflow-resumable-execution-6b105e` 브랜치: git merge-base Step 1 ACTIVE, gh pr list Step 2 빈 결과 (no PR). Step 3 fallback: active.
- plan 문서 (`workflow-resumable-execution.md`) 에서 "Phase 0/1 = workflow-resumable-execution-6b105e (merged base 로 잔류)" 라고 기술하고 있으나, 공식 PR merge 기록이 gh API 에서 확인되지 않음.
- 만약 실제로 Phase 1 작업이 main 에 반영되어 있다면 (`e34d2db2`, `8a4ad936` 커밋이 git log 에서 `claude/workflow-resumable-execution-6b105e` 에 포함됨), squash merge 로 hash 가 바뀐 케이스일 수 있다. `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

없음. 검토 대상 worktree 2건 (`workflow-resumable-execution-phase2-a6b133`, `workflow-resumable-execution-6b105e`) 모두 Step 1 ACTIVE, Step 2 빈 결과(no PR), Step 3 fallback active 로 처리됨.

- `workflow-resumable-execution-phase2-a6b133` (branch `claude/workflow-resumable-execution-phase2-a6b133`) — Step 1: ACTIVE (non-ancestor), Step 2: PR 없음 (빈 결과) → Step 3 fallback active
- `workflow-resumable-execution-6b105e` (branch `claude/workflow-resumable-execution-6b105e`) — Step 1: ACTIVE (non-ancestor), Step 2: PR 없음 (빈 결과) → Step 3 fallback active. plan 에 "merged base 로 잔류" 기술이 있으나 squash merge 케이스이면 Step 1 통과 — `cleanup-worktree-all.sh` 실행 후 재확인 권장.

---

## 요약

target plan (`spec-update-workflow-resumable-execution-phase2-followup.md`) 은 `plan/in-progress/workflow-resumable-execution.md` Phase 2.8/2.9 에서 위임된 spec 정합화로, 동기와 제안 내용이 명확하다. 미해결 결정 우회나 선행 조건 미충족 문제는 없다. 다만 `retry-handler-followup.md` (worktree `multiturn-error-preserve`) 가 동일한 `spec/5-system/6-websocket-protocol.md §4.2` 와 `spec/5-system/4-execution-engine.md` 에 대한 미결 spec 추가 사항(WARNING #1~#5) 을 보유하고 있어 `INVALID_EXECUTION_STATE` 코드 의미 범위 결정 및 §4.2 편집 조율이 필요한 WARNING 2건이 존재한다. `workflow-resumable-execution.md` §'다음 단계' 3번의 동반 업데이트 요구가 target plan 에 누락된 WARNING 1건도 추가된다. worktree 충돌 후보 7건 중 stale skip 0건, active 2건 분석 (phase2-a6b133 spec 파일 현재 동일 상태이므로 즉각적 hard block 은 아님).

---

## 위험도

MEDIUM
