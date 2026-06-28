# Testing 리뷰 결과

## 발견사항

### [INFO] UNIDENTIFIED_IP_BUCKET sentinel — hourly 한도 초과 케이스 미커버
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-quota.service.spec.ts` (신규 테스트 블록)
- 상세: 신규 추가된 `consumeStart(UNIDENTIFIED_IP_BUCKET)` 테스트는 분당 한도 초과(`reason: 'startup_rate'`) 및 정상 1회 통과만 검증한다. 시간당 누적 상한(`reason: 'hourly_new'`)에 sentinel 이 동일하게 적용되는지 확인하는 케이스가 없다. 기존 IP 에 대한 `시간당 누적 초과` 테스트(line 88-100)와 대칭되는 sentinel 전용 케이스가 비어 있다.
- 제안: `UNIDENTIFIED_IP_BUCKET` 으로 시간당 한도까지 소비해 `reason: 'hourly_new'` 를 받는 케이스를 추가한다. 기존 `ip-c` 패턴(분당 카운터 리셋 후 시간당 누적)을 sentinel 로 재현하면 된다.

### [INFO] guard.spec — IP 미식별 + hourly 한도 초과(reason: 'hourly_new') 테스트 없음
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` (line 187-200)
- 상세: 새로 추가된 429 케이스는 `reason: 'startup_rate'` 만 사용한다. 기존 정상 IP 에 대해 `hourly_new` 429 + `PUBLIC_WEBHOOK_HOURLY_LIMIT` 코드 검증 케이스(line 139-153)가 있으나, sentinel 경로에 대한 동일 검증이 없다. guard 의 error code 분기(`reason === 'hourly_new'` → `PUBLIC_WEBHOOK_HOURLY_LIMIT`)가 sentinel 경로에서도 정상 작동하는지 간접 확인이 안 된다.
- 제안: `consume: { allowed: false, reason: 'hourly_new' }` + `headers: {}` 조합으로 `PUBLIC_WEBHOOK_HOURLY_LIMIT` 코드 확인 테스트를 추가하거나, 기존 hourly 테스트를 sentinel 버전으로 파라미터화한다.

### [INFO] UNIDENTIFIED_IP_BUCKET sentinel — IPv6 주소 비충돌 정규식 미검증
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-quota.service.spec.ts` (line 164-174)
- 상세: sentinel 이 유효 IPv4 표기가 아님을 검증하는 정규식(`/^\d{1,3}(\.\d{1,3}){3}$/`)만 있고 IPv6 패턴(`/^[0-9a-f:]+$/i` 등)과의 비충돌은 테스트하지 않는다. `extractClientIpFromHeaders` 가 IPv6 를 반환할 수 있는 환경에서 sentinel 문자열이 실제 IPv6 와 겹치지 않는다는 보증이 테스트에 없다. `__no_client_ip__` 에는 콜론·16진수가 없으므로 실제 위험은 낮지만 명시적 검증이 없는 상태.
- 제안: sentinel 이 IPv6 패턴과 겹치지 않음을 확인하는 단언을 1줄 추가한다(`expect(/^[0-9a-f:]+$/i.test(UNIDENTIFIED_IP_BUCKET)).toBe(false)`). 필수는 아니나 sentinel 의 설계 의도를 테스트가 명확히 문서화하게 된다.

### [INFO] guard 테스트에서 `__publicWebhookTrigger` 첨부(W14) 가 미식별 경로에서도 동작하는지 미검증
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- 상세: 기존 테스트는 W14(`req.__publicWebhookTrigger` 첨부)를 정상 IP 경로에서 암묵적으로 통과시키지만, `noIp` 요청 객체에 대해 sentinel 경로가 trigger 를 올바르게 첨부했는지 명시적으로 검증하는 케이스가 없다. sentinel 경로도 동일한 `req.__publicWebhookTrigger = trigger` 코드 라인을 통과하므로 실제 동작은 문제없지만 테스트 커버리지 관점에서 공백이다.
- 제안: `noIp` 테스트 중 하나에 `expect((makeContext(noIp).switchToHttp().getRequest() as any).__publicWebhookTrigger).toBeDefined()` 단언을 추가한다.

## 요약

D-12 변경(IP 미식별 fail-open → sentinel 공유 버킷)에 대한 테스트 커버리지는 전반적으로 충분하다. `public-webhook-quota.service.spec.ts` 는 sentinel 상수의 형태 검증과 `consumeStart` 경유 카운터 누적을 확인하며, `public-webhook-throttle.guard.spec.ts` 는 (1) sentinel 호출 여부, (2) 공유 버킷 한도 초과 시 429 를 독립된 케이스로 검증한다. 테스트 격리(beforeEach/afterEach 환경 스냅샷·jest.restoreAllMocks)와 mock 적절성(fake in-memory Redis, quota jest.fn mock)도 양호하다. 다만 sentinel 경로의 `hourly_new` 초과 케이스 및 `PUBLIC_WEBHOOK_HOURLY_LIMIT` 코드 검증이 빠져 있고, IPv6 비충돌 단언과 W14 trigger 첨부 검증이 sentinel 경로에서 명시적으로 이루어지지 않는다. 모두 INFO 수준이며 기존 기능 회귀 위험은 없다.

## 위험도

LOW
