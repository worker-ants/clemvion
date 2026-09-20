# 부작용(Side Effect) 리뷰 — `SchedulesService` 동시 DELETE 중복 감사 수정 (라운드 3, 00_56_52)

## 검토 범위

`origin/main..HEAD` 실제 diff(로컬 `main` 은 66커밋 stale 이라 `origin/main` 기준으로 재확인)는
`eb94361cc`(핵심 수정) + `893dfeb7a`(테스트) + `69889f74e`(헬퍼 추출) + `131296205`/`030299603`(문서) +
`2879e88c7`(`affected === 0` 명시 비교·CHANGELOG 각주) 6커밋이다. 실질 코드 변경은
`codebase/backend/src/modules/schedules/schedules.service.ts` 와 그 spec 뿐이고, 나머지
(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/21/{00_06_01,00_37_06}/**`,
`review/consistency/2026/09/20/23_37_12/**`)는 문서·이전 라운드 산출물이라 부작용 표면이 없다.

이 PR 은 이미 두 라운드 리뷰(00_06_01, 00_37_06)를 거쳤고 RESOLUTION.md 상 Critical 0·Warning 4건
전부 조치 완료로 기록돼 있다. 00_37_06/side_effect.md(이전 side-effect 리뷰, 위험도 LOW)가 이미
핵심 부작용 항목을 식별·검증했다. 이번 라운드에서 그 이후 추가된 변경(`affected === 0` 명시 비교,
헬퍼 추출, CHANGELOG 각주, 대조 테스트 2건)이 새 부작용을 도입하는지 재확인했다.

## 발견사항

- **[INFO]** 동시 DELETE 의 "진 쪽" 응답이 204 → 404 로 바뀌는 관측 가능한 API 동작 변화 (재확인, 기존 식별 항목)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:342`(트리거 삭제 `affected` 판정), `:380`(`triggerId` 없는 방어 분기의 스케줄 행 `affected` 판정)
  - 상세: `m.delete(Trigger, triggerId)` 또는 `scheduleRepository.delete(...)` 의 `affected` 가 `0` 이면 `throwScheduleNotFound()` 를 호출해 `NotFoundException` 을 던진다. 이전에는 두 동시 DELETE 요청이 모두 204 를 받았으나, 이제 락에서 진 쪽은 404 를 받는다 — `DELETE /api/schedules/:id` 라는 공개 HTTP 인터페이스의 관측 가능한 응답 계약 변화다. 이번 라운드에서 판정식이 `!affected` → `affected === 0` 으로 바뀐 것은 `affected` 가 `null`/`undefined`(드라이버가 보고하지 않는 경우)일 때 "모른다"를 "없다"로 오판하지 않도록 더 보수적으로 좁힌 것뿐이라 이 관찰의 결론은 바뀌지 않는다. 형제 PR(#1369·#1370)과 동일 패턴이며 이 PR 의 목적 그 자체이고, CHANGELOG·plan·e2e 로 의도가 명시돼 있다.
  - 제안: 조치 불요 — 의도된 변경. `3-schedule.md` §4 spec 서술 격차는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재·추적 중.

- **[INFO]** `NotFoundException` 발생 시 `Logger.error` 호출을 건너뛰는 로깅 부작용 변경 (재확인)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:348`(`if (err instanceof NotFoundException) throw err;`)
  - 상세: 종전에는 트랜잭션 내 어떤 실패든 `this.logger.error(...)` 로 "반쯤 삭제된 상태 — 수동 정리 필요" 경보를 남겼다. 이 diff 로 `NotFoundException`(동시 삭제로 이미 지워진 정상 케이스)은 이 로그를 건너뛴다. 로그 기반 알림·대시보드가 이 문구를 정확 매치로 모니터링 중이었다면 발생 빈도가 줄어드는 관측 가능한 변화이나, 거짓 경보 제거가 목적이므로 바람직한 방향이고 신규 테스트(`schedules.service.spec.ts` "락 안 트리거 삭제가 0행이면 404 이고 감사·비밀 정리를 남기지 않는다")가 `expect(error).not.toHaveBeenCalled()` 로 이 계약을 고정했다.
  - 제안: 조치 불요.

- **[INFO]** `triggerId` 없는 방어 분기의 삭제 호출 방식 변경(`remove(entity)` → `delete(criteria)`) — 현재 도달 불가 (재확인)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:371`(if 분기, 여전히 `scheduleRepository.remove(schedule)`) vs `:375`(else 분기, `scheduleRepository.delete({ id, workspaceId })`)
  - 상세: 두 분기가 서로 다른 삭제 API(엔티티 기반 vs criteria 기반)를 탄다. `Schedule` 엔티티엔 `@BeforeRemove`/`@AfterRemove` 등 lifecycle 훅이 없고(재확인: grep 0건), `triggerId` 컬럼이 NOT NULL 이라(`schedule.entity.ts:25` `nullable` 미지정) else 분기는 현재 프로덕션 경로로 도달 불가능한 방어 코드다. 실질 영향 없음.
  - 제안: 조치 불요 — 스키마가 nullable 로 바뀌거나 엔티티에 lifecycle 훅이 추가되는 시점에만 재검토 필요(주석에 이미 "현재 도달 불가" 명시돼 추적 가능).

- **[INFO]** BullMQ `removeJob()` 이중 호출은 이 diff 의 신규 부작용이 아니라 기존 잔여 (재확인)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:312` 부근(`await this.scheduleRunnerService.removeJob(schedule.id);` — advisory lock 진입 전, 락 밖. 이번 라운드 diff 는 이 줄을 건드리지 않았다)
  - 상세: 동시 DELETE 두 건이 겹치면 이 외부(BullMQ) 호출은 락 밖에서 두 번 실행된다(되돌릴 수 없는 부작용). `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 절에 defer 근거가 명시돼 있다.
  - 제안: 조치 불요 — 신규 결함 아님, 이미 트래커에 등재된 잔여.

- **[INFO]** 신규 테스트 두 건이 `Logger.prototype.error` 를 spy 로 감싼다 — 공유 프로토타입 뮤테이션이지만 격리됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` "삭제 — 락 안 트리거 삭제가 0행이면 404 이고 감사·비밀 정리를 남기지 않는다" 테스트 블록(`jest.spyOn(Logger.prototype, 'error')`)
  - 상세: `Logger.prototype.error` 는 클래스 전역(모든 `Logger` 인스턴스가 공유하는 prototype) 이라 spy 설치 동안 해당 파일 내 동시 실행 중인 다른 코드의 로깅도 같이 가로챈다. 다만 이 파일의 `it()` 블록들은 순차 실행(`test.concurrent` 미사용)이고 `try/finally` 로 `error.mockRestore()` 를 보장하므로 테스트 간 오염은 없다. 같은 패턴이 이 diff 이전부터 인접 테스트("삭제 실패는 조용히 지나가지 않는다")에 이미 쓰이고 있어 신규 위험이 아니라 기존 관례의 재사용이다.
  - 제안: 조치 불요.

- **[INFO]** e2e 신규 파일이 실 DB·advisory lock 부작용을 발생시키나 정리 로직 갖춤 (재확인)
  - 위치: `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` `afterAll`(57-59행: `locker.end()`·`db.end()`), `finally`(119-121행: `ROLLBACK`·`pending` 소비)
  - 상세: 별도 DB 커넥션 2개를 열어 워크스페이스·워크플로·스케줄을 실제로 생성하고 advisory lock 으로 두 DELETE 요청을 경합시킨다. `finally` 의 `ROLLBACK` 은 이미 `COMMIT` 된 정상 경로에서 no-op 이 되지만 `.catch(() => undefined)` 로 안전 처리돼 있다. 형제 e2e 파일들(workflow/workspace/trigger-delete-concurrency)과 동일 기법이라 신규 부작용 위험 없음.
  - 제안: 조치 불요.

## 문제 없음으로 확인된 항목

- 전역 변수 신규 도입·수정 없음 — `throwScheduleNotFound()` 는 클래스 private 메서드.
- 환경 변수 읽기/쓰기 변경 없음(e2e 의 `process.env.E2E_BASE_URL` 참조는 형제 e2e 파일들과 동일한 기존 관례).
- 공개 메서드 시그니처(`remove(id, workspaceId, userId): Promise<void>`, `findById`) 변경 없음 — 내부 구현만 재구성.
- `SchedulesService` 생성자 파라미터 변경 없음 — `SecretResolverService` 주입은 `origin/main` 에 이미 존재(이 diff 의 변경분 아님, 이전 PR #1370 계열에서 이미 병합됨). 이번 diff 로 새로 추가된 의존성 없음.
- 신규 네트워크 호출(외부 서비스) 없음 — 기존 BullMQ·DB 호출 경로 재사용.
- 이벤트/콜백 발생 순서 변경 없음 — `recordAudit` 호출 위치·조건은 종전과 동일(트리거/스케줄 삭제 성공 시에만 도달, 이제 그 조건이 `affected` 로 더 엄격해졌을 뿐).
- 트랜잭션 내 예외 발생 시 자동 롤백 후 재-throw 패턴은 형제 파일(`triggers.service.ts`)과 동일 구조.
- `affected` 판정식을 `!affected` → `affected === 0` 으로 바꾼 것은 `null`/`undefined`("모른다")를 "없다"로 오판하지 않는 방향이라 부작용을 새로 만들지 않는다 — 뮤테이션 실측(트리거 판정 삭제 시 1건만 RED, 51건 GREEN)이 커밋 메시지에 기록돼 있다.
- 저장소 파일 뮤테이션: 이번 리뷰는 read-only 로만 수행했다(`git status --short` 재확인 결과 세션 시작 시점과 동일하게 `review/code/2026/09/21/00_56_52/` 미커밋 상태만 있음, 다른 변경 없음).

## 요약

실질 코드 변경은 `SchedulesService.remove()`·`findById()` 에 한정되고, 이번 라운드(00_56_52)에서 추가된 것은 판정식을 `=== 0` 으로 명시화하고 `NotFoundException` 리터럴을 헬퍼로 추출한 것뿐이라 이전 side-effect 리뷰(00_37_06, LOW)가 식별한 항목의 결론을 바꾸지 않는다. 유일하게 관측 가능한 외부 인터페이스 변화(동시 DELETE 진 쪽 204→404)와 그에 따른 로그 억제는 이 PR 의 의도된 목적이며 CHANGELOG·plan·e2e·유닛 테스트로 명시적으로 근거가 남아 있다. 전역 상태·환경 변수·공개 시그니처·신규 네트워크 호출 관점에서 새로 발견된 문제는 없다.

## 위험도
LOW
