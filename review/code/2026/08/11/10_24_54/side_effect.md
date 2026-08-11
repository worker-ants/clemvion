# 부작용(Side Effect) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts` 외 (WARNING 2건 반영 라운드)

지시받은 두 관점 — (a) `runApplyConfig` catch 의 stale 가드 유무, (b) `sseErrorDetail` 의
`target.readyState` 접근 안전성 — 을 실제 소스(`Read`)로 대조해 검증했다.

## 발견사항

- **[WARNING]** `runApplyConfig` 의 catch 는 `start()`/`sendCommand` 와 달리 **시도(attempt) 유효성
  가드 없이 무조건 `ERROR` 를 dispatch** 한다 — 자매 가드 비대칭
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1262-1274` (`runApplyConfig`),
    비교 대상 `codebase/channel-web-chat/src/widget/use-widget.ts:884-892` (`start()` 의 catch,
    `if (isStale(gen)) return;` 먼저 검사) 및 `:906` (`sendCommand` 의 `if (isStale(gen)) return;`)
  - 상세:
    ```ts
    const runApplyConfig = (cfg: BootMessage) => {
      void applyConfig(cfg).catch((e: unknown) => {
        dispatch({ type: "ERROR", message: errMessage(e) });
      });
    };
    ```
    `start()`/`sendCommand` 는 catch 진입 시 가장 먼저 `if (isStale(gen)) return;` 로 "이 시도가
    아직 유효한가" 를 재검증한 뒤에만 `ERROR` 를 낸다(각각 대체된 옛 시도의 지연 실패가 살아있는
    새 세션을 덮지 못하게 하는 목적 — 주석에 "옛 실패로 최신 상태를 덮지 않는다" 로 명시). 반면
    `runApplyConfig` 의 `.catch()` 는 `attempt`(`beginBootAttempt()` 가 발급한 `{world, boot}`
    토큰) 자체를 클로저에 갖고 있지 않다 — `attempt` 는 `applyConfig` 함수 스코프 안에서만
    존재하고 `runApplyConfig` 로 새어 나오지 않는다. 그 결과 `cannotApplyConfig(attempt)` /
    `isAttemptStale(attempt)` (`use-session-generations.ts:143-153`) 를 여기서 물을 방법이
    구조적으로 없다.

    **오늘 당장 관측 가능한 회귀인지 실측**: `applyConfig` 내부의 `await` 지점들을 추적하면 —
    (1) `isEmbedAllowed`(`:56-66`) 는 내부 `fetchEmbedConfig` 가 전체를 try/catch 로 감싸 항상
    fail-open 하므로 던지지 않는다, (2) `seedWaitingFromStatus`(`:678-...`) 도 전체가
    try/catch 이고 실패 갈래마다 `isStale`/`sessionEstablished()` 재검사 후 `SeedOutcome` 을
    **반환**하지 던지지 않는다, (3) 세션 복원 분기 안에서 유일하게 진짜로 던질 수 있는 자리는
    `openStream()` 내부 `client.openStream(...)`(EventSource 생성자 동기 throw, JSDoc 이 명시)
    인데 이 호출은 `isAttemptStale(attempt)` 체크포인트 2(`:1229`) **직후 동기 구간**(사이에
    `await` 없음)에서만 일어나므로, 그 시점에 그 attempt 는 이미 유효성이 확인된 뒤다. 즉
    **현재 코드로는 곧바로 재현되는 경로를 찾지 못했다** — 두 checkpoint(`:1180`, `:1229`)가
    현재의 모든 async 경계를 우연히 다 덮고 있다.

    그러나 이건 **`runApplyConfig`의 catch 가 스스로 보장하는 불변식이 아니라, `applyConfig`
    내부 모든 코드가 "체크포인트 뒤엔 동기 구간만 두거나 반드시 반환값으로 폐기한다" 는 규율을
    지킨 덕에 우연히 안전한 것**이다. 이 파일 자신의 JSDoc 이 반복해서 지적하는 바로 그 형태 —
    "가드를 한쪽에만 적용"·"비대칭 가드 누락으로 CRITICAL 을 여러 번 냈다"
    (`use-session-generations.ts:105-108`) — 가 이번엔 `start()`/`sendCommand` 는 명시적 가드로
    지키고 `runApplyConfig` 만 규율(암묵적 불변식)로 지키는 형태로 재발했다. `applyConfig` 에
    체크포인트 2 이후 `await` 이 하나라도 새로 들어가면(흔한 후속 편집 — 예: `scheduleRefresh()`
    가 언젠가 async 가 되거나, 꼬리 블록에 로깅/텔레메트리 await 이 추가되는 식) 그 즉시 이
    catch 는 대체된 옛 attempt 의 실패로 살아있는 새 attempt 의 화면을 `phase: "ended"` 로
    덮는 CRITICAL 급 회귀를 조용히 재도입한다 — `dispatch({type:"ERROR"})` 는
    `widget-state.ts:190-191` 에서 `phase: "ended"` 로 매핑되므로, 실제 SSE·세션은 멀쩡한데
    화면만 종료로 꺼지는 형태다.

    **테스트 비대칭도 같은 결을 보인다**: `start()` 의 stale-catch 는 전용 회귀
    (`use-widget-eager-start.test.ts:1761` `"booting 중 종료 후 옛 webhook 이 뒤늦게 실패(reject)해도
    stale start catch 가 상태를 덮지 않음"`)로 고정돼 있지만, `runApplyConfig`(`applyConfig`)
    의 catch 에는 대응하는 "대체된 attempt 의 지연 실패가 최신 상태를 덮지 않는다" 테스트가
    없다 — 있는 것은 "복원 경로의 스트림 오픈 실패 — 토큰 미노출 + ERROR 전이"
    (`:768`)뿐인데, 이건 attempt 가 대체되지 않은 **정상(비경합) 실패** 케이스라 이 가드 공백을
    겨냥하지 못한다.
  - 제안: 방어는 규율이 아니라 구조여야 한다는 이 파일의 원칙(§harness 교훈과도 일치)을 따라,
    `runApplyConfig` 의 catch 에도 명시적 가드를 두는 편이 안전하다 — 예컨대 (1) `applyConfig`
    가 자신의 `attempt` 를 캡처한 지역 catch 를 두어 `if (cannotApplyConfig(attempt)) return;`
    후에만 `ERROR` 를 dispatch 하도록 옮기거나, (2) `beginBootAttempt()` 를 `runApplyConfig`
    스코프로 끌어올려 `applyConfig(cfg, attempt)` 형태로 주입하고 바깥 `.catch()` 에서
    `cannotApplyConfig(attempt)` 를 재검사한다. 최소한, 이 불변식이 "우연"이 아니라 "의도"임을
    밝히는 주석과 함께 §회귀 테스트(경합 중 지연 실패가 최신 상태를 안 덮는다)를 하나 추가해
    두면 향후 편집이 조용히 깨는 것을 막을 수 있다.

- **[INFO]** `sseErrorDetail` 의 `target.readyState` 접근은 방어적으로 작성돼 있어 던지거나
  크래시할 여지를 찾지 못했다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:470-477`
  - 상세: `e && typeof e === "object"` 로 먼저 `e` 를 걸러 falsy(`e=null`/`undefined` 등)를
    배제하고, `target && typeof target === "object" && "readyState" in target` 로 다시
    `target` 이 falsy(특히 `typeof null === "object"` 함정을 `target &&` 로 선차단)이거나
    non-object 인 경우를 걸러낸 뒤에만 `in` 연산자를 쓴다 — `in` 은 좌항이 object 가 아니면
    TypeError 를 던지는데 그 경로가 이미 막혀 있다. `String(readyState)` 도 어떤 값(숫자·
    문자열·객체 등)이 와도 던지지 않는다. 유일한 관측 가능한 사소한 결은 `readyState` 프로퍼티가
    **존재하되 값이 `undefined`** 인 인위적 케이스에서 `readyState === null` 이 `false` 라
    `"error (readyState=undefined)"` 로 찍히는 것인데(원래 의도한 "정보 없음→`\"error\"`" 문구
    대신), 이는 `console.warn` 진단 문구의 표현 품질 문제일 뿐 부작용·크래시가 아니다. 브라우저
    네이티브 `EventSource` 가 실제로 넘기는 `e.target` 은 항상 `EventSource` 인스턴스이고
    `readyState` 는 항상 숫자 getter라 이 결은 실질적으로 도달하지 않는다.
  - 제안: 없음(참고용) — 결함 아님.

## 요약

지시받은 두 관점 중 (b)(`sseErrorDetail`)는 방어적으로 잘 작성돼 실질적 위험이 없다. (a)는
이 브랜치가 반복해 낸 "자매 가드 비대칭" 패턴이 형태를 바꿔 재발한 것이 맞다 — `runApplyConfig`
의 catch 는 `start()`/`sendCommand` 와 달리 시도(attempt) 유효성을 명시적으로 재검증하지 않고
무조건 `ERROR` 를 dispatch 해, 대체된(stale) 부팅 시도의 지연 실패가 이미 성공한 최신 시도의
살아있는 UI 상태(`phase`)를 덮어쓸 수 있는 **구조적** 여지를 남긴다. 다만 현재 `applyConfig`
내부의 모든 `await` 지점이 우연히 체크포인트로 잘 감싸져 있어 지금 이 순간 재현 가능한 경로는
찾지 못했다 — 위험은 "지금 터진다"가 아니라 "다음 편집이 조용히 재도입한다"는 잠재적 회귀이며,
그 우연한 안전성이 명시적 가드도 회귀 테스트도 아닌 규율에만 의존한다는 점이 이 파일 자신의
반복된 교훈(가드는 구조여야 한다)과 어긋난다.

## 위험도

MEDIUM — 오늘 즉시 재현되는 사고는 아니지만, 다음 편집이 조용히 되살릴 수 있는 미가드
자매-비대칭이 실재하며 이를 잡아 줄 회귀 테스트가 없다.

STATUS: REVIEWED
