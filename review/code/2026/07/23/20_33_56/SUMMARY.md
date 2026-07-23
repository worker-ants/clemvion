# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 diff 자체(`guard_default_branch_bash.py` 세그먼트 분할 확장 + 관련 테스트/문서)는 독립적으로 안전하지만, 그 작업 과정에서 security 리뷰어가 **직접 실측으로 처음 문서화**한 별건 결함 — `guard_review_before_push.py` 의 `_GIT_PUSH` 정규식이 따옴표+공백 포함 `VAR=value` 접두(예: `GIT_SSH_COMMAND="ssh -i ~/.key" git push`)에서 탐지 자체에 실패해 **mandatory review-before-push 게이트 전체가 완전히 침묵 상태로 우회**되는 문제 — 가 현재 코드베이스에 살아있는 채로 남아 있다. 이번 PR 은 이를 고치지 않고(코드 unchanged, cross-reference 주석만 추가) `plan/in-progress/harness-guard-followups.md` §J("차단성, 최우선")로 투명하게 별건 PR 위임했으므로 **은폐·회귀는 아니나**, 알려진 CRITICAL 등급 게이트 우회가 미해결 상태로 방치되는 기간의 리스크가 존재해 전체 위험도를 CRITICAL 로 표기한다. forced(router_safety) reviewer 7명은 전원 결과를 확보했으며 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `_GIT_PUSH` 정규식이 따옴표+공백 포함 `VAR=value` 접두(예: `GIT_SSH_COMMAND="ssh -i ~/.key" git push`)에서 매치 실패 → `_is_git_push()` 가 `False` 반환 → `main()` 이 526행에서 즉시 `return 0` 하여 REVIEW/PLAN 게이트를 전혀 호출하지 않음. fail-open 관측 로직(`outcome.degraded`)도 거치지 않는 완전 침묵 우회. 이번 diff 는 이 결함을 처음 실측·문서화했으나 코드는 고치지 않고 별건 PR(§J)로 위임함 — 미해결 상태로 남음 | `.claude/hooks/guard_review_before_push.py:96-98`(`_GIT_PUSH`), `:526`(`if not _is_git_push(command): return 0`); 근거 `plan/in-progress/harness-guard-followups.md` §J(라인 425-455) | §J 별건 PR 착수를 "최우선" 라벨대로 이 PR 직후 최대한 가깝게 진행. 임시 완화책으로 탐지 실패 시에도 최소 관측 로그(예: `outcome.degraded`)를 남겨 완전 침묵을 줄이는 것을 고려 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` 정책 SoT 문서 `worktree-policy.md` §5 의 구분자 서술("`&&`/`||`/`;`/`|`/개행")이 이번 diff 로 코드에 의도적으로 추가되고 테스트로 고정된 단일 `&`(백그라운드) 구분자를 누락. 코드(`guard_default_branch_bash.py:24-25` docstring)·plan·테스트(`SegmentTest::test_mutating_command_after_separator_is_caught`, `"sleep 5 & rm -rf x"`)는 전부 6종을 일관되게 서술하는데 정책 문서 한 곳만 5종으로 정지돼 있음 — 코드가 옳고 spec 문서가 낡은 케이스 | `.claude/docs/worktree-policy.md:73` | 코드 변경 불필요. `worktree-policy.md:73` 구분자 나열에 `&`(단일, 백그라운드) 추가하여 코드·테스트·docstring과 동기화 (project-planner/resolution-applier 경로) |
| 2 | MAINTAINABILITY | §J(push 가드 env-prefix 우회) 교차 참조 주석이 실제 결함 지점인 `_GIT_PUSH`(96-98행, "DO NOT EDIT" 경고 있음) 옆이 아니라 무관한 `_SEGMENT_IS_GIT`(release 방향이라 안전) 옆에 붙어 있어, "the `\S+` above" 가 어느 정규식을 가리키는지 모호함. §J 를 별건 PR로 고치러 오는 담당자가 plan 문서를 먼저 읽지 않으면 잘못된 정규식을 고칠 위험 | `.claude/hooks/guard_review_before_push.py:142-148`(주석 실제 위치) vs `:96-98`(`_GIT_PUSH`, 실제 결함 지점) | `_GIT_PUSH` 정의 위/옆에 "이 패턴의 env-prefix 그룹도 `\S+` 라 따옴표 값 push 를 놓친다 — §J, 별 PR" 한 줄을 직접 추가해 결함과 포인터를 같은 자리에 둘 것 |
| 3 | TESTING | 이 PR 의 마지막(작은) 커밋이 HEAD 가 되는 순간 기존 회귀 테스트 `test_line_anchors.py::test_diff_blocks_are_annotated_and_correct` 가 RED 로 전환됨(`AssertionError: 13 not greater than 20`). `_prepare_commit()` 이 `--commit HEAD` 1개 커밋의 diff 크기에 결속되는 기존 설계 결함이며, 리뷰 대상 파일들의 결함은 아님(origin/main 기준 별도 임시 worktree 로 배제법 검증: PASS). 다만 RESOLUTION.md 의 "하네스 전체 513건 OK" 검증 문구가 최종 HEAD 기준으로는 재현되지 않음 | `.claude/tests/test_line_anchors.py:387-406`(`_prepare_commit()`); 트리거 커밋 `004d33ccb` | 이번 PR 코드 조치 불필요(이후 커밋이 얹히면 자연 치유). `test_diff_blocks_are_annotated_and_correct` 도 `test_whole_file_blocks_are_numbered_and_correct` 처럼 고정 fixture 로 우회하는 후속 항목을 백로그에 등록 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE | 두 훅 파일이 동일 심볼명 `_SEGMENT_SPLIT` 을 서로 다른 정규식·역할(전체 세그먼트 분할 vs heredoc 소유권 판정용 단일 세그먼트 추출)로 각각 정의 — 기능 결함은 아니나 이름만으로 "같은 개념이라 함께 갱신해야 한다"는 오해 소지 | `.claude/hooks/guard_default_branch_bash.py:146`, `.claude/hooks/guard_review_before_push.py:149` | 역할 기반 심볼명 분리(`_CHAIN_SEGMENT_SPLIT`/`_HEREDOC_OWNER_SPLIT`) 고려. 차단 사유 아님 |
| 2 | PERFORMANCE | `main()` 에서 비용이 커진 `_is_mutating()`(세그먼트 분할+반복 검사)이 저렴한 `_already_warned()`(세션당 1회 유효, 파일 존재 확인)보다 먼저 실행되어, 이미 넛지가 끝난 세션의 후속 호출에서도 불필요한 정규식 비용을 반복 지불 | `.claude/hooks/guard_default_branch_bash.py:200-205`(diff 밖, 비용 구조만 변경) | `_already_warned(session_id)` 를 `_is_mutating()` 보다 먼저 검사하도록 순서 변경 고려. 프로세스 재기동 비용에 묻히는 수준이라 우선순위 낮음 |
| 3 | REQUIREMENT / TESTING | env-prefix 정규식의 잔여 미탐지 2종 — 따옴표 없는 빈 값(`VAR= git commit ...` → `False`)과 닫히지 않은 따옴표(`A="unclosed git commit` → `False`) — 둘 다 실측 확인됨. soft nudge(비차단) 훅이라 실질 위험은 낮으나 `EnvPrefixTest`/`OutOfScopeTest` 패턴으로 명시 pin 되어 있지 않음 | `.claude/hooks/guard_default_branch_bash.py:98`(env-value alternation) | 우선순위 낮음. 필요 시 `EnvPrefixTest`/`OutOfScopeTest` 에 두 케이스를 명시 pin |
| 4 | TESTING | `guard_default_branch_bash.py` 의 오케스트레이션 경로(`main`, `_read_payload`, `_already_warned`, `_mark_warned`, `_state_dir`)는 여전히 테스트 0건 — 이번 diff 는 분류기(`_is_mutating`)만 12건으로 채움(스코프상 타당) | `.claude/hooks/guard_default_branch_bash.py:120-224` | 다음에 이 파일을 건드릴 때 `main()` 레벨 테스트(세션 dedup 로직 회귀 방지) 추가 권장 |
| 5 | DOCUMENTATION | 모듈 docstring 신규 문단에 주어-동사 불일치("classes ... that opens" → "that open") | `.claude/hooks/guard_default_branch_bash.py:31-33` | "that opens" → "that open" 오타 정정 |
| 6 | DOCUMENTATION | 직전 라운드 산출물 `review/code/2026/07/23/20_02_29/testing.md` 에 sub-agent 반환 프로토콜(STATUS 헤더+구분자)이 본문에 그대로 남아 같은 세션의 다른 6개 reviewer 파일과 형식이 불일치 (기능 영향 없음) | `review/code/2026/07/23/20_02_29/testing.md:1-2` | 우선순위 낮음(과거 산출물 사후 수정 실익 적음). 향후 orchestrator 저장 시 STATUS 헤더 제거 점검 권고 |
| 7 | SCOPE | plan §J(push 가드 env-prefix 우회, 차단형 게이트) 신규 섹션 전체가 원 작업 범위(§C won't-do 종결 + 세그먼트 FN 해소)와 무관한 별도 이슈로 같은 diff 에 함께 커밋됨 — 코드 수정 없이 기록·후속 위임만이라 기능적 스코프 침범은 아님 | `plan/in-progress/harness-guard-followups.md` 라인 425-480(§J 신설 + 체크리스트) | 조치 불필요(별도 PR 위임 명시됨). 혼동 방지용 "발견·기록만" 한 줄이 이미 있어 유지하면 충분 |
| 8 | SCOPE | 이미 `plan/complete/` 로 이동된 완료 문서에 순수 forward-reference 4줄을 사후 append — "완료 문서는 건드리지 않는다" 원칙의 예외 사례(내용 재작성 아님) | `plan/complete/harness-push-guard-subcommand-detection.md:166-172` | 조치 불필요. 유사 사례 반복 시 컨벤션 문서에 예외 패턴 기록 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `_GIT_PUSH` 따옴표 env-prefix 우회로 review-before-push 게이트 완전 무력화(pre-existing, §J 별건 PR 위임됨) |
| performance | LOW | `_is_mutating` 호출 순서 상수-배수 비효율(INFO), ReDoS 없음 실측 확인 |
| architecture | LOW | 두 파일 간 `_SEGMENT_SPLIT` 심볼명 중복 사용(INFO), `_lib/` 공유 거부 결정은 타당 |
| requirement | LOW | SPEC-DRIFT(정책 문서 구분자 누락), env-prefix 잔여 갭 2종(INFO) |
| scope | LOW | §J 섹션·완료문서 사후편집이 원 작업 범위 밖 문서 확장이나 기능적 침범 아님 |
| side_effect | LOW | 넛지 트리거 범위 확대·오탐 2종은 의도된 트레이드오프로 pin 완료, 차단형 게이트 영향 없음 |
| maintainability | LOW | §J 주석 위치가 실제 결함(_GIT_PUSH)이 아닌 곳에 붙음(WARNING), 문서 중복 서술 다발 |
| testing | LOW | `test_line_anchors.py` 회귀(WARNING, pre-existing 설계 결함), 핵심 변경은 12/12 테스트 통과 |
| documentation | LOW | SPEC-DRIFT 정책 문서 누락(WARNING 중복), §J 주석 위치 오류(WARNING 중복), 오타 1건 |

## 발견 없는 에이전트

없음 — 실행된 9개 에이전트 전원이 최소 1건 이상의 INFO 이상 발견을 보고했다.

## 권장 조치사항
1. **(최우선, CRITICAL)** `plan/in-progress/harness-guard-followups.md` §J — `_GIT_PUSH` 의 따옴표+공백 env-prefix 탐지 실패로 인한 review-before-push 게이트 완전 우회를 해소하는 별건 PR을 이 PR 직후 최대한 가깝게 착수한다(byte-for-byte 핀 갱신 + 코퍼스 확장 + 뮤테이션 동반 필요).
2. `worktree-policy.md:73` 의 구분자 서술에 단일 `&`(백그라운드)를 추가해 코드·테스트·docstring과 동기화한다(SPEC-DRIFT 해소).
3. `guard_review_before_push.py` 의 §J 교차 참조 주석을 실제 결함 지점(`_GIT_PUSH`, 96-98행) 옆으로 옮기거나 명시적으로 지칭하도록 수정해 향후 §J 작업자의 오수정 위험을 제거한다.
4. `test_line_anchors.py::test_diff_blocks_are_annotated_and_correct` 를 `--commit HEAD` 크기에 결속되지 않는 고정 fixture 방식으로 리팩터링하는 후속 항목을 백로그에 등록한다.
5. (낮은 우선순위) docstring 오타 정정, env-prefix 잔여 갭(빈 값·닫히지 않은 따옴표) 명시 pin, `main()` 오케스트레이션 경로 테스트 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터가 이번 diff 스코프(하네스 훅 정규식·문서)에 해당 없음으로 판단(신규 의존성 변경 없음) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음(순수 함수·정규식 분류 로직) |
  | api_contract | API 계약 변경 없음(내부 하네스 훅) |
  | user_guide_sync | 사용자 대상 가이드/문서 변경 없음(내부 개발 하네스 문서만 해당) |