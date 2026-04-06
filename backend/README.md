# Idea Workflow - Backend

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
