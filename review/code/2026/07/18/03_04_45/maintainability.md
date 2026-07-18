# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight (03_04_45)

## 범위·방법

`prompt_file` payload 는 이전 리뷰 라운드(01_44_21)의 산출물(`meta.json`/`requirement.md`/`scope.md`/
`security.md`/`side_effect.md` 등, review 산출물 자체가 diff 로 잡힌 것)을 담고 있어 이번 라운드의
실제 검토 대상인 커밋 `94b66b212`(코드 diff)와 직접 겹치지 않는다. 호출자 지시에 따라
`git show 94b66b212`로 대상 커밋을 직접 확보해 아래 분석을 수행했다 — payload 미신뢰, 저장소 실측
우선 원칙.

대상 커밋 `94b66b212`("openStream 게이트 2곳을 개별 고정 + start() 누락 dep")은 직전 라운드(02_25_54)
가 지적한 두 항목을 처리한다:
1. `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 43줄 mock 셋업 중복을
   `raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼로 추출 + 대칭 회귀 테스트 2건(**본 리뷰의
   핵심 검토 대상**).
2. `codebase/channel-web-chat/src/widget/use-widget.ts:685` — `start()` useCallback deps 배열에
   `sessionEstablished` 1줄 추가(ESLint exhaustive-deps 정합).

직전 라운드(02_25_54)와 그 바로 다음 커밋(`fb78bfe60`)의 산출물도 함께 대조해 "구조 강제 follow-up 이
`useEiaSession` 분리 plan 으로 이관됐는지"를 검증했다.

---

## 발견사항

- **[정상 확인] `raceStartVsResendSingleStream` 헬퍼가 실제 중복(약 40줄)을 제거하고, 두 테스트를
  파라미터 하나로 명확히 구분한다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3412-3489`
  - 상세: 커밋 전 상태(`94b66b212^`)를 직접 대조한 결과, 이전엔 `it()` 블록 하나뿐이었고 이번 커밋이
    바로 그 자리에 **두 번째 대칭 테스트**(D 가 먼저 resolve 하는 케이스)를 추가하면서 헬퍼로
    추출했다 — 즉 "이미 있던 중복을 나중에 청소"가 아니라 "복사-붙여넣기로 두 번째 테스트를 만들면
    생겼을 중복을 만들기 전에 막은" 선제적 추출이다. 실제로 제거된 블록(`let esCount = 0;` ~
    `waitingAt` 팩토리 정의 끝, 3413~3452행)은 EventSource stub 클래스 + `fetch` deferred-resolver
    스텁 + `webhook202`/`waitingAt` 응답 팩토리로 약 40줄이며, 커밋 메시지의 "43줄"과 근사하게
    일치한다(경계 셈법에 따른 소폭 편차, 과장 아님).
  - 두 `it()` 호출부:
    ```
    raceStartVsResendSingleStream(false)  // C(start) 먼저 → applyConfig 게이트 고정
    raceStartVsResendSingleStream(true)   // D(재전송) 먼저 → start() 게이트 고정
    ```
    함수 내부의 `const [first, second] = resendResolvesFirst ? [1, 0] : [0, 1];` 를 인덱스 매핑까지
    직접 대조했다 — `statusResolvers[0]`=C(start 자신의 getStatus, 먼저 push), `[1]`=D(재전송의
    getStatus, 나중 push). `resendResolvesFirst=true` 면 `[first,second]=[1,0]`, 즉 D 를 먼저
    resolve — 파라미터 이름과 실제 동작이 정확히 일치한다(오프바이원 없음).
  - `it()` 설명 문자열이 "(start 먼저 — applyConfig 게이트)" / "(재전송 먼저 — start() 게이트)"로
    각 호출이 무엇을 고정하는지 즉시 드러내, 두 테스트가 "resolve 순서만 다르다"는 관계를 코드
    한 곳(함수 시그니처)과 테스트 이름 두 곳(호출부) 모두에서 일관되게 전달한다.
  - 조치 불필요.

- **[INFO]** 파라미터 `resendResolvesFirst: boolean` 은 이름 자체는 명료하나 호출부에서는
  boolean-trap 패턴(위치 인자 `true`/`false`만으로는 즉시 의미 파악 어려움)
  - 위치: `use-widget-eager-start.test.ts:3480,3486` (`raceStartVsResendSingleStream(false)` /
    `raceStartVsResendSingleStream(true)`)
  - 상세: 파라미터 이름은 self-documenting 하지만 호출부(`(false)`, `(true)`)만 보면 이름을 다시
    확인해야 의미가 드러난다. 다만 바로 옆 `it()` 설명 문자열이 "start 먼저"/"재전송 먼저"로 즉시
    풀어주고 있고, 호출부가 2곳뿐이며 helper 가 해당 `describe` 블록에 지역 스코프로 한정돼 있어
    실질적 혼동 위험은 낮다. blocking 사유는 아니다.
  - 제안(선택): 필요하다면 `raceStartVsResendSingleStream({ resendResolvesFirst: true })` 형태의
    옵션 객체나 `"start-first" | "resend-first"` 리터럴 유니언으로 바꾸면 호출부만 봐도 의미가
    드러난다. 호출부가 2곳에 그치는 테스트 전용 헬�퍼라 지금 형태도 실용적으로는 무리 없음 — 조치는
    선택적.

- **[INFO]** 새 헬퍼는 파일 상단의 재사용 가능한 설치 헬퍼(`installFetch`/`installControllableEventSource`/
  `installControllableSse`)를 재사용하지 않고 자체 EventSource/fetch 스텁을 인라인했다 — 근거 있는
  선택으로 확인됨
  - 위치: `use-widget-eager-start.test.ts:41-128`(기존 helper 3종) vs `:3412-3453`(신규 인라인 스텁)
  - 상세: `installFetch()`는 GET `/api/external/executions/e1` 케이스 자체가 없고(webhook POST/
    `/interact`만 처리), 세 helper 모두 응답을 **즉시 resolve**하는 구조라 이 테스트가 필요로 하는
    "두 getStatus 호출을 배열에 쌓아두고 임의 순서로 나중에 수동 resolve"라는 요구(레이스 재현의
    핵심)를 만족 못 한다. `installControllableEventSource()`도 최신 인스턴스(`getEs`)만 노출할 뿐
    생성 횟수 카운터(`esCount`)가 없어 "몇 번 생성됐는가"를 직접 검증하는 이 테스트엔 맞지 않는다.
    따라서 인라인 스텁은 재사용 누락이 아니라 기존 helper 의 계약이 이 시나리오와 다르기 때문에
    나온 정당한 선택이다.
  - 조치 불필요. (참고: 이 EventSource 카운팅 스텁 자체가 향후 다른 레이스 테스트에서도 필요해지면
    `installCountingEventSource()`류로 승격할 여지는 있으나, 현재 호출부가 1곳(헬퍼 내부)뿐이라
    지금 승격은 과도한 선제 추상화(YAGNI 위반) — 지금 그대로가 적절.)

- **[INFO]** 헬퍼 선언이 파일 상단 helper 들의 `/** JSDoc */` 관례 대신 `//` 라인 코멘트로 문서화됨
  - 위치: `use-widget-eager-start.test.ts:3411-3412` (`// resolve 순서를 파라미터로 받는 공용
    헬퍼 — 43줄 mock 셋업 중복을 없앤다...` 바로 다음 줄에 `async function ...`)
  - 상세: 파일 상단의 모듈 스코프 helper(`installFetch`, `installControllableEventSource`,
    `installControllableSse`, `boot`, `flushAsync`, `sendHostCommand`, `webhookPosts`,
    `interactCalls`)는 전부 `/** ... */` JSDoc 블록으로 문서화되는 반면, 이 신규 helper 는 바로 위
    22줄짜리 `//` 서술형 코멘트(테스트 배경·수정 이력·ai-review 라운드 back-reference)의 연장선으로
    자연스럽게 `//` 를 이어 썼다. 다만 이 helper 는 `describe` 블록에 지역 스코프로 한정된, 재사용
    범위가 이 2개 `it()`로 제한된 테스트 전용 함수라 — 파일 전역에서 여러 describe 가 공유하는
    모듈급 API(JSDoc 대상)와는 성격이 다르다. 우선순위 낮은 스타일 미세 불일치로, 실질 가독성
    저하는 크지 않다.
  - 제안(선택): 일관성을 더 높이려면 `@param resendResolvesFirst` 한 줄을 포함한 `/** */` 로
    바꿀 수 있으나 필수는 아님.

- **[정상 확인]** `use-widget.ts` 의 deps 배열 수정은 최소·정확한 1줄 변경, 기존 컨벤션과 일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:685`
  - 상세: `[openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale]` →
    `[..., isStale, sessionEstablished]`. ESLint exhaustive-deps 가 지적한 누락 항목 정확히
    1개만 추가했고, 그 외 로직·포맷은 무변경. 파일 전체에서 이미 `[finalizeEnded, isStale,
    sessionEstablished]`(`:598` 부근, `seedWaitingFromStatus` 자신의 deps)처럼 `sessionEstablished`
    를 deps 에 명시하는 패턴이 확립돼 있어 이번 추가는 기존 컨벤션을 그대로 따른다. 스코프 크리프
    없음.
  - 조치 불필요.

- **[정상 확인]** 구조 강제(structural enforcement) follow-up 이 코드에 즉흥 반영되지 않고
  `useEiaSession` 분리 plan 으로 명시 이관됨 — 스코프 규율 확인
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트 4번째 항목("seed 게이트 +
    openStream 게이트 짝의 구조적 강제 검토 (ai-review 02_25_54 maintainability)")
  - 상세: 02_25_54 라운드가 지적한 것은 두 갈래였다 — (a) *테스트* mock 중복(43줄) → 이번 커밋
    `94b66b212`이 헬퍼 추출로 직접 코드 fix, (b) *프로덕션 코드*의 구조적 취약성(=
    `if (sessionEstablished()) return;` 가드가 `start()`(`use-widget.ts:673`)와 `applyConfig`
    복원 분기(`:1018`) 두 곳에 손으로 복제돼 있어 3번째 seed→openStream 호출부가 생기면 "비대칭
    가드 누락"이 재발할 여지 — wrapper 로 구조적으로 강제하는 리팩토링 필요). `grep` 으로 두 호출부
    (`:673`, `:1018`)를 직접 확인해 이 설명이 현재 코드와 일치함을 검증했다. `94b66b212`는 (b)를
    건드리지 않았고, 바로 다음 커밋 `fb78bfe60`(`docs: 02_25_54 비-코드 WARNING 정합 + 잔여
    문서화`, 커밋 시각 02:52:53 — `94b66b212`의 02:51:13 직후)이 `webchat-usewidget-extraction.md`
    체크리스트에 위 항목을 추가하며 "(현재는 두 호출부 모두 대칭 회귀 테스트로 고정돼 있어
    비차단)"이라고 명시했다. 즉 즉시 필요한 안전망(대칭 테스트)은 이번 커밋이 채우고, 더 큰
    아키텍처 리팩토링(훅 분리 + wrapper 구조화)은 기능 변경 없음이 명시된 별도 백로그 plan 으로
    미뤄 두 층위(즉시 fix vs 구조 개선)를 혼동 없이 분리했다.
  - 조치 불필요 — 스코프 관리가 올바르게 동작한 사례.

---

## 요약

커밋 `94b66b212`는 직전 라운드(02_25_54)가 지적한 두 품질 항목을 정확히 그 범위 안에서 처리한다.
핵심 검토 대상인 `raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼는 사후 청소가 아니라
"두 번째 대칭 테스트를 복사-붙여넣기로 만들었다면 생겼을 약 40줄의 mock 셋업 중복을 만들기 전에
막은" 선제적 추출이며, 커밋 전/후 버전을 직접 대조해 이 점을 확인했다. 파라미터 하나
(`resendResolvesFirst`)로 두 테스트(C 먼저/D 먼저)를 구분하는 방식은 내부 인덱스 매핑까지 검증한
결과 오류 없이 정확하고, `it()` 설명 문자열이 각 호출의 의도(어느 게이트를 고정하는지)를 즉시
드러내 두 테스트의 관계가 명확하다. 호출부의 raw boolean(`(false)`/`(true)`)이 살짝의
boolean-trap 성향을 갖고 helper 문서화가 파일 상단 관례인 JSDoc 대신 `//` 를 썼다는 두 가지는
실질적 위험이 없는 선택적 개선 여지로만 기록한다(INFO). 기존 top-of-file 설치 helper 를 재사용하지
않고 자체 스텁을 쓴 것도 기존 helper 들의 계약(즉시 resolve, 생성 카운터 없음)이 이 레이스
재현 요구와 맞지 않는다는 근거가 확인돼 정당한 선택이다. `use-widget.ts` 의 deps 배열 수정은
ESLint 가 지적한 항목 하나만 정확히 채운 최소 diff 로 기존 컨벤션과 일치한다. 가장 중요한
확인은 구조적 follow-up(gate-pairing 을 wrapper 로 강제하는 아키텍처 리팩토링)이 이번 커밋에
즉흥적으로 섞여 들어가지 않고 `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트에
"ai-review 02_25_54 maintainability" 출처를 명시한 채 정확히 이관됐다는 점이다 — 즉시 안전망
(대칭 회귀 테스트)과 구조 개선(훅 분리)을 혼동 없이 분리한 스코프 규율이 확인됐다. 신규
CRITICAL·WARNING 없음.

## 위험도

NONE
