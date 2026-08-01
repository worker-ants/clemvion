STATUS=success 테스트 리뷰 완료 — WARNING 2건, INFO 2건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 방법

프롬프트 번들(45개 파일) 전체를 확인한 뒤, 크기 제한으로 diff 가 생략됐거나 전체 컨텍스트가 없던
`model-config.service.spec.ts`·`triggers.service.spec.ts`·`workflows.service.ts`·`workflows.service.spec.ts`
를 `Read`/`Grep` 으로 직접 열어 대조했다. 이전 리뷰 라운드(`review/code/2026/08/01/10_05_53/`)의
`testing.md`·`RESOLUTION.md`가 지적·조치했다고 주장한 C2(recordAudit 미검증 8곳)·W5(triggers 이중 호출)·
W9(공유 mock 미복원)·W10(죽은 코드)이 실제로 고쳐졌는지 하나씩 소스에서 재확인했다.

또한 대상 6개 spec 파일을 직접 실행해(`jest ... --silent`) 244 passed / 1 skipped / 0 failed 를 실측
확인했다(RESOLUTION.md 의 "unit: PASS" 주장과 일치).

**리뷰 중 브랜치에 새 커밋 2개(`a92f53df6` fix C2/W5/W6/W9/W10/W2, `5e44ff8a0` style eslint --fix)가
반영되어 `triggers.service.spec.ts`·`workflows.service.spec.ts`·`model-config.service.spec.ts` 의 줄
번호가 이동했다** — 아래 위치는 모두 이 커밋들 반영 후의 **현재 HEAD 기준 실측 줄 번호**다(재확인 시각
2026-08-01 11:00 KST, `git status` clean, HEAD=`5e44ff8a0`).

## 발견사항

- **[WARNING]** `triggers.service` — `chatChannel` 분기 존재 시 `recordAudit` 이중 호출 회귀를 잡아낼 테스트가 없음 (직전 라운드 W5 수정의 잔여 커버리지 갭)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2245-2336`(`describe('TriggersService — 감사 로깅 (trigger.*)'`, create 테스트 `2278-2297`·update 테스트 `2299-2312`) / 대응 프로덕션 코드 `codebase/backend/src/modules/triggers/triggers.service.ts:226-284`(`create`, chatChannel 분기 `273-282`)·`:286-364`(`update`, chatChannel 분기 `353-362`)
  - 상세: 직전 라운드 `RESOLUTION.md`(W5)는 "`triggers` create/update 가 chatChannel 분기별로 `recordAudit` 을 2회씩 호출하던 것을 `result` 변수로 통합해 1회 호출로 고쳤다"고 기록한다. 소스를 직접 확인한 결과 수정 자체는 정확하다 — `recordAudit` 호출은 저장 직후 정확히 1곳(`create` 262행대·`update` 344행대)에만 있고, `if (chatChannel) { ... }` 블록(`create` 273-282, `update` 353-362) 안에는 재호출이 없다. 문제는 **이 "정확히 1회" 불변식을 고정하는 회귀 테스트가 전혀 없다는 것**이다. `triggers.service.spec.ts` 전체에서 `auditLogs.record` 를 단언하는 테스트는 정확히 3개(2278/2299/2314행)뿐이고, 셋 다 `chatChannel` 필드가 없는 입력만 쓴다 — create 테스트는 `{ workflowId: 'wf-1', type: 'webhook', name: 'W' }`(2284행), update 테스트는 `{ name: 'W2' }`(2302행)로 둘 다 `chatChannel` 부재. 호출 횟수 단언(`toHaveBeenCalledTimes`)도 이 3개 테스트 어디에도 없다 — `grep -rn "toHaveBeenCalledTimes" .../triggers/` 결과 0건인 반면, 동일 패턴(named-field `recordAudit` 헬퍼)을 쓰는 자매 모듈 `model-config.service.spec.ts:936` 은 `expect(auditLogs.record).toHaveBeenCalledTimes(1)` 을 명시적으로 단언한다 — 4개 모듈 중 이 불변식을 실제로 잠그는 곳은 model-config 하나뿐이다. `chatChannel` 흐름 전용 테스트 파일인 `triggers.web-chat.spec.ts` 도 `AuditLogsService` 를 `{ record: jest.fn() }` 로 mock 만 할 뿐 호출 여부·횟수를 단언하지 않는다(코드 확인). 즉 향후 누군가 `details` 필드를 리소스별로 다르게 늘리다가(코드 주석이 정확히 이 시나리오를 경고한다: "details 필드를 늘릴 때 한쪽만 고치는 drift 위험") `if (chatChannel) { ...; await this.recordAudit(...); }` 형태로 예전 버그를 재도입해도, 현재 테스트 스위트는 아무 실패 없이 통과한다 — chatChannel 이 있는 입력을 감사 전용 describe 블록에 준 적이 없어 회귀를 관측할 기회 자체가 없다.
  - 제안: `TriggersService — 감사 로깅 (trigger.*)` 블록에 `chatChannel` 을 포함한 create/update 케이스를 최소 1개씩 추가하고 `expect(auditLogs.record).toHaveBeenCalledTimes(1)` 을 단언한다(model-config 의 기존 패턴 재사용 가능).

- **[WARNING]** `workflows.service.duplicate()` — 트랜잭션 커밋 뒤 기록·롤백 시 미기록을 고정하는 테스트가 없음 (동일 패턴의 `create()` 대비 비대칭 커버리지)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:732-742`(`it('duplicate 는 details.duplicatedFrom...')` — 순서 미검증) / `:408-797`(`describe('duplicate'` 전체) / 비교 대상 `:798-847`(`describe('감사 로깅 (workflow.*)'`, `create()` 전용 순서·롤백 테스트) / 대응 프로덕션 코드 `codebase/backend/src/modules/workflows/workflows.service.ts:277-405`(`duplicate`, `recordAudit` 호출 `397-403`은 `dataSource.transaction('REPEATABLE READ', ...)`(`294-394`) 완료 **뒤**)
  - 상세: `create()`(`workflows.service.ts:191-227`)와 `duplicate()`(`277-405`)는 "`dataSource.transaction(...)` 커밋 후에 `recordAudit` 호출" 이라는 동일한 구조·동일한 리스크(뮤턴트가 `recordAudit` 호출을 트랜잭션 콜백 안으로 옮겨도 최종 호출 자체는 여전히 일어나 단언이 통과할 수 있음)를 공유한다. `RESOLUTION.md`는 뮤턴트 테스트로 `create()` 의 기존 두 테스트가 이 리스크에 대해 애초 vacuous 했음을 발견해 고쳤다고 명시한다("경계를 양쪽 다 찍어야 안/밖이 구분된다" — 실제로 `:799-831` 의 `order: string[]` 순서 고정 테스트와 `:833-847` 의 롤백 테스트로 반영돼 있음, 확인 완료). 그런데 동일 위험을 지닌 `duplicate()` 에는 상응하는 테스트가 없다: `it('duplicate 는 details.duplicatedFrom...')`(732행)는 `auditLogs.record` 가 올바른 `details` 로 호출됐는지만 확인할 뿐 트랜잭션 콜백 안/밖 순서는 전혀 관측하지 않는다. `duplicate` describe 블록(`408-797`) 전체에서 `rejects`/`toThrow` 단언은 정확히 1건(`788-795`, "워크스페이스 밖 워크플로우는 404 로 막고 트랜잭션을 열지 않는다")뿐인데, 이는 트랜잭션에 **진입하기 전** 404 가드를 검증하는 것이지 트랜잭션이 **열린 뒤** 실패(commit reject 등)하는 경로가 아니다 — 즉 `duplicate()` 트랜잭션이 중간에 실패했을 때 (a) 부분 사본이 남지 않는지, (b) `workflow.created` 감사가 남지 않는지 둘 다 미검증이다. 덧붙여, `create()` 용으로 작성된 커스텀 `mockDataSource.transaction` override(`804행`, `jest.fn(async (cb: any) => {...})`, 1-인자 콜백 전제)를 `duplicate()` 에 그대로 재사용하면 깨진다 — 실제 `duplicate()` 호출은 `transaction('REPEATABLE READ', cb)` 2-인자 형태라 override 의 `cb` 매개변수에 문자열 `'REPEATABLE READ'` 이 바인딩돼 `cb(mockTransactionManager)` 가 `TypeError` 를 던진다(기본 `mockDataSource`(라인 92대, 이 파일 최상단)는 `args.find(a => typeof a === 'function')` 로 이를 이미 올바르게 처리하지만, 감사 전용 override 는 이를 흡수하지 않는다) — 후속 작성자가 단순 복붙으로 테스트를 추가하려 하면 걸려 넘어질 함정이다.
  - 제안: `create()` 의 순서 고정 테스트·롤백 테스트를 `duplicate()` 에도 대칭으로 추가한다. override 작성 시 isolation-level 인자를 흡수하도록 `(...args: unknown[]) => args.find(a => typeof a === 'function')` 패턴을 재사용할 것(기본 `mockDataSource` 와 동일 패턴).

- **[INFO]** `schedules`/`triggers` — "커밋 직후 기록" 이 순차 코드 배치로만 보장되며, 이후 외부 호출이 실패해도 감사가 이미 남아 있음을 직접 검증하는 테스트는 없음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:156-199`(`create`, `recordAudit` 호출 `188`대 vs BullMQ `registerJob` 호출 `198`) — 관련 테스트 `codebase/backend/src/modules/schedules/schedules.service.spec.ts:261-320`(감사 로깅 4건, 전부 `scheduleRunnerService.registerJob` 성공을 전제로 함)
  - 상세: model-config(`setDefault`)·workflows(`create`/`duplicate`)는 실제 DB 트랜잭션 경계 안에서 순서가 뒤바뀔 수 있어 런타임 순서 고정 테스트가 필수였다. schedules/triggers 의 "커밋 후 기록"은 트랜잭션이 아니라 단순 순차 `await` 문 배치라 소스를 눈으로 훑는 것만으로도 순서 위반이 드러나 상대적으로 위험이 낮다. 다만 "그 뒤 `scheduleRunnerService.registerJob`/`triggers` 의 secret 마이그레이션·chatChannel setup 이 실제로 던져도 감사는 이미 커밋돼 있다"를 직접 실행해 확인하는 테스트는 4개 모듈 어디에도 없다 — 이 자체가 W6 가 고치려 한 정확한 시나리오라는 점에서 회귀 방지 관점의 완결성이 살짝 아쉽다.
  - 제안: 우선순위 낮음(선택). `scheduleRunnerService.registerJob`/`setupChatChannel` mock 을 reject 하도록 만들고 그 직전에 `auditLogs.record` 가 이미 호출됐음을 확인하는 테스트를 각 1개씩 추가하면 W6 불변식이 완전히 잠긴다.

- **[INFO]** 컨트롤러 레벨 `userId` 배선 검증이 4개 모듈에 걸쳐 비일관 (직전 라운드 W8, 이미 추적됨 — 현재 상태 재확인)
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts`(스펙 파일 자체가 부재 — `ls .../schedules/*.spec.ts` 로 확인), `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`(`rotateBotToken` 만 테스트, `create`/`update`/`remove` 테스트 0건), `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`(`create`/`update`/`remove` 델리게이션 테스트 0건) — 반례: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts:166-207`(`update`/`remove` 는 `userId` 전달까지 단언, `create`/`setDefault` 는 여전히 미단언)
  - 상세: `RESOLUTION.md` 가 W8 을 "부분 조치 — 서비스 레벨 테스트가 userId 를 단언하므로 배선 자체는 타입으로 강제된다(누락 시 TS2554)" 로 명시하며 `plan/in-progress/spec-sync-auth-gaps.md` §4.1 후속에 "컨트롤러 spec 보강 (W8)" 으로 등재해 뒀다. 직접 확인 결과 이 서술은 현재도 정확하다 — 타입 강제(컴파일 실패)는 "인자를 아예 빠뜨리는" 회귀만 잡고, "잘못된 변수를 전달"(예: `@WorkspaceId()` 값을 `userId` 자리에 전달)하는 류의 논리적 배선 오류는 컴파일러도 서비스 레벨 테스트도 잡지 못한다 — 오직 컨트롤러 레벨 위임 단언만 이를 잡는데, 그게 4개 모듈 중 model-config 의 `update`/`remove` 2곳에만 있다. 새로 발견한 결함은 아니며 이미 계획에 등재돼 있어 CRITICAL/WARNING 승격은 불필요하지만, 이번 라운드에서도 그대로 남아 있음을 재확인해 둔다.
  - 제안: 조치 불요(이미 추적됨). 후속 스프린트에서 `schedules.controller.spec.ts` 신설 + `triggers`/`workflows` 컨트롤러 spec 에 create/update/remove 델리게이션(및 `userId` 전달) 테스트 추가를 권장.

## 검증했으나 문제 없음으로 판단한 항목 (직전 라운드 조치 재확인)

- **C2(Critical) — recordAudit 8곳 무검증**: `triggers` create/update(chatChannel 2분기 포함) 4곳·`workflows` update/remove 2곳·`schedules` update/remove 2곳 = 8곳 전부에 회귀 테스트가 실제로 추가돼 있고(각 모듈 spec 확인), 244개 유닛 테스트가 실측으로 GREEN 이다. 다만 위 WARNING 이 지적하듯 "recordAudit 이 호출됨" 자체는 이제 잘 잠겨 있으나 "정확히 몇 번·어떤 분기에서" 까지 잠근 곳은 4곳 중 model-config 뿐이다.
- **W9 — workflows spec 공유 mock 미복원**: `workflows.service.spec.ts:816-830`·`842-847`(현재 줄 번호) 둘 다 `try { ... } finally { mockDataSource.transaction = origTx; }` 로 정정돼 있음을 직접 확인.
- **W10 — triggers spec 죽은 코드**: `const idx = ...; void idx;` 패턴이 `triggers.service.spec.ts` 전체에서 `grep` 0건 — 완전히 제거됐고, "여기서 override" 주석은 실제 override 지점(`2273`행, `auditLogs = moduleRef.get(AuditLogsService)...`) 바로 위로 옮겨져 있다.
- **model-config 의 TypeORM `remove()` PK-소실 함정**: `model-config.service.spec.ts:1009-1032`(`remove 는 삭제 전에 읽은 kind 를 남긴다`)와 `triggers.service.spec.ts:2314-2335`가 둘 다 mock `remove` 구현 안에서 `delete entity.id`/`delete entity.type` 을 수행해 "삭제 후 필드를 읽으면 undefined" 버그를 실제로 재현 가능한 형태로 가드한다 — 이름뿐인 방어가 아니라 실행 가능한 회귀 테스트다.
- **model-config `setDefault` 트랜잭션 순서**: `:958-988`(커밋 뒤 기록, `order` 배열로 tx-start/tx-commit/audit 3단계 모두 관측) / `:990-1007`(롤백 시 미기록, 콜백을 실제 실행한 뒤 throw하는 형태로 vacuous 회피) — 두 테스트 모두 코드 주석이 "그 뮤턴트가 GREEN 이었다"는 실측을 남겨 신뢰도가 높다.
- **테스트 격리**: 6개 spec 파일 모두 `beforeEach` 에서 `Test.createTestingModule(...)` 로 매 테스트 새 모듈을 컴파일하거나(model-config/schedules/workflows), `createBaseProviders(...)` 로 매 테스트 새 provider 세트를 구성한다(triggers) — 테스트 간 상태 공유·순서 의존 없음.
- **Mock 적절성**: `AuditLogsService` 를 4개 서비스 spec 전체에서 `{ record: jest.fn() }` 형태로 일관되게 mock 하고, "감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다. 실제 기록 여부는 audit 전용 describe 가 따로 단언한다" 라는 동일 주석을 반복해 의도를 명확히 한다 — 실제 인터페이스(단일 `record()` 메서드)와 정확히 일치하는 최소 mock 이며 과도한 mock 이 아니다.
- **회귀 테스트**: 기존 테스트(encrypt/decrypt, SSRF guard, cross-kind leak 방지, cron/timezone 처리 등)는 신규 `userId` 인자를 추가로 전달하도록만 바뀌었을 뿐 기존 단언·시나리오는 그대로 유지된다 — 직접 실행 결과 244 passed 로 회귀 없음을 실측 확인.

## 요약

프로덕션 코드 자체는 정확하다 — 직전 라운드가 발견한 Critical(recordAudit 미검증)·Warning(triggers 이중 호출·workflows mock 미복원·죽은 코드) 전부가 실제로 고쳐졌고, 244개 유닛 테스트가 실측으로 통과하며, 뮤턴트 기반 회귀 테스트(트랜잭션 순서·삭제 후 필드 읽기)가 곳곳에 근거 주석과 함께 잘 심어져 있다. 다만 이 PR 이 스스로 세운 "뮤턴트로 vacuous 테스트를 잡는다"는 높은 기준을 4개 모듈에 완전히 대칭으로 적용하지는 못했다: (1) `triggers` 의 chatChannel 분기 이중 호출은 직전 라운드에서 실제로 있었던 버그(W5)인데, 그 회귀를 감지할 테스트는 여전히 없다 — model-config 만 호출 횟수를 명시적으로 잠근다. (2) `workflows.duplicate()` 는 `create()` 와 완전히 동일한 "트랜잭션 커밋 후 기록" 구조를 갖지만, `create()` 에만 순서 고정·롤백 테스트가 있고 `duplicate()` 는 없다 — 심지어 `create()` 용 mock override 를 그대로 재사용하면 isolation-level 인자 처리 미비로 깨지는 함정까지 있다. 두 건 모두 "지금 당장 잘못 동작하는 코드"는 아니지만, 정확히 이 코드베이스에서 최근에 실제로 발생했던 버그 클래스(이중 호출·트랜잭션 순서 위반)를 재발 방지하는 안전망에 뚫린 구멍이라 WARNING 으로 기록한다. 그 외 스케줄/트리거의 "커밋 후 외부호출 실패해도 감사는 남는다" 실증 테스트 부재와, 컨트롤러 레벨 userId 배선 검증 비일관(W8)은 이미 추적 중인 낮은 우선순위 항목이라 INFO 로만 남긴다.

## 위험도

LOW
