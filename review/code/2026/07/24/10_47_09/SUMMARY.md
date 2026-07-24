# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `_is_git_push()`의 길이 상한 검사가 첫 정규식 검색 뒤에 위치해, 이 모듈이 이미 세 차례 고친 것과 동일 클래스의 O(n²) ReDoS 가 재현된다(실측: 688KB 입력에서 ~58초). 이 함수는 모든 `git push` 를 게이팅하는 PreToolUse hard gate 라서 지연은 세션 정지 또는 (harness 타임아웃 처리 방식에 따라) 리뷰 게이트 자체의 fail-open 우회로 이어질 수 있다. (forced whitelist 7개 reviewer 전원 결과 확보 — 누락 없음.)

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `_is_git_push()`가 `_MAX_REDACTION_INPUT` 길이 상한 검사보다 **먼저** 원본 `command` 전체에 `_GIT_PUSH.search()`를 실행한다. 구분자(`;`/`&&`/`\|`)로 나뉜 공백 없는 세그먼트가 다수 있으면 시작 위치 수 × 백트래킹 길이 = O(n²) 로 스케일링됨을 직접 재현(길이 2배마다 시간 ~4배, 688KB에서 ~58초). 이 훅은 "모든 push 를 동기 게이팅"하는 PreToolUse hard gate 라 지연이 곧 세션 정지 또는 fail-open 우회 수단이 될 수 있다. | `.claude/hooks/guard_review_before_push.py:345-372`(함수 `_is_git_push`, 특히 352의 무제한 첫 검색과 354의 뒤늦은 길이 검사) | 길이 상한 검사를 `_GIT_PUSH.search(command)` 첫 호출 **이전**으로 이동하거나(예: `if len(command) > _MAX_REDACTION_INPUT: return True`를 최상단으로), 최소한 `_push_targets`가 이미 하듯 `command[:_MAX_REDACTION_INPUT]`로 잘라서 첫 검색에 적용. 동일 alternation 을 공유한다는 자매 훅 `guard_default_branch_bash.py`도 함께 점검 권장(스코프 밖, 미확인). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Requirement | `.claude/tests/README.md` 47행이 이스케이프 안 된 리터럴 `\|` 로 3열로 쪼개져 닫는 `\|` 도 없다. GFM 표 규칙상 헤더(2열)보다 셀이 많은 행은 초과분이 렌더링에서 버려져, `_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리 근거와 `EnvValueSubpatternSharedTest` 설명 문단 전체가 GitHub 화면에서 사라진다. `git log -S`로 추적한 결과 origin/main PR #1003(커밋 `10441e1bc`)에서 이미 이 형태로 유입돼 이번 브랜치 병합 커밋(`26c8e86a3`)이 그대로 흡수했다 — 이번 작업이 신규로 만든 결함은 아니나 지금 이 상태로 push 될 파일 안에 실재한다. `test_tests_readme_catalog.py`는 행 선두 패턴만 검사해 이 결함 클래스를 잡지 못함. | `.claude/tests/README.md:47` | 47행의 리터럴 `\|`를 제거(또는 `\\\|`로 이스케이프)하고 문장을 같은 셀로 합친 뒤 행 끝에 닫는 `\|` 추가. 원인이 origin/main 쪽 PR이므로 그쪽에도 동일 수정 필요 가능성 기록. 재발 방지로 `test_tests_readme_catalog.py`에 행별 파이프 개수 검증 추가 고려(스코프 밖). |
| 2 | Maintainability | `_run_gates`의 REVIEW/PLAN 처리 블록이 (BYPASS 체크 → import 실패 처리 → `_evaluate_over_targets` 호출 → block 시 stderr+return 2) 동일 4단계를 손으로 두 번 반복. `_evaluate_over_targets`는 이미 콜백 기반으로 일반화돼 있음에도 호출부는 게이트 목록으로 추상화하지 않았다. 이 파일 스스로 "PLAN 게이트 스코핑이 REVIEW에만 테스트가 있어 검증되지 않았다"는 실제 결함 이력이 있어 drift 위험이 현실적. | `.claude/hooks/guard_review_before_push.py:692-739`(`_run_gates`) | `(env_var, evaluate_fn, import_error, gate_name, is_blocked, render)` 게이트 명세 리스트 + 단일 루프로 통합. |
| 3 | Maintainability | 테스트 헬퍼 `_run`이 커스텀 env(BYPASS_*, CLAUDE_PROJECT_DIR)·대체 스크립트 경로를 지원하지 않아 5개 테스트가 `subprocess.run(...)` 호출·env dict 구성·payload JSON 구성을 통째로 복붙. | `.claude/tests/test_push_guard_worktree_scope.py:195-214, 216-243, 303-348, 371-419, 437-478` | `_run`에 `extra_env`, `script` 키워드 인자 추가해 5개 테스트를 헬퍼 경유로 통합. |
| 4 | Testing | `main()`의 `finally` 도입 근거로 명시된 "블록 중에도 다른 게이트의 fail-open 이 조용해지면 안 된다" 시나리오(`test_per_target_fail_open_still_checks_remaining_targets`)가 `returncode==2`와 blocked target 문자열 포함만 검증하고, 실제 fail-open 배너/`REVIEW gate —` 문구가 stderr 에 출력되는지는 assert 하지 않는다. `finally`가 조기 예외로 스킵되거나 폴백 print 가 조용히 실패해도(내부 `except Exception: pass`) 이 테스트는 green 을 유지 — §E 관측성이 가장 필요한 조합이 회귀 시 감지되지 않는다. | `.claude/tests/test_push_guard_worktree_scope.py:286-301` / `.claude/hooks/guard_review_before_push.py:590-625, 741-744` | 동일/별도 테스트에서 `r.stderr`에 fail-open 배너 문구와 `REVIEW gate —` 항목 포함 여부 assert 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Fail-open 설계·`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`는 정책 결정(2026-07-23)으로 문서화된 의도. `traceback.print_exc`/예외 메시지 노출은 로컬 CLI 훅이라 실질 위험 낮음. | `.claude/hooks/guard_review_before_push.py` 여러 곳 | 조치 불요 — Critical #1 로 인해 위험 표면이 넓어진다는 점만 인지. |
| 2 | Side-effect | `git worktree list --porcelain` subprocess 가 양쪽 게이트를 BYPASS 한 push 에도 무조건 1회 실행됨. read-only·5s timeout·fail-open 으로 안전. | `.claude/hooks/guard_review_before_push.py:800`(호출)/`469-479`(`_worktree_branches`) | 필요 시 두 BYPASS 모두 켜진 경우 조기 스킵 고려(선택적 최적화). |
| 3 | Side-effect | `evaluate_review`/`evaluate_plan` 호출이 "1회" → "target(worktree) 수만큼"으로 증폭(내부 git subprocess 도 비례 증가). 두 함수 모두 read-only 확인, §E 스트릭 카운트는 gate 당 1회로 정확히 dedup. | `.claude/hooks/guard_review_before_push.py:645-689`(`_evaluate_over_targets`), `692-738`(`_run_gates`) | 향후 두 함수에 비-멱등 부작용 추가 시 이 증폭이 문제될 수 있음을 인지. |
| 4 | Side-effect | 워크트리 스코프 결정이 harness payload 의 `cwd` 필드에 새로 의존(이전엔 `os.getcwd()`만 신뢰). cwd 는 항상 target 에 포함되고 매칭은 subtract 불가한 allowlist 라 안전 방향으로만 열림. | `.claude/hooks/guard_review_before_push.py:798` | 조치 불요 — 설계 문서화 기존. |
| 5 | Maintainability | 삼항식이 백슬래시 줄바꿈으로 쪼개지며 둘째 줄 들여쓰기가 0칸으로 나머지 코드 스타일과 어긋남. | `.claude/hooks/guard_review_before_push.py:641-642`(`_import_reason`) | 괄호로 감싸거나 if/else 로 풀어써 스타일 통일. |
| 6 | Maintainability | 모듈 상단 정규식 관련 주석 밀도가 매우 높아(일부 20~40줄) 신규 기여자가 코드 시작점을 파악하기 어려움. 의도적(회귀 근거 기록) 트레이드오프. | `.claude/hooks/guard_review_before_push.py:84-230` | 선택적으로 근거를 별도 SoR 문서로 옮기고 코드 옆엔 요약만 유지 고려. |
| 7 | Testing | Detached-HEAD worktree 는 `_worktree_branches` 파서에서 조용히 배제되는 의도된 잔여 갭(코드 주석에 "uncovered"로 기 문서화)인데, 이를 직접 pin 하는 회귀 테스트가 없음. | `.claude/hooks/guard_review_before_push.py:424-495` | `git worktree add --detach` 로 세 번째 worktree 를 만들어 배제 동작을 직접 pin. |
| 8 | Testing | `_evaluate_over_targets`의 `result is None` 방어 분기는 현재 두 게이트 스텁 모두 None 을 반환하지 않아 unreachable(주석이 스스로 "defensive"라 인정). | `.claude/hooks/guard_review_before_push.py:645-689`(674-681) | 낮은 우선순위 — 스텁 게이트에 None 반환 케이스 추가해 향후 대비 pin. |
| 9 | Testing | `_push_targets`/`_worktree_branches`가 전량 subprocess E2E 로만 검증되고, "order-stable, de-duplicated, cwd first" 계약을 직접 겨냥한 순수 함수 단위 테스트는 없음(현재는 우연히 통과). | `.claude/hooks/guard_review_before_push.py:424-524` / `.claude/tests/test_push_guard_worktree_scope.py` 전체 | 필수 아님 — `_worktree_branches` 반환값을 몽키패치해 `_push_targets`를 순수 함수로 저렴하게 단위 테스트하는 것 고려. |
| 10 | Documentation | `_run_gates(outcome, targets)`의 `targets` 매개변수가 docstring 에 여전히 미설명(직전 라운드에서 이미 지적·"낮은 우선순위"로 미조치 확정된 이월 항목). | `.claude/hooks/guard_review_before_push.py:692` | 조치 불요(기존 판단 유지) — 다음에 함수를 만질 때 한 줄 추가 권장. |
| 11 | Documentation | `_read_payload`, `_import_reason`, `main` 에 docstring 없음(이름·본문으로 자명, `main`은 인라인 주석으로 대체). | `.claude/hooks/guard_review_before_push.py:335, 638, 741` | 낮은 우선순위 — 필요 시 한 줄 docstring 추가. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `_is_git_push()` 길이 상한 우회 O(n²) ReDoS — 이번 리뷰의 유일한 Critical |
| requirement | LOW | README.md:47 표 파손(§J 설명 렌더링 소실) 외 기능 요구사항은 plan 서술과 전부 일치, 24/24 테스트 green 확인 |
| scope | NONE | 스코프 이탈 없음 — 전 변경분이 plan 목적(worktree 스코핑)에 직접 대응, 무관 변경 0건 |
| side_effect | LOW | subprocess/게이트 호출 증폭 4건 모두 read-only·타임아웃·문서화된 의도된 설계 |
| maintainability | LOW | `_run_gates` REVIEW/PLAN 중복, 테스트 헬퍼 boilerplate 반복(둘 다 drift 위험) |
| testing | LOW | fail-open 배너 co-occurrence 미검증(WARNING), 그 외 갭 3건은 INFO 수준 |
| documentation | LOW | README.md:47 표 파손(requirement 과 동일 결함, origin/main PR #1003 유래) |

## 발견 없는 에이전트

- **scope** — 위험도 NONE, 발견사항 없음(변경분이 plan 목적에 정확히 대응, 무관 변경 없음 확인).

## 권장 조치사항

1. **(Critical, 즉시)** `_is_git_push()`에서 `_MAX_REDACTION_INPUT` 길이 상한 검사를 첫 `_GIT_PUSH.search()` 호출보다 앞으로 이동 — 현재 상태는 이 모듈이 이미 세 번 고친 것과 동일 클래스의 ReDoS 가 재현되는 실질 DoS/게이트 우회 위험.
2. `.claude/tests/README.md:47` 표 파손 수정(리터럴 `\|` 제거/이스케이프 + 닫는 `\|` 추가) — §J 설명 문단이 GFM 렌더링에서 사라지는 것을 복원. origin/main PR #1003 쪽에도 동일 수정 필요 여부 확인 권장.
3. `test_per_target_fail_open_still_checks_remaining_targets`에 fail-open 배너/`REVIEW gate —` 문구 stderr assert 추가 — `main()`의 `finally` 존재 근거인 시나리오를 실제로 검증.
4. (선택) `_run_gates`의 REVIEW/PLAN 블록을 게이트 명세 리스트 + 단일 루프로 통합하고, 테스트 헬퍼 `_run`에 `extra_env`/`script` 인자를 추가해 5개 테스트의 boilerplate 중복 제거 — 과거 이 비대칭에서 실결함이 나온 이력이 있어 우선순위 있는 리팩터.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — forced whitelist 전원, 결과 전원 확보 확인됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |