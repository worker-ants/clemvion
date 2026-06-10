# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 구현 파일 (`integration-expiry-scanner.service.ts`)

- **[INFO]** BullMQ `jobId` dedup 활용 — 동시성 경쟁 안전
  - 위치: `run()` 내 `cafe24RefreshQueue.add(...)` + `enqueueCafe24BackgroundRefresh()`
  - 상세: `jobId: integration.id` 로 dedup 설정. 같은 통합에 대해 `connected-expiry` 패스와 `cafe24-background-refresh` 패스가 동시에 enqueue 를 시도해도 BullMQ 가 단일 잡으로 수렴시킨다. 코드 주석에 이 의도가 명시되어 있어 설계 의도가 분명하다.

- **[INFO]** `run()` 의 `integrationsToUpdate` 배열 뮤테이션 패턴 — 단일 패스 안에서만 참조되므로 스레드 안전 이슈 없음
  - 위치: `run()` 내 `integration.status = 'expired'` / `integration.statusReason = 'token_expired'`
  - 상세: `candidates` 배열의 객체를 in-place 변경 후 `integrationsToUpdate.push()` 에 담는 패턴. BullMQ worker 는 job 단위로 단일 실행 컨텍스트를 가지며(`concurrency: 1` 설정 확인됨), TypeORM Repository 는 요청별 인스턴스로 분리되므로 동시 패스 간 공유 상태 없음.

- **[INFO]** `expirePendingInstalls()` 는 단일 atomic bulk UPDATE 사용 — 경쟁 조건 없음
  - 위치: `expirePendingInstalls()` 내 `createQueryBuilder().update()`
  - 상세: 코드 주석("Single atomic bulk UPDATE — find→mutate→save would race against the Cafe24 callback path")에 설계 근거가 명시되어 있으며, WHERE 절이 predicate 를 UPDATE 시점에 잠가 callback 경로와의 TOCTOU 경쟁을 차단한다.

- **[INFO]** `claimThreshold()` 의 `INSERT ON CONFLICT DO NOTHING` — 원자성 보장
  - 위치: `claimThreshold()` 내 `.orIgnore().execute()`
  - 상세: partial UNIQUE constraint 를 이용한 dedup. 두 worker 가 동시에 같은 `(integrationId, threshold)` 로 insert 를 시도해도 DB가 원자적으로 한쪽만 성공시킨다. try/catch + 23505 catch 패턴 대비 예외 비용이 없다.

- **[INFO]** `resolveRecipients()` 가 루프 내에서 sequential await 로 호출됨 — 성능 관점 INFO
  - 위치: `run()` 내 `for (const integration of candidates)` 루프, `resolveRecipients` 호출
  - 상세: 각 integration 에 대해 순차적으로 `resolveRecipients` 를 await 한다. `personal` scope 는 배열 반환이라 I/O 없지만, `workspace` scope 는 `workspacesService.findAdminUserIds` DB 호출이 발생한다. 기존 N+1 를 `userRepository.find(In(...))` 로 한 번에 처리하는 B-4-2 패치가 적용되어 있지만, `resolveRecipients` 자체는 여전히 루프 내 sequential. 동시성 버그는 아니나, `personal`/`workspace` 혼재 시 workspace 행 다수면 직렬 지연 가능.
  - 제안: 긴급 이슈는 아님. 향후 `workspace` scope integration 이 많아지면 `Promise.all(candidates.map(resolveRecipients))` 로 fan-out 후 결과를 `recipientsByIntegration` 에 일괄 세팅하는 방식을 고려.

### 테스트 파일 (`integration-expiry-scanner.service.spec.ts`)

- **[INFO]** 테스트 헬퍼 `getNotifResourceIds` / `hasSavedExpired` — 동시성 이슈 없음
  - 위치: 신규 추가 헬퍼 함수(파일 상단)
  - 상세: Jest 단위 테스트는 단일 스레드에서 실행되며, mock 객체를 공유하는 동시성 시나리오가 없다. 기존 `.flat().flat()` 패턴의 "mock 미호출 시 assertion 무조건 통과" 약점을 제거한 개선이다.

### 기타 파일

- **[INFO]** `system-status.constants.ts` — `MAKESHOP_REFRESH_QUEUE` 추가, concurrency 1 설정
  - 위치: `MONITORED_QUEUES` 배열
  - 상세: 모니터링 레지스트리에 큐 추가. `concurrency: 1` 은 makeshop-token-refresh worker 의 실제 concurrency 와 일치해야 utilization 계산이 올바르다. 현재 변경에서 worker 파일은 포함되지 않아 직접 검증 불가하나, 시스템 상태 계산에만 영향을 주며 동시성 버그를 유발하지 않는다.

## 요약

변경 코드에 동시성 취약점은 발견되지 않았다. 핵심 경쟁 구간인 `claimThreshold()` 는 DB-level atomic INSERT ON CONFLICT 로, `expirePendingInstalls()` 는 단일 bulk UPDATE 로, cafe24 enqueue 는 BullMQ jobId dedup 으로 각각 올바르게 보호되어 있다. `integration-expiry-scanner` worker 의 `concurrency: 1` 설정이 `run()` 내 in-place mutation 패턴을 안전하게 만든다. `resolveRecipients` 루프 내 sequential await 는 INFO 수준의 성능 관찰 사항이며, 실제 경쟁 조건을 유발하지 않는다.

## 위험도

NONE

---
STATUS=success ISSUES=0
