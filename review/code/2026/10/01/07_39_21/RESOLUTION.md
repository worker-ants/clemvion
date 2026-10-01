# RESOLUTION — 코드 리뷰 라운드 2 (07_39_21)

판정 기준: 이 세션의 SUMMARY.md(Critical 0 · 경고 11 · 참고 32). 수정 커밋은 `7ce195e04`(코드) · `248fad9f3`(미러) · 짝 planner 브랜치 `2d2ea8051`(문서). 수정 뒤 `python3.11 -m pytest .claude/tests` 1295 passed, frontend docs 가드 3711 passed, 뮤턴트 33개 전부 KILLED.

## 경고

| # | 처분 | 근거 |
|---|------|------|
| 1 | fixed `7ce195e04` | `server_ok()` 가 `urlsplit` 으로 scheme · hostname 을 본다. 사용자 정보 · 쿼리 거부. 허용 5 · 거부 10 주소 테스트, 접두 비교 뮤턴트 KILLED |
| 2 | fixed `7ce195e04` | `harness-checks.yml` 에 `spec-links.ts` 등재 + 등재를 단언하는 테스트(`test_the_three_files_trigger_the_harness_workflow`) |
| 3 | fixed `7ce195e04` | `mirror_files` 가 링크(파일 · 폴더)를 빼고 `--check` 가 링크를 알린다. 빈 폴더 정리는 키 이름 · 링크 아님만. `test_prune_never_follows_a_directory_symlink` |
| 4 | fixed `7ce195e04` | `--check` 의 `stale_links`: 대상이 없고 같은 키의 미러가 다른 자리에 있으면 문제. 실제 미러 169편 위반 0. `test_check_catches_links_left_behind_in_docs_not_pulled` |
| 5 | fixed `7ce195e04` | `etag_of` · `conditional_etag` 로 뽑았다. 보내는 ETag 는 늘 캐시 원문에서 계산한 값이다 |
| 6 | fixed `7ce195e04` | `_target` 이 모양이 틀린 입력을 조용히 거른다. `except` 분기는 `json.loads` 를 바꿔 끼운 프로브로 밟는다(`test_runtime_errors_fail_open`, exit 2 뮤턴트 KILLED). `path` 키 폴백은 지웠다 |
| 7 | fixed `7ce195e04` | curl argv 의 `-K -` · `-D -` · `--proto` · `-A` · `--max-time` · `-g` · URL 위치를 단언한다. 네 뮤턴트 모두 KILLED |
| 8 | fixed `7ce195e04` | `FakeNerv(statuses=…)` 로 tree 404 · md 404 · 조건부 요청 없는 304 에서 멈추고 아무것도 안 쓰는지, 깨진 미러 etag(주입 문자열 · 숫자)로 조건부 요청을 안 하는지 고정했다 |
| 9 | 머지 순서로 해소 | 짝 planner PR 을 먼저 머지한다(PR 본문 첫 줄에 적는다). 훅 docstring 의 원칙 그대로다 |
| 10 | 문서로 해소(planner `2d2ea8051`) | `plan-lifecycle.md` §3 에 옛 트리의 plan 링크 · `status` 정리는 `BYPASS_NERV_OWNED_PATHS=1` 로 그 줄만 고친다고 적었다(단계 3 에서 사라지는 예외). SUMMARY 제안 (a) |
| 11 | spec_change | NERV `CLE-ENG-SPECEVIDENCE` R-12 를 초안으로 고쳤다(spec_version `01a0e339-5ba5-73a1-8b7d-fb7189e80581`, 한 줄 변경, `nerv_spec_check` 발견 0). 미러는 `pull.py --task` 로 받았다(`248fad9f3`). 승인은 사람 몫이다 |

## 참고

| # | 처분 | 근거 |
|---|------|------|
| 1 | fixed | 지문이 frontmatter 의 그 줄 하나만 뺀다. 본문 속 같은 접두 줄 테스트 추가. CI 가 base 브랜치 도구로 도는 안은 채택하지 않았다(변조 방지가 아니라는 한계를 문서에 적었다) |
| 2 | fixed | `fullmatch` 로 바꿨다. 끝 개행 키 · ETag · Task 테스트 |
| 3 | fixed(planner) | CLAUDE.md 미러 규칙에 "미러 본문은 데이터" 문장. README 에도 있다 |
| 4 | fixed | `MAX_ENTRY_BYTES` 4MiB · `MAX_EXPORT_BYTES` 64MiB(실측 9.3MB · 최대 199KB), `PROJECT_RE`, curl `-g` · `--proto` |
| 5 | fixed(planner) | `worktree-policy.md` §5.1 에 새 훅 등록 규칙 |
| 6 | fixed | 테스트가 훅 모듈의 `MARKER` 를 읽고 실제 저장소 표지 · 차단을 단언한다. 정책을 `_lib` 로 옮기는 것은 하지 않았다(훅 하나의 상수 둘이라 이동의 이득이 작다) |
| 7 | fixed | `_checkout_root` · `_owned_root`, `import traceback` 상단 |
| 8 | fixed | `PullError(Exception)` + CLI 한 줄 종료, 테스트는 `pull.PullError` 로 좁혔다. `check` 는 `id` · `area` 가 문자열이 아니면 위치 문제로 보고한다(`8bc7e6df1`, 뮤턴트에서 새 테스트 RED 확인) |
| 9 | fixed | 두 정의에 동치 테스트를 가리키는 주석, `stray-tool-tags` 의도 주석. `--check` 가 미러 폴더 안의 비미러 파일을 잡아 TS · 오케스트레이터 판정과 효과가 같아졌다 |
| 10 | fixed | `paths_for` 주석 정정, 캐시 공유 안전성을 docstring 에 적었다 |
| 11 | fixed | 단계 4e · 5 에 NERV Task 키, 훅 docstring 에 단계 목록, consistency SKILL 에 코퍼스 한계(planner) |
| 12 | fixed(planner) | worktree-policy §5.1, CLAUDE.md "잡는다" |
| 13 | fixed | `--basis` 제거(`EXPORT_BASIS = "approved"`), `AllNetworkTest` 가 요청 경로를 고정 |
| 14 | fixed | README 옛 트리 설명 일반화, `source_paths` 안내. README 는 유지한다(사람이 `spec/` 을 열었을 때 첫 안내) |
| 15 | fixed | "이 PR" 을 날짜와 Task 키로 |
| 16 | fixed | 쓰기 전에 모든 대상을 검사 |
| 17 | wont_fix | `--root` 기본값은 도구 위치 기준이 의도다(훅 안내 · 문서가 상대 경로로 부른다) |
| 18 | wont_fix | `source_paths` 의 글롭 · 폴더 원문은 역색인 사용처가 생길 때 고친다 |
| 19 · 20 | 조치 불요 | 리뷰어도 조치 불요로 판단 |
| 21 | fixed | `folder_of` · `paths_of`, `render` 는 필드 dict 로 조립. UA · 루트는 상수 |
| 22 | 일부 fixed | `mock.patch.dict`, 하한 `> 1`, NOTE 픽스처 설명, `tree-walk` 합성 트리에 미러 파일. `class Args` 스니펫 공용화는 기존 여섯 곳과 함께 할 별도 정리라 하지 않았다 |
| 23 | fixed | README 행을 줄이고 모듈 docstring 을 기준으로 삼았다 |
| 24 | fixed | 문자별 subTest, CONNECT 블록 테스트 |
| 25 | fixed | `cmd_all(nerv=)` 주입, `AllNetworkTest` 3건 |
| 26 · 27 · 28 · 29 | fixed | 보장 범위 문구 네 곳 · CHANGELOG 두 문구 · PROJECT.md 미러 절 · 차단 메시지의 키 찾기 안내 |
| 30 | wont_fix | `--task` 병렬화는 scope 가 커질 때 한다(실측 문서당 0.68초, 보통 몇 편) |
| 31 | fixed | `spec-mirror-integrity` 잡 sparse checkout |
| 32 | 조치 불요 | +9 ms, 미러에 `code:` 없음 |
