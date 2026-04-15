# 코드 리뷰 조치 내역

> Review: `review/2026-04-15_22-02-44/SUMMARY.md`
> 범위: 활성화된 OAuth provider 노출 엔드포인트 + SSR 기반 조건부 SSO UI

---

## Warning — 조치 완료

| # | 발견 | 조치 |
|---|------|------|
| 1 | `OAUTH_STUB_MODE=true` 프로덕션 우회 | `backend/src/main.ts` 부트스트랩에 `NODE_ENV=production && OAUTH_STUB_MODE=true` 조합 감지 시 즉시 throw 가드 추가 |
| 3 | Cache-Control `public` 으로 인한 공유 캐시 노출 | `Cache-Control: private, max-age=300` 로 변경 (브라우저/클라이언트 캐시만 허용, 공유 CDN 캐시 금지) |
| 4 | `OAuthProvider` 타입 3중 중복 | `auth-providers.ts` 의 `export type OAuthProvider` 를 단일 소스로 사용. `login-form.tsx` / `register-form.tsx` 에서 `import type` 으로 재사용 |
| 6 | `Cache-Control` 을 `res.setHeader()` 로 명령형 처리 | `@Header('Cache-Control', 'private, max-age=300')` 데코레이터로 전환. 컨트롤러 메서드에서 `@Res()` 파라미터 제거 → 테스트 단순화 |
| 8 | 서버 컴포넌트의 `NEXT_PUBLIC_API_URL` 사용 (k8s 라우팅 장애 가능) | `INTERNAL_API_URL ?? NEXT_PUBLIC_API_URL ?? localhost:3011/api` fallback 체인으로 변경 |
| 9 | 신규 사용자 동시 생성 시 unique violation 500 | `resolveUser` 신규 생성 경로를 `try/catch` 로 감싸고 SQLSTATE `23505` 감지 시 `findByOauth` 재조회로 회복 처리 |
| 11 | 빈 배열 케이스 `Cache-Control` 검증 누락 | `@Header()` 전환으로 컨트롤러 메서드 책임 외로 이동 → 테스트 의도 명확화 (페이로드만 검증) |
| 13 | `RegisterForm` 시그니처 불필요 `= {}` 기본값 | `LoginForm` 과 동일하게 `= {}` 제거 |

---

## Warning — 후속 과제로 이관

| # | 발견 | 사유 |
|---|------|------|
| 2 | Access Token URL 노출 | 사용자 합의된 설계(이전 라운드). 단기 일회용 교환 코드 도입은 별도 이터레이션에서 |
| 5 | `LoginForm`/`RegisterForm` SSO UI 픽셀 단위 복제 | 두 폼 모두에서 conditional render 만 있는 8라인 중복. `OAuthButtons` 추출 시 재사용 가치 < 추출 비용. 세번째 호출처 발생 시 추출 |
| 7 | `process.env` vs `ConfigService` 혼용 | 기존 `integration-oauth.service.ts` 와 일관된 패턴 유지. 두 서비스 일괄 전환이 적절 |
| 10 | `auth_oauth_state.state` 인덱스 | `state VARCHAR(64) NOT NULL UNIQUE` 인라인 제약이 자동으로 unique index 생성 — 추가 작업 불필요 |
| 12 | `API_BASE_URL` 중복 | Warning #4 와 묶어서 별도 PR로 `lib/constants.ts` 추출 권장 |

---

## INFO — 선별 조치 / 이관

| # | 발견 | 처리 |
|---|------|------|
| 1, 2 | 프론트엔드 `auth-providers` / 폼 컴포넌트 단위 테스트 부재 | 별도 태스크로 이관 (RTL/Vitest 환경 도입 범위) |
| 3, 4 | 테스트 env 격리 강화 | 현재 `originalEnv` 보존 + `afterAll` 로 일괄 복원 패턴 사용 중. 충분 |
| 5 | `getEnabledProviders` 캐시 | 호출 빈도 낮음 (5분 SSR 캐시 hit 후 거의 미발생) — 이관 |
| 6 | `revalidate` 1시간 확장 | 현 5분으로 충분, 운영 중 토글 빈도 데이터 누적 후 결정 |
| 7~12 | 주석/문서화 | 핵심 변경 지점에 의도 주석 추가 (`isUniqueViolation`, `INTERNAL_API_URL` fallback 근거, `Fail-closed` 가드 등) |

---

## 검증

```bash
cd backend
npx jest src/modules/auth/ src/modules/users/ --no-coverage
# → 6 suites passed, 61 tests passed
npx eslint src/modules/auth/ src/main.ts
# → 0 errors (기존 jest mock unsafe-return 경고만 잔존)
```

```bash
cd frontend
npx eslint src/components/auth/login-form.tsx src/components/auth/register-form.tsx \
           src/lib/api/auth-providers.ts \
           'src/app/(auth)/login/page.tsx' 'src/app/(auth)/register/page.tsx'
# → 0 errors, 0 warnings
```

---

## 요약

- Critical 0건
- Warning 13건 중 **8건 조치 · 5건 후속 과제 이관**
- 핵심 보강: 프로덕션 stub 모드 차단(부트 가드), Cache-Control private화, 동시 가입 unique violation 회복, INTERNAL_API_URL fallback, 타입 단일화
- 신규 테스트 1건 (concurrent unique violation 회복 시나리오)
