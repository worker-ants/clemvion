# 부작용(Side Effect) 리뷰

대상: NERV 미러 도구(`pull.py`), 편집 가드 훅, 관련 테스트와 CI 워크플로 변경.

## 발견사항

- **[WARNING]** `check()` 가 읽기 오류를 보고하지 않고 traceback 으로 죽는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:481` (`stale_links` 안의 `path.read_text`), 호출부 `.claude/tools/nerv-mirror/pull.py:503`
  - 상세: `stale_links` 는 파일마다 `read_text(encoding="utf-8")` 를 예외 보호 없이 부른다. `check()` 는 이 함수를, 오류를 문제 줄로 바꿔 주는 파일별 `try`(506~514줄) 보다 먼저 부른다. 같은 파일을 파일별 루프에서 읽으면 `UnicodeDecodeError` 가 `ValueError` 하위라 "frontmatter 를 읽지 못했다" 줄로 보고된다. 그런데 `stale_links` 가 앞서 죽어서 그 경로에 닿지 못한다. 스크래치 사본(저장소 밖)에서 재현했다. `spec/CLE-ENG/` 에 UTF-8 이 아닌 `CLE-ENG-BAD.md` 를 두면 `UnicodeDecodeError` traceback 이 나오고, 이름이 `CLE-ENG-DIR.md` 인 디렉터리를 두면 `IsADirectoryError` traceback 이 나온다. 종료 코드는 1 이라 CI 는 그대로 빨갛고 거짓 통과는 없다. 그러나 직전 커밋(`8bc7e6df1`)이 세운 "traceback 대신 위치 문제로 알린다" 는 의도와 어긋나고, 다른 문제 줄도 함께 사라진다. 손편집 탐지 도구의 진단이 가장 필요한 입력(깨진 파일)에서 끊긴다.
  - 제안: `stale_links` 안의 읽기를 `try/except (OSError, ValueError)` 로 감싸 그 파일은 건너뛰거나(파일별 루프가 보고한다), `check()` 에서 파일별 루프를 먼저 돌리고 `stale_links` 에는 읽힌 파일만 넘긴다. 재현용 테스트로 비 UTF-8 파일 하나와 디렉터리 하나를 더한다.

- **[INFO]** CI 워크플로 머리 주석이 `--check` 의 새 범위보다 좁게 적혀 있다
  - 위치: `.github/workflows/spec-link-checks.yml:128-129`
  - 상세: 이 주석은 "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 고 적는다. 이번 변경으로 `--check` 는 지문 없는 미러 파일 추가, 옮겨진 문서의 옛 자리를 가리키는 링크, 미러 자리의 심볼릭 링크와 미러가 아닌 파일까지 잡는다. `pull.py` docstring, CHANGELOG, `PROJECT.md` 는 새 범위로 고쳐졌는데 이 주석만 그대로다. 보장을 실제보다 좁게 말하므로 위험은 작지만, 다음 사람이 "추가는 안 잡힌다" 고 믿고 같은 틈을 다시 막으려 할 수 있다.
  - 제안: 같은 파일의 sparse-checkout 주석을 고친 커밋에서 이 문단도 CHANGELOG 와 같은 문장으로 맞춘다.

- **[INFO]** `cmd_all` 의 README 쓰기는 "쓰기 전 전체 검사" 에 들지 않는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:319-321`, `.claude/tools/nerv-mirror/pull.py:541`
  - 상세: `apply` 는 미러 문서의 모든 대상을 먼저 검사해 "중간에 멈추면 일부만 쓴 미러가 남는다" 를 막는다. 그러나 `apply` 가 끝난 뒤의 `write_if_changed(spec_root, README, ...)` 는 그 검사 밖이다. `spec/README.md` 가 심볼릭 링크이거나 `spec/` 밖으로 풀리면 문서 169편은 이미 쓰였고 README 에서 `PullError` 가 나서 exit 1 이 된다. 지금은 미러 문서에 대한 주장이 맞고 README 는 빠져 있다.
  - 제안: README 대상도 `apply` 앞의 검사 루프에서 `_write_target(spec_root, PurePosixPath(README))` 로 본다. 아니면 주석을 "미러 문서" 로 한정한다.

- **[INFO]** `cmd_task` 가 키를 검증하기 전에 캐시 파일을 읽는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:591-592`
  - 상세: 변경 전에는 `mirror_relpath(key, area)` 가 `_cached_raw` 보다 먼저 불려 "키 형식 검증이 키의 모든 사용에 앞선다" 는 성질이 있었다. 지금은 `_cached_raw(cache, key)` 가 먼저이고 `mirror_relpath` 는 `conditional_etag` 의 인자 계산에서 불린다. 키가 `keys in areas` 를 통과한 서버 트리의 값이라 `../` 가 든 키면 `<cache>/../…md` 를 읽을 수 있다. 읽은 바이트는 해시에만 쓰이고, 요청과 쓰기는 `mirror_relpath` 가 예외를 내면서 그 앞에서 멈춘다. 그래서 실제 피해 경로는 없다. 이 성질이 주석이나 테스트에 없으므로 나중에 순서가 또 바뀌면 깨질 수 있다.
  - 제안: `mirror_relpath(key, areas[key])` 를 먼저 변수에 받고 그다음에 `_cached_raw` 를 부른다.

## 확인했으나 문제 없는 것

- 호출자 영향: 훅의 `checkout_root`·`owned_root` 이름 변경, `PullError` 의 `SystemExit` 제거, `--basis` 옵션 삭제, `cmd_all` 시그니처 변경은 모두 저장소 안에 다른 호출자가 없다. `origin/main` 에는 `pull.py` 와 훅이 아직 없는 새 파일이라 기존 사용자도 없다. `--basis` 는 전 저장소에서 남은 참조가 0건이다.
- `KEY_RE`·`TASK_RE`·`ETAG_RE` 에서 `^…$` 를 없애고 `fullmatch` 로 바꿨다. 이 이름을 `.match` 로 쓰는 외부 모듈이 없어 접두 일치로 넓어지는 영향이 없다.
- 실제 트리에서 `pull.py --check` 는 "미러 169편 · 문제 0" 으로 통과한다. 새 검사(미러 자리의 다른 파일, 심볼릭 링크, 옛 자리 링크)가 커밋된 미러를 CI 에서 빨갛게 만들지 않는다.
- `render_readme` 출력은 커밋된 `spec/README.md` 와 바이트 단위로 같다. 다음 `--all` 이 README 를 다시 쓰지 않는다. 지문 정의가 바뀌었어도 `render` 의 필드 순서(`source_paths`, `mirror_sha256`, `etag`)가 같아 기존 169편의 지문이 그대로 맞는다.
- 캐시(`.nerv/cache/mirror`)는 워크트리들이 공유할 수 있고 쓰기가 원자적이지 않다. 그러나 304 재렌더는 `etag_of(cached) == 미러 etag` 일 때만 일어난다. 다른 세션이 덮어쓰거나 쓰다 만 파일을 읽어도 불일치로 끝나고 무조건 요청으로 돌아간다. 틀린 304 로 이어지지 않는다.
- 네트워크: 테스트는 전부 `FakeNerv` 나 PATH 앞의 가짜 `curl` 을 쓴다. `test_missing_environment_stops` 는 환경 변수를 비운 채 돌아 실제 토큰이 있는 개발 머신에서도 요청이 나가지 않는다. `curl` 에 `-g`, `--proto =https,http` 가 더해졌고 리다이렉트는 따르지 않는다. 토큰은 여전히 stdin 설정에만 있다.
- 환경 변수: 훅은 `BYPASS_NERV_OWNED_PATHS` 만 읽는다. `CurlBoundaryTest` 의 환경 변수 조작이 `mock.patch.dict` 로 바뀌어 테스트 뒤 전역 `os.environ` 이 원상 복구된다(수동 복원보다 안전하다).
- 훅: `_target` 이 `tool_input.path` 를 더는 보지 않아 그 키로만 온 페이로드는 통과한다. `settings.json` 의 매처(`Write|Edit|MultiEdit|NotebookEdit`)가 쓰는 키는 `file_path`·`notebook_path` 뿐이라 실제 경로가 빠지지 않는다. 오류는 여전히 exit 0(fail-open)이다.
- 테스트 자체의 부작용: 모두 임시 디렉터리에서 돈다. `test_the_real_repository_is_guarded` 와 `MirrorPredicateParityTest` 는 실제 저장소를 읽기만 한다. 훅 모듈을 `sys.modules` 에 싣는 일(`guard_nerv_owned_paths_under_test`)은 이름이 겹치지 않고, 루프 변수 `hook` 을 `h` 로 바꿔 모듈 이름과의 섀도잉도 피했다.
- `.github/workflows/harness-checks.yml` 의 새 pathspec 은 `_changed-paths.yml` 이 `#` 줄을 떼어 주는 기존 관례와 같은 모양이다. `spec-link-checks.yml` 의 sparse-checkout 은 `spec` 과 `.claude/tools/nerv-mirror` 만 받고 `pull.py` 는 표준 라이브러리만 써서 잡이 돈다. `DEFAULT_ROOT` 는 체크아웃 루트로 풀린다.
- `consistency_orchestrator.py`, `test_consistency_bundle_priority.py`, `.claude/tests/README.md` 변경은 주석·문서뿐이다.
- 실행 검증: `test_nerv_mirror_pull.py`, `test_guard_nerv_owned_paths.py`, `test_harness_checks_paths_coverage.py`, `test_workflow_yaml_structure.py`, `test_required_check_skip_jobs.py` 를 `PYTHONDONTWRITEBYTECODE=1`, `-p no:cacheprovider` 로 돌려 136 passed, 645 subtests passed. 실행 전후 `git status --short` 는 이미 있던 untracked `review/` 경로 셋뿐이고 저장소 파일은 수정하지 않았다. 재현용 사본은 scratchpad 에만 두었다.

## 요약

이 변경은 새로 들어오는 도구(`pull.py`)와 훅을 다듬는 것이라 기존 호출자·공개 인터페이스에 미치는 영향이 없다. 시그니처, 예외 계층, CLI 옵션 변경은 모두 같은 브랜치 안에서 닫힌다. 파일시스템 쓰기는 심볼릭 링크와 `spec/` 밖 경로를 막는 쪽으로 더 엄격해졌고, 환경 변수와 네트워크 경계도 좁아졌다. 실제로 재현한 결함은 `--check` 의 `stale_links` 가 읽기 오류를 보고하지 않고 traceback 으로 죽는 것 하나다. CI 는 fail-closed 라 거짓 통과는 없지만 진단이 사라진다. 나머지는 주석이 새 범위보다 좁은 점, README 쓰기가 사전 검사 밖인 점, 키 검증 순서가 바뀐 점이며 모두 동작 영향은 없다.

## 위험도

LOW
