# Send Email (`send_email`)

> SMTP를 통해 이메일을 발송합니다. Integration(`serviceType: 'email'`)에서 SMTP 자격증명을 읽어 nodemailer 풀(최대 3 커넥션 / 100 메시지)을 캐시하며, 자격증명 해시 기준으로 rotation 시 자동 재생성합니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `integrationId` | string | yes | (없음) | SMTP Integration ID (`serviceType: 'email'`) | no |
| `to` | `string[]` | yes (비어있지 않아야 함) | `[]` | 수신자 목록. 단일 문자열도 허용되며 `,` 구분 다중 주소는 자동 분리 | 배열 항목 내부 yes |
| `cc` | `string[]` | no | `[]` | CC 수신자. 비우거나 생략 가능 | 항목 내부 yes |
| `bcc` | `string[]` | no | `[]` | schema 필드. **핸들러는 현재 이 값을 nodemailer에 전달하지 않음** (아래 주의사항 참고) | — |
| `subject` | string | yes | (없음) | 메일 제목 | yes (`expression` 위젯) |
| `body` | string | yes | (없음) | 메일 본문 | yes (`expression` 위젯) |
| `bodyType` | `'text' \| 'html'` | no | `'text'` | 본문 타입. `'html'`이면 nodemailer `html` 필드, `'text'`이면 `text` 필드로 전달 | no |
| `attachments` | `Array<{filename:string, content:string}>` | no | `[]` | schema 필드. **핸들러는 현재 이 값을 nodemailer에 전달하지 않음** | `content`는 `expression` 위젯 |

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | (참조용 — 핸들러는 직접 소비하지 않음) |
| Output | `out` | Output | `data` | 발송 성공 또는 `requires_integration` 상태 |

> **error 포트 없음**. SMTP 전송 실패 / 자격증명 누락 / integration 타입 오류 등은 모두 `throw` → 노드 자체가 실패 상태로 전이합니다. try/catch 분기가 필요하면 상위 워크플로우에서 다뤄야 합니다.

## Input

핸들러는 `_input`을 직접 소비하지 않습니다. expression resolver가 핸들러 호출 전에 `to`/`cc`/`subject`/`body`/`attachments[].content` 안의 `{{ ... }}`를 평가해 config에 주입합니다.

## Output

### Case 1: 정상 발송

입력 config: `{ integrationId: "int_smtp_1", to: "a@b.com, c@d.com", cc: "team@b.com", subject: "Hello", body: "Body" }`

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["a@b.com", "c@d.com"],
    "cc": ["team@b.com"],
    "subject": "Hello",
    "bodyType": "text"
  },
  "output": {
    "messageId": "<abc@smtp.example.com>",
    "accepted": ["a@b.com", "c@d.com", "team@b.com"],
    "rejected": []
  },
  "meta": { "durationMs": 234, "deliveryStatus": "sent" }
}
```

- `config.to`, `config.cc`는 문자열 입력이었다면 `,` 기준으로 split + trim + 빈 항목 제거된 **정규화 결과 배열**.
- `from`은 자동으로 integration 자격증명의 `default_from`이 사용됩니다 (config echo엔 들어가지 않음).
- `port` 필드는 반환되지 않으므로 엔진은 기본 `out` 포트로 흐릅니다.

### Case 2: HTML 본문

입력 config의 `bodyType: 'html'`, `body: '<b>hi</b>'`.

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["a@b.com"],
    "cc": [],
    "subject": "Hello",
    "bodyType": "html"
  },
  "output": { "messageId": "<...>", "accepted": ["a@b.com"], "rejected": [] },
  "meta": { "durationMs": 201, "deliveryStatus": "sent" }
}
```

### Case 3: 일부 주소가 SMTP에서 거부된 경우

```json
{
  "config": { "integrationId": "int_smtp_1", "to": ["a@b.com", "bad@"], "cc": [], "subject": "...", "bodyType": "text" },
  "output": {
    "messageId": "<msg@host>",
    "accepted": ["a@b.com"],
    "rejected": ["bad@"]
  },
  "meta": { "durationMs": 180, "deliveryStatus": "sent" }
}
```

`messageId`가 부여되고 `deliveryStatus: 'sent'`이지만 일부 `rejected`가 존재할 수 있습니다. 전체 거부여도 nodemailer가 예외를 던지지 않는 한 success 경로입니다. 후속 노드에서 `$node["..."].output.rejected.length`로 판별하세요.

### Case 4: Integration 서비스 미주입 (`requires_integration`)

IntegrationsService DI가 연결되지 않은 환경(예: 일부 테스트/드라이런)에서 핸들러는 **throw하지 않고** 다음을 반환합니다.

```json
{
  "config": {
    "to": ["a@b.com"],
    "cc": [],
    "subject": "Hello",
    "bodyType": "text"
  },
  "output": null,
  "status": "requires_integration"
}
```

- 이 경로에서는 `config.integrationId`조차 echo되지 않습니다 (집합: `{to, cc, subject, bodyType}`).
- 엔진은 `status`에 따라 이 노드를 "integration 필요" 상태로 표시합니다.
- Case 1과 달리 `meta`, `port` 필드가 없습니다.

### Case 5: 발송 실패 또는 사전 검증 실패 (throw → 노드 실패)

아래 경우는 모두 예외를 던져 노드가 실패합니다. Activity 로그에는 아래 코드로 기록됩니다 (`toLogError`가 메시지 안 비밀번호/토큰을 마스킹).

| 코드 | 원인 |
| --- | --- |
| `INTEGRATION_TYPE_MISMATCH` | `serviceType`이 `'email'`이 아님 |
| `INTEGRATION_NOT_CONNECTED` | integration 상태가 `connected`가 아님 (`expired`, `error` 등) |
| `INTEGRATION_INCOMPLETE` | 자격증명에서 `host/port/secure/username/password/default_from` 중 누락 |
| `SMTP_SEND_FAILED` | nodemailer `sendMail`가 던진 네트워크/인증/대상 서버 오류 |
| (메시지) `No valid recipients after normalizing the 'to' field` | 정규화 후 `to`가 빈 배열일 때 |
| (메시지) `Missing workspace context — handler cannot resolve the integration` | `context.variables.__workspaceId` 누락 (엔진 설정 문제) |

| 필드 | 설명 |
| --- | --- |
| `config.integrationId` | 사용한 integration ID (stub 경로에서는 생략됨) |
| `config.to` | 정규화된 수신자 배열 |
| `config.cc` | 정규화된 CC 배열 (없으면 `[]`) |
| `config.subject` | 메일 제목 |
| `config.bodyType` | `'text'` 또는 `'html'` |
| `output.messageId` | SMTP 서버가 부여한 Message-ID |
| `output.accepted` | SMTP가 수용한 주소 |
| `output.rejected` | SMTP가 거부한 주소 |
| `meta.durationMs` | 발송 소요 ms |
| `meta.deliveryStatus` | 현재 항상 `'sent'` (큐 진입 성공). 실제 최종 delivery 상태는 아님 |
| `status` | stub 경로에서만 `'requires_integration'` |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Notify Admin`이라고 가정합니다.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Notify Admin"].output.messageId }}` | `"<msg@host>"` | SMTP Message-ID |
| `{{ $node["Notify Admin"].output.accepted }}` | `["a@b.com"]` | 수용된 주소 목록 |
| `{{ $node["Notify Admin"].output.rejected }}` | `[]` \| `["bad@"]` | 거부된 주소 목록 — 부분 실패 판별에 사용 |
| `{{ $node["Notify Admin"].meta.durationMs }}` | `234` | 발송 시간 (ms) |
| `{{ $node["Notify Admin"].meta.deliveryStatus }}` | `"sent"` | nodemailer 큐 진입 성공 표시 |
| `{{ $node["Notify Admin"].status }}` | `"requires_integration"` | integration 서비스 DI 미주입 경로에서만 |
| `{{ $node["Notify Admin"].config.to }}` | `["a@b.com"]` | 정규화된 수신자 |
| `{{ $node["Notify Admin"].config.cc }}` | `["team@b.com"]` | 정규화된 CC |
| `{{ $node["Notify Admin"].config.subject }}` | `"Hello"` | 제목 |
| `{{ $node["Notify Admin"].config.bodyType }}` | `"text"` \| `"html"` | 본문 타입 |
| `{{ $node["Notify Admin"].config.integrationId }}` | `"int_smtp_1"` | (stub이 아닐 때) integration ID |

## 주의사항

- **자격증명 제거**: SMTP 자격증명(`host/port/secure/username/password/default_from`)은 `config` echo에 절대 포함되지 않습니다. 그중 `default_from`만 `from` 필드로 실제 전송에 사용됩니다.
- **`from`은 항상 integration의 `default_from`**: config로 직접 `from`을 바꿀 수 없습니다. 다른 주소로 보내려면 별도의 SMTP Integration을 생성해야 합니다.
- **`bcc`와 `attachments`는 현재 미전송**: schema에는 선언되어 있고 UI도 받지만, 핸들러의 `sendMail` 호출에는 포함되지 않습니다. 필요한 경우 이슈를 올리고 핸들러 변경을 요청하세요.
- **수신자 정규화**: `to`/`cc`는 배열이면 문자열 항목만 남겨 `trim` + 빈 것 제거, 문자열이면 `,` 기준 split + trim. 정규화 후 `to`가 비면 `throw` (노드 실패).
- **validate 규칙**: validate는 `to`를 "비어있지 않은 문자열 또는 문자열 배열"만 허용. `cc`는 빈 문자열/undefined 허용, 값이 있으면 동일 규칙. 이메일 형식 자체는 validate에서 검사하지 않음 (SMTP 서버가 거부하면 `rejected`에 포함될 수 있음).
- **bodyType 분기**: `'html'`은 nodemailer `html` 필드, `'text'`는 `text` 필드로만 전송. 둘 다 넣을 수 없음.
- **secure 옵션 매핑**: integration 자격증명의 `secure` 값이
  - `'tls'` → nodemailer `secure: true` (SMTPS, 일반적으로 465 포트)
  - `'starttls'` → `requireTLS: true` (일반적으로 587)
  - `'none'` → 평문 (운영 환경에서 권장하지 않음)
- **커넥션 풀**: `integrationId` + 자격증명 SHA-256 해시를 키로 transporter 캐시. `pool: true`, `maxConnections: 3`, `maxMessages: 100`. 자격증명 회전 시 기존 transporter `close()` 후 새로 생성. 테스트/종료 훅에서 `handler.shutdown()` 또는 `handler.invalidateTransport(id)`로 명시적 해제 가능.
- **예외 vs `requires_integration`**:
  - **IntegrationsService DI가 애초에 주입되지 않은 경우**: `requires_integration` 상태 반환 (throw 아님).
  - **integration을 resolve했는데 자격증명이 누락/만료/타입 불일치**: `throw` (노드 실패).
  - **SMTP 전송 실패**: `throw` → Activity에는 `SMTP_SEND_FAILED` 기록. 에러 메시지 안의 비밀번호/토큰 패턴은 `toLogError`가 마스킹.
- **`deliveryStatus`는 항상 `'sent'`**: nodemailer가 큐에 넣는 데 성공했음을 의미하지, 실제 수신자의 인박스 도착을 보증하지 않습니다. 부분 거부는 `output.rejected`로 판별.
- **error 포트 부재**: 발송 실패를 워크플로우에서 분기하려면 부모 컨테이너에서 재시도 / 실패 핸들링을 구성하거나, 별도의 상위 노드에서 후속 처리를 해야 합니다.
- **IntegrationUsageLog**: 성공/실패 모두 `nodeExecutionId`와 함께 기록됩니다. `nodeExecutionId`가 없으면 최초 1회만 경고 로그 출력 후 usage row는 건너뜁니다.
