# Requirement Review — 감사 로깅 커버리지 갭 13개 액션 (workflow/trigger/schedule/model_config)

## 검토 컨텍스트

본 세션은 `audit-logging` 브랜치의 **N차 후속 리뷰**다. 동일 diff 에 대해 이미 3라운드 조치 이력이
있다 (`review/code/2026/08/01/10_05_53/RESOLUTION.md` — 1차 C1·C2, 2차 R2-C1/W4/W5/W6/W9/W11,
3차 문서 정정). 이번 검토는 그 조치가 실제로 소스에 반영됐는지 직접 재검증하고, 이전 라운드가 찾았으나
`RESOLUTION.md` 의 "조치"·"미조치 — 근거" 표 어디에도 흡수되지 않은 채 남은 항목을 재확인하는 데 집중했다.

`git diff origin/main...HEAD` 로 실제 변경 스코프를 19개 파일로 확정하고(`model-config`/`schedules`/
`triggers`/`workflows` 4모듈 + `audit-action.const.ts`), 각 서비스 전문을 직접 Read 했다. 아울러
`tsc --noEmit -p tsconfig.json` 을 직접 실행해 209건의 기존 오류를 확인했으나, 표본 검증(`SaveCanvasDto`
미import 4건, `mockTransactionManager.insert/update` 타입 오류 다건) 결과 전부 `origin/main` 에도
동일하게 존재하는 **사전 존재 오류**이며 이번 diff 의 hunk 범위(각 파일의 실제 변경 라인) 밖에 위치함을
직접 대조로 확인했다 — 이번 PR 이 새로 만든 `tsc` 오류는 없다(1·2차 라운드에서 두 번 재발했던 결함
클래스이므로 별도로 실측 재확인했음).

## 발견사항

- **[WARNING]** `SchedulesService` ↔ `TriggersService` 상호 직접 쓰기가 상대 리소스의 CRUD 감사를
  건너뛴다 — 두 모듈 docstring(`schedules.module.ts`/`triggers.module.ts`)이 각각 "`schedule.*`/
  `trigger.*` CRUD 감사 기록"을 명시하지만 실제로는 편도만 기록된다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `create()`(연결 Trigger
    row 를 `triggerRepository.create/save` 로 직접 생성, `trigger.created` 없음), `update()`(
    `trigger.name`/`trigger.isActive` 를 `triggerRepository.save(trigger)` 로 직접 변경, `trigger.updated`
    없음), `remove()`(`triggerRepository.delete(schedule.triggerId)` 로 직접 삭제, `trigger.deleted`
    없음). 대칭 지점: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `syncScheduleActivation()`(`scheduleRepository.save(schedule)` 로 `isActive` 직접 변경,
    `schedule.updated` 없음).
  - 상세: FK CASCADE 로 소멸하는 자매 리소스(예: Trigger 삭제 시 CASCADE 되는 Schedule row)의 미기록은
    이전 라운드가 이미 INFO 로 하향·수용했지만(`workflows.service.ts:254-263`류 패턴), 위 4곳은
    CASCADE 가 아니라 **애플리케이션 코드가 명시적으로 실행하는 두 번째 리소스의 INSERT/UPDATE/DELETE**
    라는 점에서 다르다. `spec/5-system/1-auth.md §4.1` 의 Planned 표·`audit-action.const.ts` 어디에도
    "1:1 결합 리소스는 주 리소스만 기록한다"는 설계 의도가 명문화돼 있지 않아, 현재 상태만으로는
    "CRUD 감사 기록"이라는 module 주석의 자기 서술과 실제 커버리지가 어긋난다.
  - 참고: 이 항목은 직전 라운드(`review/code/2026/08/01/10_49_18/SUMMARY.md` Warning #7)가 동일한
    근거로 이미 발견했으나, `review/code/2026/08/01/10_05_53/RESOLUTION.md` 의 "조치" 표에도
    "미조치 — 근거" 표(W1/W3/W4/W7[동시삭제 중복]/W8)에도 흡수되지 않았다 — RESOLUTION 의 `W7` 은
    이름이 같지만 내용이 다른 별개 이슈("동시 삭제 시 중복 `*.deleted` 감사 행")를 가리킨다. `plan/
    in-progress/spec-sync-auth-gaps.md` 에도 이 항목은 등재돼 있지 않다. 라운드 사이에서 트리아지가
    누락된 것으로 보인다.
  - 제안: (a) 의도된 설계(주 리소스만 기록)라면 `audit-action.const.ts` 상단 주석 또는
    `spec/data-flow/1-audit.md §1.1` 에 "Schedule↔Trigger 는 1:1 결합 리소스로 주 엔드포인트만 감사한다"
    를 명문화, 또는 (b) 4개 지점에 상대측 `recordAudit`(혹은 `details` 부기)를 보강. 어느 쪽이든
    `plan/in-progress/spec-sync-auth-gaps.md` 에 명시적으로 등재해 다음 라운드에서 또 유실되지 않게 할 것.

- **[WARNING]** `WorkflowsService.duplicate()` 가 `create()` 와 동일한 "트랜잭션 커밋 뒤 기록" 구조를
  갖지만, 그 불변식(W6 — 이번 PR 이 triggers/schedules 에 대해 직접 고친 바로 그 버그 클래스)을 고정하는
  순서·롤백 회귀 테스트가 `duplicate()` 에는 없다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` 의 `duplicate()`
    (`dataSource.transaction('REPEATABLE READ', ...)` 안에서 노드/엣지 insert, 트랜잭션 반환 뒤
    `recordAudit({..., action: AUDIT_ACTIONS.WORKFLOW_CREATED, details: { duplicatedFrom: id }})`
    호출) / 테스트 `codebase/backend/src/modules/workflows/workflows.service.spec.ts` 의
    `describe('duplicate', ...)` 블록 — `'duplicate 는 details.duplicatedFrom 으로 원본을 남긴다'`
    테스트 1건만 있고 호출 내용(details)만 단언, 순서·롤백은 미검증. 대조군: 바로 아래
    `describe('감사 로깅 (workflow.*)', ...)` 블록은 `create()` 전용으로 `order: string[]` 순서 고정
    테스트와 "트랜잭션이 실패하면 감사를 남기지 않는다" 롤백 테스트를 둘 다 갖는다.
  - 상세: 현재 구현 자체는 정확하다(직접 코드 대조로 커밋-후-기록 순서 확인). 그러나 향후 리팩터링이
    `duplicate()` 의 `recordAudit` 호출을 트랜잭션 콜백 안으로 옮기거나 실패 경로에서도 호출되게
    되돌려도 어떤 테스트도 RED 로 걸리지 않는다 — 이 PR 이 `triggers`/`schedules` 에서 실제로 겪은
    회귀(2차 라운드 R2-W9 로 별도 고정)와 같은 클래스의 사각지대가 `duplicate()` 한 곳에 남는다.
  - 참고: `review/code/2026/08/01/10_49_18/SUMMARY.md` Warning #12 가 동일 발견을 이미 보고했으나
    `RESOLUTION.md` 에 흡수되지 않았다.
  - 제안: `create()` 의 순서 고정(`order: string[]`)·롤백 테스트 패턴을 `duplicate()` 에도 대칭 추가.

- **[SPEC-DRIFT]** `spec/5-system/1-auth.md §4.1`(L414-436 Planned 표) · `spec/data-flow/1-audit.md
  §1.1`(L82-92 "여전히 미구현") · `spec/conventions/audit-actions.md §3`(L56-59 상태 컬럼 "미구현") ·
  `spec/2-navigation/2-trigger-list.md`(L182 `trigger.delete`, L252 `trigger.update` — 액션명 자체 오기,
  실제는 과거분사 `trigger.deleted`/`trigger.updated`) 4곳이 이번 PR 로 구현 완료된
  `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/
  deleted`, `model_config.create/update/delete/set_default` 13개 액션을 여전히 "Planned/미구현"으로
  서술한다.
  - 위치: 위 4개 spec 문서 (구체 라인은 각 문서 본문 참조. `2-trigger-list.md` 는 추가로 액션명 오탈자).
  - 상세: 코드가 옳고(구현 완료, `audit-action.const.ts` 상단 docstring·`AuditLogsModule` import·
    직접 확인한 4개 서비스의 `recordAudit` 호출부가 모두 일관) spec 표기만 낡았다 — `developer` 는
    `spec/` read-only 라 이 diff 로는 고칠 수 없는 영역이고, 실제로 `plan/in-progress/
    spec-sync-auth-gaps.md`(L18-22)에 "spec SoT 4곳 동기화 — planner 턴 필요"로 정확히 등재돼 있다.
    `impl-prep consistency(review/consistency/2026/08/01/09_11_58)` 도 사전에 동일 갭을 예견했다.
  - 제안: 코드는 유지하고 `project-planner` 턴에서 4곳을 **한 커밋**으로 동시 갱신 — ①
    `1-auth.md §4.1` Planned→구현 이동(`workflow.executed` 만 Planned 잔류), ②
    `data-flow/1-audit.md §1.1` 커버리지 갭 문단·Writer 표 갱신, ③ `conventions/audit-actions.md §3`
    상태 컬럼 "미구현"→"구현" 4행, ④ `2-navigation/2-trigger-list.md` L182/L252 액션명 오기 정정.
    (이미 tracked — 새 착수 지시가 아니라 재확인 기록.)

- **[INFO]** `SchedulesService.create()` 는 Trigger row 생성(`triggerRepository.save`)과 Schedule row
  생성(`scheduleRepository.save`)이 하나의 DB 트랜잭션으로 묶여 있지 않다(`schedules.service.ts` 의
  `create()`). 두 번째 저장이 실패하면 감사 기록도 전혀 없는 고아 Trigger row 가 남을 수 있다.
  - 상세: 이번 diff 는 기존 2단계 비-트랜잭션 저장 구조에 시그니처·감사 호출만 추가했을 뿐 구조
    자체를 바꾸지 않았다(사전 존재, 회귀 아님) — 이미 이전 라운드(10_49_18 INFO#12)가 같은 결론.
  - 제안: 조치 불요(이번 PR 범위 밖). 후속으로 `dataSource.transaction()` 으로 두 저장을 묶는 리팩터링
    고려(`WorkflowsService.create()` 가 선례).

## 검증 완료 항목 (참고 — 재확인, 신규 발견 아님)

- 4개 서비스(`model-config`/`schedules`/`triggers`/`workflows`) 의 `create`/`update`/`remove`(+
  `setDefault`/`duplicate`) 전부가 "DB 커밋 **직후**" 에 `recordAudit` 를 호출하도록 소스 레벨로
  확인됨 — `triggers`/`schedules` 의 W6 조치(2차 라운드)가 실제 반영돼 있고, 순서를 고정하는
  `order: string[]` 회귀 테스트도 `triggers.service.spec.ts`/`schedules.service.spec.ts` 양쪽에 존재.
- `remove()` 4곳 모두 TypeORM `remove()` 가 엔티티의 `id`/식별 필드를 지우는 부작용을 피하기 위해
  삭제 **전**에 값을 읽어두거나(`const { kind } = config`, `const { type } = trigger`) 함수 인자
  `id` 를 그대로 재사용하는 안전한 패턴을 씀 — "삭제 후 필드 읽기로 undefined 가 감사에 남는" 버그 없음.
- 컨트롤러→서비스 `userId` 배선 13곳(4모듈 create/update/remove(+setDefault)) 전수 직접 대조 —
  파라미터 순서 스왑 없음, 전부 `@CurrentUser('sub') userId` 또는 `user.sub` 로 정확히 전달.
- `notification-config.dto.ts` 의 감사 로깅과 무관한 hunk(2라운드 W6 지적)가 실제로 되돌려져
  `origin/main` 대비 diff 0줄임을 직접 확인.
- `schedules.service.spec.ts` 의 `UpdateScheduleDto` import 누락(2라운드 Critical, R2-C1)이 실제로
  추가돼 있음을 직접 확인. `tsc --noEmit` 재실행 결과 이 파일·`triggers`/`model-config` 관련 spec 은
  오류 0건(전체 209건은 전부 `workflows.service.spec.ts` 의 diff-hunk 밖 사전 존재 오류로 표본 검증).
- `TriggersService` 의 `chatChannel` 분기가 있어도 `recordAudit` 이 1회만 호출됨을 검증하는 회귀
  테스트(`'chatChannel 분기가 있어도 기록은 한 번이다 (W5 회귀)'`)가 실제 존재.
- `AUDIT_ACTIONS` 신규 13개 액션의 명명·시제가 `spec/conventions/audit-actions.md` §2 규약(과거분사
  기본 / CRUD 현재형 예외)과 정확히 일치 — `workflow/trigger/schedule` 과거분사, `model_config`
  현재형(`set_default` 부자연스러움 근거로 resource 단위 통일).
- `AuditLogsService.record()` 가 실패를 삼키는(fail-open) 계약이 `audit-logs.service.ts:68-97` 에서
  확인되어, 4개 서비스의 `await recordAudit(...)` 가 주 mutation 성공을 위협하지 않음.
- TODO/FIXME/HACK/XXX 주석 — 19개 대상 파일 전수 grep 0건.

## 요약

핵심 요구사항(4모듈 CRUD 13개 액션의 감사 로깅 구현)은 소스 레벨에서 정확히 충족돼 있고, 이미 3라운드에
걸쳐 다수의 Critical/Warning 이 실제로 조치됐음을 이번 세션에서 직접 재검증했다(빈 손으로 믿지 않고
`tsc`·grep·diff·전문 Read 로 재확인). 다만 두 항목이 직전 라운드(10_49_18)에서 이미 발견됐음에도
`RESOLUTION.md`의 조치/미조치 표 어느 쪽에도 흡수되지 않은 채 남아 있다 — (1) Schedule↔Trigger
상호 직접 쓰기가 상대 리소스의 CRUD 감사를 누락시키는 사각지대, (2) `duplicate()` 의 커밋-후-기록
불변식을 지키는 회귀 테스트 부재. 둘 다 활성 데이터 손상이나 보안 결함은 아니지만 "CRUD 감사 기록"
이라는 모듈 주석의 자기 서술과 실제 커버리지 사이의 괴리이며, 라운드 간 트리아지 누락 자체도 재발
방지가 필요하다. 추가로 spec SoT 4곳의 [SPEC-DRIFT](이미 `plan/in-progress/spec-sync-auth-gaps.md`
에 planner 턴 대기 중으로 정확히 추적됨)를 재확인했다 — 코드가 아니라 문서 갱신이 남은 항목이다.

## 위험도

LOW — Critical 없음. 위 WARNING 2건은 완전성·회귀-방지 갭이며 활성 버그·보안·데이터 무결성 위협은
아니다. SPEC-DRIFT 는 이미 추적 중인 문서 동기화 후속 작업이다.
