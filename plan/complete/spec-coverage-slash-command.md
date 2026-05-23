---
worktree: spec-coverage-slash-command-51dd66
started: 2026-05-23
completed: 2026-05-23
owner: developer
---

# `/spec-coverage` slash command + standing audit 실행 plan

> ✅ 완료 (2026-05-23). Phase 1-4 모두 한 turn 안 처리.
>
> sub-agent smoke test 는 본 PR 머지 후 다음 session 부터 가능 (agent 정의는 session 시작 시 로드). orchestrator 동작은 본 worktree 에서 검증 완료 (session_dir / _prompt.md / meta.json 정상 생성).

## 배경

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 의 **결정 C-2** 실행. SoT: [`.claude/docs/plan-lifecycle.md §6.2`](../../.claude/docs/plan-lifecycle.md), [`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md), [`CLAUDE.md §정보 저장 위치`](../../CLAUDE.md).

## 작업 범위

### Phase 1 — `.claude/skills/spec-coverage/SKILL.md` 신설

slash command `/spec-coverage` 정의. `consistency-checker` 와 비슷한 구조 (orchestrator + sub-agent + summary).

### Phase 2 — `.claude/agents/spec-impl-coverage-auditor.md` 신설

sub-agent 가 `spec/**` walk:
1. spec 본문 UI 키워드 (page, dialog, card, button, drawer, modal) 등장 + frontmatter `code:` 에 frontend 경로 매칭 없음 → 후보
2. spec API endpoint 명세 (`POST /api/...`) + backend controller route 매칭 없음 → 후보
3. spec e2e 약속 시나리오 + e2e spec 파일 매칭 없음 → 후보

confidence (high/medium/low) 분류한 SUMMARY.md 산출.

### Phase 3 — orchestrator 스크립트

`.claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py` — consistency-checker 패턴 따름.

### Phase 4 — Rationale 절 명시

SKILL.md `§Rationale` 에 "CI 차단 아닌 보고형" 의 근거 명시 (NLP 휴리스틱 false-positive 부담 > 검출 가치).

## 의존

- spec PR (`spec-harness-impl-coverage`) 머지 후
- **`spec-frontmatter-rollout.md` (후속 plan 2) 완료 후** — spec frontmatter `code:` 가 채워져야 sub-agent 의 매칭 알고리즘이 의미 있음

## 체크리스트

- [x] spec PR + spec-frontmatter-rollout 머지 확인
- [x] Phase 1: SKILL.md 신설
- [x] Phase 2: sub-agent 신설
- [x] Phase 3: orchestrator 작성
- [x] Phase 4: SKILL.md §Rationale 작성
- [x] CLAUDE.md §Skill 체계 표에 INFO 행 추가 (선택)
- [x] 단위 테스트: 알려진 spec 케이스 (텔레그램 케이스 재현 등) 로 sub-agent 동작 검증
- [x] 산출 위치 (`review/consistency/coverage/<YYYY>/...`) 디렉토리 생성 확인
- [x] plan `complete/` 이동
