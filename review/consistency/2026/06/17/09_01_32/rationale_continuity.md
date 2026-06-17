# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/4-execution-engine.md, diff-base=claude/engine-split-s1-nodebootstrap)
대상 diff: ai-conversation-helpers.ts (신규), ai-turn-orchestrator.service.ts (신규), ai-turn-orchestrator.service.spec.ts (신규)

---

## 발견사항

- **[WARNING]** WARN #6 주석 — 폐기된 결정의 코드 주석이 현행 구현과 함께 존재
  - target 위치: `ai-turn-orchestrator.service.ts` `emitAiWaitingForInput` 내 `persistedOutput` 영속 블록 (diff line 2029–2036)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md § Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 'WARN #6 미영속' 번복)"`
  - 상세: WARN #6 주석은 "\_resumeState 를 DB 에 저장하지 않는다 / in-memory 만 유지 / 재시작 시 소실" 이라고 기록하고 있다. 그러나 spec Rationale 는 이 WARN #6 결정이 운영 결함(장수명 채널 대화가 배포 1회로 영구 종결)을 낳아 **명시적으로 번복**됐음을 기록한다 — 번복 후 `_resumeCheckpoint` 평문 영속이 채택됐다. 실제 구현 코드도 WARN #6 주석 직하에서 `delete persistedOutput._resumeState` 뒤 `_resumeCheckpoint` 를 영속하는 올바른 경로를 따른다. 문제는 주석 문장이 **폐기된 옛 결정을 현재 시제로 서술**("저장하지 않는다", "소실된다", "Phase 2 에서 해결 예정")하고 있어, 코드를 읽는 사람이 현행 동작이 아직 in-memory-only 라고 오인할 수 있다.
  - 제안: WARN #6 주석 블록을 "구 WARN #6 결정은 spec Rationale `_resumeCheckpoint 보존` 항에서 번복됨. full \_resumeState 는 여전히 strip 하되 credential-strip 부분집합 \_resumeCheckpoint 를 DB 영속한다 (§7.5 rehydration 무손실 재개 전제)." 로 교체한다. "Phase 2 에서 해결 예정"처럼 이미 완료된 사항을 예정으로 지칭하는 문장도 제거한다.

- **[INFO]** MAX_UNKNOWN_SKIPS in-memory cap — 폐기 근거가 주석에만 존재하고 Rationale 에 미기록
  - target 위치: `ai-turn-orchestrator.service.ts` `processAiResumeTurn` 내 unknown action.type 처리 (diff line 1949)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md § Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — turn-park 로 전환됨에 따라 옛 in-memory 장수 루프의 MAX_UNKNOWN_SKIPS cap 이 폐기됐다는 사실이 spec Rationale 에 직접 기록되지는 않았다.
  - 상세: 코드 주석은 "옛 loop 의 MAX_UNKNOWN_SKIPS in-memory 누적 cap 은 turn-park 에선 각 turn 이 별 continuation job 이라 비적용 — BullMQ attempts/dedup 이 폭주를 제한한다" 고 설명한다. 이 폐기 판단은 타당하고 Rationale 의 "turn-park = 1 job per turn" 원칙과 정합하지만, spec Rationale 에는 MAX_UNKNOWN_SKIPS 의 폐기 및 BullMQ attempts 로의 대체가 명시되지 않았다. 현재는 코드 주석만이 근거다.
  - 제안: spec Rationale "park 즉시 해제 + slow-path 일원화" 항 또는 "Phase 2 cont 후속 정리" 항에 "옛 in-memory 루프의 MAX_UNKNOWN_SKIPS cap 은 turn-단위 park 로 더 이상 유효하지 않으며, BullMQ job 의 `attempts` + `dedup` 이 unknown payload 폭주를 제한한다" 를 추가해 코드 주석 근거를 spec 으로 올린다.

- **[INFO]** EngineDriver seam + forwardRef DI — Rationale 에 strangler-fig 추출 결정만 기록되고 순환 import 해소 전략 미기록
  - target 위치: `ai-conversation-helpers.ts` JSDoc (diff line 40–51), `ai-turn-orchestrator.service.ts` imports (diff line 1695–1699)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` — C-1 step2 추출 계획이 반영됐을 것으로 보이나 spec 본문·Rationale 어디에도 EngineDriver 인터페이스 패턴이나 `forwardRef` 사용 근거가 명시돼 있지 않다.
  - 상세: 코드 주석이 "엔진이 `forwardRef` DI 로 orchestrator 를 값으로 import 하므로 반대 방향 값 import 가 남으면 런타임 순환이 된다 — helper 모듈로 분리해 해소" 라고 설명한다. 이 설계 판단(helper leaf 모듈 추출로 ES module 런타임 순환 해소)은 strangler-fig 리팩토링 원칙과 직교하는 구현 수준 결정이라 spec Rationale 기록이 없어도 정책 위반이라 할 수 없다. 다만 추후 같은 영역을 다루는 사람이 참조할 결정이므로 보완 가치가 있다.
  - 제안: `spec/5-system/4-execution-engine.md` Rationale 에 "(C-1 step2, strangler-fig) AiTurnOrchestrator 추출 시 ES module 런타임 순환 해소를 위해 공유 helper 를 별도 leaf 모듈(`ai-conversation-helpers.ts`)로 분리한다 — 엔진이 forwardRef DI 로 orchestrator 를 value import 하므로 역방향 value import 차단이 필요하다" 를 short 항목으로 추가한다. 선택 사항.

- **[INFO]** `buildConversationConfigFromOutput` — D6 decision 참조가 코드 주석에만 존재
  - target 위치: `ai-conversation-helpers.ts` `buildConversationConfigFromOutput` JSDoc (diff line 228–235)
  - 과거 결정 출처: spec 본문·Rationale 에서 "D6 (2026-05-17) — 대화 필드는 output.result.* 단일 경로" 결정이 기록됐는지 확인이 필요하다. 코드 주석은 이를 명확히 설명하나, spec §7.4/§7.5 이 그 결정을 anchor 하는 항목인지 불명확하다.
  - 상세: 코드 주석 "D6 (2026-05-17) — multi-turn 의 message / messages / turnCount 는 waiting/resumed/ended 모두 output.result.* 단일 경로로 통일됐다" 는 올바른 설계 원칙이다. 이 단일 경로 원칙은 `spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.5` 와 정합해야 하지만 본 검토 scope 밖 spec 이라 교차 확인이 제한된다. 충돌 근거 없음.
  - 제안: AI Agent spec `§7.4/§7.5` Rationale 에 D6 단일 경로 결정이 아직 기록되지 않았다면 추가를 권장한다. 실행 엔진 Rationale 범위에서는 현재 충돌 없음.

---

## 요약

target 구현(C-1 step2 AiTurnOrchestrator 추출 + ai-conversation-helpers 분리)은 spec `## Rationale` 의 핵심 결정들을 준수한다. park 즉시 해제 + slow-path 일원화(Phase B), `_resumeCheckpoint` 평문 영속(WARN #6 번복), BullMQ 영속 continuation 큐, per-node task queue 미채택, execution-level intake 큐 원칙이 모두 구현에 그대로 반영됐다. 가장 주목할 사안은 WARN #6 주석으로, 폐기된 결정을 현재 시제로 기술하는 오래된 주석이 새 파일에 그대로 이식돼 있다 — 코드 동작은 올바르나 주석이 독자에게 혼동을 줄 수 있다. 나머지 발견사항은 spec Rationale 보완 권장 수준의 INFO 사항이며 구조적 위반은 없다.

---

## 위험도

LOW
