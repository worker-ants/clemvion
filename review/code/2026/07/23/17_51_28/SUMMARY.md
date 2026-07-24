# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 결함(CRITICAL)은 없으나, `_run_gate` 의 "target 단위 fail-open" 불변식이 어떤 테스트로도 검증되지 않는다는 점이 mutation 실측으로 확인됨(WARNING). 이 불변식이 깨지면 이번 PR 이 닫으려던 것과 동일한 클래스의 false-ALLOW 결함이 재발할 수 있어, 순수 문서/스타일 수준을 넘는 실질 리스크로 판단해 MEDIUM 을 부여한다. forced 화이트리스트(7명) 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `_run_gate` 의 "target 단위 fail-open"(한 worktree 평가에서 예외가 나도 나머지 target 은 계속 검사됨) 불변식이 어떤 테스트로도 검증되지 않음. `continue`→`return False` mutation 을 실제로 적용해 재현한 결과 신규 18건+기존 20건 전부(38/38) green — 즉 "첫 target 예외 시 이후 target 을 검사하지 않고 gate 전체를 통과"시키는 회귀를 잡아내는 테스트가 없다. 이 불변식이 깨지면 cwd(첫 target)의 우연한 내부 오류만으로 실제 push 대상 worktree 가 미검사 통과될 수 있어, 이 PR 이 닫으려는 바로 그 false-ALLOW 결함이 재발 가능 | `.claude/hooks/guard_review_before_push.py:494-520`(`_run_gate`, 특히 511-519 per-target try/except) | REVIEW 또는 PLAN 스텁을 "특정 경로에서만 raise"하도록 확장한 시나리오 1건 추가 — cwd 스텁은 예외를 던지고 side worktree(명령이 언급한 branch)는 dirty 로 설정, 훅이 여전히 side worktree 를 검사해 block(`returncode==2`)함을 단언 |
| 2 | Maintainability / Documentation | `_run_gate()` 의 `base_cwd` 매개변수가 함수 본문(506-520행) 어디에서도 사용되지 않는 죽은 파라미터. 인접 주석(509-510행)이 "legacy fallback 이 왜 `base_cwd` 대신 `os.getcwd()` 를 쓰는지"만 설명해, 마치 scoped 분기는 `base_cwd` 를 쓰는 듯한 인상을 주지만 실제로는 scoped 분기도 `target` 만 쓰고 `base_cwd` 는 완전히 미사용. 3개 reviewer(maintainability·documentation·이하 INFO 로 requirement·side_effect)가 독립적으로 같은 사실을 지적 | `.claude/hooks/guard_review_before_push.py:494`(정의), `:506-520`(본문), `:546`·`:557`(호출부) | `base_cwd` 파라미터를 제거하고 두 호출부에서도 인자 삭제. 향후 용도가 있다면 docstring 에 "reserved for future per-gate cwd fallback" 등으로 의도 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 1차 리뷰 WARNING("길이 상한 부재")이 `_push_targets` 진입부 `command[:_MAX_REDACTION_INPUT]` 절단으로 실제 반영됨을 코드 레벨로 확인(검증 완료) | `guard_review_before_push.py:439` | 조치 불요 |
| 2 | Security | `_worktree_branches` 의 `subprocess.run(["git","worktree","list","--porcelain"], cwd=cwd)` — 리스트 인자·`shell=True` 미사용으로 인젝션 표면 없음, 실패 시 fail-open, `timeout=5.0` 로 행 방지 | `guard_review_before_push.py:357-371` | 조치 불요 |
| 3 | Security | `_lib/review_guard.py`/`_lib/plan_guard.py` 를 직접 열람해 `cwd` 인자가 실제 git 서브프로세스 체인 전체에 전파됨을 확인 — `_accepts_cwd` probe-and-scope 설계가 실효성 있게 작동, 1차 리뷰의 미확인 우려 해소 | `_lib/review_guard.py:836-852`, `_lib/plan_guard.py:291-319` | 조치 불요 |
| 4 | Security | `payload.get("cwd") or os.getcwd()` — stdin payload 의 `cwd` 필드를 신뢰하는 것은 의도된 설계. payload 에 `cwd` 키가 없으면 pre-fix 동작(false-ALLOW 가능)으로 폴백하나 Claude Code PreToolUse(Bash) payload 는 통상 `cwd` 를 항상 포함해 실무 영향 낮음 | `guard_review_before_push.py:532-539` | (선택) harness 쪽 `cwd` 필드 항상 채워지는지 관측/로깅 |
| 5 | Testing | 다중 branch 언급 시 `_push_targets` 의 order-stable·dedup 계약(docstring)을 직접 자극하는 테스트 없음 (1차 리뷰 대비 잔존, RESOLUTION.md 가 이미 "선택" 분류) | `guard_review_before_push.py:431-449` | 선택 — 필요시 다중-branch 시나리오 테스트 추가 |
| 6 | Testing | `_worktree_branches` 의 porcelain 파서가 detached HEAD worktree 경로(코드 리딩상 버그 아님)를 실제 텍스트로 자극하는 테스트 없음 | `guard_review_before_push.py:370-383` | 선택 — 캔 porcelain 텍스트 상수 기반 순수 단위 테스트 |
| 7 | Testing | `MentionsBranchTest`/`AcceptsCwdContractTest` 의 `setUp` 이 프로젝트 컨벤션(`_harness.load_module_by_path`) 대신 수동 `sys.path.insert`+`importlib.import_module` 사용 (1차 이월, 미반영) | `test_push_guard_worktree_scope.py:296-300, 333-340` | 선택 — `_harness.load_module_by_path` 로 통일 |
| 8 | Documentation | 모듈 최상단 docstring 이 cross-worktree scoping 동작(과거 cwd-only false-ALLOW 버그 → 현재 cwd+언급 branch worktree 검사)을 요약하지 않음 (1차 이월, RESOLUTION.md 가 의도적으로 보류) | `guard_review_before_push.py:1-24` vs `316-349` | (선택) 상단 docstring 한 줄 요약 추가 |
| 9 | Documentation | `guard_review_before_stop.py` 가 이번 fix 대상에서 제외된 이유가 코드/plan 어디에도 문장으로 없음 (근거는 합리적 — Stop 훅엔 대상 branch 개념 없음, 1차 이월·보류) | `guard_review_before_stop.py:245, 262` | (선택) 한 줄 근거 추가 |
| 10 | Maintainability | `test_bypass_still_applies_to_scoped_targets` 하나만 공용 헬퍼 `_run()` 을 우회해 subprocess 호출 20줄을 직접 복제(다른 12개 테스트는 `_run()` 재사용) | `test_push_guard_worktree_scope.py:178-197` vs `:121-133` | 선택 — `_run(..., extra_env=None)` 오버라이드 파라미터 추가해 헬퍼 재사용 |
| 11 | Maintainability | `_run_gate` 호출부가 위치 인자 6개(콜백 2개 포함)를 나열해 각 인자 역할이 정의부 없이 파악 어려움 | `guard_review_before_push.py:542-561` | `base_cwd` 제거 + 나머지 인자 키워드 인자화(`is_blocked=`, `render=`) |
| 12 | Maintainability | `_mentions_branch` 의 경계 판정 `before or " "` / `after or " "` 트릭이 인라인 주석 없이 사용됨(동작은 정확) | `guard_review_before_push.py:396-401` | (선택) "empty string at start/end counts as delimiter" 한 줄 주석 |
| 13 | Side Effect | REVIEW/PLAN 게이트가 push 1회당 target 수만큼 반복 호출되는 것은 `_run_gate` 추출 후에도 유지 — `review_guard.py`/`plan_guard.py` 에 파일 쓰기·`gh`(네트워크) 호출 없음을 재확인, 새 부작용 없음 | `guard_review_before_push.py:511-519, 542-561` | 조치 불요 |
| 14 | Side Effect / Security | `subprocess`/`inspect` import 가 함수 지역→모듈 top-level 이동 — 이제 push 여부와 무관하게 모든 Bash 호출마다 로드됨(표준 라이브러리라 실질 영향 무시 가능), per-target fail-open 예외 스킵 시 어느 target 인지 stderr 미명시(진단성 낮음) | `guard_review_before_push.py:28, 32`(import), `:512-516`(fail-open 루프) | 조치 불요 / (선택) 예외 스킵 시 target 명시 |
| 15 | Requirement | 이 harness 전용 변경을 규정하는 `spec/` 문서 없음 — CLAUDE.md 폴더 구조상 정상(코드 리뷰 대상 아님), `plan/in-progress/push-guard-worktree-scope.md` 가 설계 문서 역할 수행 | `spec/`, `plan/in-progress/push-guard-worktree-scope.md` | 조치 불요 |
| 16 | Scope | 차단 메시지에 `worktree:` 줄 추가, `_run_gate()` 추출, `review/code/2026/07/23/17_28_02/*` 13개 파일 포함 — 모두 plan 문서에 사전 고지되었거나 직전 리뷰 라운드 피드백에 대한 documented 대응, 또는 프로젝트 관례상 커밋 대상인 리뷰 산출물로 scope 이탈 아님 | 다수 위치(scope.md 참조) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 1차 WARNING(길이 상한) 반영 확인 + cwd 전파 실효성 검증, 신규 CRITICAL/WARNING 없음 |
| requirement | LOW | 1차 WARNING 7건 전부 코드 레벨 반영 확인(18/485 테스트 재실행 green), `base_cwd` 죽은 파라미터 INFO |
| scope | NONE | 핵심 변경이 단일 의도(worktree 스코프 확장)에 밀접 종속, 무관한 변경 없음 |
| side_effect | LOW | `_run_gate` 리팩터는 behaviour-preserving, `base_cwd` 죽은 파라미터 재확인(INFO), 새 부작용 경로 없음 |
| maintainability | LOW | `_run_gate` DRY 추출 완료 확인, 그러나 `base_cwd` 죽은 파라미터를 WARNING 으로 신규 지적 |
| testing | MEDIUM | 1차 WARNING 반영 확인 + mutation 실측으로 `_run_gate` per-target fail-open 불변식 무검증 확인(WARNING) |
| documentation | LOW | 문서-코드 대조 전반 정확, `base_cwd` dead parameter 로 인한 주석-동작 간극 WARNING |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원 최소 1건 이상의 발견(WARNING 또는 INFO)을 보고함.

## 권장 조치사항

1. `_run_gate` 의 per-target fail-open 불변식을 실제로 자극하는 회귀 테스트 1건 추가(cwd 스텁 raise + side worktree dirty 시나리오) — 이 PR 이 닫으려는 결함과 동일 클래스의 재발을 막는 유일한 안전장치이므로 최우선.
2. `_run_gate()` 의 `base_cwd` 죽은 파라미터를 제거하거나(권장) 실제 용도를 docstring 에 명시 — 3개 reviewer 가 독립적으로 지적한 문서-코드 간극.
3. (선택, 낮은 우선순위) 테스트 헬퍼 `_run()` 에 `extra_env` 오버라이드를 추가해 bypass 테스트 중복 제거, `_mentions_branch` 경계 트릭에 인라인 주석 추가, 모듈 상단 docstring 에 cross-worktree scoping 한 줄 요약 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, 결과 확보 완료 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단으로 제외(forced 목록에도 미포함). 단, `_run_gate()` DRY 추출 관련 구조적 관점은 maintainability/scope reviewer 가 부분적으로 커버함 |