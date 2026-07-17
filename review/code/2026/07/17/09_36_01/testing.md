# 테스트(Testing) 리뷰 — 08_29_33 후속 조치 재검토 (2026-07-17 09_36_01)

대상: `codebase/channel-web-chat/src/lib/widget-state.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`codebase/channel-web-chat/src/widget/use-token-refresh.{ts,test.ts}`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
`review/code/2026/07/17/08_29_33/{RESOLUTION.md,SUMMARY.md,*.md}`(직전 라운드 산출물).

본 라운드는 직전 리뷰(`08_29_33`)의 testing CRITICAL 2건에 대한 조치를 검증하는 재검토다. 아래 세 가지를
**직접 실행/변이(mutation) 테스트로 독립 검증**했다(정적 코드리딩만으로 판단하지 않음).

## 검증 방법 요약

1. **비결정 실패(C2) 재현 검증**: 동일 명령(`npx vitest run`, 파일 인자 없음) 반복 실행. 처음에는 공유
   worktree(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`)에서 60회,
   이어서 `git worktree add --detach <scratch>/wt 31a7ce4fc`(리뷰 대상 HEAD)로 만든 **격리 worktree**에서
   추가 60회 실행.
2. **flushAsync 검증력 평가**: 정적 await-체인 추적(fetch→json→내부 함수 반환 홉 수 계산) + fake-timer
   블록과의 겹침 여부 확인 + 아래 mutation 테스트 결과로 교차검증.
3. **신규 회귀 테스트 6건 mutation 검증**: 두 번째 격리 worktree(`31a7ce4fc` 고정)에서 각 가드를 개별
   제거 → 해당 테스트 파일만 실행 → 실패 테스트 수 확인 → 원본 복원(`git diff --stat` 로 clean 확인)을
   가드마다 반복.

## 발견사항

- **[CRITICAL]** C2(비결정 실패) 재현됨 — 단, 원인은 `worldGenRef` 코드 레이스가 아니라 **리뷰가 실행되는
  공유 worktree 자체가 다른 프로세스에 의해 실행 중 동시 변경**되기 때문임을 직접 증거로 확인. RESOLUTION.md
  의 귀속 반박은 **결론(코드 자체는 안전)은 독립 재확인되나, 근거("리뷰 fan-out 중 환경 부하 아티팩트로
  추정, 단정하지 않음")는 과소 특정**되어 있었음.
  - 위치: 리뷰 대상 코드 자체가 아니라 **본 ai-review 파이프라인의 실행 환경**(공유 worktree
    `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`).
  - 상세(재현 절차와 증거):
    1. 공유 worktree 에서 `npx vitest run` 60회 반복 → **9회 실패(15%)**, 직전 리뷰어의 13%(46회 중 6회)
       보다도 높은 비율로 재현. 실패는 44~55회차에 몰려 있었다(연속 클러스터 — 무작위 산발이 아님).
    2. 실패 중 2건(`44`,`45`)은 **`widget-state.test.ts` 의 W4 순수 리듀서 단위테스트**였다 —
       `reduce([...])` 는 async/timer/DOM 어느 것도 쓰지 않는 100% 동기 순수함수 호출인데
       `expect(s.phase).toBe("ended")` 가 `Received: "awaiting_user_message"` 로 실패했다. **순수함수가
       "타이밍"으로 비결정 실패하는 것은 JS 런타임 자체로는 불가능**하다 — 이는 테스트 실행 시점에 로드된
       소스 내용이 내가 방금 읽은 내용과 달랐다는 것의 강한 방증이다. 이 파일만 20회 단독 격리 실행 시
       100% 안정(20/20 통과, 직전 리뷰어의 "격리 실행은 항상 안정" 관찰과 일치).
    3. 실패 3건(`48`,`49`,`50`)은 **W3 회귀 테스트**(언마운트 중 storage 부활 방지)가 정확히 그 막으려던
       증상으로 실패: `stderr` 에 `[widget] getStatus seed failed: unexpected fetch ...` 경고가 찍히고
       `expect(sessionStorage.getItem(...)).toBeNull()` 이 실제 세션 JSON 을 받아 실패했다.
    4. 실패 4건(`52`~`55`)은 **C1 회귀 테스트**가 `TypeError: Cannot read properties of null (reading
       'triggerEndpointPath')` 로 `use-widget.ts:205` 에서 **미처리 예외**를 던지며 실패 — 바로 그 줄을
       보호하는 C1 가드(`if (!configRef.current) return;`, L198)가 무력화된 것과 동형의 증상이다.
    5. 결정적 증거: 실패가 관측되던 시점 전후로 `git status --short` 를 재실행하자, **`use-widget.ts`,
       `use-token-refresh.ts`, `widget-state.ts`, `widget-state.test.ts`, `use-widget-eager-start.test.ts`,
       `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/code/.../RESOLUTION.md` 가
       실시간으로 `M`(modified, unstaged) 상태로 나타나고 계속 늘어났다** — 그중 한 줄의 신규 주석은
       "(ai-review 2026-07-17 09_36_01 — side_effect·security 독립 지적)" 라고 **본 라운드**를 명시적으로
       인용하고 있어, 다른 프로세스(개발자/오케스트레이터 에이전트로 추정)가 **이 동일 라운드의 다른
       reviewer 발견사항을 이미 이 공유 디렉터리에 라이브로 반영 중**이었음을 확인했다. 한 실행 로그에는
       `Cannot find module '.../src/lib/__scratch_reducer_check.test.ts'`(git 에 존재하지 않는 파일) 오류도
       찍혀, 제3의 프로세스가 이 디렉터리에 임시 파일을 만들었다 지운 흔적까지 포착했다.
    6. **격리 재검증**: `git worktree add --detach <scratch> 31a7ce4fc`(본 diff 의 HEAD)로 다른 프로세스와
       완전히 분리된 별도 worktree 를 만들고(소스만 격리, `node_modules` 는 심링크) 동일 명령을 60회
       반복 → **실패 0회(0/60)**. mutation 검증(아래 항목)에서 재현한 실패 시그니처(`Cannot read
       properties of null`, `getStatus seed failed`)가 각각 C1·W3 가드를 **의도적으로 제거했을 때**와
       정확히 일치해, 공유 worktree 관측 실패가 "다른 프로세스의 일시적 가드 부재/변경 상태"를 우연히
       읽은 것이라는 설명과 정합적이다.
  - **결론**: 리뷰 대상 코드(`worldGenRef` 게이팅)에 async 레이스로 인한 진짜 비결정성이 있다는 증거는
    **없다** — 격리 환경 60/60 통과로 RESOLUTION.md 의 핵심 주장(코드 자체는 무죄)을 독립적으로 지지한다.
    그러나 "리뷰 fan-out 환경에서 반복 실행해 비결정성을 판정한다"는 **검증 방법론 자체가 이 프로젝트의
    실제 운영 방식(여러 sub-agent 가 같은 worktree 를 동시 사용)에서는 신뢰할 수 없다**는 것이 이번에
    최초로 구체적 증거와 함께 확인됐다. 직전 라운드의 13%(46회 중 6회) 관측도 동일 메커니즘(공유
    worktree 동시 편집)일 가능성이 높다 — 즉 두 리뷰어의 상반된 관측은 "누가 틀렸다"가 아니라 **둘 다
    통제되지 않은 공유 환경을 측정했다**로 통합 설명된다.
  - 제안: (1) C2 자체는 이번 독립 재검증(격리 60/60)으로 **종결 가능** — 추가 코드 수정 불필요. (2) 다만
    이 ai-review 파이프라인이 향후 "반복 실행으로 비결정성 판정"이 필요한 사안(C2 류)을 다룰 때는 본
    문서에서 쓴 방법(`git worktree add --detach <scratch-path> <commit>` + `node_modules` 심링크)으로
    **공유 worktree 밖에서** 측정하도록 절차화할 것을 권장 — 그렇지 않으면 향후에도 "리뷰 fan-out 이 자기
    자신의 flaky 측정을 오염시키는" 동일 함정이 반복된다.

- **[WARNING]** W2 신규 회귀 테스트가 연관된 두 가드 중 **어느 하나만 있어도 통과** — 개별 가드를
  독립적으로 회귀 고정하지 못함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:380`(`seedWaitingFromStatus` catch 분기의
    세대 검사, 이하 "가드 a") 와 `:718`(`applyConfig` 의 명시적 재검증, 이하 "가드 b") —
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 의 "W2: 복원 seed 가 network
    오류로 soft-fail 해도..." 테스트가 이 둘을 대상으로 한다.
  - 상세: RESOLUTION.md §W2 는 mutation 표로 "8개(가드 a 만) → 통과, 이것만으로 충분 / 9개(a+b) → 통과,
    b 는 진짜 defense-in-depth" 라고 적어, 가드 a 가 **root fix**이고 b 는 **추가** 방어라는 인상을 준다.
    그런데 이는 "처음부터 순서대로 추가"하는 서사에서만 참이다. **최종 코드(둘 다 존재)에서** 가드 a
    **만** 제거하고 가드 b 를 그대로 두면 — 즉 `applyConfig` 자신의 재검증만 남기면 — **W2 를 포함해
    39/39 전부 통과**한다(직접 mutation 확인). 반대로 가드 b 만 제거하고 가드 a 를 남겨도 **39/39 전부
    통과**한다. **둘을 동시에 제거해야만** W2 가 실패한다(39건 중 1건). 이유는 두 가드가 완전히 동일한
    `worldGenRef`/`gen` 값 쌍을 비교하는 **중복 검사**이기 때문 — `applyConfig` 의 `gen` 은 함수 최상단에서
    캡처된 값으로, 가드 a 가 무력화돼 `"continue"` 를 반환해도 가드 b 가 **독립적으로** 동일 staleness 를
    잡는다. 즉 이 테스트는 "가드 a 와 b 중 최소 하나는 존재한다"만 고정할 뿐, RESOLUTION.md 가 "root
    fix"라고 부른 가드 a **개별**을 회귀 잠금하지 못한다. 향후 누군가 "이미 `applyConfig` 에 재검증이
    있으니 catch 분기의 검사는 중복"이라 판단해 가드 a 만 제거해도(또는 그 반대), W2 는 여전히 그린이다.
  - 제안: 두 가드를 **개별적으로** 핀하려면 (a) `seedWaitingFromStatus` 를 직접 호출하는 **단위 테스트**를
    추가해 catch 분기만 독립 검증(현재 `applyConfig` 를 경유하는 통합 테스트라 두 계층이 늘 함께 실행됨),
    또는 (b) 현재 상태 유지가 의도라면(둘 다 defense-in-depth 목적으로 "어느 하나만 있어도 안전"이 진짜
    설계 의도) RESOLUTION.md/JSDoc 의 "가드 a 만으로 충분" 서술을 "가드 a·b 는 상호 대체 가능한 중복
    방어"로 정정해 오해를 줄일 것.

- **[WARNING]** flushAsync 관용구 "선제 제거"가 같은 라운드에 추가된 자매 테스트에는 적용되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:124`(W5 테스트 내부,
    `resolveRefresh?.(...); await Promise.resolve();`) vs
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:156-158`(`flushAsync()` 정의,
    같은 파일 12곳 이상에 적용).
  - 상세: RESOLUTION.md §C2 는 "고정 횟수 microtask flush 관용구는 실재하는 취약성이므로 선제
    제거"했다고 명시하고, 그 근거(`flushAsync` 함수 docstring)는 "체인 길이를 추측하지 않아도 된다"는
    일반 원칙을 든다. 그런데 **같은 커밋에서 새로 추가된** W5 테스트(`use-token-refresh.test.ts`)는 정확히
    그 지적받은 관용구(고정 1회 `await Promise.resolve()`)를 그대로 사용한다. 이 특정 인스턴스는 직접
    추적한 결과 `refreshToken().then(fn1)` 이 단일 홉이라 **현재는 안전**하다(1회 microtask 로 fn1 전체가
    동기적으로 완결) — 활성 버그는 아니다. 그러나 "체인 길이를 몰라도 된다"는 flushAsync 도입의 핵심
    근거가 이 파일에는 적용되지 않았고, `useTokenRefresh` 의 `.then()` 핸들러에 향후 await 한 홉만
    추가돼도(예: 응답 검증 로직 추가) 이 테스트는 정확히 C2 가 지적한 산발적 실패 패턴으로 회귀할 수
    있다. `flushAsync` 는 `use-widget-eager-start.test.ts` 로컬 함수라 export/공유되지 않으므로, 이
    파일에서 쓰려면 별도 구현이 필요했을 것이다 — 파일 경계를 넘는 공유 테스트 유틸리티 부재가 이
    비일관성의 한 원인으로 보인다.
  - 제안: `use-token-refresh.test.ts:124` 도 동일 매크로태스크 플러시로 교체하거나(현재 안전하다는
    이유로 급하지 않다면), 최소한 두 파일이 쓰는 "매크로태스크 1틱 플러시" 관용구를 공유 테스트
    유틸리티(예: `src/test-utils/flush.ts`)로 추출해 향후 두 파일이 계속 갈라지지 않게 할 것을 권장.

- **[INFO]** flushAsync 교체는 검증력을 약화시키지 않음(오히려 negative-assertion 테스트를 강화) — 직접 확인
  - 상세: (1) 정적 추적 — `flushAsync()` 는 `setTimeout(r, 0)` 매크로태스크 경계이므로, 그 시점까지 큐에
    쌓인 microtask 를 **전부** 배출한다(고정 횟수 `Promise.resolve()` 보다 항상 같거나 더 철저). 예:
    `applyConfig` 의 embed-config 검증 체인(`fetch → res.json() → fetchEmbedConfig 반환 → isEmbedAllowed
    반환`)은 4~5 microtask 홉이 필요해, 구 관용구(1~2회)로는 원천적으로 부족했다 — 이 교체가 필요했다는
    주장은 타당하다. (2) fake timer 비간섭 확인 — 파일 내 `vi.useFakeTimers` 는 두 블록(라인
    239·788 부근)뿐이고 전부 `shouldAdvanceTime: true`, `flushAsync()` 호출 15곳 중 어느 것도 그 두
    블록 안에 있지 않음을 grep 으로 확인(실제 timer 컨텍스트에서만 사용). `scheduleRefresh` 의 최소
    지연(`TOKEN_REFRESH_MIN_DELAY_MS`=5000ms)도 0ms 매크로태스크로는 우발적으로 발화하지 않는다.
    (3) 경험적 검증 — 위 mutation 테스트에서 C1·W2·W3 세 테스트 모두 `flushAsync()` 를 최종 단언 직전에
    사용하는데, 대응 가드를 제거했을 때 **매번 정확히 그 테스트만 실패**했다(레이스를 우연히 피해가며
    거짓 PASS 를 내는 사례 없음) — flushAsync 가 버그를 "지나쳐서" 놓치는 정황은 관측되지 않았다.
    "이전엔 잡히던 타이밍 회귀를 이제 놓치는가"라는 질문에는 **아니다** — 오히려 negative-assertion
    테스트(예: "이후 아무 일도 안 일어남")는 버그 코드에 완결될 시간을 더 충분히 주므로 검출력이
    상승하는 방향이다.

- **[INFO]** 신규 회귀 테스트 6건 중 5건은 독립 mutation 검증으로 "주장하는 버그를 실제로 잡음" 확인
  - 상세(모두 격리 worktree, 대상 가드 제거 → 원본 복원 사이클로 검증, 매번 `git diff --stat` clean 확인):
    - **C1**(`use-widget.ts:198` 가드 제거) → `use-widget-eager-start.test.ts` 39건 중 **C1 1건만** 실패.
    - **W3**(`use-widget.ts:778` 언마운트 `worldGenRef.current++` 제거) → 39건 중 **W3 1건만** 실패
      (`stderr` 에 `getStatus seed failed: unexpected fetch...`, `sessionStorage` 값 잔존) — 직전
      리뷰어가 "제거해도 364건 중 0건 실패"라 실증했던 바로 그 결함이 **이제는 정확히 잡힘**을 확인.
    - **W5**(`use-token-refresh.ts:92` 가드 제거) → `use-token-refresh.test.ts` 11건 중 **W5 1건만** 실패.
    - **W4 첫 테스트**(`widget-state.ts:138` `if (state.phase==="ended") return state;` 제거) →
      `widget-state.test.ts` 39건 중 **W4 1건만** 실패(`Received: "awaiting_user_message"`).
    - **W4 둘째 테스트**("START 는 ended 를 벗어나는 유일한 경로")는 이번 diff 가 건드리지 않은 기존
      `case "START"` 로직을 검증하는 **동반(non-overreach) 테스트**라 이 diff 신규 라인에 대한
      mutation 표적이 없음 — 가드가 정상 재시작 경로를 막지 않는지 확인하는 용도로는 적절하다.
    - **W2** 는 위 WARNING 항목 참고(두 가드 중 하나만 있어도 통과 — "버그 클래스"는 잡지만 "가드
      개별"은 안 잡음).
  - 이 5건은 회귀 검증력이 실측으로 뒷받침되며, 대부분 명확한 JSDoc/인라인 주석으로 "왜 이 시나리오가
    재현 버그인지" 를 기술해 가독성도 양호하다.

- **[INFO]** `worldGenRef` 를 `useTokenRefresh` 에 명시적 `MutableRefObject<number>` 의존성으로 주입한
  것은 테스트 용이성 개선 사례
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:44`(`TokenRefreshDeps.worldGenRef`),
    `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:74`(`worldGenRef: { current: 0 }`).
  - 상세: W5 테스트는 `useWidget()` 전체를 렌더링하지 않고 `refs.worldGenRef.current += 1` 로 "세계가
    바뀜"을 직접 흉내낼 수 있다 — 의존성을 ref 로 명시 주입한 설계 덕분에 async mock 오케스트레이션
    없이 순수하게 이 훅만 단위 테스트할 수 있었다(테스트 대상 코드가 테스트하기 쉬운 구조로 되어 있는
    좋은 사례). `cancelledRef` 제거로 훅의 불변식이 하나 줄어든 것도 테스트 표면을 단순화한다.

## 요약

세 가지 검증 요청에 대한 결론은 다음과 같다. **(1) C2(비결정 실패)**: 코드 자체(`worldGenRef` 게이팅)에
async 레이스가 있다는 증거는 격리된 환경에서 60/60 반복 실행으로 찾지 못해 RESOLUTION.md 의 핵심 주장을
지지하지만, **공유 worktree 에서는 실제로 재현됐고(60회 중 9회, 15%) 그 원인은 이 review 파이프라인의
다른 프로세스가 같은 파일을 실행 중에 동시 편집하고 있었기 때문**임을 `git status` 실시간 관찰·순수함수
비결정 실패·phantom 파일 오류라는 세 겹의 직접 증거로 확인했다 — 이는 "코드 결함"이 아니라 "반복 실행
기반 flaky 판정 방법론이 이 프로젝트의 동시 실행 리뷰 환경에서는 신뢰할 수 없다"는, 직전 라운드에도
소급 적용되는 별도의 인프라적 CRITICAL 이다. **(2) flushAsync 치환**: 검증력을 약화시키지 않았고
(mutation 테스트로 실증), 오히려 negative-assertion 테스트를 강화하는 방향이다. 다만 동일 라운드에
추가된 `use-token-refresh.test.ts` 의 W5 는 지적받은 취약 관용구를 새로 도입해 일관성이 깨졌다(현재는
안전하지만 잠재 리스크). **(3) 신규 회귀 테스트 6건**: 5건(C1·W3·W5·W4×2)은 mutation 검증으로 실제
버그를 정확히 잡음을 확인했고 특히 W3 는 직전 리뷰어의 "0건 실패" 실증을 뒤집는다. 나머지 1건(W2)은
연관된 두 가드 중 어느 하나만 있어도 통과해, "가드 a 가 root fix" 라는 RESOLUTION.md 서술과 달리 개별
가드를 독립적으로 회귀 고정하지는 못한다(현재 둘 다 존재하므로 활성 위험은 아님). 전반적으로 이번
라운드의 테스트 작업물은 실측·mutation 검증을 동반한 성숙한 프로세스를 보여주나, 이번 재검토에서 그
프로세스가 스스로 놓친 환경적 함정(공유 worktree flaky 측정)과 테스트 커버리지의 미세한 정밀도 이슈
(W2 중복 가드, flushAsync 비일관 적용)를 추가로 드러냈다.

## 위험도

MEDIUM — 리뷰 대상 diff 자체의 코드/테스트 품질은 양호하며(5/6 신규 테스트 mutation 검증 통과, 격리
환경 60/60 무실패로 C2 코드-레벨 무죄를 재확인) 병합을 막을 활성 결함은 발견되지 않았다. 다만 (a) 이번에
새로 규명한 "공유 worktree 동시 실행이 flaky 판정을 오염시킨다"는 발견은 이 코드베이스뿐 아니라 리뷰
파이프라인 자체의 신뢰성에 관한 것이라 조치 우선순위가 높고, (b) W2 의 중복 가드·flushAsync 비일관 적용은
현재는 잠재적(non-blocking) 이슈로 WARNING 수준이 적절하다.
