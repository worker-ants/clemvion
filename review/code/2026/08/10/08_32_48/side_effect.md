# 부작용(Side Effect) 리뷰

## 리뷰 대상
1. `.claude/_shared/git_probe.py`
2. `.claude/skills/code-review-agents/lib/session.py`
3. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
4. `.claude/tests/test_consistency_bundle_priority.py`
5. `.claude/tests/test_consistency_context_budget.py`
6. `.claude/tests/test_review_session_dir_collision.py`
7. `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts`
8. `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
9. `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

## 발견사항

- **[WARNING]** `_collect_code_diff` 가 `_shared/git_probe.py` 의 하드닝(quotePath, surrogateescape)을 우회하고, 자신의 `except` 도 그 우회로 생기는 예외를 못 잡는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:400-416` (특히 `:404` subprocess.run 호출, `:407` except 절), 호출부 `:626`
  - 상세: 같은 리뷰 세트의 `git_probe.py` 는 "`-c core.quotePath=false` + `errors="surrogateescape"` 를 `_run_git_raw` 한 곳(chokepoint)에만 적용해 **모든 호출자**를 위해 고쳤다"고 명시적으로 서술한다(`git_probe.py:113-166`). 그런데 `consistency_orchestrator.py` 의 `_collect_code_diff`(`--impl-done` 전용 code diff 수집)는 이 공유 프리미티브를 쓰지 않고 자체 `subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=root)` 를 직접 호출한다(`:404-406`). `text=True` 만 쓰고 `errors=` 를 지정하지 않으므로, git 이 non-ASCII 바이트를 담은 경로를 diff 헤더에 내보내면(quotePath 미지정이라 C-quote 되거나, 그 경로 자체가 UTF-8 로 라운드트립 불가한 바이트일 때) `UnicodeDecodeError` 가 난다. 이 예외는 `ValueError` 서브클래스라 `:407` 의 `except (OSError, subprocess.TimeoutExpired)` 에 걸리지 않고 그대로 위로 전파된다. `_collect_code_diff` 호출부(`:626`, `collect_context` 내부)에도 로컬 catch 가 없어, 결국 `main()` 의 최외곽 `except Exception`(`:1090-1094`) 에서 `sys.exit(1)` 로 끝난다. 이 함수의 자체 docstring 은 "Empty string on any failure (missing base ref, no diff, git error)" 를 약속하지만, 실제로는 이 실패 경로만 그 약속을 어기고 `--impl-done` 세션 준비 전체를 중단시킨다 — `git_probe.py` 가 바로 이 클래스의 버그(round 7 이후 반복 지적된 인코딩/quote 이슈)를 "한 곳에서 고쳐 전원에게 적용"하겠다고 서술한 취지와 정확히 어긋나는 사각지대다.
  - 참고: `git_probe.py:125-128` 의 "codebase/** 현재 2,464개 파일 중 non-ASCII/따옴표 0건" 실측과 같은 근거로 오늘 당장 재현 가능성은 낮다(WARNING 수준으로 유지하는 이유). 다만 `--impl-done` 은 반복적으로 사용되는 게이트이므로, 언젠가 codebase 에 non-ASCII 파일명이 들어오는 순간 조용한 빈 diff 대신 하드 크래시로 나타난다.
  - 제안: `_collect_code_diff` 를 `_shared.git_probe._run_git_raw` (또는 그 위에 얇게 래핑한 헬퍼) 로 라우팅하거나, 최소한 `errors="surrogateescape"` + `-c core.quotePath=false` 를 이 호출에도 동일 적용하고 `except` 절에 `ValueError` 를 추가해 "빈 diff" 계약을 실제로 지키게 한다.

- **[INFO]** 신규 모듈 전역 캐시 `_READ_CACHE` — "단명 프로세스" 전제가 코드로 강제되지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:128` (선언), `:144-155` (`read_text_file`)
  - 상세: `read_text_file` 이 채우는 모듈 전역 `dict` 캐시로, 무효화 로직이 없다. 정당성은 "이 orchestrator 는 세션을 준비하고 끝나는 단명 CLI" 라는 주석상의 전제(`:126-127`)뿐이며, 실제로 `main()` 을 확인한 결과 현재는 `collect_context` 가 프로세스당 정확히 1회만 호출되어(`:1090`) 문제가 되지 않는다. 다만 이 전제를 코드가 스스로 검증하지 않고, 테스트 쪽에서 `_READ_CACHE.clear()` 를 명시적으로 호출해 격리해야 하는 것(`test_consistency_context_budget.py` `test_clearing_the_cache_re_reads`) 자체가 이 결합이 실재함을 보여준다. `code_review_orchestrator` 는 74파일 changeset 을 배치로 나눠 한 프로세스 안에서 여러 번 도는 사례가 이미 존재하므로(`session.py:38-46` 참고), 이 orchestrator 에도 향후 유사한 배치/재호출 경로가 추가되면 이 캐시가 조용히 stale 값을 돌려줄 수 있다.
  - 제안: 당장 고칠 필요는 없으나, `collect_context` 가 프로세스당 1회만 호출된다는 불변식이 깨질 경우를 대비해 짧은 assert 나 docstring 경고를 `collect_context` 진입부에 남겨두면 향후 회귀를 막기 쉽다.

- **[INFO]** `_run_git_raw` 의 예외 스코프 축소가 hook-layer 6개 함수의 예외 전파 모양을 바꾼다 (호출부에서 완화 확인됨)
  - 위치: `.claude/_shared/git_probe.py:168-179` (`_run_git_raw`), 이를 그대로 쓰는 `_current_branch`(`:46-51`) · `_origin_default_branch`(`:54-82`) · `_repo_root`(`:303-307`) · `_default_branch`(`:310-348`) · `_merge_base`(`:351-358`)
  - 상세: 이전에는 두 orchestrator 카피가 각자 `except Exception` 으로 git 호출을 감쌌으나, 이 모듈은 `_run_git_raw` 의 catch 를 `(subprocess.TimeoutExpired, FileNotFoundError, OSError)` 로 좁히고 넓은 catch 는 `branch_diff_files`(`:251`) · `worktree_changed_files`(`:290`) 두 곳에만 재적용했다(docstring `:157-166` 이 이 트레이드오프를 명시). 그 결과 `_current_branch`/`_default_branch`/`_repo_root`/`_merge_base` 등 hook-layer 함수를 부르는 push-gate 3종(`review_guard.py`/`plan_guard.py`/`branch_guard.py`)은 이제 `TypeError` 류의 예상 밖 예외를 그대로 맞을 수 있다. `review_guard.py` 소비자 쪽을 직접 확인한 결과 `guard_review_before_push.py:main()` 이 `_run_gates` 호출 전체를 최외곽 `try/except Exception`(`:967`) 으로 감싸 fail-open 처리 + degraded 카운트를 하므로 실질 회귀는 없다. 다만 이는 이 리뷰 대상 파일이 아닌 호출부의 방어에 의존하는 것이므로, 향후 이 hook-layer 함수들을 쓰는 새 소비자가 동등한 outer guard 없이 추가되면 이 좁아진 예외 표면이 그대로 크래시로 드러날 수 있다는 점만 기록해 둔다.

- **[INFO]** 테스트가 실제 버전관리 대상 spec 파일을 직접 수정·복구한다 — `finally` 만으로는 프로세스 강제종료를 방어하지 못함
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` 클래스 `TheDocumentBeingEditedIsNeverOmittedTest` 의 `_rank_of_an_uncommitted_edit`(라인 487-511)과 `test_collect_context_puts_the_edited_document_first`(라인 521-547)
  - 상세: 두 테스트 모두 `spec/5-system/7-llm-client.md` (추적 대상 실제 spec 문서)를 열어 프로브 주석을 append 한 뒤 `try/finally` 로 `shutil.copy(backup, target)` 복구한다. `git checkout` 대신 `cp` 복구를 쓰는 점은 이 저장소의 기존 관례(미커밋 작업 파괴 방지)와 일치해 적절하지만, 서브프로세스가 타임아웃/OOM/SIGKILL 로 죽으면 `finally` 자체가 실행되지 않아 실제 product spec 파일에 프로브 문자열이 남을 수 있다. `test_the_probe_leaves_no_residue` 는 정상 종료 이후를 사후 점검하는 별도 테스트일 뿐, 강제종료 케이스를 막지는 못한다.
  - 제안: 현재도 실무적으로 낮은 위험(정상 경로에서는 안전)이라 즉시 조치 불필요. 다만 CI 에 하드 타임아웃이 걸려 있다면 이 클래스만이라도 `addCleanup` 스타일(테스트 프레임워크가 SIGTERM 이후에도 최대한 실행 보장)로 옮기거나, pre-push 훅에 `spec/5-system/7-llm-client.md` 의 diff 잔존 여부를 감지하는 캐너리를 하나 추가하는 것을 고려할 만하다.

- **[INFO]** `create_session_dir` 소진(exhaustion) 폴백이 이 함수가 없애려던 충돌을 다시 허용한다 (문서화된 트레이드오프)
  - 위치: `.claude/skills/code-review-agents/lib/session.py:79-82`
  - 상세: `_MAX_SESSION_NAME_ATTEMPTS`(50회) 를 모두 소진하면 `os.path.join(day_dir, stamp)` (접미사 없는 평범한 경로)로 `os.makedirs(session_dir, exist_ok=True)` 를 호출해, 이 함수가 애초에 고치려던 "같은 초 충돌 시 `meta.json` 이 조용히 덮인다" 문제를 다시 허용한다. docstring 이 "세션 하나 잃는 것보다 리뷰를 아예 안 도는 게 더 나쁘다"고 의도적으로 밝히고 있어 결함은 아니지만, 이 경로가 실행되면 이 파일의 핵심 보장("두 세션은 서로 다른 디렉터리를 받는다")이 조용히 깨진다는 점은 부작용 관점에서 기록해 둘 가치가 있다(같은 초에 50개 이상의 세션이 몰리는 극단적 상황에서만 발동하므로 발생 가능성은 낮음).

## 요약
가장 실질적인 항목은 `consistency_orchestrator.py:_collect_code_diff` 가 같은 PR 이 `git_probe.py` 에 도입한 인코딩/quotePath 하드닝을 재사용하지 않고 독자적인 `subprocess.run` 을 유지해, "빈 diff 로 폴백"이라는 자체 계약을 어기고 `--impl-done` 세션 준비 전체를 크래시시킬 수 있는 사각지대라는 점이다(WARNING, 현재는 codebase 에 non-ASCII 파일명이 없어 재현 불가). 그 외 항목들은 모두 신규 전역 캐시·예외 스코프 축소·테스트의 실 파일 mutation·세션 디렉터리 폴백처럼 의도적으로 설계·문서화된 트레이드오프이며, 호출부(`guard_review_before_push.py` 등)를 직접 대조해 본 결과 실질적인 회귀 없이 완화되어 있다. 전역 상태 오남용, 예기치 못한 네트워크 호출, 숨은 공개 API 파괴적 변경 등 CRITICAL 급 부작용은 발견되지 않았다.

## 위험도
LOW
