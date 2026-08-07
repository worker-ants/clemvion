# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `agents_fatal` 이 이제 JSON 뿐 아니라 `_fatal/<name>` sentinel 파일과의 **합집합**으로 재도출된다 — 사람이 `_retry_state.json` 을 직접 열어 `agents_fatal` 에서 이름을 지워도 `_fatal/<name>` 파일을 함께 지우지 않으면 다음 `reconcile_state_with_disk` 호출(`--summary-state`/`--resume`)이 그 이름을 조용히 다시 `agents_fatal` 로 되돌린다. 에러 메시지 없이 "JSON 을 고쳤는데 반영이 안 됨"으로만 관측된다.
  - 위치: `.claude/_shared/retry_state.py:184-189` (`reconcile_state_with_disk` 의 `fatal_recorded = set(...) | set(fatal_on_disk(...))` 합집합 로직), 근거가 되는 파일-기반 기록은 `fatal_sentinel_path`/`_record_fatal` (`.claude/_shared/retry_state.py:107-119`, `137-164`)
  - 상세: 변경 전에는 `agents_fatal` 이 순수히 메모리/JSON 값을 `missing` 으로 필터링한 것이라, JSON 을 고치는 것만으로 상태를 되돌릴 수 있었다(그 취약성 자체가 §10 이 고치려던 결함이었음은 인지). 이번 변경으로 "영구 실패" 판정을 되돌리는 유일하게 안전한 경로는 `apply_status_update` 를 non-fatal 상태로 호출하는 것뿐이고, JSON 수기 편집만으로는 sentinel 파일이 남아있는 한 원복되지 않는다. README(`.claude/skills/code-review-agents/README.md:177-182`)가 "`_fatal/<name>` sentinel" 존재 자체는 언급하지만, "JSON 만 고치면 sentinel 이 되살린다"는 구체적 운영 함정과 그 해제 방법(sentinel 파일을 직접 지워야 함)은 어디에도 적혀 있지 않다.
  - 제안: README 또는 SKILL.md 에 "fatal 을 수동으로 해제하려면 `_fatal/<name>` 파일도 함께 지워야 한다"는 문구를 명시하거나, 그 반대로 sentinel 을 명시적으로 지우는 CLI 서브커맨드(예: `--clear-fatal SESSION_DIR:agent`)를 제공해 두 파일을 하나의 조작으로 묶는 편이 안전하다.

- **[INFO]** `apply_status_update`(모든 세 orchestrator 의 `--update` 경로 공용)가 이번 변경으로 `_retry_state.json` 쓰기 외에 새 파일시스템 부작용(디렉토리 생성 + 파일 생성/삭제)을 추가로 갖게 됐다.
  - 위치: `.claude/_shared/retry_state.py:263`(`apply_status_update` 안의 `_record_fatal(sd, agent, status == "fatal")` 호출), 실제 I/O 는 `_record_fatal` `.claude/_shared/retry_state.py:137-164`
  - 상세: 의도된 설계이고 docstring·plan(`plan/in-progress/harness-review-gate-followups.md` §10)에 근거가 잘 남아 있으며 `OSError` 는 advisory 로 swallow 되어 읽기전용 FS 에서도 update 자체는 실패하지 않는다. 다만 이 함수는 `merge_coordinator_orchestrator.py` 를 포함해 세 orchestrator 전부가 공유하는 `_shared` 경로이므로, "이 호출이 세션 디렉토리 밖 어디도 건드리지 않는다"고 가정하던 기존 호출부(예: 세션 디렉토리를 읽기 전용으로 마운트해 재생하는 감사/replay 스크립트가 있다면)는 새로 `_fatal/` 서브디렉토리가 생긴다는 점을 인지해야 한다.
  - 제안: 별도 조치 불필요. 세 orchestrator 모두 같은 `_shared` 함수를 통해 부작용을 얻으므로 일관적이다.

- **[INFO]** `code_review_orchestrator.get_git_branch_diff_files` 의 실질 타임아웃이 10초 → 30초로 3배 늘었다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1047-1063`(호출부, `timeout` 인자를 넘기지 않아 `branch_diff_files` 의 기본값을 그대로 씀) / `.claude/_shared/git_probe.py:168-169`(`branch_diff_files` 의 `timeout: float = 30.0` 기본값)
  - 상세: 이전 `get_git_branch_diff_files` 는 이 파일의 `_git(args, timeout=10)` 헬퍼(`code_review_orchestrator.py:965`)를 통했다. 새 공용 함수 `branch_diff_files` 의 기본 타임아웃은 consistency 쪽(30초)에 맞춰졌고, code-review 호출부는 별도 `timeout=` 을 넘기지 않으므로 이 경로의 실패 감지 시간이 3배 늘어난다. 새 함수의 docstring 이 "the same failure had a 10s cap on one side and 30s on the other... the longer cap wins on that asymmetry" 라고 이 트레이드오프를 명시하고 있어 의도된 결정이지만, "git diff 가 멈추면 orchestrator prepare 단계가 최대 30초까지 블로킹될 수 있다"는 실질적인 지연 증가이므로 기록해 둔다.
  - 제안: 의도된 선택으로 보이므로 조치 불필요. 다만 이 경로가 CI 의 prepare 단계 SLA 에 민감하다면 명시적으로 `timeout=10` 을 넘기는 편이 안전할 수 있다.

- **[INFO]** `merge_coordinator_orchestrator.py` 의 `--summary-state` / `--resume` 가 이번 변경으로 순수 read-only 경로에서 조건부 writer 로 바뀐다(자매 두 orchestrator 와 동일하게).
  - 위치: `--summary-state` → `_emit_summary_state` (`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:122-126`, shared `emit_summary_state` 를 통해 `reconcile_state_with_disk` 호출) / `--resume` (`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:543-549`, 새로 추가된 `_reconcile_state_with_disk(sd)` 호출)
  - 상세: 의도된 수정(§9 처분)이고 stderr 안내("reconciled …")도 유지되어 있어 "조용한 쓰기"는 아니다. 다만 이 orchestrator 의 `--summary-state`/`--resume` 를 그동안 "상태를 바꾸지 않는 조회 명령"으로 취급해온 외부 스크립트(예: CI 감사·대시보드)가 있다면, 이제 커밋된 세션 디렉토리를 조회만 해도 `_retry_state.json` 이 변경될 수 있다는 점을 인지해야 한다 — README 는 이미 자매 두 orchestrator 에 대해 "audit 를 하면 committed session 이 dirty 해질 수 있다"고 명시해 뒀지만(`emit_summary_state` docstring, `.claude/_shared/retry_state.py:229-231`), 세 번째 orchestrator 에도 같은 문구가 적용됨을 별도로 언급하고 있지는 않다.
  - 제안: 조치 불필요(설계 의도와 일치). 필요하면 merge-coordinator SKILL.md/README 에도 동일한 "conditional writer" 경고를 미러링.

- **[INFO]** `consistency_orchestrator._branch_changed_rels` 에서 `git diff` 의 `-- .` pathspec 이 제거되어, 공용 `branch_diff_files` 는 이제 pathspec 없이 저장소 전체를 대상으로 diff 한다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:239-257`(특히 246-257의 변경분), 실제 git 커맨드는 `.claude/_shared/git_probe.py:203-206`
  - 상세: 현재 유일한 호출부는 `root == os.getcwd()` 이므로 실질적 회귀는 없다는 것이 새 docstring 의 명시적 주장이며 타당해 보인다(직접 실측하지는 않았으나 두 orchestrator 모두 프로세스 cwd 에서 git 을 구동한다는 기존 계약과 일치). 다만 `branch_diff_files(base_ref, cwd, ...)` 가 향후 `cwd` ≠ 저장소 루트인 호출부에 재사용될 경우, pathspec 이 없다는 점 때문에 `cwd` 하위가 아닌 경로까지 포함된 리스트가 반환될 수 있다는 점은 이 함수의 계약이 넓어졌다는 뜻이다.
  - 제안: 조치 불필요. 새 호출부를 추가할 때 이 계약(저장소 전체, `cwd` 국한 아님)을 docstring 대로 유지할 것.

- **[INFO]** `.claude/_shared/git_probe.py` 에 추가된 `branch_diff_files` 는 이 모듈에서 유일하게 언더스코어 없이 노출된 함수다(`_run_git`, `_current_branch`, `_origin_default_branch`, `_repo_root`, `_default_branch`, `_merge_base`, `_porcelain_path` 는 전부 `_` 접두). 기능적 영향은 없으나 모듈의 "공개 표면" 표기 관례와 어긋난다.
  - 위치: `.claude/_shared/git_probe.py:168`
  - 상세: 순수 네이밍 이슈이며 side effect 는 없다. maintainability 리뷰 영역에 더 가깝지만, 이 파일이 "shared" 모듈이라는 성격상 어떤 심볼이 실제 공개 계약인지 신호가 흐려질 수 있어 기록.
  - 제안: 필요시 통일(예: 그대로 두거나 다른 함수들의 언더스코어를 걷어내는 별도 정리).

- **[INFO]** `on_error` 콜백(`branch_diff_files(..., on_error=...)`)은 두 호출부 모두 `debug_log` 로 감싸져 있고, `debug_log` 는 `make_debug_logger`(`.claude/skills/code-review-agents/lib/session.py:8-20`)에서 모든 예외를 스스로 삼키도록 구현되어 있어 콜백에서 발생한 예외가 `branch_diff_files` 호출자로 전파될 위험은 없음을 확인했다. 부작용 관점에서 안전.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1062-1063`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:256`
  - 상세: 정보성 확인 사항으로, 별도 조치 필요 없음.

- **[INFO]** 테스트 두 곳이 `sys.path` (프로세스 전역 리스트)에 `_harness.CLAUDE_DIR` 을 삽입하고 되돌리지 않는다 — `test_branch_diff_shared.py::SharedProbeContractTest._probe`, `test_retry_state_shared.py::FatalSurvivesALostUpdateTest._lib`.
  - 위치: `.claude/tests/test_branch_diff_shared.py:219-221`, `.claude/tests/test_retry_state_shared.py:164-166`
  - 상세: 동일 파일 안에 이미 있던 관례(`.claude/tests/test_retry_state_shared.py:110-111`)를 그대로 반복한 것이라 이번 diff 가 새로 도입한 패턴은 아니다. `run_in_orchestrator` 는 매 호출을 fresh subprocess 로 격리하므로 orchestrator import 로 인한 `_lib` 네임스페이스 충돌은 피해 가지만, 이 두 헬퍼는 `_shared.git_probe`/`_shared.retry_state` 를 **in-process** 로 import 하기 위해 `sys.path` 를 건드리며, 이 mutation 은 `unittest discover` 전체 세션 동안 되돌아가지 않는다. `if ... not in sys.path` 가드가 있어 중복 삽입은 막지만, 같은 디렉토리(`.claude`)가 sys.path 에 계속 남아 이후 실행되는 무관한 테스트 파일의 import 해석에 영향을 줄 여지가 이론상 존재한다 — 이 파일 자신의 docstring 이 경고하는 "in-process import 가 이름을 오염시킨다"는 클래스의 위험과 같은 종류다(다만 `git_probe`/`retry_state` 자체는 `_lib` 를 재수입하지 않으므로 실제 충돌 사례는 확인되지 않았다).
  - 제안: 조치 불필요(기존 관례와 일관). 새로 추가하는 in-process import 헬퍼가 늘어날수록 이 패턴이 누적되므로, 장기적으로는 공용 fixture(`_harness` 안에 한 곳)로 모으는 편을 고려할 수 있다.

## 요약

핵심 변경 3건(`git_probe.branch_diff_files` 로의 중복 제거, `retry_state` 의 `_fatal/<name>` sentinel 도입, `merge_coordinator_orchestrator` 의 reconcile 합류)은 모두 기존 함수 시그니처를 보존하면서 내부 구현만 공유 모듈로 위임했고, 새로 추가된 부작용(파일 생성/삭제, 조건부 디스크 쓰기, 콜백 기반 에러 보고)은 전부 docstring·README·plan 문서에 근거와 함께 명시돼 있으며 테스트(뮤테이션 포함)로 뒷받침된다. 실제 위험으로 볼 만한 지점은 하나뿐이다 — `agents_fatal` 이 이제 JSON 과 파일 sentinel 의 합집합으로 재도출되면서, "JSON 을 직접 고치면 상태가 바뀐다"는 종전의 암묵적 가정이 fatal 버킷에서는 더 이상 성립하지 않고 그 사실이 운영 문서에 뚜렷이 적혀 있지 않다는 점이다. 나머지는 의도된 타임아웃 변경, 의도된 read-only→conditional-writer 전환, 네이밍/테스트 관례 수준의 정보성 관찰이다.

## 위험도

LOW
