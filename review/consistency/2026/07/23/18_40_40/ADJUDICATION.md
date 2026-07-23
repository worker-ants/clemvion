# ADJUDICATION — review/consistency/2026/07/23/18_40_40

checker 판정: **BLOCK: YES** (convention_compliance CRITICAL 1건).
main Claude 판정: **또다시 이번 diff 에 귀속되지 않는 영역 선재 drift** — 15_33_52 와 **같은 클래스,
다른 인스턴스**.

## CRITICAL 은 실재한다 (기각하지 않음)

`excludeFromConversationThread` 에 대해 세 곳이 모순한다 — main 이 독립 실측:

| # | 출처 | 상태 |
|---|---|---|
| 1 | `spec/4-nodes/6-presentation/0-common.md:162` (§4.6) | presentation 노드 **공통 config 필드**로 선언 (frontmatter `status: implemented`) |
| 2 | `codebase/backend/src/nodes/presentation/**` | **0건** — 어느 schema 에도 선언이 없다 |
| 3 | `spec/conventions/conversation-thread.md:187` (SoT) | *"필드 정의의 단일 진실은 **3 노드 공통 공유 fragment** `shared/conversation-context-schema.ts`"* — **AI 3노드 전용** |

→ 지적은 정당하다. §4.6 이 미구현 필드를 구현된 것처럼 명문화하고 있고, 실제 SoT 와도 어긋난다.

## 그러나 이번 diff 에 귀속되지 않는다

| 검증 | 결과 |
|---|---|
| `git diff --name-only origin/main...HEAD -- spec/` | **0 파일** |
| 이번 branch 의 `codebase/` 변경 | `output-shape.ts`(**non-comment diff 0줄**) + `output-shape.test.ts`(fixture) |
| checker 자신의 관측 | INFO 1 — *"target 문서가 이번 세션 diff 에서 전혀 변경되지 않음(0줄). 실제 diff 는 output-shape.ts 프런트엔드 리팩터로 presentation spec 과 무관"* (3 checker 수렴) |

## 이번이 두 번째다 — 패턴을 기록한다

같은 게이트가 같은 영역에서 **연속 두 번** 선재 CRITICAL 을 냈다:

| 라운드 | CRITICAL | 처분 |
|---|---|---|
| 15_33_52 | `previousOutput` "폐기" 서술 vs 실제 주입 | planner PR #997 로 수정·머지 |
| **18_40_40** | `§4.6 excludeFromConversationThread` 미구현 명문화 | **미처리 — 본 문서** |

즉 **하나를 고치자 다음 것이 드러났다**. `spec/4-nodes/6-presentation` 에 standing drift 가 누적돼
있고, `--impl-done` 은 diff 무관하게 영역 전체를 검사하므로 **이 영역의 `code:` glob 에 매칭되는
어떤 변경도**(주석 한 줄이라도) 그 누적 부채를 먼저 갚아야 통과한다.

이번 diff 는 **실행 코드를 0줄 바꾸지 않는다** — 원리적으로 spec-impl drift 를 새로 만들 수 없다.

## 역할 경계

§4.6 정정은 `spec/` 편집이라 developer 범위 밖이다(CLAUDE.md: developer 는 `spec/` read-only,
변경 필요 시 planner 위임). 동반 WARNING(`form.handler.ts` 의 `{ ...rawConfig }` spread 가
node-output.md §7 D1 위반 — 형제 4개 핸들러는 명시 열거 사용)은 **codebase 이므로 developer 범위**지만
이번 PR 의 주제와 무관하다.

## 처분 — 사용자 결정 사항

SUMMARY 는 checker 원문 그대로 보존한다(BLOCK: YES). 게이트를 통과시키려고 판정 문구를 고쳐
쓰지 않는다. 선택지:

- (a) planner PR 로 §4.6 정정 → 머지 → 재검사(#997 때와 동일 경로). **세 번째 drift 가 또 나올 수 있다**.
- (b) 이번 PR 한정 게이트 우회 + §4.6·form.handler 를 별건 백로그로 추적.
- (c) `spec/4-nodes/6-presentation` standing drift 를 **일괄 정리하는 별도 작업**을 먼저 세우고,
      그 전까지 이 영역 glob 에 걸리는 PR 은 (b) 로 처리.

어느 쪽이든 **두 발견 모두 살아있는 항목으로 추적된다** — 본 문서가 그 기록이다.
