# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 프로세스 전역 동시 상한(`CONNECTION_TEST_MAX_CONCURRENCY`)이 "서비스 종류를 가리지 않고 공유된다"는 설계 의도를 실제로 검증하는 테스트가 없다 — 같은 서비스(`database`)만 5번 겹쳐 부른 경우만 단언한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:2026` (`` `동시에 도는 연결 테스트는 ${CONNECTION_TEST_MAX_CONCURRENCY}개까지…` `` 테스트, `mockedDbTester.mockImplementation` 은 2031)
  - 상세: `integrations.service.ts:408-411`(`connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`)과 그 위 JSDoc(`integrations.service.ts:113-126`)은 "mcp · email · database · http 가 **같은** 인스턴스를 공유해야 응답 없는 DNS 가 libuv 스레드풀을 채우는 것을 막는다"는 것이 이 상한의 존재 이유라고 명시한다. 그런데 실제 검증 테스트는 `database` 타입 5건만 동시에 걸어 "peak==2"를 확인할 뿐, 예를 들어 `database` 2건 + `http` 1건을 동시에 걸어도 3번째가 대기한다는 것은 보이지 않는다. 만약 누군가 실수로 서비스별로 `pLimit` 을 따로 만들도록 리팩터링해도(= 상한이 서비스마다 개별로 걸리도록 회귀해도) 이 테스트는 여전히 통과한다 — 정작 막으려던 "여러 서비스가 겹쳐 스레드풀을 채우는" 시나리오를 이 테스트가 가리지 못한다.
  - 제안: 같은 concurrency 테스트에서 `mockedDbTester`·`mockedHttpTester`(필요하면 mcp/email 테스터도) 를 함께 동시에 호출하고, 전체 in-flight 합이 2를 넘지 않음(peak 계산을 서비스 무관 공용 카운터로)을 단언하는 케이스를 하나 추가한다.

- **[INFO]** 새로 추출된 공유 모듈 `database-connection.ts`(`buildPgConnection`·`buildMysqlSsl`·`DB_HOST_BLOCKED_MESSAGE`)와 `http-redirect.ts`(`followRedirectsSafely`)에 전용 unit spec 이 없다 — 두 호출자(노드 핸들러·연결 테스터) 쪽 spec 을 통한 간접(transitive) 커버리지뿐이다.
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts` (신규 파일, spec 없음), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (신규 파일, spec 없음)
  - 상세: 두 파일의 JSDoc 은 "노드 실행과 연결 테스트가 **같은 매핑/같은 로직**을 쓰도록" 이라는 계약을 명시적으로 건다(`database-connection.ts:1-9`, `http-redirect.ts` 상단 주석). 이 계약은 지금은 두 호출자 각각의 spec(`database-connection-tester.spec.ts`, `database-query.handler.spec.ts`, `http-connection-tester.spec.ts`, `http-request.handler.spec.ts`)이 각자 다른 각도로 같은 코드를 실행해서 우연히 함께 지켜지고 있다. 둘 중 한쪽 spec 이 나중에 약해지거나 모킹 범위가 넓어지면 공유 모듈의 회귀를 어느 쪽도 못 잡을 수 있다.
  - 제안: 필수는 아니지만, 공유 모듈 자체에 대한 얇은 spec(SSL 매핑 3분기, 리다이렉트 홉 카운트·SSRF 재검증 1~2 케이스)을 두면 "공유"라는 설계 의도를 코드가 아니라 테스트로도 고정할 수 있다.

- **[INFO]** `discardBody`(연결 테스트가 응답 본문을 읽지 않고 취소한다는 명시적 설계)의 실제 호출을 검증하는 단언이 없다.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:92` (`discardBody` 함수), 호출부 `154`
  - 상세: `http-connection-tester.spec.ts` 의 모든 성공/4xx/2xx 케이스는 `result` 값만 보고, `respond()` 로 만든 `Response.body` 가 실제로 `cancel()` 되었는지는 어디서도 확인하지 않는다. `.catch(() => {})` 로 감싸 있어 실패해도 결과에 영향은 없지만, "본문을 읽지 않는다"는 설계 문서화된 동작 자체가 조용히 사라져도(예: `discardBody` 호출 자체를 실수로 지워도) 현재 테스트는 GREEN 을 유지한다.
  - 제안: `jest.spyOn`으로 `Response.prototype.body`의 `cancel` 이 호출됐는지 최소 1개 케이스에서 확인하거나, `discardBody` 를 별도로 export 해 단위 테스트한다.

- **[INFO]** rotate 리팩터링(부분 컬럼 `save`)이후 `broadcastCredentialChange` 호출 인자가 `saved.id` → `entity.id` 로 바뀌었는데, 이를 직접 검증하는 단언이 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1138`
  - 상세: 새로 추가된 rotate 테스트("바꾸는 컬럼만 저장한다")는 `integrationRepo.save` 인자와 응답 DTO 필드만 확인하고, `broadcastCredentialChange`(캐시 무효화 브로드캐스트) 가 올바른 id 로 불렸는지는 보지 않는다. 값 자체는 리팩터링 전후 동일(`entity.id === saved.id`)해서 지금 당장 회귀는 아니지만, 이 함수가 캐시 무효화라는 부작용을 가진 만큼 인자 회귀를 직접 잡는 단언이 없다는 점은 커버리지 갭이다.
  - 제안: 기존 `integration-cache-invalidate.e2e-spec.ts` 가 broadcast 자체는 이미 다루므로 필수는 아니나, unit 레벨에서 `integrationCacheBus.publish`(또는 `broadcastCredentialChange` 스파이) 인자를 한 줄 더 단언해두면 이번 리팩터링의 의도(부분 저장 뒤에도 broadcast 대상 id 는 그대로)가 더 명시적으로 고정된다.

## 요약

Database·HTTP 연결 테스터 두 파일 모두 실패 분기(SSRF 차단·인증 거부·연결 실패·타임아웃·4xx 안내·5xx·리다이렉트 추종/초과/차단·닫기 지연 등)를 성공 케이스와 대칭적으로 촘촘히 커버하며, `jest.useFakeTimers`로 "닫기가 끝나지 않는 서버"까지 결정적으로 재현하고, plan 문서에 실측 뮤테이션 테스트 표(24개 뮤턴트 중 23 RED·1 문서화된 동치 생존)를 남겨 커버리지 주장을 자체 검증했다. `IntegrationsService` 배선 테스트는 `dispatchTest`가 새 테스터로 위임되는지, `PreviewTestResultDto` 계약에 `code` 가 실제로 실리는지, rotate 실패 시 저장이 스킵되는지를 각각 단언하고, e2e 는 preview-test·`:id/test`·rotate 세 경로 모두에서 사설 host 가 실제로 차단됨을 컨테이너 환경에서 확인한다. 회귀 측면에서도 `http-request.handler.ts`의 리다이렉트 로직을 공유 모듈로 뽑아내면서 기존 handler spec 에 정확한 fetch 호출 횟수 단언(off-by-one 방지)을 추가해 두었다. 남은 갭은 대부분 INFO 수준(공유 모듈 전용 spec 부재, `discardBody`/`broadcastCredentialChange` 인자 미검증)이고, 유일하게 실질적인 지적은 "동시 상한이 서비스 종류를 가리지 않고 공유된다"는 핵심 설계 주장을 같은 서비스 반복 호출로만 검증해 서비스별 분리 회귀를 못 잡는다는 점이다.

## 위험도

LOW
