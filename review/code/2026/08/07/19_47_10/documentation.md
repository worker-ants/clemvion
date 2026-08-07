# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** 테스트 카탈로그(`test_retry_state_shared.py` 행)가 이번 diff 로 추가된 두 테스트 클래스를 설명하지 않음
  - 위치: `.claude/tests/README.md:79`
  - 상세: 이 diff 는 `test_retry_state_shared.py` 에 `FatalSurvivesALostUpdateTest`(약 8개 테스트 메서드 — `agents_fatal` 유실-복구, sentinel 상호작용, advisory 실패 처리 등)와 `MergeCoordinatorReconcilesWithDiskTest`(약 6개 테스트 메서드 — 세 번째 orchestrator 의 `--summary-state`/`--resume` 자가치유)를 새로 추가했다. 그런데 79번째 줄의 카탈로그 행은 여전히 예전 `--summary-state` CLI 계약(`_emit_summary_state` 필드 차이·stderr "reconciled" 알림) 설명만 담고 있고, 이번에 추가된 두 클래스는 전혀 언급하지 않는다.
    같은 diff 안에서 신규 파일 `test_branch_diff_shared.py` 는 무엇을 왜 고정하는지 상세히 서술한 행을 새로 받았는데(80번째 줄), 정작 기존 파일에 실질적으로 추가된 내용은 카탈로그에 반영되지 않아 비대칭이다.
    `.claude/tests/test_tests_readme_catalog.py` 가드는 "행이 존재하는가/죽은 행이 없는가"만 검사하고 내용의 최신성은 검사하지 않으므로(스스로도 그렇게 문서화되어 있다), 이 gap 은 CI 로 잡히지 않는다. 이 저장소는 "테스트 파일이 무엇을 지키는지 기록되지 않은 채 조용히 드리프트하는 것"을 이 README 의 존재 이유로 명시하고 있어(`test_tests_readme_catalog.py` 자신의 docstring), 이번 케이스가 정확히 그 실패 모드다.
  - 제안: 79번째 줄 행에 `_fatal/<name>` sentinel 유실-복구 회귀(레이스를 재진입으로 결정적으로 재현하는 기법 포함)와 merge-coordinator 세 번째 orchestrator 자가치유 커버리지를 요약해 추가한다.

- **[WARNING]** `_shared/retry_state.py` 모듈 docstring 제목이 현재 소비자 수를 과소 서술
  - 위치: `.claude/_shared/retry_state.py:1`
  - 상세: 첫 줄이 `` "`_retry_state.json` bookkeeping, shared by both orchestrators." `` 라고 되어 있고, 뒤이은 본문도 `code_review_orchestrator`/`consistency_orchestrator` 두 곳만 기원(origin) 서사로 언급한다. 그러나 이 파일의 같은 테스트 스위트에 이미 `MergeCoordinatorUsesTheSharedStateTest`("The third consumer, which had no test of its own.")가 존재했고, 이번 diff 는 그 세 번째 orchestrator(`merge_coordinator_orchestrator.py`)에 `_reconcile_state_with_disk` 위임까지 추가해 다섯 개 공유 함수 전부를 사용하는 완전한 세 번째 소비자로 만들었다(diff: `def _reconcile_state_with_disk(session_dir): return _retry_state_lib.reconcile_state_with_disk(session_dir)`). 즉 이 diff 자체가 "두 orchestrator 공유" 라는 제목을 더 부정확하게 만드는 변경인데, 제목은 갱신되지 않았다.
  - 제안: 제목을 "shared by the three orchestrators" 또는 "shared across the three orchestrators (code-review, consistency, merge-coordinator)" 식으로 갱신하거나, 최소한 본문 어딘가에 "merge-coordinator 는 이번 변경으로 다섯 함수 전부에 대해 동등한 세 번째 소비자가 되었다"는 한 문장을 추가한다.

- **[INFO]** 신규 import 바로 위 주석이 그 import 를 설명하지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47`
  - 상세: 43~46번째 줄 주석("Report location/validity is shared with the push/stop gate — see `.claude/_shared/report_paths.py`. ...")은 바로 아래 세 import(`git_probe`, `report_paths`, `retry_state`) 중 `report_paths` 만을 설명하는 내용이다. 이번 diff 로 `git_probe` import 가 알파벳 순으로 그 주석과 `report_paths` import 사이에 끼어들면서, 주석이 마치 세 import 전체(특히 바로 아래 `git_probe`)를 설명하는 것처럼 읽힐 여지가 생겼다. `git_probe.py` 자체에는 풍부한 module/function docstring 이 있어 실질적 정보 손실은 없지만, 이 위치의 주석만 보면 오독 가능성이 있다.
  - 제안: 필수는 아니지만, `git_probe` import 줄에 짧은 인라인 주석(예: `# branch-diff probe shared with consistency_orchestrator`)을 붙이거나 주석 블록을 report_paths import 바로 위로 재배치하면 명확해진다.

## 확인했으나 문제 없다고 판단한 항목

- `.claude/skills/code-review-agents/README.md` — `_fatal/` 디렉토리 트리 예시, JSON 스키마 주석(`agents_success`/`agents_fatal` 재도출 방식), "디스크가 심판이다" 블록쿼트 모두 실제 `retry_state.py` 구현(합집합 재도출, `--sync-from-disk` 존재 등)과 정확히 일치한다.
- `.claude/skills/merge-coordinator/README.md` — 자체 `_retry_state.json` 스키마 절이 "기본 필드는 `../code-review-agents/README.md` 참고"로 명시적으로 위임하고 있어, `_fatal/` sentinel 문서를 중복 기술하지 않은 것은 의도된 설계이며 갱신 누락이 아니다.
- `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` 의 새 주석("This skill's own SKILL.md documents a manual `Agent` fan-out fallback...")은 실제로 `SKILL.md:67` `#### 3-fallback. 수동 Agent fan-out (Workflow 불가 시)` 절과 정확히 대응한다.
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `_branch_changed_rels` docstring 중 "Whole-repo on purpose" 서술은 이번 diff 로 `-- .` pathspec 이 제거되면서(원래 `root == 프로세스 cwd`일 때만 참이었던 것이) 호출 위치와 무관하게 항상 참이 되어, 오히려 이전보다 더 정확해졌다 — 갱신 누락이 아니다.
- `.claude/_shared/git_probe.py` 의 신규 `_run_git_raw`/`branch_diff_files` 함수 docstring 은 측정치·근거·기존 함수와의 관계를 상세히 서술하고 있어 공개 함수 문서화 기준을 충분히 만족한다.
- 이번 diff 는 신규 환경변수·API 엔드포인트를 추가하지 않았고, `CHANGELOG.md` 는 이 저장소 관례상 `codebase/` 제품 변경만 다루므로(`.claude/` 하네스 변경에 대한 선례 없음) CHANGELOG 갱신 대상이 아니다.
- `plan/complete/harness-review-gate-followups-handoff.md` 는 종결 시점에 "이 인계문의 §6 착수 메모가 틀렸다"를 스스로 명시하며 원문을 정정하지 않고 그 이유(교훈 보존)를 남기는 방식으로, 이 저장소의 "전제는 낡는다" 관례에 부합하는 모범적인 기록이다 — 문서 결함이 아니다.

## 요약

이번 diff 는 `.claude/_shared/git_probe.py`(`branch_diff_files`/`_run_git_raw` 신설)와 `.claude/_shared/retry_state.py`(`agents_fatal` sentinel 재도출)라는 두 공유 모듈에 대해 매우 상세한 함수·모듈 docstring, 측정치 기반 근거, README 스키마 동반 갱신을 갖추고 있어 전반적인 문서화 수준은 높다. 다만 (1) `.claude/tests/README.md` 의 `test_retry_state_shared.py` 카탈로그 행이 이번에 추가된 두 개의 실질적인 테스트 클래스(패닉 없이 세 번째 orchestrator 자가치유·fatal sentinel 복구)를 반영하지 못해 이 저장소 자신의 "테스트 목적 기록" 관례에 어긋나고, (2) `retry_state.py` 모듈 제목이 이번 diff 로 완성된 "세 번째 orchestrator 완전 소비자화"를 반영하지 못한 채 "두 orchestrator" 로 남아 있다. 둘 다 기능적 위험은 없는 문서 갱신 누락이다.

## 위험도

LOW
