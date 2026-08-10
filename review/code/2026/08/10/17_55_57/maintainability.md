# Maintainability Review — `17_55_57`

이번 라운드는 두 가지를 확인하라는 명시적 요청을 받았다: (1) 직전 라운드(`17_25_34_2`) WARNING —
"`RESOLUTION.md` 가 뮤테이션 메모를 JSDoc 에 남겼다고 썼지만 실제로는 없었다" — 이 이번엔 실제로
반영됐는지, (2) `useTokenRefresh` 의 `scheduleRefresh(retryDelay?: number)` 선택 인자가 내부용인데
공개 반환값에 그대로 노출되는 결합이 함정인지 대안이 더 나쁜지 판정. 프롬프트의 diff 다수는
`review/code/**` 산출물·plan 문서라 애플리케이션 코드 체크리스트가 적용되지 않으므로, 실제 소스
(`use-widget.ts`·`use-token-refresh.ts`·`session-store.ts`·`eia-client.ts`)를 직접 열어 대조했다.

## 발견사항

- **[INFO]** 직전 WARNING(`17_25_34_2`)이 이번엔 실제로 해소됐다 — JSDoc에 뮤테이션 메모가 실존한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:125-128` (`shouldAbortAfterSeed` JSDoc 안,
    "**뮤테이션 메모**:" 단락)
  - 상세: 직전 라운드 WARNING은 `review/code/2026/08/10/17_15_33_2/RESOLUTION.md` 가 "생존이 정상임을
    JSDoc에 남겼다"고 주장했지만 실제 JSDoc에는 그 문구가 없었다는 지적이었다. 지금 `use-widget.ts`를
    직접 열어 확인한 결과, `shouldAbortAfterSeed` JSDoc(`:113-129`)에 "화이트리스트를 블랙리스트
    (`o === "ended" || o === "stale"`)로 바꾸는 뮤턴트는 생존이 정상이다 — 현재 union이 네 리터럴로
    닫혀 있어 두 식이 동치다. 이 함수의 값은 지금의 동치성이 아니라 다섯 번째 갈래가 생겼을 때 어느
    쪽으로 기우는가에 있다(ai-review `17_15_33_2` → `17_25_34_2` maintainability)"는 단락이 실제로
    존재한다. 산출물의 서술과 코드가 이제 일치한다 — "주장을 지운 것이 아니라 주장을 참으로 만들었다"
    (`17_25_34_2/RESOLUTION.md` §W2)는 자체 서술이 검증된다.
  - 제안: 없음 — 확인 완료.

- **[WARNING]** `scheduleRefresh(retryDelay?: number)` 가 훅의 공개 반환값에 그대로 노출돼, 내부 전용
  파라미터를 외부 호출부가 오용할 수 있는 여지를 타입 레벨에서 막지 못한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:124`(함수 시그니처),
    `:127`(`if (retryDelay === undefined) failuresRef.current = 0;`), `:104-108`(`failuresRef` 선언부
    주석 — 리셋 조건의 유일한 서술처), `:93`(`@returns` 문서 — 파라미터 언급 없음), `:171`(내부 재귀
    호출 `scheduleRefresh(retryDelayMs(failuresRef.current))`), `:180`(`return { scheduleRefresh,
    clearRefreshTimer };` — 별도 타입 좁힘 없이 그대로 반환)
  - 상세: `scheduleRefresh` 는 두 가지 역할을 겸한다 — (a) `start()`/`applyConfig()` 가 세션 확립 직후
    1회 부르는 **공개 진입점**(`use-widget.ts:839`, `:1202`, 둘 다 인자 없이 호출), (b) `setTimeout`
    콜백의 `.catch()` 가 지수 백오프 지연을 넘겨 스스로를 재호출하는 **내부 재귀**(`:171`). 두 역할이
    같은 함수 시그니처 `(retryDelay?: number) => void` 를 공유하고, 이 시그니처가 **타입 좁힘 없이**
    그대로 훅의 반환값(`:180`)이 되어 `use-widget.ts` 로 넘어간다 — 실제로 `use-widget.ts:271`의
    구조분해 할당(`const { scheduleRefresh, clearRefreshTimer } = useTokenRefresh({...})`)에도 명시적
    타입 주석이 없어 추론된 시그니처를 그대로 물려받는다. `failuresRef`(연속 실패 카운터, 백오프
    계산의 유일한 상태)의 리셋 여부는 `retryDelay === undefined` 라는 **암묵적 규약**으로 결정되는데,
    이 규약은 `failuresRef` 선언부 주석(`:104-108`)에만 적혀 있고 함수 자신의 JSDoc이나 `@returns`
    문서(`:93`, "scheduleRefresh — 시작/세션복원 직후 1회 호출해 예약 개시(stable)"만 서술)에는
    "인자를 넘기면 안 된다"는 경고가 없다. 현재는 `use-widget.ts`와 테스트(`use-token-refresh.test.ts`,
    11곳 전부 무인자 호출)가 전부 무인자로만 부르므로 **오늘 당장의 오용은 없다**. 그러나 타입
    시그니처 자체가 "이 함수는 지연(ms)을 받는다"고 광고하고 있어, 예컨대 향후 "지금 바로 갱신"
    기능을 추가하려는 다음 사람이 `scheduleRefresh(0)`을 외부에서 호출하는 것은 자연스러운 선택인데,
    그 경우 (1) `failuresRef` 리셋을 건너뛰어 진행 중이던 백오프 상태가 오염되고, (2) 정상 진입 경로가
    수행하는 `refreshDelayMs(session.expiresAt, ...)` 기반 만료 정렬을 우회해 임의 지연으로 타이머가
    재설정된다 — 컴파일러는 이를 전혀 막지 못한다.
  - 제안: 오케스트레이션을 합치라는 뜻이 아니다(그건 이미 `session-store.applyRefreshedToken` JSDoc이
    명시적으로 거절한 방향이고 타당하다 — 실패 정책이 정반대라 옵션 파라미터로 합치면 결합도만 는다).
    다만 **공개 표면과 내부 재귀를 가르는 것은 별도 문제이고, 이쪽은 의존성 주입 비용이 없다.**
    `useCallback` 으로 감싼 두 번째 얇은 wrapper 하나만 추가하면 된다:
    ```ts
    const scheduleRefresh = useCallback(function scheduleRefresh(retryDelay?: number): void {
      /* 기존 로직 그대로, 이름은 내부 전용으로 변경(예: armRefresh) */
    }, [clearRefreshTimer, sessionRef, clientRef, configRef, worldGenRef]);
    const scheduleRefreshPublic = useCallback(() => scheduleRefresh(), [scheduleRefresh]);
    return { scheduleRefresh: scheduleRefreshPublic, clearRefreshTimer };
    ```
    `scheduleRefresh`(내부 useCallback)는 이미 안정된 참조이므로 `scheduleRefreshPublic`의 deps도
    안정적이라 매 렌더 재생성되지 않고, `use-widget.ts` 쪽 `useCallback` deps 배열(`:849`)의 "stable
    identity" 전제도 그대로 유지된다. 외부에 노출되는 타입은 `() => void`로 좁혀져 `scheduleRefresh
    (1000)` 같은 외부 호출은 컴파일 에러가 된다. **이 대안은 `recoverFromExpiredToken`을 module-level
    로 뽑을 때 반증됐던 "의존성 넷을 주입해야 한다"는 비용과는 다른 축이다** — 여기서는 같은 훅
    클로저 안에서 얇은 래퍼 하나만 추가하는 것이라 새 의존성이 전혀 없다. 그런 의미에서 오케스트레이터가
    내린 "대안이 더 나쁘다"는 판단에는 **부분적으로만 동의한다**: "오케스트레이션 통합"이라는 큰
    대안은 확실히 더 나쁘지만, "공개/내부 시그니처 분리"라는 더 좁은 대안은 저비용이라 검토할 가치가
    있다. 다만 오늘 시점 실제 오용 사례가 전무하고(정적 타입 노출일 뿐 동작 결함은 아님) 다른 CRITICAL이
    없는 상태이므로 이번 라운드에서 반드시 막아야 할 정도는 아니라고 본다 — WARNING으로 남기되 다음에
    이 훅에 새 호출부가 생기는 시점에 함께 처리하는 것도 합리적 선택지다.

- **[INFO]** `session-store.ts`의 `applyRefreshedToken` 은 "무엇을 저장하는가"만 순수 함수로 뽑고
  "언제/어떻게 스케줄하는가"는 호출부 책임으로 명시한 경계가 정확히 지켜지고 있다.
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`
  - 상세: JSDoc이 스스로 "오케스트레이션은 합치면 안 된다"(`:114-116`)와 "세대 검사는 호출부
    책임"(`:123`)을 명시하고, 실제 두 호출부(`use-token-refresh.ts:146-151`, `use-widget.ts` 401 복구
    분기)가 각자 다른 실패 정책(fire-and-forget 재귀 vs await 후 종료 확정)을 그대로 유지한 채 이
    4줄만 공유한다. 위 `scheduleRefresh` 지적과 대비해 보면, 같은 파일군에서 "데이터 오케스트레이션은
    안 합친다"는 원칙은 잘 지켜졌고, 이번에 지적한 것은 그와 다른 축("공개 API 타입이 내부 파라미터를
    감추지 못한다")이라는 점을 분명히 해 둔다.
  - 제안: 없음 — 확인용.

- **[INFO]** `eia-client.ts`의 `isTerminalAuthError` 공유 술어는 매직 넘버(401/410)를 한 곳에 모으고
  두 호출부(재로드 복구·주기 갱신)가 실제로 그 함수를 통해서만 상태코드를 비교한다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:167-181`, 호출부
    `codebase/channel-web-chat/src/widget/use-widget.ts:528`(`recoverFromExpiredToken`), `use-token-refresh.ts:165`
  - 상세: 두 호출부 모두 `err.status === 401`/`410`을 직접 리터럴 비교하지 않고 `isTerminalAuthError`를
    통해서만 판정한다(`grep '=== 401\|=== 410'` 결과 이 두 리터럴은 `session_store`/`use-widget`의
    `404` 분기(별개 의미)와 `eia-client.ts` 함수 정의 내부에만 존재). "한쪽만 고치는 것이 이 브랜치의
    반복 결함"이라는 JSDoc의 문제의식이 실제 코드 구조로 지켜지고 있다.
  - 제안: 없음 — 확인용.

- **[INFO]** `plan/complete/web-chat-quality-backlog.md`·`webchat-command-failure-is-not-termination.md`·
  `webchat-usewidget-extraction.md`의 링크 정정(`../in-progress/webchat-reload-rest-error-branches.md`
  → `./webchat-reload-rest-error-branches.md` 또는 `../complete/...`)은 해당 plan이 `complete/`로
  이동한 사실을 정확히 반영한 단순 상호링크 동기화이며 코드 체크리스트 항목(가독성·네이밍·복잡도 등)이
  적용되지 않는다.
  - 위치: `plan/complete/web-chat-quality-backlog.md:26`, `plan/in-progress/webchat-command-failure-is-not-termination.md:35`,
    `plan/in-progress/webchat-usewidget-extraction.md:175`
  - 제안: 없음.

## 요약

핵심 두 질문 모두 확인했다. (1) 직전 라운드가 지적한 "RESOLUTION 서술과 실제 JSDoc 불일치"는 이번
라운드에서 실제로 해소됐다 — `shouldAbortAfterSeed` JSDoc에 뮤테이션 메모가 실존한다. (2)
`scheduleRefresh(retryDelay?: number)`가 공개 반환값에 그대로 노출되는 것은 오늘 시점 실제 오용
사례는 없지만(모든 외부 호출부·테스트가 무인자로만 호출) 타입 시그니처 자체가 내부 전용 파라미터를
광고하고 있고 `failuresRef` 리셋 조건이 그 파라미터의 `undefined` 여부에 암묵적으로 결합돼 있어,
다음 사람이 "지금 갱신" 류 기능을 이 시그니처를 보고 외부에서 인자를 넘겨 구현할 위험이 실재한다.
다만 이를 고치는 데 오케스트레이션 통합 같은 큰 비용이 드는 것은 아니다 — 같은 훅 클로저 안에서
얇은 공개 래퍼 하나만 추가하면 의존성 주입 없이 타입 레벨로 막을 수 있으므로, "대안이 더 나쁘다"는
전제에는 부분적으로만 동의한다(오케스트레이션 통합이라는 큰 대안은 나쁘지만, 공개/내부 시그니처
분리라는 좁은 대안은 저비용이다). CRITICAL은 없고, 다른 파일(`session-store.ts`·`eia-client.ts`)의
공유 헬퍼 경계는 의도대로 잘 지켜지고 있다.

## 위험도

LOW
