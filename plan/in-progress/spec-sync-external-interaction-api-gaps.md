---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# external-interaction-api — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/14-external-interaction-api.md

## 미구현 항목
> **결합 항목을 둘로 쪼갰다** (`08_45_50` plan_coherence W4). 두 필드는 비용이 다르고
> (`durationMs` 는 취소 경로 배관 5곳, `result.outputs` 는 **spec 이 내용을 정의한 적조차 없다**)
> 착수 시점도 갈렸다. 한 체크박스로 두면 `durationMs` 완료 시 **통째로 닫히면서
> `result.outputs` 가 조용히 사라진다** — 이 세션에서 이미 겪은 형태다.

- [ ] **`result.outputs` emit** — **먼저 planner 턴에서 내용을 정의해야 한다.** spec 은
      > **괄호 안 근거가 낡았다 (2026-08-29 재실측).** 아래 본문의
      > "(현재 `execution.completed` payload 는 `{status}` 하나)" 는 거짓이다 —
      > `durationMs` 가 2026-08-15 에 실려 **`{status, durationMs}` 둘**이고, 같은 spec 문서
      > §6.3 이 그렇게 적는다. **항목 자체와 핵심 근거는 그대로 유효하다** —
      > `result.outputs` 행은 여전히 "미구현 (Planned)" 이고 shape·의미를 정의한 문장은
      > 0건이다(2026-08-29 확인). 낡은 것은 "지금 1필드뿐" 이라는 대비이지 "채우면 계약을
      > 발명하게 된다" 는 판단이 아니다.
      > <!-- 원 감사 메모 -->
      > **무엇이 낡았나**: 괄호 안 '(현재 `execution.completed` payload 는 `{status}` 하나)' 가 낡았다 — 2026-08-15 durationMs 완료로 이미 2필드다. '{status, durationMs} 둘' 로 고치고, '신규 데이터 클래스가 열린다' 근거는 유지.
      > **실측**: spec/5-system/14-external-interaction-api.md:593 아직 '미구현 (Planned)' — 항목 자체는 유효. 그러나 같은 문서 §6.3(762~779)은 payload 를 {status, durationMs} 로 싣는다(durationMs 행도 '구현됨').
      이름만 두고 shape·의미를 적은 문장이 0건이다. 채우면 외부 webhook 에 신규 데이터
      클래스가 열리는데(현재 `execution.completed` payload 는 `{status}` 하나) 크기 상한이
      없다. 소비처 0곳
- [x] **`durationMs` emit** — **완료 (2026-08-15, `0f0050dea`+`0dce2a83f`)**. 종결 3종
      16 경로 전부. 엔티티 미로드 5곳은 UPDATE 문 안에서 SQL 계산 + `RETURNING`.
      필드 집합 표의 `durationMs` 행을 **"구현됨" 으로 flip 했다**(`0dce2a83f`).
      > **아래는 2026-08-13 등재 시점 원문이다 — 전부 해소됐다.** 취소선을 절반만 쳐 둬서
      > "아직 payload 에 안 실린다" 로 오독될 수 있었다 (`11_44_10` documentation W4).
      >
      > ~~데이터는 emit 직전에 이미 존재하는데 payload 에 넣지 않는다 —
      > `EXECUTION_COMPLETED` emit 4곳 + `retry-turn` 2곳이 `{status}` 만 싣는다.~~
      >
      > 착수 시 세어 보니 **completed 만 6곳**이었고(원문은 4곳), 종결 3종 전체로는
      > **16 경로**였다 — 등재 시점 추정이 실측보다 작았다.
- [x] **`execution.failed` 의 `error` 를 객체로 통일** (§6 필드 집합 표 `error` 행,
      2026-08-13 등재 → **2026-08-14 완료**). emit 4곳을 `toTerminalErrorPayload` 로 일원화.
      > **"wrap 과 union 을 함께 제거한다" 는 원래 계획을 절반만 집행했다 — 의도적이다.**
      > `chat-channel.dispatcher.ts` 의 string 분기는 **배포 경계에서 재생되는 레거시
      > 이벤트 흡수용으로 유지**한다. 제거하면 그 창 동안 사용자가 CCH-ERR-* 안내를 못 받는
      > silent skip 으로 되돌아간다(2026-05-25 에 고친 그 회귀다). 지어낸
      > `'INTERNAL_ERROR'` 만 `null` 로 정리했다.
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
- [x] **~~SSE/fanout 의 `nodeOutput` 은 여전히 fail-open deny-list 다~~ 해소 (2026-08-23) —
      `waiting_for_input` 표면 한정** (등재 2026-08-23, `18_30_40` plan_coherence W2 — 위 REST
      항목에서 **의도적으로 분리**). **`node.*` 이벤트 표면은 아래 신규 항목으로 분리.**
      > **착수하니 전제 둘이 뒤집혔다.**
      >
      > 1. **호출부는 넷이 아니라 하나였다.** 아래 실측이 나열한 세 서비스가 전부
      >    `WebsocketService.toFanoutEnvelope` 한 함수를 지난다 — 그 함수가 이미
      >    **외부 전용**이라(내부 WS 는 그 전에 `broadcastToChannel` 로 나간 뒤다)
      >    호출부를 하나도 건드리지 않고 닫혔다. *"envelope shape 이 달라 한 줄 대칭
      >    적용이 안 된다"* 는 (a) 는 틀렸다: payload 가 envelope 에 **평평하게** 펼쳐져
      >    위치가 REST 와 동일하다(`nodeOutput` / `buttonConfig.nodeOutput`).
      > 2. **(b) 는 맞았고, 그래서 목록이 넓어졌다.** *"잘못 좁히면 외부 채널 렌더가
      >    깨진다"* 를 실측하니 chat-channel 렌더러가 `nodeOutput.payload`·`.title`·
      >    `.rendered`·`.nodeType` 를 **top-level flat legacy shape** 으로 읽는데 그
      >    넷이 allowlist 에 **없었다**. 그대로 걸었다면 Discord/Telegram/Slack 메시지가
      >    조용히 비었다 — 유출이 아니라 기능 파손이라 마스킹 테스트로는 안 잡힌다.
      >    넷을 wire 전용 그룹에 넣고 리터럴 테스트로 못박았다.
      >    - **위젯(#1205)은 회귀가 아니었다** — `channel-web-chat` 은 `output.rendered`·
      >      `config.items` 처럼 한 겹 아래로 읽어 전부 allowlist 안이다(실측).
      >
      > §R17 표의 SSE 행을 flip 하고 *"REST·SSE 방어 강도가 다르다"* 서술을 폐기했다.
      > WS §4.4 의 *"fanout envelope 을 내부 WS store 와 SSE 가 공유한다"* 에도
      > `nodeOutput` 키 집합만은 공유하지 않는다는 단서를 달았다.

      <details>
      <summary>등재 당시 본문 (반증된 전제 포함 — 이력 보존)</summary>

      `toFanoutEnvelope` 는 **envelope 레벨**에서 `stripExternalOnlyFields` 를 걸므로 그 안의
      `nodeOutput` 에 allowlist 를 대려면 별건 변경이 필요하다. 같은 `_retryState` 를 나르고,
      **chat-channel 어댑터가 같은 subject 를 구독**해 blast radius 가 REST 열람자보다 넓다.
      > **왜 같이 안 닫았나**: (a) envelope shape 이 달라 한 줄 대칭 적용이 안 되고,
      > (b) 그 payload 를 chat-channel 렌더러가 소비하므로 잘못 좁히면 **외부 채널 렌더가
      > 깨진다** — REST 열람(읽고 버림)과 위험이 다르다.
      > **착수 시**: EIA §R17 의 표에서 이 행을 flip 하고, "REST·SSE 방어 강도가 다르다" 는
      > 서술을 함께 지운다. 그 표가 이 항목의 SoT 다.
      >
      > **호출부 실측 (`19_00_23` security W1 이 보강)** — 다시 찾지 말 것:
      > `FormInteractionService.waitForFormSubmission` 과
      > `ButtonInteractionService.waitForButtonInteraction` 이 아무 필터 없이
      > `nodeOutput` / `buttonConfig.nodeOutput` / `nodeOutputForEvent` 를 실어
      > `toFanoutEnvelope` 를 지난다. **`processButtonResumeTurn` 도 같은 경로다**
      > (`19_24_24` security W1 이 추가로 짚었다). REST 와 **같은 인가**(`verifyOwnership`)를
      > 쓰는 같은 수신 인구이고, chat-channel 어댑터가 같은 subject 를 구독한다.
      > **재사용할 헬퍼는 이미 있다** — `nodes/core/node-output-allowlist.ts` 의
      > `allowlistNodeOutputKeys`. envelope 안에서 `nodeOutput` 서브트리를 찾아 거는 것이 일이다.

      </details>

- [x] **wire-only 키가 `node-output.md` Principle 0 의 닫힌 레지스트리 밖이다** (~~4키~~ → **8키**)
      > **해소 (2026-08-24, `planner-doc-batch`)**: Principle 0 에 `wire 전용` 각주 신설 — 두 갈래 8키 표(위젯 파서 4 / chat-channel 렌더러 4)이고 라벨은 ~~`NODE_OUTPUT_ALLOWED_KEYS` 주석과~~ **EIA §R17 과** 같은 문구를 썼다(코드 JSDoc 은 접미어 없는 축약형이라 문자 그대로 같지는 않다 — `16_41_05` convention W3 정정. **키 배열 자체는 정확히 일치**하므로 기능 위험은 없다). **5필드 목록은 넓히지 않았다** — 이 키들은 핸들러 산물이 아니라 wire 조립 레이어의 산물이라, 계약에 편입하면 모든 핸들러가 지켜야 할 것처럼 읽힌다.
      (2026-08-23 등재, `20_09_38` convention_compliance W3 · `22_26_33` plan_coherence W4 로
      키 수 갱신). 그 규약은 `NodeHandlerOutput` 을 **5필드 + 3예외** 닫힌 목록으로 못박는데,
      EIA wire 조립 레이어는 거기에 없는 키를 top-level 로 얹는다 — **착수 시 다시 세라**,
      정본은 `NODE_OUTPUT_ALLOWED_KEYS` 의 wire 전용 두 그룹이다:
      - 위젯 파서: `formConfig`·`conversationConfig`·`buttonConfig`·`interactionType`
      - chat-channel 렌더러: `payload`·`title`·`rendered`·`nodeType` (2026-08-23 SSE 작업이 추가)

      `NODE_OUTPUT_ALLOWED_KEYS` 가 그 사실을 **컴파일타임 SoT 로 명문화**하면서 규약과의
      간극이 드러났다.
      > **동작 결함은 아니다** — 실제 소비처가 그 키들을 읽고(실측), allowlist 가
      > fail-closed 로 통과시킨다. 문제는 **규약 문서가 그 층의 존재를 모른다**는 것이다.
      > **planner 소관**: Principle 0 에 "EIA wire 조립 레이어가 추가하는 wire-only 필드는
      > `NodeHandlerOutput` 계약 **밖**" 각주를 다는 편이 낫다 — 5필드 목록을 넓히면
      > 핸들러 계약이 오염된다.

- [x] **~~`execution.node.completed`/`.failed` 의 `envelope.output` 은 아직 deny-list 다~~
      해소 (2026-08-24)** (등재 2026-08-23, `23_29_27` cross_spec **CRITICAL**).
      > **착수하니 이 항목이 적어 둔 유예 근거가 틀렸다.** 아래 *"같은 목록을 그대로 걸면
      > 깨진다"* 의 `{}` **측정 자체는 맞았지만**, 그 객체가 `outputData` 가 된다는 **전제**가
      > 틀렸다 — `resolveButtonInteraction` 의 flat record 는 `setNodeOutput` 으로 in-memory
      > `nodeOutputCache` 에만 들어가고, `nodeExec.outputData` 에 대입되는 것은
      > `buildResumedStructuredOutput` 이 반환하는 **`NodeHandlerOutput`** 이다.
      >
      > **실 DB 조회로 확정**(e2e 285건 후 teardown 전, `node_execution.output_data` 93행 중
      > 84행 object·배열/스칼라 0행): top-level 키는 `meta`(83)·`config`(82)·`output`(81)·
      > `port`(20)·`status`(7)·`conversationConfig`(1) 뿐, **전부 목록 안**. flat record 는
      > 한 행도 없다. 그래서 같은 목록을 그대로 걸었다.
      >
      > **교훈**: *"그 객체에 목록을 걸면 어떻게 되나"* 를 쟀고, 물었어야 할 것은
      > **"그 객체가 이 표면에 도달하나"** 였다. 프록시를 재고 유예 결론을 냈다.
      >
      > **파생 신규 항목**: `finalAdapted ?? nodeOutputCache` 폴백이 flat view 를
      > `outputData` 로 영속할 수 있다(285건 미발현) — 아래 별도 항목.

      <details>
      <summary>등재 당시 본문 (반증된 유예 근거 포함 — 이력 보존)</summary>
 같은 `NodeExecution.outputData` 를
      **`output`** 이라는 다른 키로 최상위에 싣는 표면이라, `nodeOutput` 만 찾은 SSE 작업이
      그대로 지나쳤다. `_retryState` 가 여기로 나간다.
      > **왜 놓쳤나 — 질문이 한 칸 좁았다.** *"`nodeOutput` 이 어디 있나"* 를 물었어야 할 자리에서
      > 물었어야 할 질문은 *"`NodeHandlerOutput` 이 어느 문으로 나가나"* 였다. 키 이름이 다르면
      > grep 이 침묵한다.
      >
      > **emit ~~5곳~~ 6곳 (실측 — 다시 찾지 말 것)**: `execution-engine.service.ts` 2곳
      > (NODE_COMPLETED · NODE_FAILED) · `form-interaction.service.ts` ·
      > `button-interaction.service.ts` · `ai-turn-orchestrator.service.ts`. 전부
      > `output: <nodeExec>.outputData` 이고 `emitNode` → `emitNodeEvent` →
      > `toFanoutEnvelope` 를 지난다 — **배선 지점은 여전히 그 한 함수다.**
      >
      > ## ⚠️ 같은 목록을 그대로 걸면 **깨진다** (실측 — 이 항목의 핵심)
      >
      > `envelope.output` 은 `NodeHandlerOutput` **하나가 아니다.** 버튼 재개 경로는
      > `{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}`
      > 를 `outputData` 에 저장하는데(`button-interaction.service.ts:180`), **정본**
      > `allowlistNodeOutputKeys` 에 넣어 보면 **`{}`** 다 — 13키 중 하나도 안 맞는다.
      > carousel+buttons 는 presentation 타입이라 chat-channel dispatcher sub-filter 도
      > 통과하므로 **외부 발송이 통째로 빈다**.
      >
      > **그래서 이건 키를 더 넣는 일이 아니라 shape 판별 문제다.** 착수 시 먼저 답할 것:
      > `NodeExecution.outputData` 가 실제로 취하는 shape 이 몇 가지인가(핸들러 반환 ·
      > 폼/버튼 재개 record · AI turn record …), 그리고 그 판별을 **런타임 휴리스틱 없이**
      > 할 수 있나. 못 하면 좁히기를 넣지 말 것 — fail-open 을 fail-broken 으로 바꿀 뿐이다.
      >
      > **안 닫은 방향은 캐너리가 고정한다**: `websocket.service.spec.ts` 의
      > `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다`.
      > 이 항목을 닫으면 **그 단언이 뒤집히는 것이 작업의 일부**다.

      </details>

- [ ] **`finalAdapted ?? nodeOutputCache` 폴백이 flat view 를 `outputData` 로 영속할 수 있다**
      (2026-08-24 등재, `envelope.output` 작업의 파생). `ai-turn-orchestrator.service.ts` 의
      그 폴백은 `execution-context.service.ts` 주석이 *"already-flattened engine output …
      의도적으로 bare (예: `{parameters: {}}`)"* 라 부르는 view 를 `outputData` 에 쓴다 —
      그 컬럼의 계약은 `NodeHandlerOutput` 인데.
      > **실측: e2e 285건 실 DB 조회에서 한 행도 안 나타났다**(top-level 키 6종 전부
      > `NodeHandlerOutput` 계약 안). 즉 **현재 발현하지 않는 잠재 경로**다.
      > **이번에 안 고친 이유**: 이건 egress 마스킹이 아니라 **영속 계약** 문제다. 고치려면
      > 폴백이 무엇을 써야 하는지(adapt? 빈 객체? throw?)를 정해야 하고, 그 결정이 표현식
      > 리졸버·실행 이력 UI 까지 번진다 — allowlist PR 에 얹을 크기가 아니다.
      > **현 동작은 캐너리가 고정한다** — `websocket.service.spec.ts` 의
      > `[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다`.
      > **재개 신호**: 그 폴백이 실제로 발현한 행이 관측되면(운영 DB 또는 새 e2e 시나리오).

- [x] ~~🔴 **`system_error` 재시도 배너가 라이브 WS 경로에서 안 뜬다**~~ → **완료
      (2026-08-28, `system-error-banner-live-ws`)**. 아래 실측이 전부 그대로 확인됐고,
      **표면이 하나 넓었다** — `node.completed`(`port:'error'`) 호출부도 `payload.output` 을
      넘기면서 헬퍼가 래퍼를 **한 겹 얕게** 봐서 못 찾고 있었다(뮤테이션으로 확인).
      `conversation-thread.md §9.7` 위 ⚠️ 마커와 `6-websocket-protocol.md §4.2` 의 얕은
      표기 3곳도 같은 PR 에서 정리했다. (원 등재 내용 ↓)
      🔴 **`system_error` 재시도 배너가 라이브 WS 경로에서 안 뜬다 — spec 문구가 낳은 프런트 결함**
      (2026-08-24 등재, `12_24_55` cross_spec **CRITICAL**). **문서 정합이 아니라 실제 기능
      결함**이다.
      > **실측 (다시 찾지 말 것)**:
      > - `NODE_FAILED` emit **4곳 전수** — `execution-engine.service.ts:6302`·`:6378`·`:8018`,
      >   `ai-turn-orchestrator.service.ts:1537` — 이 top-level `error` 를 **`string`**
      >   (message only)으로 보낸다. 구조화 객체는 `output.output.error` 에만 있다.
      > - `use-execution-events.ts:894` `handleNodeFailed` 는
      >   `extractNodeErrorPayload(payload.error, undefined)` 를 부른다. 그 함수는 `rawError`
      >   가 **객체일 때만** `direct` 를 잡고 `rawOutput` 이 `undefined` 라 `nested` 도 없다
      >   → **항상 `null`** → `system_error` APPEND 블록이 한 번도 실행되지 않는다.
      > - 그 함수의 주석이 *"§4.1 갱신 — `execution.node.failed.error` 는 `output.error`
      >   전체 구조"* 다. **틀린 spec 문구를 코드가 믿었다.** 그 문구는 2026-08-24 에 정정했다.
      >
      > **`handleNodeCompleted`(`:804`)도 같이 봐야 한다** — `extractNodeErrorPayload(undefined,
      > payload.output)` 인데 `nested` 가 `rawOutput.error` **한 단**만 본다. `payload.output`
      > 은 래퍼라 구조화 에러는 `output.output.error` **두 단** 아래다.
      >
      > **왜 이 PR 에서 안 고쳤나**: (a) frontend 를 전혀 건드리지 않는 egress-masking PR 이고,
      > (b) 고치면 **배너가 새로 뜨기 시작**하는 UI 동작 변경이며, (c) 현재 테스트
      > (`CT-S9`/`CT-S10`)가 **존재하지 않는 shape 을 fixture 로 쓰고 배너 미표시를 의도된
      > 동작으로 단언**하고 있어 fixture 교체가 함께 필요하다. 자기 PR 로 가야 한다.
      >
      > **착수 시**: `extractNodeErrorPayload(payload.error, payload.output)` + `nested` 를
      > `rawOutput.output.error` 2단 접근으로. `CT-S9`/`CT-S10` fixture 를 실 backend shape
      > (`error: string` + `output.output.error` 객체)으로 교체하고 *"legacy string"* 주석 정정.
      >
      > **문서는 이미 정정돼 있다** (2026-08-24, `#node-output-envelope`): WS §4.1 과
      > `conversation-thread.md` §9.7 **두 행**이 실측 shape 으로 고쳐졌고 각각 *"이 문구가
      > 프런트 결함을 낳았다"* 는 인과까지 적혀 있다. **착수 시 그 문구를 다시 고칠 게 아니라,
      > 코드를 그 문구에 맞추고 §9.7 위의 ⚠️ 블록을 지우면 된다** — 그 블록이 "아직 안 고쳐진
      > 코드" 를 가리키는 표지다.

- [ ] **`conversation-thread.md` 의 `code:` 가 thread 로직을 가진 execution-engine 파일들을
      빠뜨렸을 수 있다** (2026-08-24 등재, `13_30_49` cross_spec W1 의 후반부 — B4 를
      won't-do 로 닫으며 갈라져 나온 **별개의 더 큰 질문**).
      > B4 는 *"`websocket.service.ts` 를 넣자"* 였고, `code:` 정의(**"본 spec 이 약속한
      > surface 의 구현 경로"**)에 안 맞아 won't-do 로 닫았다. 그런데 checker 가 그 판정
      > 과정에서 **반대 방향**을 짚었다 — `execution-engine`/`ai-turn-orchestrator`/
      > `form-interaction`/`button-interaction` 은 thread 를 **실제로 누적·영속**하는데
      > `code:` 에 없다.
      > **미판정으로 남긴다**: 그 넷이 conversation-thread 가 *약속한 surface* 를 구현하는지,
      > 아니면 thread 를 **소비**만 하는지 갈라야 한다. 현재 `code:` 16항목의 선정 기준을
      > 역추적(`git log -S`)해 판단 축을 먼저 세울 것 — 축 없이 넷을 넣으면 목록이
      > *"thread 를 건드리는 모든 파일"* 로 부풀어 가드 신호가 오히려 죽는다.

- [ ] **`--spec` 의 `target_path` 가 plan 파일 하나로 고정돼 자매 트래커가 검토 밖에 있다**
      (2026-08-24 등재, `17_15_29` requirement INFO 3 — **위 후보 미도달과 다른 고장**).
      > **실측**: `review/consistency/2026/08/24/*/meta.json` 의 `target_path` 가 세 라운드
      > 모두 draft plan(`spec-draft-planner-doc-batch.md`) **한 개**다. 그래서 같은 작업이
      > 갱신하는 **정본 트래커**(`spec-sync-external-interaction-api-gaps.md`)는
      > **어느 라운드에서도 검토 대상이 아니었다.**
      >
      > **증상이 실제로 났다**: `16_41_05` 가 draft 의 B3 근거를 CRITICAL 로 반증했는데,
      > **같은 근거를 담은 트래커 줄은 그대로 남았다**. 세 라운드를 돌고도 안 잡혔고,
      > `/ai-review` 가 뒤늦게 잡았다(W2·W3). 즉 **게이트를 여러 번 도는 것으로는 못 메운다** —
      > 스코프 밖은 몇 번을 돌아도 스코프 밖이다.
      >
      > **위 항목(후보 미도달)과 구분할 것**: 그쪽은 *"관련 문서를 번들에 못 싣는다"*,
      > 이쪽은 *"target 자체가 한 개로 고정"* 이다. 처방도 다르다 — 후자는
      > `--spec` 이 **여러 target 을 받거나**, draft 의 `spec_impact`/자매 plan 을 자동으로
      > target 에 포함하면 된다.
      >
      > **당장의 완화책**: draft 와 트래커를 **같은 커밋에서** 고치고, 게이트 결과를 draft 에
      > 반영할 때 **트래커의 같은 항목도 함께 훑는다**(이번에 그렇게 했어야 했다).

- [ ] **`--spec` 번들러가 `spec_impact` 대상을 후보 집합에 넣지 못한다 (하네스)**
      (2026-08-24 등재, `13_30_49`·`16_41_05` 실측).
      > **두 고장이 섞여 있다 — 이걸 갈라야 고칠 수 있다:**
      >
      > | 파일 | 프롬프트에서의 상태 | 예산을 올리면 |
      > |---|---|---|
      > | `spec/5-system/6-websocket-protocol.md` | **절단 목록**에 있음(후보이긴 하다) | 도움 될 수 있다 |
      > | `spec/conventions/node-output.md` | **bundle 에도 절단 목록에도 없다** | **소용없다 — 후보가 아니다** |
      >
      > **실측**: `CONSISTENCY_MAX_CONTEXT_SIZE=900000` 으로 올려도 후자는 안 들어온다.
      > 파일을 **변경한 뒤** 돌려도 안 들어온다 — `--diff-base` 랭킹은 *"바꾼 파일 우선"* 이라
      > 광고하지만 그건 **후보를 재정렬**할 뿐 비후보를 후보로 만들지 않는다(2회차 `16_41_05`
      > 로 반증). 즉 `related_specs` **후보 선정** 단계의 도달성 문제다.
      >
      > **왜 중요한가**: planner 가 `spec_impact` 에 적은 **바로 그 파일**을 게이트가 못 본다.
      > `13_30_49` 이 그 상태에서 CRITICAL 을 냈고, 그건 **오탐이었다**(같은 절의 다른 각주를
      > 내 것으로 오인). 후보 선정이 `spec_impact` 를 **무조건 포함**하도록 고치는 것이
      > 가장 작은 처방으로 보인다.
      >
      > **현재 완화책**: 프롬프트가 스스로 지시하는 *"판정에 관련되면 `Read` 로 직접 열어라"*.
      > checker 들이 실제로 그렇게 하고 있어(여러 라운드에서 관측) 게이트가 무의미하진 않다.
      >
      > **기존 harness 트래커와 상호 참조** (`17_04_25` plan W4 — 고립 등재는 중복 진단을
      > 낳는다): `harness-consistency-summary-downgrade-rule.md`(2026-08-09 실측, 동일 처방
      > 미구현) · `harness-review-gate-followups.md`. **이 항목을 그쪽으로 이관하지 않는
      > 이유**: 발견 맥락이 EIA 시리즈이고 재현 근거(`13_30_49`·`16_41_05` 두 라운드)가 여기
      > 쌓여 있다. 다만 **처방은 한 곳에서** 집행돼야 하므로, harness 작업을 착수하는 쪽이
      > 이 항목을 흡수한다.

- [x] **`6-websocket-protocol.md` 에 `### 4.4` 헤딩이 둘이고 절 번호 순서가 어긋난다**
      (2026-08-24 등재, `13_30_49` naming INFO 6). **pre-existing** — allowlist 시리즈가
      만든 것이 아니다.
      > 앵커 링크가 어느 쪽에 걸리는지 불확정이라, 이 문서를 인용하는 spec 이 많은 만큼
      > 실질 위험이 있다. 다만 절 번호 재정리는 **문서 전체의 링크를 훑어야** 해서
      > doc 묶음에 얹을 크기가 아니다. 그 절을 실질 수정할 때 함께.

      **완료 (2026-08-31).** *"문서 전체의 링크를 훑어야 한다"* 는 유예 근거는 맞았다 —
      그래서 훑고 나서, **인용이 0건인 절을 움직였다.** 어느 §4.4 를 건드리느냐가 비용
      전부를 가른다:

      | 절 | 앵커 링크 | 텍스트 인용 | 하위절 앵커 |
      |---|---:|---:|---:|
      | §4.4 사용자 입력 대기 상세 | 26 | 154 | 10 (4.4.5·4.4.6) |
      | §4.4 알림 이벤트 | 4 | 0 | — |
      | §4.3 KB 문서 이벤트 | **0** | **0** | — |
      | §4.5 시스템 이벤트 | **0** | **0** | — |
      | §4.6 외부 표면 매핑 | 1 | 2 | — |

      - **처방**: 인용 ~190건의 §4.4(대기 상세)는 **번호도 위치도 그대로 두고**, 인용 0건인
        §4.3(23줄)을 그 앞으로 올린 뒤 꼬리 3절만 밀었다 — 알림 4.4→**4.5**, 시스템
        4.5→**4.6**, 외부 표면 4.6→**4.7**. 결과 `4.1 · 4.1-a · 4.2 · 4.3 · 4.4 · 4.4.5 ·
        4.4.6 · 4.5 · 4.6 · 4.7` 로 중복 0 · 오름차순.
      - **380줄짜리 절을 옮기는 대안을 버린 이유**: 순서만 맞추려고 §4.4(대기 상세)를
        내리면 diff 가 380줄이 되고, 번호를 맞추려고 §4.3 으로 개명하면 190건이 깨진다.
      - **동반 정정 7건**: `8-notifications.md` 4건(텍스트 §4.4→§4.5 + 앵커
        `#44-알림…`→`#45-알림…`) · `14-external-interaction-api.md:1124`(§4.6→§4.7 + 앵커) ·
        WS 문서 **자체 내부** 2건(`auth.token_expired`/`system.maintenance` 가 가리키는
        시스템 이벤트 §4.5→§4.6). `plan/complete/spec-fix-eia-token-error-codes.md` 는
        봉인된 시점 기록이라 두었다.
      - **검증**: WS 문서를 가리키는 앵커 링크 **96건 전수**를 헤딩 slug 와 대조 — 내가
        만든/바꾼 5개 앵커 전부 일치. 잔여 깨짐 2건은 `plan/complete/archive/` 의 선재
        결함(`#44-실행-진행-이벤트`, 존재한 적 없는 헤딩)이라 범위 밖.

      - **⚠ 그 검증은 한 칸 좁았다 — 같은 PR 의 `/ai-review` 가 잡았다 (2026-08-31).**
        "앵커 링크 96건 전수" 는 **마크다운 링크만** 센 것이고, `§4.x` **bare 프로즈 인용**은
        훑지 않았다. documentation·requirement·maintainability **3명이 독립적으로** 같은
        근본 원인을 지적했다. 재발 지점 12곳:

        | 파일 | 건수 | 주어 |
        |---|---:|---|
        | `6-websocket-protocol.md` (자기 문서) | 6 | 시스템 3 · 알림 2 · 외부표면 1 |
        | `data-flow/8-notifications.md` | 1 | 알림 (**같은 문단 안에서 190행은 §4.5, 192행은 §4.4** — 자기모순) |
        | `websocket-events.types.ts` · `websocket.service.ts` · `websocket.service.spec.ts` | 4 | 알림 (`codebase/` — 검증 범위 밖이었다) |
        | `spec-sync-websocket-protocol-gaps.md` | 1 | 알림 |

        **이 PR 이 고치던 결함 클래스를 이 PR 이 재생산했다.** `chat-channel` 주석 6곳에서
        "줄 번호로 인용하면 썩는다" 를 고쳐 놓고, 절 번호 이동에서는 **인용의 한 형태만**
        방어했다.

      - **정정 후 재전수 (주어 기준 분류)**: 실질 잔존 오인용 **0건**. 리뷰어가 지목한 9건
        외에 내 sweep 이 **2건을 더 찾았고**(`websocket.service.spec.ts:1268` ·
        `spec-sync-websocket-protocol-gaps.md:53`), 반대로 내 heuristic 오탐 3건은
        손으로 걸러냈다 — `8-notifications.md:347`(그 줄의 `auth.token_expired` 는 **점 표기
        예시**이지 절 참조가 아니다) 과 내 이력 서술 2곳("이동 전 §4.5").

      - **절차로 고정**: spec 절 번호를 옮길 때 대조 대상은 앵커가 아니라 **인용 전체**다 —
        `grep -rn '§<구번호>' spec/ codebase/ plan/in-progress/ .claude/` 로 훑고, **각 건의
        주어**로 분류할 것(같은 `§4.4` 라도 *대기 상세*를 가리키면 정정 대상이 아니다).

- [ ] **`spec-links` 가드가 앵커를 검사하지 않는다** (2026-08-31 등재, 위 항목 작업 중 발견).
      링크의 **파일 경로만** 보고 `#fragment` 는 보지 않는다.
      - **실측(뮤테이션)**: `8-notifications.md` 의 앵커 4건을 존재하지 않는
        `#99-존재하지-않는-앵커` 로 바꾸고 `spec-links.test.ts` 를 돌렸다 →
        **22 passed (GREEN)**. 예측은 RED 였다.
      - **왜 문제인가**: 이 저장소는 절 번호를 실제로 재배치한다(바로 위 항목). 경로가
        살아 있으면 가드가 통과하므로, 절이 사라지거나 번호가 밀린 링크는 **아무 신호 없이**
        남는다. 위 96건 전수 대조는 손으로 했고, 그 방식은 다음 사람에게 남지 않는다.
      - **선재 증거**: 그 전수 대조가 `plan/complete/archive/` 에서 **존재한 적 없는 헤딩**
        (`#44-실행-진행-이벤트`)을 가리키는 링크 2건을 찾아냈다 — 가드가 있었으면 등재
        시점에 잡혔을 것이다.
      - **범위 주의**: 앵커 검사를 켜면 위 2건을 포함한 선재 위반이 한꺼번에 드러난다.
        `plan/complete/archive/**` 를 검사 대상에서 뺄지부터 정해야 착수할 수 있다.

- [x] **provider spec 3곳의 `output.rendered` 가 wire 래퍼 기준인지 미확정**
      > **판정 완료 (2026-08-24) — 경로는 현행 유지**. 세 파일의 같은 표를 행 단위로 읽으니 `chart`=`output.payload.*` · `carousel`=`output.items[]` · `table`=`output.{rows,columns}` · `template`=`output.rendered` 로 일관된 **노드 타입별 출력 shape 표**다. `output.output.*` 로 고치면 나머지 세 행·노드 spec 과 어긋나 **오히려 틀린다**. 진짜 결함은 표가 **어느 계층을 서술하는지 말하지 않는 것**이라, 경로는 두고 **표 상단 각주 1회로 4행 전체**를 덮었다(`13_30_49` naming W5 반영).
      (2026-08-24 등재, `12_13_36` convention_compliance INFO 1). `telegram.md:160` ·
      `slack.md:233` · `discord.md:256` 의 CCH-MP-06 행이 *"`output.rendered` 를 escape 후
      발송"* 이라 적는데, 그 경로의 렌더러 입력은 **wire 래퍼**라 값은 실제로
      `output.output.rendered` 에서 온다.
      > **단정하지 않고 등재한다** — 실측으로 확인한 것은 `extractRendered` 가
      > `rendered` → `payload.rendered` → `output.rendered` **세 후보를 훑는다**는 것뿐이다.
      > 그래서 동작은 어느 shape 이든 맞고, 남은 질문은 **그 문장이 "노드가 무엇을 만드나"를
      > 말하는가, "렌더러가 어디서 읽나"를 말하는가**다. 전자면 현행이 맞고 후자면 한 겹
      > 얕다. 표의 다른 행들과 함께 봐야 갈리므로 **`spec/4-nodes/7-trigger/providers/`
      > 스코프의 planner 턴**에서 판정한다 — 이 PR 의 `spec_impact` 밖이다.

- [x] **래퍼/도메인 구분 산문 사본 4곳을 정본 링크로 대체** (2026-08-24 등재,
      > **해소 (2026-08-24) — 4곳이 아니라 3곳이었다**. WS §4.1-a 는 `#1209` 가 **이미 링크**해 뒀다. 미전환 3곳(EIA §R17 · conversation-thread §9.7 · chat-channel-adapter §1.3)에 정본 인용을 넣었다. 개수 오산은 **또 "열어 본 것만 세고" 형태**(`13_30_49` W3 이 정정).
      `12_55_09` convention W2 의 후반부). 정본은 `node-output.md` Principle 0 에 **세웠고**,
      나머지 4곳(`6-websocket-protocol.md` §4.1-a · `14-external-interaction-api.md` §R17 ·
      `chat-channel-adapter.md` §1.3/§3 · `conversation-thread.md` §9.7)은 아직 각자 산문을
      들고 있다.
      > **왜 이번에 사본까지 안 줄였나**: 정본을 세우는 것과 사본 4곳을 링크로 **갈아끼우는**
      > 것은 위험이 다르다. 후자는 각 문서의 문맥에 맞게 문장을 다시 짜야 하고, 이번 작업이
      > 이미 그 자리들을 네 라운드에 걸쳐 건드린 직후다 — 연달아 또 손대면 리뷰가 따라오지
      > 못한다. **정본이 선 지금은 사본이 늘어나도 대조할 기준이 있다.**
      > **B 묶음(planner doc)과 함께 처리**하는 것이 자연스럽다 — 거기 이미
      > `node-output.md` Principle 0 항목이 있다.

- [x] **`background:run:{id}` 채널이 WS §3.2 "채널 패턴" 표에서 누락** (2026-08-24 등재,
      > **해소 (2026-08-24) — §3.2 에 행 추가로 판정**. `redis-keys.md:84` 가 `background:run` · `execution` · `workflow` **세 채널을 한 행에 묶어** WS §채널 하나를 가리키므로, 포인터를 돌리면 그 행을 쪼개야 하고 *"이 셋은 Redis 키가 아니라 Socket.IO 채널"* 이라는 요지가 흐려진다. 인가 표(§3.3)에 있는 채널이 패턴 표에만 없는 건 분류 문제가 아니라 **누락**이다. 브래킷은 그 문서 컨벤션 `{id}`.
      `10_44_28` convention_compliance W1). §3.3 인가 표에는 나오는데 §3.2 패턴 표에는 없다.
      `redis-keys.md` §4 가 이 채널의 SoT 로 §3.2 를 지목하고 있어 포인터가 빈다.
      > **planner 소관**이고 **선재 갭**이다(이번 작업이 만든 것이 아니다). §3.2 표에 행을
      > 추가하거나, `redis-keys.md` §4 포인터를 `4-nodes/1-logic/12-background.md §8.5` 로
      > 돌린다 — 어느 쪽인지는 planner 판단.

- [x] **WS §4.4 `buttonConfig.nodeOutput` 행에 `nodeType` carve-out 각주 없음**
      > **해소 (2026-08-24) — 단 초판 근거는 반증됐다.** ~~각주에 **동일 이름·다른 계층** 표를 넣었다 — `nodeOutput.nodeType` 은 렌더 서브타입이라 Principle 1.1.4 의 판별자 금지와 무관하다.~~ **`16_41_05` cross_spec CRITICAL 이 반증했다** — 그 값 공간은 `chart`/`table`/`carousel` 로 `payload` 의 노드 종류와 **같고**, C3 가 기각한 바로 그 판별자다. *"렌더 서브타입"* 이라는 구분은 **코드에 없다**(내가 지어낸 것). **재작성된 각주의 논지**: 엔진은 `nodeOutput` 안에 `nodeType` 을 **넣지 않는다**(실 DB 84행 0건) — 즉 **C3 는 이미 지켜지고 있고**, allowlist 항목은 렌더러의 legacy 방어적 읽기를 깨지 않으려는 **예방적 허용**일 뿐이다. 새 코드가 그것을 쓰는 것은 여전히 C3 위반이다.
      (2026-08-24 등재, `00_51_50` convention_compliance INFO 7). 같은 절이 *"판별자 래퍼
      금지"* 를 말하는데 새 `nodeType` legacy carve-out 이 교차 참조 없이 병존한다 —
      오독 여지.
      > **planner 소관.** checker 가 *"선택, CRITICAL/WARNING 아님, 이번 diff scope 밖"*
      > 으로 판정했고, 여기서 §4.4 를 또 고치면 `--impl-done` 게이트가 다시 돌아야 한다
      > (이번 PR 이 그 루프를 다섯 번 돌았다). 다음에 그 절을 열 때 함께.

- [x] **`conversation-thread.md` frontmatter `code:` 에 `websocket.service.ts` 누락**
      > **won't-do 판정 (2026-08-24) — 등재 근거 자체가 잘못됐다**. `spec-impl-evidence.md` §2.1 이 `code:` 를 **"본 spec 이 약속한 surface 의 구현 경로"** 로 정의한다 — **인용 추적성이 아니다**. `websocket.service.ts` 는 conversation-thread surface 를 구현하지 않고(fanout 조립은 EIA §R17 의 surface), 그 문서 기존 `code:` **16항목이 전부 도메인 파일**이라 넣으면 `spec-code-paths.test.ts` 가드 신호가 흐려진다. 원래 근거(§8.4 blockquote 의 `toFanoutEnvelope` 인용)는 **본문 인라인 링크가 이미 해결**한다.
      (2026-08-24 등재, `00_26_17` convention_compliance INFO 4). 그 문서 §8.4 의 정정
      blockquote 가 `toFanoutEnvelope` 를 근거로 인용하는데 glob 이 그 파일에 안 걸린다 —
      가드 위반은 아니고 추적성 갭이다.
      > **planner 소관** (`spec/conventions/**`). 자기-반증형 소정정 예외는 **내가 쓴 문장의
      > 정정**에만 열리고 frontmatter 메타데이터 추가는 그 범위가 아니다 — 그래서 이번 턴에
      > 손대지 않았다. 다음 planner 턴에서 그 문서를 열 때 함께.

- [x] **`egress-masking.md` §2 의 파이프라인 순서가 3단계로 낡았다** (2026-08-23 등재,
      > **해소 (2026-08-24)**: §2 를 **4단계**(`maskWireEnvelope` → `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` → `attachRoutingContext`)로 갱신하고, 새 단계가 fail-closed 인 이유와 **순서가 중요한 이유**(`attachRoutingContext` 뒤에 걸면 그 함수가 얹은 `triggerId`/`chatChannel` 이 목록 밖이라 떨어진다)를 함께 적었다. §1 좌표계 표는 **깊이 상한 표**이고 새 단계는 최상위 전용이라 **해당 없음**(판정). line 77 의 `ws-event-types-extract.md` 미해결 캐비엇은 **유지**(`13_30_49` plan INFO 4).
      `23_29_27` convention_compliance W1). 그 문서가 "구현 좌표계 SoT" 를 자처하는데
      `toFanoutEnvelope` 는 이제 `strip → nodeOutput allowlist → routing` 이다.
      > **planner 소관** (`spec/conventions/**`). §2 순서에 allowlist 단계를 넣거나 §3
      > "표를 갱신한 실례" 목록에 2026-08-23 건을 등재한다.

- [ ] **fanout chokepoint 가 타입이 아니라 주석으로만 강제된다** (2026-08-23 등재,
      `23_16_40` architecture INFO 6). `emitExecutionEvent`/`emitNodeEvent` 는
      `toFanoutEnvelope` 를 지나지만 **그렇게 하라고 강제하는 것은 JSDoc 뿐**이고
      `broadcastToChannel` 은 여전히 public 이다. 새 external emit 경로가 그 문을 우회하면
      2026-08-23 에 닫은 정보 노출이 그대로 재발한다.
      > **이번 diff 가 만든 문제가 아니다** — 기존 구조다. 다만 이 PR 이 그 문에
      > **보안 책임을 하나 더 얹었으므로** 우회 비용이 전보다 커졌다.
      > **후보**: fanout 전용 emit 을 private 으로 좁히거나, 외부 sink 로 나가는 지점에
      > 타입 래퍼(`FanoutEnvelope` branded type)를 두어 조립을 강제한다.
      > **함께 볼 것** (`23_16_40` security INFO 1): allowlist 는 **이름 기반**이라 wire 전용
      > 8키 중 하나와 같은 이름의 내부 필드가 나중에 `nodeOutput` 최상위에 붙으면 통과한다.
      > 두 항목의 처방이 같은 자리(신규 emit·신규 top-level 필드 리뷰 체크리스트)다.

- [x] ~~**fanout allowlist 캐너리가 `describe('llmCalls strip …')` 안에 있다**~~ → **완료 (2026-08-27, `eia-misc-hygiene`)**.
      **캐너리는 4건이 아니라 8건이었다** — 등재 시점(2026-08-23) 이후 `envelope.output`
      경로 2건과 파이프라인 불변식 2건이 더 들어왔다. 여덟을 통째로 형제 describe
      `nodeOutput allowlist · fanout 파이프라인 불변식` 로 분리했다(테스트 수 63→63 불변).
      `aiPayload` fixture 를 쓰는 4건은 원 블록에 남으므로 fixture 스코프 문제가 없다(실측).
      (2026-08-23 등재,
      `23_16_40` testing INFO 14). 블록명이 실제 검증 대상(allowlist)과 어긋난다 — 다음에 이
      파일을 여는 사람이 allowlist 테스트를 그 이름 아래에서 찾지 않는다.
      > **이번에 안 옮긴 이유**: 이동은 `codebase/**` 변경이라 방금 끝난 리뷰가 다시 stale 이
      > 된다. 순수 이동이라 위험은 0에 가깝지만 **리뷰 한 바퀴 값어치는 아니다** — 다음에 이
      > 파일을 실질 수정할 때 함께 옮긴다.
      > **`emitNodeEvent` 경로 미검증**(같은 라운드 testing INFO 12)도 같은 자리다 — 현재
      > `nodeOutput` 을 싣는 이벤트는 `emitExecutionEvent` 뿐이라 위험이 낮고, 그 전제가
      > 깨지는 순간(= `emitNodeEvent` 가 `nodeOutput` 을 싣는 첫 케이스)이 재개 신호다.

- [x] ~~**`node-output-allowlist.ts` 를 `shared/utils/` 밖으로 재배치**~~ → **완료 (2026-08-27, `eia-misc-hygiene`)**.
      `nodes/core/` 로 옮겼다 — `NodeHandlerOutput` 이 사는 `node-handler.interface.ts`
      바로 옆이고, 그 디렉토리가 이미 그 인터페이스 주변 유틸의 자리다. 소비처는 3곳뿐이라
      (websocket · interaction.service · 자기 spec) 이동 비용이 낮았다.
      **불변식 회복 확인**: 이동 후 `shared/utils/` 에서 `nodes/`·`modules/` 를 import 하는
      파일 **0건**(이동 전에는 이 파일이 유일했다 — 실측).
      > **아래 원 등재문(2026-08-23)의 *"국소화만 되고 완전히 회복되진 않았다"* 는
      > 이동 *전* 상태를 말한다** — 이 완료 주석과 시제가 어긋나 보이는 것을 막으려
      > 표식을 남긴다 (`20_07_43` INFO 6). spec 참조 2곳(`14-…md` 의
      `code:` frontmatter · `node-output.md` 본문)도 동반 갱신 — `code:` 는
      ⚠️ **내가 쓴 근거는 틀렸다** (2026-08-27 `20_07_43` INFO 5 가 지적, 실측 확인):
      *"`spec-code-paths.test.ts` 가 검사하므로 안 고치면 build 가 깨진다"* 고 적었으나
      그 가드는 **any-match** 다 — `codes.some((c) => globMatchesAny(c, root))`. 목록의
      **한 경로라도** 실존하면 통과하므로, 나머지가 전부 stale 이어도 안 깨진다. 두 문서
      모두 유효 경로를 여럿 갖고 있어 실제로 안 깨졌을 것이다.
      **고친 것 자체는 옳다** — stale 경로는 다음 사람을 헛걸음시키고, 링크 가드는
      frontmatter 를 안 본다(그건 본문 `[..](path)` 만 본다). 다만 **강제되지 않는다**는
      것이 사실이고, 그래서 이런 자리는 사람이 안 보면 조용히 썩는다.
      (2026-08-23 등재,
      `19_24_24` architecture INFO 1). 그 디렉토리 8개 파일 중 **유일하게 도메인 타입**
      (`NodeHandlerOutput`)을 import 한다 — "shared = 도메인 비의존" 불변식이 이 PR 에서
      국소화만 되고 완전히 회복되진 않았다.
      > **왜 이번에 안 옮겼나**: 같은 라운드에 이미 한 번 옮겼고(순수 유틸에서 분리),
      > 또 옮기면 리뷰가 다시 stale 해진다. 리뷰어도 "후속" 으로 판정했다.
      > **착수 시 후보**: 유일 소비처 인근(`modules/external-interaction/`) 또는 `nodes/core/`.
      > 위 SSE 항목이 소비처를 하나 늘리므로 **그 작업과 함께 정하는 편이 낫다** — 소비처가
      > 둘이 되면 배치 답이 달라진다.
      >
      > **그 판단 시점이 왔고, 결론은 무변경이다 (2026-08-23, SSE 작업)**: 소비처는
      > `modules/external-interaction/interaction.service.ts` 와 `modules/websocket/
      > websocket.service.ts` 둘로 갈렸다 — 즉 *"유일 소비처 인근"* 이라는 후보가 사라졌고,
      > `nodes/core/` 로 올리면 이번엔 그쪽이 EIA 전용 wire 키 8개를 떠안는다. `shared/utils/`
      > 는 두 소비처 **양쪽의 하위 계층**이라 상향 참조가 없다. 남은 흠은 *"shared 8파일 중
      > 유일하게 도메인 타입을 import"* 뿐인데, 그 결속이 이 파일의 **방어 수단**(컴파일타임
      > assertion)이라 없앨 수 없다. 항목은 열어 두되 **재개 신호는 "소비처가 늘었다" 가
      > 아니라 "shared 아래가 아닌 소비처가 생겼다"** 로 바꾼다.

- [x] **`getStatus` 일반 `nodeOutput` 키-allowlist** (§R17 잔여) — §R17 이 "conversationConfig 이외의 일반 `nodeOutput` 키-allowlist 만 잔여 항목" 이라 명시했으나 등재된 plan 이 없었다. 현재 `conversationThread`·`ai_message`·`nodeOutput.conversationConfig` 는 `redactThreadForPublic`/`deepRedactSecrets` 로 마스킹되지만 그 외 `nodeOutput` 키는 공개 표면에 그대로 실린다. 도입 시 §R17 잔여 문구 flip. (2026-07-10 consistency `plan-coherence` W3 로 등재 — spec-impl-evidence R-5 "빈 약속 영구 누락" 방지.)
      > **→ 종결 (2026-08-23).** 착수 전 프로브가 **전제를 절반 갈았다**: 그 사이
      > `stripAndRedact` 가 세 출구에 걸려 "그대로 실린다" 는 낡았고, 진짜 문제는
      > `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']` — **deny-list 한 칸**이라 새 키가
      > 기본값으로 통과한다는 것(fail-open)이었다.
      > **지금 새던 구체 사례**: 엔진 내부 `_retryState` 는 `NodeExecution.outputData` 에
      > 저장되고(`retry-turn.service.ts`) `llmCalls` 가 아니라 그대로 나갔다. 자매
      > `_resumeState` 의 JSDoc 이 "표현식·UI 에 노출되지 않게 `output` 밖에 뒀다" 고 적은
      > 의도가 외부 REST 에서만 안 지켜지고 있었다.
      > **평평한 allowlist 를 손으로 나열하면 안 됐다**: 위젯이 `form → nodeOutput.formConfig
      > ?? nodeOutput` 으로 **`nodeOutput` 자체를 폼 선언**으로 쓰는데 폼 핸들러는 `formConfig`
      > 를 안 낸다(`{config, output, meta}` 만). 좁게 나열했으면 폼 렌더가 깨졌다.
      > **그래서 타입에 결속했다** — `NodeHandlerOutput` 공개 키를 컴파일타임 assertion 이
      > 덮는지 검사한다(뮤테이션으로 실증: 목록에서 `status` 를 빼면 `TS2322`).
      > **범위는 열거했다** — REST `getStatus` waiting 출구 1곳. terminal `result`/`error` 는
      > 작성자 데이터라 의도적 제외, SSE/fanout 은 **위 별도 항목**으로 분리.
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

## 폐지된 필드를 현재형으로 인용 (2026-08-14 등재, `22_29_16` cross_spec W1·W2)

**문서가 자기모순이다.** 같은 파일 `:838` 은 inline 인증 필드가 *"폐지됐고"* 라 옳게 적는데,
`EIA-NX-03`(`:57`)과 `R12`(`:1260`)는 `hmacAlgorithm` 을 *"trigger config 에 보관하되"* 라며
**현재형**으로 인용한다.

**실측**: `hmacAlgorithm` 은 `V066__trigger_config_strip_inline_auth.sql` 로 제거됐고
`triggers.service.ts:634` 가 저장 시 스트립한다(`triggers.service.spec.ts:607` 이
`not.toHaveProperty('hmacAlgorithm')` 로 고정). 현행 위치는 `AuthConfig.config.algorithm` 이며
**소유자가 트리거가 아니라 자격증명 메타로 바뀌었다** — `12-webhook.md:167` 이 그 차이를 명시한다.

- [x] `EIA-NX-03`(`:57`)·`R12`(`:1260`)의 `hmacAlgorithm` 인용을 `AuthConfig.config.algorithm`
      기준으로 재작성. 결론(inbound `sha256` vs outbound `hmac-sha256` prefix 분리)은 유지
- [x] §11 `execution.stop` 행에 WS §4.7 과 같은 `_(WS 명령 §4.2 won't-do)_` 주석 —
      두 "권위 표" 가 어긋나 있다 (`22_29_16` cross_spec W2)
- [x] (선택·비차단) `2-api-convention.md §2.2` 에 `/api/external/*` 를 "별도 인증 family 를 쓰는
      top-level 네임스페이스" 예외로 등재 (`22_29_16` convention_compliance W3)

> **왜 여기 등재하고 그 자리에서 안 고쳤나**: 발견 시점이 `eia-terminal-payload` 의
> `error` 객체화 PR 중이었다. 같은 PR 이 `durationMs` 를 "비용이 다르다" 는 이유로 떼어냈는데
> 무관한 HMAC drift 를 끌어들이면 그 원칙과 어긋난다. **한 관심사 원칙은 내 편의로 굽히지 않는다.**

## 종결 `error.message` 가 값-패턴 마스킹을 안 거친다 (2026-08-14 등재, `22_55_51` security W2)

`error.message` 의 출처는 `error instanceof Error ? error.message : String(error)` — **임의
내부 예외 메시지 원문**이다. WS fanout → SSE 외부 스트림 경로는 `sanitizePayloadForWs`
(키-이름 기반)만 통과하므로 자유 텍스트 안의 토큰을 걸러내지 못한다. REST `getStatus` 는
`stripAndRedact` 로 값-패턴까지 마스킹하므로 **두 표면이 비대칭**이다.

- [x] `toTerminalErrorPayload` 내부 또는 fanout 경계에서 `message`/`details` 에
      `deepRedactSecrets` 적용 → REST 와 대칭
      — **해소** (2026-08-16, [`eia-terminal-error-sanitize.md`](../complete/eia-terminal-error-sanitize.md)).
      등재된 두 후보 중 **`toTerminalErrorPayload` 내부**를 택했다: 호출부 5곳이 전부 emit 쪽
      (DB write 0)이라 새 종결 경로가 생겨도 구조적으로 빠질 수 없다.

      > **위 "REST 와 대칭" 서술은 부정확했다.** 실측하면 REST `getStatus` 의 `error` 는
      > `Execution.error` 가 아니라 `stripAndRedact(execution.outputData)` 다
      > (`interaction.service.ts:454`) — 두 표면은 마스킹 유무 이전에 **다른 컬럼**을 싣는다.
      > 이번 조치의 실제 효과는 "REST 와 같아진다" 가 아니라 **WS/SSE/webhook 종결 경로에
      > 값-패턴 마스킹이 생긴다** 이다.

- [ ] **자격증명을 노드 `config` 에 평문으로 담는 노드 타입 — 참조 간접화 검토**
      (2026-08-27 등재, `10_53_52` security W2 · architecture W3).
      > config echo 마스킹을 egress 로 옮기면서(`masking-expression-egress-split`) 두 대가가
      > 드러났다: **크로스-노드 자격증명 릴레이**(표현식이 원문을 읽으니 한 노드의 `apiKey` 를
      > 다른 노드로 실어 보낼 수 있다)와 **safe-by-convention 으로의 이동**(새 egress 를 여는
      > 사람이 규율을 지켜야 한다).
      > **둘 다 자격증명이 `config` 에 평문으로 들어가는 자리**에서만 문제가 된다.
      >
      > ⚠️ **전제 정정 (2026-08-27 실측, `13_47_15` cross_spec W1)** — 이 항목이 스스로
      > *"평문 자격증명을 담는 노드 타입이 실제로 몇 개인가를 재야 한다"* 고 적어 뒀고,
      > 그걸 쟀다. **초판의 "HTTP Request · Send Email 등" 은 틀렸다**:
      >
      > | 대상 | 실측 | 판정 |
      > | --- | --- | --- |
      > | AI Agent | `llmConfigId` 참조 | 해당 없음 (초판도 동일) |
      > | **Send Email** | `integrationId` 가 가리키는 Integration 엔티티에서 자격증명 해소 | **해당 없음** |
      > | **HTTP Request** `authentication='integration'` | 같은 `integrationId` 간접화. 게다가 config echo 가 필드를 **명시 열거**하고 `url` 은 `sanitizeUrlCredentials` 로 교체 (Principle 7 D1) | **해당 없음** |
      > | **HTTP Request** `authentication='custom'` | 사용자가 `headers`/`body` 에 **직접 입력** | **유일하게 남는 표면** |
      >
      > **따라서 "근본 처방 = 간접화 도입" 이라는 프레이밍이 틀렸다.** 간접화
      > (`llmConfigId`/`integrationId`)는 **이미 표준**이고, 남은 문제는 *"스키마가 없는
      > 사용자 자유입력 자리를 어떻게 다룰 것인가"* 다 — 간접화할 **참조 대상이 없으므로**
      > 같은 처방이 안 듣는다. 그쪽이 훨씬 어렵다.
      >
      > **왜 틀렸나**: 두 노드의 spec 을 안 읽고 *"integration 노드니까 config 에 자격증명이
      > 있겠지"* 로 추정해 썼다. 이 오류를 R-5 W2 에도 그대로 실어 spec 에 남길 뻔했다
      > (같은 라운드가 잡았다).
      >
      > **미판정으로 남긴다**: 대상이 좁아졌지만 스키마 없는 자유입력이라 처방이 더 어렵다.
      > 재개 전에 `authentication='custom'` 실사용 빈도를 먼저 재는 편이 낫다.
      >
      > **동반 점검 (2026-08-27 등재, `14_10_42` security W1)**: config 가 DB 에 원문으로
      > 앉으면 노출 표면이 REST/WS 두 egress **밖**으로도 넓어진다 — DB 백업·복제본·직접
      > `psql` 조회·감사 export·리포팅/ETL 파이프라인. 이 PR 은 두 egress 만 다뤘다.
      > **그 제3경로들이 `config` 원문을 재유출하지 않는지는 아직 안 쟀다** — 간접화 처방과
      > 별개로 점검이 필요하다(원문 저장 자체는 `Execution.error` 와 동일 정책이므로 새 정책은
      > 아니지만, 담기는 값의 민감도가 올라갔다).
      > **워크스페이스 경계는 넘지 않는다** — 작성 권한자는 애초에 그 값을 노드 설정에서 본다.

- [ ] **`chatChannel` 라우팅 컨텍스트만 좁은 마스커를 받는다** (2026-08-24 등재, `19_26_06` plan W6 이 드러낸 것).
      > **처방을 뒤집는다 — "순수 위생" 이 아니라 "carve-out 재검토" 다 (2026-08-29 실측).**
      > 아래는 `CREDENTIAL_KEY_PATTERN` 두 선언을 합치는 것을 위생 작업으로 적는데,
      > `websocket.service.ts` 의 JSDoc 이 그 차이를 **의도된 것으로 이미 선언**하고 있다:
      >
      > > "**미러의 범위는 자격증명 키 계열까지다**: 공용 쪽 `x[_-]api[_-]?key` 는 LLM/tool
      > > structured output 을 받는 REST 표면 전용 확장이라 **여기 없는 것이 정상이고,
      > > 동기화 대상이 아니다**."
      >
      > 차이 자체는 사실이다(2026-08-29 확인: 공용본에 `x[_-]api[_-]?key` 있고 WS 로컬본에
      > 없다). 그러나 **결정이 이미 기록돼 있으므로** 여기서 할 일은 합치기가 아니라
      > *그 carve-out 근거가 지금도 맞는지 재검토*다. 기록된 결정을 못 보고 합치면
      > 무근거 번복이 된다.
      >
      > **합친다면 넓은 쪽으로** — 좁은 쪽(WS 로컬본)으로 합치면 REST 표면이 후퇴한다.

- [ ] **잔여 — 자격증명 **없는** 연결 문자열·내부 호스트명·스택 프래그먼트는 여전히 통과**
      (2026-08-16 등재, `09_51_00` requirement W1). `SECRET_LEAK_PATTERNS` 는 자격증명을
      겨냥한다 — 무수정 프로브로 `postgres://db.internal:5432/prod` 무변화 확인.
      알림 경로의 `CONNECTION_STRING_PATTERN`·`STACK_TRACE_PATTERN` 을 shared SoT 로 올리면
      `deepRedactSecrets` 의 **다른 소비자 전부**(conversation-thread `turns[].data` ·
      `ai_message.messages[]` · EIA `nodeOutput`)가 영향을 받으므로 blast radius 가 다른 별건이다.
      승격 시 그 소비자들의 회귀 테스트를 선행해야 한다

- [x] **`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다** (2026-08-16 등재, 위 항목의
      자매 — 같은 "패턴 폭" 축이다). 키워드 목록은 `client_secret`·`access_token`·
      `refresh_token`·`id_token`·`api_key`·`password`·`passwd`·`pwd` 를 담지만 **`token` 단독은
      없다** — `secret` 은 단독 패턴이 따로 있는데 `token` 은 없어 **비대칭**이다.
      > **발견 경위**: `fe6a54c80` 의 테스트 fixture 를 `token=sk-live-abc123` 으로 썼다가
      > **통과하는 것을 보고** 알았다(fixture 를 `Bearer …` 로 교체). 즉 실측 확인된 갭이다.
      > `token=` 은 OAuth 응답·쿼리스트링에서 흔한 형태라 위 "자격증명 없는 연결 문자열"
      > 보다 **위험이 높을 수 있다** — 그쪽은 자격증명이 없지만 이쪽은 자격증명 그 자체다.
      > **다만 blast radius 는 같은 축**이다: 패턴을 넓히면 `deepRedactSecrets` 의 소비자
      > 전부가 영향받고 `redact-stored-error.spec.ts` 의 캐너리가 RED 로 바뀐다.
      > 위 항목과 **함께** 처리하는 것이 자연스럽다(한 번의 회귀 검증으로 둘 다 닫는다).
      >
      > **→ 해소 (2026-08-17). 위 blockquote 의 전제 두 개가 실측으로 반증됐다:**
      > ① *"blast radius 가 같은 축 — 캐너리가 RED 로 바뀐다"* → **거짓**. 그 캐너리는
      >   **연결 문자열**을 고정하며 `token` 문자열이 한 건도 없다. 패턴을 넓힌 뒤 백엔드
      >   **427 suites / 8,811 전원 GREEN** — 깨진 기존 테스트 0건이라 묶을 이유가 없었다.
      > ② *"`token` 단독이 빠진 비대칭"* 은 참이지만 **결함의 전부가 아니었다**. 3축 프로브
      >   결과 *접두* 계열(`csrf_token`·`auth_token`·`session_token`·`csrfToken`)이 값 축과
      >   키 축 **양쪽**에서 누출했다. 그래서 `[A-Za-z0-9_-]*token` 으로 계열째 닫았다.
      >
      > 범위: 값 패턴 + `CREDENTIAL_KEY_PATTERN` 2곳(미러) + MCP 전용 대안 흡수.
      > `maskSensitiveFields`(로깅·workflow-assistant)는 **아래 workflow-assistant 항목이
      > 소유**하므로 건드리지 않고, 이번 실측을 그 항목에 증거로 덧붙였다.

- [x] **§6.4 필드 표 + §R17 마스킹 카탈로그에 이 egress 지점 등재** — 해소(2026-08-16)
      — 2026-08-16 등재, `11_36_45` W1. 구현은 끝났는데 **spec 이 새 보안 불변식을 모른다**.

      > ⚠️ **R17 3번째 불릿에 속지 말 것.** 거기 적힌 *"terminal `result`/`error`"* 의 `error`
      > 는 `getStatus` 의 **`outputData` 기반**이라 이번에 마스킹한 `Execution.error` 와
      > **다른 컬럼**이다. 이름이 같아 "이미 포괄됨" 으로 넘기기 쉽다 — 이 트래커의
      > *"REST 와 대칭"* 서술이 같은 이유로 부정확했던 전례가 있다.

- [x] **내부 REST 와 WS 가 같은 `Execution.error` 에 다른 값을 말한다** (2026-08-16 등재,
      `11_36_45` I1). `executions.service.ts:862` 는 `error: execution.error ?? null` 로
      **원문**을 주고, WS/SSE/webhook 종결 이벤트는 이제 마스킹된 값을 준다.
      실측 확인함. 의도된 비대칭이면 R17 의 `llmCalls` 선례처럼 caveat 로 명시하고,
      아니면 REST 에도 적용을 검토한다 — **둘 중 하나를 고르는 것이 이 항목이다**

      > **결정됨 (2026-08-16, 사용자 택일): 내부 경로에도 마스킹한다.** 집행은
      > [`eia-internal-rest-error-masking.md`](../complete/eia-internal-rest-error-masking.md).
      > **이 항목의 제목이 부정확했다** — 실측하니 갈리는 축은 REST↔WS 가 아니라
      > **종결 emit ↔ 그 밖의 모든 읽기 경로**다. WS `execution.snapshot`
      > (`websocket.gateway.ts:399` → `findById`)도 원문을 싣고 있었다. 위 `:862` 도
      > **목록 경로 전용**이고 상세는 다른 함수다 — 독립 조치가 필요한 자리는 4곳이다

- [x] `interaction.triggerToken` 이 `SecretResolver` 미경유 · JSONB 평문 보관
      (선존, `09_25_29`·`11_36_45` W2 재확인). `secret-store.md` Overview 의 "모든 도메인
      모듈은 SecretResolver 경유" 와 충돌. (a) `secret://triggers/{triggerId}/interaction-token`
      슬롯 이관 + 구현 plan 신설, 또는 (b) `secret-store.md §1` 비대상 절에 명시적 예외 등재 —
      **택일해서 근거를 Rationale 에 남긴다**

      > **결정됨 (2026-08-16, 사용자 택일): (b) 명시적 예외 등재.** 집행은
      > [`eia-internal-rest-error-masking.md`](../complete/eia-internal-rest-error-masking.md) §D.
      > 근거는 `AuthConfig.config` 문구를 **재사용하지 않는다** — 그쪽 예외는 "다른
      > 메커니즘으로 동등 암호화" 이고 이 필드는 **암호화 자체가 없어** 예외의 종류가 다르다
      > (`16_03_57` rationale/convention W2)

- [x] **`NodeExecution.error` — 읽기 표면은 해소 (2026-08-16)**. 처음엔 *"다른 컬럼이라
      범위 밖, 같은 클래스의 유출 가능성"* 으로 등재했는데 **그 판정이 틀렸다** —
      `--spec`(`16_32_42`) cross_spec 이 **CRITICAL** 로 잡았고 실측이 맞았다.
      `1-data-model.md` §2.14 가 `Execution.error` 를 *"최초 failed NodeExecution 의 에러
      정보를 **복사**"* 로 정의하므로 **같은 값**이 같은 응답에 원문으로 병존했다 —
      "유출 가능성" 이 아니라 **최상위 마스킹의 완전 우회**였다. 심각도를 격상해 기록한다.
      → `findById` 의 `nodeExecutions[]` + 자매 `background-runs` body 노드에 마스킹 적용

- [x] **`DEFAULT_SENSITIVE_KEYS` 의 실질 위험은 정적 grep 으로 못 닫는다** (2026-08-23 등재,
      > **해소 (2026-08-24, `masking-expression-egress-split`)** — 이 항목의 재개 신호(*"config echo 를 다운스트림 표현식이 실제로 읽는 사례"*)가 **가장 강한 형태로 발화**했다: `migrate-node-output-refs.ts` 가 사용자 표현식을 `$node["X"].config.<field>` 로 **이주시키고** 있었다. 지정된 조치 **(a) 표현식 경로만 마스킹 제외**를 집행 — 어댑터의 `maskSensitiveFields` 를 걷어내 표현식·DB 는 원문, egress(REST/WS)만 마스킹으로 정렬했다. 안전 전제(두 마스커의 키 축 포함관계)는 **정본 구현 실행**으로 확인하고 목록에서 파생한 캐너리로 못박았다.
      `17_14_18` side_effect W1). 이 목록을 넓힐 때마다 *"노드 config 필드명과 겹치나"* 를
      재는데, **HTTP Request · Send Email 노드의 `headers`/`body` 는 사용자가 키 이름을 직접
      정한다** — 정적 분석으로는 원리적으로 안 보인다.
      > **오늘 시점 위험은 낮다**: 방향이 **과잉 마스킹(안전 쪽)** 이라 유출이 아니고, 이
      > 노출은 **신규가 아니다** — 이미 목록에 있던 `token`·`access_token`·`authorization`·
      > `apiKey` 가 같은 성질을 갖는다. 2026-08-23 확장은 접두형으로 넓혔을 뿐 새 클래스를
      > 만들지 않았다.
      > **재개 신호**: 사용자가 *"내 워크플로의 `headers.X` 값이 `****` 로 보인다"* 고
      > 신고하거나, config echo 를 다운스트림 표현식이 실제로 읽는 사례가 확인될 때.
      > 그때 조치는 (a) 표현식 경로만 마스킹 제외하거나 (b) 표면별 키 목록을 분리하는 것 —
      > (b)는 두 목록 손 동기화 비용이 있어 (a)를 먼저 검토한다.

- [x] **자매 표면 `handler-output.adapter.ts` 의 값 축은 아직 열려 있다** (2026-08-23 등재,
      > **전제가 바뀌어 재기술 (2026-08-24)** — 이 항목은 *"키 축만 걸려 있으니 값 축을 마저 걸자"* 였다. 그런데 위 항목 처리로 **어댑터의 키 축 마스킹 자체가 사라졌다** — 이제 이 표면은 마스킹을 **하지 않고**, egress 가 값 축·키 축을 **둘 다** 건다. **즉 원래 형태의 이 항목은 대상이 없다.**
      > **남는 질문은 방향이 반대다**: 어댑터가 아니라 **egress 의 값 축**이 config 를 충분히 덮는가. `deepRedactSecrets` 가 이미 `SECRET_LEAK_PATTERNS`(`Bearer …` 등)를 걸므로 대체로 덮이고, 안 덮이는 것은 아래 *"자격증명 없는 연결 문자열·내부 호스트명"* 항목과 **같은 잔여**다. 그쪽으로 합류시킨다.
      위 항목에서 **의도적으로 분리**). 노드 `config` echo 를 `maskSensitiveFields` **키 축만**
      으로 가린다 — 자유 텍스트 안의 `Bearer …`·자격증명 URI 는 그대로 통과한다.
      > **왜 같이 안 닫았나**: 그 값은 **DB 저장 · WS emit · 표현식 echo** 로 흐른다. 값 축을
      > 겹치면 저장되는 값과 표현식이 읽는 값이 바뀌어 정상 워크플로를 깨뜨릴 수 있다 —
      > LLM 도구 응답(읽고 버림)과 위험이 다르다. 그래서 위험 없는 절반(키 축, token 계열
      > 목록 확장)만 적용했다.
      > **분리 이유 자체가 규약이다** — 이 문서가 기록한 *"결합 항목을 한 체크박스로 닫으면
      > 나머지가 조용히 사라진다"* 패턴을 피하려고 별도 항목으로 세웠다(`16_21_45` W5).
      > **부수 위험** (`16_21_45` naming INFO 1): 이 표면 산출물은 `****<last4>` 라
      > `VALUE_MASK_MARKER`(`***`) 공유 계약 밖이다. 재제출 가능 경로에 들어가면
      > `isMaskedMarker` 가 못 알아봐 **재제출을 허용**할 수 있다. 오늘은 그 경로에 없다.

- [x] **workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한 마스킹으로 내보낸다**
      (2026-08-16 등재, `17_12_34` requirement W1). `explore-tools.service.ts:464`·`:484` 가
      `maskSensitiveFields`(**키 이름** 기반)만 걸어 `error.message` 안의 `Bearer …` 를
      통과시킨다 — 실측: 그 함수는 `typeof value !== 'object'` 면 그대로 반환한다.
      > **단순 합성은 답이 아니다** (실측으로 반증). `redactStoredErrorForResponse` 를 겹쳐
      > 봤더니 기존 테스트가 RED 였다 — `maskSensitiveFields` 는 자격증명 키를 `****9876`
      > 으로 **접미 힌트를 남기는데**(어떤 키가 가려졌는지 식별용) 값-패턴 마스킹이 그걸
      > `***` 로 덮는다. 두 마스킹 의미 중 이 표면에서 무엇이 우선인지가 **결정 항목**이다.
      > 테스트를 내 변경에 맞춰 고치는 대신 되돌리고 여기 등재한다
      >
      > **증거 추가 (2026-08-17, `token=` 항목 집행 중 실측)**: 이 표면의 갭은 값-패턴 부재
      > 하나가 아니다. `maskSensitiveFields` 의 `DEFAULT_SENSITIVE_KEYS` 는 **키 축에서도**
      > 접두 `token` 계열을 놓친다 — `{csrf_token}`·`{auth_token}`·`{session_token}`·
      > `{csrfToken}` 이 전부 평문 통과(bare `token` 만 잡힘). 같은 라운드에 EIA 쪽 두
      > 목록(`SECRET_LEAK_PATTERNS`·`CREDENTIAL_KEY_PATTERN` ×2)은 계열째 닫았고 **이 목록만
      > 남겨 뒀다** — 마스킹 형태가 다르고(`****<last4>` vs `***`) 위 "무엇이 우선인가"
      > 결정에 묶여 있어, 그 결정 없이 넓히면 여기서 또 되돌리게 된다.
      >
      > **→ 종결 (2026-08-23). 사용자 결정: 유출 차단이 우선.**
      > `deepRedactSecrets` 를 겹쳐 **두 축이 한 번에 닫혔다** — 값 축(`Bearer …`·자격증명
      > URI)과 키 축(`CREDENTIAL_KEY_PATTERN` 의 `[a-z0-9_-]*token` 이 `/i` 라 접두 계열 포함)
      > 이 동시에 막힌다. **이 목록을 넓힐 필요가 없었다** — 위 "잔여 작업" 예상이 실측으로
      > 바뀐 지점이다(정규식을 읽고 판단한 게 아니라 겹쳐서 돌려 봤다).
      > `****<last4>` 의 식별 힌트는 잃지만 **키 이름은 응답에 남으므로** *어떤* 키가
      > 가려졌는지는 여전히 읽을 수 있다.
      >
      > **spec 동반 갱신 4곳** (planner 턴, `16_21_45` W1~W5 가 편집 **전에** 범위를 넓혔다):
      > `4-ai-assistant.md` §4.1.1 + 같은 파일 `:1429` 결정 메모 · EIA §R17 잔여③ flip +
      > 바로 위 캐비엇 취소선 · `_product-overview.md` EH-NAV-04 · `egress-masking.md`
      > §1 표 2행 + `code:`. **자매 표면의 값 축은 위 별도 항목으로 분리**했다.

- [x] **단일 관문 근거 서술이 소스 3곳에 흩어져 있다** — 해소(2026-08-16, `fe6a54c80`).
      읽기 표면 표를 `toResponseExecution` 에 정본으로 두고 나머지 세 지점은 그것을 가리키게
      했다(개수를 다시 적지 않는다). **아래 "고치지 않는 이유" 가 이번에 뒤집혔다** — A·B 로
      이미 같은 파일들을 열어 게이트를 한 바퀴 도는 중이라 한계비용이 0 이었고, 실제로
      표면이 넷→여섯이 되며 그 "넷" 이 **낡았다**(우려가 실현됐다).
      (원 등재, `19_16_28` maintainability W1) `executions.service.ts:802` ·
      `background-runs.service.ts:301` · `executions.service.spec.ts:853` 이 각각
      *"자매 넷 중 하나만"* 을 언급한다.
      > **전제를 실측했다 — verbatim 복제는 아니다.** 공유되는 것은 저장소 공용 **관용구**
      > (패턴 이름)이고 주변 서술은 지점마다 다르다(background-runs 는 `@Roles` 부재와
      > `NodeExecution.error` 를, spec 파일은 표면별 단언 이유를 담는다). **다만 "넷" 이라는
      > 수치가 세 곳에 흩어진 것은 실제 drift 위험**이다 — 표면이 다섯이 되면 세 곳이 갈린다.
      > 정본 서술을 `toResponseExecution` 한 곳에 두고 나머지는 `{@link}` 참조로 바꾸는
      > 정리를 후속으로 남긴다. **이 PR 에서 고치지 않는 이유**: 코드 주석 정리라 기능 위험이
      > 0인데, 이 저장소의 게이트는 코드 편집마다 리뷰 라운드를 다시 요구한다 — 문서 서술
      > 수준의 개선을 위해 전체 게이트를 한 바퀴 더 도는 것은 비용이 이익을 넘는다

- [x] **WS `execution.node.*` emit 의 `error` 는 여전히 원문이다** — 해소(2026-08-16, `1b8fd5cc7`).
      **사용자 택일: wire + fanout 둘 다 마스킹**(`llmCalls` 만 wire 예외).
      > **초안의 "fanout 전용" 근거가 실측으로 반증됐다.** *"내부 wire 는 소유자 콘솔"* 로
      > 적었으나 `ExecutionChannelAuthorizer` 는 `verifyOwnership(executionId, workspaceId)`
      > 만 보고 **role 을 아예 받지 않는다** — 수신 인구가 `GET /api/executions/:id` 와 동일
      > (viewer 포함)이라 §R17 이 내부 REST 를 마스킹한 것과 같은 상황이었다.
      > 범위도 좁혔다: node 이벤트는 **SSE 에만** 도달하고 notification webhook 은
      > `FANOUT_EVENTS` 화이트리스트 밖이다(`node.completed` 만 Chat Channel 추가 구독).

- [x] **`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다** (2026-08-17 등재).
      아래 항목에서 `outputData` 만 닫고 **`inputData` 는 되돌렸다.** 이 값은 표시 전용이
      아니라 **재제출**되기 때문이다 — Re-run 모달이 프리필해 `inputOverride` 로 되보내고
      (`useOriginalInput` **기본 `false`**), 에디터 "히스토리에서 불러오기" 도 같은 값을
      재실행한다. 마스킹하면 리터럴 `'***'` 가 새 실행의 **실제 입력값**이 된다.
      > **두 게이트가 독립으로 CRITICAL 을 냈다**(`23_49_05` cross_spec · `23_50_03`
      > side_effect). 소스 추적으로 확증했고 사용자가 **철회**를 택했다.
      > 기본 Re-run(`useOriginalInput=true`)은 서버가 엔티티를 직접 읽어 영향 없다.
      > **닫는 조건**: 두 소비처가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는 가드.
      > 그 가드가 서면 이 컬럼도 닫는다.
      >
      > **⚠️ 범위 정정 (2026-08-17, `83436ed45`) — 카브아웃은 `Execution` 레벨 한정이다.**
      > `NodeExecution.inputData` 는 **마스킹 대상**으로 전환됐다(재제출 소비처 없음).
      > 노드 레벨을 비워 두면 WS emit(마스킹)과 REST(원문)가 **같은 store 슬롯**에서
      > 2초 폴링에 덮여 flip-flop 이 난다(`01_17_49` cross_spec CRITICAL).
      > 그래서 캐너리가 **두 방향으로 갈린다** — 헷갈리기 쉬우니 명시한다:
      >
      > | 캐너리 | 고정하는 것 |
      > |---|---|
      > | `⑧` · `⑧-b` (`getChain`·`stop`) + `①`·`②` | `Execution.inputData` 가 **원문**임 |
      > | `⑤` · `⑥-b` + `background-runs.service.spec.ts` | 노드 레벨 `inputData` 가 **마스킹**됨 |
      >
      > 남는 노출은 **Execution 레벨** 트리거 파라미터 자유 텍스트뿐 — webhook 민감 헤더는
      > ingestion 이 이미 `[REDACTED]` 로 가린다.
      >
      > **→ 해소 (2026-08-20) — 단, UI 정상 흐름에 한정된 폐쇄다.** 가드는 프런트 렌더
      > 경로에 있으므로 `POST /re-run` 을 직접 호출해 `inputOverride` 에 리터럴 `'***'` 를
      > 실으면 서버는 여전히 받는다. 기밀성이 아니라 호출자 자신의 실행에 한정된 무결성
      > 문제이고, 서버측 거부는 아래 별도 항목이다. **이 항목을 "완전 폐쇄" 로 재인용하지
      > 말 것** — 이미 세 라운드를 소모한 오독 패턴이다(`18_24_31` rationale_continuity).
      >
      > 닫는 조건이던 마커 가드를 세 소비처가 전부 갖췄다 —
      > 폼 프리필(#1181) · Re-run 모달(프리필 스킵 + **세 조건이 모두 참일 때까지 제출 차단**) ·
      > 에디터 히스토리 로드(JSON leaf 에 마커 잔존 시 Run 차단). `Execution.inputData` 가
      > 마스킹 대상이 되면서 위 캐너리 표의 **왼쪽 열이 반전**됐다(`①②⑧⑧-b` → 마스킹 고정).
      > 오른쪽 열(노드 레벨)은 그대로다.
      >
      > 예상 못 한 비용은 **spec 쪽**이었다 — 이 결론이 6개 문서에 SoT 로 미러돼 있어
      > planner 턴이 선행돼야 했다(`12_08_46` BLOCK:YES → `12_41_29` BLOCK:NO).

- [x] ~~**Swagger `createDocument` boilerplate 공유 헬퍼 — "4번째 사례" 임계값 도달**~~ → **완료 (2026-08-27, `eia-misc-hygiene`)**.
      `src/shared/testing/swagger-probe.ts` 신설 — `buildSwaggerDocument` / `schemasOf` /
      `schemaOf` / `propertyOf` + `SwaggerSchemaObject`. 네 스펙 전부 전환, 잔존
      `SwaggerModule.createDocument`·`ApiResponseSchemaHost` **각 0건**(실측), 순 −41줄.
      > **`dist` 오염을 먼저 막았다**: `@nestjs/testing` 은 devDependency 라 이 파일이
      > dist 로 나가면 프로덕션에서 지뢰다. `*spec.ts` 패턴에 안 걸리는 이름이라
      > `tsconfig.build.json` 의 `exclude` 에 `src/shared/testing/**` 을 명시 등재했다 —
      > 같은 파일이 `src/repo-guards/**` 를 등재한 것과 **같은 이유**이고, 그 선례는 실제
      > 오염이 일어난 뒤 추가된 것이다. `nest build` 후 `dist/shared/testing` 부재 확인.
      > **헬퍼의 존재 이유(에러 경로)를 캐너리로 고정했고, 그 캐너리가 내 가정을 반증했다**:
      > 티켓이 적은 *"`components` 가 `undefined` 면 설명 없는 `TypeError`"* 는 도달하지
      > 않는다 — `createDocument` 는 DTO 가 없어도 `{"schemas":{}}` 를 낸다(실측).
      > 도달하는 상태는 **빈 레코드**라 그쪽을 물게 고쳤다.
      (2026-08-23 등재, `21_03_29` plan_coherence W2.)
      리뷰가 반복해서 *"4번째 유사 스펙이 생기면 공유 헬퍼로 추출하라"* 는 조건부 처분을
      내렸는데, **이번 `re-run.dto.spec.ts` 가 그 4번째다**.
      > **현재 4개 · 3개 모듈**: `workflows/workflows-execute-body.spec.ts` ·
      > `external-interaction/dto/responses/interact-ack-response.dto.spec.ts` ·
      > `…/execution-status-response.dto.spec.ts` · `executions/dto/re-run.dto.spec.ts`.
      > 넷이 같은 형태를 반복한다 — 프로브 `@Controller`+`@Module` 선언, `createTestingModule`
      > → `app.init()` → `try/finally` 로 `createDocument`, `SchemaObject` 파생 캐스팅.
      > **왜 지금 안 뽑았나**: 리뷰어 스스로 "지금 불요 / 4번째에서" 로 판정했고, 그 4번째를
      > 만드는 PR 안에서 곧바로 추출하면 그 PR 의 범위를 넘는다. 다만 **임계값 도달 사실이
      > review 산출물에만 남으면 다음 세션이 문서고고학을 해야 발견한다** — 그래서 여기 적는다.
      > **착수 시**: `expectSwaggerProperty(doc, dtoName, propName)` 류로 캐스팅과 방어적
      > 옵셔널 체이닝(`components` 가 `undefined` 면 설명 없는 `TypeError`)을 한 곳에 모은다.

- [x] ~~**`redact-stored-error.ts` 위생 4건**~~ → **완료 (2026-08-27, `eia-misc-hygiene`)**. 네 건 전부:
      **①** `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`(호출부 11곳 동반).
      **②** 그 함수에 `@param`/`@returns` 보강 — 4개 export 중 유일 누락분이었다.
      **③** `maskIfPresent` 의 *"제네릭을 쓰지 않는다"* 옆에 **왜 아래는 쓰는지**를 명시
      (추론 출처가 `mask` 파라미터 vs `row` 인자로 다르다).
      **④** `egress-masking.md` `code:` 에 등재 — 정의(*"약속한 surface 의 구현 경로"*)를
      충족한다: 그 문서 §2 가 `redactStoredFieldsForResponse`·`redactStoredDataForResponse`
      를 **직접 지목**하고, WS 짝인 `websocket.service.ts` 는 이미 등재돼 있었다.
      (2026-08-23 등재.)
      전부 비차단 INFO 로 3라운드에 걸쳐 반복 지목됐고, 각각은 지금 별도 diff 를 만들 값이
      없다. 이 파일을 **다른 이유로** 여는 순간 함께 처리한다.
      > 1. `redactNodeExecutionRow` 만 자매 3개의 `…ForResponse` 접미사를 안 따른다.
      > 2. 4개 export 의 JSDoc 이 `@param`/`@returns` 태그 유무로 갈린다.
      > 3. `redactNodeExecutionRow<T>` 의 제네릭이 바로 위 `maskIfPresent` 의 *"제네릭을 쓰지
      >    않는다"* 와 나란히 놓여 **오독 소지**가 있다(`15_16_28` rationale INFO 1). 실질
      >    모순은 아니다 — 그쪽 회피 사유는 `mask` **파라미터**에서 추론되는 경로인데 이쪽은
      >    `row` **인자**에서 추론된다. 한 줄이면 갈린다.
      > 4. `egress-masking.md` frontmatter `code:` 에 `redact-stored-error.ts` 미등재.
      >    (4번은 `spec/` 편집이라 위 권한-경계 항목의 처분에 종속된다.)

- [x] ~~**doc-link 검사기가 `CLAUDE.md`·`.claude/**` 를 안 훑는다**~~ → **완료 (2026-08-27, `doclink-guard-scope`)**. (2026-08-23 등재.)
      `scripts/check-doc-links.py:187` 의 스코프는 `["prd", "spec"]` 뿐이라 거버넌스 문서의
      링크·앵커는 **기계가 안 지킨다**.
      > **실측 (넓혀서 돌려 봄)**: 루트 `*.md` + `.claude/**` = 58개 파일, 새로 드러나는 깨진
      > 링크 **6건**. 그중 `PROJECT.md:50` 이 `CLAUDE.md#worktree-기반-작업-정책` 이라는
      > **이미 썩은 앵커**를 갖고 있다 — 가설이 아니라 실현된 형태다.
      > **발견 경위**: 이번 PR 이 CLAUDE.md 에 앵커를 새로 만들었고, 검사기가 그걸 지키는지
      > **일부러 깨뜨려** 확인했더니 `BROKEN` 이 안 늘었다. 안 깨봤으면 "링크 검사 통과" 를
      > 증거로 적을 뻔했다.
      > **미착수 사유**: 사용자 요청 범위(예외 명문화) 밖의 하네스 변경이다. 6건 중
      > `CHANGELOG.md:1060` 은 과거 기록이라 처분이 갈리므로 결정이 하나 섞인다.
      > ⚠️ **전제 정정 (2026-08-27 실측, C 작업 중)** — 이 항목을 "스코프가 좁다" 로만 적은
      > 것이 사실을 가렸다. 실제로는 **세 가지**가 더 있다:
      >
      > 1. **`check-doc-links.py` 는 어디에도 배선돼 있지 않다.** `.github/`·`.claude/`·
      >    `Makefile`·`scripts/` 전역 grep 에서 호출처 **0건**. 스코프를 넓혀도 **아무도 안
      >    돌리므로 아무것도 안 지켜진다** — 배선이 스코프보다 먼저다.
      > 2. **지금 `origin/main` 에서 이미 exit 1 이다** (`BROKEN=2`). 내 변경과 무관하며
      >    두 파일 다 내 diff 밖·`origin/main` 과 동일. 안 돌리니 아무도 몰랐다.
      > 3. **둘 다 오탐이고, 배선된 검사기는 이 둘을 안 문다.**
      >    `spec-impl-evidence.md:132` 은 백틱 코드스팬 안의 `[..](path)`,
      >    `1-widget-app.md:62` 는 **ASCII 상태도**의 `[panel](transient)` — 코드스팬이
      >    아니라 그냥 다이어그램이다(스팬 제외만으론 못 잡는다).
      >    `spec-link-integrity.test.ts` 는 **scope (1) 이 동일한 `spec/**.md`** 인데도
      >    통과한다 — 즉 **같은 스코프에 다른 판정**이고, 배선된 쪽이 맞다.
      >
      > **처분 방향 (재설계)**: 넓힐 대상은 unwired 인 `check-doc-links.py` 가 아니라
      > **build 를 차단하는 `spec-link-integrity.test.ts`** 다. `check-doc-links.py` 는
      > 열등 중복이라 **삭제 후보** — 남긴다면 배선이 조건이고, 배선하려면 오탐 2건이
      > 선결이다. 원래 적은 "6건" 은 **오탐 섞인 수**이므로 대상 검사기를 바꿔 다시 재야
      > 한다. `PROJECT.md:50` 의 썩은 앵커는 검사기와 무관하게 유효한 실현 사례로 남는다.
      >
      > ✅ **집행 (2026-08-27, 사용자 결정 (b))** — 열등 중복을 지우고 배선된 쪽을 넓혔다.
      >
      > **삭제 전 고유 기능 확인**: `check-doc-links.py` 만 갖고 있다고 본 MDX frontmatter
      > `spec:` 검사가 **중복**임을 뮤테이션으로 확인했다 — 어느 `.mdx` 의 `spec:` 을 없는
      > 경로로 바꾸니 배선된 `registry.test.ts` 가 RED (*"모든 .mdx frontmatter 의 spec/code
      > 경로가 실재해요"*). 스코프의 나머지 절반인 `prd/` 는 **디렉토리 자체가 없다**.
      > 즉 고유 기능 0 — 삭제해도 잃는 것이 없다.
      >
      > ⚠️ **"6건" 은 틀렸다** — 그 수는 오탐 섞인 파이썬 스크립트 기준이었다. 배선된
      > 가드로 다시 재니 **58개 파일 / BROKEN 4**:
      >
      > | # | 자리 | 실제 원인 |
      > | --- | --- | --- |
      > | 1 | `.claude/docs/test-wrapper.md:25` | 링크가 `.claude/docs/` 기준인데 `.claude/…` 로 시작 (한 칸 위여야 함) |
      > | 2 | `.claude/skills/spec-coverage/SKILL.md:75` | 참조 plan 이 `in-progress`→`complete` 로 이동 |
      > | 3 | `PROJECT.md:50` | `CLAUDE.md#worktree-기반-작업-정책` — **존재한 적 없는 앵커** |
      > | 4 | `PROJECT.md:246` | 루트 문서인데 `../../spec/…` 로 두 칸 올라감 |
      >
      > `CHANGELOG.md:1060`("처분이 갈리므로 결정이 하나 섞인다" 고 적어 둔 그 항목)은
      > **애초에 없었다** — 배선된 가드 기준으로는 위반이 아니다. 결정 사항 0건.
      >
      > **집행 내용**: (a) `scripts/check-doc-links.py` 삭제, (b) `spec-link-integrity.test.ts`
      > 에 **scope 3(거버넌스 문서)** 추가, (c) 위 4건 정정, (d) `spec-link-checks.yml` 의
      > `pathspecs` 에 `:(glob)*.md`·`.claude/**` 등재, (e) `PROJECT.md` §문서 링크 검증 갱신,
      > (f) **`spec-impl-evidence.md §4.2` 표에 scope (3) 반영** (planner 턴 — 세 곳이 그 절을
      > SoT 로 인용하는데 정작 표가 (1)(2) 만 서술하고 있었다. `17_52_44` W1 이 잡았고,
      > 이 체크리스트에도 원래 빠져 있었다).
      >
      > **(d) 가 없으면 (b) 는 헛돈다** — 스코프만 넓히고 트리거를 안 늘리면 `CLAUDE.md` 를
      > 고쳐도 CI 에서 가드가 안 돈다. 그 워크플로 헤더 스스로 *"이 저장소가 여섯 번 겪은
      > paths 커버리지 갭"* 이라 적어 둔 바로 그 형태다. `:(glob)` 매직이 필수인 것도 실측
      > 근거가 있다 — 없으면 `*` 가 `/` 를 넘어 **17,202개**를 잡는다(있으면 루트 6개).
      > **왜 틀렸나**: `... | tail -3; echo exit=$?` 로 종료코드를 읽어 **`tail` 의 0** 을
      > 스크립트의 0 으로 착각했다. 파이프 뒤 `$?` 는 마지막 명령의 것이다.

- [x] ~~Docker Hub 익명 pull rate limit — CI 에 레지스트리 인증/미러 도입~~ →
      **won't-do (2026-08-23 사용자 결정)**. `#1202` 의 e2e 가 `minio` pull 에서
      `unauthorized` 로 죽어 backend supertest 가 시작조차 못 했다(재실행으로 초록).
      저장소의 **어떤 워크플로에도 Docker Hub 로그인이 없어**(실측) 익명 pull rate limit 에
      상시 노출돼 있고 **재발한다**.
      > **다시 진단하지 말 것** — 사용자가 처리하지 않기로 결정했다. 증상은 `docker compose up`
      > 이 이미지 pull 에서 `unauthorized: authentication required` 로 실패하고 테스트는 0건
      > 실행되는 형태다(로그에 `Tests:`/`FAIL` 없음). **조치는 실패 job 재실행**이다.
      > 같은 run 의 다른 job(`e2e-frontend`)이 통과했다면 일시적 현상이 확정된다.

- [x] **`developer` 의 자기-예측 반증형 spec 소정정 — 권한 경계를 정한다** (2026-08-23 등재 ·
      **같은 날 종결**. `14_23_44` scope W2 → `15_16_28` plan_coherence W1).
      `masking-gate-consolidation` 에서 developer 턴이
      `spec/conventions/egress-masking.md §3` 을 직접 고쳤다. 내용은 정확하고 5개 consistency
      checker + 9개 reviewer 가 전원 타당 판정했지만, CLAUDE.md 권한표는 developer 를 `spec/`
      **read-only** 로 못박고 "구현 중 spec 변경 필요 시 planner 위임" 을 따로 강조한다.
      실질 위험은 형식이 아니라 **게이트**다 — 이 편집은 `--impl-prep` 만 거쳤고 spec 편집이
      받아야 할 `--spec` 은 못 받았다.
      > ~~**planner 판단 항목**: (a) 예외 명문화 (b) planner 턴 강제.~~
      > **→ 사용자 결정 (2026-08-23): (a) 예외 명문화.** 근거는 (b) 의 비용 — 예고를 남긴
      > 것도, 그것이 틀렸음을 실측한 것도 developer 라, planner 를 강제하면 **반증할 수 있는
      > 유일한 사람에게서 정정 권한을 뺏는다**.
      >
      > **집행**: [`CLAUDE.md` §자기-반증형 소정정] 에 정의를 신설했다. 좁게 유지하는
      > **5조건**(자기가 쓴 문장 · 예고/트리거일 것 · 실측 반증 · 그 문장에 국한(취소선 보존) ·
      > `spec_impact`+커밋 기록)을 전부 충족해야 하고, `--spec` 을 면제하는 대신
      > **`--impl-done` 을 그 spec 파일 포함 scope 로** 돌리는 것을 조건에 넣었다 — 원 지적의
      > 실질이 형식이 아니라 게이트였기 때문이다.
      >
      > **미러를 늘리지 않았다**: live 규칙이 5곳에 있었는데(CLAUDE.md 2 + developer/SKILL.md 3),
      > 문구를 5곳에 복제하는 대신 **CLAUDE.md 한 곳에 정의하고 나머지는 가리킨다**. SKILL.md
      > §기획 금지("신규 정의·대규모 개정")와 §133("spec 자체 문제")은 **손대지 않았다** —
      > 자기-반증 소정정은 애초에 그 둘에 저촉되지 않는다(전수 판정 후 무변경 결정).

- [x] **`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합** (2026-08-20 등재, `14_44_08` W4 —
      **2026-08-23 종결**). `toResponseExecution` · `toExecutionDto` · 노드 레벨 `maskIfPresent`
      루프 · `background-runs.service.ts` 가 각자 마스킹을 걸고, 유일한 동기화 장치가 **사람이
      읽는 주석 표**였다. 이 fragmentation 때문에 실제로 자매 DTO JSDoc 이 갱신에서 빠지는
      CRITICAL 이 났다(`14_08_45` C2).
      > **집행 결과**: `redact-stored-error.ts` 에 헬퍼 **둘**을 인접 배치했다 —
      > `redactStoredFieldsForResponse`(DTO 조립 3곳, 부재를 `null` 로 정규화) ·
      > `redactNodeExecutionRow`(`nodeExecutions[]` 행, copy-on-change·부재 보존).
      > **하나로 뭉개지 않았다** — 노드 레벨은 엔티티 형태를 그대로 싣는 자리라 `undefined →
      > null` 정규화가 응답 shape 을 바꾸고 copy-on-change 를 깬다. 등재 시 제안한
      > `redactExecutionFields(row)` **단일** 헬퍼는 그 이유로 기각. interceptor 안은
      > 미검토 — 두 헬퍼로 SoT 가 한 파일에 모여 동기 문제가 해소돼 착수 근거가 사라졌다.
      > **뮤테이션 검증**: `inputData` 마스킹 제거 → 5개 테스트 RED(표면 ①상세·②목록·⑧chain·
      > ⑧-b stop + background-runs), identity 보존 파기 → 2개 RED. 둘 다 `tsc` 선검증 통과.
      > ~~**착수 시 동반 갱신**: 이 통합이 집행되면 개별 호출부 심볼이 헬퍼 하나로 흡수돼
      > [`egress-masking` 규약 §1 좌표계 표](../../spec/conventions/egress-masking.md) 의
      > 소비처 열이 stale 해진다(그 문서 §3 에 같은 트리거가 적혀 있다).~~
      > **그 예고는 틀렸다 — 표는 무변경이다.** 실측: 표 2행 소비처 `deepRedactSecrets` 는
      > 신규 래퍼가 흡수하지 않고 그 **위**에 서고(사슬만 한 겹 길어진다), 표 5행 소비처
      > `stripExternalOnlyFields` 는 호출부가 `websocket.service.ts`·`interaction.service.ts`
      > 뿐이라 이 4개 게이트와 접점이 없다. 표는 **마스커(함수) 좌표계**인데 예고를 쓸 때
      > **호출부(응답 조립부) 좌표계**로 착각했다 — 표 대신 그 §3 트리거 문장을 정정했다.

- [x] **`inputOverride` 서버측 마커 리터럴 거부** (2026-08-20 등재, `14_44_08` W6 — **2026-08-21 종결**).
      `resolveTriggerParameters` 는 타입·필수값만 보므로 UI 를 우회한 클라이언트(curl)는
      `'***'` 를 그대로 실어 왕복 오염을 API 레벨에서 재현할 수 있다.
      > **이번 PR 이 만든 결함은 아니다** — security reviewer 가 라운드마다 독립적으로
      > *"기밀성 침해 아님(이미 마스킹된 값을 쓰는 반대 방향) + 피해는 호출자 자기 자신의
      > 새 실행"* 으로 INFO 판정했다. defense-in-depth 로 얕은 서버측 체크(마커와 정확
      > 일치면 거부) 검토.
      >
      > **⚠️ 유예 근거 하나가 과장이었다 (2026-08-20 실측, `17_38_33` api_contract W2).**
      > 나는 이 항목을 세 라운드에 걸쳐 *"§R17 이 가드 범위를 UI 정상 흐름으로 명시했다"*
      > 로 유예해 왔는데, **§R17 을 열어 보면 그런 문장이 없다** — 프런트 소비처 셋을
      > 나열하고 "정확 일치만 감지한다" 는 경계만 적었을 뿐, *API 직접 호출 경로는 이
      > 가드의 범위 밖이다* 를 어디에도 쓰지 않았다. 근거가 약해서 같은 지적이 계속
      > 돌아온 것이다.
      >
      > **→ 종결.** planner(`spec-draft-inputoverride-marker-reject.md`, spec 7곳) + 구현
      > (`resolveTriggerParametersRejectingMasked`, Manual 실행 경로 두 곳). 범위는
      > **재제출만이 아니라 Manual 실행 전체**로 정정됐다 — execute 엔드포인트가 출처를
      > 구분할 플래그를 갖지 않기 때문이다(`23_33_00` cross_spec W1).
      >
      > **착수 시 두 가지를 함께 한다**: (1) 서버측 체크, (2) **planner 턴으로 §R17 에
      > 범위 문장 추가** — 거부하기로 하면 그 에러 코드가 EIA 에러 카탈로그에 들어가야
      > 하고, 안 하기로 하면 "왜 UI 만 막는가" 가 명문화돼야 재지적이 멎는다. 어느 쪽이든
      > spec 표면이라 `developer` 권한 밖이고, 그래서 이번 PR 에서 닫지 않는다.

- [x] **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인** (2026-08-20 등재,
      `14_44_08` W5 — **2026-08-20 종결**). JSON 스키마 타입은 그대로라 OpenAPI 로는 드러나지
      않는 **콘텐츠 계약 변경**이다. 저장소 안 프런트 3소비처는 가드됐지만, 이 엔드포인트를
      직접 호출하는 저장소 밖 소비자(QA/운영 자동화·감사 export 등)는 스키마로 알 수 없다.
      > **→ 확인했으나 없음 (2026-08-20).** 근거는 **저장소 소유자(사용자)의 직접 답변**
      > 이다 — *"없다, 프런트가 유일 소비자"*. 코드로 답할 수 있는 질문이 아니라(운영 정보)
      > 이 형태의 근거가 이 항목이 요구하던 "확인" 이다. 릴리스 노트 breaking 공지는
      > 불요. 출처·문맥: `spec-draft-inputoverride-marker-reject.md` "왜 지금인가".

- [ ] **Re-run 차단 판정을 순수 함수로 추출해 직접 단위 테스트한다** (2026-08-20 등재,
      `15_59_17` W3). `blockedByMaskedInput` 은 리뷰 3라운드에 걸쳐 **세 조건의 합**으로
      자랐는데(터치 · 마커 잔존 · 구조 필드 coerce 실패), 지금은 컴포넌트 본문 안 표현식이라
      **모달을 렌더해 DOM 을 통해서만** 검증할 수 있다.
      > 조건이 셋이면 진리표는 8행인데 렌더 경유 테스트는 실질 도달 가능한 조합만 친다 —
      > 이 시리즈가 조건을 늘릴 때마다 우회로가 하나씩 나온 이유이기도 하다. `fields` ·
      > `paramValues` · `touchedKeys` · `maskedKeys` 를 인자로 받는 순수 함수로 빼면
      > 8행을 그대로 테이블 테스트로 고정할 수 있다.
      > **이번 PR 에서 안 한 이유**: 동작 무변경 리팩터라 diff 성격이 갈리고, 리뷰어도 LOW
      > 판정했다. 조건이 **넷째로 늘어나는 순간**이 착수 시점이다.

- [x] **마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다**
      (2026-08-17 등재, `12_33_36` security/side_effect INFO-1 — 이 시리즈에서 **반복** 지적).
      `sanitize-error-message.ts` 의 `MASKED_MARKERS` 와 `lib/utils/masked-markers.ts` 의 동명 미러가
      손으로 복제돼 있다. 한쪽만 늘면 프리필 가드가 **그 신규 마커에 대해 조용히 fail-open**
      한다 — 마스킹된 값이 다시 프리필돼 실제 입력이 되는, 이 시리즈가 두 번 겪은 그 형태다.
      > **이번에 한 것**: 이름을 양쪽 동일하게 맞추고(`MASKED_MARKERS`/`isMaskedMarker`)
      > 상호참조 주석을 달았고, 프런트 테스트가 구현 상수에서 fixture 를 파생시키되
      > **리터럴 대조 테스트**로 값 자체를 못박았다. 즉 프런트 쪽 절반은 기계가 지킨다.
      > **남은 것**: 두 스택을 **가로지르는** 대조. backend jest 와 frontend vitest 가 갈려
      > 있어 공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로 남긴다.
      >
      > **닫았다 (2026-08-21)** — 계약 테스트가 아니라 **추출**로. `@workflow/masked-markers`
      > 를 신설해 두 스택이 import 한다(마커 3종 · `isMaskedMarker` · `MAX_MASK_DEPTH`).
      > 계약 테스트를 포기한 이유는 **CI 경로 게이팅**이다 — `frontend-checks` 는
      > `codebase/backend/**` 변경 때 검사를 생략하고 `backend-checks` 는 반대쪽을 생략하므로,
      > 한쪽에 둔 가드는 **반대쪽이 마커를 바꾸는 방향에 무력**하다. 양쪽 모두
      > `codebase/packages/**` 는 relevant 로 잡으므로 값을 그쪽으로 옮겼고, 이제 대조할
      > 미러가 없다. 남은 가드는 *미러가 되살아나지 않는지*(심볼 재선언)만 본다.

- [ ] **프리필 가드 후속 4건 (전부 비차단, `12_33_36` + `12_57_15` INFO)** — 2026-08-17 등재.
      > **제목의 개수·출처가 낡았다 (2026-08-28 `plan-audit`, 2026-08-29 재확인).**
      > 하위 목록은 **5개**이고 그중 1개(`isMaskedMarker` non-string)만 닫혀
      > **미해결은 4건**이다. 나머지 둘은 나중 라운드(`12_57_15`)에서 추가된 것이라
      > 출처도 `12_33_36` 하나가 아니다 — 제목에 둘 다 적었다. 4건 전부 미해소임을
      > 확인했다(2026-08-29).
      > <!-- 원 감사 메모 -->
      > **무엇이 낡았나**: 제목의 '3건' 이 낡았다 — 목록은 5개 하위 항목이고 1개(isMaskedMarker non-string)만 닫혀 **미해결 4건**이다. 나머지 둘은 나중 라운드(`12_57_15`)에서 추가됐다. 제목을 '후속 4건' 으로 고치고 출처를 `12_33_36`+`12_57_15` 병기할 것.
      > **실측**: 하위 4건 전부 미해소 실측: dynamic-form-ui.test.tsx 마스킹 가드 테스트 615·629·685·718 전부 `type:"text"`; presentation.mdx 마스킹/프리필 문자열 0건; 힌트 수명 단언 없음; 파일 상단 '검증 범위' 8줄에 마스킹 블록 없음.
      - ~~`isMaskedMarker` 의 non-string 입력(`123`/`null`/`true`) 직접 단위 테스트 (INFO-4).~~
        **닫혔다 (2026-08-21, PR #1190 — 2026-08-22 재판정에서 발견).** 공유 패키지
        `codebase/packages/masked-markers/src/__tests__/index.spec.ts` 의
        `[캐너리] 비문자열 %s 는 마커가 아니다` 가 `number`/`null`/`undefined`/`object`/`array`
        5종을 직접 순회한다. 미러 추출이 이 항목을 **부수적으로** 닫았고 아무도 적지 않았다.
      - 가드 회귀 테스트가 `type: "text"` 만 순회 — `select`/`textarea` 1건 추가로
        **타입 불문 가드**임을 고정 (INFO-5). 구현은 타입을 분기하지 않으므로 실동작 영향 없음.
      - 유저가이드 `02-nodes/presentation.mdx`(+`.en`)의 `defaultValue` 행에 프리필 스킵
        캐비엇 한 문장 (INFO-6, 3라운드 연속 잔여). 매트릭스가 요구하는 `05-run-and-debug/`
        타겟은 이미 갱신됐고 런타임 힌트가 원인을 그 자리에서 설명하므로 비차단.
      - **안내 힌트의 수명이 미결정** (`12_57_15` requirement/testing INFO-4, 3라운드에서
        처음 나옴). 힌트는 불변 prop 인 `field.defaultValue` 를 보므로 사용자가 값을 채운
        **뒤에도 남는다**. "왜 비어 있었는지" 를 계속 설명하는 것이 맞다고 보지만 결정한
        적이 없고 단언하는 테스트도 없다 — 의도를 정하고 `fireEvent.change` 후 상태를
        고정할 것.
      - 테스트 파일 상단 "검증 범위" JSDoc 목록에 신규 마스킹 왕복 차단 블록 미등재
        (`12_57_15` documentation INFO-7).
      > **`required` + 마커 조합은 조치 불요** (`12_57_15` side_effect INFO-5): 빈 초기값이
      > 되면서 네이티브 HTML5 validation 이 `handleSubmit` 이전에 제출을 막는다 — 이 PR 의
      > 목적을 **보강하는** 방향이라 결함이 아니다. 다만 이전 라운드가 다룬 적 없어 적어 둔다.

- [ ] **`kb:<documentId>` · `background:run:<id>` WS 채널에도 값-패턴 마스킹 적용 검토**
      (2026-08-17 등재, `00_23_57` security INFO-1). 두 채널의 구독 인가도 `execution:` 과
      **같은 근거**(role 미검사, workspace 소유만 확인)인데 `maskWireEnvelope` 밖에 있다.
      > 이번에 닫지 않은 이유: **외부 fanout 이 없다** — `executionEventSubject` 로 흐르지
      > 않아 SSE/chat-channel 에 도달하지 않는다. 즉 이 PR 이 겨눈 "외부 누출" 표면이
      > 아니다. 다만 population-parity 논리는 그대로 적용되므로 별건으로 남긴다.

- [x] **`sanitize-error-message.ts` 마커 JSDoc 을 `MASKED_MARKERS` 에 귀속시키기**
      (2026-08-17 등재, `00_47_01` documentation W1). 마커 계층 설명 대형 JSDoc 이 중간에 낀
      한 줄 주석들 때문에 그 상수에 붙지 않는다 — 배치 문제이고 내용·동작은 무관하다.
      > **이연 사유**: 리뷰 3R 의 유일한 WARNING 도 주석 한 줄이었고 그것을 고치자 4R 이
      > 열려 같은 급의 nit 을 냈다. 게이트가 **주석 한 글자에도** 리뷰를 stale 처리하므로
      > 여기서 또 고치면 5R 이 열린다. 발견의 성격이 두 라운드 연속 문서 층 =
      > 이 저장소의 수렴 신호라, 다음에 이 파일을 여는 작업에 곁들인다.
      > **→ 그 "다음 작업" 이 프리필 가드 PR(2026-08-17)이었다.** 예고대로 곁들여 처리했고,
      > 프런트 미러 상호참조도 같은 편집에서 붙였다. 위 이연 사유는 **해소된 과거 기록**이다.

- [x] **유저 가이드 Error 탭에도 마스킹 캐비엇** (2026-08-17 등재, `00_23_57` documentation
      INFO-19). 이번엔 Output 탭만 반영했다 — `error` 도 #1179 이후 마스킹되므로 같은 캐비엇이
      맞지만, 이 PR 의 변경 대상(`outputData`)에 범위를 맞춰 좁게 반영했다.

- [x] **WS 대기-재개 경로에도 같은 "마스킹된 값의 재사용" 이 있는지 점검** — 집행 완료
      (2026-08-17). **진짜 결함이 하나 있었다.**
      > **폼 `defaultValue` 프리필 왕복 오염** — `formConfig` 는 `waiting_for_input` payload
      > 를 타고 오고 #1180 이 그 payload 를 마스킹하는데, `DynamicFormUI` 가 `defaultValue`
      > 로 폼을 프리필하고 사용자가 손대지 않으면 리터럴 `'***'` 가 **실제 폼 값으로 제출**
      > 된다. 무수정 프로브로 `Bearer sk-live-ABC` → `***` 실측(머지된 코드에서 이미 성립).
      > **마커 가드로 닫았다** — carve-out 은 불가(`formConfig` 는 SSE·webhook 으로도 나간다).
      >
      > **버튼 재개는 무해**가 맞았다 — `resumeFromButtons` 는 로컬 UI 상태만 정리한다.
      > conversation 재개(`submitMessage`)도 사용자 입력을 보내지 프리필 왕복이 아니다.
      >
      > **교훈**: 이 항목을 등재할 때 나는 `resumeFromButtons` 만 보고 "무해" 로 정리한 뒤
      > form 경로를 끝까지 보지 않았다. *"전수로 훑어 두는 것이 값싸다"* 고 적어 둔 것은
      > **미루는 근거가 아니라 그때 했어야 할 일**이었고, 그래서 게이트 7라운드가 놓쳤다.

- [x] **내부 REST 의 `outputData` 는 원문이다** — 해소(2026-08-16, `fe6a54c80`).
      (`inputData` 는 위 항목으로 분리 — 되돌렸다.)
      트래커가 지목한 `toExecutionDto` 한 줄이 아니라 **여섯 표면**이었다 —
      `toResponseExecution` 의 `...rest` 가 엔티티를 통째 펼치던 자리 셋과
      `nodeExecutions[]`, 그리고 트래커에 없던 `BackgroundRunsService` 자매까지.
      > **"`Execution.error` 와 같은 형태" 라는 이 항목의 서술은 틀렸다.** `error` 는 마커
      > 없는 자유 필드지만 `inputData` 에는 webhook ingestion 의 `[REDACTED]` 마커가 이미
      > 있다(12-webhook §5.3 계약, 4개 문서가 전제 공유). 값-마스커가 그걸 `***` 로 덮는
      > 충돌을 무수정 프로브로 확인했고, `deepRedactSecrets` 를 **마커에 대해 멱등**하게
      > 만들어 닫았다. 이건 §C 가 "결정 항목" 으로 떼어 둔 충돌과 **같은 형태**다

> **왜 그 PR 에서 안 고쳤나**: 노출이 `error` 객체화로 **넓어지지 않았다** — 종전에도 같은
> `errMessage` 문자열이 같은 fanout 을 탔다. 형태만 바뀌었지 내용과 경로는 동일하다.
> 즉 선존 갭이고, `durationMs` 를 "비용이 다르다" 고 떼어낸 PR 이 이걸 끌어들이면 앞뒤가
> 안 맞는다. **단, 이건 보안 항목이라 우선순위가 위 HMAC 문서 정정보다 높다.**

## 타 문서가 EIA 의 현재 형태를 못 따라간 서술 (2026-08-15 등재, `09_00_27` cross_spec)

둘 다 **EIA 쪽이 이미 정합**인데 참조하는 문서가 옛 서술을 유지한 경우다 — 내 diff 밖이라
등재만 한다.

- [x] **`15-chat-channel.md` §5.1(319행)·§8(507행)** — `InteractionRequestContext` 를
      "단일 인터페이스 + optional `scope` 필드" 로 서술한다. EIA §3.3.1 은 이미
      **discriminated union**(`External`/`Internal` 별도 인터페이스)으로 정의하고 코드도
      그렇다. **체커가 "보안 민감(토큰-우회 타입)이라 우선도 있다" 고 표시했다** — 다만
      문서 stale 이지 런타임 결함이 아님을 확인했다. EIA §3.3.1 을 SoT 로 가리키는 포인터로
      대체하는 편이 재-drift 를 막는다
- [x] **EIA §5.1** 이 webhook §5.2 를 *"legacy `statusCode/errors` shape"* 라 서술 —
      webhook 은 2026-06-28(`7e181ed8e`)에 이미 `{error:{code,message,details}}` 로
      정합화됐다. 대비 문구가 유효기간을 넘겼다
- [x] ~~**`interaction.guard.ts:27` JSDoc 의 `EIA-AU-09` 오기**~~ → **완료 (2026-08-27, `eia-misc-hygiene`)**.
      `+ §3.3.1 EIA-AU-09` → `+ §3.3.1` (그 절 자체는 실재하므로 참조는 살렸다).
      결합 표기(`EIA-AU-08/09`)까지 포함한 전수 재스윕 결과 저장소 잔존 **0건**.
      (2026-08-23 등재,
      `21_24_43` rationale INFO 7). spec 쪽은 `spec-text-fixes` planner 턴이 정정했으나
      **코드 주석은 developer 소관**이라 그 턴에서 못 건드렸다.
      > 실측: `* [Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09] — In-process trusted caller 예외.`
      > `EIA-AU-09` 는 정의된 적이 없다(EIA 는 `01`~`08`). **`+ §3.3.1 EIA-AU-09` 부분만**
      > 지우면 된다 — §3.3.1 자체는 실재하는 절이므로 그 참조는 살릴 수 있다.
      > 이 파일을 다른 이유로 여는 작업에 곁들인다.

- [x] (INFO) `data-flow/15-external-interaction.md:119` 가 **정의되지 않은 `EIA-AU-09`** 참조
      (EIA §3.3 은 `01`~`08` 까지만 정의)

## ⚠️ `duration_ms` 에 "대기 시간" 이 섞여 집계를 오염시킨다 (2026-08-15 등재, `10_34_51` W3)

이번 PR 이 처음으로 `duration_ms` 를 채우는 5경로 중 다수의 값은 **실행 시간이 아니라
대기 시간**이다(위젯 idle-wait 는 기본 grace 만 1시간, park 취소는 무기한).

**읽는 쪽이 status 필터 없이 평균을 낸다:**

| 소비처 | 상태 |
|---|---|
| `dashboard.service.ts` `avgExecutionTime` | **해소** (`f79792621`) — `status='completed'` 필터 |
| `statistics.service.ts` `avgDurationMs` ×2 | **해소** (`f79792621`) — 두 자리 모두 |
| `frontend/.../executions/page.tsx:292` 외 3곳 Duration 컬럼 | **잔여** — 아래 참조 |
| `alerts-evaluator.service.ts` | **우연히 안전** — `status='completed'` 필터가 있다 |

- [x] 집계 3자리에 status 필터 (`f79792621`). 자리별 뮤테이션으로 판별력 확인
- [ ] **프런트엔드 Duration 컬럼 4곳** — 순진한 status 필터는 **오답**이다(아래 실측)
- [ ] 순수 실행시간과 wall-clock 대기시간의 **노출** — 위 항목의 유일한 정답
      > **"필드 분리" 는 이미 돼 있다 — 남은 것은 노출이다 (2026-08-29 재실측).**
      > 이 항목을 *신규 설계 과제*로 적어 둔 것이 낡았다. DB/엔티티 층 분리는 `#469`
      > (f0fa0bacf, 2026-06-05)로 **이미 존재**한다 — `execution.entity.ts` 의
      > `@Column({ name: 'active_running_ms' }) activeRunningMs`, JSDoc 이
      > "waiting_for_input park 시간은 제외 … wall-clock 총 소요는 `durationMs` 별도" 로
      > 의미까지 못박는다. 그러니 남은 작업은 **DTO·프로젝션·프런트 노출**이다.
      > 설계 과제로 적어 두면 착수자가 없는 결정을 다시 내리려 하고, 이미 내려진 결정과
      > 어긋날 위험이 생긴다.

### 프런트엔드는 status 로 못 가른다 (실측)

`stop()` REST 취소도 `CANCELLED` 인데(`executions.service.ts` `stoppable: [RUNNING, PENDING]`)
`RUNNING → CANCELLED` 의 duration 은 **진짜 실행 시간**이다. 프런트엔드는 직전 상태를 볼 수
없으므로 `status === 'cancelled'` 로 지우면 **정상 동작을 깨뜨린다**.

집계 쪽에서 `completed` 만 남긴 것이 맞는 이유도 여기 있다 — `finalizeStalledExhausted` 가
`FAILED` 라서 FAILED 도 이 PR 로 오염된다. `completed` 만이 오염되지 않은 유일한 상태다.

> **다만 그 필터는 지표 정의를 바꾼다.** 종전에 집계되던 **정상 실패**와 **stop 취소**의
> 실제 duration 이 이제 평균에서 빠진다. 대시보드 숫자가 이동한다 — CHANGELOG 에 고지했다.

임시 완화로 유저 가이드(`run-results.mdx` KO/EN)에 캐비엇을 넣었다. 근본 해결은 필드 분리다.

> **두 라운드가 이 영향을 못 봤다.** spec-to-spec 대조도, 코드 diff 리뷰도 "이 컬럼을
> **읽는** 쪽" 까지 따라가지 않았다. 쓰기를 늘릴 때 읽는 쪽을 세는 것이 빠졌다.

## §8.2 HMAC 화이트리스트가 자기 문서와 모순 (2026-08-15 등재, `10_52_07` cross_spec W1)

§8.2 는 *"`hmac-sha256` 만"* 이라 적는데 **같은 문서 §3.1 EIA-NX-03·R12**, `data-flow/15`,
그리고 코드(`notification-signature.util.ts` `SupportedHmacAlgorithm`)는 전부
**sha256 + sha512 둘 다** 화이트리스트다. 보안 섹션의 자기모순이라 우선순위가 높다.

- [x] §8.2 를 `hmac-sha256` / `hmac-sha512`(§R12) 로 정정. "v2 추가 시 `v2=` prefix" 문구는
      secret rotation 표기와 구분해 재작성하거나 삭제
      **완료 (2026-08-31).**
      - **화이트리스트**: `hmac-sha256` **만** → `hmac-sha256` / `hmac-sha512`. 이 문장은
        **자기 문서보다도 좁았다** — §R12 는 *"각 경로에서 화이트리스트는 `sha256`/`sha512`
        만 (둘 다)"*, EIA-NX-03 도 두 값을 명시한다. 구현도 마찬가지다:

        | 지점 | 값 |
        |---|---|
        | `notification-signature.util.ts:11` | `SupportedHmacAlgorithm = 'hmac-sha256' \| 'hmac-sha512'` |
        | `notification-config.dto.ts:46` | `@IsIn(['hmac-sha256', 'hmac-sha512'])` |
        | `notification-webhook.processor.ts:298` | `if (raw === 'hmac-sha512') return 'hmac-sha512'` |

      - **`v2=` 문구는 삭제가 아니라 축을 갈라 재작성했다.** 그 문장은 세 가지를 한 줄에
        섞고 있었다 — (a) 알고리즘 화이트리스트(그 bullet 의 주어) (b) **서명 스킴 버전**
        (`X-Clemvion-Signature` 의 `v1=`) (c) 읽는 사람이 떠올리는 `notification_secret_v2`
        (**secret rotation 컬럼**, §7.1). (b)는 실재하는 forward-compat 서술이라 지우면
        정보가 사라진다. 그래서 별 bullet 로 내리고 (c)와 **이름만 겹친다**고 못박았다.
      - **넓히지 않았다**: "현재 발행되는 것은 `v1=` 뿐" 을 함께 적었다. `v2=` 는 예약이지
        구현된 것이 아니다.
      - **앵커 3건 자체 검증**: 초안이 `#31-비기능-요구사항`(§3.1 의 실제 제목은 *Outbound
        Notification*)과 *"§8.2 상단 형식 참조"*(형식은 **§6.1 헤더**에 있다) 두 곳을
        틀렸다. 바로 위 항목이 등재한 **"`spec-links` 가 앵커를 안 본다"** 가 그대로 재현된
        것이라, 헤딩 slug 대조로 직접 잡았다 — 최종 3건 전부 OK.

## retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다 (2026-08-15 등재, `10_34_51` W1)

`finalizeGuarded` 의 CANCELLED 분기는 `COALESCE(duration_ms, :new)` 로 **`stop()` 이 커밋한
T1 값을 DB 에 보존**하는데, in-memory `execution.durationMs` 는 갱신되지 않아 **emit 은
재진입 시점 T2(더 큰 값)를 싣는다.** 희귀 레이스가 아니라 "retry-turn 처리 중 Stop" 이라는
일반 흐름에서 결정적으로 발생한다.

- [x] **자매 1곳** — **완료**. `finalizeCancelledExecution` 이 guarded
      UPDATE 가 0행이어도 emit 을 발행한다.
      > **처방 정정 (2026-08-15 실측).** 이 항목은 근본 원인을 *"`updateExecutionStatus` 가
      > `RETURNING` 없이 boolean 만 돌려주는 것"* 이라 적고 **둘을 함께 고쳐야 한다**고
      > 했는데, **둘 다 틀렸다.** boolean 으로 충분하다 — 호출부가 **그걸 읽지 않을 뿐**이다.
      > 바로 옆 자매 `finalizeFailedExecution` 은 같은 반환을 읽어 emit 을 skip 한다.
      > 그리고 두 항목은 **독립**이다: 이쪽은 "반환을 읽어라", 아래 CANCELLED 분기는
      > "`RETURNING` 을 추가하라" 로 처방이 다르다.
      >
      > 심각도도 한 칸 위다. "DB 미영속 로컬 값" 이 아니라 **DB 가 FAILED 인데 수신자는
      > cancelled 를 받는다** — 이 저장소가 이미 세 번 CRITICAL 로 잡은 사후 오시그널이다.
      > `finalizeFailedExecution` 의 주석이 *"형제와 동일한 guarded 경로"* 라고 **대칭을
      > 주장하는데 절반만 참이다**.
- [x] `markQueueWaitTimeout` threading 테스트 — **완료 (`777698bbe`)**. mock 에
      `duration_ms: 600000` 부여 + 정확 매칭. 이 경로만 값의 의미가
      "큐 대기 시간" 이라 다른 4경로로 대체 증명되지 않는다 (`11_09_44` testing W4)
- [x] CANCELLED 분기에 `.returning(...)` — **완료**. 실제 persist 값을 되읽어 emit
      전 갱신. 회귀 테스트는 **emit 값 자체**를 단언할 것(기존 테스트는 SQL 형태만 봐서 못 잡았다)

> ~~이 PR 이 세운 "DB = wire" 불변식의 유일한 잔여 위반이다. 같은 라운드에서 즉시 고치지
> 않은 이유는 **DB write 경로를 또 바꾸는 변경**이고, 서두르면 같은 라운드가 지적한
> 과잉 스코프(W2)를 반복하기 때문이다.~~ **(2026-08-15 해소)** —
> [`eia-db-wire-invariant`](../complete/eia-db-wire-invariant.md) 가 위 세 항목을 전부 닫았다.
>
> **이 산문이 stale 로 남은 것 자체가 지적사항이었다** (`15_23_10` documentation W3).
> 바로 위 체크박스 3개가 `[x]` 로 바뀌었는데 결론 문단은 미완료 전제를 그대로 유지했다 —
> 같은 세션에서 **세 번째**다(§6.5 취소선 대신 삭제 · `node-cancellation.md` 되돌린 동작
> 잔존 · 이 문단). **체크박스를 옮길 때 그 옆 산문을 같이 읽어라.**

## `finalizeStalledExhausted` 만 트랜잭션 밖이다 (2026-08-15 등재, `12_52_39` database W1)

**선존 결함이고 이 PR 이 유발하지 않았다** — `git diff origin/main...HEAD` 에서 이 함수의
NodeExecution cascade 도 트랜잭션 경계도 건드린 라인이 **0건**이다. 다만 이 PR 이 직접
확장한 함수이고, 실측해 보니 **어느 트래커에도 없었다**.

세 자매가 같은 2-테이블 쓰기(Execution UPDATE + NodeExecution cascade UPDATE)를 하는데
둘만 원자적이다:

| 함수 | 트랜잭션 | NodeExecution 쓰기 |
|---|---|---|
| `cancelParkedExecution` | **있음** | 있음 |
| `markWebChatIdleTimeout` | **있음** | 있음 |
| `finalizeStalledExhausted` | **없음** | 있음 |

첫 UPDATE 가 커밋된 뒤 둘째가 실패(DB 오류·크래시)하면 자식 NodeExecution 이 **영구
`RUNNING`** 으로 잔류한다 — 자매 두 함수의 docstring 이 경고하는 바로 그 실패 모드다.

- [x] `finalizeStalledExhausted` 의 두 UPDATE 를 `dataSource.transaction()` 으로 묶어
      자매 두 함수와 같은 패턴으로 통일 — **완료**
      ([`eia-stalled-atomicity`](../complete/eia-stalled-atomicity.md)). 트랜잭션 제거 뮤턴트에서
      3/3 RED. 부수 발견: `affected=0` 테스트의 단언이 **항상 참**이 될 뻔했다(더 이상
      쓰지 않는 repo mock 을 보고 있었다) — 실제 단언으로 교체

> 이 저장소의 반복 형태(*"하드닝을 자매 함수 미적용"*)의 교과서적 사례다 — 셋 중 둘만
> 닫혀 있다. **리뷰어가 직전 라운드의 자기 판정을 실측으로 정정해 찾아냈다.**

## 동일 CANCELLED 전이에 독립 emit 이 여러 번 나갈 수 있다 (2026-08-15 등재, `15_23_10` concurrency W1)

`finalizeCancelledExecution` 이 0행 후 재조회해 `CANCELLED` 면 발행하도록 고치면서 **"DB 와
모순되는" 중복은 닫혔지만**, 여러 finalizer 가 같은 CANCELLED 전이를 각자 관측하면 각자
독립적으로 `EXECUTION_CANCELLED` 를 낸다 — **단일 emit 관문이 없다.**

payload 값은 같으므로(둘 다 DB 정본을 읽는다) 수신자가 보는 것은 **중복 이벤트**이지 모순은
아니다. 리뷰어도 *"이번 diff 가 새로 만든 문제는 아니고"* · *"긴급도는 낮으나"* 로 명시했다.

- [ ] execution 당 단일 finalizer 도달이 job/advisory lock 으로 보장되는지 **실측**하고,
      보장되면 근거를 주석에, 아니면 EIA §6 에 "동일 전이에 최대 N개 독립 emit 가능,
      payload 는 동일" 캐비엇 추가

## 신규 테스트 `(d)` 가 공유 `arrange()` 를 우회한다 (2026-08-15 등재, `15_23_10` maintainability W2)

재조회 throw 케이스를 넣으면서 `arrange()` 헬퍼가 `liveStatus` 만 받아 "reject" 를 표현하지
못해 셋업을 손으로 복제했다. **이 PR 이 반복해서 지적당한 "불완전한 mock 셋업" 과 같은 결**이다.

- [ ] `arrange({liveStatus} | {rejects})` 로 시그니처를 넓혀 `(d)` 도 헬퍼만 쓰게 한다

> **이번 PR 에서 안 한 근거 (실측)**: 테스트 자체는 판별력이 있다 — `try/catch` 를 뺀
> 뮤턴트에서 `(d)` 가 **RED** 다. 정정은 codebase 편집이라 리뷰 신선도 게이트가 다시 열리고,
> 이 브랜치는 이미 5라운드를 돌았다. **동작 위험이 아니라 미래 stale 위험**이므로 별도 PR.

## `finalizeStalledExhausted` 트랜잭션의 실 DB 롤백 검증이 없다 (2026-08-15 등재, `16_19_57` W1)

원자화는 완료됐지만(`eia-stalled-atomicity`) **mock 은 롤백을 흉내내지 못한다.** 현재
테스트가 보증하는 것은 *두 UPDATE 가 같은 트랜잭션 manager 를 탄다*는 전제까지다.

- [ ] 실 DB e2e — 둘째 UPDATE(`NodeExecution` cascade)를 강제 실패시키고 첫째
      (`Execution` → FAILED)가 **커밋되지 않았음**을 확인

> **이 항목을 등재하는 것 자체가 지적사항이었다.** 나는 `eia-stalled-atomicity.md` 에
> *"정본 트래커에 등재돼 있다"* 고 썼는데 **이 문서에 "실 DB"·"롤백" 문자열이 0건**이었고,
> 내가 지목한 자매 plan(`retry-turn-terminal-guard.md` #4)은 **다른 함수**(`finalizeGuarded`)
> 를 다룬다. `16_19_57` plan_coherence 가 실측으로 반증했다.
>
> **이 형태가 네 번째다** — "별건 등재됨" 3회(`11_59_09`) · 엔티티 nullability 주석
> (`13_58_27` W9) · 그리고 이 건. **유예의 근거로 "등재했다" 를 쓸 때 그 등재를 열어서
> 확인하라.** 세 번은 grep 이 반증했고 이번엔 문자열 카운트가 0이었다.

## `claimResumeEntry` 만 두 테이블을 반대 순서로 잠근다 (2026-08-15 등재, `16_44_28` concurrency W1)

**실측** (`.update(Entity)` 등장 순서):

| 함수 | 잠금 순서 |
|---|---|
| `cancelParkedExecution` | Execution → NodeExecution |
| `markWebChatIdleTimeout` | Execution → NodeExecution |
| `finalizeStalledExhausted` | Execution → NodeExecution |
| **`claimResumeEntry`** | **NodeExecution → Execution** |

교차 함수 lock-order 역전이라 이론적 데드락 표면이다(다중 브랜치 실행에서 한쪽이 stalled
소진 중, 다른 쪽이 동시에 재개될 때).

- [ ] `claimResumeEntry` 의 순서를 자매 셋과 맞추거나, 맞출 수 없으면 그 이유를 JSDoc 에 명시
- [ ] 자매 셋의 JSDoc 에 `claimResumeEntry` 와의 역전 가능성 한 줄

> **선존이고 이 PR 이 만들지 않았다** — 자매 둘이 이미 `Execution → NodeExecution` 이었고
> `claimResumeEntry` 만 반대였다. 이 PR 은 **세 번째를 같은 방향으로 맞춘 것**이라 자매 간
> 일관성은 오히려 개선됐다. Postgres 가 데드락을 자동 검출하고, 이번에 추가한 실패-전파
> 테스트가 hang·유령 상태가 없음을 잠근다 — 그래서 차단 사유가 아니다(리뷰어도 동의).

## 종결 이벤트 emit 에 타입 초크포인트가 없다 (2026-08-15 등재, `11_59_09` architecture W1)

`emitExecution(payload: unknown)` 이 종결 payload 형태를 **타입으로 강제하지 않아** 필드
하나를 16개 호출부에 손으로 스레딩해야 한다. `11_59_09` 리뷰어의 진단: 이 구조가
**이 PR 8라운드에 걸친 반복 결함의 근본 원인**이다 — 형제 경로 누락 · grep 미검출 ·
JS/SQL 클램프 비대칭 · vacuous mock 이 전부 같은 뿌리다.

- [x] 종결 3종 전용 타입 파사드 — **완료**
      ([`eia-terminal-emit-facade`](../complete/eia-terminal-emit-facade.md)).
      `ExecutionEventEmitter.emitTerminalExecution(executionId, TerminalEventPayload)`.
      직접 호출 **11곳 → 0곳**. `status`·이벤트명은 `type` 에서 파생하고,
      `durationMs`(3종) · `error`(failed) · `cancelledBy`(cancelled)는 필수 필드다.
      **판별력**: `cancelledBy` 제거 → `TS2345`, `durationMs` 제거 → `TS2345` —
      이 세션이 실제로 겪은 두 결함이 **컴파일 타임에** 잡힌다

> **"16 호출부" 는 부정확했다** (2026-08-15 정정). 그건 `durationMs` 를 **스레딩하는 경로**
> 수다. `emitExecution` **직접 호출**은 11곳이고 나머지는 `emitCancellationEvent` 경유다.

> **이 항목을 등재하는 것 자체가 지적사항이었다.** 나는 세 라운드에 걸쳐 RESOLUTION 과
> 커밋 메시지에 *"별건 등재됨"* 이라 썼는데 **`plan/` 전체 grep 결과 그런 체크박스가 없었다**
> (`11_59_09` W1 이 실측으로 반증). 실제로 만든 것은 **task 칩**이었고 그건 SoT 가 아니다 —
> 이 저장소의 기록된 교훈이 정확히 *"미룬 항목은 그 턴에 `plan/` 에 적어라"* 다.
> **유예의 근거로 "등재했다" 를 인용할 때, 그 등재를 실측하지 않았다.**

## `cancelledBy` 가 실제 취소 주체를 모른다 (2026-08-15 등재, `18_29_21` W3·W7)

`retry-turn` 재진입 취소는 `cancelledBy: 'user'` 를 **하드코딩**한다.
`ExecutionCancelledError` 는 "DB 가 이미 CANCELLED" 를 관측했을 때 던져지므로 **누가
취소했는지 알 수 없다** — 실제 원인이 timeout/system 이면 `cancelledBy` 와 `error` 부재가
**함께** 틀린다. 자매 `finalizeCancelledExecution` 도 같은 근사를 쓴다.

- [ ] DB 의 `error.code` 로 원인을 파생한다 (§6.5 표: `RESUME_*`→system,
      `EXECUTION_QUEUE_WAIT_TIMEOUT`·`WEBCHAT_IDLE_TIMEOUT`→timeout, 없으면 user)
- [ ] spec §6 표 비고에 "동시 시스템 취소 레이스에서 `'user'` 로 근사될 수 있음" 한 줄

> **이 항목을 등재하는 것 자체가 지적사항이었다 — 그리고 다섯 번째다.**
> 나는 `eia-terminal-emit-facade.md` 에 *"별도 항목으로 등재한다"* 고 **미래형으로** 써 놓고
> 하지 않았다(`grep` 0건). 앞선 넷: "별건 등재됨" 3회(`11_59_09`) · 엔티티 nullability 주석
> (`13_58_27`) · 실 DB e2e(`16_19_57`).
>
> **패턴이 분명하다** — 유예를 정당화할 때 "등재한다/했다" 를 쓰고, 그 문장을 쓰는 시점에
> 실제로 등재하지 않는다. 체커가 *"이 세션 내에서 이미 한 차례 자백한 패턴의 재발"* 이라고
> 적었다. **미래형으로 쓰지 말고 그 자리에서 등재할 것.**

## `websocket.service` 가 값(enum)과 서비스를 함께 export 해 순환을 만든다 (2026-08-15 등재, `17_54_32` architecture W7)

`ExecutionEventType` 같은 **런타임 값**이 서비스 구현 파일에서 export 돼,
`websocket.service ↔ websocket.gateway ↔ execution-engine/retry-turn ↔ event-emitter`
ES-module 순환 위에 놓인다. 생성자의 `forwardRef` 도 같은 이유다.

**이건 이론이 아니다** — 종결 파사드가 `type`→enum 매핑을 **모듈 스코프 상수**로 두자
모듈 평가 시점에 enum 이 `undefined` 여서 **72 suites 가 터졌다.** 호출 시점 지연 평가로
우회했지만 근본 원인은 남았고, `tsc` 는 이 클래스를 못 잡는다.

- [x] `ExecutionEventType`·`NodeEventType` 등 런타임 값을 의존성-프리 모듈로 추출 —
      **완료** ([`ws-event-types-extract`](../complete/ws-event-types-extract.md) —
      2026-08-30 `complete/` 로 이동).
      `websocket-events.types.ts` 신설(**import 0줄 · 구현 0개**), 호출부 **25 → 13**,
      타입만 가져가던 곳 **1** — 그 하나는 re-export facade 를 검증하는
      `websocket.service.spec.ts` 라 **의도된 커버리지**다.

      > ~~타입만 가져가던 곳 **0**~~ 은 **틀린 수치였다** (`11_36_05` documentation W1).
      > 정본 트래커가 그 값을 TS 파서 전수(1,230 파일)로 **1** 로 재측정해 정정했는데
      > 이 요약만 옛 값을 들고 있었다 — **한 PR 이 두 문서에서 서로 다른 수를 주장**했다.
      > 원 grep 이 편집 스크립트의 제외를 물려받아 생긴 오측이고, 경위는
      > [`ws-event-types-extract`](../complete/ws-event-types-extract.md) §③ 에 있다.
      **역재현으로 실증**: 72 suites 를 터뜨렸던 모듈 스코프 파생을 되살려 **425/425 통과**.
      그 형태를 **캐너리로 남겼다** — 순환이 되살아나면 즉시 대량으로 깨진다

## `emitTerminalExecution` vs `emitTerminalExecutionMetrics` (2026-08-15 등재, `18_29_21` W8)

접두어가 거의 같아 grep 오인 소지가 있다. **시그니처가 달라 컴파일 타임 오용은 불가**하고
체커도 *"이름 변경은 불요"* 로 판정했다.

- [ ] 양쪽 JSDoc 에 상호 참조 한 줄 ("Not to be confused with…")

> 이번 PR 에서 안 한다 — codebase 편집이라 리뷰 신선도 게이트가 다시 열리는데,
> **컴파일 타임 안전이 보장된 명명 근접**이라 그 비용에 값하지 않는다.

## 종결 duration 관용구가 16곳에 손으로 복붙돼 있다 (2026-08-15 등재, `12_52_39` W5·W6)

헬퍼(`resolveTerminalDurationMs`)를 도입해 **계산**은 한 곳으로 모았지만, 그것을 **적용하는**
관용구 자체는 여전히 분산돼 있다.

- `RETURNING` 추출 `toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null` — 5곳
- 재계산 대입 `X.durationMs = resolveTerminalDurationMs(X) ?? X.durationMs;` — 11곳

- [ ] `extractReturnedDurationMs(result)` / `applyResolvedDuration(entity)` 로 축소

> **이번 PR 에서는 하지 않았다.** 이 브랜치에서 넓은 일괄 편집이 대상 밖 8곳을 조용히 바꿔
> 전량 되돌린 전례가 있다. 16곳을 한 번에 건드리는 리팩터를 10라운드째 PR 끝에 넣는 것은
> 그 사고를 반복하기 딱 좋은 자리다 — 별도 PR 에서 리뷰와 함께.

## `durationMs` 후속 2건 (2026-08-15 등재, `09_58_24`)

- [x] **REST `GET /api/external/executions/:id` 에 `durationMs`** — **완료**. push 계열
      (webhook/SSE/WS)만 채워져 **"이벤트로 받으면 있는데 재조회하면 사라지는"** 비대칭이
      생겼다. `ExecutionStatusDto` + `STATUS_PROJECTION_COLUMNS` 에 추가하거나, 의도적
      제외라면 §5.3 에 사유를 적을 것. CHANGELOG 에 이미 고지했다.
      > spec-consistency 라운드는 **spec-to-spec 대조만** 해서 이 갭을 못 잡았다 —
      > 코드 표면 간 비대칭은 ai-review 만 본다.
- [x] **`TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 에서 값 검증된 적이 없다** (W10).
      단위 테스트는 문자열 `toContain` 뿐이고, 이 SQL 을 태우는 유일한 e2e
      (`webchat-idle-reaper.e2e-spec.ts`)도 `duration_ms` 를 SELECT/assert 하지 않는다.
      **부호·단위(초 vs ms)·클램프 오류를 잡을 안전망이 없다** — 이번 라운드가 클램프
      부재를 리뷰로만 잡았다는 사실이 그 비용을 실증한다. ~~e2e 에 `duration_ms >= 0`
      sanity 단언 추가.~~
      > **닫았다 (2026-08-23, `eia-tracker-groom`)** — `duration_ms >= 0` 보다 강하게,
      > **정본 SQL 문자열을 그대로** 실제 Postgres 에 태워 값을 단언한다
      > (`test/terminal-duration-sql.e2e-spec.ts`). 이름 있는 파라미터만 pg 자리표시자로
      > 바꾸고 나머지는 손대지 않는다 — 테스트가 SQL 을 재작성하면 검증 대상이 사라진다.
      >
      > | 케이스 | 잡는 결함 |
      > | --- | --- |
      > | 1,500ms → `1500` | **단위** — 초로 계산하면 `1`/`2` |
      > | `finishedAt < started_at` → `NULL` | **부호** — 종전 `GREATEST(0, …)` 회귀(0 vs null) |
      > | 같은 시각 → `0` | 경계 — null 과 0 의 구분 |
      > | 100일 → `PG_INT4_MAX` | **클램프** — 없으면 `integer out of range` 로 문장 전체 실패 |
      >
      > e2e 총계 **276 → 282**(신규 6건 = 값 4 + 스키마 2).
      >
      > ⚠️ **원 항목의 주장이 한 칸 넓었다** (뮤테이션 실측): *"부호·단위·클램프"* 중
      > **부호·클램프는 이미 잡히고 있었다** — 단위 스펙이 `LEAST(…)` 와 `'THEN NULL'` 을
      > **문자열로** 단언해서, 그 토큰을 지우는 뮤턴트가 죽는다(각각 RED 2건·1건).
      >
      > **진짜 갭은 `단위` 하나였다** — `* 1000` 을 제거해도 단위 스펙은 **38/38 GREEN** 이고
      > 신규 e2e 만 RED(2건)다. `toContain('* 1000')` 을 추가해도 *"`EXTRACT(EPOCH)` 가 초를
      > 준다"* 는 **의미**는 여전히 검증되지 않으므로, 문자열 단언으로는 원리적으로 닿지
      > 못한다. 범위가 좁아졌을 뿐 작업의 필요성은 그대로다 — 남은 그 한 종류가 하필 가장
      > 조용하다(값이 1000배 틀려도 아무것도 안 죽는다).
      >
      > **결속 메모** (`10_48_33` plan_coherence INFO-7): 이 e2e 는 `TERMINAL_DURATION_MS_SQL`
      > 을 **정본 문자열 그대로** 태운다(이름 있는 파라미터만 치환). 그게 검증력의 원천이지만
      > 동시에 결속이기도 하다 — 이 SQL 의 형태를 바꾸는 작업(예: `duration_ms` 필드 분리)은
      > **이 e2e 를 함께 갱신**해야 한다. 파라미터 이름은 `TERMINAL_FINISHED_AT_PARAM` 에서
      > 읽으므로 이름 변경은 따라온다.
- [x] (저비용) `TERMINAL_DURATION_MS_SQL` 이 컬럼명 `started_at` 을 하드코딩 — 엔티티
      메타데이터와 대조하는 assertion 을 다음 편집 때 (W7)
      > **닫았다 (2026-08-23, 같은 e2e)** — `getMetadataArgsStorage()` 로 엔티티에서
      > 테이블·컬럼명을 **유도**해 (a) SQL 문자열 ↔ 엔티티 (b) 엔티티 ↔ 실 스키마를 잇는다.
      >
      > 함께 **`duration_ms` 가 정말 `integer`(int4)인지**도 본다 — 그게 `PG_INT4_MAX`
      > 클램프의 **전제**다. 전제가 조용히 바뀌면(bigint 승격 등) 클램프는 근거 없는 절단이
      > 된다.
      >
      > **부수 발견**: 처음엔 테이블명을 `'executions'` 로 손으로 적었다가 실제가
      > `'execution'` 이라 실패했다 — 손으로 적으면 SQL 이 가진 것과 **같은 종류의
      > 하드코딩**을 테스트가 하나 더 만드는 셈이라 대조의 의미가 없어진다. 그래서 유도
      > 방식으로 바꿨다.

## 마커 재제출 거부 PR 의 이월 항목 (2026-08-21 등재, `00_03_57`~`05_08_35` 11라운드)

11라운드에 걸쳐 리뷰어들이 **조치 불요·강제 아님·스코프 밖**으로 판정한 것들이다. 각
RESOLUTION 에 "트래커로 넘긴다" 고 적었는데 **실제로는 어디에도 적히지 않은 상태였다** —
push 직전 확인에서 발각됐다. `review/**` 는 SoT 가 아니므로 여기 등재한다.

- [x] **두 Manual 엔드포인트의 최상위 `error.code` 가 다르다** — `re-run` 은 `INVALID_INPUT`,
      `execute` 는 `INVALID_TRIGGER_PARAMETERS`. **이 PR 이전부터 존재**하는 drift 이고
      spec 에도 명시돼 있다. 통일하면 기존 클라이언트가 보는 코드가 바뀌므로 별도 결정 필요.
      (`details[].code` 를 보면 되므로 실사용 지장은 없다.)
      > **결정됨 (2026-08-22, 사용자)**: **`INVALID_TRIGGER_PARAMETERS` 로 통일**한다 —
      > 즉 `re-run` 쪽을 바꾼다. **breaking**: 기존 re-run 클라이언트가 보던
      > `INVALID_INPUT` 이 사라진다.
      >
      > 실측 기준점(2026-08-22, `7b0e65aa8`): 발행처는
      > `executions.service.ts:506`(re-run) / `workflows.controller.ts:324`(execute) 두 곳.
      > 동반 개정이 필요한 spec 은 **3곳** — `4-nodes/7-trigger/1-manual-trigger.md:180-181`
      > (경로별 코드 표), `5-system/13-replay-rerun.md:246`(§8.1 정의 SoT),
      > `5-system/3-error-handling.md:80`(카탈로그). 그 중 `3-error-handling.md:80` 은
      > *"`RERUN_` prefix 를 붙이지 않는 것은 의도 — 이미 발행 중인 코드라 error-codes §2
      > rename-stability 상 유지"* 라는 **반대 방향 Rationale** 을 담고 있어, 통일 시
      > 그 문장을 그대로 두면 자기모순이 된다. 함께 개정해야 한다.
      > Swagger 표기(`executions.controller.ts:274`)도 동반 대상.
      >
      > spec 편집을 포함하므로 **planner 턴 + `/consistency-check --plan`** 이 선행했다.

      > **닫았다 (2026-08-22, `eia-error-code-unify`)** — 통일 집행. spec 6파일 + 코드 2곳 +
      > 테스트 + 유저 가이드 KO/EN. 은퇴 코드는 `error-codes.md §5` Rename 이력에 등재했고,
      > 그 행에 **본 표에서 리스크 등급이 가장 높다**는 사실(제3자 분기를 코드로 배제 불가,
      > 판정 근거는 관측 범위 미발견)을 명시했다. 설계·기각 대안: [`eia-error-code-unify.md`](../complete/eia-error-code-unify.md)
- [x] **`ReRunRequestDto.inputOverride` Swagger description** 에 마스킹 마커 3종이 예약어라는
      제약이 없다. 5라운드 연속 이월 — 다음 DTO 편집 기회에 한 줄.
      > **닫았다 (2026-08-22, `masked-marker-cosmetic-followups`)** — 마커 3종이 **이 필드의 예약어**임을,
      > 거부 시 코드(`400 INVALID_TRIGGER_PARAMETERS` + `details[].code =
      > MASKED_VALUE_RESUBMITTED`)와 **부분 일치는 통과**한다는 경계까지 description 에 적었다.
      > OpenAPI 소비자가 문서만 보고 통합할 때 이 제약을 모르면 400 의 원인을 못 찾는다.
- [x] **마커 리터럴 cross-stack 계약 테스트 부재** — 프런트 `lib/utils/masked-markers.ts` 와
      backend `shared/utils/sanitize-error-message.ts` 의 `MASKED_MARKERS` 가 **문자 그대로
      대칭**이어야 하는데 이를 강제하는 것이 없다(jest↔vitest 경계). 한쪽만 바뀌면 프런트가
      막지 못한 값을 서버가 거부하거나 그 반대가 된다.
      > **닫았다 (2026-08-21)** — 계약 테스트가 아니라 **추출**로. `@workflow/masked-markers`
      > 를 신설해 두 스택이 import 한다(마커 3종 · `isMaskedMarker` · `MAX_MASK_DEPTH`).
      > 계약 테스트를 포기한 이유는 **CI 경로 게이팅**이다 — `frontend-checks` 는
      > `codebase/backend/**` 변경 때 검사를 생략하고 `backend-checks` 는 반대쪽을 생략하므로,
      > 한쪽에 둔 가드는 **반대쪽이 마커를 바꾸는 방향에 무력**하다. 양쪽 모두
      > `codebase/packages/**` 는 relevant 로 잡으므로 값을 그쪽으로 옮겼고, 이제 대조할
      > 미러가 없다. 남은 가드는 *미러가 되살아나지 않는지*(심볼 재선언)만 본다.
- [x] **base `resolveTriggerParameters` JSDoc 에 wrapper 역참조 없음** — 새 Manual 경로
      작성자가 base 만 보면 wrapper 규칙을 모른다. repo-guard 가 CI 에서 잡지만 그건 사후
      발견이지 작성 시점 안내가 아니다. `{@link resolveTriggerParametersRejectingMasked}` 한 줄.
      > **닫았다 (2026-08-22, `masked-marker-cosmetic-followups`)** — 한 줄이 아니라 **왜 base 가 아닌지**까지
      > 적었다 — base 는 Webhook·Schedule 도 공유하므로 거기 넣으면 무관한 경로가 같은 거부
      > 규칙을 진다. 역참조만 달면 다음 사람이 *"그럼 base 에 넣지 그랬나"* 를 다시 묻는다.
      > 실측: 그 파일 안 wrapper 언급 **0 → 1건**.
- [x] **`REASON_TO_DETAIL` 문서화 밀도 비대칭** — 신규 항목만 JSDoc 이 있고 형제 3종은 없다.
      > **닫았다 (2026-08-22, `masked-marker-cosmetic-followups`)** — 형제 3종에 JSDoc 을 채웠다(실측 1 → 4/4).
      > 그냥 채우지 않고 **사용자가 취할 행동**을 기준으로 적었다 — `missing_required`(필드를
      > 채운다) · `coerce_failed`(타입을 맞춘다) · `invalid_schema`(**입력이 아니라 트리거 노드
      > 설정을 고친다** — 앞의 둘과 책임 주체가 다르다). 그 구분이 이 4종이 별개 코드로
      > 존재하는 이유다.
- [x] **`workflows.controller.ts` 의 한/영 인라인 주석 혼재** — 같은 try/catch 블록.
      이 PR 이 만든 문제가 아니고 5라운드째 이월.
      > **닫았다 (2026-08-22, `masked-marker-cosmetic-followups`)** — 한국어로 통일했다(이 저장소 기본).
      > 실측: 해당 try/catch 블록의 한글 없는 주석 줄 **0건**. 영문 주석이 담고 있던
      > *"`errors` 가 아니라 `details`"* 라는 근거는 보존했다 — 언어만 바꾸고 정보를 잃지
      > 않는 것이 이 항목의 요점이다.
- [x] **`ExecutionsService.reRun` 이 137줄·6책임** — 선존 구조. 이번 PR 은 분기 1개만 추가.
      다음에 손댈 때 입력 해석 블록을 private 헬퍼로.
      > **실측 갱신 (2026-08-22)**: 현재 **141줄**. 등재 시점 137줄에서 이 시리즈가 4줄
      > 늘렸다(마커 거부 분기). **리팩터라 테스트·문서 PR 에 섞지 않는다** — 섞으면 구조
      > 변경 PR 이 되어 리뷰 성격이 갈린다.
      > **닫았다 (2026-08-22, `masked-marker-plan-close`)** — 트래커 문면 그대로 입력 해석
      > 블록만 `resolveManualOverrideInput` 로 뽑았다. **141줄 → 109줄**(실측). 나머지 5개
      > 책임은 각각 5~10줄이라 손대지 않았다.
      >
      > **동작 무변경을 뮤테이션으로 증명했다** — 추출된 코드가 테스트 사각지대로 이사하지
      > 않았는지가 순수 추출 리팩터의 진짜 위험이다. 에러 코드 되돌림 · `details`→`errors`
      > 되돌림 · base resolve 되돌림 **3종 전부 RED**, 마지막 것은 CI 가드
      > (`masked-reject-callers-guard`)도 함께 RED — 호출 지점이 private 메서드로 옮겨가도
      > AST 탐지 축에 그대로 걸린다.
- [ ] **`findMaskedResubmissions` 직접 단위 테스트 부재** — 상위 함수 경유 간접 커버만.
      ~~세 번째 소비처가 생기면 그때.~~
      > **유예는 유지하되 근거를 교체한다 (2026-08-22, `masked-marker-test-gaps`).**
      > 원래 조건은 *"세 번째 소비처가 생기면"* 이었다. 소비처는 여전히 함수 **1개**
      > (`resolveTriggerParametersRejectingMasked`) · 호출 2곳(phase ①·②)이라 조건은
      > 미충족이다. 그런데 **"N개가 되면" 은 그 자체로 검증 가능한 주장**이라 개수가 아니라
      > 실제 커버리지로 다시 판정했다 — 그 함수의 분기(빈 스키마 · 비객체 raw ·
      > `rawSource` 키 필터 · 정확 일치 경계 · 깊이 상한 obj/arr/혼합 · 다중 필드 수집)가
      > **전부 상위 경유로 이미 덮여 있다**. 지금 추가하면 같은 단언을 한 겹 얕은 곳에서
      > 반복할 뿐이다.
      >
      > 즉 **결론은 같지만 이유가 다르다** — 다음 사람이 "3번째 소비처" 만 세고 지나치지
      > 않도록 적는다. 재개 신호는 소비처 개수가 아니라 **상위 경유로 못 덮는 분기가
      > 생기는 것**이다(예: 이 함수만 쓰고 resolve 는 안 하는 경로).
- [x] **`13-replay-rerun.md` §8.1·§8.2 의 401 코드가 규약과 어긋난다** (2026-08-22 등재,
      `21_53_41` convention_compliance W1). 두 표가 401 을 `UNAUTHORIZED` 로 적었는데
      **표준은 `AUTH_REQUIRED`** 다(`3-error-handling.md` §1.2 · `2-api-convention.md` §5.3).
      §8.1 행은 스스로 *"표준 [Spec 에러 처리] 규약"* 이라 자칭하면서 비표준 이름을 쓴다.
      > **런타임은 이미 옳다** (실측): `http-exception.filter.ts:145` 가 401 에 대해
      > `AUTH_REQUIRED` 를 낸다. 즉 **문서만 drift** 이고 클라이언트가 받는 값은 정상이다 —
      > 고쳐도 계약 변경이 아니다.
      >
      > ~~지금 안 고치는 이유: **`spec/` 편집은 developer 권한 밖**이고(CLAUDE.md 역할 표),
      > 이 drift 는 선존이라 이번 리팩터와 무관하다. **planner 턴** 항목이다.~~
      > **닫았다 (2026-08-22, planner 턴 `spec-drift-planner-batch`)** — 두 행을
      > `AUTH_REQUIRED` 로 정정했다. **자매 전수 확인**: 치환 전 spec 전역
      > `` `UNAUTHORIZED` `` **2건**(둘 다 이 파일) → 치환 후 **0건**. 다른 문서로 번진 사본은
      > 없었다.
      >
      > `error-codes.md §5`(Rename 이력) 대상이 **아니다** — 이름이 바뀌는 게 아니라 **오기를
      > 고치는** 것이라 계약 변경이 없다(클라이언트는 이미 `AUTH_REQUIRED` 를 받고 있었다).

- [x] **`swagger.md §3` 의 길이-예외가 응답 필드만 문면상 포괄한다** (2026-08-22 등재,
      `20_05_10` convention_compliance W1). 그 예외는 *"**응답** 값이 저장된 값과 다를 수 있는
      필드(egress 마스킹 대상 등)"* 라 적혀 있어 **요청 필드의 보안·거부 규칙 캐비엇**
      (`ReRunRequestDto.inputOverride` 의 마커 예약어)은 문면상 대상이 아니다.
      > **실무가 이미 한참 앞서 있다** (실측, `origin/main` 기준 — 이 PR 변경 **전**):
      > 같은 파일의 `inputOverride` 가 **98자**, `dryRun` 이 **174자**로 둘 다 이미 가이드
      > (10~40자) 밖이다. 즉 규약 문면이 현실보다 좁다 — §3 이 자기 이력에서 *"이미 굳은
      > 관행의 추인"* 이라 밝힌 것과 **같은 형태의 재발**이다.
      >
      > **이 PR 은 129자로 두고 더 줄이지 않는다.** 40자 안에 넣으려면 캐비엇(마커 정확
      > 일치 → 400 거부)을 지워야 하는데, **그 캐비엇을 넣는 것이 이 항목(785)의 목적**이라
      > 자기모순이다. 예외 범위를 넓히는 쪽이 옳은 지렛대이고 그건 **규약 개정 = planner 턴**.
      >
      > ⚠️ **정정**: 이 PR 은 한때 *"가이드(150자) 안에 들어왔다"* 고 적었는데 **틀렸다** —
      > `swagger.md` 에는 길이 줄이 **둘**이고(L256 `DTO description 10~40자` /
      > L257 `엔드포인트 description 50~150자`) 내가 **엔드포인트 줄**을 봤다. DTO 필드에
      > 적용되는 것은 L256 이다.
      > **닫았다 (2026-08-22, planner 턴 `spec-drift-planner-batch`)** — 예외 문면을
      > **양방향 표**로 바꿨다(응답 = *"왜 DB 와 값이 다른가"* / 요청 = *"왜 이 값을 보내면
      > 400 인가"*). 논거가 대칭인데 문면만 한쪽이었던 것이 결함이다.
      >
      > **요청 쪽도 "추인" 임을 실측했다** — 집계 기준
      > `codebase/backend/src/**/dto/**/*.dto.ts` 중 `responses/`·`*-response.dto.ts` 제외:
      > 73개 파일 `description` **333개 중 114개(34%)가 40자 초과**, 최장 435자
      > (`chat-channel-config.dto.ts`). §3 이 자기 도입 때 쓴 *"이미 굳은 관행의 추인"* 논리가
      > 요청 쪽에도 그대로 성립한다.
      >
      > **consistency `22_53_02` W1 을 반영해 근거를 `## Rationale` 로 옮겼다** — swagger.md 는
      > `### §0 / §1-4 / §5 / §5-4` 처럼 "본문=규칙 / Rationale=근거" 이중 구조를 쓰는데
      > **`### §3` 만 없었다**(2026-08-17 예외가 근거를 본문 인라인으로 두고 갔다). 신설하면서
      > 그 2026-08-17 근거도 함께 옮겨 §3 의 근거가 두 곳으로 쪼개지지 않게 했다.

- [x] **`execute` 본문의 여분 키를 400 으로 거부할 것인가** (2026-08-22 등재, `execute-body-dto`
      의 이연 결정). 지금은 전역 파이프가 이 본문을 **검증하지 않는다** — 여분 top-level 키가
      조용히 무시된다. 거부로 바꾸면 문서화가 아니라 **공개 API 계약 축소**라 사용자 판단이
      필요하다.
      > 실측: 1st-party(`frontend/src/lib/api/workflows.ts:182`)는 정확히
      > `{ input, parameterValues }` 만 보내 **호환**이다. 위험한 쪽은 우리가 못 세는 외부
      > 클라이언트이고, 이 엔드포인트는 유저 가이드(`02-nodes/triggers.mdx`)에도 실려 있다.
      >
      > **결정됨 (2026-08-23, 사용자 택일): 거부하지 않는다 — 현행 유지.** *"미룬다"* 가
      > 아니라 **"안 하기로 정했다"** 이므로 항목을 닫는다.
      >
      > **다음 리뷰가 이걸 결함으로 다시 올리지 않도록 적어 둔다** — `execute` 가 전역
      > 파이프에 **진입하지 않는 것**(`CustomValidationPipe.toValidate()` 가 `Object` 제외),
      > 그래서 형제 `re-run`(`@Body() dto: ReRunRequestDto`, 데코레이터 6개)과 **반응이
      > 다른 것**은 **의도적으로 유지되는 상태**지 미발견 결함이 아니다.
      >
      > **오늘 처음 정한 게 아니라 재확인이다** (`11_59_11` rationale_continuity INFO-2):
      > 2026-08-22 `execute-body-dto` 가 이미 *"검증을 켜는 것은 별개 결정"* 으로 갈라 뒀고,
      > 그 상태를 지키는 캐너리가 `workflows-execute-body.spec.ts` 에 있다. 오늘 한 것은 그
      > 갈라 둔 결정에 **답을 준 것**이다.
      >
      > 되살릴 조건: 여분 키를 실제로 보내는 클라이언트가 없다는 **관측 데이터**가 생기면
      > 그때 통일을 재검토한다(브리핑의 (c) 안). 관측 없이 조이는 것은 미지의 외부
      > 클라이언트를 깨는 도박이라 하지 않는다.

- [x] **`re-run.dto.ts` 가 열린 map 을 `type: Object` 축약형으로 적는다** (2026-08-22 등재 ·
      **2026-08-23 종결**,
      `23_46_23` convention_compliance W1 의 부수 발견). 실측: `additionalProperties: true`
      를 쓰는 파일 **40개** vs `type: Object` 축약형 **2개**(`re-run.dto.ts` + 이번 신규).
      신규 파일은 이번에 다수 패턴으로 맞췄고, `re-run.dto.ts` 는 선존이라 남겼다.
      > 같은 디렉토리의 형제 `execute-node.dto.ts` 가 이미 다수 패턴을 쓴다 — 내가 이번에
      > **잘못된 형제**를 베꼈다가 checker 에 잡혔다.
      >
      > **→ 종결. 다만 "형태 통일" 보다 근거가 강했다** — 두 형태를 `createDocument` 까지
      > 돌려 실측하니 축약형도 `type: object` 로는 **해석된다**(메타데이터만 봤으면
      > "타입이 없다" 고 오판할 뻔했다). 실제 차이는 **`additionalProperties` 부재**다:
      > OpenAPI 상 검증 의미는 같지만, 생성기가 "선언된 프로퍼티 없는 닫힌 모델" 로 읽어
      > **빈 인터페이스**를 만든다. 열린 map 이라는 의도가 클라이언트에 전달되지 않는다.
      > 실측 후 저장소 전체 축약형 **0건**.
      > 산출물: [`rerun-dto-shorthand.md`](../complete/rerun-dto-shorthand.md).

- [x] **`ExecuteWorkflowDto.input` 이 형제 `ExecuteNodeDto.input` 과 이름은 같고 의미가 다르다**
      (2026-08-23 등재, `00_33_31` naming_collision W1). `@ApiBody` 배선으로 둘이 처음
      **같은 Swagger 표면에 동시 노출**됐다 — 전자는 `.parameters` 를 품는 봉투, 후자는
      노드 입력 값 자체다.
      > **checker 가 제안한 `legacyInput` 리네임은 성립하지 않는다** (실측): 런타임이
      > `body?.input` 을 읽으므로(`workflows.controller.ts:308,343`) DTO 필드명만 바꾸면
      > **OpenAPI 가 존재하지 않는 필드명을 광고**하게 된다 — 클라이언트가 `legacyInput` 을
      > 보내면 조용히 무시된다. *"런타임 계약 불변, OpenAPI 표면만 변경"* 이라는 제안 근거가
      > 바로 그 이유로 틀렸다.
      >
      > 현재는 docstring 의 `{@link ExecuteNodeDto.input}` 상호 참조로 완화돼 있고 checker 도
      > *"즉시 변경 불요"* 로 판정했다. 진짜로 이름을 바꾸려면 **와이어 필드명 자체를 바꾸는
      > 계약 변경**이라, 위의 "여분 키 400 거부" 항목과 같은 성격(사용자 판단 필요)이다.
      >
      > **결정됨 (2026-08-23, 사용자 택일): 이름은 그대로 두고 `deprecated` 로 표시한다.**
      > 리네임(속성명·와이어명 어느 쪽이든)은 하지 않는다.
      >
      > 근거는 코드가 이미 말하고 있었다 — `parameterValues ?? input.parameters` 로 이 필드는
      > **처음부터 back-compat 경로**다. `deprecated: true` 는 비파괴이고 클라이언트를
      > `parameterValues` 로 유도하므로, 동명이의가 **시간이 지나며 저절로 해소**된다.
      > 집행: `execute-workflow.dto.ts` + 가드
      > (`workflows-execute-body.spec.ts` 의 `[결정] \`input\` 만 deprecated 로 표시된다`).


- [x] **`swagger.md §3` 의 기본 수치 규칙(`DTO description 10~40자`)이 현실과 벌어져 있다**
      (2026-08-22 등재, 위 §3 예외 확장 작업의 부수 실측). 예외 확장은 **보안·정책 캐비엇
      클래스**만 덮는데, 실측하면 그보다 훨씬 넓다 — 요청 DTO `description` **333개 중
      114개(34%)** 가 40자를 넘고 최장이 435자다. 즉 초과의 대부분은 예외 클래스가 아니라
      **그냥 규칙을 안 지키는 것**이다.
      > 판단이 필요한 지점: (a) 수치를 현실에 맞게 올릴 것인가, (b) 규칙을 유지하고 초과분을
      > 정리할 것인가, (c) "내외" 라는 완충 표현대로 애초에 강제 대상이 아니라고 명문화할
      > 것인가. **§3 예외 확장과는 별개 판단**이라 그 작업에서 의도적으로 분리했다
      > (`22_53_02` rationale_continuity INFO-4 가 이 범위 한정을 관행 정합으로 확인).
      >
      > **결정됨 (2026-08-23, 사용자 택일): (c) 강제 대상이 아님을 명문화.** `swagger.md §3`
      > 을 **강제(엔드포인트 `summary`·`description`) / 지향(DTO `description`)** 으로 갈랐고,
      > 근거를 `## Rationale` 의 `### §3 DTO 길이는 왜 강제가 아닌가` 에 남겼다.
      >
      > 갱신 실측(결정 시점): 요청 116/335(34%) · **응답 58/128(45%)** · 전체
      > **174/463(37%)**. 응답 쪽이 더 나쁘다는 점이 *"요청만의 문제가 아니다"* 를 굳혔다.
      >
      > 기각한 두 대안과 사유도 Rationale 에 적었다 — 수치 상향(새 숫자도 임의적) ·
      > 초과분 174건 정리(§3 스스로 유용하다고 한 정보를 지우게 된다).

- [x] **마커 리터럴을 산문으로 재기술한 지점이 3곳 늘었다** (2026-08-22 등재, `19_36_12`
      requirement W1). `masked-marker-cosmetic-followups` 가 Swagger description ·
      `REASON_TO_DETAIL` JSDoc · base 함수 JSDoc 에 마커/거부 규칙을 **산문으로** 적었다.
      값의 SoT 는 `@workflow/masked-markers` 인데 이 세 곳은 링크 없이 재기술이라, 마커가
      바뀌면 기계가 아니라 **사람이** 찾아야 한다.
      > **갱신 (2026-08-22, `20_25_11` plan_coherence INFO)**: Swagger description 은 이후 두
      > 라운드에 걸쳐 축약돼 **마커 리터럴 verbatim 나열이 사라졌다**(129자, SoT 링크만 유지).
      > 남은 산문 재기술은 JSDoc 2곳이다.
      > **PR #1194(`spec/conventions/egress-masking.md` 신설)가 머지되면 그 문서 §3
      > *"이 문서는 기계가 지키지 않는다"* 가 이 클래스를 흡수한다** — 그때 이 항목을 닫는다.
      > **#1194 가 철회되거나 이 PR 보다 늦게 들어오면** 흡수처가 없으므로 이 항목이 유일한
      > 기록이다. 그래서 `complete/` 로 봉인된 plan 이 아니라 **여기(in-progress)** 에 적었다
      > — 미머지 PR 의 존재를 기정사실로 전제하면 그 PR 이 실패할 때 정보가 사라진다.
      >
      > **조건 충족 — 닫는다 (2026-08-22).** #1194 가 `bdcfdc514` 로, 그다음 #1195 가
      > `923b5892e` 로 머지됐다(적어 둔 순서 그대로). `egress-masking.md §3` 이 *"이 문서는
      > 기계가 지키지 않는다 + 알려진 stale 트리거"* 로 이 클래스를 소유하므로, 남아 있던
      > JSDoc 2곳의 산문 재기술은 그 문서가 관리 주체다. 폴백 조항은 발동하지 않았다.

- [x] **`POST /workflows/:id/execute` 의 body 가 DTO 가 아니라 OpenAPI 에 마커 예약어 설명이
      없다** (2026-08-22 등재, `19_25_39` documentation W1). 형제 `re-run` 은 `ReRunRequestDto`
      가 있어 이번에 예약어 제약을 description 에 넣었는데, `execute` 의 `parameterValues` 는
      **인라인 타입 + `@ApiBody` 부재**라 넣을 자리가 없다. **두 경로는 같은 거부 규칙**
      (`resolveTriggerParametersRejectingMasked`)을 쓰므로 문서만 비대칭이다.
      > 지금 고치지 않는 이유: DTO 승격은 코스메틱이 아니라 **컨트롤러 시그니처 변경**이다.
      > `execute()` body 를 DTO 로 올리거나 `@ApiBody` 를 다는 기회에 `re-run.dto.ts` 의
      > 설명을 그대로 이식한다.
      > **닫았다 (2026-08-22, `execute-body-dto`)** — 문면이 열어 둔 두 길 중 **`@ApiBody`**
      > 를 택했다. 둘은 동등하지 않다(실측):
      >
      > | `@Body()` 파라미터를 DTO 로 타입하면 | 결과 |
      > | --- | --- |
      > | class-validator 데코레이터 **없이** | `validate()` 가 등록 메타데이터를 못 찾아 **모든 요청** 거부 — 빈 객체 `{}` 조차 400 |
      > | 데코레이터를 **달면** | `forbidNonWhitelisted` 가 켜져 **여분 top-level 키**가 400 |
      >
      > 즉 "문서를 단다" 가 조용히 **공개 API 계약을 좁히는** 변경이 된다. 지금은 전역
      > `CustomValidationPipe.toValidate()` 가 `Object` 를 제외해 **검증이 통째로 skip** 되고
      > 있다. 그래서 DTO 는 **OpenAPI 스키마 보유자**로만 쓰고 `@Body()` 인라인 타입은 유지 —
      > 문서는 형제와 대칭이 되고 런타임은 한 줄도 안 바뀐다.
      >
      > 그 결정을 지키는 캐너리를 함께 넣었다(`workflows-execute-body.spec.ts`) — 없으면
      > 다음 사람이 *"타입을 맞춰 주자"* 며 조용히 계약을 좁힐 수 있다.
- [x] **`throwIfAny` 의 phase 경계 트레이드오프 미검증** — ①(raw) 통과 후 무관 필드의
      `coerce_failed` 가 resolve 를 선점하면 ②(JSON 문자열 안 마커)가 그 요청에서 실행되지
      않는다. **보안 우회가 아니라 안내가 한 왕복 늦는 UX 엣지**이고 docstring 에 적혀 있으나
      회귀 테스트로 고정돼 있지는 않다.
      > **닫았다 (2026-08-22, `masked-marker-test-gaps`)** — `[캐너리] 무관한 필드의 coerce
      > 실패가 ② 마커 검사를 선점한다` 를 추가했다. 기존 캐너리(`raw 에서 걸리면
      > coerce_failed 가 섞이지 않는다`)는 **①이 걸리는** 방향만 덮고 있었다 — 실측: 이
      > 반대 방향은 기존 21개 테스트 어디에도 없었다.
      >
      > 테스트 안에 **대조군**을 함께 둔다(`count: 1` 이면 ②가 같은 마커를 잡는다). 대조군이
      > 없으면 *"애초에 ②도 못 잡는 값"* 으로도 통과해 vacuous 하다.
      >
      > **이 테스트는 동작을 잠그는 게 아니라 결정을 강제한다.** 두 phase 를 합쳐 한 번에
      > 보고하는 개선을 하려면 여기가 RED 가 되고, 그때 `throwIfAny` docstring 을 읽고
      > 의도적으로 갱신하게 된다. 지금은 문서에만 있어 **선의의 되돌림이 조용히 통과**했다.

consistency `--impl-done`(`05_23_14`, **BLOCK: NO**) 이 셋을 더 냈다 — 전부 비차단이고 셋 다
**spec 편집이라 planner 턴**이 필요하다. 그래서 이 PR 에서 하지 않는다:

- [x] **wrapper 함수명이 spec 본문에 없다** — `resolveTriggerParametersRejectingMasked` /
      `reject-masked-resubmission.ts` 가 `1-manual-trigger.md` §6 와 `14-external-interaction-api.md`
      §R17 어디에도 이름으로 안 나온다. `spec-impl-evidence` R-1(≥1 코드 매치)은 충족해
      가드는 통과하지만, **"공유 함수에 넣지 않는다" 는 설계 의도가 코드 추적선에서 흐려진다**.
      두 문서에 함수·파일명 명시 + `code:` frontmatter 에 파일 추가.
      > **닫았다 (2026-08-22)** — `1-manual-trigger.md §6` 과 `14-…md §R17` 두 본문에
      > wrapper 함수명·파일명과 **base 에 넣지 않은 이유**(Webhook·Schedule 이 base 를
      > 공유한다), 그리고 그 규칙을 강제하는 CI 가드
      > (`masked-reject-callers-guard.ts`)를 함께 적었다. `code:` frontmatter 에도 추가.
      > 실측: `grep -rln resolveTriggerParametersRejectingMasked spec` = 2파일(전엔 0).
- [x] **§R17 "닫는 조건" 표의 신규 4번째 행만 볼드** — 기존 3행은 평문. 통일하거나 의도적
      강조로 유지.
      > **닫았다 (2026-08-22)** — **평문으로 통일**했다(4번째 행의 볼드를 걷어냄). 표의 다른
      > 세 행이 평문이고, 행 안에 이미 부분 볼드가 여러 개라 행 전체 볼드가 강조로 읽히지도
      > 않았다.
- [x] **`error-codes.md §4` "패턴" 표에 trigger-parameter reason 계열이 없다** — Code 노드
      핸들러 내부 코드만 나열돼 있어 직접 확인이 안 된다. 이 PR 이 만든 편차가 아니라 기존
      서술의 연장. 규약 문서 자체 개선.
      > **닫았다 (2026-08-22)** — 단순 append 가 아니라 **§4.1 / §4.2 분리**로. §4 는 열
      > 헤더로 스스로 scope 를 *"노드 `output.error.code`"* 라 선언하고 있었는데
      > trigger-parameter 계열은 목적지가 **봉투의 `details[].code`** 이고 정규화 함수도
      > 다르다(`toTriggerParameterErrorDetails`) — 그대로 행만 넣으면 표가 자기 선언과
      > 모순된다(consistency `16_34_50` W2 지적). §4 상단에 두 파이프라인 대조표를 두고
      > 각각을 §4.1·§4.2 로 내렸다.

consistency `--impl-prep`(`15_35_56`, 2026-08-22)가 하나 더 냈다 — 역시 **planner 턴**이다:

- [x] **egress 마스킹 규약이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 있다**
      (`15_35_56` convention_compliance W1). 마커 3종의 의미, 깊이 상한 SoT(`MAX_MASK_DEPTH`)와
      지역 별칭 목록, **소비처별 경계 연산자와 그 근거**(`deepRedactSecrets` 는 `>=`,
      `sanitizePayloadForWs` 는 `>`, `stripExternalOnlyFields` 는 `>`), 재마스킹 금지 규칙이
      네 파일의 주석에 흩어져 있다. `error-codes.md`·`audit-actions.md` 가 스스로 경고한
      *"산문 규약 표류"* 와 동형이고, 이미 마커 이름 불일치로 **1회 실측 발생 이력**이 있다.
      > `spec/conventions/egress-masking.md`(가칭) 신설 여부는 planner 판단. 신설 시
      > `spec-impl-evidence` 패턴대로 frontmatter `code:` 에 네 파일 등재.

> **관행 권고 (`04_46_40`·`05_08_35` scope W1)**: 기능 PR 에서 **저장소 전역 정책 가드가
> 부산물로 파생되면** 별도 PR 로 분리하는 편이 낫다. 이번엔 분리하지 않았다 — 두 가드가
> 이 PR 의 wrapper 와 `typescript` import 를 각각 전제해서, 분리하면 그 사이 커밋 구간에
> **가드 없이 코드만 있는 상태**가 생긴다. 대신 CHANGELOG 에 범위 초과를 명시했다.

## 리뷰 타겟 재실행이 forced 커버리지 자기검사를 공허하게 만든다 (2026-08-27 등재, `12_52_43` W2)

- [ ] **`Workflow(ai-review)` 에 좁힌 `agents_forced` 를 넘기면, 요약 에이전트가 그 좁힌
      목록에 대해서만 커버리지를 검사한다** — orchestrator 가 `meta.json`/`_retry_state.json`
      에 기록한 **진짜** forced 목록과 대조하지 않는다.
      > **실측 (2026-08-27)**: `masking-expression-egress-split` 의 2~5라운드를 전부
      > 타겟(4명 → 2명)으로 돌리며 `agents_forced` 도 그만큼 좁혀 넘겼다. 매 라운드 SUMMARY 가
      > *"forced 전원 결과 확보됨 — 누락 없음"* 이라 적었지만, `meta.json` 기준 forced 는
      > **7명**이었다:
      > ```
      > 12_28_26 → missing forced: maintainability, scope, side_effect
      > 12_52_43 → missing forced: maintainability, requirement, scope, security, side_effect
      > ```
      > 그래서 push 게이트가 두 세션을 **resolved 로 세지 않았고**(`_summary_is_resolved` 의
      > 조건 1), `newest_review` 가 3라운드(`12_00_05`)로 잡혀 차단됐다. 게이트 결함이
      > 아니라 **내가 만든 상태**였고, 게이트가 정확히 그 구멍을 막고 있었다.
      >
      > **왜 위험한가**: 실패가 조용하다. SUMMARY 는 초록으로 끝나고, 막히는 건 한참 뒤
      > push 시점이며, 그때 나오는 메시지(*"코드가 리뷰 뒤에 수정됐다"*)는 **원인을 가리키지
      > 않는다** — 나는 처음에 timestamp 오탐으로 오진했다. 술어를 읽고서야 알았다.
      >
      > **진단법**: `_forced_coverage_missing(<session_dir>)` 를 직접 호출한다. 세션 시각과
      > 코드 커밋 시각을 비교하기 **전에** 이걸 먼저 봐야 한다.
      >
      > **처분 후보** (택일 아님, 조사 필요): (a) 요약 에이전트가 넘겨받은 목록 대신
      > `meta.json` 의 `agents_forced` 를 읽게 한다 — 자기검사가 입력에 의존하지 않게.
      > (b) orchestrator 가 `--agents` 를 받아 forced 목록 자체를 좁혀 기록하게 한다.
      > (a) 가 옳아 보이지만 forced 화이트리스트의 **취지**(축소 불가)를 확인해야 한다.

## `config` 장기 참조 × egress identity 캐시 (2026-08-27 등재, `12_52_43` W4, **오늘은 도달 불가**)

- [ ] **`DEEP_REDACT_CACHE` 는 객체 identity 로만 키를 잡는다** — *"같은 identity ⇒ 같은
      내용"* 전제다. config echo 마스킹을 걷어내며 `setStructuredOutput` 이 핸들러 원본을
      참조로 장기 보관하게 됐으므로, 그 전제가 이론상 약해진다.
      > **실측으로 좁힌 도달 조건 — 둘 다 필요하고 둘 다 오늘 거짓이다**:
      > 1. 핸들러가 **반환 후** 자기 `config` 를 변형한다 → 오늘 그런 핸들러는 없고,
      >    `execution-context.service.spec.ts` 의 캐너리가 그 동작을 명시적으로 고정해 뒀다.
      > 2. **같은 top-level 객체**가 `deepRedactSecrets` 에 두 번 들어간다 → 캐시 키는
      >    depth-0 인자다. REST 는 `redactStoredDataForResponse(row.outputData)` 로 **쿼리마다
      >    새 객체**이고, WS 변형 `deepRedactSecretsPreserving` 은 **캐시를 아예 안 쓴다**
      >    (그 함수 JSDoc 이 이유까지 적어 뒀다 — 옵션이 다르면 같은 캐시를 쓰면 안 된다).
      >
      > **재개 신호**: 핸들러가 반환 후 config 를 변형하는 사례가 생기거나, egress 진입점이
      > in-memory 캐시 객체를 **그대로** depth-0 인자로 넘기게 바뀔 때. 리뷰어도 재현 경로를
      > 확증하지 못했다고 명시했다 — 그 판정을 그대로 싣는다.

## `config` aliasing 계약이 `node-output.md` mutation-보호 단락에 없다 (2026-08-27 등재, `13_47_15` INFO 6)

- [ ] **`node-output.md` 의 mutation 보호 서술은 `context.rawConfig` freeze(엔진→핸들러 방향)만
      다룬다** — 2026-08-24 에 생긴 **반대 방향** 계약(핸들러가 반환한 `config` 객체가
      `structuredOutputCache` 에 **참조로** 눕는다)이 그 단락에 없다.
      > 계약 자체는 `execution-context.service.ts` JSDoc + 캐너리 2건으로 코드에 고정돼 있다.
      > 빠진 것은 **규약 문서의 커버리지**다. `node-output.md` 를 다른 이유로 열 때 한 줄 넣는다.
      > 관련: 같은 라운드 W4(`DEEP_REDACT_CACHE` identity 전제)의 전제 1 이 바로 이 계약이다.

## 이 PR 이전 실행을 predecessor 로 시딩하면 `config` 가 여전히 마스킹값이다 (2026-08-27 등재, `14_10_42` INFO 7)

- [ ] **storage-format 전환은 과거 row 에 소급되지 않는다** — 단일 노드 디버그 재실행이
      `seedSingleNodePredecessorOutputs` 로 **2026-08-24 이전에 저장된** 실행을 predecessor 로
      시딩하면, 그 `config` 는 옛 boundary 가 남긴 `****abcd` 형태 그대로 캐리된다.
      > 표현식이 그 값을 읽으면 **마스킹 문자열**을 읽는다 — 이 PR 이 고치려던 바로 그 증상이
      > 과거 실행에 대해서는 남는다. 일반적 마이그레이션 한계이고 신규 결함이 아니다.
      > **처분 후보**: (a) 무조치 + 문서화(과거 실행은 재실행하면 새 값을 얻는다),
      > (b) 시딩 시점에 마스킹 마커를 감지해 경고. **먼저 잴 것**: 그 경로가 실제로 얼마나
      > 쓰이는지, 그리고 마스킹 마커(`****`)가 정상 값과 구별 가능한지.

## 형제 리뷰어의 뮤테이션 — **이관됨** (2026-08-28)

> 이 항목은 [`harness-review-gate-followups.md` §병렬 fan-out 중 리뷰어가 실제 저장소를
> 뮤테이션한다](./harness-review-gate-followups.md) 로 **합쳤다**.
>
> **왜 옮겼나**: 그쪽에 2026-08-11 부터 같은 클래스가 등재돼 있었는데(`13_04_55` — 셋이
> 같은 유령을 쫓고 하나가 `git restore` 로 남의 트리를 되돌린 사건) 내가 2026-08-27 에
> 여기 **새 항목으로 다시 만들었다**. 한 클래스가 두 집에 있으면 다음 사람이 한쪽만 본다.
> 처방이 **리뷰어 프롬프트 템플릿**이므로 주인은 하네스 문서다.
>
> 내가 등재했던 사례 3건(관측 오염·파일 파괴 near-miss·`.bak` 재발)은 실측과 함께 그쪽
> 항목 안으로 **전부 옮겼다** — 잃은 내용은 없다.

## 잔여 plan 전수 감사 — 결과와 **다루지 못한 범위** (2026-08-28 `plan-audit`)

`origin/main`(`69bf9e50f`) 기준으로 in-progress plan 의 미해결 항목을 코드베이스와 대조했다.
8개 클러스터 fan-out + **"이미 처리됨"·"불필요" 판정만 적대적 재검증**하는 파이프라인.

| | 수 |
| --- | --- |
| 감사한 항목 | **176** |
| `already_done` → 검증 통과 | **6** (체크 완료) |
| `already_done` → **반증** | **1** (살려 둠 — 아래) |
| `unnecessary` | **0** |
| `needs_revision` | **29** (항목은 유효, 서술만 정정) |
| `still_open` | 140 |

### 적대적 검증이 오판을 하나 잡았다

`spec-draft-eia-notification-payload-contract.md` 의 *"`chat-channel/types.ts:388` 을 (1)
최종형과 동기화"* 를 감사자가 `already_done` 으로 판정했는데 **틀렸다**. 검증자가 반증했고
내가 직접 재확인했다 — `EiaCompletedEvent`(`types.ts:386`)에 `status` 필드가 **없고**, 그
파일 전체에서 그 의미의 `status` 는 **0건**이다(있는 3건은 `statusCode` 주석과 무관 서술).
SoT 인 `chat-channel-adapter.md:149-151` 은 `status` + `result?` 를 선언하고 emit 도 싣는다.

**검증 단계가 없었으면 살아있는 항목을 닫았다.** 7건 중 1건이 오판이었다.

### 감사가 **다루지 않은** 범위 — 다음 사람이 알아야 한다

이 감사는 176항목만 봤다. 나머지는 **의도적으로 제외**했고 사유가 다르다:

- **`node-output-redesign/**` (30파일 · 약 85항목)** — 2026-06-25 에 **이미 전수 재대조
  (6차 갱신)** 를 했다. 그래서 이번엔 *"그 뒤 얼마나 낡았나"* 만 쟀다:
  `codebase/backend/src/nodes/` 에 **35커밋**이 들어왔고 변화가 세 곳에 몰려 있다 —
  **`ai/ai-agent` 73 · `integration/cafe24` 37 · `ai/information-extractor` 12**,
  나머지는 각 ≤7. **7차는 30파일 전수가 아니라 이 셋만** 하면 된다.
  특히 `README.md` 의 P0 항목이 `ai-turn-executor.ts:1209`·`:1439` 를 **줄 번호로** 인용하는데
  `#1212`(config echo 마스킹)가 그 파일을 건드렸다.
- **로드맵 4종** (`rag-quality-improvement` 40 · `marketplace-and-plugin-sdk` 33 ·
  `self-hosting-deployment` 29 · `ai-agent-tool-connection-rewrite` 27 = **129항목**) —
  전부 `worktree: (unstarted)` 이고 미해결 항목이 **작업 단위가 아니라 제안 내용**이다.
  코드 대조로 판정할 대상이 아니라 *"이 로드맵이 아직 유효한가"* 라는 다른 질문이다.

### 로드맵 4종의 `plan/research/` 이관 판정 — 실측

`plan-lifecycle.md §2` 의 세 신호로 쟀다:

| 문서 | 자기규정 | owner | 위임 인덱스 | 판정 |
| --- | --- | --- | --- | --- |
| `rag-quality-improvement` | *"리서치 기반 개선 제안"* ✅ | `사용자 본인 / planner` ✅ | 0건 ❌ | **2/3 — 이관 후보** |
| `marketplace-and-plugin-sdk` | ❌ | `developer` ❌ | 0건 ❌ | 작업 plan (미착수) |
| `self-hosting-deployment` | ❌ | `developer` ❌ | 0건 ❌ | 작업 plan (미착수) |
| `ai-agent-tool-connection-rewrite` | ❌ | `developer` ❌ | 0건 ❌ | 작업 plan (미착수) |

- [ ] **`rag-quality-improvement.md` 를 `plan/research/` 로 옮길지 판정** — 신호 2/3 이라
      단독 판정하지 않았다. 셋 다 *"다른 plan 참조 0건"* 이라 **위임 인덱스 축은 미충족**이고,
      그 문서가 스스로 *"리서치 기반 개선 제안 **+ 실행 plan**"* 이라 양쪽에 걸친다.
      > 이관하면 `in-progress/` 의 미해결 40건이 라이프사이클 축에서 빠져 `plan-stale-audit`
      > 신호가 정확해진다. 안 하면 2026-06-03 등재 문서가 계속 "진행 중" 으로 잡힌다.
- [ ] **미착수 로드맵 3종의 유효성 재판정** — 전부 2026-05-11 등재로 **109일** 경과.
      코드 대조가 아니라 *"제품이 이 방향을 아직 가는가"* 를 물어야 하므로 사용자 판단이 필요하다.
- [ ] **`node-output-redesign` 7차 — `ai-agent`·`cafe24`·`information-extractor` 3파일만**
      (위 실측 근거). 30파일 전수는 불필요하다.

## 후속 (cross-cutting, 본 spec 밖)
- [x] **Redis fixed-window rate-limiter INCR+EXPIRE 원자화** — `PublicWebhookQuotaService.incrWithWindow` 를 `INCR + EXPIRE ... NX` 단일 pipeline(매 요청)으로 교정해 TTL 유실 self-heal (fail-closed 잠금 창 제거). `ChatChannelRateLimiterService` 는 **이미** 동일 `INCR + EXPIRE NX` 단일 pipeline 패턴이라 무변경(점검 완료). `InteractionRateLimiterService`(item 5)는 Lua EVAL — 세 서비스 모두 원자/self-heal 확보. (PR #843 ai-review concurrency WARNING 후속, `task_fa5c5e84`.)

## §R8 Rationale 의 `statusCode` 선재 갭 서술이 **태어날 때부터 거짓이었다** (2026-08-29 등재)

- [x] **`14-external-interaction-api.md:1264` 의 "값 범위는 아직 보지 않는 **선재 갭**" 문장을
      완료형으로 정정** — `isHttpStatusCode()` 가 이미 100~599 정수 범위를 검사한다.

      > **완료 (2026-08-30, planner 턴 `spec-followups-drain`).** 취소선 없이 본문을 완료형으로
      > 교체했다 — 폐기된 *결정* 이 아니라 **한 번도 참이 아니었던 상태 서술**이라, 남기면
      > "한때 그랬다" 로 읽혀 오히려 이력이 왜곡된다. 경위(#1159 가 #1162 의 조상)는 draft 와
      > 커밋 메시지에 있다.

  **실측 (2026-08-29, `eia-idem-resolve-cache-hit` 세션이 `--impl-done` 중 발견)**:

  | 대상 | 값 |
  | --- | --- |
  | 문제 문장 | `spec/5-system/14-external-interaction-api.md` §R8 Rationale, "fail-open 의 원인은 두 축이다" 문단 |
  | 문장 요지 | "`statusCode` 는 현재 **타입만** 검사한다(`typeof === 'number'`) — 값 범위는 아직 보지 않는 **선재 갭**이다 … 범위 검사는 `readKey`/`hashBody` 경계값 항목과 함께 닫는다" |
  | 실제 코드 | `idempotency.interceptor.ts` 의 `isHttpStatusCode()` — `Number.isInteger` + `MIN_HTTP_STATUS_CODE`(100) ~ `MAX_HTTP_STATUS_CODE`(599) |
  | 갭을 닫은 커밋 | `4b1f899b7` (`#1159`, 2026-08-13) |
  | 문장을 쓴 커밋 | `1e9f3f238` (`#1162`, 2026-08-13) |
  | 순서 | `git merge-base --is-ancestor 4b1f899b7 1e9f3f238` → **참**. 즉 `#1159` 가 먼저 머지됐다 |

  **여기서 중요한 것은 "낡았다" 가 아니라 "쓰일 때 이미 거짓이었다" 는 것이다.** 보통 spec
  서술 낡음은 코드가 앞서가서 생기는데, 이 문장은 갭을 **닫은 PR 이 머지된 뒤에** 그 갭이
  아직 열려 있다고 새로 적었다. `#1162` 는 같은 문단의 fail-open 경로 수를 정정하던 PR 이라
  인접 문장을 옮겨 적으면서 옛 상태를 그대로 실어 나른 것으로 보인다 — **"인접 서술을
  건드리지 않는다" 를 지키다가 인접 서술의 거짓을 승계한 형태**다.

  **왜 이번 PR 에서 고치지 않았나** (`eia-idem-resolve-cache-hit`, `spec_impact: none`):
  - 그 PR 은 `switchMap` 콜백 추출 **순수 구조 리팩터**다. spec 편집은 `spec_impact` 를
    바꾸고 `/ai-review` + `--impl-done` 을 다시 요구한다.
  - 게이트를 다시 돌리려면 `--impl-done` scope 에 이 spec 파일이 들어가야 하는데, 그
    스코프(`spec/5-system/`)의 번들이 **예산 초과로 이 파일 본문과 코드 diff 를 둘 다
    떨군다**(2026-08-29 실측: 생략 19개에 `14-external-interaction-api.md` 와
    `<git diff …>` 가 함께 들어 있었다). 검증력이 없는 라운드로 spec 을 고치게 된다.
  - `17_53_19` 의 `rationale_continuity` 도 "이번 diff 와 무관한 사전 존재 drift, 승인 차단
    사유 아님, 별도 정리 turn 권장" 으로 등급을 매겼다.

  **다음 턴에서 판단할 것 — planner 턴인가, developer 자기-반증형 소정정인가.**
  `CLAUDE.md` 의 다섯 조건 중 1(작성자 동일: `worker-ants`)·2(예고·트리거: "…함께 닫는다")·
  3(실측 반증)·4(국한)는 충족으로 보이나, 문장 앞부분 "현재 타입만 검사한다" 는 예고가 아니라
  **구현 상태 서술**이라 2번의 경계에 걸친다. 소정정으로 갈 경우 원문을 취소선으로 남기고
  위 실측표를 함께 실어야 하며, 게이트는 `--spec` 이 아니라 이 파일이 포함되는 스코프의
  `--impl-done` 이다 — 그 번들 문제를 먼저 풀어야 한다.

## `15-external-interaction.md §4` Redis 각주가 `redis-keys.md` 등재를 반영 못 한다 (2026-08-29 등재)

- [x] **§4 외부 의존 표의 Redis 행 각주 "EIA 계열 키는 그 표에 아직 미등재" 를 명확화하거나
      §2.2 참조로 통합** — 실제로는 `4-execution-engine.md §9.2`(엔진 소유 키 **전용** 표) 기준
      서술인데, 바로 옆 §2.2 가 "SoT 는 `conventions/redis-keys.md`" 라고 말하고 **거기엔 이미
      등재돼 있어** 나란히 읽으면 "어디에도 없다" 로 오독된다.

  **출처**: `--impl-done`(`review/consistency/2026/08/29/19_45_22`) convention_compliance INFO 3.
  **이번 PR 범위 밖(pre-existing)** 이고 CRITICAL/WARNING 도 아니라 그 PR 에서 손대지 않았다 —
  `spec/` 쓰기라 `project-planner` 영역이기도 하다.

  **처분 후보 둘 중 하나** (checker 제안 그대로):
  - 각주를 "`4-execution-engine.md §9.2`(엔진 소유 키 전용 표)에는 없음 — 정식 등재는
    `conventions/redis-keys.md §3`" 로 **주어를 명시**하거나,
  - §2.2 와 중복이므로 §4 각주를 **제거하고 §2.2 참조로 통합**.

  > 후자가 더 나아 보이지만 판단은 planner 턴에서. 이 저장소가 반복해 겪은 형태다 —
  > **"어느 표를 말하는가" 를 생략한 부재 서술**은 인접 문서가 그 부재를 메우는 순간 거짓이 된다.

  > **완료 (2026-08-30, planner 턴 `spec-followups-drain`).** 전자(주어 명시)를 택했다 —
  > 각주를 지우면 "엔진 표에는 왜 없나" 를 다음 사람이 다시 묻는다. 이제 세 가지를 명시한다:
  > `redis-keys.md §3` 에 **등재돼 있고**(앵커까지), 실행 엔진 표는 **엔진 소유 키 전용**이라
  > 없는 것이 정상이며, "(별도 항목)" 은 이미 해소돼 **지웠다**(없는 작업을 쫓게 하므로).
  >
  > **부수 정정**: 원 각주가 가리키던 `§9.1` 은 **표가 아니다**(산문, 0행). 실제 키 표 9행은
  > `§9.2` 다 — 초안이 원 문장을 그대로 베껴 §9.1 을 반복했다가 `10_25_39` plan_coherence W5
  > 가 잡았다. **정정 대상 문장을 인용 출처로 쓰면 그 부정확을 승계한다.**

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__14-external-interaction-api.md 참조.
- 핵심 surface (REST 명령·SSE 스트림·iext/itk 토큰·HMAC 서명·SSRF·secret rotation·idempotency·CORS) 는 구현 완료. 위 항목은 hardening/배율/분산성 갭이며 기능 데드락은 아님.

### 미체크 항목 재판정 (2026-08-22, `backend-redact-depth-boundary`)

> **세션명이 이 절을 실은 PR 과 다른 것은 의도다** (`17_06_14` scope W2). 재판정은
> `backend-redact-depth-boundary` 세션이 착수 전 점검으로 수행했고, 그 PR 의 리뷰가
> *"본래 목표(깊이 경계 테스트)와 무관한 grooming"* 으로 지적해 **커밋째 이 PR 로 옮겼다.**
> 수행 주체를 사후에 고쳐 적으면 어느 실측이 어느 세션 것인지 추적선이 끊긴다.


착수 전 **미체크 37건을 항목별로 재판정**했다 — 이전 세션들이 쌓은 것이라 이미 닫혔을 수
있어서다. 판정은 항목 서술이 아니라 **현행 `origin/main`(`7b0e65aa8`) 코드/spec 실측**으로
했다.

| 결과 | 건수 | 비고 |
| --- | --- | --- |
| 이미 닫혀 있었다 | **1** | 프리필 가드 후속 3건의 첫 하위 항목 (`isMaskedMarker` non-string 단위 테스트) — PR #1190 이 부수적으로 닫음 |
| 이번 PR 이 닫았다 | 0 | (이 PR 이 닫은 것은 트래커 밖 `masked-marker-shared-package.md` L192) |
| 결정만 받았다 | 1 | 두 Manual 엔드포인트 `error.code` 통일 (아래 결정 노트) |
| 여전히 유효 | 나머지 | 실측 근거는 각 항목 유지 |

**실측 표본**(항목 → 확인 명령의 결과):

- `result.outputs` — spec `14-…md:589` 가 여전히 **미구현 (Planned)**
- 분산 SSE fan-out — `sse-adapter`·`notification-fanout` 둘 다 `executionEvents$` in-process
  구독뿐, Redis pub/sub 없음
- `getStatus` `nodeOutput` 키-allowlist — `interaction.service.ts:312` 주석이 아직
  *"별개 잔여 항목"*
- §8.2 HMAC — spec `14-…md:945` 가 아직 *"`hmac-sha256` 만"*
- ~~`EIA-AU-09` — `data-flow/15-…md` 가 아직 참조~~ → **해소 완료**. spec 쪽은 `spec-text-fixes`
  턴이, 코드 주석은 `eia-misc-hygiene`(2026-08-27)이 정정했다. 저장소 잔존 0건(실측).
  **주의는 유지**: 문서에 `EIA-AU-08/09` 로 적히면 `grep 'EIA-AU-09'` 는 **0건을 낸다** —
  같은 형태의 다음 오기를 찾을 때 결합 표기를 함께 훑어야 한다
- `TERMINAL_DURATION_MS_SQL` 실 Postgres 검증 — `codebase/backend/test/` 에 참조 0건
- `extractReturnedDurationMs`/`applyResolvedDuration` — 저장소 전체 참조 0건
- Re-run 차단 판정 순수 함수 추출 — `rerun-modal.tsx:419` 에 여전히 컴포넌트 본문 표현식

> **교훈**: 닫힌 1건은 *"미러 추출"* 이라는 **다른 제목의 PR** 이 부수적으로 닫은 것이었다.
> 트래커 항목은 **자기를 닫은 PR 이 자기 이름을 부르지 않으면** 영영 미체크로 남는다 —
> 그래서 주기적 재판정이 필요하고, 재판정은 항목 서술이 아니라 코드를 봐야 한다.

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
