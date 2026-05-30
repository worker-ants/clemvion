# Clemvion

<p align="left">
  <img src="codebase/frontend/public/logo.svg" alt="Clemvion — Agentic Workflow" width="280">
</p>

AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템.

**Clemvion**은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼입니다. 드래그앤드롭 캔버스 에디터에서 워크플로우를 설계하고, 워크플로우 안에 AI 에이전트 노드를 삽입해 각 단계가 단순 실행을 넘어 판단·적응까지 수행합니다. 비기술자부터 개발자까지 모두를 위한 도구입니다.

브랜드 스토리·비주얼 가이드: [`spec/6-brand.md`](./spec/6-brand.md).

## 주요 기능

- **캔버스 에디터** - 무한 2D 캔버스에서 노드를 드래그앤드롭으로 배치하고 연결
- **20종 노드** - 로직(If/Else, Switch, Loop 등), 통합(HTTP, Email, DB), 데이터 변환, 프레젠테이션 노드
- **실행 엔진** - 수동 실행, 스케줄(Cron) 실행, Webhook 트리거 지원
- **실시간 모니터링** - WebSocket 기반 실행 상태 실시간 추적
- **버전 관리** - 워크플로우 버전 히스토리 및 롤백
- **Expression Language** - 노드 간 데이터 참조 및 변환을 위한 표현식 언어
- **다국어 사용자 가이드** - `/docs/ko/...`, `/docs/en/...` 경로로 한국어·영어 매뉴얼 제공. 로케일 없는 레거시 경로(`/docs/<section>/<slug>`)는 쿠키 기반으로 자동 리다이렉트

## 아키텍처

```
Client (Next.js SPA)
│
├── 캔버스 에디터 (@xyflow/react)
├── 대시보드 / 워크플로우 관리
└── 트리거 / 스케줄 / 통합 설정
        │
        ▼  REST API / WebSocket
┌─────────────────────────────────────┐
│        API Gateway (NestJS)         │
│  Auth · Rate Limiting · Routing     │
├─────────────────────────────────────┤
│  Core API Service                   │
│  - Workflow CRUD, 검색, 버전 관리   │
│  Execution Engine                   │
│  - BullMQ 워커 풀, 스케줄러         │
│  Integration Service                │
│  - OAuth, HTTP, Email, DB           │
│  WebSocket Gateway                  │
│  - 실시간 실행 상태 업데이트        │
└─────────────────────────────────────┘
        │
        ▼
┌──────────┬──────────┬──────────┐
│PostgreSQL│  Redis   │  MinIO   │
│ (DB)     │(Cache/MQ)│(Storage) │
└──────────┴──────────┴──────────┘
```

## 프레임워크 및 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **상태 관리** | Zustand, TanStack React Query |
| **캔버스** | @xyflow/react |
| **스타일링** | Tailwind CSS, Radix UI |
| **Backend** | NestJS 11, TypeScript |
| **ORM** | TypeORM |
| **데이터베이스** | PostgreSQL 16 |
| **캐시/메시지 큐** | Redis 7, BullMQ |
| **실시간 통신** | Socket.io |
| **오브젝트 스토리지** | MinIO (Self-hosted) / AWS S3 (SaaS) |
| **인프라** | Docker Compose |
| **테스트** | Vitest (Frontend), Jest (Backend) |

## 주요 경로

```
./
├── spec/                       # 제품 정의·기술 명세 (single source of truth — 옛 prd/ 도 흡수)
├── plan/                       # 작업 추적 (in-progress/ ↔ complete/)
├── review/                     # 코드 리뷰·일관성 검토 산출물 (시점별)
├── codebase/                  # 애플리케이션 코드 영역
│   ├── frontend/              # 클라이언트 (Next.js)
│   │   └── src/
│   │       ├── app/                #   App Router 페이지
│   │       │   ├── (auth)/         #     로그인 / 회원가입
│   │       │   ├── (main)/         #     대시보드, 워크플로우 목록 등
│   │       │   └── (editor)/       #     워크플로우 에디터
│   │       ├── components/         #   공통 컴포넌트
│   │       └── lib/                #   유틸리티, 훅, API 클라이언트, 스토어
│   ├── backend/               # 서버 (NestJS)
│   │   └── src/
│   │       └── modules/
│   │           ├── auth/           #   인증 (JWT, Passport)
│   │           ├── workflows/      #   워크플로우 관리
│   │           ├── nodes/          #   노드 정의 및 설정
│   │           ├── edges/          #   노드 간 연결
│   │           ├── execution-engine/#  워크플로우 실행 엔진
│   │           ├── executions/     #   실행 이력
│   │           ├── triggers/       #   Webhook, Schedule, Manual 트리거
│   │           ├── schedules/      #   Cron 스케줄 관리
│   │           ├── integrations/   #   외부 서비스 연동
│   │           ├── websocket/      #   실시간 통신
│   │           ├── dashboard/      #   대시보드 통계
│   │           └── ...             #   users, workspaces, notifications 등
│   └── packages/              # 공유 라이브러리 (file:../packages/* 로 frontend/backend 가 참조)
│       ├── expression-engine/      # Expression Language 엔진
│       └── node-summary/           # 노드 warning/summary SSOT
├── docker-compose.yml          # 인프라(PostgreSQL/Redis/MinIO) + (--profile app 시) codebase/backend/frontend/migrate
└── README.md
```

## 설치 방법

### 사전 요구 사항

- Node.js 20+
- Docker & Docker Compose
- `jq` (`make e2e-prune` 실행 시 필요. macOS: `brew install jq`. 그 외 타겟은 jq 불필요)

### 1. 인프라 실행

`docker-compose.yml` 은 두 가지 모드로 동작합니다.

**A. 인프라만** — host 에서 `npm run dev` 로 codebase/backend/frontend 를 직접 띄우는 워크플로용.

```bash
docker compose up -d
```

PostgreSQL(5432), Redis(6379), MinIO(9000/9001) + MinIO 버킷 초기화가 실행됩니다.

**B. 풀스택 dev** — 마이그레이션·backend·frontend 까지 컨테이너로 일괄 기동.

```bash
docker compose --profile app up
```

기동 순서: postgres/redis/minio healthy → createbuckets → **migrate(Flyway)** → **backend(`nest start --watch`, :3011)** → **frontend(`next dev`, :3012)**.

- 소스코드는 host bind-mount 로 라이브 편집됩니다 (`./codebase/backend`, `./codebase/frontend` 그대로 반영).
- `dist`, `.next`, `node_modules` 는 named volume(`backend_node_modules`, `backend_dist`, `frontend_node_modules`, `frontend_next`)으로 host 와 격리되어 macOS native 모듈(예: bcrypt)이 컨테이너로 새지 않습니다.
- 컨테이너에 의존성을 추가할 때는 `docker compose exec backend npm install <pkg>` 로 컨테이너 안에서 실행하고, named volume 재시드가 필요하면 `docker volume rm clemvion_backend_node_modules` 후 `docker compose --profile app up --build`.
  - 이전 버전(`idea-workflow_*`) 볼륨이 남아 있다면 한 번에 정리: `docker volume ls -q --filter name=^idea-workflow_ | xargs -r docker volume rm`.
- `codebase/packages/expression-engine`·`codebase/packages/node-summary` 는 이미지에 baked-in. 변경 시 `docker compose build backend frontend` 로 재빌드.
- 마이그레이션만 재실행: `docker compose --profile app run --rm migrate`.

> 풀스택 dev 모드를 쓰면 아래 「3. 의존성 설치 및 실행」 단계는 건너뛸 수 있습니다 (host-mode dev 는 여전히 지원).

### 2. 환경 변수 설정

**Frontend** (`codebase/frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3011/api
NEXT_PUBLIC_WS_URL=http://localhost:3011
```

**Backend** (`codebase/backend/.env`)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<password>
DB_DATABASE=workflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=<secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_BUCKET=workflow
S3_REGION=us-east-1

# App
APP_PORT=3011
APP_URL=http://localhost:3011
FRONTEND_URL=http://localhost:3012

# Email (dev: console / prod: smtp)
MAIL_TRANSPORT=console
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<smtp-user>
MAIL_PASS=<smtp-password>
MAIL_FROM=noreply@example.com    # 배포 환경에서는 실제 발신 도메인으로 교체 (RFC 2606 placeholder)

# Security
# 일반 암호화 (32-byte hex / 64 hex chars). 빈 값이면 암호화 비활성 (dev 전용).
ENCRYPTION_KEY=<32-byte-hex>
# Integration 자격증명 (OAuth refresh token / API key / DB password 등) JSONB
# 컬럼을 AES-256-GCM 으로 암호화한다. 누락 시 평문 저장 + 부팅 경고. 운영에서는
# 반드시 설정 (한 번 분실하면 기존 행 복호화 불가).
INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>
```

### 3. 의존성 설치 및 실행

```bash
# (clone 후 1회) git hook 등록 — default branch 직접 commit 차단
make setup-githooks

# Packages (expression-engine 빌드 - backend에서 참조)
cd codebase/packages/expression-engine
npm install
npm run build

# Backend
cd codebase/backend
npm install
npm run start:dev

# Frontend (새 터미널)
cd codebase/frontend
npm install
npm run dev
```

> `make setup-githooks` 는 `git config core.hooksPath .githooks` 한 줄을 실행한다. 자세한 차단 정책은 `CLAUDE.md` 의 "Enforcement (자동 차단 3-layer)" 절 참고.

- Frontend: http://localhost:3012
- Backend API: http://localhost:3011/api
- MinIO Console: http://localhost:9001

### 스크립트

| 명령어 | Frontend | Backend |
|--------|----------|---------|
| 개발 서버 | `npm run dev` | `npm run start:dev` |
| 빌드 | `npm run build` | `npm run build` |
| 린트 | `npm run lint` | `npm run lint` |
| 테스트 | `npm run test` | `npm run test` |
| 테스트 (E2E) | - | `npm run test:e2e` |

### 격리 인프라 기반 e2e (`make e2e-*`)

`docker-compose.e2e.yml` 의 격리 Postgres/Redis/MinIO 위에서 backend e2e 와 playwright 를 실행한다. compose project name 은 `Makefile` 이 현재 worktree dir basename 으로 도출 (`-p` flag) 하므로, 개발용 인프라(`docker-compose.yml`, project=`clemvion`) 와도 자동 분리되고 **여러 worktree 가 e2e 를 동시에 돌려도 컨테이너·볼륨·network 가 자동 격리**된다. 호스트 포트도 노출하지 않아 dev 가 5432/6379 등을 점유 중이어도 충돌 없음.

- main worktree: `clemvion-e2e`
- `.claude/worktrees/<task>-<slug>/`: `clemvion-e2e-<task>-<slug>`
- override: `COMPOSE_PROJECT=foo make e2e-test`

빌드 서비스마다 `image:` 가 명시되어 있어 (`clemvion-e2e/backend:latest`, `clemvion-e2e/migrate:latest`, `clemvion-e2e/backend-deps:latest`) image 자체는 worktree 간 공유 → 두 번째 worktree 의 첫 e2e 가 image rebuild 비용을 다시 치르지 않는다.

```bash
make e2e-test        # backend supertest 1-shot (~30–60s). 끝나면 자동 down
make e2e-test-full   # backend + playwright. 끝나면 자동 down
make e2e-up          # 인프라 + backend-e2e 만 백그라운드 기동 (runner 제외)
make e2e-down        # 현 worktree 의 e2e 정리 (volume·orphan 모두)
make e2e-prune       # 모든 worktree 의 stale clemvion-e2e* compose project 일괄 정리 (jq 필요)
```

빌드 타겟 세 개 (`e2e-up`, `e2e-test`, `e2e-test-full`) 모두 매 실행 시 `docker compose ... --build` 로 backend 이미지를 갱신한다 (`e2e-down` / `e2e-prune` 은 정리 전용이라 제외). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 오버헤드는 작고, 새로 추가한 컨트롤러·라우트가 stale 이미지에 반영되지 않아 사일런트 404 로 실패하는 회귀를 차단한다.

> `git worktree remove` 로 worktree 를 정리한 뒤 docker daemon 에 해당 project 의 컨테이너·볼륨이 남아있을 수 있다. 주기적으로 `make e2e-prune` 으로 일괄 정리하거나, 정리 직전에 해당 worktree 안에서 `make e2e-down` 을 먼저 호출한다.
>
> **본 격리 방식 적용 직후 첫 실행 시** 이전 단일 `clemvion-e2e` namespace 로 만들어진 잔여 컨테이너·볼륨이 있을 수 있다. 한 번 `make e2e-prune` (또는 `docker compose -p clemvion-e2e -f docker-compose.e2e.yml down -v --remove-orphans`) 으로 비워주면 깔끔하다.

### 문서 링크 검증

`spec/` 의 markdown 내부 링크와 `codebase/frontend/src/content/docs/**.mdx` frontmatter `spec:` 항목 정합성을 확인한다.

```bash
python3 scripts/check-doc-links.py
```

- 종료 코드: 깨진 항목이 있으면 `1`, 모두 정상이면 `0`
- 의존성 없음 (Python 3 표준 라이브러리만 사용)
- 검사 항목: 파일 경로 존재 여부, anchor (`#section`) 가 대상 파일 헤딩 슬러그에 매칭되는지, MDX `spec:` 배열의 모든 경로 존재 여부
- PR 머지 전 또는 spec 헤딩을 변경한 후 한 번씩 돌려서 cross-reference 깨짐을 잡는 용도

### 운영 스크립트 (codebase/backend/scripts)

NestJS 앱을 부팅하지 않고 단발성 도구만 실행하는 스크립트들. 모두 `ts-node` (devDependencies) 로 실행한다.

#### BullMQ 손상 job 정리

`document-embedding` · `graph-extraction` 큐에 누적된 손상 job (payload 에 `documentId` 가 비어있는 레거시·외부 inject) 을 1회 청소한다. 정상 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 가 없다.

```bash
# 운영 환경 (컴파일된 dist 산출물, 컨테이너 안에서 실행)
docker compose exec backend npm run cleanup:queue-jobs           # dry-run — 후보만 출력
docker compose exec backend npm run cleanup:queue-jobs:apply     # --apply --pause-during-sweep

# 개발 환경 (ts-node, devDependencies 필요)
npx ts-node codebase/backend/src/scripts/cleanup-invalid-queue-jobs.ts                              # dry-run
npx ts-node codebase/backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply --pause-during-sweep # apply
```

운영 절차: ① dry-run 결과 검토 (jobId / name / timestamp / payloadKeys) → ② `:apply` 실행. `--pause-during-sweep` 가 sweep 직전 `queue.pause()`, 종료 시 `queue.resume()` 을 자동 수행해 워커가 같은 페이지를 동시에 집어가는 TOCTOU 를 차단하므로 워커 인스턴스를 별도로 정지할 필요는 없다. BullMQ Queue 만 `REDIS_HOST` / `REDIS_PORT` 환경변수로 직접 인스턴스화하므로 `@Processor` 워커가 활성화되지 않고 DB 자격증명도 로드되지 않는다.

## Docker / Kubernetes 배포

> 로컬 dev 풀스택 기동은 `docker compose --profile app up` 으로 대체할 수 있습니다 (위 「1. 인프라 실행」의 모드 B 참고). 아래 절차는 **프로덕션 이미지 빌드/배포** 용입니다.

프로덕션 서빙은 세 개의 컨테이너 이미지로 구성됩니다.

| 이미지 | Dockerfile | 역할 |
| ----- | ---------- | ---- |
| `backend` | `codebase/backend/Dockerfile` | NestJS API 서버 |
| `frontend` | `codebase/frontend/Dockerfile` | Next.js 16 (standalone build) |
| `migrate` | `codebase/backend/migrations/Dockerfile` | Flyway 기반 DB 스키마 마이그레이션 |

### 빌드

세 이미지 모두 **repo 루트가 빌드 컨텍스트**입니다 (`codebase/packages/*` 의 `file:` 의존성을 트래킹하기 위함).

```bash
# Backend
docker build -f codebase/backend/Dockerfile -t clemvion/backend .

# Frontend (NEXT_PUBLIC_*는 build-time에 client bundle에 인라인됨 — 환경별로 빌드)
docker build -f codebase/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
  -t clemvion/frontend .

# DB 마이그레이션
docker build -f codebase/backend/migrations/Dockerfile -t clemvion/migrate .
```

### 런타임 환경변수 (k8s ConfigMap/Secret)

**Backend** — `DB_*`, `REDIS_*`, `JWT_*`, `S3_*`, `APP_PORT`(기본 3011), `APP_URL`, `FRONTEND_URL`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`. 자세한 항목은 `codebase/backend/.env`의 키를 참고. `OAUTH_STUB_MODE=true`는 `NODE_ENV=production`과 함께 쓰면 부트스트랩이 거부합니다 (보안 가드).

**Frontend** — `INTERNAL_API_URL` (예: `http://backend.<ns>.svc:3011/api`) 을 Server Component fetch 경로로 권장. `PORT`/`HOSTNAME`은 Dockerfile 기본값 사용.

### Kubernetes 매니페스트

Kustomize 기반 매니페스트가 [`k8s/`](./k8s) 에 포함되어 있습니다.

- `k8s/base/` — 환경 공통 리소스 (Deployment, Service, ConfigMap, Secret 스키마, HAProxy Ingress, Flyway migration Job)
- `k8s/overlays/local` — docker-desktop / kind / minikube 용 (in-cluster Postgres/Redis/MinIO 포함)
- `k8s/overlays/staging`, `k8s/overlays/prod` — 외부 관리형 DB/캐시/S3 endpoint 와 환경별 image 태그

```bash
kubectl apply -k k8s/overlays/local      # 로컬
kubectl apply -k k8s/overlays/staging    # 스테이징
```

자세한 사용법(SealedSecrets 통합, Ingress 컨트롤러별 annotation, ArgoCD PreSync hook 등)은 [`k8s/README.md`](./k8s/README.md) 를 참고하세요.

## integration (SSO)
### Google OAuth 연동 설정

1. Google Cloud Console에서 OAuth 클라이언트 생성

1. https://console.cloud.google.com/ 접속 → 프로젝트 생성 (또는 기존 선택)
2. APIs & Services → OAuth consent screen
   - User type: External 선택
   - 앱 이름, 지원 이메일, 개발자 연락처 입력
   - Scopes: .../auth/userinfo.email, .../auth/userinfo.profile, openid 추가
   - Test users에 본인 Google 계정 추가 (Publishing 전까지 테스트 계정만 로그인 가능)
3. APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs 에 두 개 모두 등록:
   http://localhost:3011/api/auth/oauth/google/callback   ← 유저 로그인용
   http://localhost:3011/api/3rd-party/google/callback    ← 통합(Integration)용
   - 생성 후 Client ID / Client Secret 복사

2. codebase/backend/.env 설정

```text
OAUTH_STUB_MODE=false
GOOGLE_CLIENT_ID=<복사한 client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<복사한 client secret>
```

# 프론트엔드 리다이렉트 대상 (기본 3012; codebase/frontend/.env 의 PORT 와 일치해야 함)
```text
FRONTEND_URL=http://localhost:3012
APP_URL=http://localhost:3011
```

## 라이선스

Clemvion 은 **듀얼 라이선스(Dual Licensing)** 로 제공됩니다.

- **AGPL v3 (무료)** — 소스코드 공개 의무를 준수하는 조건으로 무료 사용이 가능합니다. 내부 업무 목적 사용은 공개 의무가 없습니다. 전문은 [`LICENSE`](./LICENSE) 참조.
- **상업 라이선스 (유료)** — AGPL v3 의무를 면제받고 소스 비공개 상태로 상업적 서비스를 운영하려는 경우 필요합니다. 안내·문의는 [`LICENSE-COMMERCIAL.md`](./LICENSE-COMMERCIAL.md) 참조.

상업 라이선스 문의: **admin@getit.co.kr**
