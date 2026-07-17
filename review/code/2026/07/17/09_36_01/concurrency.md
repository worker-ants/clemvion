# 동시성(Concurrency) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`(C1 fix + W2 fix), `use-token-refresh.ts`(W5 fix,
`cancelledRef`→`worldGenRef`), `use-token-refresh.test.ts`(W5 회귀 테스트), `codebase/channel-web-chat/src/lib/widget-state.ts`
(W4 — reducer `ended` 가드), `widget-state.test.ts`, `use-widget-eager-start.test.ts`(C1/W2/W3 회귀 테스트 + `flushAsync()`
도입), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `CHANGELOG.md`. 직전 라운드(`08_29_33`)가 발견한
CRITICAL 1건(C1, 부팅 정지 회귀) + WARNING 2건(W2·W5, 승격된 활성 버그) + W3(테스트 공백)·W4(리듀서 defense-in-depth)를
닫는 조치 커밋의 재검토다.

**검증 방법**: diff 조각이 아니라 3개 소스 파일 전체(`use-widget.ts` 807줄, `use-token-refresh.ts` 111줄,
`widget-state.ts` 200줄)를 통독해 문맥을 확인했고, `configRef.current` 대입 지점을 파일 전수 검색했으며,
`npx vitest run`으로 관련 3개 테스트 파일(및 채널-웹챗 전체 스위트)을 실제 실행해 정적 분석을 교차검증했다(아래
발견사항 7 참조 — 이 과정에서 리뷰 대상 스냅샷과 실제 워크트리 상태의 괴리를 발견했다).

## 발견사항

- **[WARNING]** `teardownSession()`의 pre-config 조기 return이 **메모리 상태**는 맞게 무효화하지만 **`sessionStorage`
  축**의 "새 대화" 의도까지 삼킨다 — C1 fix의 경계 조건
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `teardownSession()`(L187-206, 특히 신규
    `if (!configRef.current) return;` L198) ↔ `applyConfig()`의 `configRef.current = cfg;` 이후 `loadSession()` 호출부
    (L695-702).
  - 상세: 부모 질문 1("정당한 무효화를 삼키는 경우가 있는지")에 대한 핵심 답변이다. `configRef.current`가 **이미
    확립된 뒤**에는 이 가드가 살아있는 자원(세션·스트림·타이머)의 무효화를 막는 경우가 없다(아래 발견사항 2 참조 —
    그 절반은 반증됨). 그러나 **아직 확립되지 않은(pre-config) 구간**에서는 다른 종류의 누락이 있다:
    `teardownSession()`은 "정리할 세션·스트림·타이머가 없다"는 전제로 전체를 no-op 처리하지만, 이 전제는
    **in-memory 상태에만** 참이다. `sessionStorage`는 이전 마운트/이전 페이지 로드가 남긴 별도의 영속 축이라, 지금
    이 함수 호출이 정리를 건너뛴다고 해서 저장소의 옛 세션이 사라지지 않는다. 재현 경로: (1) 이전 대화가
    `sessionStorage`에 만료 전 세션으로 남아있다 (2) 위젯이 재마운트되어 `applyConfig()`가 `embed-config` 왕복 중이다
    (3) 이 창에서 host가 `resetSession`(또는 `newChat()`)을 보낸다 → `teardownSession()`이 `configRef.current`가 null이라
    조기 return, `pending "새 대화"` 의도가 아무 상태에도 기록되지 않고 사라진다 (4) `embed-config`가 뒤늦게 resolve →
    `configRef.current = cfg` → `loadSession(cfg.triggerEndpointPath)`가 **이전에 남아있던 세션을 그대로 복원**한다 →
    host가 명시적으로 요청한 "새 대화"가 조용히 무시되고 옛 대화가 이어진다. 이는 데이터 손상이나 크로스세션 유출이
    아니라 "의도가 유실되고 옛 상태가 부활한다"는, 이 다중 라운드 리팩터가 계속 잡아 온 것과 **정확히 같은 버그
    계열**(유령 표면 부활)의 변종이다. C1 회귀 테스트(`embed-config in-flight 중 host resetSession → config 확립`)는
    `beforeEach`의 `window.sessionStorage.clear()`로 시작해 저장소가 항상 비어 있으므로 이 경로를 커버하지 않는다
    (grep 확인 — 해당 테스트에 `sessionStorage.setItem` 없음).
  - **교차검증**: 이 항목을 분석하는 도중 `git diff HEAD`로 라이브 워크트리를 재확인한 결과, 정확히 이 간극을 겨냥한
    수정이 **이미 적용되어 있음을 발견했다** — `pendingResetRef`(부팅 중 리셋 요청을 기억했다가 `applyConfig()`가
    `configRef.current`/`clientRef.current`를 확립한 직후 `loadSession()` **이전**에 `clearSession(cfg.triggerEndpointPath)`로
    이행) + 신규 회귀 테스트("저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다"), 주석에
    `ai-review 2026-07-17 09_36_01 — side_effect·security 독립 지적`이라 명시되어 있다(본 라운드의 형제 리뷰어가 이미
    발견·수정). 코드를 직접 추적해 이 수정이 논리적으로 올바름을 확인했다 — `pendingResetRef`는 `worldGenRef`와
    별개 축(메모리 무효화 vs 저장소 무효화)이고, 두 함수 간 읽기/쓰기가 항상 동기 블록 안에서 일어나 JS
    run-to-completion에 의해 경쟁이 없다.
  - 제안: (이미 반영됨) 위 `pendingResetRef` 수정 + 회귀 테스트를 그대로 채택 권장. 리뷰 대상 스냅샷(prompt_file)
    기준으로는 이 항목이 열린 gap이었으므로 기록으로 남긴다.

- **[INFO]** Q1 나머지 절반 — `configRef.current`는 확립 후 결코 `null`로 되돌아가지 않는다(RESOLUTION.md 주장 확인,
  반증 실패)
  - 위치: `use-widget.ts` 전체에서 `configRef.current =` 대입 지점은 정확히 2곳뿐 — `applyConfig()`의
    `configRef.current = cfg;`(L695, 항상 non-null `cfg`)와 `updateProfile()`의 `configRef.current = merged;`(L670,
    선행 `if (!cfg) return;` 가드로 `cfg`가 이미 non-null임을 요구). `null`로 재대입하는 지점은 0곳(파일 전수 확인).
    `use-token-refresh.ts`는 `configRef`를 읽기만 한다.
  - 상세: 따라서 "이미 확립된 세계"에 대해서는 `if (!configRef.current) return;` 가드가 절대 발동하지 않는다 —
    확립 이후의 모든 `teardownSession()` 호출은 항상 `worldGenRef.current++`까지 도달한다. 이 가드가 살아있는
    세션·스트림·타이머·in-flight 요청의 무효화를 건너뛰는 시나리오는 존재하지 않는다. 이 가드가 "살아있는" 유일한
    창은 최초 `applyConfig()` 완료 이전이며, 그 구간에는 (위 WARNING 항목의 `sessionStorage` 축을 제외하면) 무효화할
    in-memory 자원 자체가 없다 — `openStream`/`scheduleRefresh`/`sendCommand` 등 모든 비동기 경로가 `clientRef.current`
    또는 `sessionRef.current`(둘 다 config 확립 후에만 세팅됨)를 전제하기 때문이다.
  - 제안: 없음(확인 완료).

- **[INFO]** Q2 답변 — `useTokenRefresh`의 `cancelledRef` 제거·`worldGenRef` 위임(cross-hook 계약)은 cleanup 실행
  순서와 무관하게 안전
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts` L60-107(훅 정의, 특히 L107
    `useEffect(() => clearRefreshTimer, [clearRefreshTimer]);`) vs `use-widget.ts` L767-782(마운트 effect의 언마운트
    cleanup, `worldGenRef.current++`).
  - 상세: `useTokenRefresh({...})`는 `useWidget()` 함수 본문에서 마운트 effect(L682-785)보다 **먼저** 호출된다
    (L170-175). React는 동일 컴포넌트(같은 fiber)에 등록된 여러 `useEffect`의 cleanup을 **선언 순서 그대로**(mount 때와
    동일한 순서, LIFO 아님) 실행하므로, 언마운트 시 `useTokenRefresh`의 `clearRefreshTimer()` cleanup이 `useWidget`의
    `worldGenRef.current++` cleanup보다 **먼저** 실행된다. 이 순서 자체는 W5 fix의 정확성과 **무관하다** — 두 cleanup
    함수는 모두 **동기 함수**이고 React의 passive-effect flush는 두 cleanup을 같은 JS 호출 스택 안에서 연달아
    실행하며 중간에 microtask queue로 양보하지 않는다(JS run-to-completion). 따라서 `refreshToken()`의 `.then()`
    콜백(microtask)은 두 cleanup이 **모두** 끝난 뒤에야 실행 기회를 얻으므로, `clearRefreshTimer()`가 먼저 돌든
    `worldGenRef.current++`가 먼저 돌든 `.then()` 시점에는 이미 `worldGenRef.current`가 증가해 있다 — 순서 의존성이
    없다. 실측: `use-widget-eager-start.test.ts`의 "webhook POST in-flight 중 언마운트" 테스트(동일한 소유자 cleanup
    메커니즘을 사용)로 이 무효화가 실제로 작동함을 확인했고(현재 워크트리에서 통과), `use-token-refresh.test.ts`의
    W5 테스트는 `worldGenRef.current += 1`을 수동으로 흉내 내 `.then()` 가드 자체를 격리 검증한다 — 두 검증을
    조합하면 "소유자가 언마운트 cleanup에서 세대를 올린다"(구현으로 확인) + "`.then()`이 세대 변화를 정확히 감지해
    폐기한다"(테스트로 확인)는 계약의 양쪽이 모두 성립함을 확인했다. 유일한 잔여 완성도 갭은 "실제 `unmount()` +
    `refreshToken` **in-flight**"를 하나의 테스트로 직접 잇는 케이스가 없다는 점이다(W3은 webhook POST in-flight,
    W5는 수동 세대 증가) — 이는 별도로 아래에 INFO로 기록.
  - 제안: 없음(안전성 확인 완료). 완성도 차원에서, `use-token-refresh.test.ts`에 `renderHook` + 실제 `unmount()` +
    `refreshToken` in-flight를 조합한 테스트 1건을 추가하면 이 cross-hook 계약을 종단으로 고정할 수 있다(선택, 저비용).

- **[INFO]** Q3 답변 — `widgetReducer`의 `ended` 가드는 정당한 전이를 막지 않는다(실측 확인, `NEW_CHAT` 경로 포함)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `case "WAITING"`(L129-146, 신규
    `if (state.phase === "ended") return state;`).
  - 상세: `ended`를 벗어나는 액션은 `START`(무조건 `phase→"booting"`)와 `NEW_CHAT`(무조건 `phase→"panel"`) 두 가지뿐이며
    (reducer 전수 확인), 이 새 가드는 오직 `WAITING` 케이스에만 걸려 있어 `START`/`NEW_CHAT` 자체의 재개를 막지
    않는다. `RESTORED`/`BOOTED` 역시 무조건 전이라 가드 대상이 아니며, 코드 추적 결과 이 두 액션은 오직 최초
    마운트(`applyConfig`)·정상 `start()` 흐름에서만 dispatch되어 `state.phase==="ended"`인 시점에 도달할 수 없다
    (SSE 이벤트·getStatus 시드는 전부 `clientRef.current`/`sessionRef.current`가 확립된 이후에만 발화 가능하고 그
    경로들은 이미 `worldGenRef`로 게이팅된다). 실측: `widget-state.test.ts`에 `it.each`로 `START`/`NEW_CHAT` 두 경로
    모두에서 "ended 이후 재개 → WAITING 정상 처리"를 검증하는 테스트가 있고(현재 워크트리 기준 2 케이스),
    "ENDED 이후 WAITING → 무시"(유령 메시지가 `mergeMessages`로 스레드에 섞이지 않는 것까지 assert) 테스트와 함께
    3케이스 모두 실행해 통과를 확인했다. 가드가 `return state;`(참조 그대로 반환)로 액션 전체를 완전히 무시하므로
    `pending`/`messages` 등 일부 필드만 부분 반영되는 결함도 없다.
  - 제안: 없음(확인 완료).

- **[INFO]** `flushAsync()`(매크로태스크 1틱 플러시)로의 전환은 이전 라운드 C2 우려(고정 횟수 `await
  Promise.resolve()`의 취약성)에 대한 견고한 개선
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(신규 `flushAsync()` 헬퍼, 12개 호출부
    치환).
  - 상세: `await new Promise((r) => setTimeout(r, 0))`은 매크로태스크 경계이므로, JS 이벤트 루프는 그 콜백을 실행하기
    전에 **그 시점까지 큐잉된 모든 마이크로태스크를(재귀적으로 새로 큐잉되는 것까지 포함)** 전부 비운다 — 따라서
    `await fetch → await res.json() → 세대 검사 → dispatch`처럼 `await` 홉 수가 늘어도 틱 수를 세지 않고 항상 안전하게
    배출된다. 이 파일 내 fake timer 사용은 전부 `vi.useFakeTimers({ shouldAdvanceTime: true })`(L239, L788)이고 신규
    C1/W2/W3 테스트가 속한 `describe` 블록(L1382 이후)은 fake timer 범위 밖(전역 `afterEach`가 `vi.useRealTimers()`로
    복귀시킴, L188-195)이라 실제 timer로 정상 발화함을 확인했다. 고정 횟수 `await Promise.resolve()` 패턴(구현의
    정확한 await 깊이에 암묵 결합되어 향후 회귀를 놓칠 수 있었던 안티패턴, 08_29_33 라운드의 여러 리뷰어가 독립
    지적)을 제거한 올바른 방향의 개선이다.
  - 제안: 없음(개선 확인).

- **[INFO]** `useTokenRefresh` cross-hook 계약의 완성도 갭 — "실제 unmount + refreshToken in-flight" 종단 테스트 부재
  - 위치: `use-token-refresh.test.ts`(W5 — `worldGenRef.current += 1` 수동 조작, 실제 `unmount()` 미사용),
    `use-widget-eager-start.test.ts`(W3 — 실제 `unmount()` 사용하나 대상이 webhook POST, `refreshToken` 아님).
  - 상세: 위 Q2 항목에서 설명했듯 두 조각(소유자가 언마운트 시 세대를 올린다 / `.then()`이 세대 변화를 감지한다)이
    각각 다른 테스트로 검증되어 있고 JS 실행 모델상 조합이 안전함을 정적으로 확인했지만, 이 둘을 **하나의**
    "renderHook → scheduleRefresh → 타이머 발화(refreshToken in-flight) → 실제 unmount() → resolve → sessionRef/storage
    불변" 테스트로 잇는 케이스는 없다. 활성 버그는 아니며(구성 요소 각각이 검증됨 + 코드 추적으로 조합 안전성 확인),
    회귀 방지 관점의 저비용 보완 여지다.
  - 제안(선택): `use-token-refresh.test.ts`에 `unmount`을 실제로 호출하는 W5 변종 테스트 1건 추가 검토.

- **[WARNING]** (코드 diff 밖 — 리뷰 파이프라인 관찰) 이 리뷰 세션 도중 **공유 git 워크트리에 대한 동시 쓰기**를
  직접 목격했다 — 리뷰 대상 스냅샷과 실행 중 워크트리 상태가 괴리될 수 있는 프로세스 레벨 경쟁
  - 위치: 리뷰 대상 코드가 아니라 `.claude/worktrees/funny-mahavira-50d003` 워크트리 자체(모든 리뷰어가 공유하는
    파일시스템 자원).
  - 상세: 위 첫 WARNING 항목을 정적으로 분석하던 도중(수정 제안을 작성하기 전) `git status`/`git diff HEAD`를 다시
    실행했더니 `use-widget.ts`·`use-widget-eager-start.test.ts`·`widget-state.ts`·`widget-state.test.ts`가 **prompt_file이
    보여준 스냅샷과 다른, 추가된** 내용으로 이미 바뀌어 있었다(`pendingResetRef` 도입 + 신규 테스트, `NEW_CHAT`
    반례를 추가한 `it.each`, JSDoc 정정 — 전부 `ai-review 2026-07-17 09_36_01`(이번 라운드) 인용 포함). 또한 전체
    스위트를 반복 실행하던 중 `codebase/channel-web-chat/src/lib/__scratch_reducer_check.test.ts`라는 **다른 프로세스가
    쓰고 지운 것으로 보이는 임시 테스트 파일**이 한 번(run 4/10) 나타났다가 다음 실행에는 사라진 것도 관측했다(내가
    만든 파일이 아님 — `Write` 호출 이력 없음). 이는 이번 라운드의 다른 리뷰어(들)와 fix-applier로 추정되는 프로세스가
    **내 리뷰가 끝나기 전에 이미 같은 워크트리에 쓰기를 수행**하고 있었다는 직접 증거다. 부수 효과로, 전체 스위트를
    반복 실행했을 때 관측한 산발적 실패(10회 중 3회, `use-widget-eager-start.test.ts`의 무관한 여러 테스트에서
    "collapsed"/"undefined"/빈 배열 등 널 상태 실패)는 **동시 파일 변경 중 vitest가 파일을 읽은 데서 온 아티팩트일
    가능성이 높다** — 격리된 3-파일 조합 반복(20회)과 파일이 안정된 뒤의 재확인(3회)에서는 전부 통과했기 때문에,
    이 산발적 실패를 "코드의 새 경쟁 조건"으로 귀속시킬 근거는 없다(직전 라운드 C2가 남긴 "미해결" 질문에 대한 답도
    아니다 — 오히려 C2의 관측치 일부가 이런 종류의 인프라 아티팩트였을 가능성을 시사한다). 다만 이는 **응용
    코드**가 아니라 **다중 에이전트 리뷰 파이프라인 자체**가 하나의 공유 가변 자원(워크트리)에 동시 쓰기를 허용하는
    구조적 특성이며, 두 에이전트가 같은 파일의 겹치는 라인 범위를 동시에 수정하면 lost-update 류 데이터 손실도
    이론적으로 가능하다.
  - 제안: 코드 변경 아님 — 조치 불요. 다만 오케스트레이터 참고용으로 기록: (a) 리뷰 라운드의 flakiness 재현
    실험(C2류)은 다른 에이전트의 동시 쓰기가 없는 격리 checkout에서 수행해야 신뢰할 수 있는 신호를 얻는다. (b) 이번
    라운드처럼 review 진행 중 fix가 이미 반영되는 경우, 최종 SUMMARY는 prompt_file 스냅샷이 아니라 실제 병합 시점의
    워크트리 상태를 기준으로 재확인할 것을 권장.

## 요약

핵심 재검토 대상인 C1(부팅 정지 회귀)·W2(`applyConfig` 세대 재검증 비대칭)·W3(언마운트 회귀 테스트 공백)·W4(리듀서
defense-in-depth)·W5(`useTokenRefresh`의 독립 `cancelledRef` 통합)는 코드 추적과 실제 테스트 실행 양쪽으로 검증한
결과 모두 올바르게 닫혔다. 부모가 요청한 세 가지 검증에 대한 답은: **(1)** `configRef.current`는 확립 후 결코
`null`로 되돌아가지 않으므로(대입 2곳 모두 non-null, 해제 0곳) 이미 확립된 세계에 대해서는 `teardownSession()`의
조기 return이 정당한 무효화를 삼키는 경우가 없다는 주장은 **사실로 확인**된다 — 다만 예외가 하나 있다: pre-config
구간에서는 `sessionStorage`라는 **별도 축**의 "새 대화" 의도가 유실되어, 뒤이어 완료되는 부팅이 이전에 남은 저장
세션을 조용히 복원할 수 있다(이 gap은 분석 도중 라이브 워크트리에서 이미 형제 리뷰어에 의해 발견·수정된 것을
확인했다). **(2)** `useTokenRefresh`의 `cancelledRef` 제거·`worldGenRef` 위임은 cleanup 실행 순서(useTokenRefresh가
useWidget보다 먼저 cleanup)와 무관하게 안전하다 — 두 cleanup이 모두 동기 함수라 JS run-to-completion에 의해
microtask(`.then()`)가 실행되기 전에 항상 둘 다 완료되기 때문이며, 이는 코드 추적과 두 개의 독립 테스트(W3·W5)
조합으로 확인했다. **(3)** 리듀서 `ended` 가드는 `START`/`NEW_CHAT` 두 정당한 재개 경로 모두를 막지 않으며, 신규
`it.each` 테스트로 실측했다. 추가로 이 재검토 과정에서 이번 다중 에이전트 리뷰 파이프라인이 하나의 공유 워크트리에
대해 동시 쓰기를 수행한다는 것을 직접 목격했다 — 이는 리뷰 대상 코드의 결함이 아니지만, 전체 스위트 반복 실행 시
관측한 일부 산발적 실패의 원인일 개연성이 높아 별도로 기록해 둔다. 전통적 mutex/데드락/스레드풀 축은 이 코드베이스
(React 훅 기반 단일 스레드 브라우저 코드)에 해당 없음을 재확인했고, 이번 라운드 실질 점검 축(async staleness
경합·원자성·Promise 체인 관리)은 전반적으로 신뢰할 수 있는 상태다.

## 위험도

LOW
