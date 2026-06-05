# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

실제 변경된 spec 파일: `spec/5-system/4-execution-engine.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/1-data-model.md`

---

## 발견사항

### 1. **[INFO]** `별도 DB 컬럼 신설 기각` Rationale 의 번복 — 새 Rationale 명시 있음 (정합)

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale L1166 / `spec/conventions/conversation-thread.md` §4 (영속화 표) + §8.4 신설
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 항목 L1166 — "**별도 `_continuationCheckpoint` 컬럼 신설 기각**: 기존 SoT 인 `NodeExecution.outputData` (JSONB) 에 키로 보존해 **DB 스키마 변경·마이그레이션을 회피**한다" ; `spec/conventions/conversation-thread.md` §4 옛 문구 — "**v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음.**" + 메모리 전략 footnote "**별도 DB 컬럼을 만들지 않는다**"
- **상세**: 과거 두 spec 은 다른 이유로 동일한 원칙을 공유했다 — `NodeExecution.outputData` JSONB 에 키를 보존해 DB 스키마 변경·마이그레이션을 회피하고, rehydration 은 분산 저장에서 thread 를 재구성한다. 이번 변경은 `Execution.conversation_thread jsonb NULL` 신규 컬럼을 도입해 두 결정을 모두 번복한다. 그러나 번복 사유가 **두 위치 모두에 명시**되어 있다.
  - `spec/conventions/conversation-thread.md §8.4` (신설 Rationale): 기존 "신규 DB 컬럼 없음" 원칙이 "실행 이력 재구성" 목적에서 출발한 것이며, durable in-flight resume 요구를 다루지 않았다는 적용 범위 분리를 명시. derived-view 재구성 대안 기각 이유 (`runningSummary`/`summarizedUpToSeq` 가 per-node output 에 분산 저장되지 않아 무손실 재구성 불가) 기록.
  - `spec/5-system/4-execution-engine.md` §6.2 행: `Execution.conversation_thread` 채택과 링크 명시.
  - `plan/in-progress/exec-park-durable-resume.md` A1 항목: "conversation-thread.md '신규 DB 컬럼 없음' 조항(§4/§7/§8 세 앵커) + `4-execution-engine.md §6.2` 를 **한 PR 로 동기 갱신**, Rationale 에 정책 전환 사유 명문화" 요구 충족 확인.
- **제안**: 정합 처리됨. 추가 조치 불필요. 다만 `spec/5-system/4-execution-engine.md` §Rationale L1166 의 "`_continuationCheckpoint` 컬럼 신설 기각" 항목은 `conversationThread` 목적의 컬럼과는 별개 결정(conversation_thread ≠ _continuationCheckpoint)이므로 해당 항목을 오해할 여지는 없다 — 단, §Rationale 독자가 두 결정을 연결하기 어려울 수 있으므로 L1166 에 "`conversationThread` 용 컬럼은 §8.4 전환 참조" 한 줄 cross-link 를 추가하면 더 명확해진다.

---

### 2. **[INFO]** `ExecutionContext rehydration 이 conversationThread 를 복원` 약속 — 기존 미이행의 정합화 (번복 아님)

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.5 rehydration 다이어그램 (L880~L893), §6.2 L728 행
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` 구 §7.5 — "NodeExecution.outputData 에서 ... conversationThread 로드"; `spec/conventions/conversation-thread.md` §4 메모리 전략 footnote — "restart / 타 인스턴스 재개 시 ExecutionContext rehydration 으로 함께 복원된다"
- **상세**: 과거 spec 은 rehydration 이 conversationThread 를 복원한다고 약속했으나 실제 구현은 빈 thread 로 리셋했다 (spec↔impl drift). 이번 변경은 그 약속을 실제 구현 경로 (`Execution.conversation_thread` 컬럼 → rehydration 복원) 로 정합화한 것이다. 번복이 아니라 drift 해소이다.
- **제안**: 정합 처리됨. 추가 조치 불필요.

---

### 3. **[INFO]** `메모리 전략 runningSummary·summarizedUpToSeq` 의 복원 경로 변경

- **target 위치**: `spec/conventions/conversation-thread.md` §4 영속화 표 footnote (자동 메모리 전략 경로)
- **과거 결정 출처**: 동 문서 §4 구 footnote — "restart / 타 인스턴스 재개 시 ExecutionContext rehydration 으로 함께 복원된다 — **별도 DB 컬럼을 만들지 않는다**"
- **상세**: 구 footnote 는 runningSummary/summarizedUpToSeq 가 Redis ExecutionContext rehydration 으로 복원된다고 기술했으나, 실제로는 Redis 직렬화가 미구현 상태여서 복원 불가였다. 신규 문서는 park 스냅샷(`Execution.conversation_thread`)을 통해 thread 전체와 함께 복원됨으로 변경한다.
- **제안**: 변경은 실제 동작을 더 정확히 반영하며, §8.4 Rationale 에 근거가 있다. 추가 조치 불필요.

---

### 4. **[WARNING]** `plan/in-progress/exec-park-durable-resume.md` Phase B (park 즉시 해제 + slow-path 일원화) — Rationale 명문화 요건 미이행

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale — Phase B 관련 신규 Rationale 없음
- **과거 결정 출처**: `plan/in-progress/exec-park-durable-resume.md` §Spec 변경 항목 — "**[Phase B 선행 — 구현 착수 전 의무]** D4 turn-단위 park Rationale 명문화(`4-execution-engine.md §4.x` 또는 신규 §Rationale): 기존 '대화 전체=단일 waiting' 대비 차이, 채택 근거(메모리 bounded + slow-path 일원화 정합), 기각 대안('단일 waiting 유지+코루틴 누적 수용')."
- **상세**: `spec/5-system/4-execution-engine.md §4.x` 또는 §Rationale 에 D4(turn-단위 park)의 Rationale 이 아직 없다. 단, 현재 diff 를 보면 Phase B 구현 자체도 아직 진행되지 않았고 Phase A1(conversationThread 영속) 만 구현·spec 반영된 상태이다. Plan 의 해당 요건은 "Phase B 선행 의무" 로 명시돼 있으므로 Phase B 착수 전 반드시 이행되어야 한다. 현 시점에서는 Phase B 구현이 없으므로 Rationale 미이행이 즉각 결함은 아니나, spec 검토자가 인지해야 할 주의 항목이다.
- **제안**: Phase B (B1~B3) 구현 착수 전에 `spec/5-system/4-execution-engine.md` §Rationale 또는 §4.x 에 다음 내용을 명문화해야 한다 — (1) 기존 "대화 전체=단일 waiting + 코루틴 in-process 생존" 대안 기각 이유(메모리 무한 누적 위험), (2) turn-단위 park 채택 근거(bounded 메모리 + slow-path 일원화 정합), (3) rehydration 비용(사람-페이스 수용 판단). 이는 plan 이 이미 식별한 의무 항목이므로 Phase B PR 에 포함한다.

---

## 요약

이번 변경의 핵심은 `spec/5-system/4-execution-engine.md` §6.2/§7.5 와 `spec/conventions/conversation-thread.md` §4 에서 오랫동안 유지해 온 "신규 DB 컬럼 없음" 결정을 `Execution.conversation_thread jsonb` 컬럼 도입으로 번복한 것이다. 그러나 번복에 따른 새로운 Rationale 이 `conversation-thread.md §8.4` 로 명시적으로 작성됐으며, 기각한 대안(derived-view 재구성)의 이유도 문서화되어 있다. 나머지 변경(rehydration 경로 반영, 메모리 전략 footnote 갱신)은 spec↔impl drift 정합화이므로 새 Rationale 이 필요한 번복이 아니다. 단, Phase B(park 즉시 해제 + slow-path 일원화)의 D4 turn-단위 park Rationale 이 아직 spec 에 없으며 plan 이 "Phase B 선행 의무"로 요구한 항목이므로 Phase B 착수 전 이행이 필요하다.

## 위험도

LOW
