# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `SchedulesService.create()`/`update()` 에서 `saved.trigger` 대입을 `if (isActive)` 밖으로 옮긴 수정(반복 재발한 버그: `isActive: false` 로 만들면 응답에서 `trigger` 키가 사라지던 것)이 **e2e 로만** 커버되고, 그 로직이 실제로 사는 서비스 계층 unit 테스트(`schedules.service.spec.ts`)에는 대응하는 케이스가 없다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:198-206`(`create()`) 및 `:257-267`(`update()`) — 두 주석이 스스로 "종전에는 이 대입이 `if (isActive)` 안에 있었다" 는 회귀 이력을 적어 둔 자리. 대응 e2e 는 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 `C-3. isActive 는 응답의 trigger 형태를 바꾸지 않는다` 테스트뿐이고, `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 에는 `isActive: false` 케이스가 여럿(라인 346, 380 부근) 있지만 `saved.trigger` 존재 여부를 단언하는 테스트는 없다.
  - 상세: 이 결함은 커밋 이력상 같은 클래스의 버그가 `create()`→`update()` 순으로 두 번 재발했다(파일 이름의 "자매 함수 미적용" 패턴, memory 의 `feedback_defense_defined_one_notch_narrow.md` 와 같은 계열). e2e 는 실 인프라(DB·BullMQ·HTTP)를 통째로 띄우므로 이 서비스 메서드 하나의 회귀를 잡기 위한 피드백 루프로는 무겁고 느리다. 이미 `schedulesService`, `scheduleRepo`, `runner` 등이 모두 mock 으로 준비돼 있는 `schedules.service.spec.ts` 에 `saved.trigger` 존재를 직접 단언하는 unit 테스트 한두 줄을 추가하면, 향후 누군가 `registerJob` 리팩터링을 하며 이 대입을 다시 조건문 안으로 옮기는 것을 e2e 인프라 없이(수 초 내에) 잡을 수 있다.
  - 제안: `schedules.service.spec.ts` 에 `create({ isActive: false })`/`update(..., { isActive: false })` 호출 후 `scheduleRepo.save` 에 전달된 인자(또는 반환값)의 `trigger` 필드가 정의돼 있음을 단언하는 테스트 2개를 추가. e2e 는 그대로 두고 unit 을 보강하는 것이 (e2e 를 대체하는 것이 아니라) 회귀 탐지 속도를 높인다.

- **[INFO]** `SchedulesController.toResponse()` 가 처리하는 두 경로(`GET /api/schedules`, `GET /api/schedules/:id`) 는 `schedules.controller.spec.ts` unit 레벨에서 전혀 커버되지 않는다 — `create`/`update`/`remove` 세 메서드만 unit 테스트가 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` 전체(파일 7) — `findAll`(`GET /`)·`findById`(`GET /:id`) 에 대응하는 `it()` 이 없다. 실제 `toResponse()` 정의는 `codebase/backend/src/modules/schedules/schedules.controller.ts:68-84`.
  - 상세: `toResponse()` 는 `t.workflow` 존재 여부에 따라 `workflow` 키를 선택적으로 얹는 분기(`...(t.workflow ? { workflow: { name: t.workflow.name } } : {})`)를 갖는데, 이 분기의 두 값(있음/없음) 모두 컨트롤러 unit 레벨에서는 검증되지 않는다(e2e `schedule-trigger.e2e-spec.ts` 의 `Object.keys(detail.body.data.trigger ?? {}).sort()` 단언이 이를 대신 커버함). `create`/`update` 만 unit 화한 이유는 "행위자(userId) 배선" 테스트 목적(파일 헤더 주석)이라 스코프상 자연스럽지만, 결과적으로 이 PR 이 새로 만든 `toResponse()` 라는 순수 함수적 로직의 절반(GET 목록/단건 경로)은 컨트롤러 unit 레벨 검증 없이 e2e 에만 의존한다.
  - 제안: 필수는 아님(e2e 가 실제 형태를 고정하고 있음) — 다만 `toResponse()` 를 별도 순수 함수로 뽑아 controller 인스턴스 없이 직접 단위 테스트하면 `workflow` 있음/없음 두 분기를 HTTP 없이 빠르게 고정할 수 있다.

- **[INFO]** `TriggersService.sanitizeForResponse()` 의 `workflow` 참조 축소 로직은 `findAll`(목록) 경로에서만 unit 테스트가 있고, `findOneDetail`/`create`/`update` 가 호출하는 같은 함수의 `findOneDetail` 진입점에서는 별도로 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 `목록 응답에서도 회전 secret 컬럼과 workflow 가 좁혀진다`(`describe('TriggersService.findAll — schedule 목록 enrichment (V-10)')` 블록) — `describe('TriggersService.findOneDetail')` 블록의 `응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다` 테스트는 `trigger.workflow` 를 fixture 에 넣지 않아 이 축을 단언하지 않는다.
  - 상세: 공유 함수라 위험도는 낮지만(같은 코드 경로), `findOneDetail` fixture 에 `workflow: { id, name, description: 'internal' }` 을 채워 `Object.keys(result.workflow).sort()).toEqual(['id','name'])` 를 추가하면 두 진입점 모두에서 좁힘이 실제로 동작함을 명시적으로 고정할 수 있다. e2e(`schedule-trigger.e2e-spec.ts` C-2, `chat-channel-trigger-create.e2e-spec.ts` 등)가 실질적으로 이를 커버하므로 위험도는 INFO.
  - 제안: 필요하면 `findOneDetail` fixture 에도 `workflow` 를 채워 대칭적으로 단언 추가.

- **[INFO]** `response-contract.ts` 의 `contractForDto` 메모이제이션 JSDoc 이 "격리 단위는 테스트 파일이다"(Jest 는 파일마다 모듈 레지스트리를 새로 만든다) 라고 명시적으로 주장하는데, 이 크로스-파일 격리 자체를 검증하는 테스트는 없다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:397-401`(JSDoc 주장) — 대응 테스트는 `codebase/backend/src/shared/testing/response-contract.spec.ts` 의 `describe('contractForDto 메모이제이션')`(같은 파일 안에서의 동일성만 검증).
  - 상세: memory 의 "설계 근거는 쓰기 전에 뮤턴트로 반증해 보라"(`feedback_design_rationale_must_be_mutation_tested.md`) 교훈과 같은 계열 — 이 문서 자체가 "종전엔 'worker 단위' 라 적었는데 실측으로 반증됐다" 고 스스로 정정 이력을 남긴 자리라, 같은 종류의 서술이 다시 틀릴 위험이 다른 곳보다 높다. 다만 Jest 의 모듈 레지스트리가 파일 단위로 격리되는 것은 Jest 자체의 문서화된 동작이라 실측 필요성은 낮고, 이 테스트가 실무적으로 시급하지는 않다.
  - 제안: 조치 불요(우선순위 낮음). 다음에 이 문서를 다시 만질 일이 생기면, 두 e2e 파일에서 같은 DTO 를 각각 `contractForDto` 호출해 두 promise 가 다른 참조인지(교차 파일 격리) 프로브하는 것도 고려할 수 있다.

## 요약

이번 PR 은 §5.4 응답-계약 검증자를 4→18개 DTO 로 넓히고, 그 과정에서 실측으로 드러난 트리거 회전 secret 2종(`notificationSecretV2`, `chatChannelTokenV2`) 및 `triggerToken` 유출을 서비스·컨트롤러 경계에서 막는 작업이다. 테스트 관점에서는 상당히 성숙한 상태다 — `response-contract.ts`(`allowMissing` 옵션, `contractForDto` 메모이제이션)는 정상 경로뿐 아니라 정확 매칭(대소문자·오타 무시 검증)·중첩 경로 전용 매칭·`undeclared` 와의 축 분리·실패 promise 미캐시(뮤턴트 없이도 캐시 삭제 로직을 직접 되돌려 RED 확인한 이력이 주석에 있음)까지 엣지 케이스를 촘촘히 덮는다. `swagger-dto-contract-guard.ts` 의 새 §5.4 금지-조합 래칫은 스스로 "존재하지 않는 fixture 를 참조해 항상 그린이었다"는 vacuous 테스트를 잡아 실제 fixture(`optional-nullable.fixture.ts`)로 교체하고 위반 2형태·준수 2형태의 양성/음성 대조군을 모두 갖췄다. `TriggersService.sanitizeForResponse`/`SchedulesController.toResponse` 의 비밀-스트립 회귀는 이전 라운드에서 "unit fixture 에 비밀 필드가 아예 없어 로직을 되돌려도 그린" 이었던 사각지대를 정확히 짚어 fixture 에 실제 비밀 값을 채우고, e2e·unit 양쪽에서 secret 부재 + 인접 non-secret 필드 보존을 함께 단언한다. `PATCH` 의 `undefined` 필드 덮어쓰기 버그(`useDefineForClassFields`)도 unit(`PATCH 에서 생략된 필드는 로드된 값을 유지한다`)과 e2e(`name [missing]`) 이중으로 고정됐다. 남은 갭은 전부 INFO 수준 — `SchedulesService.create/update` 의 `isActive:false` 트리거 보존 로직이 유닛 테스트 없이 e2e 에만 의존하는 점(같은 버그가 두 메서드에서 재발한 이력을 고려하면 unit 보강이 피드백 속도를 높일 것), `SchedulesController.toResponse()` 의 GET 경로가 컨트롤러 unit 레벨에서 미검증인 점 정도이며, 전부 e2e 가 실질적으로 커버하고 있어 회귀 위험은 낮다. Mock 구성(`triggers.service.spec.ts` 의 `createBaseProviders`/개별 providers, `schedules.controller.spec.ts` 의 `beforeEach` 재생성)도 테스트 간 격리가 지켜지고 있다.

## 위험도

LOW
