# 부작용(Side Effect) 리뷰 — SchedulesService 동시 DELETE 중복 감사 수정

## 발견사항

- **[INFO]** 동시 DELETE 의 "진 쪽" 응답이 204 → 404 로 바뀌는 관측 가능한 API 동작 변화
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:337-338` (트리거 삭제 `affected` 판정), `codebase/backend/src/modules/schedules/schedules.service.ts:371-375` (`triggerId` 없는 방어 분기의 스케줄 행 `affected` 판정)
  - 상세: `m.delete(Trigger, triggerId)` 또는 `scheduleRepository.delete(...)` 의 `affected` 가 0이면 `throwScheduleNotFound()` 를 호출해 `NotFoundException` 을 던진다. 이전에는 두 동시 DELETE 요청이 모두 204 를 받았으나, 이제 락에서 진 쪽은 404 를 받는다 — `DELETE /api/schedules/:id` 라는 공개 HTTP 인터페이스의 관측 가능한 응답 계약이 바뀐다. 이 변화 자체가 이번 PR 의 목적이며, `CHANGELOG.md`·`plan/in-progress/schedule-dup-delete.md`·e2e 테스트(`schedule-delete-concurrency.e2e-spec.ts:117`)로 의도가 명시돼 있고, 형제 PR(#1369·#1370)과 동일 패턴이라 신규 위험은 아니다. `3-schedule.md` §4 스펙 문서에는 아직 이 계약이 서술되지 않았으나 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 에 등재돼 추적 중이다.
  - 제안: 조치 불요 — 의도된 변경이고 문서·트래커에 이미 반영됨. 외부 API 클라이언트가 DELETE 재시도 로직에서 404 를 별도 처리하는지만 참고로 확인 권장.

- **[INFO]** `NotFoundException` 발생 시 `Logger.error` 호출을 건너뛰는 로깅 부작용 변경
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:340-344` (`.catch((err) => { if (err instanceof NotFoundException) throw err; ... this.logger.error(...) })`)
  - 상세: 종전에는 트랜잭션 내 어떤 실패든 `this.logger.error(...)` 로 "반쯤 삭제된 상태 — 수동 정리 필요" 경보를 남겼다. 이번 diff 로 `NotFoundException`(동시 삭제로 이미 지워진 정상 케이스)은 이 로그를 건너뛴다. 로그 기반 알림·대시보드가 이 문구를 모니터링하고 있었다면 향후 발생 빈도가 줄어드는 관측 가능한 변화지만, 오탐(false alarm) 제거가 목적이므로 바람직한 방향이다.
  - 제안: 조치 불요 — 의도된 개선. 로그 알림 룰이 이 문구를 정확 매치로 사용 중이라면 팀에 공지 권장.

- **[INFO]** `triggerId` 없는 방어 분기의 삭제 호출 방식 변경 (`remove(entity)` → `delete(criteria)`), 현재는 도달 불가
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:371-374` (else 분기), 비교 대상 `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:25`(`triggerId` 컬럼 `nullable` 미지정 — 즉 NOT NULL)
  - 상세: 종전 코드는 if/else 양쪽 뒤에서 공통으로 `scheduleRepository.remove(schedule)` (엔티티 객체 기반, TypeORM lifecycle 훅 대상)를 호출했다. 이번 diff 는 `if` 분기(트리거 있음)에만 `remove(schedule)` 을 남기고, `else` 분기(`triggerId` 없음)는 `scheduleRepository.delete({ id, workspaceId })` (criteria 기반, lifecycle 훅 미적용)로 바꿨다. `Schedule` 엔티티에는 현재 `@BeforeRemove`/`@AfterRemove` 등 lifecycle 훅이 없어(grep 확인) 실질적 차이는 없고, `triggerId` 가 스키마상 NOT NULL 이라 이 분기 자체가 현재 도달 불가능한 방어 코드다. 다만 향후 `triggerId` 가 nullable 로 바뀌거나 엔티티에 lifecycle 훅이 추가되면 두 분기가 서로 다른 삭제 경로(엔티티 vs criteria)를 타는 것이 놀라움을 줄 수 있다.
  - 제안: 조치 불요 — 현재 도달 불가 경로이며, 판정자(affected)를 정확히 얻기 위한 의도적 선택. 스키마가 nullable 로 바뀌는 시점에 재검토 권장(엔티티 주석에 이미 "현재 도달 불가" 명시돼 있어 향후 추적 가능).

- **[INFO]** BullMQ `removeJob()` 이중 호출은 이번 diff 로 새로 생긴 것이 아니라 기존 잔여
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:311` (`await this.scheduleRunnerService.removeJob(schedule.id);` — advisory lock 진입 전, 락 밖)
  - 상세: 동시 DELETE 두 건이 겹치면 이 외부(BullMQ) 호출은 락 밖에서 두 번 실행된다(되돌릴 수 없는 부작용). 이 diff 의 범위가 아니고, 형제 PR(#1369·#1370)도 동일하게 남긴 잔여이며 `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 절에 명시적으로 defer 근거가 있다. `removeJob` → `queue.removeJobScheduler(...)` 자체는 이번 diff 의 변경 대상이 아니다(수정 없음, 재확인만).
  - 제안: 조치 불요 — 이미 트래커에 등재된 기존 잔여. 신규 결함 아님.

- **[INFO]** e2e 테스트가 실제 HTTP·DB·advisory lock 부작용을 발생시키나 정리 로직이 갖춰져 있음
  - 위치: `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts:56-59`(`afterAll` — `locker.end()`·`db.end()`), `:118-121`(`finally` — `ROLLBACK`·pending 소비)
  - 상세: 신규 e2e 는 별도 DB 커넥션 2개(`db`, `locker`)를 열고 워크스페이스·워크플로·스케줄을 실제로 생성, advisory lock 을 잡아 두 DELETE 요청을 경합시킨다. `finally` 에서 `ROLLBACK`(이미 `COMMIT` 된 경우 no-op, `.catch`로 안전 처리)과 `pending` 소비, `afterAll` 에서 두 커넥션을 정상 종료한다. 형제 e2e 파일들(workflow/workspace/trigger-delete-concurrency)과 동일한 기법으로, 신규 부작용 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물(`review/code/2026/09/21/00_06_01/**`)이 이번 diff 로 저장소에 커밋됨
  - 위치: `review/code/2026/09/21/00_06_01/*.md`, `*.json` (신규 파일 다수)
  - 상세: 이전 라운드 리뷰의 SUMMARY·RESOLUTION·각 리뷰어 산출물이 저장소에 새 파일로 추가된다. `review/` 는 gitignore 대상이 아니며 프로젝트 관례상 정상적인 산출물 보존 위치다 — 예상치 못한 파일시스템 부작용이 아니라 관례에 부합하는 의도된 커밋.
  - 제안: 조치 불요.

## 문제 없음으로 확인된 항목

- 전역 변수 신규 도입·수정 없음(`throwScheduleNotFound()` 는 클래스 private 메서드).
- 환경 변수 읽기/쓰기 변경 없음.
- 공개 메서드 시그니처(`remove(id, workspaceId, userId): Promise<void>`) 변경 없음 — 내부 구현만 재구성.
- 신규 네트워크 호출(외부 서비스) 없음 — 기존 BullMQ·DB 호출 경로 재사용.
- 이벤트/콜백 발생 순서 변경 없음 — `recordAudit` 호출 위치·조건은 종전과 동일(트리거/스케줄 삭제 성공 시에만 도달, 이제 그 조건이 `affected` 로 더 엄격해졌을 뿐).
- 트랜잭션 내 예외 발생 시 자동 롤백 후 재-throw 패턴은 이미 사용 중인 형제 파일(`triggers.service.ts`)과 동일 구조로, TypeORM 트랜잭션 처리에 새로운 위험을 추가하지 않음.

## 요약

이번 diff 의 부작용은 대부분 **의도된 것**이고 CHANGELOG·plan 문서·e2e 테스트로 명시적으로 근거가 남아 있다. 유일하게 관측 가능한 외부 인터페이스 변화는 동시 DELETE 경합에서 진 쪽 응답이 204 → 404 로 바뀌는 것과, 그 경로에서 `Logger.error` 호출이 억제되는 것인데, 둘 다 이 PR 의 목적(중복 감사 행 방지) 그 자체이며 이미 spec 트래커에 문서화 격차가 등재돼 있다. `triggerId` 없는 방어 분기의 삭제 방식 변경(`remove` → `delete`)은 현재 도달 불가능한 코드라 실질 영향이 없다. 전역 상태·환경 변수·공개 시그니처·신규 네트워크 호출 관점에서는 발견된 문제가 없다.

## 위험도
LOW
