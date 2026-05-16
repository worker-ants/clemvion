# RESOLUTION — Prod re-review (1f3cb79..HEAD)

세션: `review/code/2026/05/16/11_04_17`
조치 branch: `claude/prod-rereview-fix-a7c93f`
worktree: `.claude/worktrees/prod-rereview-fix-a7c93f`
조치 일시: 2026-05-16

본 문서는 `SUMMARY.md` 의 Critical / Warning / INFO 항목에 대한 조치 결과를 기록한다.

---

## Critical

| # | 항목 | 조치 |
|---|------|------|
| C1 | `cafe24-api.client.ts` diff 누락으로 REQ-C2 비즈니스 로직 검증 불가 | **검증 완료 — 코드 정상**. `recordNetworkFailure()` (L644-678) 가 transport 실패 시 카운터 +1, 3 도달 시 `status='error', statusReason='network'` 전이 + 카운터 리셋. `resetNetworkFailures()` (L680-692) 가 정상 HTTP 응답 직후 0 으로 리셋. transport 실패는 `executeWithRateLimit` (L731) 과 `refreshAccessToken` (L469) 두 경로에서 호출. spec §6 의 `connected → error(network) | 3회 연속` 전이 이행. 코드 변경 없음. |

## Warning

| # | 항목 | 조치 |
|---|------|------|
| W1 | `OAuthBeginResultDto` required→optional union-in-class 타입 안전성 | **코드 정정**. (a) `authorizeUrl` 필드명을 실제 wire shape (`authUrl`) 으로 정정 — 사전부터 있던 DTO/wire 불일치 버그를 함께 해소. (b) `OAuthBeginPopupResultDto` (`authUrl`, `state` required) + `OAuthBeginCafe24PendingResultDto` (`mode`, `integrationId`, `appUrl`, `callbackUrl` required) 두 분기 DTO 추가. (c) `ApiOkWrappedOneOfResponse([Popup, Cafe24Pending], ...)` 헬퍼 신설. (d) `/oauth/begin`, `:id/reauthorize`, `:id/request-scopes` 3 endpoint 에 적용. (e) Swagger 콘솔이 두 분기를 명시적으로 노출. 호환 alias 클래스는 제거 (사용자 없음). 프론트엔드 `OAuthBeginResult` 는 이미 discriminated union 이라 호환. |
| W2 | `consumePreviewToken` 평문 자격증명 hard-fail 회귀 위험 | **운영 환경 점검 항목**. 코드 변경 없음. 배포 전 `SELECT count(*) FROM integrations WHERE credentials::text NOT LIKE 'enc:%';` 로 레거시 미암호화 행 수 확인 후, 존재 시 재암호화 또는 무효화 마이그레이션 권장. 운영자에게 위임. |
| W3 | `WARNING_KO` 매핑 누락 위험 (영문 SoT 전환) | **검증 완료 — 누락 없음**. `git diff 1f3cb79..HEAD -- 'backend/src/nodes/'` 에서 추출한 새 영문 message 46건과 `frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 53키를 자동 대조. 모두 ko 매핑 존재. "missing" 으로 잡힌 2건 (`missing scope: mall.write_product`, `whatever`) 은 cafe24 API 테스트 픽스처 (mock response error_message) 로 warningRule 이 아님 — 진짜 누락 0건. |
| W4 / W15 | `sanitizeLastErrorMessage` 언더스코어 패턴 커버 불명확 | **검증 완료 — 커버됨**. 정규식 `client[_-]secret|access[_-]token|refresh[_-]token|id[_-]token|api[_-]key|password|passwd|pwd` 이 underscore/hyphen 양쪽 매칭. `integration-oauth.service.spec.ts` L533-552 가 `client_secret=`, `access_token:`, `refresh_token=` 마스킹을 이미 검증. 코드 변경 없음. |
| W5 | `switch.schema.ts` 조건-메시지 의미 괴리 | **검증 — 의도된 동작**. zod 스키마 default 가 `mode='value'` 이고, `mode != expression` 은 (null/undefined → default 'value') 도 포함. 사용자 facing 메시지 "In Value mode..." 는 정확. L209-212 의 기존 주석이 이미 의도를 명시. 변경 없음. |
| W6 | `pending_install` 제외 동작 (REQ-C1) 전용 테스트 부재 | **테스트 추가**. `integration-expiry-scanner.service.spec.ts` 에 `excludes pending_install from the run() candidate query (REQ-C1)` 추가 — `Not(In(['expired', 'error', 'pending_install']))` operator 의 내부 `_value` 를 직접 검증. |
| W7 | `cafe24-token-refresh.processor.spec.ts` 중복 테스트 | **중복 제거**. L125-135 의 동일 it() 제거. 1개 propagation 테스트만 유지. |
| W8 | `OAuthBeginResultDto` 분기별 필드 존재/부재 단언 부재 | **테스트 보강**. `integration-oauth.service.cafe24.spec.ts` 의 (a) Public 분기에 Private 전용 필드 (`mode`, `integrationId`, `appUrl`, `callbackUrl`) 의 `toBeUndefined()` 단언 추가, (b) Private 분기에 Public 전용 필드 (`authUrl`, `state`) 의 `toBeUndefined()` 단언 추가. |
| W9 | `spec/2-navigation/4-integration.md` 갱신 여부 불명확 | **부분 동기**. §6 (network failure 3회), §9.2 (OAuthBeginResult 두 분기), §2.4 (pending_install 제외) 모두 이미 반영됨. §11 (cafe24-background-refresh 신규 BullMQ job) 만 미문서화 — `plan/in-progress/spec-update-cafe24-background-refresh.md` 에 spec-update 노트 작성, `project-planner` 위임 대기. |
| W10 | "Korean warning" describe 잔존 (영문 SoT 전환과 부정합) | **일괄 치환**. 22개 spec/소스 파일에서 `Korean warning` → `warning`, `Korean warnings` → `warnings`, `Korean messages` → `warning messages` 로 perl 인플레이스 치환. 검증 명령 0건. |
| W11 | 단일 PR 에 두 독립 관심사 혼재 (cafe24 + i18n SoT 전환) | **이력 사실 — 조치 없음**. 이미 main 에 merge 된 상태이므로 PR 단위 분리는 불가. 다음 작업부터는 관심사 분리. |
| W12 | `V050__*.conf` 주석 부재 | **주석 추가**. `executeInTransaction=false` 가 PostgreSQL `CREATE INDEX CONCURRENTLY` 가 트랜잭션 안에서 실행 불가하기 때문에 Flyway 의 자동 트랜잭션 wrap 을 끄는 옵션임을 5줄 주석으로 명시. |
| W13 | `llm-provider-rule.ts` JSDoc 의 SoT 명시 부재 | **JSDoc 보강**. 모듈 상단 주석에 `**Language SoT**: 본 메시지는 English 가 single source of truth 이며, 프론트엔드 WARNING_KO 가 ko 번역을 담당` 한 단락 추가. |

## INFO (참고)

| # | 항목 | 결정 |
|---|------|------|
| I1 | `consecutiveNetworkFailures` 카운터·상태 전이 원자성 | `recordNetworkFailure()` 가 단일 `integrationRepository.update()` 호출로 카운터·status·statusReason·lastError 를 함께 갱신 — 트랜잭션 한 줄로 원자. `executeWithRateLimit` 의 catch 블록 이후 throw 까지 race 가 없는 구조. 추가 조치 불필요. |
| I2 | `enqueueCafe24BackgroundRefresh` 전체 메모리 로드 | 현 통합 수 (수백 행 추정) 에서 영향 미미. 통합 수가 수만 건으로 늘 경우 cursor 기반 배치로 전환 권장 — 별도 plan. |
| I3 | `refreshViaQueue` 타임아웃 복구 경로 이중 findOne | 드문 경로 (QueueEvents 이벤트 누락 시) — 최적화 가치 낮음. 보류. |
| I4 | API 클라이언트의 도메인 상태 직접 변경 (REQ-C2) | 현 규모 수용 가능. 향후 `IntegrationNetworkHealthService` 분리 검토. |
| I5 | 임계값 `3` magic number 분산 | `cafe24-token-refresh.constants.ts` 같은 곳에 `CONSECUTIVE_NETWORK_FAILURE_THRESHOLD = 3` 상수 도입 권장 — 후속 cleanup. |
| I6 | `OAuthBeginResultDto` union-in-class | W1 에서 해소 — 분기 DTO 두 개로 split + oneOf 스키마. |
| I7 | `backend-labels.ts` 의 CI exhaustive 검증 | `WARNING_KO` 매핑 누락을 빌드 시 차단하는 스냅샷 테스트 추가 권장 — 후속 plan. |
| I8 | TypeORM 내부 구조 직접 검사 (`_value`) | `excludes pending_install` 신규 테스트도 동일 패턴 사용 — 안정적이지만, TypeORM upgrade 시 깨질 위험은 동일. e2e 보호 라인 보강은 후속. |
| I9 | `registry.test.ts` 의 `it.runIf(hasRealDocs)` skip | CI 환경에서 `content/docs` 존재 보장. skip 가시화는 후속. |
| I10 | 배포 직후 BullMQ refresh 큐 급증 위험 | 운영 모니터링 — 배포 직후 큐 길이 / job 처리 시간 dashboard 확인. |
| I11 | `docker compose run --build` 최소 버전 | Compose v2.12.0+. CI / 로컬 환경 모두 v2.20+ 보유 확인. README 명시는 후속 plan. |
| I12 | 노드 메타데이터 언어 정책 미문서화 | English SoT 정책을 `spec/conventions/` 에 명시 — 별도 plan 으로. |

---

## TEST WORKFLOW 결과

| 단계 | 결과 | 비고 |
|------|------|------|
| backend lint | ✅ 0 errors, 17 warnings | warnings 는 `migrate-node-output-refs.ts` 일회성 스크립트의 `any` 사용 — 사전부터 있는 것 |
| backend unit test | ✅ 206 suites, 3649 tests pass | 신규 추가 테스트 (pending_install 제외 + 분기 필드 단언) 포함 |
| backend build | ✅ nest build 성공 | |
| frontend lint | ✅ 0 errors | |
| frontend unit test | ⚠️ 1 flaky test pass-in-isolation | `execution-list-page.test.tsx > navigates to execution detail on row click` — 전체 suite 실행 시 `findByText("Completed")` 가 filter 버튼 + 행 status 와 중복 매칭. 단독 실행 시 통과. **사전부터 있던 이슈** (test 셀렉터가 비유니크). 내 변경과 무관. follow-up plan 으로 처리 권장. |
| frontend build | ✅ next build 성공 | |
| e2e (`make e2e-test`) | ✅ 12 suites, 66 tests pass | 18.5s 소요. integration-credentials / schedule-trigger / webhook-trigger / workflow-assistant 등 모든 영역 통과 |

## 미해결 항목 (사용자 / 후속)

1. **운영 DB 점검**: 배포 전 `credentials NOT LIKE 'enc:%'` 행 수 확인 (W2).
2. **`spec/2-navigation/4-integration.md §11` 갱신**: `cafe24-background-refresh` BullMQ job 문서화 — `plan/in-progress/spec-update-cafe24-background-refresh.md` → `project-planner` 위임 (W9).
3. **Frontend flaky test 안정화**: `execution-list-page.test.tsx` 의 `findByText` 셀렉터를 `getByRole('cell', ...)` 같은 유니크 셀렉터로 교체 (별도 PR).
4. **CI 스냅샷 검증 추가**: `WARNING_KO` 매핑 누락을 빌드 시 차단 (I7).
5. **임계값 상수화**: `CONSECUTIVE_NETWORK_FAILURE_THRESHOLD = 3` (I5).

---

## REVIEW WORKFLOW (fix branch) — `review/code/2026/05/16/11_55_54`

조치 직후 fix branch 에 `/ai-review` 를 다시 실행한 결과 (13 reviewer, 0 Critical, 9 Warning, 14 Info). 본 추가 회 의미 있는 Warnings 에 대한 조치.

| # | 항목 | 조치 |
|---|------|------|
| W1 | frontend 잔존 `authorizeUrl` | **검증 완료 — 0건**. `grep -rn "authorizeUrl" frontend/src/` 출력 없음. 프론트엔드는 본래 `authUrl` 사용. |
| W2 | DTO 분리 Swagger breaking change | **이력 정보로 RESOLUTION 에 명시**. 외부 generated client 가 있다면 재생성 필요 — 본 프로젝트는 frontend 가 직접 작성한 discriminated union 만 사용. |
| W3 | TypeORM 내부 `_value._value` 직접 접근 | **public API 로 전환**. `FindOperator.type` (public 문자열) 과 `value` (public getter) 만 사용하도록 테스트 정정. `Not(In([...]))` 의 outer.value 가 inner 배열을 직접 노출함을 실측 후 한 레이어만 검증. |
| W4 | `wrapOneOfDataSchema` 빈 배열 가드 | **fail-fast 추가**. 빈 배열 입력 시 즉시 `throw new Error('wrapOneOfDataSchema requires at least one DTO...')`. |
| W5 | spec §11 미문서화 | **plan 노트 작성됨** — `plan/in-progress/spec-update-cafe24-background-refresh.md`. project-planner 위임 대기. |
| W6 | `wrapOneOfDataSchema` 단위 테스트 부재 | **3개 테스트 추가**. (a) 정상 oneOf 빌드, (b) 단일 DTO degenerate 케이스, (c) 빈 배열 throw. `api-wrapped.spec.ts`. |
| W7 | `formUrlEncode` 단위 테스트 부재 | **본 변경 범위 밖**. 본 함수는 사전부터 있던 코드이며 이번 PR에서 수정하지 않음. HMAC 통합 테스트 (`integration-oauth.service.cafe24.spec.ts` 의 `handleInstall` 케이스) 가 간접 검증. 후속 plan 으로 분리. |
| W8 | popup 분기 `authUrl` wire 단언 부족 | **테스트 강화**. `typeof publicResp.authUrl === 'string'` + 비공백 단언, `state` 타입 단언, `authorizeUrl` 회귀 부재 단언 추가. |
| W9 | `as Record<string, unknown>` 캐스트 | **discriminator 기반 단언**. Private 분기에서 `publicResp.mode === 'cafe24_private_pending'` 명시 단언 + 공유 회귀 안전망 (`authorizeUrl` 부재). |

### 미적용 (Info 후속 plan)

I1 (DTO 배열 공유 상수), I2 (oneOf discriminator), I4 (헬퍼 추출), I5 (description 통일), I7 (CONCURRENTLY 롤백 주석), I8 (CHANGELOG migration note), I9 (reauthorize description), I10 (포맷팅 분리 PR), I11 (테스트 위치 정정), I12 (`urlToken` 회귀 테스트), I13 (`@nestjs/swagger/dist` import path), I14 (status 선검증 guard 확인) — 후속 cleanup PR.

### 최종 검증

| 단계 | 결과 |
|------|------|
| backend lint | ✅ 0 errors, 17 warnings (사전부터) |
| backend unit test | ✅ 206 suites, **3652 tests** pass (+3 from wrapOneOfDataSchema tests) |
| backend build | ✅ |
| frontend lint / build | ✅ |
| frontend unit test | ⚠️ 1 flaky (사전부터, 내 변경과 무관) |
| e2e (`make e2e-test`) | ✅ 12 suites, 66 tests pass |
