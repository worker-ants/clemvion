# Testing Review

## 발견사항

### [INFO] `PublicWebhookQuotaService` — hourly 한도 초과 테스트의 분당 카운터 리셋 방식이 구현 내부 구조에 의존
- **위치**: `public-webhook-quota.service.spec.ts` L182-194 ("시간당 누적 초과" 케이스)
- **상세**: 테스트가 `store.set('wh:rl:min:ip-c', 0)`으로 fake Redis 내부 `store` Map을 직접 조작해 분당 카운터를 초기화한다. 이 방식은 Redis key 이름 포맷(`wh:rl:min:<ip>`)에 직접 의존하므로 key 포맷이 변경되면 테스트가 silently 오통과(false-pass)할 수 있다.
- **제안**: key 포맷 상수를 서비스에서 export해 테스트가 그 상수를 참조하도록 변경하거나, test-only 헬퍼로 window 만료를 시뮬레이션하는 방법으로 교체. 현재 동작상 문제는 없으나 취약한 결합.

### [INFO] `PublicWebhookQuotaService` — `hourlyNewMax` config override 테스트 누락
- **위치**: `public-webhook-quota.service.spec.ts` L204-217
- **상세**: 마지막 "config override" 테스트는 `startupPerMinute`만 오버라이드하고 `hourlyNewMax` 오버라이드는 검증하지 않는다. 두 설정값이 각각 독립적으로 동작함을 보장하려면 `hourlyNewMax` 오버라이드 케이스도 필요하다.
- **제안**: `hourlyNewMax` config key(`publicWebhook.hourlyNewMax`) 오버라이드 + 시간당 초과 경로 테스트 케이스를 추가.

### [INFO] `PublicWebhookQuotaService` — `onModuleDestroy` quit 경로 미테스트
- **위치**: `public-webhook-quota.service.spec.ts` 전체
- **상세**: `onModuleDestroy()`가 Redis가 있을 때 `quit()`를 호출하고, quit 예외를 catch로 흡수하는 두 경로가 테스트에 없다. quit 실패 시 로그 없이 무시하는 "best-effort" 동작이 의도대로 throw하지 않는지 검증하지 않는다.
- **제안**: `onModuleDestroy` 호출 시 `quit` 정상·예외 두 케이스 테스트 추가.

### [WARNING] `PublicWebhookThrottleGuard` — `measureBodyBytes` 분기 커버리지 갭
- **위치**: `public-webhook-throttle.guard.spec.ts` 전체 / `public-webhook-throttle.guard.ts` L696-707
- **상세**: `measureBodyBytes` 내부에는 (1) rawBody 있음, (2) body=null/undefined, (3) body=string, (4) body=Object, (5) JSON.stringify 예외(직렬화 불가) 다섯 경로가 있다. 테스트는 rawBody 있음(413 케이스)과 body=Object(한도 내 통과 케이스)만 간접적으로 검증한다. `body=null`, `body=string`, 직렬화 불가 예외 경로는 미커버.
- **제안**: 아래 케이스를 guard spec에 추가:
  - `body: null` → bodyBytes=0 → 통과
  - `body: "string payload"` → byteLength 계산 경로
  - 직렬화 불가 객체(순환 참조) → `measureBodyBytes` 반환 0 → 통과

### [INFO] `PublicWebhookThrottleGuard` — IP 추출 로직(`extractClientIp`)의 엣지 케이스 미테스트
- **위치**: `public-webhook-throttle.guard.spec.ts` L545-556 (cf-connecting-ip 케이스)
- **상세**: `x-forwarded-for` 다중 IP 시나리오(예: `"1.2.3.4, 5.6.7.8"`) — 첫 번째 항목만 추출하는지, 빈 문자열 값의 cf-connecting-ip 헤더가 있을 때 fallback 동작(trim 후 falsy → xff 사용)이 올바른지 검증하지 않는다.
- **제안**: `x-forwarded-for: "1.2.3.4, 5.6.7.8"` → consumeStart 인자가 `"1.2.3.4"` 인 케이스, `cf-connecting-ip: "  "` (공백) + xff 있음 → xff 사용 케이스 추가.

### [INFO] `PublicWebhookThrottleGuard` — `maxBodyBytes` config override 경로 미테스트
- **위치**: `public-webhook-throttle.guard.spec.ts` 전체
- **상세**: guard 생성자가 `configService.get('publicWebhook.maxBodyBytes')`로 한도를 오버라이드하는 경로가 있으나, 테스트는 항상 `configService` 없이 인스턴스를 만들어 기본값(`DEFAULT_MAX_BODY_BYTES`)만 검증한다.
- **제안**: 작은 `maxBodyBytes`를 주입한 guard로 한도 초과·미만 케이스를 검증하는 테스트 추가.

### [INFO] `WidgetBridge.applyResize` — `state` 필드 누락 시 `dataset.wcState` 미변경 검증 없음
- **위치**: `bridge.spec.ts` L948-972 (wc:resize 테스트 블록)
- **상세**: `applyResize` 테스트는 정상 케이스(숫자/문자열 값)와 payload 누락 케이스만 다룬다. `state` 필드가 없을 때 `dataset.wcState` 미변경(또는 빈 문자열 방지)을 검증하지 않는다. 또한 spec의 `WcResizePayload.state`가 `'collapsed' | 'expanded'` 유니온이지만 런타임에 잘못된 값이 들어올 때 guard가 없다.
- **제안**: `state` 누락 시 `dataset.wcState` 가 변경되지 않음을 확인하는 케이스 추가.

### [INFO] `installGlobal` — boot 예외 발생 시 큐 replay 계속 진행 여부 미검증
- **위치**: `loader.spec.ts` L131-237 (installGlobal 블록)
- **상세**: 신규 테스트("data-global 커스텀 전역명", "점유 가드")는 전역명 분기를 잘 다루나, 큐 항목 replay 중 boot 콜백이 실행 예외를 던질 때 이후 항목이 계속 실행되는지 검증하지 않는다.
- **제안**: 큐에 예외를 내는 boot 항목 다음에 open 항목을 두어, open이 여전히 실행됨을 검증하는 케이스 추가.

### [INFO] `loader.ts` `off` case — boot 전 `off` 호출 시 동작 미테스트
- **위치**: `loader.spec.ts` L193-200 ("off 위임" 테스트)
- **상세**: 테스트는 boot 후에 off를 호출하는 케이스만 검증한다. `instance`가 아직 null일 때(`instance?.off(...)` — optional chaining) off 호출이 조용히 무시되는지 검증하지 않는다.
- **제안**: boot 없이 off를 호출해도 throw하지 않음을 검증하는 케이스 추가.

### [WARNING] `PublicWebhookThrottleGuard` — NestJS DI 컨텍스트 통합 테스트 없음
- **위치**: `hooks.controller.ts` / `hooks.module.ts` 변경
- **상세**: Guard가 `@UseGuards(PublicWebhookThrottleGuard)`로 컨트롤러에 선언됐고 Module에 provider로 등록됐지만, 이 연결이 실제 NestJS DI 컨텍스트에서 올바르게 동작하는지 검증하는 통합 테스트(e2e 또는 `createTestingModule`)가 없다. Unit 테스트는 Guard 클래스를 직접 인스턴스화하므로 NestJS Guard 체계와 DI 주입 경로(`@InjectRepository(Trigger)`, `PublicWebhookQuotaService` 주입)를 검증하지 않는다.
- **제안**: `HooksModule`을 `createTestingModule`로 부트스트랩하거나, 기존 hooks e2e 테스트에 공개 webhook 한도 초과 케이스(429)를 추가.

## 요약

전반적인 테스트 커버리지 수준은 양호하다. `PublicWebhookQuotaService`는 핵심 경로(분당/시간당 한도, fail-open, config override)를 잘 커버하며, `PublicWebhookThrottleGuard`도 주요 분기(trigger 없음, 인증 webhook, 공개 webhook 통과/차단, body 초과, IP 없음, DB 오류)를 망라한다. SDK 쪽(`bridge.spec.ts`, `loader.spec.ts`, `index.spec.ts`)도 신규 `off()`/`wc:resize`/전역명 충돌 방지 기능에 대한 테스트를 적절히 추가했다. 주요 갭은 두 가지다: (1) Guard의 `measureBodyBytes` 내부 분기 중 null body·string body·직렬화 불가 경로가 미커버이며, (2) NestJS Module/Guard 등록 연결을 실제 DI 컨텍스트에서 검증하는 통합 테스트가 없어 `@UseGuards`·`@InjectRepository` 연결이 런타임에서만 검증된다. 나머지 발견사항은 테스트 내부 구조의 취약한 결합(Redis key 포맷 직접 조작) 또는 부가 경계값 케이스이며 기존 동작에는 영향 없다.

## 위험도

LOW
