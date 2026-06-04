# Resolution — consistency-check --impl-done (spec-impl-evidence, 2026-06-04)

2회 실행. 1차(08_04_20) BLOCK:YES 의 Critical/Warning 은 MY-work 정합 갭이라 **전부 수정**, 2차(08_17_24) 재실행 결과 MY-work findings 는 해소되고 **cross-branch CRITICAL 1건만 잔존** — 이는 본 PR 범위 밖.

## 1차(08_04_20) → 수정 완료

- **CRITICAL#1** `code:` 신규 가드 4파일 누락 → frontmatter `code:` 에 등재 (commit 7b2a65de).
- **CRITICAL#2 / WARNING#3** §4 가드 카운트·SoT 불일치 → §4.0→§4.2 격상, SoT 정합 (cd9dffe5).
- **WARNING#2 / INFO#3** plan-lifecycle §4 에 spec_impact 포인터·sentinel 명시.
- **WARNING#4/#5** spec-drift-gates §C/§D kb-quality 완료 표기 + 설계 변경 기록.

## 2차(08_17_24) MY-work findings → 수정 완료 (commit cd9dffe5)

- §4 frontmatter-evidence 4건으로 정정, **Gate C 를 §4.2 plan 무결성 family 로 재분류**(checker #7).
- §4.0 zero-th subsection → **§4.2 격상**(checker #6).
- Gate D `--mode reverse` **구현 완료 명시**(checker #8, 미구현 오인 정정).
- **Rationale R-8**(Gate C: spec_impact + cutoff 설계, sentinel 채택) + **R-9**(§4.2 family 신설·SoT·Gate D advisory) 추가(checker #4·#5).
- §6 시제·카운트 정정, plan-frontmatter 규약 SoT=plan-lifecycle §4 명시(INFO #3·#4·#5).
- WARNING#3(Cross-Spec, plan-lifecycle main 미반영): 본 PR diff 에 `.claude/docs/plan-lifecycle.md` **포함됨**(item 3·4·7 에서 편집) — non-issue.

## 잔존 CRITICAL (본 PR 범위 밖 — ESCALATE)

**Plan Coherence CRITICAL#1**: `ai-context-memory-9c7e6e` (별도 active worktree, plan `ai-context-memory-auto.md`, PR 없음)가 merge-base `#449` 기준으로 이후 머지된 **#453 의 R-7·CATALOG_FIELD_FILE 제외 로직을 되돌리는** 변경을 보유. kb-quality 머지 후 그 브랜치가 `spec-impl-evidence.md`·`spec-frontmatter-parse.ts` 에서 3-way conflict + 444건 red 재발 위험.

- **본 PR 의 defect 아님**: 다른 in-flight 브랜치의 staleness(#453 미반영) 문제. kb-quality 가 코드로 고칠 수 없음.
- **정당한 해법**: `ai-context-memory-9c7e6e` 가 자신의 PR 개설 전 최신 origin/main 으로 rebase(되돌림 라인 폐기). 이는 merge-coordination 영역(둘 중 나중 머지가 rebase).
- WARNING#2 (competitive-analysis PR #454 §1 표현 충돌): 경미, 머지 순서 조율로 해소.

→ 다중 브랜치 동시 개발의 통상적 머지-순서 사안이며 본 PR 의 정합성과 무관. 사용자/merge-coordinator 결정 필요.
