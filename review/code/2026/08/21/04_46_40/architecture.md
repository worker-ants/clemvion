# 아키텍처(Architecture) 리뷰 — 마스킹 재제출 서버측 거부 (EIA §R17, Manual 실행 경로)

## 발견사항

- **[INFO]** 신규 보안 규칙(마커 거부)이 두 개의 다른 레이어(Controller / Service)에 각각 직접 배선된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute` 메서드 내
    `resolveTriggerParametersRejectingMasked(schema, rawValues)` 호출부(313행 부근),
    `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드 내
    동일 호출부(499행 부근)
  - 상세: `WorkflowsController.execute` 는 스키마 로드 → 트리거 파라미터 resolve →
    예외를 `BadRequestException` 봉투로 매핑하는 로직을 컨트롤러 안에서 직접 수행한다(서비스로
    위임하지 않음). 이번 PR 은 그 자리에 마스킹 거부라는 **보안 불변식**을 새로 얹었는데,
    같은 불변식을 강제하는 두 번째 자리(`ExecutionsService.reRun`)는 정상적인 서비스 레이어에
    있다. 결과적으로 이 하나의 도메인 규칙("Manual 파라미터에 마커 리터럴을 허용하지 않는다")이
    프레젠테이션 레이어와 비즈니스 레이어 양쪽에 각각 독립적으로 배선된 상태다. 함수 자체는
    공유되지만(`resolveTriggerParametersRejectingMasked`가 순서를 소유), **호출·예외 매핑
    지점**은 레이어가 다르다 — 바로 이 PR 의 동기가 된 선행 결함(`errors` vs `details` 드리프트)
    도 정확히 이 두 지점 사이에서 발생했다. 컨트롤러가 서비스를 거치지 않고 도메인 규칙을
    직접 실행하는 패턴 자체는 이 PR 이전부터 있던 기존 부채이고, 이번 diff 가 그 지점을
    옮기거나 만든 것은 아니다.
  - 제안: 즉시 강제할 사안은 아니나, 다음에 `WorkflowsController.execute` 를 손댈 기회가 있으면
    trigger-parameter 해석·검증·에러 매핑을 `WorkflowsService` 쪽 메서드로 옮겨 두 진입점이
    같은 서비스 메서드를 호출하는 구조로 수렴시키는 것을 고려. (유지보수성 리뷰가 지적한
    "find+throw 3줄 중복"과는 다른 층위의 지적 — 이건 로직 배치의 레이어 경계 문제.)

- **[INFO]** `trigger-parameter.types.ts` 가 타입 정의 외에 매핑 로직·Exception 클래스까지 겸한다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` —
    `REASON_TO_DETAIL`(신규 `masked_value_resubmitted` 항목 추가), `toTriggerParameterErrorDetails`,
    `TriggerParameterValidationException`
  - 상세: 파일명·경로(`types/`)는 순수 타입 계약을 암시하지만 실제로는 internal reason →
    public error code 매핑 함수와 예외 클래스까지 들고 있다. 이번 PR 은 그 관례를 그대로
    따라 `masked_value_resubmitted` 항목을 추가했을 뿐이라 새로 만든 문제는 아니다. 다만
    `Record<Reason, {code, message}>` 형태를 유지한 덕분에, TS 컴파일러가 union 에 새 reason 을
    추가하면 매핑 누락을 컴파일 타임에 강제한다 — 확장성 관점에서는 오히려 바람직한 설계다
    (닫힌 판별 유니온 + exhaustive Record). `types.ts` 라는 이름과 실제 내용물의 불일치만
    지적해 둔다.
  - 제안: 강제 아님. 파일을 쪼갠다면 `trigger-parameter.types.ts`(순수 인터페이스) /
    `trigger-parameter-errors.ts`(매핑+Exception) 분리를 고려할 수 있으나, 지금 규모(95줄)에서는
    분리 비용이 이득보다 클 수 있다.

## 긍정적으로 평가할 설계 (요약에 반영)

- **데코레이터 패턴으로 관심사 분리**: `resolveTriggerParametersRejectingMasked`(신규 wrapper,
  `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`)가
  기존 `resolveTriggerParameters`(base)를 감싸며 "Manual 실행 경로에서 저작 주체가 사용자인
  페이로드" 라는 새 관심사를 추가한다. base 함수는 손대지 않았고(OCP), webhook/schedule 은
  여전히 base 를 직접 쓴다 — "판정 기준은 출처가 아니라 페이로드의 저작 주체" 라는 경계가
  코드 구조(별도 함수 + 별도 모듈)로 표현되어 있다.
- **호출 순서의 소유권을 한 곳에 고정**: raw-먼저-검사 → resolve → resolve-후-재검사라는
  2단계 순서를 wrapper 내부에 캡슐화하고(`resolveTriggerParametersRejectingMasked` 함수 자체),
  docstring 에 "호출부가 순서를 다시 정하지 않는다" 고 명시했다. 이 PR 이 고친 선행 CRITICAL
  (resolve 후에만 검사해 `Boolean('***')` 로 boolean 파라미터가 완전 우회)이 바로 순서를
  호출부에 흩뿌려 두면 재발하는 종류의 결함이라, Information Expert 원칙에 맞게 캡슐화한
  선택이 타당하다.
- **모듈 경계를 자동화된 fitness function 으로 강제**: `masked-reject-callers-guard.ts` +
  `masked-reject-callers.spec.ts` 는 "base 함수를 어디서 직접 써도 되는가"라는 규칙을 주석이
  아니라 AST 기반 정적 스캔 + 허용목록으로 강제한다. 세 번째 Manual 경로가 생겨 실수로 base
  를 직접 import 하면 이 가드가 RED 를 낸다 — 순환 의존성은 아니지만 "잘못된 방향의 결합"을
  기계적으로 차단하는 좋은 architecture test 사례다. 접두 겹침(`resolveTriggerParameters` vs
  `resolveTriggerParametersRejectingMasked`) 오탐 방지, 우회 형태(namespace/require/동적
  import/bracket access) 전수 커버, "죽은 허용목록 항목" 캐너리까지 갖춰 가드 자체의 신뢰도도
  검증한다.
- **부수 위험(devDependency 누출)까지 같은 방식으로 봉쇄**: `masked-reject-callers-guard.ts` 가
  `typescript`(devDependency)를 런타임에 import 하게 되면서 생긴 프로덕션 빌드 오염 위험을,
  개별 수정(`tsconfig.build.json` 에서 `src/repo-guards/**` 제외)에 그치지 않고
  `production-build-devdep-guard.ts` 라는 별도 fitness function 으로 "빌드 대상 중 어느 파일도
  devDependency 를 끌어오지 않는다" 는 불변식 자체를 고정했다. 테스트 전용 코드와 프로덕션
  런타임 경계를 문서가 아니라 검증 가능한 산출물로 못박은 점이 이 PR 전체의 패턴과 일관된다.
- **의존 방향 확인**: `shared/utils/sanitize-error-message.ts`(마커 판정 SoT, `isMaskedMarker`/
  `MASKED_MARKERS` export 로 승격)는 어떤 상위 모듈도 import 하지 않는 리프 모듈이고,
  `execution-engine/utils`, `types` 어느 쪽도 `executions`/`workflows` 모듈을 역참조하지
  않는다 — 순환 의존 없음. webhook(`hooks.service.ts`)·schedule(`schedule-runner.service.ts`)
  은 여전히 base 함수만 쓰고 있어 문서화된 범위 캐비엇과 실제 코드가 일치한다.

## 요약

핵심 변경(`reject-masked-resubmission.ts`)은 기존 `resolveTriggerParameters` 를 건드리지 않고
데코레이터로 감싸 "Manual 실행 경로 전용 보안 규칙"을 별도 모듈에 캡슐화했고, 그 모듈 경계를
지키기 위해 허용목록 기반 AST 정적 가드까지 신설해 아키텍처 침식(erosion) 방지 장치를 코드로
만들었다는 점이 두드러진다. 순환 의존성은 없고, webhook/schedule 대 Manual 경로의 판정 기준
(저작 주체) 이 모듈 분리와 정확히 일치한다. 유일하게 짚을 지점은 새 보안 규칙의 호출부가
컨트롤러 레이어(`WorkflowsController`)와 서비스 레이어(`ExecutionsService`)에 각각 독립적으로
박혀 있다는 것인데, 이는 이 PR 이 만든 문제가 아니라 기존 컨트롤러의 레이어 경계 관행을
그대로 물려받은 것이며 즉시 조치가 필요한 수준은 아니다. `trigger-parameter.types.ts` 가
타입 외 로직을 겸하는 점도 기존 관례의 연장으로 이번 PR 범위에서 강제할 사안은 아니다.

## 위험도

LOW
