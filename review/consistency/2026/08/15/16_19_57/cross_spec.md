# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

실제 diff(`git diff origin/main...HEAD`)를 확인한 결과, `spec/5-system/` 아래 target 변경은
`spec/5-system/4-execution-engine.md` §7.1 mid-operation stalled 트리거 문단에 **한 문장 추가**뿐이다:

> `finalizeStalledExhausted`(BullMQ stalled 재배달 소진 → `WORKER_HEARTBEAT_TIMEOUT` 마감)의
> Execution `FAILED` UPDATE 와 자식 RUNNING `NodeExecution` cascade UPDATE 를 `dataSource.transaction`
> 단일 트랜잭션으로 묶었다(2026-08-15). 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 은
> 이미 원자적이었고 이 경로만 autocommit 2단계로 열려 있었다.

대응 코드 변경은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
`finalizeStalledExhausted` 뿐이며, 신규 엔티티·필드·endpoint·요구사항 ID·RBAC·상태값은 도입하지
않는다(기존 `running → failed` 전이·`WORKER_HEARTBEAT_TIMEOUT` 코드 그대로, DB write 순서/조건
(`affected=0` no-op)도 그대로 — 트랜잭션 경계만 달라짐).

## 교차 검증

1. **자매 함수 원자성 주장의 사실 확인** — `cancelParkedExecution`(L1023~)·`markWebChatIdleTimeout`
   (L1152~)을 워킹트리에서 직접 열어 확인: 둘 다 이미 `this.dataSource.transaction(...)` 로 2-UPDATE
   를 묶고 있다. target 문서가 "자매는 이미 원자적이었다"고 쓴 서술과 코드가 일치 — 사실 오류 없음.

2. **§1.1 원자성 보장 원칙과의 정합** — `4-execution-engine.md` §1.1 은 "`Execution`+`NodeExecution`
   짝 상태 변경은 단일 DB 트랜잭션으로 묶는다"를 이미 SoT 원칙으로 선언하고 있다(예: `claimResumeEntry`,
   `updateExecutionStatus`). 이번 변경은 그 원칙을 유일하게 어기고 있던 `finalizeStalledExhausted` 를
   원칙에 맞춰 정합화한 것 — 신규 원칙이 아니라 기존 원칙의 적용 범위 완성이며 다른 영역과 충돌하지 않는다.

3. **`WORKER_HEARTBEAT_TIMEOUT` 참조처 전수 확인** — `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`,
   `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`
   (3곳) 모두 이 에러코드를 참조하지만, 트랜잭션 경계까지 서술하는 곳은 없다 — 침묵이지 모순 서술이
   아니므로 CRITICAL/WARNING 대상 아님. (선택적으로 `data-flow/3-execution.md §267` 근처에 "단일 트랜잭션"
   한 줄을 미러하면 좋겠으나 필수는 아님 — 아래 INFO 참고.)

4. **plan 트래커 동기화** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당
   체크박스가 `[x]` 로 갱신되고 `eia-stalled-atomicity` 링크·근거(뮤테이션 3/3 RED)가 남아 있어 plan↔spec
   갭 트래커와도 정합. CHANGELOG 항목도 "수신자 영향 없음"을 명시해 EIA wire 계약(§5.2/§5.3 이벤트
   payload)과 모순되지 않음을 스스로 확인시킨다.

5. **§7.5 case B "zombie race" 각주와의 관계** — `finalizeStalledExhausted` 와 부팅 backstop
   `recoverStuckExecutions` 의 경합(4-execution-engine.md L1466)은 조건부 UPDATE(`WHERE status='running'`)
   수준의 기존 레이스이며, 트랜잭션 래핑은 이 레이스의 관측 가능한 동작(affected=0/1 판정)을 바꾸지
   않는다 — 각주 갱신 불요, 모순 없음.

## 발견사항

없음. (데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두 이번 diff 의 영향
범위 밖이거나, 기존 spec 원칙(§1.1)과 정합.)

### INFO 후보 (비차단, 참고용)

- **[INFO]** `data-flow/3-execution.md` 는 `finalizeStalledExhausted` 를 3곳(L69, L267, L298)에서
  언급하지만 신규 트랜잭션 서술을 미러하지 않는다.
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 (L851)
  - 충돌 대상: `spec/data-flow/3-execution.md` L267 부근 (`WORKER_HEARTBEAT_TIMEOUT` 표)
  - 상세: 모순은 아니고 단순 정보 밀도 차이(data-flow 문서는 5-system 만큼 구현 세부를 싣지 않는
    관례가 기존에도 있음 — 예: 같은 표의 다른 행들도 트랜잭션 경계를 언급하지 않음). 회귀 위험 낮음.
  - 제안: 필수 아님. 후속 편집 시 한 줄("단일 트랜잭션") 미러 고려 가능.

## 요약

target diff 는 `spec/5-system/4-execution-engine.md` 단 한 문단에 대한 좁은 사실 보강(코드가 이미
구현한 트랜잭션 래핑을 문서화)이며, 신규 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임을
전혀 도입하지 않는다. 코드(`finalizeStalledExhausted`, `cancelParkedExecution`,
`markWebChatIdleTimeout`)를 직접 대조해 target 의 "자매는 이미 원자적이었다" 주장이 사실과 일치함을
확인했고, 기존 §1.1 원자성 원칙·plan 트래커·CHANGELOG 와도 정합적이다. 다른 spec 영역(`data-flow/3-execution.md`,
`error-codes.md`, `1-data-model.md` 등)의 `WORKER_HEARTBEAT_TIMEOUT` 참조는 이번 변경과 모순되지 않으며
단순히 이 세부(트랜잭션 경계)를 언급하지 않을 뿐이다.

## 위험도
NONE
