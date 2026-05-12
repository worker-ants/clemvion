# E2E 테스트 완성도 향상

## Context

최근 도입된 e2e 인프라(`docker-compose.e2e.yml` + `Makefile` + backend supertest + frontend playwright + CI)는 **team workspace invitation 흐름 1건** 만 검증한다 (backend 5 시나리오 + frontend 4 UI 분기). 전체 제품 surface 대비 갭이 크다.

| 영역 | 현재 e2e | spec 문서 수 | 모듈/페이지 수 |
| --- | --- | --- | --- |
| backend modules | 1 controller (invitations) | 12 system + 7 노드 + 14 navigation | 24 모듈, 25 controller |
| frontend pages | 1 page (register-invitation) | 14 navigation 화면 | 28 page.tsx |

목적: e2e가 진짜 보호하는 가치(**multi-actor·transaction·race·권한 경계·실제 인프라 통과**)에 한해 시나리오를 백필해 product-level 회귀 안전망을 확보. unit/integration 으로 이미 보호되는 영역은 중복하지 않는다.

## 원칙

1. **e2e 가치 기준 선별** — 다음 중 하나 이상에 해당하면 e2e 가치 있음:
   - 멀티 액터·동시성·트랜잭션 일관성 (race condition, 격리 수준)
   - 권한 경계 (RBAC, workspace 격리, 토큰 만료)
   - 실제 인프라 의존 (Postgres, Redis, MinIO, 마이그레이션, BullMQ)
   - 다단계 흐름 (가입→인증→로그인→...)
   - 외부 인입(webhook 수신, OAuth callback)
2. **unit/integration 영역 침범 금지** — 단일 핸들러 로직, 표현식 파서, 유틸 등은 기존 `*.spec.ts` 가 담당. e2e 는 인프라·통합 레이어만.
3. **재사용 가능한 헬퍼 분리** — Owner 가입+팀 생성, 멤버 초대+수락, 워크플로우 생성 등 반복 setup 은 `backend/test/helpers/*.ts` 로 빼서 사용한다.
4. **속도 vs 완전성 트레이드오프** — 한 시나리오는 ≤10초 권장. Race 시나리오는 `Promise.all` 로 동시성 강제.

## 시나리오 카탈로그 (Phase 별)

### Phase 1 — P0 critical (이번 작업 범위)

**Backend (supertest):** `backend/test/`

| 파일 | 시나리오 (각 it) | 핵심 검증 |
| --- | --- | --- |
| `auth.e2e-spec.ts` | register valid / duplicate email 409 / login wrong password 401 / login unverified email 403 / refresh token rotation / password reset 전체 흐름 | spec/5-system/1-auth, 토큰 라이프사이클·중복 가입 차단·트랜잭션 |
| `workspace-rbac.e2e-spec.ts` | owner CRUD all / editor write 가능·삭제 불가 / viewer read-only / member 역할 변경 / ownership 이전 / 워크스페이스 격리 (A 유저가 B 워크스페이스 접근 시 403) | spec/5-system/1-auth §1.3 RBAC |
| `workflow-crud.e2e-spec.ts` | create→list (소유 필터) / update→version 스냅샷 / duplicate 독립 ID / soft delete / cross-workspace 격리 / 동시 update last-write-wins 정책 검증 | spec/2-navigation/1-workflow-list, /3-workflow-editor/3-execution |
| `workflow-execution.e2e-spec.ts` | manual execute → COMPLETED 상태·output / 실패 노드 → FAILED·error captured / stop execution → CANCELLED / 동시 execute on same workflow / execution history retention 조회 | spec/3-workflow-editor/3-execution, /5-system/4-execution-engine |
| `session-revocation.e2e-spec.ts` | 멀티 디바이스 로그인 → 다중 session row / 단일 revoke → 해당 refresh token 무효, 나머지 유효 / revoke all → 모두 무효 / device metadata 기록 | spec/2-navigation/9-user-profile §sessions, 최근 auth-sessions 작업 |
| `helpers/auth.ts` (신규) | `registerAndLogin(email, password)` / `createTeamWorkspace(token, name)` / `inviteAndAccept(...)` 등 | DRY |
| `helpers/db.ts` (신규) | pg Client 공유, table truncation 등 | DRY |

**Frontend (playwright, mock-based):** `frontend/e2e/`

| 파일 | 시나리오 | 핵심 검증 |
| --- | --- | --- |
| `auth/login.spec.ts` | 성공 → /dashboard 이동 / wrong password → 에러 토스트 + 폼 유지 / unverified email → resend 안내 / "비밀번호 찾기" 링크 동작 | spec/2-navigation/10-auth-flow §2.1 |
| `auth/register.spec.ts` | 비밀번호 strength 인디케이터 / terms 미체크 → submit 비활성 / 이메일 중복 응답 처리 / 가입 성공 → verify-email 안내 | spec/2-navigation/10-auth-flow §2.2 |
| `workflows/list.spec.ts` | 목록 렌더 + 필터(소유/전체) / 검색 / "새 워크플로우" 클릭 → 에디터 이동 / 빈 상태 안내 | spec/2-navigation/1-workflow-list |
| `profile/sessions.spec.ts` | 활성 세션 목록 / 현재 세션 라벨 / revoke 다이얼로그 → 확인 → 목록 갱신 / 이력 탭 / revoke all | 최근 profile-sessions 작업 |

### Phase 2 — P1 important (본 plan 에서 함께 처리됨)

**Backend:**
- `webhook-trigger.e2e-spec.ts` — POST /api/hooks/:path → 202 + executionId / inactive → 410 / HMAC 실패 → 401 / parameter 추출 검증
- `integration-credentials.e2e-spec.ts` — credential 암호화 저장 / API 응답에서 secret 마스킹 / test connection / 삭제 시 사용 중 워크플로우 영향
- `schedule-trigger.e2e-spec.ts` — cron 등록 → next_run 계산 / pause·resume / 즉시 실행

**Frontend:**
- `workspaces/members.spec.ts` — 멤버 목록 / 역할 변경 UI / 초대 다이얼로그 / 이전 owner 흐름
- `auth/password-reset.spec.ts` — 요청 → 안내 / 토큰으로 reset 폼 / 만료 토큰 에러
- `integrations/list.spec.ts` — credential 목록 / OAuth 시작 버튼 / 카드 삭제 확인

### Phase 3 — P2 nice-to-have (본 plan 에서 함께 처리됨)

처리 완료:
- `knowledge-base.e2e-spec.ts` — CRUD·격리·ragMode 불변. 임베딩 자체는 unit 이 담당
- `workflow-assistant.e2e-spec.ts` — 세션 CRUD·RBAC·격리. SSE 스트리밍은 unit 담당

후속 (별도 plan):
- 실 LLM 호출 의존 (KB 업로드 → 임베딩 큐 → RAG 검색 end-to-end, AI Assistant SSE 대화)
- marketplace, statistics, version-history (변경 빈도 낮음, unit 으로 충분)

## 파일 조직

```
backend/test/
├── jest-e2e.json              (기존)
├── app.e2e-spec.ts            (기존 invitation 5 시나리오 — 유지)
├── auth.e2e-spec.ts           (Phase 1)
├── workspace-rbac.e2e-spec.ts (Phase 1)
├── workflow-crud.e2e-spec.ts  (Phase 1)
├── workflow-execution.e2e-spec.ts (Phase 1)
├── session-revocation.e2e-spec.ts (Phase 1)
└── helpers/
    ├── auth.ts                (Phase 1, register/login/team-create 공통)
    └── db.ts                  (Phase 1, pg Client + truncation)

frontend/e2e/
├── team/register-invitation.spec.ts (기존)
├── a11y/smoke.spec.ts               (기존)
├── auth/
│   ├── login.spec.ts          (Phase 1)
│   └── register.spec.ts       (Phase 1)
├── workflows/
│   └── list.spec.ts           (Phase 1)
└── profile/
    └── sessions.spec.ts       (Phase 1)
```

## 헬퍼 설계 (Phase 1 신규)

**`backend/test/helpers/db.ts`**
```ts
import { Client } from 'pg';
export function createDbClient(): Client { /* env 기반 */ }
export async function truncateUserData(db: Client): Promise<void> {
  // user, workspace, workspace_member, workflow, execution 등 cascade truncate
  // 각 e2e-spec 의 afterAll 에서 호출 (test 격리)
}
```

**`backend/test/helpers/auth.ts`**
```ts
export async function registerAndLogin(base: string, email: string, db: Client): Promise<{ userId; accessToken }> {
  // register + email_verified=true (DB 직접) + login
}
export async function createTeamWorkspace(base: string, token: string, name: string): Promise<string> { ... }
export async function inviteAndAccept(base: string, owner: token, ws, inviteeEmail, role, db): Promise<{ token, userId }> { ... }
```

이 헬퍼들은 기존 `app.e2e-spec.ts` 의 beforeAll 패턴을 그대로 추출해 신규 spec 들이 4-5 줄로 setup 가능하게 만든다. 기존 `app.e2e-spec.ts` 도 점진적으로 헬퍼를 쓰도록 리팩토 가능(scope 밖, 별도 작업).

## 실행 순서 (각 단계 = 1 커밋)

1. **helpers 신설** — `backend/test/helpers/{auth,db}.ts` 작성 + 자체 import 확인
2. **auth.e2e-spec.ts** — 6 시나리오
3. **workspace-rbac.e2e-spec.ts** — 6 시나리오 (헬퍼 활용)
4. **workflow-crud.e2e-spec.ts** — 6 시나리오
5. **workflow-execution.e2e-spec.ts** — 5 시나리오 (실행 엔진 의존, BullMQ wait)
6. **session-revocation.e2e-spec.ts** — 4 시나리오
7. **frontend auth/login, auth/register** — mock 기반 3-4 케이스씩
8. **frontend workflows/list, profile/sessions** — 동일
9. **CI 갱신** — 신규 파일이 자동 discovery 되는지 확인 (jest regex `.e2e-spec.ts$` 와 playwright testMatch `**/*.spec.ts` 가 이미 와일드카드라 자동 포함될 가능성 높음)
10. **make e2e-test 전체 통과 확인** — Phase 1 마무리. plan/in-progress → plan/complete 이동

각 단계 끝에 `make e2e-test` 가 통과해야 다음 단계로. 실패 시 그 단계 안에서 해결.

## 위험 요소

- **DB 격리** — 각 e2e-spec 이 같은 DB schema 를 공유한다. truncation 정책 정해야 한다. 옵션:
  - (A) 각 spec 의 afterAll 에서 truncate cascade — 단순하지만 spec 간 순서 의존성
  - (B) 매 spec 이 고유 prefix 의 email/workspace 만 만들고 cleanup 없음 — 빠르지만 누적
  - **권장 (C)**: 각 spec 의 beforeAll 에서 본인이 쓸 테이블 truncation. afterAll 은 connection close 만. **CI 마다 ephemeral DB 이므로 누적 문제 없음.**
- **순차 vs 병렬 실행** — jest 기본은 파일 병렬, describe 내 it 직렬. 다른 spec 이 동시에 같은 워크스페이스 만들면 충돌 가능. → 각 spec 이 고유 owner email 로 시작해 격리.
- **실행 엔진 e2e 의 timing** — workflow execute → 결과 polling 필요. Polling helper 마련 (e.g. `waitForExecutionStatus(id, 'completed', 10000)`).
- **frontend playwright mock 한계** — 실 인프라 통과를 보장하지 않음. 본질적 흐름(인증·UI 분기·에러 표시)만 검증. 실 API 통합은 backend e2e 가 책임.
- **CI 시간 증가** — 현재 ~1.23s. Phase 1 완료 시 backend 25+ 시나리오 + frontend 15+ 케이스 → ~30s~1m 추정. CI workflow 의 timeout 조정 필요할 수 있음.

## 검증 (Phase 1 완료 기준)

- `make e2e-test` → backend 모든 e2e-spec 전부 PASS
- `make e2e-test-full` → playwright 모든 spec 도 PASS
- `.github/workflows/e2e.yml` 가 신규 파일 자동 포함 (jest/playwright 와일드카드 매칭으로 이미 됨)
- `plan/in-progress/e2e-completion.md` → `plan/complete/` 이동

## 비-범위 (이번 작업 X)

- 실 LLM 의존 시나리오 (KB embedding pipeline end-to-end, AI Assistant SSE 대화)
- 기존 `app.e2e-spec.ts` 의 helpers 리팩토 — 동작 보장 우선, 별도 작업
- e2e 환경의 성능 튜닝(BullMQ 워커 수 등) — 현재 CI 시간이 임계 도달하면 그때 검토
- coverage 도구 도입 (e2e coverage 측정은 부담 큼)

## 작업 결과 요약

### Backend e2e (`backend/test/`)
| 파일 | 시나리오 수 |
| --- | ---: |
| `app.e2e-spec.ts` (기존) | 5 |
| `auth.e2e-spec.ts` (P1) | 7 |
| `workspace-rbac.e2e-spec.ts` (P1) | 6 |
| `workflow-crud.e2e-spec.ts` (P1) | 6 |
| `workflow-execution.e2e-spec.ts` (P1) | 5 |
| `session-revocation.e2e-spec.ts` (P1) | 5 |
| `webhook-trigger.e2e-spec.ts` (P2) | 5 |
| `integration-credentials.e2e-spec.ts` (P2) | 6 |
| `schedule-trigger.e2e-spec.ts` (P2) | 6 |
| `knowledge-base.e2e-spec.ts` (P3) | 6 |
| `workflow-assistant.e2e-spec.ts` (P3) | 6 |
| **신규 시나리오 합계** | **58** |

헬퍼: `backend/test/helpers/{auth,db}.ts` 도입으로 spec 당 setup 4-5줄.

### Frontend playwright (`frontend/e2e/`)
| 파일 | 케이스 수 |
| --- | ---: |
| `team/register-invitation.spec.ts` (기존) | 4 |
| `a11y/smoke.spec.ts` (기존) | (a11y) |
| `auth/login.spec.ts` (P1) | 4 |
| `auth/register.spec.ts` (P1) | 3 |
| `workflows/list.spec.ts` (P1) | 3 |
| `profile/sessions.spec.ts` (P1) | 2 |
| `auth/password-reset.spec.ts` (P2) | 3 |
| `workspaces/members.spec.ts` (P2) | 2 |
| `integrations/list.spec.ts` (P2) | 2 |
| **신규 케이스 합계** | **19** |

### CI / Infra 변경

- `jest-e2e.json` regex (`.e2e-spec.ts$`) 와 `playwright.config.ts` testMatch (`**/*.spec.ts`)
  로 신규 파일이 자동 discovery — 추가 설정 변경 0.
- `.github/workflows/e2e.yml` 도 그대로. CI 시간 증가 예상: backend ~10-20s,
  frontend ~30-60s (mock 기반이라 빠름).

## 핵심 파일

신규:
- `backend/test/helpers/auth.ts`, `backend/test/helpers/db.ts`
- `backend/test/auth.e2e-spec.ts`
- `backend/test/workspace-rbac.e2e-spec.ts`
- `backend/test/workflow-crud.e2e-spec.ts`
- `backend/test/workflow-execution.e2e-spec.ts`
- `backend/test/session-revocation.e2e-spec.ts`
- `frontend/e2e/auth/login.spec.ts`
- `frontend/e2e/auth/register.spec.ts`
- `frontend/e2e/workflows/list.spec.ts`
- `frontend/e2e/profile/sessions.spec.ts`

수정:
- (없음 — 본 plan 은 백필 전용. 기존 `app.e2e-spec.ts` 와 인프라 파일은 건드리지 않음.)

참고:
- `backend/test/app.e2e-spec.ts:35-77` 기존 beforeAll 패턴 → helpers/auth.ts 의 본보기
- `spec/5-system/1-auth.md` — auth/RBAC spec 의 원전
- `spec/3-workflow-editor/3-execution.md` — 실행 엔진 흐름
- `spec/2-navigation/{1-workflow-list,9-user-profile,10-auth-flow}.md` — UI 흐름 spec
