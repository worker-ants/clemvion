# 테스트(Testing) Review — 2026/07/31 11_07_48

## 검증 방법

`.claude/tests/`(harness 자체 테스트) 전체를 실제로 실행해 회귀 여부를 1차 확인했다.

```
python3 -m unittest discover -s .claude/tests -p 'test_*.py'
→ Ran 684 tests ... OK
```

684건 전부 통과(기존 + 신규 포함). 이후 각 변경 지점을 코드 판독 + grep 전수 검색으로
"어떤 테스트가 이 경로를 실제로 검증하는가"를 추적했다.

## 발견사항

- **[WARNING]** `evaluate_review(in_flight_ok=True)` — Stop 쪽엔 신설된 "seam 단언"이 있는데 대칭인 push 쪽엔 없다
  - 위치: `.claude/hooks/guard_review_before_stop.py:344`(`decision = evaluate_review(in_flight_ok=True)`, 이번 diff 로 신설) / 비교 대상 `.claude/hooks/guard_review_before_push.py:846`(`evaluate_review` 참조 — 이번 diff 대상 아님, 미변경) / `.claude/tests/test_guard_review_before_push_main.py:72`(`_REVIEW_STUB`, 이번 diff 대상 아님)
  - 상세: 이번 수정의 핵심 불변식은 "`in_flight_ok=True` 는 Stop 전용이고 push 는 절대 넘기지 않는다"이다. Stop 쪽은 `test_stop_guard_failopen.py:113`(`test_stop_passes_in_flight_opt_in`)이 실제 프로세스를 띄워 stub 의 `evaluate_review(cwd=None, *, in_flight_ok=False)`(45행)가 어떤 값으로 호출됐는지 파일에 기록시키고 `"True"` 를 단언한다 — kwarg 가 빠지면 즉시 RED. 반대쪽(push)에는 이 불변식("push 는 절대 `in_flight_ok=True` 를 넘기지 않는다")을 직접 단언하는 테스트가 없다. `test_guard_review_before_push_main.py`의 `_REVIEW_STUB`(72행)은 `def evaluate_review():`로 파라미터가 아예 없어 실제 시그니처(`cwd=None, *, in_flight_ok=False`)를 반영하지 않는다 — 이 stub 은 실제 훅 파일을 fresh copy(`shutil.copy(HOOK_SRC, ...)`, 127행)해서 돌리므로, 미래에 push 호출부가 실수로 `in_flight_ok=True` 를 넘기게 되면 `TypeError`가 나고 `_evaluate_over_targets`(`guard_review_before_push.py:810-816`)의 `except Exception`이 이를 삼켜 해당 게이트를 fail-open(허용) 처리한다. 그 결과 `review="blocked"` 시나리오들(예: 202행)의 "exit 2" 단언이 깨지긴 하겠지만, 이는 **우연히 부작용으로 걸리는 것**이지 "in_flight_ok 불변식이 깨졌다"를 이름 붙여 진단하는 테스트가 아니다 — 실패 메시지만 보면 원인을 특정하기 어렵다.
  - 제안: `test_stop_passes_in_flight_opt_in` 과 대칭인 seam 테스트를 push 쪽에도 추가한다. 예: `test_push_guard_worktree_scope.py` 또는 `test_guard_review_before_push_main.py`에 `evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처의 stub 을 두고, 호출 시 받은 `in_flight_ok` 값을 기록해 `False`(또는 미전달)임을 직접 단언. `_REVIEW_STUB`의 시그니처도 실제 시그니처와 맞추는 편이 "Mock 적절성" 관점에서 낫다(현재는 0-인자라 실제 호출 계약과 괴리).

- **[WARNING]** `prioritize_bundle_files` 신설 4개 호출부 중 2개(`related_specs`/`conventions`)는 `collect_context` 종단 간 검증이 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:557-558`(`other_spec_files = prioritize_bundle_files(...)` / `convention_files = prioritize_bundle_files(...)`) — 비교: 이미 종단 검증이 있는 두 호출부는 `:491`(`--impl-prep`)과 `:504`(`--impl-done`)
  - 상세: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:131`은 "적용 지점: `--impl-prep`/`--impl-done` 의 scope 번들 + `related_specs` + `conventions`"라고 명시한다. 실제로 코드는 4곳 모두에 적용됐다(491, 504, 557, 558행). 그런데 `test_consistency_bundle_priority.py`의 `CollectContextUsesPriorityTest`(같은 파일, `test_impl_prep_uses_the_ranked_order`/`test_impl_done_uses_the_ranked_order`)는 오직 `ctx["target_doc"]`(즉 491/504행의 `scope_files`)만 정렬 결과로 검사하고, `test_consistency_context_budget.py`의 `RealAreaTargetSurvivalTest`도 `target_doc`만 확인한다. `ctx["related_specs"]`/`ctx["conventions"]`(557-558행이 만드는 값)를 검사하는 테스트는 harness 전체에 전무하다(`grep -rn '"related_specs"\|"conventions"' .claude/tests/`로 확인 — 유일한 매치는 `test_consistency_context_budget.py`의 순수 합성 fixture 문자열일 뿐, `collect_context` 가 실제로 만든 값이 아니다). 바로 이 항목의 plan 문서(같은 파일, 134-138행)가 "첫 seam 테스트가 vacuous 했다 — 호출부 pass-through 뮤턴트(`… = prioritize_bundle_files(...) and scope_files`)가 반환값만 버리는데도 스파이는 GREEN 이었다"를 직접 기록해 둔 바로 그 결함 형태가, 557-558행에는 아직 그 대응(효과-기반 단언)이 없는 채로 남아 있다. 즉 이 두 줄을 `prioritize_bundle_files(other_spec_files, root, **_rank)`(반환값 버림)로 되돌려도 현재 테스트 스위트는 전부 GREEN 을 유지할 것으로 판단된다(코드 판독 + grep 전수 검색 근거 — 실제 뮤테이션 실행은 리뷰어 쓰기 권한 범위(`review/code/**`) 밖이라 보류했다).
  - 제안: `CollectContextUsesPriorityTest`에 `ctx["related_specs"]`/`ctx["conventions"]`용 sentinel-순서 케이스를 추가(기존 `_scope_order`와 동일한 기법 — `prioritize_bundle_files`를 역정렬 스텁으로 교체 후 렌더 결과 순서를 단언). `conventions`/`related_specs`는 `impl_prep`/`impl_done` 모드와 무관하게 항상 채워지므로 별도 케이스 하나로 양쪽 모드를 다 검증 가능.

- **[INFO]** plan 문서의 테스트 건수 기재가 실제와 다르다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:92`
  - 상세: "테스트 `test_review_changeset_warning.py` 9건 + mutation 4종 RED"라고 적혀 있으나, 실제 `test_*` 메서드는 10개다(`WarnIfCommittedWorkIsMissingTest` 7개 + `DefaultPathIsWiredTest` 3개, `grep -c '    def test_'`로 확인). 참고로 자매 항목인 `harness-consistency-summary-downgrade-rule.md:132`의 "10건" 기재는 실제 개수(10)와 일치한다.
  - 제안: 사소한 오기재이므로 차단 사유는 아니지만, 이 프로젝트가 "실측" 문구의 정확성을 반복적으로 강조해 온 만큼 다음 편집 때 9→10 정정 권장.

- **[INFO]** `warn_if_committed_work_is_missing`이 "기본 경로에서만 발동"함을 보이는 회귀 테스트가 4개 분기 중 2개만 커버
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1150,1157,1163,1169,1176`(`if args.commit / elif args.range / elif args.branch / elif args.files / else:` 분기), 테스트는 `.claude/tests/test_review_changeset_warning.py:160-165`(`test_explicit_branch_does_not_warn`/`test_explicit_range_does_not_warn`)
  - 상세: `DefaultPathIsWiredTest`는 `--branch`/`--range`가 경고를 안 낸다는 것만 확인하고, 구조상 동일한 `elif` 사슬인 `--commit`/`--files` 분기는 "경고 미발동"을 별도로 확인하지 않는다. 네 분기 모두 같은 `if/elif/elif/elif/else` 형태라 회귀 위험은 낮지만, 커버리지 표는 4개 중 2개다.
  - 제안: `test_commit_does_not_warn`/`test_files_arg_does_not_warn` 두 케이스를 같은 패턴(`_calls("commit")`/`_calls("files")`)으로 추가하면 분기 전수 커버.

## 강점 (참고)

- 신설 테스트 2개 파일(`test_consistency_bundle_priority.py`, `test_review_changeset_warning.py`) 모두 실제 발생 이력(재발 횟수·측정치)을 docstring 에 남기고, "호출 여부"가 아니라 "효과"(정렬 순서·렌더 결과)를 단언하도록 설계돼 있다 — `CollectContextUsesPriorityTest`의 docstring 이 이전 버전의 call-count 스파이가 pass-through 뮤턴트에 뚫렸던 사실을 직접 기록하고 있는 점은 이 팀의 테스트 설계 성숙도를 보여준다(다만 위 WARNING 두 번째 항목처럼 그 교훈이 아직 전체 호출부에 고르게 퍼지지는 않았다).
- `test_stop_guard_failopen.py:113`의 `test_stop_passes_in_flight_opt_in`은 mock 시그니처를 실제 시그니처와 일치시키고(42-48행 주석이 그 이유를 명시) seam 을 통해 실제 kwarg 값을 검증하는 좋은 예다.
- `EvaluateInFlightShortCircuitTest`(`test_review_guard_hardening.py:183-204`)는 `in_flight_ok` 기본값(False)과 opt-in(True) 양방향을 모두 pin 해, 회귀가 어느 방향으로 나든 잡히게 설계됐다.
- 모든 신규/변경 테스트는 `tempfile.mkdtemp()` + `addCleanup` 또는 서브프로세스 격리(fresh interpreter) 기반이라 테스트 간 의존성이 없고, `SuiteLeavesNoRealStateTest`가 실제 저장소에 상태 파일이 새는지까지 별도로 감시한다.

## 요약

이번 diff(4개 프로덕션 파일 + 신규/갱신 테스트)는 harness 리뷰 게이트 자체의 결함 수정으로, 전체 684건 테스트가 회귀 없이 통과했고 신규 동작(`in_flight_ok` opt-in, `warn_if_committed_work_is_missing`, `prioritize_bundle_files`)에 대한 유닛 테스트 자체는 풍부하며 mock 도 실제 시그니처를 반영하도록 신경 쓴 흔적이 뚜렷하다. 다만 두 곳에서 "핵심 불변식을 지키는 종단/대칭 테스트"가 비대칭적으로 빠져 있다: (1) push 게이트가 `in_flight_ok=True`를 절대 넘기지 않는다는 것을 Stop 쪽처럼 직접 단언하는 테스트가 없고(간접 보호는 있으나 진단력이 약함), (2) `prioritize_bundle_files`가 실제로 적용된 4개 지점 중 `related_specs`/`conventions` 2곳은 `collect_context`를 통한 효과 검증이 전무해 — 바로 이 PR이 스스로 "vacuous 했다"고 기록한 것과 같은 모양의 pass-through 뮤턴트에 여전히 노출돼 있다(코드 판독 근거, 실행 검증은 권한 범위상 보류). 둘 다 현재 코드는 정확하지만, 향후 리팩터링이 같은 클래스의 결함을 조용히 재도입해도 잡아낼 안전망이 아직 없다.

## 위험도
MEDIUM
