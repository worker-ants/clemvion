# RESOLUTION — 코드 리뷰 라운드 3 (08_20_54)

판정 기준: 이 세션의 SUMMARY.md(Critical 0 · 경고 8 · 참고 31). 검토 범위 `ad8662bd5..8bc7e6df1`.

- 수정 커밋: `fb7acc7ec`(코드 · 테스트 · CI · PROJECT.md), `684c80759`(미러 README · SPECEVIDENCE, `pull.py` 출력), `b37c43b8f`(주석만).
- 검증: `python3.11 -m pytest .claude/tests` 1311 passed. 두 모듈은 주석 커밋 뒤 다시 95 passed. `pull.py --check` 미러 169편 · 문제 0.
- 뮤턴트 35개(유효) 중 34개 KILLED. 커밋 `fb7acc7ec` 위에서 돌렸고 원복은 사본 cp 로 했다. 살아남은 1개는 참고 9 에 적었다.
- `codebase/**` 변경은 없다. 라운드 시작 전에 정한 정지 규칙에 따라 라운드 4 리뷰는 돌리지 않는다. 그 규칙은 "라운드 3 수정이 harness 만 건드리면 라운드 4 리뷰 없이 pytest 와 뮤턴트로 검증한다" 였다.

## 경고

| # | 처분 | 근거 |
|---|------|------|
| 1 | fixed `fb7acc7ec` | 트리거 단언을 런타임과 같은 파서(`parse_pathspecs_block`)와 `filter_covers_file` 로 바꿨다. `.claude/tools/**` · `.claude/skills/**` · `spec-links.ts` 줄을 각각 지운 뮤턴트 3개가 모두 KILLED |
| 2 | fixed `fb7acc7ec` | 잡 주석에서 보장 범위 문장을 지우고 `pull.py` docstring 의 "보장 범위" 를 정본으로 가리킨다. docstring 은 "잡는다 / 잡지 않는다" 두 줄로 나눴고, 훅 docstring · PROJECT.md 도 그 절을 가리킨다 |
| 3 | fixed `fb7acc7ec` | `stale_links` 는 읽기 오류 파일을 건너뛴다. 파일별 루프는 `(OSError, ValueError)` 를 문제 줄로 바꾼다. `mirror_files` 는 폴더를 뺀다. 비 UTF-8 · 권한 0 · 미러 이름 폴더를 테스트했고 뮤턴트 3개가 KILLED |
| 4 | fixed `fb7acc7ec` | 치환을 함수로 넘기고, 쓴 뒤 `fm_value(..., "etag") == json.loads(bad)` 를 단언한다 |
| 5 | fixed `fb7acc7ec` | `apply(extra_targets=README)` 로 쓰기 전 검사에 README 를 넣었다. `_write_target` 은 경로 조각마다 링크를 본다. 쓸 때 `O_NOFOLLOW` 를 준다. README 링크 · 폴더 링크 · `write_if_changed` 단독 테스트를 더했고 뮤턴트 4개가 KILLED |
| 6 | fixed `fb7acc7ec` | `test_unrequested_304_stops_even_with_a_cache_of_another_version`. `etag is not None` → `cached is not None` 뮤턴트 KILLED |
| 7 | fixed `fb7acc7ec` | `_is_mirror_dir` · `_is_mirror_name` 두 헬퍼로 모았다. `stray_entries` 는 `_is_stray_in_folder` 로 나눠 2단 중첩이다 |
| 8 | fixed `fb7acc7ec` | 새 절을 인용 블록 뒤로 옮겼다 |

## 참고

| # | 처분 | 근거 |
|---|------|------|
| 1 | fixed | 키를 검증한 뒤에만 캐시를 읽는다. 오류는 `{key!r}`. 스파이 테스트(`test_keys_are_checked_before_the_cache_is_read`), 순서 뒤집기 뮤턴트 KILLED |
| 2 | fixed | 짝 없는 서로게이트를 U+FFFD 로 바꿔 판정한다(`cwd` 포함). 링크 폴더를 거친 경로까지 테스트하고 뮤턴트 2개가 KILLED. `realpath` 의 try/except 는 넣지 않았다. 치환 뒤에는 그 분기를 밟을 입력이 없어 테스트할 수 없는 코드가 된다 |
| 3 | wont_fix | fail-open 을 stderr traceback 으로 남기는 것은 형제 훅(`lint_mermaid_posttooluse.py`)의 관례다. `_lib/failopen_state.py` 는 review · plan 게이트용이라 PreToolUse 에 옮기지 않는다 |
| 4 | fixed | `--check` 출력과 CLI 오류 줄의 제어 문자를 `\xNN` 으로 바꾼다. 개행 + `::error::` 이름 테스트, 뮤턴트 KILLED |
| 5 | fixed | 오류를 `PullError` 하나로 모았다(curl 실패 · curl 없음 · 상태 줄 · zip 아님 · 없는 zip · JSON 아님 · 트리 모양 · 쓰기 실패). `main`(한 줄 + 1) · `run`(예외) 분리. 쓰기 전에 모든 문서를 렌더한다. `TransportError` 하위 클래스는 두지 않았다. 호출자가 전송 오류를 따로 다루는 곳이 없어 한 클래스로 충분하다. 관련 뮤턴트 9개 KILLED |
| 6 | fixed | `urlsplit` 의 `ValueError` 는 False. 제어 문자 · 공백 거부, curl `-q`(`~/.curlrc` 무시). 거부 목록에 `https://[::1` · `#x` · `:pw@` · 개행 · 공백을 더했다. `u.password` 검사는 지웠다. 실측으로 `https://:pw@h` 도 `username == ''` 라 사용자 이름 검사가 같은 입력을 막는다. 비밀번호 가지만 지운 뮤턴트는 어떤 입력으로도 구별되지 않았다 |
| 7 | fixed | 경로 조각마다 링크를 보고 `O_NOFOLLOW` 를 준다. CHANGELOG 의 "심볼릭 링크는 따라가 쓰거나 지우지 않는다" 가 이제 구현과 맞다 |
| 8 | fixed | 메시지가 방향을 단정하지 않는다: "링크 … 의 대상이 없다(… 미러는 spec/… 에 있다) — 이 문서와 KEY 를 함께 pull 로 다시 받는다" |
| 9 | fixed | 304 면 캐시를 다시 쓰지 않는다(스파이 테스트, 뮤턴트 KILLED). 쓸 때는 임시 이름에 쓴 뒤 `os.replace`. 원자성 뮤턴트(바로 쓰기)는 **살아남는다**. 동시 쓰기 경합을 결정적으로 재현하는 단위 테스트는 두지 않았다. 읽는 쪽이 etag 로 대조하므로 틀린 304 로 이어지지 않는다는 성질은 docstring 에 적었다 |
| 10 | fixed | `.md` 점 이름은 알린다. 합성 경계 이름 16개로 "느슨한 판정이 빼는 경로는 도구의 미러이거나 `--check` 가 알린다" 를 단언한다. 옛 트리 이름 6개는 음성 쪽으로 남는다. 편 수 하한 대신 "영역 폴더 미러와 영역 밖 미러가 각각 있다" 로 바꿨다 |
| 11 | fixed | `RuntimeError` 는 이제 없다. `CLE-ACCT/sub/` · `CLE-lower/` · 빈 폴더 링크 케이스를 더했고 각 뮤턴트가 KILLED |
| 12 | wont_fix(이 PR) | `stray-tool-tags.test.ts` 는 `codebase/**` 다. 이번 라운드를 harness 로 한정한 정지 규칙 밖이다. 하한(`spec: 190` · `plan: 250`)은 단계 3(`CLE-T-FN2JWK`) · 5(`CLE-T-7M4C4X`)가 옛 트리를 지울 때 그 테스트가 RED 로 드러내므로 조용히 깨지지 않는다. 그 단계 PR 에서 실측으로 다시 잡는다 |
| 13 | fixed | `CiWiringTest.test_the_check_runs_with_only_the_sparse_paths`: 잡의 sparse 경로만 복사한 사본에서 `--check` 를 서브프로세스로 돌린다 |
| 14 | fixed | `actions/setup-python@v7`(`python-version: '3.x'`) |
| 15 | fixed | 키 집합을 형제 훅과 같게 `file_path` · `path` · `notebook_path` 로 되돌리고 이유를 적었다(받는 키가 늘면 막는 쪽으로만 넓어진다). `input` 폴백은 다른 훅 네 곳(`guard_default_branch_edit` · `guard_default_branch_bash` · `lint_mermaid_posttooluse` · `guard_review_before_push`)과 같아서 둔다. `base = …` 로 풀어 썼다 |
| 16 | fixed | `get_ok` 를 모듈 함수 `ok_body` · `json_body` 로 뺐다. 대역은 `project` · `get` 만 둔다 |
| 17 | 일부 fixed | README 템플릿에서 Task 키를 뺐다(`684c80759`, `--all` 재실행에서 다른 미러 168편은 바이트 그대로). `pull.py` docstring 은 단계 번호만 적고 목록은 훅 docstring 한 곳을 가리킨다. 훅 docstring 의 전체 목록은 둔다. 라운드 2 참고 11 의 처분(목록 한 곳)이다 |
| 18 | spec_change | NERV `CLE-ENG-SPECEVIDENCE` R-12 초안을 고쳤다(spec_version `01a0e339-5ba5-73a1-8b7d-fb7189e80581`, 두 줄 교체, `nerv_spec_check` 발견 0). 서버 본문과 로컬 편집본이 바이트 단위로 같음을 확인했다. 미러는 `pull.py --all` 뒤 `--task CLE-T-VA4YA1` 로 받았다(`684c80759`). 승인은 사람 몫이다 |
| 19 | 조치 불요 | `stray_entries` 는 의도한 확장이다. 두 가드가 미러 자리를 통째로 빼서 생긴 빈틈을 메운다. R-12 에도 적었다(참고 18). `.orig` 같은 편집기 잔재가 CI 를 깨는 것도 의도다. 미러 폴더에는 도구가 쓴 파일만 둔다 |
| 20 | 일부 fixed | "한 가지" 로 낮추고 프로브가 `json.loads` 에 기댄다는 것을 주석과 단언 메시지에 적었다. 지워진 cwd 케이스는 더하지 않았다. `os.getcwd()` 실패도 같은 `except` 분기로 가고, 그 분기는 이미 `test_runtime_errors_fail_open` 이 결정적으로 밟는다 |
| 21 | fixed | 정규식 주석을 형식 검증 네 개로 좁혔다. `is_excluded` docstring 을 고쳤다. `Doc` docstring 과 모듈 docstring 에 "`area` 는 미러 폴더" 를 적었다 |
| 22 | fixed | 테스트 모듈 docstring 의 클래스별 목록을 채웠다 |
| 23 | fixed | PROJECT.md 에 영역 밖 문서와 `NERV_PROJECT` |
| 24 | fixed | 훅 차단 메시지와 README 에 "여러 키로 나뉘었을 수 있다" |
| 25 | fixed | "이 PR" · "라운드 N 재현" 을 날짜로 바꿨다(`fb7acc7ec`, `b37c43b8f`). 문장부호 교체의 분리는 다음 작업부터 지킨다 |
| 26 | fixed | `MIRROR_FIELDS` 상수, `fingerprint` 는 `split_frontmatter` 로 경계를 정한다. `mirror_relpath` 가 타입을 보고(`well_typed` 삭제), `area` 지역 변수를 되살렸다 |
| 27 | fixed | `test_non_string_cwd_falls_back_to_process_cwd` 로 분리, `_clean_env()`, `hook_module` |
| 28 | wont_fix | `import traceback` 상단 배치는 라운드 2 참고 7 의 처분이다. 호출당 약 1~1.5ms(리뷰어 실측)라 되돌려 제안끼리 번갈아 고치지 않는다 |
| 29 | wont_fix | 실측 85ms · 링크 수에 선형. 1초를 넘으려면 미러가 열 배 넘게 커져야 한다 |
| 30 | 일부 fixed | curl `--max-filesize 64MiB` 를 더했다. 문서마다 curl 을 새로 띄우는 구조는 둔다(라운드 2 참고 30 과 같은 판단) |
| 31 | 머지 순서로 해소 | 짝 planner PR 을 먼저 머지한다. PR 본문 첫 줄에 적는다 |
