# Cross-Spec 일관성 Check — `spec/data-flow/3-execution.md` §1.1 `alt` 3-way 반영

## 검토 대상
- target: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` (spec_impact: `spec/data-flow/3-execution.md`)
- 변경 범위: §1.1 mermaid 시퀀스 다이어그램의 `alt` 블록을 2-way → 3-way 로 확장 (순수 drift 정정, 코드 무변경 주장)

## 대조한 spec 영역
- `spec/5-system/4-execution-engine.md` §7.1 (워커 크래시 복구 — BullMQ stalled-job), §7.2 (체크포인트 기반 Resume), §7.3 (멱등성), §7.5 (Resume after Restart / rehydration case A·B), §Rationale ("네이티브 stalled = 같은 jobId 재처리 → seq/re-enqueue 불요" — 명시적으로 "PENDING=최초 실행, terminal=ack-discard 와 함께 **3-way switch**" 로 기술)
- `spec/data-flow/3-execution.md` §1.1(현재본), §2.2(Redis/BullMQ 스키마 매핑), §3.1(`execution.status` 상태 다이어그램), §3.3(비정상 종료 회수 표)
- `plan/in-progress/exec-intake-queue-impl.md` (target 이 인용한 "line 27 잔여" 항목의 실제 상태)

## 발견사항

검토 결과 CRITICAL/WARNING 없음. 확인된 사항만 기록한다.

- **[INFO]** target 의 3-way 전환이 기존 §7.1/§7.5/§Rationale 과 문언 수준까지 정확히 일치
  - target 위치: `spec-draft-dataflow-exec-seq-3way.md` "변경 (§1.1 mermaid `alt` 블록)" after 블록
  - 대조 대상: `spec/5-system/4-execution-engine.md` line 816, 824, 929, 1317
  - 상세: `spec/5-system/4-execution-engine.md` §Rationale (line 1317) 이 이미 "`runExecutionFromQueue` 는 재처리된 job 의 Execution 이 이미 `RUNNING` 임을 감지해 §7.5 case B 재구동으로 분기한다(PENDING=최초 실행, terminal=ack-discard 와 함께 3-way switch)" 라고 명시한다. target 이 제안하는 `PENDING→run / RUNNING→§7.5 case B redrive / terminal·WFI→ack-discard` 3-way 는 이 문장과 함수명(`recordRunningSegmentStart`, `redriveStuckExecution`)까지 정확히 일치한다. 이 세 함수명은 §7.1(line 816, 824)·§7.5(line 929)·`data-flow/3-execution.md` §3.3(line 293) 에서도 동일하게 사용된다.
  - 결론: 새로 도입하는 서술이 아니라 이미 다른 두 문서(§7.1/§7.5, §3.3)에 존재하는 사실을 §1.1 다이어그램에 뒤늦게 반영하는 것 — cross-spec 모순 없음.

- **[INFO]** §3.1 상태 다이어그램과 `else status ∉ {pending, running}` 분류의 정합성
  - target 위치: after 블록의 두 번째 `else` 분기 "terminal / waiting_for_input"
  - 대조 대상: `spec/data-flow/3-execution.md` §3.1 `execution.status` stateDiagram (line 235-254)
  - 상세: §3.1 이 정의하는 전체 상태 집합은 `pending / running / waiting_for_input / completed / failed / cancelled` 6개. target 의 `{pending, running}` 을 제외한 나머지 4개(terminal 3개 + waiting_for_input)를 "terminal / waiting_for_input" 로 묶은 것은 이 상태 집합을 정확히 빠짐없이 분할한다. 기존 §3.1 은 `running --> running` 전이(line 245, "crash 세그먼트 re-drive")를 이미 3-way 관점으로 기술해 두고 있어 target 변경과 방향이 일치한다.

- **[INFO]** `execution-run` 큐가 `waiting_for_input` 상태 job 을 애초에 stall 시키지 않음 — 두 번째 분기의 "…·park 등" 문구는 사전 재검증(최초 enqueue 시점 cancel) 시나리오만 실질적으로 해당
  - target 위치: after 블록 "else status ∉ {pending, running} (terminal / waiting_for_input — 큐 대기 중 cancel·park 등)"
  - 대조 대상: `spec/5-system/4-execution-engine.md` line 429 ("BLOCK 진입 시… 정상 ack/remove — Execution row 만 waiting_for_input 으로 남는다"), line 1136 (`execution-run` 큐가 stalled 재배달을 다루는 대상은 "아직 running" 인 job 한정, line 293 data-flow §3.3)
  - 상세: BLOCK(park) 시 `execution-run`/`execution-continuation` job 은 정상 ack 되어 사라지므로, stalled-redelivery 경로로 동일 jobId 가 `waiting_for_input` Execution 에 대해 재도착하는 경우는 없다. 즉 이 분기에서 실제 `waiting_for_input` 이 걸리는 경로는 (원래 2-way 시절부터 존재하던) "최초 enqueue 후 아직 pending 상태에서 cancel 등으로 상태가 바뀐" 케이스의 연장이며, target 문구는 이 기존 의미를 그대로 보존한다 — 새로운 의미를 추가하지 않음. 다만 "park 등" 표현이 stalled-redelivery 로 WFI 가 도달할 수 있다는 오해를 유발할 여지는 미미하게 있으나, 원본 2-way 문구("큐 대기 중 cancel 등")를 그대로 확장한 표현이라 정정 필요성은 낮다.

- **[INFO]** `plan/in-progress/exec-intake-queue-impl.md` line 27 잔여 항목과의 정합
  - target 위치: target "배경 (실제 갭)" 문단
  - 대조 대상: `plan/in-progress/exec-intake-queue-impl.md` "SPEC-DRIFT 반영" 섹션의 `[~]` 항목 — "`3-execution.md §1.1/§2.2` mermaid 갱신… **부분완료**: `§2.2` 는 PR2a 반영 완료. **잔여**: `3-execution.md §1.1`"
  - 상세: `spec/data-flow/3-execution.md` §2.2 (Redis/BullMQ 스키마 매핑, line 200-206) 를 직접 읽어 확인한 결과 이미 `maxStalledCount:1 (PR4 — stalled 1회 자동 재배달 → §7.5 case B 재구동)` 이 반영되어 있음 — plan 의 "부분완료" 기술과 일치. §1.1 만 미반영 상태였다는 target 의 주장도 실측과 일치. target 이 이 항목을 closed 처리하겠다는 side-effect 계획은 타당.

- **[INFO]** 동일 2-way `alt` 블록의 중복 존재 여부
  - 상세: `grep -rl` 로 spec 트리 전체를 검색한 결과 이 2-way `status !== pending` 블록은 `spec/data-flow/3-execution.md` 에만 존재 — 다른 문서에 동일 다이어그램의 stale 사본이 남아 있지 않으므로 이번 변경만으로 drift 가 완전히 해소된다.

- **[INFO]** mermaid 문법 정합
  - 상세: 동일 파일 §1.2(line 88-104)에 이미 4-way `alt/else/else/else/end` 블록이 존재해 nested `else` 패턴의 전례가 있다. target 의 3-way `alt/else/else/end` 구조는 이 전례와 문법·스타일 모두 일치한다.

## 요약

target 은 신규 설계가 아니라 이미 `spec/5-system/4-execution-engine.md` §7.1/§7.5/§Rationale 과 `spec/data-flow/3-execution.md` §2.2/§3.1/§3.3 에 반영되어 있는 PR4 3-way 분기(PENDING→run / RUNNING→§7.5 case B redrive / terminal·WFI→ack-discard)를 §1.1 시퀀스 다이어그램에만 뒤늦게 정합화하는 문서 내부 drift cleanup이다. 함수명(`recordRunningSegmentStart`/`redriveStuckExecution`)·상태 집합 분할·mermaid 문법 모두 기존 SoT 문서들과 정확히 일치하며, 다른 영역(§0-overview, §1-data-model 등)의 데이터 모델·API 계약·RBAC·요구사항 ID 와도 충돌 지점이 없다. `exec-intake-queue-impl.md` 의 잔여 항목 기술과도 실측이 일치해 plan-hygiene 처리도 타당하다.

## 위험도
NONE

---
BLOCK: NO
- Critical: 없음
- Warning: 없음
- (참고, 비차단 INFO) §1.1 두 번째 분기의 "…park 등" 문구는 stalled-redelivery 로 WFI 진입 가능하다는 오독 여지가 미미하게 있으나 원본 2-way 문구를 그대로 계승한 것이며 §7.1/§4(line 429, ack/remove) 과 실제로 모순되지 않으므로 수정 불요.

STATUS: SUCCESS
