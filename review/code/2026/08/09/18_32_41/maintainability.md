# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `run_with()` 의 임시 디렉터리가 정리되지 않음 (테스트 리소스 누수 + 자매 파일과의 일관성 불일치)
  - 위치: `.claude/tests/test_changed_paths_reusable.py:57` (`tmp = tempfile.mkdtemp()`)
  - 상세: `tempfile.mkdtemp()` 로 만든 디렉터리를 이후 어디에서도 삭제하지 않는다. 같은 판정 스크립트를 대상으로 하는 자매 파일 `.claude/tests/test_ci_paths_changed.py` 는 정확히 이 문제를 피하려고 `tempfile.TemporaryDirectory()` + `setUp`/`tearDown` 패턴을 쓴다(`_RepoFixture.setUp`/`tearDown`, 해당 파일 69·78번째 줄). 두 파일이 같은 종류의 실행-검증 테스트이면서 리소스 정리 컨벤션만 다르면, 다음에 이 패턴을 복사하는 사람이 어느 쪽을 따라야 할지 판단 근거가 없다.
  - 제안: `tmp = tempfile.mkdtemp()` 대신 `with tempfile.TemporaryDirectory() as tmp:` 로 감싸거나(각 테스트가 `run_with()` 를 호출할 때마다), 최소한 `self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)` 를 추가해 자매 파일과 정리 정책을 맞춘다.

- **[INFO]** README.md 새 행이 기존의 "문단형 표 셀" 컨벤션을 그대로 따름
  - 위치: `.claude/tests/README.md:50` (신규 `test_changed_paths_reusable.py` 행)
  - 상세: 새로 추가된 표 행 하나가 여러 문단 분량의 서술(도입 배경·회귀 클래스·pin 목록)을 한 markdown 테이블 셀에 담고 있어 표 자체의 가독성이 떨어진다. 다만 이는 이 파일의 다른 모든 행(`test_required_check_skip_jobs.py`, `test_review_gate_ci.py` 등)이 이미 취하고 있는 확립된 관례이며, 이번 diff 가 새로 만든 문제는 아니다.
  - 제안: 관례 자체를 바꾸는 것은 이번 변경 범위 밖. 다만 후속으로 이 파일이 더 커지면 표 대신 각 테스트 파일 상단 docstring 을 SoT 로 하고 표는 1~2문장 요약으로 축약하는 리팩터를 고려할 만하다(제안일 뿐, 이번 PR 에서 요구하는 것은 아님).

- **[INFO]** `_changed-paths.yml` 의 공백 판정에 서브프로세스 2개(subshell) 사용
  - 위치: `.github/workflows/_changed-paths.yml:87` (`if [ -n "$(printf '%s' "$spec" | tr -d '[:space:]')" ]; then`)
  - 상세: 각 pathspec 라인마다 `printf`+`tr` 파이프라인을 서브셸로 실행해 공백 전용 라인을 걸러낸다. 동작은 정확하고 의도(공백만 있는 라인 = 빈 pathspec 취급)는 주석으로 잘 설명돼 있으나, bash 파라미터 확장만으로(`${spec//[[:space:]]/}`) 서브프로세스 없이 같은 판정이 가능하다. `read` 루프·배열은 이미 bash 전용 기능을 쓰고 있어 이식성 손실도 없다.
  - 제안: 정확성에는 영향 없는 사소한 스타일 제안이므로 우선순위는 낮음. 필요 시에만 `[[ -n "${spec//[[:space:]]/}" ]]` 로 교체 고려.

## 요약

이번 변경은 3개 워크플로에 중복돼 있던 ~20줄의 `changes` 잡 wiring(체크아웃·SHA env·판정 스크립트 호출)을 `_changed-paths.yml` reusable workflow 하나로 추출한 리팩터로, 실제 중복 코드를 줄이는 방향이며 새로 추가된 코드 자체(워크플로 YAML·bash·Python 테스트)는 각 파일이 단일 책임을 가지고 함수/메서드 길이도 짧다. 매직 넘버·과도한 중첩·순환 복잡도 문제는 발견되지 않았고, 네이밍(`CHANGES_REUSABLE`, `pathspecs_of`, `FILTERED`)도 목적이 분명하다. 유일하게 실질적으로 짚을 만한 것은 새 테스트 파일의 임시 디렉터리 정리 누락으로, 같은 스크립트를 검증하는 자매 테스트 파일이 이미 올바른 패턴(`TemporaryDirectory`)을 쓰고 있다는 점에서 일관성 관점의 사소한 흠이다. 그 외 항목(README 표 셀 길이, bash 서브셸 사용)은 이미 코드베이스 전반에 퍼져 있는 기존 관례를 그대로 따른 것이라 이번 diff 가 새로 만든 문제는 아니다.

## 위험도

LOW
