# Testing Review

## 발견사항

---

### [INFO] Cafe24Module.onModuleInit 등록 로직에 대한 단위 테스트 없음
- 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` — `onModuleInit()`
- 상세: `Cafe24Module.onModuleInit`이 `IntegrationsService.registerEntityTester('cafe24', ...)`를 호출하는지 검증하는 테스트가 없다. `cafe24.module.ts`에 대한 spec 파일 자체가 변경 범위에 없다. 이 등록이 실패하면 fallback(구조적 성공 반환)으로 조용히 떨어지므로, 등록 여부가 회귀 시 눈에 띄지 않는다.
- 제안: `cafe24.module.spec.ts`를 추가하거나 기존 파일에 `onModuleInit` 테스트를 추가한다. `integrations.registerEntityTester`가 `'cafe24'` key로 호출됐는지 spy를 통해 확인한다.

---

### [WARNING] `registerEntityTester` 중복 등록(덮어쓰기) 동작 테스트 없음
- 위치: `backend/src/modules/integrations/integrations.service.ts` — `registerEntityTester()` / `integrations.service.spec.ts`
- 상세: 구현 주석에 "Last registration wins"라고 명시되어 있으나, 동일 `serviceType`에 두 번 등록했을 때 후자가 실제로 사용되는지 확인하는 테스트가 없다. 복수 모듈이 동일 key를 등록할 경우 묵시적 덮어쓰기 정책이 의도대로 동작하는지 보장이 필요하다.
- 제안: `integrations.service.spec.ts`의 `testConnection` describe 블록에 케이스를 추가한다:
  ```ts
  it('second registerEntityTester call for same service_type overwrites the first', async () => {
    const first = jest.fn().mockResolvedValue({ success: true, message: 'first' });
    const second = jest.fn().mockResolvedValue({ success: true, message: 'second' });
    service.registerEntityTester('cafe24', first);
    service.registerEntityTester('cafe24', second);
    integrationRepo.findOne.mockResolvedValue(makeCafe24Integration());
    const result = await service.testConnection('int-1', 'ws-1');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
  ```

---

### [WARNING] `pingConnection`에서 `assertCredentials` 실패(불완전 자격증명) 케이스 테스트 없음
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection()` 내 `assertCredentials(creds)` 호출 / `cafe24-api.client.spec.ts`
- 상세: `pingConnection`은 `assertCredentials`를 가장 먼저 호출하여 `mall_id` 누락 시 `Cafe24IncompleteCredentialsError`를 throw한다. 이 경우 함수가 예외를 던지는지, 아니면 `IntegrationTestResult`로 변환하여 반환하는지 명확하지 않으며 테스트도 없다. 실제로는 `withIntegrationLock` 내부에서 예외가 그대로 전파될 가능성이 있다.
- 제안: `pingConnection` describe 블록에 다음을 추가한다:
  ```ts
  it('throws Cafe24IncompleteCredentialsError when mall_id is missing', async () => {
    const integration = makeIntegration({ credentials: { app_type: 'public' } });
    await expect(client.pingConnection(integration)).rejects.toBeInstanceOf(
      Cafe24IncompleteCredentialsError,
    );
  });
  ```
  또는 설계 의도가 "절대 throw하지 않는다"면 구현과 함께 명시적으로 catch해야 한다.

---

### [WARNING] `rawPing` transport 실패 후 abort timer 정리 검증 없음
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `rawPing()` 내 `setTimeout`/`clearTimeout` 처리
- 상세: `rawPing`은 30초 AbortController 타이머를 생성하고 `finally`에서 `clearTimeout`을 호출한다. 그러나 `transport failure` 테스트(`'transport failure — returns failure WITHOUT incrementing...'`)는 mock reject 후 timer 정리 여부를 검증하지 않는다. `fetchMock.mockRejectedValueOnce`가 즉시 reject되므로 `clearTimeout`이 항상 실행되긴 하나, `AbortSignal` 관련 동작(예: timeout이 먼저 발화하는 경우)은 전혀 테스트되지 않는다.
- 제안: AbortController timeout 발화 케이스를 별도 테스트로 추가하거나, `rawPing`을 내부 유닛으로 분리하여 타이머 동작을 단독으로 검증한다.

---

### [WARNING] `pingConnection` 재시도 후 403 응답 시 `markAuthFailed` 호출 여부 불명확 테스트
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 717번 라인 — `if (second.status === 401 || second.status === 403)` / `cafe24-api.client.spec.ts`
- 상세: 현재 테스트는 403이 첫 번째 시도일 때만 검증한다(`'403 — returns failure but does NOT mark auth_failed'`). 그런데 구현 코드를 보면 두 번째 시도(재시도) 후 403이 오는 경우(`second.status === 403`)에는 `markAuthFailed`를 호출한다. 이 경로는 첫 번째 403의 "status 격하 없음" 동작과 정반대이며, 테스트가 없어 혼동을 준다.
- 제안: 다음 케이스를 추가한다:
  ```ts
  it('401 → refresh → retry 403 — markAuthFailed IS called (second-attempt 403 is definitive)', async () => { ... });
  ```

---

### [INFO] `'falls through to dispatchTest when no entity tester is registered'` 테스트 — 성공 이유가 불명확
- 위치: `backend/src/modules/integrations/integrations.service.spec.ts` — 92~111번 라인
- 상세: 이 테스트는 `result.success`가 `true`임만 확인한다. 테스트 이름은 "dispatchTest로 fallback"을 의도하지만, 실제로 `dispatchTest`가 호출됐는지 확인하지 않는다. `IntegrationsService`의 `dispatchTest` 내부 구현이 변경되어 다른 이유로 `success: true`를 반환해도 테스트는 통과한다. 의도를 명확히 표현하지 못한다.
- 제안: `dispatchTest`(또는 내부의 transportTesters) 호출 여부를 spy로 확인하거나, 최소한 주석으로 "cafe24 tester 없음 → google 기본 structural tester 동작"임을 명시한다. 혹은 테스트 이름을 `'returns structural success when no entity tester is registered'`로 변경해 의도를 정직하게 표현한다.

---

### [INFO] `process.env` 직접 조작 — 테스트 격리 잠재적 위험
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — 여러 테스트에서 `process.env.CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 직접 설정·삭제
- 상세: 각 테스트에서 `process.env`를 직접 설정하고 테스트 끝에 `delete`로 정리한다. 테스트 중 예외가 발생하면 `delete` 라인에 도달하지 못해 환경 변수가 오염된 채로 다음 테스트로 진행될 수 있다. Jest는 기본적으로 동일 프로세스에서 테스트를 직렬 실행하므로 누출 가능성이 있다.
- 제안: `afterEach`에서 환경 변수를 정리하거나, `jest.replaceProperty` / `process.env` 전체를 `beforeEach`에서 저장·복원하는 패턴을 사용한다:
  ```ts
  let originalEnv: NodeJS.ProcessEnv;
  beforeEach(() => { originalEnv = { ...process.env }; });
  afterEach(() => { process.env = originalEnv; });
  ```

---

### [INFO] `freshIntegration()` 헬퍼 — `consecutiveNetworkFailures` 초기값 명시 없음
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — `freshIntegration()` 함수 및 `transport failure` 테스트
- 상세: `transport failure` 테스트에서 `integration.consecutiveNetworkFailures = 0`을 명시적으로 설정하는데, `freshIntegration()`이 이 필드를 포함하지 않아 테스트 코드에서 반복적으로 직접 설정해야 한다. 이 필드가 중요한 불변 조건임에도 헬퍼에서 누락되어 있다.
- 제안: `freshIntegration()`이 반환하는 객체에 `consecutiveNetworkFailures: 0`을 포함하거나, `makeIntegration` 기본값에 추가한다.

---

### [INFO] e2e 테스트 추가 필요성 — `POST /api/integrations/:id/test` cafe24 분기
- 위치: 변경 범위 전체 (unit 테스트만 존재)
- 상세: 이번 변경은 실제 API를 호출하는 연결 테스트 기능이며, HTTP 레이어부터 `Cafe24Module` 등록, `IntegrationsService`, `Cafe24ApiClient.pingConnection`까지의 전체 흐름이 연결되어야 동작한다. 현재 unit 테스트는 각 계층을 독립적으로 검증하지만, `Cafe24Module.onModuleInit`의 등록이 실제 NestJS 컨테이너 초기화에서 올바르게 작동하는지는 e2e 테스트 없이 보장하기 어렵다.
- 제안: 프로젝트의 `docker-compose.e2e.yml` 기반 e2e 인프라를 활용해 `POST /api/integrations/:id/test` 엔드포인트의 cafe24 분기를 (mock Cafe24 서버를 대상으로) 검증하는 e2e 케이스를 추가한다.

---

## 요약

테스트(Testing) 관점에서 이번 변경은 전반적으로 높은 품질을 보인다. `Cafe24ApiClient.pingConnection`에 대해 200 성공, 401→refresh→200 재시도, 401→refresh→401 재시도 실패, refresh 자체 실패, 403 처리, transport 실패, proactive refresh 등 주요 코드 경로를 7개의 명확한 유닛 테스트로 커버하였으며, `IntegrationsService`의 entity-aware tester 등록·우선순위 분기도 2개 케이스로 검증한다. 그러나 몇 가지 커버리지 갭이 존재한다: 재시도 이후 403 응답에서 `markAuthFailed` 호출이 첫 번째 403과 반대 동작임을 검증하는 테스트가 없고, `pingConnection` 내 `assertCredentials` 예외 전파 경로가 미검증이며, `Cafe24Module.onModuleInit` 자체의 테스트가 없다. `process.env` 직접 조작 방식은 예외 발생 시 테스트 격리를 깨뜨릴 수 있어 `afterEach` 정리가 필요하다. "last registration wins" 정책과 fallback dispatchTest 경로도 의도를 더 명확히 표현할 필요가 있다. e2e 계층에서 전체 흐름을 통합 검증하는 케이스가 없는 점은 장기적으로 보완이 필요하다.

## 위험도

MEDIUM
