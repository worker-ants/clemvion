# 테스트(Testing) 코드 리뷰

## 발견사항

- **[CRITICAL]** `HooksService.verifyAuth` — HMAC 양성 케이스 전 계층 미보호
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (전체), `codebase/backend/test/webhook-trigger.e2e-spec.ts:133-167`
  - 상세: `hooks.service.spec.ts` 는 `authType: 'none'` 케이스만 테스트하며 `verifyAuth` 의 `hmac` 분기와 `bearer` 분기에 대한 단위 테스트가 전무하다. E2e 테스트(케이스 E)도 "rawBody 가 켜져 있지 않아 어느 쪽(202 또는 401)이든 acceptable" 이라는 주석과 함께 `expect([202, 401]).toContain(sigged.status)` 로 양성 케이스를 사실상 포기한다. `main.ts` 의 `NestFactory.create` 에 `rawBody: true` 옵션이 없으므로 `req.rawBody` 는 런타임에서 항상 `undefined` 이며, HMAC 인증을 설정한 모든 웹훅은 유효한 서명이라도 반드시 401 `AUTH_FAILED` 를 반환한다. spec 이 정의한 기능이 실질적으로 동작하지 않으나 테스트가 이를 탐지하지 못하는 상태다.
  - 제안: (1) `main.ts` 의 `NestFactory.create(AppModule, { rawBody: true })` 추가 또는 `express.json({ verify: ... })` 미들웨어로 `rawBody` 를 수동 캡처한다. (2) `hooks.service.spec.ts` 에 `verifyAuth` 단위 테스트를 추가한다: bearer 토큰 불일치 → UnauthorizedException, bearer 토큰 일치 → 통과, HMAC 서명 정상 rawBody → 통과, HMAC 서명 변조 → UnauthorizedException, rawBody 없을 때 HMAC → UnauthorizedException. (3) e2e 케이스 E 의 `expect([202, 401]).toContain(...)` 를 `expect(ok.status).toBe(202)` 로 교체한다.

- **[CRITICAL]** Cafe24 OAuth callback / BullMQ refresh e2e 미존재 — 장기 회귀 위험
  - 위치: `codebase/backend/test/` (cafe24 callback/refresh e2e 파일 없음), `plan/complete/cafe24-followup-backlog.md:97-98`
  - 상세: handleInstall e2e 는 완료됐으나(B-5-8), handleCallback(OAuth code exchange) 과 BullMQ 토큰 refresh 워크플로우는 "외부 Cafe24 token endpoint mock 인프라 부담"을 이유로 e2e 가 보류됐다. 두 경로는 토큰 획득과 갱신의 핵심이며 단위 테스트(unit + integration spec)가 일부 존재하지만 실 DB·Redis·BullMQ 큐 연동 없이는 검증할 수 없는 경쟁 조건(CONC H-2 등)과 암호화 transformer 우회 문제가 있다. 보류가 길어질수록 회귀 안전망의 구멍이 커진다. plan 에도 별도 follow-up 으로만 기술돼 추적이 불명확하다.
  - 제안: `docker-compose.e2e.yml` 에 경량 HTTP stub 컨테이너(예: WireMock 또는 `mockbin`)를 추가해 `https://myshop.cafe24api.com/api/v2/oauth/token` 를 스텁화한 뒤 `integration-cafe24-callback.e2e-spec.ts` 를 작성한다. 최소 커버리지: code→token exchange 성공 → connected 상태 전환, 재갱신 BullMQ job → 새 access_token 저장.

- **[WARNING]** `HooksService` 단위 테스트에서 `constantTimeEquals` 분기 미커버
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:176-181`, `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
  - 상세: `constantTimeEquals` 는 길이가 다른 입력에서 `timingSafeEqual` 을 호출하지 않도록 사전에 길이를 비교한다(길이 누출 vs DoS 회피 트레이드오프). 이 분기(길이 다름 → 즉시 false, 길이 같음 + 내용 다름 → timingSafeEqual false)가 단위 테스트에 전혀 없다.
  - 제안: bearer 분기에서 `token.length !== expected.length` 케이스 및 `token === expected` (성공) 케이스를 `handleWebhook` 단위 테스트로 커버한다. verifyAuth 를 `protected` 로 격상해 직접 테스트하거나 service 를 통해 간접 검증한다.

- **[WARNING]** Cafe24 install e2e — `mall_id 불일치(recovery fall-through 후에도) → 403` 케이스 미포함
  - 위치: `codebase/backend/test/integration-cafe24-install.e2e-spec.ts:20` (목록에 명시됐으나 테스트 없음)
  - 상세: 파일 상단 주석의 "보호 대상" 목록에 "mall_id 불일치(recovery fall-through 후에도) → 403" 이 명시돼 있으나 실제 테스트 케이스가 구현되지 않았다. HMAC 단위 테스트(unit spec)에 이 경로가 있으나 실 DB·Redis 연동 포함 e2e 검증은 없다.
  - 제안: `rejection paths` describe 블록에 `mall_id 불일치 → 403 CAFE24_INSTALL_INVALID_HMAC` 케이스를 추가한다. `insertPendingInstall` 로 `mallId=shop-A` 를 등록한 뒤 쿼리에 `mall_id=shop-B` 로 호출하면 된다.

- **[WARNING]** Nonce cache Redis 키 — HMAC 앞 8자 prefix 충돌 위험 미테스트
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts:108`, `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.spec.ts`
  - 상세: 키는 `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac[:8]}` 형태다. 동일한 mall_id + timestamp 에서 HMAC 값의 앞 8자가 같고 나머지만 다른 두 요청은 같은 Redis 키를 공유해 첫 번째 요청이 두 번째를 replay 로 차단할 수 있다. 단위 테스트는 동일한 prefix `aaaaaaaa` 를 가진 두 HMAC 에 대한 충돌 시나리오를 다루지 않는다.
  - 제안: `'bbbbbbbb-rest'` vs `'bbbbbbbb-different-suffix'` 를 같은 mall_id + timestamp 로 호출하면 동일한 prefix 8자를 공유하지만 두 요청이 독립적이어야 함을 단언하는 테스트를 추가한다 (현재 구현에서는 충돌이 발생한다). 혹은 키 설계를 전체 HMAC 해시로 변경하는 방향을 검토한다.

- **[WARNING]** `cafe24-token-refresh.processor.spec.ts` — `Date.now()` 를 fake timer 없이 사용
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts:32, 48`
  - 상세: `makeIntegration()` 은 `new Date(Date.now() - 30_000)` 으로 "만료된" 토큰을, `new Date(Date.now() + 60 * 60 * 1000)` 으로 "유효한" 토큰을 생성한다. jest fake timer 없이 실시간 시계를 사용하므로 처리기 내부 로직이 토큰 만료 판단에 특정 임계값을 쓰는 경우 경계값 근처에서 flaky 해질 수 있다. 현재 30초/1시간이라는 여유가 크기 때문에 실질 flakiness 위험은 낮으나 패턴 자체가 비결정적이다.
  - 제안: `jest.useFakeTimers()` + `jest.setSystemTime()` 으로 고정된 시각을 설정한 뒤 상대 오프셋을 계산한다. `beforeAll` 에서 고정 에포크를 설정하고 `afterAll` 에서 `jest.useRealTimers()` 를 호출한다.

- **[WARNING]** 웹훅 e2e — `Date.now()` 기반 `endpointPath` 생성으로 경합 가능성
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:74, 95, 112, 134`
  - 상세: `e2e-a-${Date.now()}` 형식의 path 는 테스트가 병렬로 실행될 경우(jest workers, `--maxWorkers`) 밀리초 수준 충돌이 이론적으로 가능하다. `jest-e2e.json` 의 현재 설정이 단일 워커라면 문제없으나 설정이 변경되면 flaky 해진다.
  - 제안: `randomBytes(8).toString('hex')` 또는 UUID v4 를 사용한다. 이미 다른 e2e 테스트(`integration-cafe24-install.e2e-spec.ts`)에서 `randomBytes` 를 사용하는 패턴이 적용돼 있으므로 일관성도 확보된다.

- **[WARNING]** `integration-cafe24-install.e2e-spec.ts` — credentials 암호화 transformer 우회
  - 위치: `codebase/backend/test/integration-cafe24-install.e2e-spec.ts:84-111`
  - 상세: 테스트는 `enc:` prefix 없이 plain JSON 으로 `INSERT` 해 암호화 transformer 를 우회한다. 이는 테스트 환경의 필요성으로 이해되지만, (1) ENCRYPTION_KEY 미설정 상태에서 transformer 가 어떻게 동작하는지 e2e 수준에서 검증되지 않고, (2) 암호화된 실제 credentials 를 사용하는 경로(production 에 가까운 경로)가 e2e 에서 커버되지 않는다.
  - 제안: 최소한 `credentials-transformer.spec.ts` 에서 `enc:` prefix 없는 레거시 행과 암호화된 행 모두 서비스 계층이 올바르게 읽는지 통합 경로를 추가한다. 별도 주석으로 이 한계를 명시하는 것은 현재 잘 돼 있으나 follow-up 계획으로 이 gap 이 추적되지 않고 있다.

- **[WARNING]** 웹훅 HMAC 긍정 케이스가 `hooks.service.spec.ts` 가 담당한다고 명시했으나 해당 spec 에 HMAC 테스트 없음
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:155` ("양성 케이스는 hooks.service.spec.ts 가 담당")
  - 상세: e2e 는 HMAC 양성 케이스 검증을 `hooks.service.spec.ts` 에 위임한다고 주석을 달았지만 `hooks.service.spec.ts` 에 HMAC 관련 테스트가 단 하나도 없다. 두 파일 모두 HMAC 양성 케이스를 커버하지 않아 참조가 끊긴 상태다.
  - 제안: `hooks.service.spec.ts` 에 `handleWebhook` 에 올바른 rawBody + HMAC 서명을 제공했을 때 `engine.execute` 가 호출되는 케이스를 추가한다.

- **[INFO]** 프론트엔드 e2e — Cafe24 Private App 설치 흐름 미커버
  - 위치: `codebase/frontend/e2e/integrations/list.spec.ts` (목록 렌더 2개 케이스만 존재)
  - 상세: 프론트엔드 e2e 는 integrations 목록 렌더와 빈 상태만 커버한다. Cafe24 Private App 설치 시작(precheck → install URL 복사) 및 상태 변화(pending_install → connected) 에 대한 Playwright 시나리오가 없다. 백엔드 e2e 에서 API 계층은 커버되지만 UI 흐름은 보호되지 않는다.
  - 제안: `codebase/frontend/e2e/integrations/cafe24-install.spec.ts` 를 추가해 precheck API 응답 mocking 후 UI 상태(pending badge, app URL 표시, 설치 완료 전환)를 검증한다.

- **[INFO]** `integration-cafe24-install.e2e-spec.ts` — happy path 가 `beforeEach` 로 공유된 상태에 의존
  - 위치: `codebase/backend/test/integration-cafe24-install.e2e-spec.ts:115-138`
  - 상세: `happy path` describe 블록은 `beforeEach` 에서 `installToken` 을 초기화하지만 `rejection paths` 블록 내 각 `it` 은 자체적으로 `insertPendingInstall` 을 호출한다. 이 패턴 자체는 올바르나 happy path 테스트가 단일 케이스만 있어 install 성공 후 통합 row 의 상태(`status`) 변화나 `state` 테이블 생성 여부를 검증하지 않는다.
  - 제안: happy path 에 후속 DB 상태 검증(행 상태가 `pending_oauth` 또는 authorized 로 전환됐는지)을 추가한다.

- **[INFO]** 프론트엔드 스토어 테스트 — Zustand 전역 상태 초기화 패턴이 일부 파일에서 누락
  - 위치: `codebase/frontend/src/lib/stores/__tests__/auth-store.test.ts:17-19`
  - 상세: `auth-store.test.ts` 는 `vi.clearAllMocks()` 만 호출하고 스토어 자체를 초기화하지 않는다. `editor-store.test.ts` 는 `useEditorStore.setState(initialState)` 로 올바르게 초기화하는 패턴을 사용한다. 스토어가 singleton 이라면 테스트 간 상태 누출이 발생할 수 있다.
  - 제안: `auth-store.test.ts` 의 `beforeEach` 에서 스토어를 초기 상태로 reset 한다. Zustand `create` 에 `resetters` 패턴을 적용하거나 `getInitialState()` export 를 추가해 일관된 초기화 API 를 제공한다.

- **[INFO]** 회귀 테스트 coverage — W1~W4, B-3, B-4 fix 의 보호 명시 부재
  - 위치: 검토 범위 전체
  - 상세: prompt 에 언급된 "B-3, B-4, W1~W4 fix 가 회귀 테스트로 보호되는지"를 확인하기 위해 해당 PR 연관 spec 변경을 추적했으나, 각 fix 가 어떤 spec 의 어떤 `it` 블록으로 보호되는지 명시된 주석이나 link 가 없다. 개별 spec 파일이 충분히 많으나 fix ↔ test 의 추적성이 낮다.
  - 제안: 보안·회귀 관련 fix 의 테스트 케이스 상단에 `// 회귀 안전망: <issue-ref>` 형태로 주석을 달아 추적성을 확보한다.

---

## 요약

전반적인 테스트 자산은 매우 광범위하고 체계적이다. backend 단위 테스트와 통합 테스트, 특히 Cafe24 installHandle HMAC/nonce/recovery 경로, OAuth state 관리, credentials 암호화 transformer, RBAC 가드, 실행 엔진 등의 커버리지는 업계 수준 이상이다. 그러나 두 개의 CRITICAL 이슈가 발견됐다. 첫째로 HMAC 웹훅 인증(`verifyAuth` hmac/bearer 분기)이 단위 테스트에서 완전히 미커버된 채 e2e 에서도 양성 케이스를 포기했으며, 더 심각하게는 `main.ts` 에 `rawBody: true` 가 없어 HMAC 인증이 운영 환경에서 실제로 동작하지 않을 가능성이 높다. 둘째로 Cafe24 OAuth callback/refresh e2e 가 인프라 부담을 이유로 보류된 상태로 장기 회귀 위험이 축적되고 있다. 이 두 이슈는 보안 회귀 안전망 직접 관련이므로 즉각 조치가 필요하다. 나머지 WARNING 은 flaky 신호, 주석 참조 단절, 엣지 케이스 누락으로 단기 보강 권고 수준이다.

---

## 위험도

**HIGH**
