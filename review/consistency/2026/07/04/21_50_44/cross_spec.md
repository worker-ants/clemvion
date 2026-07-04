# Cross-Spec 일관성 검토 — orphan pending backstop (recoverStuckExecutions 확장)

> **payload 스코프 알림**: 전달된 `_prompts/cross_spec.md` 는 `spec/5-system/1-auth.md` ·
> `10-graph-rag.md` · `0-overview.md` · `1-data-model.md` 번들이었고, 실제 검토 대상인
> `spec/5-system/4-execution-engine.md`(§1.1/§3-error-handling/§7.4/§7.5/§8) 는 payload 에
> 포함되지 않았다(기존 사례와 동일한 impl-done/consistency payload mis-scope). 지시에 따라
> `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`,
> `spec/1-data-model.md`, `spec/data-flow/3-execution.md`, 관련 코드
> (`execution-engine.service.ts`)를 직접 읽어 분석했다.

## 계획 요약 (검토 대상)

`recoverStuckExecutions`(§7.4 boot/backstop 스캔)를 확장해 admission 재큐 BullMQ job 이 소실된
`pending` Execution("orphan pending")도 회수 대상에 포함한다. 스캔 조건
`status='pending' AND queued_at < now - resolveQueueWaitTimeoutMs()` 매칭 row 를 기존
`markQueueWaitTimeout`(status→`cancelled`, `EXECUTION_QUEUE_WAIT_TIMEOUT`,
`cancelledBy='timeout'`, routing release)로 취소한다. 동일 lock(`exec:recover:lock`)·동일
트리거(boot + 테스트훅) 재사용. §8 line 1088 및 §7.4 상태 배너를 "구현 완료"로 갱신 예정.
(`plan/in-progress/orphan-pending-backstop.md` 로 이미 설계 확정 — 본 검토는 그 설계가 spec
전역과 충돌하지 않는지 확인.)

## 발견사항

- **[INFO]** `spec/data-flow/3-execution.md` 가 stale 해질 예정 — 동기 갱신 필요
  - target 위치: 계획 문서상 갱신 대상은 §8/§7.4 (`4-execution-engine.md`) 뿐
  - 충돌 대상: `spec/data-flow/3-execution.md` §3.1 mermaid 상태 다이어그램(라인 245)
    `pending --> cancelled: 큐 대기 중 사용자 cancel — runExecutionFromQueue 가 pending
    아님을 확인해 ack-discard` 및 §3.3 회수 소스 표(라인 291-298) — `recoverStuckExecutions`
    설명이 "대상: `status='running' AND started_at < now() - 30분`" 으로만 기술
  - 상세: 이 문서는 `4-execution-engine.md` 의 **companion data-flow 문서**로, 현재는
    `pending → cancelled` 전이를 "사용자 cancel(ack-discard)" 경로 하나로만 그리고,
    `recoverStuckExecutions` 스코프를 `running` 전용으로 명시한다. orphan pending 회수가
    구현되면 (1) `pending → cancelled` 에 "시스템 타임아웃(EXECUTION_QUEUE_WAIT_TIMEOUT,
    orphan pending backstop)" 신규 사유가 추가되고, (2) §3.3 회수 소스 표의
    `recoverStuckExecutions` 대상 설명(row 298)이 `running` 전용에서 `running` +
    `pending`(orphan) 로 확장돼야 한다. 지금 상태로 두면 두 문서가 서로 다른 회수 범위를
    주장하는 (약한) 모순이 발생한다 — CRITICAL 은 아니다(계획 완료 전까지는 현재 코드
    상태와 두 문서 모두 일치하므로). 하지만 §8/§7.4 갱신과 **같은 PR 안에서** 동기화하지
    않으면 impl 완료 직후 바로 불일치가 발생한다.
  - 제안: `4-execution-engine.md` §8/§7.4 "구현 완료" 갱신과 같은 커밋에서
    `spec/data-flow/3-execution.md` §3.1 다이어그램에 `pending --> cancelled` 두 번째 사유
    (orphan wait-timeout) 라벨 추가 + §3.3 표의 `recoverStuckExecutions` 행 대상 설명을
    "running(§7.5 case B) + pending(orphan wait-timeout, §8)" 형태로 갱신.

- **[INFO]** 계획 서술의 §3-error-handling 섹션 번호 오기 (spec 자체 결함 아님)
  - target 위치: 작업 지시문("§3-error-handling §1.5")
  - 충돌 대상: `spec/5-system/3-error-handling.md` — `EXECUTION_QUEUE_WAIT_TIMEOUT` 실제
    정의 위치는 §1.4(라인 104, "워크플로우 실행 에러" 섹션의 인용구), §1.5(WS commands
    에러 코드 표)에는 등재되어 있지 않다.
  - 상세: spec 자체는 문제 없음 — 에러 코드가 이미 정확히 §1.4 한 곳에만 정의되어 있고
    다른 의미로 중복 사용되지 않는다. 다만 향후 관련 plan/PR 설명이나 코드 주석에서
    "§1.5" 로 계속 잘못 인용되면 탐색성이 떨어진다.
  - 제안: 후속 문서화 시 정확한 위치(§1.4)로 인용 정정. spec 본문 수정은 불요.

## 검증 완료(충돌 없음) 항목

- **`EXECUTION_QUEUE_WAIT_TIMEOUT` 에러 코드 재사용**: `4-execution-engine.md §8`(라인
  1087)·`3-error-handling.md §1.4`(라인 104)·`1-data-model.md §2.13`(`queued_at` 필드,
  라인 463)·`6-websocket-protocol.md §4.1`(라인 179) 네 곳 모두 동일 의미("admission 큐
  대기 5분 초과 → `cancelled` + `cancelledBy='timeout'`")로 일관되게 정의되어 있다. 계획된
  orphan-pending 확장은 **새 에러 코드를 도입하지 않고 기존 코드를 그대로 재사용**하므로
  코드 의미 충돌이 없다.
- **상태 전이 PENDING→CANCELLED**: `4-execution-engine.md §1.1` 전이표(라인 70)에 이미
  `pending → cancelled : 큐 대기 중 취소` 로 등재되어 있어, orphan-pending 이 이 기존
  전이를 재사용하는 것은 상태 머신 확장이 아니라 **기존에 허용된 전이의 새 트리거 추가**다.
  `markQueueWaitTimeout` 의 조건부 UPDATE(`WHERE status='pending'`)도 이미 §1.1 이 요구하는
  "재검증 가능한 단일 전이" 성격과 일치한다.
- **§7.4 recovery 모델과의 충돌 없음**: §7.4 는 "다중 인스턴스 환경에서 stale RUNNING 을
  다른 인스턴스가 잘못 건드리지 않도록 하는 보수적 가드"로 스스로를 정의하며, 이는
  RUNNING 세그먼트 소유권 문제에 국한된 서술이다. orphan pending 스캔은 소유권 경쟁이
  아니라 "다시 pick up 될 job 자체가 없는" 별개의 실패 모드이므로 개념적으로 상충하지
  않는다. 두 스캔이 같은 `exec:recover:lock`(60초 TTL, hostname+uuid owner) 을 재사용해도
  락 자체는 "동시 스캔 시작 방지"가 목적이라 두 대상(row 집합)이 겹치지 않는 한 안전
  (RUNNING 대상과 PENDING 대상은 상호 배타적 `status` 조건이라 실제로 겹치지 않음).
- **admission gate(§8)와의 충돌 없음**: `admitExecutionOrDefer`(코드 라인 2622-2634)는 이미
  pick-up 시점에 동일한 `queued_at`+`resolveQueueWaitTimeoutMs()` 조건으로
  `markQueueWaitTimeout` 을 호출하는 경로가 존재한다. 계획된 boot-scan 경로는 이 로직을
  새로 발명하지 않고 **동일 private 메서드를 재사용**하므로 두 트리거(consumer pick-up
  시점 vs boot backstop 시점) 간 판정 기준의 불일치가 없다. `markQueueWaitTimeout` 자체가
  `WHERE status='pending'` 조건부 UPDATE 라 두 트리거가 동시에 같은 row 를 잡아도
  `affected=0` no-op 으로 자연 직렬화된다(멱등) — TOCTOU 문제 없음.
- **RBAC/권한 모델**: 이 변경은 시스템 내부 백스톱(사용자 API 표면 없음)이라 §3 RBAC
  매트릭스·Auth spec 어느 것과도 접점이 없다. `EXECUTION_QUEUE_WAIT_TIMEOUT` 취소는 기존과
  동일하게 `cancelledBy='timeout'` 시스템 취소로 처리되어 사용자 권한 판정 경로를 타지
  않는다.
- **System Status API(§16)와의 충돌 없음**: `16-system-status-api.md` 는 BullMQ 큐 레벨
  집계(`waiting/active/delayed/failed`)만 다루고 Postgres `Execution.status` row 를 다루지
  않는다 — 계획된 변경은 이 API 응답 shape·의미와 무관.
- **요구사항 ID 충돌 없음**: 계획은 신규 요구사항 ID를 도입하지 않고 기존 §8/§7.4 섹션
  본문만 "구현 완료" 로 갱신하는 스코프다.

## 요약

계획된 orphan-pending 회수 확장은 기존 에러 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`)·기존 상태
전이(`pending → cancelled`)·기존 함수(`markQueueWaitTimeout`)·기존 분산 락
(`exec:recover:lock`)을 그대로 재사용하며, `spec/5-system/4-execution-engine.md`
내부(§1.1/§7.4/§7.5/§8) 및 `3-error-handling.md`(§1.4) 어디와도 직접 모순되지 않는다.
유일한 갱신 필요 지점은 `spec/data-flow/3-execution.md` 의 companion 상태 다이어그램·회수
소스 표로, 이는 `4-execution-engine.md` §8/§7.4 "구현 완료" 갱신과 함께 반드시 동기화해야
stale 서술(현재는 `recoverStuckExecutions` = running 전용이라고 단정)이 남지 않는다. 이는
CRITICAL/WARNING 급 모순이 아니라 문서 동기화 누락 리스크이므로 INFO 로 등급했다.

## 위험도

LOW

BLOCK: NO

STATUS: SUCCESS