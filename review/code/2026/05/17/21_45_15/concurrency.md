### 발견사항

- **[WARNING]** 401 자가 회복 재시도 경로에서 `refreshViaQueue` 와 `refreshAccessToken` 간 경쟁 조건 가능성
  - 위치: `cafe24-api.client.ts` 추가된 401 분기 (diff +407~+426)
  - 상세: `refreshViaQueue` 경로는 BullMQ의 jobId dedup 으로 클러스터 전체 직렬화가 보장된다. 그러나 큐가 없을 때 fallback 하는 `refreshAccessToken` 경로는 in-process 동기화에만 의존한다. 다중 인스턴스(수평 확장) 환경에서 두 인스턴스가 동시에 401을 받아 각각 `refreshAccessToken` 을 호출하면 refresh_token 을 두 번 소진할 수 있다. Cafe24의 refresh_token은 단발성(1회 사용 후 무효화)이므로, 선착 인스턴스가 먼저 새 토큰을 저장하고 후착 인스턴스가 구 refresh_token으로 다시 요청하면 "invalid_grant" 가 발생해 의도치 않은 `markAuthFailed` 로 이어질 수 있다.
  - 제안: plan의 "비목표" 절에서도 `refreshViaQueue` jobId dedup 으로 이미 보호된다고 명시하고 있다. 그러나 해당 보호는 큐가 바인딩된 경우에만 적용된다. 프로덕션에서 큐 없이 배포하는 시나리오가 없다면 실제 위험도는 낮으나, `refreshAccessToken` 경로에 낙관적 락(DB 레벨의 CAS 또는 조건부 업데이트)이 없는 경우 이를 문서로 명시하거나, 해당 fallback 경로를 프로덕션에서 사용 금지로 제한하는 가드를 추가하는 것이 안전하다.

- **[WARNING]** `process.env` 전역 상태 변이가 테스트 병렬 실행 시 다른 테스트에 누출될 위험
  - 위치: `cafe24-api.client.spec.ts` `setRefreshClientEnv()` / `clearRefreshClientEnv()` (diff +65~+84)
  - 상세: `process.env.CAFE24_CLIENT_ID` 와 `process.env.CAFE24_CLIENT_SECRET` 은 Node.js 프로세스 전역 상태다. `setRefreshClientEnv()`/`clearRefreshClientEnv()` 는 `afterEach` 훅이 아니라 각 테스트 본문 마지막에 수동으로 호출한다. 테스트가 중간에 예외를 던지거나 `await` 이전에 실패하면 `clearRefreshClientEnv()` 가 호출되지 않아 환경변수가 오염된 채로 남는다. Jest 워커가 테스트를 병렬로 실행하는 경우(--runInBand 미사용) 다른 test file 에도 영향을 미칠 수 있다.
  - 제안: 각 테스트 `it` 블록 안에서 `setRefreshClientEnv()`/`clearRefreshClientEnv()` 를 쌍으로 호출하는 대신, `describe('auth failure')` 블록의 `beforeEach`/`afterEach` 훅으로 이동하거나, `afterEach(() => { delete process.env.CAFE24_CLIENT_ID; delete process.env.CAFE24_CLIENT_SECRET; })` 를 해당 `describe` 블록에 추가해 실패 시에도 정리를 보장해야 한다.

- **[INFO]** `executeWithRateLimit` 재귀 호출 시 `attempt` 인자를 `0` 으로 리셋하는 설계
  - 위치: `cafe24-api.client.ts` diff +418~+425 (`return this.executeWithRateLimit(integration, mallId, refreshedToken, opts, 0, true)`)
  - 상세: 401 재시도 시 `attempt=0` 으로 리셋하는 것은 429 retry 카운터와 401 retry 가 별개 개념임을 명시한 것이다. 기능적으로는 올바르다. 단, 재시도 콜 내부에서 429 rate limit 에 걸렸을 때 attempt 가 다시 최대치까지 소진될 수 있어, 최악 케이스 소요 시간이 `(401 retry 1회) × (429 최대 attempt 수)` 로 곱해질 수 있다. 이는 설계상 의도된 동작일 수 있으나 운영 타임아웃과 연계해 검토가 필요하다.
  - 제안: 현재 구조를 유지한다면 코드 주석에 "재시도 내 429 backoff 도 완전히 소진될 수 있다"는 worst-case 를 명시하는 것이 좋다. 더 엄격하게 제한하려면 `triedAuthRetry=true` 일 때 attempt 상한을 낮추는 방법도 고려할 수 있다.

- **[INFO]** `catalog-sync.spec.ts` 의 `execSync` 동기 호출은 이벤트 루프 블로킹이나 비동기 문제를 일으키지 않음
  - 위치: `catalog-sync.spec.ts` diff +461~+463
  - 상세: `execSync('git rev-parse --show-toplevel')` 는 모듈 최상위(모듈 초기화 시점)에서 단 1회 동기적으로 실행된다. Jest 환경의 테스트 파일 로딩 타임에 이뤄지므로 비동기 컨텍스트 문제는 없다. 동시성 이슈 없음.
  - 제안: 해당 없음.

### 요약

변경된 코드의 핵심은 `executeWithRateLimit()` 에 401 자가 회복(refresh + 1회 재시도) 패턴을 추가한 것이다. 동시성 측면에서 가장 주목해야 할 부분은 두 가지다. 첫째, 큐(BullMQ)가 바인딩된 경우 `refreshViaQueue` 의 jobId dedup 이 클러스터 전체 직렬화를 보장하므로 안전하지만, 큐가 없을 때 fallback 하는 `refreshAccessToken` 경로는 다중 인스턴스에서 refresh_token 이중 소진 위험이 잠재한다(단, 프로덕션에서 큐 없이 운영하지 않는다면 실질 위험도는 낮다). 둘째, 테스트 코드의 `process.env` 변이가 `afterEach` 훅이 아닌 테스트 본문 끝에서 정리되므로, 테스트 실패 시 환경변수 오염이 후속 테스트에 누출될 수 있다. 이 점은 테스트 격리 원칙 위반으로 수정이 권장된다. `triedAuthRetry` boolean flag 를 통한 무한 재귀 방지는 명확하고 올바르게 구현되어 있다.

### 위험도
LOW
