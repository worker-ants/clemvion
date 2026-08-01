# 테스트(Testing) 리뷰 — 감사 로깅(audit-logging) 확장 (workflow/trigger/schedule/model_config CRUD)

> 참고: 본 세션 이전에 동일 diff 계열을 대상으로 한 리뷰 라운드가 이미 다수 존재한다
> (`review/code/2026/08/01/00_03_38` ~ `12_44_54`, 총 20+ 라운드). 직전 라운드(`12_44_54`)의
> WARNING 4건 중 W1(model-config `isDefault:true` 감사 순서 테스트 부재)·W3(triggers 실패-시-
> 미기록 테스트 부재)는 커밋 `6032e2444`("5차 리뷰 조치")로 **해결 확인**. 본 라운드는 잔여
> W2(컨트롤러→서비스 `userId` 배선 검증 갭)·W4(recordAudit 중복, 유지보수성 스코프이므로 본
> 리뷰 범위 밖)의 현재 상태를 재확인하고, 그 외 신규 관점을 점검한다.

## 발견사항

### [WARNING] Controller → Service `userId` 배선을 검증하는 유닛테스트가 4개 모듈 중 3개에서 전무 — 4개 이상 라운드에 걸쳐 미해결

- 위치:
  - `codebase/backend/src/modules/schedules/schedules.controller.ts:150`(`create`)·`:199`(`update`)·`:221`(`remove`) — 이번 PR 로 세 메서드 모두 `@CurrentUser('sub') userId` 를 추가해 서비스로 전달하도록 바뀌었으나(`git diff origin/main...HEAD` 확인, 9줄 추가), 대응하는 `schedules.controller.spec.ts` 파일 자체가 저장소에 없다(`ls codebase/backend/src/modules/schedules/*.spec.ts` — `schedule-runner.service.spec.ts`/`schedules.service.spec.ts`만 존재).
  - `codebase/backend/src/modules/triggers/triggers.controller.ts:95`(`create`)·`:120`(`update`)·`:160`(`remove`) — 동일하게 `userId` 전달이 추가됐으나, `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:17` 는 `describe('TriggersController.rotateBotToken', …)` 단 하나뿐이라 이 세 메서드는 테스트 파일에 전혀 등장하지 않는다.
  - `codebase/backend/src/modules/workflows/workflows.controller.ts:181`(`update`)·`:203`(`remove`)·`:231`(`duplicate`) — `update`/`remove`에 `userId` 전달이 추가됐고 `duplicate`는 기존부터 `user.sub`를 서비스에 넘긴다. `workflows.controller.spec.ts`의 describe 블록은 `execute`/`executeNode`/`graceful-shutdown`/`canvas+version`/`findAll`/`graph-warnings`뿐이며 `create`/`update`/`remove`/`duplicate`를 다루는 블록이 없다.
  - `codebase/backend/src/modules/model-config/model-config.controller.ts:115`(`create`)·`:152`(`setDefault`) — `update`(`:131`)/`remove`(`:168`)는 `model-config.controller.spec.ts:166-207`에서 "userId 까지 단언한다 — 감사 로그의 **주체**라, 빠지면 누가 바꿨는지가 사라진다" 라는 명시적 코멘트와 함께 검증되지만, 같은 diff에서 동일하게 `userId` 파라미터가 추가된 `create`/`setDefault`는 대응 describe 블록이 없다.
  - e2e 레벨도 공백이다: `codebase/backend/test/audit-logs.e2e-spec.ts`는 감사 로그 **조회** 엔드포인트의 권한 경계만 다루고, 실제 CRUD 호출(`workflow-crud.e2e-spec.ts`/`schedule-trigger.e2e-spec.ts` 등 기존 e2e 파일들, `git diff origin/main...HEAD --stat -- codebase/backend/test/` 확인 결과 이번 PR에서 무변경)에는 "생성한 리소스의 `audit_log.user_id`가 인증된 호출자와 일치하는지" 를 확인하는 테스트가 하나도 없다. `model-config`는 e2e 스펙 파일 자체가 없다.
- 상세: 4개 서비스의 `recordAudit()` private 메서드는 모두 동일한 문구로 "positional 인자면 동일 타입(string) 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다"는 위험을 스스로 문서화한다(`triggers.service.ts:203-204`, `workflows.service.ts:171-172`, `model-config.service.ts:233-234`, `schedules.service.ts:139-140`). 그런데 정작 컨트롤러→서비스 호출부(`this.triggersService.create(workspaceId, dto, userId)` 류)는 여전히 positional이고, `id`/`workspaceId`/`userId`가 전부 동일 타입(`string`)이라 컴파일러가 인자 순서 스왑(예: `remove(id, workspaceId, workspaceId)`처럼 `userId` 자리에 다른 string 변수가 들어가는 실수)을 잡지 못한다. 직접 각 호출부를 대조해 **현재는 실제 버그가 없음을 확인**했으나(모든 호출부가 서비스 시그니처와 정확히 일치), 이를 지켜줄 회귀 안전망이 schedules 전체·triggers/workflows 의 create·update·remove·duplicate·model-config 의 create·setDefault 에 전혀 없다. 이 항목은 `10_05_53`(WARNING) → `10_49_18`(INFO로 하향, "이미 추적됨"이라 했으나 실제로는 대응 plan 문서가 확인되지 않음) → `12_06_37`(WARNING 재상향) → `12_44_54`(WARNING, "1차부터의 유예 근거가 유효"라며 미조치) 로 최소 4라운드에 걸쳐 반복 지적됐고, 직전 커밋(`6032e2444`, "5차 리뷰 조치")도 이 항목은 명시적으로 defer했다. 감사 로깅 기능 자체의 핵심 가치가 "누가 했는가"인 만큼, 이 배선이 깨지면 컴파일 타임에도 유닛테스트에도 잡히지 않고 컴플라이언스 데이터가 조용히 오염된다.
- 제안: 최소한 `model-config`의 update/remove 패턴(`userId` 값까지 `toHaveBeenCalledWith`로 단언)을 나머지 경로(`schedules` create/update/remove, `triggers` create/update/remove, `workflows` create/update/remove/duplicate, `model-config` create/setDefault)로 확장. `schedules.controller.spec.ts` 신설이 최소 단위. 여력이 되면 4개 CRUD e2e 스펙 중 하나에 "실제 API 호출 → `audit_log` 테이블의 `user_id`가 인증 토큰의 sub와 일치" 를 확인하는 통합 테스트 1건을 추가해 컨트롤러 유닛테스트가 못 잡는 DI/런타임 배선 실수까지 커버할 것을 권장.

### [INFO] `audit-action.const.ts`의 명명 규약(JSDoc)이 여전히 코드로 강제되지 않음 (직전 라운드 INFO 잔여, 미해결)

- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:1-91`(`AUDIT_ACTIONS`). `find codebase/backend/src/modules/audit-logs -name "*.spec.ts"` 결과 `audit-logs.spec.ts` 하나뿐이며 이는 `AuditLogsService`/컨트롤러만 다룬다. `audit-action.const.spec.ts` 는 여전히 존재하지 않는다.
- 상세: 파일 상단 JSDoc(`:1-52`)이 `<resource>.<verb>` 형식·리소스별 시제 규약·"새 action 은 반드시 본 const 에 추가"를 상당히 구체적으로 명문화하는데, `Object.values(AUDIT_ACTIONS)` 에 대해 중복 여부·포맷(`/^[a-z0-9_]+\.[a-z0-9_]+$/`)을 검증하는 테스트가 없다. 이번 diff에서 13개 액션이 한 번에 추가된 "자주 손이 가는" 파일이라, 다음 확장 때 `workflow_created`처럼 dot 없는 값이나 중복 문자열이 들어와도 조용히 통과한다.
- 제안: `Object.values(AUDIT_ACTIONS)`에 대해 (a) 중복 없음, (b) 포맷 매치를 단언하는 가벼운 스펙 1개 추가. 비용 대비 회귀 방지 효과가 크다.

### [INFO] `workflows.service.spec.ts`는 "저장 실패 시 감사 미기록" 테스트가 `create` 1건뿐 — `update`/`remove`/`duplicate`는 미방문

- 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:855-872`(`create` 실패 테스트만 존재). `update`(`:876-900`)/`remove`(`:902-917`)/`duplicate`(`:732-764`) 관련 describe 블록에는 `mockRepository.save`/`mockRepository.remove`/`mockDataSource.transaction`이 reject할 때 `auditLogs.record`가 호출되지 않음을 확인하는 테스트가 없다.
- 상세: 직전 라운드(`12_44_54`)가 "자매 3개 모듈(schedules/triggers/model-config)은 실패-시-미기록 테스트를 최소 1건씩 갖는다"는 기준으로 `triggers`의 완전 부재만 WARNING으로 지적했고, `workflows`는 `create` 1건 보유로 그 기준을 충족해 지적 대상에서 빠졌다. 다만 `update`/`remove`/`duplicate`도 각각 `save`/`remove` 뒤에 `await this.recordAudit(...)`가 순차 실행되는 동일 구조라, 코드 구조상 `save`/`remove`가 throw하면 `recordAudit`에 도달할 수 없어 실제 위험은 낮다(model-config/triggers의 트랜잭션 분기와 달리 순수 순차 `await` 체인이라 순서 버그 여지도 없음). 우선순위 낮은 대칭성 갭으로 남긴다.
- 제안: 우선순위 낮음. 다음에 이 파일을 만질 기회에 `update`/`remove`/`duplicate` 각각에 "저장 실패 → 감사 미기록" 1건씩 추가해 4개 모듈 간 완전한 대칭을 맞추는 것을 고려.

## 회귀 테스트 확인 (긍정 소견)

- 4개 서비스(`schedules`/`triggers`/`workflows`/`model-config`) 전부에서 "커밋 → 감사 → (실패 가능한 외부 호출)" 순서를 `order: string[]` 배열로 고정하는 패턴이 일관되게 적용돼 있다 — 트랜잭션 경계 양쪽(`tx-start`+`tx-commit`)을 모두 찍어 "기록이 트랜잭션 안으로 들어가도 순서가 같아 통과하는" vacuous 함정을 명시적으로 피한다(`workflows.service.spec.ts:822-823` 주석이 이 함정을 직접 문서화).
- `remove()` 경로마다 "TypeORM `remove`가 엔티티의 id/kind/type을 지우므로 삭제 **전에** 읽어야 한다"는 불변식을 필드 삭제 mock으로 직접 재현해 고정한다(`triggers.service.spec.ts:2425-2446`, `model-config.service.spec.ts:1055-1078`).
- `triggers.service.spec.ts:2344-2373`("chatChannel 분기가 있어도 기록은 한 번이다 (W5 회귀)")는 과거 분기별 중복 기록 버그의 재발을 정확히 겨냥한 좋은 회귀 테스트다.
- `model-config.service.spec.ts:1021-1053`(W1 조치)·`triggers.service.spec.ts:2404-2423`(W3 조치)는 직전 라운드 WARNING을 정확히 해소했음을 확인 — 전자는 `saveWithDefaultSwap` 트랜잭션 경로의 감사 순서를, 후자는 저장 실패 시 감사 미기록을 각각 create/update 양쪽에서 검증한다.
- 13개 신규 액션 문자열 리터럴(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`) 전부가 최소 1개 이상의 서비스 유닛테스트에서 `toHaveBeenCalledWith`로 직접 단언된다 — "존재 커버리지" 관점에서 누락이 없다.

## Mock 적절성

- 4개 서비스 spec의 `AuditLogsService` mock(`{ record: jest.fn().mockResolvedValue(undefined) }` 등)은 실제 `record(entry): Promise<void>` 시그니처와 일치한다. 부수 효과라는 이유로 기본 mock화한 뒤, 감사 전용 describe 블록에서만 DI 컨테이너에서 실제 인스턴스를 되찾아 단언하는 패턴(`triggers.service.spec.ts:2271-2275`의 "createBaseProviders 는 모듈 레벨이라 describe 스코프 mock 을 못 받는다" 코멘트)이 일관되게 적용돼 실제 동작과의 괴리가 없다.
- `triggers.service.spec.ts`의 `createBaseProviders()` 팩토리는 매 `beforeEach` 호출마다 새 `jest.fn()`을 생성해 반환하므로 describe 블록 간 mock 상태 누수가 없다 — 격리 양호.

## 테스트 격리

- 모든 spec이 `beforeEach`에서 `Test.createTestingModule(...).compile()`을 새로 수행해 테스트 간 상태 공유가 없다. `model-config.controller.spec.ts:88-99`는 이전 라운드 WARNING("파이프/메타데이터가 상태를 가질 경우 공유 위험") 조치로 `pipe`/`metadata`도 `beforeEach`에서 재생성하도록 명시적으로 격리해뒀다(주석 "WARNING#1 fix" 참조).

## 요약

직전 라운드(`12_44_54`)가 지적한 WARNING 4건 중 2건(model-config `isDefault:true` 감사 순서 테스트, triggers 실패-시-미기록 테스트)은 커밋 `6032e2444`로 정확히 조치됐음을 코드 직접 대조로 확인했다. 그러나 나머지 1건 — 컨트롤러→서비스 `userId` 배선을 검증하는 유닛테스트 부재(schedules는 controller spec 파일 자체가 없고, triggers/workflows의 create·update·remove·duplicate, model-config의 create·setDefault가 전부 미검증) — 는 최소 4개 리뷰 라운드에 걸쳐 반복 지적됐음에도 여전히 미해결이며, 이번 라운드에서도 실제 코드 재확인으로 재확인됐다(현재 호출부 자체에 버그는 없음을 직접 대조했으나, 안전망은 없다). 감사 로깅 기능의 핵심 가치(행위자 귀속)에 직결되는 항목이라 WARNING으로 유지한다. 그 외에는 신규 로직 13개 액션 전부가 존재·순서·실패·필드-캡처 관점에서 뮤테이션에 강한 방식으로 촘촘히 테스트돼 있고, mock 충실도·테스트 격리·가독성(라운드별 회귀 근거를 주석에 남기는 관례)도 전반적으로 우수하다.

## 위험도

MEDIUM
