# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `pingConnection` 내 credentials 객체 이중 접근 및 불필요한 재구성
  - 위치: `cafe24-api.client.ts` — `pingConnection` 메서드 내 `tokenAfterProactive` 계산 구간 (라인 660-663)
  - 상세: `creds`를 이미 `(integration.credentials ?? {}) as Cafe24Credentials`로 구성했음에도 동일 표현식을 한 번 더 반복해 `tokenAfterProactive`를 추출하고 있다. proactive refresh 이후 갱신된 토큰을 읽으려는 의도는 이해되지만, `integration.credentials`를 다시 캐스팅하는 표현이 중복되어 있고, `creds` 로컬 변수가 stale 해지는 구조적 혼란을 유발한다. 소규모 오버헤드이지만 코드 명확성 저하가 성능 버그 예방에도 영향을 미친다.
  - 제안: `ensureFreshToken` 호출 후 `creds` 참조를 재취득하거나(`const freshCreds = integration.credentials as Cafe24Credentials`), `integration.credentials`를 단일 소스로 통일해 불필요한 중복 표현을 제거한다.

- **[INFO]** `rawPing` 내 타임아웃 타이머가 Happy-path에서 즉시 해제되지 않을 수 있는 구조
  - 위치: `cafe24-api.client.ts` — `rawPing` 메서드 내 `AbortController` + `setTimeout` 블록 (라인 742-757)
  - 상세: `finally { clearTimeout(timer) }` 패턴은 올바르게 구현되어 있으나, `response.ok` 확인 이후 `safeReadJson(response)` 호출 시점에는 `controller`가 이미 정리된 상태다. 별도 이슈는 없으나, 타임아웃 30초는 사용자 대면 연결 테스트로서 다소 길다. UI가 30초 동안 응답을 기다릴 경우 체감 성능이 저하된다.
  - 제안: 사용자 진단 목적의 ping이므로 타임아웃을 10~15초로 단축하는 것을 검토한다. 서비스 SLA와 Cafe24 API 평균 응답 시간을 기준으로 조정한다.

- **[INFO]** `withIntegrationLock` 래핑으로 인한 잠재적 직렬화 병목
  - 위치: `cafe24-api.client.ts` — `pingConnection` 진입부 (라인 633)
  - 상세: `pingConnection` 전체가 `withIntegrationLock(integration.id, ...)` 안에서 실행된다. 이 락이 노드 실행 경로(`call()`, `executeWithRateLimit`)와 동일한 락을 공유한다면, 사용자가 연결 테스트 버튼을 누르는 동안 해당 integration의 노드 실행이 직렬화된다. 연결 테스트가 최대 3회의 외부 HTTP 왕복(proactive refresh + 첫 ping + 재시도 refresh + 두 번째 ping)을 포함할 수 있어 락 보유 시간이 길어진다.
  - 제안: `withIntegrationLock`이 노드 실행과 진단 호출에 동일한 락 키를 사용하는지 확인한다. 진단 전용 락 네임스페이스(`ping:${integration.id}`)를 분리하거나, 노드 실행과의 상호배제가 실제로 필요한지 검토한다. 필요하지 않다면 락 없이 직접 실행해 불필요한 직렬화를 제거한다.

- **[INFO]** `onModuleInit`에서 클로저 할당으로 인한 함수 객체 재생성 없음 — 적절한 설계
  - 위치: `cafe24.module.ts` — `onModuleInit` (라인 862-875)
  - 상세: 모듈 초기화 시 단 한 번 클로저를 생성해 `entityTesters` Map에 등록한다. 이후 요청마다 새 함수 객체가 생성되지 않으므로 메모리 할당 측면에서 올바른 구현이다. 특이사항 없음.
  - 제안: 현재 구현 유지.

- **[INFO]** `entityTesters` Map 조회 — O(1)이나 `service_type` 문자열 키 비교 시 불필요한 오버헤드 가능성은 없음
  - 위치: `integrations.service.ts` — `testConnection` 내 `this.entityTesters.get(entity.serviceType)` (라인 210)
  - 상세: Map을 통한 단순 O(1) 조회이며 성능 이슈 없다. 등록된 tester가 없을 때 `dispatchTest`로 자연스럽게 폴백하는 구조도 추가 연산 없이 처리된다.
  - 제안: 현재 구현 유지.

- **[WARNING]** `pingConnection` 최악의 경우 최대 4회 외부 HTTP 호출 직렬 실행
  - 위치: `cafe24-api.client.ts` — `pingConnection` 전체 흐름
  - 상세: 토큰이 proactive refresh 윈도우 안에 있고 첫 ping이 401을 반환하는 경우, 다음 4번의 순차 HTTP 호출이 발생한다: (1) `ensureFreshToken` 내부의 refresh 토큰 교환, (2) 첫 `/apps` GET, (3) `refreshAccessToken` 내부의 두 번째 refresh, (4) 두 번째 `/apps` GET 재시도. 이 네 번의 왕복이 모두 직렬로 실행되므로 최악의 경우 총 지연이 `4 × (RTT + Cafe24 처리 시간)`이 된다. 각 호출에 30초 타임아웃이 적용되면 사용자는 최대 120초를 기다릴 수 있다.
  - 제안: 핑 호출 전체에 단일 외부 deadline을 설정한다(예: `AbortSignal.timeout(15_000)`을 `pingConnection` 진입부에서 생성하고 각 rawPing과 fetch 호출에 전달). 이렇게 하면 어떤 분기에서든 총 지연이 한 번의 deadline으로 제한된다.

- **[INFO]** 테스트 코드에서 `process.env` 직접 변조 — 병렬 테스트 실행 시 상태 오염 가능성
  - 위치: `cafe24-api.client.spec.ts` — 401 refresh 시나리오 테스트들 (라인 312-313, 383-384, 438-439 등)
  - 상세: `process.env.CAFE24_CLIENT_ID`와 `CAFE24_CLIENT_SECRET`을 테스트 내에서 직접 설정하고 `delete`로 제거하는 패턴은 Jest의 기본 워커 모델에서는 문제가 없으나, `--runInBand` 없이 병렬 실행 시 테스트 간 환경변수 상태가 공유되어 race condition이 발생할 수 있다. 현재 `afterEach`나 `afterAll` 훅에서 정리되지 않고 각 `it` 블록 끝의 `delete` 문에만 의존하므로, 테스트가 중간에 실패하면 환경변수가 정리되지 않는다.
  - 제안: `beforeEach`/`afterEach` 훅으로 환경변수 설정과 해제를 이동하거나, Jest의 `jest.replaceProperty`를 사용한다. 또는 `process.env` 오염을 방지하는 `jest.resetModules()` + 모듈 재임포트 패턴을 적용한다.

## 요약

이번 변경에서 추가된 `pingConnection` / `rawPing` / `registerEntityTester` 구현은 전반적으로 성능 측면에서 안전한 설계를 따르고 있다. Map 기반 O(1) 조회, `finally` 블록의 타이머 정리, 단일 클로저 등록 등 기본기가 갖춰져 있다. 다만 최악의 경우 4회의 외부 HTTP 호출이 직렬로 수행되는 구조에서 총 레이턴시를 제한하는 단일 deadline이 없다는 점이 사용자 체감 성능 관점에서 가장 주목할 부분이다. rawPing 개별 타임아웃(30초)이 pingConnection 전체에 누적 적용되면 이론상 최대 대기 시간이 과도해진다. 또한 `withIntegrationLock` 공유 여부에 따라 노드 실행과 진단 호출이 의도치 않게 직렬화될 수 있어 검토가 필요하다. 테스트 코드의 `process.env` 직접 변조는 성능 이슈가 아닌 테스트 안정성 문제이나, 실패 시 환경 오염으로 인한 후속 테스트 slowdown을 유발할 수 있어 함께 기재한다.

## 위험도

LOW
