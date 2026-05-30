---
worktree: .claude/worktrees/enforce-review-fix
started: 2026-05-30
owner: developer
status: in-progress
---

# 구현 완료 후 review/fix 강제력 복원 (workflow 개편 회귀 대응)

> 배경: workflow 구조 개편 이후 "구현은 끝났는데 ai-review 를 범위가 크다고 자동 수행하지
> 않고 다음 턴/PR 로 미루거나, review 결과의 critical/warning 을 수정하지 않고 미루는" 회귀.
> 원인 5건 (1차: Workflow 툴의 비용 opt-in 가드 ↔ 자동 리뷰 강제 모순 / 비동기 간극 /
> fix 단계만 bespoke 분리 / 강제력 비대칭 — worktree 만 hook, review/fix 는 산문 /
> bg isolation 쓰기 가드). 4개 방안 적용.

## 방안 ↔ 변경 매핑

- [x] **방안 1 — 강제에 이빨 부여 (hook)**
  - `.claude/hooks/_lib/review_guard.py` — "branch 에 미리뷰 코드 변경이 남아있는가" 판정 (공유 lib)
  - `.claude/hooks/guard_review_before_push.py` — PreToolUse(Bash): 미리뷰 codebase 변경이 있으면 `git push` 차단 (exit 2). "PR 로 미룸" 차단.
  - `.claude/hooks/guard_review_before_stop.py` — Stop: 미리뷰 codebase 변경이 있으면 턴 종료 1회 차단(HEAD+session 당 dedup, wedge 방지). "다음 턴으로 미룸" 차단.
  - `.claude/settings.json` — Bash matcher 에 push 가드 추가 + `Stop` 훅 등록
- [x] **방안 2 — 자동 리뷰를 Workflow opt-in 가드 밖으로 (standing opt-in 명문화)**
  - `CLAUDE.md §외부 LLM 호출 정책` — 구현 완료 후 자동 review/fix 는 standing sanctioned obligation 임을 명시 (Workflow "inferred scale" 가드 비적용)
  - `code-review-agents/SKILL.md` — 자동 트리거 정책 + 자동 트리거 시 fallback 평문 Agent fan-out 우선 가이드
- [x] **방안 3 — developer SKILL §9 동기화**
  - "자동으로" 제거, async hop (workflow 발사 → 알림 대기 → SUMMARY 읽기 → resolution-applier 발사 → ESCALATE 분기) 명시. 완료 정의(DoD) 추가.
- [x] **방안 4 — bg isolation 정합**
  - developer SKILL step 0 / code-review-agents SKILL §0 — bg 세션이면 `EnterWorktree` 툴로 부모 세션 isolate (셸 cd 만으로는 workflow sub-agent write 가 bgIsolation 가드에 막힘)
  - `orchestrator-workflow-migration.md` status 갱신

## 검증

- [ ] `.claude/tests/` 에 review_guard 판정 단위 테스트 (test_review_guard.py)
- [ ] hook 수동 스모크 (push 가드 차단/통과, stop 가드 dedup)
- [ ] 본 PR 자체는 codebase/ 무변경 → push 가드 비차단 확인 (self-sanity)

## 미해결 / 후속

- `worktree.bgIsolation: "none"` repo-wide 설정은 blast radius 가 커서 보류 — EnterWorktree 툴 가이드로 대체. 추후 필요 시 사용자 결정.
