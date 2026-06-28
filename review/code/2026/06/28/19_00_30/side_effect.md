# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] process.env 객체 참조 교체 방식의 잠재적 격리 한계
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L482, L565 / `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L969
- 상세: `process.env = envSnapshot` 은 `process.env` 참조를 스냅샷 복사본으로 교체한다. 이 방식은 테스트 내에서 이미 `process.env` 참조를 캡처한 모듈(예: 모듈 로드 시 `const flag = process.env.FOO` 처럼 상수로 가져간 경우)에 대해서는 격리가 작동하지 않는다. 그러나 `extractClientIpFromHeaders`·`shouldTrustCfConnectingIp` 는 호출 시마다 `process.env.TRUST_CF_CONNECTING_IP`를 동적으로 읽으므로, 현재 테스트 대상에서는 실질적 문제가 없다. 단, 향후 해당 값을 모듈 최상위에서 캐싱하는 패턴으로 리팩터링하면 이 복원 방식이 실패하는 회귀 위험이 있다. 기존 패턴(`delete` + 원복)은 참조 교체 없이 동일 객체를 변이시키므로 그 위험이 없다.
- 제안: 현재 동작에는 문제 없으나, 복원 방식을 `Object.keys(process.env).forEach(k => delete process.env[k]); Object.assign(process.env, envSnapshot)` (동일 객체 변이)로 바꾸면 모듈 캐싱 패턴에도 안전하다. 단, 현재 코드가 동작상 문제는 없으므로 INFO 수준.

### [INFO] `extractClientIp` 로컬 래퍼 제거에 따른 함수 시그니처 변경 — 호출자 영향 없음 확인
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` diff L710-L712 (삭제된 로컬 함수)
- 상세: 파일 내부에만 존재하던 `function extractClientIp(headers)` 래퍼가 제거되고, 두 호출부(L152, L257)에서 `extractClientIpFromHeaders(...) ?? undefined`를 직접 호출한다. 삭제된 함수는 `private`도 아닌 module-scope 함수이지만 export되지 않았으므로 외부 호출자가 없다. 동작은 완전히 동일하다(`extractClientIpFromHeaders(...) ?? undefined`가 래퍼 내부와 동일). 외부 인터페이스에 영향 없음.
- 제안: 없음.

### [INFO] `PublicWebhookReqShape` 신규 export — 공개 API 추가
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L2237-L2242
- 상세: 기존에는 `getRequest<{ ... }>` 인라인 익명 타입이었고, 테스트 파일에는 동일 형태의 `ReqShape` 인터페이스가 로컬로 중복 선언되어 있었다. 이번 변경으로 `PublicWebhookReqShape`가 모듈 공개 API로 export된다. 이 자체는 추가 전용(additive) 변경이므로 기존 사용자에 대한 breaking change가 없다. 단, 이 인터페이스가 공개된 이후에는 필드 제거·타입 좁힘이 breaking change가 된다는 점을 인식해야 한다. `PublicWebhookReqExtension`을 상속하여 `__publicWebhookTrigger` 필드도 포함된다.
- 제안: 없음. additive export이므로 의도된 변경.

### [INFO] `GlobalExceptionFilter` static 상수 추가 — 클래스 형태 변경
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L282-L289
- 상세: `private static readonly UNKNOWN_ERROR_MESSAGE`와 `UNHANDLED_ERROR_MESSAGE` 두 상수가 클래스에 추가된다. `private static`이므로 외부에서 접근 불가. 런타임 동작은 이전과 동일하며(같은 문자열 값), 전역 상태 변경 없음. 테스트에서 이 상수에 직접 접근하지 않으므로 테스트 영향도 없다.
- 제안: 없음.

### [INFO] `afterEach(jest.restoreAllMocks)` 도입으로 인한 spy 복원 범위 확대
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L100-L102 / `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L1968-L1971
- 상세: 이전에는 개별 테스트 내에서 `warn.mockRestore()` / `errorLog.mockRestore()`를 명시적으로 호출했다. `jest.restoreAllMocks()`는 해당 describe 블록 내 모든 spy를 복원한다. `jest.restoreAllMocks()`는 `jest.spyOn`으로 생성된 spy만 복원하고, `jest.fn()`으로 생성된 mock은 영향받지 않으므로, 다른 테스트의 mock 설정에 의도치 않은 복원이 발생하지 않는다. 동작 보존.
- 제안: 없음.

## 요약

이번 변경은 코드 정리와 테스트 격리 견고성 개선에 집중된 리팩터링으로, 런타임 동작을 보존한다. `hooks.service.ts`의 로컬 `extractClientIp` 래퍼 제거, `http-exception.filter.ts`의 매직 문자열 상수화, `PublicWebhookReqShape` 인터페이스 추출은 모두 외부 인터페이스에 대한 breaking change 없는 additive 또는 동작-동일 변경이다. 테스트에서 `process.env = envSnapshot` 참조 교체 방식은 현재 테스트 대상 코드가 `process.env`를 매 호출 시 동적으로 읽으므로 실질적 격리 문제가 없지만, 향후 모듈 로드 시 캐싱하는 패턴이 도입될 경우 복원이 실패할 수 있다는 점이 유일한 잠재적 위험이다. 전체적으로 의도하지 않은 부작용은 발견되지 않는다.

## 위험도

NONE
