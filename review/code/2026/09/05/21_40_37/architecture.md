# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse()` 가 HTTP 오케스트레이션(라우팅·DTO 스웨거 선언)과 도메인 보안 경계 로직(조인된 `Trigger` 엔티티를 참조 4필드로 좁히는 응답 셰이핑)을 한 클래스 안에서 겸하고 있고, `private` 이라 컨트롤러 바깥에서 재사용·단독 단위 테스트가 불가능하다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67-83` (`toResponse` 정의), 호출부 `:101` / `:120-121` / `:194-196` / `:246-248`.
  - 상세: `toResponse` 는 컨트롤러가 라우팅·swagger 데코레이션을 담당하는 자리에, 트리거 엔티티에서 어떤 필드를 남기고 뺄지를 결정하는 보안-경계 판단(§5.4 응답-계약 스윕이 드러낸 secret 유출의 실제 수정 지점)까지 얹었다. 이 자체가 "narrowing 은 나가는 자리(컨트롤러)에서 한다" 는 문서화된 설계 판단(JSDoc:63-65)이라 레이어 배치 방향은 맞다 — 서비스 반환 타입을 좁히면 `update()` 등 내부 소비자가 깨지므로 컨트롤러가 옳은 경계다. 다만 그 대가로 이 로직은 컨트롤러의 `private` 메서드가 되어, 리뷰 이력(`review/code/2026/09/05/20_45_37/RESOLUTION.md` "W1·W3") 이 스스로 인정하듯 **unit 테스트로 감쌀 수 없고 e2e 4개 경로(생성·조회·목록·PATCH)가 유일한 검증 수단**이다. 같은 종류의 판단(엔티티→wire 응답 변환)이 이미 서비스마다 `sanitizeForResponse`(triggers) / `toResponseExecution`(executions) 세 가지 이름으로 흩어져 있는데(naming_collision 리뷰가 이미 지적), 그 중 이번에 추가된 것만 유일하게 컨트롤러 계층에, 그것도 unit-testable 하지 않은 형태로 들어갔다. 향후 같은 조인-과다노출 패턴이 다른 컨트롤러에서 재발하면(예: `WorkflowsController` 가 다른 엔티티를 조인해 넘기는 경우) 이 함수를 재사용할 길이 없고 처음부터 다시 손으로 짜야 한다.
  - 제안: `toResponse` 를 컨트롤러 밖의 순수 함수(예: `schedule-response.mapper.ts` 의 `toScheduleResponse(schedule: Schedule): ...`)로 추출한다. 컨트롤러는 그 함수를 호출만 하도록 남기면 (1) unit 테스트로 분기(트리거 없음/있음, `workflow` 유무)를 e2e 없이 고정할 수 있고, (2) 같은 조인-축소 패턴이 재발할 때 재사용 가능한 자리가 생긴다.

- **[WARNING]** 응답에서 비밀을 제거하는 방식이 3벌의 수기 deny-list(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` · `NOTIFICATION_SIGNING_STRIP_KEYS` · `TRIGGER_RESPONSE_STRIP_COLUMNS`) 로 구현되어 있어, 개방-폐쇄 원칙(OCP) 관점에서 새 비밀 필드가 추가될 때마다 이 파일을 직접 수정해야 하고 그 수정 자체가 컴파일러로 강제되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:53-97` (세 상수 선언), `:576-638` (`sanitizeForResponse` 본문).
  - 상세: 이번 diff 가 고친 결함(§ CHANGELOG "방어가 있었는데 한 칸 좁았다")의 근본 원인이 정확히 이 패턴이다 — `sanitizeChatChannelForResponse` 시절엔 목록이 하나였고, 새 비밀(엔티티 컬럼·notification.signing)이 생겼을 때 그 목록에 반영하는 것을 사람이 두 번 잊었다(리뷰 이력 W1). 이번 diff 는 그 잊음 두 건을 고치면서 세 번째 목록(`TRIGGER_RESPONSE_STRIP_COLUMNS`)까지 같은 패턴으로 늘렸다 — 즉 재발을 막는 대신 **같은 취약한 패턴을 한 겹 더 쌓았다.** 코드 자신의 주석(`:50` "신규 plaintext / 내부 ref 필드 추가 시 본 상수에 반드시 키 추가 — destructure 누락 위험 회피")이 이 구조의 위험을 스스로 인지하고 있고, 팀은 "세 번째/네 번째 재발 시 `@Sensitive()` 류로 승격" 이라는 임계값 기반 완화 계획을 이미 문서화해 두었다(`review/code/2026/09/05/19_08_18/RESOLUTION.md` INFO#1). 이 자체는 합리적인 트레이드오프 판단이라 즉시 리팩터를 요구할 사안은 아니지만, 이 diff 시점에 한 클래스 안에 병렬 deny-list 가 이미 3개가 됐다는 사실은 그 임계값에 이미 근접했다는 신호이므로 명시적으로 남긴다.
  - 제안: 즉시 조치 불요(팀의 기존 완화 계획과 일치). 다음에 네 번째 비밀 필드/컬럼이 생기면 데코레이터 기반(`@Sensitive()` 또는 `class-transformer` 의 `@Exclude()`) 선언적 접근으로 전환해, "새 필드 추가 = 기본적으로 노출되지 않음" 으로 기본값을 뒤집는 것을 고려할 것.

- **[INFO]** 같은 문제(조인을 통한 트리거 비밀 재노출)를 막는 두 자리가 서로 다른 전략(allow-list vs deny-list)을 쓰고 있고, 그 중 새로 추가된 컨트롤러 쪽이 구조적으로 더 안전하다 — 긍정적 관찰이자 향후 참고할 만한 비대칭이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:73-80` (`toResponse` 의 `{ id, name, workflowId, workflow }` allow-list) vs `codebase/backend/src/modules/triggers/triggers.service.ts:94-97` (`TRIGGER_RESPONSE_STRIP_COLUMNS` deny-list).
  - 상세: `TriggersService.sanitizeForResponse` 는 "알려진 비밀을 뺀다" 는 deny-list라 `Trigger` 엔티티에 새 컬럼이 추가되면 **기본값이 노출**이다(그 컬럼이 비밀이면 사람이 목록에 추가하는 것을 잊는 순간 유출 — 이번 diff 가 고친 결함이 정확히 이 클래스). 반면 `SchedulesController.toResponse` 는 "필요한 4필드만 남긴다" 는 allow-list 라, `Trigger` 엔티티에 어떤 새 컬럼(비밀이든 아니든)이 추가되어도 **기본값이 비노출**이다 — 조인 경로로 새는 결함 클래스 자체가 이 설계에서는 원리적으로 재발하지 않는다. 두 곳이 같은 위험(조인/직렬화를 통한 엔티티 과다노출)에 대응하면서 서로 다른 안전성 등급의 전략을 쓰고 있다는 점은, 이 PR 이 그 자체로 "allow-list 가 deny-list 보다 이 문제 클래스에 원리적으로 강하다" 는 근거를 실측으로 만든 셈이다.
  - 제안: 조치 불요(참고용). 향후 `TriggersService.sanitizeForResponse` 를 재설계할 기회가 생기면(위 OCP 지적의 완화 시점과 동일 시점이 자연스럽다) allow-list 전환을 우선 후보로 고려할 근거로 이 diff 를 인용할 수 있다.

- **[INFO]** `SchedulesController.toResponse()` 의 반환값이 명시적 타입(예: `ScheduleDto`)으로 표기되지 않아, 컴파일러가 이 함수의 출력이 스웨거로 선언한 `ScheduleDto` 계약과 일치하는지 검증하지 못한다 — 다만 이는 이 PR 이 도입한 런타임 검증자(§5.4 `assertMatchesContract`)가 정확히 메우려는 간극이라는 것이 코드 자신의 문서(`response-contract.ts:14-24`)에 이미 근거로 적혀 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67` (`private toResponse<T extends Schedule>(schedule: T) {` — 반환 타입 미표기).
  - 상세: `response-contract.ts` 의 JSDoc 은 "반환 타입을 DTO 로 명시하는 안은 실측으로 반증됐다 — 엔티티와 응답 DTO 를 전수 대조하니 불일치 59건 중 46건이 `Date`→`string`(직렬화 정상 동작)이었다" 고 명시적으로 이 트레이드오프를 설명한다. 즉 `toResponse` 에 `: ScheduleDto` 를 강제로 붙이면 `createdAt`/`updatedAt`(엔티티는 `Date`, DTO는 `string`) 등에서 대량의 거짓 타입 오류가 난다는 것을 팀이 이미 알고 있고, 그래서 컴파일타임 대신 이번 PR 전체가 배선하는 런타임 대조(§5.4)로 그 역할을 이관했다. 아키텍처적으로는 "정적 타입 계층이 못 미치는 자리를 런타임 계층이 방어한다" 는 의도된 설계이지 누락이 아니다.
  - 제안: 조치 불요. 다만 `toResponse` 가 반환하는 필드 **키 집합**(값 타입 말고 존재 여부)만이라도 컴파일타임에 좁히고 싶다면, `Omit<Schedule, 'trigger'> & { trigger?: ScheduleTriggerRefDto }` 형태의 별도 타입을 반환 타입으로 선언하는 절충안이 있다 — 값 타입(Date vs string) 불일치는 여전히 런타임 계층에 맡기고 키 존재만 정적으로 고정하는 방식. 우선순위는 낮다.

## 요약

이 diff 는 §5.4 응답-계약 검증자를 4→18개 DTO 로 넓히는 배선 작업과, 그 과정에서 실측으로 드러난 트리거 회전 secret 의 이중 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출)을 서비스·컨트롤러 두 경계에서 고친 보안 수정이 결합된 작업이다. 아키텍처 관점에서 가장 눈에 띄는 설계는 **3중 방어**(런타임 값-대조 `response-contract.ts`, 정적 presence/null 축, 이번에 신설된 정적 optional+nullable 금지-조합 축 `swagger-dto-contract-guard.ts`)가 각자 다른 사각지대를 명시적으로 문서화하며 겹치지 않게 분업하고 있다는 점, 그리고 `TriggerChatChannelHealth` 같은 엔티티 유니온 타입을 DTO 가 `import type` 으로 그대로 재사용해 enum 값이 두 곳에서 따로 관리되며 벌어질 drift 를 원천 차단한 점, `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 를 소비 측(schedules 모듈)이 자신의 필요에 맞춰 최소 형태로 새로 정의해 트리거 모듈의 내부 DTO 형태에 결합하지 않은 점(경계 컨텍스트 소유권이 올바른 방향)이다. 순환 의존성은 이 diff 범위에서 발견되지 않았다(모듈 등록 파일 변경 없음, `Schedule`↔`Trigger` 는 엔티티 타입만 상호 참조하고 서비스 간 직접 의존은 없음). 실질적으로 지적할 점은 두 가지로 수렴한다 — (1) `SchedulesController.toResponse()` 가 보안 경계 셰이핑 로직을 컨트롤러의 `private`·미표기-반환타입 메서드에 담아 unit 테스트 불가 상태로 만든 것(테스트 피라미드가 e2e 로 쏠림, 재사용 불가), (2) 트리거 비밀 스트립이 3벌의 수기 deny-list 로 남아 있어 다음 신규 비밀 필드가 또 같은 클래스의 결함을 재현할 여지가 있다는 것 — 다만 후자는 팀이 이미 임계값 기반 완화 계획을 문서화해 두었다. 둘 다 병합을 막을 사안은 아니며, 나머지(DTO 필드 선언 보정 24건, e2e 계약 배선 14건)는 순수 부가 작업으로 구조적 리스크가 없다.

## 위험도

LOW
