# Cross-Spec 일관성 검토 — orphan pending backstop (recoverStuckExecutions 확장)

> **payload 스코프 알림**: 전달된 `_prompts/cross_spec.md` (2503줄)는 `spec/5-system/1-auth.md`·
> `10-graph-rag.md`(GraphRAG)·`0-overview.md`·`1-data-model.md` 전체 덤프였고, 실제 검토
> 대상인 `spec/5-system/4-execution-engine.md`(§7.1/§7.4/§7.5/§8)·`spec/data-flow/3-execution.md`
> 변경분은 payload 에 포함되지 않았다(known mis-scope 패턴 — 직전 21_50_44 검토와 동일 증상).
> 지시에 따라 `git diff origin/main...HEAD` 로 폴백해 실제 변경분을 직접 분석했다.

## 계획 요약 (검토 대상 diff)

`recoverStuckExecutions`(§7.4 boot backstop, `onApplicationBootstrap` + test-hook)에
`recoverOrphanPendingExecutions()` 를 추가한다. admission 재큐 BullMQ job 이 소실(Redis
비영속·eviction)되어 재-pick up 되지 않는 `status='pending' AND queued_at < now −
EXECUTION_QUEUE_WAIT_TIMEOUT_MS` row 를 기존 `markQueueWaitTimeout`(조건부 UPDATE
`WHERE status='pending'`, 멱등)으로 §8 wait-timeout `cancelled`
(`EXECUTION_QUEUE_WAIT_TIMEOUT`, `cancelledBy='timeout'`)로 마감한다. RUNNING stale 은 기존과
동일하게 §7.5 case B re-drive, PENDING stale 은 신규로 cancel. early-return 제거로 stale
RUNNING 0건이어도 orphan pending 스캔은 항상 수행. 동일 lock(`exec:recover:lock`)·동일 트리거
재사용, 신규 migration·env·에러코드 없음. spec §8/§7.1/§7.4 + Rationale 서브섹션 +
`data-flow/3-execution.md` mermaid·회수표를 같은 diff 에서 갱신.

## 발견사항

- **[INFO]** 직전 impl-prep 검토(21_50_44)가 지적한 companion 문서 동기화 갭 — 해소 확인
  - target 위치: `spec/data-flow/3-execution.md` 라인 245(mermaid `pending --> cancelled`),
    라인 298(`recoverStuckExecutions` 회수표 행)
  - 충돌 대상: 없음(해소됨) — 21_50_44 검토가 "구현 완료 시 이 두 지점을 같은 커밋에서
    갱신하지 않으면 stale 서술이 남는다" 고 사전 경고했던 항목
  - 상세: 실제 diff 확인 결과 (1) mermaid 라인이 `pending --> cancelled: (a) 큐 대기 중
    사용자 cancel … (b) 큐 대기 5분 초과 EXECUTION_QUEUE_WAIT_TIMEOUT — admission 시점
    검사(§8) 또는 orphan pending backstop(recoverStuckExecutions, job 소실 시)` 로 두 사유를
    모두 반영했고, (2) 회수표 `recoverStuckExecutions` 행이 "(i) stale running … (ii) orphan
    pending" 으로 대상을 확장하고 액션 열도 "RUNNING → re-drive / orphan PENDING →
    markQueueWaitTimeout" 로 분기 서술했다. `4-execution-engine.md` §7.1/§7.4/§8 개정과
    완전히 동형이라 두 문서 간 모순 없음.
  - 제안: 없음(참고용 확인 항목). 향후 유사 PR 에서도 companion data-flow 문서 동기화를
    같은 diff 안에서 계속 유지할 것.

## 검증 완료 (충돌 없음) 항목

- **`EXECUTION_QUEUE_WAIT_TIMEOUT` 에러 코드 재사용**: 신규 코드 없음. `4-execution-engine.md
  §8`·`§7.1`·`§7.4`·`3-error-handling.md §1.4`·`1-data-model.md §2.13`(`queued_at`)·
  `6-websocket-protocol.md §4.1`(`cancelledBy: 'timeout'`) 모두 동일 의미로 일관. WS 프로토콜
  §4.1 은 이미 `'timeout' = §8 admission 큐 대기 5분 초과` 를 문서화하고 있어 이번 backstop
  도 같은 이벤트 계약을 그대로 재사용한다 — 신규 페이로드 shape 변경 없음.
- **상태 전이 PENDING→CANCELLED**: 코드 확인(`state-machine.ts` `ALLOWED_TRANSITIONS`)
  결과 `PENDING: [RUNNING, CANCELLED]` 가 이미 존재 — 이번 PR 은 새 전이를 추가하지 않고
  기존에 허용된 전이(§1.1 명시)에 새 트리거(boot backstop)만 추가한다. `markQueueWaitTimeout`
  의 조건부 UPDATE(`WHERE status='pending'`)를 그대로 재사용하므로 admission gate
  (pending→running)와 backstop(pending→cancelled)이 상호배타 status 전이라 이중 처리·race
  가 없다(둘 다 조건부 UPDATE, 한쪽이 먼저 성공하면 다른 쪽은 affected=0 no-op).
- **§7.1/§7.4 recovery 모델과의 정합**: §7.1/§7.4 가 반복 확정한 "heartbeat → stalled-job
  일원화, 신규 주기 스캐너 미도입" 원칙을 이번 PR 도 유지 — 별도 스캐너 없이 기존
  `recoverStuckExecutions` boot 스캔·기존 `exec:recover:lock`(60초 TTL, hostname+uuid owner)을
  재사용한다. RUNNING 대상(`status='running'`)과 PENDING 대상(`status='pending'`)은 status
  조건이 상호 배타적이라 같은 락 안에서 두 스캔이 겹쳐도 안전.
  - `recoverOrphanPendingExecutions` 코드 주석에 "전용 `(status, queued_at)` 복합 인덱스는
    두지 않는다 — 기존 `reclaimStuckRunningExecution` 선례와 대칭" 이라 명시돼 있어, DB
    인덱스 전략도 §7.4 기존 결정과 일관되게 확장했다(신규 인덱스·migration 없음).
- **admission gate(§8)와의 non-overlap**: `admitExecutionOrDefer` (consumer pick-up 시점
  wait-timeout 검사)와 `recoverOrphanPendingExecutions` (boot backstop)은 동일한
  `resolveQueueWaitTimeoutMs()` 판정 기준과 동일한 `markQueueWaitTimeout` private 메서드를
  공유한다 — 두 트리거 간 판정 기준 불일치 없음. §8 본문이 "트리거 = admission 시점 검사
  (주 경로) + 부팅 backstop(orphan)" 으로 두 경로를 명시적으로 구분·귀속했고, plan 문서
  (`orphan-pending-backstop.md`)의 "admission gate(pending→running)와 backstop
  (pending→cancelled)은 상호배타 status 전이라 이중 처리 없음" 서술과도 diff 코드가 일치.
- **요구사항 ID 충돌 없음**: 신규 요구사항 ID 미도입. 기존 §8/§7.1/§7.4 섹션 본문 확장 +
  Rationale 서브섹션(`orphan pending backstop — recoverStuckExecutions 재사용 + PENDING
  cancel (2026-07-04)`) 신설뿐.
- **RBAC/권한 모델 충돌 없음**: 시스템 내부 백스톱(사용자 API 표면 없음) — §3 RBAC 매트릭스·
  auth spec 어느 것과도 접점 없음. `cancelledBy='timeout'` 시스템 취소로 처리돼 사용자 권한
  판정 경로를 타지 않는다.
- **System Status API(§16) 충돌 없음**: `16-system-status-api.md` 는 BullMQ 큐 레벨 집계만
  다루고 Postgres `Execution.status` row 의미를 재정의하지 않는다 — 이번 변경과 무관.
- **계층 책임 충돌 없음**: 별도 스캐너·서비스를 새로 만들지 않고 기존
  `ExecutionEngineService.recoverStuckExecutions` 내부에 사경로를 추가하는 방식 — 실행 엔진
  이 자신의 admission/recovery 책임을 계속 단독 소유한다(§7.1/§7.4/§8 SoT 단일화 유지).

## 요약

이번 orphan pending backstop 변경은 기존 에러 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`)·기존
상태 전이(`PENDING→CANCELLED`, `state-machine.ts` 에 이미 존재)·기존 함수
(`markQueueWaitTimeout`)·기존 분산 락(`exec:recover:lock`)·기존 WS 이벤트 계약
(`cancelledBy='timeout'`)을 그대로 재사용하며 신규 엔티티·API·요구사항 ID·RBAC 변경이
없다. 직전 impl-prep 검토(21_50_44)가 사전 경고했던 유일한 항목(`data-flow/3-execution.md`
companion 문서 동기화)은 실제 diff 에서 mermaid 다이어그램과 회수표 양쪽 모두 갱신되어
해소를 확인했다. `spec/5-system/4-execution-engine.md` 내부(§1.1/§7.1/§7.4/§7.5/§8)와
`spec/data-flow/3-execution.md`·`spec/5-system/6-websocket-protocol.md`·
`spec/1-data-model.md` 어디와도 직접 모순되는 지점을 발견하지 못했다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
