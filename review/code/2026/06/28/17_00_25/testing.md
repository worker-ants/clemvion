# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `http-exception.filter.spec.ts` — CWE-209 메시지 마스킹 테스트 보강 적절
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.spec.ts` 변경 diff (라인 36~40)
- 상세: `mapHttpErrorLike` 경로의 413 처리에서 내부 메시지(`request entity too large`)를 echo 하지 않고 일반 문구를 반환하는 CWE-209 관련 동작을 `.not.toBe(...)` + `.toBe('Request payload too large.')` 두 단언으로 명시적으로 검증한다. positive assertion 과 negative assertion 을 모두 갖춘 구조로 의도가 명확하게 표현되어 있어 좋다.
- 제안: 해당 없음. 테스트 추가는 적절하다.

### [INFO] `mapHttpErrorLike` — 비-413 4xx 경로의 메시지 마스킹 테스트 미존재
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` 라인 178~182
- 상세: `errStatus !== 413` 일 때 `'The request could not be processed.'` 를 반환하는 분기가 새로 추가되었다. 그러나 `http-exception.filter.spec.ts` 의 테스트 케이스에는 404, 400, 422, 429 등 비-413 4xx 상태를 `mapHttpErrorLike` 경로로 유입하는 케이스가 없다. 현재 테스트는 413 만 검증하므로 해당 분기의 문구(`'The request could not be processed.'`)는 직접 단언되지 않는다.
- 제안: 비-413 4xx `HttpErrorLike`(예: `{ status: 400 }` 오류)에 대해 `body.error.message` 가 `'The request could not be processed.'` 임을 검증하는 케이스를 추가하면 커버리지 갭이 닫힌다.

### [INFO] `http-exception.filter.spec.ts` — `mapHttpErrorLike` 경로에서 logger.warn 호출 검증 누락
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` 라인 264~265
- 상세: `mapHttpErrorLike` 가 4xx http-error 를 처리할 때 원본 메시지는 `this.logger.warn(...)` 으로만 기록된다고 주석으로 명시되어 있다. 테스트에서 `logger.warn` 이 호출됐는지 검증하지 않으므로, 로깅 경로가 실수로 제거되어도 테스트는 통과한다.
- 제안: `GlobalExceptionFilter` 인스턴스를 생성할 때 logger 를 mock 으로 교체하거나 spy 를 주입해 `logger.warn` 이 원본 메시지(`'request entity too large'`)와 함께 호출됐는지 단언하는 케이스를 추가할 수 있다. 보안 감사 가시성 요구사항을 테스트 계층에서 고정하는 효과가 있다.

### [INFO] `client-ip.spec.ts` — 새로 추가된 두 케이스의 `afterEach` 환경 복원 스코프 확인
- 위치: `/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` 라인 357~370
- 상세: 새로 추가된 두 테스트(`'empty/whitespace cf-connecting-ip → falls back to XFF'`, `'whitespace-only XFF → null'`)는 `describe('extractClientIpFromHeaders')` 블록 내에 있고, 해당 블록에는 `afterEach` 가 `process.env.TRUST_CF_CONNECTING_IP` 를 복원한다. 첫 번째 새 케이스는 `process.env.TRUST_CF_CONNECTING_IP = 'true'` 를 설정하므로 복원 경로가 올바르게 커버된다. 두 번째 케이스는 env 를 변경하지 않으므로 격리 측면에서도 문제없다.
- 제안: 현 구조 유지. 테스트 격리는 적절하다.

### [INFO] `public-webhook-throttle.guard.spec.ts` — `extractClientIp` 이관 후 Guard 내 공유 코어 위임 경로 테스트 유지 확인
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` diff 라인 596~621
- 상세: 기존 Guard spec 에 있던 `extractClientIp` 직접 단위 테스트 4건이 제거되고 `auth/utils/client-ip.spec.ts` 의 `extractClientIpFromHeaders` 테스트로 이관된 것은 사본 drift 를 막는 올바른 리팩터 방향이다. Guard 수준에서는 CF 헤더 우선 케이스(`TRUST_CF_CONNECTING_IP=true` 시 `consumeStart('1.1.1.1')`)와 플래그 off 시 XFF 사용 케이스가 integration 테스트로 유지되고 있어 Guard 의 실제 동작은 커버된다.
- 제안: 해당 없음.

### [INFO] `public-webhook-throttle.guard.spec.ts` — `logger.error` 로 업그레이드된 fail-open 경고 검증 누락
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` diff 라인 953~957
- 상세: `trigger 조회 실패 → fail-open` 케이스에서 로그 레벨이 `warn` 에서 `error` 로 변경되었다. 현재 `'trigger 조회 실패 → fail-open(통과)'` 테스트는 `resolves.toBe(true)` 만 검증하고 `logger.error` 호출 여부는 검증하지 않는다. 로그 레벨 업그레이드가 무관 회귀로 제거되어도 테스트는 통과하므로 모니터링 알람 보장이 테스트로 고정되지 않는다.
- 제안: `PublicWebhookThrottleGuard` 생성 시 Logger 를 mock 으로 주입하거나 `jest.spyOn`으로 `logger.error` 를 감시해, fail-open 케이스에서 `logger.error` 가 1회 이상 호출됐음을 단언하는 테스트를 추가한다.

### [WARNING] `http-exception.filter.ts` — `mapHttpErrorLike` 4xx 분기 메시지 하드코딩에 대한 테스트 커버리지 갭
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` 라인 178~182
- 상세: `errStatus === 413` 조건문으로 메시지가 분기되는 새 로직은 413 케이스만 테스트로 검증된다. 비-413 4xx 분기(`'The request could not be processed.'`)는 spec 상 "향후 http-errors 미들웨어 추가에도 안전"을 보장해야 하는 코드이지만, 현재 테스트에서 해당 분기가 도달 가능한지조차 확인되지 않는다. 구현 주석에서 "현재 도달 경로는 body-parser 413 뿐"이라고 명시하고 있어 현재로서는 데드 코드에 가깝지만, 향후 확장 시 의도치 않은 메시지 변경이 무방비 상태가 된다.
- 제안: `{ status: 404 }`, `{ status: 400 }` 등 비-413 4xx `Error` 오브젝트를 `GlobalExceptionFilter.catch()` 에 전달해 `body.error.message` 가 `'The request could not be processed.'` 인지 검증하는 케이스를 추가한다.

## 요약

이번 변경에서 핵심 보안 동작(CWE-209 메시지 마스킹)에 대한 단언이 명확히 추가되었고, `extractClientIp` 함수의 테스트를 공유 코어(`extractClientIpFromHeaders`)로 통합한 것은 사본 drift 를 제거하는 바람직한 리팩터다. Guard 수준의 IP 추출 integration 케이스도 유지되어 기능 회귀는 방지된다. 다만 `mapHttpErrorLike` 의 비-413 4xx 메시지 분기, `logger.warn`/`logger.error` 호출 보장 등 보안 및 운영 가시성과 직결된 코드 경로의 단언이 없어 이 경로들이 조용히 깨질 수 있다. 비-413 4xx 분기는 현재 데드 코드에 가깝지만 미래 확장 대비 테스트로 고정할 것을 권장한다.

## 위험도

LOW

---

STATUS: PASS
