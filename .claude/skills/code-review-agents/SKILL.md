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
- 특정 관점만 점검할 때 (환경변수 `REVIEW_AGENTS` 로 선별, 또는 자동 선별 — 기본 `--route=auto`)
- 전수 감사가 필요할 때 (`--route=all` 로 router skip)

## 실행 절차 (main Claude 가 따른다)

### 0. 사전 점검

- 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.

### 1. 세션 준비 (Python helper, model 호출 없음)

첫 사이클(또는 /loop 밖):

```bash
# /loop 밖
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS

# /loop 안 — loop_mode=true 로 초기화하려면 env prefix
AI_REVIEW_LOOP=1 python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS
```

`/loop /ai-review --resume <session_dir>` 처럼 wake 후 재진입할 때는 prepare 가 아니라 resume:

```bash
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --resume <session_dir>
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
- `agents_pending`, `agents_success`, `agents_fatal`, `agents_skipped`.
- `agents_forced` — router_safety 강제 포함 (router 가 끄지 못함).
- `router_subagent_type`, `router_output_file`, `routing_status` (`pending` / `done` / `skipped`), `routing_skip_reason`.
- `summary_subagent_type`, `summary_output_file`.
- `loop_mode`, `last_reset_hint_sec`, `rate_limit_episodes`.

### 2.5. 라우터 호출 (routing_status=="pending" 일 때만, 첫 사이클에서 1회)

`--route=auto` (기본) 동작이다. `routing_status` 가 `skipped` 또는 `done` 이면 건너뛴다 (resume 사이클에서 자동 skip).

1. **단일 호출**: `Agent(subagent_type="review-router", prompt="prompt_file=<router_prompt_file>\noutput_file=<router_output_file>")` 한 번만. 병렬 fan-out 아님. 인자는 `_retry_state.json` 의 동명 필드 값을 그대로 사용 (reviewer 호출과 동일 KEY=VALUE 패턴).
2. **응답 파싱**: STATUS 한 줄. 정상이면 `router_output_file`(= `_routing_decision.json`) 이 생성되어 있다.
3. **분류 + 적용**:
   - `STATUS=success` → `_routing_decision.json` Read. `decisions[].selected==false` 인 reviewer 들을 `agents_pending` 에서 제거해 `agents_skipped` 로 옮긴다. `agents_forced` 에 있는 reviewer 는 무조건 `agents_pending` 유지 (router definition 이 강제하지만 main 에서도 한 번 더 확인).
   - **선택된 수 가드**:
     - filter 후 `agents_pending` 이 **0 명** 이면 → 이 변경에 적용 가능한 reviewer 가 없음 (미분류 파일만 변경된 케이스). 13명 fallback **하지 않고** minimal SUMMARY.md 작성 후 종료 — 본문에 변경 파일 목록 + "이 변경에는 적용 가능한 reviewer 가 없음. 분류 가능 카테고리(소스/패키지/문서/마이그레이션/API 스펙/spec 본문) 어디에도 매칭되지 않음." 명시. code-review-summary sub-agent 호출 없이 main 이 직접 작성 (의미 있는 reviewer 결과가 0 이라 통합할 게 없음).
     - 1명 이상이면 그대로 step 3 으로 진행 (router 가 그 reviewer 만 의미있다고 본 것이라 신뢰).
   - `STATUS=fatal` 이고 `_routing_decision.json` 이 "no applicable reviewer" 사유 — 즉 router 가 자체 가드로 0명 fatal 한 케이스 — 위와 동일하게 minimal SUMMARY 작성 후 종료.
   - `STATUS=fatal` 그 외 (router 자체 오류 — prompt_file 부재, JSON 직렬화 실패 등) → router 결정 폐기 + 전체 reviewer fallback. `routing_status="skipped"` + `routing_skip_reason="router fatal: <문구>"`.
   - `STATUS=rate_limit` 또는 `STATUS=network` → router 자체를 retry 대상으로. `routing_status` 는 `pending` 유지. `/loop` 안이면 ScheduleWakeup 으로 재시도, 밖이면 한도 안내 후 partial.
4. **상태 저장**: 정상 / fallback 처리 후 `routing_status="done"` 으로 갱신하고 `_retry_state.json` Write. resume 사이클에서 router 가 재호출되지 않는다.

> router 는 reviewer 와 동일한 context 정책으로 동작한다 — `_prompts/_router.md` 에 변경 코드 전체(diff + 파일 컨텐츠) + 13 reviewer 의 관점 + agents_forced 목록이 들어가며, router 는 자유롭게 Read/Grep/Glob/Bash 로 추가 탐색한다. 모델만 haiku 다.
>
> **강제 포함 정책 (router safety) 매트릭스**는 `.claude/skills/code-review-agents/README.md` 의 "Router safety policy" 절 또는 `lib/router_safety.py` 의 module docstring 참고. 코드(`_RULES`/패턴 상수) 가 SSOT.

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

- **첫 사이클**: 사용자의 원래 인자(`/ai-review --staged` 등) 를 그대로 받아 step 1 의 prepare 명령 실행. 출력된 session_dir 을 기록. 이 사이클에서만 router 가 호출된다 (step 2.5).
- **wake 사이클**: ScheduleWakeup prompt 가 `/loop /ai-review --resume <session_dir>` 형태로 발화된다. main 은 step 1 의 prepare 명령 대신 `--resume <session_dir>` 명령으로 orchestrator 호출 → 그 session_dir 만 echo. step 2 (`_retry_state.json` Read) 부터 진입. **`routing_status` 가 이미 `done` 이므로 step 2.5 는 자동 skip** — router 는 첫 사이클에서만 실행되며 pending 잔존이 줄어들 뿐이다.
- **자연 종료**: pending 이 비면 summary 호출 후 ScheduleWakeup 미호출 → /loop 자동 종료.

### 8. 자동 후속 흐름 (SUMMARY → 이슈 해결 → e2e → 재리뷰)

리뷰가 끝나고 SUMMARY.md 가 작성되면 main 이 **자동으로** 이슈 해결까지 진행한다 (사용자 결정: 완전 자동). 단 무한 루프와 잘못된 자동 수정을 막기 위한 가드는 적용한다.

`SUMMARY.md` 의 발견사항이 모두 `NONE / INFO` 만이면 본 단계는 skip (RESOLUTION 만 작성 후 종료). Critical / WARNING 이 1건 이상이면 진입:

#### 8.1 분류

각 발견사항을 다음 두 부류로 분류:

- **spec 관련**: 요구사항 ID / API 계약 / Rationale / convention 위반 / spec 문서 자체의 누락. `project-planner` skill 의 책임 영역.
- **코드 관련**: 구현 버그 / 테스트 누락 / 리팩토링 / 의존성 / 성능 / 보안 / DB / 동시성. `developer` skill 의 책임 영역.

main 은 별도 sub-agent 위임 없이 **자기 turn 안에서** 두 skill 의 절차를 직접 수행한다. (sub-agent 격리는 분석 단계에 한정; 수정·테스트는 cwd 의 작업 worktree 안에서 main 이 직접 손대야 한다.)

#### 8.2 spec 관련 항목 처리 — `project-planner` 절차

1. 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 draft 로 작성.
2. `/consistency-check --spec plan/in-progress/spec-draft-<name>.md` 자동 호출.
3. SUMMARY.md 의 `BLOCK: NO` 일 때만 `spec/` 본문에 반영. `BLOCK: YES` 면 자동 진행을 멈추고 사용자에게 보고 (안전 가드 — spec 의 의미 변경은 사용자 결정 영역).
4. spec 변경 commit (`docs(spec): <SUMMARY 항목>`).

#### 8.3 코드 관련 항목 처리 — `developer` 절차

1. 변경 대상 파일·테스트 식별.
2. 코드 수정 + 필요한 단위 테스트 추가.
3. **type check + 단위 테스트** 실행 (작업 영역에 맞춰 `npm test`, `npm run typecheck`, `make ...`).
4. 수정 commit (`fix(<area>): <SUMMARY 항목>` 또는 `refactor(<area>): ...`).

#### 8.4 로컬 e2e 의무 실행 (skip 절대 금지)

모든 Critical / Warning 항목 처리 후 **반드시 로컬에서** e2e 를 실행한다.

실제 명령·인프라는 `PROJECT.md §빌드·린트·테스트 명령` 참고 (예: `make e2e-test`, `make e2e-test-full`). 영역별 어느 명령을 쓸지의 분기 기준 (backend 만 / frontend 포함) 도 PROJECT.md 의 정의를 따른다.

**금지 사항** (자동 후속 흐름에서 e2e 우회는 절대 허용 안 됨):

- **GitHub Action / CI 로 미루기 금지**. CI 가 같은 명령을 다시 실행하더라도 그것은 본 흐름의 검증을 대체하지 않는다. **push 전에 로컬 e2e 가 통과해야 RESOLUTION 단계 (8.6) 진입**.
- **`[skip-e2e]` 커밋 표기 사용 금지**. `developer/SKILL.md` 의 TEST WORKFLOW 도 `[skip-e2e]` **자체 발급을 금지**하며, 수동 흐름의 면제는 화이트리스트 또는 사용자 명시 승인 후 RESOLUTION 기록 형태로만 가능하다. /ai-review 자동 후속 흐름은 그보다 더 엄격해서 ai-review 가 fix 한 코드 변경은 무조건 e2e 통과로 검증해야 한다.
- **단위·통합 테스트로 대체 금지**. unit / integration / lint / typecheck 가 모두 통과해도 e2e 는 별개. multi-actor·인프라 회귀를 검출하는 유일한 안전망이다.
- **변경 영역이 작아 보여도 실행**. "UI 트윅이라 e2e 불필요" 같은 판단은 자동 흐름에서 금지. ai-review 가 fix 한 코드 변경이 있는 한 e2e 는 무조건 실행.

**예외** (단계 8.7 안전 가드로 이관):

- docker 인프라가 환경상 실행 불가 (e2e 시작 단계에서 명백한 환경 오류 — Docker daemon 미동작, 디스크 공간 부족 등). 이 경우 자동 진행 중단 + 사용자 보고. e2e 자체를 skip 하고 통과로 처리하는 것은 절대 금지.

e2e 통과 → 단계 8.6 진행.
e2e 실패 → 단계 8.5.

#### 8.5 e2e 실패 시 재시도 (최대 3회)

1. 실패 로그 (test output / docker logs) 를 분석해 원인 파악.
2. 원인이 직전 수정과 명확히 연결되면 추가 fix commit 후 e2e 재실행.
3. 원인이 모호하거나 직전 수정과 무관한 사전 결함이면 **자동 진행 중단** — 사용자에게 보고.
4. 누적 3회 실패하면 자동 진행 중단 후 사용자에게 보고.

이 단계의 이터레이션 카운트는 `_retry_state.json` 의 `auto_fix_iterations` 필드에 누적 (orchestrator 가 만든 필드는 아니지만 main 이 동적 추가).

#### 8.6 RESOLUTION.md 작성

성공 종료 시 `review/code/<...>/RESOLUTION.md` 에 `developer/SKILL.md` 의 **RESOLUTION.md mandatory schema** 를 그대로 따른다. 자동 흐름에서도 동일한 schema 가 적용된다 — 누락된 섹션이 있으면 8.6 이 끝난 것이 아니다.

자동 흐름 특수 규칙:

- `## TEST 결과` 의 e2e 줄은 자동 흐름에서 두 형식만 허용된다 — **통과** 또는 **자동 흐름 환경 차단** (단계 8.7 의 docker 인프라 실행 불가). "면제 (화이트리스트)" / "보류 (사용자 승인)" 은 수동 흐름 전용이며 자동 흐름에서는 8.4 의 "skip 절대 금지" 정책으로 인해 발급 불가.
- 환경 차단으로 보류한 경우, 자동 진행을 멈추고 사용자에게 `needs input:` 으로 환경 복구를 요청한다 (RESOLUTION 에 보류 표기 + 8.7 안전 가드 인용).
- 해결한 Critical / Warning 항목은 SUMMARY 의 #번호 와 매핑하여 `## 조치 항목` 에 기록.
- INFO 등급 중 별도 plan 으로 옮긴 항목은 `## 보류·후속 항목` 에 plan 경로 함께 기록.

#### 8.7 안전 가드 요약

자동 진행을 중단하고 사용자에게 보고하는 경우:

- consistency-check `--spec` 의 `BLOCK: YES` (8.2.3) — spec 의 의미 변경 결정.
- e2e 누적 3회 실패 (8.5).
- 직전 수정과 무관한 사전 결함 (8.5).
- **e2e 인프라가 실행 불가** — Docker daemon 미동작, 디스크 공간 부족, `PROJECT.md` 의 e2e 명령이 시작도 못 하는 환경 오류. e2e 자체 skip 은 금지이므로 이 경우만 자동 진행을 중단하고 사용자에게 환경 복구 요청.
- 자동 수정이 production 코드의 동작을 의도 이상으로 바꿀 위험이 큰 변경 (예: 데이터베이스 마이그레이션, 외부 API 계약 변경) — main 의 판단으로 보수적 차단.
- ai-review 가 SUMMARY 본문에서 명시적으로 "사용자 결정 필요" 표기한 항목.

자동 진행이 중단되면 main 은 SUMMARY 와 진행 상황을 사용자에게 1-2 문단으로 보고하고, 미해결 항목을 RESOLUTION.md 에 보류 상태로 기록.

**그 외 어떤 사유로도 e2e skip 은 불가**. `[skip-e2e]` / "변경 영역이 작아서" / "CI 가 처리할 것" / "단위 테스트로 충분" — 모두 자동 후속 흐름에서는 허용 안 됨.

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
| `REVIEW_AGENTS` | (전체 13) | 실행할 reviewer 쉼표 구분 (예: `security,performance`). **설정 시 review-router 자동 skip** (사용자 의도 우선). |
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
