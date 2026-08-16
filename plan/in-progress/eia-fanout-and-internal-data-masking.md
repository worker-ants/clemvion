---
worktree: eia-masking-followups-3cd512
started: 2026-08-16
owner: developer
branch: claude/eia-masking-followups-3cd512
status: in-progress
priority: P1
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
---

# 외부 fanout 은 값-패턴 마스킹을 한 번도 받은 적이 없다 — node/execution emit + 내부 REST 두 컬럼

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의 **A**(`:235` WS `execution.node.*` emit 의 `error`)·**B**(`:240`
내부 REST `inputData`/`outputData`)·**D**(`:223` 단일 관문 근거 서술 분산) 세 항목을 집행한다.

**사용자가 2026-08-16 에 택일했다**:

| 항목 | 결정 | 근거 |
|---|---|---|
| A | **fanout 브랜치에만** 값-패턴 마스킹 | 아래 §A |
| B | #1179 와 같은 구조로 닫는다 | 아래 §B |
| D | A·B PR 에 묶는다 | 트래커가 이미 "단독으론 게이트 비용이 이익을 넘는다" 로 등재 |

## §A — 전제를 무수정 프로브로 실증했다

`error` 가 원문이라는 트래커 서술은 **참이고, 범위는 더 넓다.** production 코드 변경 0 상태로
`WebsocketService.emitNodeEvent` 를 직접 호출해 관측한 결과:

```text
=== external fanout envelope ===
"error":  "Upstream rejected: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.LEAKED"
"input":  { "note":  "db=postgres://user:pw@db.internal:5432/prod" }
"output": { "trace": "at Object.<anonymous> (/srv/app/secrets.ts:42:11)" }
"apiKey": "[REDACTED]"          ← 대조군: 키-이름 마스킹은 정상 동작
```

대조군이 `[REDACTED]` 로 나온 것이 이 관측이 **vacuous 가 아님**을 고정한다 — 마스킹 경로는
실제로 돌았고, 자유 텍스트 **값** 안의 자격증명만 통과한다.

새는 이유 (열거한다 — 총칭을 쓰지 않는다):

| 단계 | 위치 | 왜 못 잡나 |
|---|---|---|
| `sanitizePayloadForWs` | `websocket.service.ts:86` | **키 이름** 기반. `typeof value !== 'object'` 면 그대로 반환 → 문자열 `error` 는 무손상 통과 |
| `stripExternalOnlyFields` | `strip-external-only-fields.ts:91` | `llmCalls` **필드 제거 전용**. 값 마스킹 아님 |
| `SseAdapter.handleEvent` | `sse-adapter.service.ts:194` | 이벤트 타입 필터가 **없다** — 전 타입을 버퍼링·push |

즉 node 이벤트는 종결 이벤트(#1177 이 닫은 것)와 **같은 외부 도달 범위**를 갖는다:
SSE 구독자 · `ChatChannelDispatcher` · `NotificationFanout`.

### 자매를 전수로 셌다 — fanout 브랜치는 둘이다

`executionEventSubject.next` 는 **정확히 2곳**(`:265` `emitExecutionEvent`, `:339`
`emitNodeEvent`)이다. 트래커 항목은 node 만 지목했지만 **execution 쪽도 같은 층**이다.
종결 3종은 `toTerminalErrorPayload` 로 이미 마스킹되지만 **비-종결** execution 이벤트
(`ai_message` · `waiting_for_input` 등)는 그 관문을 지나지 않는다.

→ 한 곳만 고치면 이 저장소가 반복해 겪은 *"자매 넷 중 하나만"* 형태가 된다.
**두 fanout 브랜치가 공유하는 단일 헬퍼**를 두어 세 번째 emit 경로가 생겨도 구조적으로
빠질 수 없게 한다.

### 왜 wire 가 아니라 fanout 인가

`stripExternalOnlyFields` 가 **이미 fanout 브랜치에만** 걸려 있다(`:257`·`:331`) —
*"외부는 내부보다 적게 받는다"* 는 비대칭이 이 자리에 선례로 존재한다. 같은 자리에 얹으면
워크플로 소유자의 콘솔 디버깅(원문 에러)은 보존하면서 외부 노출만 닫힌다.

## §B — 트래커가 지목한 것보다 자매가 많다

트래커는 `toExecutionDto`(목록 경로) 한 곳만 지목했다. 실측하면 `toResponseExecution` 이
`...rest` 로 엔티티를 통째 펼치므로(`executions.service.ts:989`) `inputData`/`outputData` 는
**네 표면 전부**(`findById`·`getChain`·`stop`·목록)에 원문으로 실린다. `Execution.error` 때와
글자 그대로 같은 형태다.

> **긴장을 기록한다**: §A 는 "내부 콘솔은 원문 유지" 인데 §B 는 내부 REST 를 마스킹한다.
> 모순이 아니다 — 내부 REST `error` 의 마스킹은 **#1179 에서 이미 결정·머지**됐고, B 는 그
> 결정의 미적용 자매 두 컬럼을 맞추는 것이다. 두 표면의 정책이 갈리는 것 자체가 이 트래커가
> 연 문제였다.

## §마커 — B 는 "#1179 와 같은 구조" 가 아니다 (착수 후 발견, 프로브로 실증)

트래커는 B 를 *"`Execution.error` 와 같은 형태"* 로 등재했다. **틀렸다** — `error` 는 마스킹
마커가 없는 자유 필드지만 `inputData`/`outputData` 는 **이미 문서화된 마커를 담고 있다.**

webhook ingestion 은 민감 헤더를 `[REDACTED]` 로 마스킹해 `Execution.inputData` 에 저장한다
([12-webhook §5.3](../../spec/5-system/12-webhook.md)) — 이건 spec 5곳이 규정한 **계약**이다
(`12-webhook.md:276,317,400` · `1-manual-trigger.md:142` · `5-expression-language.md:240,242` ·
`4-execution-engine.md:766` · `data-flow/10-triggers.md:92`).

무수정 프로브:

```text
deepRedactSecrets({headers:{authorization:'[REDACTED]', cookie:'[REDACTED]', 'content-type':'application/json'}})
→ {headers:{authorization:'***', cookie:'***', 'content-type':'application/json'}}
```

즉 **값-마스커가 앞선 마스커의 마커를 덮는다.** 이건 트래커 §C 가 "결정 항목" 으로 떼어 둔
바로 그 충돌(`****9876` 접미 힌트 vs `***`)과 **같은 형태**이며, C 에만 있는 줄 알았지만
**A·B 양쪽에 다 있다**:

| 표면 | 앞선 마커 | 출처 |
|---|---|---|
| A (WS fanout) | `[REDACTED]` | `sanitizePayloadForWs` 가 fanout 분기 **전에** 건다 |
| B (내부 REST) | `[REDACTED]` | webhook ingestion (§5.3 계약) |

그냥 얹으면 `GET /api/executions/:id` 의 헤더가 `***` 로 바뀌어 **같은 값이 읽는 경로마다 다르게
보인다** — 이 트래커가 없애려는 바로 그 병이 새로 생긴다. 기존 테스트
(`websocket.service.spec.ts:564` `chatChannel.api_key === '[REDACTED]'`)도 RED 가 된다.
**테스트를 내 변경에 맞춰 고치지 않는다.**

### 처방 — 값-마스커를 마커에 대해 멱등하게

`deepRedactSecrets` 의 credential-key 분기가 **이미 마스킹된 값**(`[REDACTED]` · `***` ·
`[REDACTED_DEPTH]`)이면 다시 덮지 않는다. 안전 방향이 한쪽으로만 열린다 — **절대 unmask 하지
않고**, 이미 마스킹된 값을 재마스킹하지 않을 뿐이다(마커 문자열 자체는 시크릿이 아니다).
소비자 5곳(`terminal-error-payload` · `redact-stored-error` · `thread-renderer` ·
`ai-turn-orchestrator` · `interaction.service`) 전부 이 방향으로만 바뀐다.

이 한 처방이 A·B 를 **같은 메커니즘**으로 열어 준다. 마커 보존은 캐너리로 고정한다.

### 신규 식별자 — 기존 패밀리와 사전 대조 (`22_22_36` naming W1)

| 신규 | 역할 | 왜 충돌 아닌가 |
|---|---|---|
| `toFanoutEnvelope` | fanout envelope **조립** (strip → redact → routing 첨부) | 마스커가 아니라 조립 함수라 `redact*`/`strip*`/`sanitize*` 패밀리에 넣지 않는다. 기존 `to*` 조립 패밀리(`toTerminalErrorPayload` · `toResponseExecution` · `toExecutionDto`)와 같은 결. 모듈-로컬 `stripAndRedact`(`interaction.service.ts`)와 **동명 재사용 회피** |
| `redactStoredDataForResponse` | DB `inputData`/`outputData` 컬럼값 egress 마스킹 | 자매 `redactStoredErrorForResponse` 와 **같은 파일·같은 명명 규칙**. `Error`↔`Data` 로 대상 컬럼만 갈린다 |

## §D — 흩어진 것은 문구가 아니라 **수치**다

`executions.service.ts:802` · `background-runs.service.ts:301` · `executions.service.spec.ts:853`
이 각각 *"자매 넷 중 하나만"* 을 언급한다. verbatim 복제는 아니고(공용 관용구), 실제 위험은
**"넷" 이라는 수치**가 세 곳에 흩어진 것이다. 정본을 `toResponseExecution` 에 두고 나머지는
`{@link}` 참조로 바꾼다.

## 작업 체크리스트

- [ ] `/consistency-check --impl-prep`
- [ ] 마커 멱등 — `deepRedactSecrets` 가 기존 마스킹 마커를 덮지 않게 (§마커) + 캐너리
- [ ] B — `Execution.inputData` 의 webhook `[REDACTED]` 헤더가 읽기 경로를 지나도 보존되는
      계약 테스트 (spec 5곳이 규정한 마커)
- [ ] A — 두 fanout 브랜치가 공유하는 단일 헬퍼 + `deepRedactSecrets`
- [ ] A — 회귀 테스트: fanout 은 마스킹 · wire 는 원문 보존(양방향 고정)
- [ ] B — `toExecutionDto` + `toResponseExecution` 두 자리
- [ ] B — 회귀 테스트
- [ ] D — 정본 서술 1곳 + `{@link}` 2곳
- [ ] 성능 실측 기록 (fanout 당 추가 walk 1회)
- [ ] TEST WORKFLOW (lint / unit / build / e2e)
- [ ] spec — `6-websocket-protocol.md` fanout 마스킹 규정 (**strip-only 결정과의 관계**를 명시 — §마커 참조)
- [ ] spec — `14-external-interaction-api.md` §R17 카탈로그 등재 + **잔여 ①·② 둘 다 flip**
      (③ 은 범위 밖 유지임을 명시). `22_22_36` rationale INFO-2 — 이 문서 자신이 *"열거다"* 를
      원칙으로 두므로 ② 를 안 뒤집으면 stale 잔여가 남는다
- [ ] spec — ingestion-time(§5.3 webhook 헤더) ↔ egress-time(§R17) 마스킹 철학의 상호 참조
      한두 문장 (`22_22_36` rationale INFO-1). 아래 §마커 발견이 그 구체적 사례다
- [ ] spec — `6-websocket-protocol.md` §4.1 의 `nodeName` → `nodeLabel` 4행 정정
      (`22_22_36` convention W1). **범위 확장이 아니다** — checker 가 *"이번 작업의 spec 반영
      단계에 곁들여 정정" _을 명시 권고_ 했고 같은 파일을 이미 연다. 실측: 엔진 emit 은 전부
      `nodeLabel: node.label ?? node.type` 이고 `nodeName` emit 은 코드베이스에 0건.
      추적 유실 방지로 `spec-sync-websocket-protocol-gaps.md` 에도 등재
- [ ] `/consistency-check --spec`
- [ ] 코드 동결 → `/ai-review` → 발견 모아서 fix → `RESOLUTION.md`
- [ ] `--impl-done`
- [ ] push 게이트 통과 → PR
