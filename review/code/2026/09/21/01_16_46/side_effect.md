# 부작용(Side Effect) 리뷰 — `SchedulesService` 동시 DELETE 중복 감사 수정 (최종 라운드, 01_16_46)

## 검토 범위

`git diff origin/main...HEAD -- codebase/` 로 실제 코드 변경을 재확인했다: `codebase/backend/src/modules/schedules/schedules.service.ts`, `schedules.service.spec.ts`, 신규 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` 세 파일뿐이다. `CHANGELOG.md`·`plan/in-progress/*.md`·`review/code/2026/09/21/{00_06_01,00_37_06,00_56_52}/**`·`review/consistency/2026/09/20/23_37_12/**` 는 문서/이전 라운드 산출물이라 부작용 표면이 없다.

이 PR 은 이미 세 라운드(00_06_01 → 00_37_06 → 00_56_52)의 side_effect 리뷰를 거쳤고 매 라운드 위험도 LOW, WARNING/CRITICAL 없음으로 수렴해 왔다. 직전 라운드(00_56_52) 이후 추가된 유일한 변경은 커밋 `210808701`(테스트 전용 — `affected` 가 `undefined`/`null` 인 대조군 테스트 2건 추가)이며, `schedules.service.ts`(프로덕션 코드)는 건드리지 않았다. 아래는 그 사실을 실측으로 재확인하고, 세 라운드가 이미 짚은 항목들을 재확인한 결과다.

## 발견사항

- **[INFO]** 이번 라운드가 더한 변경은 테스트 전용이며 프로덕션 부작용 표면을 넓히지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:827`(`삭제 — affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다 (트리거 경로)`), `:848`(`삭제 — 같은 대조군 (triggerId 없는 방어 분기)`)
  - 상세: `git show --stat 210808701` 로 확인 — 변경 파일은 `schedules.service.spec.ts`(테스트) + 직전 라운드(`00_56_52`) 리뷰 산출물 커밋뿐이고 `schedules.service.ts` 는 diff 에 없다. 두 신규 `it()` 블록은 `for (const affected of [undefined, null])` 루프 매 반복마다 `triggerLockEvents.length = 0`/`auditLogs.record.mockClear()` 로 상태를 초기화하므로 반복 간 오염이 없고, `mockResolvedValueOnce` 큐도 매 반복 새로 채워 이전 반복의 잔여를 소비하지 않는다. 순수 테스트 격리 확인이며 실행 시 실제 프로세스 상태(전역 변수·파일·네트워크)에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 형태 불변) 동시 DELETE 의 "진 쪽" 응답이 204 → 404 로 바뀌는, 이 PR 목적 자체인 관측 가능한 API 동작 변화
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:342`(락 안 트리거 삭제 `affected` 판정), `:380`(`triggerId` 없는 방어 분기의 스케줄 행 `affected` 판정)
  - 상세: 세 차례의 이전 side_effect 라운드(00_06_01/00_37_06/00_56_52)가 동일하게 식별했고, 이번 라운드가 재확인한 최종 코드에서도 판정 지점·조건(`affected === 0`)이 동일하다. `DELETE /api/schedules/:id` 컨트롤러(`schedules.controller.ts`)는 이번 diff 밖이며 예외를 그대로 전파해 `GlobalExceptionFilter` 가 404 로 매핑한다 — 공개 HTTP 인터페이스의 관측 가능한 계약 변화이지만 CHANGELOG·plan·e2e·형제 PR(#1369·#1370) 세 층위로 의도가 명시돼 있다.
  - 제안: 조치 불요 — 의도된 변경. `spec/2-navigation/3-schedule.md §4` 서술 격차는 `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` 에 이미 등재.

- **[INFO]** (재확인) `NotFoundException` 발생 시 `Logger.error` 를 건너뛰는 로깅 억제
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:348`(`if (err instanceof NotFoundException) throw err;`)
  - 상세: 동시 삭제로 인한 정상 404 는 "반쯤 삭제된 상태 — 수동 정리 필요" 경보를 남기지 않도록 조기 rethrow 한다. 로그 기반 알림이 이 문구를 정확 매치로 쓰고 있었다면 발생 빈도가 줄어드는 관측 가능한 변화이나, 거짓 경보 제거가 목적이며 테스트(`schedules.service.spec.ts` 락 안 0행 테스트)가 `expect(error).not.toHaveBeenCalled()` 로 이 계약을 고정한다.
  - 제안: 조치 불요.

- **[INFO]** (재확인) `triggerId` 없는 방어 분기의 삭제 API 전환(`remove(entity)` → `delete(criteria)`) — 현재 도달 불가
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:371`(if 분기, 여전히 `scheduleRepository.remove(schedule)`) vs `:375-378`(else 분기, `scheduleRepository.delete({ id, workspaceId })`)
  - 상세: 두 분기가 서로 다른 TypeORM 삭제 API(엔티티 기반 vs criteria 기반)를 탄다. `Schedule` 엔티티(`schedule.entity.ts`) 를 직접 열어 재확인 — `@BeforeRemove`/`@AfterRemove` 등 lifecycle 훅이 없고, 관계에 `cascade: true`(애플리케이션 레벨 cascade) 옵션도 없어(둘 다 `onDelete: 'CASCADE'` 는 DB FK 레벨일 뿐) `remove()`↔`delete()` 전환이 훅 실행이나 관계 cascade 동작을 바꾸지 않는다. `triggerId` 컬럼은 `nullable` 미지정(NOT NULL) 이라 이 분기 자체가 현재 도달 불가능한 방어 코드다.
  - 제안: 조치 불요 — 스키마가 nullable 로 바뀌거나 엔티티에 lifecycle 훅/cascade 관계가 추가되는 시점에만 재검토(주석에 "현재 도달 불가" 명시돼 추적 가능).

- **[INFO]** (재확인) BullMQ `removeJob()` 이중 호출은 이 diff 의 신규 부작용이 아니라 advisory lock 이전(락 밖)에 위치한 기존 잔여
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:311`(`await this.scheduleRunnerService.removeJob(schedule.id);`) — 잠금 없는 `findById` 직후, 트랜잭션 진입 전
  - 상세: 겹치는 두 DELETE 요청 모두 이 외부(BullMQ) 호출을 각자 실행한다(되돌릴 수 없는 부작용). `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 절에 형제 PR(#1369·#1370)과 동일한 잔여로 명시적으로 defer 근거가 남아 있다.
  - 제안: 조치 불요 — 신규 결함 아님.

## 확인한 항목 (부작용 없음)

- 전역 변수·모듈 스코프 상태 신규 도입/수정 없음 — `throwScheduleNotFound()` 는 클래스 private 메서드(`schedules.service.ts:151`).
- 공개 메서드 시그니처 변경 없음 — `remove(id, workspaceId, userId): Promise<void>`, `findById(id, workspaceId): Promise<Schedule>` 모두 파라미터·반환 타입 불변, 호출부(`schedules.controller.ts:150` 등) 무영향. `throwScheduleNotFound()` 추출은 동일한 `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Schedule not found'})` 페이로드를 던지는 순수 내부 리팩터링.
- 환경 변수 신규 읽기/쓰기 없음 — e2e 의 `process.env.E2E_BASE_URL` 참조는 형제 e2e 파일(trigger/workflow/workspace-delete-concurrency)과 동일한 기존 패턴.
- 신규 외부 네트워크 호출 없음 — 기존 BullMQ(`scheduleRunnerService.removeJob`)·DB(TypeORM)·secrets(`deleteTriggerSecretsAfterCommit`) 호출 경로 재사용, 새 서비스 연동 없음.
- 이벤트/콜백 발생 순서 변경 없음 — `recordAudit` 호출 위치·조건은 기존과 동일한 자리(트랜잭션 커밋 후 성공 경로에서만 도달)이며, 그 도달 조건이 `affected` 판정으로 더 엄격해졌을 뿐 순서 자체는 그대로다.
- `manager.transaction()` 콜백 안에서 던진 `NotFoundException` 은 TypeORM 표준 동작대로 롤백 후 재-throw 되고, 트랜잭션 범위 advisory lock(`pg_advisory_xact_lock`)도 트랜잭션 종료 시 자동 해제된다 — 락 누수 없음(e2e 가 `[204, 404]` 로 실측 확인).
- `git diff origin/main...HEAD --stat -- codebase/` 로 코드 변경이 정확히 3개 파일(서비스·스펙·신규 e2e)에 국한됨을 재확인 — drive-by 포맷팅이나 무관 코드 변경 없음.
- 리뷰 중 저장소 파일에 뮤테이션을 가하지 않았다(Read/grep/git diff/git show 만 사용) — `git status --short` 결과 이 리뷰 산출물 디렉터리(`review/code/2026/09/21/01_16_46/`) 외 변경 없음.

## 요약

이번 최종 라운드에서 직전 라운드(00_56_52) 이후 추가된 유일한 변경(`210808701`)은 프로덕션 코드를 건드리지 않는 테스트 전용 커밋(대조군 테스트 2건)이라, 세 차례 반복 검증돼 온 side_effect 결론을 바꾸지 않는다. 유일하게 관측 가능한 외부 인터페이스 변화(동시 DELETE 진 쪽 204→404)는 이 PR 의 의도된 목적이며 CHANGELOG·plan·e2e·유닛 테스트 네 층위로 근거가 고정돼 있다. 전역 상태·환경 변수·공개 시그니처·신규 네트워크 호출·이벤트 순서 관점에서 새로 발견된 문제는 없으며, `remove()`↔`delete()` API 전환·BullMQ 이중 호출 등 기존에 식별된 항목도 모두 재확인 결과 그대로 INFO 수준으로 유지된다. Critical/Warning 급 신규 부작용은 발견되지 않았다.

## 위험도

LOW
