# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] _path_session_time — 로컬 타임존 의존성
- 위치: `test_review_guard_hardening.py::PathSessionTimeTest::test_parses_session_dir_timestamp` (라인 1815–1818)
- 상세: `datetime.fromtimestamp(t)` 는 시스템 로컬 타임존으로 변환한다. `_path_session_time` 내부도 `datetime(Y, m, d, H, M, S).timestamp()` 를 타임존 없이 사용하므로 두 쪽이 동일 타임존에서 동작하면 round-trip 은 맞지만, UTC 가 아닌 환경에서 DST 전환 시 모호해진다. CI 가 UTC 환경이고 개발 머신이 KST 이면 동일 코드를 양쪽에서 실행 시 결과가 달라질 수 있다. 현재는 동작에 문제가 없으나 이를 명시한 주석이 없다.
- 제안: `datetime.fromtimestamp(t, tz=None)` 대신 `datetime.utcfromtimestamp` 와 짝 맞추거나, 아니면 테스트에 "로컬 타임존 가정" 주석을 명시한다. 또는 `_path_session_time` 을 `datetime.fromisoformat` + UTC 기반으로 리팩터링하면 DST 안전.

---

### [INFO] _code_review_in_flight — 테스트에서 meta.json 내용이 비어 있음
- 위치: `test_review_guard_hardening.py::CodeReviewInFlightTest::_session` (라인 1854–1855)
- 상세: 테스트 헬퍼가 `meta.json` 에 `"{}"` 를 쓴다. 실제 프로덕션에서 meta.json 파싱이 `_is_impl_done_session` 에서 `mode` 필드를 읽지만, `_code_review_in_flight` 는 `meta.json` 의 *존재 여부*만 확인하므로 현재는 문제없다. 그러나 향후 `_code_review_in_flight` 가 meta.json 내용을 읽도록 바뀌면 빈 dict 테스트가 오류를 숨긴다.
- 제안: 테스트 헬퍼에 실제 포맷에 가까운 `{"mode": "code-review"}` 를 사용하거나, 테스트 픽스처의 의도를 주석으로 명시한다.

---

### [WARNING] _authoritative_code_time — 모든 파일이 dirty 일 때 _newest_commit_time 미호출 검증 부재
- 위치: `test_review_guard_hardening.py::AuthoritativeCodeTimeTest` (라인 1827–1847)
- 상세: `test_all_clean_ignores_mtime` 는 clean 경로를 검증하고, `test_dirty_uses_mtime_clean_uses_commit_time` 는 혼합 경우를 검증한다. 그러나 **모든 파일이 dirty** 인 경우(`clean_paths = []`)에 `_newest_commit_time` 이 호출되지 않고 `_mtime` 만 쓰이는 경로가 테스트되지 않는다. `_newest_commit_time` 이 빈 리스트로 호출되면 내부에서 `if not rel_paths: return 0.0` 로 조기 리턴하는데, 이 경로가 테스트로 커버되지 않는다.
- 제안: 아래 케이스를 추가한다:
  ```python
  def test_all_dirty_uses_only_mtime(self):
      with mock.patch.object(rg, "_dirty_set", return_value={"codebase/a.ts", "codebase/b.ts"}), \
           mock.patch.object(rg, "_mtime", return_value=300.0), \
           mock.patch.object(rg, "_newest_commit_time") as ct:
          t = rg._authoritative_code_time("/r", ["codebase/a.ts", "codebase/b.ts"])
      ct.assert_called_once_with("/r", [])
      self.assertEqual(t, 300.0)
  ```

---

### [WARNING] _glob_to_regex — 트레일링 `**` (슬래시 없음) 케이스 미검증
- 위치: `test_review_guard_hardening.py::GlobBoundaryTest` (라인 1797–1808)
- 상세: 변경된 코드에서 `**` + `/` 조합과 트레일링 `**` (슬래시 없는 경우)를 별개 분기로 처리한다. `**/` 분기는 테스트가 있지만, `glob[i]` 가 `/` 가 아닌 경우 (`.*` 를 append 하는 `else` 분기)는 테스트에 없다. 예: `codebase/**` 패턴.
- 제안: 트레일링 `**` 케이스 테스트를 추가한다:
  ```python
  def test_trailing_double_star_matches_any_path(self):
      p = rg._glob_to_regex("codebase/**")
      self.assertTrue(p.match("codebase/a/b/c.ts"))
      self.assertTrue(p.match("codebase/x.ts"))
  ```

---

### [WARNING] _summary_is_resolved — MEDIUM 위험도 + 행 없음 케이스 변경 후 회귀 테스트 갭
- 위치: `review_guard.py` diff (라인 423–428), `test_review_guard.py` (라인 54–68)
- 상세: 기존 코드의 `if risk_level in (None, "MEDIUM") and has_actionable: return False` 줄이 제거되었다. 이 줄은 dead code(`has_actionable` 가 True 이면 이미 위에서 `return False` 를 탔기 때문)였으므로 제거가 올바르다. 그러나 기존 테스트 `test_warning_rows_without_resolution_is_unresolved` 는 MEDIUM + 경고 행 있음 케이스만 검증한다. **MEDIUM + 행 없음 → 해결됨(True)** 이 되어야 한다는 케이스가 기존 `test_review_guard.py` 나 새 테스트 어디에도 없다. 이 dead code 제거가 동작을 바꾸지 않음을 확인하는 회귀 테스트가 필요하다.
- 제안:
  ```python
  def test_medium_with_no_rows_is_resolved(self):
      summary = "# x\n\n## 전체 위험도\n**MEDIUM**\n\n## Critical 발견사항\n\n...\n\n## 경고 (WARNING)\n\n..."
      sp = self._write(summary)
      self.assertTrue(rg._summary_is_resolved(sp))
  ```

---

### [WARNING] _throttle_token — 폴백(detached HEAD) 경로 테스트 없음
- 위치: `test_review_guard_hardening.py::StopThrottleTest` (라인 1913–1927), `guard_review_before_stop.py::_throttle_token`
- 상세: `_throttle_token` 은 3가지 분기를 갖는다: (1) 일반 브랜치, (2) detached HEAD (abbrev-ref 가 "HEAD" 반환 → short sha 폴백), (3) git 미사용 ("norepo"). 테스트는 분기 (1) 만 커버한다(`test_throttle_token_sanitizes_branch_slashes`). 분기 (2) 와 (3) 은 커버되지 않는다.
- 제안: 다음 케이스들을 추가한다:
  ```python
  def test_throttle_token_detached_head_returns_sha(self):
      with mock.patch("subprocess.run") as run:
          run.side_effect = [
              mock.Mock(returncode=0, stdout="HEAD\n"),      # abbrev-ref → detached
              mock.Mock(returncode=0, stdout="abc1234\n"),   # short sha
          ]
          self.assertEqual(stop._throttle_token(), "abc1234")

  def test_throttle_token_no_git_returns_norepo(self):
      with mock.patch("subprocess.run", side_effect=FileNotFoundError):
          self.assertEqual(stop._throttle_token(), "norepo")
  ```

---

### [INFO] bootstrap-session.sh — GC 로직에 대한 테스트 없음
- 위치: `.claude/tools/bootstrap-session.sh` diff (라인 2147–2156)
- 상세: 상태 마커 GC 로직(`find -mtime +30 -delete`)은 shell 스크립트이며 대응하는 테스트가 없다. 이 코드는 잘못 구성되면 state 디렉토리 외 파일을 삭제할 수 있다. 현재는 경로가 하드코딩되어 있어 위험이 낮지만, 테스트 가능성이 없다.
- 제안: 최소한 CI 에서 state 디렉토리 없을 때 스크립트가 exit 0 으로 끝나는지 smoke test 를 추가하거나, GC 로직을 Python helper 로 이동해 단위 테스트 가능하게 만든다.

---

### [INFO] lint_mermaid_posttooluse.py — 타임아웃 분기 테스트 없음
- 위치: `.claude/hooks/lint_mermaid_posttooluse.py` diff (라인 1573–1576)
- 상세: `subprocess.TimeoutExpired` 예외 핸들러가 추가되었지만 이를 검증하는 테스트가 없다. `FileNotFoundError` (node 없음) 분기도 테스트 없는 상태이다. 두 분기 모두 exit 0 + stderr 메시지를 반환해야 한다.
- 제안: `test_mermaid_lint_timeout_returns_zero` 와 같은 단위 테스트를 `test_review_guard_hardening.py` 와 동일 패턴으로 추가한다.

---

### [INFO] branch_guard.py — timeout 변경(4.0 → 2.0) 테스트 없음
- 위치: `.claude/hooks/_lib/branch_guard.py` diff (라인 38)
- 상세: Method 2 의 `remote show origin` 호출 timeout 이 4.0 → 2.0 으로 변경되었다. 변경 자체는 단순 값 조정이고 동작 변화가 없다. 그러나 `_origin_default_branch` 가 2초 타임아웃 내 완료 여부를 검증하는 테스트가 없으며, 기존 `test_branch_guard.py` 에서도 이 함수에 대한 timeout 경로를 패치하는 방식으로 커버하지 않는다.
- 제안: 선택적 — 타임아웃 경로는 `_run_git` 레벨에서 이미 `subprocess.TimeoutExpired → (1, "", "")` 로 처리되므로 상위 테스트 필요성은 낮다.

---

## 요약

새로 추가된 `test_review_guard_hardening.py` 는 핵심 변경 사항(porcelain 파싱, glob 경계, session 타임스탬프, in-flight 감지, risk level 창 확장, 스로틀 토큰)을 잘 커버하고 있으며 테스트 격리도 양호하다. 그러나 `_authoritative_code_time` 의 all-dirty 경로, `_glob_to_regex` 의 trailing `**` 분기, `_throttle_token` 의 detached HEAD·norepo 폴백, MEDIUM+행없음 resolved 케이스 등 엣지 케이스 갭이 존재한다. 또한 `bootstrap-session.sh` GC 추가와 mermaid timeout 분기는 테스트가 전혀 없다. 전반적으로 주요 기능에 대한 회귀 보호는 충분하나 분기 커버리지 완전성 면에서 개선 여지가 있다.

## 위험도

LOW
