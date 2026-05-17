# 아키텍처(Architecture) 리뷰 결과

**리뷰 대상**: Cafe24 `call()` 401 자동 재시도 구현 (cafe24-401-refresh-a3f2c1)
**주요 파일**:
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

---

### 발견사항

- **[WARNING]** `executeWithRateLimit` 메서드의 단일 책임 원칙(SRP) 부담 가중
  - 위치: `cafe24-api.client.ts` — `executeWithRateLimit()` (line ~989)
  - 상세: 이 메서드는 이번 변경으로 HTTP 실행, rate-limit 재시도, **401 인증 자가 회복 재시도**, 에러 분류(401/403/429/transport), 로그 기록까지 다섯 가지 책임을 동시에 담당하게 되었다. 특히 401 재시도 분기는 `refreshViaQueue` 또는 `refreshAccessToken` 중 하나를 택하는 런타임 조건 분기와 `triedAuthRetry` 플래그를 통한 재귀 깊이 제어를 포함하므로, 메서드 복잡도가 임계점에 가까워졌다. 현재로서는 동작 정확성에 문제는 없지만, 향후 추가 에러 코드(예: 407, 503 재시도 등)가 들어올 경우 이 메서드 하나에 계속 분기가 쌓일 위험이 있다.
  - 제안: `executeWithRateLimit`의 401 자가 회복 로직을 `private async tryRefreshAndRetry(...)` 전용 메서드로 추출하면, `executeWithRateLimit`는 HTTP 실행 + 분기 라우팅에 집중하고 회복 책임은 위임할 수 있다. 현 구현이 `pingConnection` 과 같은 패턴을 공유하지 않고 각자 인라인으로 갖는 구조이므로, 분리 시 두 경로가 동일 helper를 재사용하게 되어 코드 중복도 해소된다.

- **[WARNING]** `triedAuthRetry` boolean 파라미터가 public-facing 시그니처를 오염시키는 구조적 냄새
  - 위치: `cafe24-api.client.ts` `executeWithRateLimit(integration, mallId, accessToken, opts, attempt, triedAuthRetry = false)`
  - 상세: `triedAuthRetry`는 재귀 호출 시 무한 루프를 막기 위한 내부 구현 세부 사항이다. 그러나 `private` 메서드의 파라미터로 노출되어, 내부 재귀 경로가 호출 규약의 일부가 된다. 이 패턴은 외부에서 `triedAuthRetry=true`로 호출하면 401 자가 회복을 우회할 수 있다는 implicit contract를 형성한다. 유사하게 `attempt` 파라미터도 같은 문제(내부 재귀 상태가 시그니처 노출)를 이미 가지고 있어, 이번 변경이 기존 패턴을 따른 것은 일관성 있는 선택이지만, 구조적 부채가 누적된 형태다.
  - 제안: 재귀 상태(attempt, triedAuthRetry)를 파라미터로 넘기는 대신, `ExecuteContext` 또는 `RetryState` 타입의 단일 내부 객체로 묶어 전달하거나, 재귀를 명시적 루프(while loop + state machine)로 변환하면 시그니처가 단순해지고 상태 관리가 명확해진다. 단기 개선으로는 두 파라미터를 `private` options 객체로 합쳐 시그니처 노출을 최소화할 수 있다.

- **[INFO]** `pingConnection`과 `executeWithRateLimit`의 401 회복 로직 중복 — 추상화 기회
  - 위치: `cafe24-api.client.ts` `pingConnection()` (line ~359) vs `executeWithRateLimit()` (line ~1124)
  - 상세: 두 메서드 모두 `401 → refreshViaQueue-or-refreshAccessToken → 1회 재시도` 패턴을 독립적으로 인라인 구현한다. 핵심 불변식(BullMQ가 있으면 큐 경유, 없으면 직접 호출; 재시도 1회 상한; refresh 실패 시 throw propagation)이 동일하지만 코드가 분리되어 있다. 향후 정책 변경(예: 재시도 횟수 조정, refresh 경로 추가) 시 두 곳을 동시에 수정해야 하므로 동기화 실패 위험이 있다.
  - 제안: 공통 로직을 `private async performAuthRefresh(integration: Integration): Promise<void>` 형태의 단일 helper로 추출하고, `pingConnection`과 `executeWithRateLimit` 양쪽에서 이를 호출하도록 리팩토링. 이렇게 하면 refresh 정책의 단일 진실(SoT)이 코드 수준에서도 확보된다.

- **[INFO]** `catalog-sync.spec.ts`의 `execSync('git rev-parse ...')` — 테스트 환경 결합도
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` (신규 추가 line)
  - 상세: 테스트 파일이 `git` 명령 실행에 의존하는 구조는 테스트를 git 환경에 결합시킨다. CI/CD 환경에서 git이 설치되지 않거나 shallow clone인 경우 `execSync`가 실패할 수 있다. 또한 이 테스트는 `spec/` 디렉터리의 실제 파일 존재에도 의존하므로, 레포지토리 루트 기준 파일 시스템 의존성을 런타임에 해소하는 방식이다. worktree 환경 지원을 위한 실용적 선택이나, 테스트 계층의 경계(unit 테스트가 git CLI에 의존)가 흐려진다.
  - 제안: 환경 변수(`process.env.REPO_ROOT`) 또는 빌드 타임 상수로 레포지토리 루트를 주입하는 방식을 고려. 이를 통해 테스트가 git 런타임 없이도 동작할 수 있고, worktree 환경에서의 경로 해소도 동일하게 처리된다. 단기적으로는 `execSync` 실패 시 `__dirname` 기반 fallback을 제공하는 방어 코드를 추가하는 것이 현실적.

- **[INFO]** 401 회복 분기의 `refreshedToken` 추출 로직 — 암묵적 계약
  - 위치: `cafe24-api.client.ts` `executeWithRateLimit()` line ~1132
  - 상세: `const refreshedToken = ((integration.credentials ?? {}) as Cafe24Credentials).access_token ?? accessToken;` 패턴은 `refreshViaQueue` 또는 `refreshAccessToken`이 `integration.credentials`를 갱신한다는 부작용(side-effect)에 암묵적으로 의존한다. 이 계약이 깨지면(refresh 함수가 credentials 대신 다른 방식으로 토큰을 저장하는 경우) refreshedToken이 stale token으로 폴백되어 재시도가 동일 토큰으로 진행되는 무성한 버그가 발생한다. 현재 구현이 정확하더라도, 계약이 코드 어디에도 명시적으로 표현되지 않는다.
  - 제안: `refreshViaQueue`/`refreshAccessToken` 반환값으로 새 access_token을 명시적으로 돌려주거나, refresh 완료 후 `integration.credentials`에서 토큰을 읽는 것이 의도임을 JSDoc에 명시. `pingConnection`의 동일 패턴과 일치시켜 두 곳의 암묵적 계약을 동기화.

- **[INFO]** 테스트 헬퍼 함수(`wireRefreshTransaction`, `setRefreshClientEnv`, `clearRefreshClientEnv`)가 `describe('auth failure')` 블록 내부 지역 함수로 정의
  - 위치: `cafe24-api.client.spec.ts` `describe('auth failure')` 블록 내 line ~42-81
  - 상세: 이 세 헬퍼는 `token refresh` describe 블록의 유사 셋업 코드와 목적이 중복된다. 현재 위치(auth failure 블록 내부 지역)에서는 auth failure 테스트에만 사용 가능하며, 향후 동일 패턴이 필요한 다른 describe 블록이 생기면 복사가 불가피하다. 테스트 파일 수준의 응집도 관점에서 공유 헬퍼를 상위 스코프 또는 별도 test helper 파일로 분리하는 것이 바람직하다.
  - 제안: 파일 상단 또는 `describe('Cafe24ApiClient')` 블록 상단으로 끌어올리거나, `test-helpers/cafe24-auth.ts` 형태의 별도 파일로 추출. `afterEach`에서 `clearRefreshClientEnv()`를 자동 호출하도록 훅으로 등록하면 명시적 `clearRefreshClientEnv()` 호출 누락 위험도 제거된다.

---

### 요약

이번 변경은 `Cafe24ApiClient.executeWithRateLimit()`에 401 자가 회복 재시도 로직을 추가하고, 대응하는 테스트 케이스(T-1~T-5)를 spec 기반으로 작성하였다. 아키텍처 관점에서 핵심 우려 사항은 두 가지다. 첫째, `executeWithRateLimit`가 HTTP 실행, rate-limit 재시도, 인증 자가 회복, 에러 분류를 모두 담당하게 되어 SRP 부담이 임계점에 도달했다. 둘째, `pingConnection`과 `executeWithRateLimit`가 동일한 401 회복 패턴을 독립적으로 인라인 구현하여 DRY 원칙이 위반되고 있으며, 향후 정책 변경 시 동기화 실패 위험이 있다. `triedAuthRetry` boolean이 재귀 제어 목적으로 메서드 시그니처에 노출되는 것 역시 내부 구현 세부가 계약으로 굳어지는 추상화 누수다. 이번 변경 자체는 기존 `pingConnection` 패턴과 정합하며 무한 재귀 차단 및 403 분기 불변 유지라는 설계 제약이 잘 지켜졌으나, 중복 추상화 기회를 현 PR에서 함께 해소하지 않으면 동일 패턴이 세 번째 호출 경로에도 복사될 가능성이 높다.

### 위험도

MEDIUM
