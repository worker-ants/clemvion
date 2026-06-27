# 보안(Security) 리뷰

## 발견사항

### 파일 1: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts`

- **[INFO]** Redis 연결 정보가 환경변수로 주입됨 (하드코딩 없음)
  - 위치: 라인 66-67 (`REDIS_HOST`, `REDIS_PORT`)
  - 상세: `process.env.REDIS_HOST ?? 'redis'` 패턴으로 기본값을 제공한다. 기본값 `'redis'`는 Docker 내부 서비스 이름으로, 외부에서 직접 접근 불가한 내부망 주소이므로 문제없다.
  - 제안: 현행 유지.

- **[INFO]** `randomUUID()` 를 `node:crypto` 에서 직접 import 해 사용
  - 위치: 라인 2, 142, 163, 399
  - 상세: `Math.random()` 같은 약한 난수가 아닌 cryptographically secure UUID를 사용한다. 테스트 격리 키 생성 목적으로 올바른 선택이다.
  - 제안: 현행 유지.

- **[INFO]** `as never` 타입 단언 사용
  - 위치: 라인 123-124
  - 상세: duck-typed 어댑터를 DI 인터페이스로 캐스팅하기 위한 테스트 전용 타입 단언이다. 프로덕션 코드가 아닌 테스트 파일이므로 런타임 보안 영향 없음.
  - 제안: 현행 유지.

### 파일 2: `docker-compose.e2e.yml`

- **[WARNING]** e2e 전용 자격증명이 평문으로 docker-compose 파일에 포함됨
  - 위치: 라인 508-612 전반 (DB_PASSWORD, MINIO_ROOT_PASSWORD, S3_SECRET_KEY, JWT_SECRET, ENCRYPTION_KEY, INTEGRATION_ENCRYPTION_KEY)
  - 상세: `JWT_SECRET: clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`, `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` 등 실 암호화 키처럼 보이는 값이 VCS에 그대로 커밋된다. 파일 자체에 "운영 절대 사용 금지" 주석이 명시되어 있고, 이 파일의 목적이 e2e 테스트 전용 ephemeral 환경임을 고려할 때 의도된 설계로 판단된다. 그러나 ENCRYPTION_KEY가 실제 AES-256 키처럼 생겼고(`0123456789abcdef...` 64-hex), JWT_SECRET 역시 추측 가능한 패턴이 아닌 고정 문자열로 되어 있어, 이 값이 실수로 다른 환경에 복사될 경우 보안 사고로 이어질 수 있다.
  - 제안: 현행 주석("운영 절대 사용 금지") 수준은 적절하다. 추가로 고려할 수 있는 개선: (1) ENCRYPTION_KEY/JWT_SECRET 값 앞에 `INSECURE-TEST-ONLY-` 같은 prefix를 붙여 프로덕션 값과 시각적으로 명확히 구분, (2) CI/CD 시크릿 스캐너(gitleaks, truffleHog 등)에 이 파일 경로를 화이트리스트로 등록. 단, e2e 환경 특성상 필수 요건이 아니므로 운영 위험도는 낮다.

- **[INFO]** Redis 인증(requirepass) 없이 평문 접속
  - 위치: 라인 516-521 (redis 서비스 정의), 라인 459/665 (REDIS_HOST/REDIS_PORT 환경변수)
  - 상세: e2e docker-compose 의 Redis는 인증 없이 기동된다. docker internal network 에서만 접근 가능하고(호스트 포트 미노출), ephemeral 테스트 환경이므로 운영 위험 없음.
  - 제안: e2e 환경 목적에 부합, 현행 유지.

- **[INFO]** PostgreSQL/MinIO 자격증명이 평문으로 포함됨
  - 위치: 라인 508-510, 529-530, 567-569
  - 상세: `POSTGRES_PASSWORD: clemvion-e2e`, `MINIO_ROOT_PASSWORD: clemvion-e2e` 등 e2e 전용 단순 패스워드 사용. JWT_SECRET/ENCRYPTION_KEY와 동일하게 ephemeral 테스트 환경 전용이므로 운영 위험 없음.
  - 제안: 현행 유지.

- **[INFO]** playwright-runner의 `.git/.claude/spec/plan/review/memory` 등 민감 경로 마운트 제외
  - 위치: 라인 690-691 (주석)
  - 상세: 주석에서 명시적으로 민감 경로를 마운트에서 제외하고 있음을 확인. 실제 volumes에서도 `./codebase`, `./package.json`, `./pnpm-workspace.yaml`, `./pnpm-lock.yaml`, `./.npmrc` 만 선별 마운트하여 `.git`, `.claude`, `spec`, `plan`, `review` 등이 컨테이너에 노출되지 않는다.
  - 제안: 현행 설계 적절.

- **[INFO]** 이번 diff의 신규 추가 항목 (`REDIS_HOST: redis`, `REDIS_PORT: "6379"`)
  - 위치: diff 추가 라인 (backend-e2e-runner 서비스 environment 섹션)
  - 상세: 기존에 이미 `backend-e2e` 서비스에 동일 값이 존재하던 것을 runner 서비스에도 명시한 것. 기본값 `?? 'redis'`와 동일한 값을 중복 명시하는 것으로 보안 위험 없음.
  - 제안: 현행 유지.

## 요약

이번 변경은 e2e 테스트 파일(TypeScript)과 docker-compose 환경변수 추가로 구성된다. 테스트 코드는 `node:crypto`의 `randomUUID()`를 사용한 안전한 식별자 생성, 환경변수 기반 Redis 접속 설정 등 보안상 올바른 패턴을 따른다. docker-compose.e2e.yml의 평문 자격증명(JWT_SECRET, ENCRYPTION_KEY 등)은 ephemeral e2e 전용 값임이 주석으로 명시되어 있고 호스트 포트 미노출 등 격리 설계도 갖춰져 있어 운영 유출 위험은 낮다. 다만 VCS에 암호화 키처럼 보이는 고정 값이 포함되어 있어 시각적 혼동을 줄이는 prefix 추가 또는 시크릿 스캐너 예외 등록을 권장한다. 인젝션, 인증 우회, OWASP Top 10 해당 취약점은 발견되지 않았다.

## 위험도

LOW
