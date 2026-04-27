# Idea Workflow

누구나 자신만의 자동화 워크플로우를 만들고, AI와 함께 업무를 혁신한다.

**Idea Workflow**는 No-Code 워크플로우 빌더입니다. 드래그앤드롭 방식의 캔버스 에디터에서 워크플로우를 설계하고, 자동화된 실행 엔진을 통해 비즈니스 프로세스를 자동화할 수 있습니다. 비기술자부터 개발자까지 모두를 위한 도구입니다.

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
├── prd/                        # 제품 요구 사항 정의서 (PRD)
├── spec/                       # 기술 스펙 문서 (SDD)
├── frontend/                   # 클라이언트 (Next.js)
│   └── src/
│       ├── app/                #   App Router 페이지
│       │   ├── (auth)/         #     로그인 / 회원가입
│       │   ├── (main)/         #     대시보드, 워크플로우 목록 등
│       │   └── (editor)/       #     워크플로우 에디터
│       ├── components/         #   공통 컴포넌트
│       └── lib/                #   유틸리티, 훅, API 클라이언트, 스토어
├── backend/                    # 서버 (NestJS)
│   └── src/
│       └── modules/
│           ├── auth/           #   인증 (JWT, Passport)
│           ├── workflows/      #   워크플로우 관리
│           ├── nodes/          #   노드 정의 및 설정
│           ├── edges/          #   노드 간 연결
│           ├── execution-engine/#  워크플로우 실행 엔진
│           ├── executions/     #   실행 이력
│           ├── triggers/       #   Webhook, Schedule, Manual 트리거
│           ├── schedules/      #   Cron 스케줄 관리
│           ├── integrations/   #   외부 서비스 연동
│           ├── websocket/      #   실시간 통신
│           ├── dashboard/      #   대시보드 통계
│           └── ...             #   users, workspaces, notifications 등
├── packages/
│   └── expression-engine/      # Expression Language 엔진
├── docker-compose.yml          # 인프라 (PostgreSQL, Redis, MinIO)
└── README.md
```

## 설치 방법

### 사전 요구 사항

- Node.js 20+
- Docker & Docker Compose

### 1. 인프라 실행

```bash
docker compose up -d
```

PostgreSQL(5432), Redis(6379), MinIO(9000/9001)가 실행됩니다.

### 2. 환경 변수 설정

**Frontend** (`frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3011/api
NEXT_PUBLIC_WS_URL=http://localhost:3011
```

**Backend** (`backend/.env`)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<password>
DB_DATABASE=idea_workflow

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
FRONTEND_URL=http://localhost:3000

# Email (dev: console / prod: smtp)
MAIL_TRANSPORT=console
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<smtp-user>
MAIL_PASS=<smtp-password>
MAIL_FROM=noreply@ideaworkflow.com

# Security
ENCRYPTION_KEY=<32-byte-hex>
```

### 3. 의존성 설치 및 실행

```bash
# Packages (expression-engine 빌드 - backend에서 참조)
cd packages/expression-engine
npm install
npm run build

# Backend
cd backend
npm install
npm run start:dev

# Frontend (새 터미널)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000
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

## Docker / Kubernetes 배포

프로덕션 서빙은 세 개의 컨테이너 이미지로 구성됩니다.

| 이미지 | Dockerfile | 역할 |
| ----- | ---------- | ---- |
| `backend` | `backend/Dockerfile` | NestJS API 서버 |
| `frontend` | `frontend/Dockerfile` | Next.js 16 (standalone build) |
| `migrate` | `backend/migrations/Dockerfile` | Flyway 기반 DB 스키마 마이그레이션 |

### 빌드

세 이미지 모두 **repo 루트가 빌드 컨텍스트**입니다 (`packages/*` 의 `file:` 의존성을 트래킹하기 위함).

```bash
# Backend
docker build -f backend/Dockerfile -t idea-workflow/backend .

# Frontend (NEXT_PUBLIC_*는 build-time에 client bundle에 인라인됨 — 환경별로 빌드)
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
  -t idea-workflow/frontend .

# DB 마이그레이션
docker build -f backend/migrations/Dockerfile -t idea-workflow/migrate .
```

### 런타임 환경변수 (k8s ConfigMap/Secret)

**Backend** — `DB_*`, `REDIS_*`, `JWT_*`, `S3_*`, `APP_PORT`(기본 3011), `APP_URL`, `FRONTEND_URL`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`. 자세한 항목은 `backend/.env`의 키를 참고. `OAUTH_STUB_MODE=true`는 `NODE_ENV=production`과 함께 쓰면 부트스트랩이 거부합니다 (보안 가드).

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

# integration (SSO)
## Google OAuth 연동 설정

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
   http://localhost:3011/api/auth/oauth/google/callback          ← 유저 로그인용 (이번 작업)
   http://localhost:3011/api/integrations/oauth/callback/google  ← 통합(Integration)용 (기존)
   - 생성 후 Client ID / Client Secret 복사

2. backend/.env 설정

```text
OAUTH_STUB_MODE=false
GOOGLE_CLIENT_ID=<복사한 client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<복사한 client secret>
```

# 프론트엔드 리다이렉트 대상 (기본값이 3002라서 실제 포트와 일치하는지 확인)
```text
FRONTEND_URL=http://localhost:3002
APP_URL=http://localhost:3011
```
