# 유지보수성(Maintainability) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위

`spec/5-system/1-auth.md §4.1` Planned 갭(§1.1 `1-audit.md`)을 메우는 작업으로, `workflow.*`/`trigger.*`/
`schedule.*`/`model_config.*` CRUD 에 감사 로깅을 추가한다. 핵심 변경은 4개 서비스
(`ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService`) 각각에 `recordAudit()`
private 래퍼를 추가하고, 대응 컨트롤러가 `@CurrentUser('sub') userId` 를 서비스로 전파하는 동일한 패턴을
반복한다. 이 패턴은 이미 코드베이스에 존재하는 `AuthConfigsService.recordAudit()`(주석이 "auth-configs
W-1 과 동일 근거"로 명시적으로 인용하는 선례)을 그대로 답습한다. `review/consistency/2026/08/01/09_11_58/**`
하위 8개 파일은 이전 `/consistency-check` 실행 산출물(자동 생성 리포트)이며 소스 코드가 아니므로 본
유지보수성 관점 검토 대상에서 제외했다(저장 위치 자체는 `CLAUDE.md` 규약과 일치).

## 발견사항

- **[WARNING]** `triggers.service.spec.ts` 신규 describe 블록에 죽은 코드(dead code) — 첫 `auditLogs` 할당과 `idx`/`void idx` 블록이 아무 효과 없이 버려진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2154`, `:2166-2170` (`describe('TriggersService — 감사 로깅 (trigger.*)')` → `beforeEach`)
  - 상세: `beforeEach` 첫 줄에서 `auditLogs = { record: jest.fn().mockResolvedValue(undefined) }` 를
    만들지만, 이 객체는 `Test.createTestingModule({ providers: createBaseProviders({...}) })` 에 전달되지
    않는다 — `createBaseProviders`(모듈 스코프 헬퍼)가 내부에서 **별도의** `{ provide: AuditLogsService,
    useValue: { record: jest.fn() } }` 를 이미 등록하기 때문이다(`triggers.service.spec.ts:35`). 그 뒤
    `auditLogs = moduleRef.get(AuditLogsService) as unknown as {...}` 로 실제 주입된 인스턴스를 다시 가져와
    같은 변수를 덮어쓰므로, 첫 줄의 할당과 `.mockResolvedValue(undefined)` 설정은 어떤 테스트에도 관측되지
    않고 100% 버려진다. 그 사이에 낀 `const idx = moduleRef as unknown as { container?: unknown } as unknown
    as never; void idx;` 4줄은 선언·캐스팅·즉시 `void` 폐기 외에 아무 일도 하지 않는다 — 무언가를
    override 하려던 시도의 흔적으로 보이나 실제 override 는 다음 줄의 `moduleRef.get(AuditLogsService)`
    재조회로 이뤄지고, 이 블록 자체는 완전한 no-op 이다(eslint 도 `void` 로 unused-var 를 우회해 아무
    경고를 내지 않는다 — 실측 확인). 같은 PR 의 나머지 3개 spec 파일
    (`model-config.service.spec.ts`/`schedules.service.spec.ts`/`workflows.service.spec.ts`)은 모두
    `auditLogs` 객체를 먼저 만들고 `{ provide: AuditLogsService, useValue: auditLogs }` 로 바로 등록하는
    깔끔한 단일 경로를 쓰는데, 이 파일만 공유 팩토리(`createBaseProviders`) 제약 때문에 사후 재조회가
    필요했고 그 과정에서 시행착오 흔적이 정리되지 않고 남았다.
  - 제안: 첫 `auditLogs = {...}` 할당(라인 2154, 실질적으로 재할당 전까지 죽어 있는 값)과 `idx`/`void idx`
    4줄(라인 2166-2170)을 제거한다. `let auditLogs: { record: jest.Mock };` 선언만 유지하고
    `moduleRef.get(AuditLogsService)` 재조회 한 줄로 충분하다 — 왜 재조회가 필요한지 설명하는 기존 주석
    ("createBaseProviders 는 모듈 레벨이라 공유 mock 을 못 받는다 — 여기서 override")은 그대로 유지.

- **[WARNING]** `TriggersService.create()`/`update()` 에서 동일한 `recordAudit()` 호출이 두 분기에 중복되어 향후 드리프트 위험
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create()` 271-287번째 줄
    (`if (chatChannel) { ... if (refreshed) { recordAudit(...); return ...; } } recordAudit(...); return ...;`),
    `update()` 356-372번째 줄에 동일 구조
  - 상세: `chatChannel` 갱신 후 재조회(`refreshed`)가 성공하면 그 안에서 `recordAudit({..., resourceId:
    refreshed.id, type: refreshed.type})` 을 호출하고, 재조회가 없거나 `chatChannel` 이 없으면 함수 끝에서
    `recordAudit({..., resourceId: saved.id, type: saved.type})` 를 호출한다 — action/필드 구성이 사실상
    동일한 호출이 한 함수 안에 두 곳 존재한다. PR 이전에는 이 두 분기가 각각 단순 `return
    this.sanitizeChatChannelForResponse(x)` 한 줄이라 중복이 없었는데, 이번 PR 이 감사 호출을 양쪽에
    독립적으로 추가하면서 새로 생긴 중복이다. `recordAudit()` 의 자체 JSDoc 이 "positional 인자 순서
    스왑이 컴파일러로 안 잡힌다"는 위험을 명시적으로 경계하고 있는 만큼, 같은 함수 안에서 호출부가
    두 번 존재하면 향후 `details` 필드를 하나만 늘리거나 조건을 바꿀 때 한쪽만 고치고 다른 쪽을 놓치는
    사고(신규 필드 누락·조용한 필드 drift)가 나기 쉽다.
  - 제안: `const result = refreshed ?? saved;` 로 통합한 뒤 `recordAudit({..., resourceId: result.id, type:
    result.type})` 를 한 번만 호출하고 `return this.sanitizeChatChannelForResponse(result);` 로 마무리하면
    분기당 중복 6줄이 사라지고 두 액션(`create`/`update`) 모두 단일 호출 지점을 갖게 된다.

- **[INFO]** 신규 4개 서비스가 이미 export 된 `AuditAction` 타입 별칭을 재사용하지 않고 매번 인라인으로 재도출
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:144`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:212`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:177` — 4곳 모두
    `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];`
  - 상세: `audit-action.const.ts` 는 이미 `export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof
    AUDIT_ACTIONS];` 를 export 하고, `AuditLogsService.record()` 자신도 `action: AuditAction` 으로 이를
    사용한다. 이번 PR 이 명시적으로 선례로 인용하는 `auth-configs.service.ts` 역시 `import { AUDIT_ACTIONS,
    AuditAction } from '../audit-logs/audit-action.const'` 후 `action: AuditAction` 으로 깔끔하게 쓴다
    (실측: `grep` 결과 4개 신규 파일만 예외 없이 인라인 매핑 타입을 재작성). 기능·타입 안전성에는 차이가
    없지만(구조적으로 동일 타입), "auth-configs 와 동일 근거" 라고 스스로 주석에서 인용하는 패턴을
    4곳 모두 똑같이 살짝 벗어난 점은 그 선례를 실제로 열어 대조하지 않고 복붙했을 가능성을 시사한다.
  - 제안: 4개 파일 모두 `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const';`
    로 바꾸고 `action: AuditAction;` 으로 축약 — 기계적이고 위험 없는 정리.

- **[INFO]** `recordAudit()` 래퍼 보일러플레이트가 5개 서비스로 확산(auth-configs 기존 1 + 이번 PR 4)
  - 위치: `model-config.service.ts:232-254`, `schedules.service.ts:137-154`, `triggers.service.ts:202-224`,
    `workflows.service.ts:170-189` (+ 기존 `auth-configs.service.ts:73-95`)
  - 상세: 다섯 곳 모두 "named 필드 — positional 이면 인자 순서 스왑을 컴파일러가 못 잡는다(auth-configs
    W-1)" 는 동일 rationale 문단을 반복하고, `private recordAudit(params: {...}): Promise<void> { return
    this.auditLogsService.record({...}); }` 형태의 얇은 위임 래퍼를 각자 다시 작성한다. `details` 조립
    방식만 도메인별로 다르다(`model_config`→`{kind}`, `trigger`→`{type}`, `workflow`→임의 `details?`,
    `schedule`/`auth_config`→없음/`ipAddress`). 축(axis)이 갈리는 부분이 있어 100% 동일 코드는 아니지만,
    "resourceType 고정 + named-param 위임" 이라는 뼈대 자체는 다섯 번 손으로 다시 쓰였다.
  - 제안: 시급하지 않음(현재도 각 서비스가 짧고 명확해 즉시 위험은 없음). 다만 6번째 리소스가 추가되는
    시점에는 `audit-logs` 모듈에 `createResourceAuditRecorder(auditLogsService, resourceType)` 같은 작은
    팩토리를 두고 각 서비스가 `private readonly recordAudit = createResourceAuditRecorder(this.auditLogsService,
    'model_config')` 형태로 얇게 바인딩하는 것을 고려할 만하다 — rationale 주석 자체도 한 곳에만 있으면 된다.

- **[INFO]** `schedules.controller.ts`/`workflows.controller.ts` 안에서 `@CurrentUser` 두 스타일이 혼재
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — 기존 `runNow`(179번째 줄)는
    `@CurrentUser() user: JwtPayload` + `user.sub`, 신규 `create`/`update`/`remove`(153/203/224번째 줄)는
    `@CurrentUser('sub') userId: string`. `codebase/backend/src/modules/workflows/workflows.controller.ts`
    도 기존 8개 엔드포인트(`findAll`/`create`/`duplicate`/`execute`/`executeNode`/`saveCanvas`/
    `restoreVersion`/`importWorkflow`)는 `user: JwtPayload` 전체 페이로드 스타일이고, 신규 `update`/
    `remove`(185/206번째 줄)만 `'sub'` 축약 스타일.
  - 상세: 두 스타일 모두 코드베이스 전역에는 이미 존재한다(`auth-configs.controller.ts`/
    `workflow-assistant.controller.ts`/`workflow-test-datasets.controller.ts` 는 `'sub'` 축약을 일관되게
    쓰고, `alerts`/`sessions`/`notifications`/`workspaces` 컨트롤러는 `user: JwtPayload` 를 일관되게 쓴다)
    — 이번 PR 이 전역 규약을 새로 깬 것은 아니다. 다만 **같은 파일 안**에서 두 스타일이 나란히 있는 상태를
    만든 것은 이번 PR 이 처음이라, 그 파일만 열어보는 사람은 어느 쪽이 이 파일의 규약인지 헷갈릴 수 있다.
  - 제안: 차단 사유 아님. 여유가 있을 때 해당 두 파일 내에서 스타일을 하나로 통일(예: 기존 다수 스타일을
    따라 `user: JwtPayload` + `.sub` 로) 하면 파일 내 일관성이 개선된다.

- **[INFO]** `WorkflowsService.duplicate()` diff의 대부분이 로직 변경이 아닌 재들여쓰기 노이즈
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()` (약 277-405번째 줄)
  - 상세: `return this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` 를 `const
    duplicated = await this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` 로 바꾸는
    과정에서 Prettier 가 콜백 인자를 여러 줄로 재배치하며 콜백 본문 전체가 한 단계 더 들여쓰기됐다 — 실제
    unified diff 상 `-`/`+` 로 표시되는 줄이 100줄 이상이지만 의미상 변경은 "transaction 결과를 변수에
    담고, 커밋 뒤 recordAudit 호출을 추가하고, 마지막에 `duplicated` 를 반환" 3가지뿐이다. 결과 코드
    자체는 문제 없지만, 이런 형태의 diff 는 리뷰 시점과 향후 `git blame`/히스토리 추적 시점 모두에서
    실제 로직 변경 지점을 재들여쓰기 노이즈 속에서 다시 찾아야 하는 비용을 만든다.
  - 제안: 차단 사유 아님, 참고용. 이후 유사 변경에서는 콜백을 별도 named 함수로 뽑아 트랜잭션 호출부의
    들여쓰기가 흔들리지 않게 하면 diff 가 로직 변경에만 집중된다.

## 요약

전반적으로 이번 변경은 이미 코드베이스에 확립된 감사 로깅 패턴(`AuthConfigsService.recordAudit`, named-param
방어, 트랜잭션 커밋 후 기록, TypeORM `remove()` 이전에 필드 선-캡처)을 네 서비스에 충실히 반복 적용했고,
리소스 타입 상수·액션 명명(`AUDIT_ACTIONS`)·컨트롤러의 `@CurrentUser('sub')` 전파 순서 등 새로 추가된
표면은 일관되고 읽기 쉽다. 매직 넘버는 없고 함수 길이·중첩 깊이도 과도하지 않다. 다만 세부적으로는 두 가지
WARNING 이 있다 — (1) `triggers.service.spec.ts` 신규 describe 블록에 시행착오 흔적으로 보이는 완전한
죽은 코드(첫 `auditLogs` 재할당 + `idx`/`void idx` 4줄)가 정리되지 않고 남아 있고, (2) `TriggersService`
의 `create`/`update` 는 `chatChannel` 재조회 분기와 폴백 분기에 동일한 `recordAudit()` 호출을 독립적으로
두 번 작성해, 자기 자신의 JSDoc 이 경계하는 것과 같은 종류의(단, 다른 형태의) drift 위험을 스스로 만든다.
나머지는 전부 INFO 수준으로, 스스로 인용한 `auth-configs.service.ts` 선례와 미묘하게 다른 타입 표기,
5번째로 늘어난 `recordAudit` 보일러플레이트, 두 컨트롤러 파일 내 `@CurrentUser` 스타일 혼재, `duplicate()`
의 재들여쓰기로 부풀려진 diff — 모두 즉시 위험은 없지만 알아두면 좋은 사소한 개선 여지다.

## 위험도

LOW
