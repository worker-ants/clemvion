# PROJECT.md — Clemvion 프로젝트별 매핑·명령

본 저장소의 프로젝트-특이 매핑·명령. `.claude/` 하네스는 generic 화되어 있으므로,
이 저장소에서의 코드베이스 구조, 빌드·테스트 명령, 문서 컨벤션은 본 문서에서 한 곳에 모은다.

다른 저장소에서 본 하네스를 채택할 때는 본 파일만 자기 프로젝트에 맞게 작성하면 된다. 하네스의 generic skeleton (`developer/SKILL.md`, `ai-review.md`, `code-review-agents/SKILL.md`) 은 본 파일을 참조해 동작한다.

## 코드베이스 구조

| 영역 | 위치 | 스택 |
|------|------|------|
| 클라이언트 | `codebase/frontend/` | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack Query, @xyflow/react |
| 서버 | `codebase/backend/` | NestJS 11, TypeScript, TypeORM, Socket.io |
| 공유 패키지 | `codebase/packages/expression-engine/`, `codebase/packages/node-summary/` | TypeScript. `codebase/{frontend,backend}` 가 `file:../packages/*` 로 참조 |
| 인프라 매니페스트 | `k8s/` | Kubernetes deployment, service, ingress |
| 빌드 helper | `scripts/` | Python 검증 스크립트, setup-githooks.sh |

패키지 매니저: 모두 **npm** (yarn / pnpm 사용 금지).
인프라: PostgreSQL 16 · Redis 7 (BullMQ) · MinIO · Flyway · Docker Compose.

## 빌드·린트·테스트 명령

| 단계 | 명령 |
|------|------|
| lint | `cd codebase/backend && npm run lint` · `cd codebase/frontend && npm run lint` |
| unit test (jest/vitest, in-process) | `cd codebase/backend && npm test` · `cd codebase/frontend && npm test` |
| build | `cd codebase/backend && npm run build` · `cd codebase/frontend && npm run build` |
| e2e (backend supertest, ~30–60s) | `make e2e-test` |
| e2e (backend + playwright) | `make e2e-test-full` |
| e2e 인프라 정리 (중간 종료 시) | `make e2e-down` |
| e2e stale project 일괄 정리 (worktree 삭제 후) | `make e2e-prune` |
| git hook 등록 (clone 후 1회) | `make setup-githooks` |

**순서 근거**: e2e 는 `docker-compose.e2e.yml` 에서 backend 이미지를 빌드해 실행하므로, 로컬 `npm run build` 가 통과해야 e2e 도 의미가 있다. build 실패를 먼저 잡으면 docker 빌드 시간(분 단위) 낭비를 피한다.

**Worktree 별 e2e 자동 격리**: `make e2e-*` 는 현재 worktree dir basename 으로 compose project name 을 도출 (main worktree = `clemvion-e2e`, `.claude/worktrees/<task>-<slug>/` = `clemvion-e2e-<task>-<slug>`). 컨테이너·볼륨·network 가 worktree 별로 분리되므로 여러 worktree 에서 e2e 를 **동시에** 돌려도 충돌 없음. image 자체는 worktree 간 공유되어 (각 빌드 서비스에 `image:` 명시) 두 번째 worktree 의 첫 e2e 가 image rebuild 비용을 다시 치르지 않는다. `COMPOSE_PROJECT=foo make e2e-test` 로 사용자 override 가능. 자세한 내용은 `docker-compose.e2e.yml` 헤더 주석과 `Makefile` 상단 참고.

## e2e 면제 화이트리스트

코드 변경 (`.ts` / `.tsx` / `.sql` / 런타임 `.json` / `Dockerfile` / `Makefile` / 빌드 설정 등) 이 한 줄이라도 포함되면 **e2e 는 default 로 수행**. 변경 set 이 다음 목록의 **부분집합** 일 때에 한해 e2e 면제:

- `*.md` · `*.mdx` 본문 (frontmatter 포함)
- `spec/**` · `plan/**` · `review/**` · `CLAUDE.md` · `AGENTS.md` · `README.md` · `PROJECT.md`
- `.claude/**` (skills, hooks, agents 정의)
- `codebase/frontend/src/content/docs/**` (유저 가이드 본문)
- `codebase/frontend/src/lib/i18n/dict/**` (사전 키만; 호출 코드 변경 없음)
- 주석 전용 변경 (코드 라인 0줄, 주석/공백/포맷만)
- `.github/**` (CI 정의는 e2e 가 검증 대상 아님)
- 이미지·로고·폰트 등 정적 자산

위 목록 밖이 한 항목이라도 포함되면 면제 불가. 회색 지대(예: `*.test.ts` 만 변경, configuration JSON, helper 한 줄) 도 화이트리스트가 아니므로 e2e 수행. 화이트리스트 추가가 필요하면 본 문서를 PR 로 갱신 후 적용 — 임의 확대 금지.

### 화이트리스트 밖인데 보류가 정당한 경우 — 사용자 명시 승인 필수

다음과 같이 보류가 합리적인 상황이 있다:

- 사전 결함이 e2e 를 막고 있고 본 변경과 무관함이 명확 (commit hash 로 입증 가능)
- outbound third-party API stub 인프라 부재 등 구조적 한계
- 환경상 docker 실행 불가 (디스크/메모리/daemon)

이 경우에도 **`[skip-e2e]` 자체 발급 금지**. 멈추고 사용자 보고 → 명시 응답 받은 뒤에만 보류. RESOLUTION.md `## TEST 결과` 에 사유 + 응답 시점 인용 기록.

## 변경 유형 → 갱신 위치 매핑

코드 변경 후 함께 갱신해야 할 문서·번역 자산의 white list. 누락 시 `fix(i18n):` · `docs(user-guide):` 사후 보정 PR 패턴을 차단.

| 변경 유형 | 필수 갱신 위치 | 검증 명령 |
| --- | --- | --- |
| 새 노드 추가 (`codebase/backend/src/nodes/<cat>/<name>/`) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` + `.en.mdx` 의 노드 항목<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 노드명·필드명·placeholder·도움말<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` — 에러 코드·label 번역 | `cd codebase/frontend && npm test -- i18n docs` |
| 노드 schema 변경 (필드 추가·라벨 변경) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` 의 FieldTable<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 해당 키<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 label/errorCode | 동일 |
| 신규 UI 문자열 (TSX) | `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` **양쪽** — 한쪽만 추가 금지 (parity 가드 fail) | `cd codebase/frontend && npm test -- i18n` |
| 통합 신규/제공자 변경 | `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키 | `cd codebase/frontend && npm test -- i18n docs` |
| 유저 가이드 신규 섹션 디렉토리 (`codebase/frontend/src/content/docs/<NN>-<name>/`) | `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` **양쪽 로케일 등록** (KO/EN 모두) | `cd codebase/frontend && npm test -- locale` |
| 백엔드 API 추가·변경 | (a) controller·DTO 의 swagger jsdoc<br>(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지 | swagger 단위 테스트 / 빌드 |
| 인증·권한·세션 흐름 변경 | `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e | `make e2e-test` |
| 표현식 언어 변경 | `codebase/frontend/src/content/docs/04-expression-language/{basics,variables-and-context,cheatsheet}.mdx` + `.en.mdx` | 수동 (registry 테스트로 frontmatter 검증) |
| 실행·디버깅 흐름 변경 | `codebase/frontend/src/content/docs/05-run-and-debug/` | 동일 |
| 환경 변수·기동 방법·런타임 변경 (제품 최종 상태) | `README.md` | 수동 |
| spec 자체에 누락·오류가 있다고 판단됨 | `plan/in-progress/spec-update-<name>.md` 에 제안 노트 작성 후 `project-planner` 위임 | — |

### 유저 가이드 파일 컨벤션

자세한 규약: [`codebase/frontend/src/content/docs/_i18n-conventions.md`](codebase/frontend/src/content/docs/_i18n-conventions.md)

- 한국어 canonical: `<slug>.mdx` — frontmatter 는 여기에만
- 영어 번역: `<slug>.en.mdx` — frontmatter 없이 본문만. 없으면 EN 로케일은 KO + 안내 배너로 폴백 (의도된 동작)
- 문체·금지어: [`codebase/frontend/src/content/docs/_glossary.md`](codebase/frontend/src/content/docs/_glossary.md)
- 정식 사용자 가이드 spec: [`spec/2-navigation/13-user-guide.md`](spec/2-navigation/13-user-guide.md) (IA · frontmatter · 작성 정책 · 품질 체크)

### i18n dict 파일 컨벤션

- 22 개 top-level 섹션은 각각 `dict/ko/<section>.ts` · `dict/en/<section>.ts` 한 쌍 (예: `dict/ko/editor.ts`, `dict/en/editor.ts`). 단일 거대 파일이 아닌 섹션 단위 split 으로 병렬 PR 충돌을 최소화한다
- 신규 키 추가 시 ko/en 양쪽의 같은 섹션 파일만 손댄다. 다른 섹션 파일과는 무관
- `dict/ko/index.ts` 와 `dict/en/index.ts` 는 22 섹션 composite export — 신규 섹션 추가가 아닌 한 일반적으로 손대지 않음
- 외부 import 경로는 `from ".../dict/ko"`, `from ".../dict/en"` 그대로 (Node module 해석이 index.ts 로 자동 매핑)

### 자동 가드 (build-time 차단)

위 표의 검증 명령은 가능한 한 결정적 단위 테스트로 받아둔다:

- `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` — `ko.ts` ↔ `en.ts` leaf key parity 강제. 한쪽 누락 fail
- `codebase/frontend/src/lib/docs/__tests__/locale.test.ts` — 모든 (숨김 아닌) 섹션이 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일 등록 검증
- `codebase/frontend/src/lib/docs/__tests__/registry.test.ts` — MDX frontmatter 의 `spec:`/`code:` 경로 실존 검증

이들은 코드 리뷰가 검출하지 못한 누락도 빌드 단계에서 차단한다 (마이그레이션 V번호 가드와 동일 패턴).

## e2e 테스트 작성 가이드

e2e 는 **인프라 의존성과 multi-actor 흐름** 을 보장하는 회귀 안전망이다. unit · integration 으로 이미 보호되는 단일 핸들러 로직은 침범하지 않는다.

### 언제 e2e 를 작성하는가

- 멀티 액터 · 동시성 · 트랜잭션 일관성 (race condition, 트랜잭션 격리)
- 권한 경계 (RBAC, workspace 격리, 토큰 만료)
- 실 인프라 의존 (Postgres, Redis, MinIO, Flyway 마이그레이션, BullMQ)
- 다단계 흐름 (가입 → 인증 → 로그인 → … 등 cross-endpoint 시나리오)
- 외부 인입 (webhook 수신, OAuth callback)

### 파일 위치·명명

- backend: `codebase/backend/test/<scope>.e2e-spec.ts` — `codebase/backend/test/jest-e2e.json` 의 `.e2e-spec.ts$` regex 가 자동 discovery
- frontend: `codebase/frontend/e2e/<area>/<name>.spec.ts` — `codebase/frontend/playwright.config.ts` 의 testMatch `**/*.spec.ts` 가 자동 discovery
- 신규 헬퍼: `codebase/backend/test/helpers/<name>.ts`

### Backend e2e 패턴 (supertest)

- DB 직접 접근: `helpers/db.ts` 의 `createDbClient()` / `uniqueEmail(prefix)` / `uniqueName(prefix)` 사용. 매 spec 의 `beforeAll` 에서 connect, `afterAll` 에서 `db.end()`
- 인증 setup: `helpers/auth.ts` 의 `registerAndLogin` · `createTeamWorkspace` · `inviteAndAccept` · `extractRefreshCookie` 사용으로 boilerplate 4–5 줄로 축소
- 워크스페이스 컨텍스트: 자기 워크스페이스 외 자원을 만질 땐 항상 `X-Workspace-Id` 헤더로 명시
- **응답 shape 규칙** (`TransformInterceptor` 동작):
  - 일반 객체 반환 → `body.data.<field>` (예: `body.data.executionId`)
  - `PaginatedResponseDto` (이미 `data` 키 보유) → passthrough, `body.data` 가 곧 배열
  - 에러 → `body.error.code`
- Cookie 추출: `extractRefreshCookie(res.headers['set-cookie'])`. 쿠키 이름은 `refreshToken` (snake_case 아님)

### Frontend e2e 패턴 (playwright, mock-based)

- backend 와 분리 — `page.route('**/api/...', ...)` 로 mock. 실 backend 호출은 backend e2e 가 책임
- `(main)` 레이아웃 진입 페이지는 AuthProvider 가 `/api/auth/refresh` + `/api/users/me` 를 호출하므로 함께 mock 해야 인증 통과
- 한국어/영어 i18n 둘 다 매칭: `getByText(/한글|English/i)`
- 날짜 표기: `codebase/frontend/AGENTS.md` 의 `formatDate` / `timeAgo` 컨벤션 위반 금지

### 알려진 우회 (백엔드 quirk)

- **초대 가입 사용자의 JWT 가 모든 요청에서 401**: `JwtStrategy.validate()` 가 personal workspace 존재를 강제. 초대 가입 흐름은 personal workspace 미생성 → `helpers/auth.ts` 의 `inviteAndAccept` 가 DB INSERT 로 personal workspace 를 fast-track 생성해 우회
- **invite 엔드포인트 throttle (60s 당 10건)**: 누적 invite 가 한도를 넘으면 429. 헬퍼가 3·8·20s backoff 로 3회 재시도. 그래도 부족한 케이스(suite 마지막 차례)는 DB INSERT 로 멤버십 직접 추가 (`workflow-assistant.e2e-spec.ts E` 참고)

### 금지·주의

- LLM 호출 흐름 (workflow-assistant SSE, KB embedding pipeline) — e2e 대상 아님. unit 위임
- `app.e2e-spec.ts` 무한 누적 금지 — 신규 시나리오는 영역별 파일로 분할
- `jest-e2e.json` 의 `maxWorkers: 1` 유지 — 병렬 suite 가 throttler · DB 격리에 지장
- e2e 에서 DB row 를 강제로 만들 때는 항상 unique 식별자 사용. 정리(truncation)는 ephemeral schema 가 자동 처리

## 도메인 어휘

- **노드 카테고리**: logic / flow / ai / integration / data / presentation / trigger (총 7 카테고리, 28 종)
- **표현식 언어**: `{{ ... }}` 템플릿. tokenizer / parser / AST evaluator 는 `codebase/packages/expression-engine` SSOT. 평가 의미는 백엔드·프론트엔드 공유
- **노드 출력 컨벤션**: `spec/conventions/node-output.md` 의 11 Principle (5필드 invariant: `{config, output, meta?, port?, status?}`, config↔output 직교, meta=메트릭, 에러 컨트랙트 `port:'error'` + `output.error.{code,message,details?}` 등)
- **인프라 의존**: PostgreSQL (DB) · Redis/BullMQ (캐시·큐) · MinIO (오브젝트 스토리지) · Flyway (DB 마이그레이션) · Socket.io (실시간)
- **`spec/conventions/`**: 정식 규약 모음 — `node-output.md`, `swagger.md`, `migrations.md`, `conversation-thread.md`, `cafe24-api-metadata.md` 등
