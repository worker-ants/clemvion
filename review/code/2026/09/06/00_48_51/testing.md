# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` 의 `!t`(트리거 미로드) 방어 분기가 unit·e2e
  어느 쪽에도 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68-89` (`private toResponse`,
    `InternalServerErrorException` 던지는 자리는 82-86행)
  - 상세: 이번 PR 이 새로 추가한 방어 로직이다 — `schedule.trigger` 가 없으면
    `InternalServerErrorException` 을 던지고, 있으면 참조 4필드로 좁혀 반환한다. 정상 경로
    (`create`/`update`/`findAll`/`findById`)는 e2e·unit 모두 촘촘히 덮여 있지만(`trigger` 가
    항상 채워지는 경로), `!t` 분기 자체를 실행하는 테스트는 어디에도 없다 —
    `grep -rn "has no loaded trigger\|InternalServerErrorException" codebase/backend/src/modules/schedules/ codebase/backend/test/` 결과 정의부(`schedules.controller.ts`) 외에는 0건.
    주석은 "정상 데이터로는 도달 불가"(`Schedule.trigger_id` NOT NULL + FK `CASCADE`)라고
    설명하는데, 그 불변식이 사실이어도 **방어 코드 자체의 계약**(어떤 예외 타입·어떤 메시지를
    던지는가)은 별개로 검증할 수 있고 검증해야 한다 — 컨트롤러가 mock 서비스를 쓰는
    unit 구조라 `service.findAll`/`findById` 가 `{ id: 'x', trigger: null }` 를 돌려주게만
    하면 5줄 이하로 커버 가능하다. 지금 상태로는 이 분기의 메시지 문구나 예외 타입이
    바뀌어도, 혹은 조건이 실수로 반전(`if (t)`)돼도 — 반전은 모든 e2e 를 500 으로 깨뜨리므로
    잡히지만, "메시지가 다른 예외로 대체" 류의 변형은 — 아무 테스트도 반응하지 않는다.
  - 제안: `schedules.controller.spec.ts` 에 `service.findAll`/`findById` 가 `trigger: null` 인
    스케줄을 돌려줄 때 `toResponse` 가 `InternalServerErrorException` 을 던지는지 확인하는
    테스트 1건 추가.

- **[INFO]** `schedules.controller.spec.ts` 는 `findAll`/`findById` 를 전혀 커버하지 않는다 —
  `create`/`update`/`remove` 세 메서드만 unit 대상이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` (전체 —
    `describe('SchedulesController — 행위자(userId) 배선', ...)` 블록에 `findAll`/`findById`
    관련 `it()` 없음)
  - 상세: `findAll`(목록, `page.data.map((s) => this.toResponse(s))`)과 `findById`(단건)도
    같은 `toResponse` 를 타는 컨트롤러 레벨 진입점인데, 이 unit 파일은 그 경로를 안 부른다.
    실질 위험은 낮다 — `schedule-trigger.e2e-spec.ts` 가 목록·단건 양쪽에서 `trigger` 좁히기
    형태를 이미 실측(`Object.keys(...).sort()` 로 정확한 키 집합)으로 고정해 뒀다. 다만 이
    unit 파일의 존재 이유(행위자 인자 배선 + 응답 경계 검증)에 비춰보면 `findAll`/`findById`
    가 나가리 된 것은 파일 스코프 안에서의 비대칭이다.
  - 제안: 우선순위 낮음. e2e 가 이미 실동작을 덮는 상태라 필수는 아니나, 컨트롤러 unit
    파일을 다시 열 일이 있으면 `findAll`/`findById` 도 같은 패턴(비밀 채운 mock + 좁혀진
    키 단언)으로 채우는 편이 파일 내 일관성에 낫다.

- **[INFO]** 트리거 **생성** 응답에서 `workflow` 키의 **부재**를 명시적으로 단언하는 e2e 가
  없다 — `ScheduleDto.trigger.workflow` 에는 대칭 테스트(C-3, 정확한 키 집합 단언)가 있는데
  `TriggerDto.workflow` 에는 없다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:96-102`
    (`workflow?: TriggerWorkflowRefDto` JSDoc — "생성 응답에만 없다"), 대응 e2e 부재:
    `codebase/backend/test/webhook-trigger.e2e-spec.ts`, `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
  - 상세: `grep -rn "\.workflow\b" ... | grep -i "toHaveProperty|toBeUndefined|not\."` 결과
    0건 — 트리거 생성 e2e 어디에서도 `workflow` 부재를 정확한 키 집합으로 단언하지 않는다.
    §5.4 키 생략형 검증자(`assertMatchesContract`)는 optional 필드의 **부재를 위반으로 보지
    않으므로** — 즉 향후 회귀로 `workflow` 가 생성 응답에도 항상 채워지게 바뀌어도(계약
    위반은 아니라서) 이 계약 검사로는 못 잡는다. `ScheduleDto.trigger` 에 대해서는 이미 같은
    패턴(C-3, 정확한 `Object.keys().sort()` 단언)으로 이 사각지대를 닫아 뒀는데
    `TriggerDto.workflow` 만 비대칭이다.
  - 제안: 트리거 생성 e2e 한 곳에 `expect(Object.keys(created.body.data.trigger ?? created.body.data).sort())`
    형태로 `workflow` 부재를 양성 단언하는 줄 추가 (`ScheduleDto.trigger` C-3 패턴 재사용).

## 커버리지 갭 외 관찰 (참고용, 조치 불요)

- `response-contract.ts`/`swagger-dto-contract-guard.ts`/`triggers.service.ts` 의 신규 로직은
  이례적으로 깊게 테스트돼 있다 — `contractForDto` 메모이제이션(동일 promise 재사용·실패
  캐시 미보존), `allowMissing`(정확 일치·중첩 경로·undeclared 와 미간섭), §5.4 금지-조합
  래칫(양성/음성 대조군 fixture, 스캔 범위 오염 방지 확인)까지 전부 개별 unit 이 있다.
  `TriggersService.sanitizeForResponse` 4축 스트립도 축마다 unit(chat-channel·interaction·
  notification.signing·엔티티 컬럼)과 "chat-channel 아닌 트리거도 정화" 조기-return 회귀
  테스트가 갖춰져 있고, e2e 는 `config.interaction.triggerToken` 처럼 `additionalProperties:
  true` 라 계약 검증자가 못 보는 축까지 실제 발급 흐름(`revoke-token` 호출 후 부재 단언)으로
  vacuous 를 두 겹으로 막아 뒀다. `SchedulesService.create`/`update` 의 `isActive` 분기
  버그(트리거 대입이 `if` 안에 있던 문제)는 unit(2건, `save` mock 을 관계 없는 사본으로
  바꿔 vacuous 를 막음) + e2e(C-3, 생성·PATCH 양쪽) 로 이중 방어된다.
- 이 PR 자체가 8라운드 리뷰(`review/code/2026/09/05/18_23_02` ~ `2026/09/06/00_24_34`)를
  거치며 "vacuous 테스트"·"mock 이 비현실적"·"목록 경로가 단건 경로와 다른 코드 경로라 별도
  fixture 필요" 류의 지적을 그때그때 실측으로 닫아 온 이력이 RESOLUTION.md 들에 남아 있다 —
  본 리뷰가 지적한 3건은 그 사이에서 아직 안 닫힌 잔여다.
- `execution-response.dto.spec.ts` 변경은 기능 변경 없이 JSDoc 만 늘려(저장소 전체
  래칫과의 관계 설명) 회귀 테스트에 영향 없음.

## 요약

이 PR 은 §5.4 응답-계약 검증자를 4→18개 DTO 로 넓히는 스윕으로, 스윕 과정에서 드러난 두
보안 결함(트리거 회전 secret 유출·스케줄 조인을 통한 2차 유출)의 수정까지 포함한다. 이미
여러 라운드의 자기-리뷰를 거쳐 vacuous 테스트·비현실적 mock·조기-return 사각지대 등 전형적인
테스트 결함 패턴을 실측 기반으로 반복 정정한 흔적이 뚜렷하고, 새로 추가된 핵심 로직
(`contractForDto` 메모이제이션, `allowMissing`, §5.4 금지-조합 정적 래칫, 4축 secret strip)은
양성/음성 대조군까지 갖춘 깊이 있는 unit + e2e 조합으로 방어돼 있다. 남은 갭은 모두
경미하다 — `SchedulesController.toResponse` 의 신규 방어 분기(`InternalServerErrorException`)가
테스트되지 않은 점(WARNING), 컨트롤러 unit 파일의 `findAll`/`findById` 미커버(e2e 가
보완하므로 INFO), `TriggerDto.workflow` 생성-시 부재의 명시적 단언 부재(INFO) 정도다.

## 위험도
LOW
