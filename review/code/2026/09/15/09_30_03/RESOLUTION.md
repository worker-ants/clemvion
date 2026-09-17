# RESOLUTION — `review/code/2026/09/15/09_30_03` (1라운드 · 종결)

**Critical 0 · Warning 2 · INFO 15 · 전체 위험도 LOW.** forced 7/7(`forced_missing: []`),
11명 success·전원 리포트, `unfinished: []`. router 가 `performance` · `architecture` ·
`dependency` · `api_contract` · `user_guide_sync` 를 skip 했고 전부 강제 목록 밖이다.

## 정지 규칙 — 이번엔 **하나만** 선언했다

착수 시 plan 에 적은 규칙은 하나다:

> **`codebase/**` 수정 0 으로 끝나는 라운드가 나오면 종료.**

전신 PR(`#1334`)에서 규칙을 둘 적었다가 마지막에 갈려 «결과를 보고 고른» 꼴이 됐던 재발을
막으려는 것이었다. 이번 라운드의 대응은 `CHANGELOG.md`(루트) · `plan/**` · 트래커뿐이라
**`codebase/**` 수정 0** 이고, 규칙이 그대로 충족된다.

## Warning 처분

| # | 발견 | 처분 |
|---|---|---|
| W1 (documentation) CHANGELOG 정정 blockquote 의 *"닫았다(아래 항목)"* 가 가리킬 대상이 파일에 없다 | **수용·수정** — 새 항목은 prepend 되므로 방향이 반대였다. 항목명(«락을 잡아도 못 막는 세 번째 삭제 경로»)을 직접 인용하도록 고쳤다. 루트 파일이라 리뷰 freshness 를 안 깬다 |
| W2 (security·concurrency) 창 1(`TriggersService.update()` 의 인라인 `save()`)이 FK CASCADE 창에 대해 미검증 | **후속 등재 — «추정» 이라고 적는다.** 아래 참조 |

### W2 — 재지 못했고, 그래서 «안전하다» 고 쓰지 않는다

창 1 만 `rewriteTriggerConfigLocked` 를 거치지 않고 같은 락 안에서 `save(entity)` 를 쓴다.
그래서 이번에 넣은 `affected` 판정의 보호를 받지 못하고, 재읽기와 저장 사이에 같은 FK
CASCADE 창을 갖는다.

**추정**은 «`save` 가 사라진 행을 INSERT 로 되살리려 할 때 부모(`workflow`)도 이미 없으니 FK
위반으로 시끄럽게 실패» 다 — 조용한 부활이 아니라 500 + 롤백. 리뷰어도 *"(추정, 미확정)"* 으로
적었다.

**왜 이 PR 에서 재지 않았나**: 그 창은 **재읽기와 저장 사이**에 있고, advisory lock 은 읽기
**전에** 잡힌다. 그래서 테스트가 락을 쥐는 기존 e2e 수법으로는 그 창을 열 수 없다 — PATCH 가
락에서 멈춰 있는 동안 삭제하면 **재읽기 자체가 비어** 이미 커버된 `!fresh` 404 분기로 간다.
결판내려면 **프로세스 내부 일시정지 훅**(이 저장소의 boot-only e2e 훅 관례 —
`NODE_ENV` + FLAG 이중 게이트)이 필요하고, 그 설계는 이 batch 의 범위를 넘는다.

> **유예 근거가 추정일 때는 추정이라고 적는다.** 이 PR 이 시작된 계기가 정확히 그
> 반대다 — 어제 «삭제 경로 둘이 락을 공유해 실무적으로 닫혀 있다» 를 실측 없이 적었고
> 오늘 그것이 반증됐다. 같은 문장을 다시 쓰지 않으려고, 트래커에 **무엇을 재야 결판나는지**
> 까지 함께 적었다.

## INFO 처분

| # | 처분 |
|---|---|
| #1 `affected===0` 판정이 3번째 삭제 경로 회귀를 정확히 닫음 · #2 clamp · #5 개명 | **긍정 확인** — 조치 불요 |
| #3 `rewriteTriggerConfigLocked` 반환값을 무시하는 호출부 2곳 | **후속 등재**(트래커 developer 항목 8) — 새 `false` 를 아무도 안 본다 |
| #4 `rotateBotToken` 의 secret 쓰기가 판정보다 먼저·트랜잭션 밖 | **후속 등재**(항목 9) — 5라운드 W1(secret store 원자성)과 같은 자리 |
| #7 `@returns` 의 «쓰지 않을 거면 계산 안 함» 이 `!fresh` 분기에만 해당 · #12 JSDoc 2곳 미반영 | **후속 등재**(항목 10) — `codebase/**` 라 이번에 안 건드린다 |
| #10 `it.each` 통일 · #11 `-Infinity`·경계값 | **후속 등재**(항목 11) — 저비용 보강 |
| #6 드라이버 전환 시 `affected` 판정 재검토 · #9 JSDoc 밀도 · #14 결함+정리 혼합 커밋 | 조치 불요(리뷰어가 «인지만» 또는 «관행 부합» 으로 판정) |
| #8 공유 mock 변경의 3파일 파급 | 이미 367건 전체 재실행으로 검증 |
| #13 `11-workflow.md §3.1` CASCADE 누락 | 이미 planner 인계(`--impl-prep` W1 → 트래커 planner 항목 5b) |
| #15 리뷰 도중 워킹트리 일시 변화 관측 | **내 잘못이다** — 리뷰가 도는 동안 같은 워크트리에서 뮤테이션을 돌렸다. `git status` 는 계속 clean 이었고 커밋 상태에 영향은 없지만, 트래커에 이미 등재된 프로세스 항목(«리뷰 in-flight 중 같은 워크트리에서 뮤테이션을 돌리지 않는다»)을 어긴 것이다. 다음 세션은 뮤테이션을 **리뷰 전에** 끝낸다 |

## 결론

**`codebase/**` 수정 0 으로 종결한다.** 이 batch 가 닫은 것은 다섯 자리이고, 그중 ④는 착수 전
전제 실측에서 «정리» 가 아니라 **좁은 실결함**으로 성격이 바뀐 항목이다 — advisory lock 으로
막을 수 없는 세 번째 삭제 경로(FK CASCADE)가 남긴 0행 UPDATE 를 `false` 로 판정한다.

남은 항목은 전부 **살아 있는 트래커**(`spec-draft-nullable-notation-followups.md`)의 developer
항목 7~11 과 planner 항목 5b 에 있다 — 이 plan 은 봉인되므로.
