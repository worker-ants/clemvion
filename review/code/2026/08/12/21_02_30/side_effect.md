STATUS=success

===REPORT_MARKDOWN_BELOW===

# 부작용(Side Effect) Review — 멱등 캐시 키 스코프(execution + route)

## 발견사항

- **[INFO]** 배포 시점 기준 구-포맷 Redis 캐시 엔트리가 고아가 된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:115` (`const redisKey = \`${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}\`;`)
  - 상세: 키 포맷이 `interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>` 로 바뀌면서, 배포 직전까지 구 포맷으로 적재된 엔트리는 새 코드가 절대 조회하지 않는 키가 된다. 데이터 오염이나 캐시 오염(다른 execution 응답 재생)은 아니다 — 단지 조회되지 않는 채 기존 TTL(24h)대로 자연 만료된다. 기능적 부작용은 없고 배포 직후 잠깐 "이미 낸 요청의 멱등 재현이 한 번 끊긴다"는 운영상 참고 사항 정도다. CHANGELOG 에는 "클라이언트 영향 없음" 으로만 적혀 있어, 이 전환기 창(구 키 → 신 키 배포 시점)은 별도로 언급돼 있지 않다.
  - 제안: 문서화가 필요하면 CHANGELOG 에 "배포 시점 전후로 발급된 Idempotency-Key 재요청은 캐시 미스로 한 번 재처리될 수 있다"를 한 줄 추가. 코드 변경은 불필요(허용 가능한 트레이드오프).

- **[INFO]** 캐시 키의 `route` 세그먼트가 `context.getHandler().name`(런타임 함수 이름)에 의존한다 — 새로 도입된 암묵적 결합
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113` (`const route = context.getHandler().name;`)
  - 상세: 종전에는 이 인터셉터가 핸들러 메서드 이름을 전혀 읽지 않았다. 이번 변경으로 캐시 키의 정합성이 `InteractionController.interact`/`cancel` 메서드의 **런타임 `Function.name`** 이 소스상의 메서드명과 일치한다는 가정에 의존하게 됐다. 현재 백엔드 빌드(`nest build` → 순수 `tsc`, `nest-cli.json` 확인 — webpack/minifier 미사용)에서는 이름이 보존되므로 실질 위험은 낮다. 다만 향후 빌드 파이프라인이 webpack/terser 등으로 바뀌어 함수명 mangling 이 켜지면 `route` 값이 조용히 달라져 캐시 네임스페이스가 예기치 않게 갈릴 수 있다(데이터 오염은 아니고 캐시 미스가 늘어나는 방향의 안전한 실패이긴 하다 — `interact`/`cancel` 두 route 는 서로 다른 이름이라 mangling 이 걸려도 route 축이 붕괴하진 않는다).
  - 제안: 현재로선 조치 불요(빌드가 non-minified). 빌드 설정 변경 시 이 의존성을 재검토하도록 클래스 JSDoc 이나 빌드 설정 근처에 짧은 캐너리 주석을 남기는 정도면 충분.

- **[INFO]** fail-open 경로에서 매 요청마다 `Logger.warn` 호출이 추가됨 — 의도된 신규 로그 이벤트
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:105-107`
  - 상세: `req.interaction` 이 없으면(Guard 미적용) 매 요청마다 warn 로그를 남기고 캐시를 건너뛴다. 이 인터셉터가 붙는 두 라우트(`InteractionController.interact`/`cancel`, `codebase/backend/src/modules/external-interaction/interaction.controller.ts:58,66,112`)는 모두 클래스 레벨 `@UseGuards(InteractionGuard, InteractionRateLimitGuard)` 가 걸려 있어 Guard 가 인터셉터보다 먼저 돈다 — 즉 정상 배선에서는 이 분기가 사실상 도달 불가능이고, 로그 폭주 같은 부작용은 없다. Guard 가 빠진 새 라우트에 이 인터셉터를 재사용하면 매 요청 warn 로그가 쌓이는 점만 유의.
  - 제안: 조치 불요. 새 라우트에 이 인터셉터를 재사용할 경우에만 확인.

- **[INFO]** `intercept()` 요청 타입이 `Request` → `RequestWithInteraction` 로 바뀜 — 컴파일 타임 전용, 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:18,92`
  - 상세: `import type` + 제네릭 타입 인자 변경뿐이라 런타임 시그니처(`intercept(context, next)`)는 그대로다. `NestInterceptor` 인터페이스를 만족하는 형태도 불변이라 DI/모듈 배선에 영향 없음. `RequestWithInteraction` 은 `interaction.guard.ts` 가 소유하는 타입이지만 `interaction.guard.ts` 는 `idempotency.interceptor.ts` 를 import 하지 않아 순환 의존도 없다(둘 다 값이 아닌 타입 참조).
  - 제안: 없음.

## 확인했으나 문제 없음

- `REDIS_KEY_PREFIX`(`'interaction:idempotency:'`) 상수 자체는 불변 — 신·구 키 모두 같은 접두를 공유해, 접두 기반 Redis 스캔/모니터링이 있었다면(현재 저장소 전수 grep 결과 없음) 계속 유효하다.
- 새 전역 변수·모듈 레벨 mutable 상태 도입 없음.
- 환경 변수 읽기/쓰기 변경 없음.
- 네트워크 호출 대상·횟수 변경 없음(기존 Redis GET/SET 호출 그대로, 키 값만 변경).
- `IdempotencyInterceptor` 는 `interaction.controller.ts` 두 라우트에만 바인딩돼 있음을 grep 으로 확인 — 다른 소비처 없음, 시그니처 변경의 호출자 영향 범위가 그 두 라우트로 한정됨.
- `interaction:idempotency` 프리픽스를 직접 재구성하는 다른 코드(운영 스크립트·모니터링 등) 저장소 전수 grep 결과 없음 — 이번 키 포맷 변경으로 깨지는 별도 소비처 없음.
- 테스트 파일(`idempotency.interceptor.spec.ts`)의 `jest.spyOn(Logger.prototype, 'warn')` 은 `try/finally` 로 `mockRestore()` 하여 다른 테스트로의 누출 없음.
- CHANGELOG.md 변경은 문서 전용, 런타임 부작용 없음.

## 요약

이번 변경은 `IdempotencyInterceptor` 한 클래스와 그 유일한 두 소비 라우트(`interact`/`cancel`)로 범위가 좁게 닫혀 있다. Redis 키 포맷 변경은 기존 엔트리를 조용히 고아로 만들지만 TTL 로 자연 정리되어 실질 부작용이 없고, `context.getHandler().name` 의존은 현재 빌드 파이프라인(비-minify)에서는 안전하지만 향후 빌드 변경 시 재검토가 필요한 잠재적 브리틀니스다. 전역 상태·환경 변수·네트워크 대상·공개 시그니처(호출자 관점) 변화는 없으며, fail-open 로그 추가도 Guard 가 항상 선행하는 현재 배선에서는 도달 불가능한 안전한 방어선이다.

## 위험도

LOW
