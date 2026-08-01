# 부작용(Side Effect) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 방법

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`model-config.service.spec.ts`, `triggers.service.spec.ts`,
`workflows.service.ts` 등)을 포함해 실제 코드베이스를 `Read`/`Grep` 으로 직접 열어 확인했다. 특히 관점 4(시그니처
변경)의 호출자 영향을 검증하기 위해 리포지토리 루트(`.`, `codebase/frontend`·`scripts`·`eval`·`test` 포함,
`node_modules` 제외)에서 4개 서비스(`ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService`)의
`create/update/remove/setDefault/duplicate` 호출부를 전수 grep 했고, `npx tsc --noEmit -p tsconfig.json`(spec 포함
전체 타입체크)를 직접 실행해 실측했다. `AuditLogsService.record()`(sink), `CurrentUser` 데코레이터, `AuditLogsModule`,
FK 제약(`migrations/V001__initial_schema.sql`)도 diff 밖이지만 직접 대조했다.

## 발견사항

- **[CRITICAL]** 신규 테스트 코드가 import 되지 않은 타입을 참조 — `tsc --noEmit` 은 잡지만 CI 게이트(lint/build/jest)
  어디서도 검출되지 않는, 이 PR 자신이 이미 한 번 "CRITICAL"로 판정하고 "복구했다"고 기록한 것과 동일한 결함 클래스의 재발
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:301` (직접 `Read`/`grep`/`tsc` 로 확인 —
    이 파일은 프롬프트 크기 제한으로 diff 가 생략되어 게이트 번호가 없다)
  - 상세: 이번 diff 의 test 커밋(`24d0db60a`)이 새로 추가한 `감사 로깅 — update 는 schedule.updated 를 남긴다`
    테스트가 `{ name: 'S2' } as unknown as UpdateScheduleDto` 를 참조하는데, 이 파일 상단 import 목록(1-11줄)에는
    `CreateScheduleDto` 만 있고 `UpdateScheduleDto` 는 어디에도 import 되어 있지 않다(`update-schedule.dto.ts` 는
    존재하고 `schedules.service.ts`/`schedules.controller.ts` 에서는 정상 import 됨 — 이 spec 파일만 빠짐). 직접
    `npx tsc --noEmit -p tsconfig.json` 을 실행해 `error TS2552: Cannot find name 'UpdateScheduleDto'. Did you mean
    'CreateScheduleDto'?` 를 재현했다(같은 실행에서 이 파일에 이 오류 1건 외 다른 오류는 없음). 그런데
    `npx jest src/modules/schedules/schedules.service.spec.ts` 를 직접 실행하면 **15/15 전부 통과**한다 —
    `tsconfig.json` 의 `isolatedModules:true`(저장소 자체 주석 `src/nodes/core/assert-end-reason-domain.type-fixture.ts:11`
    도 "backend ts-jest 는 isolatedModules 로 동작해 타입을 벗겨낼 뿐 체크하지 않는다"고 확인) 하에서 `ts-jest` 는
    파일 단위 트랜스파일만 하고 크로스파일 타입 해석을 하지 않으므로, 타입 단언(`as unknown as X`)은 런타임에 완전히
    소거되어 `UpdateScheduleDto` 라는 식별자가 실제로 존재하는지 여부와 무관하게 통과한다. `tsconfig.build.json` 은
    `**/*spec.ts` 를 exclude 하므로 `pnpm build` 도 못 잡는다.
    이 결함 클래스는 이번 PR 자신이 `review/code/2026/08/01/10_05_53/RESOLUTION.md` C1 에서 "서비스 시그니처에 필수
    `userId` 를 추가하면서 기존 spec 호출부 70곳을 갱신하지 않아 `tsc --noEmit` 이 TS2554 로 깨졌다. `tsconfig.build.json`
    이 `**/*spec.ts` 를 exclude 하고 ts-jest 는 `isolatedModules` 라 lint/unit/build 어느 게이트도 못 잡는다"로
    CRITICAL 판정하고 커밋 `f77c1e0de`("fix(test): 리뷰 C1 — spec 호출부 70곳에 userId 추가 (tsc --noEmit 복구)")로
    고쳤다고 기록한 바로 그 유형이다. 다만 그 복구 작업은 **기존** 호출부의 누락된 4번째 인자(`userId`)를 채우는
    것이었고, 이번에 발견한 건은 test 커밋(`24d0db60a`)이 처음부터 갖고 있던 **신규** 블록의 import 누락이라 그
    복구의 대상이 아니었다 — 즉 같은 커밋 체인 안에서 같은 결함 클래스가 검출망을 다시 한번 빠져나갔다.
    `RESOLUTION.md` 의 "TEST 결과" 절은 "타입체크: `tsc --noEmit` 에서 내 변경이 만든 오류 0건 (잔여는 `origin/main`
    대비 감소 확인)"이라고 명시적으로 기록하는데, 이 1건에 대해서는 그 서술이 사실이 아니다.
  - 제안: `schedules.service.spec.ts` 상단에 `import { UpdateScheduleDto } from './dto/update-schedule.dto';` 추가
    (1줄 수정으로 해결). 재발 방지로 `RESOLUTION.md` 가 이미 스스로 권고한 "`tsc --noEmit`(spec 포함)을 별도
    CI/pre-push 단계로 추가" 를 실제로 집행할 것 — 이번 사례가 그 권고의 필요성을 다시 한번 입증한다.

- **[WARNING]** `SchedulesService` ↔ `TriggersService` 상호 직접 쓰기가 신규 감사 커버리지의 사각지대 — 상대 리소스의
  create/update 는 audit_log 에 전혀 남지 않는다 (기존에 알려진 FK CASCADE 삭제 공백보다 범위가 넓음)
  - 위치:
    - `codebase/backend/src/modules/schedules/schedules.service.ts:162-170`(`create` — 연결 `Trigger` 를
      `triggerRepository.create`/`save` 로 직접 생성), `:213-223`(`update` — `trigger.name`/`trigger.isActive` 를
      직접 대입 후 `triggerRepository.save`), `:270`(`remove` — `triggerRepository.delete(schedule.triggerId)` 로
      직접 삭제)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:339`(`update` 가 `syncScheduleActivation` 호출)
      → `:827-846`(그 안에서 `schedule.isActive = isActive; await this.scheduleRepository.save(schedule);` 로
      `Schedule` 을 직접 갱신), `:870`(`remove` 의 `triggerRepository.remove(trigger)` — `schedule.trigger_id ...
      REFERENCES trigger(id) ON DELETE CASCADE`(`migrations/V001__initial_schema.sql:164`)로 연결 `Schedule` 행이
      DB 레벨에서 동반 삭제)
  - 상세: 이번 PR 의 목적 자체가 "설정·자동화의 변경 이력이 통째로 남지 않고 있었다"(CHANGELOG)는 감사 커버리지
    갭을 메우는 것인데, `SchedulesService` 와 `TriggersService` 는 서로의 리포지토리에 직접 접근해(상대 서비스의
    `recordAudit` 를 거치지 않고) 상대 테이블 row 를 생성·수정·삭제한다. 그 결과: (1) `SchedulesController.create`
    로 스케줄을 만들면 연결된 `Trigger` row 가 새로 INSERT 되지만 `trigger.created` 는 기록되지 않는다(오직
    `schedule.created` 만). (2) `SchedulesController.update` 로 스케줄 이름/활성 여부를 바꾸면 `Trigger.name`/
    `Trigger.isActive` 가 함께 바뀌지만 `trigger.updated` 는 없다. (3) 반대로 `TriggersController.update`(스케줄
    타입 트리거의 `isActive` 변경)는 `Schedule.isActive` 를 직접 갱신하지만 `schedule.updated` 는 없다 — 이 필드는
    실행 스케줄을 켜고 끄는 실질적 의미가 있는 값이다. (4) `TriggersController.remove` 로 스케줄 타입 트리거를
    지우면 FK CASCADE 로 `Schedule` row 가 사라지지만 `schedule.deleted` 는 없고, 반대로 `SchedulesController.remove`
    는 `Trigger` row 를 직접 지우면서 `trigger.deleted` 를 남기지 않는다. 이전 리뷰 라운드
    (`review/code/2026/08/01/10_05_53/architecture.md` INFO #3, `SUMMARY.md` 참고 #3)가 이미 (4)의 CASCADE-삭제
    절반만 "의도된 설계일 수 있으나 명문화되지 않음"으로 INFO 지적했지만, (1)-(3)의 직접 쓰기(생성·갱신) 경로는
    이번 검토에서 추가로 확인됐다 — CASCADE 삭제보다 범위가 넓다. 사후 감사 관점에서 "이 스케줄/트리거를 누가
    켜고 껐는가"를 추적하려는 사람은 어느 쪽 엔드포인트로 조작했는지에 따라 기록이 있거나 없는, 일관성 없는
    결과를 보게 된다.
  - 제안: 의도된 설계(루트 리소스만 기록)라면 `audit-action.const.ts` 혹은 `spec/data-flow/1-audit.md` 에
    "Schedule↔Trigger 는 1:1 결합 리소스라 어느 한쪽 엔드포인트로 조작해도 그 쪽 액션만 기록하고 상대는 기록하지
    않는다"를 명문화할 것. 그게 아니라면 `SchedulesService`/`TriggersService` 가 상대 테이블에 쓸 때도 상대측
    `recordAudit`(또는 동등한 `details` 부기)를 함께 호출하도록 보강 검토.

## 검토했으나 문제 없음으로 판단한 항목

- **시그니처 변경 전수 검증**: 4개 서비스의 `create/update/remove/setDefault/duplicate` 에 `userId` 가 추가된
  변경의 호출자 영향을 리포지토리 루트에서 전수 grep 했다 — 컨트롤러 4곳 외에 이 메서드들을 호출하는 지점은
  0건(다른 서비스가 이 4개를 주입하는 9곳도 확인했으나 어느 것도 mutating 메서드를 호출하지 않음). `tsc --noEmit`
  결과도 이 4개 서비스/컨트롤러/모듈 파일 자체에는 (위 스펙 파일 1건 제외) 오류가 없음을 확인했다.
- **인터페이스 변경**: 컨트롤러에 추가된 `@CurrentUser('sub') userId` 는 JWT 파생값이라 `@Body`/`@Query`/`@Param`
  로 노출되지 않고 Swagger 문서·응답 스키마에 영향이 없다(기존 `current-user.decorator.ts` 는 이번 diff 에서
  전혀 수정되지 않음을 `git diff` 로 확인).
- **콜백/이벤트 순서**: `ModelConfigService.notifyInvalidated()`(LLM 캐시 무효화 리스너, 리스너별 try/catch 격리)는
  동기 `void` 함수라 `await this.recordAudit(...)` 앞에서 그대로 실행되고, 신규 감사 호출이 그 타이밍·격리를
  바꾸지 않는다.
- **네트워크/환경변수/파일시스템**: 신규 코드 경로에 외부 네트워크 호출·`process.env` 읽기/쓰기·파일 I/O 는 없다.
  `AuditLogsService.record()`(diff 밖, 기존 파일)는 동일 Postgres 커넥션 풀에 대한 TypeORM INSERT 이며 실패를
  내부에서 삼킨다(기존 계약, 이번 diff 로 변경되지 않음).
  - `notification-config.dto.ts` 의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], ...)` →
    `@IsIn(NOTIFICATION_EVENT_TYPES, ...)` 변경도 타입 단언 제거일 뿐 런타임에 `class-validator` 가 받는 배열
    값은 동일해 검증 로직에 부작용이 없다.
- **모듈 순환 의존**: `AuditLogsModule` 은 `TypeOrmModule.forFeature` 외 의존이 없는 leaf 모듈이라, 4개 모듈에
  반복 import 되어도 순환을 만들지 않는다(`audit-logs.module.ts` 직접 확인).
- **이전 라운드 W6/W5 재검증**: "커밋~감사 사이에 실패 가능한 외부호출이 낌"(`triggers`/`schedules` 의 secret
  rotate·BullMQ 호출)과 "`recordAudit` 중복 호출"(`triggers` create/update 의 chatChannel 분기) 문제는 현재
  코드에서 각각 `recordAudit` 가 `save()` 직후로 이동했고(`schedules.service.ts:188`,`246`, `triggers.service.ts:262`,
  `344`), `let result = saved; ... result = refreshed;` 로 단일 호출 지점으로 통합되어 있음을 직접 재확인했다.

## 요약

새 감사 로깅 코드 자체(전역 변수·환경 변수·파일시스템·네트워크 호출)에서는 부작용이 발견되지 않았고, 시그니처
변경(`userId` 추가)의 호출자 영향도 리포지토리 전체를 대상으로 직접 실측해 프로덕션 호출부 누락이 없음을
확인했다. 다만 두 가지를 보고한다. 첫째, `schedules.service.spec.ts` 에 이번 diff 의 test 커밋이 추가한 블록이
`UpdateScheduleDto` 를 import 없이 참조해 `tsc --noEmit` 을 깨뜨리는데(직접 실행해 재현), `ts-jest` 의
`isolatedModules` 특성상 `jest` 는 통과하고 `pnpm build` 도 spec 을 제외해 못 잡는다 — 이 PR 이 이미 한 번
CRITICAL 로 판정하고 "복구했다"고 문서화한 것과 동일한 결함 클래스가 같은 커밋 체인 안에서 재발한 것이며,
`RESOLUTION.md` 의 "tsc 오류 0건" 서술을 사실과 다르게 만든다. 수정 자체는 import 1줄 추가로 사소하지만, 이
PR 의 자체 검증 기록(TEST 결과)의 신뢰성에 관한 문제라 CRITICAL 로 분류한다. 둘째, `SchedulesService`/
`TriggersService` 가 서로의 리포지토리에 직접 쓰기(생성·갱신·삭제)를 수행하면서 상대 리소스의 `recordAudit`
를 호출하지 않아, 어느 엔드포인트로 조작했는지에 따라 감사 기록이 있거나 없는 비일관성이 생긴다 — 이전
라운드가 이미 지적한 CASCADE-삭제 공백(INFO)보다 넓은 범위(생성·갱신 포함)이며, 이 PR 의 핵심 목적(완전한
변경 이력)에 직접 영향을 준다. 두 항목 모두 프로덕션 런타임을 즉시 깨뜨리지는 않으며(전자는 test-only 이고
전체 테스트는 통과, 후자는 기존부터 있던 리소스 결합 패턴이 감사 영역으로 확장되며 드러난 설계 공백) 수정
난이도도 낮다.

## 위험도

HIGH
