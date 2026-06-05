# Rationale 연속성 검토 결과

검토 모드: --impl-done, scope=spec/5-system/, diff-base=origin/main
Target: `plan/in-progress/exec-park-durable-resume.md` (Phase A/B 설계 및 진행 상태)
참조 Rationale: `spec/5-system/4-execution-engine.md §Rationale`

---

## 발견사항

- **[WARNING]** B2 "fast-path 강등" 옵션이 Sticky fast-path 명시 기각 결정과 충돌 가능
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` Phase B, B2 항목
    > "continuation 처리(`applyContinuation`)에서 fast-path(`pendingContinuations.has`) 제거 **또는** '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Sticky fast-path 제거 — 항상 publish 원칙 보존"`
    > "초기 검토안에서는 'publisher 가 자기 인스턴스에 key 가 있으면 BullMQ 우회하고 직접 resolve' 하는 sticky fast-path 를 포함했다. 그러나 옛 §7.4 가 명시한 '모든 진입점은 항상 publish — 직접 dispatch 분기는 race window' 원칙과 정면 충돌. … 본 채택안에서는 sticky fast-path 를 제거하고 '항상 BullMQ enqueue' 로 통일한다."
  - 상세: Rationale 은 sticky fast-path 를 "race window" 우려로 명시 기각하고 "항상 BullMQ enqueue" 원칙을 확정했다. 그런데 plan B2 는 fast-path 를 "제거"와 "순수 최적화 강등(의존 금지)" 두 선택지로 열어두었다. 강등 선택지의 설명 "같은 프로세스 우연 생존 시"는 기각된 sticky fast-path 와 동형이다. 단순히 "의존 금지" 레이블을 붙이더라도 코드에 if(pendingMap.has) 분기가 존재하면, 라우팅이 BullMQ enqueue 를 경유하지 않고 로컬 Map 에 직접 resolve 하는 경로가 운영 환경에서 실질 발현된다 — Rationale 이 기각한 정확히 그 경로다. §7.4 표 "Worker 동작" 행(라인 823)은 현재도 "로컬 pendingContinuations 에 키가 있으면 즉시 resolve (in-instance fast path)"를 Worker 동작으로 기술하고 있어, B2 가 이 행을 갱신하지 않으면 spec 본문도 기각 결정과 정합하지 않게 된다.
  - 제안: plan B2 에서 "강등" 옵션을 삭제하고 "제거"만 명시한다. 아울러 Phase B spec 변경 항목(plan 101행)에서 §7.4 "Worker 동작" 행의 fast-path 기술도 삭제 또는 "코드에 존재하지 않음"으로 갱신하도록 명시해야 한다. 만약 동일-프로세스 경유 최적화를 보존하고 싶다면, Rationale 에 "race window 위험 없이 구현하는 이유(예: BullMQ enqueue 경로를 통하되 worker가 pick up 시 pendingMap 확인)" 를 명시적으로 신규 Rationale 로 추가해야 한다.

- **[WARNING]** Phase B 착수 전 Rationale 명문화 의무가 현 plan 에 "선행 의무"로만 기록되고 spec 변경으로는 아직 미착수
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` Spec 변경 항목 (104행)
    > "**[Phase B 선행 — 구현 착수 전 의무]** D4 turn-단위 park Rationale 명문화 … 기각 대안('단일 waiting 유지+코루틴 누적 수용')."
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.x` 구현 메모(라인 406)에서 현재 모델("runExecution 코루틴 in-process 생존 + fast-path")이 사실상 "대화 전체=단일 waiting" 에 해당하는 기술로 남아 있음.
  - 상세: spec §4.x 는 현재 "park 즉시 코루틴 해제 + slow-path 일원화로의 전환을 추진한다"고 예고하지만, D4(turn-단위 park) 채택 근거와 기각 대안("단일 waiting 유지+코루틴 누적 수용") 은 spec Rationale 에 아직 없다. plan 은 이를 "Phase B 착수 전 의무"로 명시했으나 현 시점에서는 이행 전이다. Phase B 구현이 앞서면 Rationale 부재 상태에서 기각 대안이 뒤집히는 결과가 된다.
  - 제안: Phase B 구현 착수 전에 `4-execution-engine.md §Rationale` 에 "D4 turn-단위 park 채택 근거 + 기각 대안" 항을 실제로 추가해야 한다. plan 의 "의무" 기록만으로는 Rationale 연속성이 보장되지 않는다.

- **[INFO]** §7.4 표 "Worker 동작" 행(라인 823)이 fast-path 를 현행 동작으로 기술 중 — Phase B 완료 시 갱신 필요
  - target 위치: `spec/5-system/4-execution-engine.md §7.4` 표
    > "Worker 동작 | 임의 인스턴스가 job 을 pick up. 로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Sticky fast-path 제거"` — fast-path 를 채택안에서 제거함을 확정.
  - 상세: §7.4 본문은 fast-path 가 여전히 현행 동작인 것처럼 기술하고 있다. 이는 §4.x 구현 메모(라인 406)의 "현재 fast-path 가 살아있다" 서술과 일관하지만, Rationale 이 sticky fast-path 를 기각했다는 사실과 표면적으로 불일치한다. 단 §4.x 는 "현행이지만 Phase B 에서 전환 예정"임을 명시하므로 현 시점은 과도기 기술로 수용 가능하다. plan Spec 변경 목록에 §7.4 행 갱신이 포함되어 있으므로 추적은 되고 있다.
  - 제안: Phase B PR 에서 §7.4 Worker 동작 행을 "항상 rehydration(fast-path 없음)"으로 갱신하고, §4.x 구현 메모의 "현재 fast-path" 서술을 제거/교체하는 것을 plan B Spec 변경 항목에 명시적으로 포함시킨다. (현재 plan 101행에 "로컬 pendingMap 즉시 resolve(fast-path) 서술 정정"이 있으나, "제거/강등" 이중 선택지와 맞물려 실제 제거 여부가 모호하다.)

- **[INFO]** A2b(information_extractor checkpoint 확장) 기각 대안·채택 Rationale 부재
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` A2b 항목 (68행)
    > "주의: IE state 호환성·재구성기 안전성 판단 Rationale 기록(consistency I4)."
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Multi-turn 재시작 재개 — ai_agent 한정"` 마지막 항
    > "information_extractor 등 고유 state 필드를 갖는 다른 ai_conversation 핸들러는 checkpoint 를 영속하지 않으며, 재개 시 graceful reset — **번복 이전과 동일 동작이므로 회귀가 아니다**. 일반화는 후속 작업."
  - 상세: Rationale 은 "ai_agent 한정"을 명시적으로 기재했고 IE 지원은 미래 항목으로 선언했다. A2b 가 IE 까지 확장하면 이 항목을 번복하는 것이나, plan 은 "Rationale 기록 필요"를 메모로 남길 뿐 실제 Rationale 을 아직 작성하지 않았다. 분리된 계획(후속)이므로 즉각 위험은 아니나, A2b 착수 시 Rationale 갱신 없이 진행하면 명시 기각 대안 재도입이 된다.
  - 제안: A2b 착수 시점에 `4-execution-engine.md §Rationale` 에 "IE checkpoint 확장 채택 근거 + ai_agent 한정 원칙 번복 이유"를 새 항목으로 추가한다. plan 에 이를 착수 선행 조건으로 명문화한다.

---

## 요약

`plan/in-progress/exec-park-durable-resume.md` 의 전체 구조는 `spec/5-system/4-execution-engine.md §Rationale` 의 핵심 결정(Durable Continuation, "항상 BullMQ enqueue", execution-level intake 큐, 재개 경로 일원화)과 방향이 일치한다. A1/A2a 는 이미 완료되어 spec 동기화도 이행됐다. 단, Phase B2 의 "fast-path 강등" 선택지가 Rationale 에서 명시 기각된 sticky fast-path 와 동형이라는 점이 가장 중요한 Rationale 연속성 위험이다 — "의존 금지" 레이블을 붙여도 코드에 분기가 존재하면 race window 우려가 현실화된다. 또한 D4 turn-단위 park Rationale 명문화가 "Phase B 착수 전 의무"로 명시됐지만 spec 에 아직 반영되지 않아, Phase B 구현이 선행하면 Rationale 부재 번복이 된다. 이 두 항목이 해소될 때까지 Phase B 구현 착수를 유보할 것을 권장한다.

---

## 위험도

MEDIUM
