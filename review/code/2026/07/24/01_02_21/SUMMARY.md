# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 라운드(01_02_21)의 diff/라우팅 준비 단계가 **같은 커밋(`3dc3a160a`)에 포함된 실제 코드 변경 3개 파일**
(`.claude/hooks/guard_review_before_push.py`, `.claude/tests/README.md`, `.claude/tests/test_push_guard_worktree_scope.py`)을
통째로 누락한 채 리뷰 산출물(문서) 12개만 대상으로 fan-out 되었다. 7명 중 4명(requirement, scope, side_effect, testing)이
`git show --stat`/`git diff` 로 이 갭을 독립적으로 발견했고, 나머지 2명(security, maintainability)은 "코드는 이전 라운드에서
이미 리뷰됐다"는 **틀린 전제**를 그대로 받아들여 NONE 판정을 내렸다 — 이 갭이 있는 채로 SUMMARY 가 clean 수렴하면, push
가드가 **실제로는 리뷰되지 않은 코드 변경**을 "리뷰 완료"로 오판하게 된다(이 PR 자신이 막으려는 것과 같은 계열의 실패).
다행히 requirement/side_effect/testing 3개 reviewer 가 payload 밖에서 자발적으로 실제 소스를 직접 `Read`/재실행 검증했고,
그 결과 코드 자체(6건 WARNING 반영분)는 정상 동작함을 확인했다(23/23, 540/540 테스트 통과). 다만 그 직접 검증 과정에서
신규 회귀 1건(테스트 파일핸들 미close, WARNING)과 plan 문서 드리프트(WARNING), 감사 문서 자체의 내적 모순 2건(WARNING)이
새로 발견됐다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 프로세스/하네스 | 이번 리뷰 라운드의 diff/라우팅 준비가 같은 커밋(`3dc3a160a`)의 실제 코드 변경 3개 파일(`guard_review_before_push.py` +47/-12, `test_push_guard_worktree_scope.py` +90, `README.md` +2/-1)을 완전히 누락 — `agents_forced`가 `documentation` 하나로 좁혀지고 security/requirement/scope/side_effect/maintainability/testing 은 강제 대상에서 빠질 뻔했다(실제로는 별도 강제 목록에 포함돼 실행됐으나 payload 자체가 코드를 안 담았음). security·maintainability reviewer 는 "코드는 이미 리뷰됐다"는 잘못된 전제로 NONE 판정 | `review/code/2026/07/24/01_02_21/meta.json`·`_retry_state.json`(files 목록에 3개 코드 파일 부재); 근거 커밋 `3dc3a160a`(`git show --stat`); requirement.md, scope.md, side_effect.md, testing.md 가 각자 독립 발견 | diff/라우팅 산출 단계에 `git diff <base>...HEAD` 전체 파일 집합과 `meta.json.files` 를 대조하는 self-check(assert) 추가. 최소한 이번엔 위 3개 파일을 대상으로 한 fresh 리뷰를 별도 재실행할 것. SUMMARY 확정 전 이 갭을 push 가드 판정 근거에서 누락시키지 말 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신규 테스트가 `self.hook` 파일 핸들을 컨텍스트 매니저 없이 열어 `ResourceWarning: unclosed file` 발생 — 같은 파일 내 다른 4곳은 전부 `with open(...)` 사용 | `.claude/tests/test_push_guard_worktree_scope.py:349` (`test_target_selection_failure_is_counted_not_silent`) | `with open(self.hook, encoding="utf-8") as f: src = f.read()` 로 변경해 파일 내 기존 관례와 통일 |
| 2 | 문서 드리프트 | RESOLUTION.md 가 주장한 검증 수치(테스트 21→23건, mutation 9→11건)와 코드 주석 개선(RESIDUAL GAP 신규 케이스)이 `plan/in-progress/push-guard-worktree-scope.md` 체크리스트·mutation 표·"남은 갭" 절에 반영되지 않아 문서만 구버전으로 남음 | `plan/in-progress/push-guard-worktree-scope.md:104-105`(21건/9건 잔존), `:116-129`(mutation 표 M8~M11 행 부재), `:184-185`("남은 갭" 절에 bare-push-neither-case 미기재) | 체크리스트(23건)·mutation 표(M8~M11)·"남은 갭(의도)" 절을 이번 라운드 반영분에 맞춰 갱신 |
| 3 | 감사 문서 자기모순 | RESOLUTION.md 헤더가 "WARNING 7건 — 전량 반영"이라 단언하지만 바로 아래 표(#3 "미조치")·문서 맨 아래 결론("6건 반영 + 1건 근거 있는 미조치")과 모순 | `review/code/2026/07/24/00_34_09/RESOLUTION.md:6` vs `:12`, `:42` | 헤더를 "6건 반영, 1건 근거 있는 미조치"로 실제 결론과 일치시킬 것 |
| 4 | 감사 문서 자기모순 | SUMMARY.md WARNING 표가 `_run_gate` 이름 drift 발견을 documentation/testing/requirement/**maintainability** 4곳 공동 발견으로 표기하지만, maintainability.md 원문은 이를 `[INFO]`로만 분류 — SUMMARY.md 내부의 "에이전트별 위험도 요약" 표와도 서로 다른 사실을 말함 | `review/code/2026/07/24/00_34_09/SUMMARY.md:17` vs `maintainability.md:37` vs `SUMMARY.md:47`, "권장 조치사항" 5번(`:62`)도 동일 오귀속 반복 | SUMMARY.md WARNING 표 4번째 행에서 `Maintainability` 를 제거하거나 "(maintainability 는 INFO)"로 명시 |
| 5 | 프로세스(하네스) | (위 CRITICAL #1과 동일 사실을 side_effect·scope reviewer 는 WARNING/MEDIUM 강도로 독립 판정 — dedup 시 CRITICAL 로 병합, 별도 항목 아님) | — | — |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 직접 검증(확인됨) | payload 갭에도 불구하고 requirement/side_effect/testing reviewer 가 실제 소스를 직접 재확인 — RESOLUTION.md 주장 6건(worktree 경로 매칭 `_mentions_branch(command, path)`, `TARGET_SELECTION` degraded 기록, docstring 복원, `result is None` 분기 주석, README/테스트 `_run_gate`→`_evaluate_over_targets` 정정, `_ensure_on_path()` 멱등화)이 전부 실제 코드에 존재함을 확인, 테스트 23/23·전체 540/540 통과 | `guard_review_before_push.py`(worktree 매칭 :491, TARGET_SELECTION :741, docstring :16-18, result is None 주석 :644-652), `test_push_guard_worktree_scope.py`(:84-93 `_ensure_on_path`, 신규 테스트 2건) | 조치 불요 — 코드 자체는 건전함이 확인됨 |
| 2 | Testing | `result is None` 분기(`_evaluate_over_targets`)가 주석만 추가되고 여전히 어떤 테스트로도 실행되지 않는 dead code로 남음 | `.claude/hooks/guard_review_before_push.py:646` | 급하지 않음. `_REVIEW_STUB`/`_PLAN_STUB` 에 `None` 반환 변형을 추가하면 이 분기를 회귀 테스트로 고정 가능 |
| 3 | Testing | RESIDUAL GAP(완전 bare push, branch/path 어느 것도 언급 안 되는 케이스)이 설계 주석으로만 문서화되고 회귀 테스트로 pin되지 않음 | `.claude/hooks/guard_review_before_push.py:381-393` | 급하지 않음. "bare push, cwd already inside other worktree" 시나리오 pin 테스트 1건 추가 고려 |
| 4 | 문서 | `_retry_state.json` 이 라운드 완료 후에도 `"routing_status": "pending"`, 빈 `agents_success`/`agents_fatal`로 커밋되어 SUMMARY.md("routing_status=done")와 표면적으로 어긋나 보임(harness 의도된 pre-run 스냅샷 여부 불확실) | `review/code/2026/07/24/00_34_09/_retry_state.json:8, 145-147` vs `SUMMARY.md:68` | 조치 불요(의도된 동작이면). 확실치 않다면 orchestrator 문서에 "`_retry_state.json`은 최종 상태 SoT 아님" 한 줄 명시 고려 |
| 5 | Requirement | 관련 spec 문서 없음 — 정상(harness 전용, `spec/`는 제품 코드 대상이라 스코프 밖) | `spec/`(grep 0건) | 조치 불요 |
| 6 | Maintainability | 리뷰 산출물 문서 간 동일 발견 중복 서술은 다중 reviewer 교차검증 설계(fan-out)의 의도된 결과이며 DRY 위반 아님 | 12개 산출물 파일 전반 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | diff 누락(코드 3파일)을 발견 + 직접 소스 검증으로 6건 반영 사실 확인 + plan 문서 드리프트(WARNING) |
| scope | WARNING | diff 누락 발견(router 자신도 "소스 코드 파일 0개"라 명시) |
| side_effect | MEDIUM | diff 누락 발견 + 직접 검증 결과 코드 자체 부작용은 LOW(TARGET_SELECTION 배선 등 기존 선례와 정합) |
| testing | LOW | diff 누락 발견 + 직접 재실행 검증(23/23, 540/540) + 신규 회귀 1건(파일핸들 미close, WARNING) |
| documentation | LOW | 코드 diff 없음(문서 커밋만 대상) — 감사 문서 자체의 내적 모순 2건(WARNING) 발견 |
| security | **NONE (주의)** | "코드는 이미 리뷰됐다"는 **틀린 전제**로 diff 누락을 인지하지 못한 채 판정 — 판정 자체의 신뢰도 낮음 |
| maintainability | **NONE (주의)** | 위와 동일한 틀린 전제로 diff 누락 미인지 — 판정 자체의 신뢰도 낮음 |

## 발견 없는 에이전트

- **security** — 실질 문제 없음으로 판정했으나, 실제 코드 diff(3개 파일)를 보지 못한 채 내린 판정이라 신뢰도에 한계 있음(위 CRITICAL #1 참고).
- **maintainability** — 위와 동일한 한계.

## 권장 조치사항

1. **[최우선]** 이번 라운드가 누락한 diff 준비 갭의 근본 원인을 조사·수정: diff/라우팅 산출 단계가 `git diff <base>...HEAD` 전체 파일 목록과 `meta.json.files`/reviewer payload 를 대조하는 self-check(assert)를 추가할 것. 최소한 `.claude/hooks/guard_review_before_push.py`, `.claude/tests/README.md`, `.claude/tests/test_push_guard_worktree_scope.py` 3개 파일을 대상으로 한 fresh 리뷰 1회를 별도로 재실행할 것(security/maintainability 를 포함해 전원 다시).
2. `.claude/tests/test_push_guard_worktree_scope.py:349` 의 파일 핸들 미close(`ResourceWarning`) 를 `with open(...)` 으로 수정.
3. `plan/in-progress/push-guard-worktree-scope.md` 를 최신 반영분(테스트 23건, mutation 11건, RESIDUAL GAP 신규 케이스)으로 갱신.
4. `review/code/2026/07/24/00_34_09/RESOLUTION.md` 헤더를 "6건 반영, 1건 근거 있는 미조치"로 정정.
5. `review/code/2026/07/24/00_34_09/SUMMARY.md` WARNING 표에서 maintainability 오귀속(실제는 INFO)을 정정.
6. (급하지 않음) `result is None` 분기와 RESIDUAL GAP 케이스에 대한 pin 테스트 추가 검토.

## 라우터 결정

- `routing: fallback-distrusted-decision` (router 의 자동 선별 결과를 신뢰하지 않고 fallback 으로 처리):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 강제) — 강제 목록 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |

**주의**: 강제(forced) 리스트 자체는 전원 실행·전원 결과 확보되어 이행됐으나, 그 리스트가 참조한 **diff payload 가 실제 코드 변경분을 누락**했다는 것이 이번 라운드의 핵심 CRITICAL 이다. "forced 전원 결과 확보"라는 사실이 "코드가 실제로 검토됐다"는 것을 보증하지 않는다.