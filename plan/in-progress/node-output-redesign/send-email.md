# Send Email output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. evaluated `subject`/`body`/`bodyType` (Principle 7 — config raw 와 직교) + `output.error.details.to` 마스킹 + DI stub (`status: 'requires_integration'`) 유지. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/4-integration/3-send-email.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/4-integration/3-send-email.md:101-124` — §5.1 정상 발송 (port `out`):

```json
{
  "config": { "integrationId": ..., "to": "{{ $input.email }}", "cc": [], "bcc": [], "subject": "Hello {{ $input.name }}", "body": "Welcome {{ $input.name }}!", "bodyType": "text", "attachments": [] },
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

§5.3 Runtime 전송 실패 (port `error`):

```json
{
  "output": {
    "subject": "Hello Alice", "body": "Welcome Alice!", "bodyType": "text",
    "error": { "code": "INTEGRATION_NOT_CONNECTED", "message": "...", "details": { "to": ["a***@example.com"], "subject": "...", "integrationCode": "INTEGRATION_NOT_CONNECTED" } }
  },
  "meta": { "durationMs": 35, "deliveryStatus": "failed" },
  "port": "error"
}
```

§5.4 Integration stub (DI 미주입):

```json
{
  "output": { "subject": "Hello", "body": "Welcome!", "bodyType": "text" },
  "status": "requires_integration"
}
```

## 진단

Send Email 은 외부 호출 노드 (단계 1개). 정상 / runtime 에러 / DI stub = 3 케이스.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.messageId` | 적절 (output) | nodemailer 가 부여한 SMTP Message-ID — Principle 8.2 권장 위치 |
| `output.accepted: string[]` / `output.rejected: string[]` | 적절 (output) | nodemailer 결과 (부분 거부 정보) |
| `output.subject` / `output.body` / `output.bodyType` (evaluated) | 적절 (output) | spec 명시: 실제 발송된 평가된 값. config 의 raw 와 직교 (Principle 7 표 last row 명시) |
| `output.bodyTruncated?` | 적절 | 256KB cap 동봉 |
| `output.error.{code, message, details}` | 적절 | Principle 3.2 |
| `output.error.details.to` (마스킹된 수신자) | 적절 | PII 보호 (`maskEmailForErrorDetails`) |
| `output.error.details.subject` (200자 truncate) | 적절 | 에러 envelope 의 대용량 방지 |
| `output.error.details.integrationCode?` | 적절 | `IntegrationError` 인 경우 `output.error.code` 와 동일 값 — 관찰성 호환 |
| `meta.deliveryStatus: 'sent' | 'failed'` | 적절 (meta) | 큐 진입 성공/실패 신호 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.*` (raw echo) | 적절 | Principle 7 — `to`/`cc`/`bcc` 의 string/array 원형 보존, 자격증명 echo 금지 |
| `status: 'requires_integration'` (§5.4 stub) | 적절 | 환경 구성 누락 escape hatch — 워크플로 작성자가 마주칠 일 없음 |

부적절 항목 없음. spec 본문이 매우 잘 정리됨.

추가 점검:

1. **§5.4 stub 의 `output: { subject, body, bodyType }`** — 외부 호출이 일어나지 않았으므로 evaluated 값 만 보존. `status: 'requires_integration'` 으로 식별. 합리적.
2. **`output.error` + `output` 평가된 메타 (subject/body/bodyType) 병존** — 디버깅 용이성. spec 명시: "실패 시에도 evaluated 값 보존". 합리적.
3. **`output.error.details.to` 마스킹** — 수신자 개인정보 보호. SMTP 응답에서 수신자 목록이 노출되는 경로를 차단.
4. **`config.attachments[i].path` / `href` strip + `disableFileAccess` / `disableUrlAccess`** — 보안 정책. spec §1 footnote 명시. config 단계에서 사용자 입력 통제.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 정상 발송
{
  "config": { "integrationId": ..., "to": <raw>, "cc": <raw>, "bcc": <raw>, "subject": <raw>, "body": <raw>, "bodyType": ..., "attachments": <raw> },
  "output": {
    "messageId": <string>,
    "accepted": [<email>, ...],
    "rejected": [<email>, ...],         // 부분 거부도 success 유지 (예상 가능 비즈니스 실패)
    "subject": <evaluated>,
    "body": <evaluated, 256KB cap>,
    "bodyType": <enum>,
    "bodyTruncated"?: <true>
  },
  "meta": { "durationMs": <number>, "deliveryStatus": "sent" },
  "port": "out"
}

// Runtime 실패
{
  "config": {...},
  "output": {
    "subject": <evaluated>, "body": <evaluated>, "bodyType": ..., "bodyTruncated"?,
    "error": {
      "code": "EMAIL_SEND_FAILED" | "INTEGRATION_*",
      "message": <sanitized>,
      "details": { "to": [<masked>, ...], "subject": <truncated 200자>, "integrationCode"? }
    }
  },
  "meta": { "durationMs": <number>, "deliveryStatus": "failed" },
  "port": "error"
}

// Integration stub (DI 미주입)
{
  "config": {...},
  "output": { "subject": <evaluated>, "body": <evaluated>, "bodyType": ..., "bodyTruncated"? },
  "status": "requires_integration"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- 이메일 노드의 `output` 핵심은 발송 결과 (`messageId`, `accepted`, `rejected`) + 발송된 컨텐츠 (`subject`, `body`) — 모두 비즈니스 데이터.
- evaluated `subject`/`body` 가 `output` 에 있는 이유: 후속 노드가 "실제 발송된 내용" 을 참조해야 할 수 있음 (예: 발송 로그 저장, 실패 시 재발송). `config` 의 raw 와 직교 (Principle 7 표).
- 부분 거부 (`rejected.length > 0`) 도 `out` 포트로 흐른다는 결정 (Principle 3.1 의 "예상 가능한 비즈니스 실패" 범주) 은 spec 명시. 후속 노드가 `output.rejected.length` 로 재시도 분기 구성.
- DI stub (`status: 'requires_integration'`) 은 5필드 invariant 의 status 필드를 활용한 escape hatch — 사용자 노출되지 않는 경로.
