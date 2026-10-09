---
name: code-review-agents
description: 역할 기반 sub-agent(`<role>-reviewer`, 디폴트 14개; `.claude.project.json` 의 `agents.reviewers` 로 부분 disable 가능)를 main Claude 가 Agent tool 로 병렬 호출해 코드 리뷰를 수행합니다. 사용자가 "코드 리뷰", "ai-review", "변경사항 검토/점검", "보안/성능 리뷰" 를 요청하거나, 기능 구현·리팩토링 완료 후 품질 검증이 필요할 때 사용합니다. 사용량 한도가 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도합니다.
model: sonnet
---

# Code Review Agents

전문 관점 reviewer sub-agent (디폴트 14개; 프로젝트별 `agents.reviewers` 토글로 부분 disable 가능) 가 격리 컨텍스트에서 병렬 리뷰를 수행하고, `code-review-summary` sub-agent 가 결과를 단일 SUMMARY.md 로 통합합니다(로컬 `.review/code/<…>/`, 커밋하지 않음). 기록 서브에이전트 `nerv-recorder` 가 역할 리포트를 NERV 에 `kind=code` 로 역할마다 제출하고(결정 D7), Critical/Warning 발견 시 `resolution-applier` sub-agent 가 fix + e2e 를 처리해 처분 목록을 돌려주면 `nerv-recorder` 가 `nerv_finding_resolve` 로 기록합니다(결정 D9 개정. NERV 쓰기는 main 과 기록 서브에이전트만 한다). 사용자 결정이 필요한 순간만 main 으로 escalate 합니다.

> **프로젝트별 reviewer 토글**: `.claude.project.json` 의 `agents.reviewers.<name>: false` 로 특정 reviewer 비활성. 예: 유저 가이드 매트릭스(PROJECT.md §변경 시 동반 갱신) 가 없는 프로젝트는 `agents.reviewers.user_guide_sync: false`. 디폴트는 전부 활성화 — 키 누락·`true` 면 enabled. 일회성 override 는 `REVIEW_AGENTS` env (project_config 보다 우선).

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 실행 절차

### 0. 사전 점검

현재 worktree 확인 ([`.claude/docs/worktree-policy.md`](../../docs/worktree-policy.md)). main 워크트리에서 호출되면 worktree 안내 후 거부.

**백그라운드(bg) 세션이면 `EnterWorktree` *툴* 로 격리됐는지 확인** — 셸 `cd` 만으로는 부족하다. 부모 bg 세션이 isolate 되지 않으면 harness `worktree.bgIsolation` 가드가 **Workflow sub-agent (reviewer·summary·resolution-applier) 의 공유 체크아웃 write 를 전부 차단**한다. 미격리 bg 세션에서 본 skill 을 돌리면 reviewer output_file·SUMMARY·후속 fix write 가 막히므로, 먼저 `EnterWorktree` 로 부모 세션을 격리한 뒤 진행한다. (배경: [`.claude/docs/orchestrator-workflow-migration.md`](../../docs/orchestrator-workflow-migration.md).)

> **자동 트리거(구현 완료 후) vs 대화형 호출**: `developer` 의 REVIEW WORKFLOW 가 자동으로 본 skill 을 트리거한 경우, 이는 **상시 승인된 강제 의무**이지 사용자가 추론하게 한 비싼 scale 이 아니다 (CLAUDE.md §외부 LLM 호출 정책 — standing opt-in). Workflow 의 "명시 opt-in 시에만" 가드 때문에 미루지 말 것. 대화형 세션은 자동 트리거든 사용자가 직접 친 `/ai-review` 든 Workflow 경로(§2)를 띄우고 완료 알림을 기다린다. 턴이 끝나면 세션도 끝나는 비대화형 실행(`claude -p`)은 §5 평문 Agent fan-out 경로로 한 번에 완주하고 SUMMARY 를 같은 흐름에서 받는다.

### 1. 세션 준비 (model 호출 없음)

```bash
# /loop 밖
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS

# /loop 안 — loop_mode=true 초기화
AI_REVIEW_LOOP=1 python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS

# wake 사이클 — `--resume <session_dir>`
python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --resume <session_dir>
```

stdout 마지막 줄 = 세션 디렉토리 절대경로. **`--prepare` 는 changeset 을 통째로 담은 세션을 정확히 하나만 만든다** — 파일이 아무리 많아도 줄은 하나다.

> 2026-08-10 이전에는 `REVIEW_BATCH_SIZE` 단위로 세션을 쪼개 **배치마다 한 줄씩** 찍었는데 본 문서는 "마지막 줄" 만 읽으라고 적고 있었다. 그래서 마지막 배치를 뺀 나머지가 전부 미리뷰로 남았고, 더 나쁘게는 `agents_forced` 가 **그 배치만 보고 계산**돼 실측 7명 → 2명으로 줄었다(security·testing·scope·maintainability·side_effect 소실). coverage 게이트가 그 줄어든 집합을 검사해 통과시키므로 **거짓 PASS** 였다. 지금은 분할이 없다.

옵션:
- 인자 없음 → git diff (staged + unstaged + untracked) = **아직 커밋 안 된 것만**.
  리뷰 워크플로는 커밋을 먼저 하므로 이 경로는 커밋 직후 브랜치 diff 를 통째로 놓칠 수 있다
  (실측: 기본 0건 vs `--branch origin/main` 6건 — 리뷰어는 빈 코퍼스를 받는데 요약은
  "Critical 0" 을 낸다). 누락이 감지되면 stderr 로 빠진 파일과 함께 경고가 뜨니
  **`--branch <base>` 로 재실행**할 것.
- `--staged`, `--commit <ref>`, `--range <a>..<b>`, `--branch <base>`, 파일/디렉토리 경로
  — 전부 명시 스코프라 위 경고 대상이 아니다
- `--route=auto` (기본) / `--route=all` (router skip, 전수 실행)

### 2. Workflow 실행 (Route → Review → Summary, 기본 경로)

Task 를 클레임한 세션이면 Workflow 를 띄우기 직전에 heartbeat 로 리스를 채우고 Task 를 `in_review` 로 둔다. 순서 · 실패 처리 · 리스가 지난 뒤의 동작은 developer SKILL §REVIEW WORKFLOW 「기다리는 동안의 클레임」이 정본이다.

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
  - **결정 신뢰 검증**: router 가 forced reviewer 를 `selected=false` 로 반환하거나 결정에서 누락하면 — 강제 목록은 프롬프트에 `selected=true` 고정으로 명시되므로 판단 실수가 아니라 계약 위반 — 결정을 **통째로 폐기하고 전수 실행**한다 (`fallback-distrusted-decision`). 2026-07-23 사고(전원 `selected=false` + "문서만 변경") 후 추가. CLI `--apply-routing` 도 동일 판정 — 두 구현은 `test_router_decision_trust.py` 의 차등 테스트로 묶여 있다.
  - 실행될 reviewer 가 0명인 경우는 **fatal** (main 이 minimal SUMMARY) — 전수 fallback 아님. 옛 "selected 0~1 → 전수" 규칙은 #244 에서 폐기됐다.
- **Review**: selected reviewer 를 `agentType` 으로 병렬 invoke (각 reviewer 가 자기 `prompt_file` Read → `output_file` Write — call-contract 그대로, Workflow 내 reviewer write 허용).
- **Summary**: `code-review-summary` 가 `mode=workflow` 로 **각 reviewer 전문을 인라인으로 받아** 통합 SUMMARY 마크다운을 **반환**한다. 하네스가 `SUMMARY.md` **basename** Write 를 차단하기 때문(terminal 여부와 무관 — [`subagent-call-contract.md §7`](../../docs/subagent-call-contract.md) 실측표). 인라인 전달이라 reviewer 가 자기 파일을 안 써도 판정이 온전하다(옛 디스크-Read 방식은 그런 reviewer 의 Critical 을 조용히 누락시켰다).

완료 시 task-notification. selected 0명이면 반환에 `error` — main 이 minimal SUMMARY.

### 3. SUMMARY 기록 + 수렴 분기

Workflow 반환값 (ai-review.js 가 항상 경로+전문을 함께 반환):
- `summary_output` — SUMMARY 가 있어야 할 절대경로 (`<session_dir>/SUMMARY.md`).
- `summary_markdown` — 통합 SUMMARY **전문 (항상 채워짐)**.
- `summary_written` — workflow 내 summary sub-agent 자체 Write 성공 여부. **거의 항상 false 가 정상** (하네스가 `SUMMARY.md` basename 을 차단).
- `reviewers[]` — `{name, status, has_report}`. `has_report:false` 는 그 reviewer 의 findings 를 **아무것도 확보하지 못했다**는 뜻 → Critical 을 숨기고 있을 수 있다.
- `recovered[]` — 계약을 어기고 파일 대신 텍스트로 전문을 반환한 reviewer. 스크립트가 전문을 건져 summary agent 에 넘겼고 파일 영속화도 지시했다. `ls` 로 확인.
- `forced_missing[]` — **비어있지 않으면 강제 화이트리스트 미이행**. 그 상태의 SUMMARY 는 커버리지 완전으로 취급하면 안 된다.
- `risk` / `critical_count` / `warning_count` / `skipped[]` / `unfinished[]` / `routing` / `router_decisions`.

분기:
1. **반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 — `summary_written` 값과 **무관하게 멱등 persist**. 하네스가 `SUMMARY.md` 를 어떤 sub-agent 도 못 쓰게 막고 workflow 스크립트는 FS 접근이 없으므로, **로컬 SUMMARY 의 유일한 경로가 main 의 이 Write** 다. `resolution-applier` 가 이 파일을 읽는다. 판정 근거는 아니다(판정은 NERV 라운드다).
2. 기록 후 `summary_markdown`(또는 상단 30줄)으로 전체 위험도 확인. 이어서 §4 NERV 제출. Critical/Warning > 0 이면 제출 뒤 §6 자동 후속 흐름 진입. 아니면 제출 · 처분 뒤 종료 + 1-2문장 보고.
3. `forced_missing[]` 가 있으면 **그 reviewer 를 실행하기 전에 종료하지 않는다** — router 도 override 못 하는 화이트리스트다.
4. `unfinished[]` 가 있으면(rate_limit/network, 전문도 확보 못 함) 해당 reviewer 만 재실행 — loop 결합은 §7.

> **재시도 정책 차이**: Workflow 경로는 옛 cross-turn ScheduleWakeup quota 자동 재시도를 갖지 않는다. `unfinished` reviewer 는 main 이 재실행하거나 `/loop` (fallback 경로)로 처리. 한도 상황의 무한 재시도가 꼭 필요하면 아래 fallback 경로 사용.

### 4. NERV 제출 (main 의 의무)

리뷰 결과의 정본은 NERV 리뷰 레코드다(전환 단계 2). push 훅과 CI `review-gate` 는 NERV 라운드만 본다. **이 절이 제출 절차의 정본이다.** developer SKILL · `/ai-review` · consistency-checker SKILL 은 이 절을 가리킨다.

제출은 기록 서브에이전트 `nerv-recorder` 가 하고 main 은 결과 몇 줄만 받는다(결정 D9 개정, NERV Task `CLE-T-CD9131`). 제출 묶음 전문과 응답의 `carried_over` 가 main 컨텍스트에 쌓이지 않게 하려는 것이다.

```bash
python3 .claude/tools/nerv_review_payload.py <session_dir> --out <session_dir>/_nerv_payload.json \
    --branch <브랜치> --base <merge-base> --head <리뷰한 커밋> --mode <mode> --task <클레임한 Task 키>
```

1. 도구는 제출 문서를 `--out` 파일에 쓰고 stdout 에는 요약(역할 · 심각도별 발견 수 · `errors` · `warnings`)만 낸다. exit 1 이면 요약의 `errors` · `missing_forced` 를 먼저 푼다. 강제 역할 리포트가 빠졌으면 그 reviewer 를 다시 돌린다. 그대로 내면 라운드가 `missing_roles` 로 남는다. 제출 문서 형식의 정본은 도구 docstring 이다.
   - `--base` · `--head` 는 git 이 풀 수 있는 값(`origin/main` 과 merge-base, `HEAD`)을 준다. 도구가 전체 SHA 로 바꿔 싣는다. 짧은 SHA 를 손으로 늘리지 않는다.
   - `--mode` 는 코드 리뷰면 `review`, 일관성 검토면 `spec` · `prep` · `done`(각각 `--spec` · `--impl-prep` · `--impl-done`), merge 세션이면 `coordinate`, spec_coverage 세션이면 `audit` 이다. 도구가 역할마다 `idempotency_key`(`<task>:<kind>:<mode>:<head 앞 9자>:<role>[:n]`)를 만든다. Task 가 없는 제출(merge · spec_coverage)은 `--task` 를 빼면 `<task>` 자리에 세션 디렉터리 시각(`<YYYYMMDD>-<hhmmss>`)이 들어간다. 같은 head 에서 같은 모드를 다시 돌려 내면 `--run 2` · `--run 3` 을 준다. 모드나 실행 번호가 없으면 같은 head 의 다른 검토가 같은 키를 써서 재전송으로 묶인다.
   - `changeset` 은 `--changeset`, 세션 `meta.json`, `git diff --name-only <base>..<head>` 순으로 채운다.
2. 기록 서브에이전트에 넘긴다. main 은 제출 문서를 읽지 않는다.

   ```
   Agent(subagent_type="nerv-recorder", prompt="submit_file=<session_dir>/_nerv_payload.json")
   ```

   반환은 `STATUS=… MODE=submit DONE=<성공>/<전체> ROUND_BLOCK=… BLOCKING=…` 한 줄과 `ERROR` 줄이다(형식의 정본은 [`nerv-recorder.md`](../../agents/nerv-recorder.md) §반환 형식).
   - `success`: 다음 단계로 간다.
   - `partial`: `ERROR` 줄의 역할을 확인하고 고친 뒤 같은 파일로 다시 부른다. 이미 낸 역할은 멱등 키 덕분에 한 번만 기록된다.
   - `fatal`: 제출 문서에 문제가 있다. 도구를 다시 돌린다.
   - `rate_limit` · `network`: 같은 파일로 다시 부른다(`rate_limit` 은 `RESET_HINT` 뒤에).
   - **기록 서브에이전트를 쓸 수 없는 세션**(Agent 목록에 `nerv-recorder` 가 없다. 정의는 세션을 시작할 때 읽힌다)은 main 이 직접 낸다. 제출 문서의 `submissions[]` 마다 아래처럼 부른다.

     ```
     nerv_review_submit(kind=submit.kind, branch=submit.branch, base_sha=submit.base_sha,
                        head_sha=submit.head_sha, changeset=submit.changeset, task_id=submit.task_id,
                        reviewer=묶음.reviewer, findings=묶음.findings, summary=묶음.summary,
                        idempotency_key=묶음.idempotency_key)
     ```

   - 필수 6역할(security · requirement · scope · side_effect · maintainability · testing)은 발견 0건이어도 낸다. NERV 정책 `review_roles.code` 가 역할 리포트로 센다. router 는 바뀐 파일이 하나라도 있으면 이 6역할을 강제한다(하네스 · 문서만 바꾼 Task 도 done 게이트에 passed 라운드가 필요하다). `REVIEW_AGENTS` 로 직접 고를 때는 6역할과 변경 종류에 따라 붙는 강제 리뷰어(§5)를 넣는다.
   - 같은 커밋 · 같은 `changeset` 이면 한 라운드로 모인다(응답의 `merged_into_existing_session`). `changeset` 이 다르면 같은 커밋이라도 새 라운드가 생긴다. N1 판정은 같은 head 의 라운드들에서 낸 역할을 합쳐 센다(실측 2026-10-01). 도구는 모든 역할에 같은 `changeset` 을 싣는다. 중간에 끊기면 같은 제출 문서로 다시 부른다. `idempotency_key` 는 같은 제출의 재전송을 묶는 NERV 인자다.
3. 요약에 `warnings[]` 가 있으면 해당 리포트를 읽는다. 형식 밖의 심각도 표지라면 그 줄을 정의 형식으로 고치고 `--run 2` 로 제출 문서를 다시 만들어 낸다. 같은 커밋 · 같은 `changeset` 이라 같은 라운드에 모이고 이미 낸 발견은 지문으로 합쳐진다. 목록 밖의 `*.md` 는 역할 리포트가 아니므로 내지 않는다.
4. 이번 라운드가 막는지는 반환의 `ROUND_BLOCK` · `BLOCKING` 으로 본다. 기록 서브에이전트가 마지막 응답의 `round_block` · `blocking_findings` 를 옮긴 값이다. 응답의 `block` 은 프로젝트 전체의 열린 critical 이라 판정에 쓰지 않는다. `carried_over` 는 다른 브랜치의 열린 발견이고 앞 50건만 담는다.
5. 처리할 발견을 인계 파일로 받는다. 발견 ID 를 손으로 옮겨 적지 않는다.

   ```bash
   python3 .claude/tools/nerv_review_handoff.py fetch <session_dir> --branch <브랜치>
   ```

   이 브랜치의 열린 발견이 `<session_dir>/_nerv_findings.json` 에 적힌다. 파일 형식은 그 도구의 docstring 이 정본이다. 발견은 전체 ID 로 가리킨다. NERV 발견 ID 는 UUIDv7 이라 앞 8자는 같은 분에 생긴 발견끼리 겹친다.
6. 발견은 모두 처분한다(`nerv_finding_resolve`). critical · warning 은 §6 `resolution-applier` 가 처분을 정하고, 발견으로 낸 INFO 는 applier 가 남긴 것(`left_to_main`)을 main 이 정한다. 열린 발견은 이후 모든 제출 응답에 `carried_over` 로 따라붙기 때문이다(전환 Task 에서 387건). 그래서 제출 도구(`nerv_review_payload.py`)는 kind=code · consistency 의 INFO 를 발견으로 내지 않고 그 역할 묶음의 `summary` 끝에 제목 · 위치만 싣는다(NERV Task `CLE-T-ZTTHXD`. 2026-10-09 실측으로 라운드당 INFO 가 약 11건이었고 처분은 한 건씩이다). `[SPEC-DRIFT]` INFO 는 스펙 초안 처분이 필요해 발견으로 남는다. 출력의 `info_in_summary` 가 옮긴 수다. 접힌 INFO 는 NERV 에 제목 · 위치만 남고 본문 · 제안은 세션 리포트(`.review/`)에만 있다. 처분 대상이 아니므로 고칠지는 main 이 SUMMARY 를 보고 라운드 안에서 정한다. 접힌 INFO 에는 발견 ID 가 없어 고친 커밋이 처분 커밋이 되지 못한다. 고치려면 다음 라운드 전에 고치거나 후속 Task 로 넘기고, 넘길 때 상세 · 제안을 세션 리포트에서 Task 본문으로 옮긴다(`.review/` 는 커밋하지 않는 로컬 산출물이다). 코드 주석 · 커밋은 접힌 INFO 를 인용하지 않고 이유를 직접 적는다. 예전처럼 모두 발견으로 내려면 `--keep-info` 를 준다. critical 을 `dismissed`/`wont_fix` 로 낮추는 처분은 사람 승인이 필요하다. 처분은 발견 단위다. NERV 는 같은 지적을 지문으로 합치므로 처분이 같은 발견을 담은 다른 브랜치의 라운드에도 보인다. 다른 브랜치에서 온 발견을 이 브랜치 커밋으로 `fixed` 처분하지 않는다. 반대로 push 게이트가 "처분 커밋이 이 브랜치에 없다" 로 막으면 이 브랜치에서 고친 커밋으로 그 발견을 다시 처분한다. 이미 `fixed` 인 발견도 다시 처분할 수 있다(실측 2026-10-01: 같은 발견에 새 처분이 쌓인다).

#### merge · spec_coverage 세션

같은 도구가 `.review/merge/…` · `.review/spec-coverage/…` 세션도 제출 묶음으로 바꾼다(kind 는 세션 경로에서 읽는다). 인자는 위 2 와 같고 다른 점만 적는다.

- **merge**(`/merge-coordinate`): analyzer 리포트 하나가 역할 하나다(`merge_conflict_analyzer` · `semantic_conflict_analyzer` · `integration_order_planner` · `cross_branch_spec_analyzer`). 제출은 세션마다 한 번 한다. 통합했으면 Phase 3 커밋 뒤에 내고 `head_sha` 는 그 통합 커밋이다. 통합하지 않고 끝나면(`BLOCK: YES` · confirm 거절) Phase 2 를 마칠 때 내고 `head_sha` 는 그 시점 격리 worktree 의 HEAD(통합 전 base tip)다. `branch` 는 두 경우 모두 격리 worktree 의 브랜치(`integrate-*`)다. `base_sha` 는 base 브랜치의 커밋이다. 키의 `<mode>` 는 `coordinate` 다. 통합을 맡은 NERV Task 가 있으면 `task_id` 를 붙인다.
- **spec_coverage**(`/spec-coverage`)
  - 제출: 감사기 `SUMMARY.md` 하나가 역할 `spec_coverage` 하나이고 후보 하나가 info 발견 하나다(태그 `confidence:<신뢰도>` · 방향). info 라 라운드를 막지 않는다. 키의 `<mode>` 는 `audit` 다. 도구가 요약의 후보 수보다 적게 읽으면 `warnings[]` 로 알린다. 그때는 감사기 출력 형식을 확인하고 내지 않는다.
  - 처분: 제출한 세션이 같은 세션 안에서 모두 처분한다. 사람이 고른 후보는 NERV Task 로 올리고 그 Task 를 근거로 `wont_fix`, 나머지는 `dismissed` 로 닫는다. 열린 채 두면 이후 모든 제출 응답에 `carried_over` 로 따라붙는다.

**라운드 뒤 커밋.** push 게이트는 라운드 head 이후의 `codebase/**` 커밋을 두 경우에 새 라운드 없이 통과시킨다. code · consistency 라운드에서 `fixed` 로 처분된 발견의 `commit_sha` 이거나, 커밋 메시지가 그런 발견을 `finding <발견 전체 ID>` 로 인용하는 경우다(e2e 실패 뒤 후속 수정). 한 커밋이 발견 여럿을 고치면 `finding <ID> · <ID>` 처럼 `finding` 이 든 한 문단에 전체 ID 를 나열한다. 빈 줄로 나뉜 다른 문단의 ID 는 인용으로 세지 않는다. merge 커밋은 충돌을 손으로 푼 `codebase/**` 변경이 있으면 센다. **fix 커밋은 다시 리뷰되지 않는다.** `fixed` 처분과 인용은 main 의 자기 신고이고 게이트는 커밋이 처분에 묶였는지만 본다. 리뷰 뒤 변경이 처분한 발견의 범위를 넘으면 새 라운드를 낸다. 판정 규칙의 정본은 `.claude/hooks/_lib/review_guard.py` docstring 이다.

**게이트가 판정하지 못할 때(fail-open).** push 훅은 NERV 가 응답하지 않거나 로컬에 `NERV_SERVER` · `NERV_TOKEN` 이 없으면 통과시키고 배너로 센다. CI `review-gate` 는 토큰 · 주소 설정 문제(없음, 401 · 403 · 404)만 실패로 보고, 장애(시간 초과 · 5xx · 429)는 통과시킨다. 그래서 두 게이트는 NERV 가 답할 때만 막는다. NERV 가 내려가 있어도 리뷰 결과를 저장소 파일로 커밋하지 않는다. NERV 가 돌아오면 그때 제출한다.

같은 판정을 REST 로 읽을 수 있다: `GET /api/v1/projects/clemvion/gates/reviews/check?branch=<브랜치>&kind=code,consistency`(push 훅 · CI 가 쓰는 그 응답).

### 5. (fallback) 수동 Agent 경로

Workflow 불가 환경에서는 orchestrator 의 `--summary-state` / `--apply-routing` / `--update` CLI + 직접 `Agent` fan-out + `Agent(code-review-summary, session_dir=<...>)` + `/loop` ScheduleWakeup 로 동일 결과를 낸다 (state CLI 는 `test_orchestrator_state.py` 로 검증되는 안정 인터페이스).

> **⚠ 이 경로를 택하면 Workflow 의 Route 보정(`selected = agents_forced ∪ picked`)이 사라진다.**
> "변경이 작아 보인다" 는 자가 판단으로 forced reviewer 를 빠뜨리기 쉽다 — 화이트리스트는 정확히
> 그 판단을 막으려고 존재한다. 그래서 **이 규약의 일부는 더 이상 산문이 아니다**:
>
> - **필수 6역할은 서버가 센다.** 6역할을 빠뜨린 채 제출하면 NERV 정책 `review_roles.code` 가
>   라운드를 `missing_roles`(`pending`)로 두고, push 훅과 CI `review-gate` 가 그 라운드를 통과시키지
>   않는다(NERV 가 답할 때. §4 fail-open). 판정은 **제출된 역할 리포트** 기준이라 `agents_success`
>   를 꾸며도 통과하지 못한다.
> - **그 밖의 강제 reviewer 는 push 게이트가 센다.** `documentation` · `dependency` · `database` ·
>   `api_contract` 는 NERV 정책 `review_roles` 가 표현하지 못하는 조건부 역할이라 서버는 보지 않는다.
>   대신 push 훅과 CI `review-gate` 가 라운드가 본 파일(라운드 head 와 base 의 merge-base 이후)을
>   `router_safety` 규칙에 넣어 강제 목록을 구하고, N1 `roles.reported` 에 없으면 막는다(판정 2b.
>   NERV 가 답할 때만). `.claude.project.json` 에서 끈 리뷰어는 요구하지 않는다. 이 토글은 push 하는
>   트리의 파일을 읽는다. 그래서 같은 브랜치에서 토글을 끄면 그 브랜치의 요구도 사라진다. `REVIEW_AGENTS`
>   는 보지 않으므로 그것으로 좁힌 라운드는 막힌다. 제출 전에는 `nerv_review_payload.py` 의 exit 1 이 같은 누락을 알린다. 무시하고
>   제출하지 않는다. 판정 규칙의 정본은 `.claude/hooks/_lib/review_guard.py` docstring 과 `PROJECT.md`
>   §NERV 리뷰 게이트다.
> - 미리 확인하려면(제출하기 전에):
>   ```bash
>   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py \
>     --verify-coverage <session_dir>     # forced 중 산출물 없으면 exit 1 + 누락 명단
>   ```
>
> **상태 기록은 이제 자동이다** — `--summary-state` / `--resume` 가 읽을 때 디스크로 자가
> reconcile 하므로 `--sync-from-disk` 를 기억해 호출할 의무는 없다(명시적으로 고치고 싶을 때만
> 쓰는 loud 버전으로 남겨둔다). router 를 안 불렀다면 실제 선별 근거를 `_routing_decision.json`
> 으로 남기고 `--apply-routing <session_dir>` 로 pending→skipped 를 반영한다.
>
> **소급 재분류 주의**: "산출물 존재" 판정이 "존재 + 비어있지 않음" 으로 강화된 뒤([`report_paths.py`
> has_report()`](../../_shared/report_paths.py)) 이 정의는 과거에 이미 커밋된 세션에도 그대로
> 적용된다. `touch` 된 0바이트 placeholder 리포트를 가진 과거 세션에 `--summary-state`/
> `--resume`/`--sync-from-disk` 를 실행하면(예: 감사·재조회 목적) 그 세션은 이제 "누락" 으로
> 재분류되고 `_retry_state.json` 이 갱신돼 워크트리가 dirty 해질 수 있다 — 조회만 했는데도.
>
> 근거: 2026-07-17 세션에서 두 결함이 동시에 발생 — forced 인 `security` 가 open-redirect 방어
> 경계(`buildWorkspaceHref`) 수정 diff 에서 누락됐고, 7개 세션이 stale 상태로 커밋됐다. 이후 전수
> 조사에서 **커밋된 575 세션 중 160건이 forced 미충족**(그중 107건은 당시 RESOLUTION.md 를 갖고
> 게이트를 통과 중)으로 드러났다 — 산문 의무는 예외가 아니라 상시로 무너지고 있었다.
> 하네스의 Write 차단·전문 반환 동작은 [`subagent-call-contract.md §7`](../../docs/subagent-call-contract.md).

### 6. 자동 후속 흐름 — `resolution-applier` 위임

§4-5 의 `_nerv_findings.json` 에 critical · warning 이 있으면 main 은 다음 한 호출로 끝낸다:

```
Agent(subagent_type="resolution-applier",
      prompt="session_dir=<session_dir>")
```

resolution-applier 는 `_nerv_findings.json` 의 발견을 분류 · 코드 fix · spec 제안 · e2e 까지 자기 컨텍스트 안에서 수행하고, **처분 목록** `<session_dir>/_dispositions.json` 을 쓴다. NERV 에는 쓰지 않는다(결정 D9. 기록은 `nerv-recorder` 가 한다). 파일 형식은 `.claude/tools/nerv_review_handoff.py` docstring 이 정본이다. main 으로 돌아오는 건 확장 STATUS 한 줄:

```
STATUS=<...> ITEMS=<r>/<t> E2E=<pass|fail|blocked|skipped> ESCALATE=<flag> NEEDS_SPEC=<path> DISPOSITIONS=<path> RESET_HINT=<sec>
```

main 의 기록 순서:

1. `python3 .claude/tools/nerv_review_handoff.py check <session_dir>` — exit 1 이면 기록하지 않고 같은 session_dir 로 applier 를 다시 부른다(처분 파일은 applier 가 쓴다).
2. `python3 .claude/tools/nerv_review_handoff.py pending <session_dir> --branch <브랜치> --out <session_dir>/_nerv_resolve.json` 이 기록할 처분만 파일에 쓰고 건수를 낸다. NERV 에 이미 기록된 처분은 빠진다. 사람이 NERV 에서 바꾼 처분도 덮지 않는다. applier 재호출 · wake 뒤에도 같다. 그 파일을 기록 서브에이전트에 넘긴다.

   ```
   Agent(subagent_type="nerv-recorder", prompt="resolve_file=<session_dir>/_nerv_resolve.json")
   ```

   처분 문서에는 `nerv_finding_resolve` 인자(`fixed` 는 `commit_sha`, `wont_fix`/`dismissed` 는 근거, `escalated` 는 `escalate_reason`)와 멱등 키가 있다. 반환은 `STATUS=… MODE=resolve DONE=… APPROVAL=<n> OPEN_BLOCKING=<n>` 한 줄과 `APPROVAL` · `ERROR` 줄이다. `APPROVAL` 줄은 critical 을 낮추는 처분이라 사람 승인(A3)을 기다린다는 뜻이다. 그 동안 세션은 `awaiting_input` 이다. `OPEN_BLOCKING` 은 이 브랜치에 남은 열린 critical · warning 수다(`escalated` 처분도 열린 채로 남는다). 기록 서브에이전트를 쓸 수 없는 세션은 main 이 처분 문서의 `dispositions[]` 마다 `nerv_finding_resolve` 를 직접 부른다(§4 의 2 와 같은 조건).
3. `spec_proposals` 는 아래 `spec` 행대로, `left_to_main`(발견으로 낸 INFO. 보통 `[SPEC-DRIFT]`)은 §4-6 대로 처분한다. main 이 정한 이 처분 몇 건은 main 이 `nerv_finding_resolve` 를 직접 부른다.
4. `tests` 는 Task 증적(`evidence` kind=test)으로 옮긴다.
5. push 한다. 게이트 조건은 §4 "라운드 뒤 커밋".

분기:

| ESCALATE | main 후속 |
|---|---|
| `no` | 처분 기록 뒤 ITEMS·E2E 결과를 1-2문장으로 보고 + 종료 |
| `spec` | spec 결함 **또는 SPEC-DRIFT(구현이 spec 을 의도적으로 개선해 spec 이 낡음)**. applier 는 그 발견을 처분하지 않고 `spec_proposals` 로 넘긴다(`NEEDS_SPEC` = `_spec-proposal-<area>.md`). main 은 제안대로 NERV 스펙 초안을 쓰고(`/nerv:spec edit`), 초안 본문 파일로 `/consistency-check --spec` 을 돌린다. BLOCK:NO 면 검토 요청을 하고 초안 저장의 `spec_version_id` 로 그 발견을 `spec_change` 처분한다. 초안을 쓸 수 없거나 BLOCK:YES 면 `escalated`(`escalate_reason=spec`)로 처분하고 사용자에게 알린다. 저장소 `spec/` 은 미러라 커밋하지 않는다. SPEC-DRIFT 는 코드를 되돌리지 않고 spec 만 갱신하는 정식 역류 경로다 |
| `user-decision` / `infra` / `e2e-fail-3x` / `sensitive-fix` | applier 가 해당 발견을 `escalated`(같은 사유)로 넘겼다. main 은 그대로 기록하고 `AskUserQuestion` 으로 사유·옵션을 묻는다(사람이 이 세션에 없으면 `nerv_question_create`). 사용자 결정 후 resolution-applier 재호출 |
| `rate_limit` / `network` (STATUS 자체) | ScheduleWakeup 으로 재예약 — wake 시 resolution-applier 같은 session_dir 로 재호출 (idempotency 로 복구) |
| `fatal` | `check` 를 통과한 처분까지 기록 + 사유 사용자 보고 |

> **idempotency**: resolution-applier 가 중간 종료돼도 `_resolution_state.json` + 커밋 이력(메시지의 `finding <발견 전체 ID>` 인용) + `_dispositions.json` 으로 복구한다. main 은 같은 session_dir 로 재호출하고, 기록은 `pending` 이 낸 처분만 한다.

### 7. /loop 결합 (fallback 경로 + resolution-applier 한도 복구)

Workflow 경로(§2)는 한 번에 완주하거나 `unfinished[]` 를 반환한다. cross-turn quota 자동 재시도가 필요한 경우는 **fallback 수동 Agent 경로** 또는 **§6 resolution-applier 의 rate_limit/network 재예약**에서 처리:

- 첫 사이클(fallback): 사용자 인자(`/ai-review --staged` 등) 로 step 1 `--prepare`. session_dir 기록.
- wake 사이클(fallback): prompt 안의 `--resume <session_dir>` 로 orchestrator 호출 → fallback fan-out. `routing=done` 이면 router 재호출 skip.
- §6 resolution-applier 가 `rate_limit/network` STATUS 면 ScheduleWakeup 재예약(같은 session_dir, idempotency 복구).
- 자연 종료: SUMMARY 완료 + NERV 제출 + resolution-applier ESCALATE=no + 처분 기록 → ScheduleWakeup 미호출 → /loop 종료.

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
| `REVIEW_AGENTS` | (project_config 통과 후 전체) | 실행할 reviewer 쉼표 구분. 설정 시 router 자동 skip + project_config 토글보다 우선 (일회성 override). 필수 6역할과 변경 종류에 따라 붙는 강제 리뷰어를 빼면 push 게이트가 막는다(§5). |
| `REVIEW_OUTPUT_DIR` | `./.review/code` | 세션 디렉토리 부모 (gitignore, 커밋하지 않는다. 옛 `review/` 는 편집 가드가 막는다) |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 |
| `REVIEW_MAX_FILE_SIZE` | `55296` | 개별 파일 컨텐츠 상한 (자). 라인번호 게이트 도입 전 51200 → 게이트 오버헤드(+8%) 만큼 상향. |
| `REVIEW_MAX_PROMPT_SIZE` | `141557` | reviewer 1명분 prompt body 상한 (자). 게이트 도입 전 131072 → +8%. 게이트는 리뷰 대상 코드가 아니라 메타데이터이므로, 상한을 그대로 두면 reviewer 가 보는 **코드량**이 조용히 줄어든다. |
| `REVIEW_BATCH_SIZE` | `50` | 이 수를 넘으면 stderr 로 대형 changeset 안내. **세션은 분할하지 않는다** (분할된 배치가 미리뷰로 남고 `agents_forced` 를 축소시켜 거짓 PASS 를 냈다 — 2026-08-10) |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 wake delay |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

세부 운영 가이드 (router safety 매트릭스·디버그 로그 위치): `./README.md`.
