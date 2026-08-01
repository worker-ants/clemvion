# 요구사항(Requirement) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅, 2차 라운드)

## 검토 범위·방법

`review/code/2026/08/01/10_05_53`(1차 리뷰, Critical 2·Warning 11) → `RESOLUTION.md` 조치 커밋(`f77c1e0de`
C1, `a92f53df6` C2·W5·W6·W9·W10·W2) 이 반영된 **현재 HEAD**(`a92f53df6`, `origin/main` 대비 5개 커밋)를
독립적으로 재검증했다. 프롬프트 diff 가 생략한 파일(`workflows.service.ts`, `model-config.service.spec.ts`,
`triggers.service.spec.ts`)을 포함해 4개 서비스(`model-config`/`schedules`/`triggers`/`workflows`)의
`.controller.ts`/`.service.ts`/`.module.ts`/`.spec.ts` 전부를 `Read`/`git diff origin/main...HEAD`로
직접 열람했고, `spec/5-system/1-auth.md §4.1`·`spec/data-flow/1-audit.md §1.1`·
`spec/conventions/audit-actions.md §3`·`spec/2-navigation/2-trigger-list.md`·
`plan/in-progress/spec-sync-auth-gaps.md`를 대조했다. `npx jest src/modules/{model-config,schedules,
triggers,workflows,audit-logs}`(17 suites/421 passed/1 skipped, 실패 0)와 `npx tsc --noEmit -p
tsconfig.json`을 실측하고, 신규 tsc 에러 유무를 `git show origin/main:<file>` 대조로 개별 검증했다.
1차 리뷰 산출물(`review/code/.../10_05_53/**`, `review/consistency/.../09_11_58/**`)은 이번 diff 에
신규 파일로 포함돼 있으나 코드가 아니라 리뷰 산출물이므로 별도 발견사항 대상에서 제외했다(참고 자료로만
사용).

## 발견사항

- **[WARNING]** 신규 감사 로깅 테스트가 import 되지 않은 타입을 참조해 `tsc --noEmit` 신규 오류 발생 —
  `RESOLUTION.md`의 "내 변경이 만든 오류 0건" 검증 주장이 최소 1건에 대해 사실이 아니다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:301`
    (`{ name: 'S2' } as unknown as UpdateScheduleDto,`), import 블록은 `:1-11`(`UpdateScheduleDto` 부재,
    `CreateScheduleDto`만 import 됨)
  - 상세: 이번 PR 이 신규 추가한 `'감사 로깅 — update 는 schedule.updated 를 남긴다'` 테스트(커밋
    `24d0db60a`)가 `UpdateScheduleDto` 를 타입 단언 대상으로 쓰지만 이 파일 어디에도 해당 타입을
    import 하지 않는다. `npx tsc --noEmit -p tsconfig.json` 실행 결과
    `error TS2552: Cannot find name 'UpdateScheduleDto'. Did you mean 'CreateScheduleDto'?`가
    이 줄에서 발생함을 직접 실측 확인했다. `git show origin/main:codebase/backend/src/modules/schedules/
    schedules.service.spec.ts`로 대조한 결과 origin/main 판에는 `UpdateScheduleDto` 문자열이
    **0회** 등장해 — 이 오류가 "잔여는 기존 오류"(RESOLUTION.md C1 조치란 근거)에 해당하지 않는,
    이번 PR(정확히는 C1이 아니라 그보다 앞선 `24d0db60a` 테스트 커밋)이 신규로 만든 오류임을 확정했다.
    같은 파일의 `recordAudit` 헬퍼 JSDoc(`schedules.service.ts:138-139`)이 "positional 이면 동일 타입
    인자 순서 스왑을 컴파일러가 못 잡는다"며 타입 시스템을 안전장치로 명시적으로 근거 삼고, C1 조치
    자체가 정확히 이 종류의 타입 안전망 훼손을 복구하는 게 목적이었는데, 그 복구 작업이 자기 자신이
    남긴 새 구멍은 못 잡았다. 런타임 영향은 없다 — `ts-jest`가 `isolatedModules`로 타입 단언을
    스트립만 하므로 테스트는 그대로 GREEN(직접 `jest` 실행으로 재확인: 17 suites/421 passed, 실패
    0건). `tsconfig.build.json`(spec 제외, 실제 배포 스코프)에도 안 걸린다 — 즉 병합을 막지는
    않지만, IDE red-squiggle·다음 개발자의 신뢰도(문서가 "0건"이라 명시)에는 실질적 악영향이 있다.
  - 제안: `import { UpdateScheduleDto } from './dto/update-schedule.dto';` 한 줄 추가.

- **[WARNING]** `[SPEC-DRIFT]` spec 4곳이 이번에 구현 완료된 13개 CRUD 액션을 여전히
  "Planned/미구현"으로 서술 — 코드가 옳고 spec 상태 표기가 낡았다 (developer 권한 밖, 이미
  `plan/in-progress/spec-sync-auth-gaps.md`에 planner 턴으로 큐잉돼 있음을 확인)
  - 위치: `spec/5-system/1-auth.md:429-436`(Planned 표에 `workflow.created/updated/deleted`,
    `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.*` 13개
    전부 잔류 — `workflow.executed`만 Planned 이 맞음), `:414-423`(구현된 액션 표에 신규 13개
    행 부재), `:438`("설정 CRUD 감사 로깅 자체는 현재 미구현이다" 문구) · `spec/data-flow/1-audit.md:40`
    ("실제 호출자는 8개 위치" — 이제 4개 writer 모듈이 추가돼 카운트가 stale), `:82-92`("여전히
    미구현이다 — workflows/triggers/…모듈에는 AuditLogsService import 가 전혀 없다" — 사실과 다름,
    4개 모듈 모두 import·기록함을 직접 확인) · `spec/conventions/audit-actions.md:56-59`(workflow/
    trigger/schedule/model_config 4행 상태 컬럼이 모두 "미구현") · `spec/2-navigation/2-trigger-list.md:182`
    (`trigger.delete` **액션명 자체가 오기** — 실제 구현은 `AUDIT_ACTIONS.TRIGGER_DELETED =
    'trigger.deleted'` 과거분사), `:252`(`trigger.update`도 동일하게 실제는 `trigger.updated`)
  - 상세: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-43`의 갱신된 주석이
    "workflow/trigger/schedule/model_config 의 CRUD 액션은 spec-sync-auth-gaps §4.1 로 구현됐다
    (2026-08-01)"라 명시하고, 실제로 4개 서비스 전부 `AuditLogsService`를 주입해 `record()`를
    호출함을 코드로 직접 확인했다(`model-config.service.ts:284,337,385,402`,
    `schedules.service.ts:188,246,273`, `triggers.service.ts:262,344,871`,
    `workflows.service.ts:220,245,257,397` — 총 14개 호출부). 액션 문자열·시제(`model_config.*`만
    현재형 CRUD 예외)도 spec Planned 카탈로그·`conventions/audit-actions.md`의 명명 규약과
    line-level 로 정확히 일치한다. 즉 이번 발견은 코드 결함이 아니라 spec 갱신 누락이며,
    `plan/in-progress/spec-sync-auth-gaps.md:38-42`가 이미 "spec SoT 4곳 동기화 — planner 턴 필요"로
    정확히 이 4곳(과 `trigger.delete` 오기까지)을 적시해 큐잉해뒀음을 확인했다 — developer 는
    `spec/` read-only 라 직접 고칠 수 없다(CLAUDE.md). `2-trigger-list.md` 건은 단순 staleness 가
    아니라 액션 **문자열 자체**가 항상 잘못 표기돼 있었던 것(구현 전에도 오기)이라, spec 동기화 시
    단순 상태 flip 이 아니라 문자열 정정(`trigger.delete`→`trigger.deleted`,
    `trigger.update`→`trigger.updated`)이 필요하다 — plan 문서가 이 구분도 이미 반영하고 있다.
  - 제안: (project-planner) `1-auth.md §4.1` Planned→구현 표 이동(`workflow.executed`만 잔류),
    `data-flow/1-audit.md §1.1` 커버리지 갭 문단·Writer 표(8→12개 위치) 갱신, `conventions/
    audit-actions.md §3` 상태 컬럼 4행 정정, `2-navigation/2-trigger-list.md:182,252` 액션명
    오기 정정. 코드 변경 불필요 — spec 반영만 남음.

- **[WARNING]** `triggers`/`schedules`는 W6(커밋 직후 기록) 불변식을 코드로는 올바르게 구현했지만,
  `model-config`/`workflows`와 달리 그 순서를 고정하는 회귀 테스트가 없다 — 향후 리팩터링이 순서를
  되돌려도 기존 테스트로는 못 잡는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`의
    `describe('TriggersService — 감사 로깅 (trigger.*)', …)`(신규, create/update/remove 각 1건) —
    `order: string[]` 류 시퀀스 단언 없음. `codebase/backend/src/modules/schedules/
    schedules.service.spec.ts`의 신규 감사 describe 블록(4건)도 동일하게 없음. 대조군:
    `codebase/backend/src/modules/model-config/model-config.service.spec.ts`의
    `'setDefault 는 트랜잭션 **커밋 뒤**에 남긴다'`(order 배열로 `['tx-start','tx-commit','audit']`
    명시 단언) · `codebase/backend/src/modules/workflows/workflows.service.spec.ts`의
    `'create 는 트랜잭션 **커밋 뒤**에 workflow.created 를 남긴다'`(동일 패턴)
  - 상세: 코드 자체는 직접 추적해 정확함을 확인했다 — `triggers.service.ts:262`(recordAudit)가
    `:270`(normalizeNotificationSecretRef, 외부/실패가능)·`:274`(setupChatChannel, 외부/실패가능)
    보다 먼저 실행되고, `schedules.service.ts:188`(recordAudit)가 `:198`(registerJob, BullMQ 외부
    호출)보다 먼저 실행된다(각 소스의 "리뷰 W6" 주석이 이 의도를 명시). 그런데 두 spec 파일의
    신규 감사 테스트는 `auditLogs.record`가 **호출됐는지**만 단언하고 **어떤 순서로** 호출됐는지는
    단언하지 않는다 — mock(`{ record: jest.fn() }`, `secrets.rotate`/`registerJob` 등)이 모두
    즉시 resolve 되는 단순 stub 이라, 만약 향후 누군가 `recordAudit` 호출을 `normalizeNotificationSecretRef`/
    `registerJob` **뒤**로 옮기는 회귀를 내더라도(정확히 이번 PR 이 고친 W6 버그의 재발) 이 테스트들은
    여전히 GREEN 으로 남는다 — "호출됨" 만 보고 "제때 호출됨"을 놓친다. model-config `create()`의
    `isDefault:true` 분기(`saveWithDefaultSwap` 트랜잭션 경유)도 동일한 사각지대다 — 감사 describe
    블록의 `create` 테스트는 `isDefault` 미포함 dto 라 비-트랜잭션 경로만 통과하고, `setDefault`만
    순서를 검증한다.
  - 제안: model-config/workflows 와 동일한 `order: string[]` 패턴으로 triggers `create`/`update`(감사
    가 `normalizeNotificationSecretRef`/`setupChatChannel` 보다 먼저)와 schedules `create`/`update`
    (감사가 `registerJob`/`removeJob` 보다 먼저) 순서 테스트를 추가. model-config `create()`의
    `isDefault:true` 트랜잭션 분기도 별도 순서 테스트 추가 권장.

- **[WARNING]** `model-config.controller.spec.ts`가 `update`/`remove`의 `userId` 배선만 단언하고
  `create`/`setDefault`는 컨트롤러 레벨에서 전혀 단언하지 않음 — 이미 추적 중인 plan W8의 더 구체적인
  잔여 범위
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` —
    `describe('update', …)`(:166)·`describe('remove', …)`(:190)만 존재, `describe('create', …)`·
    `describe('setDefault', …)` 블록 자체가 없음(`grep`으로 전수 확인)
  - 상세: 실제 컨트롤러 코드는 4곳 모두(`create`/`update`/`setDefault`/`remove`) 올바른 인자 순서로
    서비스에 `userId`를 전달함을 `Read`로 직접 확인했다(`model-config.controller.ts:117-121`,
    `:135-138`, `:154-157`, `:170-173`이 각각 서비스 시그니처 `create(workspaceId, kind, dto, userId)`
    / `update(id, workspaceId, dto, userId)` / `setDefault(id, workspaceId, userId)` /
    `remove(id, workspaceId, userId)`와 정확히 일치) — 기능적으로는 문제없다. 다만 `schedules`(controller
    spec 파일 자체 부재)·`triggers`/`workflows`(각 controller spec 이 이번 diff 로 전혀 갱신되지 않아
    신규 `userId` 파라미터를 검증 안 함, `grep -n userId`가 0건)까지 포함하면 4개 컨트롤러 13개
    엔드포인트 중 컨트롤러 레벨에서 `userId` 전달을 실제로 단언하는 것은 model-config 의 2곳뿐이다.
    `RESOLUTION.md` W8이 "서비스 레벨 테스트가 userId 를 단언하고 있어 배선 자체는 타입으로 강제된다
    (인자 누락 시 TS2554)"고 주장하는데, 이는 인자 **개수** 누락은 잡지만 `workspaceId`/`userId`
    같은 동일 타입(string) 인자의 컨트롤러→서비스 **순서 스왑**은 컴파일러가 못 잡는 사각지대라 —
    바로 이 PR 의 `recordAudit` 헬퍼들이 반복해서 근거로 드는 "positional 인자 스왑" 논리가 컨트롤러
    ↔ 서비스 경계 자체에는 적용되지 않고 있다(이번 회차에 실제 스왑 버그는 없음을 13개 호출부 전부
    직접 대조해 확인했으나, 안전망은 없다).
  - 제안: 낮은 우선순위(plan 에 이미 W8로 추적) — model-config 의 `create`/`setDefault` 컨트롤러 spec
    보강, `schedules.controller.spec.ts` 신설, `triggers`/`workflows` 기존 controller spec 에 신규
    `userId` 파라미터 delegation 단언 추가.

- **[INFO]** `workflow.updated` 감사가 `saveCanvas`/`importWorkflow`/`restoreVersion`(캔버스 편집 —
  실제 워크플로우 변경의 가장 흔한 경로)에는 미적용, `PATCH /workflows/:id`(이름/설정 변경)에만 적용
  — 이미 plan 에 추적된 의도적 범위 결정
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`의 `saveCanvas()`(:578-640)·
    `importWorkflow()`(:451-576)·`restoreVersion()`(:642-686) — 세 메서드 어디에도 `recordAudit` 호출
    없음. `update()`(:229-252)만 `WORKFLOW_UPDATED` 기록.
  - 상세: spec §4.1 카탈로그는 "`workflow.updated`가 어떤 코드 경로에서 발동해야 하는지" 세부를
    특정하지 않아 이 자체가 spec 위반은 아니다. `plan/in-progress/spec-sync-auth-gaps.md:46-47`이
    이미 "`saveCanvas`/`importWorkflow` 감사 기록 — 리뷰 W3. 이번 PR 범위(서비스 CRUD) 밖"으로
    명시적으로 범위를 밝히고 후속으로 남겨뒀다. 다만 실사용 관점에서 워크플로우 캔버스를 편집(가장
    빈번한 변경 경로)해도 감사 로그에 `workflow.updated`가 안 남고, `PATCH`(이름·설정 변경, 상대적으로
    드묾)만 남는 비대칭은 "누가 이 워크플로우를 언제 바꿨는가"를 추적해야 하는 감사 로그 본연의 목적과
    거리가 있다.
  - 제안: 조치 불요(이미 plan 후속 항목). 다음 라운드에서 `saveCanvas`/`restoreVersion`도 커버할지
    결정 시 `workflow.executed`와 같은 카디널리티(캔버스 저장은 편집마다 발동, `audit_log` pruner
    부재)를 함께 고려할 것 — plan 이 이미 이 연결점을 인지하고 있다.

## 검증했으나 문제 없음으로 확인한 항목

- **핵심 CRUD·트랜잭션·삭제-전-read 로직**: 4개 서비스 14개 `recordAudit` 호출부 전부를 직접 추적—
  트랜잭션 경로(model-config `setDefault`/`create`(isDefault=true), workflows `create`/`duplicate`)는
  전부 **커밋 후**, triggers/schedules 는 DB 저장 직후·외부 호출(secret store, BullMQ, chatChannel)
  이전에 기록한다. `TypeORM remove()`가 엔티티 필드를 지우는 특성 때문에 `kind`/`type`을 삭제 **전**
  지역 변수로 캡처하는 패턴(model-config/triggers `remove()`)도 정확하다.
- **컨트롤러→서비스 배선 정확성**: 4개 컨트롤러 13개 엔드포인트(`create`/`update`/`remove`(+`setDefault`,
  `duplicate`))의 `@CurrentUser('sub') userId` → `service.xxx(..., userId)` 호출부를 전부 직접 대조—
  인자 순서·개수 전수 일치. `workflows.create`(사전 존재, `workspaceId, userId, dto` 순)만 나머지
  3개 서비스(`workspaceId, dto, userId` 순)와 파라미터 순서가 다르지만, 이는 이번 PR 이전부터
  존재하던 `create()` 시그니처(diff 로 확인 — 몸체만 변경, 파라미터 목록 불변)이고 자신의 컨트롤러
  호출부와는 내적으로 일치해 버그가 아니다.
- **테스트 실측**: `npx jest src/modules/{model-config,schedules,triggers,workflows,audit-logs}` —
  17 suites, 421 passed, 1 skipped(무관), 실패 0. 이전 라운드가 지적한 "감사 로깅 테스트 커버리지
  비대칭"(schedules/triggers/workflows 의 update/remove 미검증)은 이번 라운드에서 4개 서비스 14개
  호출부 전부에 최소 1개 이상의 긍정 테스트가 신설돼 해소를 확인했다.
- **C1 조치 실효성**: `tsc --noEmit -p tsconfig.build.json`(프로덕션 스코프) 는 여전히 clean —
  `UpdateScheduleDto` 등 신규/잔존 오류는 전부 `*.spec.ts`(build 제외 대상)에 국한돼 배포 경로에는
  영향 없음을 확인.
- **AUDIT_ACTIONS 명명·시제**: 13개 신규 액션 문자열이 spec Planned 카탈로그·`conventions/audit-actions.md`
  명명 규약과 완전히 일치(`model_config.*`만 현재형 CRUD 예외). `AuditLogsService.record()` 시그니처
  (`workspaceId, userId, action, resourceType, resourceId, details?, ipAddress?`)와 4개 `recordAudit`
  헬퍼의 전달 필드도 정확히 일치.
- **TODO/FIXME/HACK/XXX**: diff 전체에서 0건(재확인).
- **에러 스월로우 계약**: `AuditLogsService.record()`(`audit-logs.service.ts:68-96`) 전체가 try/catch
  로 감싸져 있어 어떤 경로로도 예외가 호출자에게 전파되지 않음을 코드로 확인 — 감사 기록 실패가
  주 동작(create/update/remove)을 절대 깨지 않는다.

## 요약

핵심 요구사항(spec §4.1 이 Planned 로 약속한 13개 CRUD 액션을 4개 서비스에 행위자·트랜잭션 커밋
순서·삭제-전-read 규칙대로 구현)은 이번 라운드에서도 프로덕션 코드 경로 기준으로 정확하다 — 1차
리뷰(Critical 2·Warning 11)가 지적한 항목 대부분(C1 타입 안전망 복구, C2 무검증 8개 호출부에 회귀
테스트, W5 중복 호출 통합, W6 커밋-전-기록 순서 수정, W9/W10 테스트 위생)이 실측으로 해소를 확인했다.
다만 독립 재검증에서 새로 3가지를 발견했다: (1) 그 C1 조치 커밋 자신이 남긴 `UpdateScheduleDto` import
누락으로 `tsc --noEmit` 신규 오류 1건이 발생해 "내 변경이 만든 오류 0건"이라는 RESOLUTION.md 의 검증
주장과 어긋난다(런타임 영향 없음, 트리비얼 수정), (2) triggers/schedules 는 W6 순서 불변식을 코드로는
올바로 구현했지만 model-config/workflows 와 달리 그 순서를 고정하는 회귀 테스트가 없어 향후 재발
가능성이 남는다, (3) 컨트롤러 레벨 `userId` 배선 검증(스왑 방지)이 4개 컨트롤러 13개 엔드포인트 중
model-config 의 2곳(update/remove)에만 있다. spec 4곳(`1-auth.md §4.1`·`1-audit.md §1.1`·
`audit-actions.md §3`·`2-trigger-list.md`)의 SPEC-DRIFT 는 developer 권한 밖이며 이미
`plan/in-progress/spec-sync-auth-gaps.md`에 planner 턴으로 정확히 큐잉돼 있음을 확인했다 — 코드
결함이 아니다. CRITICAL 급 기능 결함은 이번 라운드에서도 발견되지 않았다.

## 위험도

LOW
