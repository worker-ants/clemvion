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
또는 `plan/complete/` 에 실존하는 plan 경로»** 로 정의한다(§3 표 `pending_plans` 행 · §4 가드
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

## D. 하지 않는 것

- **완료된 plan 을 가리키는 항목을 거부하는 것** — 트래커의 다른 항목(2026-09-10 등재 «docs
  가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다»)이다. 가드 주석이 명시하듯
  complete/ 항목을 받아 주는 것은 **설계상 의도**다(«status-lifecycle 가드가 따로 본다»). 여러
  plan 중 **하나만** 완료된 경우를 거부할지는 **규약을 바꾸는 판단**이라 planner 몫이다. 이
  PR 의 결함(비-plan 파일 수용)에는 그런 의도가 없다 — 그래서 둘을 가른다.

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/conventions`
- [x] 실패하는 단위 테스트 먼저 — RED 6건 (`isPendingPlanPath is not a function`)
- [x] 구현 → GREEN (단위 13 · 가드 55)
- [ ] 판별 뮤테이션 — «함수가 없어서» 난 RED 는 각 단언의 판별력을 증명하지 못한다
- [ ] TEST WORKFLOW
- [ ] `/ai-review` → 수렴
- [ ] 트래커 항목 체크 + plan `complete/` 로
