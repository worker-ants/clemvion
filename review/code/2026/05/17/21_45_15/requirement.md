# 요구사항(Requirement) 리뷰

## 발견사항

### [파일 1] cafe24-api.client.spec.ts — 테스트 커버리지

- **[INFO]** T-4 / T-5 (403 즉시 격하 회귀 보호) 가 plan 에 명시되어 있으나 diff 에 없음
  - 위치: `cafe24-api.client.spec.ts` diff (파일 1)
  - 상세: plan 의 테스트 항목 T-4 (403 + insufficient_scope 시그널) / T-5 (403, 시그널 없음) 는 "기존 `auth failure` 테스트의 회귀 보호" 로 분류되어 있다. diff 에는 이 두 케이스를 새로 추가하지 않고 기존 테스트가 존재한다고 전제한다. 기존 테스트(line 300~316, `on 403 + INSUFFICIENT_SCOPE signal`, `on 403 — flips … immediately`)가 실제로 `fetchMock.toHaveBeenCalledTimes(1)` 검증을 포함하도록 보강된 것으로 보이며, plan 의 T-4/T-5 체크박스가 미체크(`[ ]`)로 남아 있어 추적 관점에서 완료 여부가 불명확하다.
  - 제안: diff 의 line 309-310 (`expect(fetchMock).toHaveBeenCalledTimes(1)`) 추가가 T-4를 실질적으로 커버한다. plan 의 T-4/T-5 체크박스를 `[x]` 로 갱신하거나, T-5(non-scope 403) 도 동일한 `toHaveBeenCalledTimes(1)` 검증이 있는지 확인 필요.

- **[INFO]** T-1 에서 `integration.statusReason` null 검증 대상의 초기값 가정
  - 위치: `cafe24-api.client.spec.ts` line 158 (`expect(integration.statusReason).toBeNull()`)
  - 상세: `makeIntegration()` 팩토리가 `statusReason: null` 로 초기화한다고 가정한다. 만약 팩토리 기본값이 `undefined` 이면 `toBeNull()` 이 실패한다. `toBeNull()` 은 정확히 `null` 만 통과하고 `undefined` 는 통과하지 않는다.
  - 제안: `makeIntegration()` 의 `statusReason` 초기값이 `null` 임을 확인하거나, 검증을 `expect(integration.statusReason).toBeFalsy()` 수준으로 완화.

- **[INFO]** `wireRefreshTransaction` / `setRefreshClientEnv` 헬퍼가 `clearRefreshClientEnv` 없이 테스트 격리 가능성
  - 위치: `cafe24-api.client.spec.ts` — helper 함수들
  - 상세: T-1 ~ T-4(401 재시도 관련)는 `setRefreshClientEnv` / `clearRefreshClientEnv` 쌍으로 환경변수를 설정/해제한다. 그러나 `clearRefreshClientEnv` 는 테스트 본문 끝에 명시적 호출로 처리되어 있어, 테스트 중간에 예외가 발생하면 환경변수가 정리되지 않는다. 환경변수 오염으로 후속 테스트가 영향을 받을 수 있다.
  - 제안: `afterEach` 안에서 `clearRefreshClientEnv()` 를 호출하거나, `wireRefreshTransaction` 과 동일하게 `beforeEach`/`afterEach` 블록으로 이동하여 테스트 격리를 보장.

---

### [파일 2] cafe24-api.client.ts — 구현

- **[WARNING]** 새 access_token 추출 경로의 방어 로직 — `integration.credentials` mutation 타이밍 의존
  - 위치: `cafe24-api.client.ts` line 1132-1134
  - 상세: refresh 성공 후 `refreshedToken` 을 가져오는 코드는 다음과 같다.
    ```ts
    const refreshedToken =
      ((integration.credentials ?? {}) as Cafe24Credentials).access_token ??
      accessToken;
    ```
    이 코드는 `refreshViaQueue` 또는 `refreshAccessToken` 이 `integration.credentials` 객체를 in-place 로 갱신한다는 가정에 의존한다. `refreshViaQueue` 경로는 BullMQ worker 가 별도 프로세스에서 실행되므로 job 완료 후 `integration` 객체의 `credentials` 가 갱신되어 있지 않을 수 있다. 이 경우 `integration.credentials.access_token` 이 여전히 만료된 토큰이고, fallback `?? accessToken` 이 역시 만료된 토큰을 사용하여 재시도가 동일한 만료 토큰으로 이루어진다. 재시도가 다시 401 을 받아 T-2 경로(격하)로 진행되지만, 이는 새 토큰으로 재시도하는 의도와 다르다.
  - 제안: `refreshViaQueue` 완료 후 `integration` 객체의 credentials 갱신 여부를 `refreshViaQueue` 구현 쪽에서 보장하는지 확인. 보장되지 않는 경우 `executeWithRateLimit` 호출 직전 DB 에서 최신 credentials 를 재조회하는 단계를 추가하거나, `refreshViaQueue` 가 새 token 을 반환하도록 시그니처 변경 필요.

- **[INFO]** `attempt` 인자를 `0` 으로 리셋하는 의도가 주석에는 명시되었지만 429 retry 카운터와의 독립성을 명확히 확인하지 않음
  - 위치: `cafe24-api.client.ts` line 1135-1142
  - 상세: `executeWithRateLimit(integration, mallId, refreshedToken, opts, 0, true)` 에서 `attempt=0` 으로 리셋한다. 이로 인해 재시도 중 429 가 발생하면 `attempt` 카운터가 0 부터 다시 시작하여 최대 retry 횟수를 다시 소진한다. 이는 "attempt counter 는 새 요청 기준으로 리셋" 이라는 의도와 일치하지만, 재시도 중에 추가 429 루프가 돌 경우 전체 시도 횟수가 예상보다 많아질 수 있다. (예: 1차 요청 429 3회 + refresh + 재시도 429 3회 = 총 7회 fetch)
  - 제안: 의도된 동작이라면 JSDoc 에 "재시도 후 429 는 별도 attempt 카운터로 다시 소진" 임을 명시. 의도가 아니라면 `attempt` 파라미터를 상위 스코프의 총 시도 횟수로 전달하는 방식으로 변경.

- **[INFO]** 401 분기의 fallback 분기(`refreshAccessToken`) 가 테스트 환경에서만 동작하는 방식이지만 프로덕션 코드에 직접 분기로 존재
  - 위치: `cafe24-api.client.ts` line 1125-1128
  - 상세: `if (this.refreshQueue && this.refreshQueueEvents)` 가 false 일 때 `refreshAccessToken` 을 직접 호출한다. 이 fallback 은 "테스트 환경 fallback" 으로 주석에 명시되어 있다. 그러나 큐 없이 배포된 프로덕션 환경에서도 이 경로가 실행될 수 있어, 클러스터 환경에서 race condition 을 유발할 위험이 있다. `pingConnection()` 도 동일 패턴을 사용하므로 일관성은 있지만 잠재 위험은 남는다.
  - 제안: 프로덕션 배포 시 큐가 항상 존재한다면 이 분기를 `if (process.env.NODE_ENV !== 'test')` 가드로 제한하거나, `DI` 로직 상 큐 바인딩이 필수 조건임을 강제하는 검증 추가.

---

### [파일 3] catalog-sync.spec.ts — worktree 경로 해결

- **[INFO]** `execSync('git rev-parse --show-toplevel')` 가 CI 환경에서 git 이 없거나 `.git` 이 없는 경우 테스트 실행 자체를 실패시킬 수 있음
  - 위치: `catalog-sync.spec.ts` line 9-11
  - 상세: `execSync` 는 동기 호출이며 git 바이너리가 없거나 git 저장소 컨텍스트 밖에서 실행되면 예외를 던진다. 테스트 파일 최상위에서 호출되므로 jest 가 파일을 로드하는 순간 실패한다. Docker 기반 CI 중 git 히스토리 없이 checkout 된 환경에서 `--show-toplevel` 이 실패할 수 있다.
  - 제안: `try-catch` 로 감싸고 실패 시 `__dirname` 기반 상대 경로를 fallback 으로 사용하거나, `REPO_ROOT` 를 `process.env.INIT_CWD` 또는 `process.env.npm_config_local_prefix` 로 대체하는 방안 검토.

---

### [파일 4] plan/in-progress/cafe24-call-401-retry.md

- **[WARNING]** 코드 항목 체크박스(`[ ]`)가 모두 미완료 상태이지만 구현이 PR 에 포함됨
  - 위치: `plan/in-progress/cafe24-call-401-retry.md` §작업 항목 §코드
  - 상세: plan 의 코드 항목 4건 (`[ ] executeWithRateLimit 401 분기 교체`, `[ ] 403 분기 그대로`, `[ ] tokenExpiresAt 검토`, `[ ] source label 재사용`) 과 테스트 항목 T-1~T-5 (모두 `[ ]`) 가 미체크 상태다. 실제 구현(`cafe24-api.client.ts` diff) 과 테스트(`cafe24-api.client.spec.ts` diff) 가 PR 에 포함되어 있으므로 이 체크박스들은 완료된 상태다. plan 이 실제 진행 상태를 반영하지 않아 추적 신뢰도가 낮아진다.
  - 제안: PR 머지 전 plan 의 완료된 코드·테스트 항목을 `[x]` 로 갱신. 미완료 항목(§검증)은 그대로 유지.

- **[INFO]** T-3 검증에서 "refresh 가 `markAuthFailed` 를 호출한다"는 전제가 명시되어 있으나 테스트에서 직접 검증하지 않음
  - 위치: `cafe24-api.client.spec.ts` T-3 케이스 (diff line 217-244)
  - 상세: T-3 는 refresh 자체가 401 을 반환할 때 `repo.update` 가 `status='error'` 로 호출되는지 검증한다(line 235-241). 이는 `refreshAccessToken` 내부에서 `markAuthFailed` 가 호출된다는 사실을 간접적으로 검증한다. 그러나 `refreshAccessToken` 의 구현이 바뀌어 `markAuthFailed` 를 호출하지 않게 되면 이 테스트는 실패하는데, 실패 원인이 "refresh 가 markAuthFailed 를 안 부른다" 인지 "executeWithRateLimit 의 새 분기에 문제가 있다" 인지 구분하기 어렵다.
  - 제안: 현재 수준의 통합 검증으로 충분하다. 다만 test 설명(it-string)에 "refreshAccessToken 이 내부적으로 markAuthFailed 를 발사하므로 executeWithRateLimit 재시도 없음" 맥락을 포함하면 의도가 명확해진다.

---

## 요약

이번 변경의 핵심 요구사항인 "Cafe24 `call()` 경로의 401 수신 시 1회 refresh + 재시도" 는 `cafe24-api.client.ts` 의 `executeWithRateLimit` 에 `triedAuthRetry` boolean 플래그를 도입하여 구현되었으며, 무한 재귀 차단 요건과 403 분기 동결 요건을 충족한다. 테스트 케이스 T-1(성공), T-2(재시도 실패), T-3(refresh 실패) 는 스펙 §6.1 의 세 경로를 모두 커버하고 있다. 다만 `refreshViaQueue` 완료 후 `integration.credentials` 의 in-memory 갱신 여부에 대한 묵시적 의존이 WARNING 으로 남아 있으며, 이 의존이 충족되지 않을 경우 새 토큰 대신 만료된 토큰으로 재시도하는 무음 결함이 발생할 수 있다. 그 외 plan 체크박스 미갱신, 환경변수 테스트 격리, `execSync` 예외 처리 부재는 INFO 수준이다.

## 위험도

MEDIUM
