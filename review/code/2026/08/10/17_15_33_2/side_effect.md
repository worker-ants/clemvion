# 부작용(Side Effect) Review — spec/7-channel-web-chat/3-auth-session.md

## 리뷰 범위에 대한 메모

이번 diff 자체는 `spec/7-channel-web-chat/3-auth-session.md` 문서(markdown) 변경뿐이라 런타임
부작용은 없다(문서 서술 갱신 + `plan/in-progress/webchat-auth-session-status-reconcile.md` 링크
추가). 그러나 orchestrator 의 추가 지시에 따라, 이 문서가 "구현됐다" 고 주장하는 그 구현 —
`"stale"` CRITICAL 을 `"refresh_deferred"` 로 닫은 실제 코드(`codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-token-refresh.ts`) — 를 직접 열어 그 조합이 새 부작용을
만드는지 검증했다. 아래는 그 검증 결과다.

## 발견사항

- **[CRITICAL]** `"refresh_deferred"` 로 진입하면, 그 뒤에 예약되는 주기 갱신이 **성공해도 스트림을
  열지 않는다** — 성공/실패 어느 쪽이든 세션이 영구히 "갱신만 돌고 스트림은 없는" 상태로 남는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts` 의 `scheduleRefresh` 콜백
    (`.then()` 성공 분기 88~98줄, `.catch()` 실패 분기 100~103줄) / `codebase/channel-web-chat/src/widget/use-widget.ts:716`(`start()`)·`:1073`(`applyConfig()`)의 `openStream` 게이팅.
  - 상세: `grep -n "openStream" use-widget.ts` 결과 `openStream` 호출부는 정확히 두 곳뿐이다 —
    `start()`(716줄, `if (outcome !== "refresh_deferred") openStream(live, "0");`)과
    `applyConfig()`(1073줄, `if (!deferStream) openStream(live, "0");`). `outcome === "refresh_deferred"`
    이면 두 곳 다 **건너뛰고** `scheduleRefresh()`(717/1074줄)만 호출한다. 그런데 `scheduleRefresh`
    가 만든 `setTimeout` 콜백(`use-token-refresh.ts:79-104`)은:
    - **성공**(`.then()`, 88~98줄): `sessionRef.current` 를 새 토큰으로 교체하고 `scheduleRefresh()`
      를 재귀 재예약할 뿐, **`openStream` 을 호출하지 않는다.** `sessionRef` 는 React state 가 아니라
      `useRef`(`use-widget.ts:145`)라 변경돼도 아무 effect 도 재실행되지 않는다. 즉 이 refresh 가
      **몇 번을 성공해도** 이 세션은 영원히 스트림 없이 남는다.
    - **실패**(`.catch()`, 100~103줄): `console.warn` 만 하고 **재예약도 하지 않는다.** 이 분기의
      주석("SSE 는 hard expiry 까지 유지, 다음 입력의 401 을 sendCommand 가 처리")은 스트림이 이미
      열려 있다는 전제 위에서만 성립하는데, `refresh_deferred` 로 온 세션은 애초에 스트림을 연 적이
      없어 그 전제가 깨진다.
    - `execution.replay_unavailable` SSE 폴백(`use-widget.ts:344-349`)도 스트림이 열려 있어야
      발화하는데(SSE 이벤트이므로), 스트림 자체가 없으니 이 경로도 닿지 않는다.
    - 결과적으로 `openStream` 을 다시 호출할 수 있는 코드 경로가 **존재하지 않는다**(전수 grep으로
      확인 — 두 호출부 모두 refresh_deferred 로 게이팅돼 있고, 그 외 호출부 없음).
  - 이것이 요청받은 두 질문에 대한 답이다:
    - **(a) 지속 시간**: `scheduleRefresh` 가 사용하는 `session.expiresAt` 은 **방금 401 을 받은
      옛 세션의 값**이다(`refresh_deferred` 분기는 `sessionRef` 를 갱신하지 않음 — `recoverFromExpiredToken`
      의 `"continue"` 분기만 갱신). `refreshDelayMs(expiresAt, now) = max(TOKEN_REFRESH_MIN_DELAY_MS, expiryMs - now - TOKEN_REFRESH_LEAD_MS)`
      (`use-token-refresh.ts:21-25`, LEAD=30분)이므로, 이미 죽은 토큰의 `expiresAt` 로는 사실상
      항상 5초 바닥(`TOKEN_REFRESH_MIN_DELAY_MS`)으로 클램프된다 — 즉 **다음 시도는 ~5초 뒤**.
      하지만 그 시도가 성공하든 실패하든 스트림 없음 상태는 끝나지 않는다(위 근거) — 따라서 "얼마나
      지속되는가"의 진짜 답은 **무기한**이다.
    - **(b) 무엇이 스트림을 열어주는가**: **아무것도 없다.** 유일한 client-driven 복구는 사용자가
      탭/페이지를 새로고침해 `applyConfig` 를 처음부터 재실행시키는 경우뿐인데, 위젯 UI 자체는
      이를 유도하지 않는다(아래 두 번째 발견 참조 — 사용자에게 에러조차 보이지 않는다).
  - 제안: `use-token-refresh.ts` 의 `scheduleRefresh` 에 "이 세션이 스트림 없이 대기 중"임을 알리는
    신호(콜백 또는 상태)를 추가해, 성공 시 `openStream` 을 실제로 호출하거나 최소한 호출부(`use-widget`)
    에 "지금 열어라" 를 통지하게 해야 한다. 실패 시에도 무한정 침묵하지 말고 최소 1회는 재시도하거나
    `ERROR`/`ended` 로 명시 전이해야 한다.

- **[CRITICAL]** 위 스트림 없는 대기 상태에서 UI 는 사용자에게 **아무 것도 보여주지 않고 입력도
  막는다** — `sendCommand` 의 401 백스톱(주석이 기대하는 유일한 복구 경로)에 사용자가 아예 도달할
  수 없다.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` — `"BOOTED"`/`"RESTORED"` 리듀서 케이스가
    `phase: "streaming"` 으로 전이(각각 `case "BOOTED"`, `case "RESTORED"` 블록, `WAITING` 액션만
    `phase: "awaiting_user_message"` 로 바꿈). `codebase/channel-web-chat/src/widget/components/panel.tsx:190-192`
    — `<Composer disabled={phase !== "awaiting_user_message" || ...} loading={phase === "booting" || phase === "streaming"} />`.
  - 상세: `refresh_deferred` 분기는 `dispatch({ type: "WAITING", ... })` 를 호출하지 않는다(그 dispatch 는
    `seedWaitingFromStatus` 의 정상 성공 경로에만 있다 — `use-widget.ts:583-591`). 따라서 phase 는
    `BOOTED`/`RESTORED` 가 마지막으로 세팅한 `"streaming"` 에 멈춘다. `panel.tsx` 는 `phase !== "awaiting_user_message"`
    이면 Composer 를 비활성화하므로, 사용자는 메시지를 보낼 수 없다 — `use-token-refresh.ts:101` 주석이
    전제하는 "다음 입력이 401 이면 `sendCommand` 가 ERROR 처리" 복구 경로는 **입력 자체가 불가능해
    도달할 수 없다.** `error` state 도 세팅되지 않으므로(`ERROR` dispatch 없음) `wc-error` 배너도
    안 뜬다(`panel.tsx:174`). 즉 사용자에게는 그냥 무기한 스피너(`loading` 스타일)만 보인다.
  - 제안: 위 CRITICAL 과 함께, `refresh_deferred` 로 진입한 지 일정 시간이 지나도 스트림이 안 열리면
    `ERROR` 로 전이해 사용자에게 재시도/새로고침을 안내하는 타임아웃 백스톱을 추가할 것.

- **[WARNING]** 주기 갱신(`scheduleRefresh`)이 이 지연된 세션에 대해 **실제로 확정적 종료
  (`401`/`410`)를 받아도** storage 를 정리하지 않는다 — spec §3.1-3 "storage 정리 책임" 이 명시하는
  "stale 토큰 잔존 금지" 불변식이 이 경로에서 깨진다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:100-103`(`.catch` 블록) — HTTP
    상태코드를 전혀 구분하지 않는다. 비교: `codebase/channel-web-chat/src/widget/use-widget.ts:425-457`
    (`recoverFromExpiredToken` 의 catch)는 `401`/`410` 이면 `finalizeEnded` 로 storage 를 정리하는데,
    이 로직은 `seedWaitingFromStatus` 호출 시점의 **1회성** 낙관적 refresh 에만 있고 주기 타이머
    쪽에는 이식되지 않았다.
  - 상세: spec 본문(diff 대상 파일) 90~91줄: "**storage 정리 책임**: 종료... 그리고... 위젯이 즉시
    storage 항목을 제거한다(stale 토큰 잔존 금지)." 가 나열하는 트리거 목록에 "주기 갱신 타이머가
    나중에 받는 401/410" 은 없다 — 그 경로가 실제로 도달 가능함을 이번 조사로 확인했으므로(위
    CRITICAL 의 (a)) 이 갭도 함께 열려 있다. 즉 execution 이 실제로는 완전히 종료(blacklist 확정)
    됐는데도 클라이언트 sessionStorage 에는 죽은 토큰이 탭 종료까지 남는다 — 기능 영향은 낮지만
    (§R6 근거와 같은 논리 — 단명 토큰) 위 두 CRITICAL 과 같은 코드 경로에서 함께 생기는 부작용이라
    별도로 기록한다.
  - 제안: `use-token-refresh.ts` 의 `.catch` 도 `EiaError` 401/410 을 구분해 `clearSession`/`finalizeEnded`
    급 정리를 호출하도록 확장.

- **[INFO]** 이 잔여 갭은 이미 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에
  "남는 질문은 좁다 — `refresh_deferred` 뒤 주기 갱신이 실제로 복구까지 이어지는지(백오프·횟수)"
  로 언급돼 있으나(문서 179줄, 마지막 줄), **그 문단에는 다른 항목들과 달리 `- [ ]` 체크리스트
  항목이 없다** — 문서 자체의 관례(다른 5개 열린 질문은 전부 `- [ ]` 로 등재)와 어긋난다. 이번
  조사로 "실측 필요" 가 아니라 **"실측 완료 — 복구로 이어지지 않는다(코드상 확정)"** 로 답이 나왔으므로,
  plan 문서 갱신 시 이 사실(성공해도 openStream 안 됨)과 함께 체크리스트 항목으로 반영할 것을 제안한다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:176-179`.
  - 상세: 부작용 리뷰어의 쓰기 권한 밖(`review/code/**` 만 가능)이라 이 파일은 수정하지 않았다 —
    project-planner/developer 턴에서 반영 필요.

## 요약

이번 diff(spec 문서) 자체는 부작용이 없다. 그러나 이 문서가 "구현됐다" 고 주장하는 `"refresh_deferred"`
처리는 원래 CRITICAL("`\"stale\"`이 `scheduleRefresh` 까지 건너뛰어 영구 고착")을 절반만 닫았다 —
스트림을 못 여는 상태 자체는 사라지지 않고, 그 뒤에 예약된 주기 갱신이 **성공해도 `openStream`
을 호출하는 코드 경로가 전혀 없어** 세션이 무기한 "갱신만 돌고 화면은 멈춘" 상태로 남는다(재현
아님, 전수 grep + 코드 흐름 추적으로 확정). 실패 시엔 재예약조차 없이 침묵하고, UI 는 Composer 를
비활성화해 두므로 문서가 기대하는 "다음 입력 401 → `sendCommand` ERROR 처리" 백스톱에도 사용자가
도달할 수 없다. 부가적으로 그 지연된 갱신이 나중에 확정적 401/410 을 받아도 storage 정리가
이뤄지지 않아 spec 이 약속하는 "stale 토큰 잔존 금지" 불변식도 이 경로에서만 깨진다. 세 발견
모두 같은 근본 원인(주기 타이머 경로가 "스트림이 이미 열려 있다"는 전제로 설계됐는데
`refresh_deferred` 는 그 전제를 깨고 이 경로를 재사용함)에서 나온다.

## 위험도

CRITICAL
