# Architecture Review — eia-inputoverride-reject-a3f1c9

## 발견사항

- **[WARNING]** `resolveTriggerParametersRejectingMasked` 와 `resolveTriggerParameters` 두 함수가 같은 디렉토리에 유사한 이름으로 병존 — 새 Manual 경로 추가 시 잘못된(비-거부) 함수를 import 할 위험이 컴파일러가 아니라 docstring 으로만 막힌다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (함수 `resolveTriggerParametersRejectingMasked`, 파일 내 주석 "세 번째 Manual 경로가 생기면 이 함수를 부르면 된다" 부분) / `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:109` (`resolveTriggerParameters`)
  - 상세: 두 함수는 같은 `utils/` 폴더에 나란히 export 되고 이름도 접미사(`RejectingMasked`)만 다르다. webhook(`hooks.service.ts:183`)·schedule(`schedule-runner.service.ts:78,88`)은 의도적으로 base 함수를 쓰고, Manual 경로(`executions.service.ts`, `workflows.controller.ts`) 둘은 wrapper 를 쓴다 — 이 구분은 지금 정확하지만, 강제하는 장치가 이 파일의 JSDoc 뿐이다. 이 프로젝트 이력(memory: "미러 발산으로 반복해 뚫렸다")이 보여주듯 문서만으로 지켜지는 불변식은 이 저장소에서 실제로 여러 번 깨졌다. `isMaskedMarker`/`MASKED_MARKERS` 공유로 마스킹 판정 자체의 발산은 이미 잘 막았지만, "어떤 호출부가 어떤 함수를 써야 하는가"라는 한 단계 위의 불변식은 여전히 convention-only 다.
  - 제안: 최소한 ESLint `no-restricted-imports`(경로별 override, Manual 소비 모듈에서 base `resolveTriggerParameters` import 를 금지)나, 더 근본적으로는 base 함수를 `execution-engine` 내부 전용으로 두고 두 wrapper(`ForWebhookOrSchedule`/`RejectingMasked`)만 외부에 공개하는 배럴(index) 구조로 표면을 좁히는 방안을 고려.

- **[INFO]** 에러 봉투 조립(try/catch → `TriggerParameterValidationException` 감지 → `BadRequestException` 구성)이 두 호출부에 거의 동일한 형태로 중복되어 있음.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`reRun` 메서드, `resolveTriggerParametersRejectingMasked` 호출부 try/catch) / `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute` 메서드, 동일 패턴)
  - 상세: 두 곳 모두 "① 새 함수 호출 → ② `TriggerParameterValidationException` 이면 `code`+`message`+`toTriggerParameterErrorDetails(err.errors)` 로 `BadRequestException` 구성 → ③ 아니면 rethrow" 라는 동일한 제어 흐름을 반복한다. 다만 `code`(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)와 `message` 가 표면마다 달라 완전한 추출은 프레젠테이션 관심사를 비즈니스 레이어로 끌고 들어갈 위험이 있다 — 실제로 이 PR 의 핵심 원칙("판정 로직은 `reject-masked-resubmission.ts` 가 소유, 봉투 포맷은 호출부 소유")과 일치하는 의도적 분리로 보인다.
  - 제안: 현재 수준(판정 로직 중앙화, 봉투 조립만 호출부별 유지)은 합리적인 트레이드오프이므로 강제 리팩터링은 불필요. 다만 세 번째 소비처가 생기면 `(err, code, message) => BadRequestException` 형태의 얇은 헬퍼로 추출할 가치가 생긴다는 점만 기록.

- **[INFO]** `reject-masked-resubmission.ts` 가 `execution-engine/utils/` 아래 위치하지만 실제 소비처(`executions`, `workflows` 모듈)는 둘 다 `execution-engine` 모듈 밖이며, `execution-engine` 자신은 이 파일을 쓰지 않음.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 전체 (기존 `resolve-trigger-parameters.ts`, `load-trigger-parameter-schema.ts` 도 동일 패턴)
  - 상세: 트리거 파라미터 관련 유틸(`resolve-trigger-parameters`, `load-trigger-parameter-schema`, 이번에 추가된 `reject-masked-resubmission`)이 전부 `execution-engine` 네임스페이스 아래 있지만 소비 모듈은 `executions`/`workflows`/`schedules`/`hooks` 등 다양하다. 이 PR 이 새로 만든 문제는 아니고(선행 파일 두 개도 같은 위치), 이 리뷰에서 blocking 사유는 아니다.
  - 제안: 조치 불요(기존 구조 답습). 장기적으로 `trigger-parameters/` 같은 독립 shared 모듈로 승격하는 리팩터를 고려할 수 있으나 이 PR 범위 밖.

## 좋은 설계 결정 (근거로 남김)

- **Open-Closed 준수**: 기존 `resolveTriggerParameters`(webhook/schedule 이 계속 쓰는 함수)를 수정하지 않고 `resolveTriggerParametersRejectingMasked` 로 감싸 새 동작을 추가했다. webhook/schedule 경로는 무변경으로 남아 회귀 위험이 없다.
- **검사 시점 소유권 중앙화**: 이전 라운드에서 raw-vs-resolved 검사 순서를 호출부마다 복붙했다가 `errors`/`details` 봉투 드리프트를 겪은 뒤, 순서 자체를 `reject-masked-resubmission.ts` 하나가 소유하도록 리팩터했다(docstring 에 "호출부가 순서를 다시 정하지 않는다" 로 명문화). 세 번째 Manual 경로가 생겨도 이 함수 하나만 부르면 되는 구조.
- **의도적 스코프 제한**: 공유 프리미티브(`resolveTriggerParameters`)를 넓히지 않고 별도 wrapper 로 분리해, webhook/schedule 처럼 마커 리터럴이 정상 값일 수 있는 무관 경로가 오염되지 않도록 막았다 — "공유 프리미티브를 넓히면 무관한 경로가 오염된다"는 원칙이 코드 배치에 그대로 반영됨.
- **판정 프리미티브 재사용**: `isMaskedMarker`/`MASKED_MARKERS` 를 egress 마스킹(`sanitize-error-message.ts`)과 ingress 거부(`reject-masked-resubmission.ts`)가 공유 — 복제 시 발생하는 "미러 발산" 을 원천 차단. `MASKED_MARKERS` 도 `Object.freeze` 로 런타임 변형까지 막아, 두 판정기가 같은 싱글턴을 신뢰하는 불변식을 지킨다.
- **컴파일 타임 완전성**: `REASON_TO_DETAIL` 이 `Record<TriggerParameterValidationError['reason'], ...>` 매핑 타입이라 새 `reason` 유니온 멤버(`masked_value_resubmitted`) 추가 시 매핑 누락이 컴파일 에러가 된다 — 닫힌 union 확장의 안전한 패턴.
- **테스트 아키텍처**: `reject-masked-resubmission.spec.ts` 의 "왕복 통합" 테스트가 실제 마스커(`deepRedactSecrets`)의 산출물을 판정기에 직접 먹여, 마스커와 판정기가 각자 독립적으로 재귀 구현한 depth 로직이 실제로 정합하는지 확인한다 — 순수 모델 기반 경계 테스트만으로는 못 잡는 두 구현 간 드리프트를 잡는 설계.
- **기존 유틸 재사용**: `isRecord`(`to-record.ts`)를 재사용해 `isPlainRecord` 류 재구현을 피함 — 이전 라운드에서 지적된 중복 재발 없음.
- **순환 의존성**: `execution-engine → shared/utils`, `executions/workflows → execution-engine/utils` 단방향. 역방향 참조 없음을 확인.

## 요약

이번 변경은 마스킹된 값 재제출 거부를 서버측(Manual 실행 경로 두 곳)에 추가하는 기능으로, 검사 순서 소유권을 단일 함수(`resolveTriggerParametersRejectingMasked`)에 중앙화하고 마스킹 판정 프리미티브(`isMaskedMarker`)를 egress/ingress 양방향에서 공유해 이 프로젝트가 반복해서 겪은 "미러 발산" 실패 패턴을 구조적으로 차단했다. webhook/schedule 경로를 건드리지 않고 wrapper 로 확장한 것은 Open-Closed 원칙에 부합하며, 순환 의존성이나 레이어 위반은 발견되지 않았다. 유일한 실질적 우려는 base 함수와 wrapper 함수가 같은 폴더에 유사 이름으로 병존해 미래의 세 번째 Manual 경로가 컴파일러 도움 없이 잘못된 함수를 고를 여지가 남아 있다는 점이다(WARNING). 나머지는 의도적 트레이드오프로 문서화된 INFO 수준 관찰이다.

## 위험도
LOW
