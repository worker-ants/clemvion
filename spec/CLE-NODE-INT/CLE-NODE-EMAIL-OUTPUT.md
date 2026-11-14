---
id: "CLE-NODE-EMAIL-OUTPUT"
title: "Send Email 노드 — 출력 구조"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-EMAIL"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-EMAIL"]
area: "CLE-NODE-INT"
content_hash: "48e8ac2ebe36f91db040761d0e3c2018760499824378a1d20ec13e68a752d6e9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "13f8da9ef0a53cce1c4f7eebe3318463f3f9926c74deca1919925596d4821a75"
etag: "sha256-4bacf051766ab86dceb3527aec67cd034d14c6714a2ce0b0b3de1b6444851fad"
---
## 개요

이 문서는 [Send Email 노드](CLE-NODE-EMAIL.md) 의 하위 문서로 노드 출력 구조를 정한다. 실행 순서와 에러 코드는 부모 문서가 정한다.

## 공통 규칙

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `config` 는 사용자가 입력한 원본을 에코한다(Principle 7). `{{ }}` 를 보존하고, `to`·`cc`·`bcc` 는 배열 원형 그대로이며, 자격 증명은 싣지 않는다. `output.subject`·`output.body`·`output.bodyType` 은 실제로 SMTP 에 보낸 평가된 값이다(Principle 1). `meta` 는 실행 메트릭만 둔다(Principle 2). 공통 규칙과 다른 두 곳은 [Rationale 「`meta` 가 공통 규칙과 다른 두 곳」](CLE-NODE-EMAIL.md#meta-가-공통-규칙과-다른-두-곳-2026-11-13) 에 있다.

## 정상 발송 (`out`)

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
| `meta.durationMs` | number | 핸들러 | 실행 시간(ms). 핸들러가 직접 잰다 |
| `meta.deliveryStatus` | `'sent'` | 핸들러 | 큐 진입 성공 신호. 앞으로 값이 늘 수 있다. 공통 규칙에 없는 필드다 |
| `port` | `'out'` | 핸들러 반환 | 성공 포트 |

일부 거부(`output.rejected.length > 0`)도 성공(`out`)으로 분류한다. 노드 출력 규약 Principle 3.1 의 "예상 가능한 비즈니스 실패" 다. 분기는 뒤쪽 If/Else 노드에서 `$node["X"].output.rejected.length > 0` 으로 만든다.

표현식 접근 예:

- `$node["X"].output.messageId` → `"<abc@smtp.example.com>"`
- `$node["X"].output.accepted[0]` → `"alice@example.com"`
- `$node["X"].output.rejected.length` → 일부 거부 분기용 카운터
- `$node["X"].meta.durationMs` → `234`
- `$node["X"].port` → `"out"`

## 런타임 전송 실패 (`error`)

`IntegrationError`(빈 수신자, 자격 증명 미충족, 유형·연결 상태 불일치) 또는 nodemailer `sendMail` 의 일반 전송 실패가 catch 로 떨어진 경우다.

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
| `output.error.code` | string (UPPER_SNAKE_CASE) | 핸들러 | [에러 코드](CLE-NODE-EMAIL.md#에러-코드) 표(Principle 3.2). `IntegrationError` 면 그 코드를 그대로 낸다 |
| `output.error.message` | string | 핸들러 | 사람이 읽는 메시지. `sanitizeMessage` 가 자격 증명·비밀 토큰을 `***` 로 가린다 |
| `output.error.details.to` | string[] | 핸들러 | 정규화한 수신자를 `maskEmailForErrorDetails` 로 가린 값(`a***@example.com`). 빈 수신자(`EMAIL_NO_RECIPIENTS`)면 `[]` 다 |
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

## 서비스 미주입 (흐름 지시 상태)

`IntegrationsService` 가 주입되지 않은 환경(단위 테스트, 부팅 단계 등)에서만 생긴다. 외부 호출 없이 돌려주며, `output: null` 이 아니라 `status: 'requires_integration'` 으로 식별한다. 컨테이너의 엔진 덮어쓰기 신호([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 9)와 구별하기 위해서다. 정규화한 `to` 가 비면 이 분기에 오기 전에 `EMAIL_NO_RECIPIENTS` 로 에러 포트에 나간다.

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

## dry-run (`out`, mock)

`context.variables.__dryRun === true` 인 재실행 컨텍스트(`metadata.supportsDryRun: true`)에서만 생긴다. 설정 검증을 모두 통과한 뒤 실제 SMTP 발송 전에 끝나며, 어떤 SMTP 나 provider 도 건드리지 않고 정상(`out`) 흐름으로 진행한다. dry-run 규칙의 단일 기준은 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)이다. 이 분기는 본문 제한과 빈 수신자 확인 뒤, 서비스 미주입 확인과 실제 SMTP 발송 **앞**에 있다. 정규화한 `to` 가 비면 이 분기에 오기 전에 `EMAIL_NO_RECIPIENTS` 로 에러 포트에 나간다. `port` 는 생략한다(기본 `out`).

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
| `meta.deliveryStatus` | `'sent'` | 핸들러 | 흐름 정상 진행 신호. dry-run 은 `durationMs` 를 붙이지 않는다. 공통 규칙과 다른 점이다 |

## Rationale

출력 구조를 정한 근거는 부모 문서 [Send Email 노드](CLE-NODE-EMAIL.md) 의 Rationale 에 있다. `meta` 가 공통 규칙과 다른 두 곳의 근거는 [「`meta` 가 공통 규칙과 다른 두 곳」](CLE-NODE-EMAIL.md#meta-가-공통-규칙과-다른-두-곳-2026-11-13) 을 본다.
