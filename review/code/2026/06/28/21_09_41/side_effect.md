# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `UNIDENTIFIED_IP_BUCKET` 신규 모듈-레벨 export — 공개 API 확장
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` (diff line +112)
- 상세: `UNIDENTIFIED_IP_BUCKET = '__no_client_ip__'` 가 모듈 최상위 `export const` 로 추가된다. 기존 `makeMinKey` / `makeHourKey` / `MINUTE_WINDOW_SEC` / `HOUR_WINDOW_SEC` 와 동일한 공개 API 레벨이다. 문자열 상수이므로 런타임 부작용은 없고, 값이 변경되지 않는 한 하위 호환성도 유지된다. Redis 키 네임스페이스(`wh:rl:min:__no_client_ip__`)가 로그·메트릭 시스템에서 유효 IPv4/IPv6 가 아닌 값으로 나타날 수 있으나, 이는 의도된 sentinel 버킷이며 기존 IP 키와 구별된다. 별도 조치 불필요.
- 제안: 없음 (이미 JSDoc 에 sentinel 포함 가능 명시됨).

### [INFO] `consumeStart(ip: string)` 시그니처 — 비호환 변경 없음
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` — 시그니처 불변
- 상세: `consumeStart` 의 파라미터 타입·반환 타입·이름은 변경되지 않았다. JSDoc 에 `@param ip` 설명이 추가되었을 뿐이다. 기존 호출자(`PublicWebhookThrottleGuard.canActivate`)는 영향받지 않는다.
- 제안: 없음.

### [INFO] guard 행동 변경 — `if (!ip) return true` 제거로 인한 동작 변화
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (diff line -212 / +222~225)
- 상세: 이전에는 IP 미식별 시 guard 가 즉시 `true` 를 반환해 `this.quota.consumeStart()` 를 호출하지 않았다. 변경 후에는 `UNIDENTIFIED_IP_BUCKET` sentinel 로 `consumeStart` 가 반드시 호출된다. 이로 인해 미식별 트래픽이 Redis `wh:rl:min:__no_client_ip__` / `wh:rl:hour:__no_client_ip__` 키에 카운트 누적된다. 이 동작은 설계 의도(무제한 우회 → 유한 상한)이므로 의도치 않은 부작용이 아니나, Redis 가 이 키에 대해 INCR/EXPIRE 를 추가로 실행하게 되어 Redis 쓰기 빈도가 증가한다. 미식별 요청이 없는 정상 배포에서는 변화 없고, 헤더 없이 접근하는 클라이언트가 존재하는 경우 Redis 키 1개가 추가 생성된다.
- 제안: 모니터링 대시보드에서 `wh:rl:min:__no_client_ip__` 키를 "미식별 버킷"으로 별도 레이블링하면 운영 가시성이 향상된다. 기능 부작용은 아님.

### [INFO] `??` 연산자 도입 — `null` / `undefined` 양쪽 처리
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (diff line +225)
- 상세: `extractClientIpFromHeaders(...)` 의 반환 타입이 `string | null | undefined` 인 경우, `?? UNIDENTIFIED_IP_BUCKET` 는 `null` 과 `undefined` 를 모두 sentinel 로 대체한다. 이전 `if (!ip) return true` 는 빈 문자열(`''`)도 falsy 로 처리했으나, `??` 는 빈 문자열을 그대로 통과시킨다. `extractClientIpFromHeaders` 가 빈 문자열을 반환하지 않는다면 동작이 동일하다.
- 제안: `extractClientIpFromHeaders` 의 반환 타입을 확인해 빈 문자열 반환 가능성이 없는지 확인하거나, 방어적으로 `(extractClientIpFromHeaders(...) || UNIDENTIFIED_IP_BUCKET)` 로 변경하는 것을 검토. 단, 빈 문자열 반환 가능성이 없다면 현재 구현으로 충분하다.

### [INFO] Redis 키 공간 — 신규 sentinel 키 영구 잔류 가능성
- 위치: `consumeStart(UNIDENTIFIED_IP_BUCKET)` 호출 경로
- 상세: `wh:rl:min:__no_client_ip__` / `wh:rl:hour:__no_client_ip__` 키는 TTL(EXPIRE)이 설정되므로 윈도우 만료 후 자동 삭제된다(`MINUTE_WINDOW_SEC` = 60, `HOUR_WINDOW_SEC` = 3600). 미식별 요청이 지속적으로 들어오면 키가 계속 갱신되어 상시 잔류하지만 이는 설계 의도이며 메모리 누수가 아니다. 단일 공유 버킷이므로 IP 수 증가에 따른 키 폭발도 없다.
- 제안: 없음.

### [INFO] 테스트 파일 — 공유 상태 없음
- 위치: `public-webhook-quota.service.spec.ts`, `public-webhook-throttle.guard.spec.ts`
- 상세: 신규 테스트는 `makeFakeRedis()` 로 격리된 인메모리 저장소를 생성하고, 각 `it` 블록이 독립 인스턴스를 사용한다. 전역 상태 변경이나 파일시스템 부작용이 없다.
- 제안: 없음.

## 요약

이번 변경은 `PublicWebhookThrottleGuard` 에서 IP 미식별 시 즉시 통과(`return true`)하던 경로를 제거하고 `UNIDENTIFIED_IP_BUCKET` sentinel 을 통해 동일 rate-limit 경로로 라우팅하는 단일 행동 변경이다. 부작용 관점에서 가장 주목할 점은 sentinel `??` 연산자와 이전 falsy 체크 간의 빈 문자열 처리 차이이나, `extractClientIpFromHeaders` 가 빈 문자열을 반환하지 않는 한 실질적 차이가 없다. 신규 export 상수는 순수 값 상수로 런타임 부작용이 없고, Redis 키 증가는 설계 의도이며 TTL 에 의해 자동 관리된다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 외부 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
