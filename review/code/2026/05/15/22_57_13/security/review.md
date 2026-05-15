# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `cleanup-invalid-queue-jobs.ts` — Redis 연결 시 인증(password) 없음
  - 위치: `backend/src/scripts/cleanup-invalid-queue-jobs.ts` `createQueue()` 함수
  - 상세: `createQueue()`는 `REDIS_HOST`/`REDIS_PORT` 환경변수만 사용하고 Redis 인증 비밀번호(`REDIS_PASSWORD`/`REDIS_AUTH`)를 전혀 참조하지 않는다. 운영 Redis 에 AUTH 가 설정되어 있지 않다면 문제가 없지만, 인증이 있는 환경에서는 연결 자체가 실패하거나 향후 AUTH 를 활성화할 때 스크립트만 누락될 위험이 있다. NestJS 앱 모듈의 BullMQ 설정과 인증 파라미터가 일치하는지 명시적으로 맞춰둘 것이 권장된다.
  - 제안: `REDIS_PASSWORD` 환경변수를 읽어 `connection: { host, port, password: process.env.REDIS_PASSWORD ?? undefined }` 형태로 전달한다.

- **[INFO]** `migrate-button-ids.ts` — `CLI_WORKSPACE_ID` / `CLI_USER_ID` 를 모듈 최상위에서 즉시 파싱
  - 위치: `backend/src/scripts/migrate-button-ids.ts` 62~65행
  - 상세: `parseCliFlag('--workspace-id')` 와 `parseCliFlag('--user-id')` 호출이 `main()` 바깥 모듈 최상위에 있다. 테스트 환경에서 이 파일을 import 하면 `process.argv` 를 읽는 부작용이 발생한다. 단위 테스트(`.spec.ts`)가 `backfillButtonIds` 만 import 하므로 현재는 무해하지만, 코드 주석에서 스스로 언급한 "module import 만으로 process.env 가 오염되는 문제(review W-9)"와 동일한 패턴을 `process.argv` 에서도 반복하고 있다.
  - 제안: `CLI_WORKSPACE_ID` / `CLI_USER_ID` 파싱을 `main()` 내부로 이동하거나 `parseCliArgs()` 함수로 캡슐화해 `main()` 진입 시에만 호출되도록 한다.

- **[INFO]** `migrate-button-ids.ts` — `--workspace-id` / `--user-id` CLI 인수의 UUID 형식 검증 없음
  - 위치: `backend/src/scripts/migrate-button-ids.ts` `runMigration()` 내 audit_log INSERT
  - 상세: `CLI_WORKSPACE_ID`와 `CLI_USER_ID`는 DB 쿼리 파라미터(`$1`, `$2`)로 parameterized query 에 바인딩되므로 SQL 인젝션 위험은 없다. 그러나 UUID 형식 검증이 없어 임의 문자열이 audit_log.workspace_id / audit_log.user_id 컬럼에 기록될 수 있다. 스크립트가 운영자 수동 실행 전제이므로 위험도는 낮으나, UUID regex 검증을 추가하면 오입력을 사전 차단할 수 있다.
  - 제안: `main()`에서 `CLI_WORKSPACE_ID`/`CLI_USER_ID` 를 사용하기 전 `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` 등으로 형식 검증 후 잘못된 경우 즉시 오류 종료한다.

- **[INFO]** `cleanup-invalid-jobs.util.ts` — job payload key 목록이 console 출력에 노출
  - 위치: `backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts` 79~83행 (`runSweep` 내 logger.log)
  - 상세: `Object.keys(job.data ?? {}).join(',')` 로 job payload 의 키 목록을 로그로 출력한다. 값(value)이 아닌 키(key) 만 출력하므로 직접적인 민감 정보 노출은 아니다. 그러나 운영 로그에 job 내부 구조가 기록되면 payload 스키마가 로그 수집 시스템에 노출된다. 현재 payload 가 `documentId` 외 다른 키를 포함하지 않는다면 무해하지만, 향후 payload 확장 시 민감 키가 로그에 포함될 수 있다.
  - 제안: 허용된 키 목록(allowlist)만 출력하거나, 로그 레벨을 debug 로 제한해 운영 환경 기본 로그에는 포함되지 않도록 한다.

- **[INFO]** `background-runs.service.ts` — 커서(cursor) 디코딩 시 JSON.parse 결과를 단순 타입 캐스팅
  - 위치: `backend/src/modules/executions/background-runs/background-runs.service.ts` `decodeCursor()` 함수
  - 상세: `JSON.parse(decoded) as CursorPayload` 로 파싱 후 `typeof parsed.s !== 'string'` 등으로 필드 존재 여부를 검증한다. 문자열 필드 자체의 유효성(`i` 는 UUID 형식이어야 하고 `s` 는 ISO8601 날짜여야 함)은 `s` 에 대해서만 `new Date(parsed.s)` 로 부분 검증하고, `i`(NodeExecution ID)의 UUID 형식은 검증하지 않는다. 악의적으로 조작된 커서가 `ne.id > :lastId` 조건에 임의 문자열을 주입할 수 있으나, TypeORM parameterized query 이므로 SQL 인젝션 위험은 없다. 다만 DB 측 타입 오류(UUID 열에 비-UUID 문자열 비교)를 야기할 수 있다.
  - 제안: `i` 필드에 대해서도 UUID 형식 정규식 검증을 추가한다.

- **[INFO]** `backend/package.json` — `cleanup:queue-jobs` npm script 가 dist 빌드 산출물에만 의존
  - 위치: `backend/package.json` `scripts.cleanup:queue-jobs`
  - 상세: `node dist/scripts/cleanup-invalid-queue-jobs.js` 를 직접 실행하는 스크립트는 `npm run build` 를 먼저 수행하지 않으면 최신 코드가 반영되지 않은 이전 빌드를 실행할 위험이 있다. 운영자가 코드 변경 후 빌드 없이 바로 스크립트를 실행하는 실수가 발생할 수 있다.
  - 제안: 스크립트를 `npm run build && node dist/scripts/cleanup-invalid-queue-jobs.js` 로 변경하거나, 문서/주석에 "반드시 빌드 후 실행" 경고를 명시한다.

### 요약

보안 관점에서 이번 변경(cleanup 스크립트 리팩토링 + background-runs 서비스 코드 정렬)은 전반적으로 안전하게 구현되었다. SQL 쿼리는 TypeORM parameterized query 와 `$1`, `$2` 바인딩을 일관되게 사용해 SQL 인젝션 위험이 없고, 하드코딩된 시크릿은 발견되지 않았으며, 민감 정보(DB 자격증명, 비밀번호)는 환경변수에서만 읽는다. IDOR 차단을 위한 workspace 소유권 검증 로직도 서비스 레이어에 적절히 구현되어 있다. 다만 Redis 연결 시 인증 파라미터 미설정, CLI 인수의 UUID 형식 검증 누락, 커서 ID 필드 검증 미흡, 모듈 최상위에서의 `process.argv` 즉시 파싱 등 소규모 개선 가능 사항이 다수 INFO 등급으로 식별되었다. 이들은 즉각적인 취약점이 아니지만 운영 환경 견고성과 잠재적 오용을 방지하기 위해 개선을 권장한다.

### 위험도

LOW
