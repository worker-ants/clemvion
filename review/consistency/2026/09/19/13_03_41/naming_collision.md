# 신규 식별자 충돌 검토 — spec-draft-integration-connection-tests

## 발견사항

- **[WARNING]** `DB_CONNECT_FAILED`(신규) 가 기존 `DB_CONNECTION_ERROR` 와 근접 동형이면서 분류 경계가 다르다
  - target 신규 식별자: `DB_CONNECT_FAILED` — `plan/in-progress/spec-draft-integration-connection-tests.md` §A(490행 부근, `IntegrationTestResult.code`), §F(에러 코드 vocabulary 신규 행)
  - 기존 사용처:
    - `codebase/backend/src/nodes/core/error-codes.ts:32` — `ErrorCode.DB_CONNECTION_ERROR`
    - `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:771-943` — `DbRuntimeErrorCode` 유니온의 멤버, `classifyDbError`/`classifyPostgresSqlState`/`classifyMysqlCode` 가 산출
    - `spec/4-nodes/4-integration/2-database-query.md:340,348` — "pg SQLSTATE class 28(invalid_authorization_specification) 과 mysql `ER_ACCESS_DENIED_ERROR` 는 둘 다 handshake 단계 인증 실패다. 두 드라이버 모두 `DB_CONNECTION_ERROR` 로 라우팅되어 워크플로우의 credential-rotation retry 정책이 양쪽에서 동일하게 동작한다"
    - `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts:614-626,865-879` — SQLSTATE `28000`·`ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR` 를 명시적으로 고정하는 회귀 테스트
    - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:69` — `DB_CONNECTION_ERROR` 를 별도 소비
  - 상세: target 은 §A 에서 "인증 거부(PostgreSQL SQLSTATE class 28 · MySQL `ER_ACCESS_DENIED_ERROR` · `ER_DBACCESS_DENIED_ERROR`) → `DB_AUTH_FAILED`" / "그 밖(네트워크·타임아웃·TLS·없는 database 등) → `DB_CONNECT_FAILED`" 로 새 코드를 신설한다. 그런데 정확히 같은 driver 조건(class 28, `ER_ACCESS_DENIED_ERROR`) 을 노드 런타임은 **의도적으로** `DB_CONNECTION_ERROR` 하나로 합쳐 두었다 — "credential-rotation retry 정책이 양쪽에서 동일하게 동작"하도록 하기 위한 명시적 설계 결정이다(2-database-query.md §Rationale류 메모). 결과적으로 `DB_CONNECT_FAILED`(신규, 연결 테스트 전용)와 `DB_CONNECTION_ERROR`(기존, 노드 런타임)는 (a) 철자가 `DB_CONNECT` 까지 완전히 겹치고 (b) 이름만으로는 "커넥션 실패"라는 같은 개념을 가리키는 것처럼 보이지만, 실제로는 母집합이 다르다 — 노드 런타임의 `DB_CONNECTION_ERROR` 는 handshake 인증 실패를 **포함**하는 반면 target 의 `DB_CONNECT_FAILED` 는 그 인증 실패 부분을 `DB_AUTH_FAILED` 로 **제외**한 잔여 집합이다. `IntegrationTestResult.code` 가 "노드 런타임 `ErrorCode` enum 과는 별개 namespace"라는 전제(§5.5 기존 서술)는 이미 문서화돼 있지만, 이 두 namespace 사이에 철자가 이만큼 가까운 코드가 서로 다른 母집합을 가리키는 사례는 이번이 처음이다(`EMAIL_HOST_BLOCKED`/`DB_HOST_BLOCKED`/`HTTP_BLOCKED` 는 오히려 **같은 조건을 같은 이름으로 공유**하는 반대 패턴). 유지보수자가 `output.error.code === 'DB_CONNECTION_ERROR'` 로 인증 실패까지 재시도 분기를 걸어 둔 상태에서, 연결 테스트 결과의 `DB_CONNECT_FAILED` 를 같은 의미로 오독하면 "인증 실패인데도 연결 테스트가 CONNECT_FAILED 로 나왔다"는 혼선이 생길 수 있다.
  - 제안: 아래 중 하나
    1. target §A/§F 본문에 "`DB_CONNECT_FAILED` 는 노드 런타임의 `DB_CONNECTION_ERROR`(handshake 인증 포함)와 母집합이 다르다 — 인증 실패는 `DB_AUTH_FAILED` 로 먼저 분리된다"는 명시적 대비 문장을 추가해 근접 동형에 의한 오독을 차단한다(가장 저비용).
    2. 또는 `DB_CONNECT_FAILED` 를 `DB_CONNECT_FAILED` 대신 어휘 거리를 벌리는 이름(예: `DB_UNREACHABLE`)으로 바꿔 `DB_CONNECTION_ERROR` 와의 시각적 근접을 줄인다 — 단 이미 `EMAIL_CONNECT_FAILED`·`MCP_CONNECT_FAILED` 가 확립한 "연결 테스트 전용 코드는 `_CONNECT_FAILED` 접미" 패턴과 어긋나므로 1안을 권장.

- **[INFO]** HTTP 신규 코드(`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)와 기존 노드 런타임 계열의 관계가 spec 본문에 대비 서술이 없다
  - target 신규 식별자: `HTTP_AUTH_FAILED`, `HTTP_CONNECT_FAILED`, `HTTP_SERVER_ERROR` — §B(HTTP/REST 테스트), §F
  - 기존 사용처: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:489,519,563,577` — 노드 런타임은 이미 `HTTP_${res.status}`(usage 로그) · `HTTP_4XX`/`HTTP_5XX`(`output.error.code`) · `HTTP_TRANSPORT_FAILED`(네트워크/타임아웃) 를 발행한다. `spec/2-navigation/4-integration.md` §14.1 표(1092~1094행)에도 `HTTP_{status}`/`HTTP_TRANSPORT_FAILED`/`HTTP_BLOCKED` 가 이미 등재돼 있다.
  - 상세: 문자열 자체는 겹치지 않아(grep 0건) CRITICAL/WARNING 요건인 "동일·근접 식별자"는 아니다. 다만 같은 §14.1 표 안에 `HTTP_4XX`/`HTTP_5XX`/`HTTP_TRANSPORT_FAILED`(노드) 와 `HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`(연결 테스트)가 나란히 배치되면, `DB_HOST_BLOCKED`/`HTTP_BLOCKED`/`EMAIL_HOST_BLOCKED` 처럼 "두 namespace 가 같은 이름을 공유"하는 기존 패턴과 지금처럼 "두 namespace 가 다른 이름을 쓰는" 패턴이 표 하나에 혼재해 독자가 원칙을 헷갈릴 수 있다. `EMAIL_CONNECT_FAILED` 행(1094행)은 이미 "연결 테스트 전용 — `IntegrationTestResult.code` namespace(노드 런타임 `ErrorCode` enum 과 별개)"라는 괄호 설명을 달아 이 혼선을 예방했다.
  - 제안: target §F 가 추가하는 5개 신규 행에도 `EMAIL_CONNECT_FAILED` 행과 동일한 괄호 설명("노드 런타임 `HTTP_4XX`/`HTTP_5XX`/`HTTP_TRANSPORT_FAILED` 와 별개")을 넣도록 요구한다 — target 본문 §F 는 이미 "모두 연결 테스트 전용" 이라고 뭉뚱그려 적었을 뿐 개별 대응 코드를 짚지 않는다.

## 확인했으나 충돌 없음 (전수 확인)

- **요구사항 ID**: target 이 신규 부여하는 요구사항/트래커 ID 없음 — 기존 ID(INT-WH-02 등) 재참조뿐.
- **엔티티/타입명**: `IntegrationTestResult` 는 기존 인터페이스(`integrations.service.ts:75`, `code?: string` 느슨한 타입) 재사용 — 새 필드·새 타입 없음. 새 인터페이스/DTO 미도입.
- **API endpoint**: 신규 endpoint 없음 — 기존 `POST /api/integrations/:id/test`, `POST /api/integrations/preview-test` 문구만 정정.
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신설 없음.
- **환경변수·설정키**: 신규 ENV 없음 — 기존 `ALLOW_PRIVATE_HOST_TARGETS` 재참조뿐.
- **파일 경로**: 신규 spec 파일 없음 — 기존 `spec/2-navigation/4-integration.md` 수정.
- **5개 신규 에러 코드 리터럴 자체**: `DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR` 문자열은 `codebase/`·`spec/` 전수 grep 결과 target 문서 자신 외 0건 — target §F 의 "grep 0건(충돌 없음)" 주장은 문자열 단위로는 사실이다. 위 WARNING 은 "정확히 같은 문자열"이 아니라 "철자가 가깝고 母집합이 겹치는 기존 코드"에 대한 것이다.
- **재사용된 3개 코드** (`DB_HOST_BLOCKED`·`HTTP_BLOCKED` — SSRF 차단): 노드 런타임과 동일 문자열을 그대로 재사용하며, 이는 `EMAIL_HOST_BLOCKED` 선례를 따르는 **의도된 공유**로 이미 문서화돼 있어 충돌이 아니다.

## 요약

target 이 새로 도입하는 5개 에러 코드 리터럴(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)은 저장소 전체에서 문자열 단위로는 grep 0건이라 직접 충돌은 없다. 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·파일 경로 축에서도 신규 도입이 없어 해당 범주의 충돌 위험은 없다. 다만 `DB_CONNECT_FAILED`(신규)는 이미 다수 소비처(노드 런타임 `ErrorCode`, `execution-failure-classifier.ts`, 회귀 테스트, `2-database-query.md` 카탈로그)를 가진 기존 `DB_CONNECTION_ERROR`와 철자가 거의 동일하면서도 정확히 "PostgreSQL class 28 / MySQL `ER_ACCESS_DENIED_ERROR`" 인증-실패 조건의 소속이 서로 다르다(기존은 포함, 신규는 배제) — 이는 새 코드명 자체의 충돌이라기보다 근접 동형으로 인한 유지보수 혼선 리스크이며 WARNING 으로 등재한다. HTTP 계열 신규 코드 3종도 같은 이유로 §14.1 표에 노드 런타임과의 관계를 한 줄 명시하도록 INFO 로 제안한다.

## 위험도

LOW
