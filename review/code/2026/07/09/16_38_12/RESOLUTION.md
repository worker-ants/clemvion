# RESOLUTION — e2e 안정화 (session 16_38_12)

대상 리뷰: `SUMMARY.md` (대상 커밋 `24eaf9169` — Playwright 스위트 flakiness 안정화).
전체 위험도 MEDIUM · Critical 0 · Warning 3 · INFO 11.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| WARNING 1 | testing | **fix** — 커밋의 Tier 3 전역 `expect.timeout: 10_000` 이 하드코딩 sub-global timeout 에 override 당하는 문제 해소. positive `.toBeVisible({ timeout: 5_000/3_000 })` **10곳**의 명시 timeout 을 제거해 전역 기본(10_000)을 상속시킴 → members 등 지목 스펙에도 Tier 3 slack 이 실제 적용. `.not.toBeVisible`(negative)·전역동일 `{10_000}` 은 미대상 | `e2e/auth/login.spec.ts`(3)·`register.spec.ts`(2)·`password-reset.spec.ts`(2)·`team/register-invitation.spec.ts`(1)·`workspaces/members.spec.ts:180`·`workflows/background-run-section.spec.ts:224` |
| WARNING 2 | testing | **부분 fix + 후속 이관** — `retries:2` 회귀 은폐 우려. (a) `list`/`html` reporter 가 retry-통과분을 `flaky`(passed 와 구분)로 집계함을 `playwright.config.ts` 주석에 명시(완전 은폐 아님을 문서화). (b) CI 게이트 레벨 surfacing(PR 코멘트·quarantine)은 CI 파이프라인 변경이 필요한 별개 관심사라 `plan/in-progress/e2e-retry-visibility-followup.md` 로 이관 | `codebase/frontend/playwright.config.ts` retries 주석 · `plan/in-progress/e2e-retry-visibility-followup.md` |
| WARNING 3 | documentation | **fix** — `docker-compose.e2e.yml` `playwright-runner` 인접 주석이 Tier 2(prod 빌드)로 stale("dev 서버 자동 기동"). `CI="true"` 로 인해 webServer 가 `next build && next start`(production)를 기동함을 반영하도록 갱신 | `docker-compose.e2e.yml:226-231` |

### INFO (11건) 처리

- **INFO 1(retries blast radius)·INFO 3(누적 wall-clock)·INFO 4(build env/디스크)·INFO 2(retry idempotency)**: 관측/운영 관심사로 WARNING 2 후속 plan 및 기존 안정화 근거(webServer.timeout 240s 상향)로 커버. 별도 조치 불요.
- **INFO 5·7·9(Tier 라벨·webServer.timeout 추적성)**: 문서 추적성 개선 제안 — 비차단, 본 RESOLUTION 이 tier 별 실효 근거를 기록해 대체.
- **INFO 6·10(timeout 리터럴 파편화·전역동일 `{10_000}` redundant)**: WARNING 1 fix 로 sub-global 리터럴은 이미 제거. 전역동일 `{10_000}`(profile-edit 3곳·members:110) 제거는 리뷰어가 "본 범위 밖 후속 cleanup" 으로 명시 → 미조치(스코프 유지).
- **INFO 8(PROJECT.md e2e 섹션)**: CI 전용 동작을 config 인라인 주석에 상세 기술함으로 대체(비필수). 필요 시 후속.
- **INFO 11(`process.env.CI` 진리값 관용구)**: 본 diff 신규 도입 아님(`docker-compose` 가 `CI:"true"` 리터럴 주입 → 실질 위험 0). 조치 불요.

## TEST 결과

- **lint**: 통과 (`stage=lint status=PASS`, log `_test_logs/lint-20260709-183338.log`).
- **unit**: 미재수행 — 본 변경은 e2e 스펙(`*.spec.ts`)·config/yaml 주석·plan md 뿐으로 unit 대상(`*.test.tsx`) 파일 무변경(직교). 동 세션 직전 5196 pass.
- **build**: 미재수행 — Next build 대상(src) 파일 무변경. `playwright.config.ts`·e2e 스펙·docker-compose·plan 은 build 산출물에 미포함(직교).
- **e2e**: 통과. **정정(fresh 리뷰 18_39_22 Critical 1 반영)**: `run-test.sh e2e`(=`make e2e-test`)는 **backend Jest e2e(247 tests)만** 실행하며 본 변경 대상인 frontend Playwright 스펙은 포함하지 않는다 — Playwright 는 `make e2e-test-full`(backend Jest + `playwright-runner`)로만 실행된다. 이를 재실행해 실검증: **frontend Playwright e2e 46 passed (50.2s, retry·flaky 0, clean)** + backend Jest 247 passed (log `_test_logs/e2e-full-playwright-20260709-185331.log`, EXIT=0). 하드코딩 timeout 제거는 assert 를 더 관대하게만 만들어 통과 스펙을 깨지 않음을 실증.

## 보류·후속 항목

- **WARNING 2 CI-level retry surfacing** → `plan/in-progress/e2e-retry-visibility-followup.md` (우선순위 낮음, CI 파이프라인 정비 시 처리).
