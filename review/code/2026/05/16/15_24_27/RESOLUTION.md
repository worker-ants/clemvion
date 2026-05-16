# RESOLUTION — Cafe24 mall_id 사전 중복 감지 UX 보강

연결된 리뷰 세션: `review/code/2026/05/16/15_24_27/SUMMARY.md`
첫 리뷰 (rebase 전): `review/code/2026/05/16/15_10_23/SUMMARY.md`
worktree: `cafe24-mall-dup-ux-a7f2c8`

## 요약

| 라운드 | Critical | Warning | INFO | 비고 |
|--------|---------:|--------:|-----:|------|
| 1차 리뷰 (`15_10_23`) | 6 | 18 | 13 | `main` 와 fork 시점 차이로 발생한 diff 노이즈가 6 건의 Critical 로 잡힘 |
| **rebase** | — | — | — | `git rebase origin/main` (PR #89~#100 흡수) — 4-way 모두 충돌 없이 적용됨 |
| 2차 리뷰 (`15_24_27`) | **0** | 23 | 25 | 실제 본 PR 변경 범위에 대한 정합 리뷰 |
| 본 RESOLUTION | **0** | 7 잔존 (deferred) | 일부 적용 | Critical / 즉시·테스트 카테고리 Warning 모두 처리, 아키텍처 refactor 만 잔존 |

## 1차 리뷰 Critical 처리 (rebase)

1차 리뷰의 Critical 1~6 은 모두 **fork 시점 (`319ac304`) ↔ 현재 `main` (`29e337b3`) 간의 45개 커밋 차이**가 `git diff main..HEAD` 에 노이즈로 잡혀 reviewer 들이 "본 PR 이 spec/code 를 동시에 깨뜨렸다" 고 잘못 해석한 결과였다. (특히 PR #91 `integration-attention-filter`, PR #89 `cafe24-app-url-detail`, PR #98 `cafe24-hmac-raw-fix` 이 spec/2-navigation/4-integration.md 와 frontend 컴포넌트를 main 에서 함께 갱신한 상태.)

조치: **`git rebase origin/main`** — 4 commits 모두 자동 적용 (충돌 없음). 2차 리뷰는 본 PR 의 실제 변경분 (4 commits) 만 대상으로 수행해 Critical 0 건으로 정합.

## 2차 리뷰 Warning 처리 내역

### 즉시 처리 (UX 결함 / 회귀 차단)

- **W1 / W22 — Connect 버튼 precheck 로딩 구간 비활성화** ✅
  - `frontend/src/app/(main)/integrations/new/page.tsx` Connect 버튼 `disabled` 조건에 `cafe24PrecheckLoading` 추가. precheck 응답 도착 전 OAuth 시작 race 차단.
  - `isCafe24OAuth` 전환 시 / mall_id 패턴 무효 시 `setCafe24PrecheckLoading(false)` 함께 호출 — 영구 spinner 잔존 방지.
- **W17 — plan 체크박스 갱신** ✅
  - `plan/in-progress/cafe24-mall-dup-ux.md` Backend(1~3), Frontend(4), TEST+REVIEW WORKFLOW 항목 `[x]`.

### 테스트 커버리지 보강 (W2~W8)

- **W2 — Connect `toBeDisabled()` 어서션** ✅ — `cafe24-precheck.test.tsx` 신규 케이스 추가.
- **W3 — `precheckCafe24Mall` expired 단독 케이스** ✅ — `integration-oauth.service.cafe24.spec.ts` 케이스 추가.
- **W4 — unknown status fallback 분기** ✅ — `initializing` 임의 status mock 으로 `status` 필드 omit 검증.
- **W5 — legacy row 시나리오 단위 테스트** ✅ — `mallId IS NULL + credentials.mall_id` 매칭 케이스 추가.
- **W6 — e2e pending_install 응답 검증** ✅ — `integration-cafe24-precheck.e2e-spec.ts` 신규 케이스 + DB insert 헬퍼 재사용.
- **W7 — `formatErrorToast` 분기 검증** ✅ — `cafe24-precheck.test.tsx` 신규 케이스. backend 409 응답 mock + toast 메시지에 한글 primary + 영문 backend 메시지 포함 검증.
- **W8 — `precheckLoading` 인디케이터 검증** ✅ — Promise resolve 보류 시 `확인 중…` 표시 + Connect 비활성, resolve 후 해소 검증.

### 코드 품질 / 일관성 (W10·W12·W13·W15·W16·W18·INFO 12)

- **W10 — `Cafe24ExtraFields` `t` prop 제거** ✅ — 내부 `useT()` 직접 호출로 다른 컴포넌트 패턴과 통일.
- **W12 — legacy fallback 제거 기준 명시** ✅ — `findAllCafe24RowsForMall` JSDoc 에 backfill 마이그레이션 추적 plan 참조 + V046 partial UNIQUE 검토 항목 추가.
- **W13 — `Promise.all` 병렬화** ✅ — primary + legacy 쿼리 동시 발행으로 평균 latency 절반.
- **W15 — 에러 코드 의미 Swagger 명시** ✅ — `@ApiConflictResponse` 설명에 "`PRIVATE` 토큰은 historical artifact, app_type 무관" 명시.
- **W16 — fallback status 강제 캐스팅 제거** ✅ — priority enum 외 status 는 `status` 필드를 omit (강제 캐스팅 → silent fallthrough 방지). 동시에 `Cafe24PrecheckStatus` 타입 alias 도입.
- **W18 — PRIORITY 상수 추출** ✅ — 클래스 상단 `CAFE24_PRECHECK_STATUS_PRIORITY` 추출, DTO 주석에서 단일 진실 참조.
- **INFO 12 — `checking…` i18n** ✅ — `cafe24DuplicateMallChecking` 키 추가 (ko/en parity).

### 기각 / 사용자 지시 보존

- **W15 (코드 rename `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED`)** — 기각. 사용자가 "호환성 유지, 메시지 문구만 일반화" 명시 (consistency-check Warning #8 처리 결정과 동일). Swagger 설명에 historical artifact 임을 명시하는 방식으로 해소.

## Deferred Warning (다음 PR 또는 별도 worktree)

본 PR 범위를 최소로 유지하기 위해 아래 7건은 별도 작업으로 분리한다. 모두 기능적 결함이 아닌 리팩토링·관측 항목.

| # | 카테고리 | 설명 | 이관 사유 |
|---|---------|------|----------|
| W9 | 아키텍처 | `useCafe24MallIdPrecheck` 커스텀 훅 추출 | `page.tsx` 전반의 훅 추출과 함께 일괄 리팩토링 — 본 PR 의 변경 범위 초과 |
| W11 | 아키텍처 | `formatErrorToast` 의 에러 코드 분기를 도메인 상수로 분리 | 다른 에러 코드도 함께 동일 패턴 도입 시 정합 — 별도 리팩토링 |
| W19 | 유지보수성 | status 유니온 타입 중앙화 (서비스 / DTO / FE 3곳 중복) | shared 패키지 도입과 함께 — `packages/integration-shared` 신설 검토 |
| W20 | 유지보수성 | 테스트 mock 객체 인라인 중복 — `buildFakeIntegration(overrides)` 팩토리 추출 | 기존 spec 파일 전반에서 동일 패턴 — 별도 테스트 인프라 작업 |
| W21 | 문서화 | 라우트 순서 주석을 `@ApiOperation.description` 에 반영 | swagger 문서 일관 패턴 정의 후 일괄 적용 |
| W23 | 데이터베이스 | `throwIfUniqueViolation` 호출 컨텍스트의 트랜잭션 경계 확인 | `IntegrationsService.create` 전체 트랜잭션 도입 작업 — 범위 큼 |
| INFO 6 | 성능 | `AbortController` 기반 debounce 취소 | UI 리팩토링과 함께 처리 |

## 검증

| 단계 | 결과 |
|-----|------|
| backend lint | 0 errors (17 pre-existing warnings in `migrate-node-output-refs.ts`) |
| backend unit test | 3722 / 3722 passed |
| backend build | success |
| frontend lint | clean |
| frontend unit test | 1424 / 1424 passed (+3 from W2/W7/W8 보강) |
| frontend build | success |
| e2e | 79 / 79 passed (+1 from W6 pending_install 케이스) |
