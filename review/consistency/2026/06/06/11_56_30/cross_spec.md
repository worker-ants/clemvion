# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system` (--impl-done, diff-base=origin/main)
검토 시각: 2026-06-06

---

## 발견사항

### 발견사항 없음 (CRITICAL 0건)

직접 모순을 일으키는 CRITICAL 충돌은 발견되지 않았다.

---

### [WARNING] `spec/0-overview.md §2.4` — durable 컬럼 목록 미동기

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표 (V084 `conversation_thread`, V085 `user_variables`, V087 `resume_call_stack`)
- **충돌 대상**: `spec/0-overview.md §2.4 Execution Engine` 설명 블록
- **상세**: `0-overview.md §2.4` 는 `waiting_for_input` 이 "큐 없는 durable DB park" 임을 올바르게 언급하지만, Phase A 에서 추가된 세 신규 durable 컬럼(`conversation_thread`, `user_variables`, `resume_call_stack`)을 명시하지 않는다. `§6.1 구현 완료` 표의 "실행 엔진" 행도 rehydration 경로만 언급하며 신규 영속 매체를 나열하지 않는다. 현재 서술이 틀리지는 않으나, 개요 문서가 phase-B 구현의 핵심 인프라 결정을 반영하지 않아 독자가 과거 모델로 오해할 여지가 있다.
- **제안**: `0-overview.md §2.4 Execution Engine` 에 "durable park 상태는 `Execution.conversation_thread`(V084)·`user_variables`(V085)·`resume_call_stack`(V087) 세 컬럼으로 무손실 영속된다 ([실행엔진 §6.2](./5-system/4-execution-engine.md#62-저장-전략))" 한 줄 추가. 또는 현행 cross-ref 링크가 충분하다면 INFO 로 강등 가능.

---

### [WARNING] `spec/5-system/13-replay-rerun.md` — rehydration 컬럼 누락

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` rehydration 절차 (conversation_thread / user_variables 복원 명시)
- **충돌 대상**: `spec/5-system/13-replay-rerun.md §14.3` (re-run 의 rehydration 분기)
- **상세**: 실행 엔진 §7.5 는 rehydration 이 `Execution.conversation_thread` / `user_variables` 를 복원함을 명시하고 있고, 13-replay-rerun.md §14.3 에는 "D3 fresh-config-per-turn" 단서와 §6.1 링크를 추가했다는 plan 기록이 있다. 그러나 실제 `13-replay-rerun.md` 파일 안에 `conversation_thread` / `user_variables` 에 대한 언급이 전혀 없다(`grep` 결과 0건). re-run 이 `waiting_for_input` 상태에서 생성된 execution 을 대상으로 할 때 rehydration 의 동작과 신규 컬럼의 영향이 기술되지 않아, re-run spec 독자가 실제 재개 흐름과 다른 이해를 할 수 있다.
- **제안**: `13-replay-rerun.md §14.3` (또는 재개 흐름 관련 절) 에 "재개 시 `Execution.conversation_thread`·`user_variables` 컬럼에서 무손실 복원([실행엔진 §7.5](./5-system/4-execution-engine.md#75-resume-after-restart-rehydration))" 단서 추가.

---

### [WARNING] `spec/conventions/conversation-thread.md §4` — "신규 DB 컬럼 없음" 전제 폐기 명시 누락

- **target 위치**: `spec/conventions/conversation-thread.md §8.4` (채택 결정 기록)
- **충돌 대상**: `spec/conventions/conversation-thread.md §4` 영속화 표의 "실행 중" 행
- **상세**: §8.4 는 "신규 DB 컬럼 없음" 전제를 전환했다고 기술하고, §4 영속화 표의 "실행 중" 행은 "재시작·타 인스턴스 재개 시 `rehydrateContext` 는 이 thread 를 복원하지 못하므로…"라는 문구가 남아있다. 이 문구는 park 스냅샷이 해결한 문제의 **과거 상태**를 현재 시제처럼 기술하여, 신규 독자가 실제로는 해소된 갭이 여전히 존재한다고 오해할 수 있다.
- **제안**: §4 "실행 중" 행의 해당 문구를 "park 이전에는 복원이 불가능했으나, park 스냅샷(`Execution.conversation_thread`)이 durable 복원을 담당하므로 §4 'waiting_for_input park 진입 시' 행이 실질적 무손실 보장을 제공한다" 로 정정.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5` — "D6" 레이블 중의성 (해소됨, 동기화 권장)

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` 중첩 sub-workflow 재개 절 (`exec-park D6` 레이블 사용)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `D6 결정` (AI 노드 output 경로 단일화)
- **상세**: 두 spec 에서 서로 다른 맥락으로 `D6` 레이블이 사용된다. `4-execution-engine.md §7.5` 는 이미 "**레이블 주의**: 본 절의 `exec-park D6` 는 `1-ai-agent.md` 의 동명 `D6` 와 **무관**하다"라고 명시적으로 경고한다. 중의성 자체는 인지되어 있으나 `1-ai-agent.md` 에는 이에 대응하는 역방향 경고가 없다.
- **제안**: `1-ai-agent.md` 의 `D6` 결정 항목 옆에 "(본 D6 는 AI 노드 output 경로 단일화 결정 — `exec-park-durable-resume` plan 의 중첩 call stack 결정과 동명 상이)" 한 줄 추기. 필수 아님(실제 충돌 없음).

---

### [INFO] `spec/1-data-model.md §2.13 Execution` — `resume_call_stack` 구현 상태 표기 불일치

- **target 위치**: `spec/1-data-model.md §2.13 Execution` 의 `resume_call_stack` 행
- **충돌 대상**: `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표
- **상세**: `1-data-model.md` 의 `resume_call_stack` 행 설명에는 "V087 (exec-park D6)" 컬럼이 추가됨을 명시하지만, "park 시 stage 와 §7.5 재귀 재진입 로직은 PR-B2 후속 커밋에서 구현"이라는 구현 상태 단서가 없어 컬럼이 완전히 동작한다는 인상을 줄 수 있다. `4-execution-engine.md §6.2` 의 동일 항목에는 "(구현 상태 2026-06-06: ...컬럼은 `NULL` 유지, 중첩 blocking 은 기존 동작)" 단서가 상세히 기술되어 있다.
- **제안**: `1-data-model.md` 의 `resume_call_stack` 행 설명 끝에 "(V087 컬럼 추가 완료, park stage·재귀 rehydration 로직은 PR-B2b 구현 예정 — 그 전까지 항상 `NULL`)" 단서 추가로 두 spec 의 구현 상태 기술을 동기화.

---

### [INFO] `spec/5-system/4-execution-engine.md §1.3` — Information Extractor 다중 위치 업데이트 완료 확인

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` (`ai_agent · information_extractor` 멀티턴 노드 적용 범위)
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md §378` + `spec/4-nodes/3-ai/1-ai-agent.md §703`
- **상세**: plan A2b 에서 "ai_agent 한정" 문구 3곳을 동기 갱신했다고 기록한다. `4-execution-engine.md §1.3` 과 `3-information-extractor.md §378` 은 모두 `information_extractor` 지원을 반영하고 있다. `1-ai-agent.md §703` 의 갱신 여부는 grep 접근으로 확인이 어렵지만, plan 기록상 세 곳 모두 완료됐다고 명시되어 있다. 충돌 없음 — 동기화 완료 상태.
- **제안**: 현상 유지. 필요하면 `1-ai-agent.md §703` 라인을 spot-check 하여 "ai_agent · information_extractor" 로 업데이트됐는지 confirm.

---

## 요약

`spec/5-system` (exec-park-durable-resume — PR-B1 완료 + PR-B2a 완료 시점) 의 핵심 변경 사항(`conversation_thread`/`user_variables`/`resume_call_stack` 세 durable 컬럼 추가, park-release+slow-path 일원화, Information Extractor 멀티턴 지원 확장)은 주요 소비 spec(`1-data-model.md`, `conventions/conversation-thread.md`, `4-execution-engine.md`, `3-information-extractor.md`, `data-flow/3-execution.md`)과 전반적으로 정합하며 직접 모순은 없다. CRITICAL 충돌은 0건이다. 다만 `0-overview.md`, `13-replay-rerun.md`, `conversation-thread.md §4` 의 일부 서술이 신규 durable 컬럼과 구현 상태를 충분히 반영하지 않아 독자 오해 여지가 있으므로, 각 WARNING 항목에서 제시한 단서 추가를 권장한다. `D6` 레이블 중의성과 `resume_call_stack` 구현 상태 단서 누락은 INFO 수준으로 기능에 영향을 주지 않는다.

## 위험도

LOW

STATUS: OK
