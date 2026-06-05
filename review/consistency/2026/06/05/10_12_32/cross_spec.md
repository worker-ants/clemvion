# Cross-Spec 일관성 검토 결과

검토 모드: impl-done (scope=spec/5-system/, diff-base=origin/main)
검토 일시: 2026-06-05

---

## 발견사항

### [WARNING] §7.4 상태 전이 표 — `waiting_for_input → waiting_for_input` 설명이 Phase B 이후 스펙과 모순 가능
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §1.2 상태 전이 표 (L62)
- **충돌 대상**: 동 파일 §7.4 Worker 동작 열 (L822) + 계획 문서 `plan/in-progress/exec-park-durable-resume.md` Phase B
- **상세**: 상태 전이 표에 `waiting_for_input → waiting_for_input` 행의 설명이 "Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)" 이라고 기술되어 있다. 그러나 Phase B(`park 즉시 코루틴 해제 + slow-path 일원화`) 완료 후에는 `pendingContinuations` 재등록이 존재하지 않고 모든 재개가 rehydration으로 일원화된다. §4.x 구현 메모(L405)와 §7.4(L822)는 이미 현재 상태를 "fast-path / slow-path 이원 공존"으로 문서화하고 있으며 Phase B 이후 업데이트 예정임이 plan에 명시되어 있다. 단, 이 WARNING은 Phase B 구현 완료 전에는 아직 모순이 아니다 — Phase B 완료 시점에 해당 행을 "rehydration slow-path 로 일원화" 로 정정해야 한다.
- **제안**: Phase B 구현 PR 에서 상태 전이 표 행 + §7.4 "Worker 동작" 행(`pendingContinuations` 로컬 fast-path 언급)을 동기 정정.

---

### [WARNING] `_resumeCheckpoint` 적용 범위 — spec 3곳과 plan A2 갱신 예정 불일치
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §1.3 L111 + `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/3-information-extractor.md` L357 + `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/1-ai-agent.md` L703
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md` Phase A2 (consistency I1/I4 미해소)
- **상세**: 현재 세 곳에 "ai_agent 한정" / "information_extractor 는 미적용" 문구가 각각 기술되어 있다. Plan A2는 information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 를 저장하도록 확장을 검토하며, 확장 채택 시 세 곳을 동기 갱신하도록 명시되어 있다(consistency I1/I4). 현재 Phase A2가 미완료 상태여서 spec 이 현행 구현과 정합하지만, A2 구현 완료 후 세 곳 중 하나라도 갱신이 누락되면 spec 내부에서 "한 곳은 ai_agent 한정, 다른 곳은 범용"의 내부 충돌이 발생한다.
- **제안**: A2 PR 에서 `4-execution-engine.md §1.3`, `3-information-extractor.md §357`, `1-ai-agent.md §703` 세 곳을 한 PR 동기 갱신 의무화. Plan 체크리스트에 이미 명시되어 있으나, 누락 방지를 위해 갱신 시 consistency-check --spec 재실행 권고.

---

### [WARNING] §7.4 fast-path 라우팅 원칙 서술이 Phase B 의 "fast-path 제거" 와 선제적 긴장
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §7.4 Worker 동작 행 (L822) "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path)"
- **충돌 대상**: 동 파일 §4.x 구현 메모 + `plan/in-progress/exec-park-durable-resume.md` Phase B2/B3
- **상세**: §7.4 Worker 동작 표는 현재 "fast-path 존재"를 규범적으로 기술한다. Plan B2는 이 fast-path 를 제거하거나 "우연 생존 시 순수 최적화로 강등(의존 금지)"으로 의미를 바꾼다. spec §7.4 (L821 "라우팅 원칙": 항상 BullMQ enqueue)과 L822 (Worker 동작: fast-path) 사이에 이미 내적 긴장이 있으며, Phase B 후 §7.4 Worker 동작 행을 정정하지 않으면 spec 내부에서 "라우팅 원칙=항상 enqueue" vs "Worker=fast-path resolve" 의 모순이 고착된다.
- **제안**: Phase B PR 에서 §7.4 Worker 동작 행을 "로컬 fast-path 의존 제거 — rehydration 경로만 규범적"으로 정정. §7.4 Rationale "Sticky fast-path 제거" 항(L1206~)과 서술 정합성 확인.

---

### [INFO] Phase B 완료 후 §4.x 구현 메모 업데이트 필요
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §4.x L403–L405 (구현 메모 블록)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md` Phase B 완료 후 예정 spec 변경
- **상세**: §4.x 구현 메모(L403)는 현재 `firstSegmentBarriers` / detach 패턴 / `signalParkBarrier` 를 규범적 구현 서술로 포함하고, L405에 "park 즉시 코루틴 해제 + slow-path 일원화 추진 중"이라고 명시되어 있다. Phase B 완료 후 detach/barrier 구현 메모 블록이 제거/대체되지 않으면 제거된 메커니즘이 규범 문서에 잔류한다. Plan "Spec 변경" 절에 §4.x 갱신이 명시되어 있어 추적은 되고 있다.
- **제안**: Phase B PR에서 §4.x 구현 메모 블록을 새 "즉시 해제 + slow-path" 설명으로 교체. `firstSegmentBarriers`/`signalParkBarrier`/`settleFirstSegment` 언급 제거.

---

### [INFO] Plan 에 언급된 D4 turn-단위 park Rationale — spec 에 아직 미기술
- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` Phase B1 (D4 확정) + Spec 변경 항
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §4.x (해당 Rationale 절 부재)
- **상세**: D4(멀티턴 AI = turn-단위 park)는 확정 결정이지만, spec `4-execution-engine.md §4.x` 에 "대화 전체=단일 waiting 대비 turn-단위 차이, 채택 근거, 기각 대안" Rationale 이 아직 기술되지 않았다. Plan "Spec 변경" 절(consistency W4)에 "Phase B 선행 — 구현 착수 전 의무"로 명시되어 있다. 구현 전에 Rationale 이 spec 에 반영되지 않으면 플래너 없이 개발자가 구현에 착수할 경우 근거 없는 결정으로 보일 수 있다.
- **제안**: Phase B 착수 전, planner가 spec §4.x 또는 §Rationale 에 D4 turn-단위 park 결정 근거를 명문화 (Plan Spec 변경 W4 항 이행).

---

### [INFO] `conversation_thread` 컬럼 — `1-data-model.md` 에 이미 반영됨 (W1 해소 확인)
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/1-data-model.md` §2.13 Execution L465
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md` D1 (A1 완료 2026-06-05)
- **상세**: Plan D1이 채택한 `Execution.conversation_thread jsonb NULL (V084)` 컬럼이 data-model spec 에 정확히 반영되어 있다(L465). `conversation-thread.md §4/§8.4`, `4-execution-engine.md §6.2/§7.5`도 일치. consistency W1 은 해소 상태로 확인.
- **제안**: 없음 (이미 정합).

---

## 요약

`spec/5-system/` 현재 상태는 Phase A1 완료(conversationThread durable 영속)와 기존 fast-path/slow-path 이원 공존 구현을 정합하게 반영하고 있다. CRITICAL 충돌은 없다. 주요 긴장은 모두 Phase B("park 즉시 해제 + slow-path 일원화") 완료 시점에 해소해야 하는 **예정된 spec 갱신 미이행**에 관한 것으로, 세 개의 WARNING이 이를 포착한다: (1) 상태 전이 표의 `waiting_for_input → waiting_for_input` 행, (2) `_resumeCheckpoint` "ai_agent 한정" 3곳 동기 갱신 의무, (3) §7.4 Worker 동작 행의 fast-path 서술. 두 개의 INFO는 구현 메모 정리와 D4 Rationale 기술 누락을 가리킨다. Plan 의 "Spec 변경" 절과 체크리스트가 이 갱신들을 대부분 추적하고 있으므로, 구현 PR과 spec 갱신 PR의 동기화를 철저히 유지하면 충분히 해소 가능하다.

## 위험도

MEDIUM
