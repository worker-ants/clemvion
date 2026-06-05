# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done 검토 모드)

검토 기준일: 2026-06-05  
검토 범위: `spec/5-system/` 변경사항 (diff-base=origin/main)  
연관 plan: `plan/in-progress/exec-park-durable-resume.md` (A1 Phase 완료 반영)

---

## 발견사항

### [WARNING] `4-execution-engine.md §4.x` 구현 메모가 이미 완료된 변경을 "검토 대상"으로 기술 중
- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` (line ~405)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §Spec 변경` 및 해당 plan 상태 표기 `[A1 완료]`
- **상세**: `4-execution-engine.md §4.x` 의 구현 메모 blockquote "현재 재개 경로와 알려진 한계" 에서 `conversationThread`/멀티턴 AI `_resumeState` 등 in-memory 전용 상태 손실을 기술하면서 "park 즉시 코루틴 해제 + slow-path 일원화 + resume 상태 durable 영속" 을 "검토 대상"으로 표현하고 추적 링크를 `plan/in-progress/execution-engine-residual-gaps.md` 로 지정하고 있다. 그런데 plan `exec-park-durable-resume.md` 는 `Execution.conversation_thread` 컬럼 채택 및 A1 Phase 완료를 명시하며, `1-data-model.md §2.13` 에 이미 해당 컬럼(`conversation_thread JSONB? V084`)이 정의되어 있고, `conversation-thread.md §8.4` 에도 "채택 완료"가 기록되었다. 이 blockquote 가 갱신 없이 "검토 대상"으로 남아 spec 을 읽는 독자에게 이미 결정된 사안이 미결인 것처럼 오해를 준다.
- **제안**: `4-execution-engine.md §4.x` 의 해당 blockquote 를 "Phase B(코루틴 해제+slow-path 일원화) 계획, 선행조건 A1 완료(conversation_thread V084)" 형태로 갱신. 추적 링크를 `execution-engine-residual-gaps.md` 에서 `exec-park-durable-resume.md` 로 변경.

---

### [WARNING] `4-execution-engine.md §7.4` Worker 동작 행이 fast-path 제거 후의 모델과 불일치
- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` (line ~822)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §Spec 변경` — "consistency W5/I2 — 누락분 추가" 로 명시된 항목
- **상세**: `4-execution-engine.md §7.4` 의 Worker 동작 행은 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)" 를 여전히 current behavior 로 기술하고 있다 (line ~822: `| Worker 동작 | 임의 인스턴스가 job 을 pick up. 로컬 pendingContinuations 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path) |`). 한편 Rationale "Sticky fast-path 제거 — '항상 publish' 원칙 보존" (line ~1206) 에서는 sticky fast-path 제거가 이미 결정됐다고 서술한다. Phase B 가 완료되지 않은 현 시점에서는 구현 상태(fast-path 존재)와 Rationale(fast-path 제거 결정) 간 표현이 혼재하여, 본 plan 의 Phase B2 목표("fast-path 제거 또는 강등")와의 계획 정합성이 불명확하다. plan 이 "consistency W5/I2 누락" 을 명시하고 있어 해당 행의 갱신이 필요함을 인식하고 있으나 갱신이 반영되어 있지 않다.
- **제안**: §7.4 Worker 동작 행에 "현재 fast-path 존재, Phase B 완료 시 slow-path 일원화 예정" 임을 명기하거나, Phase B 완료 PR 에서 한꺼번에 갱신하도록 plan 에 의무 항목으로 추가.

---

### [WARNING] `4-execution-engine.md §1.1` 상태 전이표가 Phase B 이후의 "turn-단위 park" 모델을 반영하지 않음
- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` (line ~62)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §Phase B / D4` — "멀티턴 AI = turn-단위 park(D4): 매 turn 입력 대기에서 해제 — 한 turn 처리=한 세그먼트, 다음 메시지에 rehydration 재개" 결정
- **상세**: 상태 전이표의 `waiting_for_input → waiting_for_input` 행은 "다른 인스턴스에서 재개 (rehydration) — Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)" 으로 기술되어 있다. Phase B(D4) 채택 후에는 멀티턴 AI의 매 turn 이 `waiting_for_input` → `running`(재개 세그먼트 시작) → `waiting_for_input`(다음 turn 대기) 의 전이 순환을 형성한다. 현재 기술로는 이 turn-단위 반복 전이가 드러나지 않으며, 다이어그램과 전이표에도 표현되어 있지 않다. Phase B 는 미완료 상태이나 D4 결정이 확정됐으므로 spec 에 해당 전이 모델이 예고될 필요가 있다.
- **제안**: Phase B 완료 PR 에서 `§1.1` 다이어그램·전이표에 "멀티턴 turn-단위 park 순환 (D4 — Phase B 완료 후 적용)" 을 추가. 현재는 plan §Spec 변경의 "(consistency W4)" 항목으로 추적되고 있으므로 plan 에 명시는 되어 있으나, spec 에 pending 주석으로라도 예고하는 것이 권장됨.

---

### [INFO] `1-data-model.md §2.13` `conversation_thread` 컬럼 마이그레이션 번호 불일치 가능성
- **target 위치**: `spec/1-data-model.md §2.13` Execution 테이블 `conversation_thread` 행 (V084 표기)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §D1` — "마이그레이션 = V083(머지 race 시 §6.2 rebase-renumber)"
- **상세**: `1-data-model.md §2.13` 의 `conversation_thread JSONB?` 행은 "(V084)" 를 명시한다. plan `D1` 항목은 "마이그레이션 = V083(머지 race 시 §6.2 rebase-renumber)" 으로 기재하고 있어 번호가 불일치한다. rebase-renumber 시 V084 로 확정됐다면 plan 의 D1 표기가 stale 상태다. 구현 착수 시 실제 마이그레이션 파일 번호와 spec 표기를 교차 확인해야 한다.
- **제안**: plan `D1` 의 마이그레이션 번호 표기를 V084 로 통일하거나, "(V083 또는 V084 — rebase 시 결정)" 으로 명시하여 혼선 방지. spec 은 V084 로 이미 확정 표기돼 있어 단방향 정합화(plan 갱신)로 충분.

---

### [INFO] `4-execution-engine.md §1.3` 재개 state 직렬화 필드 설명의 `ai_agent` 한정 문구와 A2 범위의 긴장
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` (line ~111)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §A2` — "information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 저장(현재 ai_agent 한정 여부 확인 후 확장)" 및 "consistency I1/I4"
- **상세**: `§1.3` 의 보존 예외 `_resumeCheckpoint` 행은 "**`ai_agent` 노드 한정**" 을 명시하면서 `information_extractor` 는 `RESUME_INCOMPATIBLE_STATE` 로 graceful reset 된다고 기술한다. plan A2 는 이 한정을 확인 후 확장하는 작업이다. 현재 spec 이 이를 이미 제한으로 명기하고 있어 A2 완료 시 `§1.3` 의 "ai_agent 한정" 문구를 동기화해야 하나, plan 에서 이 갱신은 "(consistency I1/I4)" 로 추적되고 있다. spec/plan 간 상태는 정합하나, A2 완료 후 spec 갱신을 잊기 쉬운 항목이다.
- **제안**: A2 PR 착수 전 `4-execution-engine.md §1.3` + `3-information-extractor.md §357` + `1-ai-agent.md §703` 의 "ai_agent 한정" 문구 3곳을 동기 갱신하도록 plan 체크리스트에 상기 표시.

---

### [INFO] `conversation-thread.md §7` 미결 목록 V084 항목이 "검토" 표기로 잔존
- **target 위치**: `spec/conventions/conversation-thread.md §7` (line ~286)
- **충돌 대상**: `spec/conventions/conversation-thread.md §8.4` (채택 완료 Rationale) 및 `1-data-model.md §2.13`
- **상세**: `conversation-thread.md §7` 의 미결 목록에 `~~**DB 컬럼 신설**: Execution.conversation_thread jsonb 컬럼 마이그레이션 검토~~ → **채택 완료**` 형태로 취소선과 채택 완료가 혼재한다. 기능적으로는 이미 채택 완료로 표기되어 있으나, 취소선 포맷의 미결 목록 항목으로 남아 있어 스캔 시 "미결" 인상을 줄 수 있다.
- **제안**: 해당 항목을 미결 목록에서 제거하거나 §8.4 로 완전 이동해 §7 목록을 정리. 현재 기능 동작에는 영향 없음.

---

## 요약

본 검토 범위(`spec/5-system/`)의 A1 Phase 관련 변경(Execution.conversation_thread 컬럼 채택, conversation-thread.md §8.4 Rationale, 1-data-model.md §2.13 컬럼 추가)은 서로 일관성이 있고 다른 spec 영역(1-auth, 10-graph-rag, 11-mcp-client 등)과 직접 충돌하는 모순은 없다. 다만 아직 완료되지 않은 Phase B(park 즉시 해제 + slow-path 일원화)의 영향을 받는 `4-execution-engine.md §4.x` · `§7.4` · `§1.1` 의 기술이 "현재 구현"과 "계획된 상태"가 혼재한 채로 갱신되지 않아 3개의 WARNING 이 발생했다. plan 이 이를 "consistency W4/W5/I2" 로 인식하고 있는 점은 긍정적이나, Phase B PR 착수 전 해당 spec 행들의 상태가 독자에게 오독을 줄 수 있어 조기 갱신이 권장된다.

## 위험도

LOW

---

STATUS: OK
