# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 직전 라운드 CRITICAL(stale 토큰으로 SSE 재오픈)이 두 호출부 모두에서 올바르게 수정됨 — 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:625-632`(`start()`), `:981-985`(`applyConfig()`)
  - 상세: `start()`·`applyConfig()` 모두 `seedWaitingFromStatus` 가 `"continue"` 를 반환한 뒤 `openStream` 에 캡처해 둔 지역 변수(`session`/`saved`) 대신 `sessionRef.current`(`start()`) / `sessionRef.current ?? saved`(`applyConfig()`)를 넘기도록 바뀌었다. §R4 401 낙관적 refresh 가 `sessionRef.current` 를 새 토큰으로 교체하는 지점(`use-widget.ts:522-526`, `applyRefreshedToken` 호출)과 이 읽기 지점이 정확히 짝을 이뤄, "서버가 이미 거부한 토큰으로 SSE 를 여는" 이전 결함 형태는 재현되지 않는다.
  - 제안: 없음(확인용).

- **[INFO]** `applyRefreshedToken` 공유가 "세대 검사 책임"을 흐리지 않음 — 두 호출부 모두 헬퍼 호출 **직전**에 자체 세대 재검사를 유지
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`(헬퍼, JSDoc "세대 검사는 호출부 책임이다"), `codebase/channel-web-chat/src/widget/use-widget.ts:519-521`(401 성공 분기 — `isStale(gen)` → `configRef.current` 존재 확인 → `applyRefreshedToken`), `codebase/channel-web-chat/src/widget/use-token-refresh.ts:92-97`(`worldGenRef.current !== gen` 재검사 → `applyRefreshedToken`)
  - 상세: 헬퍼 자체는 세대·world 개념을 전혀 참조하지 않는 순수 함수(`{...session, ...refreshed}` 후 `saveSession`)이고, "언제 써도 되는가"를 스스로 판단하지 않겠다는 설계 의도가 JSDoc 에 명시돼 있다. 실제로 두 호출부 모두 헬퍼를 부르기 직전에 각자의 staleness 가드(하나는 `isStale()` 헬퍼, 하나는 원시 비교)를 거치므로, 공유가 "검사를 빠뜨리기 쉽게" 만들지는 않는다. (원시 비교 대 `isStale()` 표기 불일치는 이미 maintainability 리뷰 영역이라 여기서는 side-effect 관점의 "검사 누락 위험"만 확인.)
  - 제안: 없음(확인용).

- **[WARNING]** 주기 갱신 타이머와 401 낙관적 refresh(특히 `execution.replay_unavailable` fire-and-forget 경로)가 여전히 서로 모른 채 `client.refreshToken()` 을 동시에 부를 수 있다 — **직전 라운드(`16_09_40`)에서 WARNING 으로 짚었고, 이번 라운드의 RESOLUTION/SUMMARY 어디에도 반영되거나 명시적으로 보류되지 않았다.**
  - 위치: 트리거 A — `codebase/channel-web-chat/src/widget/use-widget.ts:320-333`(`execution.replay_unavailable` 핸들러, `void seedWaitingFromStatusRef.current?.(client, session, { allowWhileStreaming: true })` fire-and-forget). 트리거 A 가 도달하는 401 분기 — `use-widget.ts:511-526`(`client.refreshToken(...)` → `applyRefreshedToken`). 트리거 B — `codebase/channel-web-chat/src/widget/use-token-refresh.ts:79-97`(주기 `setTimeout` 콜백의 `client.refreshToken(...)` → `applyRefreshedToken`). 두 트리거가 겹칠 수 있는 이유 — `scheduleRefresh()` 는 `openStream()` 직후 항상 호출되므로(`use-widget.ts:633`, `:985`) 주기 타이머는 스트림이 열려 있는 내내 살아 있고, `execution.replay_unavailable` 은 정의상 스트림이 이미 열린 상태에서만 오는 SSE 이벤트다(`use-widget.ts:323` 주석 "자기 스트림이 열린 채").
  - 상세: 이번 diff 는 `applyRefreshedToken` 을 뽑아내며 "오케스트레이션은 합치지 않는다"고 명시적으로 결정했다(`session-store.ts:113-116` JSDoc — 전자는 fire-and-forget+재귀 재예약, 후자는 `await`+실패 시 세션 종료 확정이라 정반대). 이 결정은 "무엇을 저장하는가"의 코드 중복은 없앴지만, "**언제 refresh 를 시도할 것인가**"를 조율하는 장치(in-flight 플래그·mutex·단일 refresh 소유자)는 처음부터 없었고 이번 리팩터로도 추가되지 않았다. 두 경로 모두 `clearRefreshTimer()`(`use-widget.ts:263`, teardown 전용)나 다른 어떤 취소·대기 신호도 서로에게 보내지 않는다. 실제 위험은 실패 정책의 비대칭에서 온다 — 주기 갱신 실패는 `console.warn` 만 하고 넘어가지만(`use-token-refresh.ts:100-103`), 401 낙관적 refresh 의 재실패는 **무조건** `finalizeEnded("execution.token_revoked")` 로 세션을 종료 확정한다(`use-widget.ts:530-534`). 백엔드가 refresh 토큰 1회성(rotation)을 강제한다면, 두 경로가 동시에 같은 세션의 토큰으로 `refreshToken()` 을 호출했을 때 늦게 도착한 쪽(주로 401 낙관적 경로)이 실패할 수 있고, 그 실패는 "실제로는 건강한 세션인데 자신의 주기 갱신과 경합해서 진 것뿐"인 상황까지 영구 종료로 오판시킨다.
  - 근거(추적 부재): 이번 diff 의 `review/code/2026/08/10/16_09_40/RESOLUTION.md`(§1~8)와 `SUMMARY.md`(Critical 1 · WARNING 8, "채택하지 않은 것" 표 2건)는 이 라운드에서 반영된/의도적으로 보류된 모든 항목을 열거하지만 이 경합 WARNING 은 어느 목록에도 없다 — 같은 라운드가 명시적으로 채택 보류한 다른 두 항목(module-level 헬퍼 추출, `fetchMock` 파라미터화)과 달리 근거 있는 보류 기록이 없다. 신규 `plan/in-progress/webchat-auth-session-status-reconcile.md` 도 `start()` 경로 401 테스트 커버리지 갭만 추적할 뿐 이 경합은 언급하지 않는다 — `review/**` 는 SoT 가 아니므로, 이 상태로는 다음 세션이 직전 라운드의 이 지적을 다시 찾을 방법이 없다.
  - 제안: (a) `useTokenRefresh` 가 노출하는 단일 `refreshNow()`/in-flight `Promise` ref 를 두 호출부가 공유하도록 통합하거나, 최소한 refresh 호출 전 "이미 진행 중인 refresh 가 있으면 그 결과를 기다린다" 가드를 추가할 것. (b) 401 재실패를 곧바로 `finalizeEnded` 로 보내기 전에 최소 1회 `getStatus` 재조회로 실제 종료 여부를 재확인하는 완충을 고려. (c) 이 WARNING 을 `plan/in-progress/webchat-auth-session-status-reconcile.md`(또는 별도 항목)에 명시적으로 등재해 "review 산출물에만 있어 사라지는" 상태를 벗어날 것.

## 요약

이번 diff 는 직전 라운드가 지적한 CRITICAL(§R4 401 refresh 성공 후 stale 토큰으로 SSE 재오픈)을 두 호출부 모두에서 정확히 고쳤고, 그 과정에서 새로 뽑아낸 공유 헬퍼 `applyRefreshedToken` 은 "세대 검사는 호출부 책임"이라는 설계를 JSDoc 으로 명시했을 뿐 아니라 실제 두 호출부 모두 헬퍼 호출 직전에 각자의 staleness 재검사를 유지해, 공유가 검사 책임을 흐리지 않았다. 다만 요청받은 두 번째 축 — 주기 갱신 타이머와 401 낙관적 refresh(특히 스트림이 이미 열린 상태에서 오는 `execution.replay_unavailable` fire-and-forget 경로) 사이의 실행 조율 — 은 여전히 비어 있다. 이 경합은 직전 라운드(`16_09_40`)에서 이미 WARNING 으로 짚었던 것과 동일하며, 이번 라운드의 `applyRefreshedToken` 추출은 "무엇을 저장하는가"의 코드 중복만 없앴을 뿐 "언제 refresh 를 시도하는가"의 조율 부재는 그대로 남겨뒀다. 더 우려되는 점은 이 WARNING 이 이번 라운드의 RESOLUTION/SUMMARY 어느 목록(반영 8건·보류 2건)에도 등장하지 않아, 다른 두 보류 항목과 달리 근거 있는 판단 기록 없이 조용히 빠졌다는 것이다 — `review/**` 는 SoT 가 아니므로 이 상태로는 사라진다.

## 위험도

MEDIUM
