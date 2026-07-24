# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음, 핵심 fix(교차-worktree false-ALLOW 차단) 자체는 정확히 구현됨. 다만 PLAN 게이트의 worktree 스코핑 경로와 여러 fail-open 폴백 분기가 테스트로 고정되지 않아 향후 조용한 회귀 가능성이 남아 있고(testing.md MEDIUM), plan 문서의 mutation 실측 수치 오기재(requirement.md)와 REVIEW/PLAN 루프 구조적 중복(maintainability/architecture.md)이 함께 발견되어 MEDIUM 으로 판정.

forced(router_safety) whitelist 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | PLAN 게이트의 worktree 스코핑 경로가 e2e 테스트에서 전혀 검증되지 않음 — `_PLAN_STUB.evaluate_plan()` 이 항상 `untouched=False`(clean)로 하드코딩돼 있어 PLAN 게이트가 "다른 worktree 를 보고 block"하는 경로를 한 번도 타지 않음 | `guard_review_before_push.py` 523-540행(PLAN 루프), `test_push_guard_worktree_scope.py` 60-73행(`_PLAN_STUB`) | 경로-키 환경변수로 바꿔 REVIEW=clean·PLAN=block(side worktree) 케이스 최소 1건 추가, `_PLAN_MSG` 의 `worktree:` 라인도 함께 단언 |
| 2 | Testing | `_worktree_branches` 의 fail-open 경로(git 실패·timeout·detached HEAD)가 직접 단위 테스트되지 않음 — e2e 정상 경로만 간접 검증 | `guard_review_before_push.py` 350-367행 | git 미존재 디렉터리/비-0 종료/timeout/detached-HEAD 케이스별 전용 단위 테스트 추가 |
| 3 | Testing | `main()` 의 `_push_targets` 전체 실패 시 fail-open 폴백(`targets=[base_cwd]`, 이 fix 가 닫으려던 구버전 cwd-only 동작으로 소리 없이 회귀)이 테스트되지 않음 | `guard_review_before_push.py` 497-502행 | `_push_targets` monkeypatch 로 예외 유발 → REVIEW/PLAN 게이트가 cwd 기준으로는 정상 동작하는지 확인하는 회귀 테스트 추가 |
| 4 | Maintainability / Architecture | REVIEW/PLAN 게이트의 scoped 루프 구조(`scoped=_accepts_cwd(fn)` → `for target in targets...` → `try/except: continue` → block 판정)가 거의 동일하게 두 번 복제됨(DRY 위반). 3번째 게이트 추가 시 동일 버그가 각각 재현될 위험 | `guard_review_before_push.py` 505-520행(REVIEW), 523-540행(PLAN) | `_run_gate(evaluate_fn, targets, is_blocked, message_template)` 공용 헬퍼로 추출(단, "한 게이트 예외가 다른 게이트를 막지 않는다" 불변식 유지) |
| 5 | Architecture | `_accepts_cwd` 리플렉션 기반 시그니처 판별이 실제 production 함수(`review_guard.evaluate_review`/`plan_guard.evaluate_plan`)에 대해 `_accepts_cwd(fn) is True` 를 직접 단언하는 테스트가 없음 — 향후 시그니처가 keyword-only 등으로 바뀌면 조용히 False 로 degrade 되어 이 PR 이 고치려던 false-ALLOW 로 회귀할 수 있으나 어떤 테스트도 잡지 못함 | `guard_review_before_push.py` 402-426행 | `review_guard`/`plan_guard` 실제 함수를 import 해 `_accepts_cwd(evaluate_review)`/`_accepts_cwd(evaluate_plan)` 이 `True` 임을 고정하는 계약 테스트 추가, 또는 `typing.Protocol` 로 명시적 인터페이스 도입 |
| 6 | Requirement | plan 문서의 mutation 실측표(M3 행)가 "legacy 스위트 5건" 으로 기재돼 있으나, 코드 자체의 docstring("9 blocking tests") 및 독립 mutation 재현(9건 실패)과 불일치 | `plan/in-progress/push-guard-worktree-scope.md:83` vs `guard_review_before_push.py:409` | plan 문서 M3 행을 "9건" 으로 정정(코드는 정확, 감사 기록만 수정 필요) |
| 7 | Security / Performance | `_mentions_branch`/`_push_targets` 가 이 파일의 다른 손수 작성 스캔(`_MAX_REDACTION_INPUT=16,384` 상한 적용)과 달리 커맨드 길이 상한이 없음. `_is_git_push` 가 입력이 너무 커서 "block" 판정을 내려도 `main()` 은 그대로 원문 커맨드를 `_push_targets` 에 전달함 | `guard_review_before_push.py` 382-399행(`_mentions_branch`), 429-441행(`_push_targets`), 499행 호출부 | `_push_targets` 호출 전(또는 `_mentions_branch` 진입 시) 동일 상한 적용 권장. 단, 실측(2MB 커맨드×worktree 15개≈0.9ms, CPython `str.find` 는 선형)으로 현재 즉각적 DoS 위험은 낮음 — 파일의 방어적 컨벤션 일관성 차원의 개선 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 워크트리별 fail-open 루프(`except Exception: continue`)가 target 단위로 세분화되어, 특정 worktree 만 조용히 예외로 스킵되고 다른 target 은 정상 통과할 경우 로그상 구분이 안 됨 | `guard_review_before_push.py` 505-520, 523-540행 | 어느 target 이 예외로 스킵됐는지 stderr 에 명시(선택적) |
| 2 | Security | `evaluate_review`/`evaluate_plan` 실제 구현(`_lib/review_guard.py`, `_lib/plan_guard.py`)이 이번 diff 범위 밖 — `cwd` 인자를 실질적으로 소비하는지 별도 확인 필요(이번 리뷰 범위에 없어 직접 미확인) | N/A | 후속 리뷰에서 해당 모듈 diff 포함 확인 |
| 3 | Requirement | legacy(unscoped) fallback 경로에서 차단 메시지의 `worktree:` 값이 실제 평가 대상(`os.getcwd()`)과 불일치할 수 있음(현재 production 함수 시그니처상 도달 불가능한 방어적 경로) | `guard_review_before_push.py` 507-509, 516, 525-527, 536행 | fallback 분기에서 `worktree=os.getcwd()` 로 표시하도록 정정(예방적) |
| 4 | Requirement / Performance | 매칭되는 worktree 수(=커맨드가 언급한 branch 수)에 상한이 없어, 다수 branch 를 언급하는 커맨드에서 `evaluate_review`/`evaluate_plan` 풀 파이프라인이 그만큼 반복 호출됨(realpath 기준 dedup 은 적용돼 있어 중복 평가는 없음) | `guard_review_before_push.py` 429-441행, 505-540행 | 의도된 trade-off(stricter, never weaker). 필요시 soft cap 고려, 현재 15개 worktree 규모에서는 실용적 영향 낮음 |
| 5 | Scope | 차단 메시지에 `worktree:` 라인 추가는 핵심 fix 범위를 살짝 벗어난 부수 개선이나, plan 문서에 사전 고지되어 있고 다중-worktree 평가 구조에서 사실상 필요한 보완 | `guard_review_before_push.py` 447, 470, 516, 536행 | 조치 불요 |
| 6 | Maintainability | `timeout=5.0` 에 근거 주석 없음 — 파일의 다른 모든 매직넘버(`_OWNER_WINDOW`, `_MAX_REDACTION_INPUT` 등)는 근거 주석 동반 | `guard_review_before_push.py` 362행 | "왜 5초인가" 한 줄 근거 주석 추가 |
| 7 | Maintainability | 신규 함수 내부 지역 `import subprocess`/`import inspect` 가 파일의 모듈-top import 관례와 다름 | `guard_review_before_push.py` 355, 413행 | 모듈 top-level import 로 통일하거나 지연 import 사유 주석 추가 |
| 8 | Documentation | 모듈 최상단 docstring 이 신규 cross-worktree 평가 동작(`_push_targets` 설계 블록)을 요약하지 않아, 상단만 본 독자가 "훅은 여전히 cwd 만 본다" 고 오해할 수 있음 | `guard_review_before_push.py` 1-24행 | 상단 docstring 에 한두 줄 요약 추가 |
| 9 | Documentation | 자매 훅 `guard_review_before_stop.py` 가 이번 fix 대상에서 제외된 이유(대상 branch 개념 없음)가 코드·plan 어디에도 문장으로 없음 | `guard_review_before_stop.py` | 314행 블록 또는 plan 문서에 한 줄 근거 추가(선택적) |
| 10 | Architecture | 신규 worktree 토폴로지 헬퍼(`_worktree_branches`/`_mentions_branch`/`_push_targets`)가 기존 "훅=얇게, 판정 로직=`_lib/`" 레이어링과 달리 훅 파일에 직접 위치 | `guard_review_before_push.py` 347-441행 | 향후 재사용 필요 시 `_lib/worktree_scope.py` 로 분리 고려 |
| 11 | Performance | push 마다 `git worktree list --porcelain` 서브프로세스 1회 추가(동기 블로킹, `timeout=5.0`) — PreToolUse 훅이 모든 `git push` 호출을 동기 게이팅하므로 지연 가능성 존재(fail-open 방어는 이미 적용됨) | `guard_review_before_push.py` 354-367, 497-502행 | 타임아웃 정책이 다른 subprocess 호출과 일관되는지만 재검토 권장 |
| 12 | Testing / Requirement | 신규 테스트(`MentionsBranchTest.setUp`, `test_push_guard_worktree_scope.py`)가 README 컨벤션(`_harness.load_module_by_path`) 대신 수동 `sys.path.insert`+`importlib.import_module` 사용 (기능적 결함 아님, 전체 스위트 476건 통과 확인) | `test_push_guard_worktree_scope.py` 205-209행 | `_harness.load_module_by_path` 로 통일 |
| 13 | Testing | `_push_targets` 가 커맨드에서 2개 이상 worktree branch 를 동시에 언급하는 케이스(순서 안정성·dedup 계약)를 검증하는 테스트 없음 | `guard_review_before_push.py` 429-441행 | 3개 이상 worktree 로 다중-branch 언급 케이스 테스트 추가 |
| 14 | Testing | stale(디스크에서 삭제됐지만 `git worktree list` 는 여전히 보고하는) worktree 항목에 대한 `isdir` 방어 로직이 직접 자극되지 않음 | `guard_review_before_push.py` 436행 | 낮은 우선순위 — side worktree 디렉터리만 삭제 후 `_push_targets` 가 건너뛰는지 확인하는 테스트 |
| 15 | Security | `traceback.print_exc(file=sys.stderr)` 가 로컬 파일 경로를 stderr 로 노출(민감도 낮음, 기존 패턴 재사용, 신규 아님) | `guard_review_before_push.py` 42, 511, 529행 | 조치 불요 |
| 16 | Requirement | 이 push 가드를 규정하는 `spec/` 문서 없음 — harness 자동화(`.claude/`)는 CLAUDE.md 폴더 구조상 `spec/` 범위 밖이라 기대된 결과, plan 문서(설계 서술)와 구현이 라인 단위로 일치함을 확인 | N/A | 조치 불요(해당 없음으로 분류) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `_mentions_branch`/`_push_targets` 길이 상한 부재(WARNING); 그 외 fail-open 표면 확대·`review_guard`/`plan_guard` diff 범위 밖은 INFO |
| requirement | LOW | 핵심 기능 정확히 구현·9+20+476건 재실행 통과 확인. plan mutation 실측표 M3 수치 오기재(WARNING)가 유일한 실질 이슈 |
| scope | NONE | 4개 변경 파일 모두 단일 의도에 밀접 종속, 무관 변경 없음 |
| side_effect | LOW | 새 subprocess 1회, 게이트 반복 호출, target-단위 fail-open 세분화 — 모두 로컬 read-only, 의도된 설계 |
| maintainability | LOW | REVIEW/PLAN 루프 구조적 중복(WARNING); timeout 매직넘버·지역 import 는 INFO |
| testing | MEDIUM | PLAN 게이트 스코핑 미검증·`_worktree_branches`/`_push_targets` fail-open 미검증(WARNING 3건) — 코드 버그는 발견 안 됐으나 회귀 감지 커버리지 공백 |
| documentation | LOW | docstring·plan·README 정합성 우수, 모듈 최상단 요약 누락만 INFO |
| architecture | LOW | REVIEW/PLAN 루프 중복(WARNING, maintainability 와 동일 이슈)·`_accepts_cwd` 계약 미테스트(WARNING) |
| performance | LOW | 서브프로세스 1회 추가·길이 상한 부재 모두 실측상 현재 병목 아님(INFO 중심) |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상의 WARNING/INFO 를 보고함.

## 권장 조치사항

1. PLAN 게이트의 worktree 스코핑 경로(side worktree 에서 PLAN 이 block 하는 케이스)를 검증하는 e2e 테스트 최소 1건 추가 (WARNING #1, MEDIUM 위험도의 핵심 원인).
2. `_worktree_branches`/`main()`(`_push_targets` 전체 실패) 의 fail-open 폴백 분기를 monkeypatch 기반 단위 테스트로 고정 — 두 곳 모두 "정합성 fix 가 조용히 예전 취약 동작으로 퇴행"할 수 있는 지점 (WARNING #2, #3).
3. `plan/in-progress/push-guard-worktree-scope.md` M3 행의 "5건" 을 "9건" 으로 정정해 코드 docstring·실측과 일치시킬 것 (WARNING #6, 즉시 가능한 저비용 수정).
4. REVIEW/PLAN 게이트 scoped 루프를 공통 헬퍼로 추출해 구조적 중복 제거 — 3번째 게이트 추가 전에 선행 권장 (WARNING #4).
5. `_accepts_cwd(evaluate_review)`/`_accepts_cwd(evaluate_plan)` 이 실제 production 시그니처에 대해 `True` 임을 고정하는 계약 테스트 추가 (WARNING #5).
6. (선택) `_mentions_branch`/`_push_targets` 에 `_MAX_REDACTION_INPUT` 과 동일한 커맨드 길이 상한 적용 — 이 파일의 기존 방어 컨벤션과의 일관성 확보 (WARNING #7, 현재 즉각적 위험은 낮음).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, architecture, performance` (9명)
  - **제외**: 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 미이행 항목 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | concurrency | 라우터가 이번 diff(push 가드 훅 스코프 확장)에 동시성 관련 변경이 없다고 판단해 제외(구체 사유는 prompt 에 별도 명시되지 않음) |