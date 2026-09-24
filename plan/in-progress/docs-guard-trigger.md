---
title: "docs 가드가 검사하는 데이터가 그 가드를 트리거하게 한다"
status: in-progress
owner: developer
worktree: docs-guard-trigger
spec_impact: none
started: 2026-09-24
---

# docs 가드가 검사하는 데이터가 그 가드를 트리거하게 한다

트래커 `spec-draft-nullable-notation-followups.md` 의 항목 «docs 가드가 검사하는 데이터가 그
가드를 트리거하지 않는다» (developer, 중간)를 닫는다.

## A. 결함

`codebase/frontend/src/lib/docs/__tests__/` 의 가드들은 `plan/**` 과 `spec/**` 을 스캔한다
(`plan-frontmatter` · `spec-frontmatter` · `spec-code-paths` · `spec-pending-plan-existence` ·
`spec-status-lifecycle` …). 그런데 그것을 돌리는 `frontend-checks.yml` 의 pathspec 에는 `plan/**`
도 `spec/**` 도 없다. 그래서 **`plan/`·`spec/` 만 바꾼 PR 에서는 그 데이터를 검사하는 가드가
통째로 안 돈다.**

실례가 둘 있다:
- `jest-esm-native-load`(`#1387`) 1라운드 Critical — backend 전용 PR 에 `plan/**` 위반을 섞었는데
  로컬 가드만 잡았다. CI 는 `frontend-checks` 를 skip 해 초록으로 머지됐을 것이다.
- **방금 머지한 `#1389`** 가 `spec-pending-plan-existence` 를 강화했는데, 그 가드가 막으려는 위반
  (`pending_plans` 에 비-plan 경로)은 **spec-only PR 에서 가장 잘 생긴다** — 그리고 그 PR 에서
  가드는 돌지 않는다.

## B. 처방 — 트래커의 (a)(b) 보다 나은 자리가 이미 있었다

트래커는 둘을 적었다. (a) `frontend-checks` pathspec 에 `plan/**`·`spec/**` 추가(→ plan/spec
PR 마다 lint·typecheck·`next build`·전체 vitest), (b) docs 가드 전용 잡 신설(→ required check
가 하나 는다).

**`spec-link-checks.yml` 이 이미 (b) 다.** 헤더가 스스로 말한다 — «`frontend-checks` 는
`next build`(무거움)까지 도므로 … 본 workflow 는 가드 vitest 하나만 도는 lightweight 대체
트리거». skip-job 패턴이라 required check 호환이고, pathspec 에 `spec/**` 도 이미 있다.
트래커를 쓸 때 이 파일을 못 봤다. 빠진 것은 둘뿐이다:

1. pathspec 에 **`plan/**` 이 없다.**
2. **`spec-link-integrity.test.ts` 하나만** 돌린다 — 같은 디렉터리의 다른 docs 가드는 안 돈다.

그래서 이 워크플로를 넓힌다. 가드를 **파일로 열거하지 않고 디렉터리째** 돌린다 — 새 docs
가드가 생길 때마다 여기를 고치는 것을 잊는 형태를 없앤다(열거는 다음 누락을 부른다).

**잡 이름(`spec-link-integrity`)은 유지한다.** 이제 그 이름보다 넓은 일을 하지만, 하네스 가드
(`test_workflow_yaml_structure.py`)가 잡 이름을 고정하고 이 저장소의 워크플로는 required check
로 등록될 수 있게 설계돼 있다(`#1106`). 이름을 바꾸면 그 설계를 깬다.

## C. 착수 전 실측

- **required status check 는 지금 하나도 없다** — classic branch protection 없음(`Branch not
  protected`), 저장소 ruleset 없음(이 토큰으로 조회). 즉 지금 이 잡이 빨개져도 머지는 기술적으로
  막히지 않는다. 그래도 사람이 CI 를 보고 머지하므로 **빨간 불이 보이는 것 자체가 가치**다.

## D. 판별 — plan 만 바꾼 PR 에서 정말 잡이 켜지는가

CI 가 쓰는 판정 스크립트(`scripts/ci-paths-changed.sh`)를 CI 와 같은 방식
(`GITHUB_EVENT_NAME=pull_request`, `PR_BASE_SHA=<c>~1`, `PR_HEAD_SHA=<c>`)으로 불러, **과거에 실제로
plan 만 바꾼 커밋**에 옛·새 pathspec 을 각각 대조했다. pathspec 은 `_changed-paths.yml` 과 같은
규칙(`#` 주석·빈 줄 제거)으로 워크플로에서 뽑았다.

| 입력 | 예측 | 실측 |
| --- | --- | --- |
| `89f67c040`(plan 만 변경) × **옛** pathspec | `relevant=false` — 잡이 스킵된다 | **`relevant=false`** |
| `89f67c040`(plan 만 변경) × **새** pathspec | `relevant=true` — 가드가 돈다 | **`relevant=true`** |

옛 쪽이 `false` 를 냈다는 것은 스크립트가 fail-safe(판정 불가 시 `true`)가 아니라 **실제 diff 를
계산했다**는 뜻이다. 그래서 새 쪽의 `true` 도 fail-safe 가 아니라 `plan/**` 매칭에서 왔다.

> **대조군은 무효였다.** spec 만 바꾼 커밋도 같은 식으로 돌리려 했는데 최근 300커밋에 그런 커밋이
> **없어서** 빈 값이 들어갔고, 스크립트가 fail-safe 경로로 `true` 를 냈다. 그 값은 «spec 은 원래
> 켜졌다» 의 근거가 될 수 없다. 그 사실은 pathspec diff 자체(`spec/**` 는 원래 있었고, 추가된 줄은
> `plan/**` 하나)가 보여 준다.

## E. 스코프 밖 부수 수정 — 선언해 둔다

리뷰 1라운드 W1 이 이 PR 의 impl-prep 세션 `21_04_26` 의 `meta.json` 이 세션 전용 scratch 절대경로를
영구 기록으로 남긴 것을 짚었다. 고치다 보니 **이미 머지된 `#1389` 의 impl-done 세션
`review/consistency/2026/09/24/20_34_01/meta.json` 도 같은 결함**이었다 — 같은 방식(scratch 에 대상
spec 한 파일만 복사해 scope 로)으로 좁혔기 때문이다. 결함 클래스를 닫으려고 **함께 고쳤다.**

그 파일은 이 PR 의 원래 스코프(docs 가드 트리거) 밖이고, 머지된 다른 PR 의 산출물이다(리뷰 2라운드
W1). 그래서 여기 선언해 둔다:

- 무엇을: `target_path` · `mode` 의 `scope=` 를 scratch 절대경로에서 `spec/conventions/spec-impl-evidence.md`
  로. 사본으로 돌린 사실과 이유는 `scope_note` 로 **보존**했다(원래 기록을 지우지 않는다).
- 안전성: 게이트(`review_guard._is_impl_done_session`)는 `mode` 의 `--impl-done` 토큰만 본다. 토큰을
  유지했고 `20_34_01` 이 여전히 impl-done 으로 인식됨을 확인했다.
- 다음부터: 이런 소급 정정은 **별도 커밋**으로 떼고 대상 PR 번호를 메시지에 적는다.

## 체크리스트

- [x] `/consistency-check --impl-prep` — **구현 전에** 돌렸다. **BLOCK: NO · Critical 0 ·
      Warning 0** (`review/consistency/2026/09/24/21_04_26`). `spec/conventions` scope 로는 지배
      spec(`spec-impl-evidence.md`)이 예산 생략 목록에 빠져, 그 파일 하나만 담은 scope 로 다시
      준비해 5/5 를 확인하고 돌렸다. INFO 셋(`PROJECT.md` 서술·수동 명령 stale, 잡 이름 유지 주석,
      하네스 재확인)을 구현에 반영했다
- [x] `spec-link-checks.yml` — pathspec 에 `plan/**`, 가드 디렉터리 전체 실행(로컬에서 CI 와 같은
      명령으로 23파일 3567개 확인), 잡 이름 유지 + 그 이유 주석. `PROJECT.md` §문서 링크 검증 갱신
- [x] 하네스 가드 통과 — `python3 -m pytest .claude/tests -q`: 첫 구현 뒤 **1138** passed → 리뷰
      1라운드가 회귀 테스트 파일 하나(테스트 2개)를 더한 뒤 **1140** passed
- [x] 판별 — §D. plan 만 바꾼 과거 커밋에서 옛 `false` → 새 `true`
- [x] `/ai-review` → **2라운드에 수렴** (14명 전원 · forced 8/8)
      - 1R `21_16_58` Warning 4 → 전부 조치(회귀 테스트 `test_spec_link_checks_scope.py` 신설 · CHANGELOG ·
        헤더 stale · scratch 경로 영구 기록 — `#1389` 세션까지)
      - 2R `21_35_51` Warning 1(위 `#1389` 소급 수정이 스코프 미선언) → §E 로 선언. 이 라운드의 워크플로
        수정은 0건이고 fix 는 plan 뿐이라 3라운드 불요
- [x] 트래커 항목 체크 + plan `complete/` 로
