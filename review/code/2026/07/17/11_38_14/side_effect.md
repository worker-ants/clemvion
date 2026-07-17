# Side Effect Review — 2026-07-17 11_38_14

대상: `codebase/channel-web-chat/src/{lib/widget-state.ts,lib/widget-state.test.ts,widget/use-widget.ts,widget/use-widget-eager-start.test.ts,widget/use-token-refresh.test.ts}` 외 `plan/`·`review/` 문서. 직전 라운드(`09_36_01`)가 지적한 gap 의 fix — `pendingResetRef` + `applyConfig` 의 `newChat()` 재생, `isStale(gen)` 추출 — 를 중점 검증했다.

## 발견사항

- **[WARNING]** `pendingResetRef` 플래그가 "이번 부팅 시도"에 스코프되지 않아, 관련 없는 **이후의** 부팅 시도에서 오발동(엉뚱한 리셋)할 수 있다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
    - set: `teardownSession()` 231-234행 — `if (!configRef.current) { pendingResetRef.current = true; return; }`
    - consume(유일한 소비 지점): `applyConfig()` 741-745행 — `if (pendingResetRef.current) { pendingResetRef.current = false; apiRef.current.newChat(); return; }`
    - 소비 없이 지나가는 조기 return: 720행 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` (이 체크는 `gen` 캡처보다도 앞이라 항상 첫 줄에서 걸린다), 727-730행 `if (!allowed) { dispatch({ type: "BLOCKED", ... }); return; }`
  - 상세: `pendingResetRef`는 `useRef`라 컴포넌트가 살아있는 한 값이 유지된다. `grep`으로 전수 확인한 결과 이 플래그를 다루는 코드는 정확히 이 4곳뿐이며, `BLOCKED`/`apiBase 누락` 조기 return 경로에는 플래그를 지우거나 소비하는 코드가 없다.
    현재 `configRef.current`는 "확립 후 null로 되돌아가지 않는다"(코드 자체 주석이 명시)는 불변식을 갖는데, 이는 **`applyConfig`가 이 컴포넌트 수명 동안 딱 한 번만 호출된다는 뜻이 아니다.** `bridge.onBoot`의 콜백 등록은 `destroy()` 전까지 살아있어(`host-bridge.ts` 51-56행, `bootCb`가 매 `wc:boot` 메시지마다 호출됨) host가 **동일 iframe을 재마운트하지 않고 `wc:boot`를 재전송**할 수 있고, 이는 spec에도 명문화돼 있다(`spec/7-channel-web-chat/2-sdk.md:106` "host 는 iframe 을 재생성하지 않고 wc:boot 을 다시 보내 boot config 를 갱신할 수 있다. 위젯은 마지막 wc:boot 의 config 를 적용"). 실제로 이 경로는 이론이 아니라 **이미 구현돼 있다** — `codebase/frontend/src/components/web-chat/live-preview.tsx`:
      - `postBoot()`(71-77행)이 `bootConfig`(draft 전체에서 파생, `useMemo`) 변경 시마다 재전송되고(117-119행 effect), iframe은 재마운트되지 않는다(주석 "외형 폼만 바뀌면 boot 재전송(재마운트 없음)").
      - "새 세션" 버튼(125-134행)은 `disabled={status !== "ready"}`인데, `status`는 위젯이 `wc:ready`를 보내는 즉시(iframe 로드 직후, `wc:boot`가 왕복하기도 전) `"ready"`가 된다(93-100행) — 즉 **config 확립 전에도 클릭 가능**하다.
      - 또한 `state.phase === "blocked"`는 `widget-app.tsx` 49행에서 렌더만 `null`로 만들 뿐 `useWidget()` 자체는 언마운트되지 않는다(18행) — `pendingResetRef`를 포함한 모든 ref가 BLOCKED 상태를 지나서도 그대로 산다.

      재현 시퀀스(코드 추적, 실행은 워크트리 위생상 생략):
      1. 관리자 미리보기 로드 → `wc:ready` → "새 세션" 버튼 활성화. 거의 동시에 첫 `wc:boot` 전송 → `applyConfig` 시작, `isEmbedAllowed()` 네트워크 왕복 in-flight(`configRef.current`는 아직 null).
      2. 이 창에서 관리자가 "새 세션" 클릭 → `teardownSession()`이 231행 분기를 타 `pendingResetRef.current = true`.
      3. `isEmbedAllowed()`가 `false`로 resolve(예: 관리자가 아직 allowlist에 미리보기 origin을 추가하지 않은 상태) → `BLOCKED` dispatch 후 return. `pendingResetRef.current`는 **여전히 true**로 남는다(이 경로엔 소비 코드가 없음).
      4. 관리자가 allowlist를 고치거나 다른 draft 필드(제목/환영문구 등)를 편집 → `bootConfig` 변경 → `postBoot()`가 **같은 iframe에 재전송**(재마운트 없음).
      5. 새 `applyConfig` 호출은 이번엔 `isEmbedAllowed()`가 `true`를 반환해 정상적으로 config를 확립하지만, 741행에서 **3단계 전에 남은 stale `pendingResetRef.current === true`**를 보고 오늘 이 boot과 무관하게 `newChat()`을 재생한다 — 이 시점에 `sessionStorage`에 방금 정상 복원됐어야 할 세션이 있었다면 조용히 폐기되고 새 대화가 강제로 시작된다.
    이는 이번 라운드 fix가 막으려던 바로 그 버그 유형("host 요청이 조용히 무시되거나, 반대로 관련 없는 boot이 조용히 리셋됨")이 **다른 경로로 재발**하는 사례다. 신규 회귀 테스트("저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다")는 리셋이 걸린 **바로 그 boot 시도가 곧바로 성공**하는 경로만 덮고, "리셋이 걸린 시도가 실패(BLOCKED/malformed)한 뒤 별개의 나중 boot이 성공"하는 경로는 덮지 않는다.
  - 영향 범위 참고: 이 정확한 조합(재전송되는 `wc:boot` + 언제든 누를 수 있는 `resetSession` 버튼)은 현재 코드상 **관리자 콘솔 라이브 미리보기**에서 가장 쉽게 닿는다. 공개 SDK(`packages/web-chat-sdk/src/index.ts` `boot()`)는 호출마다 새 iframe을 만들고 `resetSession`을 `ChatInstance`에 노출하지 않으므로, 표준 SDK를 쓰는 일반 host 임베드에서는 이 경로가 훨씬 드물다(원시 `wc:*` postMessage 프로토콜을 SDK 없이 직접 쓰는 host라면 여전히 가능). 임팩트도 "잘못된 새 대화 시작"으로 크래시·데이터 손상은 아니라서 CRITICAL까지는 아니라고 판단해 WARNING으로 분류했다.
  - 제안: `applyConfig`의 **모든** 조기 return 경로(BLOCKED 분기, 최소한 apiBase/triggerEndpointPath 누락 분기도 검토)에서 `pendingResetRef.current`를 함께 정리하거나, 플래그를 단순 boolean이 아니라 "이 플래그가 설정된 시점의 attempt/generation"과 함께 저장해 소비 시점에 "같은 attempt인지"를 비교하는 방식으로 스코프를 좁히는 것을 권장한다. 최소한 BLOCKED 분기에서는 `pendingResetRef.current = false`로 명시적으로 버리는 것만으로도 이번에 발견된 구체적 경로는 막힌다(그 이후의 "관련 없는" boot이 stale 리셋을 물려받지 않게).

- **[INFO]** (검증 완료, 이상 없음) `applyConfig` 안에서의 `apiRef.current.newChat()` 재진입은 `applyConfig` 자신의 나머지 흐름과 충돌하지 않는다
  - 위치: `use-widget.ts` 719-745행(`applyConfig`), 208-242행(`teardownSession`), 456-503행(`start`)
  - 상세: `newChat()`이 내부적으로 `teardownSession()`(gen +1, 이번엔 `configRef.current`가 이미 세팅돼 있으므로 정상 분기 — `clearSession` 포함)과 `start()`(gen +1 더, 이번 실행 고유의 `gen`을 로컬 변수로 캡처)를 호출해 `worldGenRef.current`를 총 2회 증가시키지만, `applyConfig`는 741행에서 `apiRef.current.newChat()`을 호출한 직후 **바로 `return`**하고 자신이 719-723행에서 캡처했던 `gen` 변수를 그 뒤로는 다시 참조하지 않는다 — 따라서 재진입이 만든 gen 증가가 `applyConfig` 쪽 흐름을 stale로 오판시키는 경로가 없다. `dispatch({type:"NEW_CHAT"})` → `dispatch({type:"START"})` 동기 배치 순서도, 사용자가 직접 헤더의 "새 대화"를 눌렀을 때의 정상 `newChat()` 호출과 정확히 동일한 시퀀스라 리듀서 레벨에서 새로운 비정상 중간 상태를 만들지 않는다(위젯-스테이트 리듀서 확인 완료 — `widget-state.ts`). `apiRef.current`는 최초 렌더에서 non-null 값으로 초기화되고(712행) `newChat`의 클로저는 오직 ref만 참조하므로(state 캡처 없음) "구식 렌더의 `apiRef.current.newChat`을 부른다"는 걱정도 실질적으로 발생하지 않는다.

- **[INFO]** (검증 완료, 이상 없음) `pendingResetRef` 소비 후 조기 return 이 건너뛰는 코드에 정말 필요한 처리는 없다
  - 위치: `use-widget.ts` 741-745행 이후 746-770행(`loadSession`/`RESTORED`/`seedWaitingFromStatus`/`openStream`/`scheduleRefresh` 블록) — `applyConfig` 함수 자체가 771행에서 끝나므로 이 블록이 건너뛰는 유일한 코드다.
  - 상세: 이 블록은 "옛 세션 복원" 경로인데, `newChat()`이 호출한 `teardownSession()`이 그 직전에 이미 `clearSession(cfg.triggerEndpointPath)`로 해당 storage 키를 지웠으므로 복원 시도는 애초에 무의미하다(주석이 명시한 의도와 일치). `startedRef.current`도 스킵된 복원분기 대신 `start()` 내부(461행)에서 동일하게 `true`로 세팅되므로 `open()`의 중복 시작 방지 불변식도 유지된다. 호스트로 나가는 `conversationStarted` 이벤트도 `start()` 성공 시 정상 발사된다.

- **[INFO]** 부팅 시점에 메모리로 로드된 적 없는(storage 전용) 옛 세션은 backend에 `cancel` 통지 없이 로컬에서만 폐기된다
  - 위치: `use-widget.ts` `newChat()` 626-640행(`prevSession = sessionRef.current`가 이 경로에서는 항상 `null`이라 `client.interact(..., {command:"cancel", ...})` 분기가 실행되지 않음)
  - 상세: `pendingResetRef` 재생 경로에서는 옛 세션이 `sessionRef`(메모리)에 로드된 적이 없으므로(복원 분기 자체를 건너뜀), `newChat()`의 best-effort cancel은 대상이 없어 스킵된다. 즉 `sessionStorage`에만 있던 옛 execution은 서버 측에서 명시적으로 취소되지 않고, EIA의 idle-wait backstop(`1-widget-app.md` §R9 참조, `EIA-RL-07`)에 의해서만 나중에 회수된다. 이는 새 문제가 아니라 "탭을 그냥 닫아 세션이 방치되는" 기존 케이스와 동일한 성격이라 회귀는 아니지만, 이번에 새로 도달 가능해진 경로이므로 side-effect 관점에서 기록해 둔다. 조치 불필요 판단.

## `isStale(gen)` 추출 검증

`grep -n "worldGenRef.current"`로 전수 확인한 결과, 파일 내 남은 직접 참조는 (1) `isStale` 자신의 구현(196행, `worldGenRef.current !== gen`) (2) 증가(invalidation) 지점 3곳(238행 `teardownSession`, 465행 `start`, 826행 unmount cleanup) (3) `gen` 캡처 지점 3곳(373·510·723행)뿐이다. 재검증(guard) 용도의 `worldGenRef.current !== gen` 비교는 8곳 전부(`seedWaitingFromStatus` try/catch 각 1, `start` 3곳, `sendCommand` 1곳, `applyConfig` 2곳) `isStale(gen)`로 1:1 치환됐고 의미가 바뀐 곳은 없다 — `isStale`의 정의 자체가 원래 비교식과 완전히 동일하다. `isStale`은 `useCallback(..., [])`로 오직 `useRef`(deps 면제 대상)만 참조해 컴포넌트 수명 내내 참조가 고정되므로, 이를 호출하는 `seedWaitingFromStatus`/`start`/`sendCommand`의 deps 배열에 `isStale`이 새로 추가된 것도(424·503·529행) 메모이제이션 안정성에 영향이 없다. 가드가 조용히 약해진 곳은 발견하지 못했다 — 순수한 동작 보존 리팩터로 판단한다.

## 기타 확인

- 테스트 파일들(`widget-state.test.ts`, `use-token-refresh.test.ts`, `use-widget-eager-start.test.ts`)의 신규/변경분은 전역 상태(전역 `fetch`/`EventSource` stub, `sessionStorage`)를 `beforeEach`/`afterEach`에서 정상적으로 격리·복원한다(`vi.unstubAllGlobals()`, `vi.restoreAllMocks()`, `sessionStorage.clear()`) — 테스트 간 누수 없음.
- `use-token-refresh.test.ts`의 `await Promise.resolve()` → `await vi.advanceTimersByTimeAsync(0)` 치환은 테스트 전용이며(`use-token-refresh.ts` 구현 자체는 이 diff에 없음) 파일 내 다른 테스트와 동일한 fake-timer 관례를 따른다 — 프로덕션 부작용 없음.
- `plan/in-progress/*.md`, `review/code/2026/07/17/{08_29_33,09_36_01}/*` 변경은 문서/기록 갱신뿐이며 코드 실행 경로에 영향 없음.
- 함수 시그니처·공개 인터페이스(`useWidget()`의 반환 shape, exported 함수들) 변경 없음. 새 전역 변수·환경 변수 읽기/쓰기·예상치 못한 파일시스템 접근·의도치 않은 네트워크 호출은 발견되지 않았다(단, 위 WARNING 경로에서 발생하는 "의도치 않은 `newChat()` 재생"은 결과적으로 의도치 않은 webhook POST 를 유발한다는 점에서 §7 네트워크 호출 관점과도 겹친다).

## 요약

이번 델타의 핵심인 `isStale(gen)` 추출은 검증 결과 순수한 동작 보존 리팩터로, 재검증 지점 8곳 전부가 1:1로 치환됐고 가드가 약해진 곳은 없다. `pendingResetRef` + `applyConfig`의 `newChat()` 재생 메커니즘도 요청받은 재진입 안전성(항목 a)과 조기 return 누락 여부(항목 c) 자체는 문제없이 확인됐으나, 플래그 소비가 `applyConfig`의 **성공 경로 한 곳에만** 배선돼 있고 `BLOCKED`/설정 누락 조기 return 에는 소비·정리 로직이 없다는 구조적 gap을 새로 발견했다(항목 b) — `wc:boot` 재전송이 spec에 명문화돼 있고 실제로 관리자 콘솔 라이브 미리보기(`live-preview.tsx`)가 재마운트 없이 이를 구현하고 있어, 리셋이 걸린 boot 시도가 실패한 뒤 무관한 나중 boot이 그 stale 플래그를 물려받아 정상 세션을 조용히 폐기할 수 있는 경로가 코드로 확인된다. 이번 라운드가 고치려던 "리셋 요청이 조용히 무시됨" 버그의 형제격인 "무관한 boot이 조용히 리셋됨" 버그가 좁은 조건 하에 남아 있다고 판단한다.

## 위험도

MEDIUM
