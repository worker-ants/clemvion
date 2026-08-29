# 프로젝트 공통 규약

역할 무관하게 항상 지킨다. 역할별 워크플로는 `.claude/skills/` 하위 SKILL.md.

## 0. 작업 시작 전 (TL;DR)

모든 작업은 `.claude/worktrees/<task>-<slug>/` 안에서 진행한다. main 워크트리 default branch 에서는 Write/Edit/`git commit` 이 hook 으로 차단된다.

```bash
.claude/tools/ensure-worktree.sh <task_name>
# 출력 마지막 줄의 `cd ...` 그대로 실행
```

**예외**: read-only Q&A turn (검색·설명·요약 답변, 어떤 파일도 write 하지 않음) 은 worktree 없이 가능.

> 상세 규칙·Enforcement 4-layer·우회: [`.claude/docs/worktree-policy.md`](.claude/docs/worktree-policy.md)

## 폴더 구조

Monorepo. 애플리케이션 코드는 `codebase/` 하위 (서버 `codebase/backend`, 클라이언트 `codebase/frontend`). 제품 정의·기술 명세는 `spec/` 단일 폴더.

```text
./
  ├── spec/                # 제품의 단일 진실
  ├── plan/                # 작업 추적 (in-progress/ ↔ complete/) + research/ (리서치 산출물)
  ├── review/              # 코드 리뷰 / 일관성 검토 산출물 (nested ISO)
  ├── codebase/{frontend,backend,packages,channel-web-chat}/  # channel-web-chat: 임베드형 웹채팅 위젯 SPA (Next.js CSR, spec/7-channel-web-chat)
  └── .claude/worktrees/   # 모든 신규 작업의 git worktree
```

## 정보 저장 위치 (단일 진실 원칙)

| 저장할 내용 | 위치 |
| --- | --- |
| 제품 전체 개요·시스템 아키텍처·cross-cutting 진입 | `spec/0-overview.md` (루트, `0-` prefix). 영역 폴더 위에서 cross-cutting 으로 참조되는 루트 레벨 진입 문서 |
| 제품 정의·요구사항 | `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` |
| 기술 명세 | `spec/<영역>/*.md` 본문 |
| 결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale` |
| 정식 규약 | `spec/conventions/<name>.md` |
| 진행 중 작업 | `plan/in-progress/<name>.md` (frontmatter 에 `worktree` 명시) |
| 완료된 작업 | `plan/complete/` — 라이프사이클·이동 방식은 [`.claude/docs/plan-lifecycle.md`](.claude/docs/plan-lifecycle.md) |
| 리서치·분석 산출물 (작업 plan 아님) | `plan/research/` — 경쟁 분석·기술 조사 등 "참조되는" 문서. 완료 종착점이 없어 in-progress/complete 축과 분리. 판별 기준: [`.claude/docs/plan-lifecycle.md §2`](.claude/docs/plan-lifecycle.md) |
| 1회성·역사 문서 | `plan/complete/archive/from-*/` 만 보관, 신규 생성 금지 |
| 코드 리뷰 산출물 | `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` |
| 일관성 검토 산출물 | `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` |
| 통합 검토 산출물 | `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` |
| Spec-impl coverage standing audit 산출물 | `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (slash `/spec-coverage` 산출. SoT: [`spec/conventions/spec-impl-evidence.md`](spec/conventions/spec-impl-evidence.md) + [`.claude/docs/plan-lifecycle.md §6.2`](.claude/docs/plan-lifecycle.md)) |

> PLAN 라이프사이클·이동 규칙·frontmatter 스키마: [`.claude/docs/plan-lifecycle.md`](.claude/docs/plan-lifecycle.md)
> Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고.

## 개발 방법론

SDD(Spec-Driven Development) + TDD. 테스트는 unit / integration / e2e 3계층.

실제 명령·인프라·면제 화이트리스트·e2e 작성 패턴: [`PROJECT.md`](PROJECT.md).
Workflow 의 generic 단계 정의: [`developer/SKILL.md`](.claude/skills/developer/SKILL.md).

## Skill 체계

| 역할 | Skill | 쓰기 권한 |
| --- | --- | --- |
| 기획자 | [`project-planner`](.claude/skills/project-planner/SKILL.md) | `spec/**`, `plan/**` |
| 개발자 | [`developer`](.claude/skills/developer/SKILL.md) | `codebase/**`, `plan/**`, `review/**`. `spec/` read-only ([좁은 예외](#자기-반증형-소정정--developer-가-spec-을-고칠-수-있는-유일한-경우)) |
| 일관성 검토자 | [`consistency-checker`](.claude/skills/consistency-checker/SKILL.md) (`/consistency-check`) | `review/consistency/**` |
| 코드 리뷰어 | [`code-review-agents`](.claude/skills/code-review-agents/SKILL.md) (`/ai-review`) | `review/code/**` |
| 통합 조율자 | [`merge-coordinator`](.claude/skills/merge-coordinator/SKILL.md) (`/merge-coordinate`) | `review/merge/**`, `.claude/worktrees/integrate-*/**` |

- `spec/` 변경 → `project-planner`. `codebase/` 변경 → `developer`.
- 구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임 — **단 하나의 좁은 예외**는 아래 §자기-반증형 소정정.
- `project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무. `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 의무. Critical 발견 시 차단.

### 자기-반증형 소정정 — `developer` 가 `spec/` 을 고칠 수 있는 유일한 경우

`developer` 가 **자신이 그 spec 문서에 써 넣은 예고 문장**을 나중에 실측으로 반증했을 때,
그 문장의 정정에 한해 planner 턴 없이 직접 고친다. 아래 **다섯 조건을 전부** 충족해야 한다:

1. 대상 문장을 **developer 자신이 그 문서에 썼다** (`git blame` 으로 확인 가능)
2. 그 문장이 **예고·트리거**다 — 제품 정의·요구사항·API 계약은 **해당 없음**
3. **실측이 그 문장을 반증**했고, 그 측정을 정정문에 함께 싣는다
4. 정정은 그 문장에 **국한**된다 — 원문은 취소선으로 **남기고**, 인접 서술은 건드리지 않는다
5. plan `spec_impact` 에 명시하고 커밋 본문에 실측을 기록한다

**게이트**: `--spec` 대신 **`--impl-done` 을 그 spec 파일이 포함되는 scope 로** 반드시 돌린다.
사전 승인을 면제하는 대신 사후 그물이 훑는다.

> **왜 예외인가** (2026-08-23 사용자 결정, `#1202` 계기): 틀린 예고를 남겨 두면 다음 사람이
> 있지도 않은 작업을 쫓는다. 그런데 예고를 남긴 것도, 그것이 틀렸음을 실측한 것도 developer
> 다 — 여기서 planner 를 강제하면 **반증할 수 있는 유일한 사람에게서 정정 권한을 뺏는다**.
> 조건 1~5 가 이 예외를 "실측했으니 고쳤다" 라는 만능 통행증으로 넓히는 것을 막는다.

**보조 도구**: [`spec-coverage`](.claude/skills/spec-coverage/SKILL.md) (`/spec-coverage`) — spec 본문 약속 vs 구현 갭 standing audit (NLP 휴리스틱). 수동 호출만, CI 차단 아님. 산출 `review/spec-coverage/**`. SoT: [`spec/conventions/spec-impl-evidence.md`](spec/conventions/spec-impl-evidence.md) + [`.claude/docs/plan-lifecycle.md §6.2`](.claude/docs/plan-lifecycle.md).

## 외부 LLM 호출 정책

**기준**: model 호출은 **플랜 토큰 사용량에 포함되는(plan-metered) harness 경로**로만 한다. `subprocess.run(["claude", "-p", ...])` 와 Anthropic SDK 직접 호출은 별도 과금/미터링을 우회하므로 **금지**.

허용되는 단일 경로 — 둘 다 main Claude 가 초기화하고 플랜 토큰에 포함된다:

- **`Agent` tool** — main Claude 가 sub-agent 를 직접 invoke (기본 경로).
- **`Workflow` tool** — main Claude 가 호출하는 결정적 오케스트레이션. 내부 `agent()` 는 harness sub-agent 를 띄우며 `claude -p` 와 달리 플랜 토큰에 포함된다. 다수 sub-agent 의 fan-out/pipeline 을 스크립트로 결정적 제어할 때 사용 (orchestrator 의 수작업 STATUS/재시도 상태기계를 대체 가능).

auxiliary Python 스크립트(예: `.claude/skills/**/scripts/*orchestrator*.py`)는 **여전히 model 을 직접 호출하지 않는다** — 세션 준비·상태 파일 관리만. model 호출은 위 두 tool 중 하나로 main Claude 가 수행한다.

### 구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무 (standing opt-in)

`Workflow` tool 의 일반 가드는 "사용자가 명시적으로 multi-agent orchestration 에 opt-in 했을 때만 호출" 하라고 한다. 이는 **임의 작업에 대한 비용 보호**다. 그러나 **구현(`developer`) 완료 후의 `/ai-review` + critical/warning fix 는 그 가드의 예외** — 본 프로젝트가 **상시 사전 승인한 강제 단계**다 (developer SKILL §REVIEW WORKFLOW, hook 강제). 따라서:

- 구현이 끝나면 `/ai-review` 를 "범위가 커 보인다 / 사용자가 이번 턴에 명시 안 했다" 는 이유로 미루지 않는다. 이 자동 리뷰는 "추론된 scale" 이 아니라 **명시 규약**이므로 Workflow opt-in 가드에 걸리지 않는다.
- 마찬가지로 SUMMARY 의 Critical/Warning 에 대한 `resolution-applier` fix 도 같은 턴의 강제 의무다.
- **자동 트리거(구현 완료 후) 시에는** Workflow 의 비동기 간극을 피하기 위해 `code-review-agents` SKILL 의 **fallback 평문 Agent fan-out 경로**를 선택할 수 있다 — 사용자가 명시적으로 `/ai-review` 를 친 경우(대화형)는 Workflow 경로가 자연스럽다.

Sub-agent 호출 규약(prompt_file/output_file/STATUS 라인) + 한도 무한 재시도 정책: [`.claude/docs/subagent-call-contract.md`](.claude/docs/subagent-call-contract.md).
