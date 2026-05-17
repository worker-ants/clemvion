# 유지보수성(Maintainability) 리뷰

리뷰 대상: `cafe24-api.client.spec.ts`, `cafe24-api.client.ts`, `catalog-sync.spec.ts`, `plan/in-progress/cafe24-call-401-retry.md` 외 다수

---

### 발견사항

---

#### cafe24-api.client.spec.ts

- **[WARNING]** `setRefreshClientEnv` / `clearRefreshClientEnv` 헬퍼가 각 테스트 내부에서 수동으로 쌍으로 호출됨
  - 위치: diff +62~+81, 그리고 T-1(+170), T-2(+212), T-3(+243), surface 테스트(+292) 각각의 말미
  - 상세: `setRefreshClientEnv()` 와 `clearRefreshClientEnv()` 는 `process.env` 를 직접 조작하는 부작용 함수다. 각 `it()` 블록 내에서 수동으로 쌍을 맞춰 호출하는 방식은 `clearRefreshClientEnv()` 호출 직전에 테스트가 예외로 종료될 경우 환경 변수가 누적되는 위험이 있다. 또한 새 테스트를 추가할 때 cleanup 을 빠뜨리기 쉽다. `jest` 의 `afterEach` 훅에 cleanup 을 등록하는 것이 일반적인 관용 패턴이다.
  - 제안: `describe('auth failure')` 블록 상단에 `afterEach(() => { delete process.env.CAFE24_CLIENT_ID; delete process.env.CAFE24_CLIENT_SECRET; })` 를 추가하고, 각 `it()` 말미의 `clearRefreshClientEnv()` 호출을 제거한다. `setRefreshClientEnv()` 는 각 테스트 진입부에서 유지한다.

- **[WARNING]** `wireRefreshTransaction` 헬퍼가 `describe('auth failure')` 스코프의 내부 함수로 선언되어 있어 재사용성과 위치 파악이 어려움
  - 위치: diff +46~+56
  - 상세: `wireRefreshTransaction` 은 `describe('token refresh')` 스위트가 이미 유사한 트랜잭션 wiring 을 사용하는 것으로 보인다(프롬프트 내 언급). 두 `describe` 블록이 각각 독립적으로 동일 mock 패턴을 설정하면 중복 코드가 발생하고, 향후 `dataSource.transaction` 의 시그니처가 변경될 때 두 곳을 함께 갱신해야 한다. `describe('auth failure')` 내부의 nested 함수로 두면 스위트 외부에서 재사용이 불가하다.
  - 제안: `wireRefreshTransaction` 을 파일 최상위 헬퍼 섹션(기존 `makeIntegration`, `makeJsonResponse` 등이 위치하는 영역)으로 올리거나, `token refresh` 스위트와 공유하는 공통 fixture factory 파일로 분리한다.

- **[INFO]** T-1 테스트의 `errorUpdates` 필터링 로직이 인라인으로 작성되어 있어 의도 파악이 지연됨
  - 위치: diff +162~+168
  - 상세: `repo.update.mock.calls.filter(...)` 에서 `c[1] !== null`, `typeof c[1] === 'object'`, `(c[1] as { status?: string }).status === 'error'` 를 모두 인라인으로 작성하고 있다. 이 로직이 "status='error' 인 업데이트 호출이 없었음을 검증한다"는 의도를 코드에서 바로 읽기 어렵다.
  - 제안: `const wasMarkAuthFailedCalled = repo.update.mock.calls.some(...)` 과 같이 의미 있는 변수명으로 추출하거나, `expect(repo.update).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'error' }))` 패턴으로 단순화한다.

- **[INFO]** 테스트 케이스 T-1의 3단계 fetch mock 주석이 한국어·영어 혼용
  - 위치: diff +116~+131
  - 상세: `// (1) 1차 API 401 — race window. (2) refresh 200. (3) 재시도 API 200.` 는 한국어와 영어가 섞여 있고, 인라인 주석과 분리된 `// 2번째 fetch 는 ...` 주석이 반복된다. 주석 스타일이 동일 블록 내에서 일관되지 않다.
  - 제안: 프로젝트의 기존 주석 언어 컨벤션(한국어 또는 영어)에 맞춰 일관되게 통일한다.

---

#### cafe24-api.client.ts

- **[WARNING]** `executeWithRateLimit` 의 `triedAuthRetry` 파라미터가 boolean default 인자로 추가되어 함수 시그니처가 묵시적 선택 인자를 갖게 됨
  - 위치: diff +383 (`triedAuthRetry: boolean = false`)
  - 상세: `executeWithRateLimit` 는 `private` 메서드이지만, 자기 재귀 호출 시 6번째 인자로 `true` 를 명시적으로 전달한다(diff +421). 다른 모든 외부 호출 지점은 `triedAuthRetry` 를 생략한다. 함수 인자가 늘어날수록 호출 지점에서 순서를 착각하기 쉽고, 특히 `attempt: number` 와 `triedAuthRetry: boolean` 이 나란히 있으면 의미 구분이 불분명하다. 또한 재귀 재시도 경로에서 `attempt` 를 `0` 으로 리셋하는 것(diff +420)과 `triedAuthRetry: true` 를 전달하는 것이 두 개의 별개 제어 흐름을 혼합하고 있어 읽는 데 인지 부하가 있다.
  - 제안: 재시도 전용 private 메서드 `executeRetryAfterRefresh(integration, mallId, opts): Promise<Cafe24CallResult>` 로 추출하여 "재시도 경로"를 별도 메서드로 분리한다. 이렇게 하면 `triedAuthRetry` 파라미터가 필요 없어지고, 재귀 호출 지점에서 의도가 명확해진다.

- **[INFO]** 401 자가 회복 분기 블록 안의 주석이 매우 길어 코드 가독성을 저해함
  - 위치: diff +393~+412 (블록 헤드 주석, 10줄 이상)
  - 상세: 인라인 블록 주석이 10줄에 달하며, 구현 상세보다 spec 참조 및 설계 근거를 서술하고 있다. 이 수준의 컨텍스트는 JSDoc 또는 spec 문서에 두는 것이 적합하고, 함수 내부 인라인 주석은 "왜" 에 집중해 3줄 이내로 유지하는 것이 가독성에 유리하다. 현재의 긴 주석은 코드와 주석의 경계를 읽을 때 스크롤이 필요하게 만든다.
  - 제안: 블록 헤드 주석을 2~3줄로 요약하고("Spec §6.1 — race-window 401 시 refresh 후 1회 재시도. 403 및 재시도 401은 즉시 격하."), 나머지 설계 근거는 메서드 JSDoc 또는 spec 문서에 위임한다.

- **[INFO]** `((integration.credentials ?? {}) as Cafe24Credentials).access_token ?? accessToken` 표현이 복잡한 타입 단언을 포함
  - 위치: diff +412~+413
  - 상세: 이중 nullish coalescing + 타입 단언이 한 줄에 결합되어 있다. `Cafe24Credentials` 타입으로의 단언이 빈 객체 `{}` 를 중간에 거치는 구조라 타입 안전성과 가독성이 모두 낮다.
  - 제안: `const refreshedToken = (integration.credentials as Cafe24Credentials | null)?.access_token ?? accessToken;` 으로 단순화하거나, 별도 헬퍼 함수 `getAccessToken(integration, fallback): string` 으로 추출한다.

---

#### catalog-sync.spec.ts

- **[INFO]** `execSync('git rev-parse --show-toplevel', ...)` 호출이 모듈 최상위 레벨에서 동기 실행됨
  - 위치: diff +458~+460
  - 상세: 모듈 로드 시점에 `execSync` 가 실행된다. 이는 테스트 환경이 `git` 실행 파일을 갖추지 않거나 non-git 디렉토리에서 실행될 경우 예외를 발생시킨다. 주석에 설계 의도가 충분히 설명되어 있어 가독성은 양호하나, 예외 처리 없이 동기 호출하는 점은 테스트 셋업 신뢰성을 낮출 수 있다.
  - 제안: `try-catch` 로 감싸거나, 실패 시 `__dirname` 기반 fallback 을 유지하여 graceful degradation 을 제공한다. 또는 `jest.config.ts` 의 `rootDir` 설정을 통해 환경 의존 없이 경로를 주입하는 방법을 고려한다.

---

#### plan/in-progress/cafe24-call-401-retry.md

- **[INFO]** plan 문서의 코드 항목에 "또는 inline" 선택지가 열려 있어 구현 결정이 미확정 상태로 머지될 가능성
  - 위치: diff +531 ("새 helper `tryRefreshAndRetry`(또는 inline) 로 교체")
  - 상세: 실제 구현(`cafe24-api.client.ts`)에서는 inline 방식이 채택되었으나, plan 문서는 여전히 "또는 inline" 으로 미결 상태처럼 읽힌다. plan 과 실제 구현이 일치하지 않으면 추후 리뷰어나 작업자가 혼동을 겪을 수 있다.
  - 제안: 구현 완료 후 plan 해당 항목을 "inline 방식 채택" 으로 확정 기재한다.

---

### 요약

이번 변경의 핵심인 `cafe24-api.client.ts` 의 `executeWithRateLimit` 401 자가 회복 분기 구현은 기존 `pingConnection()` 패턴을 이식한 협소한 수정으로, 전반적인 구조는 기존 코드베이스의 패턴을 잘 따르고 있다. 다만 `triedAuthRetry` boolean 파라미터를 기존 함수 시그니처에 추가함으로써 제어 흐름 복잡도가 소폭 증가했고, 인라인 블록 주석이 과도하게 길어 코드-주석 비율 균형이 깨진 점이 눈에 띈다. 테스트 파일에서는 `setRefreshClientEnv`/`clearRefreshClientEnv` 의 수동 쌍 호출 패턴이 test isolation 위험을 내포하며, 이를 `afterEach` 훅으로 이관하는 것이 가장 영향도 높은 개선이다. `wireRefreshTransaction` 헬퍼의 scope 위치도 재사용성 관점에서 재검토가 권장된다. 전반적으로 코드 가독성과 일관성은 양호하며, 중복 코드나 과도한 중첩은 발견되지 않았다. 발견된 항목들은 버그 위험보다는 장기 유지보수성 저하 요인에 해당하며, CRITICAL 수준의 구조적 문제는 없다.

### 위험도

LOW
