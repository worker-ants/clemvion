# Spec: Send Email

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

SMTP를 통해 이메일을 발송하는 **Integration 노드**. Integration 엔티티의 SMTP 자격증명 (`host`/`port`/`secure`/`username`/`password`/`default_from`) 을 사용해 발송하며, runtime 전송 실패는 `error` 포트로 라우팅된다 (CONVENTIONS Principle 3.1).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | SMTP Integration 참조 ([공통 §1](./0-common.md#1-integration-참조)). `serviceType='email'` 만 허용 |
| to | String[] / String (표현식) | ✓ | `[]` | 수신자. 배열 또는 콤마-구분 문자열. 표현식(`{{ }}`) 지원 |
| cc | String[] / String | | `[]` | 참조. 형식은 `to` 와 동일 |
| bcc | String[] / String | | `[]` | 숨은 참조. 형식은 `to` 와 동일 |
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

> Source of truth: `backend/src/nodes/integration/send-email/send-email.schema.ts` (export `sendEmailNodeConfigSchema` / `sendEmailNodeMetadata`).

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
| `error` | Error | error | false | runtime 전송 실패 — `EMAIL_SEND_FAILED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED`. §5.3 |

> Send Email 은 동적 포트가 없다. Pre-flight (`validate()`) 검증 실패는 §5.8 throw.

## 4. 실행 로직

1. **Pre-flight 검증** (`validate()`) — `evaluateMetadataBlockingErrors` (warningRules 평가) + `validateConfig` (recipient sum-type) + `subject`/`body` 문자열 / `bodyType` enum 체크. 실패 시 throw → §5.8
2. **수신자 정규화** — `to`/`cc`/`bcc` 각각:
   - 배열 → 원소를 `trim()` 후 빈 문자열 제거
   - 문자열 → 콤마 split 후 각 토큰 `trim()`
   - 정규화 결과가 `to.length === 0` 이면 throw `'No valid recipients after normalizing the \`to\` field'`
3. **Body cap** — 평가된 `body` 를 `truncateBodyForOutput` (256KB) 로 제한. 초과 시 `output.bodyTruncated: true` 부여
4. **Integration stub 분기** — `integrationsService` 가 주입되지 않은 경우(테스트/DI 미주입) `status: 'requires_integration'` 로 즉시 반환 (외부 호출 없음). §5.4
5. **Integration 조회** — `IntegrationsService.getForExecution(integrationId, workspaceId)` 로 SMTP 자격증명 복호화. `serviceType !== 'email'` / `status !== 'connected'` / 필수 필드 누락 → `IntegrationError` throw (catch 후 §5.3)
6. **SMTP 발송** — credentials hash 기반으로 nodemailer transporter 캐시 재사용. `from = credentials.default_from`, `subject` / `body` 는 평가된 값. `bodyType='html'` 이면 `html` 옵션, 아니면 `text` 옵션
7. **Usage 로깅** — `logUsage({integrationId, status, durationMs, error?})` 를 성공/실패 무관 호출 ([공통 §4.1](./0-common.md#41-공통-계약))
8. **반환** — 성공 §5.1 / runtime 실패 §5.3 / Integration stub §5.4

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> `config` 은 사용자가 입력한 **raw** 값을 echo (Principle 7) — `{{ }}` 보존, `to`/`cc`/`bcc` 의 string/array 원형 보존, 자격증명 echo 금지. `output.subject` / `output.body` / `output.bodyType` 는 실제 SMTP 에 전송된 평가된 값 (Principle 1). `meta` 는 실행 메트릭만 (Principle 2).

### 5.1 Case: 정상 발송 (port `out`)

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": "{{ $input.email }}",
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
| `config.to` / `cc` / `bcc` | string \| string[] | config echo | 사용자가 입력한 **raw** 형태 (표현식 보존). 정규화 결과는 echo 하지 않음 |
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
    "to": "{{ $input.email }}",
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
| `EMAIL_SEND_FAILED` | nodemailer `sendMail` 이 throw 한 generic transport 실패 (네트워크/SMTP 응답 오류 등). `IntegrationError` 가 아닌 모든 catch 분기의 fallback |
| `INTEGRATION_INCOMPLETE` | SMTP credentials 의 `host`/`port`/`secure`/`username`/`password`/`default_from` 중 하나라도 누락 |
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration 의 `serviceType` 이 `'email'` 이 아님 |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected` 가 아님 (`expired` / `error`) |
| `INTEGRATION_NOT_FOUND` | `integrationId` 가 워크스페이스에 존재하지 않음 |
| `INTEGRATION_CALL_FAILED` | 기타 분류되지 않은 실패 (베이스 helper 의 fallback — `IntegrationsService.getForExecution` 내부에서 발생 가능) |

> `IntegrationError` 가 catch 된 경우 그 `code` 가 `output.error.code` 로 직접 노출된다 (예: `INTEGRATION_NOT_CONNECTED`). 그 외 모든 throw 는 `EMAIL_SEND_FAILED` 로 mapping. 자격증명 echo / 평문 노출은 `sanitizeMessage` + `maskEmailForErrorDetails` + `truncateForErrorDetails` 가 차단한다.

**Expression 접근 예**:
- `$node["X"].output.error.code === 'INTEGRATION_NOT_CONNECTED'` → 재연결 안내 분기
- `$node["X"].output.error.code === 'EMAIL_SEND_FAILED'` → 재시도 / 대체 채널 분기
- `$node["X"].output.subject` → `"Hello Alice"` (실패 시에도 evaluated 값 보존)
- `$node["X"].port === 'error'` → 에러 분기 라우팅

### 5.4 Case: Integration stub (DI 미주입, 비-error)

엔진이 `integrationsService` 를 주입하지 않은 환경(단위 테스트 / 부팅 단계 등) 에서만 발생. 외부 호출 없이 즉시 반환되며, **`output: null` 이 아닌** `status: 'requires_integration'` 로 식별된다 (Container 오버라이트 신호 [Principle 9](../../../user_memo/node-specs-improvement/CONVENTIONS.md#principle-9--container-노드의-output-오버라이트-컨트랙트) 와 구별).

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

### 5.8 Pre-flight throw (config 검증 실패)

다음 조건은 `validate()` 또는 `execute()` 진입 직후 throw → 노드 자체 실패 (CONVENTIONS Principle 3.1). `error` 포트로 라우팅되지 않는다.

| 발생 조건 | 메시지 (예) | 시점 |
|-----------|-------------|------|
| `integrationId` 누락 | `Email integration 을 선택해야 합니다.` | warningRule (캔버스 배지) + `evaluateMetadataBlockingErrors` |
| `to` 빈 배열 / 형식 오류 | `수신자 (To) 를 한 명 이상 입력해야 합니다.` / `to is required and must be a non-empty string or array of email addresses` | warningRule + `validateSendEmailConfig` |
| `cc` / `bcc` 형식 오류 (set 이지만 비-recipient shape) | `cc must be a string or array of email addresses` | `validateSendEmailConfig` |
| `subject` 누락 / 비-string | `제목을 입력해야 합니다.` / `subject is required and must be a string` | warningRule + handler.validate |
| `body` 누락 / 비-string | `본문을 입력해야 합니다.` / `body is required and must be a string` | warningRule + handler.validate |
| `bodyType` 가 `text`/`html` 외 | `bodyType must be either "text" or "html"` | handler.validate |
| `to` 정규화 결과가 빈 배열 | `No valid recipients after normalizing the \`to\` field` | `execute()` (validate 통과 후 trim/공백 제거 결과) |
| `__workspaceId` 누락 | `Missing workspace context — handler cannot resolve the integration` | `resolveIntegration` (엔진 환경 문제) |

> ⚠ **개선안 항목 (P1, [send_email.md §3](../../../user_memo/node-specs-improvement/integration/send_email.md#3-제안된-output-구조))**: `to` 정규화 결과가 빈 배열인 케이스 (`EMAIL_NO_RECIPIENTS`) 는 본질적으로 runtime 표현식 평가 결과이므로 `error` 포트로 라우팅되는 편이 일관적이다. 현재는 throw — spec 변경 시 §5.3 enum 으로 이동하고 본 §5.8 행에서 제거한다.

## 6. 에러 코드

§5.3 의 `output.error.code` enum (`EMAIL_SEND_FAILED` / `INTEGRATION_*`) 와 §5.8 의 pre-flight throw 메시지를 통합 참조한다. [공통 §4.2 공통 에러 코드](./0-common.md#42-공통-에러-코드) 표는 모든 Integration 노드에 적용된다.

`output.error.message` 는 `IntegrationHandlerBase.sanitizeMessage` 가 비밀 토큰 (`Bearer …` / `password=…` / 32+ 자 hex/base64 등) 을 `***` 로 마스킹한 후 노출된다. `output.error.details.to` 의 수신자 목록은 `maskEmailForErrorDetails` 로 로컬 파트가 마스킹된다 (`alice@example.com` → `a***@example.com`).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Send Email` 행 인용 (`to: {수신자}`, 2명 초과 시 `+N`).
