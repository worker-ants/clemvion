# 보안(Security) Review

리뷰 대상: `codebase/channel-web-chat/src/lib/widget-state.ts`(+test), `codebase/channel-web-chat/src/widget/use-token-refresh.ts`(+test),
`codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts`, `CHANGELOG.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`.
이 diff 는 직전 라운드(`review/code/2026/07/17/08_29_33`)의 CRITICAL#1(C1: 부팅 중 명령 → 위젯 영구 정지) 수정과, 그 리뷰에서 "잠재적"으로 분류됐던
W2(`seedWaitingFromStatus` catch 분기 세대 검사 누락)·W5(`useTokenRefresh`의 4번째 독립 `cancelledRef` 가드)가 **실제로 활성 버그**였음을 확인해 닫은
후속 라운드다. 나머지 파일(9~21번, `review/code/2026/07/17/08_29_33/*`)은 그 이전 라운드의 산출물(RESOLUTION/SUMMARY/개별 reviewer 리포트)이
새 파일로 커밋되는 것이라 순수 서술 문서이며, 시크릿·민감정보 포함 여부만 확인했다(문제 없음).

지시받은 3가지 검증 관점(a·b·c)에 대한 결론을 먼저 요약한다.

- **(b) `useTokenRefresh` 세대 검사가 옛 토큰의 storage 잔존·무효 토큰 스트림 오픈을 막는가** → **확인됨, 안전**. 아래 "검증 (b)" 참조.
- **(a) `teardownSession()`의 조기 return이 세션 정리·토큰 폐기를 건너뛰는가** → 그 순간의 **활성 상태**(스트림·타이머·서버측 execution)에 대해서는
  안전하다(아래 근거). 다만 **정리 대상이 "활성 상태"가 아니라 "sessionStorage 에 이미 남아있던 이전 세션"일 때는 건너뛴다** — 이것이 (c)와 직결된다.
- **(c) sessionStorage 부활 방지가 실제로 성립하는가** → **부분적으로만 성립한다.** W5(토큰 갱신 경로)·W2(seed 실패 경로)·ended-seed race(직접 원인)
  세 가지 구체적 경로는 이번 라운드에서 확실히 닫혔다. 그러나 **C1 fix 자체가 새로 연 좁은 창**이 하나 있다 — 아래 WARNING 항목 참조.

## 발견사항

- **[WARNING]** `teardownSession()` 의 부팅-전 조기 return이 "resetSession 중 sessionStorage 부활"이라는 좁지만 실재하는 창을 만든다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `teardownSession()`(L187-206, 조기 return 은 L198) ·
    `applyConfig()`(L683-723, 특히 `loadSession` 호출 L699 과 복원 블록 L700-722) · `bridge.onCommand` 의 `resetSession` 라우팅(L754-757,
    `apiRef.current.newChat()`) · `codebase/channel-web-chat/src/lib/session-store.ts` `loadSession`/`clearSession`(L45-75).
  - 상세:
    1. **재현 시나리오**: (i) `wc:boot` 수신 → `applyConfig()` 시작, `isEmbedAllowed()` 네트워크 왕복이 in-flight(embed-config 조회, 실패 시
       fail-open 이라도 응답까지 시간이 걸림). 이 시점 `configRef.current` 는 아직 `null`. (ii) 바로 이 순간 host 가 `wc:command
       {action:"resetSession"}` 을 보낸다(코드 주석 자신이 "라이브 미리보기 등 host 가 대화를 처음부터 다시 시작"이라는 실사용 트리거를
       명시) → `newChat()` → `resetSessionRefs()` → `teardownSession()`. `configRef.current` 가 `null` 이므로 L198 에서 **조기 return** —
       `worldGenRef.current++` 도, `clearSession()` 도 실행되지 않는다. (iii) 만약 이 브라우저 탭에 **이전에 저장된, 아직 만료되지 않은
       세션**이 `sessionStorage["clemvion-web-chat:session:<path>"]` 에 남아있었다면(예: 직전 위젯 인스턴스가 대화 중 SSE terminal 을
       기다리지 않고 페이지가 다시 로드된 경우, 또는 host SPA 가 위젯 iframe 을 리마운트하는 경우), 이 storage 항목은 **그대로 유지**된다.
       (iv) `isEmbedAllowed()` 가 resolve 되면(이 시점엔 `worldGenRef` 가 안 바뀌었으므로 `applyConfig` 는 stale 판정 없이 정상 진행 —
       이게 바로 C1 이 고친 부분이다) `configRef.current = cfg` 후 `loadSession(cfg.triggerEndpointPath)` 를 호출한다. `loadSession` 은
       **만료 여부만** 검사하므로(session-store.ts L56-60), 아직 유효한 이전 세션을 그대로 반환 → `sessionRef.current = saved`,
       `dispatch({type:"RESTORED"})`, 이어서 `seedWaitingFromStatus`+`openStream`+`scheduleRefresh` 로 **"새 대화"를 명령했던 host 의
       의도와 무관하게 이전 대화가 조용히 되살아난다**.
    2. **왜 (a)와 (c)가 여기서 만난다**: L198 의 조기 return 은 "그 순간의 **메모리상** 활성 세션·스트림·타이머"에 대해서는 안전하다 —
       `configRef.current` 가 아직 `null` 이라는 것은 `sessionRef.current`/`clientRef.current`/`streamRef.current` 도 전부 아직 `null` 이라는
       뜻이기 때문이다(`applyConfig` 가 `configRef.current` 를 세팅하기 **전**에는 이 값들을 만드는 다른 경로가 없다 — `start()` 도
       `if (!cfg || !client) return;` 로 동일하게 무력화됨을 확인). 즉 (a)의 "그 순간 정리해야 할 활성 리소스가 있는가"라는 질문에는
       "없다"가 맞다. 하지만 정리 대상이 **디스크(sessionStorage)에 이미 존재하는, 이 위젯 인스턴스가 아직 인지하지 못한 이전 세션**이라면
       얘기가 다르다 — 이 경로는 그 존재를 전혀 모른 채로 지나가고, 그 결과가 바로 (c)의 "storage 부활"이다.
    3. **C1 fix 자체가 구조적으로 이 창을 만들었다**: C1 이전(직전 라운드 코드)에는 `worldGenRef.current++` 가 `configRef.current` 상태와
       무관하게 무조건 실행됐다 — 그래서 `resetSession` 이 도착하면 `applyConfig` 가 진행 중이던 `gen` 을 무효화해 **`applyConfig` 자신이
       stale 판정으로 죽었다**(그게 C1 버그, 영구 hang). 이번 fix 는 정확히 그 gen 증가를 **생략**해서 `applyConfig` 가 살아남게 만들었는데,
       그 대가로 `applyConfig` 는 "부팅 중 reset 요청이 있었다"는 사실을 전달받을 방법이 없어졌다. 즉 "위젯이 멈추지 않게 하는 것"과
       "reset 의도를 지키는 것"이 이번 fix 방식(조기 return 하나로 3가지 부수효과를 통째로 스킵)에서는 서로 배타적이다.
    4. **테스트 커버리지 확인**: 신규 회귀 테스트 "C1: embed-config in-flight 중 host resetSession → config 확립"(`use-widget-eager-start.test.ts`
       L1954 이하)은 `beforeEach` 의 `window.sessionStorage.clear()`(L186) 로 인해 **매번 빈 storage 에서 시작**하며, 테스트 자신도
       `window.sessionStorage.setItem(...)` 을 호출하지 않는다 — 즉 "config 확립이 되는가"만 검증하고 "확립 시 **어떤** 세션으로
       확립되는가"(특히 이미 있던 이전 세션이 잘못 복원되지는 않는가)는 검증하지 않는다. `grep` 으로 확인한 결과 이 파일 전체에서
       "resetSession 도착 + 사전 seed 된 sessionStorage" 조합을 검증하는 테스트는 없다.
    5. **영향 범위**: sessionStorage 는 탭 단위라 임의의 제3자(외부 origin)가 원격으로 트리거할 수 있는 통로는 아니다 — `host-bridge.ts` 의
       `wc:command` 는 `e.source === win.parent` 를 요구하므로(아래 INFO 항목 참고) 실질적으로 "그 부모 프레임 자신"만 이 레이스를 만들 수
       있다. 따라서 전형적인 크로스오리진 공격 벡터는 아니다. 그러나 (i) `resetSession` 이라는 host API 가 존재한다는 사실 자체가 "완전히
       새로 시작"을 신뢰성 있게 보장해야 한다는 요구사항을 내포하고, (ii) 코드 주석이 명시한 "라이브 미리보기"처럼 **host 가 자동으로
       빠르게 boot→reset 을 반복하는 시나리오**에서 이 레이스가 드물지 않게 실제로 맞물릴 수 있으며, (iii) 위젯이 키오스크/공용 단말처럼
       "같은 탭을 여러 사용자가 이어 쓰며 매번 resetSession 으로 초기화"하는 배포 형태에 놓인다면, 사용자 B 가 "새 대화"를 시작했다고
       믿는 화면에 사용자 A 의 이전 대화 내용(PII 포함 가능)이 조용히 나타나는 세션 위생 문제로 번질 수 있다. 토큰 자체가 제3자에게
      유출되는 것은 아니므로 "탈취"는 아니지만, **"reset 의도가 조용히 무시되고 이전 세션이 부활한다"는 결과 자체는 이 diff 가 다른 세
       경로(W2·W5·ended-seed race)에서 힘써 닫으려 한 것과 동일한 위협 모델**이다.
  - 제안: `worldGenRef` 를 건드리지 않고(그러면 C1 이 재발한다) reset 의도만 별도로 기록하는 소형 플래그를 추가하는 방식을 권장한다. 예:
    ```ts
    const resetBeforePreflightRef = useRef(false);
    const teardownSession = useCallback(() => {
      if (!configRef.current) {
        resetBeforePreflightRef.current = true; // 부팅 완료 후 applyConfig 가 확인.
        return;
      }
      ...
    }, ...);
    ```
    그리고 `applyConfig()` 의 `loadSession` 직전에 `if (resetBeforePreflightRef.current) { resetBeforePreflightRef.current = false;
    clearSession(cfg.triggerEndpointPath); } else { const saved = loadSession(...); ... }` 형태로 분기해, 부팅 중 reset 이 있었으면
    복원 대신 항상 빈 상태로 시작하도록 만든다. 회귀 테스트는 기존 C1 테스트에 `window.sessionStorage.setItem(...)` 으로 유효한
    이전 세션을 미리 심어두고, `resetSession` 도착 후 config 확립 시 `result.current.state.phase` 가 `"streaming"`(복원됨)이 아니라
    `"panel"`/`"collapsed"` 이거나 최소한 이전 `executionId` 로 복원되지 않았음을 단언하는 변형을 추가하는 것으로 충분하다.

- **[INFO]** `host-bridge.ts` 의 `hostOrigin` 미확정 구간에서 `wc:command` 가 origin 검증 없이 처리됨 (본 diff 미포함 파일, 참고용)
  - 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts` L58 (`if (hostOrigin && e.origin !== hostOrigin) return;`) — 이 diff 가
    건드리지 않은 기존 파일.
  - 상세: `wc:boot` 를 아직 한 번도 받지 않아 `hostOrigin` 이 `null` 인 상태에서는 이 가드가 `false && ...` 로 항상 통과해, **origin 을
    검증하지 않고** `wc:command` 를 처리한다(즉 `resetSession` 도 이 시점에 도달 가능). 다만 `onMessage` 최상단의 `if (e.source && e.source
    !== parent) return;` (L47) 이 "실제 부모 window 프레임에서 온 메시지"만 통과시키므로, 이는 다른(별개) origin 의 임의 웹사이트가
    postMessage 로 스푸핑할 수 있는 취약점이 아니라 "부모 프레임 자신이 boot 보다 먼저/직후에 command 를 보내는" 정상 임베드 흐름의
    특성이다. 위 WARNING 항목의 재현 경로가 이 특성에 의존하므로 컨텍스트로 남긴다 — 이 파일 자체를 이번 diff 의 결함으로 취급하지는
    않았다(기존 동작, 범위 밖).
  - 제안: 조치 불요(이번 diff 범위 밖). 위 WARNING 을 고칠 때 "resetSession 이 boot 보다도 먼저 도착"하는 극단 케이스까지 함께
    고려하면 좋다(그 경우 `triggerEndpointPath` 자체를 모르므로 정리할 대상이 없어 현재도 안전하다 — 실제로 문제가 되는 것은 "boot 는
    받았지만 embed-config 왕복이 안 끝난" 구간뿐).

- **[INFO]** `widget-state.ts` 의 `ended` 최후 방어선이 `WAITING` 에만 있고 `AI_MESSAGE`/`execution.message` 에는 없음 (본 diff 밖 코드, 참고용)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `case "WAITING"`(L129-146, 가드는 L138) vs `case "AI_MESSAGE"`(L147-153).
  - 상세: 이번 diff 가 추가한 "종료된 대화는 입력 표면을 다시 열지 않는다" 가드는 `WAITING` 액션에만 적용된다. `execution.ai_message`/
    `execution.message` SSE 이벤트(`use-widget.ts` `handleEiaEvent`)는 `dispatch({type:"AI_MESSAGE", ...})` 를 여전히 무조건 실행하며,
    리듀서의 `AI_MESSAGE` 케이스도 `state.phase === "ended"` 를 검사하지 않는다 — 이론적으로는 종료 후 도착한 유령 assistant 메시지가
    `state.messages` 에 섞일 수 있는 동형(isomorphic) 경로다. 다만 실무적으로는 `teardownSession()`/`finalizeEnded()` 가 `closeStream()`
    을 먼저 호출하고, 실제 브라우저의 `EventSource.close()` 는 명세상 이후 이벤트를 발화하지 않으므로(테스트 더블 `ControllableEventSource
    .close()` 는 no-op 이라 이 불변식 자체를 단위테스트로 실증할 수는 없다) 실거래 위험은 낮다. 이 항목은 직전 라운드 concurrency 리뷰가
    이미 INFO 로 지적했던 것과 동일 지점이며, 이번 diff 가 새로 만든 것도, 이번 diff 가 다루기로 한 범위도 아니다.
  - 제안: 조치 불요(차단 사유 아님). `widgetReducer` 의 재활성화형 액션(`WAITING`/`AI_MESSAGE`/`BOOTED`/`RESTORED`) 전반에 동일한
    `ended` 가드를 일괄 적용하는 후속 정리를 검토할 가치는 있다(defense-in-depth 일관성).

## 검증 (b) — `useTokenRefresh` 세대 검사가 실제로 W5 를 닫는지 코드 추적

`use-token-refresh.ts` L60-110 을 직접 추적했다.

- `scheduleRefresh()` 의 `setTimeout` 콜백은 발화 시점에 `sessionRef`/`clientRef`/`configRef` 최신값을 다시 읽고(L81-84), **요청을 보내기
  직전에** `const gen = worldGenRef.current;` 를 캡처한다(L86) — "await 직전 캡처, await 후 재검증" 계약을 정확히 지킨다.
- `.then()` 성공 콜백은 `sessionRef.current`/`saveSession()` 을 건드리기 **전**에 `if (worldGenRef.current !== gen) return;` (L92) 로
  재검증한다.
- `teardownSession()`(`use-widget.ts` L202)은 `worldGenRef.current++` 를 **동기적으로**, `closeStream()`/`clearRefreshTimer()`/
  `clearSession()` 보다 먼저 실행한다. JS 단일 스레드 실행 모델상 `teardownSession()` 을 호출하는 핸들러(버튼 클릭·`wc:command`
  postMessage 핸들러 등)는 내부에 `await` 가 없어 완전히 동기적으로 끝까지 실행되므로, 이미 발사되어 응답을 기다리는 `refreshToken()`
  프로미스의 `.then()` 콜백(마이크로태스크)이 그 사이에 끼어들 수 없다 — 즉 gen 증가는 항상 그 시점 이후에 도착하는 모든 지연 응답보다
  **먼저** 관측된다.
- 이 early-return(`if (!configRef.current) return;`, L198)이 토큰 갱신 경로에 영향을 주는지도 확인했다: `scheduleRefresh()` 자체가
  `sessionRef.current` 가 없으면 즉시 return 하고(L76), `sessionRef.current` 는 `applyConfig`/`persist()` 를 거쳐야만(둘 다
  `configRef.current` 확립을 전제) 채워지므로, **토큰 갱신이 in-flight 인 상황 자체가 `configRef.current` 가 이미 non-null 인 상태에서만
  발생할 수 있다.** 그리고 RESOLUTION.md 가 명시하듯 `configRef.current` 는 한 번 세팅되면 코드베이스 전체에 재-null 대입 지점이
  없다(할당 2곳·해제 0곳). 따라서 "토큰 갱신 in-flight 중에 `teardownSession()` 의 조기 return 이 발동해 gen 증가를 건너뛰는" 조합은
  **도달 불가능**하다 — 토큰 갱신이 떠 있을 수 있는 시점에는 항상 `configRef.current` 가 non-null 이므로 L198 의 조기 return 이 아니라
  L202 의 정상 gen 증가 경로를 반드시 탄다.
- 신규 회귀 테스트 `use-token-refresh.test.ts` "W5: refresh in-flight 중 세대 변경(새 대화) → 지연 응답이 세션·storage 를 되살리지 않는다"
  (L105-130)는 위 트레이스와 정확히 일치하는 시나리오(요청 in-flight 중 `worldGenRef` 증가 + `sessionRef` 교체 + storage 삭제 → 지연
  응답 도착)를 모사하고, 새 세션 토큰 유지·storage 미부활 두 가지를 모두 단언한다. RESOLUTION.md 의 mutation 검증(gen 체크 제거 시
  11건 중 W5 1건만 실패)과 함께 이 fix 가 실제로 유효함을 뒷받침한다.

**결론(b)**: `useTokenRefresh` 의 세대 검사는 옛 세션 토큰이 storage 에 남거나(`saveSession` 스킵 확인) 무효 토큰으로 새 스트림을 여는
경로(애초에 이 훅은 스트림을 열지 않고 토큰만 갱신하므로 해당 없음, 스트림은 `use-widget.ts` 의 `openStream` 이 별도로 gen 가드됨)를
확실히 차단한다. 이 축에서는 추가 조치가 필요한 결함을 찾지 못했다.

## 카테고리별 확인 결과 (문제 없음)

- **인젝션**: 신규/변경 코드에 DOM 삽입·SQL·쉘 명령·경로 조합 없음. `wc:command` 의 `action` 필드는 `switch` 문 비교에만 쓰이고
  DOM/쿼리에 보간되지 않는다.
- **하드코딩된 시크릿**: 테스트 파일의 `"iext_x"`/`"iext_fresh"`/`"iext_stale"`/`"iext_prev"` 등은 이 파일 전역에서 기존부터 쓰이던
  목업 토큰 포맷이며 실제 시크릿이 아니다. `review/code/2026/07/17/08_29_33/*` 신규 파일들(리뷰 산출물)도 전수 grep 결과 API 키/
  비밀번호/Bearer 토큰/PEM 블록 패턴 없음.
  - `resolveRefresh?.({ token: "iext_stale", ... })` 등도 모두 동일한 목업 컨벤션.
- **인증/인가·세션 관리**: 위 WARNING 항목이 이 카테고리에 해당하는 유일한 발견이다. 그 외 `worldGenRef` 통합이 새로 닫은 W2(seed
  네트워크 실패 경로의 세대 검사 누락)·W5(토큰 갱신의 4번째 독립 가드)는 코드 추적으로 실제 수정을 확인했다(위 "검증 (b)" 및 WARNING
  항목 논의 참조).
- **입력 검증**: `safeApiBaseFromQuery()`(http(s) 스킴 화이트리스트) 등 기존 로직은 이번 diff 로 변경되지 않았다.
- **암호화/평문 전송**: 토큰 저장·전송 방식은 이번 diff 의 변경 범위 밖(무변경).
- **에러 처리**: 이번 diff 에서 신규로 추가된 `console.warn` 호출은 없다(주석만 갱신됨, 기존 `err.message`-only 로깅 패턴 유지).
  사용자 노출 문구는 여전히 `errMessage()` 의 generic 문자열로 고정된다.
- **의존성 보안**: 이번 diff 에 패키지/의존성 변경 없음.
- **plan/CHANGELOG 문서**: 서술 갱신이며 시크릿·민감정보 포함 없음. `CHANGELOG.md` 항목 5 의 "종료 세션 storage 부활 방지" 서술은
  W5·seed-terminal-race 두 경로에 한정해 정확하며, 위 WARNING 이 지적하는 새 경로(reset-during-boot)까지 포괄한다고 과장하지는
  않는다(문서 자체의 오류는 아님).

## 요약

이번 diff 는 직전 라운드에서 발견된 CRITICAL(부팅 중 명령으로 위젯 영구 정지)을 올바르게 수정했고, 그 과정에서 드러난 두 개의 동형
결함(W2: `seedWaitingFromStatus` 실패 경로가 세대 검사 없이 통과 → 스트림 탈취/storage 부활, W5: `useTokenRefresh`의 독립
`cancelledRef`가 `teardownSession()`을 못 잡음 → 토큰 갱신 응답이 옛 세션을 되살림)를 각각 근거 있는 재현·mutation 검증과 함께
확실히 닫았다. 지시받은 (b) `useTokenRefresh` 세대 검사는 코드 추적 결과 옛 토큰의 storage 잔존·스트림 오남용을 완전히 차단하는
것으로 확인됐다. 다만 (a)/(c)에 걸친 한 가지 미해결 지점을 발견했다 — C1 fix가 `teardownSession()`에 추가한 조기 return(`if
(!configRef.current) return;`)은 그 순간의 메모리상 활성 리소스에는 안전하지만, "부팅(embed-config 왕복) 중 host가 resetSession을
보낸 경우 sessionStorage에 이미 남아있던, 아직 만료되지 않은 이전 세션을 지우지 않는다"는 좁은 창을 새로 열었다. 이 창을 통해
`applyConfig()`가 boot 완료 후 그 이전 세션을 자신도 모르게 복원해, "새 대화"를 요청한 host/사용자의 의도와 달리 종료 의도가 없던
이전 대화가 조용히 이어지는 결과가 나올 수 있다 — 이는 이 diff가 다른 세 경로에서 힘써 막으려 한 것과 동일한 "세션 부활" 위협
모델이며, 현재 회귀 테스트로 커버되지 않는다. 외부 제3자가 원격으로 트리거할 수 있는 크로스오리진 공격은 아니지만(부모 프레임
자신만 이 레이스를 만들 수 있음), host의 자동화된 boot→reset 패턴(코드 주석이 언급하는 "라이브 미리보기")이나 탭을 재사용하는
공용 단말 배포에서는 실질적으로 도달 가능한 세션 위생 결함이다.

## 위험도

LOW
