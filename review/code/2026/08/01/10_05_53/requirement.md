# 요구사항(Requirement) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위

`spec/5-system/1-auth.md §4.1` Planned 카탈로그가 약속한 감사 로깅 커버리지 갭(`workflow.*`/`trigger.*`/
`schedule.*`/`model_config.*`, `workflow.executed` 제외 13개 액션)을 4개 서비스
(`ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService`)에 구현한 diff. 컨트롤러에
`@CurrentUser('sub') userId` 파라미터 추가 → 서비스 `recordAudit()` 사설 헬퍼 → `AuditLogsService.record()`
경로를 4개 모듈에 동형으로 적용했다. `audit-action.const.ts`·각 모듈의 `.controller.ts`/`.service.ts`/
`.module.ts`/`.spec.ts`를 전부 직접 `Read`했고, `tsc --noEmit`(전체·build 두 tsconfig)·`jest`를 실행해
실측했다. 파일 21~28(`review/consistency/2026/08/01/09_11_58/**`)은 이 구현 착수 전 `--impl-prep`
consistency-check 산출물이 그대로 diff 에 포함된 것으로, 코드가 아니라 리뷰 산출물이라 별도 발견사항
대상에서 제외했다(참고 자료로만 사용).

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` spec 3곳(`1-auth.md §4.1`·`1-audit.md §1.1`·`audit-actions.md §3`)이 이번에
  구현된 13개 액션을 여전히 "Planned/미구현"으로 서술 — 코드가 옳고 spec 상태 표기가 낡았다
  - 위치: `spec/5-system/1-auth.md:414-423`(현재 구현된 액션 표, 신규 13개 행 부재), `:429-436`(Planned
    표에 `workflow.created/updated/deleted/executed`, `trigger.created/updated/deleted`,
    `schedule.created/updated/deleted`, `model_config.*` 가 여전히 등재), `:438`("설정 CRUD 감사 로깅
    자체는 현재 미구현이다" 문구) · `spec/data-flow/1-audit.md:82-88`("여전히 미구현이다 — workflows /
    triggers / … 모듈에는 AuditLogsService import 가 전혀 없다") · `spec/conventions/audit-actions.md:56-59`
    (registry 상태 열이 `workflow`/`trigger`/`schedule`/`model_config` 4행 모두 "미구현")
  - 상세: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-43`의 갱신된 Rationale
    주석 자체가 "workflow/trigger/schedule/model_config 의 CRUD 액션은 spec-sync-auth-gaps §4.1 로
    구현됐다(2026-08-01)"라고 명시하고, 실제로 `WorkflowsService`/`TriggersService`/`SchedulesService`/
    `ModelConfigService` 4곳 모두 `AuditLogsService` 를 주입해 `record()` 를 호출한다(코드로 직접 확인,
    `tsc --noEmit -p tsconfig.build.json` clean 으로 프로덕션 경로 완전성도 재확인). 즉 코드는 spec 의
    Planned 카탈로그(액션명·시제·`model_config.*` 현재형 예외)를 line-level 로 정확히 따랐다 — 이는
    `project-planner` 위임 대상인 spec 갱신 누락이지, 코드 결함이 아니다. 다만 `workflow.executed` 는
    이번 diff 에서도 **의도적으로 미구현**(같은 주석 §37-43, 보존 정책 미정과 결부)이므로, `1-auth.md` §4.1
    Planned 표의 `workflow` 행은 `created/updated/deleted` 만 이동하고 `executed` 는 Planned 에 남아야
    한다 — `audit-actions.md` §3 의 `workflow` 행(1행에 4개 verb 묶음)도 그대로 "구현"으로 뒤집으면
    `executed` 상태가 부정확해지므로 분리가 필요하다. `plan/in-progress/spec-sync-auth-gaps.md` 의
    `- [ ] §4.1 감사 로깅 커버리지 갭` 체크박스도 이 구현 완료를 아직 반영하지 못했다(developer 의
    `plan/**` 쓰기 권한 범위인데 이번 diff 에 포함되지 않음 — 아래 별도 항목).
  - 제안: (project-planner) `spec/5-system/1-auth.md` §4.1 — `workflow.created/updated/deleted`,
    `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.create/
    update/delete/set_default` 13개를 "현재 구현된 액션" 표로 이동하고 `workflow.executed` 1개만
    Planned 표에 잔류. `spec/data-flow/1-audit.md` §1.1 SoT 표에 신규 writer 4행(workflows.service.ts→
    `workflow.created/updated/deleted`, triggers.service.ts→`trigger.*`, schedules.service.ts→
    `schedule.*`, model-config.service.ts→`model_config.*`) 추가 + "여전히 미구현이다" 문장 정정.
    `spec/conventions/audit-actions.md` §3 의 `trigger`/`schedule`/`model_config` 3행은 "구현"으로,
    `workflow` 행은 `created/updated/deleted`(구현)와 `executed`(미구현)로 분리. (developer, 같은 턴에
    가능) `plan/in-progress/spec-sync-auth-gaps.md` 의 §4.1 체크박스 체크.

- **[WARNING]** 기존(pre-existing) 유닛 테스트 호출부 약 70곳이 신규 필수 `userId` 인자를 반영하지 않아
  `tsc --noEmit`(spec 포함 tsconfig) 기준 타입 에러 — 실제 CI 게이트는 통과하지만 타입 안전성이 깨졌다
  - 위치(직접 `Read`·`tsc` 로 실측 확인): `codebase/backend/src/modules/model-config/model-config.service.spec.ts`
    (29곳, 예: `:79` `service.create('workspace-1', 'chat', dto)`, `:351` `service.remove('cfg-9', 'ws-1')`,
    `:364`/`:376` `service.update('cfg-1', 'ws-1', {...})` — 캐시무효화 리스너 테스트),
    `codebase/backend/src/modules/schedules/schedules.service.spec.ts:212,222,231,239`
    (`service.create('ws-1', {...} as unknown as CreateScheduleDto)` — 타임존 폴백 테스트 4건),
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(32곳, 예: `:508`
    `service.create('ws', {...})`, `:523` authConfig 워크스페이스 검증 테스트),
    `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:142,174`,
    `codebase/backend/src/modules/workflows/workflows.service.spec.ts:317,333,350`
    (`service.update('wf-uuid-1', 'ws-uuid-1', {...})` — settings spread-merge 테스트 3건)
  - 상세: `ModelConfigService.create/update/setDefault/remove`, `SchedulesService.create/update/remove`,
    `TriggersService.create/update/remove`, `WorkflowsService.update/remove` 가 이번 diff 로 `userId`
    를 필수(옵셔널 아님) 파라미터로 추가했는데, 각 서비스 자신의 `.spec.ts` 안에서 audit 과 무관한
    **기존** 테스트(암호화·SSRF·타임존 폴백·캐시 무효화·authConfig 검증 등)는 그대로 두어 인자 개수가
    안 맞는다. 실측: `npx tsc --noEmit -p tsconfig.json`(spec 포함) 에서 이 5개 파일에 TS2554 70건
    발생, 반면 `npx tsc --noEmit -p tsconfig.build.json`(프로덕션 스코프, `**/*spec.ts` exclude)은
    **clean** — 즉 실제 controller→service 호출부(프로덕션 코드)는 전부 올바르게 갱신됐고
    (`grep -rn "\.\(create\|update\|remove\|setDefault\)(" src --include="*.ts" | grep -v spec` 결과
    4개 컨트롤러 13곳만 존재, 전부 신규 시그니처 일치), 문제는 **테스트 파일에만 국한**된다. 또한
    `jest.config.ts` 의 `ts-jest` 가 `tsconfig.json` 의 `isolatedModules: true` 영향으로 이 arity 를
    검사하지 않아(`npx jest src/modules/{model-config,schedules,triggers,workflows,audit-logs}` 실행
    결과 415 passed, 타입 에러 무보고) 현재 CI 게이트(`PROJECT.md` 의 lint/unit/build/e2e 4단계)
    어디서도 걸러지지 않는다 — `unit`(jest)은 타입을 안 보고, `build`(`nest build`)는 spec 을 exclude
    한다. 다만 이 diff 자신의 `recordAudit` 헬퍼 주석(예: `model-config.service.ts:233-234`,
    `schedules.service.ts:138-139`)이 "positional 이면 동일 타입 인자 순서 스왑을 컴파일러가 못 잡는다"
    며 타입 시스템을 안전장치로 명시적으로 근거 삼고 있는데, 정작 같은 diff 가 남긴 70곳은 그 컴파일러
    검사망 밖에 방치돼 있다. 이 70개 테스트는 지금 `userId: undefined` 로 실행되고 있으나
    `AuditLogsService.record` 가 mock 이고 어떤 테스트도 감사 필드를 단언하지 않아 겉으로는 GREEN 이다.
  - 제안: 각 파일의 기존 create/update/setDefault/remove 호출부에 테스트용 `userId`(예: `'u-1'`)를
    추가해 `tsc --noEmit` 을 클린하게 만들 것. 프로덕션 동작에는 영향 없음(빌드 스코프는 이미 clean) —
    IDE 상 지속적인 red squiggle 노이즈와, 향후 실수 재발 방지 안전망 복구가 목적.

- **[WARNING]** 신규 계측 4개 서비스 중 3개(schedules/triggers/workflows)는 감사 로깅 유닛 테스트가
  일부 CRUD 동작에만 편중 — model-config 대비 비대칭적 커버리지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 `'TriggersService — 감사
    로깅 (trigger.*)'` describe(파일 끝부분, `it('remove 는 삭제 전에 읽은 type 을 남긴다', …)` 1건만) —
    `create()`/`update()` 의 `recordAudit` 호출은 단언 대상이 아님. `schedules.service.spec.ts` 의
    `'감사 로깅 — schedule.created …'`/`'…생성이 실패하면…'` 2건은 `create` 만 — `update`/`remove` 미검증.
    `workflows.service.spec.ts` 의 `'감사 로깅 (workflow.*)'` describe 는 `create` 커밋순서/실패 2건 +
    `duplicate` 의 `details.duplicatedFrom` 1건 — `update`/`remove` 미검증.
  - 상세: 코드 자체는 직접 `Read` 로 4개 서비스의 create/update/setDefault/remove 를 전부 추적해 정상
    동작을 확인했다(예: `triggers.service.ts` 의 `create()`/`update()` 는 `chatChannel` 유무에 따라
    `refreshed`/`saved` 두 분기 각각에서 정확히 1회만 `recordAudit` 호출하고 이중 발화가 없음을
    코드 추적으로 확인). 다만 `model-config.service.spec.ts` 만 create/update/setDefault(성공+트랜잭션
    실패)/remove 4개 동작 전부 + 트랜잭션 커밋 순서(`'tx-start'/'tx-commit'/'audit'`) 까지 세밀하게
    검증하는 반면, 나머지 3개 서비스는 동일 패턴(트랜잭션 순서·삭제-전-read 등)이 코드에 그대로
    존재함에도 `update`/`remove`(스케줄·워크플로우) 또는 `create`/`update`(트리거, 가장 분기가 복잡한
    `chatChannel` 이중 경로 포함)가 검증되지 않아, 향후 리팩터링이 이 경로들을 깨도 유닛 테스트로는
    잡히지 않는다.
  - 제안: model-config 수준으로 나머지 3개 서비스의 남은 CRUD 동작(schedules `update`/`remove`,
    triggers `create`/`update` — 특히 `chatChannel` 유무 두 분기 각각, workflows `update`/`remove`)에도
    동일한 형태(action/resourceType/resourceId/details 단언 + 트랜잭션 있는 경로는 커밋-후 순서 단언)의
    테스트를 추가할 것.

- **[INFO]** `plan/in-progress/spec-sync-auth-gaps.md` 의 완료 체크박스 미반영
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md` — `- [ ] **§4.1 감사 로깅 커버리지 갭**` 항목
  - 상세: 이 항목이 정확히 이번 diff 가 닫은 갭이다("`workflow.*`/`trigger.*`/`schedule.*`/
    `model_config.*`(create/update/delete/set_default) 액션이 미구현. 실측: workflows·triggers·
    schedules·model-config 모듈에 AuditLogsService import 0건"). `plan/**` 은 developer 스킬의 쓰기
    권한 범위(spec/ 와 달리)라 이번 diff 에서 체크 처리가 가능했는데 포함되지 않았다. 단, 같은 plan 의
    §1.3(LDAP/SAML) 은 별개로 남아 있어 파일 전체를 `plan/complete/` 로 옮길 단계는 아니다.
  - 제안: 이번 diff(혹은 바로 다음 커밋)에서 해당 체크박스만 `[x]` 로 갱신.

- **[INFO]** `triggers.service.spec.ts` 신규 describe 블록에 목적 없는 캐스팅 잔재(dead code)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `describe('TriggersService
    — 감사 로깅 (trigger.*)', …)` 의 `beforeEach` 안, `const idx = moduleRef as unknown as {
    container?: unknown; } as unknown as never; void idx;` 2줄(주석 "createBaseProviders 는 모듈
    레벨이라 공유 mock 을 못 받는다 — 여기서 override." 바로 다음)
  - 상세: `idx` 는 선언 직후 `void idx` 로 즉시 버려지며 이후 전혀 사용되지 않는다 — 실제 override 는
    바로 다음 줄의 `auditLogs = moduleRef.get(AuditLogsService) as unknown as { record: jest.Mock };`
    가 수행한다. 탐색적 디버깅 중 남은 코드로 보이며 기능에 영향은 없으나 읽는 사람에게 혼동을 준다.
  - 제안: 해당 2줄 제거(동작 변화 없음, `eslint --fix` 커밋에서도 안 걸러졌으므로 수동 정리 필요).

- **[INFO]** 무관한 파일의 타입 캐스트 제거가 "포맷만" 이라는 커밋 메시지와 문자적으로 어긋남
  - 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` — `@IsIn(
    NOTIFICATION_EVENT_TYPES, { each: true })` (커밋 `65087584b`)
  - 상세: 커밋 메시지가 "`git diff -w` 로 실질 변경 0줄 확인 — 포맷만"이라 주장하지만, 이 파일의 변경은
    `NOTIFICATION_EVENT_TYPES as unknown as string[]` → `NOTIFICATION_EVENT_TYPES` 캐스트 제거로,
    `git diff -w`(공백무시) 로도 여전히 diff 가 표시됨을 직접 확인했다(공백 변경이 아니라 토큰 삭제).
    런타임 동작은 동일(같은 배열 참조를 `@IsIn` 에 전달)하고 `tsc`/`eslint` 상 문제도 없어 안전한
    `@typescript-eslint/no-unnecessary-type-assertion` 류 autofix 로 보이지만, 커밋 메시지의 "실질
    변경 0줄" 서술은 이 파일에 한해 부정확하다. 기능 결함은 아님.
  - 제안: 조치 불요(기능 영향 없음) — 향후 유사 "포맷 전용" 커밋 메시지 작성 시 `git diff -w --stat`
    말고 실제 파일별 diff 를 확인해 캐스트/타입 제거처럼 의미 있는 변경이 섞이지 않았는지 재확인 권장.

## 검증했으나 문제 없음으로 확인한 항목 (참고)

- **핵심 동작 정확성**: 4개 서비스의 create/update/remove(+ setDefault, duplicate)가 전부 `userId` 를
  올바르게 전파하고(`grep` 으로 전수 확인, 컨트롤러 4개·13개 호출부 전부 신규 시그니처와 일치),
  트랜잭션이 있는 경로(model-config `setDefault`/`saveWithDefaultSwap`, workflows `create`/
  `duplicate`)는 전부 **커밋 후**에 `recordAudit` 을 호출해 롤백 시 감사가 남지 않는다(코드 추적 +
  전용 테스트로 확인). `TypeORM remove()` 가 엔티티의 `id`/구분 필드를 지우는 특성 때문에 `kind`/`type`
  을 삭제 **전** 지역 변수로 캡처해두는 패턴(model-config/triggers 의 `remove()`)도 정확히 구현됨.
- **에러 스월로우 계약**: `AuditLogsService.record()` 가 try/catch 로 실패를 삼키고 `logger.warn` 만
  남기는 것을 확인했다(`audit-logs.service.ts:68-97`, spec `data-flow/1-audit.md:20-22` 의 "두 record
  모두 실패를 삼킨다" 계약과 일치) — 감사 기록 실패가 주 동작을 깨지 않는다.
- **액션 명명·시제**: 신규 13개 액션 문자열이 `spec/5-system/1-auth.md §4.1` Planned 표·
  `spec/conventions/audit-actions.md §3` 레지스트리와 **line-level 로 완전히 일치**(`model_config.*` 만
  현재형 CRUD 예외 유지 등). 오탈자·dot-prefix 누락 없음.
- **RBAC**: 4개 컨트롤러의 create/update/remove(+set-default)는 기존과 동일하게 `@Roles('editor')` 로
  보호되어 있어(이번 diff 가 건드리지 않은 기존 가드) 이 변경으로 인한 권한 완화는 없다.
- **TODO/FIXME/HACK/XXX**: diff 전체에서 0건.
- **프로덕션 빌드 무결성**: `npx tsc --noEmit -p tsconfig.build.json`(spec 제외, 실제 배포 스코프)
  clean, `npx jest` 대상 17 suite 전부 통과(415 passed, 1 skipped — 무관한 기존 skip).

## 요약

핵심 요구사항(4개 서비스에 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 13개 감사 액션을
사용자·트랜잭션 커밋 순서·삭제-전-read 등 spec 이 명시한 규칙대로 구현)은 프로덕션 코드 경로 기준으로
완전하고 정확하다 — 컨트롤러→서비스 전수 확인, 트랜잭션 순서·에러 스월로우·명명 규약 모두 spec 과
line-level 로 일치했고 `tsc --noEmit -p tsconfig.build.json`/`jest` 실측으로 재확인했다. CRITICAL 급
기능 결함은 발견되지 않았다. 다만 두 가지 실질적 후속 조치가 남는다: (1) spec 3곳(`1-auth.md §4.1`·
`1-audit.md §1.1`·`audit-actions.md §3`)이 아직 이 구현을 "Planned/미구현"으로 서술하는 SPEC-DRIFT —
코드가 옳고 spec 상태 표기 갱신이 project-planner 턴으로 필요하며, `workflow.executed` 만 예외로 남겨야
하는 미묘함이 있다. (2) 신규 필수 `userId` 파라미터를 반영하지 못한 기존 유닛 테스트 호출부 약 70곳이
`tsc --noEmit`(전체 스코프) 기준 타입 에러 상태로 방치돼, 이 diff 자신이 내세우는 "컴파일러가 인자
순서/누락을 잡아준다"는 안전장치 논거를 스스로 훼손하고 있다(단, 현재 CI 게이트 어디도 이를 걸러내지
못해 병합 자체를 막지는 않는다). 부가로 신규 계측 4개 서비스 간 감사 로깅 테스트 커버리지가
비대칭적이다(model-config 만 CRUD 전체+트랜잭션 순서까지 촘촘, 나머지 3개는 일부 동작만).

## 위험도

MEDIUM
