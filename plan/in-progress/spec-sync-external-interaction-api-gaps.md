---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# external-interaction-api — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/14-external-interaction-api.md

## 미구현 항목
- [ ] **종결 이벤트의 `result.outputs` · `durationMs` emit** (§6 도입부 필드 집합 표의 Planned 2행,
      2026-08-13 등재) — 데이터는 emit **직전에 이미 존재**하는데 payload 에 넣지 않는다
      (`execution-engine.service.ts` L2356·2520·3452·4616, `retry-turn.service.ts` L723·897).
      spec 이 없는 필드를 약속하던 상태를 정리하며(§6 재작성) **문서 쪽을 실제에 맞췄고**,
      이 항목은 그 반대 방향(구현을 문서에 맞추기)의 잔여분이다. 구현되면 필드 집합 표의
      "미구현 (Planned)" 를 "구현됨" 으로 flip 한다.
- [ ] **`execution.failed` 의 `error` 를 객체로 통일** (§6 필드 집합 표 `error` 행, 2026-08-13 등재)
      — 일부 경로가 아직 string 을 싣는다(`execution-engine.service.ts` L656·L3291,
      `retry-turn.service.ts` L956). 그래서 `chat-channel.dispatcher.ts` 에 back-compat wrap 이
      쌓였고 adapter 타입도 `| string` 을 안고 있다. 통일되면 그 wrap 과 union 을 함께 제거한다.
- [x] **Outbound notification backoff 배율** (§3.1 EIA-NX-06 / §6.6) — base-4 (1s/4s/16s/64s/256s) custom BullMQ backoffStrategy 로 구현. worker `settings.backoffStrategy` + `NOTIFICATION_BACKOFF_TYPE`. spec §3.1/§6.6/data-flow-15 동기화. lint·unit·build·e2e 통과.
- [ ] **분산(다중 인스턴스) SSE / notification fan-out** (§R10) — 현재 `SseAdapter`·`NotificationFanout` 모두 단일 sink `WebsocketService.executionEvents$` 를 in-process(in-memory) RxJS 구독만 하고 Redis pub/sub 발행/구독이 없음. 코드 주석상 "v1 single-instance, 분산 fan-out follow-up". 다중 인스턴스에서 외부 SSE 클라이언트가 임의 인스턴스 접속 가능하려면 Redis pub/sub 도입 필요.
- [x] **Inbound per-execution rate-limit 및 `RATE_LIMITED` 429** (§5.1 / §8.4 rows 1·3) — `/interact` 60/분·status 120/분 (execution 당). `InteractionRateLimiterService`(Redis fixed-window, fail-open) + `InteractionRateLimitGuard` + `@RateLimit`. `429 RATE_LIMITED` + `Retry-After`. spec §5.1/§8.4/§3.1 EIA-NX-11 + §2-api-convention §7 + user-guide triggers.mdx/en.mdx 동기화. lint·unit·build·e2e 통과.
- [x] **Outbound per-trigger rate-limit + 폭주 시 `notificationHealth=degraded`** (§8.4 row 4 / §3.1 EIA-NX-11, 권장) — `OutboundNotificationRateLimiterService`(Redis fixed-window INCR+EXPIRE NX, fail-open) + `NotificationWebhookProcessor` 발송 성공 분기: >60/분이면 healthy 대신 degraded + 폭주 전용 last_error(발송실패 degraded 와 원인 구분). **폐기 없이 발송(무손실)** — throttle 아님. spec §8.4 row4/§3.1 EIA-NX-11 구현됨 flip + §Rationale R-outbound-flood + data-flow/15 §1.4 다이어그램 분기. lint·unit·build·e2e·ai-review(Critical 0)·consistency(BLOCK:NO) 통과. **PR #845**.
- [x] **`GET /api/external/executions/:id` 의 currentNode / context 실값** (§5.3) — **완료/정합 확인 (2026-07-08 재검증)**: `getStatus()` 가 `WAITING_FOR_INPUT` 상태에서 대기 `NodeExecution.outputData` 로부터 `currentNode`(id/type/interactionType)·`context`(buttons=`buttonConfig{buttons,nodeOutput}`, form/ai_conversation=`nodeOutput`)를 SSE `waiting_for_input` wire 와 동일 형식으로 복원(`interaction.service.ts` 의 `getStatus()` — `WAITING_FOR_INPUT` 분기. 라인 인용은 리팩터마다 stale 화돼 심볼로 고정). spec §5.3 "구현 상태(V1)" 노트도 이미 동기화됨. `seq` 는 항상 `0`(`SSE_SEQ_PLACEHOLDER`)이며 이는 **의도된 설계** — REST 단발 응답은 in-memory SSE seq 에 접근 불가, 클라이언트가 SSE `Last-Event-Id` 로 보정(spec §5.3 명시). running(비대기) 상태 currentNode 노출은 spec 이 약속하지 않음(V1 = waiting 한정).
  - **축 분리 주의**: 본 항목은 **런타임 실값**(context 가 null placeholder 가 아닌가)만 종결한다. 그 실값의 **OpenAPI 스키마 표현**(`additionalProperties` 로 뭉개짐)과 **부재 표현 컨벤션**(`null` vs 키 생략)은 별도 축이며 `spec-draft-eia-context-schema-absence-convention.md` 에서 진행한다 — 본 `[x]` 를 "getStatus.context 관련 갭 전부 종결" 로 읽지 말 것.
- [x] **SSE 버퍼 만료 시 `execution.replay_unavailable` emit** (§5.2 / §11 / EIA-IN-07 / EIA-NF-03) — **완료 (2026-07-08)**: `sse-adapter.service.ts` `replayOrSignalUnavailable` 이 재연결 replay 시 재생 가능한 가장 이른 seq 가 `Last-Event-Id+1` 이 아니면(만료 또는 cap 폐기 gap) 부분 replay 대신 `execution.replay_unavailable`(seq=0 control frame) 1회 push → 클라 REST 재조회. `writeSseFrame` 이 seq≤0 시 `id:` 라인 생략(Last-Event-Id 오염 방지). spec-sync: EIA §5.2/§11(EIA-IN-07·EIA-NF-03·vocab)·Rationale R-replay-unavailable + WS §6.2(3곳)·widget-app §3.1·data-flow/15 §1.3 동기화. unit(sse-adapter 6건·writeSseFrame 3건)·lint·build 통과.
  - [x] **(후속) web-chat 위젯 클라이언트 소비** — 위젯은 이벤트 리스너를 이미 등록(`eia-client.ts`)했으나 `use-widget.ts handleEiaEvent` 에 `execution.replay_unavailable` case 가 없어 no-op. **완료 (2026-07-17)**: `handleEiaEvent` 에 소비 분기 추가 — 기존 `seedWaitingFromStatus`(getStatus snapshot 폴백, EIA §5.3)를 재사용해 재동기화한다. spec `1-widget-app.md §3.1` 이 정한 동작 그대로라 **결정 불요**였고, 신호 자체는 종료가 아니므로 기본적으로 스트림·세션은 유지한다.
    **단 스냅샷이 이미 terminal 이면 종료로 확정한다**(ai-review `02_04_13`): gap 안에 execution 이 종료됐다면 terminal 이벤트도 버퍼와 함께 유실돼 다시 오지 않으므로(EIA `R-replay-unavailable`), 표면 시드 대신 세션 정리+`ENDED`+host 통지를 수행한다 — 없으면 위젯이 `streaming` 에 무기한 정지. 같은 판정이 **세션 복원 경로**에도 적용되며 종료 확정 시 SSE 재오픈·토큰 갱신을 건너뛴다(무효 토큰 스트림·종료 세션 storage 부활 방지). spec §3.1 에 이 예외 명문화.
    **구현 노트**: `seedWaitingFromStatus` 정의가 `handleEiaEvent` 보다 **아래**라 TDZ 문제가 있었다. 콜백 순서를 재정렬하는 대신 **ref 홀더(`seedWaitingFromStatusRef`)** 로 참조하되, 대입은 `apiRef` 컨벤션대로 **effect 에서** 한다(초기 서술은 "deps `[]` 라 render-body 대입도 안전" 이었으나, terminal fix 로 deps 가 `[finalizeEnded]` 로 늘면서 그 전제가 무너졌다 — reviewer 가 예견한 그대로다).
    **계약 강화 (ai-review `02_04_13` CRITICAL)**: terminal 분기를 `seedWaitingFromStatus` **안**에 넣으면 세 호출부가 자동 보호될 거라 봤지만 **정반대였다** — 그 함수가 teardown 을 수행하게 됐는데 호출부는 그 사실을 모른 채 곧바로 `openStream`/`scheduleRefresh` 를 실행했다. `start()` 는 `startGenRef` 재확인으로 **우연히** 막혔고 `applyConfig`(세션 복원)는 무방비였다. → **반환값 `Promise<boolean>`("이 호출이 대화를 종료시켰다") 으로 계약을 명시**하고 세 호출부 전부 게이팅. 중복 3줄은 `finalizeEnded(reason)` 헬퍼로 추출(`endedRef` 1회 가드 — SSE terminal 과 REST 폴백 terminal 의 중복 host 통지 차단), fire-and-forget 레이스는 `sessionRef.current !== session` staleness 가드로 폐기.
    회귀 고정: `use-widget-eager-start.test.ts` — §"버퍼 만료 재동기화"(getStatus 2회 + 표면 반영 + 미종료) · "이미 종료됐으면 ENDED 전이" · "폴백 getStatus 실패 시 soft-fail" · **"복원된 세션이 이미 terminal → SSE 미오픈 + storage 부활 없음 + refresh 미호출"**(CRITICAL 재발 방지). **각 fix 를 일부러 무력화해 해당 테스트만 실패함을 확인**(회귀 검출력 검증). spec `1-widget-app.md §3.1` 의 "소비 분기 미배선(no-op)" 서술 + terminal 예외 명문화까지 반영.

    > **왜 grooming PR(#957)에서 분리했나 (사용자 결정, 2026-07-16)**: 이 항목은 당시 분류에서 "사용자 결정 없이 바로 처리 가능" 이었다. spec §3.1 이 동작을 확정해 둬 **제품 결정이 불요하다는 판단은 옳았으나, 구현 리스크 판정이 틀렸다** — `/ai-review` 가 최종 6라운드에 걸쳐 **CRITICAL 4건 + WARNING 20여건**을 냈다. 문서·spec 정정(같은 grooming 의 ⑥⑦⑧ 등)이 이 위젯 리스크에 묶여 대기하지 않도록 분리했고 #957 이 먼저 머지됐다. #957 이 남긴 "**⚠ 머지 전 판단 필요 — 구조 문제**"(`useEiaStream` 분리 선행 검토 요구)의 답이 아래 "구조 개선" 절이다 — 검토 결과 **분리가 아니라 가드 단일화**를 택했다.

    **구조 개선 — `worldGen` 단일화 (2026-07-17, `useEiaStream` 분리 검토 결과)**: 4라운드 리뷰에서 같은 실패 유형(비동기 경로의 **대칭 가드 누락**)이 3연속 반복돼 구조를 검토했다. 결론은 **분리가 아니라 가드 단일화**였다.
    - **`useEiaStream`(스트림+이벤트) 분리는 해법이 아니다** — CRITICAL 이 났던 곳은 `seed`·`start`·`applyConfig`·`sendCommand` **조율**인데 전부 그 경계 **밖**에 남는다. 코드만 옮겨지고 문제는 그대로다.
    - **진짜 원인**: staleness 가드가 **4종**(세대 `startGenRef`/`start()` 전용 · `sessionRef` 동일성/`seed`·`sendCommand` · `cancelled` 지역 플래그/`applyConfig` 초기 부팅 · 언마운트 무가드)이었고 **무효화 트리거가 서로 달랐다**. 특히 `teardownSession()` 이 `sessionRef` 를 null 하지 않아 **`sessionRef` 동일성으로 지킨 경로는 SSE terminal 종료를 감지 못했다**.
    - **재현된 잔존 버그(4라운드 리뷰도 못 잡음)**: 버퍼 만료 seed 가 in-flight 인 동안 SSE terminal 도착 → seed 가 `waiting_for_input` 으로 resolve → `sessionRef` 검사 통과(teardown 이 안 건드림) → `dispatch(WAITING)` → **종료된 위젯이 `awaiting_user_message` 로 부활**. `widget-state.ts` 의 `WAITING` 이 `ended` 가드 없이 무조건 전이하는 것이 직접 원인. 실측 재현 확인.
    - **fix**: `worldGenRef` 하나로 통합. 무효화 지점은 **세 곳** — `teardownSession()`(모든 종료·새 대화·대화 종료의 choke point, 단 config 확립 전엔 no-op) · `start()`(새 execution 이 옛 세계를 대체) · 언마운트 cleanup. 모든 `await` 뒤 `if (worldGenRef.current !== gen) return;`. 언마운트 세대 증가로 **리뷰 W6(unmount-after-await SSE leak)도 함께 해소**.
    - **후속 리뷰(`08_29_33`) 반영 — 통합이 만든 회귀 1건 + 통합이 드러낸 동형 버그 2건** (상세: [RESOLUTION](../../review/code/2026/07/17/08_29_33/RESOLUTION.md)):
      - **C1 (내가 만든 회귀)**: `teardownSession()` 이 무조건 세대를 올리자 **부팅 중**(`embed-config` 왕복) host `resetSession` 이 `applyConfig` 를 stale 화해 죽였다 → config 영영 미확립 → **런처만 뜨고 패널이 영원히 안 열림**(silent hang). 종전 `cancelled` 는 언마운트에서만 set 이라 이 경로가 **우연히** 안전했고 단일화가 그 우연을 깨뜨렸다. 부모 커밋 A/B 로 귀속 확정. fix = `if (!configRef.current) return;`.
      - **W2 (활성 버그였음)**: `seedWaitingFromStatus` 의 **catch(soft-fail) 분기가 세대 검사 없이 `"continue"` 반환** → `getStatus` 가 네트워크 오류로 실패한 사이 새 대화가 시작되면 `outcome` 만 보는 `applyConfig` 가 통과해 **옛 세션이 스트림 탈취 + storage 부활**. `start()` 는 뒤의 명시적 세대 재검사로 우연히 무사했다 — 리뷰어가 지적한 그 **비대칭이 곧 버그**였다.
      - **W5 (활성 버그였음)**: `useTokenRefresh` 의 `cancelledRef`(4번째 가드)도 언마운트 전용이라 `teardownSession` 을 놓쳤다 → 갱신 요청 in-flight 중 새 대화 시 지연 응답이 **세션을 옛것으로 덮고 지운 storage 부활**. `worldGenRef` 주입으로 통합, `cancelledRef` 제거.
      - **W4**: 직접 원인이던 리듀서 `WAITING` 무조건 전이에 `ended` 가드 추가(최후 방어선 — 호출부 규율이 뚫려도 막힘).
      - **C2 (재현 실패 → 귀속 반박)**: "전체 스위트 동시 실행 시 ≈13% 비결정 실패, 부모 커밋 A/B 0건" 지적은 **동일 명령 85회(리뷰 대상 커밋 20 · 픽스 트리 37 · CPU 부하 8 · 최종 20) 실행에도 실패 0회**로 재현되지 않아 반박. 다만 지목된 근본 후보 중 **고정 횟수 microtask flush 관용구(기존 11곳)는 실재**하는 취약성이라 macrotask flush(`flushAsync()`)로 선제 교체.
    - **가드는 규율이지 구조가 아니다 (이 라운드의 교훈)**: 세대 단일화는 "호출부마다 `await` 뒤 재검증" 이라는 **규율**을 여전히 요구한다 — C1·W2 는 그 규율을 한 곳에서 어긴 결과다. 그래서 이번엔 (a) choke point(catch 분기)에서 막고 (b) 리듀서 최후 방어선을 두어, 호출부가 새로 추가돼도 조용히 뚫리지 않게 했다.
    - **`SeedOutcome` 3-state 는 유지** — 처음엔 세대 검사로 대체 가능하다고 봤으나 **틀렸다**: `finalizeEnded` 가 이미 종료 상태에서 dedup 으로 조기 return 하면 `teardownSession`·세대 증가를 **건너뛴다** → 그 경우 세대 검사만으로는 못 잡는다. 두 검사는 축이 다르다(outcome=`무엇이 일어났나`, gen=`세계가 바뀌었나`).
    - 검증: mutation 3종(choke point 증가 제거 → **3건 동시 실패**, seed 세대 검사 제거 → 3건, sendCommand 세대 검사 제거 → 1건). eager-start **36 passed**, lint·unit(5스택)·build·e2e(256) PASS.
    - **재리뷰(`09_36_01`) 가 잡은 잔여 gap — C1 fix 의 자기 사각지대**: C1 의 조기 return 근거("부팅 전엔 정리할 게 없다")는 **메모리에만 참**이고 `sessionStorage` 의 이전 세션은 놓친다 → 부팅 중 `resetSession` 이 조용히 무시되고 **옛 대화가 부활**(재현 확인, side_effect·security 독립 지적). fix = `pendingResetRef` 로 의도를 기록하고 `applyConfig` 가 `loadSession` 직전 소비. 교훈: **"정리할 게 없다"를 메모리만 보고 판단하면 영속 상태를 놓친다.**
    - 검증(`08_29_33`+`09_36_01` 반영 후): 신규 회귀 테스트 **8건**(vitest 실측 — eager-start 36→40: C1·C1-b·W2·W3 / token-refresh 10→11: W5 / widget-state 37→40: W4 가드 + 재개 경로 2케이스). 전부 mutation 검증(대응 가드 제거 시 **그 테스트만** 실패). 특히 W3 는 리뷰어가 "제거해도 364건 중 0건 실패"라 실증한 언마운트 지점을 닫은 것. channel-web-chat 22 파일 **372 passed**, lint·unit·build PASS.
    - **분리는 여전히 후속 후보** — 다만 그 경계는 `useEiaStream`(스트림)이 아니라 `useEiaSession`(세션 라이프사이클 전체, ≈300/735줄)이어야 하고, 가드가 하나로 정리된 **지금 상태에서 하는 편이 안전**하다. 기존 `useTokenRefresh`/`usePendingMessageQueue` 가 ref 주입 계약을 확립해 뒀다.
- [ ] **`getStatus` 일반 `nodeOutput` 키-allowlist** (§R17 잔여) — §R17 이 "conversationConfig 이외의 일반 `nodeOutput` 키-allowlist 만 잔여 항목" 이라 명시했으나 등재된 plan 이 없었다. 현재 `conversationThread`·`ai_message`·`nodeOutput.conversationConfig` 는 `redactThreadForPublic`/`deepRedactSecrets` 로 마스킹되지만 그 외 `nodeOutput` 키는 공개 표면에 그대로 실린다. 도입 시 §R17 잔여 문구 flip. (2026-07-10 consistency `plan-coherence` W3 로 등재 — spec-impl-evidence R-5 "빈 약속 영구 누락" 방지.)
- [x] **host `resetSession` booting 중 중복 webhook 가드** — **결정(2026-07-11) + 위젯 구현 완료**: **single-flight coalesce**(서버 멱등 아님) — booting 중 `resetSession` 은 in-flight `start()` 에 흡수되어 2번째 POST·2번째 execution 미생성. spec lock = [widget-app §R9·§3.1](../../spec/7-channel-web-chat/1-widget-app.md). 구현: `channel-web-chat/use-widget.ts newChat` (commit `e577f1b69`, branch `claude/webchat-widget-coalesce-cancel`). 서버 무변경 항목이라 본 항목 종결.
- [x] **공개 위젯 idle-wait execution GC (EIA-RL-07)** — **결정(2026-07-11) + 구현 완료(위젯 B-1 + 백엔드 reaper)**: ①"새 대화" best-effort `cancel`(source, widget-app §R9) = 위젯 구현(commit `e577f1b69`, PR-1). ②서버측 **idle-wait timeout backstop** = `WebchatIdleReaperService`(BullMQ repeatable 분 단위) — 익명 per_execution 토큰 전 만료(`execution_token.exp_at`)+grace `waiting_for_input` 을 engine `markWebchatIdleTimeout`(조건부 UPDATE `cancelled`/`cancelledBy='timeout'`/`WEBCHAT_IDLE_TIMEOUT`)로 회수 + `revokeAllForExecution`. EIA-RL-06 형제 sweep. §7.4 무기한 보존 불변식과 정합(§1.1 예약 "타임아웃" 사유 구현, EIA token-lifecycle sweep). spec lock = EIA §3.4 EIA-RL-07·§R19. **구현 완료(PR-2)**.

## §5.5 가 `410`(`EXECUTION_TERMINATED`) 분기를 담지 않는다 (2026-08-11 등재)

**방향이 반대인 갭이다** — 이 문서의 다른 항목은 "spec 이 약속했는데 구현이 없다" 인데, 이건
**구현이 하는 일을 spec 이 안 적는다**.

`POST .../refresh-token` 은 종료된 execution 에 대해 `410 Gone` / `EXECUTION_TERMINATED` 를 낸다 —
근거는 `interaction.controller.ts:149`(`@ApiGoneResponse`)와 `interaction.service.ts`(`GoneException`).
그런데 §5.5 응답 예시는 그 자리를 **`401` 로만** 적는다.

**어떻게 드러났나**: `7-channel-web-chat/3-auth-session.md §R4` 가 "재차 `401`·`410` 이면 종료" 를
정하면서 근거로 §5.5 를 인용했는데, consistency 의 `cross_spec`·`rationale_continuity` **두
checker 가 독립적으로** "인용이 가리키는 절이 오히려 반대를 말한다" 를 잡았다(`11_10_16`).
그 인용은 코드 SoT 를 가리키도록 바꿨고, EIA 본문 정정은 이 항목으로 넘긴다.

- [x] §5.5 에 `410 Gone (EXECUTION_TERMINATED)` 응답 추가 — **완료(2026-08-11)**. 다만 아래
      "티켓보다 넓었다" 참조: 표에는 `410` 이 **이미 있었고**(이 항목의 절반은 stale), 대신
      refresh 전용 코드 3종이 표에 통째로 없었다.
- [x] 추가 후 `3-auth-session.md §R4` 의 "EIA 본문은 아직 담지 않는다" 캐비엇 제거 — **완료**.
      "`410` 은 복구 불가" 근거(토큰 회전이 terminal 검사보다 먼저)를 대신 남겼다.

### 실측하니 티켓보다 넓었다 (2026-08-11)

착수 전 `interaction.service.ts` `refreshToken` 을 읽고 분기를 전수로 세었더니, §5.5 의 그
`401` 한 줄이 **두 가지를 다 틀리고 있었다**:

| §5.5 가 `401` 이라 적은 것 | 실제 |
| --- | --- |
| "execution 종료됨" | **`410` `EXECUTION_TERMINATED`** (티켓이 등재한 항목) |
| "expiresAt 까지 30분 이상 남음" | **`400` `TOKEN_REFRESH_NOT_IN_WINDOW`** (**티켓에 없던 항목**) |

그리고 refresh 전용 코드 **3종**(`TOKEN_REFRESH_FORBIDDEN` 403 · `TOKEN_REFRESH_NOT_IN_WINDOW`
400 · `TOKEN_REFRESH_FAILED` 400)이 §5.1 에러 코드 표에 **하나도 없었다**. 티켓은 `410` 만
보고 있었으므로 그것만 고쳤다면 나머지 절반은 그대로 남았을 것이다.

**자매 자리 하나가 더 깨져 있었다.** 표 아래 "토큰 실패 status 통일 근거" note 가
"모든 토큰류 실패는 단일 `401` 로 수렴한다" 고 단정하는데, `403 TOKEN_REFRESH_FORBIDDEN` 이
정면으로 반례다. 새 코드를 넣으면서 그 note 를 안 고쳤다면 **문서가 자기 표와 모순**한다 —
"검증 실패(Guard 가 핸들러 이전에 판정)" 로 범위를 좁히고 403 이 왜 예외인지 적었다.

**data-flow 는 이미 맞게 적고 있었다.** [`15-external-interaction.md §1.2`](../../spec/data-flow/15-external-interaction.md)
가 `itk_*` 403 · terminal 410 · 30분 윈도우를 전부 정확히 서술한다. 즉 이건 설계 변경이 아니라
**§5.5 만 홀로 stale** 했던 것이고, 같은 저장소 안에 이미 정답이 있었다.

> **교훈**: 등재된 티켓의 범위는 **발견 시점의 시야**일 뿐이다. 착수 전 그 자리를 코드로 다시
> 읽으면 티켓이 못 본 형제 결함이 같이 나온다 — 이 저장소가 이미 등재한 "반증된 전제는 더 큰
> 결함의 덮개다" 와 같은 형태다.

## 후속 (cross-cutting, 본 spec 밖)
- [x] **Redis fixed-window rate-limiter INCR+EXPIRE 원자화** — `PublicWebhookQuotaService.incrWithWindow` 를 `INCR + EXPIRE ... NX` 단일 pipeline(매 요청)으로 교정해 TTL 유실 self-heal (fail-closed 잠금 창 제거). `ChatChannelRateLimiterService` 는 **이미** 동일 `INCR + EXPIRE NX` 단일 pipeline 패턴이라 무변경(점검 완료). `InteractionRateLimiterService`(item 5)는 Lua EVAL — 세 서비스 모두 원자/self-heal 확보. (PR #843 ai-review concurrency WARNING 후속, `task_fa5c5e84`.)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__14-external-interaction-api.md 참조.
- 핵심 surface (REST 명령·SSE 스트림·iext/itk 토큰·HMAC 서명·SSRF·secret rotation·idempotency·CORS) 는 구현 완료. 위 항목은 hardening/배율/분산성 갭이며 기능 데드락은 아님.

### consistency 라운드가 넷을 더 잡았다 (`16_51_08`, 전원 BLOCK:NO)

착수 시 실측이 티켓보다 넓었듯, 리뷰도 내 정정보다 넓었다. 5 checker 전원 BLOCK:NO 였으나
**처분할 것이 넷** 나왔고 전부 고쳤다:

| # | 잡은 checker | 내용 |
| --- | --- | --- |
| 1 | **convention · plan_coherence (독립 2명)** | 내가 인용한 **`§3.3`** 이 틀렸다 — 에러 코드 표는 **§5.1** 이고 §3.3 은 인증 요구사항(EIA-AU-*) 표다. spec 2곳 + 이 plan 1곳, **또 복제** |
| 2 | **convention · cross_spec (독립 2명)** | `3-error-handling.md §1.6` 이 "정의의 SoT 는 EIA §5.1 표" 라 선언한 **미러 카탈로그**인데 새 코드 3종이 반영 안 됨. 게다가 그 표의 "모든 토큰류 실패는 단일 401" 이 `403` 과 정면 반례가 됨 |
| 3 | **rationale_continuity · cross_spec** | **§R14 본문 자체**가 "모두 `401`(`403` 미사용)" 이라 단정. 나는 §5.1 표·콜아웃에만 예외를 적고 **정본 Rationale 은 안 고쳤다** |
| 4 | **plan_coherence (보너스)** | §5.2 가 위젯 소비 분기를 "미배선(no-op)" 이라 적는데 **2026-07-17 에 이 plan 이 `[x]` 로 닫은 항목**이다. 형제 문서 `1-widget-app.md §3.1` 은 이미 "모두 구현" — **§5.5 와 똑같이 §5.2 만 홀로 stale** |

**#3 이 가장 값지다.** rationale_continuity 가 `git log -S` 로 §R14 도입 커밋(`907616c61`, #604)을
찾아 **당시 실제로 기각한 것**을 확인했다 — 기각 대상은 "scope/audience 를 403 으로 세분" 뿐이고
그 둘은 지금도 401 이다. 나아가 `TOKEN_REFRESH_FORBIDDEN` 이 **구현 최초 커밋(#230)부터** 있었고
data-flow §1.2 가 **R14 와 같은 커밋에서** "itk_* 는 403" 을 적었음을 밝혔다 — 즉 R14 저자도
예외를 알고 범위를 Guard 로 좁혀 썼는데 **제목과 표가 그 좁힘을 안 담아** drift 로 보였던 것이다.
그래서 처분은 "예외를 추가" 가 아니라 **R14 의 실제 범위를 제목·본문에 명문화**하는 형태가 됐다
(R14 는 "검증" 이라는 한정어를 쓴 적이 없으므로 "복원" 이 아니라 **처음 명문화**다 — 2라운드
`rationale_continuity` 의 정정).

### 그리고 나는 리뷰어의 이력 주장을 검증 없이 spec 에 옮겨 적었다

1라운드 `rationale_continuity` 가 "data-flow §1.2 는 R14 와 **같은 커밋**(`907616c61`)에서
도입됐다" 고 보고했고, 나는 그것을 **정본 Rationale 에 그대로 옮겨 적었다.**

**거짓이었다.** 2라운드가 `git blame` 으로 잡았고 나도 직접 실측했다 — 그 문장은
`db496a3c2`(#516, **2026-06-10**), R14 는 `907616c61`(#604, **2026-06-14**). **4일 앞선 별개 PR** 이다.
1라운드는 "그 커밋이 파일을 건드렸다"(참)와 "그 커밋이 그 줄을 도입했다"(거짓)를 혼동했다.

교훈은 둘이다:

1. **리뷰어의 보고도 실측 대상이다.** 특히 `git log -S` 류 이력 주장은 명령 하나로 확인
   가능한데, 나는 확인하지 않고 **영구 문서**에 썼다. 이 저장소는 "지어낸 Rationale" 을 이미
   경계한다 — 남이 지어낸 것을 옮기는 것도 같은 결과다.
2. **정정된 사실이 논지를 더 강하게 만들었다.** "같은 커밋" 이면 우연일 수 있지만, **4일 먼저
   있었다**면 R14 가 쓰일 때 그 서술은 이미 저장소에 있었다는 뜻이다. 약한 주장을 검증 없이
   쓰느니 실측하는 편이 결과도 낫다.

그리고 의도 귀속("저자도 알고 좁혀 적었다")은 커밋 이력으로 확정 불가라 뺐다 — 대신 R14
**본문 자체**가 근거를 `interaction.guard.ts deny()` 로 한정한다는 텍스트 사실만 남겼다.

**#4 는 이 티켓이 고친 결함과 같은 클래스**가 같은 파일에 하나 더 있었다는 뜻이다 — plan 이
닫은 항목을 spec 한 곳이 못 따라간 것. 티켓 범위 밖이지만 실측으로 확인하고 같이 닫았다.

> **교훈**: 새 사실을 표에 넣을 때 **그 표를 미러하는 문서**와 **그 표의 근거 Rationale** 이
> 자매 자리다. 나는 표만 고치고 미러(#2)와 정본(#3) 을 놓쳤다. 이 저장소가 이미 등재한
> "SoT 한쪽만 고친다" 의 재발이며, 이번엔 **미러가 자기가 미러임을 문서에 적어 두었는데도**
> 놓쳤다.
