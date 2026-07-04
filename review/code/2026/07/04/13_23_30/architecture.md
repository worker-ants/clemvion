# Architecture Review — PR4 (BullMQ stalled-job 자동 재배달)

리뷰 대상: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`,
`spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md` (5개 spec 문서, 모두 PR3→PR4 전환을 반영하는
문서 갱신). 코드 diff 자체는 이번 payload 에 포함되지 않았으나, 문서가 서술하는 설계(두 트리거 병존 —
부팅 backstop `recoverStuckExecutions` + 운영 중 BullMQ native stalled 재배달)를 아키텍처 관점에서 검토했다.
`execution-engine.service.ts`(`finalizeStalledExhausted`/`redriveStuckExecution`/`recordRunningSegmentStart`)의
실제 존재를 codebase 에서 대조 확인해 spec-코드 정합성도 함께 점검했다.

## 발견사항

- **[INFO]** 두 크래시 복구 트리거(부팅 backstop vs 운영 중 stalled)가 동일 재구동 로직(§7.5 case B)으로
  수렴하는 설계는 좋은 추상화 재사용 사례
  - 위치: `spec/5-system/4-execution-engine.md` §7.1 표 "부팅 backstop 재개" / "mid-operation 크래시 검출" 행,
    `spec/data-flow/3-execution.md` §3.3 표
  - 상세: 두 개의 서로 다른 트리거(BullMQ 네이티브 stalled 검출 vs 부팅 시 폴링 스캔)가 `rehydrateContext` +
    `runNodeDispatchLoop`(§7.5 case B)라는 단일 재구동 파이프라인을 공유하도록 설계했다. 트리거 계층
    (인프라 이벤트 소스)과 재구동 로직(비즈니스 규칙)을 분리해, 신규 트리거 추가 시 재구동 로직을 건드리지
    않아도 되는 개방-폐쇄 원칙에 부합하는 구조다. 두 트리거의 담당 영역도 상호 배타적으로 명확히 분리했다
    (stalled job 존재 케이스 vs job 자체 소실 케이스) — 책임 경계가 문서상 명료하다.
  - 제안: 없음 (설계 강점으로 기록).

- **[INFO]** 좁은 이중 마감(double-finalize) 레이스 — 두 트리거의 동시 활성 시 조건부 UPDATE 로 완화되나
  완전 배제는 아님
  - 위치: `spec/5-system/4-execution-engine.md` "PR4 — BullMQ stalled 자동 재배달" 섹션 마지막 항목
    ("잔여 zombie race"), §7.5 case B 원자 re-claim 각주
  - 상세: 문서가 스스로 인정하는 바, `finalizeStalledExhausted`(stalled 소진 dead-letter 마감)와 부팅
    backstop `recoverStuckExecutions` 의 재-claim 이 겹치는 극히 좁은 시간창에서, 조건부 UPDATE
    (`WHERE status='running'`)가 정상 재구동을 `WORKER_HEARTBEAT_TIMEOUT` 으로 오판할 수 있다. 두 개의
    독립된 "누가 이 Execution 을 소유하는가" 판정 경로(BullMQ job lock 기반 vs `started_at` 컬럼 기반)가
    공유 상태(`Execution.status`)에 대해 서로 다른 락 메커니즘으로 경쟁하는 구조라, fencing token 없이는
    구조적으로 재발 가능한 클래스의 문제다. 문서는 이를 "current fail-path 와 동일 노출이라 신규 회귀
    아님"으로 정당화하고 세그먼트-start/owner-token 영속을 향후 candidate 로 defer 했다.
  - 제안: 현재 스코프에서는 수용 가능한 trade-off 로 보이나, 두 메커니즘이 공유하는 소유권 자원
    (`Execution.status='running'`)에 대해 단일 소유권 원천(예: owner-token 컬럼)을 두는 후속 리팩터를
    이미 스스로 예고했으므로 그 후속 작업이 실제로 이어지는지 plan 추적 필요.

- **[INFO]** `execution-run` 큐와 `execution-continuation` 큐 간 재구동 정책 비대칭 — 의도적 분리이나
  향후 코드 확장 시 두 큐 정책이 계속 따로 진화할 위험
  - 위치: `spec/5-system/4-execution-engine.md` §9.2 큐 표 (`execution-run`: `attempts:1, maxStalledCount:1`
    vs `execution-continuation`: `RESUME_BULLMQ_ATTEMPTS`(기본 3), `maxStalledCount` 명시 없음)
  - 상세: 두 큐 모두 "크래시한 active 세그먼트 재개"라는 동일 도메인 개념을 다루지만, 재시도/재배달 정책
    파라미터가 큐마다 별도 상수(`maxStalledCount:1` vs `RESUME_BULLMQ_ATTEMPTS`)로 하드코딩되어 있다.
    이는 결합도 관점에서는 낮은 결합(두 큐가 서로를 알 필요 없음)이지만, "크래시 세그먼트 재배달 상한"이라는
    같은 정책 축이 두 곳에 흩어져 있어 향후 정책 변경(예: 상한 통일) 시 두 지점을 함께 수정해야 하는
    응집도 저하 여지가 있다.
  - 제안: 현재는 큐별로 성격이 달라(첫 세그먼트 vs 재개 세그먼트) 분리가 타당하다고 판단되나, 정책값을
    한 곳(`execution-limits.ts` 류)에 모아 문서화하는 것을 고려할 수 있다. 이번 PR 범위에서 블로킹 사유는
    아님.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 에러 코드의 "의미 재정의"가 명명 규약과 약간 긴장 관계
  - 위치: `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리, `WORKER_HEARTBEAT_TIMEOUT` 행
  - 상세: `conventions/error-codes.md` §1/§2 는 "코드 rename 은 breaking, 의미가 갈라지면 새 코드를 신설"을
    원칙으로 삼는다. 그런데 `WORKER_HEARTBEAT_TIMEOUT` 은 PR1~PR2("30분 절대 stale") → PR3(미발동) →
    PR4("stalled 재배달 attempts 소진")로 트리거 조건의 **의미가 세 번 바뀌었음에도** 코드명은 그대로
    유지됐다. 문서 자체가 이 예외를 historical-artifact 레지스트리(§3)에 명시적으로 등재해 원칙과의
    긴장을 인지하고 정당화하고 있어(클라이언트가 이미 이 코드값으로 분기하는 breaking 비용 vs 이름
    부정확성), 설계 판단으로는 합리적이다.
  - 제안: 현재 처리(레지스트리 등재 + 근거 기술)로 충분. 향후 또 의미가 갈라질 경우엔 신규 코드 신설
    쪽으로 기울 것을 권고하는 정도.

- **[INFO]** 문서 간 교차 참조 정합성 양호
  - 위치: 5개 파일 전반 (`spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.5/§9.2, `spec/data-flow/3-execution.md`
    §1.1/§3.1/§3.3, `spec/conventions/error-codes.md` `WORKER_HEARTBEAT_TIMEOUT` 행, `spec/5-system/3-error-handling.md`
    §1.4)
  - 상세: "PR3 부팅 backstop 은 은퇴하지 않고 PR4 이후에도 병존"이라는 핵심 아키텍처 결정이 5개 파일
    전체에서 일관되게 서술되어 있다(용어·트리거 조건·병존 근거 모두 동일). SoT 분리(카탈로그 vs 명명
    규약 vs data-flow 요약)도 각 문서가 서로를 참조하며 중복 없이 유지된다. 순환 참조나 모순되는 서술은
    발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `exec:run:seq` Redis 키 관련 서술 정정 — 과거 "PR4 활성화" 예고가 스스로 뒤집힘
  - 위치: `spec/5-system/4-execution-engine.md` §9.2 `exec:run:seq:<executionId>` 행
  - 상세: 이전 버전은 "BullMQ re-enqueue(crash 재개)가 도입되는 PR4 에서 jobId 를 `<executionId>:run:<seq>`
    로 확장할 때 활성화"라고 예고했으나, 실제 PR4 구현은 네이티브 BullMQ stalled(같은 jobId 재처리, 신규
    enqueue 아님)를 채택해 이 키가 여전히 미사용으로 남았다. 이는 나쁜 설계가 아니라 오히려 **더 단순한
    메커니즘 채택**(seq 기반 dedup 인프라 도입을 회피)이며, 문서가 이 방향 전환을 투명하게 기록한 점은
    양호하다. 다만 과거 예측이 빗나간 이력이 반복되면(§9.2 표에 "PR4 활성화" 예고 → 실제로는 "미래 예약"
    으로 재차 defer) 문서의 예측성 서술 신뢰도가 낮아질 수 있다.
  - 제안: 향후 "PR-N 에서 활성화 예정"류의 확정적 예고보다는, 현재 확정된 스코프만 서술하고 미확정
    사항은 "후속 candidate"로만 표기하는 편이 이번처럼 재정정 이력을 줄일 수 있다(경미한 문서 관행 제안).

## 요약

이번 diff 는 순수 spec 문서 갱신으로, PR3(부팅 backstop re-drive)에 이어 PR4(BullMQ 네이티브 stalled 자동
재배달)가 구현 완료됐음을 5개 문서에 일관되게 반영한다. 아키텍처적으로 가장 중요한 결정 — 두 개의 독립
크래시-복구 트리거를 담당 영역이 겹치지 않도록 분리하되 동일한 재구동 파이프라인(§7.5 case B)으로
수렴시킨 것 — 은 트리거(인프라 이벤트)와 재구동 로직(도메인 규칙)의 관심사 분리가 잘 되어 있고, 개방-폐쇄
원칙에 부합한다. `maxStalledCount:1` 상한으로 blast radius 를 bound 하고 `recoverStuckExecutions` 를
은퇴시키지 않고 backstop 으로 남긴 판단도 리스크 관리 측면에서 타당하다. 유일하게 주목할 지점은 두 소유권
판정 경로(BullMQ job lock vs DB `started_at` 컬럼)가 공유 상태에 대해 별도 락 메커니즘으로 경쟁하는 좁은
레이스인데, 문서가 이를 이미 인지·정당화하고 후속 owner-token 영속 작업을 candidate 로 예고해뒀다. 코드
자체(`execution-engine.service.ts`)의 비대함(약 7400줄, god-service 성향)은 이번 diff 의 범위가 아니고
기존에 별도 refactor 트랙(M-1/C-1)으로 추적 중이므로 본 리뷰의 신규 발견에서는 제외했다. 전반적으로
구조적 결함(CRITICAL/WARNING 등급)은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
