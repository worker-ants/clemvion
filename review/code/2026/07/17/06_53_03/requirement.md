# 요구사항(Requirement) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts` + `use-widget-eager-start.test.ts`
(review/code/2026/07/17/02_31_18/* 는 이전 라운드 리뷰 산출물의 신규 커밋 — 문서이며 요구사항 충족 분석
대상이 아니므로 본 리뷰는 프로덕션 코드 2개 파일에 집중했다.)

## 검증 방법
- `npx vitest run src/widget/use-widget-eager-start.test.ts` / `src/widget` 전체 실행(통과 확인).
- **mutation 검증 직접 재현**: W2(staleness guard) · W1(410 dedup) 각각 무력화 후 재실행 → RESOLUTION.md
  주장대로 각 1건씩 실패 확인 후 원복(diff 없음 확인).
- `npx tsc --noEmit -p .` clean 확인.
- spec 대조: `spec/7-channel-web-chat/1-widget-app.md` §3.1(표 + `replay_unavailable` 산문 + Rationale
  R7), `3-auth-session.md`(410 storage 정리 규칙), `2-sdk.md`(`conversationEnded.reason` 값 집합),
  `spec/5-system/14-external-interaction-api.md`(EIA-IN-12 410 정의).
- 신규 회귀 시나리오를 직접 작성해 재현 실험(아래 CRITICAL #1) 후 코드는 원상복구, 실험용 테스트는 커밋하지 않음.

## 발견사항

- **[CRITICAL]** `sendCommand` 의 410 처리(W1 fix)가 **같은 세션 내 중복 통지는 막지만, 세션이 교체된 뒤
  도착한 stale 410 이 새(살아있는) 세션을 오종료시키는 것은 막지 못한다** — `seedWaitingFromStatus` 에
  추가된 staleness guard(`sessionRef.current !== session`, W2)와 대칭이 되어야 할 가드가 `sendCommand`
  에는 없다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:412-432`(`sendCommand`, 특히 420-425
    catch 블록) vs `:300`(`seedWaitingFromStatus` 의 staleness guard, 대칭 부재).
  - 상세: `sendCommand` 는 함수 진입 시 `const session = sessionRef.current;` 로 세션을 캡처하지만,
    `await client.interact(...)` 가 실패해 410 로 reject 되는 catch 블록은 그 `session` 이 여전히
    `sessionRef.current` 와 동일한지 재검증하지 않고 `finalizeEnded("gone")` 을 무조건 호출한다.
    재현 시나리오: (1) 사용자가 메시지를 보냄 → `sendCommand`(세션 A) 의 `interact()` 가 in-flight,
    (2) 응답 도착 전 사용자가 "새 대화"(`newChat()`) 를 눌러 `resetSessionRefs()` 가 세션 A 를 정리하고
    `endedRef.current = false` 로 재무장한 뒤 `start()` 가 새 세션 B 를 시작·`sessionRef.current` 를 B 로
    교체, (3) 뒤늦게 세션 A 의 `interact()` 가 `410 Gone`(EIA-IN-12 — "종료된 execution 에 대한 명령")
    으로 reject → `finalizeEnded("gone")` 호출 시 `endedRef.current` 는 (2) 에서 이미 `false` 로
    재무장돼 있으므로 가드를 그대로 통과해 **세션 B 의** `teardownSession()`(SSE close·refresh timer
    정리·storage 삭제) + `dispatch({type:"ENDED"})` + host `conversationEnded` 발사를 수행한다. 즉 아무
    문제 없이 진행 중인 새 대화가 옛 세션의 stale 오류 응답 때문에 갑자기 `[ended]` 로 전이하고 host 는
    잘못된 종료 통지를 받는다.
  - **실측 재현**: 위 시나리오를 그대로 구현한 테스트를 (검증용, 비커밋) 추가해 실행한 결과
    `expect(result.current.state.phase).not.toBe("ended")` 가 **실패**(`phase === "ended"`)함을 직접
    확인했다 — 가상의 우려가 아니라 현재 diff 의 실제 동작이다.
  - 이 결함은 이번 diff 가 새로 만든 회귀는 아니다(수정 전 코드도 동일하게 무조건
    `dispatch(ENDED)+sendEvent` 였다). 그러나 이번 diff 의 명시된 목적이 정확히 "동일 계약 없이 개별
    호출부가 우연히만 안전한 구조를 제거"(W2 JSDoc, RESOLUTION.md W2/W5 행)였고, 바로 그 패턴의 staleness
    guard 를 `seedWaitingFromStatus` 세 호출부에는 추가하면서 `sendCommand` 의 `finalizeEnded` 호출에는
    빠뜨렸다는 점에서, 이번 fix 가 스스로 표방한 "세 호출부가 같은 반환 계약으로 명시 게이팅" 원칙이
    `finalizeEnded` 의 네 호출부 중 하나(`sendCommand`)에는 적용되지 않은 불완전한 구현이다. 직전
    라운드 8개 reviewer(특히 concurrency·side_effect) 도 이 cross-session 변형은 짚지 못했다 — W1 은
    "같은 세션 내 SSE terminal→410 중복 통지"만 다뤘다.
  - 제안: `sendCommand` catch 블록에서 `finalizeEnded` 호출 전에 `if (sessionRef.current !== session) return;`
    (또는 `finalizeEnded` 자체에 세션 인자를 받아 내부에서 동일 staleness 검사)를 추가. 회귀 테스트: "in-flight
    명령 대기 중 새 대화로 세션 교체 → 옛 명령이 뒤늦게 410 을 받아도 새 세션은 `ended` 로 전이하지 않는다."

- **[WARNING]** `finalizeEnded` JSDoc 이 "두 진입점이 공유한다"고 서술하지만 실제로는 diff 이후 **네
  곳**(`handleEiaEvent` SSE terminal, `seedWaitingFromStatus` REST 폴백 terminal, `sendCommand` 410,
  `endConversation`)이 호출한다 — 의도(주석)와 구현(실제 호출부 수)이 어긋난다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:169-172`(JSDoc "두 진입점이 공유한다")
    vs 실제 호출 4곳: `:231`, `:307`, `:425`, `:577`.
  - 상세: JSDoc 은 이번 diff 이전(W1/W4 fix 전) 시점의 서술이 그대로 남았다. W1(410 편입)·W4
    (`endConversation` 편입) 둘 다 이 JSDoc 을 갱신하지 않았다. 기능적 결함은 아니나, RESOLUTION.md 가
    스스로 "처분 기록의 부정확성"을 두 차례 지적받은 직후의 라운드라는 점에서 같은 종류의 문서-구현
    드리프트가 이번에도 재발했다는 것은 지적할 가치가 있다.
  - 제안: JSDoc 을 "네 진입점이 공유한다 — SSE terminal / REST 폴백 terminal / 410 Gone / 사용자 종료"로
    갱신.

- **[INFO]** RESOLUTION.md 의 "`use-widget-eager-start.test.ts` 33 passed / widget 전체 127 passed" 수치가
  현재 스냅샷 실측(`npx vitest run src/widget`)과 다르다 — eager-start 는 33 passed 로 일치하나 widget
  전체는 **130 passed**(127 아님). RESOLUTION.md 자신이 "주장과 실제 대조 필요"를 교훈으로 명시한 직후의
  문서라 사소하지만 언급한다. 기능적 영향 없음(단순 카운트 오차, 다른 위젯 테스트 파일에 이후 추가된
  케이스가 있을 수 있음).
  - 위치: `review/code/2026/07/17/02_31_18/RESOLUTION.md`(검증 절 "127 passed").

- **[INFO]** 로컬 실측 중 `vi.useFakeTimers({ shouldAdvanceTime: true })` 를 쓰는 신규 W6 테스트가 파일
  병렬 실행 + `--reporter=verbose` 조합에서 1회 `refreshCalls` 관련 flaky 실패(원인 불명 diff 값 포함)를
  보였으나, 이후 `--no-file-parallelism` 및 8회 반복 재실행에서는 전부 통과해 재현하지 못했다 — 당시
  로컬에서 직전 mutation 검증(sed 로 코드 임시 변경 후 즉시 여러 vitest 프로세스를 연속 실행)으로 인한
  일시적 리소스 경합일 가능성이 높다. 결정적 결함으로 단정할 근거는 없으나, `shouldAdvanceTime:true` 는
  본질적으로 실제 wall-clock 에 의존하므로 CI 부하가 높은 환경에서 낮은 확률의 flake 여지가 있다는 점만
  기록한다(추가 조치 불필요, 후속 관찰 권장).

## Spec fidelity 확인 (일치)

- `replay_unavailable` 인라인 주석(`use-widget.ts:218-223`)이 `spec/7-channel-web-chat/1-widget-app.md`
  §3.1(104-116행, 특히 109-116 "단, 스냅샷이 이미 terminal 이면...") 과 line-level 로 동형 — W3 fix 정확.
- `finalizeEnded("gone")` 의 `reason="gone"` 값이 `2-sdk.md:99` 의 `conversationEnded.data.reason` 예시
  (`gone = 410`)와 일치.
- 410 수신 시 즉시 storage 제거(`teardownSession`→`clearSession`) 가 `3-auth-session.md:79` "명령 응답
  `410 Gone` 수신 시 위젯이 즉시 storage 항목을 제거한다" 와 일치(단, 위 CRITICAL 시나리오에서는 **잘못된
  세션의** storage 를 지우는 부작용이 있다는 점이 문제).
- `seedWaitingFromStatus` JSDoc 요약 줄(`:262-263`)이 확장된 책임(terminal 정리)을 반영 — I1 fix 정확.
- `SeedOutcome` 3-state 전환은 모듈 비공개 내부 타입이라 spec 문서화 대상 아님(spec 침묵 영역, 문제
  없음).

## 기타 점검 결과 (문제 없음)
- TODO/FIXME/HACK/XXX 주석: 두 파일 모두 없음.
- `endConversation` 의 `resetSessionRefs(); finalizeEnded(reason);` 순서는 `endedRef` 를 false→true 로
  재무장 후 실행되므로 실제로 종료 시퀀스를 수행한다(의도대로 동작, 실측 확인). `teardownSession()` 이
  두 번(각각으로부터 한 번씩) 호출되는 점은 기능적으로 무해한 중복(멱등)이며 별도 조치 불요.
- `seedWaitingFromStatus`/`finalizeEnded`/`sendCommand`(410 dedup 부분) 세 곳 모두 모든 코드 경로에서
  적절한 값을 반환(`SeedOutcome`/`boolean`)함을 확인 — 반환 누락 경로 없음.

## 요약

이번 diff 는 직전 라운드(02_31_18)가 지적한 WARNING 7건 중 W1(410 dedup)·W2(staleness 3-state)·W3(주석
동형화)·W4(`endConversation` 통합)·W5/W6/W7(테스트 보강)를 코드·테스트 레벨에서 정확히 구현했고, 이는
mutation 재현(W1·W2 각 무력화 시 정확히 1건 실패)으로 직접 검증됐다. spec(`1-widget-app.md` §3.1,
`3-auth-session.md`, `2-sdk.md`) 과의 line-level 일치도도 높다. 다만 W1 이 좁게 정의한 "동일 세션 내
SSE-terminal→410 중복 통지" 범위 밖에 **"세션 교체 후 도착한 stale 410 이 새 세션을 오종료시키는"** 별개의
CRITICAL 등급 race 가 실측으로 확인됐다 — `seedWaitingFromStatus` 에 적용한 staleness guard 패턴이
`sendCommand` 의 `finalizeEnded` 호출에는 대칭적으로 적용되지 않았다. 이 회귀는 이번 diff 가 새로 만든
것은 아니지만, 이번 diff 가 명시적으로 "네 호출부 모두 같은 반환 계약/가드로 통일"을 목표로 삼았던
바로 그 범위 안에서 발견된 누락이라 본 라운드의 정정 대상으로 보고한다.

## 위험도
CRITICAL
