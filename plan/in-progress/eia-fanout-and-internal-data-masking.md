---
worktree: eia-masking-followups-3cd512
started: 2026-08-16
owner: developer
branch: claude/eia-masking-followups-3cd512
status: in-progress
priority: P1
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
spec_impact:
  - spec/1-data-model.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/12-webhook.md
  - spec/5-system/13-replay-rerun.md
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/15-chat-channel.md
  - spec/conventions/node-output.md
---

# 외부 fanout 은 값-패턴 마스킹을 한 번도 받은 적이 없다 — node/execution emit + 내부 REST 두 컬럼

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의 **A**(`:235` WS `execution.node.*` emit 의 `error`)·**B**(`:240`
내부 REST `inputData`/`outputData`)·**D**(`:223` 단일 관문 근거 서술 분산) 세 항목을 집행한다.

**사용자가 2026-08-16 에 택일했다**:

| 항목 | 결정 | 근거 |
|---|---|---|
| A | ~~fanout 브랜치에만~~ → **wire + fanout 둘 다** (`llmCalls` 만 wire 예외) — **2026-08-16 재택일** | 아래 §A + §A-재택일 |
| B | ~~두 컬럼~~ → **`outputData`** + **노드 레벨 `inputData`**. `Execution.inputData` 만 철회(재제출 오염) — **2026-08-17 재택일 2회** | 아래 §B + §마커 + §철회 |
| D | A·B PR 에 묶는다 | 트래커가 이미 "단독으론 게이트 비용이 이익을 넘는다" 로 등재 |

> **표를 세 번 고쳤다.** 초판은 A 를 *"fanout 브랜치에만"*, B 를 *"#1179 와 같은 구조로 두
> 컬럼"* 으로 적었는데 **전부 실측으로 반증됐다**(§A-재택일 · §마커 · §철회). 두 게이트가 이 표의 stale
> 상태를 각각 잡았다(`23_08_19` requirement W3 · `23_10_41` plan_coherence W2) — 결정이
> 뒤집히면 **요약 표가 가장 늦게 낡는다**.

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

### ~~왜 wire 가 아니라 fanout 인가~~ → §A-재택일 (초안의 근거가 반증됐다)

> **초판 주장**: *"`stripExternalOnlyFields` 가 이미 fanout 브랜치에만 걸려 있어
> (`:257`·`:331`) 선례가 있다. 같은 자리에 얹으면 **워크플로 소유자**의 콘솔 디버깅은
> 보존하면서 외부 노출만 닫힌다."*

**선례 부분은 참이지만 "소유자" 부분이 틀렸다.** `ExecutionChannelAuthorizer.authorize` 는
`verifyOwnership(executionId, workspaceId)` 만 호출하고 `ChannelAuthorizerContext` 는 **role
필드를 아예 갖지 않는다**. 즉 `execution:<id>` wire 수신 인구는 "소유자" 가 아니라
**viewer 를 포함한 워크스페이스 멤버 전원** — `GET /api/executions/:id` 와 **같은 인구**이고,
§R17 이 *"안전성은 롤 게이팅이 아니라 boundary masking parity 에 의존"* 이라며 내부 REST 를
마스킹한 바로 그 상황이다. 한쪽만 열어 두면 같은 문서 트리 안에서 선례가 갈린다.

**재택일(2026-08-16): wire + fanout 둘 다 마스킹.** 단 `llmCalls` 는 wire 에서 제외한다 —
그러지 않으면 WS §Rationale 의 strip-only 결정이 *"값-레벨 마스킹은 에디터 디버깅 가치를
훼손한다"* 며 기각한 그 상태가 된다. fanout 에서는 그 필드가 통째로 strip 되므로 외부 노출은
늘지 않는다. 즉 **strip 결정은 유지되고 값-마스킹이 병존**한다.

> 이 반증은 `22_22_36` cross_spec WARNING #1 이 제기했고 소스로 확인했다. 리뷰어 지적을
> 액면가로 받은 것이 아니라 **인가 코드를 직접 읽어** 갈랐다.

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

## §철회 — `inputData` 는 되돌렸다 (게이트가 CRITICAL 로 잡았다)

**`inputData` 는 표시 전용이 아니라 재제출되는 값이다.** 소스로 확증한 경로:

| 단계 | 근거 |
|---|---|
| 상세 페이지 → 모달 `original.inputData` | `page.tsx:471` |
| 모달이 `paramValues` 프리필 | `rerun-modal.tsx:178` |
| `useOriginalInput` 기본값 **`false`** | `rerun-modal.tsx:181` |
| `inputOverride: paramValues` 제출 | `rerun-modal.tsx:284` |
| 백엔드가 그대로 새 실행 입력으로 사용 | `executions.service.ts` re-run 분기 |

마스킹하면 리터럴 `'***'` 가 **새 실행의 실제 입력값**이 된다. 에디터 "히스토리에서
불러오기"(`editor-toolbar.tsx:126`)도 같은 컬럼이다. `23_49_05`(impl-done) cross_spec 과
`23_50_03`(리뷰 2R) side_effect 가 **독립으로 같은 결함**을 냈고, 사용자가 **철회**를 택했다.

**기본 Re-run(`useOriginalInput=true`)은 영향이 없었다** — 서버가 엔티티를 직접 읽는다.
`outputData` 도 무해하다 — 실측상 소비처가 전부 표시 전용이다. 그래서 되돌린 범위는
**`inputData` 하나**로 정확히 좁혔다.

> **교훈**: 이 PR 은 "egress 마스킹" 을 **표시 표면**의 문제로만 봤다. 같은 필드가
> **읽혀서 되쓰이는** 경로가 있으면 마스킹은 가시성이 아니라 **데이터 무결성** 문제가 된다.
> 되돌린 방향은 캐너리로 고정했다(관문을 다시 붙이면 RED).

### 철회의 범위 정정 (2026-08-17, `83436ed45`) — 레벨을 갈랐다

**첫 철회는 너무 넓었다.** 카브아웃 근거는 *"그 값이 되쓰이는가"* 인데 이를 **레벨 구분 없이**
적용해 `NodeExecution.inputData` 까지 비워 뒀다. 그러자 WS emit(마스킹)과 REST(원문)가
**같은 프런트 store 슬롯**(`nodeResults[].inputData`)으로 병합되고 진행 중 실행은 2초
폴링이 돌아 — 화면이 `***` ↔ 원문으로 깜빡이고 wire 마스킹의 보안 이득도 0이 됐다
(`01_17_49` cross_spec CRITICAL, 사용자 가시 결함).

| 값 | 마스킹 | 이유 |
|---|---|---|
| `Execution.inputData` | 안 함 | Re-run 프리필이 읽어 **재제출** |
| `NodeExecution.inputData` | **함** | 재제출 소비처 없음(표시 전용) |
| WS node `input` | 함 | 위와 같은 슬롯 |

**캐너리도 방향을 갈랐다** — `⑧`·`⑧-b`·`①`·`②` 는 Execution 레벨이 원문임을,
`⑤`·`⑥-b`·background-runs 는 노드 레벨이 마스킹됨을 고정한다.

## §부작용 — 디버깅 가시성이 줄어드는 자리 (수용된 trade-off)

**사용자에게 보이는 변화다.** 워크플로가 **정당하게** 자격증명을 다루는 경우
(HTTP 노드가 토큰을 받아 하류로 넘기는 등) 그 값이 이제 `***` 로 보인다:

| 표면 | 종전 | 이후 |
|---|---|---|
| WS/SSE node 이벤트의 `output`/`error` | 원문 | 마스킹 |
| 실행 상세 API 의 `inputData`/`outputData` | 원문 | 마스킹 |
| DB (`Execution.*`) | 원문 | **원문 유지** (egress-only) |

선례가 이미 이 방향을 택했다 — §R17 `ai_message` 불릿이 *"보수적 패턴의 rare FP 로 이미
전달된 응답이 `***` 로 바뀔 수 있으나 **보안 우선**으로 수용"* 이라 못박았고, 외부
`getStatus` 는 같은 `outputData` 에 이미 같은 마스킹을 걸고 있었다(내부만 안 걸려 있었다).

**에디터 탈출구는 `llmCalls` 하나뿐이라 LLM 호출 밖은 덮지 못한다.** 자격증명을 다루는
워크플로의 디버깅 요구가 실제로 관측되면 participant-vs-observer 분리 egress(§R17 이
"후속 개선 여지" 로 남긴 것)를 검토한다 — 지금은 **관측 전이라 착수하지 않는다**.

## §D — 흩어진 것은 문구가 아니라 **수치**다

`executions.service.ts:802` · `background-runs.service.ts:301` · `executions.service.spec.ts:853`
이 각각 *"자매 넷 중 하나만"* 을 언급한다. verbatim 복제는 아니고(공용 관용구), 실제 위험은
**"넷" 이라는 수치**가 세 곳에 흩어진 것이다. 정본을 `toResponseExecution` 에 두고 나머지는
`{@link}` 참조로 바꾼다.

## 작업 체크리스트

- [x] `/consistency-check --impl-prep` (`22_22_36`) — **BLOCK: NO**, CRITICAL 0 · WARNING 5
      전건 반영 (①·② flip · 헬퍼 명명 사전대조 · `nodeName` 정정 · 두 상충 캐비엇)
- [x] 마커 멱등 — `deepRedactSecrets` 가 기존 마스킹 마커를 덮지 않게 (§마커) + 캐너리 4개
- [x] B — webhook `[REDACTED]` 헤더가 읽기 경로를 지나도 보존되는 계약 테스트
- [x] A — 두 emit 이 공유하는 초크포인트(`maskWireEnvelope` → `toFanoutEnvelope`)
      > **사용자 재택일로 wire 도 마스킹**(`llmCalls` 만 예외) — 초안의 "fanout 전용" 근거
      > (*"wire 는 소유자 콘솔"*)가 `ExecutionChannelAuthorizer` 실측으로 반증됐다
- [x] A — 회귀 테스트 7개 (두 emit × wire·fanout 네 조합 + `llmCalls` 보존 + 마커 + 무손상)
- [x] B — 여섯 표면 전부 (`toExecutionDto` · `toResponseExecution` · `nodeExecutions[]` ·
      `BackgroundRunsService`) — 트래커는 한 곳만 지목했었다
- [x] B — 회귀 테스트 **12개** (`executions.service.spec.ts` 의 `outputData` describe 10개 +
      `background-runs.service.spec.ts` 2개). 초안은 8개라 적었는데 철회 라운드에서 캐너리가
      늘었다 — **PR 이 닫히는 시점의 실측**으로 갱신했다(`00_23_57` documentation INFO-18)
- [x] D — 정본 표 1곳(`toResponseExecution`) + 나머지 3곳은 참조로
- [x] 성능 실측 — emit 당 추가 walk 1회의 비용
      > 8턴 `turnDebugHistory` waiting payload, N=3000, 같은 머신 A/B:
      > **strip only `0.0181` → mask+strip `0.0323` ms/emit (+0.0142, 1.78배)**.
      > `stripExternalOnlyFields` JSDoc 이 기록한 옛 실측(0.0112→0.0314, 2.80배)과 **같은 축**
      > 이고 배율은 그보다 작다 — 순회가 2회에서 3회가 된 것이라 선형 증가다.
      > ForEach 5,000 emit 기준 누적 +71ms. 수용한다: 이 표면은 자격증명이 외부 SSE 로
      > 나가던 자리라 비용 대비 이익이 명확하다.
      > 읽기 표면은 컬럼 2개가 늘지만 종결 실행은 `snapshotCache` 로 1회만 계산된다.
- [x] TEST WORKFLOW 4단계 PASS (fix 반영 후 재실행) — lint / unit(백엔드 **427 suites ·
      8,809 tests**) / build / e2e **276**
      > **build 가 유닛이 못 잡은 타입 결함을 두 번 잡았다** — ① 두 컬럼에 관문을 걸자
      > `ResponseExecution`/`ResponseNodeExecution` 이 `| null` 을 거부 ② `maskIfPresent<T>` 의
      > `T` 가 값이 아니라 `mask` 파라미터에서 추론돼 `undefined` 를 흡수. 둘 다 캐스트로
      > 덮었으면 조용히 지나갔을 자리다
      > **plan 링크 가드도 draft 를 잡았다** — 인용 블록의 `./` 링크가 `spec/5-system/` 기준이라
      > `plan/in-progress/` 에서는 깨진다. 코드 스팬으로 교체
- [x] spec — `6-websocket-protocol.md` §4.1 마스킹 캐비엇 + `## Rationale` strip-only 보강
      (**번복이 아니라 병존**임을 명시) + `:184` 자기모순 각주 정정(`23_10_41` naming W3)
- [x] spec — `14-external-interaction-api.md` §R17 emit 카탈로그 불릿 신설 + **잔여 ①·② flip**
      (③ 범위 밖 유지 명시) + 표면 열거를 "여섯 표면·세 컬럼" 으로 갱신
- [x] spec — ingestion-time ↔ egress-time 마스킹 철학 상호 참조 (§R17) +
      `12-webhook.md` §5.3 "민감 헤더 key 한정" 스코프 캐비엇
- [x] spec — `6-websocket-protocol.md` §4.1 의 `nodeName` → `nodeLabel` **4행 정정 + drift
      Note 교체** (`22_22_36` convention W1). **범위 확장이 아니다** — checker 가 *"이번 작업의
      spec 반영 단계에 곁들여 정정"* 을 명시 권고했고 같은 파일을 이미 연다. 실측: 엔진 emit 은
      전부 `nodeLabel: node.label ?? node.type` 이고 `nodeName` emit 은 코드베이스에 0건.
      정정했으므로 트래커 등재는 불요(미구현 `execution.paused` 행만 그대로 두고 사유 명시)
- [x] `/consistency-check --spec` (`23_10_41`) — **BLOCK: NO**, CRITICAL 0 · WARNING 3 전건 반영
      (WS `:184` 자기모순 · plan 표 stale · draft `## Rationale` 부재)
- [x] 코드 동결 → `/ai-review` 1R (`23_08_19`, forced 7 전원) — **CRITICAL 0 · WARNING 8**,
      **8건 전부 조치**(이연 0) → `RESOLUTION.md`
- [x] `--impl-done` 1R (`23_49_05`) — **BLOCK: YES · CRITICAL 1**.
      `inputData` 마스킹이 Re-run 재제출을 오염시킨다는 지적을 소스로 확증 → **§철회**
- [x] `/ai-review` 2R (`23_50_03`, 코드 동결 후) — **CRITICAL 1**(같은 결함 독립 발견) ·
      **WARNING 7**. CRITICAL 은 설계 철회로 해소, WARNING 6건 조치 + 1건 트래커 →
      `RESOLUTION.md`
- [x] `inputData` 철회 + 되돌린 방향 캐너리 고정 + spec·CHANGELOG·유저가이드 동기화
- [x] TEST WORKFLOW 재실행 — lint / unit(백엔드 **427 suites · 8,812 tests**) / build / e2e **276**
- [ ] `--impl-done` 재실행 (철회 반영본)
- [ ] push 게이트 통과 → PR
