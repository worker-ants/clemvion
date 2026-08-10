# Maintainability Review — `18_23_54`

이번 라운드는 명시적 요청 하나를 받았다: 직전 라운드(`17_55_57`)의 내 WARNING —
"`scheduleRefresh(retryDelay?: number)` 가 훅의 공개 반환값에 그대로 노출돼, 내부 전용
파라미터를 외부 호출부가 오용할 수 있는 여지를 타입 레벨에서 막지 못한다" — 에 대해 이번
diff 가 내 자신이 제안한 형태(내부 `scheduleWithDelay(retryDelay?)` + 무인자 공개 래퍼)로
반영했는지 (a) 타입 레벨 차단 (b) `useCallback` 체인의 stable identity 유지 (c) 이름 두 개가
새 혼란인지 세 축으로 판정하는 것. `codebase/channel-web-chat/src/widget/use-token-refresh.ts`·
`use-widget.ts`·`use-token-refresh.test.ts`·`use-widget-eager-start.test.ts`·
`session-store.ts`·`eia-client.ts` 를 직접 열어 대조했다. 나머지 diff(대다수는
`review/code/**` 산출물·plan 문서)는 애플리케이션 코드 체크리스트가 적용되지 않는다.

## 발견사항

- **[INFO]** 지시받은 판정: `scheduleWithDelay`/`scheduleRefresh` 분리는 (a)(b)(c) 모두 통과 —
  `17_55_57` WARNING 이 실제로 해소됐다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:122-127`(분리 근거 주석),
    `:128`(`const scheduleWithDelay = useCallback(function scheduleWithDelay(retryDelay?: number): void {`),
    `:192`(deps `[clearRefreshTimer, sessionRef, clientRef, configRef, worldGenRef]`),
    `:198`(`const scheduleRefresh = useCallback(() => scheduleWithDelay(), [scheduleWithDelay]);`),
    `:204`(`return { scheduleRefresh, clearRefreshTimer };`). 소비부:
    `codebase/channel-web-chat/src/widget/use-widget.ts:271`(구조분해, 타입 주석 없음 — 추론 그대로 물려받음).
  - 상세:
    - **(a) 타입 레벨 차단 — 참.** `scheduleWithDelay` 는 `export` 목록(`grep '^export'` 결과
      `TOKEN_REFRESH_*` 상수·`retryDelayMs`·`refreshDelayMs`·`useTokenRefresh` 뿐)에 없어 모듈
      바깥에서 **참조 자체가 불가능**하다. 훅이 실제로 반환하는 `scheduleRefresh` 는
      `() => scheduleWithDelay()` 라는 무인자 화살표 리터럴이라 추론 타입이 `() => void` 로
      **좁혀진다** — `use-widget.ts:271` 이 타입 주석 없이 그 추론을 그대로 물려받으므로
      `scheduleRefresh(1000)` 같은 외부 호출은 컴파일 에러(`Expected 0 arguments, but got 1`)가
      된다. 이전 WARNING이 지적한 "`failuresRef` 리셋 규약이 `retryDelay===undefined` 라는
      암묵적 계약에 기대고, 시그니처가 그걸 광고해 다음 사람이 `scheduleRefresh(0)` 을 자연스럽게
      시도할 위험" 은 이제 **컴파일러가 원천 차단**한다. 실사용 소비부(`use-widget.ts:850`,
      `:1213`)와 테스트(`use-token-refresh.test.ts` 13곳 전부)도 전부 무인자 호출로 일치한다.
    - **(b) `useCallback` 체인 stable identity — 유지.** `scheduleWithDelay` 의 deps 5개
      (`clearRefreshTimer`·`sessionRef`·`clientRef`·`configRef`·`worldGenRef`) 는 전부 렌더
      전반에 걸쳐 참조가 바뀌지 않는다 — `clearRefreshTimer` 는 `useTokenRefresh` 자체 안에서
      `useCallback(..., [])`(`:115-120`, 빈 deps)로 영구 고정이고, 나머지 4개는 훅 밖
      `useWidget` 에서 각각 `useRef`(`clientRef`·`sessionRef`·`configRef`: `use-widget.ts:190-193`)
      /`useSessionGenerations()`(`worldGenRef`: `use-session-generations.ts:62` 도 `useRef(0)`) 로
      만들어진 ref 객체라 React 계약상 컴포넌트 생명주기 동안 동일 정체성이다. 따라서
      `scheduleWithDelay` 는 실제로 재생성되지 않고, `scheduleRefresh` 의 유일한 dep
      (`[scheduleWithDelay]`)도 안정적이라 `scheduleRefresh` 자신도 재생성되지 않는다.
      `use-widget.ts:271` 의 소비 측 `useCallback` deps 배열(`:860`, `[openStream, persist,
      seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]`)이 전제하는 "stable
      identity" 계약이 실제로 성립한다 — JSDoc(`:93` "scheduleRefresh — ... (stable)")의 주장이
      과장이 아니다.
    - **(c) 이름 두 개가 혼란인가 — 아니다(경미한 개선 여지만).** `scheduleWithDelay` 는
      `export` 되지 않아 이 100줄짜리 훅 파일 밖의 어떤 독자도 이 두 이름의 구분을 신경 쓸
      필요가 없다 — 노출 표면은 여전히 `scheduleRefresh` 하나뿐이다. 파일 내부 독자에게도
      `:122-127` 의 주석이 "왜 두 함수인가"(공개 계약에서 인자를 지우기 위해)를 즉시 설명하고,
      함수 표현식 이름(`function scheduleWithDelay(...)`)을 재귀 자기호출에 쓴 이유까지
      명시한다. 다만 이름 자체의 정확도엔 사소한 개선 여지가 있다 —
      `scheduleWithDelay` 는 "지연을 받는다" 는 파라미터 형태를 가리키는 이름인데, 실제로 이
      함수는 백오프 재귀·성공/실패 분기·`onRefreshed` 통지까지 겸하는 **재예약 엔진 전체**다.
      공개 래퍼도 결국 내부적으로 지연을 계산하므로("with delay" 라는 이름이 두 함수를 가르는
      축과 정확히 대응하지 않는다) `armRefreshTimer`/`scheduleRefreshCore` 류의, "공개
      진입점이 아니다"를 더 직접 가리키는 이름이었다면 근접효과가 조금 더 컸을 것이다. 다만
      이는 순수 명명 취향 수준이고 캡슐화·주석이 이미 실질적 혼란을 제거했으므로 조치를
      요구하지 않는다.
  - 제안: 없음(확인 완료). 이번 판정으로 `17_55_57` WARNING 은 **닫힘**으로 기록해도 된다.

- **[WARNING]** `start()`/`applyConfig()` 두 호출부가 "seed 결과 → `live` 세션 재확인 →
  `deferredStreamRef` 세팅 → 조건부 `openStream` → `scheduleRefresh`" 꼬리 블록을 거의
  그대로 복제하고 있다 — `shouldAbortAfterSeed` 로 "중단 여부" 축은 이미 헬퍼화됐지만, 그
  **뒤**의 "무엇을 열고 무엇을 예약하는가" 축은 여전히 두 자리에 손으로 맞춰야 한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:823-849`(`start()`),
    `:1182-1213`(`applyConfig()` 복원 경로). 대응 라인: `live` 재확인
    (`:837` vs `:1204`), `deferredStreamRef.current` 세팅(`:842` vs `:1207`), 조건부
    `openStream`+가드 주석(`:843-848` vs `:1208-1212`), `scheduleRefresh()` 마무리 호출
    (`:849` 근접 vs `:1213`).
  - 상세: 이 파일의 이력상 정확히 이 종류의 "가드를 한쪽에만 적용" 이 이번 티켓에서만
    CRITICAL 을 2회 냈다(`SeedOutcome` JSDoc·`shouldAbortAfterSeed` JSDoc 이 스스로 그렇게
    적어 두었다 — `16_09_40`·`16_56_39`). `shouldAbortAfterSeed` 추출로 그 축의 재발은
    막혔지만, 남은 꼬리 블록(라이브 세션을 다시 읽고, 미룰지 결정하고, 열고, 예약하는 4단계)은
    여전히 리터럴 복제다. 두 호출부가 진짜로 동일하지는 않다 — `applyConfig` 쪽은
    `clientRef.current` null 가드로 seed 자체를 감싸고 `isAttemptStale` checkpoint 를 하나 더
    두며 `live` 폴백이 `saved` 로 다르다(`:1204` `sessionRef.current ?? saved` vs `:837`
    `sessionRef.current`) — 그래서 지난 라운드(`17_55_57` 이전 WARNING 들)가 "오케스트레이션
    통합은 하지 말라" 는 방향으로 이미 여러 번 결론 낸 것과 같은 종류의 비대칭이 실재한다.
    다만 통합이 아니라 **부분 추출**(예: "outcome + sessionRef 를 받아 `{ openNow: SessionRef
    } | "wait_for_refresh" | null` 을 반환하는 순수 함수" 하나로 `live` 계산 + defer 플래그
    결정만 뽑고, `isStale`/`isAttemptStale` checkpoint 와 `openStream` 호출 자체는 호출부에
    남기는 형태)는 실패 정책이 갈리지 않는 부분만 골라내므로 앞서 반려된 "오케스트레이션
    통합" 과는 다른 축이다.
  - 제안: 지금 당장 막을 CRITICAL 은 아니다(현재 코드는 두 자리 모두 정확하고, 상호
    참조 주석("`start()` 와 같은 이유로...")이 사실상 사람이 읽는 단일 진실 역할을 하고
    있다). 다만 `SeedOutcome` 에 다섯 번째 갈래가 추가되는 시점(`shouldAbortAfterSeed`
    JSDoc 자신이 "다섯 번째 갈래가 생겼을 때" 를 명시적으로 우려 지점으로 남겨 뒀다)에는
    이 꼬리 블록도 두 곳에서 함께 늘어나야 하므로, 그 작업을 시작하기 전에 위 부분 추출을
    한 번 검토할 것을 권장한다.

- **[INFO]** `session-store.applyRefreshedToken`·`eia-client.isTerminalAuthError` 두 신규
  공유 헬퍼는 "오케스트레이션은 합치지 않되 판정 로직/데이터 반영만 공유한다" 는 경계를
  정확히 지키고 있다 — 재확인.
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`,
    `codebase/channel-web-chat/src/lib/eia-client.ts:167-181`. 호출부:
    `use-token-refresh.ts:151-155`(`applyRefreshedToken`), `:183`(`isTerminalAuthError`),
    `use-widget.ts` `recoverFromExpiredToken` 내부 동일 함수 재사용.
  - 상세: 두 헬퍼 모두 실패 시 무엇을 할지(로그만 vs 세션 종료 확정, 재시도 vs 중단)는
    호출부에 남기고 "무엇이 참인가/무엇을 저장하는가" 라는 순수 판정·데이터 반영만 뽑았다.
    `err.status === 401`/`410` 리터럴 비교가 `isTerminalAuthError` 정의부 외에는 코드베이스
    어디에도 없다(재확인) — 매직 넘버가 한 곳에 모여 있다.
  - 제안: 없음 — 확인용.

- **[INFO]** 문서/plan 링크 정정(`CHANGELOG.md` 신규 항목, `plan/complete/*.md` ·
  `plan/in-progress/*.md` 상호 링크 3건, `spec/0-overview.md` 상태 갱신)은 코드가 아니라
  단순 상호참조 동기화라 가독성·네이밍·복잡도 체크리스트가 적용되지 않는다. `CHANGELOG.md`
  항목은 결정 배경(§R4 401 낙관적 refresh 근거, 왜 `"refresh_deferred"` 4번째 상태가
  필요했는지)을 코드 JSDoc 과 같은 수준의 밀도로 남겨 놓아 추후 독자가 코드만으로 재구성하기
  어려운 맥락을 보완한다.
  - 위치: `CHANGELOG.md`(신규 절), `plan/complete/web-chat-quality-backlog.md:26`,
    `plan/in-progress/webchat-command-failure-is-not-termination.md:35`,
    `plan/in-progress/webchat-usewidget-extraction.md:175`, `spec/0-overview.md`(6.1 표 행).
  - 제안: 없음.

- **[정보/범위 고지]** `review/code/2026/08/10/{16_09_40,16_26_09,16_42_07,16_56_39,
  17_15_33_2,17_25_34_2,17_55_57}/**` 의 `RESOLUTION.md`·`SUMMARY.md`·`meta.json`·
  checker 산출물들은 과거 라운드의 감사 기록(append-only 아카이브)이며, 애플리케이션 코드가
  아니라 유지보수성 체크리스트(함수 길이·중첩·네이밍 등)가 적용되지 않는다. 훑어본 결과
  이번 diff 가 그 기록들을 소급 수정하지 않고 있다는 점만 확인했다(각 세션 디렉터리는
  해당 라운드 시점의 스냅샷 그대로).

## 요약

지시받은 핵심 질문 — `scheduleWithDelay(retryDelay?)` + 무인자 `scheduleRefresh: () => void`
분리가 실제로 유효한가 — 은 세 축 모두 **참**이다. (a) `scheduleWithDelay` 가 `export` 되지
않고 공개 래퍼가 무인자 화살표로 재타입되어 `scheduleRefresh(N)` 은 컴파일 에러다(실사용·
테스트 전부 무인자 호출과 일치). (b) 두 `useCallback` 의 deps 는 훅 밖 `useRef` 기반 ref
5개 + 빈-deps `clearRefreshTimer` 로만 구성돼 있어 체인 전체가 실제로 재생성되지 않고,
`use-widget.ts` 소비 측 `useCallback` 이 전제하는 "stable identity" 계약이 성립한다.
(c) 이름 분리는 `export` 경계로 노출이 하나뿐이라 실질적 혼란을 만들지 않으며, 근접한
JSDoc 이 분리 이유를 즉시 설명한다 — 사소한 명명 정확도 개선 여지(“with delay”가 두
함수의 실제 구분축과 완전히 겹치진 않음)만 남는다. `17_55_57` WARNING 은 제안한 코드 형태
그대로 반영됐으므로 닫힘으로 처리해도 된다. 이번 라운드에서 새로 발견한 항목은 `start()`/
`applyConfig()` 꼬리 블록의 잔여 중복 하나뿐이며, 이 파일의 반복된 CRITICAL 이력(가드
비대칭)을 감안하면 지금 막을 정도는 아니어도 `SeedOutcome` 다섯 번째 갈래가 생기기 전에
부분 추출을 검토할 가치가 있다. 그 외 신규 공유 헬퍼(`applyRefreshedToken`·
`isTerminalAuthError`) 는 경계를 정확히 지키고 있고, 문서/링크 정정은 체크리스트 대상이
아니다.

## 위험도

LOW
