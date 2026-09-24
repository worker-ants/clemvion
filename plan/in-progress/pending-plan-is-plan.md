---
title: "spec-pending-plan-existence 가드가 «그게 plan 인가» 를 묻게 한다"
status: in-progress
owner: developer
worktree: pending-plan-is-plan
spec_impact: none
started: 2026-09-24
---

# `spec-pending-plan-existence` 가드가 «그게 plan 인가» 를 묻게 한다

트래커 `spec-draft-nullable-notation-followups.md` 의 항목 «`spec-pending-plan-existence` 가드가
«그게 plan 인가» 를 묻지 않는다» (developer, 중간)를 닫는다. `#1386` 사고의 **진짜 원인**으로
짚었던 자리다.

## A. 결함 — 문서한 보장이 구현보다 넓었다

SoT `spec/conventions/spec-impl-evidence.md` 는 `pending_plans` 항목을 **«`plan/in-progress/`
또는 `plan/complete/` 에 실존하는 plan 경로»** 로 정의한다(§2.1 필드 정의 표 `pending_plans` 행 · §4 가드
설명). 가드 자신의 머리 주석도 같은 말을 한다.

그런데 구현은 **«디스크 어딘가에 실존»** 만 봤다:

```ts
const exists = fs.existsSync(inProgressAbs) || fs.existsSync(completeAbs);
```

`inProgressAbs = path.join(root, planRel)` 이라 `codebase/backend/migrations/V026__graph_rag.sql`
도 파일이 있으니 통과한다. 그래서 `spec/5-system/10-graph-rag.md` 가 마이그레이션 `.sql` 세
경로를 `pending_plans:` 에 **몇 주** 싣고 있었는데 CI 가 초록이었다(`#1386` 이 정정).

**규약은 바꾸지 않는다** — SoT 가 이미 옳다. 구현을 SoT 에 맞춘다.

## B. 처방

`spec-frontmatter-parse.ts` 에 순수 술어 `isPendingPlanPath(relPath)` 를 세우고(선례:
`isApplicable`), 가드가 항목마다 **「plan 인가」 → 「실존하는가」** 순으로 검사한다.

- `plan/in-progress/**.md` 또는 `plan/complete/**.md` 만 참.
- `plan/research/` 는 **의도적으로 거짓** — 완료 종착점이 없는 참조 자료라 `partial` 을
  `implemented` 로 만들 수 없다(`CLAUDE.md` 정보 저장 위치).
- **접두 검사 전에 정규화**한다. 원문 문자열에 접두 검사를 하면
  `plan/in-progress/../../codebase/x.md` 가 `plan/` 밖을 가리키면서 통과한다 — 이 술어가 닫으려는
  «존재 검사 ≠ 정합 검사» 의 같은 틈이다.

## C. 조이기 전 — main 이 깨지지 않는가

**0건 / 27개.** 가드에 단언을 넣고 실제 spec 코퍼스로 돌린 값이다.

> 처음엔 빠른 파이썬 파서로 «0건 / 24개» 를 쟀는데 **항목 수부터 틀렸다** — 가드는 27개를
> 센다(1 + 27×2 = 55 테스트). 파서가 3건을 놓쳤다. 그래서 판정은 프록시가 아니라 가드 자신으로
> 받았다.

## D. 판별 뮤테이션 — «함수가 없어서» 난 RED 는 증거가 아니었다

TDD 의 첫 RED 6건은 전부 `isPendingPlanPath is not a function` 이었다 — **각 단언이 제
분기를 판별하는지는 그것으로 증명되지 않는다.** 그래서 구현 뒤 줄 하나씩을 빼 봤다.

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| M2 정규화 제거 | `..` 단언만 RED | **`..` 단언만 RED** |
| M3 `.md` 검사 제거 | non-markdown/bare 단언만 RED | **그것만 RED** |
| M4 `plan/research/` 를 허용 목록에 | research 단언만 RED | **그것만 RED** |
| M5 술어가 항상 true | 단위 여러 RED · **가드는 초록** | **단위 5 RED · 가드 55 초록** |
| ~~M1~~ 실제 spec 에 `V026__graph_rag.sql` 추가 | «plan 인가» 만 RED | ~~둘 다 RED~~ — **무효 뮤턴트** ↓ |
| **M1b** 실제 spec 에 **실재하는** `V026__graph_extraction_status_nullable_index.sql` 추가 | «plan 인가» RED · «실존» 초록 | **정확히 그대로** (1 실패 · 56 통과) |

**M1 은 무효였다.** 넣은 경로가 **실제로는 없는 파일**이라 «실존» 검사까지 RED 가 났다.
사고의 본질은 «파일이 있어서 옛 가드가 통과했다» 인데, 없는 파일은 옛 가드도 막았을 것이라
새 검사를 판별하지 못한다. 실재하는 이름으로 다시 한 M1b 가 사고 형태의 정확한 재현이다 —
옛 가드가 통과시킬 입력을 새 검사**만** 잡는다.

**M5 가 말하는 것**: 현 코퍼스에는 위반이 0건이라 **술어가 망가져도 가드만으로는 초록**이다.
판별의 부담은 단위 테스트가 진다 — 단위 테스트를 코퍼스 가드로 갈음하면 안 되는 이유다.

(원복은 전부 `cp` + 절대경로. 원복 후 단위 13 통과 · 가드 55 통과 · 워킹트리 diff 없음.)

## E. `--impl-prep` 결과

`review/consistency/2026/09/24/19_35_41` — **BLOCK: NO · Critical 0 · Warning 2.**
번들에 `spec-impl-evidence.md` 가 5개 프롬프트 전부 본문으로 실린 것을 실행 전에 확인했다.

- **W1** `4-nodes/*/0-common.md` 6개의 `id: common` 중복 — **이 변경과 무관한 선재 drift.**
  실측으로 확인했고(6개, 그리고 id 유일성 가드 부재) 트래커에 등재했다(planner).
- **W2** cafe24 카탈로그의 `__` 명명 미문서화 — 선재. 트래커에 **이미 있다**(«`<parent>__<child>`
  더블언더스코어 표기가 규약에 정의돼 있지 않다»).
- **INFO 1** `plan/research/` 배제 근거가 SoT 의 Rationale 에 없다 — **등재하지 않는다.** SoT
  §2.1 행이 허용 위치를 둘로 **열거**하므로 research 는 이미 배제돼 있고, «왜» 는
  `isPendingPlanPath` 주석이 싣는다. 계약의 공백이 아니라 설명의 위치 문제다.

> **착수 순서를 어겼다.** `--impl-prep` 은 구현 **전** 의무인데 구현부터 하고 나중에 돌렸다.
> 푸시 전이라 결과(BLOCK: NO)로 진행했지만, BLOCK 이었으면 되돌렸어야 할 코드를 먼저 쓴 셈이다.

## F. 하지 않는 것

- **완료된 plan 을 가리키는 항목을 거부하는 것** — 트래커의 다른 항목(2026-09-10 등재 «docs
  가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다»)이다. 가드 주석이 명시하듯
  complete/ 항목을 받아 주는 것은 **설계상 의도**다(«status-lifecycle 가드가 따로 본다»). 여러
  plan 중 **하나만** 완료된 경우를 거부할지는 **규약을 바꾸는 판단**이라 planner 몫이다. 이
  PR 의 결함(비-plan 파일 수용)에는 그런 의도가 없다 — 그래서 둘을 가른다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/conventions` → **BLOCK: NO** (`19_35_41`) — §E.
      **순서를 어겼다**: 구현 뒤에 돌렸다
- [x] 실패하는 단위 테스트 먼저 — RED 6건 (`isPendingPlanPath is not a function`)
- [x] 구현 → GREEN (단위 13 · 가드 55)
- [x] 판별 뮤테이션 — M2~M5 예측=실측, **M1 은 무효 → M1b 로 재수행** — §D
- [x] TEST WORKFLOW — lint PASS · unit PASS(frontend 291 파일 / 6714, 새 단위 6 · 가드 27 포함) ·
      build PASS · e2e 380 PASS
- [ ] `/ai-review` → 수렴
- [ ] 트래커 항목 체크 + plan `complete/` 로
