# Rationale 연속성 Check 결과

대상: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` (spec draft, --spec 모드)
비교 대상: `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/1-data-model.md` 의 `## Rationale`

## 발견사항

### [WARNING] `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 §1.4 "엔진 수준 에러 (execution status → `failed`)" 표에 `cancelled` 결과로 삽입

- target 위치: target 문서 `### 3-error-handling.md §1.4 + conventions/error-codes.md §3` 절 — "신규 `EXECUTION_QUEUE_WAIT_TIMEOUT` — 엔진 레벨, 큐 대기 5분 초과 → execution `cancelled`"
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.4 표 도입부(라인 70) "엔진 수준 에러 (execution status → `failed`)" — 해당 표의 현재 8개 행(`EXECUTION_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED`/`WORKER_HEARTBEAT_TIMEOUT`/`RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED`/`INVALID_EXPRESSION`/`VARIABLE_NOT_FOUND`/`TYPE_MISMATCH`/`ERROR_PORT_FALLBACK`)은 전부 `failed` 귀결이다. `cancelled` 귀결 코드(`RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE`)는 이미 spec 안에 존재하지만 **별도 섹션인 §1.5 "WS commands 에러 코드"** 표에 등재되어 있다 — 즉 spec 은 이미 "`failed` 계열 = §1.4, `cancelled` 계열 = §1.5(또는 별도 표)" 로 섹션을 구분해 온 선례가 있다.
- 상세: target 은 새 `cancelled` 귀결 코드를 기존에 "failed 전용" 으로 문서화된 §1.4 표에 그대로 추가하려 한다. 이는 §1.4 표 자체의 스코프 선언과 충돌하며, 표 도입부 문구("execution status → `failed`")를 함께 갱신하지 않으면 문서 내부 모순이 생긴다(§1.4 를 읽는 사람은 "이 표의 모든 코드는 실패로 귀결" 이라고 신뢰하게 되는데 실제로는 예외가 하나 생김). 또한 §1.5 의 `RESUME_*` 계열과 나란히 두지 않고 §1.4 에 편입하는 이유(엔진 자체 발행 vs WS ack 발행의 레이어 차이 등)에 대한 설명이 target 에 없다.
- 제안: 다음 중 하나를 명시적으로 선택해 target 에 반영.
  1. §1.4 표 도입부 문구를 "execution status → `failed` (일부 §8 큐 대기 초과 등은 `cancelled`)" 로 갱신하고, 표에 "귀결 상태" 컬럼을 추가하거나 해당 행에 각주를 단다.
  2. `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 §1.4 밖의 별도 서브섹션(예: "엔진 레벨 cancelled 코드")에 두어 §1.4 의 "전부 failed" 불변식을 보존한다.
  어느 쪽이든 **새 Rationale 항목**("큐 대기 초과가 `failed` 계열 표에 있으나 예외적으로 `cancelled` 인 이유")을 §Rationale 에 추가해 향후 독자가 표 스코프 위반으로 오인하지 않게 한다.

### [INFO] "§4.2 invariant ... via full B3" 인용의 출처 부정확 — 실제 근거는 `jobId=executionId` dedup + PR3 재검증(잔여 zombie race 인지)

- target 위치: target 문서 `### 4-execution-engine.md §8` 절 — "stalled 재배달(§7.1 PR4)·park 재개(§7.5)는 이미 RUNNING/재진입이라 cap 재심사 skip(§4.2 직렬화 불변식과 정합 — 동일 Execution 동시 active 세그먼트 불가)"; 오케스트레이터 payload 의 핵심 결정 요약도 "§4.2 invariant ... via full B3" 로 인용
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.2 PR1 구현 메모("active-running 직렬화 불변식 (PR2a)" — `jobId=executionId` dedup 이 근거이지 "full B3" 가 아님) + §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive"(§4.2 재검증 항목 — "**§4.2 active-running 직렬화 불변식 재검증** (필수 이행)" 이 실제 수행되어 "**잔여 race**: 원 워커가 실은 살아있는 zombie 면 stale 판정으로 두 세그먼트가 동시 구동될 수 있다" 를 명시적으로 인정하고 있음(bounded, 회귀 아님으로 결론).
- 상세: "full B3" 는 park-resume 경로에서 in-memory 재개 머신(pendingContinuations 등)을 제거해 재개가 항상 rehydration 단일 경로로 가게 한 결정으로, **park 재개(waiting_for_input)** 에 적용되는 개념이다. 반면 stalled-redelivery/crash re-drive 는 `RUNNING` 상태 세그먼트의 재진입이라 완전히 다른 메커니즘(§7.1/§7.2/§7.3 — `jobId` dedup + `started_at` 조건부 re-claim)의 적용을 받는다. target 이 두 근거를 뭉뚱그려 "via full B3" 로 인용한 것은 부정확하다. 실질 결론(cap 재심사 skip) 자체는 옳다 — stalled-redelivery/park-resume 모두 **새로운 admission(PENDING→RUNNING)이 아니라 기존에 이미 cap 카운트에 반영된 RUNNING 세그먼트의 연속**이므로 cap 을 다시 세지 않는 것이 구조적으로 맞다. 다만 그 근거로 "동시 세그먼트 불가능(불변식)" 만 인용하고 PR3 Rationale 이 이미 인정한 **잔여 zombie race**(불변식이 100% 가 아니라 bounded 라는 사실)를 언급하지 않으면, PR2b 리뷰어가 "cap 재심사 skip 근거가 절대적 불변식" 이라고 오독할 위험이 있다.
- 제안: target 의 Rationale 절에 인용을 "§4.2 `jobId=executionId` dedup 불변식(PR3 재검증 완료, 잔여 zombie race 는 bounded — §Rationale '크래시/재시작 RUNNING 세그먼트 제어된 re-drive')" 로 정정. 결론(cap 재심사 skip) 은 변경 불요 — zombie race 가 실현돼도 cap 초과가 아니라 "같은 Execution 이 중복 카운트되거나 안 되거나" 문제라 §8 cap 정책과는 직교이므로, 인용 정확도만 개선하면 된다.

### [INFO] priority 3-tier 분리 결정은 기존 spec 선례와 완전 정합 — 문제 없음(확인용 기록)

- target 위치: target 문서 배경·스코프 절 + Rationale "priority 3-tier 분리"
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.1 PR1 구현 메모(라인 379, 411) — "**§8 동시성 cap·우선순위 3-tier(webhook/schedule 세분화)는 여전히 Planned (PR2b)**", "`Trigger.type` 어휘 기반 3-tier ... 는 PR2(triggerType threading) 예정"
- 상세: target 이 priority 3-tier 를 별도 PR 로 미루는 결정은 기존 spec 이 PR1 시점부터 이미 "PR2 예정" 으로 명시해 둔 것과 정확히 일치한다. 기각된 대안 재도입이나 원칙 위반 없음.
- 제안: 없음 (참고용 confirmation).

### [INFO] admission gate consumer-side 결정은 기존 아키텍처 원칙과 정합

- target 위치: target 문서 Rationale "admission gate = consumer-side"
- 과거 결정 출처: `spec/0-overview.md` §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀" — `execute()` 는 항상 pending enqueue 하고 consumer(work-stealing worker)가 처리하는 always-enqueue 모델
- 상세: target 의 "producer(`execute()`)는 항상 pending enqueue, cap 검증은 consumer(`runExecutionFromQueue`)가 원자 수행" 결정은 기존 §4.1 아키텍처("`execute()` 는 ... 즉시 반환") 및 0-overview.md 의 always-enqueue 원칙과 자연스럽게 정합한다. 새 대안 도입이며 과거에 기각된 바 없다.
- 제안: 없음.

## 요약

target 의 4개 핵심 결정 중 (1) admission gate consumer-side, (4) priority 3-tier 분리는 기존 spec Rationale·아키텍처 원칙과 완전히 정합하며 기각된 대안의 재도입이나 원칙 위반이 없다. (3) cap check skip on stalled-redelivery/park-resume 은 실질 결론(재진입 경로는 새 admission 이 아니므로 cap 재심사 불필요) 자체는 §7.1~§7.3 의 "RUNNING 재진입은 새 세그먼트가 아니라 기존 세그먼트의 continuation" 모델과 부합해 타당하나, 그 근거로 인용한 "§4.2 불변식 via full B3" 는 실제로는 park-resume 전용 개념을 혼용한 부정확한 인용이며, PR3 Rationale 이 이미 인정한 "bounded zombie race" 잔존 사실을 누락해 근거가 과신될 소지가 있다(INFO, 인용 정정 권고). 가장 중요한 발견은 (2) — `EXECUTION_QUEUE_WAIT_TIMEOUT`(cancelled 귀결)를 §1.4 "엔진 수준 에러 (execution status → `failed`)" 로 명시 스코프된 표에 그대로 얹으려는 계획으로, 이는 spec 이 이미 §1.4(failed)/§1.5(cancelled, RESUME_* 등)로 섹션을 구분해 온 기존 문서 구조 관례와 충돌한다 — 결정 자체(큐 대기 초과=cancelled)는 새로운 합리적 결정이라 문제 없으나, 배치 위치가 표의 자체 선언과 모순되므로 표 도입부 갱신 또는 별도 서브섹션 분리 + 새 Rationale 항목 추가가 필요하다.

## 위험도

MEDIUM
