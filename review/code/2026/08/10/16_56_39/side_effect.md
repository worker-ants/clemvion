# 부작용(Side Effect) Review

## 발견사항

- **[CRITICAL]** `"continue"` → `"stale"` 로 닫은 non-terminal refresh 실패 분기가, 호출부에서 `openStream()`뿐 아니라 **`scheduleRefresh()`도 함께 건너뛰게 만들어** — 주석이 약속한 "다음 복구는 주기 갱신이 맡는다"가 실제로는 일어나지 않고, 위젯이 `streaming` phase 에 영구히 고착된다(이 PR 이 없애려던 바로 그 증상을 다른 경로로 재현).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:435`(non-terminal refresh 실패 → `"stale"` 반환), 호출부 `codebase/channel-web-chat/src/widget/use-widget.ts:665`+`682-683`+`699`(`start()`), `codebase/channel-web-chat/src/widget/use-widget.ts:1023`+`1032`+`1035`+`1051`(`applyConfig()`), 재시도 차단 `codebase/channel-web-chat/src/widget/use-widget.ts:651`, phase 정의 `codebase/channel-web-chat/src/lib/widget-state.ts:143`(`RESTORED`)·`146`(`BOOTED`), `scheduleRefresh` 계약 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:57-58`
  - 상세:
    1. **(a) `"stale"` 을 받은 호출부가 건너뛰는 것 — `openStream()` 만이 아니다.** `start()`(683행)와 `applyConfig()`(1035행) 모두 `if (outcome !== "continue") return;` 한 줄로 이후 코드 전체를 스킵한다. 그 이후 코드에는 `openStream(...)` 뿐 아니라 **`scheduleRefresh()`**(699행/1051행)도 포함된다. `scheduleRefresh` 는 `use-token-refresh.ts:57-58` JSDoc 이 명시하듯 `"시작/세션복원 직후 1회 호출해 예약 개시"` 하는 **유일한 진입점**이다 — 자체적으로 재귀 재예약은 하지만(같은 파일 98행), 최초 1회는 반드시 `start()`/`applyConfig()` 가 걸어줘야 한다. `use-widget.ts` 전체에서 `scheduleRefresh(` 호출은 이 두 곳(699, 1051)뿐이다(grep 확인). 즉 `"stale"` 로 빠지면 이 세션에 대해 **주기 갱신 타이머가 그 프로세스 생애주기 동안 단 한 번도 걸리지 않는다**.
    2. **(b) 그 뒤 복구가 실제로 주기 갱신으로 이어지는가 — 이어지지 않는다.** 435행의 인라인 주석은 "다음 복구는 `use-token-refresh` 의 주기 갱신이 맡는다" 라고 적지만, 그 "주기 갱신" 은 (1)의 이유로 애초에 예약되지 않았으므로 물려받을 사이클 자체가 없다. 이 주석은 검증되지 않은(그리고 틀린) 전제를 코드에 남긴다.
    3. **user-visible 귀결**: `start()`(665행) 는 `seedWaitingFromStatus` 를 호출하기 **전에** 이미 `dispatch({ type: "BOOTED", ... })` 를 실행했고, `applyConfig()`(1023행) 도 `seedWaitingFromStatus` 호출 전에 이미 `dispatch({ type: "RESTORED", ... })` 를 실행했다. 두 액션 모두 `widget-state.ts:143`/`146` 에서 `phase: "streaming"` 으로 전이시킨다(리듀서 파일 2행 주석: `streaming` = "AI 응답 중" 표면). 따라서 `"stale"` 로 조기 return 하는 시점엔 이미 UI 는 `streaming` 스피너를 보여주고 있다. 그 뒤 SSE 도 없고(`openStream` 스킵) 주기 갱신도 없으므로(위 1), 이 phase 를 벗어나게 할 어떤 비동기 작업도 남지 않는다 — **영구 고착**이다.
    4. **자동 재시도 경로도 없다.** `start()` 상단(651행) 가드 `if (startedRef.current || sessionRef.current) return;` 는 `startedRef.current`(652행에서 `true`) 와 `sessionRef.current`(이 분기에서 세션이 보존됨, 435행 위 주석 "세션은 보존") 가 둘 다 살아있으므로, 패널을 닫았다 다시 열어(`open()` → `void start()`, 806-810행) 재시도해도 `start()` 는 즉시 no-op 이다. `applyConfig()` 도 같은 이유(1022행 `startedRef.current = true`)로 재부팅 재전송이 재시도로 이어지지 않는다. 복구하려면 사용자가 `newChat()`(대화 전체 리셋, 파괴적) 을 트리거하거나 페이지/iframe 을 새로고침해야 한다.
    5. **왜 이런 일이 생겼는가 — `"stale"` 의미의 오버로드.** `SeedOutcome.stale` 은 원래 "다른(더 최신) 시도가 이미 세계를 넘겨받았다 — 그 다른 시도가 계속 진행을 책임진다" 는 뜻으로 설계됐다(파일 상단 JSDoc `90행`: `"await 사이 세션이 교체·초기화됨 → 응답을 폐기함(아무 상태도 안 건드림)"`). 그 의미에서는 "내가 멈춰도 안전하다" 가 참인데, 그건 **누군가 다른 소유자가 이미 SSE/주기 갱신을 돌리고 있기 때문**이다. 그런데 435행의 새 사용처는 다른 소유자가 전혀 없는 **같은 시도, 같은 세대**에서 "이번 왕복만 포기하고 나중에 재시도하라" 는 의도로 `"stale"` 을 재사용했다 — 그 "나중"을 실제로 스케줄링해 줄 코드가 없다. `"ended"` 로 잘못 닫으면 살아있는 대화를 잃는다는 판단(그 자체는 옳다)이 앞선 CRITICAL(16_42_07)에서 이미 있었지만, `"stale"`/`"ended"` 두 값 중 하나를 고르는 이분법 자체가 이 경우("종료도 아니고, 다른 소유자도 없고, 그냥 재시도가 필요")를 표현할 수 없다.
  - 근거(테스트로도 이 갭이 드러난다): `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:448-485`("§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다") 는 `phase !== "ended"`·`getEs() === null`·storage 보존만 단언한다. **`phase === "streaming"`(스피너 고착 상태)로 실제로 멈췄는지, `scheduleRefresh` 가 걸렸는지는 어느 쪽도 단언하지 않는다** — 그래서 이 회귀는 "죽은 토큰으로 SSE 를 열지 않는다"는 원래 CRITICAL 은 잡지만, 그 수정이 만든 새 고착은 통과시킨다.
  - 제안: `"stale"` 을 "다른 소유자에게 이미 넘어감(그 소유자가 계속함)"과 "같은 시도가 포기했지만 재시도가 필요함"으로 분리한다 — 예를 들어 `recoverFromExpiredToken` 의 non-terminal 분기에서만은 반환 전에 직접 `scheduleRefresh()`(또는 그에 준하는 재시도 타이머)를 걸어주거나, `SeedOutcome` 에 세 번째 갈래(예: `"retry-later"`)를 추가해 호출부가 "openStream 은 스킵하되 scheduleRefresh 는 반드시 건다"로 분기하게 한다. 최소한 435행 주석의 "다음 복구는 주기 갱신이 맡는다"는 주장을 실제로 참으로 만들거나(코드 변경) 문구를 정정해야 한다. 회귀 테스트도 `phase`(streaming 에 갇혔는지)와 `scheduleRefresh` 가 실제로 걸렸는지(예: `vi.useFakeTimers()` 로 예약된 타이머 존재 확인)를 단언하도록 보강 필요.

## 그 외 축 확인 (요청 3항목)

- **전역 상태/전역 변수**: 신규 코드 없음. `applyRefreshedToken`(session-store.ts)·`recoverFromExpiredToken`(use-widget.ts)은 모두 인자로 받은 ref/세션만 변경하고 모듈 스코프 상태를 만들지 않는다.
- **파일시스템**: 해당 없음 — `saveSession`/`sessionStorage` 만 기존 경로 그대로 사용(신규 저장 위치 없음).
- **시그니처/인터페이스 변경**: `applyRefreshedToken(session, refreshed, triggerEndpointPath): PersistedSession` 신규 export — 외부(호스트 SDK 등) 공개 API 가 아니라 위젯 내부 모듈 간 헬퍼라 기존 사용자 영향 없음. `use-widget.ts` 의 import 만 `saveSession` → `applyRefreshedToken` 로 바뀌었고 훅 자체의 공개 반환 형태(`open`/`close`/`submitMessage` 등)는 불변.
- **환경 변수·네트워크 호출**: 신규 없음. `refreshToken` 호출 자체는 기존 §R4 설계(1회 제한)를 그대로 따른다 — 이번 diff 가 새로 여는 네트워크 표면 없음.
- **이벤트/콜백**: 위 CRITICAL 이 바로 이 축이다 — `"stale"` 반환이 `scheduleRefresh()` 콜백 등록 자체를 건너뛰게 만드는 것이 이번에 새로 생긴 부작용.

## 요약

이번 라운드는 이전 CRITICAL("성공 시 갱신 전 토큰으로 SSE 재오픈")을 반환값 `"continue"` → `"stale"` 로 닫았지만, 그 수정 자체가 새로운 부작용을 만들었다. `"stale"` 을 받은 두 호출부(`start()`/`applyConfig()`)는 `openStream()` 뿐 아니라 세션의 유일한 주기 토큰 갱신 예약 지점인 `scheduleRefresh()` 까지 함께 건너뛴다. `scheduleRefresh` 는 자기 자신을 재귀 재예약할 뿐 최초 1회는 반드시 이 두 호출부가 걸어줘야 하므로, 이 경로로 빠진 세션은 프로세스 생애주기 동안 주기 갱신을 단 한 번도 받지 못한다. 게다가 `BOOTED`/`RESTORED` dispatch 가 `seedWaitingFromStatus` 호출보다 먼저 일어나 phase 는 이미 `streaming`(스피너) 으로 전이돼 있고, `startedRef`/`sessionRef` 가드 때문에 패널을 재open 해도 `start()` 가 재시도되지 않는다 — 결과적으로 이 PR 시리즈 전체가 없애려던 "streaming 고착" 증상이, "죽은 토큰으로 SSE 를 여는" 경로 대신 "SSE 도 갱신 타이머도 아무것도 걸리지 않는" 경로로 재현된다. 435행의 "다음 복구는 주기 갱신이 맡는다"는 주석은 검증되지 않았고 실제로는 거짓이다. 신규 회귀 테스트는 `phase !== "ended"` 와 SSE 미생성만 확인해 이 고착 자체는 잡지 못한다.

## 위험도

CRITICAL
