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

## 폐지된 필드를 현재형으로 인용 (2026-08-14 등재, `22_29_16` cross_spec W1·W2)

**문서가 자기모순이다.** 같은 파일 `:838` 은 inline 인증 필드가 *"폐지됐고"* 라 옳게 적는데,
`EIA-NX-03`(`:57`)과 `R12`(`:1260`)는 `hmacAlgorithm` 을 *"trigger config 에 보관하되"* 라며
**현재형**으로 인용한다.

**실측**: `hmacAlgorithm` 은 `V066__trigger_config_strip_inline_auth.sql` 로 제거됐고
`triggers.service.ts:634` 가 저장 시 스트립한다(`triggers.service.spec.ts:607` 이
`not.toHaveProperty('hmacAlgorithm')` 로 고정). 현행 위치는 `AuthConfig.config.algorithm` 이며
**소유자가 트리거가 아니라 자격증명 메타로 바뀌었다** — `12-webhook.md:167` 이 그 차이를 명시한다.

- [ ] `EIA-NX-03`(`:57`)·`R12`(`:1260`)의 `hmacAlgorithm` 인용을 `AuthConfig.config.algorithm`
      기준으로 재작성. 결론(inbound `sha256` vs outbound `hmac-sha256` prefix 분리)은 유지
- [ ] §11 `execution.stop` 행에 WS §4.6 과 같은 `_(WS 명령 §4.2 won't-do)_` 주석 —
      두 "권위 표" 가 어긋나 있다 (`22_29_16` cross_spec W2)
- [ ] (선택·비차단) `2-api-convention.md §2.2` 에 `/api/external/*` 를 "별도 인증 family 를 쓰는
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

- [ ] **잔여 — 자격증명 **없는** 연결 문자열·내부 호스트명·스택 프래그먼트는 여전히 통과**
      (2026-08-16 등재, `09_51_00` requirement W1). `SECRET_LEAK_PATTERNS` 는 자격증명을
      겨냥한다 — 무수정 프로브로 `postgres://db.internal:5432/prod` 무변화 확인.
      알림 경로의 `CONNECTION_STRING_PATTERN`·`STACK_TRACE_PATTERN` 을 shared SoT 로 올리면
      `deepRedactSecrets` 의 **다른 소비자 전부**(conversation-thread `turns[].data` ·
      `ai_message.messages[]` · EIA `nodeOutput`)가 영향을 받으므로 blast radius 가 다른 별건이다.
      승격 시 그 소비자들의 회귀 테스트를 선행해야 한다

- [ ] **`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다** (2026-08-16 등재, 위 항목의
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

- [ ] **workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한 마스킹으로 내보낸다**
      (2026-08-16 등재, `17_12_34` requirement W1). `explore-tools.service.ts:464`·`:484` 가
      `maskSensitiveFields`(**키 이름** 기반)만 걸어 `error.message` 안의 `Bearer …` 를
      통과시킨다 — 실측: 그 함수는 `typeof value !== 'object'` 면 그대로 반환한다.
      > **단순 합성은 답이 아니다** (실측으로 반증). `redactStoredErrorForResponse` 를 겹쳐
      > 봤더니 기존 테스트가 RED 였다 — `maskSensitiveFields` 는 자격증명 키를 `****9876`
      > 으로 **접미 힌트를 남기는데**(어떤 키가 가려졌는지 식별용) 값-패턴 마스킹이 그걸
      > `***` 로 덮는다. 두 마스킹 의미 중 이 표면에서 무엇이 우선인지가 **결정 항목**이다.
      > 테스트를 내 변경에 맞춰 고치는 대신 되돌리고 여기 등재한다

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

- [ ] **`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다** (2026-08-17 등재).
      아래 항목에서 `outputData` 만 닫고 **`inputData` 는 되돌렸다.** 이 값은 표시 전용이
      아니라 **재제출**되기 때문이다 — Re-run 모달이 프리필해 `inputOverride` 로 되보내고
      (`useOriginalInput` **기본 `false`**), 에디터 "히스토리에서 불러오기" 도 같은 값을
      재실행한다. 마스킹하면 리터럴 `'***'` 가 새 실행의 **실제 입력값**이 된다.
      > **두 게이트가 독립으로 CRITICAL 을 냈다**(`23_49_05` cross_spec · `23_50_03`
      > side_effect). 소스 추적으로 확증했고 사용자가 **철회**를 택했다.
      > 기본 Re-run(`useOriginalInput=true`)은 서버가 엔티티를 직접 읽어 영향 없다.
      > **닫는 조건**: 두 소비처가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는 가드.
      > 그 가드가 서면 이 컬럼도 닫는다. 현재는 회귀 캐너리로 **비대상임을 고정**해 뒀다
      > (`executions.service.spec.ts` ⑧·⑧-b·⑥-b, `background-runs.service.spec.ts`).
      > 남는 노출은 트리거 파라미터 자유 텍스트뿐 — webhook 민감 헤더는 ingestion 이
      > 이미 `[REDACTED]` 로 가린다.

- [ ] **`kb:<documentId>` · `background:run:<id>` WS 채널에도 값-패턴 마스킹 적용 검토**
      (2026-08-17 등재, `00_23_57` security INFO-1). 두 채널의 구독 인가도 `execution:` 과
      **같은 근거**(role 미검사, workspace 소유만 확인)인데 `maskWireEnvelope` 밖에 있다.
      > 이번에 닫지 않은 이유: **외부 fanout 이 없다** — `executionEventSubject` 로 흐르지
      > 않아 SSE/chat-channel 에 도달하지 않는다. 즉 이 PR 이 겨눈 "외부 누출" 표면이
      > 아니다. 다만 population-parity 논리는 그대로 적용되므로 별건으로 남긴다.

- [ ] **유저 가이드 Error 탭에도 마스킹 캐비엇** (2026-08-17 등재, `00_23_57` documentation
      INFO-19). 이번엔 Output 탭만 반영했다 — `error` 도 #1179 이후 마스킹되므로 같은 캐비엇이
      맞지만, 이 PR 의 변경 대상(`outputData`)에 범위를 맞춰 좁게 반영했다.

- [ ] **WS 대기-재개 경로에도 같은 "마스킹된 값의 재사용" 이 있는지 점검** (2026-08-17 등재,
      `23_50_03` side_effect W2). 버튼 재개는 실측상 `resumeFromButtons` 가 로컬 UI 상태만
      정리하고 payload 를 재제출하지 않아 **현재는 무해**하다. 다만 위 CRITICAL 과 **같은
      클래스**(마스킹된 응답을 표시가 아니라 재입력으로 재사용)라, form/conversation 재개까지
      포함해 전수로 한 번 훑어 두는 것이 값싸다.

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

- [ ] **`15-chat-channel.md` §5.1(319행)·§8(507행)** — `InteractionRequestContext` 를
      "단일 인터페이스 + optional `scope` 필드" 로 서술한다. EIA §3.3.1 은 이미
      **discriminated union**(`External`/`Internal` 별도 인터페이스)으로 정의하고 코드도
      그렇다. **체커가 "보안 민감(토큰-우회 타입)이라 우선도 있다" 고 표시했다** — 다만
      문서 stale 이지 런타임 결함이 아님을 확인했다. EIA §3.3.1 을 SoT 로 가리키는 포인터로
      대체하는 편이 재-drift 를 막는다
- [ ] **EIA §5.1** 이 webhook §5.2 를 *"legacy `statusCode/errors` shape"* 라 서술 —
      webhook 은 2026-06-28(`7e181ed8e`)에 이미 `{error:{code,message,details}}` 로
      정합화됐다. 대비 문구가 유효기간을 넘겼다
- [ ] (INFO) `data-flow/15-external-interaction.md:119` 가 **정의되지 않은 `EIA-AU-09`** 참조
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
- [ ] 순수 실행시간과 wall-clock 대기시간의 **필드 분리** — 위 항목의 유일한 정답

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

- [ ] §8.2 를 `hmac-sha256` / `hmac-sha512`(§R12) 로 정정. "v2 추가 시 `v2=` prefix" 문구는
      secret rotation 표기와 구분해 재작성하거나 삭제

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
      **완료** ([`ws-event-types-extract`](./ws-event-types-extract.md)).
      `websocket-events.types.ts` 신설(**import 0줄 · 구현 0개**), 호출부 **25 → 13**,
      타입만 가져가던 곳 **0**.
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
- [ ] **`TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 에서 값 검증된 적이 없다** (W10).
      단위 테스트는 문자열 `toContain` 뿐이고, 이 SQL 을 태우는 유일한 e2e
      (`webchat-idle-reaper.e2e-spec.ts`)도 `duration_ms` 를 SELECT/assert 하지 않는다.
      **부호·단위(초 vs ms)·클램프 오류를 잡을 안전망이 없다** — 이번 라운드가 클램프
      부재를 리뷰로만 잡았다는 사실이 그 비용을 실증한다. e2e 에 `duration_ms >= 0`
      sanity 단언 추가.
- [ ] (저비용) `TERMINAL_DURATION_MS_SQL` 이 컬럼명 `started_at` 을 하드코딩 — 엔티티
      메타데이터와 대조하는 assertion 을 다음 편집 때 (W7)

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
