# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

- **[WARNING]** `retry_last_turn` 재진입의 "active-running 직렬화 불변식 재검증" 의무가 한 번
  PASS 로 닫혔다가 지금 다시 CRITICAL 로 뒤집혔는데, 그 반전이 target spec·완료 plan
  어디에도 기록되지 않는다
  - **target 위치**: `spec/5-system/4-execution-engine.md:425`(§4.1 PR1 구현 메모,
    "active-running 직렬화 불변식 (PR2a)" 각주 — "**PR2b+ 재진입 경로(예: `retry_last_turn`
    으로 동시 active 세그먼트가 가능해지는 설계)가 추가되면 이 불변식이 깨질 수 있으므로
    PR2b 착수 전 재검증한다**") 및 `:1372`(§Rationale "§4.2 active-running 직렬화 불변식
    재검증" — 이 항목은 crash re-drive(§7.1/§7.5 case B)만 재검증했고 `retry_last_turn`
    은 언급조차 하지 않는다)
  - **관련 plan**:
    - `plan/complete/exec-intake-queue-impl.md:57-65` — 2026-06-06 "재검토 완료" 로 정확히
      이 의무를 **PASS 판정**하며 종결했다: *"중첩 durable resume(D6)·turn-park(D4)·
      `retry_last_turn` 모두 선형 in-process 재귀 + jobId 멱등 → 동일 Execution 동시 active
      세그먼트 없음"*, *"→ 재검토 완료(2026-06-06...): full B3(단일 BullMQ enqueue 경로)로
      동일 Execution 동시 active 세그먼트 불가 — 직렬화 불변식 통과 확인"*.
    - `plan/in-progress/retry-turn-terminal-guard.md` "5차 라운드 이후 위생 정리" 통합
      목록 #1(P1, `applyRetryLastTurn` 재진입 가드를 원자 claim 으로 전환 — 1R WARNING →
      **5R CRITICAL 승격**) — 2026-07-28 `--route=all` ai-review 가 바로 그 "동시 active
      세그먼트" 를 실측 재현했다: *"두 concurrent 흐름이 락 없는 인스턴스-로컬
      `ExecutionContext`(Map) 를 공유해 대화 상태(messages/turnCount) 훼손, 중복 LLM
      호출·과금, downstream 실 부수효과 도구(Cafe24/MakeShop/MCP) 중복 실행"*. 트리거로
      BullMQ stalled-job 복구·`CONTINUATION_WORKER_CONCURRENCY` 상향·multi-instance 중복
      job 발행을 명시.
  - **상세**: spec §4.1(:425)이 스스로 건 "PR2b+ 재진입 경로 추가 시 재검증" 의무는
    2026-06-06 에 한 번 이행되어 "PASS"(불변식 유지)로 판정되고 `plan/complete/` 로
    이동했다. 그 판정의 근거였던 "retry_last_turn = 선형 in-process 재귀 + jobId 멱등"
    전제는, 그 이후 `spec/5-system/4-execution-engine.md:1664` 의 "engine→Retry 순환 DI
    제거"(후속 ④, 2026-06-19, PR #638 — `retryLastTurn`/`applyRetryLastTurn` 을 엔진에서
    분리해 `continuation-execution.processor.ts` 가 별도 continuation job 으로 외부
    호출하도록 재배선)로 무너진 것으로 보인다. 실제로 지금 진행 중인
    `retry-turn-terminal-guard.md` 의 5R 리뷰가 `applyRetryLastTurn` 재진입 가드
    (`spawnedRow.status !== RUNNING`)가 원자 claim 이 아니며, `continuation-execution.
    processor.ts` 가 이 타입만 명시적으로 원자 claim(`claimResumeEntry`) 대상에서 제외한다는
    사실을 grep/git blame 으로 재확인해 CRITICAL 로 승격시켰다 — 이는 2026-06-06 검토가
    "없다" 고 결론지었던 바로 그 레이스다. 그럼에도:
    1. target spec 의 §4.1(:425)/§Rationale(:1372 인접)은 여전히 "재검증**한다**"(미래형)
       만 적혀 있어, 한 번 PASS 로 닫혔던 이력·그 판정이 이후 리팩터로 무효화된 경위가
       전혀 드러나지 않는다.
    2. 완료된 `exec-intake-queue-impl.md` 의 "PASS(직렬화 불변식 통과 확인)" 서술도
       정정되지 않은 채 남아 있다.
    3. 지금 그 결함을 실제로 고치는 `retry-turn-terminal-guard.md` 의 P1 항목·
       project-planner 위임 목록(§8/§9 를 가리키는 포인터) 어디에도 이 spec 각주(:425/
       :1372)를 갱신 대상으로 등재하지 않았다.
    P1 코드 수정이 머지돼도 spec 은 계속 "PR2b 착수 전 재검증 필요" 를 이미 실현된 위험이
    아니라 미해결 미래형으로 서술하게 되고, 향후 리뷰가 `exec-intake-queue-impl.md` 를
    근거로 "이미 검증된 안전한 경로" 라고 재신뢰할 위험이 남는다 — 이 저장소가 §6~§8
    위임 항목에서 반복 지적해 온 "라벨과 본문 불일치" 재발 클래스와 동형이다.
  - **제안**: `retry-turn-terminal-guard.md`(또는 P1 을 실제로 구현하는 PR)의
    project-planner 위임 목록에 "`spec/5-system/4-execution-engine.md` §4.1(:425)·
    §Rationale(:1372 인접)의 'PR2b+ 재진입 경로 재검증' 각주를 `retry_last_turn` 원자
    claim 적용 완료로 갱신 + `exec-intake-queue-impl.md`(2026-06-06)의 'PASS' 판정이
    이후 DI 리팩터(#638, 2026-06-19)로 무효화됐음을 번복(반증) 기록" 항목을 추가할 것.
    `#8`(park 무효과 서술 철회)이 이미 정립한 "옛 서술 철회 + 커밋 해시 앵커링" 패턴을
    그대로 재사용하면 된다 — 발견 자체는 코드 fix 와 별개로 spec/plan 갱신만으로 닫을 수
    있다.

- **[INFO]** 인접하지만 이번 작업을 막지 않는 미해결 항목 — 재확인 결과 충돌 없음
  - `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 최상단
    (a)/(b) 택일 결정(SIGTERM/timeout 유발 abort 의 `cancelled` vs `failed` 분류)은 여전히
    미결(`owner: project-planner`, `worktree: (unstarted)`)이나, 이 결정은
    `ShutdownStateService`(bulk UPDATE) 경로를 다루고 `applyRetryLastTurn` 원자 claim
    (조건부 UPDATE `WHERE status='running'`) 과는 다른 코드 경로라 이번 target 변경과
    직접 충돌하지 않는다. 같은 문서의 `#9`(경량 정밀도 2건, `6-websocket-protocol.md:375`·
    `3-workflow-editor/3-execution.md §4` Force 서술)도 여전히 미체크 상태이나 이번
    atomic-claim 작업과 무관한 별도 백로그다 — 참고용으로만 기록.

## 요약

target(`spec/5-system/`, 특히 `4-execution-engine.md`)은 developer 가 spec 을 쓰지 않는
현재 상태를 정확히 반영하고 있어(§1.1 원자성 보장 문단이 `retry_last_turn` 재진입 claim 을
명시적으로 배제, §7.4 표가 "WAITING_FOR_INPUT 사전검증을 거치지 않는다" 고 정확히 서술) 이번
--impl-prep 시점에 target 이 plan 의 미해결 결정을 일방적으로 무시하거나 우회하는 지점은
없었다. 다만 spec 자신이 2026-05~06 무렵 심어둔 "PR2b+ 재진입 경로(retry_last_turn) 추가 시
active-running 직렬화 불변식을 재검증하라" 는 의무가 한 번(2026-06-06, `exec-intake-queue-
impl.md`) PASS 로 닫혔다가, 그 근거 전제가 이후 DI 리팩터(#638)로 무너지면서 지금
`retry-turn-terminal-guard.md` 의 P1(5R CRITICAL 승격)으로 사실상 재발했다 — 그런데 이 반전이
spec 각주에도, 완료 plan 에도, 지금 그 결함을 고치는 in-progress plan 의 위임 목록에도 반영돼
있지 않다. 코드 fix 방향 자체(조건부 UPDATE + affected 패턴 재사용)는 이미 사용자 승인된
선례(refactor 06 C-2, Option A)를 따르므로 새 결정 합의가 필요하지는 않지만, P1 이 머지되는
시점에 이 spec 각주와 완료 plan 의 stale PASS 서술을 함께 정정하지 않으면 "실현된 위험이
spec 에는 미해결 미래형으로 남는" drift 가 고착된다.

## 위험도

MEDIUM
