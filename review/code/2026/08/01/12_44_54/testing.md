# 테스트(Testing) 리뷰 — 감사 로깅(audit-logging) 커버리지 확장 (재검토)

이전 라운드(`review/code/2026/08/01/12_06_37/testing.md`)에서 지적된 CRITICAL(트리거
`update()`의 W6 순서 위반)은 `triggers.service.ts:342-355`에서 `recordAudit()`가
`syncScheduleActivation()`보다 먼저 실행되도록 수정되었고, 대응하는 순서 테스트
(`triggers.service.spec.ts:2375` "update 는 schedule 역동기화(BullMQ) 전에 기록한다
(C1 회귀)")도 추가되어 **해결 확인**. `importWorkflow()` 감사 누락 WARNING도
`workflows.service.ts:582-588` + `workflows.service.spec.ts:919-937` 테스트로 **해결
확인**. 다만 이전 라운드 WARNING 중 두 건은 **부분적으로만** 조치되었고, 한 건은 이번
재검토에서 신규로 발견됐다.

## 발견사항

### [WARNING] model-config `isDefault:true` 트랜잭션 경로(create/update)에 감사 순서 테스트가 여전히 없음 (이전 WARNING #2 잔여분)

- 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:924-1045`
  (`describe('감사 로깅 (model_config.*)')` 블록 전체 범위)
- 상세: 이전 라운드는 "`create()`/`update()`의 `isDefault: true` 분기(`saveWithDefaultSwap`
  트랜잭션)가 순서 검증은 물론 존재 커버리지조차 없다"고 지적했다. 이번 조치로
  schedules/triggers의 `update()` 순서 테스트는 추가됐지만(`schedules.service.spec.ts:345`
  "update 도 BullMQ 재등록 전에 기록한다 (W2)", `triggers.service.spec.ts:2375`), 정작
  지적의 원 출처인 model-config 는 그대로다. `감사 로깅` describe 블록(924-1045행)은
  `create`(933행, `isDefault` 미지정 — 단순 `repo.save` 분기), `update`(947행, 마찬가지
  단순 분기), `setDefault`(970/1002행, 트랜잭션 분기 + 순서/실패 테스트 있음), `remove`
  (1021행)만 다룬다. `service.create(..., { ...dto, isDefault: true }, ...)` 또는
  `service.update(..., { isDefault: true }, ...)` 를 호출해 `saveWithDefaultSwap`
  트랜잭션을 실제로 태우는 감사 테스트는 여전히 0건이다 — `model-config.service.ts:279-283`
  (create) / `:323-331`(update)의 트랜잭션 분기는 감사 기록 관점에서 미방문 코드다.
  `setDefault`에서 이미 증명된 리스크(트랜잭션 롤백 시 감사가 남으면 안 됨)가 같은
  `saveWithDefaultSwap` 헬퍼를 공유하는 다른 두 진입점에서는 검증되지 않는다.
- 제안: `setDefault`에 이미 있는 순서(`order: string[]`)/실패 테스트 패턴을 `create`
  (`isDefault: true`)·`update`(`isDefault: true`)에도 동일하게 추가.

### [WARNING] Controller → Service `userId` 배선 검증 갭 미해결 (이전 WARNING #3 잔여분)

- 위치:
  - `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:17` — 파일 전체가
    `describe('TriggersController.rotateBotToken', ...)` 하나뿐이다. `create`/`update`/
    `remove` 컨트롤러 메서드(`@CurrentUser('sub') userId`를 서비스로 위임)를 다루는
    describe 블록이 없다.
  - `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` — describe 블록이
    `execute`/`executeNode`/`graceful-shutdown`/`canvas+version`/`findAll`/
    `graph-warnings`뿐이고, `create`/`update`/`remove`/`duplicate`(모두 `userId`를
    서비스로 전달)는 없다.
  - `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` — 파일 자체가
    아직 존재하지 않는다(디렉터리에 `schedule-runner.service.spec.ts`,
    `schedules.service.spec.ts`만 있음).
  - `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` —
    `update`(166행)·`remove`(190행)는 "userId 까지 단언한다 — 감사 로그의 **주체**"
    코멘트와 함께 검증하지만, 같은 diff에서 `@CurrentUser('sub') userId`가 추가된
    `create`/`setDefault` 메서드는 여전히 describe 블록이 없다.
- 상세: 이전 라운드가 지적한 것과 동일하게, 서비스 레이어 `recordAudit()`는 "positional
  인자면 동일 타입(string) 순서 스왑을 컴파일러가 못 잡는다"는 위험을 스스로 문서화하는데
  (`triggers.service.ts:203-204`, `workflows.service.ts:171-172`,
  `model-config.service.ts:233-234` 등 동일 문구 반복), 컨트롤러→서비스 호출부는 여전히
  positional 인자(`this.triggersService.create(workspaceId, dto, userId)` 등)이고
  이를 잡을 컨트롤러 유닛테스트가 4개 모듈 중 model-config 의 update/remove 2곳에만
  존재한다. 나머지 경로(트리거/워크플로우의 create·update·remove·duplicate, 스케줄
  전체)는 컨트롤러가 서비스에 올바른 `userId`를 전달하는지 어떤 테스트도 확인하지 않는다.
- 제안: 최소한 model-config 의 update/remove 패턴을 나머지 경로에 확장.

### [WARNING] triggers.service.spec.ts 감사 describe 블록에 "실패 시 감사 미기록" 테스트가 전무 — 자매 모듈과 비대칭

- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2245-2426`
  (`describe('TriggersService — 감사 로깅 (trigger.*)')`)
- 상세: 같은 PR 로 함께 확장된 세 자매 모듈은 모두 "뮤테이션 자체가 실패하면 감사가
  기록되지 않는다"를 명시적으로 고정하는 테스트를 최소 1개씩 갖고 있다 —
  `model-config.service.spec.ts:1002` ("트랜잭션이 실패하면 setDefault 는 감사를 남기지
  않는다"), `schedules.service.spec.ts:278` ("감사 로깅 — 생성이 실패하면 남기지
  않는다"), `workflows.service.spec.ts:855` ("트랜잭션이 실패하면 create 는 감사를
  남기지 않는다"). 그런데 trigger 의 감사 describe 블록(2245-2426행)엔 `create`(2278행)·
  `update`(2299행)·`remove`(2404행) 성공 경로와 순서(order) 테스트만 있고,
  `triggerRepository.save`가 reject 하거나 `assertAuthConfigInWorkspace`/
  `assertChatChannelInputSafe`가 throw 했을 때 `recordAudit`가 호출되지 않는지 확인하는
  테스트가 없다(`grep 'auditLogs.record).not'` 결과 0건). `recordAudit`는 매 액션마다
  저장 커밋 직후 한 번만 호출되도록 코드가 짜여 있어 구조적으로는 안전하지만, 바로 그
  불변식이 이전 라운드에서 `update()` 순서 버그(CRITICAL, 이번엔 수정됨)로 실제 깨진
  전례가 있는 파일이라 회귀 방지 가치가 특히 크다.
- 제안: `triggerRepository.save`를 `mockRejectedValue`로 실패시키는 최소 1개 테스트를
  `create`/`update`(가능하면 `remove`도)에 추가해 "저장 실패 시 감사 미기록" 불변식을
  명시적으로 고정.

### [INFO] `audit-action.const.ts` 의 문서화된 명명 규약을 강제하는 테스트가 없음

- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:1-89`
  (`AUDIT_ACTIONS` 및 상단 JSDoc). 대응 테스트 파일 부재 확인
  (`codebase/backend/src/modules/audit-logs/` 디렉터리에 `audit-action.const.spec.ts`
  없음 — `audit-logs.spec.ts`는 `AuditLogsService`/컨트롤러만 다룸).
- 상세: 파일 상단 JSDoc(1-52행)이 `<resource>.<verb>` 형식·리소스별 시제 규약(CRUD 현재형
  vs 발생사건 과거분사)·"새 action 은 반드시 본 const 에 추가" 같은 상당히 구체적인 계약을
  명문화하고 있는데, 이를 코드로 강제하는 테스트가 전혀 없다. 예: `Object.values
  (AUDIT_ACTIONS)` 에 중복 문자열이 섞여 들어가거나, 새 액션이 `/^[a-z_]+\.[a-z_]+$/`
  형식을 어겨도(예: dot 누락, camelCase 유입) 어떤 테스트도 실패하지 않는다. 이 const 는
  13개 신규 액션이 이번 diff 에서 한 번에 추가된 "자주 손이 가는" 파일이라 향후 추가 시
  같은 실수(예: `workflow_created`처럼 dot 없는 값)가 조용히 통과할 위험이 상대적으로 크다.
- 제안: `Object.values(AUDIT_ACTIONS)`에 대해 (a) 중복 없음, (b) 전부
  `/^[a-z0-9_]+\.[a-z0-9_]+$/` 패턴 매치를 단언하는 가벼운 스펙 1개 추가. 비용 대비
  회귀 방지 효과가 크다.

## 회귀 테스트 확인 (긍정 소견)

- 세 자매 서비스(schedules/triggers/workflows) 모두 `order: string[]` 기법으로
  "커밋 → 감사 → (실패 가능한 외부 호출)" 순서를 뮤테이션에 강하게 고정하는 패턴이 이번
  라운드에서 `update()`까지 확장됐고, 특히 `workflows.service.spec.ts:822-823`의 주석
  ("'tx-start' 만 찍으면 기록이 트랜잭션 안으로 들어가도 순서가 같아 단언이
  통과한다(model-config 에서 실측한 vacuous 형태)")은 이전 라운드에서 실제로 관측된
  vacuous-assertion 함정을 문서화하고 양쪽 경계(`tx-start`+`tx-commit`)를 모두 찍어
  회피한 좋은 사례다.
- `model-config.controller.spec.ts`의 `ListModelConfigsQueryDto whitelist` describe 블록은
  과거 3개 라운드에 걸쳐 지적된 WARNING(파이프 격리·기본값·타입 강제·빈 문자열 falsy 분기)을
  전부 흡수해 회귀 가드를 촘촘히 두었다(96-158행).
- `AuditLogsService.record`의 best-effort(swallow) 계약이 `audit-logs.spec.ts:86-127`에서
  중앙 1곳에 테스트돼 있어, 4개 소비 모듈 각각이 "감사 기록 실패가 주 동작을 막지 않는다"를
  중복 테스트할 필요가 없는 설계는 적절하다.
- `triggers.service.spec.ts:2344-2373` ("chatChannel 분기가 있어도 기록은 한 번이다
  (W5 회귀)")는 과거 분기별 중복 기록 버그의 재발을 정확히 겨냥한 좋은 회귀 테스트다.

## Mock 적절성

- 각 서비스 spec 의 `AuditLogsService` mock(`{ record: jest.fn() }` 또는
  `jest.fn().mockResolvedValue(undefined)`)은 실제 시그니처(`record(entry): Promise<void>`)
  와 일치하고, 부수 효과라는 이유로 기본 mock 화한 뒤 감사 전용 describe 블록에서만
  실제 인스턴스를 컨테이너에서 되찾아 단언하는 패턴(예: `model-config.service.spec.ts:47`
  vs `triggers.service.spec.ts:2273` "createBaseProviders 는 모듈 레벨이라 describe 스코프
  mock 을 못 받는다 — 주입된 인스턴스를 컨테이너에서 되찾아 단언 대상으로 삼는다")이
  일관되게 적용돼 실제 동작과의 괴리가 없다.

## 요약

이전 라운드의 CRITICAL(트리거 `update()` W6 순서 위반)과 WARNING 3건 중 1건
(`importWorkflow` 감사 누락)은 확인 결과 정확히 조치됐다. 그러나 나머지 WARNING 2건은
부분 조치에 그쳤다 — "순서 테스트 확장"은 schedules/triggers 의 `update()`에는 적용됐지만
지적의 원 출처였던 model-config 의 `isDefault:true` 트랜잭션 분기(create/update)에는
아직 적용되지 않았고, "컨트롤러→서비스 userId 배선 검증"은 model-config 의 update/remove
2곳 외엔 그대로 비어 있다(schedules 는 controller spec 파일 자체가 없음). 여기에 더해
이번 재검토에서 신규로, triggers 의 감사 describe 블록만 유독 "실패 시 감사 미기록"
불변식 테스트가 없다는 비대칭을 발견했다 — 바로 그 파일이 과거 라운드에서 순서 버그가
실제로 났던 곳이라 회귀 방지 가치가 크다. 전반적으로 순서·실패·삭제-전-필드-캡처 같은
핵심 불변식을 뮤테이션에 강한 방식으로 테스트하는 코드베이스의 확립된 패턴 자체는
견고하며, 이번 지적들은 그 패턴을 4개 모듈에 걸쳐 완전히 대칭적으로 적용하라는 잔여
숙제에 가깝다 — 신규 로직에 테스트가 없는 것은 아니다.

## 위험도

MEDIUM
