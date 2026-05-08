# Spec: Database Query

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약)

SQL 쿼리를 실행하여 데이터베이스에서 데이터를 조회하거나 조작한다.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | DB Integration 참조 |
| query | String (표현식) | ✓ | — | SQL 쿼리 |
| parameters | Array \| String | — | [] | 파라미터 바인딩 (`$1`, `$2`, ...). JSON 배열 문자열도 허용 |
| queryType | Enum | ✓ | select | select / insert / update / delete / raw |

## 2. 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Success | 출력 | `success` | 쿼리 성공 결과 |
| Error | 출력 | `error` | 쿼리 실패 시 에러 정보 (분기 처리 가능) |

## 3. 출력 구조

**Success 포트 — SELECT:**
```json
{
  "rows": [ { "id": 1, "name": "..." }, ... ],
  "rowCount": 42,
  "fields": [ { "name": "id", "dataTypeID": 23 } ]
}
```

**Success 포트 — INSERT/UPDATE/DELETE (MySQL):**
```json
{
  "rows": [],
  "rowCount": 5,
  "insertId": 99,
  "fields": []
}
```

**Error 포트:**
```json
{
  "error": {
    "code": "QUERY_FAILED",
    "message": "syntax error at or near ..."
  }
}
```

## 4. 설정 UI

- Integration 선택 드롭다운 (DB 타입만 필터)
- Query Type 드롭다운
- SQL 에디터 (구문 강조, 줄 번호)
- Parameters 섹션: 순서 기반 바인딩 (`$1`, `$2`) — 각 파라미터에 표현식 입력

## 5. Handler 실행 세멘틱

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 동작은 아래와 같다.

**드라이버**: `pg` (PostgreSQL) 및 `mysql2` (MySQL). `credentials.driver`가 `'mysql'`이면 `mysql2/promise` 풀을 사용하며, `$1, $2, ...` 플레이스홀더를 내부적으로 `?`로 변환한다(파라미터는 여전히 배열 순서대로 바인딩). `credentials.host/port/database/username/password/driver` 중 하나라도 누락 시 `INTEGRATION_INCOMPLETE`.

**SSL 모드 매핑**:
| `credentials.ssl` | pg 옵션 |
|-------------------|--------|
| `disable` | `ssl: false` |
| `require` | `ssl: { rejectUnauthorized: false }` |
| `verify-full` | `ssl: { rejectUnauthorized: true }` |

**파라미터 바인딩** (`config.parameters`):
- 배열 → 그대로 `client.query(sql, params)`에 전달
- 문자열 → `JSON.parse`로 배열 복원. 파싱 실패 시 `INVALID_PARAMETERS`
- `undefined`/`null`/`''` → 빈 배열

**반환 shape**:
```json
{
  "rows": [...],
  "rowCount": 42,
  "fields": [{"name": "id", "dataTypeID": 23}],
  "query": "...",
  "queryType": "select",
  "durationMs": 18,
  "status": "ok"
}
```

커넥션 lifecycle: 핸들러는 integrationId + credential hash 기준으로 `pg.Pool` / `mysql2.Pool`을 캐시 재사용하며, 각 실행에서 `connect()` → `query()` → `release()` 흐름으로 노출된다.

**포트 라우팅**: 런타임 실패(연결/쿼리 오류)는 `error` 포트로 라우팅된다. 반면 사전 설정 오류(`INTEGRATION_INCOMPLETE`, `INVALID_PARAMETERS`, `INTEGRATION_SERVICE_UNAVAILABLE`)는 throw되어 워크플로우 전체 실패로 처리된다.

**에러 코드**: 공통 + `INVALID_PARAMETERS`, `INTEGRATION_SERVICE_UNAVAILABLE`. SQL 오류는 원본 메시지를 `error` 포트의 `error.message`와 Usage 로그에 기록한다.
