## Security Code Review

### 발견사항

---

**[WARNING] 마이그레이션 스크립트에 하드코딩된 기본 DB 패스워드**
- 위치: `backend/scripts/migrate-button-ids.ts:170`
- 상세: `password: process.env.DB_PASSWORD ?? 'workflow_dev'` — 환경변수 미설정 시 `'workflow_dev'`가 fallback으로 사용됨. 스크립트 실행 환경에서 `.env` 로드 실패 경고가 출력되더라도 스크립트가 계속 진행되어 해당 기본값으로 DB 접속을 시도할 수 있음. 실수로 프로덕션 환경에서 `.env` 없이 실행할 경우 동일 기본 자격증명을 사용하는 서버에 쓰기 트랜잭션이 실행됨.
- 제안: `DB_PASSWORD`를 필수값으로 강제하고 미설정 시 즉시 종료
  ```typescript
  const password = process.env.DB_PASSWORD;
  if (!password) {
    console.error('[migrate-button-ids] DB_PASSWORD environment variable is required.');
    process.exit(1);
  }
  ```

---

**[WARNING] CLI 인자 (`--workspace-id`, `--user-id`) UUID 포맷 검증 없음**
- 위치: `backend/scripts/migrate-button-ids.ts:50-53`, `224-229`
- 상세: `CLI_WORKSPACE_ID` / `CLI_USER_ID` 는 형식 검증 없이 `audit_log` 에 삽입됨. 파라미터화 쿼리를 사용하므로 SQL 인젝션은 차단되어 있으나, 임의 문자열(예: 빈 문자열, 제어 문자, 수백 바이트 문자열)이 그대로 저장될 수 있음. audit_log 의 귀책 목적이 훼손됨.
- 제안:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(CLI_WORKSPACE_ID) || !UUID_RE.test(CLI_USER_ID)) {
    throw new Error('--workspace-id and --user-id must be valid UUIDs.');
  }
  ```

---

**[WARNING] 전체 테이블 스캔 후 메모리 적재 — DoS/OOM 위험**
- 위치: `backend/scripts/migrate-button-ids.ts:183-200`
- 상세: `SELECT ... WHERE n.type = ANY($1)` 쿼리에 row limit이 없으므로 대규모 DB에서는 수십만 건이 한꺼번에 메모리에 적재될 수 있음. 또한 모든 업데이트를 단일 트랜잭션으로 묶어 수행하므로 오랜 시간 동안 row lock을 점유해 운영 DB 응답 지연을 유발할 수 있음.
- 제안: `LIMIT`/`OFFSET` 또는 커서 기반 배치 처리로 분할 실행. 트랜잭션도 배치 단위로 분리(예: 500건마다 커밋).

---

**[INFO] `.env` 로드 실패 후에도 스크립트 실행 계속**
- 위치: `backend/scripts/migrate-button-ids.ts:40-47`
- 상세: `.env` 파일을 읽지 못할 경우 경고만 출력하고 `process.env` 에 이미 설정된 값을 사용하도록 계속 진행함. 의도된 설계이나, `DB_PASSWORD` 필수 검증이 없는 현재 상태에서는 하드코딩 기본값이 조용히 사용되는 경로로 이어질 수 있음. (위 WARNING 조치 시 자동 완화)

---

**[INFO] `backfillButtonIds` 에서 `PORT_ID_SLUG_REGEX` 와 `button-slug.util` 의 검증 로직이 각각 독립 구현**
- 위치: `backend/scripts/migrate-button-ids.ts:62` vs `backend/src/nodes/core/button-slug.util.ts`
- 상세: 마이그레이션 스크립트의 `PORT_ID_SLUG_REGEX` 정의 (`/^[a-zA-Z0-9_-]{1,64}$/`) 와 `button-slug.util` 의 검증이 별도 파일에 중복 선언됨. 향후 정책 변경 시 한 쪽만 수정되면 마이그레이션과 런타임 간 일관성이 깨질 수 있음.
- 제안: 마이그레이션 스크립트에서도 `port-id.util` 의 `PORT_ID_SLUG_REGEX` 를 import하여 단일 소스 유지.

---

### 요약

이번 변경사항의 핵심 보안 위험은 **마이그레이션 스크립트** 에 집중되어 있다. `shadow-workflow.ts` 와 `button-slug.util.ts` 의 런타임 코드는 기존 `sanitizeLlmProvidedString`, 파라미터화 쿼리, slug 정규식 검증 등 적절한 방어 레이어가 유지되고 있어 신규 취약점 소개 없이 깔끔하다. 마이그레이션 스크립트는 관리자용 일회성 도구이지만, 하드코딩된 DB 기본 패스워드와 UUID 검증 부재가 실수로 인한 데이터 오염이나 의도치 않은 프로덕션 접근 가능성을 열어두고 있어 배포 전 수정이 권장된다.

### 위험도

**MEDIUM**