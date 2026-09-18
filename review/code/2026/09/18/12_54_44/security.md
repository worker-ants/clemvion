# Security Review — trigger (workflow_id) 인덱스 + 외부 해제 select 좁히기 (V111)

## 검토 범위

- `codebase/backend/migrations/README.md` (§5 신규 추가 인덱스 컨벤션 문서화)
- `codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` (신규 인덱스 마이그레이션)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` / `.spec.ts` (`releaseExternalForParent` 의 `select` 좁히기)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (신규 스키마 단언)
- `plan/in-progress/spec-draft-trigger-workflow-index.md`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/consistency/**` (spec draft·문서·리뷰 산출물)

실제 소스는 `Read` 로 직접 열어 대조했다(`trigger-resource-releaser.service.ts`, `trigger.entity.ts`, `chat-channel-binder.service.ts`, e2e spec 전문).

## 발견사항

### [INFO] SQL 마이그레이션·e2e 신규 쿼리는 인젝션 표면 없음 (근거 기록)

- 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:199-211`
- 상세: `V111` 마이그레이션은 정적 문자열(`DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);`)만 실행하며 사용자 입력이 개입할 여지가 없다. e2e 에 새로 추가된 `pg_index`/`pg_class` 조회(`WHERE c.relname = 'idx_trigger_workflow_id'`)도 리터럴 문자열이고, 파일 내 다른 기존 쿼리들은 모두 `$1`/`$2` 파라미터 바인딩(`INSERT INTO secret_store …`, `SELECT count(*) … WHERE ref LIKE $1`)을 이어 쓴다. 인젝션 취약점 없음.

### [INFO] `releaseExternalForParent` 의 `select` 좁히기는 오히려 노출 축소 (보안 관점 긍정적)

- 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` (72번째 줄 부근)
- 상세: 변경 전 `this.triggerRepository.find({ where: parent })` 는 `Trigger` 엔티티의 전 컬럼(`authConfigId`, `endpointPath`, 타임스탬프, 헬스 상태 등 포함)을 메모리에 올렸다. 변경 후 `select: { id: true, type: true, config: true }` 로 좁혀 실제 소비처(`releaseExternalMany` → `chatChannelBinder.teardownChatChannel` 이 `trigger.id`/`trigger.config.chatChannel` 만 읽고, schedule 분기가 `trigger.type`/`trigger.id` 만 읽음)와 정확히 일치시켰다. `chat-channel-binder.service.ts:365` (`teardownChatChannel`)에서 실제로 `trigger.id`·`trigger.config` 외 필드를 참조하지 않음을 직접 확인했다. 불필요한 컬럼(예: `authConfigId`, 비밀 참조 성격 필드)을 애플리케이션 메모리·로그 경로에 싣지 않게 되어 최소 권한/데이터 최소화 원칙에 부합한다. 새로운 위험을 도입하지 않는다.
- 참고: `Trigger.config` 는 `jsonb` 컬럼이며 엔티티에 `select: false` 지정이 없다 — 이번 변경으로 명시적으로 좁혀 적재하므로 이전보다 노출 표면이 줄었을 뿐, 새 시크릿 노출 경로는 생기지 않는다.

### [INFO] e2e 비밀 시딩은 placeholder 암호문 + 파라미터 바인딩

- 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (`secret_store` INSERT, `SECRET_NAMES` 상수 정의부)
- 상세: 테스트가 `secret_store` 행에 넣는 값은 `Buffer.from('ciphertext-placeholder')` 이며 실제 평문 비밀이 아니다. `ref` 조회도 `LIKE $1` 파라미터 바인딩을 사용한다. 하드코딩된 실 시크릿(API 키·토큰 등)은 없음.

### [INFO] `.conf`/문서 변경은 순수 문서·설정으로 보안 영향 없음

- 위치: `codebase/backend/migrations/README.md`, `codebase/backend/migrations/V111__trigger_workflow_id_index.conf`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`
- 상세: `executeInTransaction=false` 설정은 기존 컨벤션(V106/V110 선례)과 동일한 Flyway 실무 설정이며 자격증명·엔드포인트 등 민감정보를 포함하지 않는다. spec/README 변경은 인덱스 설계 근거 서술뿐이다.

## 점검 관점별 요약

1. 인젝션 — 신규 SQL/쿼리 전부 정적 문자열 또는 파라미터 바인딩. 해당 없음.
2. 하드코딩된 시크릿 — 없음(e2e 는 placeholder 암호문).
3. 인증/인가 — 이번 diff 는 인증/인가 로직을 변경하지 않는다. `releaseExternalForParent` 는 호출 시점에 이미 워크플로/워크스페이스 삭제 권한 검증이 끝난 뒤 내부적으로 호출되는 자원 정리 협력자이며, `select` 좁히기가 인가 판단에 쓰이는 필드를 제거하지도 않았다(호출부에서 인가 필드를 쓰지 않음을 확인).
4. 입력 검증 — 사용자 입력을 직접 받는 코드 변경 없음(내부 서비스 계층, 마이그레이션).
5. OWASP Top 10 — 해당 사항 없음.
6. 암호화 — 변경 없음. e2e 는 기존 방식(암호화 컬럼에 placeholder 삽입)을 그대로 재사용.
7. 에러 처리 — `removeScheduleJobsOrRestore` 등 기존 에러 메시지 처리 로직은 이번 diff 범위 밖(변경 없음). 새로 추가된 코드에 민감정보를 담은 에러 메시지 노출 없음.
8. 의존성 보안 — 신규 의존성 추가 없음.

## 요약

이번 변경은 (1) `trigger.workflow_id` FK 에 대한 `CREATE INDEX CONCURRENTLY` 마이그레이션 추가, (2) 트리거 자원 해제 서비스의 TypeORM `find` 호출에 `select` 컬럼 좁히기, (3) 관련 e2e/unit 테스트 및 spec 문서 갱신으로 구성된 순수 성능·데이터 최소화 개선이다. 신규 SQL 은 전부 정적 문자열이거나 파라미터 바인딩을 사용해 인젝션 표면이 없고, 하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 에러 처리 등 어떤 항목에서도 문제를 발견하지 못했다. `select` 좁히기는 오히려 불필요한 컬럼(비밀 참조·인증 설정 등) 적재를 줄이는 방향이라 보안 관점에서 부정적 영향이 없다.

## 위험도

NONE
