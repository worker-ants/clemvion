# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: channel-web-chat-followups (backend throttle guard + frontend SDK API 보강)
리뷰 일시: 2026-06-02

---

## 발견사항

### [INFO] PublicWebhookThrottleGuard 가 Trigger Repository 에 직접 의존 — 레이어 경계 경미 노출
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (constructor, `@InjectRepository(Trigger)`)
- 상세: Guard 는 일반적으로 인프라 결정(공개/비공개 여부 판정)을 서비스에 위임하는 것이 권장된다. 현재 구조에서 Guard 가 `Repository<Trigger>` 를 직접 주입받아 DB 쿼리를 수행하므로, 프레젠테이션 레이어(Guard/Controller)에서 데이터 레이어(TypeORM Repository)를 직접 참조하는 구조다. 클래스 주석에 "이중 책임 회피"를 위해 의도적으로 선택했음이 명시되어 있고, trigger 미존재 시 HooksService 에 위임하는 설계도 합리적이다. 다만 향후 trigger 공개/비공개 판정 로직이 복잡해질 경우(예: per-workspace 정책, auth config 종류별 분기) Guard 가 비즈니스 판정 복잡도를 흡수하게 되는 확장성 위험이 있다.
- 제안: 현재 단순 `authConfigId IS NULL` 판정 수준에서는 허용 가능. 향후 판정 로직 복잡화 시 `HooksService` 또는 별도 `WebhookPolicyService` 에 `isPublicTrigger(endpointPath): Promise<boolean | null>` 를 위임하는 구조로 전환을 검토한다.

### [INFO] PublicWebhookQuotaService 가 Redis 커넥션을 직접 생성 — 의존성 역전 부분 적용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` (constructor, `new Redis(...)`)
- 상세: `@Inject('PUBLIC_WEBHOOK_QUOTA_REDIS')` 토큰으로 외부 주입 경로를 열어두었고 테스트에서 fake Redis 를 주입하는 구조(의존성 역전 부분 준수)는 올바르다. 그러나 프로덕션 코드에서 토큰 주입 없이 configService 로부터 직접 `new Redis(...)` 를 생성하는 경로가 constructor 안에 공존한다. 이 패턴은 ApplicationModule 혹은 전용 provider factory 로 Redis 인스턴스를 생성해 주입하는 방식과 비교하면 DI 컨테이너 외부에서 의존성이 생성되는 구조다. 향후 Redis 연결 설정이 여러 서비스에 분산될 경우 중복 생성 위험이 있다.
- 제안: 현재 범위(단일 서비스)에서는 허용 가능. 장기적으로 `CacheModule` 또는 공용 `RedisModule`(커넥션 팩토리)을 도입해 Redis 인스턴스를 단일 소스로 주입받는 구조로 통합을 검토한다.

### [INFO] extractClientIp 헬퍼가 hooks.service.ts 와 중복 — 공용 유틸 추출 후보
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 하단 module-scoped 함수 (`extractClientIp`)
- 상세: 코드 주석에 "hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보" 라고 명시되어 있다. 동일 모듈 내 동명 로직 중복은 DRY 위반이고, IP 추출 우선순위(`cf-connecting-ip` > `x-forwarded-for`)가 향후 한 쪽에서만 변경될 경우 정책 불일치가 발생한다.
- 제안: `codebase/backend/src/common/utils/extract-client-ip.ts` 등 공용 위치로 추출하거나 최소한 `hooks/` 모듈 내 `utils.ts` 로 단일화한다. 동작 검증은 현재 테스트에서 충분히 이루어지고 있으므로 단순 이동으로 해소 가능하다.

### [INFO] WidgetBridge.off() 와 ChatInstance.off() 의 인터페이스 계약이 타입-완전하게 연결됨 — 긍정적 패턴
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts`, `codebase/packages/web-chat-sdk/src/types.ts`, `codebase/packages/web-chat-sdk/src/index.ts`
- 상세: `on()` 이 `Unsubscribe` 를 반환하고 `off(event, cb?)` 를 별도로 제공하며, `ChatInstance` 인터페이스에 두 계약이 모두 명시된 구조는 Observer 패턴의 올바른 구현이다. `WidgetBridge` 내 `listeners` Map 의 Set 기반 관리(`set.size === 0` 시 Map 엔트리 삭제)는 메모리 누수 방지를 명시적으로 처리하고 있다. SPA 언마운트 cleanup 시나리오에 대한 아키텍처 완결성이 높다.
- 제안: 추가 조치 불필요.

### [INFO] loader.ts installGlobal 의 globalName 파라미터화 — 개방-폐쇄 원칙 준수
- 위치: `codebase/packages/web-chat-sdk/src/loader.ts` (`installGlobal` 함수 시그니처), `codebase/packages/web-chat-sdk/src/loader-entry.ts`
- 상세: `installGlobal` 에 `globalName: string = DEFAULT_GLOBAL_NAME` 파라미터를 추가하고 `loader-entry.ts` 에서 `document.currentScript.dataset.global` 로 재지정 가능하게 한 설계는 기존 `installGlobal` 계약을 파괴하지 않으면서 확장 지점을 추가한 OCP 준수 사례다. 점유 가드(비-함수 전역 덮어쓰기 금지)까지 추가하여 호스트 전역 네임스페이스 오염을 방어한 것도 적절하다.
- 제안: 추가 조치 불필요.

### [WARNING] PublicWebhookThrottleGuard 가 Guard 책임 외에 body 크기 측정 로직을 포함 — 단일 책임 경미 위반
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (`measureBodyBytes` private 메서드, `rawBody / body` 양방향 처리)
- 상세: Guard 의 주 책임은 "요청을 통과시킬지 거부할지" 결정이며 rate-limit 체크가 핵심이다. `measureBodyBytes` 는 `rawBody` 우선, 없으면 `JSON.stringify` 추정이라는 별도 계산 로직을 내포한다. 이 계산은 NestJS 의 `bodyParser` 설정 레벨(예: `app.use(express.json({ limit: '32kb' }))`)에서 처리하는 것이 레이어 책임상 더 자연스럽다. 현재 Guard 에서 처리하는 이유는 trigger 의 공개/비공개 여부를 먼저 판정한 뒤 공개 webhook 에만 body 제한을 적용해야 하기 때문이며, 미들웨어 레벨에서는 해당 맥락 정보가 없어 blanket 적용만 가능하다는 현실적 제약이 있다. 따라서 Guard 내 처리는 현 아키텍처 제약 내에서 합리적인 선택이지만, 메서드 단위 분리(`private measureBodyBytes`)를 유지해 이 책임이 명확히 분리되어 있는 것은 긍정적이다.
- 제안: 현재 구조 유지 가능. 미들웨어 레벨에서 Content-Length 헤더 기반 조기 차단(공개 endpoint 에 한정)이 가능하다면 Guard 에서 body 크기 계산 책임을 제거할 수 있음을 중장기 리팩터링 후보로 기록한다.

### [INFO] HooksModule 에 Provider 로만 등록된 PublicWebhookThrottleGuard — exports 없음 (의도적)
- 위치: `codebase/backend/src/modules/hooks/hooks.module.ts`
- 상세: `PublicWebhookThrottleGuard` 와 `PublicWebhookQuotaService` 가 `providers` 에만 등록되고 `exports` 에 없는 것은 이 기능이 `hooks` 모듈 내부에서만 사용되는 것을 명확히 경계화한 것이다. 모듈 경계가 명확하고 응집도가 높다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 두 가지 독립적인 아키텍처 변경을 포함한다. 백엔드의 `PublicWebhookThrottleGuard` + `PublicWebhookQuotaService` 조합은 기존 `HooksService` 와 `HooksController` 의 책임을 변경하지 않고 Guard 레이어를 삽입하는 방식으로 OCP 를 준수했으며, Redis fail-open 정책과 trigger 미존재 시 통과 설계로 인프라 장애 내성이 충분히 고려되었다. 프론트엔드 SDK 의 `off()` / `Unsubscribe` 반환 / `wc:resize` 처리 보강은 Observer 패턴을 타입-완전하게 완성하며, `loader.ts` 의 globalName 파라미터화는 OCP 를 준수한 확장이다. 주요 아키텍처 위험 요소는 Guard 가 Repository 를 직접 의존하는 레이어 경계 노출(INFO 수준, 현 복잡도에서 허용)과 `extractClientIp` 로직 중복(DRY 위반, 공용 유틸 추출 권장)이며, body 측정 로직의 Guard 내 포함은 현 아키텍처 제약 내에서 합리적인 선택으로 WARNING 수준이다. 순환 의존성 없음, 모듈 경계 명확, 확장성 측면에서 전체적으로 양호한 구조다.

---

## 위험도

LOW
