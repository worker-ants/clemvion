# 변경 범위(Scope) Review — `18_23_54`

## 지시받은 두 가지를 모두 `git show`/직접 재실행으로 독립 재검증했다

### (1) `17_55_57` 라운드 `RESOLUTION.md`/`SUMMARY.md` 처분 주장 vs 실제 커밋 `36bc55fa5`

## 발견사항

- **[INFO]** `RESOLUTION.md`(W1~W5·C1)의 처분 서술이 실제 커밋 `36bc55fa5` 의 diff 와 항목별로 정확히 일치함을 확인
  - 위치: `review/code/2026/08/10/17_55_57/RESOLUTION.md`(전체), 대조 대상 `36bc55fa5`
  - 상세: `git show 36bc55fa5` 로 5개 변경 파일을 전부 열어 다음을 하나씩 대조했다.
    - **W1(side_effect)** — `use-widget.ts`: `resumeDeferredStreamRef.current` 콜백이 실제로 `openStream(session, "0")` **다음에** `deferredStreamRef.current = false`를 실행하도록 순서가 뒤집혀 있다(주장과 일치). `use-token-refresh.ts`: `onRefreshedRef.current?.(updated)` 호출이 실제로 `try {...} catch (notifyErr) { console.warn(...) }`로 격리돼 있다(주장과 일치).
    - **W2(maintainability)** — `use-token-refresh.ts`: 실제로 내부 `scheduleWithDelay(retryDelay?)` + 무인자 공개 래퍼 `const scheduleRefresh = useCallback(() => scheduleWithDelay(), [scheduleWithDelay])` 로 분리돼 있다(주장과 일치).
    - **W3(testing)** — `use-token-refresh.test.ts`: `` `410` 실패도 재시도하지 않는다 — 종료된 execution `` 테스트가 실제로 추가됐다(주장과 일치).
    - **W4(testing)** — `use-widget.ts`의 `resumeDeferredStreamRef` no-op 가드(`if (!deferredStreamRef.current) return;`) 바로 위에 `teardownSession`과 같은 근-등가 survivor임을 밝히는 주석이 실제로 붙어 있다(주장과 일치).
    - **C1+W5(documentation/requirement)** — `plan/in-progress/webchat-auth-session-status-reconcile.md`: "## 미해결 — `refresh_deferred`는 고착의 절반만 닫는다" 절이 실제로 "## 해소됨 — `refresh_deferred`의 나머지 절반 (2026-08-10, 같은 PR 안에서)"로 바뀌어 있고, 그 안에 진단(당시)/무엇을 골랐나/처분 완료 체크(`- [x]`) 세 개가 실제로 있다(주장과 일치). 동시에 `refresh_deferred` 고유가 아닌 잔여를 "## 주기 갱신이 terminal 을 만나도 세션을 정리하지 않는다 (2026-08-10, 범위 밖)" 절로 실제로 분리해 뒀다(주장과 일치).
  - 제안: 없음(검증 완료, 불일치 없음).

- **[INFO]** "뮤테이션 3종 RED" 주장을 직접 재실행해 3종 모두 실측 RED 로 재확인 — 이전 CRITICAL(커밋되지 않은 수정을 반영 완료로 적은 오류, `16_56_39` scope) 부류의 재발 없음
  - 위치: `review/code/2026/08/10/17_55_57/RESOLUTION.md` 검증 절("뮤테이션 3종 추가 전부 RED"), 대상 소스 `codebase/channel-web-chat/src/widget/use-widget.ts`·`use-token-refresh.ts`·`codebase/channel-web-chat/src/lib/eia-client.ts`
  - 상세: 저장소 밖 scratch 사본이 아니라 **이 워크트리의 추적 파일을 직접** 3회 뮤테이션 → `vitest run` → 실패 확인 → 파일 원복(→ `git status --porcelain`/`git diff` 로 바이트 단위 무변경 확인, `git checkout` 미사용)의 사이클로 재현했다.
    1. `resumeDeferredStreamRef` 순서를 `deferredStreamRef.current = false;` → `openStream(...)` 순으로 되돌림 → `use-widget-eager-start.test.ts` 의 `§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다` 가 **RED**(`expected null not to be null`).
    2. `onRefreshedRef.current?.(updated)` 를 감싼 `try/catch` 를 제거 → `use-token-refresh.test.ts` 의 `onRefreshed 가 throw 해도 갱신은 성공으로 취급된다` 가 **RED**(`expected ... to be called 1 times, but got 4 times`).
    3. `isTerminalAuthError` 에서 `err.status === 410` 항 제거 → `use-token-refresh.test.ts` 의 `` `410` 실패도 재시도하지 않는다 `` 가 **RED**(`expected ... to be called 1 times, but got 8 times`).
    - 세 경우 모두 원복 후 `npx vitest run`(전체 위젯 스위트) **429 passed** — RESOLUTION 이 적은 "위젯 vitest 429 passed (23 files, +3)" 과 정확히 일치.
  - 제안: 없음(주장이 실측과 일치).

### (2) 신규 분리 등재된 잔여 — "주기 갱신이 terminal 에 storage 를 안 지운다"

- **[INFO]** 이 잔여를 이 PR 범위 밖으로 이연한 판단은 정당하다 — 회귀가 아니라 PR 시작 이전부터 있던 성질임을 merge-base 대조로 확인
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` `## 주기 갱신이 terminal 을 만나도 세션을 정리하지 않는다 (2026-08-10, 범위 밖)` 절(커밋 `36bc55fa5`), 대조 소스 `codebase/channel-web-chat/src/widget/use-token-refresh.ts` at `git merge-base origin/main HEAD`(= `cbc0d33760`)
  - 상세: PR 시작 시점(`cbc0d33760`)의 `use-token-refresh.ts` 를 직접 열어 확인한 결과, 당시 주기 갱신의 `.catch()` 는 실패 사유(네트워크/`401`/`410` 등)를 **전혀 구분하지 않고** `console.warn` 만 하고 재시도도, storage 정리도 하지 않았다(docstring 도 "다음 입력의 401 을 sendCommand 가 ERROR 처리"라고 명시 — 즉 정리 책임을 처음부터 다음 사용자 입력에 위임하는 설계였다). 이번 PR 은 `isTerminalAuthError` 를 신설해 그 실패를 "재시도 가치 있음(네트워크/5xx, 지수 백오프)"과 "재시도 무의미(`401`/`410`)"로 처음 나눴을 뿐, **storage 정리를 하지 않는다는 성질 자체는 바꾸지 않았다** — plan 문서의 "종전부터 그랬고 이 PR 이 바꾸지 않았다" 서술이 실측과 정확히 일치한다.
  - spec `3-auth-session.md §3.1-3`(storage 정리 책임)은 정리 트리거를 "SSE terminal 수신 / 재로드 복원 200+terminal·`404`·복구불가 `401`·`410` / 명령 응답 `410 Gone`" **셋으로 명시 열거**하며, "주기 갱신 자체가 감지한 `401`/`410`"은 그 열거에 없다 — 즉 이 PR 이 맡은 §3.1-2·§R4(재로드 복원 경로)의 명시적 계약을 위반하지 않는다. 처방(훅에 `onTerminal` 콜백 주입 등)은 훅의 책임 경계를 넓히는 설계 선택이고, plan 자신이 "방금 `onRefreshed` 하나를 추가한 직후에 반대 방향 통지를 더 얹는 것은 설계를 굳히기 전에 표면부터 늘리는 일"이라 명시적으로 판단해 미룬 것 — 최소 완결이 아니라 별도 설계 확장이라는 진단이 타당하다.
  - 관측 가능한 사용자 영향도 같은 plan 문서가 이미 grep 으로 실측해 뒀다 — `use-token-refresh.ts` 는 `openStream` 을 0회 호출하므로(주기 갱신 경로 자체가 스트림을 열지 않음) 죽은 토큰으로 SSE 를 여는 이 PR 의 핵심 증상("streaming 고착")은 이 잔여와 무관하다. 남는 것은 "다음 사용자 입력이 `sendCommand`의 `410`으로 자연 수렴할 때까지 storage 에 죽은 토큰이 남는" 순수 hygiene 창이며, 체크박스도 `- [ ]`(미착수)로 정직하게 열어 뒀다(완료로 거짓 표기하지 않음 — `16_42_07` 라운드에서 지적됐던 "미커밋 수정을 반영 완료로 적는" 형태의 재발 아님).
  - 제안: 조치 불요(이연 판정 유지). 다만 plan 의 두 미체크 항목 중 "죽은 토큰이 storage 에 남는 창이 얼마나 긴지 실측"은 설계 결정("onTerminal 도입 여부")보다 선행 조사이므로, 다음 세션 착수 우선순위로 명시해 두면 좋다(강제 아님).

## 요약

지시받은 두 항목을 각각 독립 실측으로 판정했다. (1) `17_55_57` RESOLUTION/SUMMARY 의 처분 서술은 실제 커밋 `36bc55fa5` 의 diff 와 W1~W5·C1 전 항목이 텍스트·코드 레벨로 정확히 일치했고, "뮤테이션 3종 RED" 주장도 이 워크트리 추적 파일에 직접 뮤테이션을 적용·검증·원복(git checkout 미사용, 파일 직접 복원 후 `git status`/`git diff` 로 무변경 확인)하는 방식으로 재현해 3종 모두 실측 RED 를 확인했다 — 이 브랜치가 과거 겪은 "커밋 안 된 수정을 반영 완료로 적는" 클래스의 재발이 아니다. (2) 새로 분리 등재된 잔여("주기 갱신이 terminal 에 storage 를 안 지운다")는 merge-base 대조로 PR 시작 이전부터 있던 성질임을 확인했고, spec §3.1-3 의 명시적 정리 트리거 목록에도 해당하지 않으며, 처방이 훅 책임 경계를 넓히는 별도 설계 결정이라는 plan 의 판단이 타당하다 — "고쳤어야 할 것을 미룬 것"이 아니라 정당하게 분리한 out-of-scope 잔여다.

## 위험도

NONE
