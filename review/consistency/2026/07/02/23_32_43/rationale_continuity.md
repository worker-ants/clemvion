### 발견사항

- **[WARNING] 변경 3 "기존 전이 서술 변경 없음" 선언과 실제 § 1.2 표(L76) 의미 변화 사이 미세 괴리**
  - target 위치: `plan/in-progress/spec-draft-c2-atomic-claim.md` "변경 3 — §1.2 NodeExecution 상태" ("기존 `waiting_for_input → completed`·`waiting_for_input → failed` 전이 서술은 변경하지 않는다")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 L76 "`waiting_for_input → failed` — AI Agent multi-turn turn 처리 중 LLM throw(429/timeout/connection) — `handleAiTurnError` 가 … 직접 finalize" (기각 근거는 동 파일 `## Rationale` L1246–1254, 특히 L1252)
  - 상세: L76 문구는 "turn 처리 중 LLM throw"라고만 되어 있어 최초 turn 과 재개(rehydration) turn 을 구분하지 않는다. 그러나 target 의 claim 설계가 들어오면, 재개된 turn 에서 발생하는 LLM throw 는 이제 claim(`WFI→running`)이 선행 완료된 **이후** `running` 상태에서 발생하므로, 실질적으로 L76 전이(`WFI→failed` 직접) 경로를 **더 이상 타지 않고** 기존 L72 "`running→failed` — 에러 발생" 전이로 흡수된다. 즉 claim 도입 후 L76 의 적용 범위는 "최초 turn 의 LLM throw" 로 축소되는데, target 은 "기존 전이 서술은 변경하지 않는다"고만 선언해 이 적용범위 축소를 표에 반영하지 않는다. rev2 가 애써 확립한 "재서술 없이 gate 만 추가" 원칙(rev1 CRITICAL 해소책)의 취지에는 맞지만, L76 표 문구 자체가 claim 도입 후에는 부정확(과대포괄)해지는 잔여 갭이다.
  - 제안: §1.2 표 L76 행에 "(재개 turn 의 LLM throw 는 claim 선행으로 §Rationale 신규 소절 참조 — `running→failed`(L72)로 처리)" 같은 1줄 각주를 추가해, 표 자체만 봐도 최초 turn/재개 turn 케이스가 분리됨을 알 수 있게 할 것. 현재는 변경 6(§Rationale 신규 소절)에만 이 구분이 있어, §1.2 표만 보는 독자는 오도될 수 있다.

- **[INFO] rev1 CRITICAL(23_23_49) 해소 논증의 정합성 — 확인됨**
  - target 위치: 변경 3/6 및 draft 서두 rev2 노트
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` L1246–1254(L1252 "`WFI→running`후 `running→failed` 2단계 전이는 두 트랜잭션 분리로 원자성이 깨져 기각")
  - 상세: 원문 대조 결과, rev2 는 이전 세션(23_23_49)이 지적한 CRITICAL을 실질적으로 해소했다고 판단된다. (a) claim UPDATE 를 "Execution↔NodeExecution 을 단일 트랜잭션으로 갱신"한다고 명시해 이전 WARNING(#2, 전이 쌍 원자성 불명확)을 충족했고, (b) L1252 가 기각한 것은 "AI turn 실패 **finalization** 맥락"에서의 running hop(당시엔 편익이 전무)이었는데, 본 결정은 재개 진입에 **새 편익**(concurrency race-safety)을 부여하며 claim 자체는 단일 조건부 UPDATE(두 트랜잭션 분리가 아님)라는 점을 정면 인용·논증했다. §1.3 `_retryState` "affected=1 인 쪽만 진행"(L177) 패턴 인용도 원문과 정확히 일치하고, `recoverStuckExecutions`(L899-906, RUNNING 대상), V095 partial index(`1-data-model.md` L840) 인용도 모두 원문과 부합한다. §7.4 Rationale L1376 "재검증 가드"→"원자 claim" 갱신 타겟팅(변경 5)도 정확하다.
  - 제안: 없음(정보성 확인). spec 반영 시 위 WARNING 1건만 보강하면 rationale 연속성 관점에서 남은 리스크는 낮다.

- **[INFO] RESUME_* terminal 인용 범위의 정밀도**
  - target 위치: 변경 1 "claim 획득 후 rehydration 이 실패하면 아래 'Rehydration 실패 케이스'의 `RESUME_*` terminal 로 마감"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` L980-982 (RESUME_CHECKPOINT_MISSING/RESUME_FAILED/RESUME_INCOMPATIBLE_STATE — Execution `cancelled` + NodeExecution `failed`), L1413 "이분 정책"
  - 상세: RESUME_* 3케이스는 rehydration 프로세스 자체(체크포인트 부재/손상/BullMQ attempts 소진)의 실패이며 Execution 은 `cancelled` 로 마감된다 — target 변경 6 이 말하는 "claim 후 running→failed"(LLM turn throw, Execution `failed`)와는 다른 케이스·다른 종결 상태다. target 문면은 이 둘을 같은 문장 안에 병기해("claim 후 rehydration 실패는 RESUME_* / claim 후 LLM throw 는 running→failed") 큰 틀에서는 구분하고 있으나, 변경 1 요약 문구만 읽으면 두 경로가 섞여 보일 위험이 있다.
  - 제안: 변경 1 문구에서 "claim 획득 후 rehydration **프로세스**(체크포인트 로드/재구성) 실패는 RESUME_*, claim 획득 후 **turn 처리** 실패(LLM throw)는 running→failed(§Rationale 신규 소절)"로 두 경로를 표 형태로 명확히 분리해 표기할 것.

### 요약

target(`spec-draft-c2-atomic-claim.md` rev2)은 동일 draft 의 이전 리비전(rev1)이 유발한 Rationale 연속성 CRITICAL(§1.2/§1.1 상태 전이를 "WFI→running→failed 2단계"로 재서술 — `4-execution-engine.md` L1252 가 명시 기각한 대안과 구조 일치)을 인지하고, (a) 기존 finalization 전이 서술을 재서술하지 않고 claim 을 재개 **진입** gate 로만 추가하며, (b) L1252 를 정면 인용해 "편익 맥락 변화(재개 concurrency race-safety) + 원자성 실질 대응(단일 조건부 UPDATE, RESUME_* 원자 마감, recoverStuckExecutions 회수)"을 근거로 "부분 수정"을 명시적 신규 Rationale 로 작성했다. `spec/5-system/4-execution-engine.md`·`1-data-model.md` 원문과 대조한 결과 §1.3 `_retryState` 패턴, `recoverStuckExecutions` RUNNING 대상 범위, V095 partial index, §7.4 L1376 등 모든 구체 인용이 정확했고, 이전 세션이 지적한 CRITICAL/WARNING 은 실질적으로 해소된 것으로 판단된다. 다만 §1.2 상태 전이표 L76("AI Agent multi-turn turn 처리 중 LLM throw" 문구, 최초/재개 turn 미구분)이 claim 도입 후 적용범위가 축소됨에도 표 자체에는 그 구분이 반영되지 않는 잔여 정합 갭이 있어 WARNING 1건으로 기록한다.

### 위험도
LOW
