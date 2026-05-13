---
worktree: sweet-lumiere-c41f58
started: 2026-05-13
owner: claude (skill 점검 세션)
---

# Skill 체계 개편 — Worktree 정책 + consistency-checker 도입

## 배경 (사용자 요청)

1. **병렬 작업 워크플로**: 여러 작업을 동시에 진행하는 일이 잦아져, 모든 작업이 별도 worktree 에서 일어나도록 명문화하고 싶다. main 워크트리가 공유 자원으로 충돌하는 사고를 막는다.
2. **사전 일관성 검토**: spec / plan / 구현 과정에서 기존 문서와 위배되는 결정(폐기된 대안 재도입, cross-spec 충돌, convention 위반)이 누적되고 있다. 사후 리뷰가 아닌 **사전** 검토자가 필요하다.

## 결정 사항

- **Worktree 명명 규칙**: `.claude/worktrees/<task_name>-<slug>` — `task_name` 은 요청에 적절한 의미 있는 단어, `slug` 는 호출자가 부여하는 식별자.
- **consistency-checker**: 별도 skill 로 신설. `code-review-agents` 의 오케스트레이터 코드를 라이브러리화하여 재사용.
- **spec write 정책**: **엄격 차단** — Critical 발견 시 exit code 2, project-planner 가 spec write 중단.

## 작업 항목

### 1. code-review-agents 오케스트레이터 라이브러리화 ✅

- [x] `.claude/skills/code-review-agents/lib/` 신설 + `__init__.py`
- [x] `lib/session.py` — `make_debug_logger`, `create_session_dir`, `save_metadata`, `truncate_to_budget`
- [x] `lib/agent_runner.py` — `run_single_agent`, `run_agents_parallel` (도메인 무관)
- [x] `lib/summary.py` — `render_template`, `run_summary`
- [x] `code_review_orchestrator.py` 를 thin wrapper 로 재정리 (1079 → 729 lines, 동작·CLI·hook 호환 유지)

### 2. consistency-checker skill 신설 ✅

- [x] `.claude/skills/consistency-checker/SKILL.md`
- [x] `hooks/consistency_orchestrator.py` — lib 재사용. 모드 `--spec` / `--plan` / `--impl-prep`. exit code 0/1/2.
- [x] `prompts/checkers/` 5개: `cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`
- [x] `prompts/summary.md` — BLOCK 결정 명시
- [x] `.claude/commands/consistency-check.md` slash command

### 3. CLAUDE.md 보강 ✅

- [x] "Worktree 기반 작업 정책" 섹션 신설 — 명명 규칙, 수명, 직렬화 규칙, hotfix 예외
- [x] 폴더 구조 다이어그램에 `.claude/worktrees/` 추가
- [x] 명명 컨벤션 표에 `review/consistency/` 와 `.claude/worktrees/` 행 추가
- [x] 정보 저장 위치 표에 일관성 검토 산출물 행 추가
- [x] PLAN 라이프사이클에 frontmatter (`worktree`, `started`, `owner`) 규약 추가
- [x] Skill 체계 표에 `consistency-checker` 행 추가

### 4. SKILL.md 들 보강 ✅

- [x] `developer/SKILL.md` 절대 원칙에 Worktree 강제 + 사전 일관성 검토 의무 명시
- [x] `developer/SKILL.md` 워크플로에 0단계(worktree) + 3단계(consistency-check --impl-prep) 추가, 자동 커밋 표 단계 번호 갱신
- [x] `project-planner/SKILL.md` 절대 원칙에 Worktree 강제 + **엄격 차단** 의무 명시
- [x] `project-planner/SKILL.md` 워크플로에 0단계(worktree) + 5단계(Draft) + 6단계(consistency-check --spec, Critical 시 차단) 추가
- [x] `project-planner/SKILL.md` 에 consistency-checker 와의 관계 섹션 추가

### 5. 부수 변경 ✅

- [x] `.gitignore` 에 `__pycache__/` `*.pyc` 추가 (orchestrator 부산물 제외)

### 6. 검증 ✅

- [x] lib import 통과 (`agent_runner`, `session`, `summary` 모두 callable)
- [x] `code_review_orchestrator` import 통과, 13 agent 그대로, config keys 호환
- [x] `consistency_orchestrator` import + CLI `--help` 출력 정상, 5 checker, BLOCK 파서 정상
- [x] checker prompt template substitution dry-run 통과 (모든 placeholder 치환 확인)
- [x] `/consistency-check` slash command 가 skill 목록에 등록됨

## 후속 (이 plan 완료 후 별도 작업)

- [ ] 실제 spec 영역들에 대해 `/consistency-check --impl-prep <영역>` 을 첫 회 실행해 잠재 위반을 수집·보고 (별도 task; 별도 worktree)
- [ ] `code-review-agents` 의 PostToolUse 자동 트리거(`hooks/hooks.json`)가 worktree 정책과 정합한지 점검 (현재는 cwd 기반이라 worktree 안에서 동작하면 무관하지만 명시적 점검 필요)

## 산출물 위치 요약

- 라이브러리: [.claude/skills/code-review-agents/lib/](.claude/skills/code-review-agents/lib/)
- 신규 skill: [.claude/skills/consistency-checker/](.claude/skills/consistency-checker/)
- slash command: [.claude/commands/consistency-check.md](.claude/commands/consistency-check.md)
- 문서: [CLAUDE.md](CLAUDE.md), [.claude/skills/developer/SKILL.md](.claude/skills/developer/SKILL.md), [.claude/skills/project-planner/SKILL.md](.claude/skills/project-planner/SKILL.md)
