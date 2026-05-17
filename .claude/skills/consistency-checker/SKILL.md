---
name: consistency-checker
description: spec / plan / 구현 착수 직전에 기존 문서들과의 위배를 사전에 검출하는 다관점 일관성 검토자입니다. 사용자가 "consistency check", "정합성 점검", "사전 검토", "spec 충돌 확인", "/consistency-check" 를 호출하거나, project-planner 가 `spec/` 에 쓰기 전, developer 가 구현에 착수하기 전에 의무 호출됩니다. 5개의 sub-agent(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision)를 main Claude 가 Agent tool 로 병렬 호출하며, Critical 위배 발견 시 spec write·구현 착수를 차단합니다. 사용량 한도 시 `/loop /consistency-check` 와 결합해 ScheduleWakeup 으로 무한 재시도.
---

# Consistency Checker

spec / plan / 구현 변경이 **저장되기 전** 단계에서, 기존 문서들과 위배되는 지점을 사전에 검출하는 다관점 검토자다. 사후 코드 리뷰(`ai-review`)와 달리 **결정이 박히기 전 단계**에서 동작한다.

모든 model 호출은 main Claude(현재 session) 가 `Agent` tool 로 5개 checker sub-agent 를 invoke 하는 방식이다 — `claude -p` 와 Anthropic SDK 직접 호출은 요금제 정책상 사용 불가.

## 절대 원칙

- **사전 검출**: target 문서가 디스크에 쓰이기 전에 호출되는 것이 정상 동선. 사후 호출도 가능하지만 차단력은 호출 시점에 달려있다.
- **Critical = 차단**: Critical 등급 위배가 1건이라도 발견되면 호출자는 즉시 멈춘다. main 이 SUMMARY.md 의 `BLOCK: YES` 표기를 검출해 호출자(planner/developer/사용자) 에게 보고하고 해결 방안을 결정한 뒤 재실행.
- **출력은 markdown**: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 가 단일 결과 진입점. 5개 checker 의 상세는 같은 디렉토리의 `<checker>.md`.
- **재진입성**: 같은 검토를 여러 번 돌려도 부수 효과가 없다 (산출물 디렉토리만 누적). plan/spec 을 자동 수정하지 않는다.

## 5개 Checker sub-agent

| sub-agent type | 검출 대상 |
| --- | --- |
| `cross-spec-checker` | 다른 영역 spec 의 데이터 모델·API 계약·요구사항 ID 와의 충돌 |
| `rationale-continuity-checker` | 과거 Rationale 에서 기각·폐기된 결정의 재도입 |
| `convention-compliance-checker` | `spec/conventions/**` 정식 규약 위반 (예: 출력 포맷·API 문서 패턴) |
| `plan-coherence-checker` | `plan/in-progress/**` 의 미해결 결정·후속 항목·worktree 충돌 |
| `naming-collision-checker` | 신규 식별자(요구사항 ID, 엔드포인트, 엔티티명 등)의 기존 사용처 중복 |

summary: `consistency-summary` sub-agent 가 5개 결과를 통합해 SUMMARY.md 작성, `BLOCK: YES/NO` 를 상단에 박는다.

## 실행 절차 (main Claude 가 따른다)

### 0. 사전 점검

현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내.

### 1. 세션 준비 (Python helper, model 호출 없음)

```bash
# /loop 밖
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py [옵션]

# /loop 안 — loop_mode=true 로 초기화하려면 env prefix
AI_REVIEW_LOOP=1 python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py [옵션]

# wake 사이클 — 새 세션 만들지 않고 기존 세션 재진입
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --resume <session_dir>
```

모드는 첫 호출에서 택일 필수 (`--resume` 이 없을 때):
- `--spec <path>` — spec draft (예: `plan/in-progress/spec-draft-<area>.md`). project-planner 의 `spec/` 쓰기 직전 의무.
- `--plan <path>` — plan draft.
- `--impl-prep <scope>` — 구현 착수 직전. scope = spec 영역 경로.

`--resume <session_dir>` 은 위 모드들과 mutually exclusive — wake 후 동일 세션의 `_retry_state.json` 만 검증 후 그 경로를 stdout 으로 echo. 누락 시 exit code 1.

orchestrator 가 만드는 결과:
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<checker>.md` — checker 별 role-specific 페이로드 (관점·체크리스트·target 문서·보조 코퍼스 결합. checker 마다 다름).
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json` — 재시도/상태 파일.
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json` — mode / target_path / checker 명단.
- stdout 마지막 줄 = 세션 디렉토리 절대경로.

### 2. 상태 파일 로드

`<session_dir>/_retry_state.json` 을 Read. 필드는 ai-review 와 동일 스키마.

### 3. 병렬 sub-agent 호출

`agents_pending` 의 각 checker 에 대해 **한 응답 안에서** 여러 `Agent` tool 호출을 동시에 보낸다. prompt 형식은 ai-review 와 동일 (`prompt_file=...`, `output_file=...`).

### 4. STATUS 파싱·상태 갱신

`STATUS=success|rate_limit|network|fatal` 한 줄 반환. ai-review 의 [SKILL.md 단계 4](../code-review-agents/SKILL.md) 와 동일한 분류 규약 — 정규식 마지막 매칭, output_file 존재 확인, STATUS 미수신 시 키워드 fallback, `_retry_state.json` 의 `agents_pending/success/fatal`·`agent_history`·`rate_limit_episodes`·`last_reset_hint_sec`·`wake_history`·`total_wait_sec` 갱신.

### 5. 수렴 분기

- **모두 완료**:
  1. `Agent(subagent_type="consistency-summary", prompt="session_dir=<session_dir>")` invoke. summary sub-agent 가 자기 컨텍스트에서 `_retry_state.json` → 5 checker 의 `output_file` 들을 Read 해 통합한 후 `summary_output_file` 에 Write.
  2. summary 완료 후 SUMMARY.md 상단 30 라인을 Read 해 `BLOCK: YES` 검출 → 호출자에게 보고.
- **남고 `loop_mode=true`**: `ScheduleWakeup(delay=last_reset_hint_sec or 1800, prompt="/loop /consistency-check --resume <session_dir>", reason="rate-limit retry for <N> checkers")` 후 turn 종료. wake prompt 에 `--resume <session_dir>` 을 박아 두면 다음 wake 가 어떤 세션을 재개할지 모호함이 없다. 첫 호출의 모드(--spec/--plan/--impl-prep) 인자는 더 이상 필요 없다 (`_retry_state.json` 이 이미 invocation 목록을 가지고 있음).
- **남고 `loop_mode=false`**: partial summary 시도 (한도 걸리면 그대로 표시), 사용자에게 `/loop /consistency-check` 안내.

### 6. BLOCK 처리

SUMMARY.md 의 `BLOCK: YES` 가 발견되면:
- `developer` 안에서 호출됐다면 → 구현 진입을 즉시 중단하고 사용자에게 BLOCK 사유를 보고.
- `project-planner` 안에서 호출됐다면 → `spec/` 쓰기를 중단.
- 직접 사용자가 호출했다면 → SUMMARY.md 핵심을 보여주고 결정 요청.

## 호출자 워크플로 (planner / developer)

### project-planner

1. spec 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 작성 (디스크의 `spec/` 직접 수정 금지).
2. `/consistency-check --spec plan/in-progress/spec-draft-<name>.md` 호출.
3. SUMMARY.md `BLOCK: NO` 일 때만 `spec/` 본문에 반영. `BLOCK: YES` 면 즉시 멈춤.
4. Warning 은 RESOLUTION 노트를 같은 spec 의 `## Rationale` 섹션에 남긴 뒤 진행.

### developer

1. `/consistency-check --impl-prep <spec/영역경로>` 를 구현 착수 전 호출.
2. `BLOCK: YES` 면 `project-planner` 또는 사용자에게 위임. 구현 진입 금지.
3. Warning 은 `plan/in-progress/<task>.md` 에 기록하고 진행하되, 구현 결과로 해소되는지 자가 점검.

## 결과 확인 절차

1. orchestrator 출력에서 세션 디렉토리 경로(`./review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 받기.
2. 위 절차 2-6 진행 후 SUMMARY.md 를 사용자에게 1-2문단으로 요약.
3. Critical 항목은 각 checker 의 `<checker>.md` 에서 상세 근거 참고.
4. 조치 결과는 호출자(planner/developer)가 자기 워크플로의 RESOLUTION/Rationale 에 기록.

## 사용량 한도 처리 정책

ai-review 와 동일. sub-agent 가 `STATUS=rate_limit RESET_HINT=<sec>` 를 보고 → main 이 pending 유지 → `/loop` 안이면 ScheduleWakeup, 밖이면 partial 종료.

## 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONSISTENCY_AGENTS` | (전체 5) | 실행할 checker 쉼표 구분 (예: `cross_spec,naming_collision`) |
| `CONSISTENCY_OUTPUT_DIR` | `./review/consistency` | 결과 디렉토리 |
| `CONSISTENCY_MAX_CONTEXT_SIZE` | `262144` | checker 1명분 prompt body 상한 (자) |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true (slash command 가 자동 설정) |
| `DISABLE_CONSISTENCY_CHECK` | `0` | `1` 이면 orchestrator 자체 비활성화 |

> `CONSISTENCY_MODEL`, `CONSISTENCY_TIMEOUT` 은 옛 subprocess 모드의 유산으로 더 이상 동작하지 않는다. model/timeout 은 각 sub-agent definition 의 `model` 필드와 Claude Code 의 Agent tool 동작에 위임.

## code-review-agents 와의 관계

본 skill 은 `.claude/skills/code-review-agents/lib/session` 만 import 한다 (세션 디렉토리 / meta.json / truncation 헬퍼). 옛 `agent_runner`·`summary` 모듈은 두 skill 모두에서 삭제되었다. 동일한 `_retry_state.json` 스키마와 sub-agent 호출 규약을 공유한다.
