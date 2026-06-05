# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)  
검토 범위: `spec/5-system/` 전체  
기준 Rationale 출처: `spec/5-system/4-execution-engine.md § Rationale`, 특히 "Durable Continuation & Graceful Shutdown" / "Sticky fast-path 제거" 항목  
관련 plan: `plan/in-progress/exec-park-durable-resume.md`

---

## 발견사항

### [WARNING] §7.4 Worker 동작 행이 기각된 sticky fast-path 와 혼재

- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` 의 continuation-bus 표, "Worker 동작" 행  
  ```
  | Worker 동작 | 임의 인스턴스가 job 을 pick up. 로컬 pendingContinuations 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path) |
  ```
  및 다이어그램의 `pendingMap hit (fast path)` 분기
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Sticky fast-path 제거 — 항상 publish 원칙 보존"`  
  > "초기 검토안에서는 '자기 인스턴스에 key가 있으면 BullMQ 우회하고 직접 resolve' 하는 sticky fast-path를 포함했다. 그러나 … 본 채택안에서는 sticky fast-path를 제거하고 '항상 BullMQ enqueue' 로 통일한다."  
  및 "라우팅 원칙" 행: `모든 진입점은 항상 BullMQ enqueue. 자기 인스턴스의 pendingContinuations 에 키가 있어도 마찬가지`
- **상세**: Rationale 는 publisher-side sticky fast-path(publisher 가 자기 인스턴스 pendingMap 에 키가 있으면 BullMQ 우회)를 기각했지만, Worker 동작 행과 다이어그램은 여전히 worker-side fast-path(`pendingMap hit → resolve()`)를 정상 경로로 기술한다. 이 둘이 공존하므로 독자는 "publisher 가 항상 enqueue, worker 가 pendingMap 로 fast-path" 라는 해석이 남는다. Plan Phase B2 는 `pendingContinuations` 의존을 완전 제거하거나 "순수 최적화(의존 금지)"로 강등할 것을 명시했으므로, spec 의 Worker 동작 기술이 plan 이 기각하는 fast-path 의존을 허용하는 듯한 표현으로 남아 있다.  
  - Plan Phase B2: `applyContinuation 에서 fast-path(pendingContinuations.has) 제거 또는 "같은 프로세스 우연 생존 시 순수 최적화"로 강등(의존 금지)`
- **제안**: Phase B 구현 착수 전, §7.4 Worker 동작 행과 다이어그램에서 `pendingContinuations` fast-path 분기를 "현재 구현 과도기(Phase B 이전)"임을 주석 또는 별도 배너로 표시하거나, Phase B Spec 변경 항목에 §7.4 동기화가 명시적으로 포함되어 있는지 확인한다. Plan의 "Spec 변경" 섹션에 §7.4 Worker 동작 행 정정이 이미 언급(`consistency W5/I2 — 누락분 추가`)되어 있으나, 구현 시작 전 spec 선행 갱신이 규약상 의무이므로 Phase B 착수 시점에 먼저 §7.4 를 정정해야 한다.

---

### [WARNING] Phase B 선행 Rationale 명문화 미완료 — turn-단위 park

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` (또는 §Rationale 신규 항목)  
  현재 §4.x 구현 메모에는 turn-단위 park 전환의 **Rationale 가 없다**.
- **과거 결정 출처**: `plan/in-progress/exec-park-durable-resume.md §Spec 변경` 항목  
  > "[Phase B 선행 — 구현 착수 전 의무] D4 turn-단위 park Rationale 명문화(`4-execution-engine.md §4.x` 또는 신규 §Rationale): 기존 '대화 전체=단일 waiting' 대비 차이, 채택 근거(메모리 bounded + slow-path 일원화 정합), 기각 대안('단일 waiting 유지+코루틴 누적 수용')."
- **상세**: Plan 자체가 "Phase B 구현 착수 전 의무"로 Rationale 선행 기록을 명시하고 있다. 현재 spec 에는 D4(멀티턴 AI = turn-단위 park) 결정의 Rationale 가 존재하지 않는다. 기존 §Rationale 에는 "대화 전체 = 단일 waiting" 이 묵시적 전제로 쓰여 있고, turn-단위로 바꾸는 결정을 뒤집으면서 어떤 대안을 기각했는지가 기록되지 않은 상태로 Phase B 구현이 시작되면 합의된 원칙("구현 착수 전 spec 선행 변경 + Rationale 기록") 위반이 된다.
- **제안**: Phase B 구현 착수 전 `4-execution-engine.md §Rationale` 에 "turn-단위 park 채택" 항을 추가한다. 포함 내용: (1) 기존 "대화 전체 = 단일 waiting_for_input 코루틴" 방식과의 차이, (2) 채택 근거 — 메모리 bounded + slow-path 일원화 정합, (3) 기각 대안 — "단일 waiting 유지 + 코루틴 누적 수용"(재개 latency 최소, 추론 단순하지만 park 수 증가 시 메모리 위험) vs "turn 경계마다 해제 + rehydration"(수용). Plan 이 이미 "Phase B 선행 의무"로 명시했으므로 이는 규약 충돌이 아니라 미이행 상태 확인이다.

---

### [INFO] §4.x "현재 재개 경로와 알려진 한계" 배너가 Phase B 이후에도 유효성 유지 필요

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` 구현 메모 배너  
  > "park 후 runExecution 코루틴은 in-process 로 살아 있어, 같은 프로세스가 재개를 받으면 무손실 fast-path(in-memory pendingContinuations resolve)로 이어진다. … 한편 유저 입력 시점이 불확실해 park 코루틴이 누적되면 메모리 압박 위험이 있으므로 'park 즉시 코루틴 해제 + slow-path 일원화' 로의 전환을 추진한다"
- **과거 결정 출처**: 동일 §4.x 배너의 "전환을 추진한다" 문구 및 plan Phase B 결정
- **상세**: 이 배너는 "현재는 코루틴이 살아 있다"는 현행 구현 상태를 서술하는 동시에 Phase B 전환 의지를 밝힌다. Phase B 완료 후 이 배너를 정리하지 않으면 "코루틴이 in-process 로 살아 있다"는 사실-오류가 spec 에 잔류한다. 이는 결정 번복이 아니라 Phase B 이후 spec 동기화 의무에 해당한다.
- **제안**: Phase B PR 의 spec 변경 체크리스트에 "§4.x 구현 메모 배너 — fast-path/coroutine-alive 문구를 Phase B 완료 후 현실(park 즉시 해제 + slow-path 일원화) 로 교체" 항목을 추가하도록 plan 에 명시한다.

---

### [INFO] A2b(information_extractor checkpoint) — "ai_agent 한정" 문구 3곳의 Rationale 갱신 선행 필요

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md §A2b`  
  > `4-execution-engine.md §1.3 L111` · `3-information-extractor.md L357` · `1-ai-agent.md L703` 세 곳의 "ai_agent 한정" 문구
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존"` 마지막 항  
  > "초기 도입은 재구성기·allow-list 를 ai_agent shape 에 맞춰 ai_agent 한정으로 출하하고 일반화를 후속 작업으로 남겼다."
- **상세**: Rationale 가 "ai_agent 한정은 후속 일반화를 전제한 초기 결정"임을 이미 기록하고 있어, A2b 가 이를 IE 로 확장하는 것은 Rationale 의 기대 방향과 일치한다. 그러나 A2a 완료 기준(PR-A2a, commit `7c32712f`)을 보면 checkpoint 견고화는 `ai_agent` + `information_extractor` 지원을 명시했으나, plan A2b 가 분리된 채로 spec 의 "ai_agent 한정" 문구 3곳이 아직 갱신되지 않은 상태라면, 구현이 spec 의 "한정" 문구보다 앞서 나가는 drift 가 발생할 수 있다. 기각된 대안 재도입은 아니지만, A2b 구현 착수 전 문구 3곳 갱신 + Rationale 확장 선행이 필요하다.
- **제안**: A2b 구현 착수 시 "ai_agent 한정" 문구 3곳을 IE 포함으로 갱신하고, Rationale 의 해당 항에 "A2b 에서 IE 로 확장 완료" 사실을 append 한다. (이미 plan 이 이를 명시했으므로 실행 체크리스트 확인에 해당.)

---

## 요약

검토 범위(`spec/5-system/`) 내의 기존 Rationale 와 진행 중인 plan(`exec-park-durable-resume.md`) 사이에서 CRITICAL 수준의 충돌(기각된 대안의 무근거 재도입, 합의된 invariant 위반)은 발견되지 않는다. 두 개의 WARNING 이 있다. 첫째, `§7.4 Worker 동작` 행이 Rationale 가 명시적으로 기각한 sticky fast-path 와 혼재하는 표현을 유지하고 있으며, plan 이 Phase B 구현 전 spec 동기화를 의무로 명시했음에도 해당 행이 아직 갱신되지 않은 상태다. 둘째, D4(turn-단위 park) 채택 Rationale 가 plan 의 "Phase B 착수 전 선행 의무"로 지정되어 있으나 현재 spec 에 미기록 상태다 — Phase B 구현이 이 Rationale 없이 진행되면 "결정 번복 시 새 Rationale 를 함께 작성" 규약을 위반한다. 두 INFO 항목은 Phase B/A2b 완료 시 동기화할 spec 잔존 표현에 관한 사전 경고다.

---

## 위험도

MEDIUM
