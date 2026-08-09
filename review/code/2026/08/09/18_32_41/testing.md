# 테스트(Testing) Review

## 발견사항

- **[WARNING]** "공백 포함 pathspec" 은 워크플로 주석이 명시적으로 파손 위험 클래스로 지목했는데 정작 회귀 테스트가 없다
  - 위치: `.claude/tests/test_changed_paths_reusable.py:76` (`ArgumentSplittingTest` 클래스 전체, 76~116행) / 근거 주석: `.github/workflows/_changed-paths.yml:28` (`# > (과 공백 포함 pathspec)이다.`)
  - 상세: `_changed-paths.yml` 헤더 주석은 뮤테이션 검증 결과로 "실제로 깨지는 것은 글로브 확장 **과 공백 포함 pathspec**" 이라고 못박는다. 그런데 `ArgumentSplittingTest` 의 케이스들(`test_each_line_becomes_one_argument`, `test_globs_are_not_expanded_by_the_shell`, `test_blank_lines_are_dropped`, `test_whitespace_only_lines_are_dropped`, `test_empty_input_fails_closed`, `test_single_pathspec_still_works`)은 전부 "줄 경계" 만 다루고, **한 pathspec 값 안에 공백이 들어간 경우**(예: `"a b.yaml"` 한 줄)를 넣어 그것이 여전히 인자 1개로 남는지 확인하지 않는다. 현재 `run:` 블록은 `FILTERED+=("$spec")` 로 정확히 따옴표 처리돼 있어 지금은 안전하지만, 이 파일 자체의 존재 이유가 "정적으로 안전해 보여도 실행으로 고정한다"인데, 정작 named risk 중 하나가 실행 고정 대상에서 빠져 있다. 나중에 누군가 `FILTERED+=($spec)` 처럼 따옴표를 빼는 리팩터를 해도(글로브 문자가 없는 값이면) 이 스위트가 못 잡는다.
  - 제안: `run_with("path with space.yaml\n")` 같은 케이스를 추가해 `argv(proc) == ["path with space.yaml"]` 를 단언한다.

- **[WARNING]** `run:` 블록이 `${{ inputs.pathspecs }}` 를 문자열에 직접 끼워 넣지 않고 `env:` 로만 받는다는 스크립트-인젝션 방지 불변식이 테스트로 고정돼 있지 않다
  - 위치: `.github/workflows/_changed-paths.yml:69-71` (`PATHSPECS: ${{ inputs.pathspecs }}` + 주석 "스크립트 인젝션 회피") / 테스트 측 대응 지점: `.claude/tests/test_changed_paths_reusable.py:119` (`class WiringTest`), 헬퍼 `detect_run_block()` (42행)
  - 상세: 이 저장소는 "학습한 불변식은 반드시 assertion 으로 고정한다"는 관행이 매우 일관적인데(README 전체가 그 사례 목록이다), 이 불변식만 프로즈로만 남고 검증이 없다. `detect_run_block()` 이 이미 `run:` 문자열을 반환하므로 비용이 거의 0에 가까운 회귀 테스트다. 누군가 리팩터하면서 `PATHSPECS: ${{ inputs.pathspecs }}` (env) 를 지우고 `run: | ... ${{ inputs.pathspecs }} ...` 처럼 직접 문자열에 삽입해도 잡는 테스트가 없다.
  - 제안: `WiringTest` 에 `self.assertNotIn("${{", detect_run_block())` 같은 단언을 추가해 `run:` 본문에 GH 표현식 삽입이 없음을 고정한다.

- **[INFO]** `run_with()` 가 만든 임시 디렉터리를 정리하지 않는다
  - 위치: `.claude/tests/test_changed_paths_reusable.py:57` (`tmp = tempfile.mkdtemp()`)
  - 상세: `tempfile.mkdtemp()` 로 만든 디렉터리가 어떤 테스트 케이스에서도 삭제되지 않는다. CI 러너에서는 무해하지만, 로컬에서 이 스위트를 반복 실행하면(6개 테스트 × 여러 번) 디렉터리가 계속 누적된다. 다른 harness 테스트들이 대체로 `tempfile.TemporaryDirectory()` 또는 명시적 정리를 쓰는 관행과 다르다.
  - 제안: `tempfile.TemporaryDirectory()` context manager 로 바꾸거나 `self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)` 를 추가한다(단, `run_with` 는 `unittest.TestCase` 밖의 자유 함수라 `addCleanup` 을 쓰려면 호출부에서 처리해야 함).

- **[INFO]** `on:` 이 YAML boolean 키로 파싱되는 문제를 우회하는 한 줄이 두 파일에 중복 인라인됐다
  - 위치: `.claude/tests/test_changed_paths_reusable.py:122` (`on = doc.get(True) if True in doc else doc.get("on")`) vs `.claude/tests/test_required_check_skip_jobs.py:72` (`return doc.get(True) if True in doc else doc.get("on")`, 함수명 `triggers`)
  - 상세: 같은 로직이 두 파일에 독립적으로 존재한다. 지금은 내용이 일치하지만, 이 저장소가 반복해서 겪은 "두 곳에 독립 존재해 한쪽만 갱신돼도 조용히 통과" 클래스의 축소판이다. 다만 정책 레지스트리 수준이 아니라 한 줄짜리 파싱 헬퍼라 실질 위험은 낮다.
  - 제안: 우선순위는 낮음. 굳이 추상화 파일을 새로 만들 필요는 없지만, `test_changed_paths_reusable.py` 에서 `test_required_check_skip_jobs` 를 import 해 `triggers()` 를 재사용하는 정도(이미 `test_required_check_skip_jobs.py::test_the_two_registries_agree` 가 반대 방향으로 cross-import 하는 선례가 있음)로 통합할 수 있다.

## 요약

`test_changed_paths_reusable.py` 는 이 저장소의 "정적 증거가 아니라 받는 쪽 산출물을 실행으로 확인하라"는 관행을 정확히 따른다 — YAML 에서 실제 `run:` 블록을 뽑아 bash 3.2 호환 방식으로 실행하고 스텁이 받은 인자 수·값을 단언하는 구조는, `mapfile`(bash4+ 전용) 회귀를 실제로 잡아낸 사례에서 보듯 실효성이 검증됐다. `test_required_check_skip_jobs.py` 의 `pathspecs_of()` 전환(substring → 파싱)도 이전의 얕은 substring 검증(주석에 적힌 경로까지 통과시키던 결함)을 제거했고, 세 워크플로 → `_changed-paths.yml` 로의 wiring 추적(`uses:`, `outputs.relevant`, `workflow_call.outputs`)까지 지름길 없이 따라간다. 다만 워크플로 자신의 주석이 명시적으로 지목한 위험 클래스 중 "공백 포함 pathspec" 케이스가 테스트로 고정되지 않았고, `${{ }}` 를 `run:` 에 직접 넣지 않는다는 인젝션 방지 불변식도 검증이 없다 — 둘 다 이 코드베이스의 "학습한 것은 assertion 으로 고정한다" 관행에서 벗어난 구멍이며, 비용이 낮은 추가로 메울 수 있다. Mock/stub 사용(인자 보고 전용 stub, 실제 판정 로직은 `test_ci_paths_changed.py` 로 분리)은 적절하고 과도하지 않다. 테스트 격리는 임시 디렉터리 미정리라는 사소한 위생 문제만 있다.

## 위험도
LOW
