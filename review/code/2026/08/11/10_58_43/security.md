# 보안(Security) Code Review

대상: 웹채팅 위젯 `shouldAbortAfterSeed`(및 `SeedOutcome` 타입) 를 `useWidget()` 클로저 스코프에서
module-level `export` 로 전환(커밋 `37b38cf31`) + 그 헬퍼를 직접 겨냥하는 4-way 진리표 단위 회귀
(`use-widget.test.ts`) 추가. 그 외 파일(`eia-client.ts` 의 `isTerminalAuthError`/`redactToken`,
`session-store.ts` 의 `applyRefreshedToken`, plan/review 문서 등)은 이전 라운드(`16_09_40`~
`10_41_08`)에서 이미 코드 변경으로 리뷰·반영이 끝난 것으로, 이번 delta 에서 재차 손댄 바 없다
(diff-base 가 `origin/main` 이라 조립 프롬프트에 누적으로 잡힌 것). 오케스트레이터 지시대로 이번
delta 의 실제 보안 관련 변경 = `shouldAbortAfterSeed`·`SeedOutcome` export 뿐이라는 전제를
소스·커밋으로 직접 검증했다.

## 검증 1 — 이번 delta 의 실제 변경 범위 (액면가 아님, `git show` 직접 대조)

`git show 37b38cf31 -- codebase/channel-web-chat/src/widget/use-widget.ts` 로 diff 전체를 확인했다.
변경은 다음 넷뿐이다.

1. `type SeedOutcome` → `export type SeedOutcome`.
2. `function shouldAbortAfterSeed` → `export function shouldAbortAfterSeed`. **함수 본문
   (`return outcome !== "continue" && outcome !== "refresh_deferred";`) 은 한 글자도 바뀌지
   않았다.**
3. `sseErrorDetail` 의 `@internal` JSDoc 위치 이동(중복 태그 정리, 이미 export 상태였음 — 이번
   delta 가 새로 노출한 게 아니다).
4. JSDoc 서술 3건 정정("(실측)" → "(정적 추적)" 등, 순수 텍스트) — 런타임 로직과 무관.

런타임 동작을 바꾸는 줄은 없다. 신규 프로덕션 로직·신규 I/O·신규 상태 변경이 전혀 없는
"export 키워드 + 주석" 델타다.

## 검증 2 — `shouldAbortAfterSeed`/`SeedOutcome` export 가 새 위험을 만드는가

`codebase/channel-web-chat/src/widget/use-widget.ts` 의 정의(`SeedOutcome` 타입, `shouldAbortAfterSeed`
함수)를 직접 읽어 확인했다.

- `SeedOutcome` 은 **네 개의 문자열 리터럴** (`"ended" | "stale" | "continue" | "refresh_deferred"`)
  로 닫힌 union 타입이다. 타입은 컴파일 타임에 소거되며, 런타임에 노출되는 정보는 없다. 리터럴
  자체도 세션 상태 라벨일 뿐 토큰·URL·개인정보를 담지 않는다.
- `shouldAbortAfterSeed(outcome)` 은 `outcome !== "continue" && outcome !== "refresh_deferred"`
  하나의 화이트리스트 비교식만 수행하는 **순수 함수**다 — 인자 외 어떤 상태도 읽지 않고, I/O·
  콘솔 로그·예외 발생·부작용이 전혀 없다. 반환값은 `boolean` 뿐이라 이 함수를 거쳐 유출될 수
  있는 정보의 상한 자체가 "네 리터럴 중 무엇이었는지 boolean 으로 뭉갠 것"으로 고정돼 있다 —
  토큰·URL 이 들어올 표면이 애초에 없다.
- **소비처 확인**(`grep -n "shouldAbortAfterSeed" use-widget.ts`): 정의부 1곳, 기존 호출부 2곳
  (`start()`:866, `applyConfig()`:1227 — 두 곳 다 이번 delta 이전부터 있던 호출로, 인자로
  넘기는 `outcome` 값 자체도 바뀌지 않았다), 신규 테스트 소비처(`use-widget.test.ts`) 하나뿐이다.
  다른 프로덕션 모듈이 이 export 를 새로 import 하지 않는다 — `sseErrorDetail` 이 이전 라운드
  (`10_41_08`)에 export 로 전환됐을 때와 **동일한 패턴**(순수·부작용 없음·유일 소비자가 여전히
  동일 모듈)이며, 그때 이미 "export 자체는 새 위험을 만들지 않는다"고 판정한 근거가 그대로
  적용된다.
- `@internal — unit-test seam only` JSDoc 은 접근제어자가 아니라 문서 경고이므로 이론상 다른
  코드가 재사용할 여지를 완전히 막지는 못하지만, 함수가 반환할 수 있는 값의 상한이 이미
  안전하게 고정돼 있어 남용되더라도 보안 등급을 올릴 사안이 아니다(위 `sseErrorDetail` 재확인
  때와 동형의 판단).

## 검증 3 — 토큰 노출 4지점 재확인 (이번 delta 가 손대지 않았는지)

`10_02_22` 라운드가 전수 확인한 토큰 노출 진입점 4곳(`start`·`applyConfig`·`resumeDeferredStream`·
`onError`)이 이번 delta 로 흔들렸는지 소스에서 직접 재확인했다.

- `errMessage()`(`use-widget.ts:1367`, `redactToken(e instanceof Error ? e.message : String(e))`
  를 거쳐 `console.warn`) — `start()`(`:895`)·`sendCommand`(`:939`)·`runApplyConfig`(`:1287`)
  3곳의 `dispatch({type:"ERROR", message: errMessage(e)})` 가 모두 여전히 이 함수를 경유한다.
  이번 delta 는 이 함수·호출부를 건드리지 않았다(diff 에 등장하지 않음).
- SSE `onError` 핸들러(`use-widget.ts:504-508`)는 원본 이벤트 대신 `sseErrorDetail(e)` 반환값만
  `console.warn` 에 넘긴다 — 이번 delta 로 `sseErrorDetail` 본문이 바뀌지 않았으므로(검증 1) 이
  경로도 그대로 안전하다.
- `resumeDeferredStreamRef`(`:782`)는 `useTokenRefresh` 의 `onRefreshed` 콜백에서만 호출되는
  경로로, 이번 delta 의 변경 파일 목록(`use-widget.ts`, `use-widget.test.ts`)에 `use-token-refresh.ts`
  가 포함되지 않는다 — 미변경.

4지점 모두 이번 delta 의 diff 범위 밖이고, `git show 37b38cf31` 로 확인한 실제 변경 4건(검증 1)
중 어느 것도 이 경로들과 겹치지 않는다. **재확인 결과: 4지점 전수 확인은 여전히 유효하다.**

## 검증 4 — 신규 테스트 픽스처 재확인

`use-widget.test.ts` 의 신규 `describe("shouldAbortAfterSeed — 중단 판정 진리표", ...)` 블록은
`"ended"`/`"stale"`/`"continue"`/`"refresh_deferred"`/`"something_new"` 같은 상태 라벨 문자열만
쓴다(토큰·시크릿 형태 문자열 없음) — 하드코딩 시크릿 해당 사항 없음.

## 발견사항

없음. (신규 CRITICAL/WARNING/INFO 없음 — export 전환은 순수 함수·닫힌 타입에 국한되고, 토큰
노출 4지점은 이번 delta 의 diff 범위 밖임을 직접 확인)

## 요약

이번 delta 는 `shouldAbortAfterSeed`(화이트리스트 boolean 판정 순수 함수)와 `SeedOutcome`(네
리터럴로 닫힌 상태 라벨 타입)을 module-level export 로 전환하고 이를 직접 겨냥하는 단위 테스트를
추가한 것이 전부다. `git show` 로 실제 diff 를 대조한 결과 함수 본문·호출부·인자값 어느 것도
바뀌지 않았고, 새로 노출되는 표면은 "테스트가 이 함수를 직접 import 할 수 있다"는 것뿐이다.
함수 자체가 부작용 없이 `boolean` 만 반환하고 타입은 세션 상태 라벨일 뿐이라 export 로 인해
토큰·URL 등 민감정보가 새로 노출될 경로는 없다 — 직전 라운드(`10_41_08`)에서 같은 패턴
(`sseErrorDetail` export)에 내린 안전 판정과 동형이다. 오케스트레이터가 재검증을 요청한 "토큰
노출 4지점"(`start`·`applyConfig`·`resumeDeferredStream`·`onError`)도 이번 delta 의 diff 범위
밖임을 소스에서 직접 확인했으므로 그 확인은 여전히 유효하다. 직전 두 라운드(`10_24_54`,
`10_41_08`)의 NONE 판정을 흔들 요소가 이번 delta 에 없으므로 판정을 유지한다.

## 위험도

NONE
