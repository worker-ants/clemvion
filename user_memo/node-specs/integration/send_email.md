# Send Email (`send_email`)

> SMTP를 통해 이메일을 발송합니다. Integration에서 SMTP 자격증명을 받아 nodemailer 풀로 연결을 관리합니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `integrationId` | string | yes | (없음) | SMTP Integration ID | no |
| `to` | string[] | yes (1개 이상) | `[]` | 수신자 목록. 단일 문자열도 허용(`,` 구분 자동 분리) | (배열 항목별) |
| `cc` | string[] | no | `[]` | CC 수신자 | (배열 항목별) |
| `bcc` | string[] | no | `[]` | BCC 수신자 (현재 핸들러는 사용 안 함, schema에만 정의) | — |
| `subject` | string (expression) | yes | (없음) | 메일 제목 | yes |
| `body` | string (expression) | yes | (없음) | 메일 본문 | yes |
| `bodyType` | `'text' \| 'html'` | no | `'text'` | 본문 타입 | no |
| `attachments` | `Attachment[]` | no | `[]` | 첨부파일 목록 (현재 핸들러는 사용 안 함) | — |

`Attachment`:
- `filename`: string
- `content`: string (URL 또는 인코딩된 데이터)

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (참조용) |
| Output | `out` | Output | 발송 성공/대기 결과 |

> Send Email은 명시적 `error` 포트가 없습니다. 발송 실패는 노드 자체를 throw 시켜 워크플로우 실패로 처리됩니다.

## Input

핸들러는 input을 직접 사용하지 않고 expression resolver가 `subject`/`body` 안의 표현식을 사전 평가합니다.

## Output

### Case 1: 정상 발송

config: `{ integrationId: "smtp_1", to: ["a@b.com"], subject: "Hello", body: "Body" }`

```json
{
  "config": {
    "integrationId": "smtp_1",
    "to": ["a@b.com"],
    "cc": [],
    "subject": "Hello",
    "bodyType": "text"
  },
  "output": {
    "messageId": "<abc@host>",
    "accepted": ["a@b.com"],
    "rejected": []
  },
  "meta": { "durationMs": 234, "deliveryStatus": "sent" }
}
```

### Case 2: Integration 서비스 미설정 (`requires_integration` 상태)

```json
{
  "config": { "to": [...], "cc": [], "subject": "...", "bodyType": "text" },
  "output": null,
  "status": "requires_integration"
}
```

이 경우 워크플로우 엔진은 사용자에게 integration 설정을 요구하는 상태로 처리.

### Case 3: 발송 실패 (자격증명, SMTP 에러)

핸들러가 throw → 노드 실패. 에러 코드 예: `INTEGRATION_INCOMPLETE`, `SMTP_SEND_FAILED`. error 포트가 없으므로 워크플로우가 실패합니다 (try/catch 분기 불가).

| 필드 | 설명 |
| --- | --- |
| `output.messageId` | SMTP가 부여한 메시지 ID |
| `output.accepted` | 수신 가능한 주소 목록 (SMTP 응답 기준) |
| `output.rejected` | 거부된 주소 목록 |
| `meta.durationMs` | 발송 시간 |
| `meta.deliveryStatus` | `'sent'` (발송 큐 진입 성공) |
| `status` | `'requires_integration'` (integration 서비스 없을 때만) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Notify Admin`이라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Notify Admin"].output.messageId }}` | `"<msg-id@host>"` | SMTP 메시지 ID |
| `{{ $node["Notify Admin"].output.accepted }}` | `["a@b.com"]` | 수신 가능한 주소 |
| `{{ $node["Notify Admin"].output.rejected }}` | `[]` | 거부된 주소 |
| `{{ $node["Notify Admin"].meta.durationMs }}` | `234` | 발송 시간 |
| `{{ $node["Notify Admin"].meta.deliveryStatus }}` | `"sent"` | 상태 |
| `{{ $node["Notify Admin"].status }}` | `"requires_integration"` | (integration 미설정일 때만) |
| `{{ $node["Notify Admin"].config.to }}` | `["a@b.com"]` | 발송 대상 |

## 주의사항

- `to`, `cc`는 단일 문자열도 허용되며, `,`로 구분된 다중 주소 자동 분리됩니다.
- **`bcc`와 `attachments`는 schema에 정의되어 있으나 핸들러에서 실제로 사용되지 않습니다** (현재 미구현).
- `default_from`은 SMTP integration 자격증명에서 가져옵니다 — config로 from을 직접 지정할 수 없습니다.
- `bodyType: 'html'`이면 `html` 필드, `'text'`면 `text` 필드로 nodemailer에 전달.
- SMTP 실패는 throw → 워크플로우 노드 자체가 실패 상태가 됩니다. fan-out 후 한 노드가 실패해도 다른 분기는 진행되지만, 직접 분기 처리는 불가.
- `secure: 'tls'`(자격증명)는 SMTPS(465), `'starttls'`는 STARTTLS(587), `'none'`은 평문(권장 안 함).
- 연결 풀: integration ID + creds hash로 캐시. 자격증명 회전 시 자동 재생성. 풀 max 3 conn / 100 messages.
- 자격증명 누락 시 `INTEGRATION_INCOMPLETE` throw, integration 서비스 미설정 시 `requires_integration` 상태로 반환 (둘은 다른 분기).
