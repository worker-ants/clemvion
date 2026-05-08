# Spec: Send Email

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약)

SMTP를 통해 이메일을 발송한다.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | SMTP Integration 참조 |
| to | String[] (표현식) | ✓ | — | 수신자 이메일 목록 |
| cc | String[] | — | [] | 참조 |
| bcc | String[] | — | [] | 숨은 참조 |
| subject | String (표현식) | ✓ | — | 제목 |
| body | String (표현식) | ✓ | — | 본문 |
| bodyType | Enum | — | text | text / html |
| attachments | Attachment[] | — | [] | 첨부 파일 목록 |

**Attachment 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| filename | String | 파일명 |
| content | String (Base64) 또는 URL | 파일 내용 또는 다운로드 URL |

## 2. 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 (success) | `out` | 발송 결과 |
| Output | 출력 (error) | `error` | 전송 실패 — `EMAIL_SEND_FAILED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 등 (CONVENTIONS §3.2) |

## 3. 출력 구조

CONVENTIONS Principle 7 — `config` 는 워크플로 작성자가 입력한 **raw** 설정 (`{{ ... }}` 보존, 사용자가 입력한 string/array 형태 그대로), 평가 결과는 `output.*` 에 둔다. `output.subject` / `output.body` / `output.bodyType` 는 실제로 SMTP 에 보낸 평가된 값. `output.body` 는 256KB cap 이며 초과 시 `output.bodyTruncated: true`.

성공 시:

```json
{
  "config": {
    "integrationId": "…",
    "to": "{{ $input.email }}",
    "cc": [],
    "bcc": [],
    "subject": "Hello {{ $input.name }}",
    "body": "Welcome {{ $input.name }}!",
    "bodyType": "text",
    "attachments": []
  },
  "output": {
    "messageId": "<message-id@smtp.example.com>",
    "accepted": ["alice@example.com"],
    "rejected": [],
    "subject": "Hello Alice",
    "body": "Welcome Alice!",
    "bodyType": "text"
  },
  "meta": { "durationMs": 820, "deliveryStatus": "sent" }
}
```

실패 시 (`port: 'error'` — 본문은 디버깅 용이성을 위해 보존):

```json
{
  "config": { "integrationId": "…", "to": "{{ $input.email }}", "subject": "Hello {{ $input.name }}", "body": "Welcome {{ $input.name }}!", "bodyType": "text" },
  "output": {
    "subject": "Hello Alice",
    "body": "Welcome Alice!",
    "bodyType": "text",
    "error": {
      "code": "INTEGRATION_NOT_CONNECTED",
      "message": "SMTP integration \"Company SMTP\" is in status \"expired\"",
      "details": {
        "to": ["alice@example.com"],
        "subject": "Welcome",
        "integrationCode": "INTEGRATION_NOT_CONNECTED"
      }
    }
  },
  "meta": { "durationMs": 35, "deliveryStatus": "failed" },
  "port": "error"
}
```

> `IntegrationError` 의 원본 코드는 `output.error.code` 로 직접 노출되며 동일한 값이 `output.error.details.integrationCode` 에도 보존된다 (관찰성 대시보드 호환). 순수 SMTP 전송 실패는 `code: 'EMAIL_SEND_FAILED'`.

## 4. 설정 UI

- Integration 선택 드롭다운 (SMTP 타입만 필터)
- To / CC / BCC: 이메일 칩 입력 (표현식 지원)
- Subject 입력
- Body: 텍스트/HTML 탭 전환, HTML 시 리치 에디터 제공
- Attachments: 파일 추가 UI

## 5. Handler 실행 세멘틱

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 동작은 아래와 같다.

**라이브러리**: `nodemailer` — Integration.credentials.{host, port, secure, username, password, default_from} 기반으로 SMTP transport 를 생성한다. 핸들러 인스턴스가 `integrationId + credentials hash` 키로 transport 를 캐시 재사용하며 (TLS 핸드쉐이크 비용 회피), credential 회전 시 stale 인스턴스를 evict 후 재생성한다. 프로세스 종료 시 `shutdown()` 으로 모든 transport 를 close 한다.

**`to`/`cc` 정규화** (`validate()` 통과 후 `execute()`에서 수행):
- 배열 → 각 원소 `trim()` 후 공백 원소 제거
- 문자열 → `","`로 split, 각 토큰 `trim()` 후 공백 제거
- 최종 결과가 비어있으면 "No valid recipients" 오류
- 정규화된 결과는 SMTP 전송에만 사용 — `config` echo 는 raw 형태 (사용자가 입력한 string 또는 array) 를 그대로 보존 (§3)

**SMTP secure 매핑**:
| `credentials.secure` | nodemailer 옵션 |
|----------------------|-----------------|
| `tls` | `secure: true` |
| `starttls` | `secure: false, requireTLS: true` |
| `none` | `secure: false` |

반환 envelope 은 §3 (성공 / 실패 예시) 를 정본으로 한다 — `config` (raw) / `output` (evaluated subject·body·bodyType + nodemailer 결과) / `meta` (durationMs · deliveryStatus) / `port`.

**에러 코드**: 공통 코드 외에 `EMAIL_SEND_FAILED` (nodemailer sendMail 이 throw 한 일반 전송 실패). `IntegrationError` 가 throw 한 경우 (`INTEGRATION_INCOMPLETE`, `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED` 등) 의 코드를 그대로 보존한다.
