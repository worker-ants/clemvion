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
| `npm run lint` | ESLint |
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

## Docker

프로덕션 이미지는 `backend/Dockerfile`(멀티스테이지, non-root `node` 유저)로 빌드합니다. 빌드 컨텍스트는 **repo 루트** — `file:../packages/*` 의존성을 함께 가져오기 위함입니다.

```bash
# repo 루트에서
docker build -f backend/Dockerfile -t clemvion/backend .
```

- 컨테이너 포트: `EXPOSE 3011` (실제 바인딩은 `APP_PORT` env로 제어, k8s에서 override 가능)
- 헬스 엔드포인트: `GET /api/health` (DB·Redis 연결 상태 포함) — k8s readinessProbe 용도
- DB 마이그레이션은 본 이미지에 포함되지 않습니다. 별도 Flyway 이미지 `backend/migrations/Dockerfile` 참고: [`migrations/README.md`](./migrations/README.md).
