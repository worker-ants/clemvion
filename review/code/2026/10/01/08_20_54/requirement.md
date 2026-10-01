# 요구사항(Requirement) 리뷰 — 라운드 3

범위는 `ad8662bd5..8bc7e6df1` 이다. 라운드 2 수정 커밋(`7ce195e04`, `8bc7e6df1`)과 미러 갱신 커밋(`248fad9f3`)을 봤다. 기준은 Task `CLE-T-VA4YA1` 명세(프롬프트에 붙은 요약), 라운드 2 SUMMARY · RESOLUTION, 그리고 미러된 NERV 스펙 `CLE-ENG-SPECEVIDENCE` R-12 다.

## 검증한 것

- scratch 사본(`review-scratch-r3/requirement/full`)에서 `test_guard_nerv_owned_paths.py` · `test_nerv_mirror_pull.py` 를 돌렸다. 80 passed, 서브테스트 78 passed. 같은 사본에서 `test_consistency_bundle_priority.py` · `test_harness_checks_paths_coverage.py` 는 실패했다. 사본에 실제 `.git` 과 `plan/` 이 없어서 생긴 환경 문제이고 이번 변경과 무관하다(main 세션이 원본 트리에서 1295 passed 를 보고했다).
- 실제 미러 169편에 `pull.py --check` 를 돌렸다(사본). 문제 0. 모든 미러 파일의 frontmatter 끝 세 줄이 `source_paths` → `mirror_sha256` → `etag` 순서이고, `source_paths` 는 본문 머리 인용 줄과 전부 일치한다. 커밋된 `spec/README.md` 는 `render_readme()` 출력과 바이트 단위로 같다.
- 훅을 scratch 저장소 사본에서 16가지 페이로드로 돌렸다. 절대 · 상대 · 대문자 `SPEC/` · `MultiEdit` · `NotebookEdit` · `input` 별칭은 기대대로 exit 2 또는 0 이다. 모양이 틀린 페이로드(`tool_input` 이 null · 문자열, 빈 경로, 최상위 배열)는 조용히 exit 0 이다. `path` 키 폴백 제거는 등록 matcher(`Write|Edit|MultiEdit|NotebookEdit`)와 충돌하지 않는다.
- `.claude/settings.local.json` 의 키 이름만 확인했다(값 출력 없음). `NERV_SERVER` · `NERV_TOKEN` · `NERV_PROJECT` 가 있고 프로젝트 이름 · 서버 주소는 `PROJECT_RE` · `server_ok` 를 통과하는 형태다. PROJECT.md 의 "값은 `settings.local.json` 의 `env` 가 준다" 는 맞다.
- `spec-link-checks.yml` 주석의 "추적 파일 약 3.3만 개, 대부분 `review/`" 는 실측과 맞다(`git ls-files` 33,508 · `review/` 29,313).
- 전환 단계 Task 키 12개(0~5, 4a~4g)는 메모리의 전환 계획과 전부 일치한다. NERV 서버에서 실재 여부는 이 세션에서 조회하지 못했다.
- 저장소 트리는 건드리지 않았다. `git status --short` 는 시작 때와 같다(리뷰 산출물 untracked 디렉터리 3개).

## 라운드 2 지적의 닫힘 여부

| 라운드 2 | 판정 | 근거 |
| --- | --- | --- |
| W1 loopback 접두 비교 | 닫힘 | `server_ok` 가 `urlsplit` 으로 스킴 · 호스트를 본다. 허용 5 · 거부 10 주소 테스트. 잔여 한 가지는 아래 I5 |
| W2 동치 테스트 CI 트리거 | 닫힘 | `harness-checks.yml` 에 `spec-links.ts` 등재, 등재를 단언하는 테스트 있음 |
| W3 심볼릭 링크로 prune 이 밖을 지움 | 대체로 닫힘 | `mirror_files` 가 링크를 빼고 `--check` 가 링크를 알린다. 잔여 한 가지는 아래 I4 |
| W4 받지 않은 문서의 옛 링크 | 닫힘 | `stale_links`. 탐지는 맞다. 메시지 방향 한 가지는 아래 I1 |
| W5 ETag 설정 줄 주입 | 닫힘 | `conditional_etag` 가 늘 캐시 원문에서 계산한 값만 돌려준다 |
| W6 훅 페이로드 모양 | 닫힘 | 위 16가지 프로브 |
| W7 · W8 curl · 오류 응답 테스트 | 닫힘 | 테스트 통과 확인 |
| 참고 1 지문이 줄을 전부 뺌 | 닫힘 | frontmatter 안의 첫 줄만 뺀다. 본문의 같은 접두 줄 테스트 있음 |
| 참고 8 `id` · `area` 가 문자열 아님 | 닫힘 | `well_typed` 검사와 테스트 |
| 참고 14 README 옛 트리 설명 | 닫힘 | 일반형 문구, 렌더 출력과 일치 |
| 참고 16 쓰기 전 전체 검사 | 일부만 | 쓰기 대상 검사만 앞당겼다. 렌더 오류는 여전히 중간에 멈춘다(I5) |
| 참고 26~29 보장 범위 문구 네 곳 | 일부만 | 다섯 번째 자리가 남았다(W1) |
| SPEC-DRIFT R-12 "본문 지문" | 닫힘 | 미러된 R-12 가 "파일 전체(frontmatter 의 그 줄을 뺀)" 로 바뀌어 코드와 맞는다 |

## 발견사항

- **[WARNING]** CI 잡 주석이 `--check` 보장 범위를 옛 그대로 적고 있다. 라운드 2 의 "보장 범위 문구 네 곳" 수정이 이 자리를 빠뜨렸다.
  - 위치: `.github/workflows/spec-link-checks.yml:124-131`(특히 127-129)
  - 상세: 주석은 `--check` 가 지문과 위치만 보고 "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 고 적는다. 지금 코드는 지문 없는 미러 파일 추가(`test_added_mirror_file_without_a_fingerprint_is_caught`), 받지 않은 문서의 옛 자리 링크, 미러 자리의 심볼릭 링크와 미러가 아닌 파일까지 잡는다. `pull.py` docstring(40-44), 훅 docstring(35-37), CHANGELOG(40-42), tests/README 는 이미 새 범위로 고쳐져 있다. 저장소 전체에서 "추가 · 삭제" 문구가 남은 곳은 이 주석 한 줄뿐이다(grep). 이 파일은 이번 diff 에도 들어 있다(sparse-checkout). 같은 잡 위의 주석이 구현보다 좁게 말하면 다음 사람이 "추가는 어느 층도 안 잡는다" 고 믿고 이미 있는 검사를 다시 만들 수 있다.
  - 제안: 주석을 `pull.py` docstring 의 보장 범위 문단과 같은 내용으로 바꾼다. 잡지 않는 것은 미러 파일 삭제 · 지문까지 다시 계산한 위조 · 옛 트리의 셸 편집 세 가지다.

- **[INFO]** `stale_links` 메시지의 원인 · 처방 문구가 한 방향에서는 사실과 반대로 적힌다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:486-490`
  - 상세: 미러 사본에서 재현했다. 문서 B 가 NERV 에서 옮겨졌는데 B 를 받지 않고 B 를 가리키는 A 만 `--task` 로 받으면, A 의 링크는 B 의 새 자리를 가리키고 B 파일은 옛 자리에 남는다. `--check` 는 이 경우도 잡지만(탐지는 맞다) 메시지는 "링크 `../CLE-IX/CLE-ACCT-SESSION.md` 가 옛 자리를 가리킨다(… 는 지금 spec/CLE-ACCT/…) — 이 문서도 pull 로 다시 받는다" 로 나온다. 링크는 새 자리를 가리키고 낡은 쪽은 B 미러다. 처방대로 A 를 다시 받아도 문제가 안 풀리고, B 를 받아야 한다. 라운드 2 가 재현한 반대 방향(B 를 받고 A 를 안 받음)에서는 문구가 맞다. 미러만 보면 어느 쪽이 낡았는지 알 수 없다.
  - 제안: 방향을 단정하지 않는 문구로 바꾼다. 예를 들어 "링크 대상 경로에 파일이 없다({key} 미러는 spec/{now}) — 링크를 가진 문서와 {key} 를 둘 다 pull 로 다시 받는다".

- **[INFO]** PROJECT.md 에 새로 넣은 절이 기존 절의 꼬리 인용문을 가로챘다.
  - 위치: `PROJECT.md:402-419`(추가된 `### NERV 스펙 미러`), `PROJECT.md:421`(`> **2026-08-27 변경**: … 위 가드로 합쳤다`)
  - 상세: 새 절이 docs 가드 절(`MDX frontmatter … registry.test.ts`)과 그 절의 "2026-08-27 변경" 인용문 사이에 들어갔다. 인용문의 "위 가드" 는 `spec-link-integrity` 를 가리키는데 지금은 `### NERV 스펙 미러` 제목 아래에 있어 미러 잡을 가리키는 것처럼 읽힌다. 새 절 첫 문장은 미러 배치를 `spec/<영역 키>/<KEY>.md` · `spec/README.md` 로만 적어 영역 밖 문서 2편(`spec/CLE-VISION.md` · `spec/CLE-GLOSSARY.md`)을 빼먹었다(같은 파일 393행은 `spec/CLE-*` 로 맞게 적었다).
  - 제안: 새 절을 인용문 뒤로 옮기거나 인용문을 새 절 앞으로 옮긴다.

- **[INFO]** CHANGELOG 의 "심볼릭 링크는 따라가 쓰거나 지우지 않는다" 가 구현보다 넓다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:283-288`(`_write_target`), `CHANGELOG.md:35`
  - 상세: `_write_target` 은 대상 파일 자체가 링크이거나 `resolve()` 결과가 `spec/` 밖일 때만 멈춘다. scratch 에서 `spec/CLE-ACCT` 를 `spec/old-tree/` 로 가는 폴더 링크로 바꾸고 `_write_target(spec, "CLE-ACCT/CLE-ACCT-X.md")` 를 불렀더니 예외 없이 `spec/old-tree/CLE-ACCT-X.md` 를 돌려줬다. 링크가 `spec/` 안을 가리키면 동결된 옛 트리에 쓸 수 있다. prune 쪽은 링크 폴더를 이미 빼므로 안전하고, 이 링크는 `--check` 가 심볼릭 링크로 알려 CI 에서 잡힌다. 그래서 위험은 작고 문구만 넓다.
  - 제안: 문구를 "`spec/` 밖을 가리키는 링크와 파일 링크는 따라가지 않는다" 로 좁히거나, `_write_target` 이 경로의 모든 조상이 링크가 아닌지 본다.

- **[INFO]** `PullError` docstring 은 CLI 가 늘 한 줄 `pull: <이유>` 로 끝난다고 하지만 예외 세 갈래는 traceback 으로 끝나고, 렌더 오류는 부분 쓰기를 남긴다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:113`(docstring), `:408-413`(`server_ok`), `:319-324`(`apply` 쓰기 루프), `:481`(`stale_links`), `:675-679`(`main` 의 `except (PullError, RuntimeError)`)
  - 상세: 전부 scratch 에서 재현했다. (a) `NERV_SERVER=https://[abc` 는 `urlsplit` 이 `ValueError: Invalid IPv6 URL` 을 낸다. `server_ok` 가 False 를 돌려주지 못한다. (b) 200 이지만 zip 이 아닌 응답(Cloudflare HTML 등)은 `zipfile.BadZipFile`, 없는 `--from-zip` 경로는 `FileNotFoundError` 다. (c) 미러 파일이 UTF-8 이 아니면 `stale_links` 의 `read_text` 가 `UnicodeDecodeError` 를 낸다. 아래 파일별 루프는 같은 읽기를 `ValueError` 로 잡아 파일별로 보고하려 했으나 `stale_links` 가 먼저 돌아 그 경로에 닿지 않는다. (d) export 의 한 문서가 frontmatter 없이 오면 `render` 가 `ValueError` 를 내고, 키 순서상 앞선 문서는 이미 써진 뒤다(`CLE-AAA` 만 남음). 쓰기 대상 검사를 앞당긴 수정의 목적("일부만 쓴 미러가 남는다")이 렌더 오류에는 닿지 않는다. 종료 코드는 모두 1 이라 CI 와 호출자의 판정에는 영향이 없다. N3 이 frontmatter 를 보장하므로 (d) 의 확률도 낮다.
  - 제안: `main` 의 `except` 에 `ValueError` · `OSError` · `zipfile.BadZipFile` 을 더해 한 줄로 끝낸다. `apply` 는 쓰기 전에 모든 문서를 렌더해 두고 쓴다. `stale_links` 의 읽기는 루프와 같은 `try` 로 감싼다.

- **[INFO]** [SPEC-DRIFT 후보, 회색지대] R-12 가 `--check` 의 새 검사 두 가지를 적지 않았다.
  - 위치: `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md:364`(R-12), 구현 `pull.py:259-280`(`stray_entries`), `:252-256`(`mirror_links`)
  - 상세: R-12 는 `--check` 가 지문, 파일 위치, 옮겨진 문서의 옛 자리 링크를 본다고 적는다. 코드는 여기에 미러 자리의 심볼릭 링크와 미러가 아닌 파일을 더 본다. 스펙과 충돌하지는 않지만, 뒤의 두 검사는 R-12 가 정한 "미러를 두 가드에서 뺀다" 의 빈틈을 메운다. 옛 트리 가드(`inNervMirror`)와 consistency 코퍼스가 `spec/CLE-*` 자리를 통째로 미러로 보고 빼므로, 그 자리에 놓인 다른 파일은 어느 검사도 보지 않는다. 그 보완 장치가 스펙에 없으면 다음에 미러 제외를 손보는 사람이 `stray_entries` 를 군더더기로 읽을 수 있다. 같은 문장의 "`spec/<영역 키>/<KEY>.md` 169편" 도 영역 밖 문서 2편을 센 숫자라 정확하지 않다. 코드를 되돌릴 일이 아니다.
  - 제안: 코드 유지. NERV 에서 R-12 초안에 "미러 자리의 심볼릭 링크와 미러가 아닌 파일(두 가드 제외가 그 자리를 못 보기 때문)" 을 한 줄 더한다. 미러는 `pull.py --task CLE-ENG-SPECEVIDENCE` 로 받는다. 이 저장소에서는 손대지 않는다.

- **[INFO]** `spec-mirror-integrity` 잡의 sparse-checkout 목록은 어떤 테스트도 고정하지 않는다.
  - 위치: `.github/workflows/spec-link-checks.yml:144-149`, `.claude/tests/test_nerv_mirror_pull.py` 의 `CiWiringTest`
  - 상세: 목록은 `spec` 과 `.claude/tools/nerv-mirror` 둘이다. `CiWiringTest` 는 잡이 `--check` 를 부르는지와 `needs` 만 본다. 나중에 `pull.py` 가 `.claude/tools/` 의 다른 디렉터리 모듈을 import 하게 되면 이 잡만 ImportError 로 빨개진다. 조용한 실패가 아니라 CI 가 바로 드러내므로 위험은 작다. docstring 의 "표준 라이브러리만 쓴다" 가 그 전제를 적고 있다.
  - 제안: 조치 불요. 원하면 `CiWiringTest` 에 sparse-checkout 이 `spec` 과 도구 디렉터리를 포함하는지 한 줄 단언을 더한다.

- **[INFO]** 코드 · 테스트 주석에 시점 상대 표현과 곧 사라질 경로의 인용이 남았다.
  - 위치: `.claude/tests/test_guard_nerv_owned_paths.py:191`("이 PR 을 부른 사고가"), `.claude/tools/nerv-mirror/pull.py:247`, `:474`("라운드 2 리뷰 재현"), `.claude/tests/test_nerv_mirror_pull.py:305`, `:565`("라운드 2 재현")
  - 상세: 라운드 2 RESOLUTION 참고 15 는 "이 PR" 을 날짜와 Task 키로 바꿨다고 했으나 테스트 주석 한 곳이 남았다. "라운드 N" 주석은 `review/` 산출물을 가리키는데 `review/` 는 전환 단계 3 에서 제거된다(결정 D11). 동작에는 영향이 없다.
  - 제안: "2026-10-01 실측(Task `CLE-T-VA4YA1`)" 처럼 날짜 · 재현 내용으로 바꾼다. 급하지 않다.

## 기타 확인 사항(조치 불요)

- 저장소 `CLAUDE.md` 는 이 브랜치에서 아직 `spec/**` 쓰기를 planner 에 안내한다. 짝 planner PR(`claude/nerv-cutover-1-docs-c46df0`)이 먼저 머지되어야 훅 docstring 의 "먼저 막으면 문서가 시키는 일을 훅이 막는다" 원칙이 지켜진다. 라운드 2 참고 9 와 같은 전제이고 코드 변경은 필요 없다.
- TODO · FIXME · HACK 주석은 변경 파일에 없다.
- `MirrorPredicateParityTest` 의 하한을 `> 100` 에서 `> 1` 로 낮췄다. `tool` 집합에 README 가 항상 들어가므로 실제 미러 파일 1편만 있어도 통과한다. 169편이 있는 지금은 동치 비교가 의미 있게 돈다. 미러가 줄어드는 것을 이 테스트가 잡지는 않지만 `--check` 의 0편 실패가 그 역할을 한다.

## 요약

라운드 2 의 경고 11건은 코드 기준으로 전부 닫혔고 수정이 새 결함을 만들지는 않았다. `server_ok` · `conditional_etag` · 지문 범위 · 훅 페이로드 방어 · `stale_links` · 링크 · 미러가 아닌 파일 검사는 scratch 재현과 테스트로 확인했고, 실제 미러 169편과 README 는 도구 출력과 일치한다. 남은 것은 문서 · 메시지 층이다. 경고 1건은 `spec-link-checks.yml` 잡 주석이 `--check` 보장 범위를 옛 그대로 적고 있는 것으로, 라운드 2 의 문구 정리가 이 자리를 놓쳤다. 나머지는 `stale_links` 메시지 방향, PROJECT.md 절 위치, 심볼릭 링크 문구, 예외 처리 일관성, R-12 회색지대 같은 참고 사항이다. 스펙과 충돌해서 코드를 고쳐야 하는 항목(CRITICAL)은 없다. R-12 는 이번 미러 갱신으로 코드와 맞아졌다.

### 위험도
LOW
