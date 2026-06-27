# 보안(Security) 리뷰 — execution-seq-allocator-load e2e

## 발견사항

### [INFO] docker-compose.e2e.yml: e2e 전용 시크릿이 평문으로 존재
- 위치: `docker-compose.e2e.yml` — `JWT_SECRET`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `DB_PASSWORD`, `S3_SECRET_KEY`, `MINIO_ROOT_PASSWORD` 등 다수 라인
- 상세: 이 값들은 파일 내 주석(`운영 절대 사용 금지`)과 함께 e2e 전용 더미 시크릿임이 명확히 표시되어 있다. 신규 변경(`REDIS_HOST`/`REDIS_PORT`)은 시크릿이 아니며 기본값과 동일한 호스트명/포트 명시에 불과하다. 기존에 존재하는 시크릿 패턴은 본 변경이 도입한 것이 아니므로 이번 diff 의 책임 범위 밖이다.
- 제안: 현상 유지 적절. 단, 향후 실 운영 시크릿이 이 파일에 혼입되지 않도록 CI에서 시크릿 스캔(예: truffleHog, gitleaks) 적용을 권장한다.

### [INFO] e2e 테스트: Redis 연결 정보가 환경변수로 주입됨 (양호)
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 66–67
- 상세: `REDIS_HOST`와 `REDIS_PORT`를 `process.env`로 읽고 기본값(`'redis'`, `'6379'`)을 fallback으로 사용한다. 하드코딩된 시크릿 없음. 기본값은 공개 기본 포트이므로 보안 문제 없음.
- 제안: 해당 없음.

### [INFO] Redis 연결에 인증(AUTH) 미적용
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 143–144, `docker-compose.e2e.yml` redis 서비스
- 상세: `new Redis({ host, port })` 호출 시 password 파라미터가 없으며 docker-compose의 redis 서비스도 requirepass 설정 없이 구동된다. e2e 전용 격리 네트워크(`docker network`) 안에서만 접근 가능하고 호스트 포트를 노출하지 않으므로 실질적 위협은 없다. 운영 Redis에는 반드시 인증이 적용되어야 한다.
- 제안: e2e 환경이므로 현 수준 허용 가능. 운영 배포 Redis와 동일한 Redis 인스턴스를 공유하지 않도록 격리를 유지한다.

### [INFO] 테스트 코드에서 `as never` 타입 우회
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 154–155
- 상세: `makeProvider(redisA) as never`로 TypeScript 타입 검사를 우회한다. 런타임 보안 위험은 없으나(덕타이핑 어댑터가 필요한 인터페이스를 충족함) 타입 시스템 우회는 잠재적 오용 경로를 만들 수 있다. 이미 이전 리뷰 사이클에서 주석으로 의도가 명시된 상태다.
- 제안: 보안 위험 없음. 현 처리 적절.

## 요약

이번 변경은 e2e 통합 테스트 파일 신규 추가와 docker-compose.e2e.yml에 `REDIS_HOST`/`REDIS_PORT` 환경변수 명시 추가로 구성된다. 두 파일 모두 테스트 인프라 전용으로, 외부에 노출되는 API 경로·인증 로직·사용자 입력 처리·암호화 경로가 전혀 포함되지 않는다. 인젝션 취약점, 하드코딩된 운영 시크릿, 인증/인가 우회, XSS/CSRF, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10 해당 항목은 발견되지 않는다. redis 무인증은 e2e 전용 격리 네트워크 내에서만 유효하며 허용 가능한 수준이다. 보안 관점에서 이번 변경은 위험도가 없다.

## 위험도

NONE
