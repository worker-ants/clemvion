# Code Review 통합 보고서

## 전체 위험도
**LOW** — Redis pub/sub 기반 멀티 인스턴스 credential 캐시 무효화 버스 도입. 보안·API 계약·변경 범위 관점에서 Critical 발견 없음. 주요 개선 여지는 `DatabaseQueryHandler` 생성자의 arrow function 중복 등록 가능성, `onModuleInit` subscribe race window, spec 트리거 목록 SPEC-DRIFT 1건.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/4-integration/2-database-query.md §4.2` broadcast 트리거 목록이 코드보다 과하게 열거 — `update`·`reauthorize`·OAuth 갱신 포함. 코드는 `rotate`+`remove` 만 broadcast(의도적 정제). `data-flow/5-integration.md` 는 이미 코드와 일치. | `spec/4-nodes/4-integration/2-database-query.md §4` | 코드 유지. spec 트리거 목록을 `rotate`·`remove` 만으로 축소, 제외 이유 명시. project-planner 위임 |
| 2 | Side Effect / Architecture | `DatabaseQueryHandler` 생성자에서 매 인스턴스마다 새 arrow function 참조로 `integrationCacheBus.register()` 호출 — `Set`의 idempotent 보장이 동일 함수 참조에만 적용되므로 비싱글톤 시나리오에서 invalidator 누적 가능. 전역 싱글톤 bus에 누수 지속. | `database-query.handler.ts` L1730–1732 | arrow function을 인스턴스 프로퍼티로 고정(`private readonly onInvalidate = (id: string) => this.invalidatePool(id)`) 후 해당 참조로 register, 또는 createHandler 싱글톤 계약을 명시적 문서·아키텍처 보장으로 강화 |
| 3 | Architecture / Maintainability | `broadcastCredentialChange` private 메서드가 `this.integrationCacheBus.publish(id)` 한 줄만 호출하는 thin wrapper — 불필요한 indirection. 현재 2 호출 지점 기준으로 직접 호출이 더 단순. | `integrations.service.ts` broadcastCredentialChange | 제거 후 호출 지점에서 직접 `await this.integrationCacheBus.publish(id)` 호출, 또는 향후 횡단 관심사 집중 의도를 JSDoc에 명시 |
| 4 | Architecture | `NodeHandlerDependenciesProvider` 에서 `integrationCacheBus` 가 `@Optional()` — 프로덕션에서 Redis 없이 배포 시 버스 등록 누락이 silently degrade. | `node-handler-dependencies.provider.ts` | `build()` 내부에서 `integrationCacheBus` null 시 `Logger.warn` 발행으로 운영 가시성 향상 |
| 5 | Side Effect | `duplicate()` 연결의 `lazyConnect` 상속 여부가 명확히 문서화되지 않음 — ioredis 버전에 따라 subscribe 호출 전 암묵적 TCP 연결 시도 가능성. | `integration-cache-bus.service.ts` `onModuleInit` | `base.duplicate({ lazyConnect: false })` 등 명시적 옵션 지정, 또는 `lazyConnect` 동작 전제를 주석으로 명확히 기술 |
| 6 | Maintainability | `onModuleDestroy` 의 임시 변수 `s` — 단문자 네이밍으로 의도 불명. | `integration-cache-bus.service.ts` `onModuleDestroy` | `const sub = this.subscriber;` 로 변경 |
| 7 | Maintainability | e2e `waitForBroadcast` 의 `while(true)` + `eslint-disable-next-line no-constant-condition` 패턴 — eslint 억제 필요, 재사용 가능성 있으나 인라인 helper만 존재. | `integration-cache-invalidate.e2e-spec.ts` `waitForBroadcast` | `while(!condition && !timeout)` 리팩터링 또는 `test/helpers/waitUntil` 범용 helper로 추출 |
| 8 | Maintainability | 단위 테스트 `makeProvider` 의 `const base = client;` — 파라미터 단순 복사, 반환 `base` 필드 실사용 거의 없음. | `integration-cache-bus.service.spec.ts` `makeProvider` | `base` 필드 제거 또는 `provider` 만 반환하도록 단순화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Redis pub/sub 채널에 integrationId 평문 전송 — Redis 인증·네트워크 격리 전제 하에 허용 가능. | `integration-cache-bus.service.ts` L540 | Redis 인증(requirepass/ACL) 및 내부망 격리를 운영 가이드에 명시. 코드 변경 불필요 |
| 2 | Security | 수신 메시지 integrationId의 UUID 형식 검증 부재 — Redis ACL 취약 시 가용성(pool flush DoS) 위험. 기밀성·무결성 침해 아님. | `integration-cache-bus.service.ts` L565–566 | Redis ACL로 publish 권한 제한(운영 레벨). 코드 레벨 UUID 정규식 검증 추가는 선택 사항 |
| 3 | Performance | `invalidatePool`의 `pool.end()` await — stale 클라이언트 보유 시 임의로 길어질 수 있음. `resolvePgPool`의 fire-and-forget 패턴과 불일치. | `database-query.handler.ts` `invalidatePool` | `pool.end()`에 타임아웃 래퍼 추가 또는 fire-and-forget 처리 검토 |
| 4 | Performance | `runInvalidators`의 `instanceof Promise` 체크 — thenable 미감지 가능성. 현 코드베이스에서는 native Promise만 반환하므로 실제 문제 없음. | `integration-cache-bus.service.ts` `runInvalidators` | 방어적으로 `typeof result?.then === 'function'` 으로 교체 고려 |
| 5 | Testing | e2e `received` 배열이 describe 스코프 공유, beforeEach 초기화 없음 — uniqueName으로 실제 오탐 위험 낮으나 테스트 격리 명확성 부족. | `integration-cache-invalidate.e2e-spec.ts` | `beforeEach(() => received.length = 0)` 추가 |
| 6 | Testing | `register` idempotency(Set 중복 방지) 테스트 누락 — JSDoc에 명시된 속성이나 테스트 없음. | `integration-cache-bus.service.spec.ts` | `bus.register(fn); bus.register(fn)` 후 1회 호출 검증 케이스 추가 |
| 7 | Testing | `onModuleInit` subscribe reject 분기 미테스트 — `.catch()` 처리 존재하나 warn 로그 경로 미검증. | `integration-cache-bus.service.spec.ts` | `sub.subscribe.mockRejectedValueOnce` 케이스 추가 |
| 8 | Testing | `onModuleInit` error 이벤트 핸들러 테스트 누락 — on('error') 미등록 시 Node.js process crash 위험 대역. | `integration-cache-bus.service.spec.ts` | `FakeRedis`에 `emitError` helper 추가 후 throw 없음 확인 |
| 9 | Testing | `runInvalidators` 빈 integrationId 경계값 테스트 누락 — `if (!integrationId) return` 가드 존재하나 미검증. | `integration-cache-bus.service.spec.ts` | 빈 문자열 메시지 수신 시 invalidator 미호출 확인 케이스 추가 |
| 10 | Testing | e2e `waitForBroadcast` 실패 시 메시지 불명확 — `false` 반환 후 `expect(...).toBe(true)` 실패만으로 어느 id가 미도달인지 알기 어려움. | `integration-cache-invalidate.e2e-spec.ts` | expect 메시지 추가: `` `broadcast not received for ${id} within 5s` `` |
| 11 | Architecture | `onModuleInit` subscribe race window — subscribe 완료 전 첫 rotate publish 도달 시 메시지 유실 가능. fail-safe 설계(best-effort)와 일관적이나 명시 부족. | `integration-cache-bus.service.ts` `onModuleInit` | `onModuleInit(): Promise<void>` 로 선언해 `await sub.subscribe(...)` 대기 고려, 또는 race window를 주석에 명시 |
| 12 | Architecture | `IntegrationCacheBus`가 database-query spec의 `code:` 에만 등재 — 향후 다른 핸들러도 사용 가능한 integration-generic 인프라. | `spec/4-nodes/4-integration/2-database-query.md` frontmatter | 두 번째 핸들러 사용 시점에 공용 Redis pub/sub infra spec을 별도 문서로 추출 권고 |
| 13 | Documentation | `onModuleInit`/`onModuleDestroy` JSDoc 없음 — 가장 복잡한 라이프사이클 동작임에도 문서 부재. | `integration-cache-bus.service.ts` | 1-2줄 주석으로 "전용 subscriber 연결 생성 + 채널 구독 / quit" 의도 명시 |
| 14 | Documentation | e2e `CHANNEL` 상수가 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` import 없이 문자열 재선언 — 채널명 변경 시 두 곳 수정 필요. | `integration-cache-invalidate.e2e-spec.ts` L2426 | `import { INTEGRATION_CACHE_INVALIDATE_CHANNEL }` 로 교체(프로젝트 e2e→src import 컨벤션 확인 후) |
| 15 | Documentation | `spec/4-nodes/4-integration/2-database-query.md` frontmatter `code:` 에 `integrations.service.ts` 누락 — `broadcastCredentialChange` 핵심 호출자. | `spec/4-nodes/4-integration/2-database-query.md` frontmatter | `integrations.service.ts` 추가 검토 |
| 16 | Concurrency | `pools` Map의 비원자적 invalidate/resolve — 단일 이벤트 루프 원자성으로 현재 안전하나 Worker Threads 도입 시 취약. | `database-query.handler.ts` `invalidatePool` vs `resolvePgPool` | "단일 이벤트 루프 원자성 의존" 주석으로 향후 재검토 신호 남기기 |
| 17 | Maintainability | 단위 테스트 `describe('subscribe + register')` 내 fixture setup 5개 it 블록에 반복 — `beforeEach` 추출 여지. | `integration-cache-bus.service.spec.ts` | `beforeEach`에서 `sub`, `base`, `bus` 초기화 공통화 |
| 18 | Side Effect | `IntegrationsService.remove()` 이후 `broadcastCredentialChange(id)` 호출 — 현재는 안전하나 향후 `broadcastCredentialChange`에 로직 추가 시 삭제된 entity 조회 실수 가능성. | `integrations.service.ts` diff L1083–1084 | JSDoc에 "호출 시점에 해당 integration은 이미 DB에서 삭제됐을 수 있으므로 외부 조회 없이 id 전달만 수행" 제약 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | OWASP Top 10 해당 취약점 없음. Redis 인증·네트워크 격리를 운영 수준에서 보장 필요(INFO) |
| performance | LOW | `invalidatePool`의 `pool.end()` stale 대기 가능성, e2e `received` 공유 상태 신뢰성 |
| architecture | LOW | `broadcastCredentialChange` indirection, `@Optional()` 운영 가시성 부족, subscribe race window |
| requirement | LOW | SPEC-DRIFT 1건 — `database-query.md §4.2` 트리거 목록 과포괄(코드가 정제된 올바른 구현) |
| scope | NONE | 15개 파일 변경 전체가 선언 범위 내 최소 필요 변경 |
| side_effect | LOW | arrow function 중복 등록 패턴, `duplicate()` lazyConnect 불명확, remove 후 broadcast 주석 부재 |
| maintainability | LOW | thin wrapper, 단문자 변수명, busy-wait eslint 억제, fixture 중복 |
| testing | LOW | 모두 INFO — register idempotency, subscribe reject, error 이벤트, 빈 id 경계값 미테스트 |
| documentation | LOW | `onModuleInit` JSDoc 없음, spec 간 broadcast 트리거 범위 불일치 명시 부족 |
| concurrency | LOW | subscribe fire-and-forget 시 destroy race(드묾), pools Map 원자성 주석 부재 |
| api_contract | NONE | 공개 HTTP API 계약 변경 없음 |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 내 모든 파일 정확히 일치 — 발견 없음
- **api_contract**: 공개 HTTP API 계약 변경 없음 — 발견 없음

---

## 권장 조치사항

1. **[SPEC-DRIFT 필수] `spec/4-nodes/4-integration/2-database-query.md §4` 트리거 목록 수정** — `rotate`·`remove` 만으로 축소, `update`(name 전용)·`reauthorize`·OAuth 갱신 제외 이유 명시. project-planner 위임. (requirement WARNING #1)
2. **`DatabaseQueryHandler` arrow function 인스턴스 프로퍼티화** — `private readonly onInvalidate = (id: string) => this.invalidatePool(id)` 선언 후 register에 해당 참조 전달, 비싱글톤 시 Set 누적 방지. (side_effect WARNING #2)
3. **`duplicate()` lazyConnect 명시화** — `base.duplicate({ lazyConnect: false })` 또는 주석으로 lazyConnect 동작 전제 명확히 기술. (side_effect WARNING #5)
4. **`onModuleDestroy` 변수명 `s` → `sub` 변경** — 단 한 글자, 가독성 직결. (maintainability WARNING #6)
5. **`NodeHandlerDependenciesProvider.build()`에 integrationCacheBus null 경고 로그 추가** — 운영 가시성 향상. (architecture WARNING #4)
6. **`broadcastCredentialChange` 처리** — 제거 후 직접 호출로 인라인하거나, 향후 횡단 관심사 집중 의도를 JSDoc에 명시. (architecture/maintainability WARNING #3)
7. **e2e `received` 배열 `beforeEach` 초기화** — `beforeEach(() => received.length = 0)`. (testing/side_effect INFO)
8. **`onModuleInit` JSDoc 추가 및 subscribe race window 주석** — "전용 subscriber 연결 생성 + 채널 구독, best-effort race window 존재" 명시. (documentation/concurrency INFO)
9. **`spec/4-nodes/4-integration/2-database-query.md` frontmatter `code:`에 `integrations.service.ts` 추가** — broadcastCredentialChange 핵심 호출자. (documentation INFO)
10. **e2e `CHANNEL` 상수를 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` import로 교체** — 단일 진실 원칙. (maintainability INFO)

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외** (3명):

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | (라우터 판단 — 의존성 변경 없음으로 추정) |
| database | (라우터 판단 — DB 스키마/마이그레이션 변경 없음으로 추정) |
| user_guide_sync | (라우터 판단 — 사용자 가이드 영향 없음으로 추정) |