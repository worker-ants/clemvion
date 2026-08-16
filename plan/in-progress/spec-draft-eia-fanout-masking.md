---
worktree: eia-masking-followups-3cd512
started: 2026-08-16
owner: project-planner
status: draft
---

# spec draft — WS emit 값-마스킹 + 내부 REST 두 컬럼 (§R17 잔여 ①·② 종결)

구현은 `1b8fd5cc7`·`fe6a54c80` 로 이미 머지 대기 중이고, 본 draft 는 **그 구현이 만든
새 보안 불변식을 spec 에 등재**하는 것이다.

> **인용 블록 안의 링크는 코드 스팬으로 적는다.** 삽입될 텍스트의 `./` 는 `spec/5-system/`
> 기준이라 이 draft 위치(`plan/in-progress/`)에서는 실재하지 않는다 — 살아있는 링크로 두면
> `plan-frontmatter.test.ts` 의 상대링크 가드가 (정당하게) RED 가 된다. 실제로 한 번 잡혔다. 사전 검토 `22_22_36`(`--impl-prep`, BLOCK: NO)
의 WARNING 5건 중 spec 관련 4건을 반영한다.

---

## 변경 1 — `spec/5-system/14-external-interaction-api.md` §R17

### 1-a. 새 카탈로그 불릿 추가 (기존 `execution.failed` 불릿 **뒤**)

표제에 **필드 경로 + 표면**을 명시한다 — 같은 `error` 이름을 쓰는 세 번째 불릿이라
기존 둘과 구분되어야 한다(`22_22_36` naming INFO-3).

> - **`execution.node.*` / 비-종결 `execution.*` emit 의 자유 텍스트 값 (강제됨 — 2026-08-16)**:
>   위 두 `error` 불릿과 **또 다른 층**이다 — 거기는 종결 이벤트의 `Execution.error`(DB 컬럼)이고,
>   여기는 **node-level 이벤트 payload** 의 `error`/`input`/`output` 과 `ai_message` 같은
>   **비-종결** execution 이벤트의 자유 텍스트 필드다. 이 표면에는 값-패턴 방어가 **아예 없었다**.
>   - **왜 새는가**: `sanitizePayloadForWs` 는 **키 이름** 기반이라 문자열 값을 그대로 통과시키고,
>     `stripExternalOnlyFields` 는 `llmCalls` **필드 제거** 전용이다. 종결 이벤트만
>     `toTerminalErrorPayload` 가 막고 있었다. 무수정 프로브로
>     `error: 'Authorization: Bearer eyJ…'` 가 fanout envelope 까지 원문 도달함을 실증했다.
>   - **처방**: `WebsocketService` 의 두 emit(`emitExecutionEvent`·`emitNodeEvent`)이 공유하는
>     초크포인트에서 `deepRedactSecretsPreserving` 로 마스킹한다. `executionEventSubject.next`
>     호출부가 **정확히 둘**이라 한 곳만 고치면 자매가 갈린다 — 두 경로가 같은 문을 지나게 했다.
>   - **wire 에도 건다 (boundary parity)**: `execution:<id>` 구독 인가는 workspace 소유만 보고
>     **role 을 받지 않는다**(`ExecutionChannelAuthorizer`). 수신 인구가 `GET /api/executions/:id`
>     와 **동일**하므로, 위 "내부 읽기 경로" 불릿과 같은 근거로 내부 wire 도 마스킹한다.
>   - **단 `llmCalls` 는 wire 에서 제외**: 에디터 전용 raw 디버그 탈출구다
>     (`[WS §Rationale](./6-websocket-protocol.md)` strip-only 결정). fanout 에서는 필드 자체가
>     제거되므로 외부 노출은 늘지 않는다.
>   - **도달 범위는 총칭이 아니라 열거다**: `execution.node.*` 는 **SSE 구독자**에게 도달한다
>     (`SseAdapter` 는 이벤트 타입 필터가 없다). `execution.node.completed` 만 Chat Channel 이
>     추가 구독하고, **notification webhook 은 `FANOUT_EVENTS` 화이트리스트 밖이라 도달하지 않는다**.

### 1-b. 잔여 목록 ①·② 를 **둘 다** flip (③ 은 유지)

현재 서술(`:1515-1525`)의 ①·② 를 해소 표기로 바꾸고 ③ 만 남긴다. 이 문서 자신이
*"적용 범위는 총칭이 아니라 열거다"* 를 두 번 못박으므로, ② 를 안 뒤집으면 **고쳤는데
문서엔 갭으로 남은 stale 잔여**가 된다(`22_22_36` plan_coherence/rationale W4).

> - **~~잔여 ①~~ 해소(2026-08-16)**: WS `execution.node.*` emit 의 `error` — 위 새 불릿이 닫았다.
> - **~~잔여 ②~~ 해소(2026-08-16)**: `inputData`/`outputData` — 아래 "내부 읽기 경로" 불릿의
>   표면 목록에 두 컬럼이 포함됐다.
> - **잔여 ③ (범위 밖 유지)**: workflow-assistant LLM 도구 — (기존 문구 그대로)

### 1-c. "내부 읽기 경로" 불릿의 표면 열거 갱신

현재 *"`ExecutionsService` 4경로와 `BackgroundRunsService` body 노드까지"* 로 적힌 자리를
**여섯 표면 + 세 컬럼**으로 갱신한다:

> `redactStoredErrorForResponse`(`error`) 와 `redactStoredDataForResponse`
> (`inputData`/`outputData`)를 읽기 표면 **여섯 곳**에 적용한다 — `findById` · `getChain` ·
> `stop` · `toExecutionDto`(목록) · `findById` 의 `nodeExecutions[]` ·
> `BackgroundRunsService.toNodeExecutionDto`(본문 노드). 소스 정본은
> `ExecutionsService.toResponseExecution` 의 표다.

### 1-d. ingestion-time ↔ egress-time 마스킹 철학 상호 참조 (신설)

`22_22_36` rationale INFO-1 + cross_spec W2. §R17 안에 한 문단:

> **언제 가리는가 — 두 철학이 공존한다**: `[12-webhook §5.3](./12-webhook.md#53-민감-헤더-마스킹-ingestion)` 은 민감 헤더를
> **ingestion 시점**에 지우고(`[REDACTED]`), §R17 은 `Execution.error` 등을 **egress 시점**에
> 가린다(원문은 DB 에 보존). 모순이 아니라 **대상이 다르다** — *구조화된 시크릿 전용 필드
> (알려진 헤더 key)* 는 ingestion 이 옳고(검증 후엔 원문을 남길 이유가 없다), *자유 텍스트·
> 진단용 필드* 는 egress 가 옳다(저장 시점에 지우면 사후 디버깅의 진실이 사라진다).
> 두 층은 경쟁하지 않고 **쌓인다**: key-blacklist 가 못 잡는 값-패턴을 egress 층이 덮는다.
>
> **그래서 egress 층은 ingestion 층의 마커를 덮지 않는다.** `deepRedactSecrets` 는 이미
> 마스킹된 값(`[REDACTED]`·`***`·`[REDACTED_DEPTH]`)을 재마스킹하지 않는다 — 덮으면 같은
> 헤더가 `$trigger.headers` 에서는 `[REDACTED]`, 실행 상세 API 에서는 `***` 로 보인다.

---

## 변경 2 — `spec/5-system/6-websocket-protocol.md`

### 2-a. §4.1 `nodeName` → `nodeLabel` 4행 정정 + drift Note 제거

`22_22_36` convention W1. 실측: 엔진 emit 은 전부 `nodeLabel: node.label ?? node.type` 이고
`nodeName` emit 은 코드베이스에 **0건**. `node.cancelled` 행은 이미 `nodeLabel` 이다.
4행 정정과 함께 바로 아래 `> **Note (spec drift)**` 블록을 **삭제**한다(정정됐으므로).

### 2-b. §4.1 표 아래 마스킹 규정 캐비엇 신설

기존 `### 4.4` 절 번호가 중복돼 있어(이미 이연된 결함) 새 절을 만들지 않고 §4.1 표 직후에
캐비엇으로 붙인다(`22_22_36` naming INFO-4):

> **값-패턴 마스킹 (2026-08-16)**: 위 execution/node 이벤트의 payload 는 emit 시점에
> 자격증명 값-패턴이 마스킹된다 — 자유 텍스트 `error`/`message` 안의 `Bearer …`,
> 자격증명 포함 URI 등. **내부 WS wire 와 외부 fanout 양쪽**에 적용되며, 예외는
> `llmCalls`(에디터 전용 raw 디버그, wire 에서만 원문 유지 — fanout 은 필드째 strip).
> 앞선 키-이름 마스킹의 `[REDACTED]` 마커는 덮이지 않는다.
> 근거·범위: `[EIA §R17](./14-external-interaction-api.md)`.

### 2-c. `## Rationale` 의 strip-only 항목에 갱신 노트

기존 *"기각된 대안: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고 부분적이며…"* 바로
아래에 붙인다. **결정을 번복하는 것이 아님을 명시**한다:

> **(2026-08-16 보강)** 이 기각은 *"`llmCalls` 를 값-마스킹으로 **대체**한다"* 에 대한
> 것이었고, 그 근거(에디터 디버깅 가치 훼손)는 지금도 유효하다 — `llmCalls` 는 여전히
> **strip-only** 이고 wire 에서 값-마스킹 대상이 **아니다**. 그와 별개로, `llmCalls` 가
> 아닌 **자유 텍스트 필드**(`error`/`message` 등)에는 값-패턴 마스킹이 **추가**됐다
> (EIA §R17). 즉 이 항목의 결정은 유지되고 적용 대상만 명확해졌다.

---

## 변경 3 — `spec/5-system/12-webhook.md` §5.3 스코프 캐비엇

`22_22_36` cross_spec W2. 현재 §5.3(:319 부근)의 *"`inputData`/`output_data` 를 노출하는
**모든** read 경로가 자동으로 마스킹된다(표면별 개별 마스킹 불필요)"* 문장은 스코프를
명시하지 않아, EIA §R17 이 닫은 자유-텍스트 갭까지 이미 해소된 것처럼 오독된다.

> **스코프는 민감 헤더 key 한정이다** — 이 자동 마스킹은 `sanitizeResponseHeaders` 의
> key-blacklist 가 아는 **헤더 key** 에만 걸린다. body/params 의 자유 텍스트에 박힌
> 자격증명(`Bearer …` 등)은 이 층이 잡지 못하며, 그쪽은 읽기 표면의 egress 값-마스킹
> (`[EIA §R17](./14-external-interaction-api.md)`)이 담당한다. 두 층은 대상이 다르다.

---

## 검토 요청 관점

- ①·② flip 이 §R17 의 "열거" 원칙을 지키는가 (③ 만 남는 것이 맞는가)
- 2-c 가 strip-only 결정의 **번복이 아니라 범위 명확화**로 읽히는가
- 1-d 와 변경 3 이 `12-webhook.md` Rationale 과 충돌 없이 상호 참조되는가
- `nodeName`→`nodeLabel` 정정이 다른 인용처를 깨지 않는가

## Rationale

### 왜 ①·② 를 **둘 다** flip 하나

§R17 은 자기 안에 *"적용 범위는 총칭이 아니라 열거다"* 를 두 번 못박는다 — 이 저장소가
*"자매 넷 중 하나만"* 으로 반복해 겪은 실패를 문서 층에서 막으려는 장치다. 그 원칙을
쓰는 문서에서 **닫힌 항목을 열린 것처럼 남겨 두면** 다음 사람이 이미 해소된 갭을 다시
조사하거나, 반대로 열린 ③ 까지 닫힌 것으로 읽는다. ①·② 는 이 PR 이 실제로 닫았고 ③ 은
안 닫았으므로 **셋의 상태를 각각 정확히** 적는다.

### 왜 wire 까지 마스킹하나 (초안 번복)

초안은 fanout 전용이었다. 근거는 *"내부 wire 는 워크플로 소유자의 콘솔"* 이었는데
`ExecutionChannelAuthorizer` 가 workspace 소유만 검증하고 role 을 받지 않아 **수신 인구가
`GET /api/executions/:id` 와 동일**함이 실측으로 드러났다. §R17 이 같은 인구를 근거로 내부
REST 를 마스킹했으므로, WS 만 예외로 두면 **같은 문서 트리가 같은 인구에 다른 원칙을 쓴다**.

### 왜 strip-only 결정을 번복하지 않는가

WS §Rationale 이 기각한 것은 *"`llmCalls` 를 값-마스킹으로 **대체**한다"* 이고, 기각 근거는
에디터 디버깅 가치 훼손이었다. 본 변경은 `llmCalls` 를 **strip-only 로 그대로 두고**
(wire 에서 값-마스킹 제외) 다른 자유 텍스트 필드에만 값-마스킹을 **추가**한다. 대체가
아니라 병존이므로 기각 결정과 충돌하지 않는다 — 두 층의 역할이 다르다: strip 은 *디버그
전용 필드 자체*를, 값-마스킹은 *어느 필드에든 박힐 수 있는 패턴*을 겨냥한다.

### 왜 ingestion-time 과 egress-time 이 공존해도 되는가

`12-webhook.md` 는 display 시점 마스킹을 기각하고 ingestion 을 택했다. 그 기각 근거
("raw secret 이 DB 에 잔존")는 지금도 유효하지만, **자유 텍스트는 대상 패턴을 사전 특정할
수 없어 ingestion 단계에서 걷어낼 수 없다** — 알려진 헤더 key 를 지우는 것과 임의 문자열
안의 자격증명을 찾는 것은 다른 문제다. 그래서 두 층은 경쟁이 아니라 누적이며, 뒤에 도는
egress 층이 앞선 층의 마커를 **덮지 않게** 하는 것이 그 공존의 조건이다.

### 기각한 대안

- **fanout 전용 유지 + §R17 옆 캐비엇**(`22_22_36` cross_spec 이 제시한 (b)안): wire 예외의
  근거를 새로 세워야 하는데, viewer 포함 전원이 받는 채널을 "별도 신뢰 경계" 로 재정의하는
  것은 RBAC 결정이라 이 작업 범위를 넘고 #1179 와도 어긋난다.
- **`llmCalls` 도 wire 에서 값-마스킹**: strip-only 기각 근거를 그대로 되살리는 셈이라
  기존 결정과 정면 충돌한다.
- **`deepRedactSecrets` 를 마커 무시하도록 두고 `[REDACTED]` → `***` 수용**: spec 4개 문서가
  공유하는 계약을 깨고, 같은 헤더가 읽는 경로마다 달라진다.
