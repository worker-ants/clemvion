STATUS=success 테스트 관점 리뷰 완료 — CRITICAL 2 / WARNING 2 / INFO 3 (실측: tsc --noEmit 전수 실행 + 3개 서비스 대상 mutation 검증으로 확인)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — audit-logging (workflow/trigger/schedule/model_config 감사 로깅)

## 검증 방법

정적 diff 판독에 더해 다음을 직접 실행해 확인했다 (모두 `codebase/backend/`):
- `npx tsc --noEmit -p tsconfig.json` — 전체 프로젝트(spec 포함) 타입체크.
- `git diff origin/main --stat -- <5개 spec 파일>` — 각 spec 파일이 "추가만" 있고 기존 줄 수정이 0건임을 확인.
- 3개 서비스(`triggers.service.ts`/`workflows.service.ts`/`schedules.service.ts`)의 `recordAudit` 호출부를 임시로 제거하는 mutation 을 적용 → 관련 유닛 테스트 재실행 → 결과 확인 → `cp` 로 원본 복구(수정 전 md5 와 일치 확인, `git status --short codebase/` 로 잔여 diff 없음 확인).

## 발견사항

- **[CRITICAL]** 기존(diff 대상 아닌) 테스트 호출부 약 70곳이 새 필수 `userId` 인자를 받도록 갱신되지 않아 `tsc` 타입체크가 깨진다 — 현재 CI 게이트로는 감지되지 않음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts` (29곳, 예 L79/L97/L112/L125 `describe('create', …)`, L229-L364 `describe('update', …)`, L351/L386/L452/L501/L525 `setDefault`/`remove` 관련, L704-L774 `SSRF guard`), `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (4곳, L212/L222/L231/L239, 전부 `describe('create — timezone fallback (§2.2)', …)`), `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (32곳, 예 L508/L538/L567/L597/L617 `create`, L649/L672/L694/L718/L741/L1038…L1980 `update`), `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (L142/L174), `codebase/backend/src/modules/workflows/workflows.service.spec.ts` (L317/L333/L350).
  - 상세: 이번 diff 는 4개 서비스의 `create`/`update`/`remove`/`setDefault`(+ `duplicate`)에 필수 `userId: string` 인자를 추가했다. 그런데 `git diff origin/main --stat` 으로 확인한 결과 위 5개 spec 파일은 전부 **추가만 있고 기존 줄 수정이 0건**이다 — 즉 diff 이전부터 있던 호출부는 옛 인자 개수 그대로 남았다. `npx tsc --noEmit -p tsconfig.json` 을 프로젝트 전체(스펙 포함)로 돌리면 정확히 이 5개 파일에서 총 약 70건의 `TS2554: Expected N arguments, but got N-1` 이 발생한다. 이게 지금 안 잡히는 이유: (1) `tsconfig.build.json` 의 `exclude`에 `**/*spec.ts` 가 있어 `pnpm --filter backend build`(=`nest build`)가 스펙 파일을 타입체크하지 않고, (2) `jest`(ts-jest) 실행 자체도 이 인자 개수 오류를 걸러내지 않는다 — 실측: `npx jest src/modules/triggers/triggers.service.spec.ts` 는 32건의 TS2554 가 있는 바로 그 파일에서 `61 passed, 1 skipped, 0 failed` 로 초록이다. `.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 세 단계 중 어느 것도 스펙 포함 전체 타입체크를 하지 않으므로, 현재 표준 워크플로로는 이 결함이 전혀 드러나지 않는다.
  - 영향: 이 ~70개 호출은 지금 `userId` 를 아예 안 넘겨 런타임에 `undefined` 로 들어간다. 해당 테스트들이 audit 관련 단언을 하지 않아 지금 당장 거짓 초록은 아니지만, "변경 후에도 기존 테스트가 유효한지"(회귀 테스트 기준) 정면 위반이다 — 향후 `tsc --noEmit` 을 CI 게이트로 추가하거나 IDE 로 이 파일들을 열면 즉시 수십 건의 오류가 쏟아진다. 시그니처 변경 시 호출부 전수 갱신이 누락된 전형적 패턴.
  - 제안: 위 5개 파일의 기존 호출부에 `userId` 인자(예: 새로 추가된 감사 테스트가 쓰는 `'u-1'`/`'user-uuid-1'` 류 픽스처)를 채운다. 재발 방지로 `tsc --noEmit`(스펙 포함) 을 별도 CI/pre-push 단계로 추가하는 것을 권장 — 지금은 `build`(스펙 제외)와 `jest`(diagnostics 미시행) 사이의 사각지대가 이 클래스의 결함을 구조적으로 놓친다.

- **[CRITICAL]** `TriggersService`/`WorkflowsService`/`SchedulesService` 의 감사 기록(`recordAudit`) 호출부 다수가 테스트로 전혀 검증되지 않음 — mutation 으로 실측 확인(코드를 지워도 전 테스트 통과)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L271-277(`create` — chatChannel 재조회 분기), L281-287(`create` — fallback 분기), L356-362(`update` — chatChannel 재조회 분기), L366-372(`update` — fallback 분기); `codebase/backend/src/modules/workflows/workflows.service.ts` L245-250(`update`), L257-262(`remove`); `codebase/backend/src/modules/schedules/schedules.service.ts` L251-256(`update`), L269-274(`remove`).
  - 상세: `triggers.service.spec.ts` 에 새로 추가된 `describe('TriggersService — 감사 로깅 (trigger.*)', …)`(L2141-2201)는 `remove()` 하나만 검증한다 — `create()`/`update()`(각 2개 분기, 총 4개 호출부)는 파일 전체에서 `TRIGGER_CREATED`/`TRIGGER_UPDATED`/`trigger.created`/`trigger.updated`/`auditLogs.record` 어떤 것도 grep 되지 않는다. `workflows.service.spec.ts` 의 `describe('감사 로깅 (workflow.*)', …)`(L783-828)는 `create()`(트랜잭션 커밋 순서 포함) 와 `duplicate()`(L717-727) 만 검증하고 `update()`/`remove()` 는 0건. `schedules.service.spec.ts` 는 `create()` 만 검증(happy+실패 경로 2건)하고, `update()`/`remove()` 는 **감사뿐 아니라 메서드 전체가 파일 어디에도 호출되지 않는다**(`grep -n "service\.update(\|service\.remove("` 0건 — pre-existing 갭이지만 이번 diff 가 두 메서드 시그니처를 바꾸면서도 메꾸지 않았다).
    실측: 세 서비스 각각에서 위 호출부를 임시로 제거(`triggers.service.ts` L281-287 삭제 → `triggers.service.spec.ts`+`triggers.web-chat.spec.ts`+`triggers.controller.spec.ts` 69/69 통과; `workflows.service.ts` L245-250/L257-262 삭제 → `workflows.service.spec.ts`+`workflows.controller.spec.ts` 102/102 통과; `schedules.service.ts` L251-256/L269-274 삭제 → `schedules/` 전체 28/28 통과)한 뒤 관련 유닛 테스트를 재실행했고, 세 경우 모두 전부 초록이었다(이후 `cp` 로 원복, `git status --short codebase/` 로 무잔여 확인). e2e 로도 보완되지 않는다 — `audit-logs.e2e-spec.ts` 는 seed row 를 실제 API 가 아니라 SQL `INSERT` 로 직접 만들고(L44-48), 나머지 어떤 `*.e2e-spec.ts` 도 `audit_log` 를 단언하지 않는다(grep 0건).
  - 영향: 감사 로그의 존재 이유(누가/언제/무엇을 바꿨는지 추적)가 정확히 걸려 있는 지점인데, `trigger.created`/`trigger.updated`(양쪽 분기)/`workflow.updated`/`workflow.deleted`/`schedule.updated`/`schedule.deleted` 6개 액션은 향후 리팩터링(예: `TriggersService.update()`의 chatChannel early-return 이후 recordAudit 호출을 실수로 빠뜨리는 것)이 감사 트레일을 조용히 깨뜨려도 어떤 테스트도 잡지 못한다. 이는 `recordAudit` 자체의 doc 주석("positional 이면 동일 타입 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다")이 명시적으로 경계하는 바로 그 실패 유형이며, 같은 PR 의 `model-config.service.spec.ts`(create/update/setDefault/remove 전부, 트랜잭션 커밋 순서·롤백 시 미기록까지 포함해 촘촘히 검증)와 극명하게 대비된다.
  - 제안: `model-config.service.spec.ts` 의 패턴(정상 경로 + 실패 시 미기록 + 트랜잭션 커밋 순서)을 `triggers.service.ts`(create/update 각 2분기 전부) 와 `workflows.service.ts`/`schedules.service.ts` 의 `update`/`remove` 에도 동일하게 적용한다. `SchedulesService.update`/`remove` 는 감사 이전에 기능 자체의 기본 유닛 테스트부터 필요하다.

- **[WARNING]** 컨트롤러 계층의 `userId` 배선(`@CurrentUser('sub')` → 서비스 호출) 검증이 비일관적이고, 이를 보완할 e2e 도 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L115-121(`create`)·L152-158(`setDefault`) — 대응하는 `model-config.controller.spec.ts` 에 `describe('create', …)`/`describe('setDefault', …)` 블록 자체가 없음(반면 `update`/`remove` 는 L166-199 에서 "userId 까지 단언한다" 주석과 함께 명시적으로 검증됨). `codebase/backend/src/modules/schedules/schedules.controller.ts` — 대응 spec 파일(`schedules.controller.spec.ts`)이 저장소에 아예 존재하지 않음(`find`로 확인, `triggers.controller.spec.ts`/`workflows.controller.spec.ts` 는 존재). `triggers.controller.spec.ts`/`workflows.controller.spec.ts` 는 각각 `rotateBotToken`/`execute`·`executeNode`·canvas·`findAll`·`graphWarnings` 만 다뤄 `create`/`update`/`remove` 는 이번에도 다루지 않음.
  - 상세: 이 PR 코드가 반복적으로 명시하는 리스크("동일 타입 인자 순서 스왑을 컴파일러가 못 잡는다")가 실제로 발생할 수 있는 지점은 데코레이터에서 뽑힌 `userId` 가 컨트롤러→서비스 호출로 올바른 위치에 전달되는지인데, 정확히 그 지점이 4개 컨트롤러 중 model-config 의 `update`/`remove` 2곳에서만 검증된다. e2e 로도 보완되지 않는다(위 CRITICAL#2 의 e2e 조사와 동일 — `audit-logs.e2e-spec.ts` 는 SQL seed 만 쓰고, workflow/trigger/schedule/model-config CRUD 를 실제로 호출해 `audit_log.user_id` 를 단언하는 e2e 는 0건).
  - 제안: `ModelConfigController.create`/`setDefault` 에도 `update`/`remove` 와 동일한 userId-forwarding 단언을 추가하고, 최소한의 `schedules.controller.spec.ts` 를 신설한다. 여력이 되면 `workflow-crud.e2e-spec.ts`/`schedule-trigger.e2e-spec.ts` 류에 "실제 API 로 리소스를 만들고 `audit_log.user_id` 가 인증된 호출자와 일치하는지" 확인하는 e2e 1건을 추가하는 것을 권장.

- **[WARNING]** `workflows.service.spec.ts` 의 신규 트랜잭션 순서 테스트가 suite 공유 mock 을 `finally`/`afterEach` 없이 되돌려, 단언 실패 시 이후 무관한 테스트로 오염이 번질 수 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` L783-828 (`describe('감사 로깅 (workflow.*)', …)` 의 두 `it()` — `'create 는 트랜잭션 **커밋 뒤**에 workflow.created 를 남긴다'`, `'트랜잭션이 실패하면 create 는 감사를 남기지 않는다'`). 관련 컨텍스트: `mockDataSource` 선언부 L92, 최상위 `beforeEach` 의 `jest.clearAllMocks()` L153.
  - 상세: `mockDataSource` 는 최상위 `describe('WorkflowsService', …)` 바깥에서 `const` 로 한 번만 생성되고(L92), 매 테스트의 `beforeEach` 는 `jest.clearAllMocks()` 만 호출한다(호출 기록만 지우고, `obj.prop = jest.fn(...)` 식으로 통째 재할당된 구현은 되돌리지 않는다). 두 신규 테스트는 `const origTx = mockDataSource.transaction; mockDataSource.transaction = jest.fn(...); …expect(...)…; mockDataSource.transaction = origTx;` 형태로 복원을 테스트 본문 **맨 끝**에 일반 statement 로 둔다 — 중간의 `expect()` 가 하나라도 실패(=바로 이 테스트가 잡으려는 회귀가 실제로 발생)하면 마지막 복원 줄이 실행되지 않고, `mockDataSource.transaction` 은 order-tracking 클로저에 고정된 채로 파일의 나머지 테스트 전부(대형 suite)에 새어나간다. 같은 방식을 쓰는 `model-config.service.spec.ts` 는 `mockRepo`(및 그 안의 `manager.transaction`)를 매 테스트 `beforeEach` 에서 통째로 새로 만들기 때문에 이 문제가 구조적으로 없다 — 대비를 통해 이 파일의 취약점이 뚜렷하다.
  - 제안: `try { … } finally { mockDataSource.transaction = origTx; }` 로 감싸거나, 복원을 `afterEach` 로 옮겨 테스트 실패 여부와 무관하게 격리를 보장한다.

- **[INFO]** 신규 감사 로깅 테스트 블록에 남은 죽은 코드
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` L2167-2170 (`describe('TriggersService — 감사 로깅 (trigger.*)', …)` → `beforeEach`).
  - 상세: `const idx = moduleRef as unknown as { container?: unknown } as unknown as never; void idx;` 는 아무 효과가 없고 바로 폐기된다. 바로 다음 줄(`auditLogs = moduleRef.get(AuditLogsService) as unknown as { record: jest.Mock };`)이 실제로 필요한 작업을 하므로, 이 블록은 디버깅 중 남은 잔재로 보인다.
  - 제안: `idx` 블록 삭제.

- **[INFO]** `ModelConfigService.create()` 의 `isDefault: true` 경로(트랜잭션 `saveWithDefaultSwap`) 는 감사 테스트가 다루지 않음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts` L921-933 (`'create 는 model_config.create 를 행위자·대상과 함께 남긴다'`).
  - 상세: 픽스처 `dto`(L913-919)에 `isDefault` 가 없어 `service.create()` 는 항상 `repo.save()` 단순 경로만 탄다. `setDefault`/`update` 의 `isDefault:true` 분기는 각각 커밋 순서·트랜잭션 테스트가 있는데 `create()` 의 동일 분기는 없다. `recordAudit` 호출 자체는 두 분기 합류 이후라 위험도는 낮지만, 분기 조합 하나가 비어 있다.
  - 제안: `isDefault: true` 로 생성하는 케이스를 추가해 `resourceId`/`kind` 가 여전히 올바르게 감사되는지 확인.

- **[INFO]** `notification-config.dto.ts` 의 `@IsIn` 캐스트 제거에 대응하는 회귀 테스트 없음
  - 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` L105 (`@IsIn(NOTIFICATION_EVENT_TYPES, { each: true })` — 이전엔 `as unknown as string[]` 캐스트가 있었음).
  - 상세: `NotificationConfigDto`/`NOTIFICATION_EVENT_TYPES` 를 참조하는 `*.spec.ts` 가 저장소에 전혀 없다(grep 0건). 이 변경은 감사 로깅 기능과 무관한 편승 수정으로 보이고 런타임 동작을 바꾸지 않을 가능성이 높지만(순수 타입 캐스트 제거 — `class-validator`의 `IsIn` 은 런타임 값만 본다), 이를 뒷받침하는 직접 테스트가 없어 "정말 동작 보존인지"를 코드 리뷰만으로 확정하기 어렵다.
  - 제안: 우선순위 낮음. 다른 trigger DTO 검증 스펙이 있으면 `events` 화이트리스트 통과/거부 케이스를 얹는 정도로 충분.

## 요약

이번 PR 은 `workflow`/`trigger`/`schedule`/`model_config` 4개 리소스에 CRUD 감사 로깅을 추가하면서, `model-config.service.spec.ts` 하나는 정상 경로·실패 시 미기록·트랜잭션 커밋 순서(롤백 시 미기록 포함)까지 촘촘히 다루는 모범적인 테스트를 갖췄다. 그러나 나머지 세 서비스는 코드 구조(트랜잭션 순서 주석, positional-swap 경고 주석)가 model-config 와 동일한 위험을 명시함에도 테스트 커버리지가 크게 못 미친다 — `triggers.service.ts` 의 `create`/`update`(각 2분기) 는 감사 기록이 전혀 검증되지 않고, `workflows.service.ts`/`schedules.service.ts` 의 `update`/`remove` 도 마찬가지다. 이 갭은 관측으로 그치지 않고 세 파일 각각에서 해당 `recordAudit` 호출을 실제로 제거한 뒤 테스트를 재실행해 "전부 통과"함을 직접 확인했다 — 감사 트레일이 조용히 사라지는 회귀를 현재 테스트 스위트가 잡지 못한다는 뜻이다. 별도로, 시그니처 변경(신규 필수 `userId` 인자) 이 기존 호출부 전수 갱신 없이 이뤄져 5개 spec 파일에서 `tsc` 기준 약 70건의 인자 개수 오류가 발생하며, 이는 `nest build`(스펙 제외)나 `jest`(diagnostics 미시행으로 보임) 어느 쪽으로도 현재 걸러지지 않는 사각지대에 있다. 컨트롤러 계층의 `userId` 배선 검증도 model-config 의 update/remove 2곳에만 존재하고 e2e 로도 보완되지 않아, "누가 바꿨는지" 를 남기는 게 핵심 목적인 기능치고 그 배선 자체의 검증이 얇다.

## 위험도

HIGH
