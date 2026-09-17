# RESOLUTION — `review/code/2026/09/17/14_11_48` (2라운드)

**Critical 0 · Warning 2 · MEDIUM.** forced 7/7, `unfinished: []`. 12명 전원이 핵심 코드(창 1 부분 객체
`save`)에 결함 없음으로 확인했고, MEDIUM 의 유일한 근거는 W1(문서 수치의 재현성)이다.

`codebase/**` 주석을 고쳤으므로 이 라운드로는 종결하지 않는다 — 3라운드가 뒤따른다.

| # | 발견 | 처분 |
|---|---|---|
| W1 (testing) mock JSDoc 의 «60 RED» 를 두 방식으로 재현하니 64·68 | **수용 — 숫자를 지우고 규칙을 남겼다.** 원인은 뮤턴트 형태가 고정돼 있지 않다는 것이다. 내 뮤턴트는 콜백 대신 manager 객체를 돌려줬고(60), 리뷰어는 `undefined`·`false` 를 돌려줬다(64·68). 이 숫자는 13 → 53 → 60 으로 세 번 바뀌어 왔다 — 형태를 고정하지 않은 숫자는 다음 사람이 재현하지 못한다. JSDoc 은 «수십 건 RED · 이 파일을 고칠 땐 같은 뮤턴트로 다시 확인하라» 는 **규칙**만 남기고, 숫자가 적히지 않는 이유를 짧게 적었다. 주석은 줄었다 |
| W2 (documentation) CHANGELOG 가 `workflow`·`workspace` CASCADE 를 나란히 «실측» 으로 적었다 | **수용·수정** — e2e 는 `workflow` 삭제만 쟀다(`workspace` 삭제 쿼리는 저장소에 0건). `workflow` 로 한정하고 `workspace` 는 «같은 `ON DELETE CASCADE` 구조라 동일할 것으로 보지만 따로 재지 않았다» 로 명시했다 |

INFO:
- **#12 [SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md §3` ⚠️ — 1라운드와 같다. planner 후속(⚠️ 교체 · 증거 e2e `code:` 등재 · `15-chat-channel.md §5.4` 404 사유).
- **#15** 리뷰 도중 공유 워킹트리에서 `trigger-transaction-mock.ts` 의 일시적 미커밋 변경 관측 — 리뷰어 간 뮤테이션 흔적이다. 이 라운드의 수정은 그 뒤 main 세션에서 했고 `git status` 로 확인했다.
- **#4·#5·#6·#7·#9·#16** `update()` 비대화 · ORM 내부 동작 의존 · 타입-런타임 불일치 · e2e 접속정보 중복 · 헬퍼 골격 중복 — 1라운드에 이미 처분(defer)한 항목의 재확인.
- **#1·#2·#3·#10·#11·#13·#14** 방향 확인 · 기지 갭 · 조치 불요.
