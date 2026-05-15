---
name: code-review-agents
description: 13개의 역할 기반 sub-agent(`<role>-reviewer`)를 main Claude 가 Agent tool 로 병렬 호출해 코드 리뷰를 수행합니다. 사용자가 "코드 리뷰", "ai-review", "변경사항 검토/점검", "보안/성능 리뷰" 를 요청하거나, 기능 구현·리팩토링 완료 후 품질 검증이 필요할 때, 또는 특정 커밋/브랜치/파일에 대한 다각도 리뷰가 필요할 때 사용합니다. 사용량 한도가 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도합니다.
---

# Code Review Agents

13개의 전문 관점 sub-agent 가 격리된 컨텍스트에서 병렬로 리뷰를 수행하고, 결과를 통합 보고서로 묶습니다. 모든 model 호출은 main Claude(현재 session) 가 `Agent` tool 로 직접 invoke 합니다 — `claude -p` 와 Anthropic SDK 직접 호출은 요금제 정책상 사용 불가합니다.

## 언제 사용하는가

- 사용자가 "코드 리뷰해줘", "ai-review 실행해줘", "이 변경사항 검토해줘" 를 요청할 때
- 기능 구현·버그 수정·리팩토링 완료 직후 품질 검증이 필요할 때
- 특정 커밋·브랜치·파일·디렉토리에 대한 다각도 검토가 필요할 때
- 특정 관점만 점검할 때 (환경변수 `REVIEW_AGENTS` 로 선별)

## 실행 절차 (main Claude 가 따른다)

### 0. 사전 점검

- 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.

### 1. 세션 준비 (Python helper, model 호출 없음)

첫 사이클(또는 /loop 밖):

```bash
# /loop 밖
python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --prepare $ARGUMENTS

# /loop 안 — loop_mode=true 로 초기화하려면 env prefix
AI_REVIEW_LOOP=1 python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --prepare $ARGUMENTS
```

`/loop /ai-review --resume <session_dir>` 처럼 wake 후 재진입할 때는 prepare 가 아니라 resume:

```bash
python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --resume <session_dir>
```

resume 는 세션을 새로 만들지 않고 `<session_dir>/_retry_state.json` 의 존재만 검증한 뒤 그 경로를 stdout 으로 echo 한다. 누락이면 exit code 1.

`--prepare` 가 기본 모드. `--cli` 도 deprecated alias.

옵션은 다음과 같다 (기존과 동일):
- 인자 없음 → git diff (staged + unstaged + untracked)
- `--staged`, `--commit <ref>`, `--range <a>..<b>`, `--branch <base>`, 파일/디렉토리 경로

orchestrator 가 만드는 결과:
- `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<role>.md` — reviewer 별 role-specific 입력 페이로드 (관점·체크리스트·변경 컨텐츠 결합. role 마다 내용이 다름)
- `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json` — 재시도/상태 파일
- `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json` — 세션 메타데이터
- stdout 마지막 줄(들) = 세션 디렉토리 절대경로 (batch 별로 한 줄씩)

### 2. 상태 파일 로드

세션 디렉토리의 `_retry_state.json` 을 Read. 주요 필드:
- `subagent_invocations[]` — `{name, subagent_type, prompt_file, output_file}` 목록.
- `agents_pending`, `agents_success`, `agents_fatal`.
- `summary_subagent_type`, `summary_output_file`.
- `loop_mode`, `last_reset_hint_sec`, `rate_limit_episodes`.

### 3. 병렬 sub-agent 호출

`agents_pending` 의 각 reviewer 에 대해 **한 응답 안에서** 여러 `Agent` tool 호출을 동시에 보낸다. 각 호출 인자:

- `subagent_type` = invocation 의 `subagent_type` 값 (예: `security-reviewer`)
- `description` = 짧은 한 줄
- `prompt` = 두 줄, KEY=VALUE 형식:
  ```
  prompt_file=<invocation.prompt_file>
  output_file=<invocation.output_file>
  ```

sub-agent 는 자기 system prompt 의 호출 규약대로 prompt_file 을 Read, 분석 결과를 output_file 에 Write, main 에게는 한 줄만 return.

### 4. 결과 파싱

각 sub-agent return value 의 정상 형식:
```
STATUS=<success|rate_limit|network|fatal> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>
```

**파싱 규칙**: 응답 텍스트 전체에서 정규식 `^STATUS=(\S+)\s+ISSUES=(\d+)\s+PATH=(\S+)(?:\s+RESET_HINT=(\d+)?)?$` 의 **마지막 매칭** 을 STATUS 라인으로 사용. 본문 + STATUS 두 줄 응답에도 안전.

분류:
- `success` → `agents_success` 로 이동. **단** `PATH` 가 가리키는 `output_file` 이 존재하지 않거나 비어 있으면 보수적으로 `fatal` 로 강등 (성공 거짓 보고 방어).
- `fatal` → `agents_fatal` 로 이동 (재시도하지 않음).
- `rate_limit`, `network` → `agents_pending` 에 유지. `rate_limit` 인 경우 `rate_limit_episodes += 1`. `RESET_HINT` 가 있으면 `last_reset_hint_sec` 에 갱신 (여러 reviewer 의 hint 중 **최대값** — 가장 늦게 풀리는 한도 기준 안전 마진).

**STATUS 라인 미수신 시 (fallback)**: sub-agent 가 한도/네트워크 오류로 본인 응답을 끝맺지 못한 경우, STATUS 정규식 매칭이 없거나 truncated/error 응답이 그대로 main 에 돌아온다. 이때 main 은 응답 전체 텍스트를 다음 키워드로 분류한다:
- rate-limit 패턴: `Claude AI usage limit`, `rate.?limit`, `rate_limit_exceeded`, `too many requests`, `quota`, `5-hour limit`, `try again in`, `\b429\b`
- network 패턴: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EHOSTUNREACH`, `could not resolve`, `connection refused/reset`, `TLS handshake`, `socket hang up`, `overloaded_error`, `service unavailable`, `bad gateway`, `gateway timeout`, `\b50[234]\b`, `APIConnectionError`, `fetch failed`

매칭되면 해당 분류로 pending 유지. 둘 다 안 맞으면 보수적으로 `rate_limit` 로 분류 (재시도 안전). 단, 같은 reviewer 가 3회 연속 STATUS 미수신이면 `fatal` 로 강등 (operator 개입 신호).

### 5. 상태 갱신

`_retry_state.json` 을 위 결과로 갱신해 Write 로 덮어쓴다. 매 사이클마다 갱신할 필드:

- `agents_pending` / `agents_success` / `agents_fatal` — 분류 결과로 재구성.
- `agent_history[<name>]` — 이번 시도 기록 append (`{ts, status, reset_hint_sec}`).
- `rate_limit_episodes` — rate_limit 분류된 agent 수만큼 증가.
- `last_reset_hint_sec` — 이번 사이클의 rate_limit RESET_HINT 중 최대값 (없으면 null 유지).
- ScheduleWakeup 호출 직전: `wake_history.append({ts, delay_sec, reason})`, `total_wait_sec += delay_sec`.

### 6. 수렴 분기

- **모두 완료** (`agents_pending` 가 빔):
  1. `Agent(subagent_type="code-review-summary", prompt="session_dir=<session_dir>")` invoke. summary sub-agent 가 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` 들을 Read 해 통합한 후 `summary_output_file` (= `<session_dir>/SUMMARY.md`) 에 Write 한다.
  2. summary 의 STATUS 도 동일 규약. `rate_limit/network` 이면 summary 도 재시도 대상 (별도 pending 표기).
  3. SUMMARY.md 생성 완료 후 사용자에게 1-2 문단 요약 + 세션 경로 출력.
- **남고 `loop_mode=true`**: `ScheduleWakeup(delay=last_reset_hint_sec or 1800, prompt="/loop /ai-review --resume <session_dir>", reason="rate-limit retry for <N> agents")` 호출 + "한도 N개 agent 재시도 예약 (Xs 후)" 한 줄 출력 후 turn 종료. wake prompt 에 `--resume <session_dir>` 절대경로를 그대로 박아 두면 wake 시점에 어떤 세션을 재개할지 모호함이 없다.
- **남고 `loop_mode=false`**: code-review-summary 를 partial 호출 (pending 항목을 "재시도 필요" 로 명시). 사용자에게 `/loop /ai-review` 로 재시작 안내.

### 7. /loop 결합

`/loop /ai-review` 가 호출되면 main 은 dynamic mode 안에서 위 1-6 사이클을 반복한다.

- **첫 사이클**: 사용자의 원래 인자(`/ai-review --staged` 등) 를 그대로 받아 step 1 의 prepare 명령 실행. 출력된 session_dir 을 기록.
- **wake 사이클**: ScheduleWakeup prompt 가 `/loop /ai-review --resume <session_dir>` 형태로 발화된다. main 은 step 1 의 prepare 명령 대신 `--resume <session_dir>` 명령으로 orchestrator 호출 → 그 session_dir 만 echo. step 2 (`_retry_state.json` Read) 부터 진입.
- **자연 종료**: pending 이 비면 summary 호출 후 ScheduleWakeup 미호출 → /loop 자동 종료.

## 13개 reviewer sub-agent

| sub-agent type | 핵심 관점 |
|----------------|-----------|
| `security-reviewer` | 인젝션, 하드코딩 시크릿, 인증/인가, OWASP Top 10 |
| `performance-reviewer` | 알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O |
| `architecture-reviewer` | SOLID, 결합도, 레이어 책임, 순환 의존성 |
| `requirement-reviewer` | 기능 완전성, 엣지 케이스, 의도-구현 괴리 |
| `scope-reviewer` | 의도 이상 변경, 불필요한 리팩토링, 무관 수정 |
| `side-effect-reviewer` | 의도치 않은 상태 변경, 전역 변수, 시그니처 변경 |
| `maintainability-reviewer` | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버, 중복 |
| `testing-reviewer` | 테스트 존재, 커버리지 갭, 엣지 케이스, mock 적절성 |
| `documentation-reviewer` | docstring, README, API 문서, 주석 정확성 |
| `dependency-reviewer` | 새 의존성, 버전 고정, 라이선스, 취약점 |
| `database-reviewer` | 인덱스, N+1, 트랜잭션, 마이그레이션 안전성 |
| `concurrency-reviewer` | 경쟁 조건, 데드락, 동기화, async/await |
| `api-contract-reviewer` | 하위 호환성, 버전 관리, 응답/에러 형식 |

> `database-reviewer`, `concurrency-reviewer`, `api-contract-reviewer` 는 해당 없는 코드면 "해당 없음, 위험도 NONE" 으로 결과를 작성하고 `STATUS=success ISSUES=0` 으로 반환합니다.

## 사용량 한도 처리 정책

요금제 정책상 외부 LLM 호출(`claude -p`, Anthropic SDK) 이 모두 차단되었기 때문에, 모든 model 호출은 main session 의 한도를 공유한다. 한도가 걸리면:

1. sub-agent 가 한도 메시지를 받고 `STATUS=rate_limit RESET_HINT=<sec>` 를 그대로 보고한다 (임의 우회 금지).
2. main 이 위 4번 단계에서 분류 후 pending 에 유지.
3. `/loop /ai-review` 안이라면 ScheduleWakeup 으로 RESET_HINT 만큼 대기 후 재진입.
4. /loop 밖이라면 partial SUMMARY 작성 후 사용자에게 `/loop /ai-review` 안내.

네트워크 오류(`STATUS=network`) 도 동일하게 재시도 대상. 차이는 RESET_HINT 가 보통 없다는 것 — 이때 ScheduleWakeup delay 는 `RETRY_WAKE_DEFAULT_SEC` (1800s) 사용.

## 환경변수

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `REVIEW_AGENTS` | (전체 13) | 실행할 reviewer 쉼표 구분 (예: `security,performance`) |
| `REVIEW_OUTPUT_DIR` | `./review/code` | 세션 디렉토리 부모 (nested ISO 분할은 lib.session 이 담당) |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 (예: `md,txt,json`) |
| `REVIEW_MAX_FILE_SIZE` | `51200` | 개별 파일 컨텐츠 상한 (자) |
| `REVIEW_MAX_PROMPT_SIZE` | `131072` | reviewer 1명분 prompt body 상한 (자) |
| `REVIEW_BATCH_SIZE` | `50` | 한 세션 당 파일 상한 (초과 시 batch 분할) |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true 로 초기화 (slash command 가 자동 설정) |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 (ScheduleWakeup runtime cap) |

> `REVIEW_MODEL`, `REVIEW_TIMEOUT`, `DISABLE_CODE_REVIEW`, `RETRY_DISABLED`, `RATE_LIMIT_PATTERNS`, `NETWORK_PATTERNS` 는 옛 subprocess 모드의 유산으로 더 이상 동작하지 않는다. 모델/타임아웃은 각 sub-agent definition 의 `model` 필드와 Claude Code 의 Agent tool 동작에 위임.

## 세부 문서

운영 가이드(빠른 시작, `_retry_state.json` 스키마, 디버그 로그 위치, /loop 사용법 등)는 `./README.md` 를 참고하세요.
