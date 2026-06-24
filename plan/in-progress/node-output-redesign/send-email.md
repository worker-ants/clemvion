# Send Email output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: 핸들러 분할 없음(단일 `send-email.handler.ts` 유지) — 단 2026-06-03 이후 dry-run 분기(`isDryRun`/`buildDryRunMock`, §5.5)·SSRF host 가드(`EMAIL_HOST_BLOCKED`)·abort 사전체크가 추가되어 **모든 라인 인용이 +40~60줄 시프트**. §7·§8 의 stale `파일:라인` 을 현재값으로 전수 정정(예: 정상 return `:174-186`→`:217-229`, 에러 return `:217-232`→`:261-276`, DI stub `:115-126`→`:140-151`, `to.length===0` throw `:111-113`→`:124-126`). §8 미해결 3건은 **전부 잔여**: ① `EMAIL_NO_RECIPIENTS` throw→runtime port 이동 미구현(spec 도 §5.3 footnote line 226 에서 "Planned 갭"으로 명시), ② 정상 분기 `port:'out'` 명시 echo 미적용(handler `:217-229` 여전히 미반환), ③ 부분 거부(`rejected.length>0`) 회귀 테스트 부재(spec mock `:51` 은 `rejected: []` 만). 해소 0건. spec 본문은 cfffc135(#440)·c5218211(#452) 로 갱신되어 갭들을 "Planned"로 정식 문서화함.

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. evaluated `subject`/`body`/`bodyType` (Principle 7 — config raw 와 직교) + `output.error.details.to` 마스킹 + DI stub (`status: 'requires_integration'`) 유지. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/4-integration/3-send-email.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/4-integration/3-send-email.md:101-124` — §5.1 정상 발송 (port `out`):

```json
{
  "config": { "integrationId": ..., "to": ["{{ $input.email }}"], "cc": [], "bcc": [], "subject": "Hello {{ $input.name }}", "body": "Welcome {{ $input.name }}!", "bodyType": "text", "attachments": [] },
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

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/integration/send-email/{send-email.handler.ts, send-email.schema.ts, send-email.handler.spec.ts, send-email.schema.spec.ts}` + `codebase/backend/src/nodes/core/error-codes.ts` (maskEmailForErrorDetails / truncateForErrorDetails).

1. **spec §5 ↔ handler return 정합성** (2026-06-25: dry-run/SSRF/abort 추가로 라인 시프트, 인용 정정):
   - 정상 (`send-email.handler.ts:217-229`): `{ config: configEcho, output: { messageId, accepted, rejected, subject, body: cappedBody.value, bodyType, ...(truncated ? { bodyTruncated: true } : {}) }, meta: { durationMs, deliveryStatus: 'sent' } }`. **`port` 미반환** — schema 의 `port: z.enum(['out', 'error']).optional()` (`send-email.schema.ts:96`) 와 정합 (default 단일 success 포트). spec §5.1 의 `"port": "out"` 은 명시했지만 handler 는 미반환 → 엔진이 default 포트로 라우팅. spec 의 의도 부합.
   - 에러 (`:261-276`): `{ config: configEcho, output: { subject, body, bodyType, bodyTruncated?, error: { code, message, details: { to, subject, integrationCode? } } }, meta: { durationMs, deliveryStatus: 'failed' }, port: 'error' }`. spec §5.3 정확 일치.
   - DI stub (`:140-151`): `{ config: configEcho, output: { subject, body, bodyType, bodyTruncated? }, status: 'requires_integration' }`. **`port`/`meta` 미반환** — spec §5.4 정확 일치.
   - dry-run (`:132-138`, 2026-06-03 이후 신규): `isDryRun(context)` 시 `output: buildDryRunMock('send_email', { to, subject })` + `meta: { deliveryStatus: 'sent' }`. `port` 미반환(default `out`). spec §5.5 와 정합 — body cap(step 3) 직후·DI stub(step 5) 이전 위치.

2. **schema ↔ spec config 정합성**: `sendEmailNodeConfigSchema` (`send-email.schema.ts:101-196`) 의 모든 필드 (integrationId/to/cc/bcc/subject/body/bodyType/attachments) + `attachmentSchema` (`:15-32`, `filename/content/contentType/encoding/cid` — **path/href 의도적 제외**). spec §1 표와 일치.

3. **validate 일관성** (`send-email.handler.ts:57-77`): SSOT (`evaluateMetadataBlockingErrors` + `validateSendEmailConfig` 의 recipient **array-only** 강제 — 2026-05-19 정준화, spec §8.1) + subject/body string 가드 + `bodyType` enum 가드. spec §5.8 와 정확히 일치.

4. **에러 컨트랙트 (Principle 3)** — **핵심** (2026-06-25: 라인 인용 정정):
   - **Pre-flight throw** — `to.length === 0` (`:124-126`) 만 throw 로 남음 (spec §5.3 footnote line 226 의 `EMAIL_NO_RECIPIENTS` 개선안 후보 — runtime `port:'error'` 로 이동 권고. **여전히 미구현 — STILL PENDING**, spec 도 "Planned 갭"으로 명시).
   - **Runtime `port:'error'`** — try/catch 안에서 `IntegrationError` instanceof 분기로 `code` 채택, fallback `EMAIL_SEND_FAILED` (`:248-249`). `details.integrationCode` 가 `IntegrationError` 케이스에서만 동봉 (`:257-259`) — spec §5.3 표 정확 일치.
   - **`details.to` / `details.subject` 마스킹/truncate** (`:253-256`): `maskEmailForErrorDetails(to)` + `truncateForErrorDetails(subject, 200)` 적용. spec §5.3 표 부합. `core/error-codes.ts` 의 헬퍼 재사용.
   - **`safeMessage`** (`:339-344`): `sanitizeMessage`(toLogError) 재사용해 password/Bearer/긴 토큰 마스킹. spec §6 footnote 부합.
   - **SSRF host 가드** (`:179-184`, 2026-06-03 이후 신규): `isSmtpHostBlocked(credentials.host)` 시 `IntegrationError('EMAIL_HOST_BLOCKED')` → §5.3 라우팅. spec §4 step 7 + §5.3 표(line 218 영역)와 정합.
   - **Integration stub** (`:140-151`): `port` 미반환 + `status: 'requires_integration'` — spec §5.4 정확 일치. `to.length === 0` throw 가 stub 분기보다 **위** (`:124-126` < `:140`) — `to` 미정상일 때 stub 도착 전 throw 한다 (정합한 순서). (참고: 2026-06-03 이후 dry-run 분기 `:132-138` 가 throw 와 stub **사이**에 삽입됨.)

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config` 에 raw `to/cc/bcc/subject/body/attachments`, `output` 에 evaluated `subject/body/bodyType` + nodemailer 결과 — 직교 부합.
   - Principle 2: `meta = { durationMs, deliveryStatus }` — `deliveryStatus` 는 큐 진입 신호 (실행 메트릭). spec 부합.
   - Principle 7: `configEcho` 가 explicit picking (`:109-118`, `rawConfig` 우선 + `?? config` 단위테스트 fallback) — DB 와 동일 패턴. 자격증명 미echo (`integrationId` 만).
   - Principle 8.2: `output.messageId/accepted/rejected/subject/body/bodyType` — spec 표 정확 일치.

6. **handler 테스트 (`send-email.handler.spec.ts`, 776+ 줄 — 2026-06-03 이후 SSRF/dry-run/abort 테스트 추가로 증가, 라인 인용 정정)**:
   - validate (`:58-190`): to 의 array/expression-in-array/empty array 케이스 + raw string reject 케이스 (2026-05-19 array-only 정준화), cc/bcc 의 optional (undefined / 빈 배열) + 잘못된 타입(string·number) reject.
   - DI stub (`:192-215`): `status: 'requires_integration'` 반환, `config.to` 의 raw echo 검증 (Principle 7).
   - 정상 발송 (`:249-310`): from/to/cc 정확 전달, deliveryStatus='sent', logUsage success, transporter 캐싱 + shutdown. **공유 mock 의 `rejected: []` (`:51`) 만 사용 — 부분 거부 케이스 미커버 (§8 잔여 item 3).**
   - SSRF 가드 (`:312-348`, 신규), bcc / 빈 cc/bcc 회귀 (`:350-388`), HTML 분기 (`:390-411`), raw config echo (`:412-447` — `{{ $input.email }}` 등 보존), attachments 전달 (`:448-476`) + disableFileAccess/disableUrlAccess 검증, attachments path/href strip (`:494-520` 보안), 256KB cap + bodyTruncated (`:521-546`).
   - Runtime error 포트 (`:547-589`): SMTP reject → `EMAIL_SEND_FAILED`, evaluated subject/body 보존, logUsage failed.
   - Integration 에러 분기 (`:590-695`): TYPE_MISMATCH / NOT_CONNECTED / INCOMPLETE 각각 `details.integrationCode` 정확. 워크스페이스 컨텍스트 누락 (`:696-715`).
   - dry-run mock (`:716-757`, 신규) + abort 사전체크 (`:776+`, 신규).

7. **횡단 일관성 (Integration 4종)**:
   - Send Email 은 `IntegrationError` 를 try 블록 **안**에서 catch 하여 `port:'error'` 로 라우팅 (`:160-277`) — DB / Cafe24 와 동일 패턴. HTTP 만 throw 유지 (auth='none' 가능성 때문).
   - `details.integrationCode` 동봉 패턴은 Email 노드 고유 (Cafe24 는 `details.mallId`, DB 는 `details.driverCode`). Principle 3.2 의 `details` 가 노드별 schema 라는 spec 명시 부합.
   - `truncateBodyForOutput` (256KB cap) 공유: HTTP `requestBody` + Email `body`. DB 는 미적용 (`output.rows` 자체가 user-bounded 쿼리 결과).
   - `port: 'out'` (Email) vs `port: 'success'` (HTTP/DB/Cafe24) — spec 의 의도된 비대칭 (단일 success 포트 인 Email 은 관용적 `out` label).

8. **구현 품질** (2026-06-25: 라인 인용 정정):
   - Transporter 캐시 (`:46-49, :307-336`): `integrationId + credsHash` 키로 재사용. credential 회전 시 stale close.
   - `disableFileAccess: true` + `disableUrlAccess: true` (`:203-204`) — sendMail 옵션 보안 강제. `mapAttachmentsForNodemailer` (`:409-437`) 가 allow-list (filename/content/contentType/encoding/cid) 만 통과시키고 path/href 등을 제거 — 다중 방어선.
   - normalizeRecipients (`:364-378`): array-only 처리 (2026-05-19 정준화, spec §8.1) — 배열 원소 trim+빈문자 제거. 비-배열 입력은 defensive `[]` + `logger.warn` (zod + validator 가 standard path 에서 이미 reject, legacy 데이터 safety net). spec §4 step 2 와 정합.
   - `logUsage` 항상 `.catch(() => {})` (`:216, :241`) — B-5-6 의 "DB 다운 시 노드 실행 깨지 않기".

## 종합 개선안 (2026-05-16)

- [ ] (spec, 선택 P1) `to.length === 0` (정규화 결과 빈 배열) 케이스를 throw → runtime `port:'error'` + `code: 'EMAIL_NO_RECIPIENTS'` 로 이동. 표현식 평가 결과의 빈 배열이라 의미상 runtime 실패. 근거: `send-email.handler.ts:124-126` (여전히 try 블록 밖 plain `Error` throw — 미구현), spec `3-send-email.md:226` footnote (이미 개선 후보 + "현재 미surface Planned 갭"으로 명시). — STILL PENDING (2026-06-25 재검증).
- [ ] (impl, 선택) `port: 'out'` 을 정상 분기에서 명시적으로 반환할지 검토 — 현재 `port` 미반환이지만 spec §5.1 의 JSON 예시는 `"port": "out"` 을 포함. schema default 동작 vs 명시 echo 정합성. 근거: `send-email.handler.ts:217-229` (여전히 `port` 미반환), `send-email.schema.ts:96` (`port: z.enum(['out','error']).optional()`), `3-send-email.md:134`. — STILL PENDING (2026-06-25 재검증).
- [ ] (test, 선택) **부분 거부** (`rejected.length > 0`) 회귀 테스트 추가 — spec footnote (`3-send-email.md:155`) 는 부분 거부가 success 분기로 흐른다고 명시하나 단위 테스트 부재. nodemailer mock 의 `rejected: ['x@y.com']` 시 `port` 부재 + `meta.deliveryStatus='sent'` 검증. 근거: `send-email.handler.spec.ts:249-310` (정상 발송 테스트), 공유 mock `:51` 은 현재 `rejected: []` 만. — STILL PENDING (2026-06-25 재검증).
