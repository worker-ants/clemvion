# 프로젝트 공통 규약

본 문서는 role에 무관하게 이 프로젝트에서 항상 지켜야 하는 공통 규약을 정의한다. 역할별 세부 워크플로는 `.claude/skills/` 하위의 각 skill 문서를 따른다.

## 폴더 구조

`Monorepo`로 구성되어 있다.

- 서버는 반드시 `backend`에 구성한다.
- 클라이언트는 반드시 `frontend`에 구성한다.
- 제품 정의·기술 명세는 **`spec/` 단일 폴더**에 통합 관리한다 (docs-consolidation 2026-05-12 이후).

```text
./ (Root)
  ├── spec/                  # 제품의 단일 진실 (single source of truth). 상세 트리는 spec/0-overview.md §8 참고
  ├── plan/                  # 작업 추적 라이프사이클 (in-progress/ ↔ complete/)
  ├── review/                # 코드 리뷰 / 일관성 검토 산출물 (시점별 디렉토리)
  ├── frontend/              # 클라이언트 (Next.js)
  ├── backend/               # 서버 (Nest.js)
  └── .claude/worktrees/     # 모든 신규 작업이 일어나는 git worktree 들 (main 워크트리는 통합용)
```

### 명명 컨벤션

각 폴더 안에서 따르는 규칙. **현재 파일 목록을 여기에 박제하지 않는다** — 그건 spec/0-overview.md 와 코드 트리가 책임진다.

| 위치 | 패턴 | 의미 |
| --- | --- | --- |
| `spec/<영역>/_product-overview.md` | 언더스코어 prefix | 영역의 제품 정의(옛 PRD). 다중 spec 파일을 가진 영역에 둔다 |
| `spec/<영역>/_layout.md` | 언더스코어 prefix | 영역 공통 레이아웃·횡단 규약 (예: 내비게이션 공통) |
| `spec/<영역>/0-overview.md` | `0-` prefix | 영역 안의 기술 아키텍처 개요 (제품 정의와 별개) |
| `spec/<영역>/N-name.md` | 숫자 prefix | 정렬 보장된 상세 spec 문서. 본문 끝에 `## Rationale` 섹션을 권장 |
| `spec/<영역>/0-common.md` | `0-common` | 카테고리 공통 규약 (예: 노드 카테고리별) |
| `spec/conventions/*.md` | 평문 | 정식 규약(노드 Output, Swagger 등). 다른 spec 에서 참조 |
| `plan/in-progress/<name>.md` | 평문 | 처리할 항목이 남은 plan. 새 plan 은 항상 여기 |
| `plan/complete/<name>.md` | 평문 | 모든 항목 완료된 plan. `in-progress/` 에서 `git mv` |
| `plan/complete/archive/from-*/` | 고정 경로 | 옛 `memory/`·`user_memo/` 의 1회성·역사 문서 보관. 신규 생성 금지 |
| `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` | nested ISO | 코드 리뷰 세션. `SUMMARY.md`·`RESOLUTION.md` + 분야별 `<role>.md` (예: `security.md`) |
| `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` | nested ISO | consistency-checker 세션. `SUMMARY.md` + 5 checker 별 `<checker>.md` + `meta.json` |
| `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` | nested ISO | merge-coordinator 세션. `SUMMARY.md` + 4 analyzer 별 `<analyzer>.md` + `_prompts/`·`_conflicts/`·`meta.json` |

> 옛 flat 경로(`review/<timestamp>/`, `review/consistency/<timestamp>/`) 의 누적된 데이터는 한 디렉토리 안 항목 수가 폭주해 `ls` 등 파일시스템 조회가 무거워지는 문제가 있어 nested 형식으로 전환했다. 기존 데이터는 사용자가 일괄 이동 예정이며, 새 세션부터 위 형식을 강제한다.
| `.claude/worktrees/<task_name>-<slug>/` | `<task_name>-<slug>` | 신규 작업이 일어나는 worktree. `task_name` 은 요청에 맞는 의미 있는 단어, `slug` 는 호출자가 부여하는 식별자 |

> 옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다.

## 개발 방법론

모든 개발은 반드시 **SDD(Spec-Driven Development)** 와 **TDD(Test-Driven Development)** 로 접근한다. 아래 공통 규약은 **반드시 누락 없이** 지켜진다.

테스트는 unit · integration · **e2e**(`make e2e-test`, `docker-compose.e2e.yml` 기반 격리 인프라) 3 계층으로 운영하며, 영역별 작성·실행 규약은 `.claude/skills/developer/SKILL.md` 의 TEST WORKFLOW 와 E2E TEST WRITING GUIDE 에 위임한다.

### 정보 저장 위치 (단일 진실 원칙)

| 저장할 내용 | 위치 |
| --- | --- |
| 제품 정의·요구사항 (옛 PRD) | `spec/<영역>/_product-overview.md` 또는 영역 진입 문서의 `## Overview (제품 정의)` 섹션 |
| 기술 명세 (스펙) | `spec/<영역>/*.md` 본문 |
| 아키텍처 결정의 배경·근거 (옛 ADR/memory) | 해당 spec 문서 끝의 `## Rationale` 섹션 |
| 정식 규약 (옛 user_memo CONVENTIONS) | `spec/conventions/<name>.md` |
| 진행 중 작업 추적 | `plan/in-progress/<name>.md` (frontmatter 에 `worktree` 명시) |
| 완료된 작업 추적 | `plan/complete/<name>.md` (`git mv`로 이동) |
| 코드 리뷰 산출물 | `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/{SUMMARY.md,RESOLUTION.md,<role>.md,_routing_decision.json,...}` |
| 일관성 검토 산출물 | `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/{SUMMARY.md,meta.json,<checker>.md,...}` |
| 통합 검토 산출물 | `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/{SUMMARY.md,meta.json,<analyzer>.md,_prompts,_conflicts,...}` |
| 1회성 분석·역사 문서 | `plan/complete/archive/from-*/` 만 보관, 신규 생성 금지 |

### 작업 시 점검 (절대 누락 금지)

- 작업 이전: 관련 `spec/` 문서와 `plan/in-progress/` 를 먼저 읽는다.
- 작업 이후: 결과를 해당 위치의 살아있는 문서에 반영하거나, 더 이상 필요 없는 항목은 제거한다.

### PLAN 문서 라이프사이클

`plan/` 하위는 **반드시** 다음 두 폴더 중 하나에 위치해야 하며, 최상위(`plan/*.md`)에는 plan 문서를 두지 않는다.

- **`plan/in-progress/`** — 처리할 항목이 하나라도 남아있는 plan 문서를 둔다. 새 plan 문서는 항상 여기에서 생성한다. 하위 폴더로 그룹핑(예: `plan/in-progress/stages/`)해도 된다.
- **`plan/complete/`** — 모든 작업·체크리스트·후속 항목까지 끝난 plan 문서만 둔다. 미완 항목이 단 하나라도 남아있으면 이 폴더로 옮기지 않는다.

규칙:

- **이동 시 `git mv` 사용** — 단순 복사·삭제가 아니라 `git mv` 로 옮겨 history를 보존한다.
- **상태 갱신 시점**: 작업 단계가 끝날 때마다 plan 문서를 갱신하고, 모든 항목이 완료된 순간에 `complete/`로 이동한다. 새로운 후속 항목이 발견되면 다시 `in-progress/`로 되돌린다.
- **이동은 마지막 작업 PR 안에서 처리** — plan 의 모든 체크박스가 `[x]` 가 되고 미해결 follow-up 도 0건이 되는 그 PR 안에서 함께 `git mv` 한다. **plan 이동만 담은 별 PR 로 분리하지 않는다** (PR 증식 + 이동 누락 패턴 차단). 코드 변경 commit 과 분리해 `chore(plan): mark <name> complete` 형태의 commit 을 같은 PR 에 추가한다. review 중 일부 항목이 follow-up 으로 빠지면 같은 PR 의 추가 commit 으로 plan 의 해당 항목을 `[ ]` 로 되돌리고 `git mv` 도 `in-progress/` 로 revert.
- **분류 기준**: 미체크 체크박스(`[ ]`), "TODO", "남은 작업", "다음 단계", "결정 필요", 미해결 follow-up 항목이 하나라도 있으면 `in-progress/` 다.
- **인입 참조**: `review/**` 처럼 시점 기록 성격의 문서는 옛 경로를 그대로 둔다(역사 기록). `spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신한다.
- **frontmatter 메타데이터**: `plan/in-progress/<name>.md` 상단에 다음 frontmatter 를 둔다. 동시 작업 추적과 worktree 충돌 검출(consistency-checker 의 `plan_coherence` checker)에 사용된다.

  ```markdown
  ---
  worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름
  started: 2026-05-13              # ISO 날짜
  owner: <역할/이름>                 # planner / developer / 사용자 본인 등
  ---
  ```

  `complete/` 로 옮긴 후에는 frontmatter 를 그대로 두어 history 가 보존되도록 한다.

## Worktree 기반 작업 정책

병렬 작업이 일상이므로, **모든 신규 작업(spec 개정 · 구현 · 리뷰 조치)은 별도 worktree 에서 진행한다**. main 워크트리는 통합/릴리스 운영용으로만 사용한다.

### 명명 규칙

`.claude/worktrees/<task_name>-<slug>/`

- `task_name` — 요청에 맞는 의미 있는 단어 (kebab-case). 예: `nav-redesign`, `auth-refactor`, `webhook-spec-draft`, `skill-rework`. 사람이 한눈에 무슨 작업인지 알아볼 수 있는 단어를 고른다.
- `slug` — 호출자가 부여하는 식별자 (자동 생성된 짧은 코드, 충돌 회피용). 예: `c41f58`, `7ab3d2`.

전체 예시: `.claude/worktrees/skill-rework-c41f58`, `.claude/worktrees/auth-refactor-7ab3d2`.

### 운영 규칙

- **진입 시 강제**: 모든 skill (`project-planner` · `developer`) 의 0단계는 "현재 worktree 확인". main 워크트리에서 진입하면 작업을 거부하고 worktree 생성을 안내한다.
- **수명 = PR 단위**: 작업이 PR 로 merge 되면 즉시 `git worktree remove` 로 정리한다. 사용 끝난 worktree 를 누적시키지 않는다.
- **plan 과 worktree 의 결속**: 새 plan 을 만들 때 frontmatter 의 `worktree` 필드에 현재 worktree 이름을 기록한다. 동일 worktree 안에서 여러 plan 이 진행되어도 무방하다.
- **공유 자원 직렬화**: 같은 `spec/` 파일이나 동일 코드 영역을 두 worktree 가 동시에 수정 중이면, plan/in-progress 에 그 사실을 명시적으로 기록하고 작업을 직렬화한다. `consistency-checker` 의 `plan_coherence` 가 이 충돌을 사전 검출한다.
- **hotfix 예외**: 긴급 hotfix 도 별도 branch 에서 작업한다. 정말 default branch 에서 직접 commit 해야 하는 경우는 `BYPASS_DEFAULT_BRANCH_GUARD=1` 로 한 commit 만 우회 (아래 Enforcement 절 참고).
- **통합 작업 worktree**: 다수 branch 를 통합할 때는 `merge-coordinator` 가 별도 `.claude/worktrees/integrate-<slug>/` 를 신설해 거기서 merge/rebase 를 시도한다. 통합이 PR 로 merge 되면 정리한다.

### 신규 worktree 생성 명령 예

```bash
git worktree add .claude/worktrees/<task_name>-<slug> -b <branch_name>
cd .claude/worktrees/<task_name>-<slug>
```

`branch_name` 은 일반적으로 `claude/<task_name>-<slug>` 또는 작업 의도에 맞는 feature 브랜치명을 사용한다.

### Enforcement (자동 차단 3-layer)

CLAUDE.md / SKILL.md 의 worktree 규칙은 모델 자율 준수만으로는 위반된 사례가 있어, 다음 3-layer 자동 차단을 둔다. 모두 같은 정책을 공유하며 판정은 `.claude/hooks/_lib/branch_guard.py` 한 곳에서 한다.

- **차단 조건**: 최상위 `.git` 이 **디렉토리**(== main worktree) **AND** 현재 branch == origin default branch.
- **허용**: 위 조건 아닌 모든 경우. linked worktree (`.git` 이 파일) 거나, branch 가 default 가 아니거나, origin 자체가 없으면 통과.

| Layer | 위치 | 시점 | 효과 |
|---|---|---|---|
| **A. PreToolUse hook** | `.claude/hooks/guard_default_branch_edit.py` | Write/Edit/MultiEdit/NotebookEdit 직전 | 차단 + Claude 에게 사유 전달 |
| **B. UserPromptSubmit hook** | `.claude/hooks/guard_default_branch_prompt.py` | 사용자 prompt 진입 | 작업성 키워드 매칭 시 reminder inject (안내, 차단 X) |
| **C. git pre-commit hook** | `.githooks/pre-commit` | `git commit` 직전 | exit 1 로 commit 자체 차단 |

활성화:

```bash
make setup-githooks   # 또는: git config core.hooksPath .githooks
```

A·B 는 `.claude/settings.json` 등록만으로 자동 동작. C 는 한 번 `setup-githooks` 실행 필요 (`core.hooksPath` 는 clone 별 git config 라 동기화 안 됨).

우회:

- **branch 변경** (정상 동선): 다른 branch / worktree 로 옮기면 자동 통과.
- **`BYPASS_DEFAULT_BRANCH_GUARD=1`**: 단발성 우회. 의식적 결정 (release tagging, 긴급 hotfix 등) 에만 사용.

옛 `[hotfix-on-main]` commit message escape hatch 는 폐기 — branch 변경만으로 충분하므로 별도 표기 불필요.

## Skill 체계 (역할 분담)

이 프로젝트의 작업은 역할 단위로 분리되어 있다. 사용자의 요청이 어느 역할에 속하는지 판별한 뒤, 해당 skill의 지침을 따른다.

| 역할 | Skill | 담당 업무 | 쓰기 권한 |
| ---- | ----- | --------- | --------- |
| 기획자 | [`project-planner`](.claude/skills/project-planner/SKILL.md) | 제품 정의·스펙(spec)의 신규 작성·개정. `spec/` 본문·Overview·Rationale 모두 다룬다. **구현 금지** | `spec/**`, `plan/**` |
| 개발자 | [`developer`](.claude/skills/developer/SKILL.md) | 스펙 기반의 구현·리팩토링·테스트 작성·빌드·품질 검증. **기획 금지** | `frontend/**`, `backend/**`, `plan/**`, `review/**/RESOLUTION.md`. `spec/` 은 **read-only** — 수정 필요 시 `project-planner` 로 위임 |
| 일관성 검토자 | [`consistency-checker`](.claude/skills/consistency-checker/SKILL.md) (`/consistency-check`) | spec/plan/구현 착수 **직전** 다른 문서와의 위배 사전 검출. Critical 발견 시 호출자를 차단. | `review/consistency/**` |
| 코드 리뷰어 | [`code-review-agents`](.claude/skills/code-review-agents/SKILL.md) (`/ai-review`) | **사후** 다각도 코드 리뷰 실행. `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 생성 | `review/**` (SUMMARY 와 각 에이전트 출력) |
| 통합 조율자 | [`merge-coordinator`](.claude/skills/merge-coordinator/SKILL.md) (`/merge-coordinate`) | 다수 PR/branch 통합 전·중·후 검토 (4 analyzer + 1 summary) + conflict 시 patch 제안 위임 + `/ai-review`·`/consistency-check` 자동 chain. 격리 worktree 안에서 실행 | `review/merge/**`, `.claude/worktrees/integrate-*/**` |

- `spec/` 을 다루면 `project-planner` 로 진입한다.
- 코드베이스(`frontend/`·`backend/`)를 다루면 `developer` 로 진입한다.
- 구현 중 스펙 수정이 필요해지면 `developer` 는 작업을 멈추고 `project-planner` 호출 또는 사용자에게 위임한다.
- `project-planner` 는 `spec/` 에 쓰기 **직전** 에 `consistency-checker --spec` 을 의무 호출하고, Critical 발견 시 차단한다. `developer` 는 구현 착수 **직전** 에 `consistency-checker --impl-prep` 를 의무 호출한다.

## 외부 LLM 호출 정책

요금제 정책 변경으로 다음 두 경로의 model 호출은 **모두 사용 금지**.

- `subprocess.run(["claude", "-p", ...])` — 별도 Claude CLI 인스턴스 spawn
- `anthropic.Anthropic().messages.create(...)` — Anthropic SDK 직접 호출

본 프로젝트에서 model 을 호출하는 유일한 경로는 **main Claude(현재 session) 가 `Agent` tool 로 sub-agent 를 invoke** 하는 것이다. sub-agent 는 `.claude/agents/<name>.md` 에 정의된 custom subagent 로, 호출 즉시 별도 conversation 으로 격리된다.

### 적용 규칙

- `/ai-review`, `/consistency-check` 모두 hook 자동 trigger 가 아닌 **slash command 진입점**만 사용. PostToolUse 자동 트리거는 사용 불가 (model 호출이 main session 안에서만 가능).
- orchestrator 스크립트(`.claude/skills/*/hooks/*_orchestrator.py`)는 **prepare 모드**만 갖는다 — diff/context 수집, prompt 파일 작성, `_retry_state.json` 초기화, 세션 경로 stdout 출력. **model 호출 금지**.
- 모든 sub-agent 는 `prompt_file=<...>` 와 `output_file=<...>` 두 인자를 받아 본문은 output_file 에 Write 하고, main 에게는 한 줄(`STATUS=<...> ISSUES=<n> PATH=<...> RESET_HINT=<sec>`) 만 반환한다. main 의 context window 부담을 최소화하기 위함.
- `claude -p` 또는 SDK 호출 코드를 새로 추가하지 않는다. 발견되면 sub-agent 위임으로 즉시 전환.

### 사용량 한도 무한 재시도 정책

- sub-agent 가 한도 메시지(`Claude AI usage limit reached`, `rate_limit_exceeded`, `quota`, `try again in ...`, `5-hour limit`) 를 받으면 임의로 우회·재시도하지 않고 그대로 `STATUS=rate_limit` 와 RESET_HINT 를 보고한다. 재시도 결정은 호출자(main) 가 한다.
- main 은 한도 감지 시 미완료 명단을 `_retry_state.json` 에 유지하고 `ScheduleWakeup(delay=RESET_HINT or 1800, prompt="/loop /ai-review", reason=...)` 으로 재시도를 예약한 뒤 turn 을 종료한다. main session 이 점유되지 않으므로 한도 회복까지 사용자가 다른 일을 할 수 있다.
- 사용자는 `/loop /ai-review` 또는 `/loop /consistency-check` 로 진입해 dynamic mode 에서 무한 재시도를 위임한다. pending 이 비면 ScheduleWakeup 미호출 → /loop 자연 종료.
- 네트워크 오류(`STATUS=network`) 도 동일하게 무한 재시도 대상이며 RESET_HINT 없을 때 `RETRY_WAKE_DEFAULT_SEC`(1800s) 사용.
- 결정적 오류(`STATUS=fatal`) 는 재시도하지 않고 partial SUMMARY 에 표기한다. 예: prompt 파일 부재, sub-agent definition 부재, 명백한 argument 오류.

## 프로젝트 스펙 문서

`spec/` 하위 문서는 제품의 **최종 상태**를 정의한다. history 가 아닌 latest 에 대한 기술이므로, 변경이 누적되어 정합성이 흐려질 경우 문서를 전체적으로 정리·재구성한다.

각 spec 문서는 권장 3섹션 구성을 따른다:

1. **Overview (제품 정의)** — 영역의 사용자 가치·요구사항·목표. 옛 PRD 의 자리.
2. **본문 (스펙)** — 데이터 모델, API, UI, 상태 전이, 에러 처리 등 기술 명세.
3. **Rationale** — 결정의 배경·근거·폐기된 대안. 옛 memory/ ADR 의 자리.

> `_product-overview.md` 는 다중 spec 파일을 가진 영역에서 Overview 만 따로 두는 케이스다. 단일 spec 파일 영역(예: `spec/5-system/12-webhook.md`)은 본문 상단에 직접 `## Overview` 섹션을 둔다.

## 패키지 매니저

frontend와 backend는 모두 npm을 사용한다. (yarn, pnpm 등을 사용하지 않는다.)

## README.md

`README.md` 는 제품의 설명과 실행 방법 등을 기술한다. 구현 완료 후 변동 사항이 있을 경우 `spec/` 을 참고해 다시 정리한다. history 가 아닌 **제품의 최종 상태** 를 서술한다.
