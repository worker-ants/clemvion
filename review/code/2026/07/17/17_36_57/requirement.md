# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (§106 "마지막 wc:boot 적용")

리뷰 대상: `codebase/channel-web-chat/src/lib/widget-state.{ts,test.ts}` · `codebase/channel-web-chat/src/widget/use-widget.ts` ·
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` · `plan/in-progress/{harness-session-anchor-guards.md(삭제),webchat-boot-single-flight.md(신규)}` ·
`spec/7-channel-web-chat/2-sdk.md`(frontmatter). 리뷰 대상 commit range: `5de44d4d6..215cd1c3f`(브랜치 `claude/webchat-boot-single-flight-8c92b4`, 3개 커밋: `68ff69ba7`/`b8ea32b63`/`215cd1c3f`).

**검증 방법론 고지**: 아래 CRITICAL·WARNING 발견 중 3건은 리뷰 대상 commit(`215cd1c3f`)을 격리 throwaway git worktree(`git worktree add <scratch> 215cd1c3f --detach`, node_modules 는 원본 worktree 로 심링크)에 체크아웃해 **실제로 mutation 을 가하고 `vitest run` 을 실행**해 재현했다. Diagnostic probe 테스트는 리뷰 대상 파일에 임시로 append 했다가 worktree 자체를 통째로 폐기했다(원본 리뷰 대상 worktree 는 read-only 로만 사용, 수정 없음 — 최종 `git status`/`git diff --stat` 로 무결성 확인 완료). 아래 각 항목에 실행 로그를 요약해 첨부한다.

---

## 발견사항

- **[CRITICAL]** §106 위반 — 대체된(superseded) 부팅 시도의 "종료 확정" 부수효과가 아직 살아있는 **마지막** wc:boot 시도를 stale 로 오판시켜 config 가 옛 값에 고착된다(실측 재현, resolve 순서와 무관하게 발생).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus`(당시 라인 ~445-511, `if (isStale(gen)) return "stale";` 가 **world 축만** 검사)와 `applyConfig` 복원 분기(`const outcome = await seedWaitingFromStatus(clientRef.current, saved);` → `finalizeEnded` 경유 `teardownSession()` → `worldGenRef.current++`), 그리고 `beginBootAttempt`/`isAttemptStale`(라인 261-269, world+boot 결합 토큰).
  - 상세: 겹친 두 번의 `wc:boot`(1차=plan A, 2차=plan B, **B 가 마지막**)가 모두 세션 복원 분기로 진입했다고 하자. 1차가 먼저 `establishConfig(A)` 를 호출해 `config.profile.plan="A"` 로 세팅한 뒤 `seedWaitingFromStatus` 로 `getStatus` 를 발사한다(아직 in-flight). 이때 2차가 도착해 `bootGenRef` 를 2로 올려 1차를 **boot 축에서 대체**한다. 이어서 1차의 `getStatus` 가 **"completed"(정상적으로 실제 종료됨)** 로 응답하면, `seedWaitingFromStatus` 는 `finalizeEnded()` → `teardownSession()` 을 호출해 **world 세대를 올린다**. 그런데 이 `seedWaitingFromStatus` 내부의 재검증은 `isStale(gen)`(world 전용)뿐이라 "자신(1차)이 이미 boot 축에서 대체됐다"는 사실을 모른 채 종료를 확정해버린다. 그 결과 world 가 바뀌었으므로, **아직 아무 것도 건드리지 않고 자기 순서를 기다리던 2차**가 자신의 `isAttemptStale(attempt)` 재검증(`isEmbedAllowed` 뒤)에서 "world 가 변했다"는 이유만으로 stale 로 오판되어 조용히 물러난다 — `establishConfig(B)` 가 **끝내 호출되지 않는다**. 결과적으로 `config.profile.plan` 은 마지막으로 보낸 B 가 아니라 **먼저 보낸 A 에 영구 고착**된다(다음 wc:boot 이 올 때까지). 이는 spec 문장 "위젯은 **마지막 wc:boot 의 config 를 적용**한다"(2-sdk.md §106)의 명백한 위반이다. `worldGenRef`/`bootGenRef` 를 "합치지 말 것"이라 JSDoc 이 강조하지만, 실제로는 **한 시도의 세션-종료 확정이라는 부수효과를 통해 world 축이 오염되어 다른 시도의 boot 축 판정에 간섭**한다 — 두 축이 문서상의 의도와 달리 실제로는 커플링돼 있다.
  - **실측 재현 로그**(격리 worktree, `215cd1c3f` clean checkout, diagnostic probe):
    ```
    PROBE2:: config.plan after attempt1 establishConfig = A
    PROBE2:: phase after attempt1 termination discovery = ended
    PROBE2:: RESULT final config.profile.plan = A (expected by spec §106 = 'B', last wc:boot)
    PROBE2:: RESULT phase = ended
    ```
  - **참고(투명성 고지)**: 리뷰 도중 대상 worktree(`webchat-boot-single-flight-8c92b4`, 이 파일이 위치한 바로 그 worktree)에 **미커밋 상태로 이미 이 결함의 수정이 진행 중**인 것을 확인했다(`seedWaitingFromStatus` 에 `attempt?: {world,boot}` 파라미터 추가 + `if (attempt && isAttemptStale(attempt)) return "stale";`). 그 수정의 코드 주석이 정확히 "(ai-review 2026-07-17 17_36_57 concurrency CRITICAL — 실측 재현)" 이라고 적고 있어, **같은 배치의 다른(concurrency) reviewer 가 동일 결함을 독립적으로 발견**했음이 교차 확인된다. 단 그 수정은 **본 리뷰가 부여받은 diff 범위 밖**(아직 커밋되지 않은 후속 변경)이므로, 본 리뷰는 이를 "이미 해결됨"으로 처리하지 않고 리뷰 대상 diff 자체에 대한 CRITICAL 로 기록한다. 다만 오케스트레이터 입장에서는 별도 재작업 없이 해당 후속 커밋을 채택하면 될 가능성이 높다는 점을 참고하라.
  - 제안: `seedWaitingFromStatus` 가 부팅 시도로부터 호출될 때는 boot 토큰도 함께 받아 "종료 확정 직전"에 boot 축도 재검증하게 한다(위에서 관찰한 라이브 수정과 동일한 방향). 다만 그 수정 자체도 `start()`/`replay_unavailable` 폴백처럼 **부팅 시도가 아닌** 호출부와의 시그니처 비대칭(옵셔널 파라미터)을 새로 만드므로, 이 파일이 반복해온 "비대칭 가드 누락" 계열 회귀를 재도입하지 않는지 별도 mutation 검증(모든 `seedWaitingFromStatus` 호출부에 대해 boot 토큰 전달 누락 케이스)이 필요하다.

- **[WARNING]** A-6 는 reducer 레벨의 **증상**(phase 부활)만 막을 뿐, 근본 원인(`ERROR` 경로가 `teardownSession()` 을 호출하지 않는 것)은 리뷰 대상 diff 에 남아 있어, `wc:boot` 재전송 시 "화면은 ended 인데 백그라운드에서 좀비 SSE 연결과 불필요한 재조회가 발생"하는 부작용이 실측된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `sendCommand` 콜백의 `catch` 블록 else 분기(당시 `dispatch({ type: "ERROR", message: errMessage(e) });` 만 존재, `teardownSession()` 호출 없음) + `applyConfig` 복원 분기(`if (saved) { ...; dispatch(RESTORED); seedWaitingFromStatus(...); openStream(...); scheduleRefresh(); }`).
  - 상세: A-6 은 `widget-state.ts` 의 reducer 에 `if (state.phase === "ended") return state;` 를 `RESTORED`/`BOOTED` 에 추가해 **화면 phase 가 부활하지 않도록** 막았다. 그러나 `applyConfig` 는 reducer 의 판단과 무관하게 **자기 코드를 계속 실행**한다 — `dispatch(RESTORED)` 가 reducer 에서 no-op 이 되어도 그 다음 줄의 `seedWaitingFromStatus(...)`(실제 `getStatus` REST 호출)와, outcome 이 `"continue"` 면 이어지는 `openStream(...)`(새 `EventSource` 생성) · `scheduleRefresh()`(토큰 갱신 타이머 예약)는 **그대로 실행된다**. `ERROR` 로 종료된 세션은 서버 관점에서 실제로는 안 끝났을 수 있으므로(예: 명령이 500 으로 실패했을 뿐 execution 자체는 `running`) `getStatus` 가 `"continue"` 를 반환하기 쉽고, 그러면 옛(사용자가 이미 "끝났다"고 인지한) 세션에 대해 SSE 가 다시 열리고 토큰 갱신이 예약된다.
  - **실측 재현 로그**(격리 worktree, `215cd1c3f` clean checkout, `EventSource` 생성 횟수·`getStatus` 호출 횟수 계측):
    ```
    PROBE:: esConstructCount(after ERROR)= 1 getStatusCalls(after ERROR)= 1
    PROBE:: phase(after resend)= ended
    PROBE:: esConstructCount(after resend)= 2 getStatusCalls(after resend)= 2
    PROBE:: RESULT esConstructCount_increased= true getStatus_called_again= true
    ```
    (`phase` 는 A-6 덕에 `ended` 로 정확히 유지되지만, `EventSource` 가 1개 더 생성되고 `getStatus` 가 1번 더 불렸다 — 방어선 뒤에서 자원이 새는 상태.)
  - 새로 추가된 통합 테스트("ERROR 로 종료된 대화는 wc:boot 재전송으로 부활하지 않는다", `use-widget-eager-start.test.ts`)는 `state.phase` 만 단언하고 SSE 재오픈 여부(`getEs()`)는 단언하지 않아 이 gap 을 못 잡는다 — 같은 파일의 인접 §106 테스트("복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다")는 `expect(getEs()).toBeNull()` 패턴을 이미 쓰고 있어, 이 신규 테스트에도 동일 패턴을 넣는 것이 자연스러웠을 것이다.
  - 참고: 이 항목도 리뷰 대상 worktree 에 이미 미커밋 수정(`sendCommand` catch else 분기에 `teardownSession();` 추가, 정확히 이 부작용을 서술하는 주석 포함)이 진행 중임을 확인했다 — 위 CRITICAL 항목과 동일한 투명성 고지가 적용된다.
  - 제안: `ERROR` 로의 모든 전이 지점(`sendCommand` catch·`start()` catch)에서 세션이 실제로 존재하는 경우 `teardownSession()` 을 호출해 storage/스트림을 정리한다(단 `start()` catch 는 `persist()` 이전 실패라 세션이 아직 저장되지 않아 영향 없음 — 실제로 필요한 곳은 `sendCommand` catch 뿐임을 확인했다).

- **[WARNING]** §106 은 "멱등 재설정"을 표방하지만, 활성(비-ended) 대화 중 `wc:boot` 재전송 시 `RESTORED` 가 **무조건** `phase: "streaming"` 을 강제해 `Composer` 가 일시적으로 disable+로딩스피너로 전환되는 플리커가 발생한다. 이 PR 이 새로 만든 결함은 아니지만(기존 코드 경로), 이번 PR 이 다루는 "§106 완전성"에 직결되고, 실사용 트리거 빈도가 예상보다 훨씬 높다.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `case "RESTORED":`(`if (state.phase === "ended") return state; return {...state, phase:"streaming"};` — `ended` 외 다른 phase 조건 없음) + `codebase/channel-web-chat/src/widget/components/composer.tsx`(`disabled`/`loading` 이 `phase` 에서 직접 파생).
  - 상세: `applyConfig` 는 `saved` 세션이 있으면(대화가 이미 진행 중이든 아니든) **항상** `dispatch({type:"RESTORED", ...})` 를 호출한다. 대화가 `awaiting_user_message`(예: 자유 텍스트 입력 대기) 상태일 때 host 가 외형만 바꿔 `wc:boot` 을 재전송하면, `RESTORED` 가 `phase` 를 일시적으로 `"streaming"` 으로 되돌리고(이어지는 `seedWaitingFromStatus` 의 `getStatus` 왕복이 끝나야 `WAITING` 이 재도착해 원래 phase 로 복귀), 그 사이 `Composer` 는 `disabled=true, loading=true` 로 렌더된다 — 사용자가 입력 중이던 텍스트박스가 순간적으로 잠기고 스피너가 보인다.
  - **실사용 트리거 빈도 확인**(코드 추적, `codebase/frontend/src/components/web-chat/live-preview.tsx:48-58,116-119`): 이 재전송의 유일한 실사용 호출부인 관리자 라이브 미리보기는 `bootConfig` 를 `draft` 전체(디바운스 없음)에 의존해 재계산하고, `status==="ready"` 인 한 `bootConfig` 가 바뀔 때마다 `postBoot()` 를 재실행한다. `draft` 는 폼 입력마다(키 입력 단위로) 갱신되므로(`use-appearance-draft.ts`/`AppearanceBuilder` 경로에 디바운스 없음 확인), **외형 폼을 편집하며 동시에 미리보기에서 대화 중이면 사실상 키 입력마다** 이 플리커가 트리거될 수 있다.
  - 제안: (a) `LivePreview` 의 `postBoot` 트리거에 디바운스를 추가하거나, (b) `applyConfig` 복원 분기가 "이미 확립된 활성 대화로의 재전송"과 "최초 마운트 복원"을 구분해 후자에서만 `RESTORED`→streaming 전이를 하도록 한다(예: 이미 `sessionRef.current` 가 이번 mount 에서 세팅된 적이 있으면 재확립 dispatch 를 생략). 스코프가 이번 PR 밖일 수 있으므로 최소한 별도 plan 항목으로 추적을 권고한다.

- **[WARNING]** `widget-state.ts` 의 `WAITING` 케이스 주석이 바로 이 diff 가 같은 파일에 추가한 `RESTORED`/`BOOTED` 가드와 모순된다 — 문서(주석) vs 구현 불일치.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:155-156`(현재 라인 기준) — `case "WAITING":` 블록의 주석: `"**가드 범위는 WAITING 뿐이다** — RESTORED/BOOTED/USER_MESSAGE 도 state.phase 를 검사하지 않고 무조건 전이하므로, 'ended 를 벗어나는 액션'의 리듀서 레벨 불변식은 아직 없다."`
  - 상세: 이 주석은 이전 라운드(`08_29_33`/`09_36_01`)에 작성된 것으로, 그 시점엔 사실이었다. 그런데 **이번 diff 가 바로 몇 줄 위(`case "RESTORED"`, `case "BOOTED"`)에 `if (state.phase === "ended") return state;` 가드를 추가**했음에도 이 주석은 갱신되지 않았다. 현재는 "가드 범위는 WAITING 뿐이다" 가 더 이상 사실이 아니고(RESTORED/BOOTED 도 이제 가드됨), 정확한 서술은 "USER_MESSAGE 만 아직 무가드" 이다. 향후 리뷰어/구현자가 이 주석만 보고 "RESTORED/BOOTED 는 여전히 무방비"라고 오판할 위험이 있다.
  - 제안: 해당 주석에서 `RESTORED`/`BOOTED` 를 제외하고 `USER_MESSAGE` 만 남기도록 갱신(예: "가드 범위는 WAITING·RESTORED·BOOTED — USER_MESSAGE 만 아직 무가드").

- **[INFO]** 리뷰 payload 의 파일 5(`plan/in-progress/harness-session-anchor-guards.md` 전체 삭제)는 실제 HEAD(`215cd1c3f`) 상태와 불일치하는 것으로 보인다 — diff 캡처 시점의 아티팩트로 판단, 코드 품질 이슈 아님.
  - 위치: 리뷰 payload 파일 5.
  - 상세: `git show 215cd1c3f:plan/in-progress/harness-session-anchor-guards.md` 로 확인한 결과 해당 파일은 **현재도 그대로 존재**한다. 이 파일은 조상 커밋 `14bc86a53`(`#965`, 이미 이 브랜치 히스토리에 병합됨)이 추가했고, 리뷰 대상 3개 커밋(`68ff69ba7`/`b8ea32b63`/`215cd1c3f`) 중 어느 것도 이 경로를 건드리지 않는다(`git log 5de44d4d6..215cd1c3f -- <path>` 에 `14bc86a53` 만 나타남). 리뷰 진행 중 대상 worktree 가 다른(동시) 프로세스에 의해 계속 갱신되는 것을 관찰했으므로(아래 참고), diff 생성 시점과 스냅샷 시점 사이의 레이스로 추정된다.
  - 제안: 오케스트레이터가 diff 재생성 시 이 항목이 사라지는지 확인. 코드 리뷰 관점에서는 조치 불필요.

- **[INFO]** spec `2-sdk.md` 의 `code:` frontmatter 보강(`host-bridge.ts`·`use-widget.ts` 추가) 타당성 — 확인 결과 합리적, 문제 없음.
  - 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter.
  - 상세: `spec/conventions/spec-impl-evidence.md` §2.1/R-1 은 `code:` 를 "해당 spec 이 약속한 surface 의 구현 경로"로 정의하고 글로브를 허용한다. `1-widget-app.md` 의 기존 `code: - codebase/channel-web-chat/**` 글로브가 이미 이 두 파일을 매칭하므로 `spec-code-paths.test.ts` 빌드가드 관점에서는 이번 보강이 **필수는 아니다**(추가 안 해도 통과). 그러나 §106(재전송 계약)을 **서술하는 문서가 2-sdk.md** 이고 `1-widget-app.md` 는 재전송 자체를 서술하지 않으므로, "약속을 서술한 문서에 그 증거를 건다"는 원칙(spec-coverage NLP 매칭·독자 가독성)에는 `2-sdk.md` 가 더 정확하다. 저장소에 이미 존재하는 "주석 달린 `code:` 항목 추가" 패턴(`spec/2-navigation/10-auth-flow.md`, `# §7.2 로그인 후 ... catch-all` 주석 사례)과도 형식이 일치한다. 두 spec 문서의 `code:` 가 이제 일부 중복 매칭되지만, `spec-impl-evidence.md` 에 "복수 spec 이 동일 코드를 매칭하면 안 된다"는 배타 규칙은 없다.
  - 제안: 조치 불필요 — 판단이 타당함을 확인.

- **[INFO]** A-6(ERROR 로 종료된 대화가 재부팅으로 부활)가 위반한 명시적 spec 조항은 없다 — `1-widget-app.md §3.1` 전이표의 **커버리지 갭**(회색지대)이며, 명문화를 권고한다.
  - 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1`(전이표: 닫기/대화 종료/새 대화/토큰 만료·서버 타임아웃/새로고침 5행).
  - 상세: §3.1 표는 `[ended]` 로 들어가는 4개의 **명명된** 경로(대화 종료·새 대화·토큰 만료/서버 타임아웃·새로고침 만료/410)를 갖고, 그중 대화 종료·새 대화는 명시적으로 "세션 정리"를 동반한다고 서술한다. 그러나 **"명령/시작이 일반 에러(non-410)로 실패 → `ERROR` → `[ended]`"** 라는, 위젯의 `ERROR` action 이 실제로 나타내는 다섯 번째 경로는 이 표에 행이 없다 — spec 이 침묵하는 영역이다. 따라서 A-6 은 spec 문장을 "위반"한 게 아니라, spec 이 미처 다루지 않은 전이에 대한 구현 갭을 메운 것이다. 다만 이 결함 클래스(부활)는 이미 `WAITING`(전전 라운드) → `RESTORED`/`BOOTED`(이번 A-6) 로 두 차례 재발했고, 위 CRITICAL/WARNING 항목에서 보듯 같은 클래스의 세 번째 변형(world 축 오염, 좀비 SSE)이 여전히 발견되는 중이다 — "모든 `[ended]` 전이는 세션 정리를 동반해야 한다"는 불변식을 §3.1 표에 명문화(project-planner 위임)해 두면, 향후 새 action/호출부가 추가될 때 이 클래스가 네 번째로 재발하는 것을 spec 레벨에서 방지하는 데 도움이 된다.
  - 제안: `project-planner` 에게 `1-widget-app.md §3.1` 표에 "명령/시작 실패(일반 에러) → ended" 행을 추가하고, "ended 로의 모든 전이는 teardownSession(세션 정리)을 동반한다"는 불변식을 본문에 명시할 것을 권고. 본 reviewer 는 spec 을 직접 수정하지 않는다.

---

## Plan 문서 정량 주장 표본검증 결과 (사용자 지정 검증 항목)

`plan/in-progress/webchat-boot-single-flight.md` 의 정량 주장을 리뷰 대상 commit(`215cd1c3f`)의 격리 clean checkout 에서 **전부 재현**했다 — 이번 건은 과대 주장이 아니었다.

- **A-5 mutation 매트릭스**(주장: `4/3/1/1/4/0`) — `use-widget-eager-start.test.ts`(48 tests) 기준, `isAttemptStale`/`beginBootAttempt` 를 정확히 주장된 방식으로 mutate 하며 재현:
  | mutation | 주장 | 실측 |
  |---|---|---|
  | boot 축 무력화(world-only 로 축소) | 4 | **4** ✓ |
  | 첫 지점만 제거(`isEmbedAllowed` 뒤) | 3 | **3** ✓ |
  | 둘째 지점만 제거(`seedWaitingFromStatus` 뒤) | 1 | **1** ✓ (신규 테스트 "§106: 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다" 가 유일하게 실패) |
  | world 축 무력화(boot-only 로 축소) | 1 | **1** ✓ (신규 테스트 "embed-config 왕복 중 언마운트..." 가 유일하게 실패) |
  | 세대 미증가(`++` 제거) | 4 | **4** ✓ |
  | 베이스라인(무변경) | 0 | **0** ✓ |
- **"둘째 지점·world 축이 직전엔 0(무방비)이었다" A/B 주장** — **직접 재현**: 이 PR 의 **부모 커밋**(`5de44d4d6`, `origin/main` 조상)을 별도로 체크아웃해 `applyConfig` 의 두 `isStale(gen)`(당시 world-only) 호출을 모두 무력화하고 **그 시점의 44개 테스트**를 실행 → **44/44 전부 통과**(0 실패) 확인. "이 파일이 3번 회귀를 낸 계열의 비대칭"이라는 주장과 "world 가드가 한 번도 고정된 적 없었다"는 주장 모두 실측 근거가 있음을 확인했다.
- **A-6 mutation 주장**(`RESTORED 가드 제거 → 2건(단위+통합) / BOOTED 가드 제거 → 1건`) — 재현: RESTORED 가드 제거 시 `widget-state.test.ts` 1건 + `use-widget-eager-start.test.ts` 1건 = **2건** 실패 ✓. BOOTED 가드 제거 시 `widget-state.test.ts` **1건만** 실패(통합 테스트는 BOOTED 가 `ended` 에서 도달 불가하므로 무영향, plan 의 "오늘 도달 불가" 서술과 일치) ✓.
- **테스트 총계**: 리뷰 대상 commit 을 clean checkout 해 전체 스위트 실행 → `channel-web-chat 382 passed(22 파일)` — plan 이 "spec code: 증거" 절에서 주장한 수치와 정확히 일치. (참고: 대상 worktree 를 **직접** 실행하면 383 이 나오는데, 이는 위 CRITICAL/WARNING 항목에서 언급한 동시 진행 중인 미커밋 후속 수정이 테스트 1건을 추가했기 때문 — 리뷰 대상 diff 자체의 수치 오류가 아님을 clean checkout 으로 확인했다.)
- typecheck(`tsc --noEmit`): 대상 worktree 에서 에러 없음 확인.

---

## 요약

이 PR 은 spec `2-sdk.md §106`("host 는 wc:boot 재전송으로 boot config 를 갱신할 수 있고, 위젯은 마지막 wc:boot 의 config 를 적용한다")의 핵심 문장을 `bootGenRef`/`beginBootAttempt`/`isAttemptStale` 토큰으로 구현하고, resolve-순서-역전 시나리오에서 이를 테스트로 고정했다 — **단순 resolve-순서-역전 케이스는 정확히 동작**하며, `locale` 1회 해석(§106 단서 문장)·origin 핀·같은 endpoint 재부팅 시 중복 시작 방지 등 §106 의 나머지 문장들과도 코드 추적상 모순되지 않는다. Plan 문서의 정량 주장(mutation 매트릭스 4/3/1/1/4/0, "둘째 지점·world 축 직전엔 0" A/B 주장, A-6 mutation 2/1, 총 382 테스트)은 격리 worktree 에서의 독립 재현으로 **전부 정확함**을 확인했다 — 이 저장소의 과거 과대 주장 이력과 달리 이번 plan 은 신뢰할 만하다. 다만 §106 을 "실제로 충족하는지"를 더 깊게(단순 2-way resolve-역전을 넘어 "겹친 시도 중 하나가 세션 종료를 발견하는" 3-way 상호작용까지) 실측 검증한 결과, **§106 의 핵심 문장 자체를 위반하는 CRITICAL 레이스**(대체된 시도의 종료-확정 부수효과가 world 세대를 오염시켜, 아직 살아있는 "마지막" wc:boot 시도가 stale 로 오판되어 config 가 옛 값에 고착)를 실측 재현했다. 또한 이번 diff 의 핵심 산출물인 A-6(ERROR 종료 부활 방지)는 reducer 레벨 방어(phase 는 정확히 `ended` 유지)에는 성공하지만, 근본 원인(ERROR 경로가 세션을 정리하지 않는 것)은 열려 있어 화면 뒤에서 좀비 SSE 연결·불필요 재조회가 발생함을 실측으로 확인했다 — A-6 를 "완전히 닫힌 결함"으로 서술하는 것은 과장이다. 흥미롭게도 리뷰 도중 대상 worktree 에 이 두 CRITICAL/WARNING 을 정확히 겨냥한 **미커밋 후속 수정이 이미 진행 중**임을 관찰했고(같은 배치의 concurrency reviewer 가 첫 번째를 CRITICAL 로 독립 발견한 주석까지 확인), 이는 두 발견 모두 오탐이 아님을 강하게 교차 확인해준다. spec `code:` frontmatter 보강(host-bridge.ts·use-widget.ts → 2-sdk.md)은 컨벤션과 정합해 문제없고, A-6 이 위반한 "명시적" spec 조항은 없으나(§3.1 표의 커버리지 갭) 이 결함 클래스의 반복 재발(WAITING→RESTORED/BOOTED→이번 world/SSE 변형)을 고려하면 "모든 ended 전이는 세션 정리를 동반한다"는 불변식을 spec 에 명문화할 가치가 크다.

## 위험도

HIGH — CRITICAL 1건(§106 핵심 문장 위반, 실측 재현)과 WARNING 3건(근본원인 미해결 zombie SSE·실사용 빈발 UX 플리커·stale 주석)이 존재하나, CRITICAL·최상위 WARNING 모두 대상 worktree 에 이미 수정이 진행 중인 것으로 관찰되어 머지 차단이 아니라 "그 후속 수정을 이번 라운드에 반드시 포함/확인"하는 방향의 조치가 합리적으로 보인다.
