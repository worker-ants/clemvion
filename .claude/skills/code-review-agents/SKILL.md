---
name: code-review-agents
description: 13개의 역할 기반 sub-agent(`<role>-reviewer`)를 main Claude 가 Agent tool 로 병렬 호출해 코드 리뷰를 수행합니다. 사용자가 "코드 리뷰", "ai-review", "변경사항 검토/점검", "보안/성능 리뷰" 를 요청하거나, 기능 구현·리팩토링 완료 후 품질 검증이 필요할 때 사용합니다. 사용량 한도가 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도합니다.
---

# Code Review Agents

13개의 전문 관점 reviewer sub-agent 가 격리 컨텍스트에서 병렬 리뷰를 수행하고, `code-review-summary` sub-agent 가 결과를 단일 SUMMARY.md 로 통합합니다. Critical/Warning 발견 시 `resolution-applier` sub-agent 가 자동으로 fix + e2e + RESOLUTION 까지 처리합니다 (사용자 결정이 필요한 순간만 main 으로 escalate).

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 실행 절차

### 0. 사전 점검

현재 worktree 확인 ([`.claude/docs/worktree-policy.md`](../../docs/worktree-policy.md)). main 워크트리에서 호출되면 worktree 안내 후 거부.

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

### 2. 세션 상태 한 줄 받기

```bash
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --summary-state <session_dir>
```

한 줄 형식: `pending=<n> success=<n> fatal=<n> routing=<status> last_reset=<sec|null>`. 분기 결정에 충분. 전체 `_retry_state.json` 은 sub-agent 들이 자기 ctx 로 Read (main 부담 X).

### 2.5. 라우터 호출 (`routing=pending` 일 때만, 첫 사이클)

`Agent(subagent_type="review-router", prompt="prompt_file=<router_prompt_file>\noutput_file=<router_output_file>")`. prompt_file·output_file 경로는 step 1 의 orchestrator 출력에 포함됨 (또는 `--summary-state` 의 확장 옵션으로).

라우터 응답 분기:

- `STATUS=success` → orchestrator 가 `--apply-routing <session_dir>` 로 state 갱신 (decisions JSON 적용 → pending/skipped 분류). 호출:
  ```bash
  python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --apply-routing <session_dir>
  ```
  selected 0명이면 `applied=0` echo — main 이 minimal SUMMARY 작성 후 종료.
- `STATUS=fatal` (router 가드 사유) → 동일하게 minimal SUMMARY.
- `STATUS=fatal` 그 외 → fallback (전체 reviewer 실행). orchestrator 가 `--apply-routing --fallback` 으로 처리.
- `STATUS=rate_limit/network` → ScheduleWakeup (loop 안), 또는 한도 안내 (loop 밖).

### 3. 병렬 reviewer 호출

`agents_pending` 의 각 reviewer 에 대해 **한 응답 안에서** 여러 `Agent` 호출. 각 호출:
- `subagent_type` = `<role>-reviewer`
- `prompt` = `prompt_file=<...>\noutput_file=<...>` (orchestrator 가 만든 경로 그대로)

### 4. STATUS 파싱·상태 갱신

각 응답의 STATUS 한 줄로 분류 (call-contract 정책). main 은 orchestrator 의 `--update <session_dir> --agent <name> --status <s> [--reset-hint <sec>]` 한 번 호출로 상태 파일을 갱신:

```bash
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --update <session_dir> --agent security --status success
```

JSON 직접 Read/Write 없음. STATUS 미수신 / 본문 응답 등 비정상 케이스는 main 이 fallback 분류 후 `--update --status rate_limit|network|fatal` 으로.

### 5. 수렴 분기

- **모두 완료** (pending=0):
  1. `Agent(subagent_type="code-review-summary", prompt="session_dir=<session_dir>")`. summary sub-agent 가 자기 ctx 로 reviewer 결과 통합 후 SUMMARY.md Write.
  2. SUMMARY.md 의 상단 30줄을 main 이 Read 해 전체 위험도 확인.
  3. Critical/Warning > 0 이면 §6 자동 후속 흐름 진입. 아니면 종료 + 사용자에게 1-2문장 보고.

- **남고 `loop_mode=true`**: `ScheduleWakeup(delay=last_reset or 1800, prompt="/loop /ai-review --resume <session_dir>", reason=...)` → turn 종료.

- **남고 `loop_mode=false`**: code-review-summary 를 partial 호출 후 사용자에게 `/loop /ai-review` 안내.

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
| `spec` | `/consistency-check --spec <NEEDS_SPEC>` 실행 → BLOCK:NO 시 spec 반영 + commit, resolution-applier 재호출 (동일 session_dir). BLOCK:YES 시 사용자 escalate |
| `user-decision` / `infra` / `e2e-fail-3x` / `sensitive-fix` | `AskUserQuestion` 으로 사유·옵션 제시. 사용자 결정 후 resolution-applier 재호출 또는 부분 RESOLUTION 종료 |
| `rate_limit` / `network` (STATUS 자체) | ScheduleWakeup 으로 재예약 — wake 시 resolution-applier 같은 session_dir 로 재호출 (idempotency 로 복구) |
| `fatal` | RESOLUTION 부분 + 사유 사용자 보고 |

> **idempotency**: resolution-applier 가 중간 종료돼도 `_resolution_state.json` + git log + RESOLUTION.md 로 복구. main 은 같은 session_dir 로 재호출만 하면 된다.

### 7. /loop 결합

- 첫 사이클: 사용자 인자(`/ai-review --staged` 등) 로 step 1 `--prepare`. session_dir 기록.
- wake 사이클: prompt 안의 `--resume <session_dir>` 로 orchestrator 호출 → step 2 부터. routing 이 `done` 이면 step 2.5 skip.
- 자연 종료: pending=0 + resolution-applier ESCALATE=no → ScheduleWakeup 미호출 → /loop 종료.

## 13개 reviewer 매트릭스

| sub-agent type | 핵심 관점 |
|---|---|
| `security-reviewer` | 인젝션, 시크릿, 인증/인가, OWASP Top 10 |
| `performance-reviewer` | 알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O |
| `architecture-reviewer` | SOLID, 결합도, 레이어 책임, 순환 의존성 |
| `requirement-reviewer` | 기능 완전성, 엣지 케이스, 의도-구현 괴리 |
| `scope-reviewer` | 의도 이상 변경, 불필요 리팩토링 |
| `side-effect-reviewer` | 의도치 않은 상태 변경, 시그니처 변경 |
| `maintainability-reviewer` | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버 |
| `testing-reviewer` | 테스트 존재, 커버리지, 엣지 케이스 |
| `documentation-reviewer` | docstring, README, API 문서, 주석 정확성 |
| `dependency-reviewer` | 새 의존성, 버전 고정, 라이선스, 취약점 |
| `database-reviewer` | 인덱스, N+1, 트랜잭션, 마이그레이션 |
| `concurrency-reviewer` | 경쟁 조건, 데드락, async/await |
| `api-contract-reviewer` | 하위 호환성, 응답/에러 형식 |

`database`, `concurrency`, `api-contract` 는 해당 없는 코드면 "해당 없음 / 위험도 NONE" 으로 success 반환.

## 환경변수

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `REVIEW_AGENTS` | (전체 13) | 실행할 reviewer 쉼표 구분. 설정 시 router 자동 skip. |
| `REVIEW_OUTPUT_DIR` | `./review/code` | 세션 디렉토리 부모 |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 |
| `REVIEW_MAX_FILE_SIZE` | `51200` | 개별 파일 컨텐츠 상한 (자) |
| `REVIEW_MAX_PROMPT_SIZE` | `131072` | reviewer 1명분 prompt body 상한 (자) |
| `REVIEW_BATCH_SIZE` | `50` | 한 세션 당 파일 상한 (초과 시 batch 분할) |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 wake delay |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

세부 운영 가이드 (router safety 매트릭스·디버그 로그 위치): `./README.md`.
