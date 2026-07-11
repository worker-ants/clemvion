---
title: 웹채팅 공개 위젯 서버측 execution 잔존 2건 — 결정·설계 (A 중복 webhook 드레인 / B idle waiting GC)
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-11
owner: project-planner
spec_area: spec/7-channel-web-chat/1-widget-app.md, spec/5-system/14-external-interaction-api.md, spec/5-system/4-execution-engine.md
spec_impact:
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/4-execution-engine.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/3-error-handling.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/data-flow/3-execution.md
  - spec/data-flow/15-external-interaction.md
---

## 배경

PR #874(웹채팅 위젯 세션 컨트롤 + 히스토리 복원) 파생으로 남은 **서버측 execution 잔존 2건**을
planner 관점에서 결정·설계한다. 구현은 별도 developer 세션 위임(본 문서는 결정 SoT + 편집 명세).

- **(A)** host SDK `resetSession`(=newChat) 을 `booting`(webhook POST in-flight) 중 호출하면 in-flight
  `start()` 와 겹쳐 중복 `POST /api/hooks/:path` 가 발사될 수 있다(첫 노드 부작용 2회 위험). 헤더 UI
  컨트롤은 `isActiveConversationPhase`(booting 제외)로 차단했으나 host-API 경로는 게이트 밖(pre-existing).
  위젯 gen guard(`use-widget.ts startGenRef`)는 client 상태 오염만 막고 발사된 webhook 은 못 막는다.
  → 등재: [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
  "host `resetSession` booting 중 중복 webhook 가드"(2026-07-10 consistency W3).
- **(B)** eager-start(패널 open 즉시 `POST /api/hooks`)로 생긴 execution 이 사용자 이탈(탭 종료·"새 대화"
  등) 시 명시 종료 없이 `waiting_for_input` 로 무기한 잔존
  ([4-execution-engine §7.4/§7.5](../../spec/5-system/4-execution-engine.md) 무기한 보존 불변식과 정합하나 누적).
  → 어느 plan 에도 미등재(현재 widget-app §3.1 "새 대화" 행에 *결과*로만 서술). 본 plan 이 인수.

**정찰(2026-07-11)**: origin/main #884~#915 에 두 건 해결 흔적 없음. 병렬 세션 신규 결정 문서 없음
(drain/reaper/single-flight grep 0건). PR #874 파생 [`spec-draft-pr874-deferred-docs.md`](./spec-draft-pr874-deferred-docs.md)
는 문서 보강(R7 승격)만 다루고 A/B 실해결은 backlog 로 남김. → 중복 아님, 착수 valid.

## 사용자 확정 결정 (2026-07-11)

| # | 결정 | 대안(기각) |
|---|---|---|
| **A** | **Coalesce** — single-flight 가드로 booting 중 `resetSession` 을 in-flight `start()` 에 흡수(2번째 POST·2번째 execution 없음) | ① await→cancel→restart(첫 노드 부작용 1회 추가) ② 서버 webhook Idempotency-Key(부적합·아래 R-A2) |
| **B** | **Client cancel + 채널 idle-wait timeout** — ①확립 세션에서 "새 대화" 시 이전 execution best-effort EIA `cancel`(source fix) + ②익명(`auth_config_id IS NULL`) per_execution waiting execution 에 채널 스코프 idle-wait timeout backstop | ① client cancel 만(backstop defer) ② idle-timeout 만(client 무변경) |

## consistency-check 반영 (2026-07-11, `review/consistency/2026/07/11/16_45_01/`, 초기 BLOCK YES→해소)

| # | Sev | 발견 | 반영 |
|---|---|---|---|
| C1 | CRITICAL | `cancelledBy='channel_idle_timeout'` 이 닫힌 3값 union(`user`\|`system`\|`timeout`)을 4번째 값으로 확장(EIA §6.5·WS §4.1·chat-channel-adapter·TS 리터럴 5지점) | **철회** → §8 큐 대기 선례처럼 `cancelledBy='timeout'` 재사용 + 신규 `error.code='WEBCHAT_IDLE_TIMEOUT'`. 미러 문서(WS §4.1·EIA §6.5·error-handling) 동반 갱신 등재 |
| C2 | CRITICAL | B-2 주기 스캐너가 engine 이 2회 기각한 "신규 주기 스캐너 미도입" 원칙(§7.1/§7.4, L1352·L1597) 재도입 | **구조적 예외로 명문화**(택2) → park=BullMQ job 부재라 "stalled 가 본령" 기각 전제 불성립 + tab-abandonment steady-state 누적이라 boot-only 불충분. R-B2 + engine Rationale 양쪽 갱신 |
| W1 | WARN | R-B2 가 auth-session §3.1 "Planned" 401 refresh 분기를 기정사실 인용 | 논거를 §3 시퀀스 7(구현된 proactive refresh) + JWT exp 하드 사실로 한정, reload-401 인용에 "(Planned)" caveat |
| W2 | WARN | §7.4 "워크플로우 정의 timeout" carve-out 을 "채널 정의"로 소급 확장하며 "무변경(이미 허용)"이라 서술 | **신규 확장 결정**으로 재서술 + §7.4 원문 소폭 확장 |
| W3 | WARN | 파일명 `spec-decide-` 규약 이탈 | `spec-draft-webchat-execution-residuals.md` 리네임(반영 완료) |
| I1 | INFO | 신규 요구사항 ID 미확정 | **EIA-RL-07**(§3.4 다음 빈 슬롯)로 lock — 편집 시 재확인 |
| I2 | INFO | `EIA-AU-05` 앵커가 `#93-인증`(오)→`#33-인증` | 정정(본 문서·spec 편집 양쪽) |

---

## (A) 설계 — single-flight coalesce 드레인

**원인 재정의**: 이것은 공유 webhook 표면의 멱등성 문제가 **아니라** client 동시성 결함이다 —
`resetSession` 이 in-flight `start()` 를 드레인하지 않고 무조건 새 `start()` 를 발사한다.

**결정된 계약** (구현은 `codebase/channel-web-chat`):

1. **single-flight start 불변식**: 위젯은 **동시에 in-flight `POST /api/hooks/:path` 를 최대 1개**,
   **live execution 을 최대 1개** 유지한다. `start()` 진입점(패널 open eager-start · `[ended]` CTA ·
   헤더 "새 대화" · host `resetSession`)은 모두 이 단일 게이트를 통과한다.
2. **booting 중 reset = coalesce**: start 가 in-flight(`booting`)인 동안 도착한 `resetSession`/newChat 은
   **2번째 POST 를 발사하지 않고 in-flight start 에 흡수**한다. booting 은 아직 대화 미확립(메시지 0,
   세션 미persist)이라 "새 세션" 요구가 in-flight booting 으로 이미 충족되기 때문이다 — 흡수된 booting
   session 이 그대로 세션이 된다.
3. **경계 보장**: booting 은 항상 유한 시간에 settle(webhook 202/에러 — 요청 타임아웃 존재)한다.
   settle 시 위젯은 확립된(never-interacted) 세션을 그대로 사용한다. boot 실패 시 `[ended]` 로 수렴하고
   host 는 재시작할 수 있다.

**효과**: 중복 webhook·중복 execution·첫 노드 부작용 2회가 **구조적으로 제거**된다(0회 중복).
서버 무변경 — 공유 webhook 표면을 건드리지 않는다.

**host-facing 투명성**: host 는 executionId 를 보지 않으므로(위젯 내부) coalesce 는 host `resetSession`
계약에 관측 가능한 차이를 만들지 않는다. 유일한 잔여 edge: booting(sub-second) 창 안에서 host 가
로그아웃→다른 유저 로그인으로 profile 을 바꾸며 reset 하면 흡수된 booting 이 이전 profile 을 유지 —
그러나 `updateProfile` 는 소급 불가(§R5)라 어차피 다음 start 까지 미반영이며, host 는 booting settle 후
`resetSession` 재호출로 새 세션을 얻는다(그 시점엔 헤더 컨트롤도 활성).

---

## (B) 설계 — client cancel(source) + 채널 idle-wait timeout(backstop)

### B-1 (source) — "새 대화" 시 이전 execution best-effort cancel

**확립 세션**(`streaming`/`awaiting_user_message`)에서 "새 대화"/`resetSession` 발원 시, 위젯은 새 start
전에 **이전 execution 을 best-effort EIA `cancel`([§5.4](../../spec/5-system/14-external-interaction-api.md#54-명시적-취소--post-apiexternalexecutionsexecutionidcancel))**
로 종료한다(위젯 토큰으로 자기 execution 취소 가능). 이로써 orphan 을 **근원에서 제거**한다.

- `cancel`(범용 종료)을 쓴다 — "새 대화" 는 대화 *완료*가 아니라 *폐기*이므로 graceful `end_conversation`
  이 아니다("대화 종료" 의 graceful 분기와 구분, §R7).
- **optimistic**: "대화 종료"(§R7)와 동형 — SSE 를 먼저 닫고 로컬은 새 booting 으로 전이한 뒤 cancel 을
  best-effort 발사한다. cancel 실패(410/409/네트워크)해도 로컬 재시작을 되돌리지 않는다.
- booting 중 coalesce 경로(A)에는 취소 대상이 없다(아직 execution 미확립 → 흡수). 따라서 B-1 은
  **확립 세션발 "새 대화"** 에만 적용된다 — A(coalesce)와 상호 배타로 깔끔히 맞물린다.
- B-1 은 "새 대화" 만 커버한다. **탭 종료·"닫기"(collapse, 세션 의도적 유지)** 로 이탈한 execution 은
  명시 cancel 을 못 보내므로 B-2 backstop 이 담당한다(아래).

### B-2 (backstop) — 익명 per_execution waiting execution 채널 idle-wait timeout

best-effort cancel 은 실패하거나(탭 강제 종료·네트워크) 애초에 발사되지 않는다("닫기"·탭 종료·eager-start
후 미전환 이탈). 이 잔존 orphan 을 서버가 회수하는 **좁은 backstop** 을 둔다. 실제 누적의 **지배적 원천**은
"새 대화 반복"이 아니라 **eager-start(패널 open) 후 미전환 이탈**이므로, B-2 가 B 의 load-bearing 파트다.

**정책**: `auth_config_id IS NULL`(공개 위젯) 트리거가 시작하고 `per_execution` 토큰으로만 접근되는
`waiting_for_input` execution 이, **발급된 모든 interaction 토큰이 영구 만료**(un-refreshable)된 뒤
grace window 를 초과하면 terminal(`cancelled`)로 전이한다.

- **cancelledBy·error.code (C1 반영)**: 닫힌 3값 union 을 **확장하지 않는다**. `cancelledBy='timeout'`
  (idle-wait 도 시간 bound 초과라 §8 큐 대기 timeout 선례와 대칭) 재사용 + **신규 `error.code='WEBCHAT_IDLE_TIMEOUT'`**
  로 세분화한다. 선례: `'system'`+`RESUME_*`(§7.5 rehydration 실패), `'timeout'`+`EXECUTION_QUEUE_WAIT_TIMEOUT`
  (§8 큐 대기). WS §4.1·EIA §6.5 의 "`'timeout'` = §8 큐 대기" 서술에 WEBCHAT_IDLE_TIMEOUT 을 병기한다.

**판정 신호 = 토큰 영구 만료(un-continuable 증명)**:
- 익명 위젯 토큰은 **만료 후 refresh 불가** — refresh 는 "만료 30분 이내 & alive"([EIA-AU-05](../../spec/5-system/14-external-interaction-api.md#33-인증))
  일 때만 200 이고, 완전 만료된 JWT 는 `InteractionGuard` 가 `TOKEN_EXPIRED`(401)로 선차단해 refresh
  핸들러에 도달조차 못 한다(§5.5). 즉 **alive 위젯은 만료 전 proactive refresh([§3 시퀀스 7](../../spec/7-channel-web-chat/3-auth-session.md#3-세션-시퀀스-per_execution), 구현됨) 로 유지**하고, abandoned 위젯은 refresh 를 멈춰 토큰이 만료된다.
- 따라서 "모든 발급 토큰 만료"(`execution_token.exp_at` — V060, `max(exp_at) < now`)는 **익명 사용자가
  그 execution 을 영원히 이어갈 수 없음의 증명**이다. (위젯의 reload-401 낙관적 refresh 분기[auth-session §R4]는
  현재 **Planned/미구현**이라 본 논거의 필수 전제로 삼지 않는다 — proactive refresh + JWT exp 하드 사실만으로
  성립. 다만 그 분기가 구현돼도 만료 토큰 refresh 는 여전히 401 이라 결론 불변.)
- grace window(env, 예: 토큰 exp 이후 추가 N — 기본값은 developer 가 결정) 를 둬 롤링/시계 편차 여유.

**회수 동작**: soft-terminal. hard-delete 아님(`cancelled` 전이 + 토큰 일괄 revoke `revokeAllForExecution`,
EIA-RL-06). 이력·감사·`GET /:id`(§5.3) 조회는 보존된다.

**메커니즘 — 기존 EIA sweep 패턴 확장 (C2·W4·I3·I4 반영, "원칙 예외" 아님)**: B-2 reaper 는 **신규 아키텍처가
아니라 EIA 계층에 이미 존재하는 주기 sweep 의 형제**다. 두 확립된 선례로 성립한다:
- **§1.1 이 이미 예약한 전이의 최초 구현**: `4-execution-engine §1.1` 상태 전이표(L76)가 `waiting_for_input → cancelled`
  의 사유로 *"사용자 취소, **타임아웃**, 또는 rehydration 실패"* 를 **이미 열거**한다 — B-2 는 그 예약된 "타임아웃"
  사유를 공개 위젯 채널에 대해 **최초로 구현**하는 것이지 새 전이/원칙을 여는 게 아니다.
- **EIA-RL-06 sweep 패턴의 재사용**: EIA 계층은 이미 `terminal-revoke-reconciler`(EIA-RL-06 · §9.3 R15)라는
  **BullMQ repeatable scheduler**(분단위 `* * * * *`, `execution_token`⋈`execution` join sweep, `upsertJobScheduler`
  로 멀티 인스턴스 전역 1회 — `login-history-pruner` 선례)를 운영한다. B-2 reaper 는 **동일 계층·동일 데이터소스
  (`execution_token.exp_at`)·동일 전역-1회 패턴**의 형제 sweep 이다.
- 따라서 engine 의 "신규 주기 스캐너 미도입" 원칙(§7.1/§7.4)과는 **애초에 무관**하다 — 그 원칙은 *job 이 존재하는
  RUNNING/pending 의 **엔진 recovery scanner***에 스코프된 것이고, B-2 는 그게 아니라 **EIA token-lifecycle sweep**
  이다(park 는 §7.4 상 BullMQ job 자체가 없어 engine recovery 대상이 아니다). engine §7.4 에는 오독 방지용 1줄
  cross-ref 만 둔다(변경안 (3) — 원칙 번복/예외 신설이 아님).
- **기각 대안(W4)**: execution 별 delayed job 을 매 토큰 refresh 마다 재스케줄해 exp+grace 에 발화시키는 job-based
  안도 가능하나 — waiting execution(잠재적 수백만)마다 delayed job 추적 + 매 refresh 재스케줄 비용 + park 의 "job
  없음" 설계(§4.x) 부분 반전을 유발한다. EIA-RL-06 형 **단일 전역 sweep** 이 `execution_token` durable 추적을
  그대로 재사용해 더 단순·저비용이므로 채택.

**범위 제약(불변식 보호)**: 본 timeout 은 **오직** `auth_config_id IS NULL` + per_execution 토큰 전 만료
execution 에만 적용한다. 인증 트리거·per_trigger·`formConfig.timeout` 등 워크플로우 정의 대기는
**대상 아님** — §7.4 무기한 보존 불변식의 대상 도메인은 그대로다. chat-channel(Telegram 등)은 per_trigger·
in-process 라 B-2 범위 밖 → `chat-channel-adapter` 렌더 로직 변경 불요(신규 `error.code` 는 어댑터의 generic
fallback 이 이미 커버).

---

## 불변식과의 관계 (§7.4/§7.5 무기한 보존) — Rationale 명문화 대상

**결론: (A)·(B) 어느 것도 무기한 보존 불변식의 보호 대상(=입력이 실제로 도착할 legitimate 대기)을 약화하지
않는다. B-2 의 `waiting_for_input → cancelled` 전이는 §1.1 이 이미 예약한 "타임아웃" 사유이며, §7.4/§4.x carve-out
산문만 그 timeout 카테고리를 명시하도록 소폭 확장한다(전이표 자체는 무변경).**

1. **§1.1 예약 카테고리의 최초 구현 + carve-out 산문 확장**. `§1.1` 전이표(L76)는 `waiting_for_input → cancelled`
   의 사유로 **"타임아웃" 을 이미 열거**한다 — B-2 는 그 예약 사유를 공개 위젯 채널에 최초 구현할 뿐 새 전이를
   여는 게 아니다. 다만 §7.4(L930)·§4.x(L425-431)의 carve-out **산문**은 timeout 을 *"노드별 `formConfig.timeout`
   등 워크플로우 정의"* 로 한정 서술하므로, 이를 *"워크플로우 정의 + 공개 위젯 채널이 판정하는 provably
   un-continuable 상태(EIA §B-2)"* 로 소폭 확장한다(변경안 (3)). 이는 §1.1 예약을 구체화하는 산문 정합이지 불변식
   전이 규칙의 신설/번복이 아니다.
2. **B-2 는 "genuinely waiting" 을 죽이지 않는다 — false-waiting 을 정정한다**. 익명 위젯 execution 은
   토큰 영구 만료 시점에 **입력이 도착할 경로가 물리적으로 소멸**한다(익명·무토큰·refresh 불가). 그
   상태의 `waiting_for_input` 은 "곧 올 입력을 기다림" 이 아니라 **영원히 오지 않을 입력을 기다리는 false
   상태**다. 회수 대상은 불변식이 보호하려는 "며칠 후 올 입력" 케이스와 disjoint 하다.
3. **B-1 은 "명시 명령의 부재" 만 바꾼다**. 불변식은 *명령 없이 방치된* waiting 을 보존하라는 것이지,
   *명령 금지* 가 아니다. "새 대화" 가 명시 `cancel` 을 보내는 것은 불변식이 이미 허용하는 정상 종료다
   (기존 "대화 종료" 도 동일).
4. **A 는 서버 상태를 아예 만들지 않는다**. coalesce 는 2번째 execution 을 생성하지 않으므로 회수할
   orphan 도, 불변식과의 접점도 없다.

---

## Rationale (결정 근거)

**R-A1 — A 를 서버 멱등이 아닌 client 드레인으로.** 근본 원인은 client 동시성(단일 게이트 부재)이지
webhook 표면의 멱등 부재가 아니다. 수정은 원인 계층(위젯)에 둬야 side-effect 가 국소화된다.

**R-A2 — 서버 webhook Idempotency-Key 기각.** (a) `POST /api/hooks/:path` 는 전 webhook 통합이 쓰는
**공유 트리거 표면**이라 start-멱등 도입은 광범위·의미 모호(키/body/윈도우)한 변경이다. (b) 더 결정적으로
Idempotency-Key 는 *동일 요청 재시도* 를 dedup 하는데, reset 은 **새 세션 intent** 라 다른 키를 쓰게 되어
두 execution 이 그대로 생긴다 — 이 race 를 원리적으로 못 막는다. reset 이 booting 키를 재사용하면
그건 곧 coalesce 이고, 그건 공유 표면을 건드리지 않고 client 에서 더 깔끔히 된다.

**R-A3 — await→cancel→restart 대신 coalesce.** await-cancel 은 booting execution 을 확립시킨 뒤 취소하므로
**첫 노드 부작용이 1회 추가**되고 취소될 execution(=B orphan 후보)을 만든다. coalesce 는 2번째 execution
자체를 만들지 않아 부작용 0·orphan 0 으로 A·B 를 동시에 최적화한다. "reset 은 항상 새 executionId 를
보장해야 한다" 는 host 계약이 없으므로(host 는 executionId 미관측) coalesce 가 지배적이다.

**R-B1 — "새 대화" 를 best-effort cancel 로.** 기존 서술("새 대화 는 명시 종료를 보내지 않는다")은 #874
당시 optimistic-local 단순성 선택이었으나 누적 orphan 을 낳는다. "새 대화" = (이전 폐기) + (새 시작)
이므로 이전 execution 의 명시 `cancel` 은 의미상 자연스럽고 "대화 종료" 와 대칭이다. graceful 이 아닌
범용 `cancel` 인 이유는 폐기(완료 아님)이기 때문.

**R-B2 — backstop 을 blanket idle-timer 가 아니라 토큰-만료 신호로 + 기존 EIA sweep 패턴 확장.**
(a) *신호*: "N일 idle → kill" 같은 엔진 전역 GC 는 legitimate 대기(며칠 후 올 입력)를 오살할 위험이 있어
§7.4 불변식과 충돌한다. 대신 **공개 위젯의 토큰 영구 만료** 를 신호로 삼으면 *증명 가능하게 un-continuable*
한 execution 만 회수하므로 불변식의 보호 대상과 disjoint 하다. 이 신호는 익명 위젯에만 존재하는 특수 조건이라
blast radius 가 채널로 자연 한정된다. (b) *메커니즘 = 기존 패턴 확장(원칙 예외 아님)*: (i) `§1.1` 전이표가
`waiting_for_input → cancelled` 의 사유로 **"타임아웃" 을 이미 예약**(L76)하므로 B-2 는 그 예약 카테고리의 **최초
구현**이다. (ii) EIA 계층은 이미 `terminal-revoke-reconciler`(**EIA-RL-06** · BullMQ repeatable, `execution_token`
sweep, 전역 1회)를 운영하므로 B-2 reaper 는 **동일 계층·데이터소스·패턴의 형제 sweep** 이다. 따라서 engine 의
"신규 주기 스캐너 미도입" 원칙(§7.1/§7.4 — *job-backed 엔진 recovery* 스코프)과는 **무관**하다(park 는 job 부재라
recovery 대상 자체가 아님). engine §7.4 엔 오독 방지 cross-ref 만 두고 원칙은 손대지 않는다. execution 별 delayed
job(매 refresh 재스케줄) 대안은 수백만 job 추적 비용 + park 의 no-job 설계 반전이라 기각, 단일 전역 sweep 채택.

**R-B3 — client cancel + 서버 backstop 이중화.** client cancel(B-1) 단독은 탭 종료·"닫기"·네트워크 유실에
취약하고, backstop(B-2) 단독은 정상 "새 대화" 경로에서도 토큰 만료까지 orphan 을 방치한다. 둘을 병행하면
"새 대화" 는 즉시(B-1), 그 외 이탈은 토큰 만료+grace 후(B-2) 수렴한다.

---

## 변경안 (spec 편집 — 결정 lock)

> 실제 최종 문구는 각 spec 파일 참조. 아래는 편집 대상·요지.

### (1) `spec/7-channel-web-chat/1-widget-app.md`
- **§3.1 "새 대화" 행**: (A) "알려진 제약(Planned) … host-API 측 가드/드레인은 backlog" 를 **해소된
  coalesce 설계**로 교체. (B-1) "이전 execution 은 명시 종료 명령을 보내지 않으므로 … waiting_for_input
  로 잔존" 을 **"확립 세션발 새 대화는 이전 execution 을 best-effort `cancel` 후 재시작; booting 발 reset 은
  coalesce(취소 대상 없음)"** 로 교체. 잔존 이탈(탭/닫기)은 B-2 backstop 으로 수렴 명시.
- **§R7 말미**: "host `resetSession` … 잔여 위험은 §3.1 에 Planned 로 남긴다" 를 **coalesce 로 해소**
  참조로 교체. 종료 명령 실패 시 서버 수렴을 **B-2 backstop** 참조로 보강.
- **신규 §R9**: A(single-flight coalesce) + B-1(새 대화 cancel) 결정 근거(R-A1~R-B1 요지) 승격.
  R7 은 "신규 결정 없음" 이었으므로 신규 결정은 R9 로 분리(R8 까지 사용 중 — 번호 충돌 없음).
- **§3.1 "토큰 만료/서버 타임아웃" 행(L88)** (W2 반영 — 이 행은 여기 있고 auth-session 엔 없음): "idle → 410 Gone"
  이 토큰만 죽이던 것을, execution 도 B-2(EIA-RL-07)로 회수됨을 1줄 병기.
- **§R6 각주**(I5): "방치 세션은 토큰 TTL/idle 만료로 정리" 라는 낙관적 서술에, 서버측 execution 회수분은
  B-2/EIA-RL-07 backstop 이 실질 제공함을 cross-ref(§3.1 "execution 잔존, 토큰만 만료" 서술과의 갭 해소).

### (2) `spec/5-system/14-external-interaction-api.md`
- **신규 요구사항 §3.4 `EIA-RL-07`**(다음 빈 슬롯 — 편집 시 재확인): 익명 per_execution waiting execution
  채널 idle-wait timeout backstop(B-2) — 판정=토큰 영구 만료, 동작=`cancelled`/`cancelledBy='timeout'`/
  `error.code='WEBCHAT_IDLE_TIMEOUT'`, 범위=`auth_config_id IS NULL`+per_execution 한정.
- **§6.5 `execution.cancelled`**: `'timeout'` 사유에 WEBCHAT_IDLE_TIMEOUT(B-2) 병기(기존 큐 대기와 구분).
- **신규 Rationale**: R-B2(신호=토큰만료·메커니즘=주기 예외) + 불변식 관계(위 §"불변식과의 관계").

### (3) `spec/5-system/4-execution-engine.md`  *(W1: §7.4·§4.x 두 곳 동반)*
- **§7.4(L930)** `waiting_for_input 무기한 보존` carve-out 산문을 **소폭 확장** — "워크플로우 정의 timeout 뿐
  아니라 **공개 웹채팅 위젯이 판정하는 provably un-continuable 상태(EIA §B-2, `auth_config_id IS NULL`+per_execution;
  Chat Channel §15 과는 별개)**도 별도 timeout 카테고리"임을 명시(SoT 는 EIA, cross-ref). 불변식 **보호 대상**·
  §1.1 전이표 자체는 무변경(§1.1 은 이미 "타임아웃" 사유 예약).
- **§4.x(L425-431)** 동일 불변식 중복 서술의 "노드 워크플로 정의 timeout" 문구에도 같은 cross-ref 1줄 동반(W1 —
  두 곳 비대칭 방지).
- **Rationale**(L1597 인접, orphan-pending 원칙 항목): "'신규 주기 스캐너 미도입' 원칙은 *job-backed 엔진
  recovery*(RUNNING/pending) 스코프이며, **job 부재 park 의 client-abandonment 회수는 engine recovery 가 아니라
  EIA token-lifecycle sweep(EIA-RL-06 형제, EIA §B-2)**이라 본 원칙과 무관"임을 1줄 병기(재대조 재충돌 방지 —
  원칙 번복/예외 신설 아님).

### (4) `spec/5-system/6-websocket-protocol.md`
- **§4.1 `execution.cancelled`**: `cancelledBy='timeout'` 의 `error.code` 열거에 WEBCHAT_IDLE_TIMEOUT
  추가(기존 EXECUTION_QUEUE_WAIT_TIMEOUT 옆).

### (5) `spec/5-system/3-error-handling.md`
- 큐 대기 초과(§1.x) 인접에 **WEBCHAT_IDLE_TIMEOUT**(cancelled 귀결 그룹, `cancelledBy='timeout'`) 등재.

### (6) `spec/7-channel-web-chat/3-auth-session.md`  *(W2: 편집 위치 정정)*
- **§R4/§R6 근처 cross-ref 1줄**: per_execution 토큰 만료(idle) 서술 옆에, 토큰만 죽고 잔존하던 서버 execution 을
  **B-2/EIA-RL-07 backstop 이 회수**함을 cross-ref. (당초 지정한 "§3.1 토큰 만료 행" 은 auth-session 이 아니라
  widget-app §3.1 L88 에 있으므로 그 행은 변경안 (1)에서 처리.)

### (7-a) `spec/data-flow/3-execution.md`  *(W3: canonical 미러)*
- **§3.1 상태 전이 다이어그램**: `waiting_for_input → cancelled` edge(또는 신설)에 B-2 트리거(공개 위젯 토큰
  영구 만료 → `WEBCHAT_IDLE_TIMEOUT`)를 기존 `pending → cancelled`(EXECUTION_QUEUE_WAIT_TIMEOUT) 서술과 대칭 등재.

### (7-b) `spec/data-flow/15-external-interaction.md`  *(W3: canonical 미러)*
- **§2.2 Redis/BullMQ job 카탈로그**: `terminal-revoke-reconcile` 행 옆에 신규 reaper repeatable job 을 형제로
  등재(전역 1회 · `execution_token` 만료 sweep · EIA §B-2/EIA-RL-07).

### (8) backlog plan 갱신
- [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md): item A
  를 **결정 완료(coalesce, 구현 handoff)** 로 갱신 + item B(B-2 backstop) 신규 등재.

## 체크리스트

- [x] `/consistency-check --spec` 1차 (초기 YES) → C1·C2 정정 → 2차 **BLOCK: NO** (`.../17_04_05/SUMMARY.md`). W1~W4·I1~I8 draft 반영 완료
- [x] (1) widget-app §3.1 "새 대화" 행 + §R6(L149) 각주 + §R7(2곳) + 신규 §R9  *(§3.1 L88 client-410 행은 B-2 가 4곳 cross-ref 돼 skip — 직교)*
- [x] (2) EIA EIA-RL-07(§3.4) + §6.5 timeout error.code + 신규 Rationale §R19
- [x] (3) execution-engine §7.4 + §4.x carve-out 산문 확장 + Rationale 스코프 cross-ref (원칙 무변경)
- [x] (4) WS-protocol §4.1 error.code (WEBCHAT_IDLE_TIMEOUT)
- [x] (5) error-handling §1.x WEBCHAT_IDLE_TIMEOUT
- [x] (6) auth-session §R6 cross-ref (서버측 execution 회수)
- [x] (7-a) data-flow/3-execution §3.1 전이 · (7-b) data-flow/15-external §2.2 job 카탈로그
- [x] (8) backlog plan 갱신 (spec-sync-external-interaction-api-gaps: item A 완료화 + item B 등재)
- [x] doc-guard(spec-link-integrity) 통과 (13/13) + mermaid-lint(data-flow/3-execution) 통과
- [x] commit + PR (#916 머지)
- [~] **developer 위임 (진행 중 — 이 plan 은 두 PR 완료까지 in-progress 유지)**:
  - [x] **PR-1 (위젯)** single-flight coalesce + 확립세션 cancel — 브랜치 `claude/webchat-widget-coalesce-cancel`. impl-prep BLOCK:NO(`review/consistency/2026/07/11/17_54_21/`). TDD 25/25·lint·unit(33)·build·e2e(252) PASS. `/ai-review`(`review/code/2026/07/11/18_18_31/`) Critical 0·Warning 7 → W1(큐 누수 fix+non-vacuous 회귀)·W3·W5(브릿지)·W6(CHANGELOG)·W7 반영, W2 defer·W4 조치불요(RESOLUTION.md).
  - [ ] **PR-2 (백엔드)** idle-wait reaper(EIA-RL-07) — 미착수(별 세션/PR)

## 구현 위임 메모 (developer 세션용)

1. **위젯(`codebase/channel-web-chat`)**: single-flight start 게이트(모든 start 진입점 통과) + booting 중
   reset coalesce + 확립 세션발 새 대화 best-effort `cancel`. `startGenRef` gen guard 와의 관계 정리.
2. **서버(backend EIA)**: **주기** repeatable sweep(park 는 boot-only 로 부족 — R-B2; **EIA-RL-06
   `terminal-revoke-reconciler` 와 동일 패턴이되 별도 서비스/큐명**으로 — 혼동 방지, I8)으로 `auth_config_id IS NULL`
   + per_execution 토큰 전 만료(`execution_token.exp_at`) `waiting_for_input` 을 `cancelled`(`cancelledBy='timeout'`
   + `error.code='WEBCHAT_IDLE_TIMEOUT'`) 회수 + `revokeAllForExecution`. grace window env 기본값 결정.
   조건부 UPDATE(`WHERE status='waiting_for_input'`)로 race-safe(§7.4 orphan-pending 패턴 준용).
   e2e: abandoned 위젯 세션이 grace 후 회수되는지.
3. **error-code 등록**(I6): `WEBCHAT_IDLE_TIMEOUT` 은 `error-codes.ts` 편집 — [`exec-intake-followups.md`](./exec-intake-followups.md)
   ARCH#5 "정착 대기" 동시 편집 대기열과 겹침(충돌 아님, 착수 시 순서만 조율).
