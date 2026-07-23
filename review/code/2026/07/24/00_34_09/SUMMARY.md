# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 이 훅의 핵심 목적(교차-worktree push 리뷰 우회 차단)과 정확히 같은 클래스의 false-ALLOW 잔여 갭(bare `git push`, upstream tracking 의존)이 security·requirement 두 리뷰어에서 독립적으로 발견됐고, 그 실패 경로가 자신이 천명한 "fail-open 은 절대 침묵하지 않는다"(§E) 관측 불변식과도 충돌할 수 있음이 requirement·testing 리뷰어에서 실측/코드분석으로 확인됨. 모든 forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 결과는 전원 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Requirement | `_mentions_branch` 매칭이 push 명령 텍스트에 대상 branch 이름이 리터럴로 등장할 때만 동작 — `cd <다른 worktree> && git push`(upstream tracking 의존 bare push, 흔한 git 사용 패턴)는 branch 이름이 텍스트에 없어 target 에서 누락되고, 이 PR 이 닫으려던 것과 동일한 클래스의 false-ALLOW 가 재발할 수 있다. plan 문서의 "남은 갭(의도)"는 "체크아웃 안 된 branch"만 언급할 뿐 이 케이스는 미문서화. cwd 자체는 항상 평가되므로 완전 무검사는 아님(no regression) | `.claude/hooks/guard_review_before_push.py` `_mentions_branch`(414-431행), `_push_targets`(459-477행) | plan 문서에 이 케이스를 명시적 잔여 위험으로 추가. 가능하면 `cd <worktree-path>` 형태로 텍스트에 남는 worktree 경로도 `_worktree_branches` 결과와 대조해 target 에 포함하는 보조 규칙 검토 |
| 2 | Requirement | `main()` 에서 `_push_targets()` 자체가 예외를 던지면 `[cwd]` 로 조용히 축소 폴백되는데, 이 실패가 fail-open 관측(§E, `outcome.degraded`)에 전혀 기록되지 않음 — push DETECTION 실패는 명시적으로 관측되는 것과 비대칭. 실측(패치 스크립트로 재현) 결과 두 게이트가 축소 스코프 위에서 정상 응답하면 streak 파일이 생성되지 않아 "완전 건강한 실행"으로 오판됨 | `.claude/hooks/guard_review_before_push.py:706-710`(`main()`), 대비 outer `except Exception as exc:` 블록(714-723행) | `main()` 의 `_push_targets` except 블록에서도 `outcome.degraded.append(("TARGET_SELECTION", ...))` 기록. 회귀 테스트로 streak 파일 생성 여부 단언 추가 |
| 3 | Maintainability/Architecture | `_run_gate()` 헬퍼가 origin/main 재구조화 병합으로 `_evaluate_over_targets`+`_run_gates` 로 대체되면서, 병합 전 7줄이던 `main()` 의 REVIEW/PLAN 호출부가 다시 21줄짜리 동일 골격(BYPASS 체크 → import 실패 체크 → 호출 → print+return) 두 벌로 재발. 세 번째 게이트 추가 시 이 프로젝트가 과거 겪은 "미러링된 두 블록 중 한쪽만 갱신" drift 패턴 재현 위험 | `.claude/hooks/guard_review_before_push.py:639-685`(`_run_gates`) — REVIEW 641-661행, PLAN 663-683행 | `_run_one_gate(evaluate, bypass_env, gate, import_error, targets, outcome, is_blocked, render)` 같은 헬퍼로 재추출해 병합 전 압축 수준 회복 |
| 4 | Documentation/Testing/Requirement/Maintainability | 병합으로 사라진 함수명 `_run_gate` 를 README 테스트 카탈로그와 테스트 docstring 두 곳이 여전히 현재형으로 인용 — 실제 코드엔 `_evaluate_over_targets`/`_run_gates` 뿐(`grep` 0건). 자동 가드(`test_tests_readme_catalog.py`)는 행 존재만 검사해 이 drift 를 못 잡음 | `.claude/tests/README.md:47`, `.claude/tests/test_push_guard_worktree_scope.py:247` | 두 곳 모두 `_evaluate_over_targets`(또는 `_run_gates`)로 정정. 리뷰 라운드 인용은 감사 이력이므로 유지 |
| 5 | Documentation | 4라운드 걸려 반영됐던 모듈 docstring 의 cross-worktree 평가 요약 한 줄("Each gate evaluates not just the hook's own cwd but also any other checked-out worktree whose branch the command names…")이 origin/main 재구조화 병합(`feda5b219`) 과정에서 origin 쪽 docstring 을 base 로 채택하며 소리 없이 유실. plan 문서의 "origin/main 재구조화 흡수" 절에도 이 회귀 자체가 기록돼 있지 않음 | `.claude/hooks/guard_review_before_push.py:14-24`(module docstring) | `990c6c69a` 커밋의 해당 문장을 복원. plan 문서에 "병합 시 docstring 요약 한 줄 유실 → 5차에서 복원" 한 줄 남겨 감사 추적 보완 |
| 6 | Testing | 이번 병합으로 신규 추가된 `_evaluate_over_targets` 의 `if result is None: continue` 분기가 `outcome.answered` 갱신 없이 넘어가는데, 모든 target 이 None 을 반환해 루프가 끝나면 그 게이트는 `answered` 에도 `degraded` 에도 등재되지 않아 배너·streak 리셋 둘 다 발생하지 않음 — 모듈이 스스로 천명한 "fail-open 은 절대 침묵하지 않는다" 원칙과 상충 가능. 현재 `evaluate_review`/`evaluate_plan` 은 None 을 반환하는 경로가 없어 오늘은 죽은 코드 | `.claude/hooks/guard_review_before_push.py:627`(`_evaluate_over_targets`) | 도달 불가능하면 분기 제거+assert 로 명문화, 아니면 스텁에 None 반환 케이스를 추가해 동작을 테스트로 고정하고 §E 정책상 허용 가능한지 docstring 에 남길 것 |
| 7 | Side Effect | 신규 테스트 `MentionsBranchTest.setUp`/`AcceptsCwdContractTest.setUp` 이 `sys.path.insert` 를 멤버십 검사 없이 매 테스트 메서드마다 반복 호출 — 이 저장소가 `_harness.py` 에서 명문화한 "sys.path 삽입은 import 시점에 1회, 멱등하게" 관례 위반. `AcceptsCwdContractTest` 는 `_lib` 자체를 `sys.path[0]` 에 얹어 `review_guard`/`plan_guard` 를 패키지 한정자 없는 최상위 모듈로 캐싱 — `_harness.py` 가 경고하는 네임스페이스 충돌 표면과 동일 클래스. 오늘 당장 충돌 증거는 없음 | `.claude/tests/test_push_guard_worktree_scope.py:414`, `:451-452` | 모듈 top-level 또는 `setUpClass` 에서 `if ... not in sys.path:` 가드로 1회만 삽입하도록 통일, 또는 `addCleanup` 으로 복원 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 1차 리뷰 WARNING(길이 상한 부재 DoS 우려)이 `_MAX_REDACTION_INPUT` truncation + 전용 회귀 테스트로 닫혔음을 재검증 확인 | `_push_targets` | 조치 불요 |
| 2 | Security | per-target fail-open + gate당 1회 degraded 기록(#999 재이식) 두 불변식 모두 회귀 테스트로 고정됨을 재검증 | `_evaluate_over_targets`(598-636행) | 조치 불요 |
| 3 | Side Effect | push 마다 `git worktree list --porcelain` 서브프로세스 신규 추가(읽기전용, fail-open) | `_worktree_branches`(380-411행) | 조치 불요 — 의도된 트레이드오프 |
| 4 | Side Effect | `evaluate_review`/`evaluate_plan` 호출 빈도가 push당 1회 → target 수만큼으로 변경. 두 함수 모두 파일쓰기·전역상태 변경 없음을 grep 으로 확인 | `_evaluate_over_targets` 호출부 | 조치 불요 |
| 5 | Testing | `_PLAN_STUB` 이 프로덕션 `PlanDecision` 의 `complete_but_in_progress` 필드를 미러링하지 않음(오늘은 무해, push 경로에서 미참조) | `test_push_guard_worktree_scope.py:68-72` | 급하지 않음 — 스텁에 필드 추가 권장 |
| 6 | Testing | 단일 push 명령이 2개 이상의 non-cwd worktree 를 동시에 언급하는 시나리오 미검증 | `_push_targets` for 루프 | 급하지 않음 — 3-worktree 시나리오 테스트 1건 추가 권장 |
| 7 | Testing | `BYPASS_PLAN_GUARD` 가 스코프된 target 에도 적용되는지 대칭 검증 없음(REVIEW 만 테스트됨, 코드 구조상 리스크 낮음) | `test_bypass_still_applies_to_scoped_targets` | 급하지 않음 |
| 8 | Testing | 전체 스위트 실행 시 `test_line_anchors.py` 1건 실패하나 이 diff 대상 파일 아님(리뷰 산출물 크기로 인한 우연한 임계치 도달로 추정) — 오귀속 방지 차원 기록 | `test_line_anchors.py::test_diff_blocks_are_annotated_and_correct` | 조치 불요 |
| 9 | Maintainability | `_evaluate_over_targets` 안 "gate 를 answered 로 표시" 2줄 조건문이 early-return/loop-후 두 곳에 반복 | `guard_review_before_push.py:630-635` | 선택적 — 로컬 헬퍼로 통합 가능 |
| 10 | Maintainability | `_mentions_branch` 의 `before or " "` 경계 처리 트릭에 인라인 주석 없음(1~2차 리뷰부터 이월) | `guard_review_before_push.py:427-429` | 낮은 우선순위 |
| 11 | Architecture | `_evaluate_over_targets` 가 스코핑 순회 + fail-open 관측 두 책임을 의도적으로 결합(문서화된 트레이드오프, M9 mutation 으로 고정) | `guard_review_before_push.py:598-636` | 조치 불요 — 세 번째 축 추가 시 `GateSpec` dataclass 화 고려 |
| 12 | Architecture | worktree 토폴로지 헬퍼가 여전히 훅 파일에 인라인 — 이 프로젝트의 "두 번째 소비자가 생기면 추출" 관례에 정확히 부합(Stop 훅이 아직 무인자 호출이라 두 번째 소비자 없음) | `guard_review_before_push.py:344-477` | 조치 불요 — Stop 훅에 필요해지면 `_lib/worktree_scope.py` 로 추출 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | bare push false-ALLOW 잔여 갭(WARNING); 길이상한·fail-open·인젝션 표면 등은 검증 완료(INFO) |
| requirement | MEDIUM | `_push_targets()` 실패 시 fail-open 관측 누락(WARNING) + bare push false-ALLOW(WARNING, security 와 동일 지점) + `_run_gate` 이름 drift(WARNING, 중복) |
| scope | NONE | 발견 없음 — 병합 재이식이 최소 변경(헬퍼 재배선+테스트 1건)임을 diff 대조로 확인 |
| side_effect | LOW | 테스트 `sys.path` 무가드 반복 삽입(WARNING); 그 외 순수 읽기전용/격리 확인(INFO) |
| maintainability | LOW | `_run_gates` REVIEW/PLAN 골격 중복 재발(WARNING); 두 이전 WARNING(DRY, 죽은 파라미터) 해소 확인 |
| testing | LOW | `result is None` 미검증 분기 + `_run_gate` 이름 drift(WARNING 2건); 커버리지 여백 다수(INFO) |
| documentation | LOW | 모듈 docstring 요약 유실(WARNING) + `_run_gate` 이름 drift(WARNING, 중복); 나머지 문서 정합 확인 |
| architecture | LOW | `_run_gates` 잔여 중복(WARNING, maintainability 와 동일 지점); 순환의존·병합 무결성 확인 |

## 발견 없는 에이전트

- scope — 무관한 파일·불필요 리팩토링·기능 확장·포맷팅 변경 없음. 위험도 NONE.

## 권장 조치사항

1. `_mentions_branch` 의 커버리지 갭(bare `git push`, branch 이름 미언급)을 plan 문서에 명시적 잔여 위험으로 기록하고, 가능하면 worktree 경로 매칭으로 보강한다 (security+requirement 공통 지적, 이 PR 의 핵심 목적과 직결).
2. `main()` 의 `_push_targets()` 실패 폴백을 fail-open 관측(§E, `outcome.degraded`)에 연결해 "완전 침묵" 상태를 없앤다 (requirement).
3. `_evaluate_over_targets` 의 `result is None` 분기의 의도(도달 가능/불가능)를 확정하고 테스트로 고정한다 (testing).
4. `_run_gates` 의 REVIEW/PLAN 잔여 골격 중복을 얇은 헬퍼로 재추출한다 (maintainability+architecture).
5. README 카탈로그·테스트 docstring 의 `_run_gate` → `_evaluate_over_targets` 이름 정정 (documentation+testing+requirement+maintainability 공통).
6. 유실된 모듈 docstring cross-worktree 요약 한 줄 복원 (documentation).
7. 신규 테스트의 `sys.path.insert` 를 멱등 가드 또는 `setUpClass`/`addCleanup` 패턴으로 정리 (side_effect).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, architecture (8명)
  - **제외**: 표 참고 (1명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | concurrency | router 가 이번 변경 범위(push 훅 스코핑 로직, 동시성 프리미티브 미도입)에서 관련성 낮다고 판단해 제외 |

---

**참고**: 이번 라운드는 병렬 세션(#999/#1000, fail-open 관측 구조)이 origin/main 에 먼저 머지된 뒤 이 브랜치의 worktree-scoping 수정을 재이식(`feda5b219`)한 직후 상태를 대상으로 함. 직전 4라운드(17_28_02 / 17_51_28 / 18_06_41 / 18_22_56)는 이미 CRITICAL 0 / WARNING 0~1 로 수렴했으나, 이번 병합 자체가 새로운 문서 drift(§4, §5)와 잠재적 불변식 위반(§2, §6)을 재도입했다.
---

> **main Claude 정정 주석 (2026-07-24, `/ai-review` 01_02_21 WARNING 4)** — 위 WARNING 표에서
> `_run_gate` 이름 drift 를 **maintainability 공동 발견으로 표기한 것은 오귀속**이다. 그
> checker 원문(`maintainability.md`)은 이를 `[INFO]` 로 분류했고, 같은 파일의 "에이전트별
> 위험도 요약" 표와도 어긋난다. 정확한 제기자는 **documentation · testing · requirement** 3인.
> "권장 조치사항" 5번의 동일 오귀속에도 같은 정정이 적용된다.
>
> 원문 표는 **고쳐 쓰지 않는다**(감사 무결성 — 산출물은 생성 시점 그대로 보존). 본 주석이
> 정정 기록이며, 재집계 시 이 귀속을 위 3인으로 읽을 것. 처리 방향에는 영향이 없다.
