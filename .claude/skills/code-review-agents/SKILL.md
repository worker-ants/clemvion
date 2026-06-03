---
name: code-review-agents
description: 역할 기반 sub-agent(`<role>-reviewer`, 디폴트 14개; `.claude.project.json` 의 `agents.reviewers` 로 부분 disable 가능)를 main Claude 가 Agent tool 로 병렬 호출해 코드 리뷰를 수행합니다. 사용자가 "코드 리뷰", "ai-review", "변경사항 검토/점검", "보안/성능 리뷰" 를 요청하거나, 기능 구현·리팩토링 완료 후 품질 검증이 필요할 때 사용합니다. 사용량 한도가 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도합니다.
model: sonnet
---

# Code Review Agents

전문 관점 reviewer sub-agent (디폴트 14개; 프로젝트별 `agents.reviewers` 토글로 부분 disable 가능) 가 격리 컨텍스트에서 병렬 리뷰를 수행하고, `code-review-summary` sub-agent 가 결과를 단일 SUMMARY.md 로 통합합니다. Critical/Warning 발견 시 `resolution-applier` sub-agent 가 자동으로 fix + e2e + RESOLUTION 까지 처리합니다 (사용자 결정이 필요한 순간만 main 으로 escalate).

> **프로젝트별 reviewer 토글**: `.claude.project.json` 의 `agents.reviewers.<name>: false` 로 특정 reviewer 비활성. 예: 유저 가이드 매트릭스(PROJECT.md §변경 시 동반 갱신) 가 없는 프로젝트는 `agents.reviewers.user_guide_sync: false`. 디폴트는 전부 활성화 — 키 누락·`true` 면 enabled. 일회성 override 는 `REVIEW_AGENTS` env (project_config 보다 우선).

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 실행 절차

### 0. 사전 점검

현재 worktree 확인 ([`.claude/docs/worktree-policy.md`](../../docs/worktree-policy.md)). main 워크트리에서 호출되면 worktree 안내 후 거부.

**백그라운드(bg) 세션이면 `EnterWorktree` *툴* 로 격리됐는지 확인** — 셸 `cd` 만으로는 부족하다. 부모 bg 세션이 isolate 되지 않으면 harness `worktree.bgIsolation` 가드가 **Workflow sub-agent (reviewer·summary·resolution-applier) 의 공유 체크아웃 write 를 전부 차단**한다. 미격리 bg 세션에서 본 skill 을 돌리면 reviewer output_file·SUMMARY·후속 fix write 가 막히므로, 먼저 `EnterWorktree` 로 부모 세션을 격리한 뒤 진행한다. (배경: [`.claude/docs/orchestrator-workflow-migration.md`](../../docs/orchestrator-workflow-migration.md).)

> **자동 트리거(구현 완료 후) vs 대화형 호출**: `developer` 의 REVIEW WORKFLOW 가 자동으로 본 skill 을 트리거한 경우, 이는 **상시 승인된 강제 의무**이지 사용자가 추론하게 한 비싼 scale 이 아니다 (CLAUDE.md §외부 LLM 호출 정책 — standing opt-in). Workflow 의 "명시 opt-in 시에만" 가드 때문에 미루지 말 것. 비동기 task-notification 간극을 피하고 싶으면 자동 트리거 시 §(fallback) 평문 Agent fan-out 경로를 택할 수 있다 — 한 번에 완주하고 SUMMARY 를 같은 흐름에서 받는다. 사용자가 직접 `/ai-review` 를 친 대화형 호출은 Workflow 경로(§2)가 자연스럽다.

### 1. 세션 준비 (model 호출 없음)

```bash
# /loop 밖
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS

# /loop 안 — loop_mode=true 초기화
AI_REVIEW_LOOP=1 python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS

# wake 사이클 — `--resume <session_dir>`
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --resume <session_dir>
```

stdout 마지막 줄 = 세션 디렉토리 절대경로.

옵션:
- 인자 없음 → git diff (staged + unstaged + untracked)
- `--staged`, `--commit <ref>`, `--range <a>..<b>`, `--branch <base>`, 파일/디렉토리 경로
- `--route=auto` (기본) / `--route=all` (router skip, 전수 실행)

### 2. Workflow 실행 (Route → Review → Summary, 기본 경로)

`--prepare` 가 만든 `_retry_state.json` 은 model-free manifest (경로뿐). 짧게 Read 해 매니페스트를 추출하고 `Workflow` tool 에 넘긴다 — router 호출·선별·reviewer fan-out·STATUS 추적·수렴을 Workflow 가 결정적으로 처리 (옛 step 2.5 라우터 → `--apply-routing` → fan-out → `--update` → summary 수작업 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합 (CLAUDE.md §외부 LLM 호출 정책).

```text
1. Read <session_dir>/_retry_state.json — subagent_invocations[], router_subagent_type,
   router_prompt_file, router_output_file, routing_status, agents_forced,
   summary_subagent_type, summary_output_file 추출 (경로뿐, 작음).
2. Workflow(name="ai-review", args={
     invocations:    subagent_invocations,
     router:         router_prompt_file 이 null 이 아니면 {subagent_type: router_subagent_type,
                       prompt_file: router_prompt_file, output_file: router_output_file}, 아니면 null,
     routing_status: routing_status,         // "pending" → router 실행, "skipped" → 전수
     agents_forced:  agents_forced,
     summary: { subagent_type: summary_subagent_type, output_file: summary_output_file }
   })
```

Workflow 동작:
- **Route**: `routing_status=="pending"` 이고 router 가 있으면 `review-router` 를 `mode=workflow` + structured-output schema 로 invoke → `decisions[]` 반환. `selected = agents_forced ∪ {selected:true}`. `skipped` 이면 전수. router 실패 시 fail-open(전수).
- **Review**: selected reviewer 를 `agentType` 으로 병렬 invoke (각 reviewer 가 자기 `prompt_file` Read → `output_file` Write — call-contract 그대로, Workflow 내 reviewer write 허용).
- **Summary**: `code-review-summary` 가 `mode=workflow` 로 통합 SUMMARY 마크다운을 **반환** (terminal sub-agent 의 report-file Write 는 차단되므로 텍스트 반환).

완료 시 task-notification. selected 0명이면 반환에 `error` — main 이 minimal SUMMARY.

### 3. SUMMARY 기록 + 수렴 분기

Workflow 반환값 (ai-review.js 가 항상 경로+전문을 함께 반환):
- `summary_output` — SUMMARY 가 있어야 할 절대경로 (`<session_dir>/SUMMARY.md`).
- `summary_markdown` — 통합 SUMMARY **전문 (항상 채워짐)**.
- `summary_written` — workflow 내 summary sub-agent 자체 Write 성공 여부 (terminal write 가드로 false 일 수 있음).
- `risk` / `critical_count` / `warning_count` / `reviewers[]` / `skipped[]` / `unfinished[]` / `routing` / `router_decisions`.

분기:
1. **반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 — `summary_written` 값과 **무관하게 멱등 persist**. (workflow 의 terminal summary sub-agent write 는 harness 가 차단할 수 있고 workflow 스크립트는 FS 접근이 없으므로, 디스크 단일 진실의 신뢰 경로는 main 의 이 Write 다. 건너뛰면 SUMMARY.md 가 디스크에 없어 review-before-stop 가드가 미해소된다.)
2. 기록 후 `summary_markdown`(또는 상단 30줄)으로 전체 위험도 확인. Critical/Warning > 0 이면 §6 자동 후속 흐름 진입. 아니면 종료 + 1-2문장 보고.
3. `unfinished[]` 가 있으면(rate_limit/network) 해당 reviewer 만 재실행 — loop 결합은 §7.

> **재시도 정책 차이**: Workflow 경로는 옛 cross-turn ScheduleWakeup quota 자동 재시도를 갖지 않는다. `unfinished` reviewer 는 main 이 재실행하거나 `/loop` (fallback 경로)로 처리. 한도 상황의 무한 재시도가 꼭 필요하면 아래 fallback 경로 사용.

### (fallback) 수동 Agent 경로

Workflow 불가 환경에서는 orchestrator 의 `--summary-state` / `--apply-routing` / `--update` CLI + 직접 `Agent` fan-out + `Agent(code-review-summary, session_dir=<...>)` + `/loop` ScheduleWakeup 로 동일 결과를 낸다 (state CLI 는 `test_orchestrator_state.py` 로 검증되는 안정 인터페이스).

### 6. 자동 후속 흐름 — `resolution-applier` 위임

SUMMARY 의 Critical/Warning > 0 이면 main 은 다음 한 호출로 끝낸다:

```
Agent(subagent_type="resolution-applier",
      prompt="session_dir=<session_dir>")
```

resolution-applier 는 §8.1–8.6 (분류·코드 fix·spec draft·e2e·RESOLUTION) 을 자기 컨텍스트 안에서 수행한다. main 으로 돌아오는 건 확장 STATUS 한 줄:

```
STATUS=<...> ITEMS=<r>/<t> E2E=<pass|fail|blocked|skipped> ESCALATE=<flag> NEEDS_SPEC=<path> RESOLUTION=<path> RESET_HINT=<sec>
```

분기:

| ESCALATE | main 후속 |
|---|---|
| `no` | RESOLUTION 경로와 ITEMS·E2E 결과를 1-2문장으로 보고 + 종료 |
| `spec` | spec 결함 **또는 SPEC-DRIFT(구현이 spec 을 의도적으로 개선해 spec 이 낡음)**. `/consistency-check --spec <NEEDS_SPEC>` 실행 → BLOCK:NO 시 spec 반영 + commit, resolution-applier 재호출 (동일 session_dir). BLOCK:YES 시 사용자 escalate. SPEC-DRIFT 는 코드를 되돌리지 않고 spec 만 갱신하는 정식 역류 경로다 |
| `user-decision` / `infra` / `e2e-fail-3x` / `sensitive-fix` | `AskUserQuestion` 으로 사유·옵션 제시. 사용자 결정 후 resolution-applier 재호출 또는 부분 RESOLUTION 종료 |
| `rate_limit` / `network` (STATUS 자체) | ScheduleWakeup 으로 재예약 — wake 시 resolution-applier 같은 session_dir 로 재호출 (idempotency 로 복구) |
| `fatal` | RESOLUTION 부분 + 사유 사용자 보고 |

> **idempotency**: resolution-applier 가 중간 종료돼도 `_resolution_state.json` + git log + RESOLUTION.md 로 복구. main 은 같은 session_dir 로 재호출만 하면 된다.

### 7. /loop 결합 (fallback 경로 + resolution-applier 한도 복구)

Workflow 경로(§2)는 한 번에 완주하거나 `unfinished[]` 를 반환한다. cross-turn quota 자동 재시도가 필요한 경우는 **fallback 수동 Agent 경로** 또는 **§6 resolution-applier 의 rate_limit/network 재예약**에서 처리:

- 첫 사이클(fallback): 사용자 인자(`/ai-review --staged` 등) 로 step 1 `--prepare`. session_dir 기록.
- wake 사이클(fallback): prompt 안의 `--resume <session_dir>` 로 orchestrator 호출 → fallback fan-out. `routing=done` 이면 router 재호출 skip.
- §6 resolution-applier 가 `rate_limit/network` STATUS 면 ScheduleWakeup 재예약(같은 session_dir, idempotency 복구).
- 자연 종료: SUMMARY 완료 + resolution-applier ESCALATE=no → ScheduleWakeup 미호출 → /loop 종료.

## Reviewer 매트릭스 (디폴트 14)

| sub-agent type | 핵심 관점 | 영역 무관 시 NONE 가능 |
|---|---|---|
| `security-reviewer` | 인젝션, 시크릿, 인증/인가, OWASP Top 10 | |
| `performance-reviewer` | 알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O | |
| `architecture-reviewer` | SOLID, 결합도, 레이어 책임, 순환 의존성 | |
| `requirement-reviewer` | 기능 완전성, 엣지 케이스, 의도-구현 괴리, **관련 spec 본문 일치 여부** | |
| `scope-reviewer` | 의도 이상 변경, 불필요 리팩토링 | |
| `side-effect-reviewer` | 의도치 않은 상태 변경, 시그니처 변경 | |
| `maintainability-reviewer` | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버 | |
| `testing-reviewer` | 테스트 존재, 커버리지, 엣지 케이스 | |
| `documentation-reviewer` | docstring, README, API 문서, 주석 정확성 | |
| `dependency-reviewer` | 새 의존성, 버전 고정, 라이선스, 취약점 | |
| `database-reviewer` | 인덱스, N+1, 트랜잭션, 마이그레이션 | ✓ |
| `concurrency-reviewer` | 경쟁 조건, 데드락, async/await | ✓ |
| `api-contract-reviewer` | 하위 호환성, 응답/에러 형식 | ✓ |
| `user-guide-sync-reviewer` | PROJECT.md §변경 시 동반 갱신 매트릭스 기반 docs MDX·i18n dict·backend-labels 동반 갱신 누락 검출. 매트릭스 부재 프로젝트는 `agents.reviewers.user_guide_sync: false` 권장 | ✓ |

`database` · `concurrency` · `api-contract` · `user_guide_sync` 는 해당 없는 코드면 "해당 없음 / 위험도 NONE" 으로 success 반환.

## 환경변수

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `REVIEW_AGENTS` | (project_config 통과 후 전체) | 실행할 reviewer 쉼표 구분. 설정 시 router 자동 skip + project_config 토글보다 우선 (일회성 override). |
| `REVIEW_OUTPUT_DIR` | `./review/code` | 세션 디렉토리 부모 |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 |
| `REVIEW_MAX_FILE_SIZE` | `51200` | 개별 파일 컨텐츠 상한 (자) |
| `REVIEW_MAX_PROMPT_SIZE` | `131072` | reviewer 1명분 prompt body 상한 (자) |
| `REVIEW_BATCH_SIZE` | `50` | 한 세션 당 파일 상한 (초과 시 batch 분할) |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 wake delay |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

세부 운영 가이드 (router safety 매트릭스·디버그 로그 위치): `./README.md`.
