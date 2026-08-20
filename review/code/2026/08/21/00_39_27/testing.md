# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 범위

실제 코드 변경 8파일 + 신규 테스트 3파일을 직접 열어 확인했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규 구현)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규, 프롬프트에서 diff 생략돼 원본 직접 Read)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` (신규 캐너리 3건)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`)
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` (신규 캐너리 3건)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (export 승격만, 로직 변경 없음)

`review/**`·`plan/**`·CHANGELOG 등 산출물 파일은 테스트 관점 대상이 아니므로 제외했다.

## 발견사항

- **[WARNING]** raw 단계와 resolve 단계 위반이 한 요청에 섞여 있으면 첫 예외에는 **한쪽만** 실린다 — 이 상호작용이 테스트되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수 `resolveTriggerParametersRejectingMasked` (61행 `throwIfAny(findMaskedResubmissions(schema, rawSource, rawSource))`, 63행 `resolveTriggerParameters` 호출, 66행 두 번째 `throwIfAny`)
  - 상세: ①raw 검사가 위반을 찾으면 `throwIfAny`가 즉시 throw 하고 63행(`resolveTriggerParameters`)·66행(②resolve 검사)에는 아예 도달하지 않는다. 즉 같은 요청 안에 (a) raw 그대로 마커인 필드(예: `apiKey: '***'`, phase① 감지)와 (b) object/array 를 JSON 문자열로 보내 파싱 후에야 leaf 로 드러나는 필드(예: `headers: '{"token":"***"}'`, phase② 전용 감지)가 동시에 있으면, 사용자는 첫 응답에서 `apiKey` 위반만 보고 `headers` 위반은 그 필드를 고쳐 재제출한 뒤에야 발견한다. 함수 docstring 은 "왜 두 번 보는가"는 상세히 설명하지만 "두 단계가 서로 다른 예외로 분리돼 부분 공개된다"는 언급이 없다 — 의도된 설계인지 미처 인지하지 못한 부작용인지 코드만으로는 판별 불가. `reject-masked-resubmission.spec.ts` 의 "여러 필드가 걸리면 전부 돌려준다" 테스트는 두 필드(`a`, `b`) 모두 **raw 리터럴** 마커(phase①에서 둘 다 잡힘)라 이 상호작용을 가르지 못한다 — phase①/phase② 위반이 혼재된 입력에 대한 캐너리는 없다.
  - 제안: (1) 혼재 케이스를 재현하는 캐너리 테스트 하나 추가(예: `{ apiKey: '***', headers: '{"token":"***"}' }` → 현재 동작이 `apiKey`만 리포트함을 고정), 또는 (2) 두 phase 결과를 합쳐서 한 번에 throw 하도록 바꾸고 "모든 위반을 한 응답에 모은다"를 캐너리로 고정. 어느 쪽이든 지금은 동작과 문서·테스트가 침묵하고 있어 다음 사람이 "details[] 는 항상 완전하다"고 오신할 여지가 있다.

- **[INFO]** 이 기능 경로에 대한 e2e(supertest) 테스트가 없다 — 다만 실질 위험은 낮다
  - 위치: `codebase/backend/test/re-run.e2e-spec.ts`, `codebase/backend/test/workflow-execution.e2e-spec.ts` 에 `MASKED_VALUE_RESUBMITTED`/마커 관련 신규 케이스 없음(grep 결과 0건). `RESOLUTION.md`(파일 12)가 보고하는 "e2e PASS — supertest 276" 도 기존 스위트 규모이지 이 기능을 겨냥한 신규 e2e 가 아니다.
  - 상세: `workflows.controller.spec.ts`/`executions-rerun.service.spec.ts` 는 컨트롤러/서비스 메서드를 직접 호출해 던져진 `BadRequestException.getResponse()` 를 검사한다 — 실제 HTTP 요청이 `GlobalExceptionFilter` 를 거쳐 응답 바디로 직렬화되는 전체 배선은 검증하지 않는다. 다만 `GlobalExceptionFilter` 자체는 `codebase/backend/src/common/filters/http-exception.filter.spec.ts` 에서 `details` 필드 forwarding 이 이미 별도 유닛테스트로 확인돼 있어("recognizes nested { error: { code, message, details } } envelope"), 두 유닛테스트를 합성하면 사실상 전체 경로가 커버된다 — 완전한 공백은 아니다. 다만 이 PR 자체가 "`errors` vs `details` 키 드리프트"라는, 정확히 이 이음매에서 발생한 선존 버그를 고치는 PR이라는 점에서 실제 HTTP 왕복 스모크 테스트 1개가 있었다면 이런 종류의 봉투 드리프트를 원천적으로 더 강하게 막았을 것이다.
  - 제안: 필수는 아님. 여유가 있으면 `re-run.e2e-spec.ts`/`workflow-execution.e2e-spec.ts` 에 마커 재제출 → 400 + `error.details[].code === 'MASKED_VALUE_RESUBMITTED'` 를 확인하는 스모크 케이스 1개씩 추가.

- **[INFO]** `findMaskedResubmissions` (export 된 함수)에 대한 직접 단위 테스트가 없다 — wrapper 를 통한 간접 커버리지만 존재
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:95`(`export function findMaskedResubmissions`)
  - 상세: `reject-masked-resubmission.spec.ts` 는 전부 `resolveTriggerParametersRejectingMasked`(`rejectedFields` 헬퍼)를 통해서만 검증하고, `findMaskedResubmissions` 를 직접 import 해 부르는 테스트는 없다. 함수가 공개 API 로 export 돼 있으므로(향후 다른 소비처가 직접 부를 가능성을 열어둔 설계) 계약이 wrapper 의 특정 호출 패턴에만 의존해 검증되는 셈이다. 실질적으로는 wrapper 가 이 함수를 두 번(raw/resolve) 부르는 유일한 경로라 커버리지 자체는 충분하지만, 함수 시그니처(3-인자: schema/rawSource/values)를 wrapper 우회로 직접 검증하는 테스트가 하나쯤 있으면 향후 세 번째 직접 소비처가 생겼을 때의 회귀 안전망이 더 명확해진다.
  - 제안: 필수 아님(강제할 사안 아님).

## 긍정 평가 (회귀·엣지 케이스 관점에서 특히 견고한 부분)

- **캐너리/경계/회귀/통합 태그로 의도를 명시**: `[캐너리]`(우회 재발 방지) · `[경계]`(off-by-one) · `[회귀]`(스택 안전성) · `[통합]`(실제 마스커 왕복) 네 태그로 테스트 목적을 구분해 가독성이 높다.
- **직전 라운드 CRITICAL(boolean 우회)·W1(number 오안내)·W2(defaultValue 과잉차단) 세 갈래를 각각 독립 캐너리로 고정**했다 — 무수정 프로브로 실증된 결함이 재발하면 즉시 RED.
- **깊이 상한 경계를 object/array 양쪽 분기 모두에서, 상한과 상한+1 양방향으로 테스트**한다(`nestObj`/`nestArr`, `MAX_REDACT_DEPTH`/`MAX_REDACT_DEPTH + 1`) — "분기 매트릭스가 각 항목을 다른 값으로 커버해야 관측 가능하다"는 이 저장소의 반복 교훈에 부합한다.
- **스택 안전성 회귀 테스트가 실측 크기(5000)를 쓴다** — docstring 이 "1,000 으로 잡으면 상한 없는 구현도 통과해 vacuous"라고 명시하고, 실제로 `JSON.parse` 는 depth 100,000 을 통과시키지만 상한 없는 재귀는 5,000 에서 터진다는 실측 근거를 남겼다. vacuous 테스트를 피하려는 의식적 설계.
- **왕복 통합 테스트가 실제 `deepRedactSecrets` 출력을 판정기에 먹인다**(모델 fixture 가 아님) — 마스커/판정기가 `MAX_REDACT_DEPTH` 상수만 공유하고 재귀 구현은 각자라는 리스크를 정확히 겨냥했고, 전제 확인(`expect(JSON.stringify(masked)).toContain(VALUE_MASK_MARKER)`)을 먼저 넣어 마스커가 실제로 마커를 남기지 않으면 그 아래 단언이 vacuous 해지는 것을 방지했다.
- **정확 일치 경계**(`a***b`, `***bold***`, `postgres://***@db/prod`)를 과잉 차단 방지 테스트로 명시 고정 — substring 매칭으로 잘못 넓어지면 즉시 RED.
- **테스트 격리**: `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 모두 `beforeEach` 에서 mock 상태(`getOneQueue`/`chainDepth`/`nodeRepo`/`service` 인스턴스)를 완전히 재생성하고, `jest.spyOn(service, 'findById')` 는 매번 새 인스턴스에 대해 걸리므로 테스트 간 누수가 없다. 신규 테스트 3건이 기존 파일의 관행(동일한 `getOneQueue`/`nodeRepo.findOne` 셋업 패턴, `findById` spy 패턴)을 그대로 따라 이질감 없다.
- **회귀 테스트 유효성**: `errors`→`details` 봉투 교정에 대한 회귀 캐너리("[회귀] 거부 응답이 details[] 로...")가 `body.errors` 가 `undefined` 임을 함께 단언해, 선존 버그(내부 reason 원문이 새어 나가던 문제)의 반대 방향까지 고정한다.
- **Mock 적절성**: `nodeRepo.findOne` mock 반환값(`{ config: { parameters: [...] } }`)이 `loadTriggerParameterSchema` 의 실제 조회 형태(`triggerNode?.config` → `.parameters`)와 정확히 일치해 실제 동작과의 괴리가 없다.
- **테스트 용이성**: `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 가 DB·I/O 없는 순수 함수로 분리돼 있어 mock 없이 직접 단위 테스트가 가능했고, 실제로 `reject-masked-resubmission.spec.ts` 는 어떤 mock 도 없이 순수 함수 호출만으로 15개 이상의 케이스를 검증한다 — 의존성 주입이 필요 없는 구조로 설계된 것 자체가 테스트 용이성 측면의 강점이다.

## 요약

핵심 신규 로직(`reject-masked-resubmission.ts`)은 이전 라운드에서 실증된 CRITICAL(boolean 완전 우회)·WARNING 2건(number 오안내·defaultValue 과잉차단)을 각각 독립 캐너리로 고정했고, 깊이 경계·정확 일치 경계·스택 안전성·실제 마스커와의 왕복 통합까지 다루는 테스트 스위트가 견고하다. 두 호출부(`executions.service.ts`/`workflows.controller.ts`) 신규 테스트도 기존 파일 관행을 그대로 따라 격리·가독성이 좋다. 다만 raw/resolve 두 검사 단계가 서로 다른 예외로 분리돼 있어, 한 요청에 두 단계 각각에서만 감지되는 위반이 섞이면 첫 응답에는 한쪽만 실리는 "부분 공개" 상호작용이 테스트로 다뤄지지 않는다(WARNING) — 보안 우회는 아니지만 "details[] 는 완전하다"는 암묵적 기대를 배반할 수 있어 캐너리 하나로 고정하거나 의도를 문서화할 가치가 있다. 그 외 이 기능 전용 e2e 부재·`findMaskedResubmissions` 직접 단위 테스트 부재는 각각 낮은 실질 위험의 INFO다.

## 위험도

LOW
