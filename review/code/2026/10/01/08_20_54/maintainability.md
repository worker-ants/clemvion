# 유지보수성(Maintainability) 리뷰 — 라운드 3

범위: `ad8662bd5..8bc7e6df1`. 라운드 2 수정이 새 결함을 만들지 않았는지에 무게를 두고 읽었다. 저장소 파일은 수정하지 않았고 검증용 실행은 읽기 전용(YAML 파싱)만 했다. `git status --short` 는 리뷰 시작 때와 같다.

### 발견사항

- **[WARNING]** CI 트리거 등재 테스트의 두 단언이 공허하다. 줄을 지워도 통과한다.
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:834` · `:837` · `:838` (`test_the_three_files_trigger_the_harness_workflow`)
  - 상세: `wf["jobs"]["changes"]["with"]["pathspecs"].split()` 은 YAML 블록 스칼라의 **주석 줄까지** 토큰으로 자른다. 블록 스칼라 안에서는 `#` 줄도 본문이기 때문이다(`_changed-paths.yml` 이 런타임에 `#` 줄을 떼는 이유). `harness-checks.yml` 의 새 주석 "나머지 둘은 위 `.claude/tools/**` · `.claude/skills/**` 가 덮는다" 에 그 두 토큰이 그대로 들어 있다. 실측(scratch 에서 YAML 파싱): 실제 `.claude/tools/**` 줄을 지워도 `".claude/tools/**" in specs` 가 True 로 남는다. 즉 `:837` · `:838` 은 pathspec 을 빼는 PR 을 잡지 못한다. `:836` 의 전체 경로 단언만 유효하다. 이 함정은 이미 `test_harness_checks_paths_coverage.py::parse_pathspecs_block` docstring 에 적혀 있고 `test_spec_link_checks_scope.py` 가 그것을 재사용한다. 새 테스트만 자체 파싱으로 같은 함정에 빠졌다.
  - 제안: `from test_harness_checks_paths_coverage import parse_pathspecs_block` 로 바꾸고 `specs = parse_pathspecs_block(text)` 를 쓴다. `import yaml` 도 필요 없어진다. 고친 뒤 `.claude/tools/**` 줄을 지우는 뮤턴트로 RED 를 확인한다.

- **[WARNING]** `spec-link-checks.yml` 의 잡 주석이 `--check` 의 보장 범위를 옛 그대로 적고 있다.
  - 위치: `.github/workflows/spec-link-checks.yml:124-131` (특히 `:128` "미러 파일의 추가 · 삭제와 옛")
  - 상세: 이 주석은 "미러 파일의 추가 · 삭제 … 는 잡지 않는다" 고 적는다. 라운드 2 수정 뒤 `pull.py` docstring, 훅 docstring, CHANGELOG 는 "지문 없는 미러 파일 추가 · 미러 자리의 다른 파일 · 심볼릭 링크 · 옛 자리를 가리키는 링크를 잡는다" 로 바뀌었다. 같은 파일의 `sparse-checkout` 만 고쳐서 이 주석은 diff 밖에 남았다. 지문이 "`mirror_sha256` 줄을 뺀 파일 전체" 라는 설명도 이제는 "frontmatter 의 그 줄 하나" 가 정확하다. 보장 범위 서술이 훅 docstring · pull.py docstring · CHANGELOG · 이 주석 · PROJECT.md · 미러 R-12 여섯 곳에 각자 문장으로 있어, 라운드마다 한두 곳이 뒤처진다(이번이 그 사례다).
  - 제안: 이 주석은 범위 문장을 줄이고 "`pull.py` 모듈 docstring 의 '보장 범위' 가 정본" 이라고 가리킨다. 최소한 `:128-129` 를 pull.py docstring 과 같은 내용으로 맞춘다.

- **[WARNING]** 미러 자리 판정(폴더 · 파일 이름 조건)이 `pull.py` 안에 여러 벌이고, 라운드 2 결함이 바로 그 한 곳의 누락이었다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:238-240` (`_mirror_entries`) · `:269` · `:273-278` (`stray_entries`) · `:329` (`apply` 의 빈 폴더 정리)
  - 상세: "미러 폴더" 조건 `d.is_dir() and not d.is_symlink() and KEY_RE.fullmatch(d.name)` 이 세 곳에 조금씩 다른 모양으로 있다(`:269` 는 앞의 `continue` 로 `is_symlink` 를 대신하고, `:329` 는 순서가 다르다). "미러 파일 이름" 조건 `suffix == ".md" and KEY_RE.fullmatch(q.stem)` 도 `:237` · `:240` · `:273` · `:276` · `:278` 에 흩어져 있다. 라운드 2 에서 prune 이 폴더 심볼릭 링크를 따라가 `spec/` 밖 파일을 지우는 결함이 나온 원인이 이 조건 하나(`mirror_files`)에서 `is_symlink` 가 빠진 것이었다. 다음에 미러 자리 규칙이 바뀌면(예: 카탈로그 영역 허용) 같은 종류의 누락이 다시 나기 쉽다. 파일 쓰기와 삭제 경로라 비용이 큰 자리다.
  - 제안: `_mirror_dirs(spec_root)` (링크 아닌 키 이름 폴더)와 `_is_mirror_file_name(path)` (`.md` + 키 stem) 두 헬퍼로 모으고 세 함수가 그것만 부른다.

- **[INFO]** `stray_entries` 의 가독성. 중첩 4단, 같은 조건의 부정형이 섞여 있다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:259-280`
  - 상세: `for → if → for → if → if` 이고 `:275-277` 은 `not (q.is_file() and not q.is_symlink() and … )` 로 이중 부정이다. `:273` 이 같은 조건의 양성형을 앞에서 한 번 더 쓴다. 이 함수를 읽고 "무엇이 stray 인가" 를 한 문장으로 말하기 어렵다.
  - 제안: 위 헬퍼를 쓰면 `if is_mirror_file_name(q): continue` 한 줄(링크 여부는 `mirror_links` 가 본다)과 나머지는 stray 로 줄어든다. 폴더 안 검사는 `_stray_in_folder(folder)` 로 나누면 중첩이 2단이 된다.

- **[INFO]** 프런트매터 필드 이름이 `FINGERPRINT_FIELD` 만 상수이고 나머지는 리터럴이다. 필드 순서도 두 번 적는다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:216` · `:226` · `:229-230` · `:563`
  - 상세: 라운드 2 에서 `MIRROR_FIELDS` 를 없애고 `added = ("source_paths", FINGERPRINT_FIELD, "etag")` 를 지역 변수로 넣었다. `"etag"` 는 `:216` · `:226` · `:230` · `:563` 에, `"source_paths"` 는 `:216` · `:226` · `:229` 에 있다. `render` 는 `fields` 딕셔너리를 만들고(`:226`) 곧바로 같은 키를 다시 풀어 순서를 바꿔 새 딕셔너리를 넘긴다(`:229-230`). 순서 "source_paths → mirror_sha256 → etag" 는 테스트(`test_nerv_mirror_pull.py:181-182`)가 단언하지만 코드에서는 읽어 내기 어렵다.
  - 제안: `MIRROR_FIELDS = ("source_paths", FINGERPRINT_FIELD, "etag")` 를 모듈 상수로 되돌려 `added` 와 순서의 정본으로 삼고, `render` 는 값 딕셔너리 하나에 지문 자리만 채워 `MIRROR_FIELDS` 순서로 조립한다.

- **[INFO]** "멈춘다" 예외가 두 갈래다. `PullError` 와 `RuntimeError`.
  - 위치: `.claude/tools/nerv-mirror/pull.py:435` · `:451` · `:576` · `:579` · `:678`
  - 상세: 라운드 2 에서 `PullError(SystemExit)` 를 `Exception` 으로 바꾸고 `__main__` 이 `(PullError, RuntimeError)` 를 잡게 했다. 그런데 curl 실패(`:435`)와 응답 해석 실패(`:451`)는 여전히 `RuntimeError` 라, 사용자에게 한 줄로 알릴 실패가 두 클래스로 나뉜다. `:576` · `:579` 의 `json.loads` 가 `JSONDecodeError` 를 내거나 `--from-zip` 이 `BadZipFile` 을 내면 한 줄 종료 규약(`test_cli_reports_errors_in_one_line`)을 벗어나 traceback 이 나온다. `__main__` 의 catch 목록이 암묵 계약이 됐다.
  - 제안: `Nerv.get` · `parse_response` 를 `PullError` 로 통일하고(테스트 `test_curl_failure_raises` 의 기대도 함께 고친다), `json.loads` 경계는 작은 헬퍼로 감싸 `PullError` 로 바꾼다. 통일하지 않을 것이면 `PullError` docstring 에 "외부 I/O 실패는 RuntimeError" 라고 적는다.

- **[INFO]** 프런트매터 끝을 찾는 규칙이 두 곳에 따로 있다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:147-154` (`split_frontmatter`) · `:202-210` (`fingerprint`)
  - 상세: 전자는 `text.find("\n---\n", 4)`, 후자는 "첫 줄이 `---` 이고 다음 `---` 줄까지" 를 직접 돈다. 잘 닫힌 파일에서는 같은 결과지만 끝 개행 없는 닫힘(`---` 로 끝나는 파일)이나 빈 프런트매터에서 갈라진다. `check` 가 `split_frontmatter` 를 먼저 통과시켜 지금은 드러나지 않는다. 지문은 무결성 검사의 핵심이라 경계 정의가 하나여야 한다.
  - 제안: `split_frontmatter` 가 닫는 줄의 위치를 돌려주는 내부 헬퍼를 두고 `fingerprint` 가 그것을 쓴다.

- **[INFO]** `mirror_relpath` 가 타입 검증을 안 하고, 호출자가 `well_typed` 로 대신한다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:129-131` · `:518-523`
  - 상세: `KEY_RE.fullmatch(name)` 은 문자열이 아니면 `TypeError` 를 낸다. 그래서 `check` 가 `well_typed` 를 따로 계산해 `mirror_relpath` 호출을 피한다(`:519-521`). 같은 "키가 아니면 PullError" 규칙이 두 층에 나뉘었다. `check` 본문도 33줄에 여섯 검사가 섞여 파일 단위 검사(`:504-525`)를 `_check_file` 로 뗄 만하다.
  - 제안: `mirror_relpath` 에 `isinstance(name, str)` 조건을 넣어 `PullError` 로 통일하면 `well_typed` 와 `try/except` 가 사라진다.

- **[INFO]** `cmd_task` 에서 지역 변수를 없애 `areas[key]` 가 네 번 반복된다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:588` · `:592` · `:600`
  - 상세: 라운드 2 에서 `area = areas[key]` 를 지우고 인라인했다. 루프 본문이 길어진 만큼 읽는 쪽이 매번 같은 조회를 다시 해석해야 한다.
  - 제안: `area = areas[key]` 를 되돌린다. `conditional_etag` 추출은 좋은 변경이다.

- **[INFO]** 전환 단계 → Task 키 목록이 훅 docstring 에 있고, Task 키가 일곱 곳에 흩어져 있다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-21` · `.claude/tools/nerv-mirror/pull.py:9-11` · `:625`
  - 상세: 훅은 "어느 경로를 막는가" 를 설명하는 파일인데 4a~4g 정리 Task 일곱 개의 키까지 담는다. 다른 파일(`pull.py:11`)이 "목록 전체는 훅 docstring 에 있다" 고 가리켜 이 자리가 사실상 정본이 됐다. `CLE-T-7M4C4X` · `CLE-T-VP5KDJ` 는 `spec-links.ts`, 오케스트레이터, 테스트, `spec/README.md`, `render_readme` 에도 박혀 있다. 특히 `render_readme`(`:625`)는 생성물에 Task 키를 굳혀, 5단계에서 옛 트리가 지워지면 문구가 낡은 채 남는 템플릿이 된다.
  - 제안: 단계 목록은 NERV 를 정본으로 두고 코드 주석에는 단계 번호와 "NERV `[전환 N]` Task 참조" 만 남기거나, 거버넌스 문서 한 곳(planner 소유)으로 옮긴다. `render_readme` 의 Task 키는 "단계 5" 로만 쓴다.

- **[INFO]** `test_malformed_payloads_pass_quietly` 가 이름과 다른 동작을 함께 검사하고, 환경 정리 코드가 세 번 반복된다.
  - 위치: `.claude/tests/test_guard_nerv_owned_paths.py:183-188` · `:192` (`run_hook` 본문 `:88-90`)
  - 상세: 마지막 블록은 `cwd` 가 문자열이 아닐 때 **차단(exit 2)** 을 확인한다. 테스트 이름("조용히 통과")과 기대가 반대라 실패했을 때 원인 추적이 어렵다. `{k: v for k, v in os.environ.items() if k != "BYPASS_NERV_OWNED_PATHS"}` 가 `:187` · `:192` 와 `run_hook` 에 각각 있는 것은 `run_hook` 에 프로세스 cwd 인자가 없어서다.
  - 제안: `run_hook(..., proc_cwd=None, runner=None)` 로 확장하거나 `_clean_env()` 헬퍼를 두고, 마지막 블록을 `test_non_string_cwd_falls_back_to_process_cwd` 로 분리한다.

- **[INFO]** 모듈 변수 `hook` 과 상수 `HOOK` 이 한 글자 대소문자 차이다.
  - 위치: `.claude/tests/test_guard_nerv_owned_paths.py:37` · `:39` · `:57-59`
  - 상세: 경로는 `HOOK`, 적재한 모듈은 `hook` 이다. 리스트 컴프리헨션 변수 이름이 `hook` 과 겹쳐 `h` 로 바꿔야 했다(`:57-59`). 같은 원인의 읽기 비용이다.
  - 제안: `hook` → `hook_module` (또는 `guard`).

- **[INFO]** `RUNTIME_ERROR_PROBE` 는 훅이 `json.loads` 를 쓴다는 구현 세부에 기댄다.
  - 위치: `.claude/tests/test_guard_nerv_owned_paths.py:42-50` · `:196-197`
  - 상세: 훅이 `json.load(sys.stdin)` 으로 바뀌면 프로브가 예외를 내지 못한다. 그때 `assertIn("RuntimeError: probe")` 가 실패하지만 원인이 "프로브가 안 걸렸다" 임을 알기 어렵다. 코멘트는 "유일한 결정적 방법" 이라고만 한다.
  - 제안: 코멘트에 "훅이 `json.loads` 로 읽는다는 사실에 기댄다" 를 적고 `assertIn` 에 "프로브가 훅의 읽기 경로를 못 밟았다" 메시지를 붙인다.

- **[INFO]** 실제 미러 동치 테스트의 하한이 100 에서 1 로 내려가 "공허함" 검사가 사실상 사라졌다.
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:825`
  - 상세: 미러가 부분 스냅샷(D3)이라 하한을 낮춘 이유는 타당하다. 다만 `> 1` 은 근거 없는 매직 넘버다. 현재 169편이라 파일이 2편만 남아도 통과한다.
  - 제안: `MIN_MIRROR_FILES = 2` 같은 이름을 붙이고 이유를 한 줄 적거나, README · 영역 폴더 · 영역 밖 문서가 각각 하나 이상인지로 바꾼다.

- **[INFO]** `FakeNerv.get_ok` 가 실제 `Nerv.get_ok` 를 대역 객체에 바인딩해 부른다.
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:487-488`
  - 상세: 중복 제거로는 좋다. 다만 실제 `get_ok` 가 `self.project` 같은 속성을 더 쓰기 시작하면 대역이 조용히 깨진다. 지금 구현(`pull.py:438-442`)은 `self.get` 만 쓴다.
  - 제안: 그대로 두되 `FakeNerv` docstring 에 "`get_ok` 는 실제 구현을 빌려 쓴다. `Nerv.get_ok` 가 `get` 외 속성을 쓰게 되면 대역에도 넣는다" 를 적는다.

- **[INFO]** 훅 `_target` 의 `cwd` 처리 식이 한 줄에 중첩돼 있고, `input` 폴백의 근거가 없다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:75` · `:84-85`
  - 상세: `Path(cwd if isinstance(cwd, str) and cwd else os.getcwd()) / path` 는 조건식을 `Path(...)` 안에 넣어 읽기 어렵다. `payload.get("tool_input") or payload.get("input")` 의 `input` 폴백은 남기면서 `path` 폴백은 "편집 도구가 쓰지 않는 키" 라며 지웠다. 두 폴백의 기준이 다르다.
  - 제안: `base = cwd if isinstance(cwd, str) and cwd else os.getcwd()` 로 풀어 쓰고, `input` 폴백이 실제 페이로드에 있는지 확인해 없으면 지우고 있으면 이유를 주석으로 남긴다.

### 잘 된 점 (회귀 방지용 기록)

- `fullmatch` 통일, `PullError` 를 `SystemExit` 에서 분리한 것, `etag_of` · `conditional_etag` · `folder_of` · `paths_of` 추출은 가독성과 테스트 용이성을 실제로 높였다.
- `.claude/tests/README.md` 의 행을 줄이고 "모듈 docstring 이 정본" 이라고 못 박은 것은 같은 내용을 두 곳에 두던 드리프트를 끊는다.
- 세 곳의 미러 판정에 "동치 테스트가 있다" 는 상호 참조 주석을 단 것은 유지보수 경로를 남긴다.
- `mock.patch.dict` 로 환경 복원을 바꾼 것(`CurlBoundaryTest`)은 수동 복원보다 안전하다.

### 요약

라운드 2 수정은 대체로 구조를 좋게 했다(예외 분리, 공용 헬퍼 추출, 상수화, 테스트 docstring 정본화). 남은 문제는 세 가지로 모인다. 첫째, 새로 추가한 CI 트리거 테스트가 주석 토큰 때문에 두 단언에서 공허하다(저장소에 이미 같은 함정을 푼 헬퍼가 있다). 둘째, `--check` 보장 범위 서술이 여섯 곳에 복제돼 있고 이번에도 `spec-link-checks.yml` 주석 한 곳이 옛 문장으로 남았다. 셋째, 미러 자리 판정이 `pull.py` 안에서 세 곳에 흩어져 있어 라운드 2 의 prune 결함과 같은 누락이 다시 나기 쉽다. 나머지는 읽기 비용과 일관성에 관한 INFO 이며, 동작을 바꾸는 결함은 보지 못했다.

### 위험도

MEDIUM
