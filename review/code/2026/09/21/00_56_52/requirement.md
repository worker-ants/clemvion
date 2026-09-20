# 요구사항(Requirement) 리뷰 — schedule-dup-delete (3라운드, 00_56_52)

## 검토 범위 및 방법

이 세션은 이미 두 차례 리뷰(`review/code/2026/09/21/00_06_01`, `review/code/2026/09/21/00_37_06`)를 거쳐 발견된
Warning 6건(1라운드 4건 + 2라운드 2건)이 모두 커밋(`893dfeb7a`·`69889f74e`·`131296205`·`2879e88c7`)으로 조치된
뒤의 상태다. 이번 라운드는 그 조치가 실제로 반영됐는지, 그리고 핵심 기능 변경 자체가 요구사항·spec 과
line-level 로 일치하는지를 `Read`/`Grep` 으로 원본 파일을 직접 열어 재검증했다(저장소 뮤테이션 없음 —
`git status --short` 로 확인, 이 세션이 새로 쓴 `review/code/2026/09/21/00_56_52/` 외 변경 없음).

실질적인 기능 변경은 3개 파일이다: `codebase/backend/src/modules/schedules/schedules.service.ts`,
`codebase/backend/src/modules/schedules/schedules.service.spec.ts`,
`codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`. 나머지(`CHANGELOG.md`, `plan/**`,
`review/**`)는 문서·이전 리뷰 산출물이다.

## 확인한 것 (실물 대조)

- `SchedulesService.remove()`(`schedules.service.ts:308-388`, 전체 Read 로 확인): `findById`(락 없음) →
  `removeJob`(락 밖) → `triggerId` 있으면 트랜잭션+advisory lock(`acquireTriggerConfigLock`) 안에서
  `m.delete(Trigger, triggerId)` 의 `affected` 를 **`=== 0` 명시 비교**로 판정 → 0 이면
  `throwScheduleNotFound()`(트랜잭션 롤백) → `.catch` 에서 `NotFoundException` 만 조용히 재던짐(그 외는
  "반쯤 삭제된 상태" 로그 후 재던짐) → 비밀 정리 → 방어적 `scheduleRepository.remove(schedule)`(CASCADE
  로 0행 no-op) → `triggerId` 없으면(엔티티 NOT NULL 이라 현재 도달 불가) `scheduleRepository.delete` 의
  `affected` 를 같은 방식(`=== 0`)으로 판정 → 마지막에 `recordAudit(SCHEDULE_DELETED)`. 두 분기 모두
  0-affected 시 감사·비밀정리를 건너뛰고 즉시 404 로 끝나 "동시 DELETE 두 건이 감사를 두 번 남긴다"는
  원 결함을 정확히 닫는다.
- **2라운드 WARNING 2(concurrency) 조치 확인**: 트리거 판정(`:342`)·방어 분기 판정(`:380`) 두 곳 모두
  `!affected` 가 아니라 `affected === 0` 로 바뀌어 있다 — `null`/`undefined`("모른다")를 "없다"로 오판하지
  않는다는 근거(`rewriteTriggerConfigLocked`, `trigger-config-lock.ts:255`)와 정확히 일치.
- **2라운드 WARNING 1(documentation) 조치 확인**: `CHANGELOG.md:66-67` 에 트리거 항목의 "남는 것" 문단
  끝에 "**2026-09-21 해소**: 위 스케줄 항목이 그 잔여를 닫았다..." 각주가 원문을 보존한 채 추가돼 있다 —
  인접 모순이 해소됐다.
- **1라운드 WARNING 3(maintainability) 조치 확인**: `throwScheduleNotFound(): never` 헬퍼(`:151-156`)가
  `findById`(`:141`)·트리거 삭제 판정(`:342`)·방어 분기 판정(`:380`) 세 곳 모두에서 호출된다 — 리터럴
  3중 복제가 헬퍼 추출로 정리됨. 형제 `triggers.service.ts` 의 `throwTriggerNotFound()` 와 이름·형태 일치.
- **1라운드 WARNING 4(documentation) 조치 확인**: `CHANGELOG.md` 최상단(`:3-37`)에 형제 항목(#1369·
  #1370)과 동일한 4단 구성(문제 → 판별자 차이 → 고친 것 → 판별력 실측 → 남는 것)으로 항목이 추가돼 있다.
- **1라운드 WARNING 1·2(testing) 조치 확인**: `schedules.service.spec.ts:778-816`(트리거 삭제 0행 →
  404·감사·비밀정리·`scheduleRepo.remove` 미호출 단언), `:896-918`(`triggerId` 없는 분기의 0-affected
  → 404 대조 테스트, `auditLogs.record`·`triggerRepo.delete` 미호출 단언)가 실제로 존재하고, 성공 경로
  테스트(`:736-769`)에도 `expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)` 단언이 추가돼
  있다. `DeleteResult` 타입(`typeorm`)이 import 돼 있고 mock (`triggerRepo.delete`, `scheduleRepo.delete`)
  모두 `{ affected: n }` 형태로 통일 — plan 이 주장한 "build 가 타입 오류를 잡았다"는 서술과 일치하는
  계약 형태다.
- `Schedule.triggerId` 관련 방어 분기(`:373-381`)가 "NOT NULL 이라 현재 도달 불가"라고 주석에 적은 것은
  실측과 일치 — `schedule.entity.ts` 의 `triggerId` 컬럼에 `nullable` 옵션이 없다.
- e2e 신규 파일이 참조하는 심볼(`triggerConfigLockKey`, `createDbClient`/`uniqueEmail`/`uniqueName`,
  `registerAndLogin`/`createTeamWorkspace`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`)이 모두 실제로 존재하고
  시그니처가 일치한다. `deleteTriggerSecretsAfterCommit(secrets, logger, [triggerId], caller)` 호출부도
  헬퍼 시그니처와 일치.
- TODO/FIXME/HACK/XXX 계열 미완성 마커 없음(대상 3개 코드 파일 grep 결과 0건).
- 모든 경로에서 반환값(`Promise<void>` 계약)이 명시적으로 지켜진다 — 정상 경로는 마지막 `recordAudit`
  까지 완주 후 암묵적 `undefined` 반환, 실패 경로는 예외로 귀결한다. 누락된 경로 없음.

## Spec fidelity

- `spec/2-navigation/2-trigger-list.md §4.3`(297-313행)은 "**트리거 행을 없애는 모든 경로**"에 트리거
  화면 삭제·**스케줄 화면 삭제**·워크플로/워크스페이스 삭제를 명시적으로 포함시키고, 외부 자원(schedule
  BullMQ job)이 "행 삭제 전, DB 트랜잭션 밖"에서 정리돼야 한다는 시점 표를 두고 있다. §4.4(315-320행)는
  "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"와 락
  대기 상한 5초를 명시하며, 그 문단 자체가 "스케줄 화면 삭제는 BullMQ job 해제"를 같은 계약의 적용
  대상으로 나열한다. 즉 이 spec 은 **트리거 행을 지우는 축을 기준으로 서술**돼 있고, 스케줄 화면
  삭제는 그 코드 경로상 실제로 트리거 행(`m.delete(Trigger, triggerId)`)을 지우므로 이 일반 계약의
  적용 대상이다. 구현(`removeJob` 을 락 밖·행 삭제 전에 실행, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`=5000ms
  로 락 대기 상한, 0-affected 시 `404 RESOURCE_NOT_FOUND`)은 이 일반 계약과 line-level 로 일치한다.
- `spec/2-navigation/3-schedule.md §4`(133-144행, API 표)는 `DELETE /api/schedules/:id` 를 "삭제" 한
  줄로만 서술하고 "동시 삭제 → 두 번째 404" 를 스케줄 축 자신의 문서에 직접 적어 두지 않는다. 이는
  새 결함이 아니라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4795`(문서상 실제
  줄 번호로 grep 확인)에 등재돼 있고, 이번 diff(파일 6)가 그 스코프에 `3-schedule.md §4` 를 실제로
  추가한 것도 확인했다 — **[SPEC-DRIFT] 아님**(spec 이 명백히 낡은 것이 아니라, 트리거 축 spec 이
  일반화된 계약을 이미 담고 있어 스케줄 축 문서 자체의 침묵은 완전성 격차이지 구현 불일치가 아니다).

## 발견사항

- **[INFO]** `spec/2-navigation/3-schedule.md §4` 자신은 "동시 삭제 → 두 번째 요청 404" 계약을 서술하지
  않는다(침묵, 모순 아님)
  - 위치: `spec/2-navigation/3-schedule.md:142` (`| DELETE | /api/schedules/:id | 삭제 |`)
  - 상세: 위 "Spec fidelity" 절에서 확인했듯 `2-trigger-list.md §4.3/§4.4` 가 "트리거 행을 없애는 모든
    경로"(스케줄 화면 삭제 포함)에 이 계약을 일반화해 담고 있고 구현이 그 일반 계약과 정확히 일치하므로
    **구현 결함이 아니다**. 다만 `3-schedule.md` 자신의 API 표에는 그 사실이 반영돼 있지 않아 그 문서만
    보는 독자에게는 계약이 안 보인다. 이미 트래커에 등재돼 있고 이번 세션이 스코프를 확장했다.
  - 제안: 조치 불요(이미 추적 중). 트래커 항목 처리 시 `project-planner` 가 §4 에 트리거 목록과 대칭되는
    한 문장을 추가하면 된다. 본 reviewer 는 spec 을 직접 수정하지 않는다.

- **[INFO]** 공유 트래커의 `SchedulesService.remove()` 항목이 여전히 `- [ ]`(미해소)로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`SchedulesService.remove() 도
    동시 삭제에서...` 항목, `- [ ]` 로 시작하는 불릿)
  - 상세: 이 PR 이 실제로 그 결함을 닫았음에도(위 확인 내용 참조) 트래커 체크박스와 "해소" 각주가 아직
    없다. 다만 `plan/in-progress/schedule-dup-delete.md` 자신의 체크리스트에도 "트래커 항목 해소 + 이
    plan `plan/complete/` 로"가 `- [ ]` 로 명시돼 있어, 세션 마무리 단계에서 처리될 **의도된 미완료
    상태**로 보인다(형제 plan `trigger-dup-delete.md` 가 트래커에 "2026-09-20 해소" 각주를 남긴 것과
    같은 패턴을 마무리 커밋에서 반복하면 된다).
  - 제안: 조치 불요 — 세션 마무리(`plan/complete/` 이동) 커밋에서 트래커 항목에 `[x]` + 해소 각주를
    남길 것. 지금 단계에서 차단 사유 아님.

- **[INFO]** `triggerId` 없는 방어 분기(`schedules.service.ts:373-381`)는 엔티티 제약상 현재 도달
  불가한 죽은 코드
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:373-381`
  - 상세: `Schedule.triggerId` 가 NOT NULL 이라 실제 운영 경로에서 이 분기가 실행될 일은 없다. 코드
    주석·plan·테스트(대조군 2건, `:862-886`·`:896-918`) 모두 이 사실을 일관되게 명시하고 실행 검증까지
    갖춰 오해의 소지는 없다.
  - 제안: 조치 불요 — 현행 유지, `triggerId` 가 nullable 로 바뀌는 스키마 변경 시 재검토.

CRITICAL 은 없다. 이전 두 라운드에서 발견된 Warning 6건 전부 커밋 히스토리·현재 소스·테스트 assertion
을 직접 대조해 실제로 해소됐음을 확인했고(주장뿐 아니라 실물 확인), 새로 도입된 결함은 찾지 못했다.

## 요약

`SchedulesService.remove()` 의 동시 DELETE 중복 감사 수정은 형제 PR(#1369 워크플로/워크스페이스, #1370
트리거)이 확립한 "advisory lock + 락이 보호하는 실제 쓰기의 `affected` 를 판별자로" 패턴을,
`schedule.trigger_id → trigger` 의 `ON DELETE CASCADE` 때문에 판정 기준이 달라지는 네 번째 자리에
정확히 확장한 구현이다. 기능 완전성(트리거 있음/없음 두 분기, 0/1 affected 양쪽 모두 유닛 테스트로
실행 검증됨), 엣지 케이스(`affected` 의 `null`/`undefined` vs `0` 을 명시 비교로 구분), 에러 시나리오
(`NotFoundException` 조기 분리로 거짓 경보 방지), 반환값(모든 경로가 명시적으로 완주 또는 404 예외로
귀결), 비즈니스 로직(CASCADE 로 인한 판정 대상 전환)이 모두 코드·테스트·CHANGELOG·plan 문서에서 일관
되게 확인된다. 이전 두 리뷰 라운드가 지적한 Warning 6건은 모두 실물 대조로 조치 완료가 확인됐다. Spec
쪽은 `2-trigger-list.md §4.3/§4.4` 의 일반화된 계약(트리거 행을 없애는 모든 경로 — 스케줄 화면 삭제
포함)과 코드가 line-level 로 일치하며, `3-schedule.md` 자신의 API 표에 그 계약이 반영돼 있지 않은 것은
새 결함이 아니라 이미 트래커에 등재되고 이번 세션이 스코프를 확장한 알려진 문서 완전성 격차다. CRITICAL
없음, 신규 WARNING 없음.

## 위험도

NONE
