---
title: consistency 번들러 예산 — target spec 이 조용히 절반 잘리던 문제 (§H)
worktree: harness-checks-paths-guard-f6b2d9
started: 2026-07-24
owner: developer
status: complete
priority: P2
# `.claude/skills/**` + `.claude/tests/**` 전용 — 어떤 spec 의 `code:` glob 에도 미매칭.
spec_impact: none
---

## Overview

`harness-guard-followups.md` §H 에서 이관.

> 출처: `interaction-type-guard-comment-false-negative` 후속 ④ —
> impl-prep `review/consistency/2026/07/18/12_04_53`,
> impl-done `review/consistency/2026/07/18/12_34_30`,
> ai-review `review/code/2026/07/18/12_31_58` 이 공통 재현.

## 원 전제는 반증됐다 (2026-07-24 실측)

원 티켓: "`cafe24-api-catalog/**` 대용량 덤프에 예산이 소진돼 **target spec 본문이
프롬프트에서 완전히 밀려난다**(100% 치환)".

실측 결과 **이 메커니즘은 성립할 수 없다**. `budget_substitutions` 는 키별 독립 예산
(`CHECKER_BUDGET_RATIO`)을 쓰고, 그 구조는 **2026-05-16(`3446d0d57`)부터** 있었다 —
2026-07-18 관측보다 두 달 앞선다. conventions 는 자기 몫(10%) 안에서만 잘리므로
target(30%) 을 잠식할 수 없다.

## 그런데 진짜 결함이 있다 — 다른 결함이다

`--impl-prep spec/2-navigation/` 실측:

| 항목 | 값 |
| --- | --- |
| target 번들 원본 | **376,294 자** |
| target 예산 (30% of 262,144) | 78,643 자 |
| 체커에 도달한 영역 파일 | **9 / 18** |
| 유실 고지 | 맨 끝에 `... (truncated due to size limit) ...` 한 줄뿐 |

즉 **절반이 조용히 사라진다**. 게다가 잘림이 문자 단위라 마지막 생존 파일은 문장 중간에서
끊긴 채 완전한 것처럼 보인다. 체커는 "이 영역에 X 언급이 없다" 와 "X 를 언급한 부분이
잘렸다" 를 구분할 수 없고, **두 번째를 답했다고 믿으며 첫 번째를 답한다**.
`--impl-prep` 는 차단 게이트이고 그 `BLOCK: NO` 는 "영역을 검토했다" 의 근거로 쓰인다.

원 티켓이 "checker 들이 워크트리를 직접 조사해 매번 우회한다" 고 적은 것은 **이 결함에도
그대로 적용된다** — 우회가 지침에 의존한다는 위험 평가 자체는 옳았다.

## 조치 (2026-07-24)

- [x] **예산을 체커별로 배분.** 5개 코퍼스가 `max_context_size` 를 나눠 갖는 구조는
      "한 프롬프트가 전부를 싣는다" 를 전제하는데, `build_checker_prompt_body` 는
      `target_doc` + **코퍼스 1개**(naming_collision 만 3개)를 보낸다. 창의 절반이
      아무도 읽지 않을 자리로 예약돼 있었다. → `target_doc 0.60 / corpus 0.40`.
- [x] **잘림이 무엇을 버렸는지 말하게 한다.** `truncate_file_bundle` 은 파일 경계에서
      **통째로** 떨어뜨리고, 생략된 경로를 전부 나열한 뒤 "여기 없다는 것을 근거로 삼지 말고
      `Read` 로 열어라" 를 붙인다. 체커에게 `Read` 가 있으니 **보이는 생략은 지시**이고
      보이지 않는 생략은 오판이다.
- [x] 회귀 고정: `.claude/tests/test_consistency_context_budget.py` (16건).
      "target 이 살아있는가" 가 아니라 **"모든 영역 파일이 포함되거나 생략 목록에 이름이
      있는가"** 를 단언한다 — 전부 들어가는 건 애초에 불가능(`spec/4-nodes/` 는 858KB)하고,
      가능한 척한 것이 조용한 버전이 나온 경로다. 비-vacuity 테스트로 그 영역이 실제로
      넘치는지 먼저 확인한다.
- [x] mutation: 비율 0.30 원복 → 2건 red / 생략 고지 제거 → 6건 red.

### 결과

| | 수정 전 | 수정 후 |
| --- | --- | --- |
| 포함된 영역 파일 | 9/18 | **11/18** |
| 나머지 7개 | 흔적 없음 | **경로 전부 명시 + Read 지시** |
| 프롬프트 크기 | 105K~223K | 206K~223K (창 262K 이내) |

전부 담는 것은 창 크기상 불가능하다. 바뀐 것은 **미포함이 관측 가능해졌다**는 것이다.

## 잔여 — 종결 (2026-07-24, 전제 반증)

- [x] (부수) reverse-diff 오염 — **이미 three-dot 이라 발생 불가**. `_collect_code_diff` 는
      `git diff {diff_base}...HEAD`(**세 점**)을 쓴다. `A...B` 는 `merge-base(A,B)..B` 라
      `diff_base`(갓 fetch 한 `origin/main` 등)가 fork-point 를 앞서도 base-쪽 변경이
      역-삭제로 새지 않는다. 잔여가 제안한 "merge-base 로 고정" 이 곧 three-dot 이 이미
      하는 일이다 — 원 전제(two-dot `git diff origin/main`)는 코드에 존재한 적이 없다.
      테스트 대신 `_collect_code_diff` docstring 에 "two-dot 로 바꾸지 말 것" 을 근거와 함께
      고정(회귀 방지 비용 대비, 표준 git 의미론이라 pin 테스트는 과설계).

## 관련

- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/test_consistency_context_budget.py`
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §H

## Rationale

**왜 카탈로그를 그냥 빼지 않나.** 원 티켓의 답이 여전히 유효하다 —
`cafe24-api-catalog/**` 도 정당한 conventions 문서다. 다만 실측 결과 그것은 애초에
target 을 잠식하고 있지 않았고, 필요한 것은 배제도 우선순위도 아닌 **체커별 배분 + 관측
가능한 생략**이었다.

**왜 "target 이 살아있다" 를 단언하지 않나.** 원 티켓의 제안이었지만, 그 술어는 참이면서도
절반이 사라진 상태를 통과시킨다(실제로 그랬다). 단언해야 할 것은 **전수 회계** — 모든 파일이
본문으로 있거나 이름으로 있거나 둘 중 하나다.
