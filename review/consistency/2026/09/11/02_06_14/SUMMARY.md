# Consistency Check 통합 보고서 — `--impl-done spec/5-system` (종결)

**BLOCK: NO** (Critical **0** · Warning **2**)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상**: `spec/5-system` + `git diff origin/main...HEAD -- codebase/**`
**성격**: `/ai-review` 7라운드가 **CRITICAL 0 · `codebase/**` 수정 0건**으로 수렴한 뒤,
코드가 고정된 상태에서 돌린 **종결용** 사후 검증이다(SKILL §4 순서 규약 — 리뷰 수렴 뒤에
`--impl-done` 을 준비한다).

## 집계

| Checker | 위험도 | Critical | Warning |
|---|---|---|---|
| `cross_spec` | LOW | 0 | 1 |
| `rationale_continuity` | LOW | 0 | 1 |
| `convention_compliance` | **NONE** | 0 | 0 |
| `plan_coherence` | **NONE** | 0 | 0 |
| `naming_collision` | **NONE** | 0 | 0 |
| **합계** | — | **0** | **2** |

`plan_coherence` 가 **NONE** 인 것이 이 라운드의 핵심 신호다 — 직전 라운드들이 반복해서
잡았던 *"약속하고 등재 안 함"* 이 이번엔 하나도 없다.

## Warning 2건 — 둘 다 이미 등재된 후속이다

| # | Checker | 사안 | 처분 |
|---|---|---|---|
| 1 | `cross_spec` | `details.field` 실제 표현(값에 따라 **중첩/flat 분기**)이 SoT spec 문면(flat 확정 / "미확정" placeholder)과 다르다 | **planner 후속** — `spec/**` 는 developer 권한 밖. `spec-draft-nullable-notation-followups.md` 에 **두-갈래 실측표**로 등재돼 있다. `git blame` 상 그 문장은 developer 가 쓴 것이 아니라 자기-반증형 소정정 대상도 아니다 |
| 2 | `rationale_continuity` | 동시 PATCH 레이스가 R-CC-21 이 막 닫은 fail-open 을 **다른 경로로** 되살릴 수 있다 | **후속 등재 완료** — 사전 존재 설계(CCH-SE-01 2단계 커밋). `/ai-review` 여러 라운드가 같은 지점을 독립 확인했고, 처방은 `update()`·`setupChatChannel()`·`rotateChatChannelBotToken()` 세 지점을 함께 직렬화해야 해 이 PR 범위를 넘는다 |

## 이 PR 이 spec 을 어긴 곳은 없다

`convention_compliance` · `naming_collision` **NONE**, `rationale_continuity` 는 R-CC-10 ·
R-CC-21 · telegram carve-out 어느 것도 번복하지 않았음을 확인했다. 두 WARNING 은 **구현이
spec 을 어긴 것이 아니라** (1) spec 문면이 실측보다 낡았고 (2) 사전 존재 설계 부채가
남아 있다는 것이다.

## 게이트 순서에 대한 기록

push 게이트는 3층이 순서대로 드러난다. 이 세션에서 실제로 그랬다:

1. **리뷰 층** — *"N codebase/ file(s) changed AFTER the most recent resolved review"*.
   타겟 라운드(4R·5R)는 `_summary_is_resolved()` 의 **forced 7명 커버리지**를 만족하지 못해
   이 층을 닫지 못한다 — 전수 라운드가 필요했다.
2. **SPEC-CONSISTENCY 층** — 리뷰 층이 풀린 뒤 이 층이 드러났다:
   *"리포트 세션 시각 01:10:44 < 최신 spec-linked 편집 01:52:35"*. 그래서 이 세션(`02_06_14`)을
   코드 고정 **뒤에** 새로 돌렸다.

두 층 모두 **추측하지 않고 `review_guard.evaluate_review()` 에 직접 물어** 확인했다.
