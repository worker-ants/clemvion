# 정식 규약 준수 검토 — `plan/in-progress/form-resubmit-fix.md`

검토 모드: `--plan` (plan draft 정식 규약 준수)
검토 일시: 2026-05-24

---

## 발견사항

### [CRITICAL] frontmatter `worktree` 값이 디렉토리 이름이 아닌 전체 경로
- **target 위치**: `plan/in-progress/form-resubmit-fix.md` 1–11행, frontmatter `worktree` 필드
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` (워크트리 **디렉토리 이름**)
- **상세**: 실제 값은 `.claude/worktrees/form-resubmit-fix-b1caa8` (전체 경로). `plan-lifecycle.md §4` 예시와 기존 plan 파일들(`ai-presentation-tools.md`, `multiturn-error-preserve.md` 등)은 모두 `form-resubmit-fix-b1caa8` 처럼 디렉토리 이름만 기재한다. `consistency-checker` 의 `plan_coherence` checker 는 이 필드로 워크트리 충돌 검출을 수행하는데, 경로 형식이 섞이면 동일 워크트리 중복 탐지 로직이 오탐할 수 있다.
- **제안**: 값을 `form-resubmit-fix-b1caa8` 으로 변경 (경로 접두어 `.claude/worktrees/` 제거).

---

### [CRITICAL] 필수 frontmatter 필드 `started` 누락
- **target 위치**: `plan/in-progress/form-resubmit-fix.md` 1–11행, frontmatter
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `started: <ISO 날짜>` 필수
- **상세**: frontmatter 에 `started` 키가 전혀 없다. 해당 필드는 `plan-lifecycle.md §4` 에서 필수(required)로 정의되어 있고, 동시 작업 추적·stale plan audit (`§6.1`)의 기준 날짜로 사용된다. 없으면 `plan-stale-audit.sh` 가 작업 경과 일수를 산정할 수 없다.
- **제안**: `started: 2026-05-24` 추가.

---

### [CRITICAL] 필수 frontmatter 필드 `owner` 누락
- **target 위치**: `plan/in-progress/form-resubmit-fix.md` 1–11행, frontmatter
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `owner: <역할/이름>` 필수
- **상세**: frontmatter 에 `owner` 키가 없다. `plan-lifecycle.md §4` 가 명시하는 3개 필수 키(`worktree`, `started`, `owner`) 중 하나가 완전히 빠진 상태다. 동시 작업 추적 시 어느 역할이 해당 plan 을 소유하는지 식별 불가.
- **제안**: `owner: developer` (또는 적절한 역할 표기) 추가.

---

### [WARNING] frontmatter 에 비표준 필드 `name`, `branch`, `status` 포함
- **target 위치**: `plan/in-progress/form-resubmit-fix.md` 2행(`name`), 4행(`branch`), 10행(`status`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마는 `worktree`, `started`, `owner` 세 키만 정의하며 비표준 키에 대한 허용 언급 없음
- **상세**: `name`(파일명으로 이미 식별 가능), `branch`(worktree 에서 파생 가능), `status: in-progress`(폴더 위치 자체가 이미 인코딩) 세 필드는 규약 스키마에 없는 추가 키다. `name` · `branch` 는 중복 정보이고, `status: in-progress` 는 `plan/in-progress/` 폴더 위치와 이중화된 상태다. 규약 자체가 이 필드들을 금지하지는 않으나, 다른 모든 plan 파일과 스키마 일관성이 깨진다.
- **제안**: `name`, `branch`, `status` 세 필드 제거. `related_spec`·`related_commits` 는 유용한 cross-link 이므로 유지해도 무방하나, 규약 갱신(plan-lifecycle.md §4 에 선택 필드로 공식화)이 동반되는 것이 바람직하다.

---

### [INFO] frontmatter `related_commits` 의 비표준 인라인 주석
- **target 위치**: `plan/in-progress/form-resubmit-fix.md` 9행 (`30e02117  # tool_result content...`)
- **위반 규약**: YAML frontmatter 은 `#` 인라인 주석을 허용하지만 본 프로젝트 plan 파일 관행과 다름 (어느 규약에도 명시 금지·허용이 없음)
- **상세**: YAML 파서에 따라 인라인 주석 처리 방식이 달라질 수 있다. `plan-lifecycle.md §4` 의 예시 frontmatter 에는 인라인 주석이 없다. `plan_coherence` checker 등 frontmatter 파싱 도구가 주석을 포함한 문자열로 commit hash 를 읽을 경우 매칭 오류 가능성이 있다.
- **제안**: 주석을 별도 키(`related_commits_note:`) 나 본문 섹션으로 이동하거나, YAML list item 으로 분리(`- hash: 30e02117\n  note: ...`). 또는 현행 관행 유지 후 규약에 허용 명시.

---

## 요약

`plan/in-progress/form-resubmit-fix.md` 의 본문(문제 기술·변경 범위·테스트 계획·체크리스트) 구성은 프로젝트 관행에 잘 부합하지만, frontmatter 가 `.claude/docs/plan-lifecycle.md §4` 의 정식 스키마와 세 곳에서 직접 충돌한다: (1) `worktree` 값이 디렉토리 이름 대신 전체 경로, (2) 필수 필드 `started` 부재, (3) 필수 필드 `owner` 부재. 이 세 항목은 `consistency-checker` 의 `plan_coherence` 검사와 `plan-stale-audit.sh` 가 가정하는 invariant 를 직접 깨뜨릴 수 있으므로 CRITICAL 로 분류한다. 비표준 필드 혼입은 다른 plan 파일과의 일관성 결여(WARNING)이며, 인라인 YAML 주석은 사소한 형식 문제(INFO)이다.

## 위험도

**HIGH**
