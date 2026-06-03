---
id: send-email
status: implemented
code:
  - codebase/backend/src/nodes/integration/send-email/send-email.handler.ts
  - codebase/backend/src/nodes/integration/send-email/send-email.schema.ts
---

# Spec: Send Email

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [CONVENTIONS](../../conventions/node-output.md)

SMTP를 통해 이메일을 발송하는 **Integration 노드**. Integration 엔티티의 SMTP 자격증명 (`host`/`port`/`secure`/`username`/`password`/`default_from`) 을 사용해 발송하며, runtime 전송 실패는 `error` 포트로 라우팅된다 (CONVENTIONS Principle 3.1).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | SMTP Integration 참조 ([공통 §1](./0-common.md#1-integration-참조)). `serviceType='email'` 만 허용 |
| to | String[] | ✓ | `[]` | 수신자 배열. 각 원소가 이메일 주소 또는 표현식(`{{ }}`). 콤마-구분 단일 문자열은 비허용 — §8 Rationale 참조 |
| cc | String[] | | `[]` | 참조. 형식은 `to` 와 동일 |
| bcc | String[] | | `[]` | 숨은 참조. 형식은 `to` 와 동일 |
| subject | String (표현식) | ✓ | `''` | 메일 제목 |
| body | String (표현식) | ✓ | `''` | 메일 본문. `bodyType='html'` 시 HTML 문자열 |
| bodyType | `text` / `html` | | `text` | 본문 포맷 |
| attachments | Attachment[] | | `[]` | 첨부 파일 목록 |

**Attachment 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| filename | String | ✓ | 파일명 |
| content | String (Base64 또는 plain text, 표현식) | ✓ | 파일 내용. `encoding='base64'` 와 함께 쓰면 바이너리 첨부 |
| contentType | String | | MIME 타입. 미지정 시 `filename` 으로부터 추론 |
| encoding | String | | content 의 인코딩 (예: `base64`, `hex`) |
| cid | String | | HTML 본문에서 인라인 이미지로 참조할 Content-ID |

> **보안**: nodemailer 의 `path` / `href` 옵션은 의도적으로 노출하지 않는다. 사용자 입력으로 임의 로컬 파일 (`/etc/passwd` 등) 또는 외부 URL 접근이 발생할 수 있어, `disableFileAccess: true` / `disableUrlAccess: true` 를 sendMail 옵션에 부여하고 핸들러도 `path` / `href` 키를 strip 한다.

> Source of truth: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` (export `sendEmailNodeConfigSchema` / `sendEmailNodeMetadata`).

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Integration  [SMTP integration ▼]   │
│                                      │
│  To       [alice@example.com  ] [+]  │
│  CC       (none)                [+]  │
│  BCC      (none)                [+]  │
│                                      │
│  Subject  Hello {{ $input.name }}    │
│                                      │
│  Body Type  [text ▼]                 │
│  ┌──────────────────────────────────┐│
│  │ Welcome {{ $input.name }}!       ││
│  └──────────────────────────────────┘│
│                                      │
│  Attachments  (none)            [+]  │
└──────────────────────────────────────┘
```

- Integration 드롭다운은 `serviceType='email'` 로 필터링됨 ([공통 §2](./0-common.md#2-integration-선택-ui))
- To / CC / BCC: 칩 입력 (배열) — 표현식 지원
- Body: text / html 탭 전환. html 시 리치 에디터 옵션 제공
- Attachments 는 활성. 항목당 `filename` + `content` 필수, `contentType` / `encoding` / `cid` 는 선택

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (참조용 — 핸들러는 직접 소비하지 않으며 표현식에서만 사용) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 발송 성공 (부분 거부 포함). §5.1 |
| `error` | Error | error | false | runtime 전송 실패 — `EMAIL_SEND_FAILED` / `EMAIL_HOST_BLOCKED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED`. §5.3 |

> Send Email 은 동적 포트가 없다. `handler.validate()` 실패와 `to.length === 0` 가드(try 밖) 는 throw → 노드 실행 자체가 시작/완료되지 않음. `execute()` 의 try/catch 안에서 발생한 실패만 §5.3 (`port:'error'`) 로 라우팅된다 (§5.3 표 1 비고).

## 4. 실행 로직

1. **Pre-flight 검증** (`validate()`) — `evaluateMetadataBlockingErrors` (warningRules 평가) + `validateConfig` (recipient array-only, §8.1) + `subject`/`body` 문자열 / `bodyType` enum 체크. 실패 시 throw → 노드 실행 자체가 시작되지 않음 (워크플로우 실패 처리). `execute()` 의 try/catch 안에서 발생한 실행 단계 실패는 §5.3 (`port:'error'`) 으로 라우팅 (단 `to.length === 0` 가드는 try 밖이라 예외 — step 2)
2. **수신자 정규화** — `to`/`cc`/`bcc` 는 array-only (§8 Rationale):
   - 배열 → 원소를 `trim()` 후 빈 문자열 제거
   - 비-배열 입력 → defensive `[]` 반환 (raw 는 schema + validator 두 layer 가 이미 reject 하므로 standard path 에서는 도달 불가, legacy 데이터·직접 호출 경로의 safety net)
   - 정규화 결과가 `to.length === 0` 이면 plain `Error('No valid recipients after normalizing the \`to\` field')` 를 try 블록 **밖**에서 throw → 노드 실행 자체 실패 (error 포트 미라우팅 — §5.3 표 1 비고)
3. **Body cap** — 평가된 `body` 를 `truncateBodyForOutput` (256KB) 로 제한. 초과 시 `output.bodyTruncated: true` 부여
4. **Re-run dry-run 분기** — `context.variables.__dryRun === true` 면 (`metadata.supportsDryRun: true`) 실제 SMTP 발송 직전에 `buildDryRunMock('send_email', { to, subject })` 로 단락한다. 외부 SMTP 를 건드리지 않고 `out` 포트로 정상 진행. §5.5 ([Spec Re-run §7](../../5-system/13-replay-rerun.md#7-dry-run-모드-정의))
6. **Integration 조회** — `IntegrationsService.getForExecution(integrationId, workspaceId)` 로 SMTP 자격증명 복호화. `serviceType !== 'email'` / `status !== 'connected'` / 필수 필드 누락 → `IntegrationError` throw (catch 후 §5.3). 단 존재하지 않는 `integrationId` 는 `NotFoundException` (≠`IntegrationError`) 라 §5.3 표 1 비고대로 `EMAIL_SEND_FAILED` 로 흡수
7. **SSRF 가드** — `credentials.host` 가 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역을 가리키면 `EMAIL_HOST_BLOCKED` 로 §5.3 라우팅. [HTTP Request §8](./1-http-request.md#4-실행-로직) 과 **동일 메커니즘·플래그** — 기본 차단, self-host 는 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out. 연결 테스트([Spec 통합 관리 §5.5](../../2-navigation/4-integration.md#55-email-smtp))와 동일 가드를 발송 경로에도 적용해 비대칭을 막는다.
8. **SMTP 발송** — credentials hash 기반으로 nodemailer transporter 캐시 재사용. `from = credentials.default_from`, `subject` / `body` 는 평가된 값. `bodyType='html'` 이면 `html` 옵션, 아니면 `text` 옵션
9. **Usage 로깅** — `logUsage({integrationId, status, durationMs, error?, api})` 를 성공/실패 무관 호출 ([공통 §4.1](./0-common.md#41-공통-계약)). 활동 로그 API 식별 정보 (`_product-overview.md` INT-US-05):
   - `api_label` = NULL (Send Email 은 단일 동작 — operation catalog 없음)
   - `api_method` = `'SEND'` (상수 — 향후 다른 SMTP method 추가 시 enum 확장)
   - `api_path` = `credentials.host` (SMTP host) 또는 NULL. **수신자 이메일은 절대 저장하지 않는다** (PII 보호 — 수신자 마스킹된 디테일은 §5.3 의 `output.error.details.to` 에 한정)
10. **반환** — dry-run §5.5 / Integration stub §5.4 / 성공 §5.1 / runtime 실패 §5.3

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> `config` 은 사용자가 입력한 **raw** 값을 echo (Principle 7) — `{{ }}` 보존, `to`/`cc`/`bcc` 는 array 원형 보존 (array-only — §8 Rationale), 자격증명 echo 금지. `output.subject` / `output.body` / `output.bodyType` 는 실제 SMTP 에 전송된 평가된 값 (Principle 1). `meta` 는 실행 메트릭만 (Principle 2).

### 5.1 Case: 정상 발송 (port `out`)

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
| `config.integrationId` | UUID | config echo (Principle 7) | SMTP Integration 참조. 자격증명 자체는 echo 되지 않음 |
| `config.to` / `cc` / `bcc` | string[] | config echo | 사용자가 입력한 **raw** 배열 (표현식 보존). 정규화 결과는 echo 하지 않음. array-only (§8 Rationale) |
| `config.subject` / `body` | string | config echo | raw 템플릿 (`{{ }}` 보존) |
| `config.bodyType` | `'text'` / `'html'` | config echo | 본문 포맷 |
| `config.attachments` | Attachment[] | config echo | 사용자가 입력한 raw. `filename` / `content` / `contentType` / `encoding` / `cid` 만 nodemailer 로 전달되며, `path` / `href` 등 파일·URL 접근 옵션은 서버에서 strip + `disableFileAccess` / `disableUrlAccess` 로 차단 |
| `output.messageId` | string | nodemailer | SMTP 가 부여한 Message-ID. **Principle 8 권장 위치** |
| `output.accepted` | string[] | nodemailer | 서버가 수락한 수신자 목록 |
| `output.rejected` | string[] | nodemailer | 서버가 거부한 수신자 목록 (부분 거부 시 비어있지 않음 — success 유지) |
| `output.subject` / `body` | string | runtime — evaluated | 실제 발송된 평가 결과 (`{{ }}` 해석 완료). `body` 는 256KB cap |
| `output.bodyType` | `'text'` / `'html'` | runtime | 발송 시 사용된 포맷 |
| `output.bodyTruncated?` | boolean | runtime | 256KB cap 초과 시 `true` (해당 시에만 출력) |
| `meta.durationMs` | number | engine + handler | 실행 시간 (ms) |
| `meta.deliveryStatus` | `'sent'` | handler | 큐 진입 성공 신호. 향후 enum 확장 예정 (개선안 §3) |
| `port` | `'out'` | handler return | 단일 success 포트 |

> 부분 거부 (`output.rejected.length > 0`) 도 본 케이스 (success, port `out`) 로 분류된다 — 이는 Principle 3.1 의 "예상 가능한 비즈니스 실패" 범주. 분기는 후속 `if_else` 에서 `$node["X"].output.rejected.length > 0` 로 구성한다.

**Expression 접근 예**:
- `$node["X"].output.messageId` → `"<abc@smtp.example.com>"`
- `$node["X"].output.accepted[0]` → `"alice@example.com"`
- `$node["X"].output.rejected.length` → 부분 거부 분기용 카운터
- `$node["X"].meta.durationMs` → 234
- `$node["X"].port` → `"out"`

### 5.3 Case: Runtime 전송 실패 (port `error`)

`IntegrationError` (자격증명 미충족·타입/연결 상태 불일치) 또는 nodemailer `sendMail` 의 generic transport 실패가 catch 블록으로 떨어진 경우.

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
| `config.*` | (§5.1 과 동일) | config echo | 실패 케이스도 동일 구조로 echo — 디버깅 용이성 보장 |
| `output.subject` / `body` / `bodyType` | string / enum | runtime — evaluated | 디버깅 용이성을 위해 실패 시에도 evaluated 값 보존 |
| `output.bodyTruncated?` | boolean | runtime | 256KB cap 초과 시 `true` |
| `output.error.code` | string (UPPER_SNAKE_CASE) | handler | 표 1 enum 참조 (Principle 3.2) |
| `output.error.message` | string | handler | 사람이 읽는 메시지. `sanitizeMessage` 가 자격증명/비밀 토큰을 `***` 로 마스킹 |
| `output.error.details.to` | string[] | handler | 정규화된 수신자를 `maskEmailForErrorDetails` 로 마스킹 후 노출 (`a***@example.com` 형태) |
| `output.error.details.subject` | string | handler | `truncateForErrorDetails(subject, 200)` 로 절단 |
| `output.error.details.integrationCode?` | string | handler | 원인이 `IntegrationError` 인 경우에만 동봉 — `output.error.code` 와 동일 값 (관찰성 호환) |
| `meta.durationMs` | number | handler | 실패까지 소요 시간 |
| `meta.deliveryStatus` | `'failed'` | handler | 실패 신호 |
| `port` | `'error'` | handler return | runtime 실패 분기 |

**`output.error.code` enum (표 1)**:

| 코드 | 조건 |
|------|------|
| `EMAIL_SEND_FAILED` | nodemailer `sendMail` 이 throw 한 generic transport 실패 (네트워크/SMTP 응답 오류 등). `IntegrationError` 가 **아닌** 모든 catch 분기의 fallback — 따라서 `IntegrationError` 로 분류되지 않은 실패(아래 비고의 `INTEGRATION_NOT_FOUND` `NotFoundException`, workspaceId 누락 plain `Error` 등)도 현재 구현에서는 이 코드로 흡수된다 |
| `EMAIL_HOST_BLOCKED` | SMTP `host` 가 사설/loopback 대역이라 SSRF 가드(§4 step 6)에 차단됨. 기본 ON, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out. HTTP 의 `HTTP_BLOCKED` 와 동일 메커니즘. `IntegrationError('EMAIL_HOST_BLOCKED')` 로 throw → 그대로 surface |
| `INTEGRATION_INCOMPLETE` | SMTP credentials 의 `host`/`port`/`secure`/`username`/`password`/`default_from` 중 하나라도 누락. `IntegrationError` 로 throw → surface |
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration 의 `serviceType` 이 `'email'` 이 아님. `IntegrationError` 로 throw → surface |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected` 가 아님 (`expired` / `error`). `IntegrationError` 로 throw → surface |

> **`output.error.code` surface 메커니즘**: `execute()` 의 try/catch 안에서 `IntegrationError` 가 catch 된 경우에만 그 `code` 가 `output.error.code` 로 **직접** 노출된다 (위 표의 `EMAIL_HOST_BLOCKED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED`). 그 외 catch 분기의 모든 throw — nodemailer transport 실패 포함 — 는 `EMAIL_SEND_FAILED` 로 mapping 된다. 자격증명 echo / 평문 노출은 `sanitizeMessage` + `maskEmailForErrorDetails` + `truncateForErrorDetails` 가 차단한다.
>
> **현재 미surface (구현 갭 — Planned)**: 다음 코드들은 본 노드의 error 포트로 **아직 노출되지 않는다**. spec 이 종전 surface 를 약속했으나 코드가 다른 경로로 흐른다:
> - `EMAIL_NO_RECIPIENTS` — `to.length === 0` 가드(§4 step 2)가 `execute()` 의 try 블록 **밖**에서 plain `Error('No valid recipients after normalizing the \`to\` field')` 를 throw 한다. 따라서 error 포트(§5.3)로 라우팅되지 않고 **노드 실행 자체가 실패**한다(워크플로우 실패 처리 — §5.8 의 validate-실패 경로와 동일 결과). 향후 이 가드를 try 안으로 옮겨 `IntegrationError('EMAIL_NO_RECIPIENTS')` 로 throw 하면 surface 된다. 근거: `send-email.handler.ts:124-126`.
> - `INTEGRATION_NOT_FOUND` — `integrationId` 가 워크스페이스에 없으면 `IntegrationsService.getForExecution` → `requireEntity` 가 NestJS `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw 한다. 이는 `IntegrationError` 가 아니므로 catch 에서 `EMAIL_SEND_FAILED` 로 흡수된다. 근거: `integrations.service.ts:1108-1122`, `send-email.handler.ts:248-249`.
> - `INTEGRATION_SERVICE_UNAVAILABLE` — `__workspaceId` 컨텍스트 누락 시 base `resolveIntegration` 가 plain `Error('Missing workspace context …')` 를 throw → `IntegrationError` 가 아니므로 `EMAIL_SEND_FAILED` 로 매핑된다. 근거: `integration-handler-base.ts:54-58`.
> - `INTEGRATION_CALL_FAILED` — base helper 의 fallback 코드(`toLogError`)는 **활동 로그(IntegrationUsageLog)** 에만 등장하고 `output.error.code` 로는 노출되지 않는다.

**Expression 접근 예**:
- `$node["X"].output.error.code === 'INTEGRATION_NOT_CONNECTED'` → 재연결 안내 분기
- `$node["X"].output.error.code === 'EMAIL_SEND_FAILED'` → 재시도 / 대체 채널 분기
- `$node["X"].output.subject` → `"Hello Alice"` (실패 시에도 evaluated 값 보존)
- `$node["X"].port === 'error'` → 에러 분기 라우팅

### 5.4 Case: Integration stub (DI 미주입, 비-error)

엔진이 `integrationsService` 를 주입하지 않은 환경(단위 테스트 / 부팅 단계 등) 에서만 발생. 외부 호출 없이 즉시 반환되며, **`output: null` 이 아닌** `status: 'requires_integration'` 로 식별된다 (Container 오버라이트 신호 [Principle 9](../../conventions/node-output.md#principle-9--container-노드의-output-오버라이트-컨트랙트) 와 구별).

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
| `config.*` | (§5.1 과 동일) | config echo | |
| `output.subject` / `body` / `bodyType` | string / enum | runtime | 평가된 값 보존 (디버깅) |
| `output.bodyTruncated?` | boolean | runtime | 256KB cap 초과 시 |
| `status` | `'requires_integration'` | handler return | DI 미주입 식별자. `port` / `meta` 는 생략 |

> 본 케이스는 **runtime 정상 경로 분기** 가 아니라 환경 구성 누락을 알리는 escape hatch 다. 워크플로 작성자가 직접 마주칠 일이 없으며, 다운스트림 노드는 `status === 'requires_integration'` 으로 분기하지 않는다.

### 5.5 Case: Re-run dry-run (port `out`, mock)

`context.variables.__dryRun === true` 인 재실행/리플레이 컨텍스트(`metadata.supportsDryRun: true`)에서만 발생. config 검증을 모두 통과한 뒤 실제 SMTP 발송 직전에 단락되어 **어떤 SMTP/provider 도 건드리지 않고** 정상(`out`) 흐름으로 진행한다. SoT: [Spec Re-run §7](../../5-system/13-replay-rerun.md#7-dry-run).

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
| `config.*` | (§5.1 과 동일) | config echo | raw 템플릿 echo |
| `output._dryRun` | `true` | handler (`buildDryRunMock`) | dry-run 식별자. Run Results UI 가 시각 구분 ([Re-run §7.4](../../5-system/13-replay-rerun.md#7-dry-run)) |
| `output.skippedReason` | `'dry-run mode'` | handler | 단락 사유 |
| `output.wouldHaveCalled` | object | handler | 실제 호출됐을 작업 미리보기. `kind: 'send_email'` + 정규화된 `to` + 평가된 `subject` 만 노출 (`body` / 자격증명 비노출) |
| `meta.deliveryStatus` | `'sent'` | handler | 흐름 정상 진행 신호. dry-run 은 `durationMs` 미부여 |

> dry-run 분기는 §4 step 4 — body cap(step 3) 직후, DI stub(step 5) 및 실제 SMTP 발송 **이전**에 위치한다. `port` 는 생략(default `out`).

### 5.8 handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅

- **`handler.validate()` 실패** (config 형식 자체가 잘못된 경우): warningRule + `evaluateMetadataBlockingErrors` + `validateSendEmailConfig` 가 throw → 엔진이 워크플로우 실패 처리. 예: `Email integration 을 선택해야 합니다.`, `수신자 (To) 를 한 명 이상 입력해야 합니다.`, `subject is required and must be a string`, `bodyType must be either "text" or "html"`.
- **`execute()` try/catch 안의 실패**: §5.3 (`port: 'error'` + `output.error.*`) 으로 라우팅된다. 현재 실제 surface 되는 코드:
  - `EMAIL_SEND_FAILED` — nodemailer transport / SMTP 응답 실패 (fallback). `IntegrationError` 가 아닌 모든 catch 분기도 이 코드로 흡수
  - `EMAIL_HOST_BLOCKED` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` — `IntegrationError` 로 throw 되어 code 가 직접 surface ([공통 §4.2](./0-common.md#42-공통-에러-코드))
- **error 포트로 라우팅되지 않는 실패 (구현 현황 — §5.3 표 1 비고 SoT)**:
  - `EMAIL_NO_RECIPIENTS` — `to.length === 0` 가드가 try **밖**에서 plain `Error` 를 throw → error 포트 미도달, **노드 실행 자체 실패** (validate-실패 경로와 동일 결과). `send-email.handler.ts:124-126`
  - `INTEGRATION_NOT_FOUND` (`NotFoundException`) / `INTEGRATION_SERVICE_UNAVAILABLE` (`__workspaceId` 누락 plain `Error`) — `IntegrationError` 가 아니므로 catch 에서 `EMAIL_SEND_FAILED` 로 흡수된다 (Planned: 별도 코드 surface)

## 6. 에러 코드

§5.3 의 `output.error.code` enum (현재 실제 surface: `EMAIL_SEND_FAILED` / `EMAIL_HOST_BLOCKED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED`) 가 error 포트 실패 경로의 surface. `EMAIL_NO_RECIPIENTS` / `INTEGRATION_NOT_FOUND` / `INTEGRATION_SERVICE_UNAVAILABLE` / `INTEGRATION_CALL_FAILED` 는 §5.3 표 1 비고대로 **현재 error 포트로 노출되지 않는다** (Planned). [공통 §4.2 공통 에러 코드](./0-common.md#42-공통-에러-코드) 표는 모든 Integration 노드에 적용된다.

`output.error.message` 는 `IntegrationHandlerBase.sanitizeMessage` 가 비밀 토큰 (`Bearer …` / `password=…` / 32+ 자 hex/base64 등) 을 `***` 로 마스킹한 후 노출된다. `output.error.details.to` 의 수신자 목록은 `maskEmailForErrorDetails` 로 로컬 파트가 마스킹된다 (`alice@example.com` → `a***@example.com`).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Send Email` 행 인용 (`to: {수신자}`, 2명 초과 시 `+N`).

## 8. Rationale

### 8.0 SMTP host SSRF 가드

§4 step 6 의 SSRF 가드는 HTTP Request / Database Query 노드와 **동일한 `ALLOW_PRIVATE_HOST_TARGETS` 플래그**를 공유한다(기본 차단, self-host opt-out) — integration 노드 전반의 SSRF posture 일관성. 별도 opt-in 플래그를 신설하지 않은 근거·코드명(`EMAIL_HOST_BLOCKED`) 채택 근거·chat-channel 분류표 무영향 분석은 [Spec 통합 관리 §Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"](../../2-navigation/4-integration.md#smtp-ssrf-가드를-httpdb-와-동일-allow_private_host_targets-로-통일) 가 SoT. 연결 테스트만 막고 발송은 뚫리는 비대칭을 막기 위해 발송 경로(본 노드)에도 동일 가드를 적용한다.

### 8.1 `to`/`cc`/`bcc` array-only 정준화

종전: 표 상 `String[] / String` (sum type) — 사용자가 콤마-구분 단일 문자열 (`"alice@x.com, bob@y.com"`) 도 입력 가능.

문제: 두 검증 layer 의 진실이 어긋남.

| layer | string 입력 처리 |
|---|---|
| zod `sendEmailNodeConfigSchema` | `z.array(z.string())` — parse 실패 |
| validator `validateSendEmailConfig` | `isRecipientsLike` 가 `typeof string` 도 허용 — 통과 |

결과: raw `string` 이 들어오면 zod 단계에서 거부되어 normalizeRecipients 까지 도달하지 못하지만, validator 단독으로는 통과 — `add_node` tool 응답에는 valid 처럼 보이는데 storage 에는 array 로 강제 변환되어 의도와 다른 1-원소 array 가 저장될 수 있음.

**해법**: validator + handler 를 array-only 로 좁혀 (breaking) 두 layer 를 정렬한다 — storage·echo·표현식 모두 단일 array 형태로 통일된다. zod 를 sum-type 으로 완화하면 storage 에 두 형태가 공존해 output echo·downstream 표현식이 모두 sum-type 을 처리해야 하고, frontend 자동 wrap 은 backend semantic 보정 책임을 frontend 가 떠안게 되어 책임 위치가 모호해지므로 모두 배제했다. 스테이징 단계로 단일 string 형태 워크플로가 거의 없어 별도 마이그레이션 스크립트 없이 진행한다.

**결과 동작 layer**:
- **frontend** — `widget: 'field-array'` 이미 array. 변경 없음
- **storage (zod)** — `z.array(z.string())` 유지 (변경 없음). 비-array raw 입력은 parse 실패
- **validator (`validateSendEmailConfig`)** — `string` 경로 제거, array-only. zod 와 일관
- **handler (`normalizeRecipients`)** — string 콤마-split 경로 제거. 비-array 입력은 defensive `[]` (safety net)
- **output echo (`sendEmailNodeOutputSchema.config.to/cc/bcc`)** — `z.unknown()` → `z.array(z.string())` (echo 의 array-only 명시)
- **표현식** — array 원소 단위로 `{{ ... }}` 사용 (예: `["{{ $input.email }}"]`)
