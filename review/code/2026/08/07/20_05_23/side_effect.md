# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `_run_git_raw`(및 이를 감싸는 `_run_git`)의 예외 처리가 `(subprocess.TimeoutExpired, FileNotFoundError, OSError)` 에서 무차별 `except Exception` 으로 넓어졌다. 이 함수는 `branch_guard.py`/`plan_guard.py`/`review_guard.py` 세 push-gate 훅과 두 orchestrator가 **공유하는 단일 지점**이므로, 이번 PR의 실제 목적(`branch_diff_files` 추가)과 무관한 기존 3개 훅의 실패 처리 방식까지 함께 바뀐다. 의도(다큐먼트에 "세 docstring 모두 empty on any failure 를 약속했는데 이전 리팩터가 그 계약을 깼다"고 명시, 테스트로 고정)는 타당하고 근거도 측정되어 있지만, 이제는 `TypeError`/`AttributeError` 같은 **프로그래밍 버그성 예외까지도** `(1, "", "")` 로 조용히 삼켜 push-gate 판정 실패를 "git 이 실패함" 으로 위장시킬 수 있다. 안전 방향(fail-closed)인 가드는 오탐 차단으로 넘어갈 수 있고, fail-open 가드는 진짜 버그를 놓칠 수 있다.
  - 위치: `.claude/_shared/git_probe.py:175` (`except Exception:  # noqa: BLE001`), 함수 `_run_git_raw`(131행)·이를 alias 하는 `.claude/hooks/_lib/branch_guard.py`, `plan_guard.py`, `review_guard.py` 의 `_run_git = _git_probe._run_git`
  - 상세: 위와 동일
  - 제안: 이미 테스트로 계약("empty on any failure")은 고정돼 있으나, 세 훅 각각에 대해 "narrow→broad" 전환이 실제 실패 모드를 바꾸지 않는지(특히 fail-open/fail-closed 방향) 회귀 테스트가 있는지 확인 권장. 없다면 최소 한 번 각 훅에 대해 명시적으로 pin.

- **[INFO]** `code_review_orchestrator.get_git_branch_diff_files` 의 git 호출 타임아웃이 기존 `_git(args, timeout=10)` 의 10초에서, 공유 `branch_diff_files` 의 기본값 30초로 늘어났다(`git_probe.py` 자체 docstring이 "the longer cap wins on that asymmetry" 라고 명시한 의도적 변경). 실패 경로(예: git 이 행)에서 이 orchestrator의 `--prepare`/`--branch` 처리가 최대 3배 더 오래 블로킹될 수 있다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1061-1064` (호출부), `.claude/_shared/git_probe.py:197`(`branch_diff_files` 의 `timeout: float = 30.0`), 기존 기본값은 같은 파일 `_git(args, timeout=10)` (grep 확인: 965행)
  - 상세: 의도된 트레이드오프이나 "동일 함수의 동일 호출부가 실패 시 대기시간이 3배로 늘어난다"는 사실 자체는 부작용 카테고리로 기록할 가치가 있음.
  - 제안: 변경 없음(의도된 설계). CI 등에서 이 경로의 실패가 잦다면 상한 재검토.

- **[INFO]** `consistency_orchestrator._branch_changed_rels` 에서 기존 `-- .` pathspec 이 제거되어, cwd(=`root` 인자)가 git 최상위 디렉토리가 아닌 경우 "cwd 하위로 범위 제한" 대신 "저장소 전체" 로 동작이 바뀐다. 현재는 `repo_root() == os.getcwd()` 이고 orchestrator 가 항상 repo root 에서 실행된다는 암묵적 불변식에 의해 안전하지만, 코드 레벨에서 강제되지는 않는다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:254-257`(호출부), `.claude/_shared/git_probe.py:223-226`(docstring 근거), `consistency_orchestrator.py:121-122`(`repo_root() = os.getcwd()`)
  - 상세: 위와 동일. 두 사본이 이미 "whole-repo on purpose" 로 문서화하고 있었으므로 버그 수정에 가깝다.
  - 제안: `root` 인자가 항상 `os.getcwd()`(=repo root)와 같다는 불변식을 주석/assert 로 명시하면 향후 호출부 추가 시 재발을 막을 수 있음.

- **[INFO]** `apply_status_update` 가 이제 상태(성공/실패/rate_limit 등) 무관하게 매 호출마다 `_record_fatal` 을 통해 `<session_dir>/_fatal/<name>` 파일시스템 write/stat/unlink 를 수행한다. `review/**` 디렉토리는 gitignore 대상이 아니므로(CLAUDE.md 메모 확인), fatal 로 전이된 세션을 커밋하면 이 sentinel 파일도 함께 저장소에 들어간다. README 에 구조가 문서화돼 있어 의도된 설계이지만, "예상치 못한 파일 생성" 관점에서 신규 파일시스템 표면(디렉토리+파일)이 늘어난 사실은 명시적으로 짚어둔다.
  - 위치: `.claude/_shared/retry_state.py:145-189`(`_record_fatal` 정의), `:288`(`apply_status_update` 호출부: `_record_fatal(sd, agent, status == "fatal")`)
  - 상세: 위와 동일
  - 제안: 변경 없음(의도된 설계, README 동반 갱신 확인됨).

- **[INFO]** `merge_coordinator_orchestrator.py --resume` 가 이제 `_reconcile_state_with_disk` 를 호출해 상태가 변경되었으면 `_retry_state.json` 을 디스크에 다시 쓴다. 기존에는 `--resume` 이 파일을 읽고 경로만 echo 하는 순수 조회였는데, 이제 조건부 writer 가 됐다(자매 두 orchestrator 는 이미 이렇게 동작하므로 일관화 목적의 변경). "오래된 커밋 세션을 감사(`--resume`)하면 워킹트리가 dirty 해질 수 있다"는, `save_state`/`emit_summary_state` docstring 이 이미 경고하는 것과 같은 카테고리의 부작용이 이 orchestrator 에도 새로 생긴다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:547-549`
  - 상세: 위와 동일. 알림은 `debug_log`(파일)로만 가고 stderr 에는 안 뜨는데, 이는 자매 두 orchestrator 의 `--resume` 경로도 동일한 패턴이라(grep 확인) 이 PR 이 만든 새로운 불일치는 아님.
  - 제안: 변경 없음(자매 orchestrator와 일관성 확보 목적, 기존 패턴 그대로 확장).

- **[INFO]** (참고용, 이미 알려진 잔여 리스크) `_record_fatal` 의 "해제(fatal→비fatal)" 방향은 여전히 동시 쓰기 유실에 취약하다 — sentinel 삭제 후 JSON 저장 전에 유실되면, 다음 reconcile 의 union(JSON ∪ sentinel) 이 stale JSON 을 근거로 fatal 을 되살린다. 이는 코드 자체 docstring 과 `test_clearing_fatal_is_still_unprotected_against_a_lost_update` 캐너리 테스트로 명시적으로 고정되어 있고, `plan/in-progress/harness-review-gate-followups.md` 상 이전 라운드에서 concurrency·architecture·side_effect 세 리뷰어가 이미 수렴 확인한 항목이다. 새로운 미검증 결함이 아니라 "알고 있고 추적 중"인 상태임을 확인차 기록한다.
  - 위치: `.claude/_shared/retry_state.py:161-176`(`_record_fatal` docstring 중 "NOT symmetric" 단락), 테스트는 `.claude/tests/test_retry_state_shared.py` 의 `test_clearing_fatal_is_still_unprotected_against_a_lost_update`
  - 상세: 위와 동일
  - 제안: 조치 불필요(이미 캐너리로 고정, 별도 설계 과제로 plan 에 등록됨).

- **[INFO]** `errors="surrogateescape"` 도입으로 `branch_diff_files`/`get_git_branch_diff_files` 가 반환하는 파일명 문자열에 lone surrogate 코드포인트가 포함될 수 있다. POSIX 파일시스템 API(`os.path.isfile`, `open()`)에는 안전하게 왕복되지만, 이 문자열을 strict UTF-8 텍스트로 그대로 write(예: 리포트/프롬프트 `.md` 파일에 파일명 나열)하면 `UnicodeEncodeError` 가 날 수 있다. 현재 저장소에는 해당 형태의 파일명이 0건(추가된 테스트 자체가 측정)이라 당장 도달 불가능하지만, 이 값을 소비하는 하류(다운스트림) 코드가 늘어날 경우 잠재 위험이다.
  - 위치: `.claude/_shared/git_probe.py:171`(`errors="surrogateescape"`), 테스트 `.claude/tests/test_branch_diff_shared.py` 의 `UndecodableGitOutputTest.test_a_path_git_cannot_round_trip_does_not_crash_the_caller`
  - 상세: 위와 동일
  - 제안: 조치 불필요(현재 도달 불가). 향후 이 반환값을 텍스트 리포트에 그대로 삽입하는 소비자가 추가되면 `errors="surrogateescape"` 로 인코딩하거나 sanitize 필요.

- **[INFO]** 테스트 헬퍼가 모듈 함수 자체를 직접 재할당해 몽키패치한다(`rs.save_state = save_once_interrupted`, `unittest.mock.patch` 미사용). `try/finally` 로 원복되어 정상 실행 시 안전하지만, 공유 모듈(`_shared.retry_state`)의 전역 속성을 직접 변경하는 패턴이라 예외가 할당 시점과 `finally` 사이에서 발생하면 이후 테스트에 누출될 여지가 이론적으로 남는다.
  - 위치: `.claude/tests/test_retry_state_shared.py` `_lose_a_fatal_update`(약 207-220행), 동일 패턴이 `test_clearing_fatal_is_still_unprotected_against_a_lost_update` 내부(약 332-345행)에도 반복
  - 상세: 위와 동일
  - 제안: 테스트 안정성 상 큰 위험은 아니나, `unittest.mock.patch.object(rs, "save_state", ...)` 로 바꾸면 예외 발생 시에도 원복이 보장되어 더 견고함.

## 요약

이번 변경은 `.claude/_shared/git_probe.py`(branch-diff 공유 프로브 신설)와 `.claude/_shared/retry_state.py`(`_fatal/<name>` sentinel 기반 자기치유 확장)를 축으로 하며, 세 orchestrator(code-review·consistency·merge-coordinator)가 공유 모듈로 위임하도록 리팩터링됐다. 대부분의 동작 변화(예외 처리 확대, 타임아웃 10→30초, `-- .` pathspec 제거, `--resume` 이 조건부 writer 가 됨, `_fatal/` 신규 파일시스템 표면)는 docstring·plan 문서·전용 테스트(뮤테이션 커버리지 포함)로 명시적으로 근거가 남아 있고 의도된 설계다. 다만 `_run_git_raw` 의 예외 처리를 특정 타입에서 `except Exception` 으로 넓힌 변경은 이번 PR의 직접 목적(신규 `branch_diff_files`)을 넘어 **기존 세 push-gate 훅의 실패 처리 방식까지 함께 바꾸는** 부수효과이므로, 공유 모듈 리팩터 시 "새 기능이 기존 소비자의 실패 모드를 조용히 바꾼다"는 관점에서 별도로 짚어둘 가치가 있다(WARNING). 나머지는 대체로 저위험·문서화·테스트로 뒷받침된 의도적 side-effect이며, 신규 CRITICAL 급 미검증 결함은 발견되지 않았다.

## 위험도

LOW
