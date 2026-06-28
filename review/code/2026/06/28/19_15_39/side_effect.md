# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] process.env 객체 참조 교체 방식의 잠재적 격리 한계
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L150-L156, L168-L175 / `public-webhook-throttle.guard.spec.ts` L281-L288
- 상세: `process.env = envSnapshot` 패턴은 `process.env` 참조 자체를 스냅샷 복사본으로 교체한다. 현재 테스트 대상인 `extractClientIpFromHeaders`·`shouldTrustCfConnectingIp` 함수가 호출 시마다 `process.env.TRUST_CF_CONNECTING_IP`를 동적으로 읽기 때문에 실질적 격리 문제는 없다. 그러나 이 방식은 기존 `const orig = process.env.TRUST_CF_CONNECTING_IP` + 조건부 delete/재할당 패턴과 달리 원본 `process.env` 객체 자체를 교체한다. Node.js 네이티브 바인딩이나 모듈 로드 시점에 `process.env` 객체 참조를 캡처한 코드에서는 복원이 무효가 될 수 있다. 이전 리뷰(19_00_30 side_effect.md)에서 동일하게 지적되었고 RESOLUTION에서 "실질 문제 없음"으로 확인된 항목이다.
- 제안: 동작상 문제 없으므로 INFO 수준 유지. 장기 안전을 위해 동일 객체 변이 방식(`Object.assign`·`delete`) 또는 `jest.replaceProperty(process, 'env', ...)` 검토 가능. 현행 유지도 허용.

### [INFO] `extractClientIp` 로컬 래퍼 제거 — 외부 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` (삭제된 module-scope 함수)
- 상세: `function extractClientIp(headers)` 래퍼가 제거되고 두 호출부에서 `extractClientIpFromHeaders(input.headers) ?? undefined`를 직접 호출한다. 삭제된 함수는 export되지 않은 module-scope 함수였으므로 외부 소비자 없음. 두 호출부의 실행 경로(`handleWebhook` L152 및 `handleChatChannelWebhook` L260)에서 반환값·타입이 동일(`string | undefined`)하다. 동작 보존.
- 제안: 없음.

### [INFO] `PublicWebhookReqShape` 신규 export — additive 공개 API 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (신규 export interface)
- 상세: 기존 `getRequest<{ ... }>` 인라인 익명 타입이 named interface `PublicWebhookReqShape`로 추출되어 export된다. 이는 additive 변경으로 기존 소비자에 breaking change가 없다. 단, 이후 이 인터페이스 필드를 제거하거나 타입을 좁히면 breaking change가 된다는 인식이 필요하다. `PublicWebhookReqExtension`을 상속하므로 `__publicWebhookTrigger` 필드도 공개 타입의 일부가 된다. 이전에 test 파일 내부의 로컬 `export interface ReqShape`가 제거되었으므로, 해당 export를 임포트하던 코드가 있다면 breaking이 될 수 있으나 이전 리뷰에서 외부 소비자 0이 확인되었다.
- 제안: 없음. 의도된 additive 변경.

### [INFO] `GlobalExceptionFilter` private static 상수 추가 — 클래스 외부 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` (UNKNOWN_ERROR_MESSAGE, UNHANDLED_ERROR_MESSAGE)
- 상세: `private static readonly` 상수 2종이 클래스에 추가된다. `private`이므로 외부 접근 불가. 런타임 값은 이전 인라인 문자열 리터럴과 동일하며 전역 상태 변경 없음. 기존 문자열(`'An unexpected error occurred'`, `'An unexpected error occurred. Please try again later.'`)을 named 상수로 대체하는 것이므로 동작 변경 없음.
- 제안: 없음.

### [INFO] `afterEach(jest.restoreAllMocks)` 도입 — spy 복원 범위 정리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L36-L38 / `public-webhook-throttle.guard.spec.ts` L281-L288
- 상세: 기존 개별 테스트 내 `mockRestore()` 호출을 `afterEach(jest.restoreAllMocks)`로 통일한다. `jest.restoreAllMocks()`는 `jest.spyOn`으로 생성된 spy만 원래 구현으로 복원하며, `jest.fn()`으로 생성된 mock은 영향받지 않는다. 기존에 `try/finally` 없이 `warn.mockRestore()`를 개별 호출하던 방식에서는 테스트가 예외로 중단되면 spy가 누설될 수 있었는데, `afterEach`로 이동함으로써 예외 발생 시에도 항상 복원된다. 의도된 개선이며 다른 테스트의 mock 설정에 의도치 않은 영향 없음.
- 제안: 없음.

### [INFO] `requestId` 단언 추가 — 상태 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L47
- 상세: 비-413 4xx 테스트에 `expect(body.error.requestId).toBeDefined()` 단언이 추가된다. 테스트 내 단언 추가이며 프로덕션 코드 동작 변경 없음. `requestId`는 필터 내부에서 생성·주입되므로 외부 상태 영향 없음.
- 제안: 없음.

## 요약

이번 변경은 코드 정리(로컬 래퍼 제거·상수화·인터페이스 추출)와 테스트 격리 강화(env 스냅샷·afterEach 통일)로 구성된 순수 리팩터링이다. 런타임 동작을 보존하며, 외부 인터페이스에 대한 breaking change는 없다. 유일한 잠재적 위험은 `process.env = envSnapshot` 참조 교체 방식인데, 현재 테스트 대상 코드가 `process.env`를 매 호출 시 동적으로 읽기 때문에 실질적 격리 문제가 없고, 이전 리뷰에서도 동일하게 검토·확인된 사항이다. `PublicWebhookReqShape` export 추가는 additive이며, `extractClientIp` 래퍼 제거는 module-scope 비공개 함수라 외부 영향 없다. 의도하지 않은 부작용은 발견되지 않는다.

## 위험도

NONE
