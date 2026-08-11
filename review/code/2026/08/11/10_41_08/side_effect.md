# 부작용(Side Effect) Review

## 스코프 정정

프롬프트에 조립된 diff 는 `origin/main` 대비 브랜치 전체(review artifact 20여 라운드 포함)다.
그러나 오케스트레이터가 지목한 "이번 delta" 는 그중 최신 커밋 하나 — `8eb223c19`
("refactor(webchat): 라운드 11 — 동작 결함 0, 커버리지·배치·주석 밀도 정리", 대상 파일 3개:
`use-widget.ts`/`use-widget.test.ts`/`webchat-auth-session-status-reconcile.md`) — 다. 그 외
파일(eia-client.ts 의 `isTerminalAuthError`/`redactToken`, session-store.ts 의
`applyRefreshedToken`, review/ 산출물 등)은 이전 라운드에서 이미 검토·반영 완료된 것으로,
이번 라운드에 신규로 바뀐 바 없어 재검토 대상에서 제외했다(신규 발견 없음, 재확인만 함).
아래는 `8eb223c19` 델타에 대한 검증 결과다.

## 검증 방법

주장을 액면가로 받지 않고 실제 소스(`Read`)로 대조했고, 정적 판단이 위험한 지점(자동/수동
`await` 존재 여부, hoisting)은 `tsc --noEmit`(0 errors) + `vitest run
use-widget.test.ts eia-client.test.ts`(41 passed)를 직접 실행해 교차 검증했다. 워킹트리를
바꾸는 git 명령은 쓰지 않았다(읽기 전용 `git show`/`git diff`만).

## 발견사항

- **[INFO]** `sseErrorDetail` 모듈-스코프 이동은 관찰 가능한 동작 변화가 없다 — 검증 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:204` (새 위치, `export function
    sseErrorDetail`), 유일한 실 호출부 `:500`(`openStream` 의 `onError` 콜백 내부)
  - 상세: 이동 전에도 이 함수는 `useWidget()` **내부**의 함수 선언(function declaration)이라
    자바스크립트 hoisting 규칙상 이미 `useWidget()` 스코프 최상단으로 끌어올려져 있었다 —
    파일상 물리적 위치(‎`openStream` JSDoc 과 정의 사이)와 무관하게 훅 본문 어디서든 호출
    가능했다. 즉 "이동"은 **가독성 재배치**였을 뿐, 호출 가능 시점을 바꾸지 않는다. 함수
    자체는 파라미터 `e` 만 읽는 순수 함수로 훅의 `state`/`ref`/클로저 변수를 전혀 캡처하지
    않으므로(`Read` 로 본문 전체 확인, `codebase/channel-web-chat/src/widget/use-widget.ts:204-211`),
    모듈 스코프로 옮겨도 반환값·부작용이 달라질 여지가 없다. 유일한 실질 차이는 **인스턴스
    생성 빈도**다 — 이전엔 `useWidget()` 훅이 호출될 때마다(즉 렌더마다) 새 함수 객체가
    만들어졌고, 이제는 모듈 로드 시 1회만 만들어져 렌더 간 동일 참조를 공유한다. 이 identity
    변화가 관찰 가능한 차이를 낳으려면 그 참조가 `useCallback`/`useMemo`/`useEffect` 의존성
    배열에 들어가 있어야 하는데, `grep` 결과 `sseErrorDetail` 은 어떤 의존성 배열에도 없다
    (`openStream` 의 deps 는 `[closeStream, handleEiaEvent]` 뿐, `:507`). 함수 선언은 `const`
    와 달리 TDZ 의 영향도 받지 않으므로 모듈 최상단으로 옮긴 것이 초기화 순서 문제를 일으키지도
    않는다.
  - 제안: 없음 — 순수 리팩터로 판정.

- **[INFO]** `export` 추가는 기존 test-seam 컨벤션을 그대로 따르며 프로덕션 표면을 넓히지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:203-204`
    (`/** @internal — unit-test seam only. ... */` + `export function sseErrorDetail`)
  - 상세: 같은 파일이 이미 `safeApiBaseFromQuery`(`:170`)·`refreshDelayMs`/
    `TOKEN_REFRESH_MIN_DELAY_MS`(`:26`, re-export)를 동일한 이유(단위 테스트 seam)로
    export 하고 있었다 — 이번 추가는 새 패턴이 아니라 기존 패턴의 세 번째 사례다. 프로덕션
    코드에서 `use-widget.ts` 를 import 하는 파일은 `widget-app.tsx` 하나뿐이며 거기서는
    `useWidget` 만 가져온다(`grep -rln 'use-widget"' src | grep -v test` → `widget-app.tsx`
    한 곳, import 목록도 `useWidget` 단독 — `codebase/channel-web-chat/src/widget/widget-app.tsx:4`).
    `sseErrorDetail` 은 어차피 `useWidget()` 본문에서 무조건 호출되므로(`:500`) `export` 여부와
    무관하게 프로덕션 번들에 포함된다 — `export` 는 번들 결과·트리셰이킹 대상 여부를 바꾸지
    않고, 테스트 파일이 import 할 수 있는 진입점만 하나 늘린다. `@internal` JSDoc 태그를 강제하는
    빌드/린트 설정(api-extractor 류)은 없어 규약적 표식일 뿐이지만, 이미 같은 방식으로 3개의
    export 가 공존하고 있어 이번 추가가 그 컨벤션을 처음 도입하는 것도 아니다.
  - 제안: 없음 — 기존 컨벤션과 일치, 실질적 표면 확대 없음.

- **[INFO]** 주석 축약 2곳은 정보 손실 없이 포인터로 치환됐다 — 대상 앵커 내용 확인 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:616`
    (`"근거는 아래 @returns 참조"` → 실제 근거는 `:632-634` 에 온전히 서술돼 있음 확인),
    `:863-864`(`"근거는 seedWaitingFromStatus 의 @returns"` → 같은 `:632-634` 블록을 가리킴,
    실제로 존재)
  - 상세: 두 포인터 모두 겨냥하는 `@returns` 블록(`seedWaitingFromStatus` JSDoc,
    `:624-636`)이 실제로 "`sessionRef.current` 를 읽어야 하는 이유(캡처한 지역 변수 대신 —
    401 refresh 가 토큰을 교체하므로)" 를 온전히 서술하고 있음을 `Read` 로 대조했다. 요약이
    아니라 중복 제거이므로 코드 동작에는 영향이 없고(주석은 런타임에 무해), 문서 정확성
    측면에서도 참조 무결성이 성립한다.
  - 제안: 없음.

- **[INFO]** `runApplyConfig` catch 에 추가된 것은 순수 주석 블록뿐 — 로직 변화 없음, 확인 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1268-1277`
    (신규 주석), `:1278`(`dispatch({ type: "ERROR", message: errMessage(e) })`, 변경 없음)
  - 상세: catch 블록의 유일한 실행문은 이전과 동일한 `dispatch(...)` 한 줄이다. 새로 추가된
    9줄은 전부 `//` 주석이며 조건문·분기·부수효과를 추가하지 않는다.
  - 제안: 없음.

- **[INFO]** 직전 라운드(`10_24_54`) WARNING("`runApplyConfig` 에 stale 가드 없음")의 "가드
  대신 문서화" 처분 — 근거 주장(checkpoint 2 이후 동기 구간뿐)을 직접 재현·검증했고, 타당한
  처분으로 판정
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1173-1243`(`applyConfig` 전체),
    `plan/in-progress/webchat-auth-session-status-reconcile.md:246-261`(신규 등재 항목)
  - 상세: 커밋 메시지·주석의 핵심 주장 3가지를 각각 소스로 대조했다.
    1) `isEmbedAllowed`(`:1175`)는 함수 내부가 전부 try/catch 로 감싸져 있어(별도 확인,
       fail-open) 여기까지 던지지 않는다.
    2) `seedWaitingFromStatus`(`:677-756`)는 async 함수 전체가 단일 `try { ... } catch (err)
       { ... }` 로 덮여 있고, catch 갈래마다 `return "stale"/"ended"/"continue"` 로 **값을
       반환**하지 재-throw 하지 않는다(`:723-753` 전체 확인). 401 분기가 위임하는
       `recoverFromExpiredToken` 도 이 catch **안쪽**에서 호출되므로 그 결과가 무엇이든
       `applyConfig` 의 `await seedWaitingFromStatus(...)`(`:1214`) 자체는 절대 reject 하지 않는다.
    3) `applyConfig` 에서 checkpoint 2(`isAttemptStale(attempt)`, `:1225`) 이후 코드
       (`:1226-1242`)는 `sessionRef.current` 읽기·필드 대입·`openStream(live, "0")` 호출·
       `scheduleRefresh()` 호출로만 구성되며 그 사이 `await` 가 하나도 없다(직접 `Read` 로
       전 구간 스캔 확인). `openStream`(`:480-508`)은 `useCallback` 이되 함수 본문 자체가
       `async` 가 아닌 동기 함수이고, 유일한 throw 가능 지점(`client.openStream(...)` →
       `EventSource` 생성자)도 동기 호출이다. 따라서 "checkpoint 2 직후엔 동기 구간만 있고,
       그 구간의 유일한 throw 원인은 이미 유효성이 확인된 attempt 의 EventSource 생성 실패뿐"
       이라는 주장은 현재 코드에서 사실이다.
    - 처분 자체의 위생도 확인: `runApplyConfig` catch 안 주석(`:1276-1277`)과
      `webchat-auth-session-status-reconcile.md` 의 미체크 항목(`- [ ] checkpoint 2 뒤 await
      추가 시 — attempt 토큰 노출 또는 동등한 가드 도입`, `:261`)이 트리거 조건을 동일한
      말로 명시하고 서로를 가리켜, 향후 `applyConfig` 에 checkpoint 2 뒤 `await` 가 추가되는
      편집이 있을 때 재검토가 걸릴 지점이 코드와 plan 양쪽에 남아 있다. 이는 "유예 근거는
      실측해야 한다"·"살아있는 결함은 문서만으로 닫지 않는다" 는 이 프로젝트 반복 교훈에
      부합하는 형태다 — **가드가 아니라 문서**로 닫았지만, 닫힌 사유가 검증 가능한 구체적
      코드 상태(모든 await 지점 나열)이고, 재개 트리거가 모호하지 않다(구체적 편집 패턴).
  - 제안: 없음(이번 판정에 한함) — 다만 이 안전성은 여전히 "구조"가 아니라 "규율"에
    의존한다는 원래 WARNING 의 본질적 리스크는 사라지지 않았다. `applyConfig` 를 만지는
    후속 편집자가 등재된 트리거 조건을 놓치면(plan 을 안 읽고 코드만 보고 `await` 를
    추가하면) 재도입 가능하므로, 코드 쪽 트리거 주석(`:1276-1277`)이 유일한 실질 방어선이다.
    구조적 가드(예: `applyConfig` 가 자신의 `attempt` 를 캡처한 지역 catch 를 두는 것)로
    전환할 여지가 여전히 남아 있다는 점은 plan 항목이 스스로 인지하고 있어 새로 지적할
    필요는 없다.

## 요약

이번 라운드(`8eb223c19`)의 "동작 변경 0" 주장은 검증 결과 **성립한다**. `sseErrorDetail` 의
모듈-스코프 이동은 순수 함수 재배치로 hoisting·클로저·의존성 배열 어디에도 관찰 가능한 차이를
만들지 않고(직접 소스 대조 + `vitest`/`tsc` 통과로 교차 검증), `export` 추가는 이미 3개
export 가 존재하는 test-seam 컨벤션의 연장이며 유일한 프로덕션 소비처(`widget-app.tsx`)는
`useWidget` 만 가져와 표면 확대의 실질 영향이 없다. 주석 축약 2곳은 참조 대상에 원문 내용이
그대로 남아 있어 정보 손실이 없고, `runApplyConfig` 변경은 순수 주석 추가로 실행 경로에
개입하지 않는다. 직전 WARNING(stale 가드 부재)에 대한 "가드 대신 불변식 문서화 + plan 트리거
등재" 처분은 그 근거 주장(모든 내부 await 자체 방어, checkpoint 2 이후 동기 구간뿐)을 소스
레벨에서 재현 검증한 결과 사실과 일치했고, 재개 조건이 코드·plan 양쪽에 구체적으로 박혀 있어
타당한 처분으로 판정한다. 다만 이는 구조적 가드가 아니라 규율 의존이라는 잔여 취약성 자체는
없어지지 않았으며(이미 plan 이 스스로 인지·추적 중), 신규 지적 사항은 아니다.

## 위험도

NONE — 이번 delta 는 관찰 가능한 동작 변화가 없는 순수 리팩터/문서/테스트 추가로 확인됐고,
새로 도입된 side effect 는 발견하지 못했다.

STATUS: REVIEWED
