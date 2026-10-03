---
name: consistency-checker
description: 스펙 초안 · 구현 착수 직전 · 구현 완료 후에 기존 문서들과의 위배를 검출하는 다관점 일관성 검토자입니다. 사용자가 "consistency check", "정합성 점검", "사전 검토", "spec 충돌 확인", "/consistency-check" 를 호출하거나, project-planner 가 `spec/` 에 쓰기 전, developer 가 구현에 착수하기 전에 의무 호출됩니다. 5개의 sub-agent(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision)를 main Claude 가 Agent tool 로 병렬 호출하며, Critical 위배 발견 시 spec write·구현 착수를 차단합니다. 사용량 한도 시 `/loop /consistency-check` 와 결합해 ScheduleWakeup 으로 무한 재시도.
model: opus
---

# Consistency Checker

스펙 초안 · 구현 변경이 **저장되기 전** 단계에서 기존 문서들과의 위배를 사전 검출(`--impl-done` 은 구현 뒤 사후 검증). 사후 코드 리뷰(`ai-review`)와 달리 **결정이 박히기 전** 동작.

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 절대 원칙

- **사전 검출**: target 문서 디스크 쓰기 전 호출이 정상.
- **Critical = 차단**: SUMMARY.md 상단 `BLOCK: YES` 면 호출자 즉시 멈춤.
- **출력은 markdown + NERV 레코드**: 로컬 `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`(gitignore, 커밋하지 않음)가 단일 결과 진입점이고, checker 리포트는 checker 마다 NERV `kind=consistency` 로 제출한다(전환 단계 2).
- **재진입성**: 스펙 자동 수정 안 함, 산출물 디렉토리만 누적.

## Checker 4개

| sub-agent | 검출 대상 |
| --- | --- |
| `cross-spec-checker` | 다른 영역 spec 의 데이터 모델·API·요구사항 ID 충돌 |
| `rationale-continuity-checker` | 과거 Rationale 의 기각 결정 재도입 |
| `convention-compliance-checker` | 정식 규약(미러 frontmatter `type: "convention"` 문서) 위반 |
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
- `--spec <path>` — 스펙 초안. NERV 초안을 **저장한 뒤 검토 요청 전** 의무다(`nerv_spec_check` 와 함께, 결정 D10). `<path>` 는 `nerv_spec_get(basis=latest)` 로 받은 초안 본문을 둔 파일이다(scratchpad 의 절대 경로도 받는다). 결과는 `kind=consistency` 로 NERV 에 제출한다.
  > **draft 원본이 `<session>/_target/` 에 보존된다** (`meta.json` 의 `target_snapshot`).
  > draft 는 임시 파일이 아니라 **산출물**이다 — 옛 흐름에서 `developer` 가 `spec/` 을 직접 못 고치는
  > 경계는 "planner 턴을 밟았다" 로만 정당화되고 draft 가 그 유일한 증거였다. planner 턴 끝에
  > draft 를 지우는 일이 두 턴 연속 벌어져(`#1242`·`#1243`) main 이 존재하지 않는 파일을
  > 인용하는 상태가 됐고, 그때 복원은 `_prompts/` 코드펜스에 원문이 **우연히** 남아 있어서
  > 가능했다(프롬프트의 target 은 예산에 따라 잘린다). 그 우연을 계약으로 바꾼 것이 이
  > 사본이다.
  >
  > **차단 가드가 아니다.** 옛 흐름에서는 draft 를 `plan/complete/` 로 옮겨 남겼다(보존된 69개 중 66개).
  > 전환 단계 3 에서 `plan/` 이 없어졌고 지금 초안의 정본은 NERV 버전이다. 이 사본은 로컬 세션의
  > 증거로만 남는다.
- `--impl-prep <scope>` — 구현 착수 직전. scope 는 NERV 키(`CLE-ENG-SPECEVIDENCE`) · 미러 영역 폴더(`spec/CLE-ENG/`) · 미러 파일 중 하나이고 쉼표로 여럿을 준다. 미러 밖 경로와 `spec/` 자체는 받지 않는다(종료 코드 2). 보통 클레임 scope 의 `spec_ids` 를 준다. 키가 로컬 미러에 없으면 종료 코드 2 로 멈추므로 먼저 `pull.py --task <Task 키>` 로 받는다.
- `--impl-done <scope>` — **구현 완료 후 사후 검증**. scope 형식은 `--impl-prep` 와 같다. target_doc 에 대상 미러 문서 + `git diff <diff-base>...HEAD -- <code_areas>` 가 함께 묶여, checker 들이 "spec 본문 vs 실 구현 diff" 정합성을 사후 분석. `--diff-base <ref>` 로 base 변경 (default: `origin/main`). **이 base 는 전 모드 공통으로 번들 우선순위 산정에도 쓰인다** — 이 브랜치가 변경한 파일이 컨텍스트 예산의 앞자리를 받는다. **developer REVIEW WORKFLOW 의 의무 단계** — 결과를 checker 마다 `kind=consistency` 로 NERV 에 제출하고(`task_id` 포함) 발견을 처분한다. NERV Task done 게이트(`done_gate.review_coverage`)가 그 Task 의 consistency 라운드를 요구한다. target_doc 맨 앞에는 **HEAD 워킹트리 절대경로 + "CWD 상대 Read/Grep 은 diff-base(변경 전) 라 신뢰 금지" 가드**가 박힌다 — checker sub-agent 의 CWD 가 default-branch 체크아웃이라 신규 추가 코드를 "미구현" 으로 오탐하던 #738 버그 차단 (코드 확인은 절대경로 / `git -C <root>` 로).
  - **구현 위치 대조**: 미러 문서의 `## 구현 위치` 가 이 브랜치가 바꾼 파일을 덮으면 그 문서를 대상에 더하고 census 에 이유를 적는다. 옛 push 게이트의 spec-linked 검사(구현 파일을 고치면 구현 완료 검토 요구)가 하던 대조를 `--impl-done` 을 돌릴 때 되살린 것이다. 강제는 아니다. done 게이트는 consistency 라운드가 있고 통과했는지만 보고 어떤 문서를 대상으로 했는지는 보지 않는다.
  - `--diff-path <path>` 로 구현 diff 경로를 바꾼다(여럿이면 반복, 기본 `code_areas`). 하네스만 바꾼 작업은 `--diff-path .claude` 처럼 준다. 생성된 API 카탈로그 필드 문서(`codebase/api-catalogs/*/*/**/*.md`)는 diff 에서 빼고 뺀 수만 적는다.
- `--focus <keys>` — scope 가 영역 폴더처럼 넓을 때 그 안에서 컨텍스트 예산의 앞자리를 줄 NERV 키(쉼표). 보통 클레임 scope 의 `spec_ids`. 모든 모드에서 쓴다. scope 가 키 하나면 쓸 필요가 없다.

> **대상과 대조 코퍼스**: 대상과 대조 코퍼스 모두 미러(`pull.py` 가 쓴 `spec/<키>.md` · `spec/<영역 키>/<키>.md`)다. 정식 규약 코퍼스(`conventions`)는 frontmatter `type: "convention"` 문서, 관련 스펙 코퍼스(`related_specs`)는 그 밖의 미러 문서다. 리서치 영역(`CLE-RESEARCH`)과 미러 안내 `spec/README.md` 는 뺀다. `--spec` 초안 파일 이름이 키면 그 키의 미러 판은 코퍼스에서 빠지고 Rationale 은 남는다. 번들 순서는 브랜치가 바꾼 문서 → `--focus` 키 · 구현 위치가 바뀐 파일을 덮는 문서 → 대상 본문이 부르는 키 → 나머지다. 미러는 구현할 때 `pull.py --task` 로 받은 버전이라 NERV 의 최신 초안 · Rationale 과의 연속성은 `nerv_spec_check` 가 함께 본다.

stdout 마지막 줄 = 세션 디렉토리.

### Checker 프로젝트별 토글

`.claude.project.json` 의 `agents.checkers.<name>: false` 로 특정 checker 비활성. 디폴트는 전부 활성화 (키 누락·`true` ⇒ enabled, 명시 `false` ⇒ disabled). 이 저장소는 4개를 모두 켠다. 일회성 override 는 `CONSISTENCY_AGENTS` env (project_config 보다 우선). checker key: `cross_spec` · `rationale_continuity` · `convention_compliance` · `naming_collision`.

### 2. Workflow 실행 (기본 경로)

`--prepare` 가 만든 `_retry_state.json` 은 model-free manifest 다 (경로만, prompt body 없음). 이걸 짧게 Read 해 invocation 목록을 추출하고 `Workflow` tool 에 넘긴다 — fan-out·STATUS 추적·수렴을 Workflow 가 결정적으로 처리한다 (수작업 `--summary-state`/`--update`/`ScheduleWakeup` 루프 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합 (CLAUDE.md §외부 LLM 호출 정책).

```text
1. Read <session_dir>/_retry_state.json — subagent_invocations[], summary_subagent_type, summary_output_file 추출 (작음: 경로뿐).
2. Workflow(name="consistency-check", args={
     invocations: subagent_invocations,            // [{name, subagent_type, prompt_file, output_file}]
     summary: { subagent_type: summary_subagent_type, output_file: summary_output_file }
   })
```

Workflow 동작: `Checkers` phase 에서 각 checker 를 `agentType` 으로 병렬 invoke — checker 는 `prompt_file` 을 Read 하고 `output_file` 에 Write 한 뒤 **STATUS + 보고서 전문**을 반환한다(스크립트가 prompt 에 그 규약을 덧붙인다). `Summary` phase 에서 `consistency-summary` 가 `mode=workflow` 로 **각 checker 전문을 인라인으로 받아** 통합 SUMMARY 마크다운을 **반환**한다.

> **왜 전문을 반환시키나**: 하네스가 sub-agent 에게 "보고서를 파일로 쓰지 말고 텍스트로 반환하라" 고 지시하기 때문에, checker 가 `output_file` Write 를 건너뛰는 일이 잦다(실측: 한 런에서 5개 중 4개가 Write 호출 0회). 옛 방식은 summary 가 디스크에서 Read 했기에 그런 checker 의 `[CRITICAL]` 이 **BLOCK 계산에서 조용히 누락**됐다(2026-07-10 실측 3회 — `BLOCK: NO` 인데 journal 엔 CRITICAL). 인라인 전달은 그 거짓 음성을 구조적으로 제거한다. 차단되는 것은 `SUMMARY.md` **basename** 뿐이고 checker 파일은 허용된다 — terminal 여부와 무관하다 ([`subagent-call-contract.md §7`](../../docs/subagent-call-contract.md) 실측표). 완료 시 task-notification.

### 3. SUMMARY 기록 + 결과 확인

Workflow 반환값 (항상 경로+전문):
- `summary_output` — SUMMARY 절대경로. `summary_markdown` — 통합 SUMMARY **전문 (항상 채워짐)**. `summary_written` — workflow 내 summary write 성공 여부(**거의 항상 false 가 정상** — 하네스가 `SUMMARY.md` basename 차단). `block` — YES/NO.
- `checkers[]` — `{name, status, has_report}`. `has_report:false` 는 그 checker 의 findings 를 **아무것도 확보 못 했다**는 뜻 → Critical 을 숨기고 있을 수 있다.
- `recovered[]` — 계약을 어기고 파일 대신 텍스트로 전문을 반환한 checker. 스크립트가 전문을 건져 summary 에 넘겼고 파일 영속화도 지시했다. `ls` 로 확인.
- `unfinished[]` — **전문조차 확보 못 한** checker(파일도 없고 반환 본문도 없음). 비어있지 않으면 해당 checker 만 재실행. status 가 success 가 아니어도 전문이 있으면 여기 포함되지 않는다 — 재실행 불요.

**반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 — `summary_written` 값과 **무관하게 멱등 persist**. 하네스가 `SUMMARY.md` 를 어떤 sub-agent 도 못 쓰게 막고 workflow 스크립트는 FS 접근이 없으므로, **로컬 SUMMARY 의 유일한 경로가 main 의 이 Write** 다. 그 다음 반환의 `block` (또는 기록한 SUMMARY 상단)으로 `BLOCK: YES/NO` 판정.

### 3.5 NERV 제출 (main 의 의무)

절차는 `code-review-agents` SKILL §4 와 같고 `kind=consistency` 만 다르다.

- **제출**: `python3 .claude/tools/nerv_review_payload.py <session_dir>` 가 checker 리포트를 checker 별 제출 묶음으로 바꾼다(kind 는 세션 경로에서 `consistency` 로 읽는다). 묶음마다 `nerv_review_submit(kind=consistency, …)` 를 부른다(인자 · `idempotency_key` · `changeset` 은 그 절. 키의 `<mode>` 는 `spec` · `prep` · `done`). `--spec` · `--impl-prep` · `--impl-done` 결과 모두 같은 방법으로 낸다. 발견은 `nerv_finding_resolve` 로 처분한다.
- **하향 경고**: 출력의 `warnings[]` 에 `SUMMARY.md: … 하향 …` 이 있으면 SUMMARY 가 checker 의 `[CRITICAL]` 을 낮춘 것이다. 아래 §4 금지 조항 위반이니 SUMMARY 를 바로잡는다. NERV 판정은 checker 리포트로 서므로 SUMMARY 의 하향이 라운드를 통과시키지는 못한다.
- **`task_id` 규칙과 한계**: `task_id` 는 `--impl-done` 결과에만 붙인다. done 게이트는 Task 에 묶인 consistency 라운드를 보므로 구현 전 검토가 그 자리를 채우면 사후 검증 없이 done 이 된다. 다만 NERV 는 활성 클레임이 있으면 `task_id` 를 주지 않아도 제출을 그 Task 에 묶는다. 그래서 이 규칙만으로는 막지 못한다(2026-10-03, `CLE-T-VP5KDJ` 의 `--spec` 라운드 `01a0ff48-bb01…` 은 클레임 중이라 묶였고, 리스가 끝난 뒤 낸 `01a0ff87-a61b…` 의 첫 제출은 묶이지 않았다. `--impl-prep` · `kind=code` 는 따로 확인하지 않았다).
- **해야 할 일**: done 을 시도하기 전에 그 Task 에 묶인 `--impl-done` 라운드가 passed 인지 확인한다. `--spec` · `--impl-prep` 라운드만 있으면 done 을 시도하지 않는다.

> **재시도 정책 차이**: Workflow 경로는 옛 ScheduleWakeup cross-turn quota 자동 재시도를 갖지 않는다. 사전 쓰기 게이트(대화형 실행)라 수용 가능 — 한도 시 사용자가 재호출하거나 `unfinished` checker 만 다시 돌린다.

### (fallback) 수동 Agent 경로

Workflow 가 불가한 환경에서는 orchestrator 의 `--summary-state` / `--update <...> --agent <name> --status <s>` CLI + 직접 `Agent` fan-out + `Agent(consistency-summary, session_dir=<...>)` 로 동일 결과를 낼 수 있다 (state CLI 는 `test_orchestrator_state.py` 류로 검증되는 안정 인터페이스). loop_mode 시 ScheduleWakeup 재예약.

> **⚠ 직접 fan-out 은 Workflow 의 "전문도 반환" 보정이 없어** checker 가 Write 를 건너뛰면 결과가 사라진다. prompt 에 `output_file` Write 를 **명시적으로 지시하고 성공을 확인**시킬 것 ([`subagent-call-contract.md §7`](../../docs/subagent-call-contract.md)).
>
> **상태 기록은 자동이다** — `--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile 하므로 수동 호출 의무는 없다. (종전에는 `--update` 미호출로 `_retry_state.json` 이 prepare 스냅샷에 멈춘 채 커밋돼, 같은 세션 SUMMARY 의 "5/5 성공" 과 **모순되는 증거**가 남았다 — 2026-07-17 실측 한 브랜치 7개 세션. 이 파일은 `/loop --resume` 검증의 SoT 라 stale 이면 전 checker 재실행을 유발한다.) 커밋된 세션을 명시적으로 고치려면:
> ```bash
> python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py \
>   --sync-from-disk <session_dir>     # disk 가 심판 — 산출물 없는 agent 는 success 아님
> ```
>
> **fatal 을 손으로 해제할 때의 함정**: `agents_fatal` 은 JSON **∪** `_fatal/<name>` sentinel
> 로 재도출되므로, `_retry_state.json` 에서 이름만 지우면 다음 재조정이 sentinel 을 보고
> 조용히 되살린다. `--update <session_dir> --agent <name> --status rate_limit` 로 정규 경로를
> 태우거나, 손으로 한다면 두 곳을 함께 지울 것. 이 skill 도 같은 `_shared/retry_state.py` 를
> 쓰므로 동일하게 적용된다 — 상세: [`../code-review-agents/README.md`](../code-review-agents/README.md) §운영 함정.
>
> **소급 재분류 주의**: "산출물 존재" 판정이 "존재 + 비어있지 않음" 으로 강화된 뒤([`report_paths.py`
> `has_report()`](../../_shared/report_paths.py)) 이 정의는 과거에 이미 커밋된 세션에도 그대로
> 적용된다. 0바이트 placeholder 리포트를 가진 과거 세션에 `--summary-state`/`--resume` 를
> 실행하면(예: 감사·재조회 목적) 그 세션은 이제 "누락" 으로 재분류되고 `_retry_state.json` 이
> 갱신돼 워크트리가 dirty 해질 수 있다 — 조회만 했는데도.

### 4. BLOCK 처리

`BLOCK: YES` 발견 시:
- `developer` 안 호출이면 → 구현 진입 중단.
- 스펙 초안 검토면 → 검토 요청(`nerv_spec_submit_review`) 중단.
- 사용자 직접 호출이면 → 핵심 보여주고 결정 요청.

**Critical 하향은 금지다.** checker 의 `[CRITICAL]` 을 통합 단계에서 WARNING 으로 낮춰 `BLOCK: NO`
를 내는 것은 근거가 타당해 보여도 규약 위반이다. 호출자는 `BLOCK:` 줄을 읽고 다음 단계로 가기
때문이다(스펙 초안의 검토 요청 · 구현 착수). NERV 라운드는 checker 리포트로 판정하므로 그쪽은
하향에 속지 않는다. 제출 도우미가 하향을 경고로 알린다(§3.5). (`consistency-summary.md §요약 지침 3`)

**근본 원인이 스펙이면 (`developer` 턴의 스펙 drift 등) 스펙 초안으로 넘긴다.**
"구현은 끝났는데 스펙 표가 stale" 은 코드만으로 닫을 수 없는 정상적인 중간 상태다. 우회하지
말고 SUMMARY 의 **§planner 인계** 표를 근거로 NERV 스펙 초안(`/nerv:spec edit`)을 쓰고 검토
요청한 뒤 재실행한다. 초안은 developer 도 쓸 수 있고 승인은 사람이 한다(결정 D8). planner 가
`spec/` 을 바로 고치던 옛 흐름에서는 스펙 정정이 우회 설계보다 쌌다(3줄). 승인 대기가 들어간 지금
흐름의 비용은 아직 재지 않았다.

> 이 경로가 문서화되기 전에는 요약 에이전트가 스스로 하향을 발명해 진행했다
> (옛 `review/code/2026/07/25/22_58_00`, git 이력). 막다른 길처럼 보이면 우회가 생긴다 — 그래서 금지와
> 인계 경로를 함께 둔다.

## 호출자 워크플로

**스펙 초안 작성자**(project-planner · developer):
1. NERV 초안을 저장한다(`/nerv:spec new|edit`).
2. 초안 본문을 파일로 받아 `/consistency-check --spec <path>` 호출, `nerv_spec_check` 도 돈다.
3. `BLOCK: NO` 일 때만 검토 요청(`nerv_spec_submit_review`). Warning 은 초안 `## Rationale` 에 노트. 저장소 `spec/` 은 쓰지 않는다(미러는 구현 PR 이 pull 한다).

**developer**:
1. `/consistency-check --impl-prep <NERV 키 · 미러 폴더>` 를 구현 착수 전(보통 클레임 scope 의 `spec_ids`).
2. `BLOCK: YES` → 위임. Warning 은 Task 진행 기록에 남기고 진행.

## 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONSISTENCY_AGENTS` | `.claude.project.json` 이 켠 checker(이 저장소는 4개 전부) | 실행할 checker 쉼표 구분 |
| `CONSISTENCY_OUTPUT_DIR` | `./.review/consistency` | 결과 디렉토리 (gitignore, 커밋하지 않는다) |
| `CONSISTENCY_MAX_CONTEXT_SIZE` | `262144` | checker 1명분 prompt body 상한 |
| `AI_REVIEW_LOOP` | `0` | `1` → loop_mode=true |
| `DISABLE_CONSISTENCY_CHECK` | `0` | `1` 이면 비활성화 |

세션 디렉토리 스키마·디버그 로그 위치: `./README.md`.
