---
worktree: harness-review-router-c4f1a2
started: 2026-05-16
owner: developer (main Claude)
---

# Harness 개선: review-router + 산출물 평탄화 + default-branch 작업 차단 + hooks/scripts 정리

## 배경

네 가지 문제를 한 PR 로 묶어 해결한다 — 모두 `.claude/` 하위 harness 변경이고 변경 영역이 가까워 따로 처리하는 게 오히려 노이즈.

1. `/ai-review` 가 13 reviewer 를 무조건 전부 호출 → 한도 소진, "해당 없음" 다수.
2. 산출물이 `<role>/review.md` 디렉토리 한 단계 깊은데 항상 1파일 → 평탄화.
3. CLAUDE.md "main 워크트리 거부" 규칙이 **모델 자율 준수** → 강제력 0, 다른 세션이 무시한 사례 발생.
4. `.claude/skills/*/hooks/` 와 `.claude/hooks/`(Phase 4 신규) 가 같은 단어 "hooks" 를 다른 의미로 사용 → 혼동.

## 결과물 (제품 최종 상태)

- 산출물: `review/{code,consistency}/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/<role>.md`.
- 세션 루트: `_prompts/`, `_retry_state.json`, `meta.json`, `SUMMARY.md`, `RESOLUTION.md`, `_routing_decision.json`.
- `/ai-review` 기본 `--route=auto` — review-router 가 reviewer 선별. router_safety 화이트리스트 / 0~1 가드 / `--route=all` / `REVIEW_AGENTS` fallback. `SUMMARY.md` 끝 "라우터 결정" 섹션.
- **default branch 에서 보호 작업 3-layer 차단** — PreToolUse + UserPromptSubmit + pre-commit. branch 만 바꾸면 통과 (escape hatch 단순화).
- 디렉토리 정리: `.claude/skills/<skill>/scripts/` (skill helper), `.claude/hooks/` (Claude Code 진짜 hook) — 두 의미 분리.

## Phase 1 — 산출물 경로 평탄화 ✅ 완료

- [x] **1a** `code_review_orchestrator.py`: `<role>/review.md` → `<role>.md`.
- [x] **1b** `consistency_orchestrator.py`: 동일.
- [x] **1c** 20개 sub-agent `output_file` 문구 일반화.
- [x] **1d** `CLAUDE.md` + `code-review-agents/{README,SKILL}.md` + `consistency-checker/SKILL.md` + `commands/consistency-check.md` 경로 표기 갱신.
- [x] **1e** 옛 누적 세션은 history 보존.

## Phase 2 — review-router sub-agent ✅ 완료

- [x] **2a** `.claude/agents/review-router.md` (haiku).
- [x] **2b** `lib/router_safety.py` (강제 포함 6 카테고리, 11 케이스 sanity 통과).
- [x] **2c** orchestrator: `--route=auto|all` + router state 필드. `REVIEW_AGENTS` 명시 시 auto-skip.
- [x] **2d** `code-review-summary.md` 에 "라우터 결정" 섹션.
- [x] **2e** `SKILL.md` step 2.5 + `ai-review.md` `--route` 사용 예.

## Phase 3 — 검증 (Phase 1+2) ✅ 완료

- [x] **3a** `py_compile` 통과.
- [x] **3b** dry-run `--prepare`: 평탄 경로 + router 필드 확인. `documentation` 자동 강제 포함.
- [x] **3c** `--route=all` / `REVIEW_AGENTS=...` skip 동작 확인.
- [x] **3d** 옛 누적 세션 history 보존.

## Phase 4 — Default-branch 작업 차단 (A + B + C 풀세트)

### 차단 정책 (모든 layer 공유)

- **차단 조건 = 둘 다 참**:
  1. 최상위 `.git` 이 **디렉토리** (= main worktree).
  2. 현재 branch == default branch (origin 기준).
- **허용**: 위 조건 아닌 모든 경우 — `.git` 이 파일(worktree) 이거나, branch != default branch.
- **default branch 추출 우선순위**:
  1. `git symbolic-ref refs/remotes/origin/HEAD` 의 마지막 segment (가장 정확)
  2. fallback: `git remote show origin | sed -n 's/.*HEAD branch: //p'` (네트워크 필요할 수 있음 → 1차 실패 시만)
  3. origin 자체가 없음 → **허용** (fresh init / 로컬 전용)
- **escape hatch**: 다른 branch 로 checkout. `[hotfix-on-main]` commit prefix 같은 별도 표기 없음.
- **운영 우회**: `BYPASS_DEFAULT_BRANCH_GUARD=1` (디버깅·CI 용 — 명시적 의도 요구).

### 차단 검출 공통 모듈

`.claude/hooks/_lib/branch_guard.py` 신규 — 차단 여부 판정 함수 1개. 세 hook 스크립트가 공통 import.

```python
def is_default_branch_on_main_worktree(cwd: str) -> tuple[bool, str]:
    """Return (blocked, reason). blocked=True 면 차단."""
    # 1. .git 디렉토리 여부
    # 2. origin default branch 추출 (실패 시 허용)
    # 3. 현재 branch 비교
```

### 작업

- [ ] **4a** `.claude/hooks/_lib/branch_guard.py` — 공통 판정 함수.
- [ ] **4b** `.claude/hooks/guard_default_branch_edit.py` — PreToolUse hook.
  - stdin JSON 의 `tool_input.file_path` 또는 `tool_input.command` 추출.
  - `is_default_branch_on_main_worktree` 가 True 면 stderr 에 사유 + `exit 2`.
  - `BYPASS_DEFAULT_BRANCH_GUARD=1` 이면 `exit 0`.
- [ ] **4c** `.claude/hooks/guard_default_branch_prompt.py` — UserPromptSubmit hook.
  - 차단 조건이고 작업성 키워드("구현", "수정", "리팩토링", "추가", "버그", "기능", "테스트 작성", "fix", "implement" 등) 매칭 시 stdout 에 system reminder 출력 (Claude Code 가 prompt 에 inject).
  - 차단 아님, 안내만.
- [ ] **4d** `.githooks/pre-commit` — git hook.
  - `is_default_branch_on_main_worktree` Python 호출 (또는 동등 shell 로직).
  - True 면 `exit 1` + 안내 메시지. `BYPASS_DEFAULT_BRANCH_GUARD=1` 환경변수 시 통과.
  - 실행권한 (`chmod +x`) 부여.
- [ ] **4e** `.claude/settings.json` 에 hook 등록.
  - PreToolUse matcher: `Write|Edit|MultiEdit|NotebookEdit`.
  - Bash 도 matcher 에 포함할지는 검토 — `git commit` 자체를 Bash 로 호출하는 케이스 차단하려면 필요. 단 Bash 차단은 정밀 검사 어렵고 false-positive 위험. → **이번 phase 에선 Write/Edit 만**. git commit 은 pre-commit hook 이 잡음 (이중 방어).
  - UserPromptSubmit: matcher 없음, 스크립트 안에서 자체 필터.
  - 기존 settings.json 있으면 merge.
- [ ] **4f** setup 진입점 + 문서.
  - `scripts/setup-githooks.sh` — `git config core.hooksPath .githooks` 한 줄.
  - 프로젝트 루트의 setup 진입점이 이미 있으면 (Makefile 등) 그쪽에 추가.
  - `CLAUDE.md` "Worktree 기반 작업 정책" 절에 "Enforcement" 소절 추가 — 3-layer 동작, default-branch 정책, `BYPASS_DEFAULT_BRANCH_GUARD` 환경변수, branch 변경으로 우회 가능함 명시.
  - `README.md` (기여/실행 절) 에 setup hook 안내.
- [ ] **4g** 검증 — 5 시나리오.
  - (a) main worktree + default branch checked-out 에서 `backend/foo.ts` Edit 시도 → PreToolUse 차단.
  - (b) main worktree + 다른 branch checked-out 에서 Edit → 통과.
  - (c) 다른 worktree (`.git` 파일) 에서 Edit → 통과.
  - (d) main + default branch 에서 commit → pre-commit `exit 1`.
  - (e) `BYPASS_DEFAULT_BRANCH_GUARD=1` 로 hook 우회 동작 확인.
  - 검증은 임시 파일·임시 commit 으로 진행 후 즉시 정리.

### 운영상 고려

- **CI 환경**: GitHub Actions 등은 보통 detached HEAD 라 branch 가 default 와 같을 일 거의 없음. 필요하면 `BYPASS_DEFAULT_BRANCH_GUARD=1` 을 CI env 에 설정.
- **로컬 fetch 누락**: origin/HEAD 가 stale 일 수 있음 → `git symbolic-ref` 우선 사용 (로컬 cache). fetch 강제 안 함.
- **사용자 직접 shell** (`! git commit ...`): hook 우회 가능 — 의도된 동작. 사람 책임.

## Phase 5 — `hooks/` → `scripts/` 리네이밍 정리

Phase 4 가 만드는 `.claude/hooks/` 는 Claude Code 의 진짜 hook 이고, 기존 `.claude/skills/<skill>/hooks/` 는 skill helper script. 같은 단어가 두 의미를 가져 혼동 → skill 쪽을 `scripts/` 로 옮긴다.

### 작업

- [x] **5a** `git mv` 로 3개 디렉토리 리네이밍 (`hooks` → `scripts`, history 보존): code-review-agents · consistency-checker · merge-coordinator.
- [ ] **5b** 문서 일괄 갱신 — `grep -rn 'skills/[a-z-]\+/hooks/'` 결과 전수 치환:
  - 각 `SKILL.md` 의 명령어 예시
  - 각 `README.md`
  - `.claude/commands/{ai-review,consistency-check,merge-coordinate}.md`
  - `CLAUDE.md` 있다면
  - Phase 1-3 에서 갱신한 문서들 (현재 작업물) 포함
- [ ] **5c** 디렉토리 의미 명시 — `.claude/README.md` (없으면 신규) 에 한 줄:
  - `hooks/` = Claude Code event hooks (harness 자동 실행)
  - `skills/<skill>/scripts/` = skill 내부 helper script (main Claude 가 절차에서 호출)
  - `skills/<skill>/lib/` = Python module
- [ ] **5d** 검증: `grep -r 'skills/[a-z-]\+/hooks'` 결과 0 건 확인.

## 후속 (이번 PR 범위 외)

- merge-coordinator (4 analyzer) 평탄화 + router 패턴 적용.
- routing decision false-negative 메트릭.
- 운영 후 false-positive 사례 수집 → 정책 보정.

## Commit / PR 전략

한 PR, 4 commit 권장 (각 phase = 1 commit, 독립 revert 가능):

1. `chore(harness): flatten review output paths` — Phase 1
2. `feat(harness): add review-router + safety` — Phase 2
3. `feat(harness): enforce default-branch boundary` — Phase 4
4. `refactor(harness): rename skill hooks/ to scripts/` — Phase 5

각 commit 별로 `py_compile` + 해당 dry-run 검증 통과.
