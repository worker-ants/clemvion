# 아키텍처(Architecture) Review

## 검토 배경

본 diff(`git diff origin/main...HEAD`, 20개 파일)는 `model-config`/`schedules`/`triggers`/`workflows`
4개 모듈에 감사 로깅(13개 신규 액션)을 추가한다. 이 브랜치는 이미 여러 라운드의 리뷰·조치 사이클
(`10_05_53` → `10_49_18` → `12_06_37`)을 거쳤고, 직전 라운드(`12_06_37`)가 Critical 로 지적한
`TriggersService.update()` 의 "커밋 후 기록"(W6) 순서 위반과 `WorkflowsService.importWorkflow()` 감사
누락은 이후 커밋(`4b9f50a87` "4차 리뷰 조치")으로 수정되어 있다. 본 라운드는 그 수정을 포함한 최신
상태를 아키텍처 관점에서 재검증한다. `triggers.service.ts`/`triggers.service.spec.ts`/
`workflows.service.ts`/`workflows.service.spec.ts` 는 프롬프트에 전문이 없어 `Read` 로 워크트리
파일(`/Volumes/project/private/clemvion/.claude/worktrees/audit-logging/...`)을 직접 열어 확인했다.

## 발견사항

- **[INFO]** `recordAudit` private 헬퍼가 4개 서비스에 사실상 동일한 shape 으로 중복 구현되어 있다 (기존
  `auth-configs.service.ts` 까지 포함하면 5곳).
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239` /
    `codebase/backend/src/modules/schedules/schedules.service.ts:141` /
    `codebase/backend/src/modules/triggers/triggers.service.ts:209` /
    `codebase/backend/src/modules/workflows/workflows.service.ts:174`
  - 상세: "감사"라는 크로스커팅 관심사를 매 서비스에 손으로 재구현하는 방식이라, `resourceType` 고정 +
    named-param 위임이라는 동일한 뼈대가 5곳에 있다. `details` shape(`{kind}`/`{type}`/제네릭/없음)이
    도메인별로 갈리기 때문에 지금 당장 공용 팩토리로 뽑으면 오히려 어색한 제네릭이 될 수 있다는 점도
    사실이다. `RESOLUTION.md`(10_05_53, W4)가 이미 "6번째 리소스 추가 시점에 팩토리화 재검토"로 명시적
    유예를 결정했고, 이번 diff 는 그 결정 이후 새 리소스를 추가한 것이 아니라 그 4개를 최초로 채운
    것이므로 유예 판단의 전제를 흔들지 않는다. maintainability 리뷰가 이 지점을 WARNING(추출 후보)으로
    더 상세히 다루므로 여기서는 아키텍처 관점(크로스커팅 관심사가 DI 가능한 서비스로 분리되지 않고
    각 도메인 서비스에 재구현된 상태)만 기록한다.
  - 제안: 즉시 조치 불요. 5번째 신규 리소스 추가 시점에 `createAuditRecorder(auditLogsService, resourceType)`
    형태의 공용 팩토리 추출을 재검토(이미 RESOLUTION 에 등재된 방향과 동일).

- **[INFO]** `WorkflowsService` 내부에서 `userId` 파라미터의 위치가 형제 메서드 간에 통일돼 있지 않다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:191`(`create(workspaceId, userId, dto)`) /
    `:451`(`importWorkflow(workspaceId, userId, dto)`) — userId 가 dto **앞**
    vs `:229`(`update(id, workspaceId, dto, userId)`) / `:254`(`remove(id, workspaceId, userId)`) /
    `:277`(`duplicate(id, workspaceId, userId)`) — userId 가 **맨 뒤**.
  - 상세: 자매 서비스(`TriggersService`/`SchedulesService`/`ModelConfigService`)는 `create`/`update`/`remove`
    전부 "userId 는 항상 마지막 위치"로 일관되지만, `WorkflowsService` 는 `create`/`importWorkflow` 만
    예외적으로 가운데에 둔다(diff 이전부터 있던 기존 시그니처 — 이번 PR 이 새로 만든 배치는 아니다).
    `recordAudit(params: {...})` 를 named-param 객체로 설계한 이유가 바로 "동일 타입(string) 인자의
    positional 순서 스왑을 컴파일러가 못 잡는다"는 것인데, 그 상위 호출부인 서비스 공개 메서드
    자체는 여전히 `id`/`workspaceId`/`userId` 를 위치 인자로 받고 그 순서가 클래스 내부에서도
    일관되지 않아, 같은 클래스의 다른 메서드 시그니처에 익숙해진 호출자가 실수로 인자를 바꿔 넣기
    쉬운 조건을 만든다(다만 `dto` 파라미터는 타입이 달라 대부분의 스왑은 `tsc` 가 잡는다 — 실질
    위험은 낮음). 컨트롤러 호출부(`workflows.controller.ts`)는 현재 전부 올바른 순서로 호출하고
    있어 활성 버그는 아니다.
  - 제안: 급하지 않음. 다음에 이 파일의 메서드 시그니처를 만질 기회에 "userId 마지막" 규약으로 통일
    (`create(workspaceId, dto, userId)` 형태로 재배치하거나, 아예 4개 서비스 전체를 `{ workspaceId,
    userId }` 같은 옵션 객체로 통일).

- **[INFO]** `recordAudit` 의 `action` 파라미터가 서비스별로 좁혀지지 않고 `AUDIT_ACTIONS` 전체
  유니온을 받는다 — 인터페이스 분리(ISP) 관점에서 완전하지 않다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242` /
    `codebase/backend/src/modules/schedules/schedules.service.ts:144` /
    `codebase/backend/src/modules/triggers/triggers.service.ts:212` /
    `codebase/backend/src/modules/workflows/workflows.service.ts:177` — 네 곳 모두
    `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 타입.
  - 상세: `recordAudit` 는 이미 `resourceType` 을 클래스 상수로 고정해 "행위자·대상 뒤바뀜"(named-param)
    은 막지만, `action` 타입 자체는 34개 액션 전체를 받아들여 예컨대 `SchedulesService.recordAudit` 에
    `AUDIT_ACTIONS.MODEL_CONFIG_CREATE` 를 넘겨도 컴파일이 통과한다. 현재 호출부는 전부 자기 리소스의
    액션만 쓰고 있어 활성 버그는 아니지만, 리소스가 늘어날수록(현재 10개 그룹, 34개 액션) 오검증
    범위가 넓어진다.
  - 제안: 템플릿 리터럴 타입(`Extract<AuditAction, \`model_config.${string}\`>`)으로 서비스별 액션
    서브셋을 타입 레벨에서 좁히는 것을 검토. 위 `recordAudit` 팩토리 추출과 함께 처리하면 자연스럽다.

## 확인된 안전한 구조 (재검증)

- **레이어 책임 분리**: 컨트롤러는 `@CurrentUser('sub') userId` 추출과 HTTP 계약(상태 코드·DTO)만
  책임지고, "언제/무엇을" 감사할지는 서비스가 결정한다(트랜잭션 커밋 지점을 서비스만 알기 때문에
  타당한 위치). `audit-action.const.ts:15-19` 가 규정한 "인증 액션은 controller 경계에서 기록"
  원칙과 이번 diff 의 "CRUD 액션은 service 경계에서 기록" 은 서로 다른 규칙이 아니라, "누가 트랜잭션
  경계·세션 컨텍스트를 쥐고 있는가" 라는 동일 원칙의 두 적용이다.
- **모듈 경계·순환 의존성 없음**: `AuditLogsModule`(`codebase/backend/src/modules/audit-logs/audit-logs.module.ts`)
  은 `TypeOrmModule.forFeature([AuditLog])` 만 의존하는 순수 leaf 모듈이며 도메인 모듈을 되돌아
  참조하지 않는다. `model-config.module.ts:12` / `schedules.module.ts:24` / `triggers.module.ts:28` /
  `workflows.module.ts:24` 4곳 모두 `AuditLogsModule` 을 단방향으로 import 할 뿐이라 `forwardRef` 가
  전혀 필요 없다 — 크로스커팅 관심사 모듈이 지녀야 할 "많은 곳에서 소비되지만 아무것도 되돌아
  참조하지 않는" 형태를 정확히 지킨다.
- **커밋-후-기록 불변식(W6) 이 구조적으로 일관됨, C1 수정 확인**: `create`/`update`/`remove`/`setDefault`/
  `duplicate`/`importWorkflow` 전 경로가 DB 커밋 직후·실패 가능한 외부 호출(BullMQ·secret store·chat
  channel setup) 이전에 `recordAudit` 을 호출한다. 특히 `triggers.service.ts:342`(`recordAudit`)가
  `:353`(`syncScheduleActivation` — 내부에서 BullMQ 호출)보다 앞선다는 것과, `workflows.service.ts:582`
  (`importWorkflow` 의 신규 `recordAudit`)가 `:481` 트랜잭션 완료 이후 위치한다는 것을 직접 코드로
  재확인했다 — 직전 라운드의 Critical(C1)·Warning(importWorkflow 누락)이 실제로 해소됐다.
- **1:1 결합 리소스 감사 정책이 코드와 정합**: `audit-action.const.ts:38-44` 가 명문화한 "Schedule↔Trigger
  상호 직접 쓰기는 호출된 엔드포인트의 리소스만 기록한다" 원칙대로, `SchedulesService.create/update/remove`
  는 `Trigger` row 를 직접 쓰면서도 `trigger.*` 를 기록하지 않고 `TriggersService.syncScheduleActivation`
  도 `schedule.*` 를 기록하지 않는다 — 문서 갱신(W4)이 기존 구현과 실제로 일치한다(코드 변경 없이 문서만
  추가된 diff 이므로 이번 라운드에서 이 대칭을 재확인).

## 요약

크로스커팅 관심사(감사 로깅)를 leaf 모듈(`AuditLogsModule`)로 분리하고 각 도메인 서비스가 이를
단방향으로 소비하는 구조는 순환 의존성이 없고 레이어 책임(HTTP 관심사=컨트롤러, 트랜잭션·감사
시점 결정=서비스)도 명확하다. 직전 라운드가 Critical 로 지적한 트랜잭션-순서 위반(`TriggersService.
update()`)과 감사 누락(`WorkflowsService.importWorkflow()`)은 이후 커밋에서 실제로 수정됐음을 코드
대조로 확인했으며, "1:1 결합 리소스는 주 리소스만 기록한다"는 신규 설계 문서도 기존 구현과 정합적이다.
남은 항목은 전부 INFO 수준으로, `recordAudit` 보일러플레이트가 5개 서비스에 반복되는 것(이미 6번째
리소스 시점 재검토로 유예 결정됨), `WorkflowsService` 내부 `userId` 파라미터 위치 비일관(자매
서비스와 대비되는 기존 패턴, 활성 버그 아님), `action` 파라미터가 서비스별로 타입 좁혀지지 않은 점
(ISP 완전성의 사소한 여백) 정도다. 신규 순환 의존성·레이어 위반·안티패턴은 발견되지 않았다.

## 위험도

LOW
