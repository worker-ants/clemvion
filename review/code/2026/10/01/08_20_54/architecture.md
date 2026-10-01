# 아키텍처(Architecture) 코드 리뷰: 라운드 3 (`ad8662bd5..8bc7e6df1`)

저장소 파일은 수정하지 않았다. 실험은 전부 scratchpad 사본에서 했다. `git status --short` 는 시작할 때와 같다. `output_file` 은 쓰지 않고 전문을 이 메시지에 싣는다(하네스가 보고서 파일 쓰기를 금지한다). 저장은 main 세션이 한다.

실측은 다음과 같다.
- `python3.11 -m pytest -p no:cacheprovider -q test_guard_nerv_owned_paths.py test_nerv_mirror_pull.py` 는 80 passed, 78 subtests passed 였다.
- 두 검사의 차이를 확인하려고 scratch 에서 헌 경로 16개를 넣고 `pull.check` 를 돌렸다.
- CLI 오류 경계는 scratch root 로 `pull.py` 를 돌려 봤다.
- `harness-checks.yml` 사본에서 줄을 지우는 뮤턴트를 돌렸다.

## 발견사항

- **[WARNING]** 새 워크플로 트리거 테스트 `test_the_three_files_trigger_the_harness_workflow` 의 단언 세 개 중 두 개가 공허하다. 이 변경이 더한 주석이 그 토큰을 대신 채운다.
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:829-838` (파싱은 `:834`), 원인 주석은 `.github/workflows/harness-checks.yml:79`
  - 상세: 테스트가 `pathspecs` 블록 스칼라를 `.split()` 으로 쪼갠다. 블록 스칼라 안의 `#` 주석도 본문이라 주석 단어가 그대로 원소가 된다. 이 PR 이 더한 주석(`harness-checks.yml:79`, "나머지 둘은 위 `.claude/tools/**` · `.claude/skills/**` 가 덮는다")에 두 토큰이 공백으로 구분되어 들어 있다. scratch 사본에서 실제 pathspec 줄을 지워 봤다.

    | 사본 | 테스트 방식(`split`) | 실제 원소 |
    | --- | --- | --- |
    | `.claude/tools/**` 줄 삭제 | `tools: True` (통과) | `tools: False` |
    | `.claude/skills/**` 줄 삭제 | `skills: True` (통과) | `skills: False` |

    둘 다 지웠는데도 단언이 통과한다. 저장소에는 이미 같은 일을 하는 SoT 가 있다. `test_required_check_skip_jobs.py::pathspecs_of`(`:109`)의 docstring 이 "substring 은 주석에 적힌 경로도 통과시킨다. 파싱해서 실제 원소로 본다" 고 적었고, `test_harness_checks_paths_coverage.py::parse_pathspecs_block`(`:143`)도 있다. 새 테스트가 그것을 쓰지 않고 파서를 새로 짰다. `spec-links.ts` 경로 단언(`:836`)만 실제 줄로만 성립한다.
  - 제안: `skip_jobs.pathspecs_of("harness-checks.yml")` 를 재사용한다. 그러면 `.split()` 과 `import yaml` 이 필요 없다. 단언을 두 자리(`.claude/tools/**` 줄 삭제, `.claude/skills/**` 줄 삭제)에서 RED 로 확인한다.

- **[WARNING]** 라운드 2 RESOLUTION 의 "`--check` 보장 범위 문구 네 곳 fixed"(#26~29)에 빠진 곳이 있다. CI 워크플로 주석이 구현과 반대로 적혀 있다.
  - 위치: `.github/workflows/spec-link-checks.yml:128-129`
  - 상세: 주석에 "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 라고 있다. 지금 `--check` 는 지문 없는 미러 파일 추가를 잡는다(`test_added_mirror_file_without_a_fingerprint_is_caught`). 미러 자리의 비미러 파일, 심볼릭 링크, 옛 자리를 가리키는 링크도 잡는다. 이 주석이 CI 잡의 보장 범위를 설명하는 유일한 자리다. 같은 문장이 다음 위치에 사본으로 있어서 이번에도 한 곳이 남았다.
    - `pull.py` docstring
    - 훅 docstring
    - `CHANGELOG.md`
    - `.claude/tests/README.md`
    - 테스트 docstring
    - `CLE-ENG-SPECEVIDENCE`
    - 이 워크플로 주석
  - 제안: 이 주석은 `pull.py` 모듈 docstring 의 "보장 범위"를 가리키게 줄인다. 새 사본을 만들지 않고, 범위가 바뀌면 그 한 곳만 고치게 한다.

- **[INFO]** CLI 오류 경계가 절반만 옮겨졌다. 오류 분류도 둘로 갈려 있다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:675-679` (`__main__`), `:435` · `:451` (`RuntimeError`), `:645` (`main`)
  - 상세: `PullError(SystemExit)` 를 `Exception` 으로 바꾼 것은 옳다. 그런데 `main()` 이 도메인 오류에는 `PullError` 를 그대로 던지고, 한 줄 종료는 `__main__` 블록이 맡는다. `pull.main()` 이 "CLI 전체"가 아니라서 `argparse` 는 `SystemExit(2)`, 성공과 `--check` 실패는 `int`, 오류는 예외라는 세 갈래다. 전송 계층 오류는 `PullError` 가 아니라 `RuntimeError`(`:435` curl 실패, `:451` 응답 해석 실패)다. `except (PullError, RuntimeError)` 는 표준 라이브러리의 `RuntimeError` 하위 클래스(`RecursionError` · `NotImplementedError`)까지 "pull: …" 한 줄로 삼킨다. 테스트 `test_cli_reports_errors_in_one_line` 이 고정한 "한 줄" 은 이 두 종류에만 해당한다. scratch 에서 돌려 보니 다음은 여전히 traceback 이다.
    - `--all --from-zip` 에 zip 이 아닌 파일: `zipfile.BadZipFile`
    - 없는 zip 경로: `FileNotFoundError`
    - `PATH` 에 curl 이 없을 때: `FileNotFoundError`

    종료 코드는 모두 1 이라 동작 결함은 아니다.
  - 제안: `class TransportError(PullError)` 를 두고 `RuntimeError` 두 곳을 바꾼다. try/except 는 `main()` 안으로 옮겨 `return 1` 로 끝낸다(`__main__` 은 `sys.exit(main())` 한 줄). 입력 파일 읽기 오류(`OSError` · `BadZipFile`)는 `PullError` 로 감싸는 경계를 한 곳(`cmd_all` 의 입력 읽기)에 둔다.

- **[INFO]** 「미러 경로」 판정 세 벌의 동치 테스트는 실제 트리의 집합만 본다. 안전 성질은 다른 곳에 있다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:259-280` (`stray_entries`, 점 이름 건너뜀은 `:271-272`), `.claude/tests/test_nerv_mirror_pull.py:808-827`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:202`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:257`
  - 상세: 도구는 파일 단위로 엄격하다(`KEY_RE.fullmatch`). 오케스트레이터와 TS 는 접두로 느슨하다(`CLE-[A-Z0-9-]+/` 아래는 전부 미러). 실제로 지켜야 할 것은 "느슨한 판정이 옛 트리 가드에서 빼는 모든 경로는 엄격한 쪽이 미러 파일이거나 `--check` 가 잡는다" 는 포함 관계다. 동치 테스트는 지금 트리에 있는 유효한 이름만 비교하므로 이 관계를 보지 않는다. scratch 에서 헌 경로 16개(`CLE-A-.md` · `CLE--A.md` · `CLE-X/notes.md` · `CLE-ENG/sub/CLE-Z.md` · `CLE-ENG/README.md` · `CLE-ENG/cle-x.md` 등)를 넣어 봤다. 느슨한 판정에서 빠지는데 `check` 가 조용한 경로는 하나였다.
    - `spec/CLE-ENG/.hidden.md`: 옛 가드에서는 빠지고(`CLE-ENG/` 접두) `stray_entries` 는 점 이름을 건너뛴다.

    `.DS_Store` 때문에 넣은 예외가 `.md` 까지 넓다. 영향은 작다(읽는 곳이 없다). 그러나 이 자리는 "어느 검사도 안 본다" 를 막으려고 만든 검사의 빈틈이다. 이번에 `> 1` 로 낮춘 공허성 하한(`:825`)도 같은 방향이다.
  - 제안: 점 이름은 `.md` 가 아닐 때만 건너뛴다. 합성 이름 코퍼스(경계 이름 20여 개)로 "느슨 ⊇ 엄격, 차이는 `check` 가 잡는다" 를 단언하는 테스트를 더한다. 정규식 원문 세 벌을 하나로 합치는 것은 언어가 갈려서 이득이 작다. 그러니 합의 지점은 테스트로 둔다.

- **[INFO]** 편집 대상 경로 추출이 세 훅에서 다른 키 집합을 쓴다. 이 훅만 `path` 를 버렸다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:73-86` (`_target`), 비교: `.claude/hooks/guard_default_branch_edit.py:50-57`, `.claude/hooks/lint_mermaid_posttooluse.py:72-74`
  - 상세: 라운드 2 에서 `path` 폴백을 지웠다. 다른 두 훅은 `file_path` · `path` · `notebook_path` 를 받는다. 하네스가 어떤 편집 도구에 `path` 를 쓰면 이 훅만 조용히 통과한다. 세 훅은 같은 페이로드를 읽는데 어느 쪽이 맞는지 적은 곳이 없다. 훅을 `_lib` 없이 독립으로 둔 것은 합리적이다. 그래도 사본이 갈라지는 자리다.
  - 제안: 이 훅의 `_target` docstring 에 "다른 두 훅과 키 집합이 다르다, 이유는 …" 를 한 줄 적는다. 또는 세 훅의 키 집합을 같은 테이블로 고정하는 테스트를 더한다.

- **[INFO]** 훅의 fail-open 이 exit 0 + stderr traceback 이라 런타임 오류가 보이지 않는다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:131-136`
  - 상세: `MARKER` 주석(`:51-52`)은 "조용히 꺼진다" 를 경계하는데, 같은 종류의 오류(예: `.git` 접근 권한 오류)는 경고 없이 훅을 끈다. `lint_mermaid_posttooluse.py` 가 같은 관례(명시적 fail-open)를 쓰므로 일관성은 있다. 다만 저장소에는 "조용히 통과시키지 않는다" 는 선례도 있다(`_lib/failopen_state.py`, `guard_review_before_push._report_fail_open`의 "never silence"). 그 경우는 review · plan 게이트용이라 PreToolUse 에 그대로 맞지 않을 수 있다. 독립 결함이 아니라 관찰 가능성의 선택이다.
  - 제안: 필요하면 기록 한 줄을 사용자가 볼 수 있는 경로로 낸다. 선택 사항이다.

- **[INFO]** 테스트 더블이 `Nerv` 구현을 빌려 쓴다. 클라이언트 경계가 타입으로 없다.
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:487-488` (`FakeNerv.get_ok` 가 `pull.Nerv.get_ok(self, path)` 호출), `.claude/tools/nerv-mirror/pull.py:531-532` · `:570-571` (`nerv: Nerv | None`)
  - 상세: 의존성 주입 이음매(`cmd_all(nerv=…)`, `cmd_task(nerv=…)`)는 좋다. 그런데 계약이 "`get` 과 `get_ok`" 라는 암묵적 덕 타이핑이다. 더블이 실제 클래스의 비공개 구현(`get_ok` 가 `self.get` 을 부른다)에 기댄다. `get_ok` 의 동작이 바뀌면 더블이 조용히 따라간다.
  - 제안: 작은 `Protocol`(`get`, `get_ok`)을 두거나 `get_ok` 를 모듈 함수 `ok_body(client, path)` 로 빼서 더블이 빌릴 필요를 없앤다.

- **[INFO]** 전환 단계와 NERV Task 키의 사본이 코드 주석과 생성물에 흩어졌다. `render_readme` 는 그 키를 산출물 템플릿에 넣는다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-21`, `.claude/tools/nerv-mirror/pull.py:9-11` · `:623-625` (`render_readme`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:254`, consistency 오케스트레이터 주석, `spec/README.md:15-17` (생성물)
  - 상세: `pull.py` docstring 이 "목록 전체는 훅 docstring 에 있다" 고 가리키는 것은 한 곳으로 모으려는 시도로 읽힌다. 그런데 정본은 NERV Task 이고, 키(`CLE-T-7M4C4X` 등)는 주석 일곱 곳과 커밋되는 README 템플릿에 들어갔다. README 는 `--all` 을 돌려야 갱신된다. 단계 4g 가 주석 래칫이라면 이 자리들이 그 대상일 것이다.
  - 제안: 템플릿에서 Task 키를 빼고 "전환 단계 5" 만 남긴다. 코드 주석은 지금처럼 키를 적되, 단계 목록은 훅 docstring 한 곳만 두는 규칙을 유지한다.

- **[INFO]** `PROJECT.md` 에 새 절을 끼워서 앞 절의 꼬리 인용문이 잘못된 절 밑에 붙었다.
  - 위치: `PROJECT.md:402-419` (새 `### NERV 스펙 미러`), `PROJECT.md:421` (기존 "2026-08-27 변경" 인용문)
  - 상세: 그 인용문은 "종전의 `scripts/check-doc-links.py` 를 삭제하고 위 가드로 합쳤다" 는 `### 문서 링크 검증` 절의 꼬리다. 새 절이 그 사이에 들어가서 "위 가드" 가 미러 `--check` 로 읽힌다.
  - 제안: 새 절을 인용문 뒤(`### Playwright flaky surfacing` 앞)로 옮긴다.

## 요약

치명적 결함은 없다. 라운드 2 지적 중 구조에 해당하는 것은 실제로 닫혔다.
- `PullError` 가 `SystemExit` 에서 빠졌다.
- 입력 검증이 `fullmatch` 로 통일됐다.
- 쓰기 전 사전 검사, 심볼릭 링크 차단, `server_ok` 경계가 들어갔다.
- `OWNED_ROOTS` 가 데이터 주도라 단계 2 · 3 경로를 더하는 확장이 쉽다.

남은 것은 테스트와 문서 층의 응집도다.
- 새 트리거 테스트가 이 변경이 더한 주석 때문에 단언 둘이 공허하다. 기존 `pathspecs_of` 를 재사용해야 한다.
- `--check` 보장 범위를 설명하는 사본 한 곳이 구현과 반대로 남았다. RESOLUTION 의 "네 곳 fixed" 는 다섯째를 놓쳤다.
- 오류 경계와 미러 판정 동치 검증은 설계 의도를 절반만 고정한다. 동작 위험은 작다.

위험은 낮다. 위 두 WARNING 은 테스트 신뢰성과 문서 정확성 문제이고 실행 경로를 바꾸지 않는다.

### 위험도
LOW
