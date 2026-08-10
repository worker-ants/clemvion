# 테스트(Testing) 리뷰 결과

## 스코프에 대한 메모

`_prompts/testing.md` 의 diff 페이로드는 이전 라운드(`17_15_33`·`17_15_33_2`)의 review 산출물
(`_retry_state.json`·`meta.json`·`RESOLUTION.md`·`SUMMARY.md`·`documentation.md`·
`maintainability.md`·`scope.md`·`security.md`·`side_effect.md`·`testing.md`)과
`spec/7-channel-web-chat/3-auth-session.md` 뿐이다 — **실제 프로덕션 코드 diff 는 이 프롬프트
게이트에 없다**. 그러나 오케스트레이터의 호출 메시지가 직접 지목한 검증 대상은 코드다:
직전 라운드에서 내가(testing reviewer) 낸 CRITICAL(`500` 케이스 보강 누락)에 대응해 커밋
`d03deb339`(`test(webchat): 같은 경로를 검증하는 두 케이스 중 한쪽만 보강했다 + …`)가
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`·`use-widget.ts` 를
고쳤고, `RESOLUTION.md`(프롬프트 파일 3)가 "같은 보강 적용, 뮤테이션 **2건 RED**(이전 1건)"
라고 주장한다. 이 주장을 독립적으로 재현·검증하고, 같은 코드 경로를 검증하는 **다른** 테스트
케이스가 더 있는지 전수로 확인하는 것이 이번 라운드의 실질 과업이다. 아래 인용 줄 번호는
프롬프트 오프셋이 아니라 **해당 파일을 직접 `Read`/`git show` 로 연 결과의 실제 소스 줄
번호**다.

## 검증 방법 (repo 밖 scratch 사본, 워킹트리 무변경)

`rsync` 로 `codebase/channel-web-chat` 전체(`node_modules` 제외)를 `/private/tmp/.../scratchpad/webchat-mutation`
에 복사하고 `node_modules` 만 원본 위치로 symlink 해 격리된 사본에서 vitest 를 직접 구동했다
(원본 워크트리는 `git status --porcelain codebase/channel-web-chat/src/widget/use-widget.ts` 로
무변경임을 확인). 이 사본에서:

1. **베이스라인(무수정)**: 전체 스위트 `npx vitest run` → **23 files / 417 tests 전부 통과**.
   `RESOLUTION.md`·`SUMMARY.md` 가 주장하는 "위젯 417 passed" 와 정확히 일치.
2. `use-widget.ts` 의 `recoverFromExpiredToken` catch 블록 `!terminal` 분기
   `return "refresh_deferred";`(현재 소스 463번째 줄)를 `return "stale";` 로 뮤테이션.
3. 대상 파일만(`use-widget-eager-start.test.ts`, `-t "refresh 가"` 필터) 재실행 → **2건 FAIL**:
   - `§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다`
     (`expect(after).toBeGreaterThan(before)`, 소스 497번째 줄) — `AssertionError: expected 1 to be greater than 1`
   - `` §R4: refresh 가 `500` 으로 실패해도 종료로 확정하지 않는다 — 상태 **필터** 축 ``
     (같은 단언, 소스 542번째 줄) — 동일 에러
   - (`410` 테스트는 무관 분기라 여전히 GREEN — 정상)
4. 같은 파일 전체(70 tests) 재실행 → **정확히 2 failed / 68 passed**. 다른 어떤 테스트도
   이 뮤턴트에 반응하지 않음.
5. **전체 스위트**(23 files, 417 tests) 재실행 → **정확히 2 failed / 415 passed**. `session-store`·
   `use-token-refresh` 등 다른 테스트 파일에는 `recoverFromExpiredToken`/`refresh_deferred` 참조가
   전무함(`grep -rl` 확인 결과 `use-widget-eager-start.test.ts` 단 1개 파일)도 재확인.
6. 뮤테이션 원복 후 재실행 → 다시 417 passed(베이스라인과 동일) 확인, scratch 사본만 사용해
   원본 워크트리는 시종 무변경.

## 발견사항

- **[INFO]** (검증 완료) `RESOLUTION.md`(프롬프트 파일 3, 5~12번째 줄)·`SUMMARY.md`(프롬프트
  파일 4, 19번째 줄)의 "같은 보강 적용, 뮤테이션 **2건 RED**(이전 1건)" 주장을 독립 재현으로
  **정확히 확인**했다 — 위 절차 3에서 실측한 실패 2건(네트워크-오류 테스트 497번째 줄, `500`
  테스트 542번째 줄)이 정확히 그 둘이고, 다른 파일·다른 테스트에서는 이 뮤턴트가 전혀
  검출되지 않는다(절차 4·5). "417 passed" 수치도 베이스라인에서 정확히 재현됐다. 커밋
  `d03deb339` 의 diff 를 직접 확인한 결과 두 테스트가 동일 패턴(`vi.useFakeTimers({ shouldAdvanceTime: true })`
  → `advanceTimersByTimeAsync(20_000)` → `refresh-token` 재호출 횟수 비교)을 대칭으로 적용해
  구조적 비대칭이 해소됐다.

- **[INFO]** (전수 판정 결과 — 새 결함 아님) `recoverFromExpiredToken` 은 `seedWaitingFromStatus`
  를 통해 **세 호출부**에서 쓰인다: `start()`(신규 대화, `use-widget.ts` 713번째 줄
  `shouldAbortAfterSeed`) · `applyConfig`(재로드 복원, 1069~1073번째 줄) · `execution.replay_unavailable`
  fire-and-forget 폴백(365번째 줄, `void seedWaitingFromStatusRef.current?.(...)`, 반환값
  자체를 읽지 않음). 이번에 보강된 두 테스트는 **둘 다 `boot()` → 사전 저장 `sessionStorage`
  경로**(즉 `applyConfig` 호출부)만 태운다 — `use-widget-eager-start.test.ts` 294번째 줄의
  기존 주석("**덮는 범위: 복원 경로(`applyConfig`)뿐이다.** `start()` 도 같은 형태로 `openStream`
  을 부르므로 같은 실수를 각자 할 수 있고…")이 이미 이 비대칭을 정직하게 기록해 뒀다.
  전체 스위트 뮤테이션(절차 5)에서 이 갭이 실측으로도 확인된다 — `start()` 경로를 태우는
  테스트가 아예 없어 그 경로가 뮤턴트를 잡을 기회 자체가 없다. 다만 이는 **이번 diff 가
  새로 낸 갭이 아니라 기존에 이미 식별·등재된 항목**이다 —
  `plan/in-progress/webchat-auth-session-status-reconcile.md` 15번째 줄(추적 표)과
  68~82번째 줄("함께 남은 미확인 갭 — `start()` 경로의 401")에 "**도달 가능성 실측** 후 —
  가능하면 회귀 추가, 불가면 주석 고정" 으로 명시 등재돼 있으므로 재지적하지 않는다(다만
  "전수로 판정하라" 는 이번 지시에 대한 답으로서 결과를 기록해 둔다).

- **[INFO]** fire-and-forget 세 번째 호출부(`execution.replay_unavailable`, 365번째 줄)는
  `seedWaitingFromStatus` 의 반환값을 아예 읽지 않으므로(`void` 호출) 이번 뮤테이션 표면
  (`"refresh_deferred"` vs `"stale"`)에 대해 관측 가능한 차이가 구조적으로 없다 — 이 경로는
  이미 스트림이 열려 있는 상태(`allowWhileStreaming: true`)에서의 표면 재동기화 전용이라
  `scheduleRefresh`/`openStream` 게이팅과 무관하다. 이 경로는 side_effect CRITICAL #2
  (`RESOLUTION.md` 14~26번째 줄, "`refresh_deferred` 는 고착의 절반만 닫는다")로 이미
  범위가 정의돼 있어 별도 테스트 갭으로 카운트하지 않는다.

## 요약

지시받은 두 가지를 모두 독립 실측으로 판정했다. (1) `RESOLUTION.md`/`SUMMARY.md` 의 "500 케이스
보강 반영, 뮤테이션 2건 RED(이전 1건)" 주장은 repo 밖 scratch 사본에서 베이스라인 417 passed →
뮤턴트 적용 시 정확히 2 failed(네트워크-오류·`500` 두 테스트, 다른 415건은 무관)로 **정확히
일치**함을 확인했다. (2) 같은 코드 경로(`recoverFromExpiredToken` 의 `!terminal` →
`"refresh_deferred"`)를 검증하는 다른 케이스가 있는지 전수 조사한 결과, 이 뮤턴트를 잡는
테스트는 정확히 그 2건뿐이고 그 이상도 이하도 아니다 — 세 번째 호출부(`start()`)는 여전히
같은 뮤테이션 표면을 검증할 테스트가 없지만, 이는 이번 diff 가 새로 낸 갭이 아니라
`webchat-auth-session-status-reconcile.md` 에 이미 "도달 가능성 실측 후 결정" 으로 등재된
기존 항목이다(재지적 대상 아님). 새로운 테스트 결함은 발견되지 않았다.

## 위험도

NONE
