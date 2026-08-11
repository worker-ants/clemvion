# 부작용(Side Effect) Review — webchat-apibase-scheme (커밋 `99d3e9000`)

오케스트레이터가 요청한 4개 확인 항목을 전부 `git show`/실제 소스 대조/실행 실측으로 검증했다.

## 확인 1 — `use-widget.ts` 는 정말 JSDoc 주석뿐인가

**확인됨 — 사실.** `git show 99d3e9000 -- '*/use-widget.ts'` 를 직접 열어보면 이 커밋의
`use-widget.ts` diff 는 단일 hunk이고, 추가·삭제된 모든 줄이 `safeApiBase` 함수 위
JSDoc 블록 내부(각 줄이 ` *` 로 시작하는 주석 라인)뿐이다. `export function`/실행문·타입
시그니처·호출부(`bridge.onBoot` 배선 등) 어느 줄도 이 커밋에서 바뀌지 않았다 — 그 배선
변경(`mergeBootConfig` 도입)은 이전 커밋(`3f1169ab5`/`d8abc7003`)에서 이미 반영됐고
`99d3e9000` 은 손대지 않는다. `git show 99d3e9000 --stat` 로 6개 파일 전체를 대조해도
프로덕션 코드는 `use-widget.ts` 하나뿐이고 그마저 `+12/-표` 전량이 주석이라, "프로덕션 코드
변경은 JSDoc 주석뿐" 이라는 주장은 정확하다.

## 확인 2·3 — 신규 e2e 테스트의 `window.history.replaceState` 부작용

대상: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 의
`"유효 쿼리(apiBase만) + 악성 boot → 쿼리 값이 이긴다 (덮어쓰기 차단, e2e)"` (게이트
4256~4273, `replaceState` 호출은 4259~4260·복원은 4271).

**실측 방법**: `pnpm install --filter="./codebase/channel-web-chat..."` 로 이 worktree 에
의존성을 설치한 뒤, 대상 테스트 파일을 임시 복사본(`__leak_probe*.test.ts`, 커밋 대상
아님·검증 후 즉시 삭제하고 `git status` 로 원상복구 확인)에 canary `it` 를 덧붙여
1) 기본 실행 순서, 2) `--sequence.shuffle --sequence.seed=1`, 3) `--sequence.seed=2`
(이 시드에서는 문제의 테스트와 canary 사이에 다른 테스트 42개가 끼어든다) 세 조건으로
`vitest run` 을 반복 실행했다.

- **jsdom 기본 URL은 `http://localhost:3000/`**(`vitest.config.ts` 에 `environmentOptions`
  미지정 → Vitest jsdom 기본값)이며, 이 파일 안에서 `location.search`/`pathname` 을 건드리는
  코드는 이 신규 테스트가 유일하다(`grep -n "location.search" use-widget-eager-start.test.ts`
  결과 이 테스트의 `const original = window.location.search;` 한 줄뿐).
- 세 조건 모두 canary(`expect(window.location.search).toBe(""); expect(window.location.pathname).toBe("/")`)가
  **통과**했다(78/78, 79/79, 79/79 — 매 실행 전부 GREEN, 회귀 없음). `try { ... } finally { window.history.replaceState(null, "", original || "/"); }`
  구조라 `waitFor`/`expect` 실패가 나도(자바스크립트 예외) `finally` 는 항상 실행되므로,
  이 파일이 우려하는 "assert 실패 시 정리 코드가 스킵된다" 부류의 실패 모드(주석 250~254,
  `document.referrer` 관련)에 이 테스트는 해당하지 않는다. **다른 테스트로 새는 것을 관측하지
  못했다.**
- **다만 복원 로직 자체는 우연에 기대고 있다.** `original || "/"` 는 "원래 search 가 빈
  문자열이면 pathname 도 `'/'` 로 되돌린다" 는 뜻인데, 이는 **jsdom 기본 URL이 정확히
  `http://localhost:3000/`(pathname=`/`)라서** 지금 우연히 옳을 뿐이다. 이 관용구는
  `search` 만 캡처하고 `pathname`은 캡처하지 않으므로, 만약 (a) 이 파일에 다른 테스트가
  나중에 `history.pushState`로 pathname을 바꾸거나, (b) `vitest.config.ts`에
  `environmentOptions.jsdom.url`이 추가되거나, (c) 이 관용구가 pathname이 `/`가 아닌
  다른 테스트 파일로 복사되면, 복원이 실제 pathname을 버리고 조용히 `"/"`로 덮어쓴다.
  현재는 발현하지 않지만 캡처·복원 비대칭(search만 저장, pathname은 하드코딩)이라는
  점에서 **잠재적(latent) 부작용**이다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:4259-4260`(캡처·변경), `:4271`(복원)
  - 제안: `const original = window.location.href;` 로 전체 URL을 캡처하고
    `window.history.replaceState(null, "", original);` 로 그대로 되돌리면 이 비대칭이
    사라진다(`original` 이 falsy 가 될 일이 없다 — `href` 는 항상 non-empty).

**확인 3 — `beforeEach`/`afterEach` 전역 상태와의 충돌**: **없음.** 이 파일 최상단
`afterEach`(게이트 243~256)는 `vi.unstubAllGlobals()`(→ `installFetch`/`installControllableEventSource`
의 `fetch`/`EventSource` stub 해제), `vi.useRealTimers()`, `vi.restoreAllMocks()`(→ `console.warn`
spy 해제), `document.referrer` 리셋을 전담한다. 신규 테스트 3건이 쓰는 `installFetch()`·
`vi.spyOn(console, "warn")` 는 이 전역 `afterEach` 가 그대로 정리하므로 문제없다. 신규
테스트는 `document.referrer` 를 전혀 건드리지 않고, `boot()` 헬퍼가 매번 고정된
`origin: "http://host.test"` 를 postMessage 에 실어 보내므로 referrer 상태와 무관하게
동작한다 — 충돌 없음.

다만 **관용구 불일치**는 지적할 만하다. 이 파일은 이미 "복원은 전역 `afterEach` 가 담당해야
개별 테스트의 assert 실패에도 다음 테스트로 새지 않는다"는 원칙을 명시적으로 문서화하고
반복 적용한다(예: `document.referrer` 오버라이드, 게이트 2767 부근 "복원은 전역 afterEach
가 담당 — 아래 단언이 실패해도 다음 테스트로 새지 않도록"). 신규 `location.search` 변경만
그 공유 안전망 대신 **로컬 `try/finally`** 를 쓴다 — 실측상 정상 동작하지만(위 참조),
전역 안전망 밖에 있으므로 향후 이 describe 블록에 `try/finally` 를 빠뜨린 테스트가
추가되면 이 파일의 다른 항목들과 달리 보호받지 못한다.

- **[INFO]** `location.search` 복원이 파일의 기존 "전역 `afterEach` 안전망" 관용구를 따르지 않고 로컬 `try/finally` 로만 처리됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:4256-4273`(신규 `it` 전체), 대조: `:243-256`(전역 `afterEach`, referrer 복원 패턴)
  - 상세: 오늘은 안전하다(위 실측). 다만 이 파일 스스로가 "로컬 정리는 assert 실패 시 스킵될 수 있다" 는 이유로 전역 `afterEach` 패턴을 정착시켰는데, `location.search` 만 예외적으로 다른 메커니즘(`try/finally`)을 쓴다.
  - 제안: 전역 `afterEach` 에 `window.history.replaceState(null, "", "/")` (또는 위 `href` 캡처 방식과 결합한) 안전망을 한 줄 추가하면, 로컬 `try/finally` 가 이중 방어선이 되어 이 파일의 기존 컨벤션과 정합해진다. blocking 은 아님.

## 확인 4 — `R0` → `R7` 이동이 spec 문서의 다른 내용을 흔들었는가

`git show 99d3e9000 -- 'spec/7-channel-web-chat/4-security.md'` 로 직접 diff 를 열어
확인했다.

- **`4-security.md` 내부는 깨끗하다.** `### R0.` 섹션 전체(구 177~211행)가 삭제되고, 문서
  맨 끝에 **동일 본문**이 `### R7.`(게이트 272)로 재삽입됐다. `R1`~`R6` 헤딩 텍스트는
  이 커밋에서 단 한 글자도 바뀌지 않았다(`grep -n "^### R" spec/7-channel-web-chat/4-security.md`
  로 재확인: `R1`~`R7` 이 정확히 한 번씩, 중복·결번 없이 등장). GitHub 스타일 앵커는 헤딩
  텍스트의 슬러그이므로 `R1`~`R6` 을 가리키는 타 문서의 `#r6-...` 류 앵커도 이 리네이밍의
  영향을 받지 않는다 — 커밋 메시지의 "기존 R1~R6 헤딩은 불변이라 타 문서 4곳의 앵커는
  그대로 유효" 주장과 실측이 일치한다.
- **그런데 이동 자체가 아니라 "이동을 알린 대상 파일"에서 정합이 깨졌다.** 같은 커밋
  (`99d3e9000`)이 같은 순간에 `use-widget.ts` JSDoc(게이트 197)에 다음 문장을 **신규로**
  추가했다:

  > `> 첫 판은 "applyConfig 가 자기 자리에서 실패한다" 고 적었다. 거짓이다. spec §R0 에서
  > 그 문장을 정정하면서 여기(코드 SoT)는 안 고쳤다 …`

  이 문장이 코드에 쓰인 시점에 `spec/7-channel-web-chat/4-security.md` 에는 이미 `§R0` 가
  **존재하지 않는다** — 같은 커밋이 그 절을 `§R7` 로 옮겼기 때문이다(`git show 99d3e9000`
  한 커밋 안에서 두 변경이 동시에 일어남을 확인). 즉 이 커밋은 자신이 방금 만든 리네이밍을
  자신이 새로 쓴 코드 주석에 반영하지 않았다 — 이 커밋의 표제("정정을 한 곳에만 했다")가
  가리키는 바로 그 실패 클래스(한 사실을 두 곳에 두고 한 곳만 고침)를, 이번엔 **리네이밍
  대상**에 대해 다시 냈다. 저장소 전체 grep(`§R0`)으로 확인한 결과, 코드에서 살아있는
  참조는 이 한 줄뿐이고 나머지는 전부 `review/`·`plan/complete/` 의 역사 기록(수정 대상
  아님, 규약상 보존)이다.

- **[WARNING]** `use-widget.ts` JSDoc이 이 커밋 자신이 폐기한 spec 앵커(`§R0`)를 신규로 인용한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`(`spec §R0 에서` 문구), 대응 spec 자리는 `spec/7-channel-web-chat/4-security.md:272`(현재는 `### R7.`)
  - 상세: `4-security.md` 에 `### R0.` 헤딩이 더 이상 존재하지 않으므로(`grep -n "^### R" spec/7-channel-web-chat/4-security.md` 결과 `R0` 0건, `R7` 1건), 이 JSDoc 을 읽고 spec 을 찾아가는 다음 사람은 "§R0" 를 문서에서 찾지 못한다. 런타임 영향은 없다(순수 주석 텍스트 리터럴이라 컴파일·테스트에 관여하지 않음) — 그래서 이번 라운드 리뷰·테스트가 잡지 못했다. 다만 이 문단 자체가 "정정 근거를 두 곳에 남겼다" 는 취지를 설명하는 자리라, 그 두 곳 중 하나가 실제로는 존재하지 않는 앵커를 가리키는 것은 이 PR 이 스스로 지적해 온 "복제된 사실 중 한 곳만 고친다" 패턴의 재발이다.
  - 제안: `use-widget.ts:197` 의 `spec §R0` → `spec §R7` 로 문구만 정정. 1줄짜리 사소한 수정이지만, 같은 클래스의 3번째 발생(이 PR 자체 이력 기준)이라 이번엔 회귀 방지 관점에서 짚어 둔다.

## 그 외 점검 관점 (전역 변수·파일시스템·시그니처·인터페이스·환경변수·네트워크)

- **전역 변수**: 새로 도입된 전역 변수 없음. `mergeBootConfig`/`safeApiBase` 는 순수 함수이고 모듈 스코프 mutable state 를 갖지 않는다(이 커밋 자체는 이 함수들의 시그니처도 바꾸지 않음 — 시그니처 변경은 이전 커밋에서 이미 반영·리뷰됨).
- **파일시스템 부작용**: 이 커밋은 `plan/complete/`·`plan/in-progress/`·`spec/` 마크다운만 편집·이동하며, 코드가 런타임에 파일을 쓰는 동작은 없다.
- **시그니처/인터페이스 변경**: 이 커밋(`99d3e9000`) 단독으로는 없음(`safeApiBase`/`mergeBootConfig` export 는 이전 커밋에서 이미 확정).
- **환경 변수**: 관련 변경 없음.
- **네트워크 호출**: 신규 테스트는 `installFetch()` 로 `fetch` 를 스텁하므로 실제 네트워크 호출 없음. 프로덕션 코드는 이 커밋에서 fetch 호출부를 건드리지 않는다.
- **이벤트/콜백**: `bridge.onBoot` 콜백 배선(`mergeBootConfig` 호출)은 이전 커밋에서 이미 반영됐고 이 커밋은 그 줄을 변경하지 않는다(주석만 바로 위에 추가).

## CRITICAL

**새 CRITICAL 없음.** 요청된 4개 항목 모두 실측 결과 코드 자체의 런타임 동작에는 영향이 없다.
유일한 실체 있는 지적은 `use-widget.ts:197` 의 죽은 `§R0` 참조(WARNING, 순수 문서 정확성
문제)와 신규 e2e 테스트의 `location.search` 복원 관용구 두 가지(비긴급 INFO 2건, 잠재적
fragility·컨벤션 불일치)다.

## 요약

`99d3e9000` 의 프로덕션 코드 변경(`use-widget.ts`)은 주장대로 JSDoc 주석뿐이며 실행 코드
한 줄도 바뀌지 않았다(`git show` 로 hunk 단위 확인). 신규 e2e 테스트가 쓰는
`window.history.replaceState` 는 기본 실행 순서·2가지 shuffle 시드(사이에 42개 테스트가
낀 경우 포함)에서 전부 정상 복원됐고 `beforeEach`/`afterEach` 의 referrer·fetch·타이머
정리와도 충돌하지 않았다 — 다만 복원 로직(`original || "/"`)이 pathname 을 캡처하지 않고
하드코딩한다는 점과, 이 파일이 정착시킨 "전역 afterEach 안전망" 관용구 대신 로컬
`try/finally` 만 쓴다는 점은 오늘은 무해하지만 향후 재사용 시 잠재적 결함의 씨앗이라 INFO
로 남긴다. `R0`→`R7` spec 섹션 이동 자체는 `4-security.md` 내부에서 깔끔했지만(R1~R6 헤딩·
앵커 불변 확인), 같은 커밋이 동시에 작성한 `use-widget.ts` JSDoc 이 이미 사라진 `§R0` 를
새로 인용해 이 PR 이 스스로 경계해 온 "한 사실을 두 곳에 두고 한 곳만 고친다" 패턴을 리네이밍
대상에 대해 재발시켰다 — WARNING 으로 기록한다.

## 위험도

LOW

STATUS: OK
