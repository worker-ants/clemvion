# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (3차, `01_15_47`)

## 검토 범위

실질 프로덕션 코드 변경 8개 파일과 그 테스트:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (기존 함수 export 승격, 로직 무변경)

나머지(CHANGELOG, plan/spec 문서, `review/code/2026/08/21/00_03_57/**`·`00_39_27/**` 산출물)는 앞선 두 라운드가
이미 검토·처분했고(RESOLUTION.md 로 확인) 이번 diff 는 그 산출물을 그대로 커밋에 실은 것뿐이라 테스트 관점
재검토 대상에서 제외했다. 앞선 두 라운드에서 CRITICAL 1건(boolean 우회)·WARNING 다수(왕복 통합 테스트
부재 등)가 이미 지적·수정됐음을 `reject-masked-resubmission.ts`/`.spec.ts` 실물 코드로 확인했다.

**직접 실행 검증**: `npx jest reject-masked-resubmission` → 20/20 PASS. `npx jest executions-rerun.service.spec.ts
workflows.controller.spec.ts` → 47/47 PASS(경고 로그 1건은 기존 audit-log 실패 시뮬레이션으로 무관).

## 발견사항

- **[INFO]** 이 PR 이 고치는 "선존 버그"(`errors` vs `details` 봉투 드리프트)의 재발 방지가 e2e 레벨 대신
  두 개의 서로 다른 unit 스펙의 조합에만 의존한다
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` (신규 `[회귀]` 테스트,
    함수 `it('[회귀] 거부 응답이 details[] 로...')`) / `codebase/backend/src/common/filters/http-exception.filter.spec.ts`
    (`it('passes through an explicit code + details')`)
  - 상세: 신규 회귀 캐너리는 `service.reRun(...)` 이 던진 `BadRequestException.getResponse()` 가
    `{code, details}` 형태임을 컨트롤러/서비스 레이어에서 검증하고, `http-exception.filter.spec.ts` 는
    필터가 임의 예외의 `details` 필드를 실제 HTTP 응답 봉투(`error.details[]`)로 전달함을 별도로 검증한다.
    두 unit 테스트를 합치면 논리적으로는 전체 경로가 커버되지만, **실제 Nest 파이프라인(컨트롤러 →
    `GlobalExceptionFilter` → HTTP 응답 직렬화)을 한 번에 태우는 e2e/supertest 테스트는 없다**
    (`codebase/backend/test/re-run.e2e-spec.ts`·`manual-trigger-default-param.e2e-spec.ts` 둘 다
    마스킹 마커 재제출 시나리오를 다루지 않음을 grep 으로 확인). 이번 PR 이 고치는 결함 자체가 "두 층이
    각자는 옳은데 봉투 키가 어긋나 조용히 유실됐다" 는 **레이어 경계 결함**이었다는 점을 감안하면, 그
    경계를 실제로 넘나드는 테스트가 하나도 없다는 것은 같은 클래스의 회귀(예: 필터가 `details` 대신 다른
    키를 읽도록 리팩터링되는 변경)를 unit 조합이 놓칠 수 있다는 뜻이다.
  - 제안: 필수는 아니지만, `re-run.e2e-spec.ts` 또는 `manual-trigger-default-param.e2e-spec.ts` 에
    `inputOverride`/`parameterValues` 로 `'***'` 를 보내 실제 HTTP 400 응답 바디의
    `error.details[0].code === 'MASKED_VALUE_RESUBMITTED'` 를 단언하는 캐너리 1건을 추가하면, 컨트롤러
    ↔ 필터 경계가 실제로 붙어 있음을 배선 레벨에서 고정할 수 있다.

- **[INFO]** 깊이 경계 테스트가 동종(homogeneous) 중첩만 다루고 혼합(object↔array 교차) 중첩은 다루지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` 함수
    `nestObj`/`nestArr` 및 이를 쓰는 `[경계]` 테스트 3건(게이트 174~201)
  - 상세: `hasMaskedLeaf` 는 object 분기와 array 분기가 동일하게 `depth + 1` 로 재귀한다는 전제 위에서
    "두 분기가 같은 보폭으로 세는지 본다" 는 목적으로 `nestObj`(전부 객체)와 `nestArr`(전부 배열)를 각각
    독립적으로 검증한다. 두 분기가 **개별적으로는** 같은 깊이에서 옳게 동작함을 확인하지만, 실제
    Manual 트리거 입력에서 흔한 "object 안에 array, array 안에 object" 교차 중첩이 같은 상한에서 동일하게
    작동하는지는 직접 검증하지 않는다. 구현 로직상 위험은 낮다(두 분기 모두 단순히 `depth + 1` 만
    넘기므로 교차해도 깨질 이유가 없다) — 방어적 캐너리 성격의 지적이다.
  - 제안: 필수 아님. 여유가 있다면 `p: { a: [{ b: [MARKER] }] }` 류의 교차 중첩을 상한 깊이에 맞춰 한 건
    추가하면 "같은 보폭" 주장이 실제 혼합 형태까지 커버됨을 코드로 고정할 수 있다.

- **[INFO]** phase-1(raw)에서 무관 필드가 `coerce_failed` 로 통과 실패하면, phase-2(resolve 후 JSON-string
  마커) 검사가 아예 실행되지 않는 조합은 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수
    `resolveTriggerParametersRejectingMasked` (게이트 62~74) — 특히 `const resolved =
    resolveTriggerParameters(schema, rawSource);` (게이트 68)
  - 상세: `rawHits` 가 비어 `throwIfAny(rawHits)` 를 통과하더라도, 바로 다음 줄의 `resolveTriggerParameters`
    호출 자체가 (마스킹과 무관한) 다른 필드의 진짜 타입 오류로 `TriggerParameterValidationException`
    (`coerce_failed`)을 던질 수 있다. 이 경우 게이트 72의 phase-2 마스킹 검사(JSON-string 안에 파묻힌
    마커)는 도달하지 않고, 사용자는 "타입 오류" 만 보고 같은 요청 안의 마스킹된 필드는 다음 재제출까지
    안내받지 못한다. `[캐너리] raw 에서 걸리면 coerce_failed 가 섞이지 않는다` 테스트(spec.ts 게이트
    282~299)는 **raw 단계에서** 마커와 coerce_failed 가 동시에 걸리는 경우만 다루고, "raw 는 깨끗하지만
    resolve 도중 무관 필드가 진짜로 실패해 phase-2 마스킹 검사를 가리는" 이 조합은 다루지 않는다. 보안
    우회는 아니다(값이 그대로 통과되는 게 아니라 에러 우선순위 문제) — UX 상 "왜 마스킹 안내를 못
    받았지" 로 이어질 수 있는 엣지케이스다.
  - 제안: 이번 PR 스코프에서 강제할 사안은 아님. `throwIfAny` 바로 위 docstring 이 "두 phase 를 합쳐서
    던지지 않는다" 는 결정과 근거(coerce_failed 혼입 방지)는 이미 적어 뒀으니, 이 특정 조합(무관 필드
    coerce_failed 가 phase-2 마스킹 검사를 가림)도 알려진 트레이드오프로 한 줄 추가해 두면 다음 사람이
    "왜 이 경우 마스킹 안내가 없었지" 를 재조사하지 않아도 된다.

## 회귀 테스트 확인

- `errors: err.errors` → `details: toTriggerParameterErrorDetails(err.errors)` 전환에 대해, 기존
  `executions-rerun.service.spec.ts` 의 `'throws INVALID_INPUT when inputOverride fails trigger schema
  validation'` 테스트(게이트 330)는 `rejects.toBeInstanceOf(BadRequestException)` 만 단언하고 봉투
  키(`errors`/`details`) 형태를 검증하지 않아 이번 변경으로 깨지지 않는다. `workflows.controller.spec.ts`
  는 애초부터 `details` 형태였으므로(WorkflowsController 는 이 PR 이전부터 `toTriggerParameterErrorDetails`
  사용) 영향 없음 — 두 경로 모두 실행해 확인했다(47/47 PASS).
- `resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked` 전환 후 두 호출부 어디에도
  옛 함수의 잔존 호출이 없음을 grep 으로 확인(webhook/schedule 경로는 원래 함수를 그대로 사용하므로
  영향 밖).

## 테스트 가독성·설계 (긍정 평가)

- `reject-masked-resubmission.spec.ts` 는 캐너리(`[캐너리]`)·경계(`[경계]`)·회귀(`[회귀]`)·통합(`[통합]`)
  태그로 테스트 의도를 이름에서부터 명시하고, 각 테스트 상단 docstring 이 "이 테스트가 없으면 어떤
  CRITICAL 이 재발하는가" 를 구체적으로 적어 둬 다음 사람이 테스트를 지우거나 완화하기 전에 이유를 알 수
  있다.
- `deepRedactSecrets` 실제 산출물을 판정기에 그대로 먹이는 왕복 통합 테스트(게이트 227~250)는 전제
  확인(`expect(JSON.stringify(masked)).toContain(VALUE_MASK_MARKER)`)을 먼저 넣어, 마스커가 실제로 마커를
  안 남기는 상황에서 아래 단언이 vacuous 해지는 것을 막는다 — mock 모델과 실제 구현의 괴리를 좁히는
  좋은 패턴이다.
- 두 호출부 spec 모두 `beforeEach` 에서 `service`/`controller` 를 새로 만들어(TypeORM 리포지토리 mock도
  매번 재생성) 테스트 간 상태 공유가 없다. `jest.spyOn(service, 'findById')` 는 매 테스트 새 인스턴스를
  대상으로 하므로 명시적 `restoreMocks` 없이도 누수되지 않는다(기존 파일 전체가 같은 패턴).
- `REASON_TO_DETAIL` 매핑이 `Record<TriggerParameterValidationError['reason'], ...>` 타입으로 닫혀 있어,
  신규 `reason` 값을 추가하고 매핑을 빠뜨리면 **컴파일 타임에** 실패한다 — 런타임 테스트가 이 exhaustiveness
  를 별도로 지켜야 할 부담이 없다.

## 요약

핵심 신규 로직(`reject-masked-resubmission.ts`)은 20건의 전용 unit 테스트로 스칼라·타입별 우회(boolean/number)·
JSON-string 중첩·정확 일치 경계·깊이 상한 경계(±1)·스택 안전성·실제 마스커와의 왕복 통합·phase 경계까지
빈틈없이 다루고 있으며 직접 실행해 전부 GREEN 임을 확인했다. 두 호출부(`executions.service.ts`,
`workflows.controller.ts`)에는 각각 스칼라 거부·중첩 거부·과잉 차단 방지 3종 캐너리가 추가됐고, 선존 버그
회귀 방지 테스트도 명시적으로 고정됐다. 기존 테스트는 봉투 키 형태를 구체적으로 단언하지 않아 이번
`errors`→`details` 정정으로 깨지지 않음을 실행으로 확인했다. 새로 찾은 이슈는 모두 INFO 수준이다 —
(1) 이 PR 이 고치는 바로 그 결함 클래스(레이어 경계 봉투 드리프트)를 실제로 넘나드는 e2e 캐너리는 없고
unit 조합에만 의존한다, (2) 혼합 중첩·(3) phase-1 무관 실패가 phase-2 마스킹 검사를 가리는 조합 — 셋 다
보안 우회나 즉각적 회귀 위험은 아니며 방어적 보강 제안 수준이다.

## 위험도

LOW
