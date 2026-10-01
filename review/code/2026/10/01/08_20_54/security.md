# 보안(Security) 리뷰 — 전환 1, 라운드 3 (`ad8662bd5..8bc7e6df1`)

### 발견사항

- **[WARNING]** 워크플로 pathspec 테스트가 주석 때문에 `.claude/tools/**` · `.claude/skills/**` 두 항목에서 공허하다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:834-838` (`test_the_three_files_trigger_the_harness_workflow`), 원인 주석은 `.github/workflows/harness-checks.yml:79`
  - 상세: 테스트는 `wf["jobs"]["changes"]["with"]["pathspecs"].split()` 로 토큰을 만들고 `assertIn(".claude/tools/**", specs)` · `assertIn(".claude/skills/**", specs)` 를 본다. `pathspecs` 는 `|` 블록 스칼라라 `#` 주석 줄도 문자열에 들어간다. 이번 diff 가 더한 주석 "나머지 둘은 위 .claude/tools/** · .claude/skills/** 가 덮는다" 가 공백으로 나뉘면 두 토큰을 그대로 만든다. 실측(scratch 사본): 실제 pathspec 줄 두 개(`.claude/tools/**`, `.claude/skills/**`)를 지운 변이 사본에서도 두 단언이 모두 통과했고, 일치를 만든 것은 위 주석 줄이었다. 즉 누가 그 두 줄을 지워도 RED 가 나지 않는다. 지워지면 `pull.py` 나 오케스트레이터만 고친 PR 은 `MirrorPredicateParityTest` 를 돌리지 않는다. 세 번째 사본인 `spec-links.ts` 경로는 주석에 경로 문자열이 없어서 이 문제가 없다. 이 저장소가 여러 번 겪은 "게이트가 조용히 안 도는" 갭이고, 미러 판정 세 곳을 묶는 유일한 CI 고리라서 보안 관점에서도 가드 무결성 문제로 본다.
  - 제안: 토큰화 전에 주석 줄을 뺀다. 예: `lines = [ln.strip() for ln in raw.splitlines() if ln.strip() and not ln.strip().startswith("#")]`. 세 단언 모두 이 `lines` 집합에서 정확 일치로 본다. 고친 뒤 실제 줄을 지운 변이로 RED 를 확인한다.

- **[INFO]** `cmd_task` 가 키 형식 검증보다 먼저 트리에서 온 키로 캐시 경로를 읽는다 (이번 라운드 리팩터링이 만든 순서 역전)
  - 위치: `.claude/tools/nerv-mirror/pull.py:591-592` (`cached = _cached_raw(cache, key)` → 다음 줄의 `mirror_relpath(key, areas[key])`), 오류 출력은 `pull.py:587`
  - 상세: 이전 커밋(`ad8662bd5`)은 `existing = spec_root / mirror_relpath(key, area)` 로 키를 검증한 뒤 `_cached_raw` 를 불렀다. 지금은 `_cached_raw` 가 먼저이고 검증(`mirror_relpath`)은 `conditional_etag(...)` 의 인자를 평가할 때 일어난다. `areas` 의 키는 서버 트리 응답의 `node["key"]` 이고 `KEY_RE` 검사를 받지 않는다(`key in areas` 는 존재만 본다). 실측(scratch, 가짜 NERV 의 트리 키 `../victim`): 현재 코드는 `_cached_raw` 가 `<cache>/../victim.md` 를 실제로 읽었고(`b'OUTSIDE-SECRET'` 확인) 그다음 줄의 `mirror_relpath` 에서 `PullError` 로 멈췄다. 이전 코드는 `_cached_raw` 호출이 0회였다. 읽은 값은 검증 실패로 어디에도 쓰이거나 출력되지 않아 유출은 없고, 네트워크 요청과 쓰기도 그 뒤라 일어나지 않는다. 그래서 실제 피해는 없다. 다만 악의적 서버나 `--spec` 입력이 임의 `*.md` 읽기를 일으키는 경로가 다시 열렸고, 이 줄들은 "검증 뒤에 경로를 만든다" 는 이전 불변식을 깬다. `pull.py:587` 의 `NERV 에 없는 키 — {key}` 도 서버가 준 값을 `!r` 없이 출력해 제어 문자가 터미널에 닿는다.
  - 제안: `for key in keys:` 첫머리에서 `rel = mirror_relpath(key, areas[key])` 를 먼저 계산해 검증하고, 그 `rel` 을 `conditional_etag` 에 넘긴다. `_cached_raw` 안에서 `KEY_RE.fullmatch(key)` 를 한 번 더 보는 방어도 싸다. 오류 메시지의 `{key}` 는 `{key!r}`. `TaskModeTest` 에 "트리 키가 `../x` 이면 `_cached_raw` 가 불리지 않는다" 를 스파이로 고정하면 순서 역전이 다시 RED 가 된다.

- **[INFO]** 편집 가드가 입력으로 일으킬 수 있는 예외에서 fail-open 한다 (lone surrogate 경로)
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:86` (`os.path.realpath`) · `:132-136` (`except Exception` → exit 0). 입력 검사는 `:80`
  - 상세: 라운드 2 는 NUL 과 비문자열 경로를 "조용히 통과" 로 정리했다. 같은 부류로 lone surrogate 가 남아 있다. 하네스(Node)는 `JSON.stringify` 로 lone surrogate 를 `\ud800` 이스케이프로 내보내고, Python `json.loads` 는 그것을 lone surrogate 문자열로 읽는다. `os.path.realpath` 는 `os.lstat` 에서 `UnicodeEncodeError` 를 낸다(surrogateescape 범위 `\udc80-\udcff` 밖). 그러면 `main()` 이 예외로 끝나 `except Exception` 이 exit 0 으로 통과시킨다. 실측(python3 와 python3.11 모두): `<repo>/spec/CLE-VISION.md` 는 exit 2, `<repo>/spec/\ud800/CLE-X.md` 와 `<repo>/spec/CLE-X\udfff.md` 는 exit 0 과 traceback, `\udc80` 은 exit 2. 같은 경로를 Node `fs.writeFileSync` 로 쓰면 U+FFFD(`efbfbd`)로 바뀐 이름으로 성공한다(실측). 하네스의 Write 도구가 같은 경로로 쓰는지는 도구 내부를 볼 수 없어 확인하지 못했다. Node 기반 도구라면 같은 결과일 것으로 추정한다. 실제 피해는 작다. 이름에 U+FFFD 가 들어가므로 기존 미러 파일을 덮을 수는 없고, `spec/` 아래에 이상한 이름의 새 항목을 만드는 데 그친다. 그 항목이 `spec/CLE-*` 자리(예: `spec/CLE-X\ufffd.md`)면 `--check` 의 `stray_entries` 가 잡고, 옛 트리 자리(예: `spec/\ufffd/…`)면 어느 층도 잡지 않는다. 이 훅은 사고 방지용이고 적대적 에이전트를 막는 용도가 아니라서 INFO 로 둔다. 다만 "예외가 fail-open" 이라는 설계 때문에 입력 모양 하나하나가 우회 경로가 되는 구조이고, 테스트 `test_malformed_payloads_pass_quietly` 의 목록에 이 경우가 없다.
  - 제안: `_target` 에서 `value = value.encode("utf-8", "replace").decode("utf-8")` 로 Node 가 쓰는 이름과 같게 정규화한 뒤 `realpath` 를 부른다. 그러면 위 두 경로가 `spec/` 로 판정돼 exit 2 가 난다. 더해서 `realpath` 를 `try/except (ValueError, OSError)` 로 감싸 실패하면 `os.path.abspath` 로 대체한다. 테스트 목록에 `"\ud800"` 이 든 경로(차단돼야 한다)를 더한다.

- **[INFO]** `--check` 출력이 저장소가 정하는 파일 이름을 그대로 찍어 CI 로그에 워크플로 명령을 끼울 수 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:501-502` (`stray_entries` 를 문제 줄로 만드는 곳) · `:667` (`print(f"spec-mirror-integrity: {p}")`)
  - 상세: 이번 라운드가 더한 `stray_entries` 는 미러 폴더 안의 임의 이름을 문제 줄에 넣는다. git 은 이름에 개행을 허용한다. 실측(scratch): `spec/CLE-ACCT/` 에 이름이 `x\n::error::spoofed annotation\n::stop-commands::tok` 인 파일을 두면 stdout 에 `::error::...` 와 `::stop-commands::tok: ...` 가 줄 머리부터 나온다. GitHub Actions 는 그런 줄을 워크플로 명령으로 해석하므로 가짜 주석을 만들거나 이후 출력의 명령 처리를 멈출 수 있다. 종료 코드는 그대로 1 이라 통과/실패 판정은 바뀌지 않는다. 영향은 로그 위조에 한정된다. PR 작성자가 이미 파일 내용을 마음대로 쓸 수 있어 위험은 낮다.
  - 제안: 문제 줄을 만들 때 경로를 이스케이프한다. 예: `json.dumps(rel, ensure_ascii=False)` 나 `rel.encode("unicode_escape").decode()`. 줄 머리 접두(`spec-mirror-integrity: `)는 이미 붙어 있으므로 개행만 막으면 `::` 해석이 사라진다.

- **[INFO]** 워크플로 헤더 주석이 `--check` 의 보장을 실제보다 좁게 적는다
  - 위치: `.github/workflows/spec-link-checks.yml:128-129` (이번 diff 가 바꾸지 않은 문맥 줄)
  - 상세: "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 라고 적혀 있지만, 이번 라운드부터 `--check` 는 지문 없는 미러 파일 추가와 미러 자리의 다른 파일 · 심볼릭 링크를 잡는다(`pull.py` 독스트링, CHANGELOG, `CLE-ENG-SPECEVIDENCE` 는 이미 갱신). 보장을 좁게 적은 쪽이라 해롭지는 않지만, 같은 사실을 세 곳이 다르게 말한다.
  - 제안: 주석을 "미러 파일의 삭제와 …" 로 맞춘다.

### 검토했으나 문제 없음 (라운드 2 지적이 닫혔는지 포함)

- **export.zip**: 이름 검사는 `parts[0] == "specs"`, 깊이 2~3, `KEY_RE.fullmatch` 를 파일 시스템 접근 전에 거친다. zip-slip 경로(`..`, 절대 경로, 역슬래시)는 모두 건너뛰거나 거부한다. 크기 상한은 선언 크기(`info.file_size`)로 거는데 `ZipExtFile` 이 읽기를 선언 크기에서 자르므로 헤더를 속여도 메모리가 폭증하지 않는다(상한 4MB/64MB).
- **정규식**: 키 · Task · ETag · 프로젝트 형식이 모두 `fullmatch` 라 끝 개행 우회(`CLE-X\n`)가 닫혔다. `MIRROR_LINK_RE` · `SOURCE_LINE_RE` 는 `[^()\s#]` 와 줄 단위 `.match` 라 입력 길이에 선형이다.
- **curl 경계**: 토큰은 `-K -` stdin 설정에만 있고 argv · 예외 메시지 · 출력 어디에도 없다. 설정 줄에 들어가는 값은 따옴표 · 역슬래시 · 제어 문자를 거부하고 ETag 는 `fullmatch` 다. `-L` 이 없어 리다이렉트는 따라가지 않고 3xx 는 `응답 N` 오류가 된다. `server_ok` 는 사용자 정보 · 쿼리 · 프래그먼트와 `localhost.evil`, `127.0.0.1@evil` 류를 거부한다. `urlsplit` 이 `\t\r\n` 을 지우고 판정해서 `http://local\nhost` 는 `server_ok` 가 True 지만(실측) 실제 curl 8.7.1 은 그 URL 을 `URL rejected: Malformed input` 으로 거부하므로 fail-closed 다. 선택 하드닝으로 `server != server.strip()` 이나 제어 문자를 `Nerv.__init__` 에서 거부하고 curl 에 `-q` 를 줘 `~/.curlrc` 를 무시하게 할 수 있다.
- **심볼릭 링크**: 쓰기 전 전 대상 사전 검사(`_write_target`), 링크 폴더를 따라가지 않는 `_mirror_entries`, prune 이 `mirror_files` 만 지우는 구조, 빈 폴더 `rmdir` 의 `KEY_RE`+비링크 조건이 일관된다. 라운드 2 의 디렉터리 링크 prune 재현은 닫혔다.
- **`--check` 우회 표면**: `stray_entries` 가 TS `inNervMirror` 와 오케스트레이터 `_NERV_MIRROR_REL` 의 접두 일치(`CLE-*` 뒤 임의 접미, 하위 폴더)를 보완한다. `fingerprint` 는 frontmatter 의 첫 줄 하나만 빼므로 본문의 `mirror_sha256:` 줄이나 두 번째 줄 삽입은 해시를 바꾼다. 실제 저장소에서 `--check` 는 `미러 169편 · 문제 0` 이다(scratch 사본으로 읽기 전용 실행).
- **시크릿**: 변경 파일에 하드코딩된 자격 증명은 없다. 테스트의 `SECRET` 은 명백한 가짜 값이다. 의존성은 표준 라이브러리뿐이고 새 패키지가 없다.
- **CI**: `permissions: contents: read`, `pull_request` 트리거(시크릿 없음)이며 sparse-checkout 은 `spec` 과 도구 하나만 받는다. 이 잡이 PR 이 넣은 `pull.py` 로 돈다는 한계는 워크플로 · 독스트링에 이미 적혀 있다. 지문이 변조 방지가 아니라는 한계도 `test_limitation_*` 로 고정돼 있다.

### 요약

이번 범위의 입력 경계(zip · 키 · curl 설정 · 서버 주소 · 심볼릭 링크)는 라운드 2 지적이 실제로 닫혔고 새 Critical 은 없다. 남은 것은 세 갈래다. 첫째 이번 diff 의 주석이 만든 테스트 공허(WARNING)로, 미러 판정 세 곳을 묶는 CI 트리거가 실제 줄을 지워도 RED 가 나지 않는다. 둘째 `cmd_task` 리팩터링이 키 검증 앞에 캐시 읽기를 끼운 순서 역전으로, 유출은 없지만 이전 불변식을 깼다. 셋째 훅의 fail-open 이 lone surrogate 같은 입력으로 트리거되는 문제와 `--check` 출력의 로그 명령 주입으로, 둘 다 영향이 작다. 경로 이탈, 시크릿 노출, 인증 우회에 해당하는 취약점은 확인하지 못했다.

### 위험도
LOW

### 작업 기록
- 저장소 트리에는 아무것도 쓰지 않았다. 모든 실험은 `/private/tmp/claude-501/-Volumes-project-private-clemvion/52477887-e230-4159-906d-cdf4c5878063/scratchpad/review-scratch-r3/security/` 아래 사본에서 했다(`surrogate_probe.py`, `cache_order_probe.py`, `pathspec_probe.py`, `server_probe.py`, `logspoof_probe.py`). 종료 후 `git status --short` 는 시작 때와 같다(`review/` 미추적 폴더 3개뿐). 원복할 변이는 없었다.
