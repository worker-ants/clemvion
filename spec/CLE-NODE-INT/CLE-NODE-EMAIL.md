---
id: "CLE-NODE-EMAIL"
title: "Send Email 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-EMAIL-001", "REQ-EMAIL-002", "REQ-EMAIL-003", "REQ-EMAIL-004", "REQ-EMAIL-005", "REQ-EMAIL-006", "REQ-EMAIL-007", "REQ-EMAIL-008", "REQ-EMAIL-009", "REQ-EMAIL-010", "REQ-EMAIL-011", "REQ-EMAIL-012", "REQ-EMAIL-013", "REQ-EMAIL-014", "REQ-EMAIL-015", "REQ-EMAIL-016", "REQ-EMAIL-017", "REQ-EMAIL-018", "REQ-EMAIL-019", "REQ-EMAIL-020", "REQ-EMAIL-021", "REQ-EMAIL-022", "REQ-EMAIL-023", "REQ-EMAIL-024", "REQ-EMAIL-025", "REQ-EMAIL-026"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "e09f8056a08e4e198607c06faa3041f22faa6ca9b89c056ca4e4364be87a0097"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/4-integration/3-send-email.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "a877c9ae18690f07ac86966d9d8ddd37f6ef29cfd0588741d21feaf266b979fc"
etag: "sha256-a14f9d983428ed933228499dcee900b57cd3565529378069f6a16a46f43d922a"
---
> 구현 상태: 구현됨 (일부 에러 코드 노출은 미구현) · 원문: `spec/4-nodes/4-integration/3-send-email.md`, `spec/4-nodes/_product-overview.md` (§7.3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Send Email 노드(`send_email`)는 SMTP 로 이메일을 보내는 서비스 특화 통합 노드다. 통합의 SMTP 자격 증명(`host`·`port`·`secure`·`username`·`password`·`default_from`)으로 보낸다. 런타임 전송 실패는 `error` 포트로 나간다(노드 출력 규약 Principle 3.1).

통합 참조, 핸들러 6단계 계약, 공통 에러 코드, 사설망 차단 정책, 캔버스 요약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. SMTP 통합의 자격 증명 스키마와 연결 테스트는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서 정한다. 이 문서는 노드의 설정·실행·출력·에러를 정한다. 이 노드는 통합 노드 공통 규칙과 두 군데가 다르다. 서비스 미주입 시 흐름 지시 상태 `requires_integration` 을 돌려주고, `IntegrationError` 가 아닌 실패를 모두 `EMAIL_SEND_FAILED` 로 흡수한다.

## 요구사항

- REQ-EMAIL-001 WHEN 노드가 실행되면 THE SYSTEM SHALL `service_type='email'` SMTP 통합의 자격 증명으로 이메일을 보낸다. (원본: ND-EM-01)
- REQ-EMAIL-002 WHEN 사용자가 노드를 설정하면 THE SYSTEM SHALL 수신자(To·CC·BCC)·제목·본문 입력을 제공한다. (원본: ND-EM-02)
- REQ-EMAIL-003 WHEN `bodyType` 이 `html` 이면 THE SYSTEM SHALL 본문을 HTML 로 보내고, 그 밖이면 텍스트로 보낸다. (원본: ND-EM-03)
- REQ-EMAIL-004 WHEN 첨부 파일이 설정되면 THE SYSTEM SHALL `filename`·`content`·`contentType`·`encoding`·`cid` 만 nodemailer 로 넘겨 첨부한다. (원본: ND-EM-04)
- REQ-EMAIL-005 WHEN 수신자·제목·본문·첨부 내용에 표현식이 있으면 THE SYSTEM SHALL 평가한 값으로 보낸다. (원본: ND-EM-05)
- REQ-EMAIL-006 IF 첨부 항목에 `path`·`href` 키가 있으면 THE SYSTEM SHALL 그 키를 지우고 `disableFileAccess`·`disableUrlAccess` 를 켠 채 보낸다.
- REQ-EMAIL-007 IF 수신자 필드(`to`·`cc`·`bcc`)가 배열이 아니면 THE SYSTEM SHALL 스키마와 검증기 단계에서 거부한다.
- REQ-EMAIL-008 WHEN 수신자를 정규화하면 THE SYSTEM SHALL 각 원소를 trim 하고 빈 문자열을 뺀다.
- REQ-EMAIL-009 IF 정규화한 `to` 가 비면 THE SYSTEM SHALL 에러 포트로 보내지 않고 노드 실행을 실패시킨다.
- REQ-EMAIL-010 IF 정규화한 `to` 가 비면 THE SYSTEM SHALL `EMAIL_NO_RECIPIENTS` 로 에러 포트에 보낸다. (미구현)
- REQ-EMAIL-011 WHEN 평가된 본문이 256KB 를 넘으면 THE SYSTEM SHALL `output.body` 를 자르고 `output.bodyTruncated` 를 `true` 로 둔다.
- REQ-EMAIL-012 WHEN dry-run 으로 실행되면 THE SYSTEM SHALL SMTP 를 건드리지 않고 mock 결과로 `out` 포트에 보낸다.
- REQ-EMAIL-013 WHILE `IntegrationsService` 가 주입되지 않은 동안 THE SYSTEM SHALL 외부 호출 없이 흐름 지시 상태 `requires_integration` 을 돌려준다.
- REQ-EMAIL-014 WHEN SMTP 로 보내기 전이면 THE SYSTEM SHALL `credentials.host` 에 사설망 차단을 적용한다.
- REQ-EMAIL-015 IF SMTP 호스트가 사설망 대역을 가리키면 THE SYSTEM SHALL `EMAIL_HOST_BLOCKED` 로 에러 포트에 보낸다.
- REQ-EMAIL-016 WHEN 이메일을 보내면 THE SYSTEM SHALL 보낸 사람을 `credentials.default_from` 으로 둔다.
- REQ-EMAIL-017 WHEN 같은 자격 증명으로 다시 보내면 THE SYSTEM SHALL 자격 증명 해시 기반으로 캐시한 transporter 를 재사용한다.
- REQ-EMAIL-018 WHEN 서버가 일부 수신자만 거부하면 THE SYSTEM SHALL `out` 포트로 보내고 거부된 수신자를 `output.rejected` 에 담는다.
- REQ-EMAIL-019 IF nodemailer 발송이 실패하면 THE SYSTEM SHALL `EMAIL_SEND_FAILED` 로 에러 포트에 보낸다.
- REQ-EMAIL-020 IF 실행 중 `IntegrationError` 가 나면 THE SYSTEM SHALL 그 코드를 `output.error.code` 로 그대로 내보낸다.
- REQ-EMAIL-021 IF 실행 중 `IntegrationError` 가 아닌 예외가 나면 THE SYSTEM SHALL `EMAIL_SEND_FAILED` 로 에러 포트에 보낸다.
- REQ-EMAIL-022 IF 통합이 없거나 워크스페이스 정보가 누락되면 THE SYSTEM SHALL 전용 코드로 에러 포트에 보낸다. (미구현)
- REQ-EMAIL-023 WHEN 에러를 내보내면 THE SYSTEM SHALL 메시지의 비밀 토큰을 `***` 로 가리고, 수신자 로컬 파트를 마스킹하고, 제목을 200자로 자른다.
- REQ-EMAIL-024 WHEN 실행이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 남긴다.
- REQ-EMAIL-025 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 `SEND`, `api_path` 를 SMTP 호스트로 채우고 수신자 이메일은 저장하지 않는다.
- REQ-EMAIL-026 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | SMTP 통합 참조([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조). `serviceType='email'` 만 허용 |
| `to` | String[] | ✓ | `[]` | 수신자 배열. 각 원소는 이메일 주소 또는 표현식. 콤마로 구분한 단일 문자열은 받지 않는다(Rationale) |
| `cc` | String[] | | `[]` | 참조. 형식은 `to` 와 같다 |
| `bcc` | String[] | | `[]` | 숨은 참조. 형식은 `to` 와 같다 |
| `subject` | String (표현식) | ✓ | `''` | 메일 제목 |
| `body` | String (표현식) | ✓ | `''` | 메일 본문. `bodyType='html'` 이면 HTML 문자열 |
| `bodyType` | `text` / `html` | | `text` | 본문 형식 |
| `attachments` | Attachment[] | | `[]` | 첨부 파일 목록 |

첨부 항목(Attachment):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filename` | String | ✓ | 파일 이름 |
| `content` | String (Base64 또는 평문, 표현식) | ✓ | 파일 내용. `encoding='base64'` 와 함께 쓰면 바이너리 첨부 |
| `contentType` | String | | MIME 타입. 비우면 `filename` 으로 추론 |
| `encoding` | String | | `content` 의 인코딩(예: `base64`, `hex`) |
| `cid` | String | | HTML 본문에서 인라인 이미지로 참조할 Content-ID |

보안: nodemailer 의 `path`·`href` 옵션은 의도적으로 노출하지 않는다. 사용자 입력으로 임의의 로컬 파일(`/etc/passwd` 등)이나 외부 URL 에 접근할 수 있기 때문이다. 발송 옵션에 `disableFileAccess: true`·`disableUrlAccess: true` 를 주고, 핸들러도 `path`·`href` 키를 지운다.

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` 의 `sendEmailNodeConfigSchema`·`sendEmailNodeMetadata` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기 | `serviceType='email'` 통합만 보여 준다 |
| 수신자 | 통합 아래 | To·CC·BCC 칩 입력과 추가 버튼 | 배열로 입력한다. 원소마다 표현식 가능 |
| 제목 | 수신자 아래 | Subject 입력 | 표현식 가능(예: `Hello {{ $input.name }}`) |
| 본문 | 가운데 | Body Type 선택(text·html), 본문 에디터 | html 이면 리치 에디터 옵션을 준다 |
| 첨부 | 아래 | Attachments 목록과 추가 버튼 | 항목마다 `filename`·`content` 필수, `contentType`·`encoding`·`cid` 선택 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터. 핸들러는 직접 쓰지 않고 표현식에서만 참조한다 |
| 출력 | `out` | Output | data | false | 발송 성공(일부 거부 포함) |
| 출력 | `error` | Error | error | false | 런타임 전송 실패. `EMAIL_SEND_FAILED`·`EMAIL_HOST_BLOCKED`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED` |

동적 포트는 없다. `handler.validate()` 실패와 빈 `to` 가드(try 밖)는 throw 로 노드 실행 자체를 실패시킨다. `execute()` 의 try/catch 안에서 난 실패만 `error` 포트로 간다.

## 실행 로직

1. **사전 검증**(`validate()`): `evaluateMetadataBlockingErrors`(경고 규칙 평가), `validateConfig`(수신자 배열만 허용), `subject`·`body` 문자열 확인, `bodyType` enum 확인. 실패하면 throw 로 노드 실행이 시작되지 않는다(실행 실패).
2. **수신자 정규화**: `to`·`cc`·`bcc` 는 배열만 받는다.
   - 배열이면 원소를 `trim()` 하고 빈 문자열을 뺀다.
   - 배열이 아니면 방어적으로 `[]` 를 돌려준다. 원본은 스키마와 검증기가 이미 거부하므로 표준 경로에서는 도달하지 않는다. 옛 데이터와 직접 호출 경로를 위한 안전망이다.
3. **본문 제한**: 평가된 `body` 를 `truncateBodyForOutput`(256KB)으로 제한한다. 넘치면 `output.bodyTruncated: true` 를 붙인다.
4. **빈 수신자 확인**: 정규화한 `to.length === 0` 이면 try 블록 **밖**에서 `Error('No valid recipients after normalizing the \`to\` field')` 를 던진다. 에러 포트로 가지 않고 노드 실행 자체가 실패한다.
5. **dry-run 분기**: `context.variables.__dryRun === true` 면(`metadata.supportsDryRun: true`) 실제 SMTP 발송 전에 `buildDryRunMock('send_email', { to, subject })` 로 끝낸다. 외부 SMTP 를 건드리지 않고 `out` 포트로 진행한다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) dry-run).
6. **서비스 미주입 확인**: `IntegrationsService` 가 주입되지 않았으면 외부 호출 없이 `status: 'requires_integration'` 을 돌려준다(아래 "서비스 미주입").
7. **통합 조회**: `getForExecution(integrationId, workspaceId)` 로 SMTP 자격 증명을 복호화한다. `serviceType !== 'email'`·`status !== 'connected'`·필수 필드 누락은 `IntegrationError` 로 던져 catch 에서 에러 포트로 보낸다. 없는 `integrationId` 는 `NotFoundException`(`IntegrationError` 가 아님)이라 `EMAIL_SEND_FAILED` 로 흡수된다.
8. **사설망 차단**: `credentials.host` 가 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역을 가리키면 `EMAIL_HOST_BLOCKED` 로 에러 포트에 보낸다. HTTP Request·Database Query 노드와 같은 메커니즘과 플래그를 쓴다([통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단). 연결 테스트와 같은 가드를 발송 경로에도 적용해 비대칭을 막는다.
9. **SMTP 발송**: 자격 증명 해시 기반으로 nodemailer transporter 캐시를 재사용한다. `from = credentials.default_from` 이고 `subject`·`body` 는 평가된 값이다. `bodyType='html'` 이면 `html` 옵션, 아니면 `text` 옵션으로 보낸다.
10. **활동 로그 기록**: 성공·실패와 관계없이 `logUsage({integrationId, status, durationMs, error?, api})` 를 부른다. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
    - `api_label` = NULL. 단일 동작이라 operation 카탈로그가 없다.
    - `api_method` = `'SEND'`(상수). 다른 SMTP 동작이 생기면 값을 늘린다.
    - `api_path` = `credentials.host`(SMTP 호스트) 또는 NULL. 수신자 이메일은 절대 저장하지 않는다(개인정보 보호). 마스킹한 수신자는 에러 케이스의 `output.error.details.to` 에만 둔다.
11. **반환**: dry-run, 서비스 미주입, 성공, 런타임 실패 중 하나의 노드 출력을 돌려준다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `config` 는 사용자가 입력한 원본을 에코한다(Principle 7). `{{ }}` 를 보존하고, `to`·`cc`·`bcc` 는 배열 원형 그대로이며, 자격 증명은 싣지 않는다. `output.subject`·`output.body`·`output.bodyType` 은 실제로 SMTP 에 보낸 평가된 값이다(Principle 1). `meta` 는 실행 메트릭만 둔다(Principle 2).

### 정상 발송 (`out`)

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["{{ $input.email }}"],
    "cc": [],
    "bcc": [],
    "subject": "Hello {{ $input.name }}",
    "body": "Welcome {{ $input.name }}!",
    "bodyType": "text",
    "attachments": []
  },
  "output": {
    "messageId": "<abc@smtp.example.com>",
    "accepted": ["alice@example.com"],
    "rejected": [],
    "subject": "Hello Alice",
    "body": "Welcome Alice!",
    "bodyType": "text"
  },
  "meta": { "durationMs": 234, "deliveryStatus": "sent" },
  "port": "out"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.integrationId` | UUID | 설정 에코 | SMTP 통합 참조. 자격 증명은 에코하지 않는다 |
| `config.to` / `cc` / `bcc` | string[] | 설정 에코 | 사용자가 입력한 원본 배열(표현식 보존). 정규화 결과는 에코하지 않는다 |
| `config.subject` / `body` | string | 설정 에코 | 원본 템플릿(`{{ }}` 보존) |
| `config.bodyType` | `'text'` / `'html'` | 설정 에코 | 본문 형식 |
| `config.attachments` | Attachment[] | 설정 에코 | 사용자가 입력한 원본. nodemailer 로는 `filename`·`content`·`contentType`·`encoding`·`cid` 만 넘기고 `path`·`href` 등은 서버에서 지운다 |
| `output.messageId` | string | nodemailer | SMTP 가 부여한 Message-ID. Principle 8 권장 위치 |
| `output.accepted` | string[] | nodemailer | 서버가 받은 수신자 목록 |
| `output.rejected` | string[] | nodemailer | 서버가 거부한 수신자 목록. 일부 거부 시 비어 있지 않아도 성공이다 |
| `output.subject` / `body` | string | 런타임(평가된 값) | 실제로 보낸 평가 결과. `body` 는 256KB 제한 |
| `output.bodyType` | `'text'` / `'html'` | 런타임 | 발송에 쓴 형식 |
| `output.bodyTruncated?` | boolean | 런타임 | 256KB 를 넘었을 때만 `true` |
| `meta.durationMs` | number | 엔진·핸들러 | 실행 시간(ms) |
| `meta.deliveryStatus` | `'sent'` | 핸들러 | 큐 진입 성공 신호. 앞으로 값이 늘 수 있다 |
| `port` | `'out'` | 핸들러 반환 | 성공 포트 |

일부 거부(`output.rejected.length > 0`)도 성공(`out`)으로 분류한다. 노드 출력 규약 Principle 3.1 의 "예상 가능한 비즈니스 실패" 다. 분기는 뒤쪽 If/Else 노드에서 `$node["X"].output.rejected.length > 0` 으로 만든다.

표현식 접근 예:

- `$node["X"].output.messageId` → `"<abc@smtp.example.com>"`
- `$node["X"].output.accepted[0]` → `"alice@example.com"`
- `$node["X"].output.rejected.length` → 일부 거부 분기용 카운터
- `$node["X"].meta.durationMs` → `234`
- `$node["X"].port` → `"out"`

### 런타임 전송 실패 (`error`)

`IntegrationError`(자격 증명 미충족, 유형·연결 상태 불일치) 또는 nodemailer `sendMail` 의 일반 전송 실패가 catch 로 떨어진 경우다.

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["{{ $input.email }}"],
    "cc": [],
    "bcc": [],
    "subject": "Hello {{ $input.name }}",
    "body": "Welcome {{ $input.name }}!",
    "bodyType": "text",
    "attachments": []
  },
  "output": {
    "subject": "Hello Alice",
    "body": "Welcome Alice!",
    "bodyType": "text",
    "error": {
      "code": "INTEGRATION_NOT_CONNECTED",
      "message": "Integration \"Company SMTP\" is expired",
      "details": {
        "to": ["a***@example.com"],
        "subject": "Hello Alice",
        "integrationCode": "INTEGRATION_NOT_CONNECTED"
      }
    }
  },
  "meta": { "durationMs": 35, "deliveryStatus": "failed" },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 정상 케이스와 같음 | 설정 에코 | 실패해도 같은 구조로 에코한다(디버깅) |
| `output.subject` / `body` / `bodyType` | string / enum | 런타임(평가된 값) | 디버깅을 위해 실패해도 평가된 값을 보존한다 |
| `output.bodyTruncated?` | boolean | 런타임 | 256KB 를 넘었을 때 `true` |
| `output.error.code` | string (UPPER_SNAKE_CASE) | 핸들러 | 아래 에러 코드 표(Principle 3.2) |
| `output.error.message` | string | 핸들러 | 사람이 읽는 메시지. `sanitizeMessage` 가 자격 증명·비밀 토큰을 `***` 로 가린다 |
| `output.error.details.to` | string[] | 핸들러 | 정규화한 수신자를 `maskEmailForErrorDetails` 로 가린 값(`a***@example.com`) |
| `output.error.details.subject` | string | 핸들러 | `truncateForErrorDetails(subject, 200)` 로 자른 제목 |
| `output.error.details.integrationCode?` | string | 핸들러 | 원인이 `IntegrationError` 일 때만 넣는다. `output.error.code` 와 같은 값(관측 호환) |
| `meta.durationMs` | number | 핸들러 | 실패까지 걸린 시간 |
| `meta.deliveryStatus` | `'failed'` | 핸들러 | 실패 신호 |
| `port` | `'error'` | 핸들러 반환 | 런타임 실패 분기 |

표현식 접근 예:

- `$node["X"].output.error.code === 'INTEGRATION_NOT_CONNECTED'` → 재연결 안내 분기
- `$node["X"].output.error.code === 'EMAIL_SEND_FAILED'` → 재시도·대체 채널 분기
- `$node["X"].output.subject` → `"Hello Alice"` (실패해도 평가된 값 보존)
- `$node["X"].port === 'error'` → 에러 분기 라우팅

### 서비스 미주입 (흐름 지시 상태)

엔진이 `IntegrationsService` 를 주입하지 않은 환경(단위 테스트, 부팅 단계 등)에서만 생긴다. 외부 호출 없이 바로 돌려주며, `output: null` 이 아니라 `status: 'requires_integration'` 으로 식별한다. 컨테이너의 엔진 덮어쓰기 신호([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 9)와 구별하기 위해서다.

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["alice@example.com"],
    "cc": [],
    "bcc": [],
    "subject": "Hello",
    "body": "Welcome!",
    "bodyType": "text",
    "attachments": []
  },
  "output": {
    "subject": "Hello",
    "body": "Welcome!",
    "bodyType": "text"
  },
  "status": "requires_integration"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 정상 케이스와 같음 | 설정 에코 | |
| `output.subject` / `body` / `bodyType` | string / enum | 런타임 | 평가된 값 보존(디버깅) |
| `output.bodyTruncated?` | boolean | 런타임 | 256KB 를 넘었을 때 |
| `status` | `'requires_integration'` | 핸들러 반환 | DI 미주입 식별자. `port`·`meta` 는 생략 |

이 케이스는 런타임 정상 경로 분기가 아니라 환경 구성 누락을 알리는 탈출구다. 워크플로우 작성자가 직접 마주칠 일이 없으며, 뒤쪽 노드는 `status === 'requires_integration'` 으로 분기하지 않는다.

### dry-run (`out`, mock)

`context.variables.__dryRun === true` 인 재실행 컨텍스트(`metadata.supportsDryRun: true`)에서만 생긴다. 설정 검증을 모두 통과한 뒤 실제 SMTP 발송 전에 끝나며, 어떤 SMTP 나 provider 도 건드리지 않고 정상(`out`) 흐름으로 진행한다. dry-run 규칙의 단일 기준은 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)이다. 이 분기는 본문 제한과 빈 수신자 확인 뒤, 서비스 미주입 확인과 실제 SMTP 발송 **앞**에 있다. `port` 는 생략한다(기본 `out`).

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["{{ $input.email }}"],
    "cc": [],
    "bcc": [],
    "subject": "Hello {{ $input.name }}",
    "body": "Welcome {{ $input.name }}!",
    "bodyType": "text",
    "attachments": []
  },
  "output": {
    "_dryRun": true,
    "skippedReason": "dry-run mode",
    "wouldHaveCalled": {
      "kind": "send_email",
      "to": ["alice@example.com"],
      "subject": "Hello Alice"
    }
  },
  "meta": { "deliveryStatus": "sent" }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 정상 케이스와 같음 | 설정 에코 | 원본 템플릿 에코 |
| `output._dryRun` | `true` | 핸들러(`buildDryRunMock`) | dry-run 식별자. 실행 결과 화면이 시각적으로 구분한다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)) |
| `output.skippedReason` | `'dry-run mode'` | 핸들러 | 건너뛴 이유 |
| `output.wouldHaveCalled` | object | 핸들러 | 실제로 부를 뻔한 작업 미리보기. `kind: 'send_email'`, 정규화한 `to`, 평가된 `subject` 만 보인다(`body`·자격 증명은 보이지 않음) |
| `meta.deliveryStatus` | `'sent'` | 핸들러 | 흐름 정상 진행 신호. dry-run 은 `durationMs` 를 붙이지 않는다 |

## 에러 코드

### 사전 검증 에러

`handler.validate()` 실패(설정 형식 자체가 잘못된 경우)는 경고 규칙, `evaluateMetadataBlockingErrors`, `validateSendEmailConfig` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `Email integration 을 선택해야 합니다.`, `수신자 (To) 를 한 명 이상 입력해야 합니다.`, `subject is required and must be a string`, `bodyType must be either "text" or "html"`.

### 런타임 에러 (`port: 'error'`)

| 코드 | 조건 |
|------|------|
| `EMAIL_SEND_FAILED` | nodemailer `sendMail` 이 던진 일반 전송 실패(네트워크·SMTP 응답 에러 등). `IntegrationError` 가 **아닌** 모든 catch 분기의 fallback 이다. 그래서 없는 `integrationId` 의 `NotFoundException` 과 워크스페이스 누락의 일반 `Error` 도 현재 이 코드로 흡수된다 |
| `EMAIL_HOST_BLOCKED` | SMTP `host` 가 사설·loopback 대역이라 사설망 차단에 막힘. 기본 켜짐, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 해제. `IntegrationError('EMAIL_HOST_BLOCKED')` 로 던져 그대로 나온다 |
| `INTEGRATION_INCOMPLETE` | SMTP 자격 증명의 `host`·`port`·`secure`·`username`·`password`·`default_from` 중 하나라도 없음 |
| `INTEGRATION_TYPE_MISMATCH` | 참조한 통합의 `serviceType` 이 `'email'` 이 아님 |
| `INTEGRATION_NOT_CONNECTED` | 통합 상태가 `connected` 가 아님(`expired`·`error`·`pending_install`) |

- `execute()` 의 try/catch 에서 `IntegrationError` 를 잡은 경우에만 그 `code` 가 `output.error.code` 로 **직접** 나온다(`EMAIL_HOST_BLOCKED`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED`). nodemailer 전송 실패를 포함한 그 밖의 모든 throw 는 `EMAIL_SEND_FAILED` 로 바뀐다.
- `output.error.message` 는 `IntegrationHandlerBase.sanitizeMessage` 가 비밀 토큰(`Bearer …`, `password=…`, 32자 이상 hex·base64 등)을 `***` 로 가린 뒤 나간다. `output.error.details.to` 는 `maskEmailForErrorDetails` 로 로컬 파트를 가린다(`alice@example.com` → `a***@example.com`).

### 아직 에러 포트로 나오지 않는 코드 (Planned)

다음 코드는 이 노드의 에러 포트로 **아직 나오지 않는다**.

- `EMAIL_NO_RECIPIENTS`: 빈 `to` 가드가 try 블록 **밖**에서 일반 `Error('No valid recipients after normalizing the \`to\` field')` 를 던진다. 그래서 에러 포트로 가지 않고 노드 실행 자체가 실패한다(사전 검증 에러와 같은 결과). 가드를 try 안으로 옮겨 `IntegrationError('EMAIL_NO_RECIPIENTS')` 로 던지면 나온다. 근거: `send-email.handler.ts` 의 빈 수신자 가드.
- 통합 없음(`INTEGRATION_NOT_FOUND` 로 부르던 경우): `getForExecution` → `requireEntity` 가 NestJS `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 던진다. `IntegrationError` 가 아니라서 `EMAIL_SEND_FAILED` 로 흡수된다. 공통 규칙상 `INTEGRATION_NOT_FOUND` 라는 코드는 현재 없다([통합 노드 공통](CLE-NODE-INT-COMMON.md)).
- `INTEGRATION_SERVICE_UNAVAILABLE`: `__workspaceId` 가 없으면 공통 베이스 `resolveIntegration` 이 일반 `Error('Missing workspace context …')` 를 던지고, `IntegrationError` 가 아니라서 `EMAIL_SEND_FAILED` 가 된다.
- `INTEGRATION_CALL_FAILED`: 공통 베이스의 fallback 코드(`toLogError`)는 **활동 로그**에만 나오고 `output.error.code` 로는 나오지 않는다.

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Send Email 행을 따른다. `summaryTemplate` 은 `{{to.length}} recipients · {{subject}}` 이고 렌더된 한 줄을 40자에서 자른다. `summaryTemplate` DSL 이 배열 슬라이스·조건 카운트를 지원하지 않아 `to: {수신자} +N` 대신 수신자 수와 제목을 보인다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다. 이 노드는 `integrationId` 가 언제나 필수라 조건 없이 대상이다.

## 구현 위치

- `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`
- `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts`

## Rationale

### SMTP 호스트에도 사설망 차단 적용

발송 경로의 사설망 차단은 HTTP Request·Database Query 노드와 같은 `ALLOW_PRIVATE_HOST_TARGETS` 플래그를 쓴다(기본 차단, 셀프 호스팅만 해제). 통합 노드 전체의 보안 자세를 한 가지로 유지하기 위해서다. 연결 테스트만 막고 발송은 뚫리는 비대칭을 막으려고 발송 경로에도 같은 가드를 둔다. 별도 opt-in 플래그를 만들지 않은 근거, 코드 이름(`EMAIL_HOST_BLOCKED`)을 고른 근거, 채팅 채널 분류표에 영향이 없다는 분석은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 에 있다.

### 수신자 필드를 배열만 받게 정리

이전에는 수신자 타입이 `String[] / String`(합 타입)이라 콤마로 구분한 단일 문자열(`"alice@x.com, bob@y.com"`)도 입력할 수 있었다. 문제는 두 검증 층의 판단이 달랐다는 점이다.

| 층 | 문자열 입력 처리 |
|----|------------------|
| zod `sendEmailNodeConfigSchema` | `z.array(z.string())` 라 파싱 실패 |
| 검증기 `validateSendEmailConfig` | `isRecipientsLike` 가 `typeof string` 도 허용해 통과 |

원본 문자열은 zod 단계에서 거부돼 `normalizeRecipients` 까지 가지 못한다. 하지만 검증기만 보면 통과라서 `add_node` 도구 응답에는 유효해 보이는데 저장소에는 배열로 강제 변환돼 의도와 다른 원소 1개짜리 배열이 저장될 수 있었다.

해법으로 검증기와 핸들러를 배열만 받도록 좁혀(breaking) 두 층을 맞췄다. 저장·에코·표현식이 모두 배열 한 가지 형태가 된다. zod 를 합 타입으로 완화하는 안은 저장소에 두 형태가 섞여 출력 에코와 뒤쪽 표현식이 모두 합 타입을 처리해야 해서 버렸다. 프론트엔드가 자동으로 배열로 감싸는 안은 백엔드가 져야 할 의미 보정 책임을 프론트엔드가 떠안아 책임 위치가 흐려져서 버렸다. 스테이징 단계라 단일 문자열 워크플로우가 거의 없어 별도 마이그레이션 스크립트 없이 진행했다.

층별 결과 동작:

- 프론트엔드: `widget: 'field-array'` 가 이미 배열이라 변경 없음
- 저장(zod): `z.array(z.string())` 유지. 배열이 아닌 원본 입력은 파싱 실패
- 검증기(`validateSendEmailConfig`): 문자열 경로를 지우고 배열만 받음. zod 와 일치
- 핸들러(`normalizeRecipients`): 문자열 콤마 분리 경로를 지움. 배열이 아닌 입력은 방어적으로 `[]`
- 출력 에코(`sendEmailNodeOutputSchema.config.to/cc/bcc`): `z.unknown()` 에서 `z.array(z.string())` 로 바꿔 배열만 에코함을 명시
- 표현식: 배열 원소 단위로 `{{ ... }}` 를 쓴다(예: `["{{ $input.email }}"]`)
