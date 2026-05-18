---
name: consistency-checker
description: spec / plan / 구현 착수 직전에 기존 문서들과의 위배를 사전에 검출하는 다관점 일관성 검토자입니다. 사용자가 "consistency check", "정합성 점검", "사전 검토", "spec 충돌 확인", "/consistency-check" 를 호출하거나, project-planner 가 `spec/` 에 쓰기 전, developer 가 구현에 착수하기 전에 의무 호출됩니다. 5개의 sub-agent(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision)를 main Claude 가 Agent tool 로 병렬 호출하며, Critical 위배 발견 시 spec write·구현 착수를 차단합니다. 사용량 한도 시 `/loop /consistency-check` 와 결합해 ScheduleWakeup 으로 무한 재시도.
---

# Consistency Checker

spec / plan / 구현 변경이 **저장되기 전** 단계에서 기존 문서들과의 위배를 사전 검출. 사후 코드 리뷰(`ai-review`)와 달리 **결정이 박히기 전** 동작.

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 절대 원칙

- **사전 검출**: target 문서 디스크 쓰기 전 호출이 정상.
- **Critical = 차단**: SUMMARY.md 상단 `BLOCK: YES` 면 호출자 즉시 멈춤.
- **출력은 markdown**: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 단일 결과 진입점.
- **재진입성**: plan/spec 자동 수정 안 함, 산출물 디렉토리만 누적.

## 5개 Checker

| sub-agent | 검출 대상 |
| --- | --- |
| `cross-spec-checker` | 다른 영역 spec 의 데이터 모델·API·요구사항 ID 충돌 |
| `rationale-continuity-checker` | 과거 Rationale 의 기각 결정 재도입 |
| `convention-compliance-checker` | `spec/conventions/**` 위반 |
| `plan-coherence-checker` | `plan/in-progress/**` 미해결 결정·worktree 충돌 |
| `naming-collision-checker` | 신규 식별자 기존 사용처 중복 |

summary: `consistency-summary` 가 통합 + `BLOCK: YES/NO` 표기.

## 실행 절차

### 0. 사전 점검
worktree 확인 ([`.claude/docs/worktree-policy.md`](../../docs/worktree-policy.md)).

### 1. 세션 준비

```bash
# /loop 밖
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py [옵션]
# /loop 안
AI_REVIEW_LOOP=1 python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py [옵션]
# wake 사이클
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --resume <session_dir>
```

모드 (첫 호출 — `--resume` 없을 때 택일):
- `--spec <path>` — spec draft (project-planner 의 `spec/` 쓰기 직전 의무).
- `--plan <path>` — plan draft.
- `--impl-prep <scope>` — 구현 착수 직전. scope = spec 영역 경로.

stdout 마지막 줄 = 세션 디렉토리.

### 2. 세션 상태 한 줄 받기

```bash
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --summary-state <session_dir>
```

한 줄: `pending=<n> success=<n> fatal=<n> last_reset=<sec|null>`. 분기 결정에 충분.

### 3. 병렬 sub-agent 호출

`agents_pending` 의 각 checker 에 대해 **한 응답 안에서** 여러 `Agent` 호출. prompt: `prompt_file=<...>\noutput_file=<...>` (orchestrator 가 만든 경로).

### 4. STATUS 파싱·상태 갱신

```bash
python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --update <session_dir> --agent <name> --status <s> [--reset-hint <sec>]
```

JSON 직접 Read/Write 안 함. fallback 분류 규약은 call-contract.

### 5. 수렴 분기

- **모두 완료**: `Agent(subagent_type="consistency-summary", prompt="session_dir=<session_dir>")`. summary 가 SUMMARY.md Write 후 main 은 상단 30줄 Read 해 `BLOCK: YES` 검출.
- **남고 `loop_mode=true`**: ScheduleWakeup → turn 종료.
- **남고 `loop_mode=false`**: partial summary + `/loop /consistency-check` 안내.

### 6. BLOCK 처리

`BLOCK: YES` 발견 시:
- `developer` 안 호출이면 → 구현 진입 중단.
- `project-planner` 안 호출이면 → `spec/` 쓰기 중단.
- 사용자 직접 호출이면 → 핵심 보여주고 결정 요청.

## 호출자 워크플로

**project-planner**:
1. spec 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 작성.
2. `/consistency-check --spec <path>` 호출.
3. `BLOCK: NO` 일 때만 `spec/` 반영. Warning 은 `## Rationale` 에 노트.

**developer**:
1. `/consistency-check --impl-prep <spec/영역>` 을 구현 착수 전.
2. `BLOCK: YES` → 위임. Warning 은 plan 에 기록 + 진행.

## 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONSISTENCY_AGENTS` | (전체 5) | 실행할 checker 쉼표 구분 |
| `CONSISTENCY_OUTPUT_DIR` | `./review/consistency` | 결과 디렉토리 |
| `CONSISTENCY_MAX_CONTEXT_SIZE` | `262144` | checker 1명분 prompt body 상한 |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true |
| `DISABLE_CONSISTENCY_CHECK` | `0` | `1` 이면 비활성화 |

세션 디렉토리 스키마·디버그 로그 위치: `./README.md`.
