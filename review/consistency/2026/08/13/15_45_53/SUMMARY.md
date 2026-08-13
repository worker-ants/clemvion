# Consistency Check 통합 보고서

**BLOCK: YES** — `convention_compliance` checker 가 CRITICAL 1건을 보고했다 (target 자신의 반복 원칙·이전 두 차례 반려 사유와 동일 계열의 재발).

## 전체 위험도
**HIGH** — target 이 실측으로 확인한 `cancelledBy` 누락 결함을 EIA §6.5·`chat-channel-adapter.md` 두 곳에는 caveat/optional 로 반영하면서, 같은 wire 를 문서화하는 WS §4.1 에는 반영하지 않았다. 이는 이 draft 가 이미 두 차례(`15_15_08`, `15_28_10`) BLOCK: YES 를 받았던 "규칙을 일부 절에만 적용" 실패 패턴이 **필드 단위로 세 번째 재발**한 것이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `cancelledBy` 누락 caveat 가 EIA §6.5·`chat-channel-adapter.md` §1.2 에는 명시되지만 WS §4.1 에는 반영되지 않음 — draft 자신의 "실측" 표(`retry-turn.service.ts failRetryExecution` L956, `{status}` 뿐)와 모순되는 상태를 3번째 spec_impact 파일에 그대로 남김 | target §3 (`### 3. §6.5 execution.cancelled`, L111-116), §4 (`### 4. WS §4.1 — 종결 3행`, L118-121) | `spec/5-system/6-websocket-protocol.md` L179 (`{executionId, cancelledBy, duration, error?}` — `cancelledBy` 비-옵셔널로 문서화), 실제 코드 `WebsocketService.emitExecutionEvent`(websocket.service.ts L453-507)가 WS wire 와 internal fanout 에 **동일 payload** 공급 | §4(WS §4.1)에 "`cancelledBy` 는 `failRetryExecution`(L956) 경로에서 emit 되지 않는다"는 동일 caveat 추가 또는 `cancelledBy` 를 optional 로 표기해 §3·§5 와 3-way 동기화. `spec_impact` 의 WS 파일 갱신 대상에 이 caveat 를 명시적으로 포함시킬 것 |

## planner 인계 (권한 밖 Critical)

> 해당 없음. 위 CRITICAL 은 project-planner 자신이 작성 중인 spec draft(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`) 본문의 누락이며, `spec/` 반영 전 단계에서 draft 자체를 수정하면 해소되는 항목이다 — developer 턴에서 발견된 권한 밖 spec drift 사례가 아니므로 인계 대상이 아니다.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §6.2 기존 SSE wire caveat(WS "caveat 오너십 분리" 선례로 확립, `node.id`/`context.buttonConfig` 등 현재 비-`payload`-nested 경로 기준 매핑)가 신규 `payload` 봉투 도입으로 stale 해지는데 갱신 대상으로 명시 안 됨 | 계획 §0 "봉투 규칙" 마지막 문장 | `spec/5-system/14-external-interaction-api.md` §6.2 "SSE 스트림 wire 형태 주의" (현재 캐노니컬 JSON 기준 매핑 표) | §0 또는 §6.2 항목에 "SSE caveat 매핑 표 좌변 경로를 `payload.` 프리픽스로 동반 갱신(또는 두 채널의 unwrap 여부 명시)"을 체크리스트에 추가 |
| 2 | rationale_continuity | §6.5 를 수정 대상으로 지정하면서, 같은 섹션이 서술하는 `execution.ai_message`(비목표)의 기존 "payload 키 없이 flat wrap" 서술이 신규 §0 "항상 payload 로 감싼다" 규칙과 문자 그대로 모순되는 상태로 공존하게 됨 | 계획 §3 (`execution.cancelled` 결정, §6.5 수정 대상 지정) | `spec/5-system/14-external-interaction-api.md` §6.5 `execution.ai_message` 서술("표준 envelope 만 추가로 wrap") vs 실제 코드(`notification-fanout.service.ts` `FANOUT_EVENTS`, `payload: event.payload` 로 감싸 발송) | `execution.ai_message` 를 명시적 비목표로 별도 이월하거나, §6.5 에 그 서술이 §0 규칙과 다른 이유(범위 제외)를 캐비엇으로 명시 |
| 3 | convention_compliance | `cancelledBy` optional 화 방향이 병행 plan(`retry-turn-terminal-guard.md`)의 목표(코드를 고쳐 항상 필수로 emit)와 정반대이며, 이 optional 표기가 임시인지 영구인지 draft 본문에 없음 | target §5 (`### 5. conventions/chat-channel-adapter.md §1.2`, L123-127), 후속 목록 마지막 항목(L155) | `plan/in-progress/retry-turn-terminal-guard.md` 통합 목록 `#2`(P2, 미완료) — "`EXECUTION_CANCELLED` payload 에 필수 `cancelledBy` 추가" | §5(및 §3)에 "이 optional 표기는 W1/#2 완료 전까지의 임시 상태이며 그 PR 머지 후 required 로 되돌린다"는 한 줄 명시, 또는 이번 범위에서 #2 를 먼저 흡수하는 방안 검토 |
| 4 | naming_collision | `retry-turn-terminal-guard.md` 교차 참조가 그 문서 안에서 **최소 6곳 이상** 재사용된 라운드-한정 라벨 `W1`을 인용 — 내용 대조 결과 의도한 대상(`#2`)은 정확히 맞으나 표기가 모호함. 그 문서 스스로 "라운드마다 재등재돼 고유 14건이 20개로 흩어졌다"며 안정적 단일 목록(`#1~#19`)을 별도로 마련해 둔 상태 | 체크리스트 항목(line 178), 본문 line 137-139 | `plan/in-progress/retry-turn-terminal-guard.md` L120/L272/L329/L437/L490/L573/L653/L676 등 `W1` 재사용 다수 | `W1` 대신 `retry-turn-terminal-guard.md #2`(우선순위 목록 항목 번호) 또는 `5R W1`처럼 라운드 명시 |
| 5 | naming_collision | 신규 `payload` 봉투 구조(§0)가 `chat-channel-adapter.md` 의 `EiaEvent` union 타입(flat 필드 선언)에는 반영 지시가 없어, 같은 이름 `EiaEvent` 가 두 문서에서 서로 다른 실제 shape(nested payload vs flat)를 가리킬 위험 | §0 "봉투 규칙"(line 101-119), §5(line 146-150, "필드 3종만" 지시) | `spec/conventions/chat-channel-adapter.md` §1.2 (L138-150) `EiaEvent` union — flat 필드 선언, R3(L527-531) "EIA §6 SoT, drift 회피" | §5 실행 지시에 "`EiaEvent` 3 variant 도 §0 의 `payload` 봉투로 재구조화"를 필드 optional화와 별개 항목으로 명시 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `chat-channel-adapter.md` §5 캐비엇 문구가 "`result.cancelledBy` 도 optional"이라 쓰는데, 실측하면 `failRetryExecution` 경로는 `result` 필드 **자체**를 emit 하지 않음(필드 누락이 아니라 객체 통째 부재). `result?: {...}` 로 선언하면 실무 영향은 없음 | target §5 | §1.2 갱신 시 `result?: { cancelledBy: ... }` (result 전체 optional)로 표현을 실제 emit 형태와 맞춤 |
| 2 | rationale_continuity | target 이 (정당하게) WS 의 "caveat 우선" 선례 대신 R16 "코드가 SoT" 선례를 따라 캐노니컬 JSON 자체를 rewrite 하는데, 이 구분을 Rationale 이 스스로 설명하지 않아 향후 "왜 caveat 선례를 안 따랐나"로 재반려될 위험 | target `## Rationale` | "왜 caveat 이 아니라 rewrite 를 택했는가" 한 문단 추가(두 선례가 다른 종류 문제를 다룬다는 요지) |
| 3 | convention_compliance | `chat-channel-adapter.md` R3 "EIA spec payload shape 재사용" 문구가, EIA §6.3~6.5 가 `payload` 로 감싼 wire 를 문서화하게 되면 문자 그대로는 부정확해질 소지(`EiaEvent` 는 in-process bus flat payload, notification-fanout 은 webhook 전용 enveloped payload — 다른 layer) | target §0/§5 | §5 작업 시 `chat-channel-adapter.md` §1.2 서두에 두 layer 구분 문장 추가 |
| 4 | naming_collision | 실제 spec 삽입 시 봉투 절 번호를 "### 0."으로 붙이면 `spec/` 전체에 선례 없는 `X.0` 서브섹션 패턴이 됨(형제 절은 항상 `.1`부터 시작) | target "### 0. 봉투 규칙" | 실제 삽입 시 `### 6.0 봉투 규칙` 또는 6.1을 봉투로 삼고 나머지를 6.2~6.7 로 한 칸씩 미는 방안 |
| 5 | plan_coherence | `retry-turn-terminal-guard.md` #2 가 나중에 구현되면, 이 draft 가 만든 `cancelledBy` optional 표기(§6.5, `chat-channel-adapter.md §1.2`)를 되돌리는 후속 spec draft 가 한 번 더 필요함 | `## 후속 (developer)` 마지막 항목 | `retry-turn-terminal-guard.md` `#2` 항목 설명에 "완료 시 EIA §6.5 optional 표기 되돌릴 것" 한 줄 추가(비차단) |
| 6 | plan_coherence | `pending_plans` 2건(spec-sync-*-gaps.md)에 이 payload 계약 관련 Planned 항목이 아직 미등재이나, target 자신의 체크리스트에 잔여 작업으로 이미 반영돼 있어 누락이 아님 | frontmatter `pending_plans`, `## 체크리스트` | 조치 불필요 — 재검토 통과 전 자연 처리 예정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec_impact 4파일 범위는 grep 기준 완전, 인용 코드 라인 실측 일치. `chat-channel-adapter.md` §5 캐비엇 문구 정밀도만 INFO |
| rationale_continuity | MEDIUM | §6.2 SSE caveat·§6.5 `execution.ai_message` 서술이 신규 `payload` 봉투 규칙과 충돌 위험(WARNING 2건) — 동일 계열 결함의 잠재적 3번째 재발 |
| convention_compliance | HIGH | `cancelledBy` caveat 가 WS §4.1 에 미반영(CRITICAL) + optional 화 방향이 병행 plan 목표와 반대(WARNING) |
| plan_coherence | NONE | `plan/in-progress/**` 전량 대조 결과 CRITICAL/WARNING 없음, 교차 참조 전부 정확 |
| naming_collision | LOW | 신규 식별자 충돌은 없으나 `W1` 라벨 모호 참조·`EiaEvent` payload 봉투 미반영 지시(WARNING 2건) |

## 권장 조치사항
1. **(BLOCK 해소)** target §4(WS §4.1)에 `cancelledBy` 누락 caveat 추가 또는 optional 표기, `spec_impact` 갱신 대상에 명시 포함 — §3·§4·§5 3-way 동기화
2. §0/§6.2 에 SSE wire caveat 매핑 표를 `payload.` 프리픽스로 동반 갱신하는 체크리스트 항목 추가
3. §6.5 `execution.ai_message` 서술을 명시적 비목표로 이월하거나, §0 규칙과의 불일치 이유를 캐비엇으로 명시
4. `cancelledBy` optional 화가 `retry-turn-terminal-guard.md` #2(P2) 완료 전까지의 임시 상태임을 명시(또는 #2 를 먼저 흡수)
5. `retry-turn-terminal-guard.md` 교차 참조를 `W1` 대신 `#2`(우선순위 목록 항목 번호)로 명확화
6. §5 실행 지시에 `EiaEvent` 3 variant 의 `payload` 봉투 재구조화를 명시적으로 추가
7. (INFO 항목들) `result?: {...}` 표현 정밀화, Rationale 에 caveat-vs-rewrite 선례 구분 문단 추가, R3 layer 구분 문장 추가, 실삽입 시 절 번호를 `6.0` 계열로 정렬
---

## 이 라운드 처분 (main Claude) — **반복을 멈추고 구조를 본다**

**3차 연속 BLOCK: YES.** 세 라운드가 찾은 CRITICAL 은 매번 **같은 규칙의 새 적용처**였다:

| 라운드 | 놓친 적용처 |
|---|---|
| `15_15_08` | WS §4.1 을 `cancelled` 행만 · `chat-channel-adapter.md` 누락 |
| `15_28_10` | `payload` 봉투를 §6.3 에만 |
| `15_45_53` | `cancelledBy` 캐비엇을 §6.5·adapter 에만 (WS §4.1 누락) |

세 번 다 "내가 또 절반만 잡았다" 로 읽었고 그때마다 그 자리를 메웠다. **그 진단이 얕았다.**

### 진짜 원인 — 계약이 4곳에 *재서술*돼 있다

`cancelledBy` 하나가 `14-external-interaction-api.md`(3회) · `6-websocket-protocol.md`(1회) ·
`conventions/chat-channel-adapter.md`(2회) 에 **각자 필드를 열거**하는 형태로 존재한다.
`3-workflow-editor/3-execution.md §8.1` 까지 세면 넷이다.

이 구조에서는 **어떤 변경도 N번 손으로 적용해야** 하고, 한 번이라도 빠뜨리면 그 자리가 즉시
새 drift 가 된다. 내가 세 라운드 동안 겪은 것이 정확히 그것이다 — 그리고 이번 라운드
WARNING 들(§6.2 SSE caveat 매핑, §6.5 `ai_message` flat 서술, `EiaEvent` 봉투 미반영)은
**아직 안 건드린 재서술 지점이 더 있다**는 뜻이다.

### 이 세션이 이미 답을 만들었다

[`spec/conventions/redis-keys.md`](../../../spec/conventions/redis-keys.md) — "인벤토리는
**포인터만** 갖는다. 한 표에 상세까지 모으면 그 표가 곧 두 번째 SoT 가 된다."
Redis 키에 적용한 그 원칙을 **종결 이벤트 payload 에는 아무도 적용하지 않았다.**

그래서 남은 선택은 "한 번 더 동기화" 가 아니라:

- **(A) N곳 동기화** — 이번 draft 의 현재 방향. 4곳을 손으로 맞춘다. 맞추는 순간은 정합하지만
  **구조는 그대로**라 다음 변경에서 같은 일이 반복된다. 라운드 3회가 그 비용의 실측치다.
- **(B) SoT 단일화** — EIA §6 을 **유일한 규범 shape** 으로 두고, WS §4.1 ·
  `chat-channel-adapter.md` §1.2 · `3-workflow-editor §8.1` 은 **필드 열거를 버리고 포인터**로
  바꾼다. 작업량은 (A)보다 크지만 **N-places 문제 자체가 사라진다.**

**(B) 를 권한다.** 근거는 (A)를 세 라운드 시도한 실측이다 — 매번 한 곳을 더 찾았고, 이번
WARNING 들이 아직 더 있다고 가리킨다. 다만 (B)는 이 draft 가 승인받은 범위("계약을 실제에
맞춘다")보다 **넓다** — 문서 아키텍처 변경이다. 그래서 임의로 확장하지 않고 사용자에게 묻는다.

**진행 중지 지점**: 이 draft 는 `--spec` 미통과 상태로 남는다. spec 파일은 아직 **하나도
수정하지 않았다** — draft 단계에서 멈췄으므로 저장소의 spec 은 종전 그대로다.
