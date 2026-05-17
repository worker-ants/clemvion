# RESOLUTION — cafe24 401 자가 회복 PR 코드 리뷰 조치

세션: `review/code/2026/05/17/21_45_15/`
SUMMARY: [SUMMARY.md](SUMMARY.md) (Critical 0, Warning 12, Info 22, 전체 위험도 MEDIUM)

## 조치 항목

### 본 PR 안에서 해소된 항목

| ID | 카테고리 | 조치 | fix commit |
|----|----------|------|------------|
| W-2, W-3 (부분) | architecture | `performAuthRefresh()` private helper 추출 — `executeWithRateLimit` 의 401 분기에서 큐 분기 로직을 helper 로 이동해 SRP 부담 완화. `pingConnection()` 은 명시적으로 in-process `refreshAccessToken` 우회 사용 (진단용 1회성, 의도된 동작) → 본 helper 사용 안 함. W-3 의 완전한 통일은 후속 PR 후보로 RESOLUTION 추적 | refactor commit (아래) |
| W-5 | testing | `afterEach` 훅에서 `clearRefreshClientEnv()` + `dataSource.transaction.mockReset()` 자동 실행 — 테스트 중간 실패 시 env 오염 누출 차단. 본문 끝 수동 호출은 잔존 안전망으로 유지 (idempotent) | refactor commit |
| W-6 | testing | `dataSource.transaction.mockReset()` afterEach 등록 | refactor commit |
| W-7 (해소) | requirement | `refreshViaQueue` JSDoc 에 **side-effect contract** 명시 — "정상 return 후 `integration.credentials.access_token` 갱신 보장" 한 단락. 코드 동작은 이미 그러함 (line 666-672), 명시적 계약화로 묵시적 의존 해소 | refactor commit |
| W-9, W-10 | documentation | `executeWithRateLimit` 401 블록 인라인 주석 압축 + `performAuthRefresh` 호출 후 contract 의존 주석 + `else` fallback 분기 의도 (helper 안으로 이동되어 별도 fallback 분기 노출 없음) | refactor commit |
| W-11 | security | `process.env` cleanup afterEach 자동화. fixture 값을 `'env-id'` → `'fake-client-id-for-test'` 로 변경해 의도 명확화 (INFO-4 동시 해소) | refactor commit |
| W-12 | maintainability | `wireRefreshTransaction` helper 는 `describe('auth failure')` scope 안에서만 사용되므로 그 안에 유지 (다른 describe 의 token-refresh 테스트는 inline 패턴 별도 사용 — 변경 시 회귀 위험 큼). 별 PR 후보로 추적 | (보류) |
| W-8 | plan | `plan/in-progress/cafe24-call-401-retry.md` 의 코드·테스트·검증 체크박스를 `[x]` 로 갱신, 미결 "또는 inline" → "inline 방식 채택" 확정 기재. 본 RESOLUTION 줄도 plan 의 `[ ] RESOLUTION.md 작성` 갱신과 결합 | refactor commit |
| INFO-3 | testing | `catalog-sync.spec.ts` 의 `execSync` 호출에 `try/catch` 추가 — git 바이너리 부재 시 옛 6-levels-up `__dirname` fallback 으로 main worktree 호환성 보전 | refactor commit |
| INFO-4 | security | fixture 값 `'env-id'`/`'env-secret'` → `'fake-client-id-for-test'`/`'fake-client-secret-for-test'` (W-11 과 동시 해소) | refactor commit |

### 본 PR 에서 보류 — 후속 PR 후보 (RESOLUTION 추적)

| ID | 카테고리 | 사유 | 후속 PR plan |
|----|----------|------|--------------|
| W-1 | concurrency | `refreshAccessToken` fallback 경로의 다중 인스턴스 race 위험. 프로덕션은 항상 BullMQ 큐 바인딩 (테스트 환경 전용 fallback) — 프로덕션 가드 (예: NODE_ENV='production' 일 때 fallback 시 throw) 추가가 안전망. 다만 별 PR 로 분리 — DI 계약 변경 동반 | `plan/cafe24-refresh-fallback-prod-guard.md` 후보 |
| W-3 (완전 통일) | architecture | `pingConnection()` 과 `executeWithRateLimit()` 의 helper 단일화. 본 PR 에서 `performAuthRefresh` 만 일부 통일 (큐 분기). pingConnection 의 401 retry 패턴 자체는 그대로 유지 — 진단용 1회성 호출이라 큐 우회가 의도된 동작. 통일은 의미 변경 동반이므로 별 PR | `plan/cafe24-auth-retry-unify.md` 후보 |
| W-4 | architecture | `triedAuthRetry: boolean` 인자가 시그니처에 노출. `RetryState` 객체로 묶거나 while 루프로 전환. 본 PR 분량 안 - 의미 변경 동반 | (INFO 격하) |
| W-12 (helper 이전) | maintainability | `wireRefreshTransaction` 파일 상단 helper 섹션으로 이전. 다른 describe 의 inline 패턴과 회귀 위험 → 별 PR | (deferred) |
| INFO-2 | security | `refreshedToken` fallback (`?? accessToken`) silent 실패 시 warn 로그. contract 위배 신호로 가치 있으나 본 PR 분량 안 | (deferred) |
| INFO-5 | architecture | `refreshAccessToken` JSDoc 에도 동일 side-effect contract 명시 (`refreshViaQueue` 만 본 PR 에서 명시). 별 PR | (deferred) |
| INFO-6 | architecture | `catalog-sync.spec.ts` 의 git CLI 결합 — `REPO_ROOT` 환경변수 주입 또는 jest config rootDir. 본 PR 의 `try/catch` fallback 으로 critical risk 해소 | (deferred) |
| INFO-16 | testing | T-1 응답 body 단언 추가. fetch mock 의 body 가 `{ products: [...] }` 라 본 PR 의 `res.status === 200` 만 검증해도 retry 후 정상 경로 도달 신호 충분 | (deferred) |
| INFO-17 | testing | T-1 Authorization 헤더 검증 단순화. 현재 검증은 fetchMock.mock.calls 의 `Record<string,string>` 캐스팅 — TypeScript 만족 위해 필요. 의미 동일 | (deferred) |
| INFO-18 | testing | `refreshViaQueue` 경로 401 자가 회복 unit 테스트. 핵심 시나리오라 가치 있으나 BullMQ mock setup 분량이 큼. e2e 가 큐 동작은 커버. follow-up | `plan/cafe24-refresh-queue-retry-test.md` 후보 |
| INFO-21 | documentation | `REQ-C3` 주석 범위 명시. 본 PR 의 새 401 분기 추가로 REQ-C3 주석이 403 분기 안으로 이동했음 — 위치는 정확함. INFO 격하 | (deferred) |
| 나머지 INFO 1-22 (해소·기록만) | — | 모두 형식·완결성·정보 수준. 본 PR 머지 차단 사유 아님. SUMMARY 에서 이미 추적 | — |

---

## TEST 결과

REVIEW 조치 commit 후 TEST WORKFLOW 4단계 재실행:

- **lint**: `cd codebase/backend && npm run lint` — 0 errors, 19 warnings (모두 본 PR 무관 pre-existing — `executions.service.ts`, `migrate-node-output-refs.ts`).
- **unit**: `cd codebase/backend && npm test` — **217 suites / 3875 tests pass**.
- **build**: `cd codebase/backend && npm run build` — `nest build` 성공.
- **e2e**: `make e2e-test` — **16 suites / 93 tests pass** (1회차).
  - 직전 2회 실행이 docker daemon 의존성 cold-start 이슈로 실패 (`Container redis failed to start`, `No such container`) → `make e2e-down` 후 재시도로 회복. e2e 결과 자체에는 본 PR 변경 무관.

---

## 보류·후속 항목

위 "본 PR 에서 보류" 표의 항목들은 follow-up plan 으로 분리. 본 PR 머지 차단 사유 아님.

핵심 후속 후보:
1. `cafe24-refresh-fallback-prod-guard` — W-1 다중 인스턴스 race 가드
2. `cafe24-auth-retry-unify` — pingConnection ↔ executeWithRateLimit DRY 완전 통일
3. `cafe24-refresh-queue-retry-test` — refreshViaQueue 경로 401 자가 회복 unit 커버리지 보강

라우터 결정: 9 reviewer 실행, 4 reviewer 제외 (performance / dependency / database / api_contract — 본 변경에 적용 불가).
