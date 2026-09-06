# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `schedules.service.ts::create()` 가 이번에 고친 정확한 회귀(“`isActive:false` 로 생성하면 트리거는 생겼는데 응답에서 `trigger` 키가 사라진다”)를 잠그는 테스트가 unit·e2e 어디에도 없다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `async create(...)` (198~203번째 줄, `saved.trigger = savedTrigger;` 를 `if (isActive)` 밖으로 옮긴 자리)
  - 상세: 주석 자체가 “종전에는 이 대입이 `if (isActive)` 안에 있어서 … 응답에서 `trigger` 키가 사라졌다”고 정확히 버그를 설명한다. 그런데 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 생성 테스트(`C.`/`C-2.`/`D.`/`E.`)는 전부 `POST /api/schedules` 요청 바디에 `isActive` 를 넣지 않아 항상 기본값(`true`)으로만 생성한다(`grep -n "isActive" schedule-trigger.e2e-spec.ts` 실측 — 나오는 3곳은 전부 `PATCH /api/triggers/:id`(트리거 자체 PATCH, G/H) 관련이지 스케줄 생성 바디가 아니다). `schedules.service.spec.ts` 에도 `create()` 를 `isActive:false` 로 호출해 `saved.trigger` 존재를 단언하는 테스트가 없다(같은 파일의 `isActive:false` 등장 2곳은 모두 `update()` 테스트 fixture). 즉 이 PR 이 고친 바로 그 조건 분기가 어떤 자동화도 없이 “돌아가는 것 같다”는 코드 리뷰에만 의존한다 — 다음에 누군가 이 대입을 다시 조건 안으로 옮겨도(리팩터링·머지 충돌 등) 아무 테스트도 RED 가 되지 않는다.
  - 제안: `schedules.service.spec.ts` 또는 `schedule-trigger.e2e-spec.ts` 에 `POST /api/schedules { isActive: false, ... }` → 응답에 `trigger` 키가 (참조 4필드 형태로) 존재함을 단언하는 케이스 추가. 뮤턴트로도 검증할 것 — `saved.trigger = savedTrigger;` 를 다시 `if (isActive)` 안으로 넣었을 때 RED 가 나는지 확인.

- **[WARNING]** `SchedulesController.toResponse()` — 이 PR 의 핵심 보안 로직(조인된 `Trigger` 엔티티를 참조 4필드로 좁히는 응답 경계)에 대한 unit 테스트가 전혀 없다. e2e 로만 검증된다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `private toResponse<T extends Schedule>(schedule: T)`; `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` (이번 PR 이 손대지 않은 기존 파일, `git diff origin/main...HEAD --stat -- codebase/backend/src/modules/schedules/` 로 미변경 확인)
  - 상세: `schedules.controller.spec.ts` 는 이번 PR 이전부터 있던 파일로 `service.create`/`update`/`remove` 를 mock 하지만, `mockResolvedValue({ id: 'sch-1' })` 로 `trigger` 필드조차 없는 객체를 주고 `await controller.create(WS, dto, USER);` 의 **반환값을 전혀 assert 하지 않는다** — `service.create` 가 올바른 인자로 호출됐는지만 확인한다. 그래서 `toResponse()` 가 (1) `trigger` 존재 시 4필드로 좁히는지, (2) `trigger` 부재 시 `rest`(키 생략) 를 그대로 돌려주는지, (3) `page.data.map(this.toResponse)` 가 배열 전체에 적용되는지는 이 unit 스펙에서 **완전히 vacuous** 하다. 같은 라운드에서 `TriggersService.sanitizeForResponse` 에는 실제 비밀 값을 채운 fixture + 뮤턴트 검증 회귀 테스트가 2건 새로 붙었는데(파일 10), 대칭적으로 중요한 `SchedulesController.toResponse` 쪽은 순수 함수임에도(입력이 스케줄 객체 하나) 아무 unit 커버리지가 없다. 현재는 `schedule-trigger.e2e-spec.ts` C 케이스가 실제 HTTP 응답으로 4필드 형태를 양성 검증해 실질 위험은 낮지만, 실 인프라가 필요한 e2e 에만 의존하는 구조라 회귀 시 피드백이 느리다.
  - 제안: `schedules.controller.spec.ts` 에 `toResponse`(또는 `controller.create`/`findAll` 반환값)를 직접 assert 하는 unit 테스트 추가 — 최소 “`trigger` 에 회전 secret 이 실린 mock 스케줄을 넣으면 반환값의 `trigger` 가 4필드만 남는다”, “`trigger` 가 없으면 `trigger` 키 자체가 응답에 없다” 두 건.

- **[WARNING]** `contractForDto` 메모이제이션에 새로 붙은 2건의 테스트가 전부 **성공 경로만** exercise 한다 — 정작 이번에 새로 문서화·구현된 “실패한 promise 는 캐시에 남기지 않는다”는 핵심 계약이 어떤 테스트로도 검증되지 않는다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.spec.ts` — `describe('contractForDto 메모이제이션', ...)` (신설 2개 `it`); 대상 구현은 `codebase/backend/src/shared/testing/response-contract.ts` 의 `export function contractForDto(...)` 의 `.catch((err) => { contractCache.delete(Dto); throw err; })` 분기
  - 상세: JSDoc 은 “실패한 promise 를 캐시에 남기면 이후 호출이 전부 같은 실패를 되돌려 받아 원인이 사라진 뒤에도 낫지 않는다. 지우고 다시 던진다.” 라고 이 분기의 존재 이유를 명시적으로 서술한다 — 이건 반증 가능한 설계 근거다. 그런데 두 테스트(“같은 DTO 는 같은 promise 를 돌려준다”, “해소된 뒤에도 같은 계약을 돌려준다”)는 둘 다 정상적으로 성공하는 `MemoProbeDto` 만 사용해 캐시 **적중(hit)** 경로만 확인한다. `catch` 블록의 `contractCache.delete(Dto)` 줄을 통째로 지우는 뮤턴트를 넣어도 이 두 테스트는 여전히 GREEN 이다(둘 다 실패 시나리오를 만들지 않으므로) — 즉 이 라운드가 “근거만 있고 검증이 없었다”고 스스로 지적한 결함(`review/code/2026/09/05/18_23_02` W4)의 **절반만** 고쳤다: 캐시-재사용은 잠갔지만 캐시-무효화(실패 시)는 여전히 미검증이다.
  - 제안: `buildContractForDto` 를 실패시키는 fixture(예: 스키마에서 찾을 수 없는 이름의 클래스를 넘기거나 `buildSwaggerDocument` 를 일시적으로 mock/spy 해 1회 reject 하게 함)로 “1차 호출 실패 → 캐시에서 제거됨 → 2차 호출이 다시 시도해 성공(또는 같은 이유로 다시 실패하되 **다른 promise 인스턴스**)” 를 단언하는 테스트 추가.

- **[WARNING]** `allowMissing` 옵션의 문서화된 “중첩은 경로로 적는다” 기능이 어떤 테스트로도 검증되지 않는다 — 새 테스트 3건 전부 최상위(flat) 필드만 사용한다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.spec.ts` — 신설 3개 `it('allowMissing …')` (전부 `VALID.id` 최상위 필드 대상); 옵션 정의는 `codebase/backend/src/shared/testing/response-contract.ts` 의 `ContractCheckOptions.allowMissing` JSDoc(“중첩은 경로로 적는다”)과 `visit()` 의 `walk.allowMissing.has(path)`(`path` 는 `join(prefix, name)` 으로 만든 dot-path)
  - 상세: 이 PR 이 실제로 붙인 유일한 실사용 호출부(`workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']`)도 최상위 필드다. 그래서 “경로”(`a.b.c` 형태)로 지정했을 때 `join()`/`visit()` 의 재귀 호출이 그 경로를 정확히 매칭해 면제하는지는 코드에 존재하는 기능이면서도 어떤 테스트에도 등장하지 않는다. 오탈자·구분자 실수(`.`) 로 경로를 잘못 적어도 지금 이 조합으로는 아무 테스트가 잡아내지 못한다.
  - 제안: 중첩 스키마(예: 기존 `contract` fixture 에 nested object 하나 추가하거나 별도 fixture)로 `allowMissing: ['parent.child']` 형태가 실제로 그 깊이의 missing 을 면제하는 것과, 얕은 이름만 주면(예: `'child'`) 매칭되지 않는 것을 함께 단언하는 테스트 1~2건 추가.

- **[INFO]** `SchedulesController.toResponse()` 의 두 조건부 분기(`t` 부재, `t.workflow` 부재)가 현재 어떤 unit·e2e 테스트로도 도달되지 않는다 — 현재 코드 경로상 실질적으로 도달 불가능해 보이는데도 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `toResponse` 의 `return t ? {...} : rest;` 와 `...(t.workflow ? { workflow: { name: t.workflow.name } } : {})`
  - 상세: `SchedulesService.findAll`/`findById` 는 둘 다 항상 `trigger`+`trigger.workflow` 를 조인/relations 로 적재하고(`leftJoinAndSelect('t.workflow', 'w')`, `relations: ['trigger', 'trigger.workflow']`), 스케줄은 생성 시 트리거를 항상 동반 생성하므로, 이 컨트롤러를 거치는 현재 4개 호출부(`findAll`/`findOne`/`create`/`update`)에서 `t` 또는 `t.workflow` 가 falsy 인 상황이 실제로 발생하는지 불분명하다(예: workflowId 가 가리키는 workflow 가 삭제된 orphan 케이스라면 join 이 null 을 반환할 수 있음). JSDoc 은 “조회 경로에 따라 없을 수 있다”고 명시하지만, 그 경로가 실제로 어떤 호출인지 코드나 테스트 어디에도 나타나지 않는다 — 방어 분기 자체가 죽은 코드일 수도, 혹은 진짜 미검증 엣지케이스일 수도 있다.
  - 제안: 조치 시급성은 낮음. 다만 다음에 이 메서드를 만질 때, `t`/`t.workflow` 부재 케이스를 mock 으로 강제 재현하는 unit 테스트(`schedules.service.spec.ts` 의 “[방어 분기]” 패턴 참고)를 최소 1건 추가해 이 분기가 살아있는 계약인지 확정할 것.

- **[INFO]** `IntegrationDto.appUrl` 의 “cafe24 Private → 비-null 문자열” 분기가 `assertMatchesContract` 로 검증되지 않는다 — null 분기만 실측된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`appUrl: string | null`); 유일하게 `IntegrationDto` 계약 대조를 배선한 곳은 `codebase/backend/test/ai-agent-tool-payload-warning.e2e-spec.ts` 인데, 그 테스트는 makeshop 타입 통합만 생성해 `appUrl` 은 항상 `null` 이다(`grep appUrl codebase/backend/test/*.ts` 로 확인 — 다른 곳에 등장하는 `appUrl` 은 `integration-makeshop-begin.e2e-spec.ts` 의 OAuth begin 응답 필드로 이 DTO 와 무관).
  - 상세: `nullable: true` 선언 자체는 null 값으로 이미 실측됐지만, 이 필드가 실제로 문자열을 실어 나르는 cafe24 Private 흐름에서 `assertMatchesContract` 가 한 번도 실행되지 않아 “타입이 `string | null` 로 선언된 그 문자열 값이 실제로 계약과 맞는가”는 미검증이다. (`IntegrationsService.toPublic` 자체는 이 PR 의 변경 대상이 아니라 사전 존재 로직이라, 이 PR 범위의 버그는 아니다.)
  - 제안: 조치 시급성 낮음 — cafe24 Private 연동을 실 인프라로 세팅하는 e2e 가 이미 있다면 그 자리에 `assertMatchesContract(..., IntegrationDto)` 한 줄 추가를 고려.

## 요약

이 PR 은 응답-계약 검증자(§5.4)를 14개 e2e 로 넓히고, 그 과정에서 실측으로 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출)을 서비스·컨트롤러 두 경계에서 고쳤다. 전반적으로 테스트 태도는 이례적으로 성숙하다 — `triggers.service.spec.ts` 에 실제 비밀 값을 채운 fixture 로 뮤턴트 검증까지 한 회귀 2건을 추가했고, `swagger-dto-contract.spec.ts` 의 새 래칫은 직전 라운드 자신의 vacuous 결함(존재하지 않는 fixture 참조)을 실제 fixture + 양성/대조군 단언으로 정정한 이력이 CHANGELOG·RESOLUTION 에 투명하게 남아 있다. 다만 이번 diff 를 좁혀 보면 대칭이 깨지는 지점이 몇 군데 있다 — `schedules.service.ts::create()` 가 고친 “`isActive:false` 로 만들면 응답에서 `trigger` 가 사라진다” 회귀 자체를 잠그는 테스트가 없고, 같은 라운드에 새로 생긴 `SchedulesController.toResponse()`(보안 경계 로직)는 e2e 로만 검증되며 기존 `schedules.controller.spec.ts` 는 반환값을 전혀 assert 하지 않아 이번 변경에 대해 vacuous 하다. `contractForDto` 메모이제이션과 `allowMissing` 옵션도 문서화된 계약의 절반(실패-후-재시도, 중첩 경로)이 테스트되지 않은 채 남아 있다. 이들은 현재 관측 가능한 결함이 아니라 "다음에 조용히 깨져도 아무도 못 잡는" 종류의 갭이며, 이 PR 이 스스로 반복해서 지적해 온 패턴(방어는 있었는데 테스트가 좁았다)과 같은 형태다.

## 위험도

MEDIUM
