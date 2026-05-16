# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `formatAuthFailure`가 `mallId`와 Cafe24 응답 바디의 일부를 오류 메시지에 포함
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `formatAuthFailure()` (라인 425–433), `pingConnection()` 라인 342, 385
  - 상세: `formatAuthFailure`는 `Cafe24 authentication failed (${status}) for mall ${mallId} — ${summary}` 형태의 메시지를 반환하며, 이 메시지가 `pingConnection`의 반환값 `message` 필드에 직접 실린다. `summarizeCafe24ErrorBody`는 Cafe24 응답 바디에서 `error_code`, `error_message`, `error_description`, `message` 필드를 추출해 200자 이내로 잘라 포함한다. 이 `message` 값은 `IntegrationsService.testConnection`을 통해 API 응답으로 클라이언트에 전달될 가능성이 있다. `mallId`는 도메인 식별자로서 자체는 비밀이 아니지만, Cafe24 응답 바디가 예상치 못한 민감 정보(예: 에러 본문에 토큰 조각 echo)를 포함할 경우 클라이언트에 노출될 수 있다. 한편, 로그 경로에는 `sanitizeLastErrorMessage`가 적용되어 있어 로그 측 보호는 적절하다.
  - 제안: `pingConnection` 반환 메시지에도 `sanitizeLastErrorMessage`를 적용하거나, 별도의 경량 sanitize 패스(`Bearer`, `access_token=`, `client_secret=` 등 패턴 마스킹)를 `formatAuthFailure` 또는 호출 지점에 추가한다. 현재 로그에는 sanitize가 적용되지만 API 응답 메시지에는 미적용 상태이므로 일관성을 맞추는 것이 좋다.

- **[INFO]** 테스트 코드에서 `process.env` 환경변수를 직접 설정·삭제
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — 라인 312–313, 376–377, 383–384, 432–433, 438–439, 467–468, 527–528, 565–566
  - 상세: 테스트 케이스 내에서 `process.env.CAFE24_CLIENT_ID = 'env-id'`와 `process.env.CAFE24_CLIENT_SECRET = 'env-secret'`를 직접 할당하고 테스트 종료 시 `delete process.env.*`로 정리한다. 이 패턴은 테스트 케이스 사이에서 환경변수가 정리되지 않을 수 있는 경쟁 조건(예: 비동기 테스트 실패 시 finally 없이 delete 건너뜀)과, 테스트 파일이 병렬 실행될 경우 전역 `process.env` 오염 위험이 있다. 프로덕션 코드가 아닌 테스트 코드이므로 CRITICAL은 아니지만, 테스트 격리성 문제는 보안 신뢰성에 간접 영향을 줄 수 있다.
  - 제안: `jest.spyOn(process.env, ...)` 대신 `afterEach`/`afterAll`에서 정리하거나, `jest.replaceProperty`나 mock 모듈로 환경변수 주입을 격리한다. 최소한 각 케이스의 `try/finally`로 정리 보장을 명시한다.

- **[INFO]** `registerEntityTester`에 접근 제한이 없어 런타임에 임의 모듈이 등록 가능
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — 라인 197–199
  - 상세: `registerEntityTester(serviceType: string, tester: EntityAwareTester): void`는 `public` 메서드로, NestJS DI 컨텍스트 내에서 `IntegrationsService` 인스턴스에 접근할 수 있는 모든 모듈이 임의의 `serviceType`에 대한 테스터를 덮어쓸 수 있다(`Last registration wins` 정책). 현재 프로젝트 구조에서 DI 경계 밖에서 이를 호출하는 경로는 없지만, 악의적인 또는 실수로 작성된 모듈이 기존 tester를 대체하면 연결 테스트가 의도하지 않은 외부 호출을 수행할 수 있다. 특히 `entityTester`는 실제 DB 엔티티(`Integration` row)를 인자로 받아 호출되므로, 잘못 등록된 tester는 토큰 값에 접근할 수 있다.
  - 제안: 최초 1회 등록만 허용하는 "register-once" 정책을 추가하거나(중복 등록 시 경고/예외), allowlist에 정의된 `serviceType`만 등록 허용하는 가드를 추가한다. 또는 메서드 레벨의 주석으로 `@internal`을 명시하고, 테스트 환경에서만 재등록을 허용하는 플래그를 둔다.

- **[INFO]** `withIntegrationLock`이 제공하는 잠금 범위와 `rawPing` 타임아웃의 조합
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection()` 라인 295, `rawPing()` 라인 404
  - 상세: `pingConnection`은 `withIntegrationLock`으로 integration 단위 잠금 내에서 실행되며, `rawPing`은 30초 `AbortController` 타임아웃을 설정한다. 두 번의 `rawPing`(초기 + 재시도) 과 사이에 `refreshAccessToken`까지 포함하면 잠금 최대 보유 시간이 이론상 90초 이상이 될 수 있다. 과도하게 긴 잠금은 동일 integration에 대한 다른 노드 실행을 지연시켜 간접적인 DoS 효과를 낼 수 있다. 이는 DoS 취약점 범주에 속하지만, 진단용 "사용자 직접 호출" 경로라는 점에서 위험도는 낮다.
  - 제안: 진단 핑 전체에 대한 별도의 상위 타임아웃(예: 60초)을 설정하거나, `rawPing` 개별 타임아웃을 15초로 단축해 최악의 잠금 보유 시간을 줄인다.

## 요약

이번 변경(`Cafe24ApiClient.pingConnection` 추가 + `IntegrationsService.registerEntityTester` 패턴)은 전반적으로 보안을 의식한 설계로 작성되어 있다. 로그 경로에서 `sanitizeLastErrorMessage`를 적용해 토큰 조각 노출을 방지하고, transport 실패를 `consecutive_network_failures` 카운터에서 분리해 사이드 이펙트를 최소화했다. 401 재시도 전략도 진단 목적과 운영 상태 보호의 균형을 잘 잡았다. 주요 잠재적 우려 사항은 `formatAuthFailure`가 반환하는 오류 메시지가 API 응답에 실릴 때 `sanitizeLastErrorMessage` 없이 그대로 전달되는 경로, `registerEntityTester`의 last-write-wins 정책이 모듈 경계 오용 시 tester 교체로 이어질 수 있는 점, 그리고 테스트 코드에서 `process.env`를 직접 조작할 때의 격리 미흡이다. 하드코딩된 시크릿, SQL 인젝션, XSS, 경로 탐색 등의 OWASP Top 10 고위험 취약점은 발견되지 않았다.

## 위험도

LOW
