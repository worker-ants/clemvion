# 부작용(Side Effect) 리뷰 — NERV 스펙 미러 도입 (전환 1, 라운드 2)

### 발견사항

- **[WARNING]** 훅은 머지 즉시 `spec/` 쓰기를 막는데, 그 쓰기를 안내하는 거버넌스 문서를 고치는 짝 PR 이 아직 머지되지 않았다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-20` (docstring), `.claude/settings.json:36-39` (배선)
  - 상세: 라운드 1 W2(훅이 문서가 시키는 일을 막는다)는 코드 범위에서는 닫을 수 없는 항목이고 지금도 열려 있다. 짝 PR 은 브랜치 `claude/nerv-cutover-1-docs-c46df0`(커밋 `0c3d549ed`)에 있고, `git merge-base --is-ancestor` 로 로컬 `origin/main` 에 들어 있지 않음을 확인했다(원격 최신은 확인하지 못했다). 이 PR 이 먼저 머지되면 그 순간부터 project-planner 의 `spec/` 쓰기, developer 의 자기-반증형 소정정, `consistency-check --spec` 전제가 모두 훅에 막힌다. 훅 docstring 이 스스로 세운 규칙("먼저 막으면 문서가 시키는 일을 훅이 막는다")과도 어긋난다. 짝 PR 은 `worktree-policy.md` 는 고치지 않으므로 Enforcement 목록에 이 훅이 없다는 라운드 1 지적도 남는다.
  - 제안: PR 본문에 "짝 planner PR 을 먼저 머지" 를 머지 순서 조건으로 적는다. 훅 배선 커밋만 짝 PR 뒤로 미루는 방법도 있다.

- **[WARNING]** `NERV_SERVER` 의 평문 http 허용 목록이 접두 비교라서 외부 호스트가 통과한다 (라운드 1 보안 수정이 완전히 닫히지 않음)
  - 위치: `.claude/tools/nerv-mirror/pull.py:306` (`Nerv.__init__`)
  - 상세: `server.startswith(("http://127.0.0.1", "http://localhost"))` 를 그대로 돌려 실측했다. `http://127.0.0.1@evil.example`(호스트는 evil.example), `http://localhost.evil.example`, `http://127.0.0.1.evil.example`, `http://localhostevil.example` 가 모두 ACCEPTED 였고 `http://nerv.example` 만 거부됐다. 통과하면 `Authorization: Bearer <토큰>` 이 평문으로 그 호스트에 나간다. docstring 과 테스트(`test_plain_http_is_rejected`)는 "평문 http 는 거부" 만 고정하고 이 우회는 보지 않는다. `NERV_SERVER` 는 사용자의 `settings.local.json` env 가 주는 값이라 악용 가능성은 낮다. 그래도 "토큰이 평문으로 나가지 않는다" 는 문서화된 보장이 구현보다 넓다.
  - 제안: `urllib.parse.urlsplit(server).hostname in {"127.0.0.1", "localhost", "::1"}` 로 호스트를 비교하고 userinfo 가 있으면 거부한다. 위 네 URL 을 회귀 테스트로 추가한다.

- **[INFO]** `apply()` 는 문서를 하나씩 쓰다가 중간에 멈추면 부분 적용 상태로 남는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:197-207` (`write_if_changed`), `:223-225` (쓰기 루프)
  - 상세: 심볼릭 링크 · 경계 검사가 파일마다 쓰기 직전에 돈다. 스크래치 사본에서 `CLE-VISION.md` 를 링크로 바꿔 두고 `--all` 을 돌리자 키 순서상 앞선 `CLE-A/*` 두 편은 새로 쓰였고 `CLE-VISION.md` 에서 exit 했다. 링크 밖 파일은 만들어지지 않았다(`test_never_writes_through_a_symlink` 가 보는 부분은 지켜진다). 같은 원인을 고치고 다시 돌리면 결정적이라 수렴하므로 위험은 낮다.
  - 제안: 쓰기 전에 모든 대상 경로를 먼저 검사한다.

- **[INFO]** `apply()` 끝의 빈 디렉터리 정리가 "이 도구가 소유한 미러" 판정보다 넓다
  - 위치: `.claude/tools/nerv-mirror/pull.py:229-231`
  - 상세: `mirror_files` 는 `KEY_RE` 로 소유를 좁히는데 여기서는 `spec_root.glob("CLE-*")` 로 키 형식이 아닌 이름까지 훑는다. 실측: 빈 `spec/CLE-lower/` 는 삭제됐고, 빈 디렉터리를 가리키는 심볼릭 링크 `spec/CLE-ZZ` 는 `rmdir` 이 `NotADirectoryError` 로 터져 문서를 쓴 뒤 크래시(traceback)했다. 실제 저장소에서 나올 가능성은 낮다.
  - 제안: `KEY_RE.match(d.name) and not d.is_symlink()` 로 좁힌다.

- **[INFO]** `--root` 기본값이 cwd 가 아니라 스크립트 위치라서 main checkout 의 사본을 돌리면 main 의 `spec/` 에 쓴다
  - 위치: `.claude/tools/nerv-mirror/pull.py:508-509`
  - 상세: `Path(__file__).resolve().parents[3]` 이라 워크트리 세션이 `$CLAUDE_PROJECT_DIR/.claude/tools/nerv-mirror/pull.py` 같은 절대 경로로 부르면 기본 브랜치 체크아웃의 `spec/` 과 `.nerv/cache` 를 쓴다. 훅 안내 문구는 상대 경로(`python3 .claude/tools/nerv-mirror/pull.py`)라 정상 사용은 안전하다.
  - 제안: 필요하면 쓰기 전에 `--root` 가 `git rev-parse --show-toplevel`(cwd 기준)과 같은지 경고한다.

- **[INFO]** 훅은 `tool_input` 이 객체가 아니면 fail-open 하면서 traceback 을 stderr 에 남긴다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:61-70` (`_target`), `:115-121`
  - 상세: `tool_input` 이 문자열·리스트, `file_path` 가 숫자, 경로에 NUL 이 있는 경우를 실측하면 모두 exit 0(허용)에 traceback 이 출력된다. 하네스가 이런 페이로드를 보내지 않으므로 차단 회귀는 없다. 다만 "모양이 틀린 페이로드는 조용히 통과" 라는 설명과 `test_empty_or_broken_payload_fails_open` 의 `stderr == ""` 단언은 이 모양들을 덮지 않는다.
  - 제안: `_target` 에서 `isinstance(tool_input, dict)` 를 확인하거나 문서 문구를 "허용(traceback 가능)" 으로 고친다.

- **[INFO]** `--impl-prep` / `--impl-done` 의 대상 폴더가 미러이면 관련 코퍼스에는 같은 내용의 옛 트리만 남는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:743-756` (대상 수집, 미러 필터 없음), `:806-807` (코퍼스 필터)
  - 상세: 미러 제외는 `all_spec_files`(관련 코퍼스)에만 걸리고 대상 번들은 그대로라 `--impl-done spec/CLE-ACCT/` 는 동작한다. 그 대신 checker 는 같은 주제의 동결된 옛 `spec/<영역>/` 문서를 "관련 spec" 으로 받는다. 대상과 내용이 겹쳐 중복·충돌 지적이 나올 수 있다. 코퍼스를 미러로 옮기는 단계 4e 전까지의 과도기 동작이라 지금 결함은 아니다. 실제 checker 출력으로는 확인하지 않은 추론이다.
  - 제안: 단계 4e 전까지 checker 지침에 "대상이 미러면 옛 트리 중복은 동결 사본" 을 한 줄 적는다.

### 닫힘 확인 (라운드 1 대비)

- W1 훅이 다른 저장소까지 막음: `MARKER`(`pull.py`) 표지 판정으로 닫혔다. 표지 없는 별도 git 저장소 통과를 테스트가 고정하고 62개 중 해당 항목이 통과한다.
- W3 빈 export 전체 삭제: `docs_from_zip` 이 빈 목록을 거부하고, 50% 초과 삭제는 `--allow-mass-prune` 이 필요하며, `--check` 는 0편에서 실패한다. 스크래치에서 재현되지 않았다.
- INFO 링크 304 재렌더: `--task` 가 `.nerv/cache/mirror` 원문으로 다시 렌더한다. 이 캐시는 워크트리들이 공유하는 `.nerv` 아래에 있으나, 캐시 sha256 이 미러 etag 와 같을 때만 조건부 요청을 보내므로 다른 세션이 같은 키의 캐시를 덮어써도 잘못된 304 로 이어지지 않는다(`pull.py:436-444`).
- INFO 세 판정 복제: `MirrorPredicateParityTest` 가 실제 트리에서 세 판정의 집합 일치를 고정한다.
- INFO 대소문자 · 심볼릭 링크: `realpath` 와 `casefold` 로 닫혔다. `../spec`, `SPEC`, 심볼릭 링크 모두 exit 2 를 실측했다.

### 부작용 영역별 점검 결과

- 전역/공유 상태: 훅은 읽기 전용이고 `BYPASS_NERV_OWNED_PATHS` 만 읽는다. `pull.py` 는 `NERV_SERVER`/`NERV_TOKEN`/`NERV_PROJECT` 를 읽기만 하며 환경을 바꾸지 않는다. `review_guard._spec_code_patterns` 가 `spec/**` 를 훑지만 미러 frontmatter 에 `code:` 키가 없다(본문 코드펜스에만 2건).
- 파일시스템: 미러 쓰기는 `spec/CLE-*` 와 `spec/README.md`, 캐시는 gitignore 된 `.nerv/cache/mirror` 로 한정된다. 테스트는 모두 tempdir 과 `_harness.git_in`(GIT_CEILING 고정)을 쓴다. `CurlBoundaryTest` 가 바꾸는 `os.environ` 은 cleanup 에서 복원된다.
- 시그니처/인터페이스: `collectSpecMarkdown` 의 소비자는 `__tests__` 안 세 곳뿐이고, `inNervMirror` 는 추가 export 다. 오케스트레이터에는 함수 추가와 필터 한 줄뿐이다.
- 네트워크: 호출은 `curl` 로 `NERV_SERVER` 에만 나가며 redirect 를 따르지 않는다. 토큰은 stdin 설정에만 있고 argv 와 출력에 없다(테스트가 고정). 위 http 접두 비교 건만 예외다.
- CI: 새 잡 `spec-mirror-integrity` 는 네트워크와 토큰 없이 표준 라이브러리만 쓴다. `harness-checks.yml` 에 `.claude/settings.json` 을 넣은 것은 새 가드의 배선 테스트와 일치한다.

### 요약

코드 범위의 부작용은 대체로 잘 격리돼 있고 라운드 1 의 부작용 지적 세 건(다른 저장소 차단, 빈 export 전체 삭제, 304 링크)은 실측으로 닫힌 것을 확인했다. 남은 실질 항목은 둘이다. 하나는 훅과 거버넌스 문서의 머지 순서 의존(짝 PR 이 로컬 `origin/main` 에 없음)이고, 다른 하나는 라운드 1 수정이 만든 http 허용 목록의 접두 비교 우회(`http://127.0.0.1@evil.example` 등, 토큰이 평문으로 나갈 수 있음)다. 나머지는 부분 적용 · 빈 디렉터리 정리 · `--root` 기본값 · traceback 잡음 같은 낮은 위험의 정리 항목이다. 검증 프로브는 모두 저장소 밖 scratchpad 에서 돌렸고 작업 트리는 건드리지 않았다(`git status` 는 리뷰 산출물 외 변경 없음).

### 위험도

LOW
