# 요구사항(Requirement) 리뷰 — schedule-dup-delete (재검토 라운드 00_37_06)

## 검토 범위

이번 라운드는 이전 리뷰(`review/code/2026/09/21/00_06_01`)의 WARNING 4건(#1~#4)에 대한
`resolution-applier` 조치(`893dfeb7a`·`69889f74e`·`131296205`) 및 그 RESOLUTION 기록
(`030299603`)까지 포함한 diff다. 실질적인 기능 변경은 3개 파일 — `schedules.service.ts`,
`schedules.service.spec.ts`, 신규 `schedule-delete-concurrency.e2e-spec.ts` — 이고, 나머지
(`CHANGELOG.md`, `plan/**`, `review/**`)는 문서·산출물이다. `Read`/`Grep` 로 각 파일의
현재 상태를 직접 열어 diff 주석의 주장과 대조했다(저장소 뮤테이션 없음 — `git status --short`
로 확인, 이 세션이 새로 쓴 `review/code/2026/09/21/00_37_06/` 외 변경 없음).

## 확인한 것

- `SchedulesService.remove()` (`schedules.service.ts:308-383`): `findById`(락 없음) →
  `removeJob`(락 밖, 되돌릴 수 없음) → `triggerId` 있으면 트랜잭션+advisory lock 안에서
  `m.delete(Trigger, triggerId)` 의 `affected` 를 판별자로 0이면 `throwScheduleNotFound()`
  → `.catch` 에서 `NotFoundException` 만 조용히 재던짐(그 외는 에러 로그 후 재던짐) →
  비밀 정리 → 방어적 `scheduleRepository.remove(schedule)`(CASCADE 로 0행 no-op) →
  `triggerId` 없으면(엔티티 NOT NULL 이라 현재 도달 불가) `scheduleRepository.delete` 의
  `affected` 로 같은 방식 판정 → 마지막에 `recordAudit(SCHEDULE_DELETED)`. 두 분기 모두
  0-affected 시 감사·비밀정리를 건너뛰고 즉시 404 로 끝나 "동시 DELETE 두 건이 감사를
  두 번 남긴다" 는 원래 결함을 정확히 닫는다.
- `Schedule.triggerId` 컬럼(`schedule.entity.ts:25-26`)에 `nullable` 옵션이 없어 NOT NULL —
  "방어 분기는 현재 도달 불가" 주석·plan 서술이 실측과 일치.
- `triggerConfigLockKey`, `createDbClient`/`uniqueEmail`/`uniqueName`,
  `registerAndLogin`/`createTeamWorkspace`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5_000ms) —
  e2e 신규 파일이 참조하는 모든 심볼이 실제로 존재하고 시그니처가 일치한다.
  `deleteTriggerSecretsAfterCommit(secrets, logger, triggerIds, caller)` 호출부도 헬퍼
  시그니처와 정확히 일치한다.
- 직전 라운드 WARNING #1·#2(테스트 미검증 방어 분기 2곳)는 `893dfeb7a` 로 실제 추가된
  테스트(`schedules.service.spec.ts:772`, `:893`)가 각각 `affected:0` mock 을 주입해 404
  reject·감사 미호출·비밀정리 미실행을 단언한다 — plan 이 주장한 "유효 뮤턴트 확인"과
  일치하는 형태다.
- WARNING #3(`NotFoundException` 리터럴 3중 복제)는 `throwScheduleNotFound(): never` 헬퍼
  (`schedules.service.ts:151-156`)로 추출되어 `findById`(141행)·트리거 삭제 판정(338행)·
  방어 분기 판정(375행) 세 곳 모두가 호출한다.
- WARNING #4(CHANGELOG 누락)는 `131296205` 로 형제 항목(#1369·#1370)과 동일한 4단 구성
  (문제→판별자 차이→고친 것→판별력 실측→남는 것)으로 `## Unreleased` 최상단에 추가됐다.
- **spec fidelity**: `spec/2-navigation/3-schedule.md` §4 는 `DELETE /api/schedules/:id` 를
  "삭제" 한 줄로만 서술하고 동시 삭제 시 두 번째 요청의 404 계약을 언급하지 않는다. 반면
  `spec/2-navigation/2-trigger-list.md:318` 은 "동시 삭제: 두 클라이언트가 동시에 같은
  트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 를 명시한다. 코드는 트리거 목록의
  이 계약(`RESOURCE_NOT_FOUND`)을 스케줄 축에도 그대로 적용했으므로 **코드는 기존 정책과
  정합**이다. 스케줄 spec 문서 쪽의 서술 침묵은 이 PR 이 새로 만든 갭이 아니라
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있고, 이번
  diff(파일 6)가 그 트래커 스코프에 `3-schedule.md §4` 를 실제로 추가한 것도 확인했다.
- TODO/FIXME/HACK/XXX 계열 미완성 마커 없음(대상 3개 코드 파일 grep 결과 0건).

## 발견사항

- **[INFO]** `spec/2-navigation/3-schedule.md` §4 는 여전히 "동시 삭제 → 두 번째 요청 404"
  계약을 서술하지 않는다(spec 침묵, 모순 아님)
  - 위치: `spec/2-navigation/3-schedule.md:142` (`| DELETE | /api/schedules/:id | 삭제 |`)
  - 상세: 코드 구현은 형제 트리거 목록 §4.4 의 기존 정책(두 번째 요청 404)을 스케줄 축에
    정확히 확장했으나, 그 사실을 담을 spec 본문 자체는 아직 갱신되지 않았다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 트래커에 등재돼 있고
    이번 세션이 그 스코프에 `3-schedule.md §4` 를 새로 추가했다 — 새 결함이 아니라 알려진
    문서 격차의 연속.
  - 제안: 조치 불요(이미 추적 중). 트래커 항목 처리 시 `project-planner` 가 §4 에 트리거
    목록과 대칭되는 한 문장을 추가하면 된다. 본 reviewer 는 spec 을 직접 수정하지 않는다.

- **[INFO]** `triggerId` 없는 방어 분기(`schedules.service.ts:368-376`)는 엔티티 제약상 현재
  도달 불가한 죽은 코드
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:368-376`
  - 상세: `Schedule.triggerId` 가 NOT NULL 이라 실제 운영 경로에서 이 분기가 실행될 일은
    없다. 코드·주석·plan·테스트 넷이 모두 이 사실을 일관되게 명시하고 있어 오해의 소지는
    없다. `triggerId` 가 nullable 로 바뀌는 시점에 재검토가 필요하다는 점만 기록.
  - 제안: 조치 불요 — 현행 유지, 스키마 변경 시 재검토.

CRITICAL 은 없다. 이전 라운드 WARNING 4건은 커밋 히스토리·현재 소스·테스트 assertion 을
직접 대조해 실제로 해소됐음을 확인했고(주장뿐 아니라 실물 확인), 새로 도입된 결함은
찾지 못했다.

## 요약

`SchedulesService.remove()` 의 동시 DELETE 중복 감사 수정은 형제 PR(#1369 워크플로/워크스페이스,
#1370 트리거)이 확립한 "advisory lock + 락이 보호하는 실제 쓰기의 `affected` 를 판별자로" 패턴을,
`schedule.trigger_id → trigger` 의 `ON DELETE CASCADE` 때문에 판정 기준이 달라지는 스케줄 축에
정확히 확장한 구현이다. 기능 완전성(트리거 있음/없음 두 분기, 0/1 affected 양쪽), 에러 시나리오
(`NotFoundException` 조기 분리로 거짓 경보 방지), 반환값(모든 경로가 명시적으로 204 완주 또는
404 예외로 귀결), 테스트 커버리지(직전 라운드가 지적한 미검증 방어 분기 2곳도 뮤턴트로 판별력
확인된 테스트로 보강)가 모두 확인됐다. spec 쪽은 `2-trigger-list.md §4.4` 의 기존 "두 번째 요청
404" 정책과 코드가 line-level 로 일치하며, `3-schedule.md` 자체의 서술 침묵은 새 결함이 아니라
이미 트래커에 등재된 알려진 문서 격차다. CRITICAL 없음, 신규 WARNING 없음.

## 위험도

NONE
