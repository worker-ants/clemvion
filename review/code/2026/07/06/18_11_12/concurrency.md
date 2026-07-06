### 발견사항

- **[INFO]** `dispatchEmails`/`dispatchScheduleFailedNotification`/`dispatchExecutionFailedNotification`/`dispatchTeamInviteNotification` 모두 fire path 에서 `await` 후 계속 진행 — 블로킹이나 경쟁 조건 없음
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` (`notify`/`createMany` → `dispatchEmails`), `execution-engine.service.ts` (`dispatchExecutionFailedNotification`), `schedule-runner.service.ts` (`dispatchScheduleFailedNotification`), `workspace-invitations.service.ts` (`dispatchTeamInviteNotification`)
  - 상세: 4곳 모두 동일 패턴 — try/catch 로 예외를 삼켜 host 흐름(적재/실행/재시도)에 영향을 주지 않는 best-effort 발사. `notify()`/`createMany()`는 `await this.dispatchEmails(...)`로 인라인 대기하지만 이는 신규 diff 이전(PR2, 16_24_00 리뷰 라운드)에 이미 WARNING으로 식별·defer 처리된 기존 사항이며, 호출자가 전부 백그라운드 워커/API 응답 후 fire-forget 성격이라 이벤트 루프 블로킹 위험은 낮음(이미 리뷰 이력에 기록됨). 본 PR3(발사 소스 3종)에서 새로 추가된 `dispatchExecutionFailedNotification`/`dispatchScheduleFailedNotification`/`dispatchTeamInviteNotification` 도 동일하게 안전한 try/catch 격리 패턴을 재현했다.
  - 제안: 없음(기존 defer 결정 유지, 신규 리스크 아님).

- **[INFO]** `ScheduleRunnerService.process()` 는 BullMQ 재시도 시 `schedule_failed` 알림 중복 발사 가능
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.ts` catch 블록 (`dispatchScheduleFailedNotification` 호출 후 `throw err`)
  - 상세: enqueue/파라미터 해석이 실패하면 알림을 발사한 뒤 원 에러를 rethrow 하는데, BullMQ 잡이 재시도 설정(attempts>1)이라면 각 재시도 실패마다 owner 에게 동일한 `schedule_failed` 알림이 매번 새로 INSERT 되어 중복 알림이 쌓일 수 있다. 이는 경쟁 조건이라기보다 "실패 시마다 새 알림 row 생성"이라는 설계상 특성이며, dedup 로직(`hasRecentDuplicate` 유사 헬퍼가 서비스 내 이미 존재하는 것으로 보임 — L250 부근 `MoreThanOrEqual(cutoff)` 카운트 헬퍼)이 이 경로에는 적용되지 않았다.
  - 제안: 코드 결함이라기보다 정책 확인 필요 — BullMQ 재시도 횟수(attempts) 설정과 함께, 재시도마다 알림을 반복 발사할지 최초 실패에만 발사할지는 스펙/product 결정 사항. 동시성 버그는 아니므로 참고용으로만 남김(요청 시 requirement/architecture 리뷰어가 별도 판단할 사안).

- **[INFO]** `dispatchEmails` 의 `Promise.allSettled` 배치 병렬 발송 — 격리는 적절하나 동시성 상한 없음
  - 위치: `notifications.service.ts` `dispatchEmails()` — `Promise.allSettled(emailRows.map((row) => this.sendOneEmail(...)))`
  - 상세: `createMany` 로 대량 fan-out(예: 워크스페이스 전체 멤버 대상) 시 email 대상 row 수만큼 SMTP 발송이 무제한 동시에 발행된다. 각 발송은 독립적으로 실패 격리되어(allSettled) 부분 실패가 다른 row 에 전파되지 않으므로 correctness 관점 문제는 없다. 다만 리소스 풀링(SMTP 커넥션 풀/pool 크기) 상한이 코드에 없어 매우 큰 배치에서는 동시 커넥션 폭주 가능성이 있다 — 이미 기존 리뷰 라운드(17_00_31)에서 "대량 배치 UPDATE 배치화 = 후속 최적화" 로 INFO 처리된 사항과 동일 계열이며 본 PR 신규 리스크는 아니다.
  - 제안: 없음(기존 INFO 유지, 필요 시 후속 최적화 트랙에서 p-limit 등 동시성 상한 고려는 이미 이전 라운드에 문서화됨).

- **[INFO]** `execution-engine.service.ts` 의 advisory-lock admission 코드 diff 는 순수 타입 캐스트 제거(`as unknown[]` 제거)이며 동시성 로직 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2667-2677 (`m.query(...)` 결과 캐스트 제거)
  - 상세: `pg_advisory_xact_lock` 기반 admission gate 자체(트랜잭션 스코프, cap 체크, RETURNING)는 변경되지 않았고 단순히 불필요한 `as unknown[]` 캐스팅만 제거됐다. 기존에 이미 검증된 동시성 안전 장치(advisory lock 으로 TOCTOU 방지)는 그대로 유지된다.
  - 제안: 없음.

### 요약

이번 diff 의 핵심은 알림 발사 소스 3종(`execution_failed`/`schedule_failed`/`team_invite`) 추가와 이전 PR2(이메일 발송)의 연장으로, 모든 신규 발사 경로가 동일한 방어 패턴(try/catch 로 예외 삼킴, 호출자 흐름에 영향 없는 best-effort, `In(...)` 배치 조회로 N+1 회피, `Promise.allSettled` 로 배치 부분 실패 격리)을 정확히 재현하고 있어 경쟁 조건·데드락·동기화 결함은 발견되지 않았다. execution-engine 의 advisory-lock 기반 admission gate 는 이번 diff 에서 로직 변경 없이 타입 캐스트만 제거됐으므로 기존에 이미 검증된 동시성 안전성이 그대로 유지된다. 유일하게 참고할 만한 점은 (1) BullMQ 재시도 시 `schedule_failed` 알림이 매 시도마다 중복 발사될 수 있다는 설계적 특성과 (2) 대량 배치 이메일 발송 시 동시성 상한이 없다는 점인데, 둘 다 이전 리뷰 라운드에서 이미 다뤄졌거나 정책적 판단이 필요한 사안이지 버그성 동시성 결함은 아니다.

### 위험도
NONE
