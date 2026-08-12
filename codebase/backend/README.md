# Clemvion - Backend

NestJS 기반 백엔드 API 서버입니다.

## 실행

```bash
npm install
npm run start:dev
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run start:dev` | 개발 서버 (watch mode) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드된 앱 실행 |
| `npm run lint` | ESLint — 트리를 고치지 않음(`--fix` 없음). **warning 1건도 실패**(`--max-warnings 0`) |
| `npm run lint:fix` | ESLint + 자동 수정 (`--fix`) |
| `npm run test` | 단위 테스트 |
| `npm run test:e2e` | E2E 테스트 |
| `npm run test:cov` | 커버리지 리포트 |

## 환경 변수

`.env` 파일을 참고하세요. 주요 항목:

- `DB_*` - PostgreSQL 연결 정보
- `REDIS_*` - Redis 연결 정보
- `JWT_*` - JWT 인증 설정
- `S3_*` - MinIO/S3 스토리지 설정
- `MAIL_*` - 이메일 발송 설정 (SMTP)
- `APP_*` - 앱 포트, URL 설정
- `ENCRYPTION_KEY` - 크레덴셜 암호화 키

## 배포 주의 — 기동을 멈추는 검사

부팅 시 두 검사가 순서대로 돌고, 걸리면 `app.listen` 에 도달하기 전에 프로세스가 죽습니다(fail-closed). **둘은 성격이 다르니 구분해서 보세요** — 하나는 production 환경변수 축이고, 다른 하나는 환경과 무관한 구조 불변식입니다.

### 1. production 설정 검증 — `assertProductionConfig` (`NODE_ENV=production` 전용)

`NODE_ENV=production` 에서 다음 중 하나라도 해당하면 부팅을 즉시 거부합니다. 운영용 무작위 secret 을 반드시 설정하세요 (`openssl rand -hex 32` 등). 비-production 에서는 no-op 입니다.

- `JWT_SECRET` 가 미설정·예시/기본값이거나 32자 미만 (CWE-521)
- `ENCRYPTION_KEY` 가 미설정이거나 공개 `.env.example` 예시 키
- `OAUTH_STUB_MODE=true` 또는 `LLM_STUB_MODE=true` (비보안 stub)
- `MCP_ALLOW_INSECURE_URL=true` (SSRF 방어 우회)

### 2. 워크스페이스 reflection 캐너리 — `assertWorkspaceIdReflectionWorks` (환경 무관)

`@WorkspaceId()` 를 소비하는 라우트를 **하나도 인식하지 못하면** 부팅을 거부합니다. `RolesGuard` 가 그 판별로 멤버십 검증 대상을 좁히므로, 판별이 깨지면 워크스페이스 라우트가 검증을 **조용히** 건너뛰어 cross-tenant 접근이 열립니다 — 런타임에 조용히 새는 것보다 배포가 멈추는 편이 낫다는 판단입니다.

> **위 검사와 성격이 다릅니다.** `assertProductionConfig` 는 "production 환경변수" 축이라 dev·CI 에서는 아무 일도 하지 않지만, 이쪽은 **환경과 무관한 구조 불변식**이라 `NODE_ENV` 값에 상관없이 모든 환경에서 같은 조건으로 멈춥니다. 따라서 production 배포에서만 처음 드러나는 종류가 아닙니다 — 다만 파손 계기 중 하나가 빌드 산출물(minify/mangle)이라 **배포 이미지의 부팅 로그를 확인하는 것이 최종 확인**입니다.

- 깨지는 계기: `@nestjs/*` 업그레이드(caret 이라 minor/patch 로도 옵니다) · 핸들러를 감싸는 데코레이터 도입으로 `Function.name` 소실 · 빌드 단계 minify/mangle
- 정상 기동 시 인식한 라우트 수가 부팅 로그에 남습니다 — `@WorkspaceId() 소비 라우트 N건 인식`. 캐너리는 **0건만** 잡으므로, 일부 라우트만 인식 실패하는 부분 파손은 이 수치의 급락으로만 드러납니다. 배포 후 이 줄을 확인하세요.
- 먼저 볼 곳: `src/common/decorators/workspace.decorator.ts` 의 `handlerConsumesWorkspaceId`. 설계 근거 전문은 `src/common/decorators/workspace-reflection-canary.ts` 상단 주석.

## Docker

프로덕션 이미지는 `codebase/backend/Dockerfile`(멀티스테이지, non-root `node` 유저)로 빌드합니다. 빌드 컨텍스트는 **repo 루트** — `file:../codebase/packages/*` 의존성을 함께 가져오기 위함입니다.

```bash
# repo 루트에서
docker build -f codebase/backend/Dockerfile -t clemvion/backend .
```

- 컨테이너 포트: `EXPOSE 3011` (실제 바인딩은 `APP_PORT` env로 제어, k8s에서 override 가능)
- 헬스 엔드포인트: `GET /api/health` (DB·Redis 연결 상태 포함) — k8s readinessProbe 용도
- DB 마이그레이션은 본 이미지에 포함되지 않습니다. 별도 Flyway 이미지 `codebase/backend/migrations/Dockerfile` 참고: [`migrations/README.md`](./migrations/README.md).
