# Testing 리뷰 결과

## 발견사항

### 1. 신규 기능 테스트 커버리지 (integrations.service.ts + spec.ts)

- **[INFO]** `pending_install` 가드 — 테스트 추가 양호
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (파일 7, 신규 테스트 2건)
  - 상세: `integrations.service.ts`에 추가된 `pending_install` 상태 조기 반환 가드(파일 8)에 대해 `rejects pending_install integration with INTEGRATION_INCOMPLETE`와 `pending_install guard is service_type-agnostic` 두 케이스가 함께 추가되었다. 새 프로덕션 코드와 테스트가 동일 PR에 포함된 정상 패턴이다.
  - 제안: 없음.

---

### 2. ExecutionEventEmitter 유닛 테스트 부재

- **[WARNING]** `ExecutionEventEmitter` 서비스 자체에 대한 유닛 테스트 파일이 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (파일 3)
  - 상세: 변경 내용은 서식(포맷) 수정 전용이지만, 본 파일 전체를 보면 `emitExecution`과 `emitNode` 두 public 메서드가 존재한다. 이 facade 서비스에 대한 전용 `.spec.ts` 파일이 보이지 않는다. 파일 주석에 "엔진 unit test 가 websocket service 의 broadcastToChannel 까지 mock 해야 했다"는 배경이 명시되어 있어, 이 facade 가 있음으로써 엔진 테스트가 단순해져야 하는데 그 facade 자체를 검증하는 테스트가 없다.
  - 제안: `execution-event-emitter.service.spec.ts`를 작성하여 `emitExecution`/`emitNode` 가 각각 올바른 인자로 `websocketService` 메서드를 위임하는지 검증한다.

---

### 3. WebsocketGateway 구독 상한 로직에 대한 테스트 부재

- **[WARNING]** `MAX_SUBSCRIPTIONS_PER_CONNECTION` 초과 시 분기(파일 10)에 대한 테스트 커버리지가 불명확하다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (파일 10, 라인 926~933)
  - 상세: `isNewSubscription && clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 조건은 포맷만 바뀌었으나, 이 조건 분기가 기존 `websocket.gateway.spec.ts`에서 테스트되는지 확인되지 않는다. `websocket.service.spec.ts`(파일 11)는 `WebsocketService`만 다루고 Gateway 레이어는 포함하지 않는다.
  - 제안: `websocket.gateway.spec.ts`에 구독 상한 초과 시 `{ event: 'subscribed', data: { ... } }` 형태로 조기 반환되는 케이스를 추가한다.

---

### 4. CORS 캐시 격리 — afterAll 복원 방식의 위험

- **[WARNING]** `afterAll`에서 `process.env = originalEnv`로 통째로 교체하는 방식은 테스트 격리를 불완전하게 보장한다.
  - 위치: `codebase/backend/src/common/utils/cors-origins.spec.ts`, 라인 183
  - 상세: `process.env = originalEnv`는 전체 env 객체 참조를 교체한다. Jest의 병렬/워커 환경에서 다른 테스트 파일이 같은 프로세스 env를 공유할 경우 이 치환이 의도하지 않은 부작용을 일으킬 수 있다. 또한 이미 `beforeEach`에서 `delete` 방식으로 케이스별 초기화가 이뤄지고 있으므로, `afterAll`의 역할과 중복된다.
  - 제안: `afterAll`을 `afterEach` 패턴과 통일하거나, `jest.restoreAllMocks()` 대신 각 키를 명시적으로 복원(`process.env.CORS_ORIGINS = originalEnv.CORS_ORIGINS`)하도록 변경한다.

---

### 5. `catalog-sync.spec.ts` — 폴백 경로 하드코딩 레벨 수

- **[INFO]** `resolveRepoRoot` 의 예외 경로에서 `join(__dirname, '..', '..', '..', '..', '..', '..', '..')` 7단계 상위를 가정한다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` (파일 18)
  - 상세: `git rev-parse --show-toplevel`이 실패할 때만 동작하는 폴백이므로 일반 실행 경로에서는 문제가 없다. 하지만 폴백 경로의 깊이가 파일 이동 시 자동으로 갱신되지 않는다.
  - 제안: 위험도가 낮으나, `path.resolve(__dirname, '../../../../../../../')` 대신 `__dirname`에서 `package.json`을 찾아 올라가는 동적 방식을 고려할 수 있다.

---

### 6. `Cafe24InstallNonceCache` — `close()` 시 Redis가 없는 경우 테스트 부재

- **[INFO]** `close()` 메서드가 Redis가 없는 인스턴스(`new Cafe24InstallNonceCache()`)에서 호출될 때의 동작을 검증하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.spec.ts` (파일 5)
  - 상세: Redis 없이 생성된 `noRedis` 인스턴스에서 `isReplay` graceful degradation은 검증되어 있으나(라인 514~522), `noRedis.close()`의 동작(예외 없이 no-op인지)은 검증되지 않는다.
  - 제안: `it('close() without Redis is a no-op', async () => { const noRedis = new Cafe24InstallNonceCache(); await expect(noRedis.close()).resolves.toBeUndefined(); })`를 추가한다.

---

### 7. 메타데이터 파일들(파일 17~27) — 테스트 없음 (정상)

- **[INFO]** `application.ts`, `collection.ts`, `community.ts`, `customer.ts`, `design.ts`, `product.ts`, `promotion.ts`, `supply.ts`, `translation.ts` 변경은 모두 서식(따옴표 스타일·줄 길이) 수정이며 로직 변경이 없다.
  - 위치: 파일 17~27 전체
  - 상세: 이 파일들은 정적 메타데이터 배열을 정의하며, `catalog-sync.spec.ts`(파일 18)가 전체 메타데이터 컬렉션의 구조적 정합성을 회귀 검증한다. 개별 서식 수정에 추가 테스트는 불필요하다.
  - 제안: 없음.

---

### 8. `service-registry.ts` — 스코프 변경에 대한 테스트

- **[INFO]** `mall.read_privacy`에 `requiresApproval: true` 속성이 추가된 기존 항목이 서식 변경과 함께 수정되었다(파일 9).
  - 위치: `codebase/backend/src/modules/integrations/services/service-registry.ts`, `CAFE24_SCOPES` 배열
  - 상세: 변경 내용은 서식 전용이며 `requiresApproval: true`는 이미 존재했던 것으로 보인다. `restricted-approval.spec.ts`(파일 25)가 `mall.read_privacy`를 restricted 목록에서 검증하고 있어 커버된다.
  - 제안: 없음.

---

### 9. Mock 타입 안전성 — `as never` 패턴

- **[INFO]** `cafe24-install-nonce-cache.service.spec.ts`(라인 471)와 `integration-action-required-notifier.service.spec.ts`(라인 678~682)에서 `as never` 캐스팅으로 Mock을 주입한다.
  - 위치: 파일 5, 파일 6
  - 상세: `as never` 캐스팅은 타입 체커를 완전히 우회한다. 실제 인터페이스 변경 시 컴파일 오류 없이 런타임에서만 실패할 수 있다.
  - 제안: `jest.Mocked<ClassName>` 또는 `createMock<ClassName>()` 패턴으로 교체해 타입 안전성을 높인다.

---

### 10. `ai-agent.handler.ts` — 서식 변경에 대한 단위 테스트

- **[INFO]** `buildMcpDiagnosticsMeta` 호출부(라인 1865, 1954)의 서식만 바뀌었고 로직 변경이 없다(파일 12).
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - 상세: `mcpServerSummaries`가 `undefined`일 때 `?? {}`로 폴백하는 로직이 기존에도 있었으며 해당 경로 테스트가 `cafe24-mcp-tool-provider.spec.ts`에 간접적으로 포함된다. 직접적인 `buildMcpDiagnosticsMeta(undefined)` 케이스 테스트는 확인되지 않으나, 서식 전용 변경이므로 긴급 추가는 불필요하다.
  - 제안: 없음.

---

## 요약

이번 변경의 대부분은 Prettier/ESLint 서식 정규화(따옴표 통일, 라인 길이 초과 분리)로, 실질적인 로직 변경은 `integrations.service.ts`의 `pending_install` 가드 신규 추가 한 건이다. 이 가드에 대해서는 service-type 독립성 검증을 포함한 테스트 2건이 함께 추가되어 TDD 원칙을 잘 따르고 있다. 주요 개선 포인트는 두 가지다: `ExecutionEventEmitter` facade에 대한 전용 유닛 테스트 부재(현재 이 facade의 올바른 위임 동작이 테스트로 검증되지 않는다), 그리고 WebsocketGateway 구독 상한 분기의 테스트 커버리지 불확실성. `cors-origins.spec.ts`의 `afterAll` 환경 복원 방식도 격리 완전성 측면에서 개선 여지가 있으며, `Cafe24InstallNonceCache.close()` no-Redis 케이스와 mock `as never` 타입 안전성은 낮은 우선순위의 개선 사항이다.

## 위험도

LOW
