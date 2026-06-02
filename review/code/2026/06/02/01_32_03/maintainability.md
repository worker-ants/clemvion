# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `extractClientIp` 함수 중복 — hooks.service.ts 동명 헬퍼와 동일 정책
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 하단 파일-레벨 함수 `extractClientIp`
- 상세: 파일 내 주석("hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보.")이 중복 사실을 인식하고 있음. IP 추출 로직(`cf-connecting-ip` → `x-forwarded-for` 첫 항목)이 두 파일에 분산되어 있어, 헤더 우선순위 정책 변경 시 두 곳을 함께 수정해야 한다.
- 제안: `codebase/backend/src/common/utils/http.ts` 등 공용 util 모듈로 추출하고 두 사용처에서 import. 주석의 "추후 후보"를 실제 이동으로 전환 권장.

---

### [INFO] `PublicWebhookQuotaService` 생성자 — Redis 초기화 분기 흐름이 길고 early-return 이 3개
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 생성자(~271~320 라인)
- 상세: 생성자에서 `injectedRedis` 확인 → `configService` 존재 확인 → `host/port` 확인 → 인스턴스 생성 순서로 early-return 이 세 번 발생한다. 각 분기의 의미는 명확하지만 책임(config 로부터 Redis 연결 생성)이 생성자에 집중되어 있다. 테스트에서도 생성자에 Redis 를 직접 주입해야 해서 구성이 복잡하다.
- 제안: 현재 크기(~50줄)는 수용 가능하나, 향후 TLS/auth 옵션이 추가되면 private static `createRedis(configService)` 팩터리 메서드로 분리를 고려.

---

### [INFO] `PublicWebhookThrottleGuard` — `canActivate` 의 인라인 요청 타입 선언
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 ~632~637
- 상세: `context.switchToHttp().getRequest<{ params?: ...; headers?: ...; body?: ...; rawBody?: Buffer; }>()` 에서 동일 형태가 Guard 코드에 인라인으로 선언되어 있다. 테스트 파일(`public-webhook-throttle.guard.spec.ts`)에서도 동일한 `ReqShape` 인터페이스를 별도로 정의한다.
- 제안: `ReqShape` 인터페이스를 guard 파일 상단 또는 공용 타입 파일에 내보내고, 테스트에서 import 해 사용하면 계약이 한 곳에서 관리됨.

---

### [INFO] 매직 넘버 — Swagger 설명에 `32KB` 하드코딩
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` `@ApiPayloadTooLargeResponse` description
- 상세: `static readonly DEFAULT_MAX_BODY_BYTES = 32 * 1024` 상수는 적절하게 정의되어 있으나, Swagger 응답 설명(`'공개 webhook body 크기 초과(32KB)'`)에 동일 값이 리터럴 문자열로 중복된다. 상수 값 변경 시 이 설명을 별도로 수정해야 한다.
- 제안: 컨트롤러는 정적 컨텍스트라 완전 해소는 어렵지만, 비고로 인식하고 상수 변경 시 함께 갱신하는 관행을 주석으로 남기거나 설명을 단위 비표시(`제한 초과`)로 단순화.

---

### [INFO] Redis 윈도우 시간 리터럴 `60`, `3600` — 명명된 상수 부재
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` `consumeStart` 메서드 내 `incrWithWindow` 호출
- 상세: `this.incrWithWindow(\`wh:rl:min:${ip}\`, 60)` 와 `this.incrWithWindow(\`wh:rl:hour:${ip}\`, 3600)` 에서 윈도우 크기가 리터럴로 사용됨. 의미는 충분히 유추 가능하나, 정책 변경 시 실수가 줄어들고 의도가 더 명확해진다.
- 제안: `private static readonly MINUTE_WINDOW_SEC = 60;` / `private static readonly HOUR_WINDOW_SEC = 3600;` 상수 추가.

---

### [INFO] `applyResize` — 내부 `toCss` arrow function 이 메서드 호출마다 재선언
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` `applyResize` private 메서드
- 상세: `const toCss = (v: number | string | undefined): string | undefined => { ... }` 가 메서드 내부에서 매 호출마다 재선언된다. 로직은 간단하고 성능 영향은 무시 수준이나, 동일 변환이 다른 메서드에 필요해질 경우 재사용이 어렵다.
- 제안: 현 크기에서는 수용 가능. 사용처가 늘면 파일-레벨 순수 함수 또는 private 메서드로 추출 권장.

---

### [INFO] 테스트 `public-webhook-quota.service.spec.ts` — `last` 변수 타입이 서비스 반환 타입과 느슨하게 연결됨
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.spec.ts` 라인 ~175
- 상세: `let last = { allowed: true, reason: null as string | null }` 초기값으로 타입을 추론하는 방식은 기능적으로 맞지만, 서비스 반환 타입이 변경될 때 테스트가 자동으로 타입 오류를 내지 않는다.
- 제안: `Awaited<ReturnType<PublicWebhookQuotaService['consumeStart']>>` 를 명시적으로 사용하거나, 서비스에서 반환 타입을 export 해 테스트가 참조하도록 하면 변경 추적성 향상.

---

## 요약

이번 변경은 공개 webhook 남용 방어(`PublicWebhookQuotaService` + `PublicWebhookThrottleGuard`)와 웹채팅 SDK의 `on()`/`off()`/`wc:resize`/전역명 충돌 방지 기능을 추가한다. 전반적으로 코드 의도가 명확하고 네이밍이 일관적이며, Redis 미가용 시 fail-open 정책이 주석과 코드 모두에 명시되어 가독성이 높다. 함수 길이는 대부분 적절하고 중첩 깊이도 과도하지 않다. 주요 유지보수 관심사는 (1) `extractClientIp` 헬퍼가 두 파일에 중복 정의된 점(이미 주석에서 인식하고 있으나 미이동), (2) Redis 윈도우 시간(60/3600)이 리터럴로 남은 점이며, 모두 INFO 수준으로 기능 정확성에는 영향이 없다. 테스트 커버리지는 각 경계 조건(fail-open, 한도 초과, IP 미식별, DB 오류 등)을 고루 다루고 있어 회귀 방어 측면에서 긍정적이다.

## 위험도

LOW
