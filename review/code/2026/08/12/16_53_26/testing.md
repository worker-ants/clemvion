# Testing Review — EIA §R8 idempotency 캐시 스코프 (2차, dead-code CRITICAL 수정 후)

## 발견사항

- **[WARNING]** 기존(변경되지 않은) `'400 VALIDATION_ERROR 는 캐시하지 않는다'` 테스트가 **이번 PR이 바로잡은 것과 같은 클래스의 vacuous mock**을 그대로 쓰고 있어, closed-list 제외 조건(`isErrorStatusCacheable`)이 실제 error 채널에서 400 을 올바르게 제외하는지는 여전히 어떤 테스트로도 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:243-253` (`it('400 VALIDATION_ERROR 는 캐시하지 않는다 (Spec EIA §R8)', ...)`) — 이 테스트는 이번 diff 의 변경분이 아니라(진단된 unified diff 밖의 기존 코드) `@@ -231,31 +252,134 @@` 헌크 앞에 그대로 남아 있는 pre-existing 블록이다.
  - 상세: `interaction.service.ts` 의 `dispatchContinuation()` (`badRequest(ErrorCode.VALIDATION_ERROR, ...)`, 493~497행)을 직접 확인하면 `FormValidationError` → `400 VALIDATION_ERROR` 역시 409/410 과 완전히 같은 방식으로 **`BadRequestException` 을 throw** 한다 — 즉 실제 트래픽에서는 error 채널(→ 새로 만든 `catchError` 분기)로 흐른다. 그런데 이 pre-existing 테스트는 `makeCallHandler({ error: 'VALIDATION_ERROR' })`(성공/`of()` 채널)에 `makeContext({ statusCode: 400 })` 로 상태코드를 인위적으로 프리셋하는, 바로 이번 PR 이 409/410 에 대해 "실제로 발생하지 않는 상태를 검사한다"고 지목해 폐기한 것과 **동일한 패턴**이다. 이 테스트가 실제로 도는 코드 경로는 `cacheTapped` 의 `tap({next})`(2xx 범위 필터)뿐이고, `catchError` 블록 안의 `isErrorStatusCacheable(400)` 판정은 전혀 행사되지 않는다.
  - **실측 가능한 결과**: `isErrorStatusCacheable` 를 `statusCode === 409 || statusCode === 410 || statusCode === 400` 로 오염시키는 뮤턴트를 넣어도, 이 파일의 어떤 테스트도 RED 가 되지 않는다 — 409/410 테스트는 여전히 참(캐시됨)이고, 404 테스트(`NotFoundException` 을 실제 throw)는 `isErrorStatusCacheable(404)` 가 여전히 false 라 그대로 통과하며, 이 400 테스트는애초에 error 채널을 행사하지 않으므로 `isErrorStatusCacheable(400)` 값과 무관하게 통과한다. RESOLUTION.md 의 뮤테이션 재실측 표(`catchError 블록 제거`→409·410, `isErrorStatusCacheable → >= 400`→404)에도 이 "닫힌 목록에 400 을 잘못 추가" 뮤턴트는 없다 — 정확히 이 사각지대가 실측에서 빠졌다.
  - 현재 구현(`isErrorStatusCacheable`)은 코드 직접 확인 결과 `=== 409 || === 410` 만 반환하므로 **지금 당장 살아있는 버그는 아니다.** 다만 이 PR 자체가 "mock 이 만들 수 있는 상태와 시스템이 실제로 만드는 상태는 다르다"는 교훈을 §R8 닫힌 목록 전체에 대해 정착시키려던 것인데, 그 적용이 409/410/404/5xx/3xx 다섯 케이스에는 이뤄지고 원래부터 있던 400 케이스 하나만 비껴갔다.
  - 제안: `makeThrowingHandler(new BadRequestException({ error: { code: 'VALIDATION_ERROR' } }))` 로 error 채널을 행사하는 테스트로 교체(또는 병행 추가)하고, `redis.set` 이 호출되지 않음을 단언한다. 이렇게 하면 `isErrorStatusCacheable` 에 `400` 이 잘못 추가되는 회귀가 실제로 검출된다.

- **[INFO]** `'throw 된 409 가 캐시된다'` / `'410 도 캐시된다'` 두 테스트를 제외한 나머지 신규 error-채널 테스트(`5xx`, `404`)는 캐시된 값의 `responseJson` 내용까지는 검증하지 않고 `redis.set` 미호출만 확인한다 — 캐시되지 않아야 하는 경로라 내용 검증이 필요 없어 문제는 아니지만, 참고로 남긴다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:336-350`(5xx), `:367-381`(404)
  - 제안: 조치 불요.

- **[INFO]** `makeThrowingHandler` 테스트들이 `makeContext({ ..., statusCode: 202 })` 를 함께 넘기는데, error 채널에서는 `res.statusCode` 가 전혀 읽히지 않으므로(=`catchError` 는 `err.getStatus()` 만 본다) 이 인자는 실질적으로 no-op 이다. 파일 상단 docstring(14-15행)에 "컨트롤러가 `@HttpCode(202)`" 라는 배경은 있지만, 각 `it` 자리에서 "왜 202 를 넘기는지(= res.statusCode 가 실제로 이 값으로 선고정돼 있어도 catchError 경로는 그것과 무관함을 보여주려는 의도)"는 명시돼 있지 않아 다음 사람이 이 인자를 지워도 되는지 헷갈릴 수 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:266`, `:292`, `:344`, `:373`
  - 제안: 선택 사항 — 각 자리 또는 `makeThrowingHandler` 사용 시 한 줄 주석으로 "res.statusCode 는 error 채널에서 무시됨(대조용)" 을 명시.

- **[INFO]** `Idempotency-Key` e2e 부재는 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 후속 항목으로 적절히 등재돼 있고(§`16_29_45` CRITICAL 의 후속 권고), RESOLUTION.md 도 별도 작업으로 분리한다고 명시했다. 재지적하지 않는다 — 다만 위 400 케이스처럼 **단위 테스트의 mock-리얼리티 갭이 반복 발생하는 지점**이라, 그 e2e 가 결국 이 종류의 갭을 잡는 안전망이 될 것이다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (신규 체크리스트 항목)
  - 제안: 없음 — 추적 상태 확인만.

- **[INFO]** 신규 error-채널 테스트(409/410/5xx/404) 자체는 `makeThrowingHandler` 를 통해 실제 NestJS 파이프라인(핸들러 예외 → RxJS error notification → `catchError`)을 정확히 재현하고, 각 케이스가 `redis.set` 호출 여부·저장된 `statusCode`(및 409 는 `responseJson` 내용까지)를 단언하며, 재현(캐시 히트 → 예외 재throw) 경로도 별도로 커버한다. 테스트 격리(매 `it` 마다 신규 `redis`/`interceptor`)도 양호하고, 각 주석이 "왜 error 채널이어야 하는가"를 `16_29_45` CRITICAL 을 인용해 명확히 설명해 가독성이 좋다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:255-381`
  - 제안: 없음 — 참고용 기록.

## 요약

이번 diff 는 직전 라운드(`16_29_45`)에서 CRITICAL 로 지적된 "409/410 캐싱이 도달 불가능한 dead code" 를 `catchError` 확장 + `makeThrowingHandler` 기반 error-채널 테스트로 실질적으로 바로잡았고, 신규 회귀 테스트(409/410/5xx/3xx/404)는 실제 예외 throw 경로를 정확히 재현해 이전의 vacuous-mock 문제를 해소했다. 다만 같은 파일에 **손대지 않고 남겨 둔** `'400 VALIDATION_ERROR 는 캐시하지 않는다'` 테스트 하나가 여전히 옛 방식(성공 채널 + 인위적 statusCode 프리셋)을 쓰고 있어, `interaction.service.ts` 가 400 도 409/410 과 동일하게 예외로 throw 한다는 사실과 어긋난다 — 그 결과 `isErrorStatusCacheable` 에 `=== 400` 이 잘못 추가되는 회귀를 이 스위트의 어떤 테스트도 잡지 못한다(직접 확인: 404/409/410 테스트 전부 이 뮤턴트에 통과). 현재 구현 자체는 400 을 정확히 제외하므로 지금 살아있는 버그는 아니지만, 이번 라운드가 다잡으려던 "mock 이 만드는 상태 vs 시스템이 실제로 만드는 상태" 원칙이 닫힌 목록의 한 항목(400)에는 아직 적용되지 않은 잔여 갭이다.

## 위험도

MEDIUM
