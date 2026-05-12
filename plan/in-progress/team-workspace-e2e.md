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

### 1. docker-compose `app` profile 정비

- `docker-compose.yml` (또는 별도 `docker-compose.e2e.yml`) 에 e2e 전용 profile 추가. 최소 구성: Postgres + Redis + backend (env: `NODE_ENV=test`, `MAIL_TRANSPORT=console`, 임시 DB schema).
- Flyway migration 자동 실행으로 schema 초기화 (기존 `migrate-repair` 서비스 패턴 참고).
- backend 컨테이너의 health-check + 종료 후 cleanup.

### 2. backend e2e — `backend/test/app.e2e-spec.ts` 교체

`describe.skip` 제거 후 실 시나리오:

- (A) 초대 → 메일(console transport) 로그에서 토큰 추출 → 가입(`POST /auth/register` with invitationToken) → 자동 멤버 등록 → workspaces.members 에서 신규 사용자 조회 확인.
- (B) 만료된 토큰 accept → 410 `invitation_already_used` 또는 `invitation_expired` 확인.
- (C) 이메일 불일치 가입 시도 → 400 `invitation_email_mismatch`.
- (D) 동시 accept 경쟁 — 같은 토큰으로 두 번 호출 시 한 번만 성공, 두 번째는 410.
- (E) 재발송 후 기존 토큰이 즉시 무효, 새 토큰만 동작.

### 3. frontend e2e — playwright spec

`frontend/e2e/` 에 신규 spec 추가:

- (F) 팀 워크스페이스 전환 시 워크플로 리스트의 `Team` 배지 노출, 개인 워크스페이스에서는 비노출.
- (G) 팀 워크스페이스에서 `내 워크플로우 / 공유된 워크플로우 / 전체` 버튼 그룹 노출, 클릭 시 list URL 의 `ownership=` 변동.
- (H) 멤버 관리 → 미가입 이메일 초대 → 대기 중 목록에 표시 → `재발송` 클릭 시 새 토큰 발급 확인.
- (I) `/auth/register?invitationToken=…` 진입 시 email prefill + readOnly, 가입 후 대시보드 진입.

### 4. CI 통합

- GitHub Actions workflow 에 `docker compose --profile app up -d` → backend e2e → frontend playwright → cleanup 의 step 추가.
- 실패 시 mail console 로그·Playwright trace 를 artifact 로 저장.

## 수용 기준

- NAV-WF-07 · NAV-UP-05 의 e2e 가 CI 환경에서 통과.
- backend `npm run test:e2e` 가 skipped 없이 통과.
- frontend `npx playwright test` 가 통과.

## 의존성·리스크

- **의존**: 없음. 본체 구현·spec·문서가 모두 ✅.
- **리스크**:
  - playwright 의 browser binary 다운로드가 CI 시간 증가 — `actions/cache` 로 보완.
  - 메일 console transport 로그 파싱 — 환경에 따라 로그 포맷 변동 가능. backend 가 `MAIL_TRANSPORT=console` 일 때 일관된 prefix(`Workspace invitation for {email}: {url}`) 유지 필요.
  - 동시 accept 경쟁(D) 테스트의 race window — fixture 단계에서 sleep 없이 두 fetch 를 한 번에 발사하는 패턴 사용.

## 참고

- spec: `spec/5-system/1-auth.md` §1.5 (초대 토큰 흐름·에러 코드 정의), `spec/2-navigation/9-user-profile.md` §4.1.1, `spec/2-navigation/10-auth-flow.md` §2.6.
- 본체 구현: `plan/complete/team-workspace-followups.md` 의 commit 흐름 (`66a2c8de` spec → `e697daef` backend → `2323643e` review → `48863b94` frontend → `eacb6b12` review).
