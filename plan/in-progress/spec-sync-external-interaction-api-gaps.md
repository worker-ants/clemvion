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

- [x] `EIA-NX-03`(`:57`)·`R12`(`:1260`)의 `hmacAlgorithm` 인용을 `AuthConfig.config.algorithm`
      기준으로 재작성. 결론(inbound `sha256` vs outbound `hmac-sha256` prefix 분리)은 유지
- [x] §11 `execution.stop` 행에 WS §4.6 과 같은 `_(WS 명령 §4.2 won't-do)_` 주석 —
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

- [ ] **workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한 마스킹으로 내보낸다**
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

- [ ] **`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합** (2026-08-20 등재, `14_44_08` W4).
      `toResponseExecution` · `toExecutionDto` · 노드 레벨 `maskIfPresent` 루프 ·
      `background-runs.service.ts` 가 각자 마스킹을 걸고, 유일한 동기화 장치가 **사람이 읽는
      주석 표**다. 이 fragmentation 때문에 실제로 자매 DTO JSDoc 이 갱신에서 빠지는 CRITICAL 이
      났다(`14_08_45` C2) — 근본 원인은 그대로 남아 있다.
      > 공유 `redactExecutionFields(row)` 또는 응답 직전 interceptor 로 통합 검토.
      > **착수 시 동반 갱신**: 이 통합이 집행되면 개별 호출부 심볼이 헬퍼 하나로 흡수돼
      > [`egress-masking` 규약 §1 좌표계 표](../../spec/conventions/egress-masking.md) 의
      > 소비처 열이 stale 해진다(그 문서 §3 에 같은 트리거가 적혀 있다).

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

- [ ] **프리필 가드 후속 3건 (전부 비차단, `12_33_36` INFO)** — 2026-08-17 등재.
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

- [ ] **`execute` 본문의 여분 키를 400 으로 거부할 것인가** (2026-08-22 등재, `execute-body-dto`
      의 이연 결정). 지금은 전역 파이프가 이 본문을 **검증하지 않는다** — 여분 top-level 키가
      조용히 무시된다. 거부로 바꾸면 문서화가 아니라 **공개 API 계약 축소**라 사용자 판단이
      필요하다.
      > 실측: 1st-party(`frontend/src/lib/api/workflows.ts:182`)는 정확히
      > `{ input, parameterValues }` 만 보내 **호환**이다. 위험한 쪽은 우리가 못 세는 외부
      > 클라이언트이고, 이 엔드포인트는 유저 가이드(`02-nodes/triggers.mdx`)에도 실려 있다.

- [ ] **`re-run.dto.ts` 가 열린 map 을 `type: Object` 축약형으로 적는다** (2026-08-22 등재,
      `23_46_23` convention_compliance W1 의 부수 발견). 실측: `additionalProperties: true`
      를 쓰는 파일 **40개** vs `type: Object` 축약형 **2개**(`re-run.dto.ts` + 이번 신규).
      신규 파일은 이번에 다수 패턴으로 맞췄고, `re-run.dto.ts` 는 선존이라 남겼다.
      > 같은 디렉토리의 형제 `execute-node.dto.ts` 가 이미 다수 패턴을 쓴다 — 내가 이번에
      > **잘못된 형제**를 베꼈다가 checker 에 잡혔다.

- [ ] **`swagger.md §3` 의 기본 수치 규칙(`DTO description 10~40자`)이 현실과 벌어져 있다**
      (2026-08-22 등재, 위 §3 예외 확장 작업의 부수 실측). 예외 확장은 **보안·정책 캐비엇
      클래스**만 덮는데, 실측하면 그보다 훨씬 넓다 — 요청 DTO `description` **333개 중
      114개(34%)** 가 40자를 넘고 최장이 435자다. 즉 초과의 대부분은 예외 클래스가 아니라
      **그냥 규칙을 안 지키는 것**이다.
      > 판단이 필요한 지점: (a) 수치를 현실에 맞게 올릴 것인가, (b) 규칙을 유지하고 초과분을
      > 정리할 것인가, (c) "내외" 라는 완충 표현대로 애초에 강제 대상이 아니라고 명문화할
      > 것인가. **§3 예외 확장과는 별개 판단**이라 그 작업에서 의도적으로 분리했다
      > (`22_53_02` rationale_continuity INFO-4 가 이 범위 한정을 관행 정합으로 확인).

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

## 후속 (cross-cutting, 본 spec 밖)
- [x] **Redis fixed-window rate-limiter INCR+EXPIRE 원자화** — `PublicWebhookQuotaService.incrWithWindow` 를 `INCR + EXPIRE ... NX` 단일 pipeline(매 요청)으로 교정해 TTL 유실 self-heal (fail-closed 잠금 창 제거). `ChatChannelRateLimiterService` 는 **이미** 동일 `INCR + EXPIRE NX` 단일 pipeline 패턴이라 무변경(점검 완료). `InteractionRateLimiterService`(item 5)는 Lua EVAL — 세 서비스 모두 원자/self-heal 확보. (PR #843 ai-review concurrency WARNING 후속, `task_fa5c5e84`.)

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
- `EIA-AU-09` — `data-flow/15-…md` 가 아직 참조. **주의**: 문서에 `EIA-AU-08/09` 로 적혀
  있어 `grep 'EIA-AU-09'` 는 **0건을 낸다**(철자 하나만 보면 놓치는 형태)
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
