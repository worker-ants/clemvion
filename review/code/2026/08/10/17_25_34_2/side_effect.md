# 부작용(Side Effect) Review — `17_25_34_2` 라운드

## 리뷰 범위에 대한 메모

이번 라운드의 diff(파일 1~13)는 전부 `review/**` 산출물(JSON/MD, 순수 추가)과 `spec/7-channel-web-chat/3-auth-session.md` 문서 서술 갱신뿐이다. 런타임 코드 변경이 없으므로 표준 8개 관점(전역 상태·전역 변수·파일시스템·시그니처·인터페이스·환경변수·네트워크·이벤트/콜백)은 전부 **N/A** — `review/`(1~12번 파일)는 리뷰 워크플로 자체의 부기 아티팩트이고 순수 추가(append-only)이며, spec 문서 변경(13번 파일)은 서술 텍스트 갱신일 뿐 `code:` frontmatter 매핑을 바꾸지 않는다.

오케스트레이터의 추가 지시에 따라, 직전 라운드(`17_15_33_2`)에서 낸 CRITICAL — "`refresh_deferred` 가 고착의 절반만 닫는다" — 를 이 PR 이 아니라 plan 에 등재하며 붙인 판단, **"종전 대비 악화는 아니다(종전에도 그 경로는 죽은 토큰으로 SSE 를 열어 같은 스피너였고, 지금은 죽은 토큰을 안 쓴다)"** 가 실측상 맞는지를 실제 소스(`use-widget.ts`, `use-token-refresh.ts`)와 git 이력을 직접 열어 검증했다. 아래는 그 결과다.

## 발견사항

- **[INFO]** "종전 대비 악화 아님" 판단 — **재검증 결과 유효.** 두 가지 방식으로 확인했다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:730-733`(`start()`)·`:1073-1089`(`applyConfig()`)의 `openStream` 게이팅, `codebase/channel-web-chat/src/lib/eia-client.ts:130-151`(`openStream` 이 만드는 `EventSource`), `codebase/channel-web-chat/src/lib/widget-state.ts` 의 `"BOOTED"`/`"RESTORED"`→`phase:"streaming"` 리듀서 케이스(`WAITING` 만 `awaiting_user_message` 로 바꿈).
  - **(1) UI 축 — "같은 스피너" 재확인**: 비교 대상인 옛 `"continue"` 분기(커밋 `31b14aa22`, 이후 `3d0cec69b`·`fd1075514` 로 대체돼 현재는 존재하지 않음)와 현재 `"refresh_deferred"` 분기 둘 다, `seedWaitingFromStatus` 의 **`WAITING` dispatch 정상 성공 경로**(`use-widget.ts:583-591` 부근)를 거치지 않고 401-재복구 `catch` 블록에서 직접 `return` 한다. 즉 두 경로 모두 `phase` 는 `BOOTED`/`RESTORED` 가 마지막으로 세팅한 `"streaming"` 에 멈추고 `panel.tsx` 가 Composer 를 동일하게 비활성화한다 — **UI 관점에서 "같은 스피너"라는 서술은 코드로 확정된다**(두 분기 모두 `dispatch({type:"WAITING"})` 호출 0건, `grep` 실측).
  - **(2) 네트워크/상태 축 — 실제로는 "같음" 이 아니라 "개선"**: 옛 `"continue"` 분기는 `openStream(live, "0")` 를 실제로 호출해 **거부된(dead) 토큰으로 `EventSource` 를 생성**했다(`eia-client.ts:130-133`, 토큰을 쿼리파라미터로 굽는다). 이 `EventSource` 의 `onError` 핸들러(`use-widget.ts` `openStream` 콜백)는 `console.warn` 만 하고 `es.close()` 를 호출하지 않으며, `closeStream()` 은 teardown/재시작/언마운트에서만 불린다(`use-widget.ts:253-255`, `294`, `1150`) — 즉 그 죽은 `EventSource` 참조가 `streamRef.current` 에 **비-null 로 계속 남는다.** `sessionEstablished()`(`use-widget.ts:251`)는 `streamRef.current !== null` 만 검사하므로, 옛 경로는 실패한 스트림을 "이미 확립됨" 으로 **오판하는 부작용**을 추가로 갖고 있었다. 반대로 현재 `"refresh_deferred"` 경로는 `openStream` 자체를 건너뛰므로 `streamRef.current` 는 `null` 로 남아 `sessionEstablished()` 가 정확한 값을 유지한다.
  - 결론: 사용자 가시 증상(무기한 스피너)은 옛/현재 두 경로에서 동일하고, 현재 경로가 (a) 거부된 토큰으로 커넥션을 열지 않고 (b) `streamRef` 를 오염시키지 않는다는 점에서 **엄밀히는 "같음" 이 아니라 "우위"** 다. 이는 plan 문서(`webchat-auth-session-status-reconcile.md`, `## 미해결` 절)가 향후 선택지 (a)(주기 갱신 성공 시 `openStream` 호출 주입)를 검토할 때 실제로 유리한 조건이기도 하다 — `streamRef` 가 미리 오염돼 있지 않아야 그 fix 가 `sessionEstablished()` 가드에 막히지 않는다.
  - 제안: 없음(검증 결과 확인만). 이 PR 에서 추가 조치 불필요.

- **[INFO]** "종전" 이 정확히 가리키는 커밋이 모호하다 — 결론에는 영향 없으나 문구 정밀도 낮음.
  - 위치: 커밋 `d03deb339` 메시지 §3, `plan/in-progress/webchat-auth-session-status-reconcile.md` `## 미해결` 절 마지막 문단("종전 대비 악화는 아니다…").
  - 상세: `git log --oneline -- codebase/channel-web-chat/src/widget/use-widget.ts codebase/channel-web-chat/src/widget/use-token-refresh.ts` 로 실측한 실제 커밋 이력은 `"continue"`(커밋 `31b14aa22`, 죽은 토큰 SSE) → `"stale"`(커밋 `3d0cec69b`, 스트림+갱신예약 둘 다 스킵) → `"refresh_deferred"`(커밋 `fd1075514`, HEAD) 3단계다. RESOLUTION·plan 문구의 "종전에도 그 경로는 죽은 토큰으로 SSE 를 열어" 는 이 중 **`"continue"`(2단계 전)** 를 가리키는데, 이 수정이 실제로 대체한 **직전(1단계 전) 커밋의 실제 상태는 `"stale"`** — `"stale"` 은 죽은 토큰으로 SSE 를 연 적이 없다(애초에 `scheduleRefresh` 조차 건너뛰어 갱신 시도 자체가 없었다, `3d0cec69b` 커밋 메시지 자체가 이를 "영구 고착" CRITICAL 로 명시). 다만 두 상태(`"continue"`/`"stale"`) 모두에 대해 `"refresh_deferred"` 가 열위가 아님(오히려 우위: `"continue"` 대비는 위 INFO#1, `"stale"` 대비는 최소한 `scheduleRefresh` 를 살려 자기치유 시도가 1회는 남는다)을 이미 확인했으므로, 결론 자체는 어느 비교 기준을 잡아도 동일하게 유효하다.
  - 제안: 부작용 리뷰어 권한 밖(plan 수정은 project-planner/developer 몫)이라 직접 고치지 않는다. 다음에 이 plan 절을 만지는 턴에서 "종전" 을 "`\"continue\"`(2단계 전 커밋 `31b14aa22`)" 처럼 구체적으로 명시하면 이후 독자의 오독(직전 커밋과 혼동)을 막을 수 있다는 점만 남긴다.

## 요약

이번 라운드 diff 자체(review 산출물 + spec 문서)는 런타임 부작용이 없다. 오케스트레이터가 요청한 검증 — 직전 CRITICAL("`refresh_deferred` 가 고착의 절반만 닫는다")을 이 PR 에서 안 닫기로 한 근거인 "종전 대비 악화 아님" 판단 — 은 실제 소스(`use-widget.ts`/`use-token-refresh.ts`)와 git 이력을 직접 추적한 결과 **유효**하다: 사용자 가시 증상(무기한 스피너, Composer 비활성)은 옛/현재 두 경로에서 동일하고, 네트워크/내부상태 측면에서는 현재 경로(거부된 토큰으로 EventSource 를 안 열고 `streamRef` 를 오염시키지 않음)가 오히려 더 낫다. 따라서 이 CRITICAL 을 이번 PR 에서 반드시 닫아야 할 근거는 없다 — plan 등재 처분이 타당하다. 유일한 흠은 RESOLUTION/plan 문구의 "종전" 이 실제 직전 커밋(`"stale"`)이 아니라 그보다 한 단계 더 이전 상태(`"continue"`)를 가리켜 다소 부정확하다는 점인데, 어느 기준으로 비교해도 결론(악화 아님)은 바뀌지 않으므로 이 PR 의 처분을 뒤집을 사안은 아니다.

## 위험도

NONE
