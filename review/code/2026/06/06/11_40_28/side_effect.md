# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 파일 1: branch_guard.py — 네트워크 타임아웃 단축 (4.0s → 2.0s)
- 위치: `.claude/hooks/_lib/branch_guard.py`, `_origin_default_branch()` Method 2
- 상세: `git remote show origin`의 타임아웃을 4.0초에서 2.0초로 줄였다. Method 1(local symbolic-ref)이 성공하면 Method 2는 실행되지 않으므로 대부분의 경우 영향 없음. 그러나 origin/HEAD 심볼릭 레프가 설정되지 않은(예: 최초 클론 직후, `git remote set-head`가 안 된) 환경에서는 2초 이내로 네트워크 응답이 안 오면 기본 브랜치를 알 수 없어 가드가 ALLOW로 fall-through한다.
- 제안: 현재 설계(fail-open)는 의도적이며 허용 방향의 부작용이다. 단, 원격이 느린 환경에서 가드 판단이 달라질 수 있음을 문서에 명시하면 충분하다. 추가 수정 불필요.

### [INFO] 파일 2: review_guard.py — 모듈 레벨 전역 상수 추가
- 위치: `.claude/hooks/_lib/review_guard.py`, 모듈 상단
- 상세: `_IN_FLIGHT_TTL_SECONDS = 1800`과 `_SESSION_TS_RE = re.compile(...)` 두 개의 모듈 수준 전역 상수가 추가된다. 두 값 모두 불변(int, compiled Pattern)이며, 기존 전역 상수들(`CODE_PREFIX`, `REVIEW_GLOB_ROOT` 등)과 동일한 패턴이다. 의도치 않은 상태 변경 없음.
- 제안: 없음.

### [INFO] 파일 2: review_guard.py — `_dirty_set()` 추가로 git 호출 횟수 증가 가능성
- 위치: `_newest_resolved_review_mtime()` 및 `_newest_resolved_impl_done_mtime()` 각각에서 `_dirty_set()` 호출
- 상세: 두 함수가 각각 독립적으로 `_dirty_set()`을 호출한다. `_dirty_set()`은 내부에서 `git status --porcelain`을 수행하므로, `evaluate_review()`가 두 게이트를 모두 평가하는 경우 `git status`가 2번 실행된다. 기존 대비 git 호출이 늘어나지만, 이 함수들은 Stop/Push hook 경로에서만 불리고 모두 read-only이다. 파일시스템 변경 없음.
- 제안: 성능 민감 환경에서는 `_dirty_set()`을 `evaluate_review()` 진입부에서 한 번 계산해 파라미터로 전달하는 방식으로 개선할 수 있으나, 현재 범위에서는 기능적 부작용이 아님.

### [INFO] 파일 2: review_guard.py — `_code_review_in_flight()` — 전체 review/code 디렉토리 walk
- 위치: `_code_review_in_flight()` 내 `os.walk(root)`
- 상세: 이 함수는 `review/code/` 하위 전체를 순회하며 `meta.json` + SUMMARY.md 부재 조합을 탐색한다. 리뷰 세션이 많이 쌓일수록 매 Stop hook 호출마다 디렉토리 탐색 비용이 증가한다. 파일을 쓰거나 삭제하지는 않으며 read-only이다.
- 제안: 현재로서는 허용 범위. review/code 디렉토리가 수백 개 이상 쌓이는 장기 운용 시 `_iter_summaries()`와 결합한 단일 walk로 리팩터링을 고려할 수 있다.

### [INFO] 파일 2: review_guard.py — `_summary_is_resolved()` 로직 변경 — `risk_level in (None, "MEDIUM") and has_actionable` dead code 제거
- 위치: `_summary_is_resolved()`, diff 라인 `+427~429`
- 상세: 기존 코드에서 `if risk_level in (None, "MEDIUM") and has_actionable: return False`는 이미 바로 위 `if has_actionable: return False`로 커버된 dead code였다. 제거 후 동일한 결과를 냄. 기능적 부작용 없음.
- 제안: 없음.

### [INFO] 파일 3: guard_review_before_stop.py — 파일시스템 쓰기: 마커 파일 경로 변경
- 위치: `_marker_path()`, `_mark_nudged()`
- 상세: 마커 파일명이 `{session_id}__{head_sha}`에서 `{session_id}__{branch_name}`으로 바뀐다. 브랜치명에 슬래시가 있으면 `-`로 치환한다(`ref.replace("/", "-")`). 기존 마커 파일들(HEAD sha 기반)은 자동으로 삭제되지 않고 `.claude/state/review_stop_nudged/` 에 잔류하지만, 30일 GC(파일 6 bootstrap-session.sh)가 처리한다. 이전 포맷의 마커가 잔류해도 새 포맷의 키와 충돌하지 않으므로 오작동 없음.
- 제안: 없음.

### [WARNING] 파일 3: guard_review_before_stop.py — `session_id = None`일 때 마커 키 충돌 가능성
- 위치: `_marker_path(session_id=None, token)` — `sid = "nosession"`으로 fallback
- 상세: `session_id`가 없는 경우 모든 호출이 동일한 `nosession__{token}` 키를 공유한다. 복수의 독립 세션이 동시에 `session_id` 없이 동일 브랜치에서 실행되면 한 세션의 nudge가 다른 세션의 throttle에 영향을 미친다. 그러나 주석("worst case is throttling slightly across sessions, which is the safe direction")이 명시하듯 이는 의도된 fail-safe 방향이고, push guard가 hard gate이다.
- 제안: 현재 설계 의도에 부합하나, `session_id` 부재가 프로덕션에서 실제 발생하는지 확인 권장. Claude Code가 항상 `session_id`를 주입하는 경우 이 경로는 방어적 코드로만 기능하므로 실질 위험은 낮음.

### [INFO] 파일 4: lint_mermaid_posttooluse.py — 네트워크/프로세스 타임아웃 추가
- 위치: `_resolve_tool_dir()` git 호출, `main()` node 실행 subprocess
- 상세: 두 subprocess에 타임아웃이 추가됐다(5.0s, 20.0s). 양쪽 모두 예외 발생 시 fail-open(return 0)으로 처리한다. 파일 생성·수정·환경 변수 변경 없음.
- 제안: 없음.

### [INFO] 파일 5: test_review_guard_hardening.py — 테스트 파일 생성 (tempfile)
- 위치: `CodeReviewInFlightTest._session()`, `RiskLevelWindowTest.test_high_risk_below_old_window_with_rows_is_unresolved()`
- 상세: 테스트에서 `tempfile.TemporaryDirectory()` 및 `tempfile.mkdtemp()`를 사용해 임시 파일과 디렉토리를 생성한다. `TemporaryDirectory`는 context manager 종료 시 자동 삭제되나, `tempfile.mkdtemp()`로 생성된 `d` 디렉토리는 테스트 종료 후 명시적으로 삭제하지 않는다. OS가 프로세스 종료 후 정리하지만, 테스트 프로세스가 비정상 종료될 경우 시스템 임시 디렉토리에 잔류 파일이 남을 수 있다.
- 제안: `RiskLevelWindowTest`에서 `tempfile.mkdtemp()` 대신 `tempfile.TemporaryDirectory()`를 사용하도록 수정하거나 `addCleanup(shutil.rmtree, d)`를 추가하는 것이 깔끔하다.

### [INFO] 파일 6: bootstrap-session.sh — 파일시스템 삭제 (find -delete)
- 위치: GC 루프, `find "$state_dir" -type f -mtime +30 -delete`
- 상세: `.claude/state/review_stop_nudged/` 및 `.claude/state/main_worktree_bash_warned/` 에서 30일 이상 된 파일을 삭제한다. 이는 의도된 GC이며, 대상은 hook이 생성한 마커 파일뿐이다. `|| true`로 실패를 무시하며 존재하지 않는 디렉토리는 건너뛴다.
- 제안: 없음.

---

## 요약

이번 변경은 review/push guard 훅의 안정성 강화(타임아웃 추가, checkout-immune freshness 로직, in-flight 세션 감지, 브랜치 기준 throttle)를 목적으로 한다. 전역 변수 추가는 불변 상수 2개에 한정되고, 새 파일 생성은 테스트 임시 파일과 기존 GC 대상인 마커 파일뿐이다. 공개 API(`evaluate_review`, `evaluate`, `GuardDecision`, `ReviewDecision`)의 시그니처는 변경되지 않았으며, 내부 private 함수의 변경은 호출자에 투명하다. `_newest_code_mtime` back-compat alias가 유지되어 외부 테스트 세임(seam)과의 호환성도 보존된다. 유의미한 의도치 않은 부작용은 없고, 테스트 파일의 임시 디렉토리 미정리(INFO 수준) 한 건만 개선 여지가 있다.

---

## 위험도

LOW
