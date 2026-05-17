# 보안(Security) 코드 리뷰

**검토 대상 PR**: Cafe24 `call()` 401 자동 재시도+갱신 (`cafe24-401-refresh-a3f2c1`)
**검토 일시**: 2026-05-17
**검토 범위**: 파일 1~3 (변경된 코드 중 보안 관련 파일)

---

### 발견사항

- **[WARNING]** 테스트 파일에서 `process.env` 에 자격증명을 직접 주입하고 정리하는 패턴의 격리 위험
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — `setRefreshClientEnv()` / `clearRefreshClientEnv()` (diff line 62~81)
  - 상세: 테스트 헬퍼 `setRefreshClientEnv()` 가 `process.env.CAFE24_CLIENT_ID = 'env-id'` / `process.env.CAFE24_CLIENT_SECRET = 'env-secret'` 를 전역 프로세스 환경 변수에 직접 기록한다. 테스트 실행 중 예외 발생으로 `clearRefreshClientEnv()` 가 호출되지 않으면 해당 값이 동일 프로세스 내 후속 테스트 컨텍스트에 누출된다. Jest 는 기본 병렬 worker 모드에서 각 파일을 별도 worker 로 격리하지만, 동일 파일 내 병렬 실행 (`test.concurrent`) 이나 `--runInBand` 모드에서는 ENV 상태가 공유된다. 현재 코드는 각 `it` 블록 안에서 `setRefreshClientEnv` / `clearRefreshClientEnv` 를 수동으로 호�하고 있어, 테스트가 중간에 실패하면 `afterEach`/`afterAll` 없이 cleanup 이 생략될 수 있다.
  - 제안: `beforeEach`/`afterEach` 훅으로 환경 변수 설정·복원을 이전하거나, `jest.replaceProperty(process, 'env', ...)` 또는 `jest.spyOn` 패턴을 사용해 자동 복원을 보장한다. 또는 `beforeAll`/`afterAll` 블록으로 `describe('auth failure')` 전체를 감싸 안전하게 격리한다.

- **[WARNING]** `execSync('git rev-parse --show-toplevel', ...)` — 커맨드 인젝션 위험 부재 확인 필요 (테스트 빌드 환경)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` diff line 8~10
  - 상세: `execSync` 에 고정 문자열 명령을 전달하므로 사용자 제공 입력이 인젝션되는 경로는 없다. 인젝션 취약점 자체는 아니다. 그러나 `execSync` 는 동기 blocking 호출이고 child_process 의 `stdout` 출력에 의존한다. CI 환경에서 git 바이너리가 없거나 worktree 외부에서 실행될 경우 exit code 128 로 프로세스 전체가 비정상 종료된다. 또한 `trim()` 만 적용하므로 경로에 trailing newline 이 남을 경우 이후 `join()` 으로 구성된 파일 경로가 의도치 않은 경로를 가리킬 수 있다(실제로 `trim()` 이 이를 처리하므로 큰 위험은 아님).
  - 제안: 운영 코드가 아닌 테스트 코드이므로 보안 위협 등급은 낮다. 다만 CI 강건성을 위해 `execSync` 호출에 `try/catch` 를 추가하고, git 명령 실패 시 `__dirname` 기반 fallback 경로로 복귀하는 방어 코드를 두는 것을 권장한다.

- **[INFO]** `triedAuthRetry: boolean = false` 기본값 파라미터 — 무한 재귀 차단 메커니즘의 신뢰성
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff line 383, 420~422
  - 상세: 401 자가 회복 로직은 `triedAuthRetry = false` 기본값 파라미터를 통해 재귀를 1회로 제한한다. `executeWithRateLimit` 내부에서 재시도 호출 시 `triedAuthRetry = true` 를 명시적으로 전달한다. 구현 자체는 의도된 단일 재시도 제한을 정확히 구현한다. 그러나 TypeScript 에서 기본값 파라미터는 시그니처 레벨에서만 강제되며, 새로운 호출 경로가 추가될 때 `triedAuthRetry` 를 `false` 로 전달하면 우회된다. 명시적 jsdoc 주석이 이미 존재("true 로 진입하면 다시 401 을 받아도 retry 하지 않고 격하 — 무한 재귀 차단")하여 의도가 문서화되어 있으나, 컴파일 타임 강제 수단은 없다.
  - 제안: 현재 구현은 충분하다. 향후 리팩토링 시 단일 재시도 제한을 타입 레벨에서 강제하려면 내부 private 메서드로 분리하거나 `Symbol`/불투명 타입을 사용하는 것을 고려할 수 있다. 현재 범위에서는 INFO 수준.

- **[INFO]** `refreshedToken` 폴백 시 만료된 `accessToken` 재사용 가능성
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff line 412~414
  - 상세: refresh 성공 후 새 토큰을 추출하는 코드는 `((integration.credentials ?? {}) as Cafe24Credentials).access_token ?? accessToken` 패턴이다. `refreshViaQueue` / `refreshAccessToken` 이 `integration` 객체의 `credentials` 를 in-place 로 갱신하지 않거나, credentials 가 예상치 않은 구조를 가지면 폴백(`?? accessToken`)으로 만료된 원래 토큰이 재사용된다. 이 경우 재시도가 같은 만료 토큰으로 수행되어 또 다시 401 이 발생하지만, `triedAuthRetry = true` 이므로 격하 처리된다. 보안 위협은 아니나 silent fallback 이 디버깅을 어렵게 만들 수 있다.
  - 제안: `access_token` 추출이 `null`/`undefined` 인 경우 warn 로그를 발행하거나, 명시적 예외를 던져 refresh 후 토큰 갱신 실패를 조기에 탐지할 것을 고려한다.

- **[INFO]** 테스트 코드에서 사용하는 Mock 자격증명 값이 의미 있는 단어 ('env-id', 'env-secret')
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` diff line 63~65
  - 상세: 테스트에서 `'env-id'` / `'env-secret'` 는 가짜 fixture 값이며 실제 자격증명과 무관하다. 운영 시스템에서 사용되는 실제 키가 아니므로 하드코딩 시크릿에 해당하지 않는다. 단, 이 값들이 실제 Cafe24 개발자 콘솔의 값과 우연히 일치하지 않도록 `FAKE_ID_FOR_TEST` 등 의도가 명확한 이름을 사용하면 검토 시 혼동을 줄일 수 있다.
  - 제안: 보안 위협 없음. 가독성 향상 차원에서 fixture 값에 `fake-` / `test-` prefix 사용 권장 (강제 아님).

---

### 요약

이번 변경의 핵심은 `cafe24-api.client.ts` 의 `executeWithRateLimit()` 메서드에 401 응답 시 refresh + 1회 재시도 로직을 추가한 것이다. 보안 관점에서 가장 주목할 사항은 두 가지다. 첫째, 테스트 파일에서 `process.env` 에 자격증명 환경 변수를 수동으로 주입하고 정리하는 패턴으로, 테스트 중간 실패 시 cleanup 이 생략되어 동일 프로세스 내 후속 테스트에 값이 누출될 수 있다. 이는 운영 코드의 취약점은 아니지만 테스트 격리 측면에서 WARNING 으로 분류한다. 둘째, `catalog-sync.spec.ts` 에서 도입된 `execSync('git rev-parse --show-toplevel')` 호출은 고정 문자열이므로 커맨드 인젝션 위험은 없으나, git 바이너리 부재 시 프로세스 전체 종료라는 CI 강건성 문제가 있다. 운영 코드인 `cafe24-api.client.ts` 의 401 retry 로직 자체는 재귀 방지(`triedAuthRetry` 플래그), 403 즉시 격하 분리, refresh 후 격하 처리 등 인증 흐름의 보안 정책을 올바르게 구현하고 있다. SQL 인젝션, XSS, LDAP 인젝션, 경로 탐색, 하드코딩 시크릿, 평문 전송 등의 취약점은 변경된 코드 범위 내에서 발견되지 않았다.

### 위험도

LOW
