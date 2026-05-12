# 팀 워크스페이스 e2e — 인프라 정비 + 시나리오

> 작성일: 2026-05-12
> 선행 plan: `plan/complete/team-workspace-followups.md` (본체는 unit + lint + build 로 회귀 잠금됨)

## 배경

`team-workspace-followups` 본체는 NAV-WF-07 (공유 Team 배지·소유 필터) + NAV-UP-05 (미가입자 초대 토큰 흐름) 구현·spec·문서가 모두 끝났고, backend 3245 unit / frontend 1250 vitest 로 회귀 잠금이 됐다. e2e 만 인프라 의존으로 진행하지 못한 채 남아 있어, 그 마지막 안전망을 따로 정비하는 plan.

현 상태:
- `backend/test/app.e2e-spec.ts` — `describe.skip` 으로 비활성화. 주석에 "docker compose --profile app 등으로 backend 의존(Postgres + Redis) 인프라가 test-time 에 떠 있는 환경 정비 후 해제" 라고 명시.
- `frontend/e2e/` — `a11y/` 만 존재. playwright 설치되어 있고 `playwright.config.ts` 도 있음. 실제 시나리오 spec 0개.
- docker-compose 에 `app` profile 미정의.

## 작업 단위

### 1. docker-compose.e2e.yml + Makefile (2026-05-12 완료)

설계 결정 (사용자 합의):
- 별도 `docker-compose.e2e.yml` 신규 (기존 `docker-compose.yml` 은 손대지 않음).
- `name: clemvion-e2e` top-level 키로 project 격리 → `-p` 플래그 불필요. named volume·컨테이너·network 가 자동 분리.
- 호스트 포트 매핑 없음 → dev 가 5432/6379/9000/3011 등을 점유 중이어도 무관.
- ephemeral (named volume 없음) — 매 실행 깨끗한 DB.
- 서비스 6 + runner 2: postgres / redis / minio / createbuckets / migrate / backend-e2e + (profile=test) backend-e2e-runner / playwright-runner.
- backend-e2e 는 `target=runner` (production-like), NODE_ENV 만 test override. healthcheck = `wget /api/health` (alpine 기본).
- backend-e2e-runner 는 `target=deps` + 호스트 `./backend` mount + anonymous `node_modules` volume — dev dep + src 양쪽 보유.
- runner 들은 `profiles: ["test"]` 라 `make e2e-up` 으로는 안 뜨고, `make e2e-test` 에서만 기동.

`Makefile` 타겟 (루트, 신규):
- `make e2e-up` — `docker compose -f docker-compose.e2e.yml up -d --wait backend-e2e`
- `make e2e-down` — `down -v --remove-orphans`
- `make e2e-test` — `--profile test --exit-code-from backend-e2e-runner backend-e2e-runner` 후 자동 down (exit code 전파)
- `make e2e-test-full` — `--profile test --exit-code-from playwright-runner` 로 playwright 까지

산출물:
- [x] `docker-compose.e2e.yml` (2026-05-12)
- [x] `Makefile` 루트 신규 (2026-05-12)

후속 Step 들이 의존하는 hostname (`backend-e2e`), DB name (`clemvion_e2e`), env (`MAIL_TRANSPORT=console`) 모두 박제됨.

### 2. backend e2e — `backend/test/app.e2e-spec.ts` 교체 (2026-05-12 완료)

`describe.skip` 제거 후 5 시나리오 작성:
- (A) 초대 → DB 에서 토큰 추출 → 가입(`POST /auth/register` with invitationToken) → 자동 멤버 등록 확인
- (B) 만료 토큰 → 410 `invitation_expired`
- (C) 이메일 불일치 → 400 `invitation_email_mismatch` (트랜잭션 롤백으로 User row 미생성 확인)
- (D) 동시 register w/ token — 둘 중 하나만 201, 다른 하나는 409/410
- (E) resend — 기존 토큰 404, 새 토큰 200

토큰 추출은 `pg` 클라이언트로 `workspace_invitation` 직접 조회 (DB 가 같은 docker network).
실행 path: e2e-runner 컨테이너 안에서 `npm run test:e2e` → ts-jest → supertest 가 `http://backend-e2e:3011` 으로 HTTP 호출.

### 3. frontend e2e — playwright spec (2026-05-12 완료)

`frontend/e2e/team/register-invitation.spec.ts` 신규. backend 호출을 `page.route` 로 mock — backend 의 실제 통신 정합성은 §2 가 보장하고, 본 spec 은 "프론트엔드가 응답을 받아 UI 분기를 제대로 하는가" 만 검증.

4 시나리오:
- ready meta → email prefill + readOnly + 워크스페이스 배너
- 410 expired → 에러 배너 + submit 비활성화
- 404 not found → "확인할 수 없어요" 안내
- no invitationToken → 일반 가입 페이지 (배너 없음, email 자유 입력)

추가 정합성: `playwright.config.ts` 에 `webServer` (npm run dev) 추가 — `PLAYWRIGHT_NO_WEBSERVER=1` 로 로컬 babysit 시 우회 가능. `npm run e2e` script 는 이미 존재.

후속 (별도 plan): 워크플로 리스트의 Team 배지/ownership 필터, 멤버 관리 초대 흐름 — 인증 fixture 가 필요해 본 plan 범위에서 분리.

### 4. CI 통합 (2026-05-12 완료)

`.github/workflows/e2e.yml` 신규:
- 두 job (`e2e` = backend supertest HTTP, `e2e-frontend` = playwright mock-based) 병렬 실행
- buildx + actions/cache 로 docker layer 캐시
- 실패 시 docker logs / playwright report 를 artifact 로 7일 보관
- concurrency group 으로 같은 branch 의 중복 실행 취소

## 수용 기준

- [x] NAV-WF-07 · NAV-UP-05 의 e2e 가 통과 (`make e2e-test` 5/5 PASS, 2026-05-12 검증)
- [x] backend `npm run test:e2e` 가 skipped 없이 통과
- [x] frontend playwright spec 작성 (mock-based, backend 의존 없음)
- [x] CI workflow (`.github/workflows/e2e.yml`) 추가

## 적용된 부수 fix (e2e 가 노출한 backend 버그)

- `GlobalExceptionFilter` 가 `QueryFailedError(23505 unique_violation)` 을 `ConflictException(409)` 으로 자동 변환 — race window 의 UNIQUE 위반이 5xx 로 새지 않도록.
- frontend `register-form.tsx` 의 axios error code/message 추출이 `{error: {...}}` envelope 도 인식하도록 `extractApiCode/Message` 헬퍼 추출.
- backend e2e spec 의 `res.body.code` → `res.body.error.code` 정정 (`GlobalExceptionFilter` 응답 구조 부합).

## 의존성·리스크

- **의존**: 없음.
- **리스크 / 대응**:
  - playwright browser binary 다운로드 시간 — CI 의 `actions/cache` 로 보완 (이미 적용).
  - 동시 accept 경쟁(D) 의 race window — backend race 결과가 `[201, 409]` / `[201, 410]` / `[409, 410]` 등 timing 에 따라 다양. 어서션을 "successes ≤ 1 + user_count == successes" 로 보정해 안전 fail 도 spec 부합으로 인정 (token 또는 user 가 절대 중복 commit 되지 않음이 핵심).
  - Docker Desktop 의 `--abort-on-container-exit` 와 network attach race — `up --wait` + `run --rm` 분리 패턴으로 회피.

## 검증 결과 (2026-05-12)

```
PASS test/app.e2e-spec.ts
  Invitation flow (e2e)
    ✓ A. invite → register with token → 자동 멤버 등록 (223 ms)
    ✓ B. expired token → 410 invitation_expired (11 ms)
    ✓ C. email mismatch on register → 400 invitation_email_mismatch (8 ms)
    ✓ D. concurrent register w/ same token — 한 번만 성공 (218 ms)
    ✓ E. resend — 기존 토큰 즉시 무효, 새 토큰만 동작 (13 ms)
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## 참고

- spec: `spec/5-system/1-auth.md` §1.5 (초대 토큰 흐름·에러 코드 정의), `spec/2-navigation/9-user-profile.md` §4.1.1, `spec/2-navigation/10-auth-flow.md` §2.6.
- 본체 구현: `plan/complete/team-workspace-followups.md` 의 commit 흐름 (`66a2c8de` spec → `e697daef` backend → `2323643e` review → `48863b94` frontend → `eacb6b12` review).
