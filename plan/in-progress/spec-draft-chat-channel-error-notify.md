---
worktree: chat-channel-error-notify-6d37ec
draft_for: chat-channel-error-notify.md
status: draft (consistency-check pending)
target_specs:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/chat-channel-adapter.md
  - spec/4-nodes/7-trigger/providers/telegram.md
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
  - spec/5-system/3-error-handling.md
---

# Spec Draft — Chat Channel 실행 실패 안내 (CCH-ERR-*)

본 draft 는 `/consistency-check --spec` 호출 입력. Critical 발견 시 spec 본 반영 차단.

---

## Change 1 — `spec/5-system/15-chat-channel.md`

### 1a. §3.4 (신뢰성 / 보안) 표 아래 새 절 §3.5 (현 §3.5 비기능을 §3.6 으로 밀어냄)

> 위치: 현재 line 92 ~ 99 의 `#### 3.5 비기능 요구사항` 직전. 신설 §3.5 삽입, 기존 §3.5 (비기능) 는 §3.6 으로 renumber. 표 ID 자체 (`CCH-NF-*`) 는 불변.

```markdown
#### 3.5 실행 실패 사용자 안내 (CCH-ERR-*)

`execution.failed` 이벤트 (EIA §6.4) 수신 시, 어댑터가 channel 사용자에게 generic 안내 메시지를 1건 발송한다. 분류 알고리즘과 입력 화이트리스트는 [`conventions/chat-channel-adapter.md §3.1`](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 단일 진실.

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-ERR-01 | `execution.failed` 수신 시 어댑터가 분류 알고리즘 결과 (`key`, `placeholders`) 로 `languageHints[key]` 를 lookup → placeholders 치환 → `text` ChannelMessage 1건 sendMessage. `languageHints[key]` 미설정 시 [`§4.1`](#41-triggerconfigchatchannel) 의 default 한국어 문구 사용 | 필수 |
| CCH-ERR-02 | 분류 입력 화이트리스트 — `error.code` (EIA §6.4 enum) + `error.details.statusCode` (정수, optional) 2 필드만 분류 결정에 사용. `error.message` 원문·`nodeId`·`details` 의 다른 필드·`workflowId`·`executionId` 는 분류 입력으로 사용 금지 | 필수 |
| CCH-ERR-03 | 민감정보 노출 금지 — `error.message` 원문, `details.url` / `details.endpoint` / `details.query` / `details.stack` / `nodeId` / `executionId` / `workflowId` 는 channel 메시지 본문·로그(`level=info` 이상)·metric 어디에도 포함하지 않는다. i18n template 의 허용 placeholder 는 `{statusCode}` 1종 (정수, PII/secret 아님) | 필수 |
| CCH-ERR-04 | 분류 표에 없는 `error.code` (unknown) 또는 `error.code === null` 는 `executionFailedInternal` key 로 fallback. silently swallow 금지 — backend 로그 (`level=warn`, structured `{ kind: "chat_channel_unknown_failure_code", code, hasDetails: boolean }`) 발사 후 generic 안내 발송 | 필수 |
| CCH-ERR-05 | 안내 메시지 발송도 [CCH-SE-01](#34-신뢰성--보안) 의 5초 timeout + 3회 지수 백오프 정책 적용. 최종 실패 시 silent log (사용자가 받지 못한 안내는 추가 안내로 보완 시도 금지 — 무한 retry 방지). `chat_channel_health` 갱신은 CCH-SE-01 의 일반 정책 그대로 적용 (안내 발송 실패도 외부 API 실패의 하나이므로 health=degraded 갱신 대상) | 권장 |

본 절은 **execution 의 실패 안내** 정책으로, [CCH-SE-01](#34-신뢰성--보안) 의 **어댑터 자체 외부 API 호출 실패** (sendMessage retry 소진 등) 와 의미 분리된다. 두 정책의 sink 자원이 다르다: 전자는 `output.error.code` (실행 엔진 / 노드 핸들러 결과), 후자는 `chat_channel_health` (어댑터 외부 호출 status). (Rationale R-CC-15 (d) 참조.)
```

### 1b. §3.1 시퀀스 다이어그램 갱신

> 위치: line 137 ~ 142 의 `├─ execution.failed` 박스 옆. ASCII 다이어그램 안에 1 박스 추가.

기존:
```
                                  ├─ execution.waiting_for_input
                                  ├─ execution.ai_message
                                  ├─ execution.completed
                                  ├─ execution.failed
                                  └─ execution.cancelled
```

신:
```
                                  ├─ execution.waiting_for_input
                                  ├─ execution.ai_message
                                  ├─ execution.completed
                                  ├─ execution.failed  ──▶  classifyExecutionFailure()
                                  │                         (Convention §3.1 — pure helper)
                                  │                         │
                                  │                         ▼
                                  │                   languageHints[key] + {statusCode} 치환
                                  │                         │
                                  │                         ▼ (이하 일반 renderNode → sendMessage 경로와 동일)
                                  └─ execution.cancelled
```

### 1c. §4.1 `languageHints` 객체 확장

> 위치: line 194 ~ 201 의 `"languageHints": { ... }` 블록.

기존:
```jsonc
    "languageHints": {                          // 봇이 보내는 자체 안내 메시지 i18n
      "groupChatRefusal":      "이 봇은 1:1 대화만 지원합니다.",
      "executionStarted":      "워크플로우를 시작합니다…",
      "executionCompleted":    "워크플로우가 완료되었습니다.",
      "executionStillRunning": "워크플로우가 처리 중입니다. 잠시만 기다려 주세요.",  // CCH-CV-03 의 running 케이스 안내 default
      "help":                  "사용 가능한 명령: /start, /cancel, /help"            // §7 명령 처리의 /help default
    }
```

신:
```jsonc
    "languageHints": {                          // 봇이 보내는 자체 안내 메시지 i18n
      "groupChatRefusal":              "이 봇은 1:1 대화만 지원합니다.",
      "executionStarted":              "워크플로우를 시작합니다…",
      "executionCompleted":            "워크플로우가 완료되었습니다.",
      "executionStillRunning":         "워크플로우가 처리 중입니다. 잠시만 기다려 주세요.",  // CCH-CV-03 의 running 케이스 안내 default
      "help":                          "사용 가능한 명령: /start, /cancel, /help",          // §7 명령 처리의 /help default
      // 실행 실패 안내 (CCH-ERR-01 / §3.5) — 분류 알고리즘 (Convention §3.1) 결과의 key. 미설정 시 본 default.
      "executionFailedThirdParty4xx":  "외부 서비스 요청이 거부되었습니다 ({statusCode}). 잠시 후 다시 시도해 주세요.",
      "executionFailedThirdParty5xx":  "외부 서비스에 일시적인 문제가 발생했습니다 ({statusCode}). 잠시 후 다시 시도해 주세요.",
      "executionFailedThirdParty":     "외부 서비스 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "executionFailedTimeout":        "처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
      "executionFailedRateLimit":      "요청량이 많아 잠시 후 다시 시도해 주세요.",
      "executionFailedInternal":       "서비스에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
    }
```

placeholder 정책: `{statusCode}` 1종만 허용 (CCH-ERR-03). 그 외 `{...}` 는 read-time 에 어댑터가 인식하지 못하고 그대로 발송 → 사용자가 raw template 을 보게 될 위험 → 백엔드 validator 가 등록 시점에 reject. (validator 동작은 본 spec 범위 밖 — DTO 검증 구현 사항.)

### 1d. §5.5 (Inbound HTTP Contract) 의 "어댑터 내부 에러" 행에 cross-link 한 줄

> 위치: line 363 의 표 row.

기존:
```
| 어댑터 내부 에러 (sendMessage 실패 등) | `202 Accepted` | `{ ignored: true }` 또는 `{ executionId }` (실패 단계에 따라) | 백그라운드 처리, `chat_channel_health='degraded'` 갱신 |
```

신:
```
| 어댑터 내부 에러 (sendMessage 실패 등) | `202 Accepted` | `{ ignored: true }` 또는 `{ executionId }` (실패 단계에 따라) | 백그라운드 처리, `chat_channel_health='degraded'` 갱신. 본 행의 정책은 **어댑터 외부 API 호출 실패** 영역 — execution 자체의 실패 안내 정책은 [§3.5 CCH-ERR-*](#35-실행-실패-사용자-안내-cch-err-) 참조 |
```

### 1e. Rationale 신규 R-CC-15

> 위치: 파일 끝 (line 605 이후). R-CC-14 다음에 추가.

```markdown
### R-CC-15. Execution Failed 안내 — 분류 입력 화이트리스트 + placeholder 1종 정책 (2026-05-25)

대안:
1. **(채택) `error.code` enum + `details.statusCode` 2 필드만 분류 입력 + `{statusCode}` 1 placeholder**: 사용자에게 노출되는 데이터의 채널 = 분류 결정 + 메시지 본문 두 갈래 모두 명시적 화이트리스트. 분류 결정이 enum 이므로 코드 수준 정적 검증 가능 (`switch` 문 exhaustive check 가능). placeholder `{statusCode}` 는 정수라 secret/PII 아님 (HTTP status code 자체는 공개 정보).
2. **(기각) `error.message` 원문을 사용자 안내에 포함**: 일부 노드 핸들러가 `error.message` 에 URL · query · DB 컬럼명 · stack 일부 · API key 일부를 흘릴 가능성 존재 (대표 사례: `HTTP_TRANSPORT_FAILED` 의 `message: "ENOTFOUND api.internal.example.com"` — 내부 인프라 노출). spec 차원에서 redact 가이드를 강제하려면 모든 노드 핸들러의 message 필드를 audit 해야 — 비현실적.
3. **(기각) `nodeId` / `nodeName` placeholder 추가**: 사용자가 노드 이름을 알면 디버깅에 도움이 될 수 있으나, 노드 이름은 워크플로우 작성자가 임의로 정의한 internal label — 외부 chat 사용자에게는 의미 불명 + 워크플로우 구조 노출 위험.
4. **(기각) `executionId` / `traceCode` placeholder 추가**: support 문의 시 운영자가 traceback 가능한 식별자가 유용. v1 에서는 채택 안 함 — (a) executionId 는 UUID 로 사용자가 입력하기 부담스러움, (b) traceCode (8자리 short hash 등) 도입은 별 자원 (mapping table) 필요. 후속 plan 으로 검토.

근거: 안내 메시지의 **유틸리티 가치** (사용자가 "왜 실패했는지" 대략 짐작) 보다 **민감정보 누출 위험** 이 압도적. v1 은 카테고리별 generic + statusCode 만으로 충분 — 사용자가 더 자세한 정보를 원하면 워크플로우 운영자에게 문의 (운영자는 backend 로그에서 executionId / error.message 원문 접근 가능).

세부:
- (a) **분류 입력 enum 의 SoT** = [`spec/5-system/3-error-handling.md §1.4 / §3.2`](./3-error-handling.md#14-워크플로우-실행-에러) 의 `ErrorCode` enum. 본 spec 은 카테고리 매핑 규칙만 (Convention §3.1) — enum 자체는 그쪽이 단일 진실.
- (b) **unknown code fallback** 은 `executionFailedInternal`. silent swallow 금지 (CCH-ERR-04) 이유 = 운영 중 새 노드 카테고리 추가 시 missing case 를 backend 로그에서 즉시 감지 가능해야 한다. silent skip 시 enum 확장이 누락된 채 long-term drift 발생.
- (c) **placeholder 정책** = `{statusCode}` 1종. unknown placeholder 가 raw 형태 (`{nodeId}` 등) 로 사용자에게 노출되지 않도록 DTO validator 가 등록 시점에 reject. 미허용 placeholder 가 발견되면 `400 VALIDATION_ERROR (details.field='languageHints.executionFailed*', code='UNKNOWN_PLACEHOLDER')`.
- (d) **`chat_channel_health` 와의 의미 분리**: `chat_channel_health=degraded` 는 어댑터의 외부 API 호출 (sendMessage 등) 실패 신호 (CCH-SE-01). 본 spec 의 실패 안내는 **execution 자체의 실패** (`output.error.code` — LLM API / HTTP 노드 / 사용자 코드 실패) 안내. 두 자원이 직교적이므로 발송 자체는 `chat_channel_health` 와 무관. 단 안내 sendMessage 호출이 5초 timeout 후 retry 도 실패하면 CCH-SE-01 의 일반 정책에 따라 health=degraded 갱신 — 이건 안내 발송 메커니즘 자체의 외부 호출 실패라 정합.
- (e) **MCP 도구 호출 실패 카테고리 반영 시점**: 본 spec 작성 시점 (2026-05-25) `3-error-handling.md §1.4` 의 enum 에 MCP 전용 코드 (`MCP_TOOL_CALL_FAILED` 등) 미정의. MCP 노드가 별 코드 enum 을 추가하면 Convention §3.1 의 분류 표에 행 추가 + 신규 i18n 키 검토. 본 spec 의 §3.5 CCH-ERR-02 화이트리스트 ({code, statusCode}) 는 그대로 유효 (MCP 도구도 HTTP-like statusCode 가 있으면 같은 placeholder 활용 가능).
```

---

## Change 2 — `spec/conventions/chat-channel-adapter.md`

### 2a. §3 매핑 표 `execution.failed` 행 격상

> 위치: line 240.

기존:
```
| `execution.failed` | `error.message` | `text` 1건 — 에러 안내 (사용자에게 안전한 형태로 redact) |
```

신:
```
| `execution.failed` | `error.code` + `error.details.statusCode` (다른 필드 사용 금지) | `text` 1건 — 분류 helper [§3.1](#31-execution-failed-분류-알고리즘) 결과 `(key, placeholders)` → `languageHints[key]` lookup + placeholder 치환. [Spec Chat Channel §3.5 CCH-ERR-*](../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 가 시스템 의무 SoT |
```

### 2b. §3 끝에 신규 §3.1 신설

> 위치: line 243 (§3 표 종료) 와 §4 (Form 다단계) 사이.

```markdown
### 3.1 Execution Failed 분류 알고리즘

`execution.failed` 이벤트를 사용자 안내 메시지로 변환하기 전, **provider-invariant pure function** 이 `(key, placeholders)` 를 결정한다. 어댑터 (`renderNode`) 는 본 helper 결과로 [Spec Chat Channel §4.1 `languageHints`](../5-system/15-chat-channel.md#41-triggerconfigchatchannel) 의 i18n template 을 lookup·치환하여 `text` ChannelMessage 1건을 합성한다.

```typescript
interface ExecutionFailureClass {
  /** languageHints lookup key — Spec Chat Channel §4.1 의 6 키 중 1개. */
  key:
    | "executionFailedThirdParty4xx"
    | "executionFailedThirdParty5xx"
    | "executionFailedThirdParty"
    | "executionFailedTimeout"
    | "executionFailedRateLimit"
    | "executionFailedInternal";
  /** i18n template placeholder 치환값. 화이트리스트 = `{statusCode}` 1종 (정수). */
  placeholders: { statusCode?: number };
}

/**
 * Pure function. Side-effect free. Provider-invariant.
 * 입력 화이트리스트 (CCH-ERR-02): `event.error.code` + `event.error.details?.statusCode` 만.
 */
function classifyExecutionFailure(event: Extract<EiaEvent, { type: "execution.failed" }>): ExecutionFailureClass;
```

**카테고리 매핑** (`error.code` enum 의 SoT 는 [`spec/5-system/3-error-handling.md §1.4 / §3.2`](../5-system/3-error-handling.md#14-워크플로우-실행-에러)):

| `error.code` | 추가 조건 | 결과 `key` | placeholders |
|---|---|---|---|
| `HTTP_4XX` | `details.statusCode` ∈ [400, 499] (있으면) | `executionFailedThirdParty4xx` | `{ statusCode }` (없으면 omit) |
| `HTTP_5XX` | `details.statusCode` ∈ [500, 599] (있으면) | `executionFailedThirdParty5xx` | `{ statusCode }` (없으면 omit) |
| `HTTP_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `HTTP_TRANSPORT_FAILED` | — | `executionFailedThirdParty` | `{}` |
| `LLM_RATE_LIMIT` | — | `executionFailedRateLimit` | `{}` |
| `LLM_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `LLM_CALL_FAILED` · `LLM_RESPONSE_INVALID` · `MAX_COLLECTION_RETRIES_EXCEEDED` | — | `executionFailedThirdParty` | `{}` |
| `EMAIL_SEND_FAILED` | — | `executionFailedThirdParty` | `{}` |
| `EXECUTION_TIMEOUT` (engine) · `CODE_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `CODE_EXECUTION_FAILED` · `SUB_WORKFLOW_FAILED` · `DB_*` · `RECURSION_DEPTH_EXCEEDED` · `MAX_ITERATIONS_EXCEEDED` · `CYCLE_DETECTED` · `INVALID_EXPRESSION` · `VARIABLE_NOT_FOUND` · `TYPE_MISMATCH` · `ERROR_PORT_FALLBACK` | — | `executionFailedInternal` | `{}` |
| 그 외 모든 code (`error.code === null` 포함) | unknown — fallback | `executionFailedInternal` | `{}` (+ backend `warn` 로그 CCH-ERR-04) |

**`statusCode` placeholder omit 규칙**: `details.statusCode` 가 missing 이거나 정수가 아닌 경우, `4xx`/`5xx` 분기 자체는 `error.code` (`HTTP_4XX`/`HTTP_5XX`) 만으로 결정한다 (HTTP 노드 핸들러는 `error.code` 와 `details.statusCode` 를 일관되게 set 한다고 가정 — 노드 핸들러 계약). placeholder 가 omit 되면 어댑터는 template 의 `{statusCode}` 토큰을 `"?"` 로 치환 (또는 `({statusCode})` 괄호 segment 전체 제거 — 어댑터 자유). 사용자 영향 ≈ 0.

**위치**: 본 helper 는 `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 한 파일로 구현. 어댑터별 호출만 (provider-specific 분기 없음).
```

### 2c. Rationale 신규 R5

> 위치: 파일 line 327 부근 (현 `## Rationale` 의 R4 다음).

```markdown
### R5. Execution Failed 분류 helper 를 Convention 에 두는 이유 (2026-05-25)

대안:
1. **(채택) Convention §3.1 의 pure helper**: cross-provider 공통 알고리즘 — Form 다단계 시퀀스 (§4) 와 같은 layer. 어댑터별 중복 구현 회피. 분류 알고리즘 자체는 provider 와 무관 (input = EIA payload, output = i18n key + placeholders, 둘 다 provider invariant).
2. **(기각) 어댑터 인터페이스에 `renderError(event)` 신설**: 6함수 인터페이스 (§1) drift 발생 — 새 함수 추가는 모든 provider 어댑터의 contract 변경. 분류 자체가 provider invariant 이므로 함수 분리 이득 없음.
3. **(기각) Spec `15-chat-channel.md` 본문에 알고리즘 표 인라인**: Spec 본문은 요구사항·시스템 동작·EIA 관계 중심. 알고리즘 상세 (입력 타입 / fallback 규칙 / placeholder 정책) 는 형식 규약 — Convention 거주가 더 자연스러움. 본 분리는 cafe24 의 [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) (형식 규약) ↔ [`4-nodes/4-integration/4-cafe24.md`](../4-nodes/4-integration/4-cafe24.md) (시스템·노드 정의) 의 분리 패턴과 동일.

세부:
- (a) **`renderNode` 시그니처는 미변경** — 본 helper 결과는 어댑터 안에서 `renderNode` 가 직접 호출해 lookup·치환 후 `text` ChannelMessage 합성. dispatcher 가 분류 helper 와 renderNode 를 외부에서 chain 하지 않음 (provider 별 mrkdwn / MarkdownV2 / plain 텍스트 차이가 어댑터 안에서 흡수되어야 하므로).
- (b) **provider 별 텍스트 합성 차이** 는 각 `providers/<name>.md §5.6` 의 SoT. 분류 결과 (key + placeholders) 자체는 provider 무관.
```

### 2d. Changelog 한 줄

> 위치: 파일 끝 Changelog 테이블.

추가 행:
```
| 2026-05-25 | §3 매핑 표 `execution.failed` 행 격상 (분류 helper §3.1 결과 → `text` 1건). §3.1 "Execution Failed 분류 알고리즘" 신설 — pure function `classifyExecutionFailure` + 카테고리 매핑 표 + `{statusCode}` placeholder 규약 + unknown fallback. Rationale R5 추가. 6함수 인터페이스 / 기타 데이터 타입 변경 없음. [`spec/5-system/15-chat-channel.md §3.5 CCH-ERR-*`](../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 동반 갱신. chat-channel-error-notify. |
```

---

## Change 3 — `spec/4-nodes/7-trigger/providers/telegram.md`

### 3a. §5 끝에 §5.6 신설

> 위치: §5.4 (line 135-155) 다음, §6 (line 156) 직전. (Telegram §5 는 §5.5 typing 이 없음 — §5.4 다음 바로 §6.)

```markdown
### 5.6 Execution Failed (CCH-ERR-*)

`execution.failed` 이벤트는 [Convention §3.1](../../../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 의 `classifyExecutionFailure(event)` 가 결정한 `(key, placeholders)` 를 어댑터가 lookup·치환하여 단일 `sendMessage` (plain text) 로 발송한다.

| 항목 | Telegram 매핑 |
|---|---|
| API 호출 | `POST /bot{token}/sendMessage` (1회) — chunked 미적용 (안내 메시지는 한 줄) |
| 본문 | `text` = `languageHints[key]` 의 `{statusCode}` 치환 결과. **MarkdownV2 escape 적용** (R4 동일 — `_*[]()~``>#+-=|{}.!` 모두 backslash escape). `parse_mode: "MarkdownV2"` |
| `reply_markup` | 미부여 (`inline_keyboard` 등 인터랙션 컨트롤 없음 — terminal event) |
| `reply_to_message_id` | 미부여 (1:1 DM 가정) |
| ack | `answerCallbackQuery` 무관 (callback 이 아님) |
| timeout / retry | [CCH-SE-01](../../../5-system/15-chat-channel.md#34-신뢰성--보안) 동일 — 5초 timeout + 3회 지수 백오프. 최종 실패 시 `chat_channel_health=degraded` |

민감정보 strip — [CCH-ERR-03](../../../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 그대로. 본 §5.6 은 매핑 구체만 명시.
```

---

## Change 4 — `spec/4-nodes/7-trigger/providers/slack.md`

### 4a. §5 끝에 §5.6 신설

> 위치: §5.5 (typing, line 197-206) 다음, §6 (line 207) 직전.

```markdown
### 5.6 Execution Failed (CCH-ERR-*)

`execution.failed` 이벤트는 [Convention §3.1](../../../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 의 `classifyExecutionFailure(event)` 가 결정한 `(key, placeholders)` 를 어댑터가 lookup·치환하여 단일 `chat.postMessage` (plain text) 로 발송한다.

| 항목 | Slack 매핑 |
|---|---|
| API 호출 | `POST https://slack.com/api/chat.postMessage` (1회) |
| 본문 | `text` = `languageHints[key]` 의 `{statusCode}` 치환 결과. **mrkdwn 무사용** (`<>*_~` 등 mrkdwn 문법 회피, plain text). `blocks` 미부여 |
| `thread_ts` | 미부여 (1:1 DM 가정 — R-S-4 의 DM only) |
| `channel` | conversation 의 `channel_id` (기존 `chat.postMessage` 매핑과 동일) |
| timeout / retry | [CCH-SE-01](../../../5-system/15-chat-channel.md#34-신뢰성--보안) 동일 |

민감정보 strip — [CCH-ERR-03](../../../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 그대로.
```

---

## Change 5 — `spec/4-nodes/7-trigger/providers/discord.md`

### 5a. §5 끝에 §5.6 신설

> 위치: §5.5 (typing, line 218-223) 다음, §6 (line 224) 직전.

```markdown
### 5.6 Execution Failed (CCH-ERR-*)

`execution.failed` 이벤트는 [Convention §3.1](../../../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 의 `classifyExecutionFailure(event)` 가 결정한 `(key, placeholders)` 를 어댑터가 lookup·치환하여 단일 `POST /channels/{id}/messages` (plain text) 로 발송한다.

| 항목 | Discord 매핑 |
|---|---|
| API 호출 | `POST https://discord.com/api/v10/channels/{channel_id}/messages` (1회) |
| 본문 | `content` = `languageHints[key]` 의 `{statusCode}` 치환 결과. **plain text** (`**__~~` 등 markdown 회피). `embeds` 미부여 |
| `components` | 미부여 (button / select 등 인터랙션 컨트롤 없음 — terminal event) |
| `message_reference` | 미부여 (DM only — R-D-4) |
| Interactions Webhook ack | 무관 (본 발송은 `MESSAGE_CREATE` 가 아니라 server-initiated push — Interactions Webhook 3초 ack 시한 규약과 별개) |
| timeout / retry | [CCH-SE-01](../../../5-system/15-chat-channel.md#34-신뢰성--보안) 동일 |

민감정보 strip — [CCH-ERR-03](../../../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 그대로.
```

---

## Change 6 — `spec/5-system/3-error-handling.md`

### 6a. §1.4 표 아래 cross-link 한 줄

> 위치: 현 line 73 의 "구 에러 코드 `NODE_EXECUTION_FAILED` ..." note 직후 (line 73 ~ 74 사이).

추가 라인:
```
> Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다 — 분류 표 SoT 는 [`spec/conventions/chat-channel-adapter.md §3.1`](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘). 본 enum 확장 (예: MCP 도구 카테고리) 시 분류 표 행 추가 검토 의무.
```

---

## 영향 요약

| 파일 | 신규 ID | 신규 섹션 | Rationale 추가 |
|---|---|---|---|
| `spec/5-system/15-chat-channel.md` | CCH-ERR-01 ~ 05 (5개) | §3.5 (renumber 기존 §3.5 → §3.6) | R-CC-15 |
| `spec/conventions/chat-channel-adapter.md` | — | §3.1 + Changelog 1행 | R5 |
| `spec/4-nodes/7-trigger/providers/telegram.md` | — | §5.6 | — |
| `spec/4-nodes/7-trigger/providers/slack.md` | — | §5.6 | — |
| `spec/4-nodes/7-trigger/providers/discord.md` | — | §5.6 | — |
| `spec/5-system/3-error-handling.md` | — | §1.4 cross-link 1줄 | — |

## consistency-check 의 위험 신호 사전 점검

| 위험 | 분석 |
|---|---|
| Naming collision (CCH-ERR-*) | 신규 prefix — 기존 `CCH-{AD,CV,MP,SE,NF}-*` 와 충돌 없음 |
| Naming collision (i18n 키 6개) | 기존 `executionStarted` / `executionCompleted` / `executionStillRunning` 와 동일 패턴. `execution` prefix 충돌 없음 |
| Cross-spec drift — `3-error-handling.md` enum SoT | 본 draft 는 cross-link 만 추가, enum 정의 자체는 변경 없음. drift 위험 없음 |
| Cross-spec drift — `data-model.md §2.8` chat_channel_* 컬럼 | 본 draft 는 컬럼 변경 없음. `chat_channel_health` 의미는 R-CC-15 (d) 에 의미 분리만 명시 |
| Cross-spec drift — `12-webhook.md` 응답 정책 | §5.5 의 "어댑터 내부 에러" 행 cross-link 만 추가, 응답 정책 자체 미변경 |
| Convention §1.1 (6함수 책임) 변경 | 6함수 시그니처 미변경 — `renderNode` 의 책임 안에서 분류 helper 호출. drift 없음 |
| Rationale 재도입 위험 (R-CC-* prefix) | R-CC-15 는 신규 결정. 기존 R1~R-CC-14 / R-K 의 결정 재도입 없음 |
| Plan coherence | `plan/in-progress/chat-channel-*` 6개 plan 과 영역 겹침 검토:<br>- `chat-channel-discord-gateway` / `chat-channel-slack-socket-mode` — provider 별 inbound 경로 확장, 본 작업의 outbound `execution.failed` 와 무관<br>- `chat-channel-form-native-modal` — Form §5.3 의 UI 변경, 본 작업의 §5.6 신설과 무관<br>- `chat-channel-visual-ssr-png` — §5.4 (carousel/chart/table) 시각 렌더 v2, 본 작업과 무관<br>- `chat-channel-secret-store-infra` — secret store ref 마이그레이션, 본 작업과 무관<br>- `chat-channel-outbound-still-broken` — outbound EIA shape 변환 회귀 (PR #319 의 fix), 본 작업의 `execution.failed` 경로와 별 path. 단 PR #319 가 outbound shape 의 단일 변환 위치를 정한 직후라 본 draft 의 `execution.failed` 처리도 같은 변환 layer 를 따라야 — 이는 구현 단계 (developer) 의 책임이며 spec 본 draft 와는 무관. **단일 confirm 필요** |
| User-guide 동반 갱신 (PROJECT.md 매트릭스) | `chatChannel.languageHints` 가 user-guide 페이지에서 노출되는지 별 확인 — 본 draft 가 spec 만 변경이므로 user-guide-sync-reviewer 는 `/ai-review` 단계에서 자동 점검 |
| Convention §7 "변경 관리" 의무 (15-chat-channel + providers 3개 동시 갱신) | 본 draft 는 5 spec 파일 동시 갱신 — Convention §7 의무 충족 (4 파일 + error-handling cross-link 1) |

`/consistency-check --spec` 의 5-agent (cross-spec / rationale-continuity / convention-compliance / plan-coherence / naming-collision) 가 위 위험 신호를 정밀 검증할 예정. 본 사전 점검은 휴리스틱 — 실제 BLOCK 판단은 sub-agent.
