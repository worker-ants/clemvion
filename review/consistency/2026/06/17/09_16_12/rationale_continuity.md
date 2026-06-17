# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` — 구현 변경 diff (claude/engine-split-s1-nodebootstrap...HEAD)
검토 대상 파일:
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts` (신규)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (신규)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (신규)

---

## 발견사항

- **[INFO]** `WaitingInteractionType` 타입 import 방식 — Rationale 핀과 정합
  - target 위치: `ai-turn-orchestrator.service.ts` L1698 `import type { WaitingInteractionType } from './execution-engine.service'`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale` — "interaction-type-registry.md §1.1 핀에 따라 엔진 파일에 잔류한다" (코드 주석 C-1 step3 W3)
  - 상세: `WaitingInteractionType` 정의를 엔진 파일에 두고 orchestrator 에서는 `import type` (런타임 소거) 으로만 참조하는 구조가 Rationale 핀과 일치한다. "타입 전용 import 라 런타임에 소거되어 orchestrator→엔진 값 순환을 만들지 않는다" 설명이 코드 주석에 명시돼 있어 의도 추적 가능.
  - 제안: 현상 유지. 향후 `WaitingInteractionType` 이동 시 이 핀 결정을 함께 갱신해야 함을 spec Rationale 에 cross-link 형태로 남길 것.

- **[INFO]** `PARK_RELEASED` sentinel — 공유 모듈 이관 정합
  - target 위치: `ai-turn-orchestrator.service.ts` L1682 `import { PARK_RELEASED, type ProcessTurnResult } from '../../shared/execution-resume/process-turn-result'`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — "resume turn dispatch registry 추출 (#507, 2026-06-06): `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 도 `shared/execution-resume/process-turn-result.ts` 로 이관됐다"
  - 상세: 구현이 Rationale 에 기록된 이관 결정을 그대로 따른다. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `_resumeState` DB 미저장 + `_resumeCheckpoint` 평문 영속 — 보안 invariant 일관 준수
  - target 위치: `ai-turn-orchestrator.service.ts` `emitAiWaitingForInput` 메서드 내 `delete persistedOutput._resumeState` + `_resumeCheckpoint` 조건부 설정
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 'WARN #6 미영속' 번복)"` — 암호화 기각, credential-strip 부분집합만 평문 영속, `_resumeState` 자체는 미저장
  - 상세: 추출된 orchestrator 가 `_resumeState` strip 과 `_resumeCheckpoint` 조건부 설정 logic 을 그대로 보존하고 있어 Rationale 의 security invariant 와 일치한다. "메서드 본문은 추출 전과 완전히 동일하게 보존" 원칙이 지켜졌다.
  - 제안: 없음.

- **[INFO]** `EngineDriver` 인터페이스를 통한 상태 전이 위임 — per-node task queue 기각 결정과 무관
  - target 위치: `ai-turn-orchestrator.service.ts` `AiTurnOrchestrator` 클래스 전반 — `this.driver.updateExecutionStatus`, `this.driver.stageDurableResumeSnapshot` 등
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐"` — "dispatch loop in-process 전제(한 세그먼트 = 한 프로세스가 call stack 을 재귀 in-process 구동)를 유지한다"
  - 상세: `EngineDriver` 는 per-node 분산이 아니라 동일 프로세스 안의 seam 인터페이스다. orchestrator 는 `useExisting: ExecutionEngineService` 로 주입되는 동일 인스턴스를 driver 로 받으므로 in-process 전제를 깨지 않는다. spec Rationale 의 "per-node task queue 기각" 과 충돌하지 않는다.
  - 제안: `ENGINE_DRIVER` DI 토큰의 `useExisting` 바인딩이 in-process 전제의 핵심인데, spec 에 이 바인딩이 명시되어 있지 않다. spec `§Rationale` 또는 `§5 노드 핸들러 계약` 에 "EngineDriver 는 항상 useExisting — 분산 분리 아님" 을 짧게 기재하면 향후 리뷰어 혼동 방지에 도움이 된다.

- **[INFO]** `runAiConversationLoop` 장수 루프 완전 부재 확인 — full B3 원칙 준수
  - target 위치: `ai-turn-orchestrator.service.ts` 전체 — 루프 미존재, `processAiResumeTurn` 이 단발 turn 처리만 수행
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — "D4 — 멀티턴 turn-단위 park: `runAiConversationLoop` 의 장수 루프를 매 turn 입력 대기에서 해제 … 기각 대안('대화 전체 = 단일 waiting 유지 + 코루틴 누적 수용')은 bounded-메모리 목표와 정면 충돌이라 기각"
  - 상세: 추출된 orchestrator 에 in-memory 장수 루프가 없고 `waitForAiConversation` 이 `PARK_RELEASED` 를 반환하며 세그먼트를 종료하는 구조가 D4 결정과 일치한다. 기각된 "대화 전체 단일 waiting + 코루틴 누적" 대안이 재도입되지 않았음.
  - 제안: 없음.

- **[INFO]** `button_click` stale re-park 처리 — 기존 decision 보존
  - target 위치: `ai-turn-orchestrator.service.ts` `processAiResumeTurn` L1939-L1946
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.9` 인용 (diff 주석) — "ai_conversation 대기 중 presentation 본체 버튼은 표시·라우팅 안 됨. 도달 시 graceful: 상태 변경 없이 re-park"
  - 상세: stale `button_click` 의 graceful re-park 처리가 기각된 "즉시 throw/FAILED" 패턴이 아닌 "warn + re-park" 로 구현돼 있다. Rationale 의 방어 원칙과 일치.
  - 제안: 없음.

- **[INFO]** `MAX_UNKNOWN_SKIPS` in-memory 카운터 미존재 — B3 완전 제거 확인
  - target 위치: `ai-turn-orchestrator.service.ts` unknown action.type 분기 — in-memory 카운터 없이 BullMQ attempts 에 위임
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — "B3: `pendingContinuations`·`firstSegmentBarriers` 일가·`firePayload` scheduler·`runAiConversationLoop`·detached 완전 제거"
  - 상세: diff 주석("옛 loop 의 MAX_UNKNOWN_SKIPS in-memory 누적 cap 은 turn-park 에선 각 turn 이 별 continuation job 이라 비적용 — BullMQ attempts/dedup 이 폭주를 제한한다")이 이 결정을 명시해 Rationale 연속성이 추적 가능하다.
  - 제안: 없음.

---

## 요약

이번 diff (C-1 step2/step3 `AiTurnOrchestrator` 추출)는 god-class `ExecutionEngineService` 에서 AI 멀티턴 생명주기를 별도 서비스로 분리하는 **행동 보존 리팩토링**이다. 검토 결과, `spec/5-system/4-execution-engine.md §Rationale` 에 기록된 모든 핵심 결정 — D4(turn-단위 park), full B3(in-memory 루프 완전 제거), `_resumeState` 미저장 + `_resumeCheckpoint` 평문 영속, `PARK_RELEASED` 공유 모듈 이관, `WaitingInteractionType` 엔진 잔류 핀, per-node 분산 기각 + in-process 유지, stale button_click graceful re-park — 이 추출 후에도 그대로 준수되고 있다. 기각된 대안(장수 루프 재도입, in-memory 카운터 누적, 암호화 기반 _resumeState 저장, per-node task queue)이 재도입된 흔적은 없다. INFO 수준의 제안으로 `EngineDriver` 의 in-process (`useExisting`) 바인딩 전제를 spec Rationale 에 짧게 명시하는 것이 향후 리뷰어 혼동 방지에 유용할 것이다.

---

## 위험도

NONE
