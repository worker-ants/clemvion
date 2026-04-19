# Send Email (`send_email`) — Output 일관성 개선안

- **카테고리**: integration
- **현 문서**: [../../node-specs/integration/send_email.md](../../node-specs/integration/send_email.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

SMTP 로 이메일을 발송합니다. 단일 출력 포트(`out`) 만 존재하고 **error 포트는 없습니다**. 발송 실패(SMTP 전송 실패, 자격증명 오류, 타입 불일치, recipient 정규화 실패 등)는 모두 `throw` 되어 노드 자체가 실패로 전이되므로, 워크플로우에서 "전송 실패 분기" 를 잡을 수 없습니다.

### 현재 Case 1: 정상 발송

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

### 현재 Case 2: 부분 거부 (success 로 분류됨)

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

### 현재 Case 3: Integration 미주입 stub

```json
{
  "config": { "to": ["a@b.com"], "cc": [], "subject": "Hello", "bodyType": "text" },
  "output": null,
  "status": "requires_integration"
}
```

특징 요약:

- `port` 필드 자체가 생략됨 (단일 포트이므로 엔진 기본 `out`).
- `output.{messageId, accepted, rejected}` 가 성공 경로의 결과.
- `meta.deliveryStatus` 는 현재 **항상 `'sent'`** (큐 진입 성공 의미).
- `bcc` / `attachments` 는 schema 에는 있지만 핸들러가 nodemailer 로 전달하지 않음 — **구현 결함**.
- 발송 실패는 `throw` — error 포트 부재로 인해 사용자는 실패 분기를 구성할 수 없음.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 발송 실패 시 error 포트 없음 | Principle 3.1 | SMTP 전송 실패는 "외부 API 실패" 에 해당하는 **runtime 에러** 이므로 `port: 'error'` + `output.error.{code,message,details?}` 로 라우팅되어야 함. 현재는 throw → 노드 자체 실패 → 분기 불가능 |
| 2 | `bcc` / `attachments` schema-handler 불일치 | Principle 3.1 (pre-flight) / Principle 11 | schema 에 선언되어 UI 에서 값을 받지만 실제 발송에는 사용되지 않음. silent failure 의 전형 — validate 단계에서 거부하거나 핸들러가 실제로 지원해야 함 (별도 구현 이슈) |
| 3 | `status: 'requires_integration'` 특수값 | Principle 0 / INCONSISTENCY_MATRIX 축 9 | enum 에 포함되어 있으나 다른 노드와 달리 "DI 미주입" 이라는 엔진 환경 상태를 노드 output 으로 노출. enum 유지하되 문서에 명시 |
| 4 | Integration stub 경로의 `output: null` | Principle 9 (container 오버라이트 규약)과 혼동 가능 | `output: null` 은 통상 container 엔진 오버라이트 신호인데, stub 경로에서도 같은 값을 사용. `status` 조합으로 구분은 가능하나, 문서에서 명시적으로 분리해야 함 |
| 5 | `meta.deliveryStatus` 항상 `'sent'` | Principle 2 (의미 없는 메트릭) | 실제로 큐 진입 성공 이외 값을 갖지 않음. 의미상 중복이나 향후 `'queued'` / `'sent'` / `'rejected_all'` 등으로 확장 여지 남기고 유지 |
| 6 | `port` 필드 미반환 | Principle 5 | 단일 출력 노드이므로 `port: undefined` 는 규약에 부합 (P5 표). 유지 |

## 3. 제안된 Output 구조

### Before — 발송 실패 시 throw (error 포트 없음)

```
handler → throw Error("SMTP_SEND_FAILED: connection timeout")
→ 노드 실패 상태, 후속 노드 모두 실행 불가
```

### After — Case 1: 정상 발송 (변경 거의 없음)

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
  "meta": { "durationMs": 234, "deliveryStatus": "sent" },
  "port": "out"
}
```

- `port: "out"` 를 **명시적으로 반환** (현재는 생략 → 엔진 fallback). 자동완성/디버깅에서 활성 포트를 일관되게 조회 가능.

### After — Case 2: 부분 거부 (변경 없음, success 유지)

```json
{
  "config": { "integrationId": "int_smtp_1", "to": ["a@b.com", "bad@"], "cc": [], "subject": "...", "bodyType": "text" },
  "output": {
    "messageId": "<msg@host>",
    "accepted": ["a@b.com"],
    "rejected": ["bad@"]
  },
  "meta": { "durationMs": 180, "deliveryStatus": "sent" },
  "port": "out"
}
```

- 부분 거부는 **success** 로 유지 (Principle 3.1 "예상 가능한 비즈니스 실패"). 분기는 `$node["X"].output.rejected.length > 0` 로 `if_else` 에서 처리.

### After — Case 3: 전체 거부 (운영 판단에 따라 확장)

```json
{
  "config": { "integrationId": "int_smtp_1", "to": ["bad1@", "bad2@"], "cc": [], "subject": "...", "bodyType": "text" },
  "output": {
    "messageId": "<msg@host>",
    "accepted": [],
    "rejected": ["bad1@", "bad2@"]
  },
  "meta": { "durationMs": 120, "deliveryStatus": "rejected_all" },
  "port": "out"
}
```

- `deliveryStatus: 'rejected_all'` 을 **enum 확장** (선택 사항). `accepted.length === 0 && rejected.length > 0` 조건에서 이 값을 사용. 핸들러는 여전히 throw 하지 않음.

### After — Case 4: SMTP 전송 실패 (신규 error 포트)

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": ["a@b.com"],
    "cc": [],
    "subject": "Hello",
    "bodyType": "text"
  },
  "output": {
    "error": {
      "code": "SMTP_SEND_FAILED",
      "message": "Connection timeout to smtp.example.com:587",
      "details": { "cause": "ETIMEDOUT" }
    }
  },
  "meta": { "durationMs": 30001 },
  "port": "error"
}
```

### After — Case 5: 정규화 후 `to` 가 빈 배열 (신규 error 포트)

```json
{
  "config": {
    "integrationId": "int_smtp_1",
    "to": [],
    "cc": [],
    "subject": "Hello",
    "bodyType": "text"
  },
  "output": {
    "error": {
      "code": "EMAIL_NO_RECIPIENTS",
      "message": "No valid recipients after normalizing the 'to' field"
    }
  },
  "meta": { "durationMs": 1 },
  "port": "error"
}
```

- 현재는 throw → 노드 실패. 개선 후에는 error 포트로 라우팅 (사용자가 실시간 입력한 `to` 값을 정규화한 결과 비어있는 **runtime 케이스** 이므로 error 포트가 타당).

### After — Case 6: Integration stub (변경 없음)

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

- `output: null` + `status: 'requires_integration'` 조합은 유지. `meta` / `port` 는 여전히 생략 (엔진 "integration 연결 필요" 표시만).
- 문서에 "`output: null` + `status: 'requires_integration'` 은 container 오버라이트 신호가 아니라 DI 미주입 신호" 를 명시.

### After — Case 7: Pre-flight (throw 경로, 유지)

아래는 여전히 throw (노드 실패):

| 코드 | 원인 |
| --- | --- |
| `INTEGRATION_TYPE_MISMATCH` | `serviceType` 이 `'email'` 아님 |
| `INTEGRATION_NOT_CONNECTED` | integration 상태가 `connected` 아님 |
| `INTEGRATION_INCOMPLETE` | 자격증명 필드 누락 (`host/port/secure/username/password/default_from`) |
| `MISSING_WORKSPACE_CONTEXT` | `context.variables.__workspaceId` 누락 (엔진 설정 문제) |

- 이들은 **사용자가 설정 단계에서 잡아야 할 오류** 이므로 P3.1 의 pre-flight 분류를 유지.

### `output.error.code` enum (신규)

| 코드 | 조건 | 현재 처리 → 개선 후 |
| --- | --- | --- |
| `SMTP_SEND_FAILED` | nodemailer `sendMail` 가 던진 네트워크/인증/대상 서버 오류 | throw → **error 포트** |
| `EMAIL_NO_RECIPIENTS` | `to` 정규화 후 빈 배열 | throw → **error 포트** |
| `SMTP_AUTH_FAILED` | SMTP 535/534 인증 실패 (`SMTP_SEND_FAILED` 의 하위 분류, details 로 구분 가능) | throw → **error 포트** |
| `SMTP_TIMEOUT` | SMTP 커넥션/응답 타임아웃 | throw → **error 포트** |

### Ports 표 개정

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | 참조용 — 핸들러는 직접 소비하지 않음 |
| Output | `out` | Output | `data` | 발송 성공 (부분 거부 포함) |
| Output | `error` | Error | `error` | **신규**. 런타임 전송 실패 (`SMTP_*`, `EMAIL_NO_RECIPIENTS`). pre-flight(`INTEGRATION_*`) 는 throw 유지 |

### `bcc` / `attachments` 구현 결함 (별도 이슈)

- **스코프 밖**: 본 개선안의 shape 정리와는 독립적으로 수행되어야 할 구현 이슈.
- **단기 조치**: `bcc` / `attachments` 를 UI 에서 **비활성화 또는 숨김** 처리하여 silent failure 를 방지.
- **장기 조치**: 핸들러가 nodemailer 호출 시 실제로 `bcc` / `attachments` 를 전달하도록 수정. 전달 후에는 config echo 에도 포함.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output.messageId` | `$node["X"].output.messageId` | No | 성공 경로 유지 |
| `$node["X"].output.accepted` | `$node["X"].output.accepted` | No | 동일 |
| `$node["X"].output.rejected` | `$node["X"].output.rejected` | No | 동일 |
| `$node["X"].meta.durationMs` | `$node["X"].meta.durationMs` | No | 동일 |
| `$node["X"].meta.deliveryStatus` (항상 `'sent'`) | `$node["X"].meta.deliveryStatus` (`'sent'` / `'rejected_all'`) | No (additive) | enum 확장. 기존 `'sent'` 로 분기하던 사용자에게 영향 없음 |
| `$node["X"].status` (`undefined` 또는 `'requires_integration'`) | `$node["X"].status` | No | 동일 |
| `$node["X"].port` (항상 undefined) | `$node["X"].port` (`'out'` / `'error'`) | **Yes (behavior)** | 엔진이 기존에 fallback 으로 처리하던 부분을 핸들러가 명시. 값 자체는 새로 조회 가능 |
| (없음) | `$node["X"].output.error.code` | No (신규) | `SMTP_SEND_FAILED` / `EMAIL_NO_RECIPIENTS` / `SMTP_AUTH_FAILED` / `SMTP_TIMEOUT` |
| (없음) | `$node["X"].output.error.message` | No (신규) | SMTP 원문 메시지 (자격증명 마스킹됨) |
| (없음) | `$node["X"].output.error.details` | No (신규) | 케이스별 스키마 (`cause` 등) |
| SMTP 실패 → 노드 실패 상태, 후속 노드 중단 | SMTP 실패 → `port: 'error'` + `output.error`, 후속 에러 분기 실행 | **Yes (behavior)** | 가장 큰 변경. throw 로 전체 실행을 중단시키던 기존 동작에 의존했다면 **의도치 않게 후속 노드가 실행될 수 있음** — changelog 에 강조 필요 |
| "전송 실패 시 워크플로우 자체 실패 여부 판단" (노드 상태 체크) | `$node["X"].port === 'error'` 로 분기 | **Yes (behavior)** | 기존 워크플로우는 `send_email` 이 "성공 아니면 전체 실패" 가정. 이제는 명시적으로 error 포트로 라우팅해야 실패가 전파됨 |

**권장 전략**:

1. P0: error 포트 신설 + `output.error.{code,message,details?}` 반환. 동시에 엔진 레벨에서 **"error 포트 미연결 노드가 error 를 반환하면 자동으로 워크플로우 실패" 폴백 규칙** 이 있는지 확인 — 없다면 후속 노드가 silent 로 스킵될 위험 있음.
2. P0: 마이그레이션 가이드에 "기존에 `send_email` 실패가 전체 워크플로우를 중단시키던 동작을 유지하려면 `error` 포트를 **어디에도 연결하지 말 것** (엔진 fallback) 또는 명시적인 실패 처리 노드에 연결할 것" 명시.
3. P0: `port: 'out'` 을 성공 경로에서 명시적 반환 — 자동완성/디버깅 경험 개선.
4. P1: `bcc` / `attachments` 구현 결함을 별도 이슈로 트래킹. 단기 UI 숨김 또는 validate reject, 장기 핸들러 실제 지원.
5. P1: `deliveryStatus: 'rejected_all'` 확장은 optional. 적용 시 기존 `'sent'` 소비자는 영향 없음.
6. P2: `status: 'requires_integration'` 경로 문서 강화 — container 오버라이트 신호(`output: null`) 와의 구별을 명확히 기술.

## 5. 근거

- **Principle 3.1 (에러 분류)**: SMTP 전송 실패는 외부 시스템 호출 실패의 전형적 패턴. `http_request`, `database_query` 가 이미 error 포트로 처리하고 있으므로 `send_email` 만 throw 하는 현재 동작은 세 integration 노드 간 **학습 비대칭** 을 만듭니다. 동일 카테고리 노드가 동일한 실패 모델을 가지면 workflow 작성자는 "integration 노드는 `output.error` 를 확인한다" 는 한 가지 규칙만 익히면 됩니다.
- **Principle 3.2 (에러 shape 통일)**: `http_request` / `database_query` / `send_email` 이 모두 `output.error.{code, message, details?}` 를 공유하면 에러 처리 서브그래프(예: 슬랙 알림 노드로 `{code, message}` 전달) 를 노드 종류에 상관없이 재사용할 수 있습니다.
- **Principle 1 vs Principle 3 의 조화**: 부분 거부(`rejected.length > 0`)는 에러가 아닌 **비즈니스 결과** 이므로 success 포트 유지. 이는 P3.1 의 "예상 가능한 비즈니스 실패" 범주로, `if_else` 로 후속 분기를 구성하는 것이 자연스럽습니다.
- **Principle 5 (port 활성화)**: 성공 경로에서 `port: 'out'` 을 명시 반환하는 것은 "port 필드 조회 시 항상 값이 있다" 는 invariant 를 전체 노드에 적용하여 자동완성 신뢰도를 높입니다.
- **운영 관점**: 현재 throw 모델은 "전송 실패 = 워크플로우 전체 실패" 를 강요합니다. 이는 비동기 발송/재시도/대체 채널 같은 현실적 요구사항과 충돌합니다. error 포트가 있으면 워크플로우 작성자가 재시도 루프, 대체 알림(SMS), 로그 기록 등을 자유롭게 구성할 수 있습니다.
- **INCONSISTENCY_MATRIX 축 3**: `send_email` 행은 "throw on fail → error 포트 신설, `output.error`" 로 매핑되어 있으며 본 개선안이 정확히 그 결정을 구현합니다.
- **`bcc` / `attachments` 는 shape 이슈가 아님**: schema-handler 불일치는 구현 결함이므로 본 문서에서는 **flag 만 올리고** 별도 이슈로 이관. shape 결정은 "실제로 전송되는 필드만 `config` 에 echo" 원칙으로 자연히 정리됨 (Principle 7).
