# 문서화 리뷰 (라운드 3, 범위 `ad8662bd5..8bc7e6df1`)

## 발견사항

- **[WARNING]** `spec-mirror-integrity` 잡의 주석이 `--check` 의 보장 범위를 옛 그대로 적고 있다
  - 위치: `.github/workflows/spec-link-checks.yml:124-131` (특히 127-129)
  - 상세: 이 잡 바로 아래(142-149)를 이번 범위에서 고쳤는데, 주석은 그대로다. 주석은 `--check` 가 "지문(`mirror_sha256` 줄을 뺀 파일 전체)과 위치" 를 보고 "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 고 적는다. 지금 코드는 지문 없는 미러 파일 추가, 옮겨진 문서의 옛 자리를 가리키는 링크, 미러 자리의 심볼릭 링크와 미러가 아닌 파일까지 잡는다(`pull.py` `check` · `stale_links` · `stray_entries`, 테스트 `test_added_mirror_file_without_a_fingerprint_is_caught` 등). 지문도 이제 frontmatter 의 그 줄 하나만 뺀다(`fingerprint`). 같은 보장 범위를 이번 라운드에 훅 docstring(35-37), `pull.py` docstring(40-44), CHANGELOG(40-42), PROJECT.md 에서는 고쳤고 이 주석만 빠졌다. `git grep "추가 · 삭제"` 로 옛 서술이 남은 곳은 이 한 군데뿐이다. 이 경우는 문서가 구현보다 좁게 말하지만, 같은 사실을 네 곳이 다르게 적은 채 남게 된다.
  - 제안: 127-129 를 CHANGELOG 40-42 의 문장으로 맞춘다("손편집 · 위치 이동 · 지문 없는 미러 파일 추가 · 옛 자리를 가리키는 링크 · 미러 자리의 링크와 다른 파일을 잡는다. 미러 파일 삭제, 지문까지 다시 계산한 위조, 옛 트리의 셸 편집은 잡지 않는다"). 보장 범위 문장은 여러 곳에 복제되어 있으니 `pull.py` docstring 을 SoT 로 두고 나머지는 한 줄 요약 + 링크로 줄이는 것도 방법이다.

- **[WARNING]** PROJECT.md 에 새 절을 끼워 넣어 `2026-08-27 변경` 메모가 엉뚱한 절 아래로 밀렸다
  - 위치: `PROJECT.md:402-419` (새 `### NERV 스펙 미러`), `PROJECT.md:421-426` (`> **2026-08-27 변경**` 인용 블록)
  - 상세: 그 인용 블록은 `check-doc-links.py` 삭제 이력이고 "위 가드로 합쳤다" 는 바로 앞 절(문서 링크 검증, docs 가드)을 가리킨다. 새 절이 그 사이에 들어와 지금은 `### NERV 스펙 미러` 의 마지막 문단으로 읽히고, "위 가드" 가 `pull.py --check` 로 읽힌다. 이력 메모의 소속이 바뀌어 사실이 틀어진다.
  - 제안: 새 `### NERV 스펙 미러` 절을 인용 블록 뒤(`### Playwright flaky surfacing` 앞)로 옮긴다.

- **[INFO]** 테스트 주석의 "유일한 결정적 방법" 이 반증된다
  - 위치: `.claude/tests/test_guard_nerv_owned_paths.py:42-43`
  - 상세: 실측(scratch 에서 훅을 그대로 실행): 작업 디렉터리가 지워진 프로세스에서 상대 경로 페이로드(`{"tool_input":{"file_path":"spec/x.md"}}`, `cwd` 키 없음)를 주면 `_target` 의 `os.getcwd()`(훅 85행)가 `FileNotFoundError` 를 내고 `except Exception` 분기로 들어가 exit 0 과 traceback 을 낸다. `json.loads` 를 바꿔치지 않아도 그 분기를 결정적으로 밟는다. 워크트리를 reaper 가 지운 뒤 세션이 그 경로에서 편집을 시도하는 상황과도 가깝다.
  - 제안: "유일한" 을 "한 가지" 로 낮추거나, 삭제된 cwd 케이스를 하나 더 둔다. 다음 사람이 이 주석을 보고 다른 재현 방법을 찾지 않게 되는 것이 문제다.

- **[INFO]** `pull.py` 정규식 주석이 실제보다 넓다
  - 위치: `.claude/tools/nerv-mirror/pull.py:79`
  - 상세: "아래 형식은 모두 `fullmatch` 로 쓴다" 라고 했지만 아래에 있는 `LINK_RE`(`sub`, 185행) · `SOURCE_LINE_RE`(`match`, 168행) · `MIRROR_LINK_RE`(`finditer`, 482행) 는 부분 일치로 쓴다. 검증용인 `KEY_RE` · `TASK_RE` · `ETAG_RE` · `PROJECT_RE` 는 전부 `fullmatch` 로 쓰인다(130 · 237-278 · 420 · 428 · 572행).
  - 제안: "형식 검증용 `KEY_RE` · `TASK_RE` · `ETAG_RE` · `PROJECT_RE` 는 `fullmatch` 로만 쓴다. `re.match` 와 `$` 는 끝 개행을 받아들인다" 로 범위를 좁힌다.

- **[INFO]** `is_excluded` docstring 이 코드보다 좁고, `area` 이름이 폴더를 뜻한다는 설명이 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:141` (docstring), `:117` (`Doc`), `:127` (`mirror_relpath`)
  - 상세: 이번 범위에서 고친 docstring 은 "영역이 없으면(트리 밖 · 영역 밖) 키 접두로 본다" 고 적는다. 실측(scratch 에서 모듈을 읽어 호출): `is_excluded("CLE-C24-X", "CLE-IX")` 도 True 다. 키 접두 판정은 영역이 있어도 돈다(142-144). 테스트 `test_catalog_key_outside_its_area_is_still_skipped` 는 영역이 없는 경우만 본다. 또 이번 라운드에 `folder_of` 와 `area_map` docstring 이 "미러 폴더" 라는 말을 쓰기 시작했는데 `Doc.area` · `mirror_relpath(key, area)` · `is_excluded(key, area)` 의 `area` 는 그대로 폴더(영역 문서는 자기 키)를 뜻해 NERV frontmatter 의 `area`(부모 영역)와 다르다. 이 구분이 `folder_of` 한 곳에만 적혀 있다.
  - 제안: docstring 을 "영역이 카탈로그이거나 키가 카탈로그 접두면 True" 로 고치고, `Doc` 에 한 줄 docstring("area: 미러 폴더 키. 영역 문서는 자기 키라서 frontmatter `area` 와 다르다")을 단다.

- **[INFO]** 테스트 모듈 docstring 의 "클래스별 목록" 이 완전하지 않다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:9-28`, 이를 "keep that list, not this row, complete" 로 가리키는 `.claude/tests/README.md:66`
  - 상세: README 가 이 목록을 완전한 SoT 로 선언하는데 다음 테스트가 빠져 있다. `InputValidationTest.test_cli_reports_errors_in_one_line`(CLI 는 traceback 없이 `pull: …` 한 줄 + exit 1), `InputValidationTest.test_only_empty_mirror_folders_are_removed`, `CheckTest.test_odd_frontmatter_values_are_reported_not_raised`(id · area 가 문자열이 아니어도 위치 문제로 알린다. 직전 커밋 `8bc7e6df1` 의 수정), `MirrorPredicateParityTest.test_the_three_files_trigger_the_harness_workflow`(클래스 docstring 에만 있다).
  - 제안: 해당 줄에 각 항목을 한 구절씩 더한다. 특히 `8bc7e6df1` 의 수정을 고정하는 테스트가 목록에 없으면 다음 사람이 "이 케이스는 누가 지키나" 를 찾기 어렵다.

- **[INFO]** PROJECT.md 새 절의 환경 변수와 대상 파일 서술이 일부 빠졌다
  - 위치: `PROJECT.md:404-405`, `PROJECT.md:418-419`
  - 상세: `pull.py` 는 `NERV_PROJECT`(선택, 기본 `clemvion`)도 읽는데(459-465행, docstring 에는 있음) 새 절은 `NERV_SERVER` · `NERV_TOKEN` 만 적는다. 또 "`spec/<영역 키>/<KEY>.md` · `spec/README.md` 는 미러" 라고만 써서 영역 밖 문서(`spec/CLE-VISION.md` · `spec/CLE-GLOSSARY.md`)가 빠진다.
  - 제안: 한 줄씩 보탠다("`NERV_PROJECT` 는 선택, 기본 `clemvion`", "영역 밖 문서는 `spec/<KEY>.md`").

- **[INFO]** `stray-tool-tags` 의 `spec` 하한 주석이 옛 트리만의 실측이고, 단계 3 · 5 에서 깨진다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:59`, `:70-73` (이번 범위에서 고친 곳은 27-28)
  - 상세: 이번에 "NERV 미러도 일부러 본다" 를 적었으므로 그 스캔 집합이 바뀐 것을 주석이 알아야 한다. 측정(`git ls-files`, archive 제외): 지금 `spec/**/*.md` 는 557편(옛 트리 387 + 미러 169 + README 1)이고, 주석의 "spec 386" 은 2026-09-01 옛 트리만의 값이다. 전환 단계 5 가 옛 트리를 지우면 스캔 대상은 170편이라 `spec: 190` 하한(`toBeGreaterThan`)을 밑돌아 RED 가 된다. `plan: 250` 도 단계 3 에서 같은 일이 생긴다.
  - 제안: 하한 주석에 "전환 단계 3(plan 제거) · 5(옛 spec 삭제) 에서 이 하한을 그 단계의 실측으로 다시 잡는다" 를 한 줄 남긴다. 단계 Task(`CLE-T-FN2JWK` · `CLE-T-7M4C4X`)의 scope 에 넣는 쪽이 더 확실하다.

- **[INFO]** 훅 차단 메시지와 README 의 `source_paths` 안내가 "옛 경로 하나 = 키 하나" 로 읽힌다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:56-58`, `.claude/tools/nerv-mirror/pull.py:619` (README 템플릿, `spec/README.md:11`)
  - 상세: 안내대로 `grep -rl 'spec/5-system/1-auth.md' spec/CLE-*` 를 돌리면 6편이 나온다(`CLE-ACCT-DATA` · `CLE-ACCT-SESSION` · `CLE-ACCT-SIGNIN` · `CLE-ACCT-WS` · `CLE-OBS-AUDIT` · `CLE-OBS-AUDITNAME`). 옛 문서 하나가 여러 NERV 스펙으로 나뉘는 경우가 많다. 안내가 단수("NERV 키")라 첫 결과만 보고 멈출 수 있다.
  - 제안: "옛 경로의 NERV 키(여러 개일 수 있다)" 로 한 구절 보탠다. 동작은 맞다.

## 확인해서 문제가 없었던 것

- 훅 docstring 과 `pull.py` docstring 의 전환 단계 Task 키 12개(`CLE-T-0EZEYF` · `VA4YA1` · `4ABTG7` · `FN2JWK` · `BD48J3` · `BDRZVX` · `9AM31N` · `BR8BNZ` · `VP5KDJ` · `RXMB2X` · `M7K35H` · `7M4C4X`)를 NERV 에서 읽기 전용 GET 으로 조회해 `[전환 N]` 제목과 전부 일치함을 확인했다.
- `MAX_EXPORT_BYTES` 주석의 실측("448항목 · 합계 9.3MB · 최대 항목 199KB")을 같은 엔드포인트의 export 로 다시 쟀다: 448항목, 압축 해제 9,323,583바이트, 최대 198,993바이트. 맞다.
- `spec-link-checks.yml:142` 의 "추적 파일 약 3.3만 개, 대부분 `review/`": `git ls-files` 33,508개 중 `review/` 29,313개. 맞다.
- `--basis` 제거: 저장소(`.claude` · `.github` · 루트 문서 · `codebase` · `spec/README.md` · `spec/CLE-ENG`)에 참조가 남아 있지 않다. 훅의 `checkout_root` · `owned_root` 개명도 외부 참조가 없다.
- CHANGELOG 항목은 코드 동작(지문 없는 추가 · 옛 자리 링크 · 심볼릭 링크 · 미러 아닌 파일 탐지, 한계 세 가지)과 맞고 `Unreleased — …` 접두와 «무엇이 항목을 만드는가» 기준(가드 신설 · 조임)을 지킨다. `spec-mirror-integrity` 의 sparse-checkout 은 가드의 범위를 바꾸지 않는 실행 비용 조정이라 항목이 필요 없다.
- `harness-checks.yml` 새 주석("나머지 둘은 `.claude/tools/**` · `.claude/skills/**` 가 덮는다")은 같은 파일의 pathspec 과 일치한다.
- `.claude/tests/README.md` 의 두 행, 훅 테스트 docstring, `spec-links.ts` · `tree-walk.test.ts` · `consistency_orchestrator.py` 주석은 코드와 맞다. `spec/README.md` 의 예시 경로 `spec/5-system/1-auth.md` 는 실재하고 `source_paths` 조회도 동작한다. `spec/` 의 두 파일은 `pull.py` 출력이라 문체 · 내용을 손대지 않는다.

## 요약

이번 라운드는 문서 갱신이 대체로 꼼꼼하다. `--check` 보장 범위를 바꾸면서 훅 · `pull.py` · CHANGELOG · 테스트 docstring 을 함께 고쳤고, Task 키와 실측 수치도 재측정에서 맞았다. 남은 것은 같은 사실을 적은 곳 가운데 두 군데가 따라오지 못한 경우다. CI 잡 주석(`spec-link-checks.yml`)이 옛 보장 범위를 그대로 적고 있고, PROJECT.md 새 절이 기존 `2026-08-27 변경` 메모를 다른 절 아래로 밀어냈다. 둘 다 한두 줄 수정으로 끝나며 동작에는 영향이 없다. 나머지는 주석의 과장("유일한 결정적 방법", "아래 형식은 모두 fullmatch")과 목록 누락 같은 참고 사항이다. 저장소 파일은 건드리지 않았고 실험은 scratchpad 에서만 했다(`git status --short` 는 시작 때와 같다).

## 위험도

LOW
