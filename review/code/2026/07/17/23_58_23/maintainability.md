# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight (23_58_23)

리뷰 대상: `origin/main` 대비 브랜치 전체(18 커밋, merge-base `29aa918a6`)이나, orchestrator 지시에 따라
**이번 라운드 핵심 diff**(A-6 되돌림 `8b37e8bef`, concurrency fix `fa1dceba5`, 잔여 정리 `d48a48aae`)에
집중해 실제 `codebase/channel-web-chat/src/lib/widget-state.ts` · `widget-state.test.ts` ·
`codebase/channel-web-chat/src/widget/use-widget.ts` · `use-widget-eager-start.test.ts` HEAD 스냅샷을
직접 읽고 `git show`/`grep`/`wc` 로 실측했다(공유 워크트리 — 코드 수정 없이 read-only 로만 검증).

---

## 발견사항

### 지시받은 판단 1 — `seedWaitingFromStatus` 의 이중 staleness 정책은 명확히 방어됐다

- **[INFO] 이중 정책(종료 확정=world만 / 표면 갱신=world+boot)이 코드·문서·테스트 3중으로 방어돼 있다 — "대칭 함정" 재발 위험은 낮다**
  - 위치: `use-widget.ts:486-502`(JSDoc 표) · `:528`(공통 world 가드) · `:534-537`(종료 확정 분기, 추가 가드 없음) · `:541`(표면 갱신 분기, `attempt && cannotApplyConfig(attempt)` 추가 가드) · `use-widget-eager-start.test.ts:3095-3149`(반대 축 회귀 테스트).
  - 상세: 실제 구조를 추적하면 두 정책이 **분기 순서 자체로** 구현돼 있다 — `try` 블록 진입 시 공통 `isStale(gen)`(world 축, L528)이 이후 코드 전체를 게이팅하고, `waiting_for_input` 분기(L538-554)만 그 위에 `cannotApplyConfig(attempt)`(boot 축, L541)를 **추가로** 얹는다. 즉 "표면 갱신에 boot 가드를 추가로 붙인다"가 코드의 실제 모양이지 "종료 확정에서 가드를 뺀다"가 아니어서, 대칭을 맞추려는 편집은 종료 확정 분기(L534-537)에 **없는 코드를 새로 추가**해야 한다 — 실수로 섞여 들어가기보다 의도적 편집이 필요한 구조다.
  - 문서 방어선: JSDoc 표(L488-491)가 "합치지 말 것" 을 표 제목에 명시하고 각 분기의 "왜" 를 적었다. 표면 갱신 쪽 근거(대체된 시도의 지연 응답이 살아있는 화면을 되감는다)와 종료 확정 쪽 근거(종료는 세계의 사실이지 시도의 소유물이 아니다 — `sessionEstablished()` 스킵으로 살아있는 시도가 자기 `getStatus` 를 안 낼 수 있고, 버퍼 만료 구간엔 terminal SSE 도 재도착하지 않는다)가 각각 독립적으로 설득력 있다.
  - 테스트 방어선(가장 강력): `use-widget-eager-start.test.ts:3104` 의 테스트명 자체가 불변식을 서술한다 — `"대체된 시도가 발견한 종료는 그대로 확정된다 (종료 확정은 boot 축을 보지 않는다)"`. 바로 위 주석(`:3102-3103`)이 오케스트레이터가 이번에 제기한 우려와 **문장 단위로 거의 동일한 표현**을 이미 선언해 두었다: `"이 방향을 고정하지 않으면 '대칭이 예뻐 보인다' 는 이유로 종료 확정에도 boot 가드가 붙는다 — 실제로 mutation 시 이 테스트가 없을 땐 388건 전부 통과했다(무방비)."` 즉 이 위험은 사후에 발견된 게 아니라 **이 diff 를 쓴 사람이 직접 예견하고 회귀 테스트로 선제 고정**한 것이다. `RESOLUTION.md`/plan 의 mutation 매트릭스도 "종료 확정에 boot 가드 추가 → 1 실패(직전엔 0·무방비)" 로 이 테스트의 효력을 별도로 재확인해 뒀다.
  - 잔여 리스크(경미): 테스트 기반 방어는 "테스트를 이해 못 한 채 실패를 없애려 값만 맞춘다" 는 실패 모드에는 완전 면역이 아니다 — 다만 테스트명이 불변식을 그대로 서술하므로, `cannotApplyConfig(attempt)` 한 줄을 종료 분기에 추가하면 이 테스트가 실패하고 실패 메시지 근처 주석을 읽지 않고 통과시키기는 이름상 어렵다. 구조적으로 한 단계 더 강하게 하려면 `finalizeEnded` 호출부와 `WAITING` dispatch 호출부를 두 개의 이름이 다른 predicate(`isStale`/`isStaleForSurface` 류)로 시각적으로 분리하는 것도 가능하나, 현재도 표+테스트로 충분히 방어되고 있어 **필수는 아니고 선택적 개선**이다.
  - 결론: 오케스트레이터가 우려한 "다음 사람이 대칭을 맞추려다 §3(재전송) 을 깨뜨릴 위험" 은 **이미 이 diff 안에서 명시적으로 인지·서술·테스트로 고정되어 있다.** 리뷰 시점 기준 이 항목은 이슈가 아니라 좋은 방어 패턴의 사례로 판단한다.

### 지시받은 판단 2 — `useWidget()` 규모와 `useEiaSession` 분리 이월

- **[WARNING] `useWidget()` 이 930줄·`useCallback` 26개·`useRef` 13개로 이 저장소 최대 단일 함수이며, 이번 PR 동안에도 계속 커지고 있다 — 자동 가드가 전무하다**
  - 위치: `use-widget.ts:121`(함수 시작) ~ `:1052`(닫는 괄호, `errMessage` 직전) — 실측 931줄. `useCallback(` 선언 26개(`grep -n "^  const [a-zA-Z]* = useCallback"`), `useRef(` 선언 13개.
  - 상세(성장 추이 실측, `git show <rev>:<path> | wc -l`): merge-base(`14bc86a53`, origin/main 분기점) 파일 전체 **877줄** → 직전 리뷰 라운드 HEAD(`1c9708ac8`, `18_39_11` 검토 시점) **1005줄** → 이번 라운드 HEAD **1065줄**. 즉 이 브랜치가 살아있는 동안 파일이 +188줄(≈+21%) 커졌고, 그중 **+60줄은 바로 이번 라운드(A-6 되돌림 + concurrency fix + 잔여 정리 3커밋)에서 추가**됐다 — `useEiaSession` 분리를 "이월"로 미룬 바로 그 라운드에 그 대상 함수가 더 커진 셈이다.
  - `codebase/channel-web-chat/eslint.config.mjs` 를 확인한 결과 `max-lines`/`max-lines-per-function`/`complexity` 류 규칙이 없다(grep 0건) — 이 성장을 잡아 줄 자동 게이트가 전혀 없고, 오직 리뷰 라운드마다 사람이 "이번엔 몇 줄" 을 재는 방식으로만 추적되고 있다.
  - 이월 자체(분리를 지금 하지 않는 것)는 **타당하다고 판단한다** — 이번 diff 는 CRITICAL 동시성/데이터유실 버그 3건을 같은 파일에서 함께 고치는 중이라, 대규모 구조 리팩터(훅 분리)를 같은 라운드에 끼워 넣으면 회귀 위험이 커진다. `plan/in-progress/webchat-boot-single-flight.md:129`(A-0 결정 근거 문단)도 "축이 다시 2개가 되어 분리 전제가 흔들린다" 는 구체적 이유로 분리 시점을 뒤로 미루는 판단 근거를 남겼다 — 즉흥적 보류가 아니라 근거를 남긴 보류다.
  - 제안: 분리 자체를 지금 강행할 필요는 없으나, 매 라운드 "이번엔 몇 줄인가" 를 사람이 재는 대신 `eslint` 에 `max-lines-per-function`(warn) 을 도입해 두면 이 특정 함수 하나만 예외 처리(`// eslint-disable-next-line max-lines-per-function` + 사유 주석, 또는 override 설정)로 지정하고, **다른 함수가 같은 클래스로 자라나는 것**은 자동으로 잡을 수 있다. 지금은 `useWidget` 이 이미 예외적으로 크다는 사실 자체가 문서(plan)에만 있고 도구에는 없다.

- **[WARNING] `useEiaSession` 분리 이월의 기록 형식이, 이 PR 이 같은 라운드에서 직접 진단한 "산문 이월 유실" 패턴과 동일한 위험에 노출돼 있다**
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:298-303`(`## 이월 추가 (18_39_11 side_effect·maintainability)` 절, `useEiaSession` 분리 항목) vs. 같은 파일 말미 `## 이월 (신규)` 절(`ERROR`→`ended` 항목을 `webchat-command-failure-is-not-termination.md` 로 **분리**하며 남긴 사유).
  - 상세: 이 plan 은 자신의 말미에서 정확히 이 위험을 스스로 진단한다 — "`ERROR` 가 `phase: 'ended'` 로 보내는 것 자체" 항목을 별도 plan 파일로 분리하면서 **"이 plan 하단의 산문으로만 두면 본 plan 이 `complete/` 로 이동할 때 함께 묻힌다 — `--impl-done` 19_46_54 `plan_coherence` WARNING 이 그 위험을 정확히 지적했다"** 라고 명시했다. 그런데 그보다 앞서 기록된 `useEiaSession` 분리 항목(`:303`)은 **같은 파일의 같은 "이월 추가" 산문 절**에 그대로 남아 있고, 별도 plan 파일로 분리되지도, 이 plan 의 체크리스트(`- [ ]` 항목, `:105-117` 참조)에 편입되지도 않았다. `.claude/docs/plan-lifecycle.md:10` 은 "**모든 작업·체크리스트·후속 항목까지** 끝난 plan" 만 `complete/` 로 이동한다고 규정하는데, 산문 절의 항목이 그 "후속 항목" 판정에 걸리는지는 (체크박스가 아니므로) 기계적으로 보장되지 않는다 — 바로 이 PR 이 `ERROR`/`ended` 항목에서 실증한 실패 유형이다.
  - `webchat-command-failure-is-not-termination.md` 는 spec 변경이 필요해(`project-planner` 트랙) 스킬 경계상 분리가 강제됐다는 차이는 있지만, "산문 이월이 plan 종료 시 함께 묻힌다" 는 위험 자체는 스킬 트랙과 무관하게 `useEiaSession` 항목에도 동일하게 적용된다.
  - 제안: `useEiaSession` 분리 항목을 (a) 이 plan 의 체크리스트에 `- [ ]` 로 승격하거나(단, 이번 PR 범위 밖이라면 완료 조건을 명확히 "다음 PR 로 이관" 으로 명시), 또는 (b) 자매 항목과 동일하게 별도 `plan/in-progress/*.md` 로 분리해 사고 이력(이 클래스 8회)을 근거로 남길 것. 지금 형태로 이 plan 이 `complete/` 로 이동하면 정확히 이 plan 자신이 경고한 유실이 재발할 수 있다.

### 관련 발견 — 코드 자체의 구조적 취약점

- **[WARNING] JSDoc 인접성 유실 버그가 이 파일에서 이미 2회(`pendingResetRef` → `bootGenRef`) 재발했고, 이번 fix 도 "주석으로 경고" 라는 절차적 대응에 그친다 — 자동화된 3번째 방어선이 없다**
  - 위치: `use-widget.ts:178-180`("⚠ 이 블록과 `bootGenRef` 선언 사이에 다른 선언을 끼워 넣지 말 것 — JSDoc 은 인접성으로만 붙는다. 이 파일에서 두 번 당했다") — 이번 diff(`8b37e8bef`)가 새로 추가한 경고 주석.
  - 상세: TypeScript 의 JSDoc-인접 선언 첨부 규칙(연속된 두 `/** */` 뒤에 선언이 두 개 오면 각 선언은 자신의 바로 앞 블록만 갖고 그 앞 블록은 고아가 된다)이 이 파일에서 **같은 클래스**로 두 번 재발했다 — 1차는 `bootGenRef` 삽입이 `pendingResetRef` 의 JSDoc 을 삼켰고(`18_39_11` C3 이전 라운드), 2차는 `unmountedRef` 삽입이 `bootGenRef` 의 JSDoc 을 삼켰다(이번 diff 가 되돌린 대상). 두 사례 모두 검증 방법이 사람이 `ts.getJSDocCommentsAndTags()` 를 **수동으로 실행**해 확인하는 것이었다(`plan/in-progress/webchat-boot-single-flight.md:229,341`, `documentation.md` — `grep -rn "getJSDocCommentsAndTags"` 결과 이 호출은 리뷰/plan 문서에만 있고 `codebase/` 안에 실제 lint 규칙이나 unit test 로 codify 된 적이 없다).
  - 이번 라운드의 대응은 "이 블록 위/아래에 새 ref 를 넣으라" 는 주석 경고 추가뿐이다(`:178-180`) — 같은 파일 안에서 정확히 이 경고가 필요했던 두 사건이 모두 "다른 걸 하던 중 무심코 사이에 끼워 넣음" 이었다는 걸 감안하면, 세 번째 심볼이 추가될 때 이 경고를 읽지 않을 확률은 낮지 않다. 절차(경고 주석)로 두 번 실패한 방어를 세 번째도 절차로 막으려는 시도다.
  - 제안: `ts.getJSDocCommentsAndTags()` 기반 확인을 리뷰 라운드마다 수작업으로 반복하는 대신, channel-web-chat 패키지에 "지정된 심볼 목록 전원이 정확히 1개의 JSDoc 블록을 갖는다" 를 단언하는 작은 unit test(컴파일러 API 사용, `use-widget.ts` 대상)로 승격하는 것을 검토할 것. 새 ref 가 추가돼 목록에서 빠지면 그 자체가 "이 테스트도 갱신해야 함" 을 알리는 신호가 되어, 인접성 문제를 사람의 기억이 아니라 CI 가 잡는다.

### 기타 (경미)

- **[INFO] `sendCommand` 의 비-410 분기가 코드 1줄에 주석 20줄 — 의도적 "이력 문서화" 전략이나 비율이 계속 늘고 있다**
  - 위치: `use-widget.ts:671-691`(주석) vs `:692`(`dispatch({ type: "ERROR", message: errMessage(e) });` 단 1줄).
  - 상세: 이 파일은 "왜 이렇게 안 했는지" 를 남기는 전략을 반복 채택해 왔고(같은 줄이 세 번째로 뒤집힌 지점 — 종전 `teardownSession()` 추가 → 이번 되돌림), 그 자체는 재발 방지에 실제로 기여해 왔다(재도입 시 mutation 회귀 테스트가 잡음, `RESOLUTION.md` 매트릭스 확인). 다만 코드 대비 주석 비율이 이 지점에서 20:1 까지 커졌고, 이런 지점이 파일에 여럿(worldGenRef·bootGenRef·pendingResetRef JSDoc 각 15-40줄) 누적되며 파일 전체 크기 성장의 상당 부분을 차지한다(위 WARNING 항목과 연결).
  - 제안: 즉각 조치 불필요 — 다만 다음에 이 지점이 또 뒤집히면, 산문 누적 대신 plan/spec 링크 한 줄 + 테스트 참조로 축약하는 것을 고려. (지금은 `1-widget-app.md §2` 이월 논의로 이어질 근거 자료라 유지가 합리적이다.)

- **[INFO] `widget-state.ts` `RESTORED`/`WAITING` 케이스 주석은 "왜 틀렸었는지" 를 서술하는 좋은 예시 — 유지보수성 관점에서 긍정적으로 평가**
  - 위치: `widget-state.ts:125-143`(`RESTORED`), `:147-164`(`WAITING`).
  - 상세: 되돌린 가드를 그냥 지우지 않고 "한때 뒀다가 되돌렸다 — 그 가드가 발화 가능한 유일한 상황이 spec 이 복원하라고 명시한 상황이었다" 라고 반증 근거까지 남겼고, `WAITING` 케이스는 `RESTORED` 케이스를 상호 참조하며 "가드 범위가 왜 비대칭인지"(world 축 vs 살아있는 세션)를 명확히 구분한다. 이는 위 "대칭 함정" 방어와 같은 패턴이며, 새 리듀서 케이스를 추가하는 다음 개발자가 실수로 가드를 확대하기 전에 막아 줄 가능성이 높다. 별도 조치 불필요 — 좋은 사례로 기록.

- **[INFO] `widget-state.test.ts` 의 `it.each` 회귀 테스트는 기존 컨벤션과 일관됨**
  - 위치: `widget-state.test.ts:71-78`.
  - 상세: `RESTORED`/`BOOTED` 두 케이스를 파라미터화(`it.each`)해 중복 없이 대칭 검증하며, 테스트명(`"%s: ended 여도 전이한다(살아있는 세션의 복원을 막지 않는다)"`)이 불변식을 그대로 서술한다 — 위 `use-widget-eager-start.test.ts:3104` 와 동일한 "테스트명 = 불변식" 패턴. 이 파일의 기존 테스트 스타일과도 일치해 새로운 불일치를 만들지 않는다.

---

## 요약

이번 라운드 핵심 diff(A-6 되돌림 + concurrency fix)는 유지보수성 관점에서 준수한 수준이다. 오케스트레이터가
우려한 `seedWaitingFromStatus` 의 이중 staleness 정책(종료 확정=world만, 표면 갱신=world+boot)은 코드
분기 순서 자체가 "표면 갱신에 조건을 추가로 얹는" 구조라 대칭 편집이 우발적으로 섞여 들어가기 어렵고,
JSDoc 표와 함께 정확히 이 위험을 예견해 이름 자체가 불변식을 서술하는 회귀 테스트(`use-widget-eager-start.test.ts:3104`)로
선제 고정돼 있다 — 방어는 충분하다고 판단한다. `widget-state.ts` 의 리듀서 되돌림도 "왜 틀렸었는지" 를
반증 근거와 함께 남겨 재도입을 억제하는 좋은 사례다. 다만 그 방어 전략 자체(주석·테스트로 규율을 강제)가
비용 없이 공짜는 아니다 — `useWidget()` 은 이 저장소 최대 단일 함수(931줄·`useCallback` 26개)이며 이번
diff 가 진행되는 동안에도(+60줄) 계속 커졌고, 이를 잡아 줄 자동 게이트(`max-lines`/`complexity` lint)가
전혀 없다. `useEiaSession` 분리 보류 판단 자체는 타당하나(같은 라운드에 CRITICAL 동시성 버그를 고치는
중 대규모 리팩터를 얹는 건 위험 증대), 그 보류를 기록한 방식(plan 하단 산문)은 이 PR 이 형제 항목
(`ERROR`/`ended` 이월)에서 직접 진단·시정한 "산문 이월이 plan 완료 시 묻힌다" 실패 유형과 동일한 형태로
남아 있어, 지금 형태로는 재발 위험이 실재한다. 또한 JSDoc 인접성 유실 버그가 같은 파일에서 이미 2회
재발했는데 대응이 여전히 절차(경고 주석)에 머물러 있어, 세 번째 재발을 막을 구조적 장치가 없다는 점도
같은 계열의 리스크다.

## 위험도

MEDIUM — 이번 diff 자체를 막을 CRITICAL/즉시조치 결함은 없다(핵심 우려 사항인 이중 정책은 잘 방어됨).
다만 "최대 단일 함수가 매 라운드 커지는데 자동 가드 없음", "동일 버그 클래스가 2회 재발했는데 대응이
절차적 경고에 그침", "이월 기록이 이 PR 이 스스로 진단한 실패 패턴과 같은 형태로 남음" 세 가지가 같은
방향(문서·규율 의존, 구조적 강제 부재)을 가리키는 반복 신호라 WARNING 다수로 MEDIUM 을 부여한다.

STATUS=success maintainability ISSUES=8 PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/23_58_23/maintainability.md RESET_HINT=
