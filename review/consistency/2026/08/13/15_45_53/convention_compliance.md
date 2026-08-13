# 정식 규약 준수 검토 — spec-draft-eia-notification-payload-contract.md

검토 모드: spec draft 검토 (`--spec`)
target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

## 발견사항

- **[CRITICAL]** `cancelledBy` 누락 캐비엇이 WS §4.1 에는 반영되지 않는다 — draft 자신의 "실측" 증거와 모순
  - target 위치: target 문서 §3 (`### 3. §6.5 execution.cancelled`, L111-116) 및 §4 (`### 4. WS §4.1 — 종결 3행`, L118-121)
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` R3 ("EIA spec §6 의 payload 가 SoT — 두 spec 간 type drift 회피")의 정신 — 동일 wire 를 기술하는 문서 전부가 정합해야 한다는 이 draft 자신의 반복 원칙(§3 캐비엇 문구: "한쪽만 적으면 그쪽이 다시 SoT 와 어긋난다")
  - 상세: `execution.cancelled` 이벤트는 `WebsocketService.emitExecutionEvent` 한 번의 `executionEventSubject.next()` 로 WS wire(`wireEnvelope`)와 internal fanout(`fanoutEnvelope`, NotificationFanout·ChatChannelDispatcher 공용 소스)에 **동일 payload** 를 공급한다(코드: `codebase/backend/src/modules/websocket/websocket.service.ts` L453-507). 즉 draft 의 "실측" 표(target L44: `cancelled (예외) | { status } — cancelledBy 없음 | retry-turn.service.ts failRetryExecution L956`)가 확인한 결함은 EIA §6.5 뿐 아니라 **WS §4.1 이 문서화하는 것과 동일한 wire** 에도 그대로 적용된다. 그런데 draft 의 §3 은 "이 캐비엇은 §6.5 **와** chat-channel-adapter.md §1.2 **양쪽에** 적는다" 고 명시하면서 WS §4.1 을 빠뜨렸고, §4(WS §4.1 처리 지시)는 "cancelled 는 nested 로 정정한다"만 지시할 뿐 `cancelledBy` 누락 caveat 를 언급하지 않는다. 현재 `spec/5-system/6-websocket-protocol.md` L179 는 `cancelledBy` 를 **비-옵셔널** 로 문서화하고 있어(`{ executionId, cancelledBy, duration, error? }`), 이 draft를 그대로 반영하면 WS 소비자는 여전히 실제로는 부재할 수 있는 필드를 항상 있다고 가정하게 된다 — 이 PR 이 고치려는 "외부 계약이 거짓인 상태"(target §왜) 를 세 번째 문서(WS)에 그대로 재생산한다. 이는 이 draft 가 이미 두 차례(`15_15_08`, `15_28_10`) BLOCK:YES 를 받은 것과 동일한 실패 패턴("규칙을 세 곳 중 두 곳에만 적용")이 세 번째로 재발한 사례다.
  - 제안: §4(WS §4.1)에 "`cancelled` 의 `cancelledBy` 는 `retry-turn.service.ts failRetryExecution` L956 경로에서 emit 되지 않는다"는 동일 caveat 를 추가하거나 `cancelledBy` 를 optional 로 표기 — §3·§5 와 3-way 로 동기화. `spec/5-system/6-websocket-protocol.md` 도 (이미 `spec_impact` 에 있으므로) 이 caveat 반영 대상에 명시적으로 포함시킬 것.

- **[WARNING]** `cancelledBy` optional 화 방향이 병행 plan(`retry-turn-terminal-guard.md`)의 목표 상태와 반대
  - target 위치: target 문서 §5 (`### 5. conventions/chat-channel-adapter.md §1.2`, L123-127) 및 후속 목록 마지막 항목(L155)
  - 위반 규약: 직접적인 `spec/conventions/**` 조항은 아니나, `spec/conventions/chat-channel-adapter.md` R3 의 "SoT 정합" 취지와 충돌하는 **의사결정 방향의 비정합**
  - 상세: `plan/in-progress/retry-turn-terminal-guard.md` 는 같은 결함(`failRetryExecution` 의 `cancelledBy` 누락)을 이미 "W1(api_contract)"로 추적 중이며, 통합 목록 항목 #2 는 "`EXECUTION_CANCELLED` payload 에 spec §4.1 **필수** `cancelledBy` 추가(`emitCancellationEvent` 재사용)"를 P2 로 계획한다 — 즉 그 plan 의 목표는 **코드를 spec(필수 `cancelledBy`)에 맞추는 것**이다. 반면 이 draft 의 §5 는 정반대로 **spec 을 코드(optional)에 맞춘다.** target 은 "`failRetryExecution` 의 `cancelledBy` 누락은 retry-turn-terminal-guard.md W1 에서 집행(교차 참조만)"이라고만 적어 두 plan 이 서로 다른 방향으로 움직이고 있다는 점을 조율하지 않는다. `optional` 화가 P2 완료 전까지의 **임시** 표기인지, 아니면 영구 결정인지가 draft 본문에 없다 — P2 가 먼저 머지되면 이 draft 의 spec 변경(optional)이 다시 stale 이 된다.
  - 제안: §5(및 §3)에 "이 optional 표기는 `retry-turn-terminal-guard.md` W1(P2) 이 `cancelledBy` 를 항상 emit 하도록 코드를 고치기 전까지의 임시 상태이며, 그 PR 이 머지되면 required 로 되돌린다"는 한 줄을 명시하거나, 반대로 이번 PR 범위에서 P2 코드 수정을 먼저 흡수해 "optional" 자체를 도입하지 않는 방향을 검토.

- **[INFO]** `chat-channel-adapter.md` R3 "EIA spec 의 payload shape 재사용" 문구가 봉투 도입 후 부정확해질 소지
  - target 위치: target 문서 §0 (`### 0. 봉투 규칙`, L72-96) 및 §5 (L123-127)
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` §1.2 L140 및 R3(L527-529)
  - 상세: `EiaEvent`(chat-channel-adapter.md §1.2)는 `ChatChannelDispatcher` 가 `WebsocketService.executionEvents$` 를 직접 구독해 받는 **in-process bus 페이로드**로, `notification-fanout.service.ts` 가 outbound webhook 전용으로 씌우는 `payload` 봉투(target §0)와는 다른 layer 다(코드 확인: `notification-fanout.service.ts` L123-137 의 `eventBody` 조립은 NotificationFanout 전용 경로). draft 의 §0/§5 는 이 구분을 정확히 반영해 `EiaEvent` 에 `payload` 래퍼를 추가하지 않는데, 이는 코드상 맞다. 다만 §1.2 L140 의 "EIA spec §6 outbound notification payload 의 shape 을 재사용 (drift 회피)"라는 문구는, EIA §6.3~6.5 가 이제 `payload` 로 감싼 wire 를 문서화하게 되면(§0) 더는 문자 그대로 참이 아니게 된다("shape 재사용" ≠ "동일 wire 구조"). R3 가 "drift 회피"를 명시적으로 표방하는 문서이므로, 이 구조적 차이(bus-layer flat vs webhook-layer enveloped)를 §1.2 상단에 한 줄 명시해 두면 향후 편집자가 "EiaEvent 도 payload 로 감싸야 하는가"를 다시 묻는 걸 막을 수 있다.
  - 제안: §5 작업 시 `chat-channel-adapter.md` §1.2 서두에 "`EiaEvent` 는 `executionEvents$` in-process bus 의 payload 를 반영하며, `NotificationFanout` 이 outbound webhook 전용으로 추가하는 `payload` 봉투(EIA §6.1/§0)는 포함하지 않는다"는 명시적 구분 문장을 추가.

## 준수 확인 (양호)

- frontmatter: `spec_impact`(리스트, bare string/빈 배열 아님) · `pending_plans`(리스트, 실존 경로) · `worktree`/`started`/`owner` 3필드 모두 `plan-frontmatter.test.ts`/Gate C 스키마 충족.
- `spec_impact` 4개 파일(`14-external-interaction-api.md` · `6-websocket-protocol.md` · `chat-channel-adapter.md` · `3-execution.md`) 전부가 "무엇을 쓸 것인가" 절 + 체크리스트에 1:1 대응 — 앞선 두 차례 BLOCK:YES 의 "범위 절반" 실패를 이번엔 파일 단위로는 재발하지 않음.
- `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 모두 이미 `status: partial` + `pending_plans` 가 draft 의 `pending_plans`(`spec-sync-*-gaps.md`)와 정확히 일치 — `spec/conventions/spec-impl-evidence.md` §2.1/R-5 (`pending_plans` 역방향 링크 의무) 충족.
- "미구현 (Planned)" 마커는 `spec/conventions/node-cancellation.md`/`audit-actions.md` 등에서 이미 쓰이는 기존 표기 관행과 일치.
- 에러 코드(`EXECUTION_TIMEOUT` 등) UPPER_SNAKE_CASE 유지, 신규 rename 없음 — `spec/conventions/error-codes.md` §1/§2 위반 없음.
- webhook 은 Swagger 로 노출되는 inbound REST 엔드포인트가 아니므로 `spec/conventions/swagger.md` 는 target 범위 밖 — 해당 없음(위반 아님).

## 요약

target 은 plan 문서 구조(frontmatter Gate C, `pending_plans` 역링크, `## Rationale` 종결)와 명명 규약을 잘 지키고, 4개 `spec_impact` 파일을 빠짐없이 다룬다는 점에서 앞선 두 차례 BLOCK:YES 의 교훈("범위를 절반만 잡음")을 파일 단위로는 반영했다. 그러나 같은 실패 패턴이 **필드 단위**로 세 번째 재발했다 — draft 자신이 "실측"으로 확인한 `retry-turn.service.ts failRetryExecution` 의 `cancelledBy` 누락 caveat 를 EIA §6.5·`chat-channel-adapter.md` §1.2 두 곳에는 명시하면서 같은 wire 를 문서화하는 WS §4.1 에는 반영하지 않아, 이번 PR 이 고치려는 "문서화된 필드가 실제와 다르다"는 결함을 WS 표면에 그대로 남긴다. 또한 그 optional 화 결정이 병행 plan(`retry-turn-terminal-guard.md` W1/P2, 코드를 고쳐 `cancelledBy` 를 항상 필수로 만드는 방향)과 반대 방향이라는 점이 draft 본문에서 조율되지 않았다.

## 위험도

HIGH
