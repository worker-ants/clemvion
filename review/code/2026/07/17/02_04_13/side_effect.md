## 발견사항

- **[CRITICAL]** 세션 복원(restore) 경로에 `seedWaitingFromStatus` 신규 terminal 분기의 가드가 없음 — teardown 직후 stream 재오픈 + refreshToken 네트워크 호출 + 세션 storage 부활
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:564-573` (`applyConfig`, 마운트 시 저장 세션 복원). 대조: 동일 함수를 호출하는 `start()` 는 `:309-346`, 특히 `:332-336`.
  - 상세:
    이번 diff 는 `seedWaitingFromStatus`(`use-widget.ts:240-278`)에 새 terminal 분기를 추가했다 — `getStatus` 결과가 `completed`/`failed`/`cancelled` 면 `teardownSession()` → `dispatch({type:"ENDED"})` → `bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 수행하고 `return` 한다. 이 함수는 3곳에서 호출된다: ① `start()`(`:332`), ② 세션 복원 `applyConfig`(`:570`), ③ `execution.replay_unavailable` 폴백(`handleEiaEvent`, ref 경유). 세 호출부 모두 "이 함수가 내부적으로 teardown 을 수행할 수 있다"는 새 전제를 안게 됐는데, **가드는 ①에만 있고 ②에는 없다.**

    - `start()`(`:309-346`)는 `await seedWaitingFromStatus(...)` 뒤에 `if (startGenRef.current !== gen) return;`(`:334`)로 재확인한 뒤에만 `openStream`/`scheduleRefresh` 를 호출한다. `teardownSession()` 이 `startGenRef.current++` 를 수행하므로(`:143`), 이 가드가 (의도했든 우연이든) terminal 분기 이후의 `openStream`/`scheduleRefresh` 를 정확히 스킵시킨다.
    - 반면 `applyConfig`(`:564-573`, 세션 복원 경로)는 `await seedWaitingFromStatus(clientRef.current, saved)`(`:570`) 뒤에 **아무 가드 없이** 곧바로 `openStream(saved, "0")`(`:571`)과 `scheduleRefresh()`(`:572`)를 실행한다.

    재현 시나리오: 사용자가 위젯을 열어 대화를 시작한 뒤 탭을 닫거나 새로고침하지 않고 방치 — execution 이 백그라운드에서 완료(`completed`/`failed`/`cancelled`)된 뒤, 사용자가 페이지를 새로고침(또는 재방문)한다. `loadSession()` 이 여전히 유효한(만료 전) persisted session 을 반환하므로 `applyConfig` 가 복원 분기를 타고, `seedWaitingFromStatus` 가 `getStatus` 로 이미 terminal 임을 확인해 `teardownSession()`(`clearSession()` 포함 — storage 에서 세션 제거) + `dispatch ENDED` + host `conversationEnded` 통지까지 정상 수행한다. **그러나 그 직후** 가드 없이:
    1. `openStream(saved, "0")`(`:571`) — 방금 종료 통지한 execution 의 엔드포인트로 **새 SSE 연결을 다시 연다**. `execution.replay_unavailable` 시나리오와 동일하게 서버가 아직 5분 버퍼를 들고 있다면, 재연결이 그 버퍼 안의 terminal 이벤트를 다시 replay 할 수 있고, 그러면 `handleEiaEvent` 의 기존 terminal 분기(`:184-188`, 이번 diff 무관)가 재차 실행돼 `teardownSession()` + `dispatch ENDED` + **`bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 두 번째로 발사**한다 — host(임베딩 페이지)가 동일 대화 종료를 두 번 통지받는다(§8 이벤트/콜백 변경에 해당).
    2. `scheduleRefresh()`(`:572`) — `teardownSession()` 이 `sessionRef.current` 를 null 처리하지 않으므로(참고: `resetSessionRefs`=`teardownSession`+`sessionRef.current=null`+... 와 달리, 이 새 terminal 분기와 기존 SSE terminal 분기는 둘 다 `teardownSession()` 만 호출하고 `sessionRef.current` 는 그대로 둔다) `scheduleRefresh` 는 `sessionRef.current`(=`saved`, 이미 종료된 execution)를 기준으로 타이머를 예약한다. 이미 종료된 execution 의 interaction token 은 대개 만료에 가깝거나 지난 상태이므로 `refreshDelayMs` 는 최소 지연(`TOKEN_REFRESH_MIN_DELAY_MS`=5s)으로 클램프되기 쉽고, 그러면 **5초 후 `client.refreshToken(...)` 이 실제로 백엔드에 호출된다**(§7 의도치 않은 네트워크 호출). 이 호출이 성공하면 `sessionRef.current = updated; saveSession(cfg.triggerEndpointPath, updated)`(`use-token-refresh.ts:78-80`)가 실행돼 **방금 `clearSession()` 으로 지운 storage 항목을 종료된 세션 데이터로 다시 채운다** — 이 diff 의 fix 의도(`{ terminal 이면 teardown+ENDED }`)를 곧바로 무효화하는 상태 재기록이다(§1 의도치 않은 상태 변경).
  - 제안: `applyConfig` 에도 `start()` 와 동일한 재확인 가드를 추가한다. 가장 단순한 방법은 `seedWaitingFromStatus` 를 "teardown 발생 여부"를 반환하도록 바꾸거나(예: `boolean` 반환), `start()` 가 쓰는 `startGenRef` 패턴을 `applyConfig` 도 공유하도록 세대 카운터를 comparison 하는 것이다. 최소 변경으로는 `await seedWaitingFromStatus(...)` 직후 `if (sessionRef.current !== saved) return;`(teardown 시 `resetSessionRefs` 계열이 `sessionRef.current` 를 null 화하는 경우) 만으로는 불충분하므로(현재 이 terminal 분기는 `sessionRef.current` 를 건드리지 않음), `seedWaitingFromStatus` 자체가 teardown 을 수행했는지 알려주는 명시적 신호(반환값 또는 별도 ref 플래그)를 두고 두 호출부(`start`/`applyConfig`) 모두 그 신호로 후속 `openStream`/`scheduleRefresh` 를 게이팅하는 것을 권장.

- **[INFO]** `seedWaitingFromStatusRef` 갱신을 render-body 대입에서 `useEffect(() => {...})`(deps 없음, 매 렌더 실행)로 이동
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:284-286`
  - 상세: 기존에는 render 중 직접 대입이었던 것을 effect 로 옮겨 `apiRef`(`:543-545`) 컨벤션과 통일했다. 이 콜백(`seedWaitingFromStatus`)이 이제 `handleEiaEvent` → SSE 이벤트로만(스트림은 effect 이후에만 열림) 호출되므로 "최초 effect 이전 호출" race 는 없다는 주석 근거도 타당하다. 부작용 관점에서 문제 없음(오히려 `useCallback` deps 가 향후 늘어나도 stale-ref 위험이 사라져 안전성이 개선됨).

- **[INFO]** `seedWaitingFromStatus` 의 `useCallback` deps 가 `[]` → `[teardownSession]` 로 변경
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:277`
  - 상세: `teardownSession` 은 안정적인(`useCallback` deps `[closeStream, clearRefreshTimer]`, 둘 다 `[]`) 콜백이라 실질적으로 `seedWaitingFromStatus` 도 여전히 stable 하다. 이 함수를 deps 로 갖는 `start`(`:346`)의 `useCallback` 배열도 기존에 `seedWaitingFromStatus` 를 이미 포함하고 있어 연쇄 재생성 영향 없음. 문제 없음.

- **[INFO]** 테스트 파일(`use-widget-eager-start.test.ts`) — GET 매칭 관용구 통일 + 신규 2건 추가
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1141`(관용구 통일), `:1191-1259`(신규 terminal 테스트), `:1262-1317`(신규 soft-fail 테스트)
  - 상세: fetch mock 조건식을 파일 기존 관용구(`(init?.method ?? "GET") === "GET"`)로 통일했고, 신규 두 테스트는 각각 "replay_unavailable 폴백 중 이미 종료된 execution → ENDED 전이"와 "폴백 getStatus 자체 실패 시 soft-fail 유지"를 검증한다. 둘 다 순수 mock/assert 로 실제 네트워크·전역 상태를 건드리지 않으며, `vi.stubGlobal("fetch", ...)` 은 기존 테스트 인프라 패턴 그대로다. 다만 두 신규 테스트 모두 `execution.replay_unavailable` 폴백 경로만 검증하고, 위에서 지적한 **세션 복원(`applyConfig`) 경로의 terminal 처리는 커버하지 않는다** — CRITICAL 항목이 테스트로 잡히지 않는 이유이기도 하다.
  - 제안: 없음(테스트 자체는 side-effect 관점 문제 없음). 단, 위 CRITICAL 항목 수정 시 "복원 시 이미 terminal 인 세션 → openStream/scheduleRefresh 미호출" 을 검증하는 회귀 테스트 추가를 권장(이는 testing 영역 소관이나 이 발견의 재발 방지와 직결).

- **[INFO]** `webauthn.controller.spec.ts` — mock 확장 + 신규 `describe('webauthnList', ...)` 2건
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts:36`(mock에 `listCredentials: jest.fn()` 추가), `:47-87`(신규 테스트)
  - 상세: `beforeEach` 의 `jest.clearAllMocks()` 로 매 테스트 격리되고, 신규 테스트는 컨트롤러 반환값(`{ data: { items } }` envelope)만 검증하는 순수 단위 테스트다. 전역 상태·파일시스템·네트워크·환경변수에 영향 없음. `webauthn.controller.ts`/`webauthn-response.dto.ts` 자체는 이번 diff 범위 밖(이미 이전 커밋에 존재)이라 시그니처·인터페이스 변경 이슈 없음.

- **[INFO]** `review/code/2026/07/17/01_42_44/*` (RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json, 각 리뷰어 산출물 9종) 신규 추가
  - 위치: `review/code/2026/07/17/01_42_44/**`
  - 상세: 이전 ai-review 라운드의 산출물을 저장소에 커밋하는 순수 문서/데이터 파일 추가. 런타임 코드가 아니므로 부작용 관점 해당 없음.

## 요약
프로덕션 코드 변경은 `use-widget.ts` 한 곳(`seedWaitingFromStatus` 에 terminal 상태 처리 분기 추가)이며, 이 분기 자체(teardown + ENDED dispatch + host 통지)는 `execution.replay_unavailable` 폴백 목적에는 부합한다. 그러나 같은 함수를 호출하는 세 지점 중 세션 복원 경로(`applyConfig`)에만 `start()` 가 갖고 있는 "teardown 이후 후속 호출(openStream/scheduleRefresh) 스킵" 가드가 빠져 있어, 이미 종료된 execution 을 복원할 때 (a) 방금 종료 통지한 대화에 대해 SSE 를 다시 열어 buffer replay 로 인한 중복 `conversationEnded` host 콜백을 유발할 수 있고, (b) `scheduleRefresh` 가 종료된 세션 기준으로 예약돼 실제 `refreshToken` 네트워크 호출과 그 성공 시 storage 에 종료된 세션을 되살리는 상태 재기록을 일으킬 수 있다. 이는 이번 fix 가 명시적으로 의도한 teardown/정리 동작을 같은 요청 흐름 안에서 스스로 되돌리는 실질적 회귀이며, 신규 테스트도 이 경로를 커버하지 않아 검출되지 않는다. 나머지 변경(ref effect 전환, deps 확장, 테스트 추가, 문서 산출물 커밋)은 부작용 관점에서 문제 없다.

## 위험도
CRITICAL
