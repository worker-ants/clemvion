# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 10건, execution-response.dto.spec.ts)와
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(응답 DTO 전수 78건, swagger-dto-contract.spec.ts)의
  부분집합 관계가 **주석으로만** 선언되고 코드로 강제되지 않는다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:59-71`
    (`OPTIONAL_NULLABLE_DRIFT` 상수 및 JSDoc), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
    의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 상수 정의부 (해당 파일 diff 는 프롬프트 크기 제한으로
    생략돼 게이트 번호를 인용할 수 없음 — `const EXPECTED_OPTIONAL_NULLABLE_DRIFT` 로 식별).
  - 상세: 두 목록은 각각 별도의 "래칫"(ratchet) 테스트로 고정되는데, 전자가 후자의 **부분집합**
    이어야 한다는 불변식은 두 파일 어디에도 자동 검증이 없다. `execution-response.dto.spec.ts`
    자신의 JSDoc 이 정확히 이 위험을 지목한다 — *"한쪽만 상환하면 다른 쪽이 조용히 낡는다"*
    (`review/consistency/2026/09/05/19_08_19` W5 인용). 즉 이 PR 은 위험을 **알고 문서화**했지만
    그 문서화를 강제하는 테스트는 추가하지 않았다. 두 목록 중 하나만 갱신되는 편집(예: 다음
    PR 이 `ExecutionDto` drift 10건 중 일부를 갚으면서 전수 래칫 78건 목록을 깜빡함, 혹은 그
    반대)이 일어나도 두 스펙 파일 모두 **각자는 그린**을 유지한다 — 서로의 존재를 모르기
    때문이다. 현재는 우연히 일치한다(10건 전부 78건 목록 안에 문자 그대로 존재함을 확인).
  - 제안: `execution-response.dto.spec.ts` 가 `swagger-dto-contract.spec.ts` 에서
    `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 를 import 해 `OPTIONAL_NULLABLE_DRIFT.every(k => EXPECTED.includes('execution-response.dto.ts:ExecutionDto.' + k))`
    형태의 부분집합 단언을 자동 테스트로 추가한다(순환 의존이 걱정되면 반대 방향 — 전수
    래칫 쪽에서 실행 DTO 서브셋을 import — 도 동일하게 유효하다).

- **[WARNING]** 신설 공유 테스트 헬퍼 `expectNarrowedScheduleTriggerRef` 가 같은 디렉터리의
  자매 헬퍼(`response-contract.ts` → `response-contract.spec.ts`, `swagger-probe.ts` →
  `swagger-probe.spec.ts`)와 달리 **전용 단위 테스트가 없다**.
  - 위치: `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:39-52`
    (`expectNarrowedScheduleTriggerRef` 함수 전체)
  - 상세: 이 헬퍼는 e2e 3곳 + 컨트롤러 unit 2곳, 도합 5개 호출부에서 "무엇이 남아야 하는지"를
    양성으로 고정하는 유일한 수단이다(JSDoc 이 스스로 그렇게 설명한다). 그런데 헬퍼 자체가
    (a) 정확한 키 집합에서 통과하는지, (b) 여분의 키가 있으면 실패하는지, (c)
    `TRIGGER_SECRET_COLUMNS`(`notificationSecretV2`, `chatChannelTokenV2`) 가 섞여 들어오면
    실패하는지를 증명하는 자체 테스트가 없다. 내부 로직은 표준 `expect().toEqual()` 이라
    Jest 자체의 신뢰성에 기대어 위험이 낮긴 하지만, 이 PR 의 리뷰 이력 자체가 "헬퍼/가드가
    실제로는 아무것도 못 집는데 그린이었다"(예: `swagger-dto-contract.spec.ts` 의 존재하지
    않는 fixture 경로 Critical, `contractForDto` 캐시 실패-경로 미검증 W4)는 패턴을 같은
    세션에서 최소 2회 반복해 자기 반증한 바 있다 — 새로 추가되는 공용 단언 헬퍼는 이 패턴의
    다음 후보다.
  - 제안: `schedule-trigger-ref.spec.ts` 를 신설해 (1) `REF_KEYS_WITHOUT_WORKFLOW`/
    `REF_KEYS_WITH_WORKFLOW` 각각에서 통과, (2) 여분 키(`description` 등)가 섞이면
    실패, (3) `notificationSecretV2` 가 섞이면 (`Object.keys` 비교에서든
    `TRIGGER_SECRET_COLUMNS` 체크에서든) 실패함을 직접 단언한다.

- **[INFO]** `TriggersService.create()`/`update()` 경로의 `sanitizeForResponse` 호출이
  비밀 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) 스트립을 실제로 거치는지 확인하는
  mock 기반 unit 테스트가 없다 — `findOneDetail`/`findAll` 은 각각 전용 unit 테스트를
  받았는데(다른 코드 경로라는 이유로, 리뷰 이력에 명시) `create`/`update` 는 같은
  `sanitizeForResponse` 호출부이면서도 이 원칙이 적용되지 않았고 e2e 에만 의존한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`/`update`
    메서드 말미의 `this.sanitizeForResponse(result)` 호출부. 이 파일의 diff 는 프롬프트
    크기 제한으로 게이트 없이 생략됨 — 함수명으로 식별) /
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`findOneDetail`
    describe 블록의 `'응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다'`
    unit 은 있으나 동일 패턴의 `create`/`update` unit 은 없음)
  - 상세: 현재는 `chat-channel-trigger-create.e2e-spec.ts`(POST 응답에
    `assertMatchesContract(trigger, contractForDto(TriggerDto))`)와
    `schedule-trigger.e2e-spec.ts`(PATCH 응답 동일 대조)가 실 DB·실 HTTP 왕복으로 이
    경로를 덮는다 — 결함 검출 자체는 가능하다. 다만 unit 이 없으면 (1) 회귀 시 실패
    위치를 알아내는 데 e2e 인프라 기동이 필요해 피드백 루프가 느리고, (2) `sanitizeForResponse`
    호출을 실수로 지우거나 조건부로 바꾸는 뮤턴트가 `create`/`update` 자리에서만 unit
    스위트로는 잡히지 않는다 — 정확히 이 세션이 `findOneDetail`/`findAll` 각각에 대해
    "다른 코드 경로라 별도로 unit 이 필요하다"고 반복해서 명시한 원칙(예:
    `review/code/2026/09/05/22_24_58` W2 코멘트)이 `create`/`update` 에는 적용되지 않은
    비대칭이다.
  - 제안: `triggers.service.spec.ts` 의 `create`/`update` 관련 describe 블록에
    `notificationSecretV2`/`chatChannelTokenV2` 를 채운 mock 으로 반환값에서 그 두 키가
    없음을 단언하는 unit 을 각각 추가한다 (`findOneDetail` 의 기존 테스트와 같은 패턴).

## 요약

이 PR 은 응답-계약 검증자(§5.4)의 배선을 4→18개 DTO 로 넓히는 작업으로, 이미 5라운드의
코드/일관성 리뷰를 거치며 e2e·unit 양쪽에서 매우 촘촘한 뮤테이션 테스트(고의로 로직을
되돌려 RED 확인, vacuous 방지를 위한 "다른 코드 경로마다 별도 unit" 원칙 등)를 축적해
왔다. `sanitizeForResponse`(triggers), `toResponse`(schedules controller), 그리고
`response-contract.ts` 자체의 핵심 로직(`allowMissing`, `contractForDto` 캐시 실패 경로,
undeclared/missing/null 3축)은 전부 근거 있는 unit 테스트로 뒷받침돼 있고, e2e 는 4개
경로(생성·조회·목록·수정)를 각각 개별 `assertMatchesContract` + 양성 대조(`expectNarrowedScheduleTriggerRef`)
로 덮는다. 남은 갭은 셋뿐이다: (1) 두 개의 독립 "drift 래칫" 목록 사이 부분집합 불변식이
주석으로만 존재하고 테스트로 강제되지 않음(WARNING), (2) 새 공유 단언 헬퍼
`schedule-trigger-ref.ts` 가 이 저장소의 확립된 관례(자매 헬퍼는 전용 spec 보유)를 어기고
전용 테스트가 없음(WARNING), (3) `create`/`update` 의 비밀 스트립이 unit 이 아닌 e2e에만
의존함(INFO, 이미 이 PR 이 다른 호출부에 적용한 원칙과의 비대칭). Critical 급 커버리지
누락은 발견되지 않았다.

## 위험도
LOW
