# Cross-Spec 일관성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Target: `spec/5-system/` (exec-park-durable-resume 구현 대상)
검토일: 2026-06-05

---

## 발견사항

### [WARNING] Phase B 진입 전 spec 갱신 의무 — `pendingContinuations`/fast-path 서술 잔류

- **target 위치**: `spec/5-system/4-execution-engine.md`
  - §1.1 전이표 line 62: `waiting_for_input → waiting_for_input` 전이 설명 "`pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)"`
  - §4.x "구현 메모": "`firstSegmentBarriers`" / "in-process 로 살아 있어, 같은 프로세스가 재개를 받으면 무손실 fast-path(`pendingContinuations` resolve)" 기술
  - §7.4 Worker 동작 표: "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)"
  - §7.5 case 1: "로컬 pendingMap 키 있음 → 즉시 resolve() (fast path — §7.4)"
- **충돌 대상**: 동일 파일 §Spec 변경(plan `exec-park-durable-resume.md §Spec 변경`) 에 "Phase B 선행 — 구현 착수 전 의무: §7.4 Worker 동작 행의 'fast-path' 서술 정정·제거 + §7.5 case 1 (fast-path) 문구 정정" 이 명시됨
- **상세**: Phase B(B1/B2/B3)는 `pendingContinuations` Map 제거 및 fast-path 일원화를 구현 목표로 한다. plan 은 이 변경을 "구현 착수 전 spec 갱신 의무" 로 지정했으나 현재 spec 은 여전히 fast-path/`pendingContinuations` 모델을 규범적으로 기술하고 있다. Phase B 구현이 착수되면 spec 과 코드가 상충한다. 단, plan 이 A1→A2a 완료 후 B 전에 갱신 예정임을 명시하므로 현시점 의도적 gap 이다 — CRITICAL 아닌 WARNING.
- **제안**: Phase B 착수 전 다음을 갱신:
  - `spec/5-system/4-execution-engine.md §1.1` 전이표에서 `waiting_for_input → waiting_for_input` 행 삭제 또는 "다른 인스턴스 rehydration 재개 (§7.5)" 로 재기술 (`pendingContinuations` 재등록 문구 제거)
  - `§4.x` 구현 메모를 Phase B 이후 모델("park 즉시 코루틴 해제 + slow-path 일원화")로 대체
  - `§7.4` Worker 동작 표 fast-path 행 제거 + §7.5 case 1 제거 (slow-path 단일 경로로 서술)

---

### [WARNING] D4 turn-단위 park Rationale 미기재 — Phase B 착수 전 차단 조건

- **target 위치**: `spec/5-system/4-execution-engine.md` — §4.x 또는 §Rationale 에 해당 내용 부재
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §Spec 변경` — "Phase B 선행 — 구현 착수 전 의무: D4 turn-단위 park Rationale 명문화(`4-execution-engine.md §4.x` 또는 신규 §Rationale): 기존 '대화 전체=단일 waiting' 대비 차이, 채택 근거(메모리 bounded + slow-path 일원화 정합), 기각 대안('단일 waiting 유지+코루틴 누적 수용')"
- **상세**: 멀티턴 AI Agent 를 "대화 전체가 단일 `waiting_for_input`" 에서 "매 turn = 독립 park 세그먼트" 로 전환하는 결정(D4, 2026-06-05 확정)의 Rationale 이 spec 에 기재되어 있지 않다. plan 은 이를 Phase B 착수 전 의무로 규정한다. 현재 `spec/5-system/4-execution-engine.md` §Rationale / §4.x 어디에도 해당 내용이 없어 구현자가 의도를 추적할 근거가 없다.
- **제안**: Phase B 착수 전 `spec/5-system/4-execution-engine.md §Rationale` 또는 §4.x 신규 sub-section 에 다음을 추가:
  - "멀티턴 AI = turn-단위 park" 채택 근거 (메모리 bounded, slow-path 일원화 정합)
  - 기각된 대안 ("단일 waiting 유지 + 코루틴 누적 수용") 과 그 위험
  - `runAiConversationLoop` 장수 루프 해제 → 매 turn = 독립 active 세그먼트 모델

---

### [INFO] A2b (information_extractor checkpoint) — spec 선반영 vs plan "분리 후속" 불일치

- **target 위치**:
  - `spec/5-system/4-execution-engine.md §1.3` line 111: "`ai_agent` · `information_extractor` 멀티턴 노드" 로 `_resumeCheckpoint` 적용 범위 기술
  - `spec/4-nodes/3-ai/3-information-extractor.md §5.4` line 357: "information_extractor 도 `_resumeCheckpoint` 재시작-재개를 지원" 명시
  - `spec/4-nodes/3-ai/1-ai-agent.md §1.3` line 703 표 및 §Rationale line 1166: IE checkpoint 지원 Rationale 기재
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §A2b` — "⭐⭐ [분리, 후속]" — 미이행으로 표기
- **상세**: plan 은 A2b (IE 멀티턴 checkpoint 확장)를 "분리, 후속" 으로 남겼으나 spec 은 이미 IE 를 `_resumeCheckpoint` 지원 범위에 포함하고 있다. spec 과 plan 사이의 비일관성으로, 구현 착수 전 plan 상태를 확인해야 한다. 실제로 구현이 선행 완료된 것인지, spec 만 선반영된 상태에서 구현이 미이행인지 구분이 필요하다. 만약 spec 만 선반영이고 구현이 미이행이면 spec-impl drift 가 존재한다.
- **제안**:
  - plan A2b 의 실제 구현 상태를 확인(코드베이스 `buildRetryReentryState` / `emitAiWaitingForInput` / `handleAiMessageTurn` 의 IE 처리 분기)
  - 구현 완료 시 plan A2b 를 "완료" 로 갱신
  - 미구현 시 spec 의 IE checkpoint 서술을 "Planned" 로 표시 또는 주석 처리

---

### [INFO] `waiting_for_input → waiting_for_input` 전이 — Phase B 이후 삭제 예정 항목 잔류

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 전이표 line 62
- **충돌 대상**: Phase B 완료 후 해당 전이 자체가 제거됨 — park 즉시 해제 후에는 in-process 코루틴이 없으므로 "다른 인스턴스에서 재개 시 self-loop" 개념이 사라진다
- **상세**: 현재 전이표의 `waiting_for_input → waiting_for_input` 행은 "다른 인스턴스에서 재개 — Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록" 으로 기술된다. 이 전이는 in-process 코루틴이 살아있는 현재 모델의 구현 세부사항이다. Phase B 이후에는 이 전이 자체가 불필요하다 (재개는 단순히 새 continuation segment 시작이며 status 는 RUNNING 으로 변함). W1 항목과 연관된 정리 대상.
- **제안**: WARNING 1 의 §1.1 전이표 갱신 작업에 포함해 Phase B 와 함께 처리.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter — `pending_plans` 에 `exec-park-durable-resume` 미등록

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` — `exec-park-durable-resume.md` 항목 없음
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §Spec 변경` — AI Agent spec 동기 갱신 필요(§12.1/§12.10/§12.13 은 A1 에서 완료됐으나, Phase B 의 turn-단위 park 서술은 신규)
- **상세**: plan 의 A1 은 ai-agent spec §12.1/§12.10/§12.13 갱신까지 완료로 표기하나, `1-ai-agent.md` frontmatter 에 `exec-park-durable-resume` 가 없다. Phase B 진행 시 `1-ai-agent.md` 의 multi-turn 루프 서술도 영향받으므로 pending_plans 등록이 권장된다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` 에 `plan/in-progress/exec-park-durable-resume.md` 추가.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/5-system/` (exec-park-durable-resume 구현 대상)의 주요 충돌은 두 곳이다. 첫째, `4-execution-engine.md` 에 `pendingContinuations`/`firstSegmentBarriers`/fast-path 서술이 남아있어 Phase B 구현과 직접 충돌한다 — plan 이 Phase B 착수 전 갱신 의무로 지정했으므로 현시점 의도적 gap 이지만 갱신 없이 Phase B 구현 착수 시 spec 위반이 된다. 둘째, D4(turn-단위 park) Rationale 이 spec 에 아직 없어 Phase B 구현자의 의사결정 근거가 부재하다 — 이 역시 plan 이 "착수 전 의무" 로 명시하므로 Phase B 전 반드시 추가되어야 한다. 나머지 INFO 항목은 plan 상태와 spec 사이의 미동기화(A2b spec 선반영, `1-ai-agent.md` frontmatter 누락)로 구현 정합성보다는 추적 명확성의 문제다. 이 두 WARNING 을 Phase B 착수 직전 spec PR 에서 일괄 처리하면 Cross-Spec 충돌이 해소된다. 현재(A 페이즈 완료 후 B 착수 전) 상태의 구현 착수는 A2a 이후 항목에 한해 BLOCK 이 없다.

## 위험도

MEDIUM

---

*관련 파일*

- `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/1-ai-agent.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/3-information-extractor.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/conversation-thread.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/plan/in-progress/exec-park-durable-resume.md`
