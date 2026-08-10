# 테스트(Testing) Review

## 검증 방법

`use-widget.ts`/`use-widget-eager-start.test.ts` 는 이미 직전 라운드(`review/code/2026/08/10/12_39_25`)에서
7명 전원 리뷰 + `RESOLUTION.md` 로 WARNING 3건이 반영된 상태다. 이번 라운드는 그 반영 결과(및 그 사이
누적된 plan/spec 문서)를 대상으로 하므로, 직전 라운드가 이미 잡은 항목을 재검증(claim 실측)하고 신규
관측만 별도로 보고한다.

- `pnpm vitest run src/widget/use-widget-eager-start.test.ts` — **62 passed** (직접 실행 재확인)
- `pnpm exec tsc --noEmit` (channel-web-chat) — **0 errors** (직접 실행 재확인)
- 소스 직접 대조(`Read`) — `openStream`(게이트 `364`-`411`), 두 호출부(게이트 `613`-`624`, `965`-`976`),
  `start()` 의존성 배열(게이트 `634`)을 열어 RESOLUTION.md/SUMMARY.md 의 "반영 완료" 주장과 실제 코드가
  일치하는지 줄 단위로 대조했다.

## 발견사항

- **[해소 확인]** 회귀 테스트 주석 stale 서술(직전 라운드 WARNING #3) — 실제로 갱신됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3409`
  - 상세: 옛 주석("`openStream` 직전에도 재확인... 게이트가 `start()`와 `applyConfig` 양쪽에 있다")이
    현재 구조("스트림 게이트가 `openStream()` 안에 있다")로 정확히 갱신돼 있다. assertion 본체
    (`raceStartVsResendSingleStream`, 게이트 `3420`-`3497`)는 여전히 관측 가능한 결과(`esCount`/`nodeId`)만
    단언하므로 게이트 위치 이동과 무관하게 유효하다 — 구현이 다시 바뀌어도 테스트를 고칠 필요가 없는
    좋은 설계가 유지된다. 양방향 두 테스트(`resendResolvesFirst` true/false)가 각 호출부의 게이트를
    개별로 고정하는 구조도 그대로 보존됨을 확인했다.

- **[INFO]** "부정 비교(fail-closed)" 설계 의도가 현재 `StreamClaim` 3-variant 로는 관측 불가능한 동등
  변형(equivalent mutant) 공간을 남긴다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:623`, `:974`
    (`if (claim !== "opened" && claim !== "no_client") return;`)
  - 상세: 이 줄의 주석(게이트 `619`-`621`)은 "부정 비교라 향후 '중단이어야 하는' variant 가 늘 때 자동으로
    fail-closed 로 처리된다"고 명시적으로 근거를 든다. 그런데 `StreamClaim`(게이트 `104`-`110`)은 현재
    정확히 `"opened" | "already_owned" | "no_client"` 세 값뿐이다. 이 세 값의 정의역 안에서는
    `claim !== "opened" && claim !== "no_client"` 와 `claim === "already_owned"`(긍정 비교, fail-open 형태)가
    **모든 실행 가능한 입력에 대해 항상 같은 결과**를 낸다 — 세 값 중 어느 것을 넣어도 두 식이 갈리지
    않는다. 즉 이 줄을 긍정 비교로 뒤집는 뮤테이션은 현재 타입/테스트 조합으로는 **죽지 않는 동등
    뮤턴트**다(plan 문서가 실측한 두 "생존 동등 뮤턴트" — `"no_client"`→`"already_owned"` 반환값 교체,
    호출부의 결과 무시 — 와는 다른 축의 세 번째 동등 뮤턴트). 결과적으로 "fail-closed 설계가 미래의
    4번째 variant 를 안전하게 처리한다"는 주석의 핵심 주장은 **오늘 시점의 어떤 테스트로도 검증되지
    않는다** — 그 4번째 variant 가 실제로 추가되는 순간에야 비로소 두 형태가 갈리기 시작한다. 지금
    당장 결함은 아니지만("문서화된 보장이 구현/테스트보다 넓다" 류의 패턴), 4번째 variant 를 추가하는
    다음 사람이 이 comparison 을 긍정형으로 "단순화"해도 현재 테스트 스위트는 그것을 잡지 못한다.
  - 제안: 지금 조치는 불필요. 다만 향후 세 번째 seed→openStream 호출부나 4번째 `StreamClaim` variant가
    실제로 추가되는 시점에는, 이 fail-closed 비교를 헬퍼 함수(예: `isStreamClaimOk(claim)`)로 뽑아
    variant 추가 시 컴파일러가 강제로 분기를 다시 묻게 만들거나(exhaustive switch + `assertNever`),
    최소한 신규 variant 를 "진행"으로 잘못 처리하지 않는지 확인하는 회귀 테스트를 그 작업의 완료
    기준에 포함시킬 것.

- **[INFO]** `StreamClaim` 해석 로직(부정 비교 한 줄)이 호출부 2곳에 문자 그대로 복제돼 있다 — 이번
  리팩터가 없애려던 것과 같은 모양의 복제가 한 단계 위로 이동
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:623`, `:974` (두 줄 완전히 동일:
    `if (claim !== "opened" && claim !== "no_client") return;`)
  - 상세: 이번 diff 의 핵심 목표(JSDoc·plan 체크리스트 모두 명시)는 "소유권 게이트가 호출부 2곳에
    손으로 복제돼 있던 3줄 구조를 `openStream` 내부로 옮겨 구조적으로 강제"하는 것이었다. 실제로
    **소유권 체크**(`streamRef.current !== null`) 자체는 `openStream` 내부로 정확히 단일화됐다.
    다만 그 반환값(`StreamClaim`)을 "진행할지 중단할지"로 해석하는 로직은 여전히 두 호출부에 손으로
    복제돼 있고, 이번 diff 가 스스로 강조하는 위험("3번째 seed→openStream 경로가 생기면 아무도
    상기시켜 주지 않는다")이 그대로 이 해석 로직에도 적용된다 — 3번째 호출부가 생기면 이 한 줄을
    또 손으로 복제해야 하고, 어느 한쪽만 새 variant 를 반영하고 다른 쪽을 놓쳐도 컴파일러도 테스트도
    잡지 못한다(두 호출부 사이의 "동기화" 를 검증하는 테스트가 없다 — 기존 회귀 테스트 2건은 각
    호출부의 소유권 게이트만 개별로 고정할 뿐, 두 호출부의 해석 로직이 서로 일치하는지는 검증하지
    않는다). 지금 상태(호출부가 정확히 2곳뿐이고 둘 다 이번 diff 에서 함께 갱신됨)에선 안전하지만,
    구조 자체가 "가드를 한쪽에만 적용" 재발 패턴을 완전히 차단하지는 못했다.
  - 제안: 급하지 않음(현재 두 호출부는 diff 시점에 정합함). 다음에 세 번째 호출부를 추가하거나
    `StreamClaim` variant 를 늘릴 때, 해석 로직을 공용 헬퍼로 뽑아 단일 지점에서만 바뀌게 하는 것을
    고려. 그 시점에 헬퍼 자체를 단위 테스트로 직접 커버하면(현재 `openStream` 은 비공개 클로저라
    직접 테스트 불가하지만 헬퍼는 순수 함수로 뽑을 수 있어 독립 테스트 가능) 이 계열의 재발을
    구조적으로도, 테스트로도 막을 수 있다.

- **[INFO]** plan 체크리스트 자체 서술(호출부 형태)이 실제 코드와 미묘하게 다르다 — plan 문서 내부 drift
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:69` vs
    `codebase/channel-web-chat/src/widget/use-widget.ts:622-623`, `:973-974`
  - 상세: plan 체크리스트는 "호출부는 `if (openStream(...) === "already_owned") return;` 한 줄이
    된다"고 서술한다(긍정 비교, 단일 표현식). 그런데 실제로 반영된 코드는 `const claim = openStream(...)`
    로 값을 받은 뒤 `if (claim !== "opened" && claim !== "no_client") return;` 로 게이팅한다(부정 비교,
    두 줄) — 이는 같은 파일의 다른 곳(게이트 `619`-`621`)이 "부정 비교라야 fail-closed 다"라고 명시적으로
    설명하는 바로 그 형태이며, plan 문서가 적은 단순 긍정형과는 (현재 3-variant 범위에서는 동등하지만)
    형태가 다르다. plan 체크리스트 항목이 아마 `ai-review 12_48_08` 이전 시점(단순 boolean-스러운 긍정
    비교)에 작성됐다가, 이후 fail-closed 부정 비교로 다시 다듬어졌는데 plan 문서 쪽 서술은 갱신되지
    않은 것으로 보인다. 기능적 영향은 없으나, 이 저장소가 스스로 "주석/문서 drift 로 반복 결함을
    냈다"고 여러 곳에서 자인하고 있는 만큼, 다음에 이 plan 문서를 근거로 새 호출부를 작성하는 사람이
    실제 코드 형태(부정 비교)가 아니라 plan 이 적은 단순형(긍정 비교)을 그대로 베낄 위험이 있다.
  - 제안: `webchat-usewidget-extraction.md:69` 의 예시 코드를 실제 형태
    (`if (claim !== "opened" && claim !== "no_client") return;`)로 정정. 급하지 않음(체크리스트는
    이미 `[x]` 완료 처리됐고 코드 자체는 정확함).

- **[참고, 조치 불요]** mutation 테스트 claim(plan §체크리스트, 게이트 `81`-`86`) 실측 검증 — 논리적으로
  타당함을 코드 대조로 확인
  - "소유권 게이트 제거 → RED": `openStream` 의 `if (streamRef.current !== null) return "already_owned";`
    (게이트 `391`)를 제거하면 두 continuation 모두 `closeStream()` → 새 `EventSource` 생성 경로를 타
    `esCount===1` 단언이 양방향 모두 깨진다 — 코드 흐름상 타당.
  - "`no_client`→`already_owned` 교체·호출부 결과 무시가 동등 뮤턴트": 두 호출부(`start()` 게이트
    `580`, `applyConfig` 게이트 `954`)가 모두 `client` truthy 를 이미 보장한 뒤에만 `openStream` 을
    부르므로(`if (!cfg || !client) return;` / `if (clientRef.current) { … }` 블록 안), `"no_client"`
    분기(게이트 `389`)는 현재 두 호출부 어디서도 실행되지 않는다 — 주장한 도달 불가능성이 코드로
    확인된다. `scheduleRefresh`(`use-token-refresh.ts:73-74`)가 `clearRefreshTimer()` 로 시작하는
    멱등 함수라는 주장도 확인했다.

## 요약

이번 diff 의 핵심 코드(`use-widget.ts` `openStream`/`StreamClaim`)와 회귀 테스트(`use-widget-eager-start.test.ts`)
는 직전 라운드(`12_39_25`)의 WARNING 3건이 전부 실제로 반영됐음을 소스 대조·`vitest`/`tsc` 직접 실행으로
재확인했다 — 특히 testing WARNING 이었던 "옛 구조를 서술하는 회귀 테스트 주석" 은 현재 구조를 정확히
설명하도록 갱신됐고, assertion 자체는 구현 세부와 무관하게 관측 가능한 결과(`esCount`)만 보므로 여전히
유효하다. plan 문서(`webchat-usewidget-extraction.md`)가 주장하는 뮤테이션 테스트 결과(소유권 게이트
제거 RED, `no_client` 도달불가·`scheduleRefresh` 멱등성으로 인한 2종 동등 뮤턴트)도 코드 대조로 타당함을
확인했다. 신규로 발견한 것은 전부 INFO 수준이며 지금 당장의 결함은 아니다 — (1) "부정 비교=fail-closed"
설계 의도가 현재 3-variant 범위에서는 어떤 뮤테이션으로도 관측되지 않는 동등-변형 공간을 남기고,
(2) `StreamClaim` 해석 로직이 소유권 게이트 자체는 벗어났지만 호출부 2곳에 여전히 문자 그대로 복제돼
있어 "가드를 한쪽에만 적용" 재발 위험이 한 단계 위(해석 로직)로 이동했으며, (3) plan 체크리스트가
적은 예시 코드 형태(긍정 비교)가 실제 shipped 코드(부정 비교)와 미묘하게 달라 plan 문서 자체 내부에
경미한 drift 가 있다. 셋 다 차단 사유는 아니고, 3번째 seed→openStream 호출부나 4번째 `StreamClaim`
variant 가 실제로 추가되는 시점에 함께 정리하면 충분하다.

## 위험도

LOW
