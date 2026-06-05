# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/exec-park-durable-resume.md` (target)
관련 spec: `spec/5-system/4-execution-engine.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 위반 없음

검토 결과 아래 4개 관점 모두에서 위반이 발견되지 않았다.

**1. 기각된 대안의 재도입**

spec Rationale 에서 명시적으로 기각된 대안 목록:

- `Sticky fast-path (publisher-side BullMQ 우회)` → Rationale "Sticky fast-path 제거" 에서 기각. Plan B2 는 worker-side fast-path 도 제거해 일관되게 적용.
- `Redis pub/sub 유지 + 재시도` → Rationale "Durable Continuation" 에서 기각. Plan 에서 재도입 없음.
- `Temporal/Inngest 전용 워크플로우 엔진 이전` → Rationale 에서 기각. Plan 에서 재도입 없음.
- `WAITING_FOR_INPUT → INTERRUPTED 신규 enum 도입` → Rationale 에서 기각. Plan 에서 재도입 없음.
- `_continuationCheckpoint 별도 컬럼 신설` → Rationale 1.4.E 에서 기각. Plan 은 기존 NodeExecution.outputData 에 보존하는 채택 방향 유지.
- `derived-view 재구성 (컬럼 없이 NodeExecution 에서 thread 재구성)` → conversation-thread §8.4 에서 기각. Plan A1 은 Execution.conversation_thread jsonb 컬럼 채택(D1 확정), 기각 대안 재도입 없음.
- `checkpoint 에 rawConfig 영속해 per-conversation frozen 유지` → Rationale "park 즉시 해제 + slow-path 일원화" D3 에서 기각. Plan D3 은 fresh-per-turn 으로 확정, 기각 대안 재도입 없음.
- `대화 전체 = 단일 waiting 유지 + 코루틴 누적 수용` → Rationale D4 에서 기각. Plan D4 는 turn-단위 park 로 확정, 기각 대안 재도입 없음.
- `per-node task-queue (1 Worker = 1 NodeExecution)` → Rationale "per-node task queue → execution-level intake 큐" 에서 기각. Plan 에서 재도입 없음.

이 모든 기각 대안이 Plan target 에서 재도입되지 않았음을 확인.

**2. 합의된 원칙 위반**

주요 합의 원칙과 Plan 의 정합 확인:

- "항상 BullMQ enqueue (publisher-side)" 원칙 → Plan B2 가 worker-side 대칭 완성으로 강화. 원칙 위반 없음.
- "park 시 코루틴 즉시 해제 (bounded 메모리)" 원칙 (Phase B Rationale 채택) → Plan Phase B/B1 에서 구현 예정. 위반 없음.
- "모든 재개 = rehydration 단일 경로 (slow-path 일원화)" 원칙 → Plan B2 에서 구현 예정. 위반 없음.
- "Phase A 완료 후 Phase B 진행" 순서 원칙 → Plan 에서 A1/A2a/A2b/A3 완료 후 B 착수로 명시. 위반 없음.
- "`_resumeCheckpoint` credential-strip 부분집합만 영속 (암호화 아님)" 원칙 → Rationale "Multi-turn 재시작 재개" 채택. Plan A2a/A2b 에서 동일 정책 준수.
- "ai_agent + information_extractor 확장" (초기 ai_agent 한정에서 점진 확장) 원칙 → Rationale 1.4 마지막 항목. Plan A2b 가 IE 확장으로 이를 실현. 위반 없음.
- conversation-thread "신규 DB 컬럼 없음 → durable park resume 한정 전환" 원칙 (§8.4) → Plan A1 은 이 결정을 구현. 위반 없음.

**3. 결정의 무근거 번복**

Plan 에서 기존 spec 결정을 번복하는 항목 2건을 확인했으나, 두 건 모두 spec Rationale 에 해당 번복 근거가 명문화되어 있다.

- "신규 DB 컬럼 없음" 원칙 → `Execution.conversation_thread jsonb` 컬럼 신설로 번복. spec conversation-thread §8.4 Rationale 에 "적용 범위 분리 (실행 이력 재구성 vs durable in-flight resume)" 로 번복 근거 명시. 적절한 번복.
- "ai_agent 한정" `_resumeCheckpoint` → `ai_agent + information_extractor` 로 확장. spec execution-engine Rationale "ai_agent + information_extractor 지원 (점진 확장)" 에 근거 명시. 적절한 번복.

두 건 모두 새 Rationale 과 함께 번복됐으며 무근거 번복이 아님.

**4. 암묵적 가정 충돌**

spec Rationale 에 기록된 system invariant 와 Plan 의 충돌 여부 확인:

- invariant: `waiting_for_input` 은 큐 엔트리 없음 · stalled 재큐 대상 아님 · 무기한 park. Plan 이 이 invariant 를 우회하는 설계를 포함하지 않음.
- invariant: `_resumeCheckpoint` TTL 없음 (waiting Execution 은 무기한 보존). Plan A2a/A2b 에서 TTL 미포함 유지.
- invariant: "동일 turn 이중 실행 0 (durable WAITING_FOR_INPUT + NodeExecution.status 재검증 가드)". Plan B2 불변식 보존 항목에서 명시.
- invariant: park 중 user_variables 중 시스템 `__*` 는 commit 제외 (사용자분만 영속). Plan A3 `stageDurableResumeSnapshot` 에서 `__*` 제외 명시. invariant 위반 없음.

---

## 요약

`plan/in-progress/exec-park-durable-resume.md` 는 `spec/5-system/4-execution-engine.md` 및 관련 spec 의 Rationale 와 전면 정합한다. Phase A(A1~A3) 의 완료된 항목들은 각각 해당 Rationale 에서 채택된 결정(Execution.conversation_thread 컬럼 신설, _resumeCheckpoint credential-strip 영속, user_variables durable commit)을 충실히 구현했으며, Phase B(B1~B3) 의 미완 항목들도 Rationale "park 즉시 해제 + slow-path 일원화" 의 채택·기각 구조와 정확히 일치한다. 기각된 대안(sticky fast-path, per-conversation frozen, 코루틴 누적 수용, per-node task-queue 등) 중 Plan 에 재도입된 항목은 없고, 번복이 일어난 두 결정("신규 컬럼 없음", "ai_agent 한정")은 모두 spec Rationale 에 근거가 선행 명문화된 상태이다. Rationale 연속성 관점의 위험 요인은 발견되지 않았다.

---

## 위험도

NONE
