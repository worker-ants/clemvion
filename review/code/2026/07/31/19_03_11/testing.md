# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 신규 backstop 의 "모델에 실제로 도달"하는 배선(wiring)이 어떤 테스트로도 보호되지 않는다 — mutation 으로 실측 확인
  - 위치: `.claude/hooks/guard_review_before_push.py:846-859` (`_evaluate_over_targets` 내 notes 수집 블록, 특히 857행 `for note in getattr(result, "notes", ()) or ():`)
  - 상세: `ReviewDecision.notes`(review_guard.py) → `_evaluate_over_targets`의 수집·중복제거 → `outcome.notes` → `_report_notes()`(stdout/stderr 분기) 로 이어지는 파이프라인 중, **정확히 가운데 단계**(수집·동적 속성부여·dedup)를 실행하는 테스트가 전무하다. 직접 실측했다: (1) `grep -rn "\.notes" .claude/tests/*.py` 결과 `test_block_integrity.py` 밖에는 `.notes` 를 참조하는 테스트가 전혀 없다. (2) `test_block_integrity.py::AdvisoryReachesTheModelTest` 는 `outcome.notes = [...]` 를 **수동으로 미리 채운 뒤** `_report_notes()`만 호출한다 — `_evaluate_over_targets`의 수집 로직 자체는 건드리지 않는다. (3) `test_guard_review_before_push_main.py`의 `_REVIEW_STUB._Decision` 은 의도적으로 `blocked`/`reason` 만 있는 좁은 dataclass(주석: "If main() starts reading another one, these stubs raise AttributeError… fail-loud")인데, 실제 수집 코드는 `getattr(result, "notes", ())`로 **방어적으로** 읽으므로 그 "fail-loud" 보장이 이 필드에는 적용되지 않아 스텁 기반 테스트로도 이 경로를 우연히도 잡아낼 수 없다. **뮤테이션으로 직접 검증**: `_evaluate_over_targets`에서 847~859행(notes 수집 블록 전체)을 삭제한 뒤 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 실행 — 735개 테스트 전원 GREEN(원복 완료, `git status`/`git diff --stat` 로 무변경 확인). 즉 이 배선이 통째로 사라져도 어떤 테스트도 알아채지 못한다. 이 PR 이 고치는 결함의 정의("review_guard must actually CALL the check — not merely be able to… That is the exact failure this backstop exists to prevent, one level up", `test_block_integrity.py` `GateSurfacesTheContradictionTest` 독스트링) 가 **그 자신의 새 코드에서 한 단계 위 계층으로 그대로 재발**할 수 있는 상태다.
  - 제안: `_evaluate_over_targets`를 실제 `evaluate_review`(또는 `notes` 필드를 가진 실물 `ReviewDecision`)와 실제(비-스텁) `failopen_state.Outcome`으로 호출해 `outcome.notes`가 올바르게 채워지는지 직접 단언하는 테스트를 추가한다. 최소 2케이스: (a) 단일 target 에서 `result.notes=("a",)` → `outcome.notes == ["a"]`, (b) 동일 note 를 내는 두 target → dedup 되어 1개만 남는지. 가능하면 `main()` 을 subprocess 로 구동해 실제 stdout 에 해당 note 문자열이 찍히는 end-to-end 케이스도 추가(`test_guard_review_before_push_main.py` 의 `_REVIEW_STUB._Decision` 에 `notes: tuple = ()` 필드를 추가하고 env-driven 옵션을 하나 더 두는 방식이 기존 패턴과 맞음).

- **[WARNING]** `summary_block_verdict`의 좌측-최우선(leftmost-match) 앵커링이 override-배너와 stale 판정 줄의 **한쪽 순서만** 테스트되어 있고, 반대 순서에서는 틀린 값을 반환한다 — 직접 재현
  - 위치: `.claude/_shared/block_integrity.py:89-100` (`summary_block_verdict`), 정규식은 `:54-58`(`_BLOCK_LINE`)
  - 상세: 독스트링과 `test_block_integrity.py::VerdictIsAnchoredTest`는 실제 732개 세션에서 관측된 4가지 형태를 전부 정확히 분류한다고 주장하고, 그 유일한 override-배너 사례(`test_an_override_banner_at_line_end_wins`)는 override 배너가 문서 **앞쪽**에, superseded 된 stale 판정 줄이 **뒤쪽**에 오는 순서다(`> ## ✅ 최종 판정 …: **BLOCK: NO**` 다음에 `**BLOCK: YES** (최초 판정 — 위 최종 판정으로 대체됨)`). `re.search`는 왼쪽에서 가장 먼저 매치되는 위치를 채택하므로 이 순서에서는 우연히 정답(override)이 이긴다. 그런데 이 함수는 순서에 무관하게 "다른 세션의 예전 판정을 서술하는 문장이 아니라 진짜 판정 줄"을 찾는 게 목적인데, **override 가 문서 뒤쪽에 오고 stale 판정이 앞쪽에 오는(반대) 경우**는 어떤 fixture 도 다루지 않는다. 실측:
    ```python
    text = "**BLOCK: YES** (초기 판정)\n\n> ## 최종 판정: **BLOCK: NO**\n"
    BI.summary_block_verdict(text)  # → 'YES'  (의도된 최종 판정 NO 가 아니라 stale YES 를 반환)
    ```
    메모리에 이미 기록된 교훈과 동일한 클래스다: "분기 매트릭스 완성 뒤에도 순서 fixture 는 양쪽에 다른 값을 넣어야 관측 가능" — 이 앵커링은 정확히 그 형태의 순서-의존 분기이고, 지금 코퍼스는 한쪽 순서만 담고 있다.
  - 제안: override 배너가 **stale 판정보다 뒤에** 오는 fixture(값도 반대로) 를 최소 1개 추가해 현재 동작이 의도인지 확정한다. 의도라면(즉 "override 는 항상 위에 온다"는 문서 저작 관례를 전제로 설계된 것이라면) 그 전제를 독스트링에 명시하고 테스트로 고정하고, 의도가 아니라면 최후(마지막) 매치를 우선하는 등 순서-불변 규칙으로 조정이 필요하다.

- **[WARNING]** 테스트 카탈로그(`README.md`)와 `test_retry_state_shared.py` 자신의 모듈 독스트링이 `--update` 커버리지를 과장 서술 — 실제로는 `--summary-state` 만 구동
  - 위치: `.claude/tests/README.md:61` (신규 행), `.claude/tests/test_retry_state_shared.py:10` (모듈 독스트링), `:56-58` (`_run` 헬퍼)
  - 상세: README 신규 행은 "The `--summary-state` / `--update` CLI contract after the five state-bookkeeping helpers moved to `_shared/retry_state.py`" 라고 적었고, 파일 자신의 독스트링도 "`--summary-state` and `--update` are read by `/loop`… so the exact stdout line and the stderr notice are the interface" 라고 두 CLI 를 모두 검증한다는 투로 서술한다. 그러나 `grep -n '"--update"' .claude/tests/test_retry_state_shared.py` 는 0건이다 — `_run()` 헬퍼는 `"--summary-state"` 인자만 하드코딩되어 있고, 파일 전체에 `--update`/`apply_status_update` 참조가 전혀 없다. `--update` 는 전체 스위트에서 `test_orchestrator_state.py`(코드리뷰 오케스트레이터 CLI 경유) 하나뿐이다(`grep -rln '"--update"' .claude/tests/*.py` 결과 그 파일 1건). `test_tests_readme_catalog.py` 는 "행이 존재하고 가리키는 파일이 실재하는지" 만 확인하고 행의 **서술 정확성**은 검증하지 않으므로, 이 과장은 그 가드를 통과한다.
  - 제안: README 행과 모듈 독스트링에서 `--update`(consistency_orchestrator 경유) 를 실제로 다루지 않는다는 점을 반영해 서술을 `--summary-state` 로 좁히거나, 아니면 `consistency_orchestrator.py --update` 를 구동하는 subTest 를 이 파일에 추가해 서술을 사실로 만든다(코드리뷰 쪽만 검증된 `apply_status_update` 공유 함수가 consistency 오케스트레이터의 CLI 배선을 통해서도 동일하게 동작하는지는 아직 실측되지 않았다).

- **[INFO]** `merge_coordinator_orchestrator.py` — 이번 diff 가 상태 위임 배선(`_load_state`/`_save_state`)을 바꿨는데도 이 파일을 구동하는 테스트가 전혀 없다
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:110-115` (`_load_state`/`_save_state` 위임), import 배선은 33-45행 근방(`CLAUDE_DIR` sys.path 추가 + `from _shared import retry_state`)
  - 상세: `code_review_orchestrator.py`/`consistency_orchestrator.py` 는 동일한 리팩터에 대해 `test_retry_state_shared.py`(신규) + 기존 `test_orchestrator_state.py`/`test_consistency_orchestrator_state.py` 로 보호받지만, 세 번째 사본인 이 파일은 어떤 테스트 파일에서도 참조되지 않는다(`grep -rl "merge_coordinator_orchestrator" .claude/tests/` 결과 0건). 수동으로 `--summary-state` 를 구동해 런타임 동작은 정상임을 확인했으나(변경 후에도 `pending=1 success=0 fatal=0 branches=2 base=main last_reset=null` 정상 출력), 이는 이번 리뷰가 만든 안전망이 아니라 즉석 확인일 뿐이다. plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 #9)가 이 파일의 `reconcile_state_with_disk` 부재를 이미 별도 후속으로 등재했으므로 완전히 방치된 사각지대는 아니지만, **이번에 실제로 변경된** `_load_state`/`_save_state` 위임 자체에 대한 회귀 보호는 여전히 0건이다.
  - 제안: `test_retry_state_shared.py` 에 `merge_coordinator_orchestrator.py --summary-state` 케이스를 세 번째 subject 로 추가(간단한 branch/base state 로 스모크 테스트 1개)하면 이 사각지대와 plan 후속 항목 어느 쪽에도 부담 없이 닫힌다.

- **[INFO]** `_CRITICAL_TAG` 정규식의 대소문자 민감성이 명시적으로 테스트되지 않음
  - 위치: `.claude/_shared/block_integrity.py:40` (`_CRITICAL_TAG = re.compile(r"\[CRITICAL\]")`, `re.IGNORECASE` 없음)
  - 상세: 리뷰어 템플릿이 항상 정확히 대문자 `[CRITICAL]` 을 쓴다는 전제(측정 기반 주석은 있음)에 의존하지만, `[critical]`/`[Critical]` 같은 변형이 들어오면 조용히 미검출된다. 실제 위험은 낮아 보이나(코드베이스 전반의 리뷰어 출력 형식이 강제되어 있음), 이 전제를 테스트로 명문화한 케이스는 없다.
  - 제안: `test_ignores_prose_and_the_risk_scale` 옆에 `[critical]`(소문자) 이 의도적으로 0으로 카운트된다는(혹은 카운트되어야 한다는) 단언을 1줄 추가해 현재 동작이 우연이 아니라 의도임을 고정.

## 요약

신규 파일(`block_integrity.py`, `retry_state.py`) 과 그 테스트(`test_block_integrity.py`, `test_retry_state_shared.py`) 자체는 품질이 높다 — 실제 프로덕션 세션 4건을 그대로 재현한 회귀 픽스처, 실제 임시 디렉터리·실제 모듈 로딩을 쓰고 과도한 mock 을 피한 점, `addCleanup` 기반의 확실한 격리, 의도를 설명하는 이름이 강점이다. 오케스트레이터 3곳의 리팩터(5개 함수를 `_shared/`로 위임)는 전부 subprocess/CLI 경유 기존 테스트에 의해 보호되며, 전체 스위트(735개)가 변경 없이 GREEN 임을 직접 실행해 확인했다. 다만 이 PR 의 핵심 목적 — "하향 판정이 조용히 통과되던 것을 사람이 실제로 볼 수 있게 만든다" — 을 완성하는 마지막 배선(`_evaluate_over_targets`의 notes 수집)은 뮤테이션으로 직접 확인한 결과 어떤 테스트도 보호하지 않으며, 이는 이 PR 이 고치려는 결함 클래스("아무도 읽지 않는 규칙")가 그 자신의 새 코드에서 한 단계 위로 재발할 수 있는 상태다. 여기에 판정 앵커링의 순서-의존성 미검증, 그리고 테스트 카탈로그의 커버리지 과장 서술(`--update`)이 겹쳐, "무엇이 실제로 보호되는가"에 대한 문서상 신뢰와 실제 사이에 괴리가 있다.

## 위험도
MEDIUM
