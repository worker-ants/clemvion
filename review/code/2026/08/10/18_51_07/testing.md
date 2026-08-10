# Testing Review

대상: `webchat-reload-rest-branches` 최신 라운드 — `18_23_54` testing CRITICAL(§R4 회귀가 콜드/웜
transform 캐시에 따라 결정론적으로 갈림)에 대한 저자의 처분(`38b49780e`: `PHASE_SCHEDULE_MS=90분`·
`PHASE_ADVANCE_MS=91분` 도입 + "아직 안 열렸다" 자매 테스트 동반 확장)을 검증한다. 지시대로 뮤테이션은
**repo 밖 scratch 사본**에서만 수행했다(워킹트리는 `Read`/읽기전용 `vitest run`만 사용, 최종
`git status --porcelain`으로 워킹트리 무변경 확인).

## 재현 절차

- 사본: `/private/tmp/.../scratchpad/cwc-repro-{1..4}`, `cwc-cold-1`, `cwc-cold-full-1` — 매번
  `rsync --exclude node_modules`로 `codebase/channel-web-chat/`(설정 파일 포함)을 복사하고
  `node_modules`만 실제 워크트리로 symlink.
- **"콜드/웜" 판별 변수를 한 단계 더 좁혔다**: 모든 사본이 같은 `node_modules`를 symlink 로 공유하므로
  `node_modules/.vite/vitest`(vite 의존성 사전번들 캐시)도 사본 간 **공유**된다. 이 캐시가 이미
  데워져 있으면(오늘 세션에서 이전 테스트 실행으로 12:33 에 생성돼 있었다) "새 절대경로 사본"이어도
  transform 이 빠르다(≈25-190ms). 그래서 `node_modules/.vite`를 명시적으로 삭제(gitignored, 워크트리
  비영향 — 재확인함)한 뒤 재실행해 진짜 콜드에 더 가깝게 만들었다.
- 결과: 콜드 캐시 삭제 후에도 전체 스위트(23 files/433 tests) transform **1.14초**로 리뷰어가 보고한
  "4/4 결정론적 FAIL"급 지연은 이 환경(이 세션의 이 머신)에서 재현되지 않았다 — 6회 트라이얼(개별
  파일 4회 + 캐시-클리어 2회, 그 중 1회는 전체 스위트) 전부 **PASS**. OS 파일시스템 페이지캐시 등
  vite 캐시보다 더 아래 레이어가 이미 데워져 있었을 가능성이 있다(오늘 여러 세션이 이 저장소를
  반복 실행). 즉 **정상 코드 경로에 대해 저자의 "4/4 PASS" 주장은 내 환경에서도 재현됐다**(합계
  6회 이상 콜드성 트라이얼 전부 PASS)는 확인은 되지만, "리뷰어가 본 4/4 FAIL 조건"을 내가 다시
  강제로 만들지는 못했다.
- **뮤턴트 확인**: 원래 결함 형태(`resumeDeferredStreamRef`에서 `deferredStreamRef.current = false`를
  `openStream(...)` **이전**으로 되돌림, `use-widget.ts:760-761`)를 적용하고
  `vitest run use-widget-eager-start.test.ts -t "§R4"` 실행 → **정확히 그 위전 테스트 1개만 FAIL**
  (`§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다`, `AssertionError: expected null not
  to be null` at 현재 파일 기준 685행), 나머지 7개 §R4 테스트는 여전히 PASS. 저자의 "뮤턴트 RED"
  주장과 일치한다.

## 발견사항

- **[정보 — 검증 결과, 확인됨]** `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS`(90분/91분) 전환은 유효하고,
  넓힌 두 테스트가 정확히 일치한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:139-140`(상수 정의),
    `:587-631`(`§R4: 미뤄 둔 스트림은 주기 갱신이 토큰을 되살리면 열린다`, "아직" 단언은 `:620-622`),
    `:644-694`(`§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다`, "아직 안 열렸다"류 단언은
    `:679-682`)
  - 상세: `git show 38b49780e -- .../use-widget-eager-start.test.ts`로 diff 를 직접 대조한 결과, 이
    라운드가 `TOKEN_REFRESH_LEAD_MS + 6_000`/`advanceTimersByTimeAsync(10_000\|20_000)` 조합을
    `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS`로 바꾼 지점은 **정확히 이 두 `it` 뿐**이다. 커밋 메시지의
    "자매 테스트도 같은 취약 형태라 함께 넓혔다"는 서술과 실제 diff 가 일치한다.
  - 제안: 없음(확인용).

- **[정보 — 본 질문에 대한 답]** 이 파일(`use-widget-eager-start.test.ts`)에서 `shouldAdvanceTime: true`를 쓰는
  블록은 총 **6개**(`:480`, `:540`, `:588`, `:645`, `:729`, `:1278`)이고, 그 중 "아직 일어나지
  않았다"류 부재 단언 + 촘촘한 스케줄 조합으로 **드리프트에 취약한 것은 2개**(`:588`, `:645`) —
  둘 다 이미 넓혀졌다. **이 파일 안에서 놓친 자매는 없다.** 나머지 4개는 구조적으로 다른 이유로
  안전하다(아래 근거).
  - 위치/근거:
    - `:480`(`§R4: refresh 가 네트워크 오류로 실패하면...`)·`:540`(`§R4: refresh 가 500으로
      실패해도...`) — `expect(getEs()).toBeNull()`(각각 `:517`, `:564`)이 "아직 안 열림"처럼
      보이지만, 이 fetchMock 은 `/refresh-token`을 **항상** 실패시킨다(네트워크 reject 또는 항상
      500). 즉 이 fixture 에서는 주기 타이머가 드리프트로 **조기에 발화해도** 여전히 실패해 스트림을
      열지 못한다 — 검증 시점이 스케줄 경계와 무관하게 항상 참이다. `after > before` 류 후속 단언도
      "언젠가는 늘어난다"는 **양의(positive)** 방향이라 드리프트가 오히려 그 방향을 돕는다(거짓
      실패를 만들 수 없다).
    - `:729`(`복원된 세션이 이미 terminal...`) — `expect(refreshCalls).toBe(0)`(`:767`)은 "아직 안
      왔다"가 아니라 **"영구히 안 온다"**를 검증하되, 방식이 안전하다 — 실제로 `advanceTimersByTimeAsync(10_000)`로 **일부러 시간을 진행시켜 보고**도 0인지 확인하는 양성 대조(positive
      control) 패턴이라, 없는 스케줄이 드리프트만으로 생겨날 수 없다.
    - `:1278`(`fake timer: BOOTED 후 refresh delay 경과...`) — `toBeGreaterThanOrEqual(1)`(`:1321`)은
      양의 단언이고 90분 스케줄에 61분 점프로 여유가 크다.
  - 제안: 없음(확인용) — 이 파일 범위에서는 저자의 처분이 완전하다.

- **[WARNING] 같은 취약 형태("부재 단언 + 촘촘한 스케줄" 축)가 다른 파일에 남아 있다 — 이번 위젠**
  **처분이 놓쳤다.**
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:210-227`
    (`it("일시적 실패(네트워크) → 백오프로 재예약 — 사이클이 죽지 않는다", ...)`), 특히 `:222-224`
    (`// 2차 백오프는 **2배** — base 만큼만 밀면 아직 안 온다` 주석 + `expect(refreshToken)
    .toHaveBeenCalledTimes(2)`). `describe` 블록 전체가 `:68`에서 `vi.useFakeTimers({
    shouldAdvanceTime: true })`를 쓴다. 관련 상수: `TOKEN_REFRESH_RETRY_BASE_MS =
    TOKEN_REFRESH_MIN_DELAY_MS = 5_000`(`use-token-refresh.ts:11,13`).
  - 상세: `:219`에서 `TOKEN_REFRESH_RETRY_BASE_MS`(5,000ms)만큼 전진해 2차 호출을 발화시킨 뒤,
    `:223`에서 **다시 같은 5,000ms**만 전진하고 "아직 3차는 안 왔다"(`toHaveBeenCalledTimes(2)`,
    `:224`)를 단언한다. 그런데 3차는 2차 백오프(`base*2`=10,000ms) 뒤에 발화하므로, 이 단언 시점의
    **남은 여유는 정확히 5,000ms**다 — 저자 자신이 CRITICAL 처분 커밋에서 명시한 위험 조건("스케줄
    간격과 검증 창이 같은 자릿수면 실행 속도가 결과를 정한다")과 **자릿수가 동일**하다(원래
    CRITICAL 은 스케줄 6초/여유 4초, 이쪽은 스케줄·여유 각 5초). 게다가 이 fixture 는 `refreshImpl`
    이 **매번** `Promise.reject(new TypeError("network down"))`을 반환해 호출마다 반드시 백오프가
    붙으므로, 드리프트로 3차가 조기 발화하면 `.toHaveBeenCalledTimes(2)`가 그대로 3으로 어긋난다 —
    `:480`/`:540`(안전 사례)과 달리 여기서는 **타이밍이 실제로 관측 값을 바꾼다**.
  - **재현 시도**: 위와 동일한 방법(신규 절대경로 사본 4개 + `node_modules/.vite` 캐시 삭제 후 콜드
    재실행, 개별 파일·전체 스위트 양쪽)으로 이 테스트만/포함 스위트를 6회 이상 돌렸으나 **매번
    PASS**했다 — 내 환경에서는 강제 재현에 실패했다. 다만 원 CRITICAL 도 "이 정확한 저장소, 이
    머신"에서 실측된 사례이므로, 재현 실패가 결함 부재의 증거는 아니다(느린 CI 러너·첫 콜드 부팅
    등 조건이 다르면 다시 나타날 수 있는 동일 메커니즘). 저자 자신도 이 파일의 다른 곳(`:153-155`
    주석)에서 "이 파일의 fake timer 는 `shouldAdvanceTime: true`"임을 명시하고 있어 위험 인지
    자체는 있었다.
  - 제안: (a) 이 파일이 이미 쓰고 있는 수동 제어 패턴(`resolveRefresh`/`rejectRefresh`, `:138-159`의
    "세대 변경" 테스트)으로 바꿔 `refreshImpl`이 즉시 reject 하지 않고 **테스트가 원하는 시점에**
    reject 하도록 하면 `shouldAdvanceTime`의 실경과시간 결합 자체를 없앨 수 있다(가장 근본적).
    (b) 최소 조치로는 `TOKEN_REFRESH_RETRY_BASE_MS`를 그대로 쓰는 대신 검증 창만 별도로 크게 벌릴 것
    — 예컨대 "2차 백오프가 아직"을 보려면 `base + base/2`처럼 경계에 바짝 붙이지 말고, 상수 자체가
    5초로 작으니 이 축만 별도로 큰 값(예: 분 단위)으로 스텁하거나 `retryDelayMs`를 목킹.
    (c) 안 고칠 거면 최소한 왜 안전하다고 판단했는지(예: "이 머신에서는 확률상 무시 가능") 근거를
    남길 것 — 근거 없는 판단 보류는 이 브랜치가 반복 지적받은 형태다.

- **[정보 — 검증 결과, 결함 아님]** WARNING(`instanceof` 가드 미검증) 처분 — 오리 타이핑 테스트가
  실제로 그 축을 가른다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.test.ts:281-285`
    (`.status` 를 가진 비-`EiaError` 는 종단이 아니다), 대상 함수 `eia-client.ts:179-181`
    (`isTerminalAuthError`)
  - 상세: scratch 사본에서 `err instanceof EiaError && (...)`를 `(err as {status?:number})?.status
    === 401 || ...`로(= `instanceof` 가드만 제거) 바꿔 실행 → **정확히 이 신규 테스트 1개만 FAIL**
    (`AssertionError: expected true to be false`), 나머지 29개는 PASS. 저자의 확인이 정확하다.
  - 제안: 없음(확인용).

- **[정보 — 검증 결과, 결함 아님]** `redactToken` 회귀 — "처음엔 vacuous, 고친 뒤 항등 뮤턴트로
  가른다"는 주장이 재현된다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.test.ts:288-295`
    (`redactToken — 로그에 단명 토큰을 남기지 않는다`), 대상 함수 `eia-client.ts:193-195`
  - 상세: scratch 사본에서 `redactToken`을 항등 함수(`return text;`)로 바꿔 실행 →
    `쿼리의 token 값을 지운다(다른 파라미터는 보존)` 테스트가 **정확히** FAIL(`not.toContain
    ("iext_secret")` 위반), 나머지는 PASS. 현재 테스트 메시지(`eia-client.test.ts:290`)가 실제로
    `https://api.test/api/x/stream?token=iext_secret&lastEventId=0` 형태의 **URL 을 담은 메시지**를
    쓰고 있어(구 버전이 vacuous 했던 이유 — mock 이 URL 없는 메시지를 던졌던 것과 대비), redaction
    로직이 실제로 실행 경로를 타는 구조임을 확인했다.
  - 제안: 없음(확인용).

## 요약

이번 라운드의 핵심 주장 두 가지 — (1) `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS` 전환으로 콜드/웜 캐시
의존성이 사라졌고 "아직 안 열렸다"류 자매 테스트도 같은 형태라 함께 넓혔다는 것, (2)
`redactToken`/오리 타이핑 회귀가 실제로 뮤턴트를 가른다는 것 — 은 모두 재현으로 확인됐다. 특히 (1)에
대해 `use-widget-eager-start.test.ts` 파일 안의 `shouldAdvanceTime: true` 블록 6개를 전수 분류한 결과,
"부재 단언 + 촘촘한 스케줄" 축에 해당하는 것은 정확히 2개였고 둘 다 이미 넓혀졌다 — **이 파일 안에서는
놓친 자매가 없다.** 다만 같은 PR 이 건드린 **다른 파일**(`use-token-refresh.test.ts`)에 신규 추가된
`일시적 실패(네트워크) → 백오프로 재예약` 테스트가 **정확히 같은 형태**(스케줄 5초 = 검증 여유 5초,
매 호출이 실패하는 fixture라 타이밍이 관측값을 실제로 바꿈)를 갖고 있는데 이번 처분 범위(위젠 파일)
밖이라 넓혀지지 않았다. 6회 이상의 콜드성 재현 시도(신규 절대경로 사본 + 공유 `node_modules/.vite`
캐시 명시적 삭제)로도 내 환경에서 강제 FAIL을 만들지는 못했지만, 이는 결함 부재의 증거가 아니다 —
동일 메커니즘이 바로 이 저장소·이 종류의 테스트에서 이미 한 번 결정론적 FAIL 을 낸 전례가 있다. 근본
해법(수동 promise 제어로 실경과시간 결합 제거)을 제안한다.

## 위험도

WARNING
