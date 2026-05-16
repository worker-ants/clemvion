# 신규 식별자 충돌 검토 — naming_collision

검토 모드: --impl-prep  
대상 파일: `Makefile`, `docker-compose.e2e.yml`  
변경 내용: `e2e-up` / `e2e-test` / `e2e-test-full` Makefile 타겟에 `--build` 플래그 추가

---

## 발견사항

### 발견 없음

본 변경(Makefile 타겟에 `--build` 플래그 추가)은 식별자를 새로 도입하지 않는다. 구체적으로 아래 6개 관점을 각각 점검한 결과:

1. **요구사항 ID 충돌** — 새로 부여된 요구사항 ID 없음. 기존 플랜 문서(`plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`)의 작업 항목 변경만 발생.

2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 미도입. `Makefile`·`docker-compose.e2e.yml`의 서비스 이름(`backend-e2e`, `backend-e2e-runner`, `playwright-runner`, `postgres`, `redis`, `minio`, `createbuckets`, `migrate`)과 Make 타겟명(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 모두 기존에 존재하는 식별자이며 의미가 변경되지 않는다.

3. **API endpoint 충돌** — API 경로 변경 없음.

4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경 없음.

5. **환경변수·설정키 충돌** — `docker-compose.e2e.yml`에 선언된 환경변수(`NODE_ENV`, `APP_PORT`, `APP_URL`, `FRONTEND_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `REDIS_HOST`, `REDIS_PORT`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `MAIL_TRANSPORT`, `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, `E2E_BASE_URL`, `POSTGRES_VERSION`, `MC_USER`, `MC_PASS`, `CI`, `PLAYWRIGHT_BASE_URL`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`)는 모두 기존 `backend/.env.example` 및 `docker-compose.yml`(dev)에서 동일한 의미로 이미 사용 중이다. 신규 도입된 키 없음.

6. **파일 경로 충돌** — 새 spec 파일이나 파일 경로 변경 없음. `Makefile`·`docker-compose.e2e.yml` 두 파일 모두 repo 루트에 기존부터 존재한다.

---

## 요약

`Makefile`의 `e2e-up`·`e2e-test`·`e2e-test-full` 타겟에 `--build` 플래그를 추가하는 이번 변경은 기존 식별자의 동작 방식(컨테이너를 기동 전 항상 rebuild)을 보강할 뿐이며, 새로운 식별자(요구사항 ID, 엔티티명, API 경로, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다. 6가지 신규 식별자 충돌 관점 모두에서 발견 사항이 없다.

---

## 위험도

NONE
