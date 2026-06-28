# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 상수 명명의 유사성으로 인한 혼동 가능성
- **위치**: `/codebase/backend/src/common/filters/http-exception.filter.ts` 라인 282–289
- **상세**: `UNKNOWN_ERROR_MESSAGE`와 `UNHANDLED_ERROR_MESSAGE` 두 상수는 이름이 매우 유사하며 둘 다 "An unexpected error occurred"로 시작한다. JSDoc에 의도적 차이를 명시했으나, 이름만 보고 차이를 인지하기 어렵다. `UNKNOWN` (비-Error throw) vs `UNHANDLED` (Error이지만 매핑 없음)의 구분이 이름에서 직관적으로 드러나지 않는다.
- **제안**: `NON_ERROR_THROW_MESSAGE` / `UNHANDLED_EXCEPTION_MESSAGE` 처럼 throw된 값의 종류를 이름에 반영하면 혼동을 줄일 수 있다. 현 구현도 JSDoc으로 보완되어 있어 차단급 문제는 아님.

### [INFO] `handleChatChannelWebhook`에서 `clientIp`를 추출하지만 사용처가 단 한 곳에 국한됨
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 981
- **상세**: `handleChatChannelWebhook` 내부에서 `extractClientIpFromHeaders(input.headers) ?? undefined`로 `clientIp`를 추출하지만, 이 값은 실행 시작 경로(`this.executionEngineService.execute` 호출)에서만 사용된다. 단, 메서드 초반부에 추출하여 이후 모든 early-return 경로에서는 쓰이지 않고 계산만 된다. 성능 영향은 미미하지만 읽는 사람이 "왜 초반부에 추출했는지" 맥락을 찾게 된다.
- **제안**: 사용 지점 직전으로 이동하거나, `handleWebhook`과 동일하게 주석으로 "한 번만 추출" 의도를 명시하면 더 명확하다.

### [INFO] `getActiveExecutionStatus`의 private 필드 브래킷 접근
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 1606
- **상세**: `this.executionsService['executionRepository']?.findOne?.(...)` 패턴은 private 멤버를 브래킷 표기로 접근하는 방식이다. 이는 TypeScript 접근 제어를 우회하며, `executionRepository`가 리팩터링으로 이름이 바뀌거나 삭제되어도 컴파일 타임에 잡히지 않는다. 현재도 `.catch(() => null)` 방어를 달아 런타임 안전은 확보되어 있으나, 유지보수성 측면에서 취약점이다.
- **제안**: `ExecutionsService`에 `findExecution(id, select)` 같은 좁은 공개 메서드를 추가하거나, 해당 서비스에서 execution status를 조회하는 메서드(`getStatusById`)를 노출하는 방향이 이상적이다.

### [INFO] `handleChatChannelWebhook` 메서드의 높은 순환 복잡도
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 962–1373
- **상세**: 해당 메서드는 약 410라인으로, cancel/help/open_form_modal/form_submission/text_message/button_callback/file_upload 등 7개 이상의 command kind 분기와 각 분기 내부 중첩 조건을 포함한다. 순환 복잡도가 20을 크게 초과할 것으로 추정된다. 특히 `form_submission` 블록(1168–1295 라인)은 try/finally + 중첩 조건으로 단독으로도 복잡하다.
- **제안**: 이번 변경이 메서드 자체의 리팩터링 범위는 아니나, 장기적으로 command kind별 private 핸들러 메서드 분리(`handleCancelCommand`, `handleFormSubmission`, `handleInteractionCommand` 등)가 필요하다. 단, 이 변경은 리팩터링 백로그 항목으로 별도 관리함이 적절하다.

### [INFO] `beforeEach` 환경 스냅샷 패턴의 두 describe 블록 중복
- **위치**: `/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` 라인 433–441, 451–459
- **상세**: `envSnapshot` 선언 + `beforeEach` 스냅샷 + `afterEach` 복원 패턴이 동일 파일 내 두 describe 블록에 중복 선언된다. 이번 변경이 기존 try/finally 패턴보다 명확하게 개선된 것은 맞으나, 파일 상단 또는 공통 헬퍼로 추출 가능하다.
- **제안**: `describe.each` 또는 `beforeEach`/`afterEach`를 `describe` 블록 밖 파일 레벨로 이동하거나, 헬퍼 함수 `withEnvSnapshot()` 형태로 추출하면 단일 선언으로 정리된다. 현 패턴도 허용 범위이나 향후 블록 추가 시 또다시 중복될 수 있다.

### [INFO] `hooks.service.ts` 의 `?? undefined` 표현 반복
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 683, 693, 981, 1351
- **상세**: `extractClientIpFromHeaders(...) ?? undefined`가 여러 곳에 반복된다. `extractClientIpFromHeaders`의 반환형이 `string | null`이고 호출부가 `string | undefined`를 요구하기 때문에 `?? undefined` 변환이 필요한 것은 이해되나, 이 패턴이 눈에 띄게 반복된다.
- **제안**: `extractClientIpFromHeaders`의 반환형을 `string | undefined`로 변경하거나, 래퍼 함수(`extractClientIp`)를 공유 유틸로 두는 방법을 고려할 수 있다. 이번 PR에서 로컬 래퍼를 제거하면서 직접 호출로 바꿨는데, 반환형 통일이 더 근본적인 해법이다.

### [INFO] `PublicWebhookReqShape`와 `PublicWebhookReqExtension`의 상속 관계 혼동 여지
- **위치**: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 2237–2243
- **상세**: `PublicWebhookReqShape extends PublicWebhookReqExtension` 구조로 `__publicWebhookTrigger` 필드를 상속한다. 그러나 `ReqShape`는 요청의 "입력 형태"를 나타내고 `ReqExtension`은 Guard가 "주입한 확장 필드"를 나타내므로, 두 역할이 하나의 타입으로 합쳐지는 것은 의미 경계가 모호하다. 테스트 파일에서 `type ReqShape = PublicWebhookReqShape`로 재사용하는 것은 중복 제거로 올바른 방향이다.
- **제안**: 현 구조는 실용적이고 주석으로 의도가 설명되어 있으므로 허용 범위이다. 만약 분리한다면 `req` 타입은 `PublicWebhookReqShape & PublicWebhookReqExtension`으로 intersection을 쓰는 방법도 있다.

## 요약

이번 변경은 전체적으로 유지보수성을 개선하는 방향으로 이루어졌다. 로컬 래퍼 함수 제거(A-1), 매직 문자열 상수화(A-2), 인라인 익명 타입의 named interface 추출(A-3), 테스트 환경 격리 패턴 통일(B-4~B-7) 모두 코드 중복을 줄이고 의도를 명확히 하는 올바른 방향이다. 주요 우려 사항은 `getActiveExecutionStatus`의 private 필드 브래킷 접근과 `handleChatChannelWebhook`의 높은 순환 복잡도이나, 후자는 이번 PR 범위 밖의 기존 구조이며 전자도 런타임 방어가 있다. `UNKNOWN_ERROR_MESSAGE`와 `UNHANDLED_ERROR_MESSAGE`의 유사 명칭은 주석이 보완하고 있으나 이름 자체의 구분력이 낮다는 점은 향후 개선 여지가 있다. 전반적으로 동작 보존 범위 내에서 코드 정리를 충실히 수행한 변경이다.

## 위험도

LOW
