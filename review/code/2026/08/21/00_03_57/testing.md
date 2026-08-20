STATUS=success testing review complete — 1 CRITICAL, 2 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `inputOverride`/`parameterValues` 마스킹 재제출 거부 (EIA §R17 서버측 2층)

## 검토 방법

핵심 코드 변경 8개 파일(트리거 파라미터 타입·신규 가드 함수+spec·두 호출부(`executions.service.ts`/
`workflows.controller.ts`)+각 spec·마스킹 유틸 export 승격)을 읽고, 실제 소스(`Read`)와 대조해 게이트
줄번호를 검증했다. 그리고 **정적 리딩만으로는 확신할 수 없는 두 가설**을 실제 저장소 코드로 임시
probe spec 을 만들어 `jest` 로 직접 실행·검증했다(검증 직후 파일 삭제, `git status --porcelain` 로
잔존 없음 확인 — 커밋된 코드에는 영향 없음, 기존 회귀 스위트 126개 전부 GREEN 도 함께 확인).

## 발견사항

- **[CRITICAL]** `resolveTriggerParameters` 의 타입 강제변환이 `findMaskedResubmissions` 보다 먼저
  실행돼, **`boolean` 타입 트리거 파라미터는 마스킹 마커가 실려도 거부되지 않고 조용히 통과한다** —
  이 시나리오를 exercise 하는 테스트가 전무하다.
  - 위치(테스트 갭): `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
    전체(1~122) — 모든 케이스가 `findMaskedResubmissions` 를 **이미 resolve 된 값**에 직접 호출하며
    스칼라/중첩값 타입을 가리지 않는다(단위 테스트 자체는 정상). 진짜 갭은 이 함수의 **호출부** 쪽 통합
    테스트에 있다: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:362-465`,
    `codebase/backend/src/modules/workflows/workflows.controller.spec.ts:130-193` — 신규 캐너리 4개가
    전부 `type: 'string'` 필드(`apiKey`/`note`) 또는 `type: 'object'` 필드에 **중첩된** 문자열
    마커(`headers.apiKey`)만 쓴다. `type: 'boolean'`/`'number'`/`'array'` 필드, 또는 `object` 필드
    자체가 **직접** 마커 문자열인 경우는 어느 스펙에도 없다.
  - 위치(원인 코드): `codebase/backend/src/modules/executions/executions.service.ts:495-503` 및
    `codebase/backend/src/modules/workflows/workflows.controller.ts:314-322` — 둘 다
    `parameters = resolveTriggerParameters(schema, raw)` 뒤에 `findMaskedResubmissions(parameters)` 를
    호출한다. `resolveTriggerParameters`(`codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:133-140`)
    는 `coerceToType` 을 먼저 적용하고, `coerceToType`(`.../coerce-type.ts` `case 'boolean'`)은
    `'***'` 처럼 `'true'`/`'false'` 가 아닌 임의 문자열을 `Boolean(v)`(truthy)로 캐스팅해 **`true`
    를 반환하며 실패 처리하지 않는다** — 이 시점에 원본 마커 문자열은 사라지고, 뒤이은
    `findMaskedResubmissions` 는 `true`(boolean) 를 보므로 아무 것도 잡지 못한다.
  - **실측(임시 probe, 삭제 완료)**: `resolveTriggerParameters([{name:'flag',type:'boolean'}], {flag:'***'})`
    → `{flag: true}` (예외 없이 통과) → `findMaskedResubmissions({flag: true})` → `[]`. 즉 boolean
    타입 필드는 이 가드를 완전히 우회해 요청이 그대로 실행된다. (참고로 `number`/`array`/`object`(값
    자체가 문자열)는 `coerce_failed`(`TYPE_COERCION_FAILED`)로 **막히긴 하지만** §R17 이 의도한
    `MASKED_VALUE_RESUBMITTED` 안내는 못 준다 — 이쪽은 fail-open 은 아니고 "잘못된 안내" 수준.)
  - 왜 이론적 엣지케이스가 아닌가: 값-마스킹은 `CREDENTIAL_KEY_PATTERN`(필드 **이름**)으로 트리거되고
    (`codebase/backend/src/shared/utils/sanitize-error-message.ts:285-292`), 매칭되면 **선언된
    타입과 무관하게** 값 전체를 문자열 `'***'` 로 wholesale 치환한다. 즉 `apiKeyEnabled: boolean` 같은
    크리덴셜류 이름의 boolean 트리거 파라미터가 있으면, 그 파라미터는 응답에서 `'***'` 로 마스킹되고,
    사용자가 그 값을 그대로 복사해 재제출하면 이 신규 가드가 막아야 할 정확히 그 상황에서 **막지
    못한다**. 이 PR 자체의 doc 주석이 강조하는 "off-by-one 이 곧 fail-open" 원칙과 같은 급의 결함이,
    "타입 강제변환이 마스크 검사보다 먼저"라는 순서 문제로 재발한 것이다.
  - 제안: (a) 최소한 `type: 'boolean'`/`'number'`/`'array'` 필드에 대한 캐너리 테스트를 두 호출부
    spec 에 추가해 현재 동작(boolean=fail-open, number/array=wrong-message)을 고정하고 회귀를 잡는다.
    (b) 근본 수정은 로직 변경이 필요하다 — `findMaskedResubmissions` 를 **raw 입력**(타입 강제변환
    전)에 대해 먼저 돌리거나, `resolveTriggerParameters` 내부에서 `coerceToType` 적용 전에
    `isMaskedMarker(raw value)` 를 검사하도록 순서를 바꿔야 boolean 케이스의 fail-open 이 닫힌다.
    이건 코드 변경이라 로직/보안 관점 리뷰어에도 동일 근거로 전달할 가치가 있다.

- **[WARNING]** 실제 마스커(`deepRedactSecrets`)와 `findMaskedResubmissions` 를 **함께** 실행하는
  통합 테스트가 없다 — 깊이 경계 테스트가 자체 모델(`nestObj`/`nestArr`)에만 기반한다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:73-103`
    (깊이 상한 경계 3개), 근거 주석은 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 파일
    상단 doc(37~42행 부근) — "마스킹된 값에서 마커가 놓일 수 있는 가장 깊은 자리가 **정확히** 그
    지점이다" 라고 서술.
  - 실측(임시 probe, 삭제 완료): 실제 흐름에서 마스킹 대상은 `Execution.inputData = { __triggerSource,
    parameters }` 이고 `redactStoredDataForResponse`(`shared/utils/redact-stored-error.ts:70`)가
    `deepRedactSecrets(inputData)` 를 **`inputData` 루트에서 depth 0** 으로 호출한다 — `parameters`
    자체가 이미 depth 1 이므로, `findMaskedResubmissions(parameters)` 의 depth-0 기준과 실제 마스커의
    depth 기준 사이에 **2단계 오프셋**이 있다. 실제로 재현해 보면 (필드명이 크리덴셜 패턴에 안 걸리는
    순수 depth-cutoff 케이스) `note` 필드를 7단계 중첩했을 때부터 wholesale 치환이 시작됐다
    (`MAX_REDACT_DEPTH=10` 이지만 실제 절단은 상대 depth ~7에서 발생) — 코드가 쓰는 상수(10)는 다행히
    **더 관대한 방향**(over-conservative, 안전)이라 fail-open 은 아니지만, doc 주석의 "정확히 그
    지점" 이라는 주장은 실측과 어긋난다. 이 어긋남 자체를 잡아 줄 테스트가 없다.
  - 제안: `deepRedactSecrets`/`redactStoredDataForResponse` 를 실제 `{ __triggerSource, parameters }`
    형태 입력에 돌려 얻은 결과의 `.parameters` 를 `findMaskedResubmissions` 에 넣는 **엔드투엔드
    characterization 테스트**를 최소 1개 추가해, 두 함수 사이의 실제 depth 대응 관계를 코드가 아니라
    테스트가 고정하게 한다. (`MAX_REDACT_DEPTH` 값이나 `inputData` wrapping 구조가 바뀌면 이 관계가
    조용히 깨질 수 있는데, 지금은 아무 테스트도 이를 감지하지 못한다.)

- **[INFO]** webhook/schedule 경로가 이 가드 밖이라는 설계 결정(§R17 범위 문서화, `reject-masked-resubmission.ts`
  도입부 "## 범위 — Manual 실행 경로 한정")에 대한 **경계 캐너리**가 없다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:183` (`resolveTriggerParameters` 호출,
    `findMaskedResubmissions` 미호출 — 실측 confirm 함). 대응 테스트 없음(`hooks.service.spec.ts` 에
    `'***'`/`MASK` grep 0건).
  - 상세: 이 저장소 MEMORY 가 반복 지적한 패턴("방어의 정의를 한 칸 좁게 잡는다")과 정확히 대칭인
    **의도된 좁은 범위**다. 의도적으로 배제한 경로이므로 지금 당장 webhook 을 가드에 포함시키라는
    뜻이 아니라, 그 배제가 유지되는지 지키는 캐너리가 없다는 뜻이다 — 향후 누군가 "형제 호출부니까
    같이 막자"며 `resolveTriggerParameters` 안에 체크를 넣는 리팩터를 하면(이 문서 자신이 명시적으로
    기각한 대안), webhook 페이로드의 정상적인 리터럴 `'***'` 값이 부당하게 막혀도 잡아줄 회귀 테스트가
    없다.
  - 제안: `hooks.service.spec.ts` 에 "webhook body 에 `'***'` 리터럴이 있어도 정상 처리된다"는 캐너리
    한 개 추가.

- **[INFO]** `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 스칼라 테스트(`reject-masked-resubmission.spec.ts:24-31`)가
  검증하는 시나리오는 현재 `Execution.inputData` 마스킹 경로에서는 발생할 수 없다.
  - 상세: `deepRedactSecrets`(`Execution.inputData` 마스킹에 실제로 쓰이는 함수)는 `VALUE_MASK_MARKER`
    만 생산한다 — `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 는 별개 경로인
    `codebase/backend/src/modules/websocket/websocket.service.ts` 의 WS emit 전용 마스커
    (`sanitizePayloadForWs` 계열)에서만 쓰인다(grep 확인: 두 상수의 사용처가 `sanitize-error-message.ts`
    자체 정의부와 `websocket.service.ts` 뿐). 잘못된 테스트는 아니다(마스커가 향후 통합되면 유효해질
    방어적 커버리지) — 다만 "현재 재제출 가능한 실제 위협"과 "미래 대비용 커버리지"가 테스트 코드
    상에서 구분 없이 섞여 있어, 이 테스트만 보고 "세 마커가 모두 실제로 재제출될 수 있다"고 오독할
    여지가 있다. 필수 수정 아님 — 주석 한 줄로 "현재는 VALUE_MASK_MARKER 만 실사용, 나머지는 방어적"
    정도면 충분.

## 잘된 점 (참고)

- `reject-masked-resubmission.spec.ts` 의 깊이/배열/정확-일치 경계 테스트는 매직넘버 대신
  `MAX_REDACT_DEPTH` 상수를 참조해 구현이 바뀌어도 vacuous 해지지 않는다 — 좋은 관행.
  `nestObj`/`nestArr` 로 object·array 두 분기를 **같은 보폭**으로 따로 검증한 것도(§R17 이전 PR 들이
  겪은 "분기 매트릭스" 함정을 피함) 적절하다.
- `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 모두 `beforeEach` 에서 mock
  상태(`getOneQueue`/`chainDepth`/NestJS testing module)를 완전히 새로 만들어 테스트 간 격리가
  튼튼하다 — 공유 mutable state 로 인한 순서 의존성 없음을 확인했다.
  `errors`→`details` 배선 버그의 회귀 캐너리(`executions-rerun.service.spec.ts:394-404`, "errors 키
  아님"을 명시적으로 부정 단언)는 이 시리즈가 실제로 겪은 선존 버그를 정확히 겨냥해 값어치가 크다.
- 스택 오버플로 회귀 테스트(`reject-masked-resubmission.spec.ts:110-115`)가 임의로 작은 상수(예:
  1,000)가 아니라 실측(#1188, `JSON.parse` 는 100,000 을 통과·재귀는 5,000 에서 터짐)에 기반한 크기를
  써서 vacuous 하지 않다.

## 요약

핵심 가드 함수(`findMaskedResubmissions`)의 순수 로직 테스트(깊이 상한·정확 일치·배열/객체 분기·스택
안전성)는 이례적으로 꼼꼼하고, 두 호출부(execute/re-run) 각각에 캐너리 + 회귀(errors→details 배선
버그) 테스트가 배선돼 있다. 그러나 실제로 `jest` 로 재현·검증한 결과, **`boolean` 타입 트리거
파라미터는 이 가드를 완전히 우회한다** — `resolveTriggerParameters` 의 타입 강제변환이
`findMaskedResubmissions` 호출보다 먼저 실행되고, boolean 강제변환은 `'***'` 같은 임의 문자열을
`true` 로 조용히 캐스팅해 실패하지 않기 때문이다. 크리덴셜 마스킹은 필드 이름 패턴으로 트리거돼
선언된 타입과 무관하므로, 이 경로는 이론적 사각지대가 아니라 실제로 도달 가능한 시나리오다. 모든
신규 테스트가 `string`(또는 object 안에 중첩된 string) 타입 필드만 사용해 이 우회를 하나도 잡지
못한다. 이 CRITICAL 하나를 제외하면 나머지는 실제 마스커와의 depth 정합성을 검증하는 통합 테스트
부재, webhook 경계 캐너리 부재 등 WARNING/INFO 급 보강 항목이다.

## 위험도
CRITICAL
