# Resolution — 2026/05/16 13:59:20 review

대상 SUMMARY: `./SUMMARY.md` (13개 reviewer · Critical 1 · Warning 14 · Info 16).

## 처리 정책

- Critical 1: spec 갱신 위임 — **본 PR 범위 밖**. 사전 일관성 검토 결과대로 3개 in-flight worktree (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`) 머지 후에 `plan/in-progress/spec-update-cafe24-test-connection.md` 를 project-planner 가 실행한다. 본 worktree 의 plan 노트에 의존성 명시 완료.
- Warning 14: 코드로 즉시 해소되는 11건 처리, 분석 후 false positive 1건, deferred 2건 (e2e 추가 / 공유 타입 분리 — 별도 plan 필요).
- Info 16: 작은 것 (헬퍼 추출·매직넘버·JSDoc) 은 같이 처리, 나머지는 RESOLUTION 의 추적 항목으로 기록.

## 조치 내역

| # | 카테고리 | 등급 | 조치 | 위치 |
|---|----------|------|------|------|
| 1 | 잠금 재진입 (Concurrency W#1) | WARNING | **False positive** — 분석 후 RESOLUTION 만 기록. `withIntegrationLock` 은 task 단위 promise-chain 직렬화이며 task 안에서 호출되는 `ensureFreshToken`/`refreshAccessToken`/`rawPing` 은 락을 다시 잡지 않는다. 기존 `call()` 도 같은 패턴으로 운영 중이므로 재진입 데드락 없음. `pingConnection` JSDoc 에 잠금 의미 명시 추가. | `cafe24-api.client.ts` `pingConnection` JSDoc |
| 2 | DB 상태 변경 (Side-Effect W#2) | WARNING | spec 갱신 위임 노트 (`spec-update-cafe24-test-connection.md`) §5.8 갱신안에 "재시도도 401 이면 `error(auth_failed)` 로 전이" 명시 완료. 코드의 JSDoc 도 동일 정책 명시. | `cafe24-api.client.ts` `pingConnection` JSDoc |
| 3 | 403 정책 비대칭 (Requirement W#3 · API W#11) | WARNING | 재시도 후 403 도 첫 번째 403 과 동일하게 `markAuthFailed` 호출 안 함. 401 만 격하. 403 의 코드는 별도 `CAFE24_INSUFFICIENT_SCOPE` 로 분리 (401 은 그대로 `CAFE24_AUTH_FAILED`). | `cafe24-api.client.ts` `pingConnection` |
| 4 | never-throws 위반 (Requirement W#4) | WARNING | `assertCredentials` 호출을 try-catch 로 감싸서 `mapPingError` 로 변환. `Cafe24IncompleteCredentialsError` → `INTEGRATION_INCOMPLETE` 코드. | `cafe24-api.client.ts` `pingConnection` |
| 5 | 누적 deadline (Performance W#5) + 매직 넘버 (INFO #8) | WARNING + INFO | `PING_TIMEOUT_MS = 30_000` 을 클래스 정적 상수로 승격. 단일 ping 의 30초 한도는 유지 (각 단계가 직렬 단축 가능하므로 worst-case ≤ 90s 예상). 전체 deadline 추가 도입은 별도 plan — 현재 사용자 진단 호출이라 노드 자동 호출 SLO 와 분리 운영. | `cafe24-api.client.ts` `rawPing` |
| 6 | catch 중복 (Maintainability W#6) | WARNING | `mapPingError(err)` 모듈 헬퍼로 추출. 3개 try-catch 블록 모두 한 줄 호출로 통일. | `cafe24-api.client.ts` |
| 7 | assertCredentials 미테스트 (Testing W#7) | WARNING | `'incomplete credentials — never throws, returns INTEGRATION_INCOMPLETE result'` 케이스 추가. | `cafe24-api.client.spec.ts` |
| 8 | 재시도 후 403 미검증 (Testing W#8) | WARNING | #3 정책 변경에 맞춰 새 케이스 추가: `'401 → refresh succeeds → retry 403 — returns INSUFFICIENT_SCOPE WITHOUT markAuthFailed (403 정책 일관)'`. | `cafe24-api.client.spec.ts` |
| 9 | env 격리 (Testing W#9) | WARNING | `pingConnection` describe 에 `afterEach(() => delete process.env.CAFE24_*)` 추가. | `cafe24-api.client.spec.ts` |
| 10 | 반환 타입 공유 (Architecture W#10) | WARNING | **Deferred** — `IntegrationsService` 의 `IntegrationTestResult` 를 `cafe24-api.client.ts` 에서 import 하면 layering 의도 (`nodes → modules` 단방향) 가 깨질 수 있다. 공유 타입 레이어(`backend/src/shared/`) 신설은 본 PR 범위 밖. RESOLUTION 추적. | — |
| 11 | 403 코드 분리 (API W#11) | WARNING | #3 과 함께 처리됨. | `cafe24-api.client.ts` |
| 12 | 중복 등록 묵시 덮어쓰기 (Side-Effect W#12) | WARNING | `IntegrationsService.registerEntityTester` 에 기존 등록 존재 시 `Logger.warn` 추가. 단위 테스트 케이스 추가. | `integrations.service.ts`, `integrations.service.spec.ts` |
| 13 | review/consistency artifact 혼입 (Scope W#13) | WARNING | 이미 직전 커밋에 포함되어 분리 어려움. **다음 커밋부터 별도 분리 합의** — RESOLUTION 추적. | — |
| 14 | plan 체크리스트 (Scope W#14 · Documentation) | WARNING | 모든 항목 완료 후 본 plan 갱신 + `git mv plan/in-progress → plan/complete`. 본 RESOLUTION 커밋과 함께 처리. | `plan/in-progress/cafe24-test-connection.md` |

## INFO 추적 항목 (별도 처리 또는 차후 plan)

| # | 항목 | 위치 | 처리 방향 |
|---|------|------|----------|
| 1 | API 응답 메시지 sanitize 일관성 | `formatAuthFailure` | 토큰이 cafe24 error body 에 echo 되지 않는 정책상 저위험. 별도 plan 으로 추적. |
| 2 | `Cafe24Module.onModuleInit` 단위 테스트 | `cafe24.module.ts` | e2e 가 cafe24 통합 핑 경로를 cover (`integration-credentials.e2e-spec.ts`). 별도 단위 테스트는 후속 plan. |
| 5 | e2e 케이스 추가 | 변경 범위 전체 | mock cafe24 server 셋업 비용으로 본 PR 범위 밖. 후속 plan. |
| 6 | `currentAccessToken` 헬퍼 추출 | `cafe24-api.client.ts` | 본 RESOLUTION 에서 같이 적용 (`pingConnection` 내 두 군데 사용). |
| 8 | `PING_TIMEOUT_MS` 상수 | `cafe24-api.client.ts` | 본 RESOLUTION 에서 적용 (Warning #5 와 함께). |
| 9 | `cafe24Integration` 픽스처 중복 | `integrations.service.spec.ts` | 두 it 블록 중복은 의도적 (각 테스트 격리) — 변경 보류. |
| 10 | `freshIntegration` 기본값 | `cafe24-api.client.spec.ts` | 본 RESOLUTION 에서 `consecutiveNetworkFailures: 0` 추가. |
| 11–13 | JSDoc 보강 | 여러 위치 | 본 RESOLUTION 에서 `pingConnection`/`rawPing`/`formatAuthFailure`/`registerEntityTester` JSDoc 보강 적용. |
| 14 | `previewTest` cafe24 단순 ping | `integrations.service.ts` `previewTest` | 현재 OAuth 흐름에서 막 발급된 토큰은 거의 100% 유효하므로 fallback success 그대로 둠. 후속 plan 추적. |
| 15 | 모듈 초기화 타이밍 경합 | `integrations.service.ts` `testConnection` | NestJS 의 onModuleInit 보장 (HTTP 핸들러는 init 후 활성). 저위험. |
| 16 | 분산 잠금 (수평 확장) | `withIntegrationLock` | refresh 는 BullMQ 큐가 분산 잠금. ping 은 진단 호출이라 race 시에도 멱등 (단지 markAuthFailed 가 race 가능 — 사용자 영향 미미). 후속 plan 추적. |

## TEST 재수행 결과

- backend lint: 0 errors, 17 warnings (모두 본 변경 영역 외 — `migrate-node-output-refs.ts`)
- backend unit test: 208 suites · 3691 tests **all pass**
- backend build: pass
- e2e: 12 suites · 66 tests **all pass**

## 커밋 분할

본 RESOLUTION 의 코드 변경은 단일 후속 커밋으로 묶는다 (REVIEW WORKFLOW step 9 단일 커밋 규약).
