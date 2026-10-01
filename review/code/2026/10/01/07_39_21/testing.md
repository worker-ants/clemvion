# 테스트(Testing) 리뷰 — 라운드 2 (범위 d82040273..8a45684cd)

검증 방법은 두 가지다. 먼저 저장소를 읽기만 하는 실행으로 회귀를 확인했다. `.claude/tests` 전체가 1274 passed 이고 `unittest discover` 로 돌린 신규 두 모듈(47건, 11건)도 OK 이며 frontend docs 가드 `vitest` 는 23 파일 3711건이 모두 통과했다. 다음으로 scratch 사본(`/private/tmp/claude-501/-Volumes-project-private-clemvion/52477887-e230-4159-906d-cdf4c5878063/scratchpad/review-scratch-r2/testing/`)에서 뮤턴트 19개를 돌렸다. 저장소 트리는 고치지 않았고 작업 종료 시점의 `git status --short` 는 기존 untracked 3줄(`review/…`)뿐이다.

뮤턴트 결과는 다음과 같다. 예측은 "라운드 1 이 닫았다고 한 것은 죽는다"였다.

| 뮤턴트 | 결과 | 죽인 테스트 |
| --- | --- | --- |
| 오케스트레이터 제외 절 제거 / `README` 분기 제거 / 디렉터리 분기 제거 / 최상위 파일 분기 제거 | KILLED 4/4 | `NervMirrorStaysOutOfTheOldCorpusTest` 두 개 |
| 훅 `cwd` 해석 제거 / `notebook_path` 제거 / `input` 별칭 제거 / `isinstance(dict)` 제거 | KILLED 4/4 | dot-dot, every_edit_tool, empty_or_broken_payload |
| 훅 `except` 의 `sys.exit(0)` → `sys.exit(2)` | SURVIVED | 없음 |
| 훅 `tool_input.get("path")` 폴백 제거 | SURVIVED | 없음 |
| `Nerv.get` argv 에서 `-K -` 제거 / `-D -` 제거 / `-A` 제거 / `--max-time` 제거 | SURVIVED 4/4 | 없음 |
| `parse_response` 의 `established` 절 제거 | SURVIVED | 없음 |
| `_curl_value` 에서 역슬래시 제거 | SURVIVED | 없음 |
| `cmd_task` 의 md 응답 `status != 200` 가드 무력화 | SURVIVED | 없음 |
| `cmd_task` 의 etag 형식 검사(복구) 제거 | SURVIVED | 없음 |
| `http://localhost` 루프백 예외 제거 | SURVIVED | 없음 |
| `MAX_PRUNE_RATIO` 비교 `>` → `>=` | SURVIVED | 없음 |

## 발견사항

- **[WARNING]** 훅의 fail-open `except` 분기가 무테스트이고 그 분기를 fail-closed 로 뒤집어도 전 테스트가 통과한다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:115-121` (`if __name__ == "__main__"` 블록), `.claude/tests/test_guard_nerv_owned_paths.py:146-152`
  - 상세: 이 PR 이 훅을 고친 계기가 "훅이 죽어 모든 편집이 막힌 사고"인데, 예상 밖 예외에서 exit 0 으로 빠지는 계약은 어떤 테스트도 밟지 않는다. `sys.exit(0)` 을 `sys.exit(2)` 로 바꾼 뮤턴트가 11개 테스트를 모두 통과했다(예측: KILLED, 실측: SURVIVED). `test_empty_or_broken_payload_fails_open` 의 입력(`""`, `{not json`, `[]`, `null`, `{"tool_name":"Write"}`)은 전부 `_read_payload`/`_target` 에서 일찍 반환해서 `except` 에 닿지 않는다. 실제로 `except` 에 닿는 입력을 프로브로 확인했다. `{"tool_input":"x"}`(AttributeError), `{"tool_input":{"file_path":5}}`(TypeError), `{"cwd":5,"tool_input":{"file_path":"a"}}`(TypeError), `file_path` 에 NUL 바이트(ValueError), `file_path` 가 리스트(TypeError)는 모두 exit 0 에 traceback 이 stderr 로 나간다. 동작은 맞지만 고정돼 있지 않다. 테스트 주석의 "traceback 없음"은 조기 반환 입력에만 해당한다.
  - 제안: `tool_input` 이 문자열인 페이로드와 `file_path` 가 정수인 페이로드를 넣어 `returncode == 0` 과 `"Traceback" in stderr`(runtime 오류는 조용하지 않고 허용된다는 뜻)를 각각 단언하는 테스트를 더한다. 덤으로 `tool_input.get("path")` 폴백(뮤턴트 SURVIVED)은 편집 도구에 없는 키이므로 테스트로 고정하거나 코드에서 지운다.

- **[WARNING]** curl 경계 테스트가 curl 에 넘기는 인자를 검증하지 않아 `-K -` · `-D -` 누락이 통과한다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:493-501`(`FAKE_CURL`), `:533-541`(`test_token_only_in_stdin_and_etag_quoted`), `.claude/tools/nerv-mirror/pull.py:317-319`
  - 상세: 가짜 `curl` 은 argv 의미를 무시하고 stdin 을 로그에 남긴 뒤 항상 헤더 + 본문을 출력한다. 그래서 `-K -` 를 뺀 뮤턴트(진짜 curl 이라면 stdin 설정을 읽지 않아 `Authorization` 헤더 없이 401), `-D -` 를 뺀 뮤턴트(진짜 curl 이라면 헤더를 안 내서 `parse_response` 가 RuntimeError), `-A`(Cloudflare 1010 회피 근거로 docstring 에 적힌 값), `--max-time` 제거가 모두 SURVIVED 다(예측: 최소 `-K -` 는 KILLED, 실측: 4/4 SURVIVED). 테스트는 "토큰이 argv 에 없다"와 "stdin 에 있다"만 본다. 이 조합은 "curl 이 stdin 을 설정으로 읽는다"를 보장하지 않는다. README 의 `CurlBoundaryTest` 설명("the token is in the stdin config and never in argv")은 이 공백을 가린다.
  - 제안: 가짜 curl 이 argv 에 `-K` 다음이 `-` 가 아니면 exit 2 로 끝나고 `-D` 다음이 `-` 가 아니면 헤더 없이 본문만 내도록 하거나, 테스트가 `call["argv"]` 에서 `-K -` · `-D -` 쌍과 URL 이 마지막 인자인 것과 `-A` 존재를 직접 단언한다.

- **[WARNING]** `Nerv.__init__` 의 http 루프백 예외가 무테스트이고 접두 비교라 경계가 열려 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:306`, `.claude/tests/test_nerv_mirror_pull.py:557-559`(`test_plain_http_is_rejected`)
  - 상세: `server.startswith(("http://127.0.0.1", "http://localhost"))` 는 호스트 경계를 보지 않는다. 프로브 실측으로 `http://localhost.evil.invalid` · `http://127.0.0.1.evil.invalid` · `http://localhost@evil.invalid` 가 ACCEPT 됐다. 이 주소들은 Bearer 토큰을 평문으로 공격자 호스트에 보낸다. `NERV_SERVER` 는 운영자의 로컬 설정이라 악용 가능성은 낮고 본 결함은 security 리뷰어 영역이지만, 테스트 관점에서는 루프백 예외 자체가 한 번도 실행되지 않는다(분기 제거 뮤턴트 SURVIVED). "루프백은 허용, 그 접두로 시작하는 다른 호스트는 거부"라는 경계 테스트가 있었다면 잡혔다.
  - 제안: `urllib.parse.urlsplit(server).hostname in {"127.0.0.1", "localhost"}` 로 바꾸고 테스트를 더한다. 허용은 `http://127.0.0.1:8080`, `http://localhost:3000`, 거부는 위 세 주소와 `http://nerv.example.invalid` 다.

- **[WARNING]** `--task` 의 오류 응답 · 손상된 etag 복구 경로가 무테스트다 (라운드 1 경고 2 · INFO 11 · INFO 17 의 고침이 고정되지 않음)
  - 위치: `.claude/tools/nerv-mirror/pull.py:441-442`(etag 형식 검사 후 `etag = None`), `:446-449`(md 응답 `status != 200`), `.claude/tests/test_nerv_mirror_pull.py:348-372`(`FakeNerv`), `:483-490`(`test_corrupt_mirror_file_is_refetched`)
  - 상세: 두 뮤턴트가 SURVIVED 다. (1) md 응답 non-200 가드를 무력화한 뮤턴트에서, 404 본문이 그대로 `Doc(raw=…)` 로 들어간다. 진짜 `Nerv.get_ok` 는 tree · tasks 에서만 non-200 을 PullError 로 바꾸므로 md 경로는 이 가드가 유일하다. `FakeNerv.get` 은 200/304 만 돌려주고 `get_ok` 는 `assert status == 200` 이라 오류 상태를 만들 수 없다. 그래서 tree · tasks · md 의 오류 분기 전부가 테스트로 닿을 수 없는 구조다. (2) 라운드 1 경고 2(미러 frontmatter 의 `etag` 가 curl 설정 줄로 주입)의 고침은 `Nerv.get` 쪽 ETAG_RE 와 `cmd_task` 쪽 복구 두 겹이다. 앞쪽은 `test_config_injection_values_are_rejected` 가 고정하지만 `cmd_task` 쪽 복구(저장된 etag 가 형식이 아니면 새로 받아 덮는다)는 그 줄을 지워도 전 테스트가 통과한다. 지우면 "미러 파일이 손상됐다" 로 실행이 멈춰 복구 대신 중단이 된다. `test_corrupt_mirror_file_is_refetched` 는 frontmatter 가 아예 없는 경우(ValueError 경로)만 다룬다.
  - 제안: `FakeNerv` 에 경로별 상태 재정의(`statuses={…: 404}`)를 넣어 md 404 → SystemExit + 미러·캐시 미변경, tree 500 → SystemExit 를 고정한다. 그리고 frontmatter 는 유효하지만 `etag: "x\"\nurl = \"https://evil\""` 나 `etag: 5` 인 미러 파일로 `--task` 를 돌려 "조건부 요청 없이 받아 덮고 `check` 통과"를 단언한다.

- **[WARNING]** 미러 판정 동치 테스트가 TS 쪽 정규식만 고친 PR 에서는 CI 에서 돌지 않는다
  - 위치: `.github/workflows/harness-checks.yml:74-76`(이번에 더한 `.claude/settings.json` 항목 옆 pathspec 목록), `.claude/tests/test_nerv_mirror_pull.py:585-619`(`MirrorPredicateParityTest`)
  - 상세: 이 테스트의 목적은 세 판정(도구 · 오케스트레이터 · `spec-links.ts`)이 갈라지면 각 스위트가 초록인 채로 지나가는 것을 막는 것이다. 그런데 `harness-checks.yml` 의 `pathspecs` 에는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 없다. 그래서 `NERV_MIRROR` 리터럴만 고치는 PR 은 harness-checks 가 no-op 으로 통과하고 동치 테스트는 안 돈다(도구 쪽은 `.claude/tools/**`, 오케스트레이터 쪽은 `.claude/skills/**` 가 이미 목록에 있다). 세 면 중 하나만 트리거가 없다. `test_harness_checks_paths_coverage.py` 는 `PRODUCT_PREFIXES`(`codebase/` · `spec/`)를 요구 대상에서 일부러 빼므로 이 공백을 잡아 주지 않는다(실행하면 통과한다). 이 저장소가 "가드가 있는데 안 도는" 같은 종류를 여섯 번 겪었다고 그 파일 머리에 적혀 있다. 명시 등재 선례도 있다(`codebase/frontend/tsconfig.typecheck.json`, `codebase/packages/*/package.json`). 덧붙여 `assertGreater(len(tool), 100)` 는 지금의 169편에 묶인 하한이라 미러 규모가 바뀌면 무관하게 빨개진다(INFO 수준).
  - 제안: pathspec 에 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 한 줄과 "MirrorPredicateParityTest 가 이 파일의 `NERV_MIRROR` 리터럴을 읽는다" 주석을 더한다.

- **[INFO]** `_curl_value` 가 거르는 문자 중 테스트가 보는 것은 일부다
  - 위치: `.claude/tools/nerv-mirror/pull.py:298-301`, `.claude/tests/test_nerv_mirror_pull.py:549-555`
  - 상세: 코드는 따옴표 · 역슬래시 · CR · LF · 제어 문자(`ord < 0x20`)를 거른다. 테스트는 `"` + `\n` 조합 한 입력만 쓴다. 역슬래시를 집합에서 뺀 뮤턴트가 SURVIVED 다. curl 설정 파일에서 `\"` 는 따옴표 이스케이프라 역슬래시는 주입에 의미가 있는 문자다. README 의 "a malformed ETag or token never reaches the config" 는 이 범위를 넘게 읽힌다.
  - 제안: 문자별 `subTest`(`"`, `\`, `\r`, `\n`, `\t`)로 넓힌다. 같은 자리에서 `MAX_PRUNE_RATIO` 의 `>` 경계(정확히 절반)도 고정하면 좋지만 가치는 낮다(`>=` 뮤턴트 SURVIVED).

- **[INFO]** 프록시 CONNECT 응답 건너뛰기가 무테스트다
  - 위치: `.claude/tools/nerv-mirror/pull.py:339`, `.claude/tests/test_nerv_mirror_pull.py:561-563`
  - 상세: docstring 은 "1xx · 프록시 CONNECT 블록은 건너뛴다"고 하지만 테스트는 1xx 만 본다. `or b"established" in head.lower()` 절을 지운 뮤턴트가 SURVIVED 다. 프로브에서 `HTTP/1.1 200 Connection established` 블록은 정상 건너뛰어졌다(동작은 맞다).
  - 제안: `b"HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 200\r\n\r\nbody"` → `(200, b"body")` 케이스를 더한다. 반대로 200 블록 뒤가 `HTTP/` 로 시작하는 본문인 경우(`established` 없음)는 첫 블록을 돌려준다는 것도 함께 고정한다.

- **[INFO]** `--all` 의 네트워크 경로는 구조상 테스트할 수 없다 (테스트 용이성)
  - 위치: `.claude/tools/nerv-mirror/pull.py:388-400`(`cmd_all`), `.claude/tools/nerv-mirror/pull.py:345-351`(`load_env`)
  - 상세: `cmd_task` 는 `nerv` 인자를 받아 주입할 수 있지만 `cmd_all` 은 안에서 `load_env()` 를 부른다. 첫 미러 169편을 만든 경로(`export.zip?basis=…&layout=tree`, 이진 본문이 `parse_response` 를 지나는 것, `--basis` 전달, non-200, `NERV_SERVER`/`NERV_TOKEN` 누락 오류)가 전부 수동 확인뿐이다. 테스트는 `--from-zip` 로만 돈다.
  - 제안: `cmd_all(…, nerv=None)` 로 주입 가능하게 하고 `FakeNerv.get_ok` 가 `make_zip()` 을 돌려주게 해 경로 문자열에 `basis=latest&layout=tree` 가 실리는지, `load_env` 누락 시 SystemExit 인지 고정한다.

- **[INFO]** `tree-walk.test.ts` 는 미러 제외를 합성 트리로 겨누지 않고 주석만 더했다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts:156-157`, `:164-168`
  - 상세: 이 파일의 머리말이 "실저장소 데이터로만 지나가던 필터를 합성 트리에 일부러 걸릴 것을 심어 겨눈다"를 존재 이유로 적는다. 이번 변경은 그 표 아래에 미러가 제외된다는 주석만 넣었다. 미러 제외의 양성 검증은 `spec-link-integrity.test.ts` 의 실저장소 테스트 하나뿐이고, 그 테스트는 커밋된 미러가 있어야 비공허하다(최상위 `spec/CLE-*.md` 존재를 단언해 공허함은 막았다). 미러가 나중에 줄거나 옮겨지면 이 파일의 원칙(저장소 데이터에 의존하지 않기)에서 빠진다.
  - 제안: 합성 트리에 `spec/CLE-X.md` · `spec/CLE-ACCT/CLE-ACCT.md` · `spec/README.md` 를 심고 `collectSpecMarkdown` 기대값을 `["spec/real.md"]` 로 그대로 둔다.

- **[INFO]** `--check` 의 문서화된 비보장 범위를 고정하는 테스트가 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:35-37`(docstring), `.claude/tests/test_nerv_mirror_pull.py:302-345`(`CheckTest`)
  - 상세: docstring 과 CHANGELOG · CI 주석은 "미러 파일의 추가 · 삭제, 옛 트리 셸 편집, `spec/README.md` 는 보지 않는다"고 쓴다. 이 한계는 어떤 테스트로도 묶이지 않아서 나중에 동작이 바뀌어도(또는 문서가 낡아도) 서로 어긋나는 것을 알아챌 길이 없다. 라운드 1 권장 조치 3 의 "한계를 고정하는 테스트"가 들어오지 않았다. 다만 한계를 테스트로 굳히면 강화가 RED 가 되므로 이름에 "한계" 임을 적는 전제다.
  - 제안: 미러 한 편 삭제와 지문을 맞춘 가짜 `CLE-FAKE.md` 추가에서 `check()` 가 `[]` 인 것을 단언하는 테스트를 이름에 `limitation` 을 붙여 더하거나, 더하지 않을 거면 문서 문구를 "현재 동작" 으로 낮춘다.

## 요약

회귀는 깨끗하다. `.claude/tests` 1274건, 신규 두 모듈의 `unittest discover` 실행, frontend docs 가드 3711건이 모두 통과한다. 라운드 1 테스트 경고 중 훅의 `..` 정규화 · 대소문자 · 심볼릭 링크 · 다른 저장소 통과, 오케스트레이터 제외와 미러 존재 사전 단언, 미러 판정 세 곳 동치, `CLE-MKS` · CRLF · 머리 5줄 창 · 트리 순환 · zip 이름 · 빈 export 는 실제로 닫혔고 이번 뮤턴트 중 해당 칸은 전부 KILLED 였다. 남은 공백은 같은 모양으로 모여 있다. 라운드 1 이 고친 "입력 검증 · 오류 경로"의 바깥쪽 절반이다. 첫째, 가짜 curl 과 `FakeNerv` 가 너무 관대해서 curl 인자(`-K -` · `-D -`)와 오류 응답(404/500)을 모델링하지 못한다. 둘째, 훅의 fail-open `except`, http 루프백 경계, `cmd_task` 의 etag 복구가 미고정이다. 이 중 훅 fail-open 은 이 PR 이 겪은 사고의 계약 자체이고 루프백 경계는 테스트를 썼다면 드러났을 실결함(토큰 평문 전송 가능 호스트)이다. 동치 테스트는 TS 쪽 수정에서 CI 가 안 돌아 본래 목적이 한 면 비어 있다. Critical 은 없다.

## 위험도
MEDIUM
