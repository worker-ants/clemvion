---
name: consistency-checker
description: spec / plan / 구현 착수 직전에 기존 문서들과의 위배를 사전에 검출하는 다관점 일관성 검토자입니다. 사용자가 "consistency check", "정합성 점검", "사전 검토", "spec 충돌 확인", "/consistency-check" 를 호출하거나, project-planner 가 `spec/` 에 쓰기 전, developer 가 구현에 착수하기 전에 의무 호출됩니다. 5개의 sub-agent(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision)를 main Claude 가 Agent tool 로 병렬 호출하며, Critical 위배 발견 시 spec write·구현 착수를 차단합니다. 사용량 한도 시 `/loop /consistency-check` 와 결합해 ScheduleWakeup 으로 무한 재시도.
model: opus
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
| `plan-coherence-checker` | `plan/in-progress/**` 미해결 결정·선행 plan 미해소·후속 항목 누락 |
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
- `--impl-done <scope>` — **구현 완료 후 사후 검증**. scope = spec 영역 경로. target_doc 에 spec 영역 파일 + `git diff <diff-base>...HEAD -- <code_areas>` 가 함께 묶여, 5 checker 가 "spec 본문 vs 실 구현 diff" 정합성을 사후 분석. `--diff-base <ref>` 로 base 변경 (default: `origin/main`). **spec 연결 코드(어떤 spec 의 frontmatter `code:` glob 에 매칭) 변경 시 developer REVIEW WORKFLOW 의 의무 단계** — `BLOCK: NO` 산출물이 없으면 `review_guard.py` 의 SPEC-CONSISTENCY 게이트가 push·턴종료를 차단한다. (이전엔 "권장" 이었으나 종료 게이트로 승격: code-vs-spec 일치 검증의 비대칭 해소.)

stdout 마지막 줄 = 세션 디렉토리.

### Checker 프로젝트별 토글

`.claude.project.json` 의 `agents.checkers.<name>: false` 로 특정 checker 비활성. 디폴트는 전부 활성화 (키 누락·`true` ⇒ enabled, 명시 `false` ⇒ disabled). 일회성 override 는 `CONSISTENCY_AGENTS` env (project_config 보다 우선). 5 checker key: `cross_spec` · `rationale_continuity` · `convention_compliance` · `plan_coherence` · `naming_collision`.

### 2. Workflow 실행 (기본 경로)

`--prepare` 가 만든 `_retry_state.json` 은 model-free manifest 다 (경로만, prompt body 없음). 이걸 짧게 Read 해 invocation 목록을 추출하고 `Workflow` tool 에 넘긴다 — fan-out·STATUS 추적·수렴을 Workflow 가 결정적으로 처리한다 (수작업 `--summary-state`/`--update`/`ScheduleWakeup` 루프 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합 (CLAUDE.md §외부 LLM 호출 정책).

```text
1. Read <session_dir>/_retry_state.json — subagent_invocations[], summary_subagent_type, summary_output_file 추출 (작음: 경로뿐).
2. Workflow(name="consistency-check", args={
     invocations: subagent_invocations,            // [{name, subagent_type, prompt_file, output_file}]
     summary: { subagent_type: summary_subagent_type, output_file: summary_output_file }
   })
```

Workflow 동작: `Checkers` phase 에서 각 checker 를 `agentType` 으로 병렬 invoke (checker 가 자기 `prompt_file` 을 Read 하고 `output_file` 에 Write — 기존 call-contract 그대로, Workflow 내 checker write 는 허용됨). `Summary` phase 에서 `consistency-summary` 가 `mode=workflow` 로 통합 SUMMARY 마크다운을 **반환**한다 (terminal sub-agent 의 report-file Write 는 harness 가 차단하므로 파일 대신 텍스트 반환). 완료 시 task-notification.

### 3. SUMMARY 기록 + 결과 확인

Workflow 반환값 (항상 경로+전문):
- `summary_output` — SUMMARY 절대경로. `summary_markdown` — 통합 SUMMARY **전문 (항상 채워짐)**. `summary_written` — workflow 내 summary write 성공 여부. `block` — YES/NO.
- `unfinished[]` — success 아닌 checker. 비어있지 않으면(rate_limit/network) 해당 checker 만 재실행.

**반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 — `summary_written` 값과 **무관하게 멱등 persist** (workflow 의 terminal summary write 는 차단될 수 있고 workflow 스크립트는 FS 접근이 없으므로, 디스크 단일 진실의 신뢰 경로는 main 의 이 Write 다). 그 다음 반환의 `block` (또는 기록한 SUMMARY 상단)으로 `BLOCK: YES/NO` 판정.

> **재시도 정책 차이**: Workflow 경로는 옛 ScheduleWakeup cross-turn quota 자동 재시도를 갖지 않는다. 사전 쓰기 게이트(대화형 실행)라 수용 가능 — 한도 시 사용자가 재호출하거나 `unfinished` checker 만 다시 돌린다.

### (fallback) 수동 Agent 경로

Workflow 가 불가한 환경에서는 orchestrator 의 `--summary-state` / `--update <...> --agent <name> --status <s>` CLI + 직접 `Agent` fan-out + `Agent(consistency-summary, session_dir=<...>)` 로 동일 결과를 낼 수 있다 (state CLI 는 `test_orchestrator_state.py` 류로 검증되는 안정 인터페이스). loop_mode 시 ScheduleWakeup 재예약.

### 4. BLOCK 처리

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
