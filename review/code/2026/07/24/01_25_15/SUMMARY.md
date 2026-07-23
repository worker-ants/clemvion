# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — worktree 스코핑 기능 자체는 완전하고 테스트도 두터우나(23건 신규 + 하네스 540건 green), **현재 커밋된 `.claude/hooks/guard_review_before_push.py` 스냅샷이 `origin/main` 에 이미 랜딩된 push-탐지 버그픽스(§J, #1001/#1002)를 흡수하지 못해, 병합·push 시 게이트 전체 우회 결함이 재현된다.** 이 PR 자체의 커밋들은 해당 코드 라인을 건드리지 않으므로 정상 머지/rebase 로 자동 해소될 가능성이 높지만, **현재 상태 그대로는 알려진 게이트 우회 결함을 담고 있어 머지 전 동기화가 필수**다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `_GIT_PUSH` 정규식이 `origin/main` 에 이미 랜딩된 §J 버그픽스(커밋 `442ccc325` #1001, `ddd3633d4` #1002)를 흡수하지 못한 구 버전 그대로다. 구 버전은 env-prefix 스킵이 `=\S+` 라 따옴표 안 공백에서 끊겨(`GIT_SSH_COMMAND="ssh -i ~/.key" git push ...` 등) push 를 **아예 탐지하지 못하고** `_is_git_push()`가 `False` 를 반환 → `main()`이 즉시 `return 0` 으로 빠져 REVIEW/PLAN 게이트, 그리고 이 PR 이 구현한 worktree 스코핑 자체가 전혀 실행되지 않는다(fail-open 배너조차 없음, §E 관측 대상도 아님). 회귀 테스트(`test_push_guard_allowlist.py` `EnvValueSubpatternSharedTest`)와 `.claude/tests/README.md` 해당 행도 이 브랜치엔 없다. 다행히 `93e7ac344..HEAD`(이 PR 자체 커밋들) diff 는 `_GIT_PUSH` 정의 줄을 건드리지 않아, 정상 머지/rebase 로 해소될 것으로 보인다. | `.claude/hooks/guard_review_before_push.py:101-103` | push/머지 전에 `origin/main` 을 이 브랜치에 병합(또는 rebase)해 `442ccc325`/`ddd3633d4` 를 흡수. 병합 후 (1) `_GIT_PUSH` 가 escape-aware 버전인지, (2) `test_push_guard_allowlist.py` §J 코퍼스가 이 PR 의 worktree-스코핑 테스트와 공존해 green 인지, (3) `.claude/tests/README.md` 카탈로그가 두 PR 행을 모두 반영하는지 재확인. `plan/in-progress/push-guard-worktree-scope.md` 의 "origin/main 재구조화 흡수" 절에 #1001/#1002 흡수 기록도 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `_run_gates()` 내 REVIEW/PLAN 두 게이트 블록(`BYPASS_*` 체크 → degraded 기록 → `_evaluate_over_targets` 호출 → 차단 시 stderr+return 2`)이 구조적으로 거의 동일하게 20줄씩 중복. 파일 자체가 "미래에 세 번째 게이트 추가 가능"을 전제하고 있어 그 시점에 재복붙 위험. | `.claude/hooks/guard_review_before_push.py:664-711` | `_run_one_gate(name, bypass_env, evaluate, ...)` 헬퍼로 통합해 `_run_gates`를 두 번 호출로 축소(동작 무변경 순수 리팩터, 별도 커밋 가능). |
| 2 | testing | `BYPASS_PLAN_GUARD=1`이 scoped(multi-worktree) PLAN 차단을 억제하는지 검증하는 테스트가 없음(REVIEW 쪽 `test_bypass_still_applies_to_scoped_targets`와 비대칭). 같은 파일이 "PLAN 쪽이 REVIEW 대비 테스트 공백이었다"는 동일 패턴을 이미 한 번 실측한 이력(리뷰 17_28_02 WARNING 1)이 있어 반복 위험. | `.claude/tests/test_push_guard_worktree_scope.py` (REVIEW 대응 테스트는 196행 부근) | `test_plan_gate_is_scoped_too`(222행) 옆에 `BYPASS_PLAN_GUARD=1` + scoped PLAN 차단 → returncode 0 을 pin 하는 대칭 테스트 추가. |
| 3 | documentation | 회귀 테스트 docstring 의 리뷰 라운드 인용이 실제 발견 라운드와 다르다 — `test_push_targets_crash_falls_back_to_cwd` docstring 이 `(17_51_28 WARNING 1)`을 인용하지만, 그 이슈는 `18_06_41` 리뷰 SUMMARY WARNING #1 이 낳은 것이고 `17_51_28`은 이미 다른 테스트(`test_per_target_fail_open_still_checks_remaining_targets`)에 정확히 귀속돼 있다. 이 저장소는 라운드 인용을 감사 이력으로 취급하므로 오귀속은 추적을 그릇된 세션으로 안내한다(기능 영향 없음). | `.claude/tests/test_push_guard_worktree_scope.py:409` | `(17_51_28 WARNING 1)` → `(18_06_41 WARNING 1)` 로 정정. |
| 4 | architecture | 게이트 인터페이스("cwd 를 첫 인자로 받는가")가 명시적 타입 계약(Protocol/ABC) 없이 런타임 시그니처 추론(`_accepts_cwd` + `inspect.signature`)에만 의존. 설계자 스스로도 docstring 에 "keyword-only 로 바뀌면 조용히 false-ALLOW 구멍이 재발한다"는 위험을 인지하고 테스트(`AcceptsCwdContractTest`) 하나로만 막고 있다. | `.claude/hooks/guard_review_before_push.py:450` (`_accepts_cwd`), 호출부 `:636` | `_lib` 에 `GateEvaluator` `Protocol` 을 선언해 시그니처 계약을 정적으로 드러나게 하는 것을 고려. |
| 5 | architecture | REVIEW/PLAN 두 게이트의 "차단됨" 필드명이 불일치(`Decision.blocked` vs `Plan.untouched`)해, 신설 공용 러너 `_evaluate_over_targets` 호출부마다 커스텀 `is_blocked` 람다로 흡수해야 한다. 세 번째 게이트 추가 시마다 이 패턴이 반복될 소지. | `.claude/hooks/guard_review_before_push.py:719`(`lambda d: d.blocked`), `:741`(`lambda pl: pl.untouched`) | 결과 dataclass 에 공통 `blocked: bool` 속성/property 를 추가해 `is_blocked=lambda d: d.blocked` 하나로 통일하는 것을 고려(필수 아님). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | subprocess 호출 전부 list-argv(`shell=True` 미사용)로 커맨드 인젝션 없음. `_GIT_PUSH` ReDoS 우려도 적대적 입력(n=1,000~160,000) 실측 결과 현재 선형 시간 확인. | `.claude/hooks/guard_review_before_push.py:101,364,441` | 조치 불요(양호 패턴 유지). 향후 `_GIT_PUSH` 재수정 시 동일 벤치마크 재실행 권장. |
| 2 | security | fail-open 설계 + 무인증 `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 우회는 의도된 트레이드오프(같은 신뢰 도메인 로컬 워크플로 가드, 진짜 보안 경계 아님). | `.claude/hooks/guard_review_before_push.py:707,729` | 조치 불요. 향후 다른 신뢰 도메인으로 이식 시에만 재검토 필요하다는 점을 문서에 명시 고려. |
| 3 | side_effect | push 감지마다 신규 서브프로세스(`git worktree list --porcelain`) 호출 추가, gate 함수가 타겟 수만큼 최대 N회 호출될 수 있음. 둘 다 read-only + timeout/fail-open 으로 경계됨. | `.claude/hooks/guard_review_before_push.py:396-411`, `:617-661` | 조치 불요, 관찰 기록만. |
| 4 | maintainability | `_import_reason()` 의 백슬래시 라인 연속이 파일의 괄호 기반 관례와 다름. `_evaluate_over_targets()` 파라미터에 타입힌트 없음(파일 내 다른 함수와 비일관). | `.claude/hooks/guard_review_before_push.py:650-654`, `:617` | 괄호 기반 결합으로 통일, `targets: list[str]`/`gate: str` 최소 타입힌트 추가. |
| 5 | testing | `_evaluate_over_targets` 의 `result is None` 방어분기, `_accepts_cwd`/`_worktree_branches` 의 예외 raise 경로(현재 dead code 또는 희귀)가 pin 테스트 없음. | `guard_review_before_push.py:646-653,471-472,413-415` | 우선순위 낮음. 여유 있을 때 hermetic mock 기반 pin 추가. |
| 6 | documentation | `# SoR:` 주석이 이미 `plan/complete/` 로 이동한 plan 경로를 가리킴(이 PR 범위 밖 pre-existing). `_run_gates` docstring 에 신규 `targets` 매개변수 설명 누락. | `guard_review_before_push.py:96`, `:664-665` | `SoR:` 경로를 `plan/complete/...`로 정정(선택), `targets` 한 줄 문서화. |
| 7 | architecture | push-detection 서브시스템(정규식/heredoc/redaction, ~250줄)이 REVIEW/PLAN 게이트·fail-open 상태와 달리 `_lib/` 로 추출되지 않아 모듈화 기준이 파일별로 비일관. `failopen_state` import 실패 시 대체 `_Outcome` 클래스가 실제 `Outcome` shape 을 손으로 미러링. | `guard_review_before_push.py:101-345`, `:602-608` | 필수 아님. 다음 개편 시 `_lib/push_detection.py` 로 이관 고려. |
| 8 | requirement | 이 변경 영역(`.claude/hooks/**`, `.claude/tests/**`)은 `spec/**` 스코프 밖(harness 인프라)이라 spec-linked 대상 아님 — 정상. 설계 SoT 는 `plan/in-progress/push-guard-worktree-scope.md`이며 코드 docstring 과 line-level 로 일치 확인. | — | 해당 없음. |
| 9 | requirement | worktree-스코핑 기능 자체(`_worktree_branches`/`_mentions_branch`/`_push_targets`/`_accepts_cwd`/`_evaluate_over_targets`)는 요구사항을 완전히 충족. 신규 23건 + 하네스 전체 540건 green, 엣지케이스(stale worktree, git 실패 degrade, per-target fail-open, `_mentions_branch` 경계, `BYPASS_*` 적용 등) 실측 확인. | — | 해당 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/ReDoS 없음(실측 검증), fail-open+BYPASS 우회는 의도된 트레이드오프 |
| requirement | **CRITICAL** | `_GIT_PUSH` 가 origin/main 의 §J 버그픽스(#1001/#1002)를 흡수 못해 게이트 전체 우회 재현 위험(현재 스냅샷 기준). 기능 자체는 요구사항 완전 충족 |
| scope | NONE | 전 변경이 worktree 스코핑이라는 단일 목적에 수렴, 범위 이탈 없음 |
| side_effect | LOW | 신규 subprocess 호출·gate 반복 호출 모두 read-only+경계됨, 실 부작용 없음 |
| maintainability | LOW | `_run_gates` REVIEW/PLAN 블록 중복(WARNING), 스타일 사소 편차 다수(INFO) |
| testing | LOW | 두터운 회귀 테스트(23건+540건 green). `BYPASS_PLAN_GUARD` scoped 비대칭 커버리지(WARNING) |
| documentation | LOW | 문서화 수준 높음. 회귀 테스트 docstring 리뷰 라운드 오귀속 1건(WARNING) |
| architecture | LOW | 전반적으로 양호한 Strategy 추상화. 게이트 인터페이스가 타입 계약 대신 런타임 추론에 의존, 필드명 불일치로 람다 매핑 필요(WARNING 2건) |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 이상의 발견사항을 보고했다(security/scope 는 실질 결함 없이 확인 사항만 INFO 로 기록).

## 권장 조치사항

1. **[최우선/CRITICAL]** push/머지 전에 `origin/main` 을 이 브랜치에 병합(또는 rebase)하여 `442ccc325`(#1001)/`ddd3633d4`(#1002) §J 버그픽스를 흡수 — `_GIT_PUSH` 가 escape-aware 버전인지, `test_push_guard_allowlist.py`(§J 코퍼스)가 이 PR 의 worktree-스코핑 테스트와 공존해 green 인지, `.claude/tests/README.md` 카탈로그가 두 PR 행을 모두 반영하는지 재확인.
2. `BYPASS_PLAN_GUARD` 의 scoped-target 억제를 검증하는 대칭 테스트 추가(REVIEW 쪽과 동일 패턴).
3. `test_push_targets_crash_falls_back_to_cwd` docstring 의 리뷰 라운드 인용 정정 (`17_51_28` → `18_06_41`).
4. 여유 있을 때: `_run_gates()` REVIEW/PLAN 블록 중복을 헬퍼로 통합, 게이트 결과 타입에 공통 `blocked` 필드 도입, `_accepts_cwd` 계약을 `Protocol` 로 명시화(모두 별도 후속 커밋으로 가능, 이번 병합을 막을 사안 아님).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `architecture` (8명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |