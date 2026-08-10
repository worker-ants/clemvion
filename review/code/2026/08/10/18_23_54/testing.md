# Testing Review

대상: `webchat-reload-rest-branches` 최신 라운드 — WARNING 2건 반영 커밋(`36bc55fa5`)이 추가한
신규 테스트 3종(`410` 비재시도 / `onRefreshed` throw 격리 / §R4 재개-throw-후-재시도)의 vacuous 여부를
전수 재검증. 뮤테이션은 지시대로 **repo 밖 scratch 사본**(`/private/tmp/.../scratchpad/cwc-mutation`,
`src/` 를 파일 복사 + `node_modules` 는 실제 워크트리로 symlink)에서만 수행했고, 워킹트리는
`Read`/`Bash`(읽기 전용 `vitest run`)만 사용했다 — 최종 `git status --porcelain` 으로 워킹트리 무변경
확인함.

## 발견사항

- **[CRITICAL]** §R4 회귀 테스트가 **실행 환경(콜드 vs 웜 transform 캐시)에 따라 결정론적으로 결과가
  갈린다** — "10초/20초 2단계 분할이 실제로 두 상태를 가르는가" 에 대한 답은 **아니오**다. 게다가
  그 flaky 실패가 의도한 뮤턴트(낙관적 클리어 복원)의 실패와 **완전히 동일한 시그니처**를 낸다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:626-669`
    (특히 657행 `waitFor`, 661-662행 1단계, 664-665행 2단계)
  - 상세:
    1. **재현 절차**: 워크트리 원본 `src/` 를 scratch(`/private/tmp/.../cwc-mutation`)로 파일 복사(내용
       바이트 동일 — `diff -rq` 로 확인)하고 `node_modules` 만 심볼릭 링크했다. 이 상태로
       `vitest run use-widget-eager-start.test.ts -t "§R4..."` 를 실행하면 **4/4 회 결정론적으로
       FAIL**(`AssertionError: expected null not to be null` at line 665). 같은 시각, 동일 소스의
       원본 워크트리 경로에서 같은 명령을 실행하면 **10/10 회 결정론적으로 PASS**(단일 실행 8연속
       + 별도 재확인 2회). 두 경로는 같은 물리 디스크(`disk3s5`)이고 같은 `node_modules` 를
       공유하므로 뮤테이션이나 의존성 차이가 아니다 — 유일한 변수는 **module transform 캐시가
       콜드(scratch, 매번 새 절대경로)냐 웜(워크트리, 이 세션에서 이미 여러 번 트랜스폼됨)이냐**다.
    2. **뮤턴트와 구분 불가**: 저자가 문서화한 뮤테이션 1(`resumeDeferredStreamRef` 의
       `deferredStreamRef.current = false;` 를 `openStream(...)` **이전**으로 되돌리는 것,
       `use-widget.ts:758-759` 원상복구)을 scratch 에 적용해 같은 테스트를 돌리면 **동일 위치, 동일
       메시지**(`use-widget-eager-start.test.ts:665`, `expected null not to be null`)로 실패한다.
       즉 리뷰어/CI 가 "뮤테이션 RED 확인" 을 관측해도, 그것이 **진짜 결함 검출**인지 **콜드 캐시로
       인한 우연한 flake** 인지 실패 로그만으로는 구분할 방법이 없다 — 이 테스트는 자신이 지키려는
       바로 그 결함 클래스에 대해 **신뢰할 수 없는 오라클**이다.
    3. **메커니즘 추정**: 이 `it` 는 `vi.useFakeTimers({ shouldAdvanceTime: true })` 를 쓴다 —
       가상 시계가 **실제 경과 시간**에 자동으로 동기화되는 옵션이다(`waitFor` 폴링이 동작하려면
       필요). 갱신 주기가 6초로 촘촘하고(`expiresAt: now + LEAD_MS + 6_000`), 1단계/2단계 경계도
       10초/20초로 촘촘하다. `boot()` 직후 `waitFor` 가 끝나기까지 실제로 소요되는 CPU 시간(콜드
       트랜스폼 시 명백히 더 길다)이 `shouldAdvanceTime` 을 통해 가상 시계에 그대로 얹히므로,
       "6초/12초" 논리적 스케줄과 "10초/20초" 검증 창의 상대적 위치가 **실행 환경의 실제 속도에
       의존**하게 된다. 정확한 인과 사슬을 100% 특정하진 못했지만(추가 계측 없이는), **재현 자체는
       완전히 결정론적**이며(콜드=4/4 FAIL, 웜=10/10 PASS) 우연한 노이즈가 아니다.
    4. **파급**: `RESOLUTION.md`/`SUMMARY.md` 가 "뮤테이션 3종 추가 전부 RED" 라고 적었는데, 이
       발견에 비추면 그 중 §R4 항목의 RED 는 **재현 신뢰도가 낮다** — 우연히 콜드 캐시 상태에서
       확인했을 수도, 웜 상태에서 정말 뮤턴트가 잡혀서였을 수도 있다(이번 재검증에선 콜드에서
       확인했으므로 후자인지 검증 불가). 더 심각한 함의는 **미래의 진짜 회귀**다 — 이 테스트가
       CI 에서 가끔(혹은 느린 러너에서 자주) FAIL 하면 "flaky, 재실행" 으로 넘겨지기 쉽고, 정작
       `resumeDeferredStreamRef` 순서가 실수로 되돌아가는 진짜 회귀가 나도 같은 flaky 로 오인되어
       무시될 위험이 있다.
  - 제안: (a) 이 테스트가 의존하는 실시간 결합을 제거할 것 — `installControllableEventSource`/
    `fetchMock` 을 수동으로 resolve 하는 패턴(이 파일의 다른 곳, 또는
    `use-token-refresh.test.ts` 의 `resolveRefresh`/`rejectRefresh` 패턴처럼)으로 바꿔 `refreshToken`
    round-trip 자체를 제어하면 `shouldAdvanceTime` 의 실경과시간 결합 없이 두 상태를 결정론적으로
    가를 수 있다. (b) 최소 조치로는 CI 컨테이너(콜드 스타트에 가까움)에서 이 테스트만 여러 번(예:
    10회) 반복 실행해 실측 flake 율을 확인하고, 여전히 불안정하면 두 단계 사이 마진을 훨씬 크게
    벌리거나(예: 1단계는 그대로, 2단계를 수십 초~분 단위로 확대) `vi.waitFor`(vitest 자체 API, 폴링
    간격을 fake timer 와 맞출 수 있음)로 교체할 것. (c) `RESOLUTION.md` 의 "뮤테이션 3종 전부 RED"
    서술에 이 항목에 한해 신뢰도 caveat 을 남길 것.

- **[WARNING]** `isTerminalAuthError` 의 `err instanceof EiaError` 가드가 **어떤 테스트로도 검증되지
  않는다** — 저자가 센 뮤테이션 3종(410 항 제거만 검증) 밖의 축이다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:179`(`export function
    isTerminalAuthError`)
  - 상세: scratch 사본에서 `return err instanceof EiaError && (err.status === 401 || err.status ===
    410);` 를 `return (err as { status?: number })?.status === 401 || (...)?.status === 410;` 로
    바꿔(= `instanceof EiaError` 가드만 제거, 상태코드 판정은 유지) 전체 스위트(`vitest run`, 23
    files)를 돌리면 **429/429 전부 GREEN** — 어떤 테스트도 이 가드의 부재를 못 잡는다. 기존
    "비종단(non-terminal)" 케이스가 전부 `.status` 필드가 아예 없는 `TypeError`/`Error` 를 쓰기
    때문에(예: `use-token-refresh.test.ts:211` `new TypeError("network down")`), `instanceof`
    가드가 사라져도 `err.status === 401` 자체가 `undefined === 401` 로 false 라 결과가 안 바뀐다.
    이 함수 자신의 JSDoc(`eia-client.ts:171-174`)이 "이 구분을 넓게 잡으면… 좁게 잡으면…" 이라고
    명시적으로 이 술어의 정확도를 강조하는데, 그 절반(타입 가드 축)은 실은 방어선이 아니라 장식이다.
    실사용 위험은 낮다 — `EiaClient.refreshToken` 의 HTTP 실패는 현재 항상 `EiaError` 로 래핑되는
    것으로 보이고, `.status` 를 가진 non-`EiaError` 객체가 실제로 refresh 경로에서 reject 되는
    경로는 코드베이스에 없어 보인다. 그래도 "호출부 비대칭 CRITICAL 2회" 를 겪은 이 술어를 향후
    누군가 duck-typing 으로 리팩터(예: 서버 응답을 직접 파싱해 `{status}` 를 만드는 경로 추가)하면
    이 가드 소실이 조용히 통과한다.
  - 제안: `new Error("x") as unknown` 에 `.status = 401` 을 얹은 non-`EiaError` 오브젝트로
    "이건 여전히 재시도해야 한다" 를 단언하는 테스트 1건을 `eia-client.test.ts`(있다면) 또는
    `use-token-refresh.test.ts` 에 추가할 것. 우선순위는 낮음(WARNING) — 위 CRITICAL 대비 실사용
    위험이 훨씬 작다.

- **[정보 — 검증 결과, 결함 아님]** `410` 비재시도 테스트와 `onRefreshed` throw 격리 테스트는 **견고함을
  확인**했다 — vacuous 아님.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:253`(`410` 실패도
    재시도하지 않는다), `:270`(`onRefreshed` 가 throw 해도 갱신은 성공으로 취급된다)
  - 상세: scratch 사본에서 저자가 명시한 뮤테이션 2·3 을 각각 적용해 재현했다.
    - 뮤테이션(예외 격리 제거, `use-token-refresh.ts` 의 `try { onRefreshedRef.current?.(updated); }
      catch {...}` → 무방비 호출): `onRefreshed 가 throw 해도…` 테스트가 **첫 단언에서 즉시**
      RED — `expected "vi.fn()" to be called 1 times, but got 4 times`(61분 창 안에서 지수
      백오프 재시도 체인이 실제로 발화함을 그대로 관측). 마진이 넓어(61분 vs 필요 시간 초 단위)
      플레이크 위험 없음.
    - 뮤테이션(`isTerminalAuthError` 에서 `410` 항 제거): `410 실패도 재시도하지 않는다` 테스트가
      역시 첫 단언에서 RED — `expected … to be called 1 times, but got 8 times`(재시도 백오프가
      상한까지 반복 발화). 마진도 넓음(`TOKEN_REFRESH_RETRY_MAX_DELAY_MS * 3` ≈ 15분).
    - 두 테스트 모두 `setup()` 헬퍼가 매 `it` 마다 새 `sessionRef`/`clientRef`/`worldGenRef` 를
      만들어(`use-token-refresh.test.ts:75-102`) 테스트 간 상태 공유가 없다 — 격리 양호.
    - `410` 테스트는 이미 신뢰받는 `401` 테스트(`:234`)와 구조가 완전히 대칭이라(같은 헬퍼·같은
      두 단계 advance·같은 마진) 추가 위험이 낮다는 저자 판단도 확인된다.
  - 제안: 없음(참고용). 이 2건은 그대로 유지 권장.

## 요약

이번 라운드가 반영한 WARNING 2건(410 비재시도, survivor 양쪽 근거 기록) 자체는 문제없이 반영됐고,
새로 추가된 3개 테스트 중 2개(`410` 비재시도, `onRefreshed` throw 격리)는 뮤테이션으로 견고함을
직접 확인했다(넓은 마진, 첫 단언에서 명확히 갈림, 테스트 간 격리 양호). 그러나 세 번째(§R4 재개-throw
-후-재시도)는 **콜드/웜 transform 캐시 여부에 따라 동일 소스가 결정론적으로 PASS/FAIL 이 갈리고, 그
FAIL 시그니처가 의도한 뮤턴트의 FAIL 시그니처와 완전히 동일**하다는 것을 직접 재현으로 확인했다 —
"10초/20초 분할이 실제로 두 상태를 가르는가" 라는 질문에는 **아니오, 실행 환경에 따라 다르다**가
답이다. 이는 이 PR 이 방금 고친 결함(낙관적 클리어로 인한 영구 고착)을 지키는 유일한 회귀 테스트의
신뢰도 문제이므로, 뮤테이션 확인 절차 자체가 이 항목에 한해 오염돼 있을 수 있다. 부가적으로
`isTerminalAuthError` 의 타입 가드(`instanceof EiaError`) 축은 어떤 테스트로도 안 잡히는 서바이버임을
확인했다(낮은 실사용 위험, WARNING).

## 위험도

CRITICAL
