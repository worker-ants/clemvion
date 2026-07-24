# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. Warning 1건(순수 감사기록 라운드 오귀속 — 기능 코드 영향 없음). 나머지는 전부 INFO(재확인·이월) 또는 해당 없음. forced 화이트리스트 7명 전원 결과 확보됨(강제 미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 감사기록 라운드 오귀속 — "2차 RESOLUTION 이 틀렸다"는 서술이 실제로는 1차(17_28_02) RESOLUTION 을 가리켜야 함. `17_28_02/RESOLUTION.md` 옛 버전(1차)이 "위 2건이 커버"라 잘못 주장했고 1차 자신이 정확히 자기귀속("당시")했으나, 3차 RESOLUTION.md와 이를 요약한 plan.md 3차 절이 이를 "2차 RESOLUTION 이 틀렸다"로 오기재. 같은 라운드의 SUMMARY.md(18_06_41)는 정확히 1차를 지목해 산출물 간 내부 모순 존재 | `review/code/2026/07/23/18_06_41/RESOLUTION.md:9,11,24,59-60`, `plan/in-progress/push-guard-worktree-scope.md:90` | "2차" 3+1곳을 "1차"로 정정. 기능 코드 영향 없음, 감사 추적 신뢰도 차원의 정정 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 커맨드 인젝션 표면 없음(`_worktree_branches`, 리스트 인자, `shell=True` 미사용, `timeout=5.0` + fail-open) | `.claude/hooks/guard_review_before_push.py:357-371` | 조치 불요 |
| 2 | Security | 1차 WARNING(길이 상한 부재로 인한 DoS 가능성)이 truncation + 전용 회귀 테스트로 닫힘, cwd 검사는 절대 약화 안 됨 | `.claude/hooks/guard_review_before_push.py:439`, `.claude/tests/test_push_guard_worktree_scope.py:322-356` | 검증 완료, 조치 불요 |
| 3 | Security | 게이트 우회 표면(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`)이 scoped target 확장에도 약화 없이 그대로 적용 | `.claude/hooks/guard_review_before_push.py:506`, `test_bypass_still_applies_to_scoped_targets` | 조치 불요 |
| 4 | Security | per-target fail-open + `main()` target-선택 폴백, 두 독립 false-ALLOW 경로 모두 회귀 테스트로 고정 확인 | `_run_gate:494-520`, `main():535-539` | 검증 완료 |
| 5 | Requirement | 관련 spec 문서 없음 — harness 전용 변경이라 정상(spec drift 아님) | `.claude/hooks/guard_review_before_push.py` 전체 | 조치 불요 |
| 6 | Requirement | `_run_gate` 필드명(`.blocked`/`.reason`/`.untouched`/`.plan_path`)이 실제 `ReviewDecision`/`PlanDecision`과 1:1 일치, `main()` 모든 경로가 int 반환 | `guard_review_before_push.py:494-520,542-561` | 조치 불요 |
| 7 | Requirement | 핵심 요구사항(cwd 대신/추가로 push 대상 worktree 평가)이 e2e 3종 테스트로 독립 재확인됨 | `test_false_allow_hole_is_closed` 등 | 조치 불요 |
| 8 | Requirement | 3라운드 자기정정 이력이 감사 가능한 형태로 남아 있고 최신 상태에서 유효함을 재실행으로 확인 | plan.md:79-96, 관련 테스트 2건 | 조치 불요 |
| 9 | Side Effect | 신규 테스트가 임시 복사본에만 소스 패치 수행 — 저장소 부작용 없음, `addCleanup`으로 완전 정리 | `test_push_guard_worktree_scope.py:280-320` | 조치 불요 |
| 10 | Side Effect | 서브프로세스 env가 `dict(os.environ)` 복사본에만 대입 — 테스트 프로세스 자신의 env 불변 | `test_push_guard_worktree_scope.py:301-306` | 조치 불요 |
| 11 | Side Effect | 훅 본체 부작용 프로파일 이번 라운드 무변경(재확인) | `guard_review_before_push.py` 전체 | 조치 불요 |
| 12 | Maintainability | 신규 테스트가 `_run()` 헬퍼를 우회해 env+subprocess 보일러플레이트를 3번째로 반복 | `test_push_guard_worktree_scope.py:280-320` | 급하지 않음. `_run()`에 `hook_path=None` 키워드 인자 추가로 통합 가능(후속 defer 가능) |
| 13 | Testing | 신규 테스트가 REVIEW 게이트 차단만 단언, PLAN 게이트 쪽 동일 폴백 발동은 별도 시나리오로 미검증(공유 변수라 위험 낮음) | `test_push_guard_worktree_scope.py:280-320,319-320` | 우선순위 낮음. `STUB_PLAN_BLOCKED_PATHS` 대칭 케이스 추가 시 완전성 향상 |
| 14 | Testing | detached-HEAD 파싱 분기, `_accepts_cwd`의 signature 조회 실패 분기 여전히 직접 미자극(1~3차부터 defer됨, 재확인) | `guard_review_before_push.py:372-383,427-428` | 선택, 미조치 유지 가능 |
| 15 | Testing | 일부 테스트가 README 컨벤션(`_harness.load_module_by_path`) 대신 수동 `sys.path.insert`+`importlib` 사용(반복 기존 지적) | `test_push_guard_worktree_scope.py:366-370,403-410` | 조치 불요 |
| 16 | Documentation | 모듈 최상단 docstring이 cross-worktree 평가 계약을 여전히 요약 안 함(3라운드 연속 의도적 보류, plan에 명시) | `guard_review_before_push.py:1-24` vs `315-349` | 선택, 이월. 한 줄 추가 권고 |
| 17 | Documentation | 테스트 카탈로그(`README.md`) 1행이 4라운드째 늘어난 안전핀 테스트를 이름으로 언급 안 함(최초 커밋 후 갱신 0회) | `.claude/tests/README.md:45` | 선택, 이월. "PLAN 게이트도 동일 스코핑" + "시그니처 계약 테스트 포함" 구절 추가 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Critical/Warning 0. 커맨드 인젝션·경로탐색·시크릿 없음. 1차 WARNING(길이상한) 반영 확인. false-ALLOW 2경로 모두 회귀 고정 확인(INFO) |
| requirement | LOW | 핵심 기능(교차-worktree 검증)이 코드·테스트·plan 문서 line-level 일치. 3라운드 mutation 실측 재확인. 신규 발견 0 |
| scope | NONE | 39개 파일 전부 단일 정합성 fix + 3라운드 리뷰 대응에 종속. 무관 파일·불필요 리팩터·기능확장 없음 |
| side_effect | LOW | 훅 본체 이번 라운드 무변경. 신규 테스트는 격리된 임시 사본에만 패치, 잔재 없음 |
| maintainability | LOW | 훅 본체 무변경, 과거 WARNING 전부 해소 유지. 신규 테스트의 헬퍼 미재사용(INFO, 급하지 않음) |
| testing | LOW | mutation 재현으로 3차 WARNING 해소 검증(단일 테스트가 M7 kill). 하네스 전체 487/487 green. PLAN 경로 미검증(INFO) |
| documentation | LOW | 문서화 품질 대체로 높음. WARNING 1건(감사기록 라운드 오귀속, 기능 무관). INFO 2건(docstring 요약 부재, 테스트 카탈로그 미갱신, 둘 다 이월) |

## 발견 없는 에이전트

없음 (전 에이전트 각자 최소 1건 이상의 INFO/WARNING 발견, scope 만 위험도 NONE으로 실질 스코프 이탈 없음).

## 권장 조치사항

1. (WARNING, 낮은 긴급도) `review/code/2026/07/23/18_06_41/RESOLUTION.md` 9·11·24·59-60행과 `plan/in-progress/push-guard-worktree-scope.md` 90행의 "2차 RESOLUTION 이 틀렸다" 오귀속을 "1차(17_28_02) RESOLUTION" 으로 정정 — 기능 코드 영향 없음, 감사 추적 정확성 차원.
2. (선택, 이월) 모듈 최상단 docstring에 "각 게이트는 cwd 뿐 아니라 push 명령이 언급한 다른 checked-out worktree도 평가한다" 한 줄 추가.
3. (선택, 이월) `.claude/tests/README.md` 테스트 카탈로그 문장에 PLAN 게이트 스코핑 및 시그니처 계약 테스트 커버리지를 반영해 갱신.
4. (선택, 후속) `test_push_targets_crash_falls_back_to_cwd` 등 유사 테스트가 `_run()` 헬퍼를 재사용하도록 `hook_path` 키워드 인자를 추가해 env/subprocess 보일러플레이트 3중 반복을 통합.
5. (선택, 완전성) PLAN 게이트가 `main()`의 target-선택 폴백에서 동일하게 동작함을 보이는 대칭 테스트 케이스 추가(현재는 REVIEW 경로만 직접 증명).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 강제, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |