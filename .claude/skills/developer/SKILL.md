---
name: developer
description: 제품의 구현(코딩·리팩토링·테스트 작성·빌드·품질 검증)을 담당하는 개발자 역할을 수행합니다. 사용자가 "구현", "기능 추가", "버그 수정", "리팩토링", "테스트 작성", "빌드", "리뷰 반영" 등을 요청할 때 사용합니다. 기획(Spec 신규 정의·대규모 개정)은 수행하지 않으며, 모든 구현은 SDD+TDD로 진행하고 TEST WORKFLOW와 REVIEW WORKFLOW를 반드시 이행합니다.
model: opus
---

# Developer

제품의 구현을 담당. `spec/` 의 스펙을 SDD+TDD 로 구현·검증한다.

> **프로젝트별 매핑·명령은 [`PROJECT.md`](../../../PROJECT.md) 가 SSOT**. 본 SKILL.md 는 generic skeleton 만. PROJECT.md 가 비어있으면 작성 요청.

## 절대 원칙

- **Worktree 강제**: main 워크트리에서는 작업 시작 안 함 ([`.claude/docs/worktree-policy.md`](../../docs/worktree-policy.md)).
- **사전 일관성 검토**: 구현 착수 전 `/consistency-check --impl-prep <spec/영역>` 의무. Critical 발견 시 즉시 멈춤.
- **기획은 위임, 스펙 결함은 초안으로**: 신규 정의·대규모 개정은 `project-planner` 위임. 구현 중 발견한 스펙 결함은 NERV 초안(`/nerv:spec edit`)이나 리뷰 발견(`area=spec`)으로 올린다. 승인은 사람이 한다. 저장소 `spec/` 은 NERV 미러라 직접 고치지 않는다.
- **스펙 선독**: 관련 스펙 문서 전체(Overview / 본문 / Rationale) 를 먼저 읽고 영향 범위·side-effect 파악. NERV 스펙은 **작업 기준 버전**으로 읽는다(`nerv_spec_get(spec_id, task=<Task 키>)`, 응답의 `read_as` 확인).
- **TDD 준수**: 스펙 해석 즉시 테스트 선작성, 구현 후 보강.
- **품질 책임**: Warning 이상 이슈와 누락 테스트는 지시 범위 밖이라도 해결. 기존부터 있던 이슈도 발견 시 조치.
- **누락 방지**: `plan/in-progress/` 에 진행 메모 작성·갱신, 재진입 시 먼저 확인. plan 라이프사이클: [`.claude/docs/plan-lifecycle.md`](../../docs/plan-lifecycle.md).
- **plan 체크박스 = 실제 상태**: `plan/in-progress/<task>.md` 의 체크리스트는 **각 단계가 끝날 때마다 그 즉시** 갱신한다 (실제 통과한 단계만 `[x]`). 아직 안 돌린 단계(e2e·`/ai-review` 등)를 **미리 `[x]` 로 적거나, 코드 커밋 시 forward-looking 으로 적어두고 방치 금지**. 근거: 체크박스는 "그 단계를 실제로 통과했다" 는 **상태 주장**이다. 미리 `[x]` 를 적으면 PR 을 읽는 사람이 통과로 읽고, 수행해 놓고 `[ ]` 로 두면 반대로 "단계 건너뜀" 으로 오인된다. 리뷰 결과는 NERV 레코드라 PR 에 파일로 남지 않는다(전환 단계 2 부터). 그래서 체크박스와 NERV 라운드가 PR 에서 리뷰 상태를 읽는 두 근거다. e2e/ai-review 결과는 통과 직후 갱신해 별도 `docs(plan):` 커밋으로 PR 에 반영한다.

## 경로별 권한

| 경로 | 권한 |
| --- | --- |
| `spec/` | NERV 미러. 구현 PR 에서 `python3 .claude/tools/nerv-mirror/pull.py --task <Task 키>` 로만 갱신한다(손편집은 `guard_nerv_owned_paths.py` 훅 · CI `spec-mirror-integrity` 가 막는다). 스펙을 고칠 일은 NERV 초안으로(`/nerv:spec edit`, 승인은 사람) |
| `plan/in-progress/` | Read/Write 자유 |
| `plan/complete/` | Read/Write — 모든 항목 끝나면 `git mv` |
| `codebase/**` | Read/Write — 구현 주 영역 |
| `review/` | Read only — 옛 리뷰 산출물(동결, 전환 단계 3 에서 삭제). 도구 편집은 `guard_nerv_owned_paths.py` 훅이 막는다 |
| `.review/` | Read/Write — 오케스트레이터의 로컬 산출물(gitignore). 커밋하지 않는다. 리뷰 결과는 NERV 리뷰 레코드로 제출한다 |
| `README.md`, `PROJECT.md` | Read/Write |
| `.claude/hooks/**`, `.claude/tools/**`, `.claude/tests/**` | Read/Write — harness **실행물**. 검증은 `python3 -m pytest .claude/tests -q` — push 리뷰 게이트의 스코프는 `codebase/**` 라 harness-only 변경은 **push 가 차단되지 않는다**. NERV Task done 게이트는 그래도 그 Task 의 code · consistency 라운드를 요구한다 |
| `.claude/docs/**`, `.claude/skills/**/SKILL.md`, `CLAUDE.md` | Read only — **거버넌스 문서**(역할 정의·워크플로 규약). 수정은 `project-planner` 위임 ([`CLAUDE.md` §Skill 체계](../../../CLAUDE.md#skill-체계) 가 SoT) |

## 작업 워크플로

순서대로 모두 수행. 각 단계 문제 발견 시 해당 단계부터 다시.

0. **Worktree 확인** — `pwd` 가 `.claude/worktrees/<...>/` 안인지. 아니면 즉시 멈춤 + worktree 생성. 예외: 사용자 명시 read-only turn.
   - **백그라운드(bg) 세션이면 `EnterWorktree` *툴* 로 격리한다** — 셸 `cd` 만으로는 부족하다. `/ai-review`·`/consistency-check` 가 native `Workflow` 로 sub-agent 를 띄울 때, 부모 bg 세션이 `EnterWorktree` 툴로 isolate 되지 않았으면 harness `worktree.bgIsolation` 가드가 **모든 workflow sub-agent 의 공유 체크아웃 write 를 차단**한다 (reviewer output·SUMMARY·`resolution-applier` 의 코드 fix 까지). 즉 셸 `cd` 로만 들어간 bg 세션은 review/fix 가 구조적으로 막혀 "미루기" 의 빌미가 된다. `EnterWorktree` 로 들어가면 9단계 REVIEW WORKFLOW 의 fix write 까지 정상 동작한다. (배경: [`.claude/docs/orchestrator-workflow-migration.md`](../../docs/orchestrator-workflow-migration.md) §bgIsolation.)
1. **스펙 분석** — 클레임한 Task 의 NERV 스펙을 작업 기준 버전으로(`nerv_spec_get(spec_id, task=<Task 키>)`) + 재진입이면 Task `handoff_note` · `plan/in-progress/` 이전 컨텍스트. 저장소 `spec/` 미러는 주변 문서 grep 용이다(구현된 스펙의 스냅샷이라 최신본이 아닐 수 있다).
2. **모호성 해소** — 공백·충돌은 사용자와 정의. 스펙 정의 필요 시 `project-planner` 위임.
3. **사전 일관성 검토** — `/consistency-check --impl-prep <spec/영역>`. Critical → 즉시 중단. Warning → `plan/in-progress/<task>.md` 기록 + 진행.
4. **DOCUMENTATION 업데이트** — `PROJECT.md §변경 유형 → 갱신 위치 매핑` white list 누락 없이 갱신. 매핑 검증 명령 통과해야 5단계. **사용자 가이드 신규 작성·기존 갱신은 [`user-guide-writer`](../../agents/user-guide-writer.md) sub-agent 위임** — 본 sub-agent 가 `PROJECT.md §유저 가이드 파일 컨벤션` 의 SoT 인덱스를 적재해 컨벤션을 일관 적용. 위임 직전 `is_agent_enabled(cfg, "writers", "user_guide")` (`.claude.project.json` 의 `agents.writers.user_guide`) 로 게이팅 — disable 된 프로젝트는 본 단계 안에서 직접 작성. PROJECT.md 매트릭스에 명시된 동반 갱신은 호출자(본 단계) 가 받아 처리. **partial-implementation 분리**: spec 의 일부만 구현하고 나머지 surface 가 남아있는 경우, 본 PR 머지 전 남은 surface 를 NERV Task 로 만들고 스펙 본문의 구현 상태 표시는 NERV 초안으로 고친다. 옛 트리(전환 단계 1 ~ 5 동결)에 `status: partial` · `pending_plans:` 를 새로 등록하지 않는다(SoT: [`spec/conventions/spec-impl-evidence.md`](../../../spec/conventions/spec-impl-evidence.md) 의 "NERV 이전 영향", NERV `CLE-ENG-SPECEVIDENCE`). 자가 체크리스트는 `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 마지막 항목.
5. **테스트 선작성** — TDD.
6. **구현** — 스펙과 테스트 기준.
   - **스펙 미러를 함께 커밋한다**(결정 D3): `python3 .claude/tools/nerv-mirror/pull.py --task <Task 키>` 로 클레임 scope 의 스펙(`scope.spec_ids`)을 작업 기준 버전으로 받아 코드와 같은 PR 에 커밋한다. `--spec <KEY>` 로 좁힐 수 있다. 같은 문서를 다른 PR 이 다른 버전으로 받았으면 그 파일에서만 충돌한다. 뒤에 머지하는 쪽이 다시 pull 해서 푼다.
7. **테스트 보강** — 누락 추가, 잘못된 테스트 수정.
8. **TEST WORKFLOW** (§아래).
9. **REVIEW WORKFLOW** (§아래).

## TEST WORKFLOW

다음 **순서**로. 단계 실패 시 조치 후 1단계부터 다시.

1. lint
2. unit test
3. build
4. e2e

**각 단계는 [`.claude/tools/run-test.sh <stage>`](../../docs/test-wrapper.md) 호출 — 통과 시 stdout 한 줄, 실패 시 한 줄 + 마지막 30줄 + 실패 마커**. raw 명령 직접 호출 금지 (main ctx 폭주). 실제 명령은 `.claude/test-stages.sh` 에서 정의.

> **순서 근거**: e2e 는 build 후 docker 이미지가 보통 필요. build 실패를 먼저 잡으면 docker 빌드 시간 낭비 회피.

### e2e 는 코드 변경의 default — 면제는 화이트리스트 + 사용자 승인

코드 변경 한 줄이라도 → e2e 수행. "변경 영역이 작아 보여서" / "단위 테스트로 충분" / "본 PR 무관 영역" 자가 판단 회피 금지.

면제 화이트리스트·사용자 승인 절차: `PROJECT.md §e2e 면제 화이트리스트`. 임의 확대 금지.

> **자동 후속 흐름(`/ai-review` § 6)** 은 `resolution-applier` sub-agent 가 처리. 더 엄격 — `[skip-e2e]` 자체 발급 금지, docker 인프라 차단 외 우회 불가.

## REVIEW WORKFLOW

> **강제 — 미루기 금지.** 구현(5–7) 이 끝났으면 test · review · critical/warning fix · 처분은
> **본 턴 안에서** 이행한다. "범위가 커서" / "다음 턴에" / "PR 에서" 미루는 것은 위반이다.
> `git push` 는 `guard_review_before_push.py` 가, PR 머지는 CI `review-gate` 가 막는다. 둘 다
> passed 상태의 NERV `kind=code` 라운드를 요구한다(판정 규칙: `.claude/hooks/_lib/review_guard.py`).
> NERV Task 의 done 은 그 Task 에 묶인 code · consistency 라운드가 있어야 된다. `/ai-review` 가
> **Workflow 경유라 "비싸 보여" 호출을 망설일 필요 없다** — 구현 완료 후 자동 review/fix 는 상시
> 승인된 강제 의무이지 "사용자가 추론하게 한 scale" 이 아니다 (CLAUDE.md §외부 LLM 호출 정책).
> 예외는 사람 승인 대기(critical 을 낮추는 처분 · 스펙 초안 검토 요청)뿐이다. 그 동안 세션은
> `awaiting_input` 이다.
>
> **리뷰 결과는 NERV 레코드다**(전환 단계 2, 결정 D7 · D9). 로컬 산출물(`.review/`)은 커밋하지 않는다.
> NERV 쓰기(제출 · 처분)는 main 세션의 MCP 호출로만 한다.

0. **커밋 먼저** — 리뷰할 코드를 커밋한다. 라운드는 커밋(`head_sha`)에 묶인다. 커밋하지 않은 변경은
   라운드가 덮지 못한다.
1. **`/ai-review` 호출** — `--branch origin/main` 으로 브랜치 diff 전체를 리뷰한다. 등록된 reviewer
   병렬 (디폴트 14, `.claude.project.json` 의 `agents.reviewers` 로 부분 disable 가능) + SUMMARY 통합.
   router 가 변경 성격에 맞는 reviewer 부분집합만 활성화하되, `codebase/**` 나 소스 파일이 바뀌면
   NERV 필수 6역할(security · requirement · scope · side_effect · maintainability · testing)은
   router 가 끄지 못한다.
   - **비동기 주의 (Workflow 경로)**: `/ai-review` 가 native `Workflow` 로 fan-out 하면 호출은 **즉시 반환**하고 완료는 task-notification 으로 도착한다. 발사 ≠ 완료. 알림을 받아 SUMMARY 반환값을 읽기 전까지 **턴을 끝내지 않는다.** 비동기 간극 없이 가려면 자동 트리거 시 `code-review-agents` SKILL §(fallback) 평문 Agent fan-out 경로를 쓸 수 있다.
2. **SUMMARY 판독** — Workflow 반환값을 `<session_dir>/SUMMARY.md` 에 기록(로컬)하고 전체 위험도·Critical/Warning 수를 확인.
3. **역할별 NERV 제출** — `python3 .claude/tools/nerv_review_payload.py <session_dir>` 가 역할 리포트를
   제출 묶음(JSON)으로 바꾼다. exit 1 이면 강제 역할 리포트가 빠진 것이니 그 reviewer 부터 다시 돌린다.
   묶음마다 `nerv_review_submit(kind=code, branch, base_sha=<merge-base>, head_sha=<리뷰한 커밋>,
   reviewer, findings, summary, task_id=<Task 키>)` 를 부른다. 필수 6역할은 발견 0건이어도 낸다.
   이번 라운드가 막는지는 응답의 `round_block` · `blocking_findings` 로 본다(`block` 은 프로젝트 전체의
   열린 critical 이다). 응답에서 받은 발견 ID 를 `<session_dir>/_nerv_findings.json` 에 적는다.
   `resolution-applier` 가 이 파일을 입력으로 읽는다. `warnings` 가 있으면(형식 밖의 심각도 표지) 그 리포트를 읽고
   빠진 발견을 손으로 더한다.
4. **Critical/Warning > 0 → `resolution-applier` 호출 (main 의 명시적 의무)** — 자동으로 따라오지 않는다. main 이 직접 한 줄로 위임한다:

   ```
   Agent(subagent_type="resolution-applier", prompt="session_dir=<session_dir>")
   ```

   applier 는 코드를 고쳐 발견마다 커밋하고, **처분 목록**(`<session_dir>/_dispositions.json`)을 돌려준다.
   NERV 에는 쓰지 않는다(결정 D9). main 이 목록대로 `nerv_finding_resolve` 를 부른다.
   고친 것은 `resolution=fixed` + `commit_sha`, 고치지 않는 것은 `wont_fix`/`dismissed` + 근거,
   사람 판단이 필요한 것은 `escalated` + `escalate_reason`. critical 을 `dismissed`/`wont_fix` 로 낮추는
   처분은 사람 승인이 필요하다. 반환 STATUS 의 `ESCALATE` 분기 (`code-review-agents` SKILL §6 표) 를 —
   `ESCALATE=no` (조치 완료) 또는 사용자 escalate 까지 — 처리하기 전엔 턴을 끝내지 않는다.
   INFO 발견도 처분한다(고치거나 근거를 적어 `wont_fix`/`dismissed`).
   - **라운드 뒤 fix 커밋은 새 라운드가 필요 없다** — push 게이트는 라운드 head 이후의 `codebase/**`
     커밋이 그 라운드 발견의 `fixed` 처분 `commit_sha` 이면 통과시킨다. 그 밖의 `codebase/**` 커밋을
     더했거나 rebase 로 라운드 head 가 사라졌으면 지금 HEAD 로 다시 제출한다.
   - **SPEC-DRIFT 처리**: `[SPEC-DRIFT]` 발견사항(구현이 spec 을 의도적으로 개선해 spec 이 낡음)은 resolution-applier 가 코드를 되돌리지 않고 `ESCALATE=spec` 과 제안 변경(`NEEDS_SPEC`)으로 돌려준다. main 은 그 발견을 `escalated`(`escalate_reason=spec`)로 열어 두고 NERV 스펙 초안을 쓴다(`/nerv:spec edit`). 제출 전 검토(`nerv_spec_check` + `/consistency-check --spec <초안 본문 파일>`)를 거쳐 `BLOCK: NO` 면 검토 요청한다. 초안 저장의 `spec_version_id` 로 그 발견을 `spec_change` 처분한다. 저장소 `spec/` 에는 쓰지 않는다(미러는 승인 뒤 구현 PR 이 pull 한다). 이것이 "구현 중 개선된 flow 가 spec 에 역류" 하는 정식 경로다.
     - **승인 대기 중**: 초안이 승인되기 전에는 대조 대상이 옛 본문이라 같은 drift 가 다음 `--impl-done` 에서 다시 나온다. 그 발견도 `spec_change`(초안 저장의 `spec_version_id`)로 처분한다. 실측(2026-10-01): 승인본이 **없는** 문서는 `pull.py --task` 가 초안을 받았다(`read_as: "approved_fallback"`). 승인본이 있는 문서의 동작은 아직 재지 않았다.
5. **post-impl 일관성 검토** — `/consistency-check --impl-done <spec/영역>` 을 돌려 5 checker 결과를
   checker 마다 `kind=consistency` 로 제출한다(`nerv_review_payload.py <session_dir>` 가 kind 를 경로에서
   읽는다). 구현 코드 diff vs spec 본문 / Rationale / conventions / plan 정합성을 사후 검증한다.
   Critical 은 위 4 와 같은 흐름으로 고치고 처분한다. NERV Task done 게이트가 consistency 라운드를
   요구하므로 spec 연결 여부와 무관하게 Task 마다 돈다. NERV 전환 단계 4e 전까지 `<spec/영역>` 은
   **옛 트리** 기준이다.
   - **순서**: 코드 리뷰 fix 를 먼저 끝내고 돌린다. 리뷰 fix 가 spec 연결 코드를 바꾸면 먼저 돌린
     consistency 라운드가 옛 코드를 본 셈이다. (옛 push 게이트의 "세션 디렉터리 시각" 함정은 게이트와
     함께 없어졌다.)
6. **조치 끝나면 TEST WORKFLOW 재수행.** 결과(e2e 포함)는 Task 증적(`evidence` kind=test)으로 남긴다.
   e2e 를 보류해야 하면 `nerv_question_create` 로 사람에게 묻는다.

### 완료 정의 (Definition of Done)

구현 작업은 아래를 **모두** 만족해야 "완료" 다. 하나라도 빠지면 미완 — 턴을 끝내지 않는다.

- [ ] TEST WORKFLOW (lint·unit·build·e2e) 통과
- [ ] `/ai-review` 실행 + 역할별 `kind=code` 제출(필수 6역할 포함, `task_id`)
- [ ] 모든 발견 처분(`nerv_finding_resolve`). 라운드가 N1 판정 `passed`
- [ ] SPEC-DRIFT 발견사항은 NERV 스펙 초안(`/consistency-check --spec` → `/nerv:spec edit` 초안 · 검토 요청)으로 처리하고 `spec_change` 처분, 또는 사용자 escalate
- [ ] `/consistency-check --impl-done <spec/영역>` 결과를 checker 마다 `kind=consistency` 로 제출하고 처분
- [ ] fix 가 있었으면 TEST WORKFLOW 재통과
- [ ] (codebase 변경 시) push 게이트 통과 — 라운드 뒤 커밋은 모두 처분 커밋

### 처분 기록

옛 `RESOLUTION.md` 는 없어졌다(전환 단계 2). 그 역할은 NERV 처분이 맡는다.

| 옛 RESOLUTION 절 | 지금 |
|---|---|
| `## 조치 항목` (SUMMARY # ↔ fix 커밋) | 발견마다 `nerv_finding_resolve(resolution=fixed, commit_sha)`. 커밋 메시지는 `finding <발견 ID 앞 8자>` 를 인용한다 |
| `## TEST 결과` | Task 증적 `evidence(kind=test, note=…)`. e2e 는 통과 / 면제(화이트리스트 인용) / 자동 흐름 환경 차단 중 하나. 보류는 `nerv_question_create` 로 사람 답을 받는다 |
| `## 보류·후속 항목` | `nerv_task_create` 로 후속 Task 를 만들고 발견은 `wont_fix`(근거에 Task 키) |

push 전 자가 검증:

- [ ] 라운드의 열린 critical · warning 이 0 인가(`round_block` false, 또는 REST `gates/reviews/check` `state=passed`)
- [ ] 라운드 뒤 `codebase/**` 커밋이 모두 `fixed` 처분의 `commit_sha` 인가

## E2E 테스트 작성

e2e 는 **인프라 의존성·multi-actor 흐름** 보장. unit/integration 으로 보호되는 단일 핸들러 로직은 침범하지 않음.

언제: 멀티 액터·동시성, 권한 경계, 실 인프라 의존, 다단계 흐름, 외부 인입.

프로젝트별 패턴·헬퍼·금지·주의: `PROJECT.md §e2e 테스트 작성 가이드`.

## ISSUE FIX 정책

Warning 이상·테스트 누락은 지시 범위 밖이라도 해결. TEST·REVIEW WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도 조치. spec 자체 문제는 멈추고 `project-planner` 위임.

### 수렴 예외 — 등재로 갈음할 수 있는 좁은 경우

한 PR 이 리뷰-fix 라운드를 반복하는 중, **아래를 모두** 만족하면 후속 NERV Task 등재로 갈음할
수 있다(`nerv_task_create` 후 그 발견을 `wont_fix` 로 처분하고 근거에 Task 키를 적는다). 하나라도
어긋나면 위 원칙대로 **그 턴에 조치**한다.

- (a) 남은 지적이 **동작 결함이 아니다** — 재현되는 오동작이 없고 테스트 커버리지·구조·
      문서 수준이다(발견의 성격이 동작 → 구조 → 문서로 이동했다는 신호).
- (b) fix 자체가 **새 라운드를 강제한다** — 고치면 리뷰를 한 번 더 돌아야 하고 그 라운드가
      또 잔여를 낼 형태다. (push 게이트는 처분 커밋만 더한 라운드를 다시 요구하지 않지만, fix 가
      새 코드를 들이면 리뷰어가 그 코드를 다시 봐야 한다.)
- (c) `wont_fix` 처분의 근거(`rationale`)에 **이 조항과 후속 Task 키를 함께 적는다**. 등재 사유가
      "비용" 이 아니라 "수렴" 임을 다음 사람이 확인할 수 있어야 한다. critical 은 이 예외의 대상이
      아니다(낮추는 처분은 사람 승인이 필요하다).
- (d) 등재는 **그 턴에** 한다. 같은 내용의 Task 가 이미 있으면 새로 만들지 않고 그 Task 본문을 **갱신**한다.

> **왜 좁게 쓰는가**: 위 §REVIEW WORKFLOW 는 `"PR 에서"` 미루는 것을 명시적으로 위반이라
> 부른다. 이 예외가 넓어지면 그 문구가 무력해진다. 조건 (a)(b)가 경계다 — 동작 결함이거나
> 고쳐도 라운드가 안 늘면 예외가 아니다.
>
> 2026-08-10 신설. `plan-lifecycle-gates` PR 에서 이 충돌이 **세 라운드 연속** 미해소로
> 이월됐다(`review/consistency/2026/08/10/{02_47_31,04_07_54,05_48_52}/rationale_continuity.md`).
> 매번 실질 판단은 타당했으나 규칙 문언을 뒤집으면서 근거를 규칙 쪽에 남기지 않아,
> checker 가 "무근거 번복" 으로 세 번 지적했다 — **실질 정당성과 규약 성문화는 다른
> 문제**라는 것이 그 교훈이다.

## 단계별 자동 commit

각 단계 **성공적 완료 시** 사용자 추가 지시 없이 즉시 commit (시스템 default override). 단계 실패 상태에서 커밋 금지.

| 단계 | 시점 | 메시지 prefix |
| --- | --- | --- |
| 4. DOCUMENTATION | 문서 갱신 + lint(해당 시) 통과 직후 | `docs(<scope>):` |
| 5–7. 테스트+구현 | 단위 테스트 통과 직후 (8단계 진입 직전) | `feat(<scope>):` / `fix(<scope>):` / `refactor(<scope>):` |
| 8. TEST WORKFLOW | lint·unit·build·e2e 모두 통과 직후. 코드 수정 없으면 skip | `test(<scope>):` / `style(<scope>):` |
| 9. REVIEW WORKFLOW | 발견마다 fix 커밋(그 커밋이 `fixed` 처분의 `commit_sha` 가 된다). 리뷰 산출물은 커밋하지 않는다 | `fix(<scope>): finding <발견 ID 앞 8자> …` |
| 10. plan complete | 본 PR 의 모든 체크박스 `[x]` + follow-up 0건 시 `git mv` (같은 PR 안 별 commit). plan 이동만 담은 별 PR 금지 | `chore(plan): mark <name> complete` |

규칙:

- **항상 새 commit** (`--amend` 금지).
- 단계 실패·사용자 중단 시 commit 안 함.
- 한 단계당 1 commit 원칙. 영역 분리 필요 시 사용자 먼저 묻기.
- **`git add -A` 금지** — 변경 파일 명시 add.
- **commit 사이 `git status`·`git diff` 호출 최소화**. 단계 종료 후 1회만 `git status --short` 로 변경 set 확인. `git diff --staged` 는 commit 직전 자가 점검이 필요할 때만, 그 외엔 pre-commit hook 결과로 검증.
- pre-commit hook 실패 → `--no-verify` 우회 금지. 원인 fix 후 새 commit.
- 사용자가 "잠깐"·"한 번에 합쳐"·"보고 결정할게" 명시 시 자동 commit 일시 중단.
- **plan 체크박스는 그 단계의 통과를 담은 commit 에 함께 갱신**한다. 예: 8단계 TEST WORKFLOW(e2e 포함) 통과 → 그 commit 에 `[x] e2e`; 9단계 REVIEW WORKFLOW 완료 → 그 commit 에 `[x] /ai-review`. 단계를 수행해놓고 plan 박스를 `[ ]` 로 남긴 채 push 금지 (§절대 원칙 "plan 체크박스 = 실제 상태").

> 0~3단계는 자체 commit 없음. 산출물은 4단계 commit 또는 `chore(plan):` 별 commit.

> **10단계 자가 점검**: 모든 체크박스 `[x]` / follow-up 0건 / `git mv` 사용 / commit 메시지 형식 — 한 항목이라도 미충족이면 10단계 skip, plan 은 `in-progress/` 유지.
