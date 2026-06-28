# 아키텍처(Architecture) 리뷰

## 발견사항

### **[INFO]** `consumeStart` 시그니처가 IP 와 sentinel 을 구분하지 않음 — 추상화 경계 약화
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` line 73, 164
- **상세**: `consumeStart(ip: string)` 은 매개변수명 `ip` 가 실제 IP 주소임을 암시하지만, 이제 `UNIDENTIFIED_IP_BUCKET = '__no_client_ip__'` sentinel 도 동일 시그니처로 수용한다. 파라미터 타입이 `string` 으로 열려 있어 호출부가 임의 문자열을 전달할 수 있으며, sentinel 을 오·남용하거나 미래에 새로운 버킷을 임의 추가하는 경로가 열린다. 단일 책임 관점에서 "IP 검증 책임"이 서비스 내부로 들어와야 할 수도 있고, 인터페이스 분리 관점에서 per-IP 경로와 sentinel 경로를 명시적으로 구분하는 타입이 부재하다.
- **제안**: 현 규모에서는 허용 가능한 실용적 타협이므로 즉각적 리팩터링은 불필요하다. 다만 `ip` 파라미터를 `ipOrBucket: string` 또는 `clientKey: string` 으로 이름을 변경하고, JSDoc 에 "허용 값: 유효 IPv4/IPv6 문자열 또는 `UNIDENTIFIED_IP_BUCKET`" 을 명시하면 추상화 경계가 명확해진다. 장기적으로는 `type ClientBucket = string & { readonly __brand: 'ClientBucket' }` 브랜드 타입으로 타입-안전성을 강화할 수 있다.

---

### **[INFO]** Guard 가 sentinel 상수를 직접 import — Guard/Service 간 결합도 소폭 증가
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` line 16-18
- **상세**: `PublicWebhookThrottleGuard` 가 `PublicWebhookQuotaService` 뿐 아니라 `UNIDENTIFIED_IP_BUCKET` 도 직접 import 한다. sentinel 값이 서비스의 구현 세부사항(Redis 키 접두어 전략)에 묶여 있는데, 그 결정이 guard 레이어로 누출된다. guard 는 "IP 를 모를 때 어떤 버킷 키를 쓸지"를 알 필요가 없으며, 이는 quota service 의 내부 정책이다.
- **제안**: `PublicWebhookQuotaService` 에 `consumeStartForUnidentified(): Promise<...>` 메서드를 추가하거나, `consumeStart(ip: string | null)` 로 null 을 허용하고 서비스 내부에서 sentinel 로 변환하면 guard 는 sentinel 상수를 알 필요가 없어진다. 단, 현재 구조도 동일 모듈 내(hooks 모듈) 결합이므로 실질적 위험은 낮다. null-허용 오버로드가 더 의미상 자연스러운 API 다.

---

### **[INFO]** 단일 공유 버킷의 한도가 per-IP 한도와 동일 — 운영 확장성 고려 사항
- **위치**: `public-webhook-quota.service.ts` line 79-98 (consumeStart 로직)
- **상세**: `UNIDENTIFIED_IP_BUCKET` 으로 묶인 모든 미식별 요청이 분당 10, 시간당 20 의 동일 고정 한도를 공유한다. 정상적인 배포 환경(프록시/CDN 정상 구성)에서는 미식별 트래픽이 매우 적어 문제없으나, 대규모 헤더-제거 공격 시나리오가 아닌 **레거시/직접 연결 클라이언트가 다수 존재하는 환경** 에서는 정상 클라이언트를 불합리하게 한도 초과시킬 수 있다. plan 문서는 이 한도가 "보수적(conservative)"임을 명시했으나, 설정으로 튜닝할 수 없다.
- **제안**: config 에 `publicWebhook.unidentifiedBucketMultiplier` 같은 배율 설정을 추가하거나, `consumeStart` 에서 sentinel 여부를 감지해 별도 한도(`unidentifiedStartupPerMinute`)를 적용할 수 있다. 현재 범위 경계(범위 경계 §4 가용성 철학)에서 배제된 것으로 보이므로 INFO 수준 이월 항목이다.

---

### **[INFO]** `PublicWebhookReqShape` 확장 필드가 `any`-계열 런타임 프로퍼티 첨부로 구현됨
- **위치**: `public-webhook-throttle.guard.ts` line 83, 159-174
- **상세**: `req.__publicWebhookTrigger = trigger` 는 NestJS `Request` 객체에 런타임으로 프로퍼티를 첨부하는 패턴이다. 타입 안전성을 위해 `PublicWebhookReqShape` 인터페이스가 정의되어 있어 동일 모듈 내에서는 안전하게 사용되지만, 이 패턴은 NestJS `ExecutionContext` 레이어 책임 경계를 Guard 가 침범하는 형태다(Guard → Controller/Service 간 사이드채널). 이는 이번 PR 의 변경 사항이 아니라 기존 W14 결정이므로 이번 변경과 독립적이다.
- **제안**: 중장기적으로 `REQUEST` scope provider 나 `AsyncLocalStorage` 기반 컨텍스트 전파로 교체하면 레이어 경계가 명확해진다. 현재 변경에서는 기존 패턴을 그대로 유지했으므로 문제 없음.

---

## 요약

이번 변경은 `PublicWebhookThrottleGuard` 의 `if (!ip) return true` fail-open 취약점을 `UNIDENTIFIED_IP_BUCKET` sentinel 패턴으로 강화하는 작은 범위의 보안 패치다. 아키텍처 관점에서 핵심 결정(socket 폴백 기각, fail-closed 기각, 단일 공유 버킷 완화)은 기존 Rationale(1-auth §2.3.B, 4-security §4 R3)과 일관성이 있으며, Guard·Service·Quota 계층의 책임 분리도 잘 유지되고 있다. 주요 개선 여지는 두 가지다: (1) sentinel 상수가 service 내부 결정임에도 guard 레이어로 누출된 결합도, (2) `consumeStart` 파라미터가 IP 와 sentinel 을 구분하지 않아 추상화 경계가 약해진 부분. 두 사항 모두 동일 모듈 내 결합이고 변경 범위가 작아 즉각적인 리팩터링 압력은 낮다. 테스트 커버리지(sentinel 충돌 검증, consumeStart 공유 버킷 누적, 429 반환)는 설계 의도를 적절하게 검증한다.

## 위험도

LOW

STATUS: SUCCESS
