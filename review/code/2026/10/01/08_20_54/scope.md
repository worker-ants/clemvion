# 변경 범위(Scope) 리뷰 — 라운드 3

범위: 커밋 `ad8662bd5..8bc7e6df1`(`7ce195e04` · `248fad9f3` · `8bc7e6df1`), 16개 파일.
기준: 라운드 2 SUMMARY(경고 11 · 참고 32)와 RESOLUTION. 이번 수정이 그 지적을 넘어서거나 무관한 곳을 건드리지 않았는지 본다.

## 확인한 것

- `git diff --stat ad8662bd5..8bc7e6df1` 의 16개 파일이 프롬프트 대상과 같다. 그 밖의 파일 변경은 없다. `.claude/settings.json` · `.gitignore` · `plan/**` · 옛 `spec/<영역>/` 트리 변경이 0건이다.
- `codebase/**` 접촉은 `spec-links.ts` · `stray-tool-tags.test.ts` 의 주석, `tree-walk.test.ts` 의 합성 트리 픽스처와 테스트 제목뿐이다. 제품 코드 변경은 없다. 작업 명세가 허용한 예외 안이다.
- `spec/` 변경 2건은 `pull.py` 출력이다(README 템플릿 변경, SPEC-DRIFT 를 고친 NERV 초안을 `--task` 로 받음). `pull.py --check` 를 돌려 "미러 169편 · 문제 0" 을 확인했다. 트리는 바뀌지 않았다.
- 바뀐 Python 4개 파일(`pull.py` · 훅 · 테스트 두 개)에 쓰지 않는 import 가 없다(ast 로 확인). 새 import(`urllib.parse` · `traceback` 상단 이동 · `mock` · `re`)는 모두 쓰인다. 지운 이름(`--basis` · `MIRROR_FIELDS`)을 가리키는 남은 참조도 없다.
- 공백 · 줄바꿈만 바꾼 hunk 가 없다. 리팩토링 성격의 변경(`folder_of` · `paths_of` · `etag_of` · `conditional_etag` · `_write_target` · `render` 의 `assemble`)은 전부 라운드 2 경고 5 · 16 · 참고 21 이 요구한 것이다.
- 라운드 2 의 `wont_fix`(17 · 18 · 30)는 실제로 손대지 않았다. 범위를 넓히지 않았다는 주장이 맞다.
- 라운드 2 범위 지적 두 건(참고 13 `--basis`, 참고 15 "이 PR" 상대 표현)은 닫혔다. `--basis` 는 지워졌고 "이 PR" 은 날짜와 Task 키로 바뀌었다(CHANGELOG 는 시점 문서라 그대로 둔다).

## 발견사항

- **[INFO]** `--check` 에 미러 자리의 "미러가 아닌 파일" 탐지(`stray_entries`)를 새로 넣었다. 라운드 2 가 요구한 것은 문서 문구 정렬과 한계 고정 테스트였다
  - 위치: `.claude/tools/nerv-mirror/pull.py:259-280`(`stray_entries`), `:499-502`(`check` 의 문제 줄), `.claude/tests/test_nerv_mirror_pull.py:397-404`(`test_other_files_in_the_mirror_place_are_caught`)
  - 상세: 경고 26 의 제안은 "네 곳의 문구를 맞추고 `CheckTest` 에 `limitation` 테스트로 고정" 이었고, 참고 9 의 제안은 각 정의 옆 주석과 "동치 테스트에 합성 경로(깊이 2, 비-키 줄기)를 더한다" 였다. 수정은 그 대신 미러 폴더 안의 다른 파일과 `spec/CLE-*` 의 비-`.md` 이름을 `--check` 가 실패로 세게 바꿨다(약 20줄과 테스트 2건). RESOLUTION 참고 9 가 "효과가 같아졌다" 고 적은 것이 이 선택이다. 동치 테스트의 합성 경로 케이스는 더해지지 않았고 실제 트리 하한만 `> 100` 에서 `> 1` 로 낮아졌다(`:825`). 심볼릭 링크 탐지(`mirror_links`)는 경고 3 의 `mirror_files` 링크 제외가 만든 사각지대를 메우는 것이라 필연적 동반 변경으로 본다. `stray_entries` 는 그렇지 않다. CI 실패 표면이 넓어졌다. 점으로 시작하는 이름만 예외라 `CLE-ACCT/CLE-ACCT.md.orig` 같은 편집기 잔재도 CI 를 깨뜨린다. 방금 고친 NERV 스펙 R-12 는 `--check` 가 보는 것을 "지문 · 위치 · 옛 자리 링크" 로만 열거해 이 두 탐지를 빼놓는다. 커밋 본문 · CHANGELOG · PROJECT.md 에는 적혀 있어 숨겨진 변경은 아니다
  - 제안: 의도한 확장이라면 RESOLUTION 참고 9 에 "제안 대신 탐지를 넣었다" 고 적고 R-12 열거에 한 구절을 더한다(다음 planner 턴). 넓히지 않으려면 `stray_entries` 를 빼고 `test_limitation_*` 한 건으로 "미러 폴더의 다른 파일은 TS · 오케스트레이터에서만 미러로 본다" 를 고정한다

- **[INFO]** RESOLUTION 참고 26 이 "보장 범위 문구 네 곳 fixed" 라고 적었으나 CI 잡 주석 한 곳이 그대로다
  - 위치: `.github/workflows/spec-link-checks.yml:128-129`
  - 상세: 그 주석은 여전히 "미러 파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다" 라고 적는다. 이 범위에서 `--check` 는 지문 없는 미러 파일 추가, 옛 자리 링크, 미러 자리의 링크 · 다른 파일을 잡는다. 같은 파일의 `:144-149`(sparse-checkout)는 이번에 고쳤으면서 바로 위 주석을 놓쳤다. 훅 docstring · `pull.py` docstring · CHANGELOG 는 고쳐졌다. 전부 "실제보다 좁게 적은" 방향이라 해롭지는 않다(`grep '추가 · 삭제'` 에서 이 줄만 남는다)
  - 제안: 주석을 훅 docstring 의 새 문장("지문 없는 미러 파일 추가를 잡는다. 미러 파일 삭제와 옛 트리의 셸 편집은 어느 층도 잡지 않는다")과 같게 맞춘다

- **[INFO]** `PROJECT.md` 의 새 절이 문서 링크 검증 절과 그 절의 변경 안내 사이에 끼어들었다
  - 위치: `PROJECT.md:402-420`(새 `### NERV 스펙 미러`), `:421`(`> **2026-08-27 변경**: … 위 가드로 합쳤다`)
  - 상세: `:421` 의 인용 블록은 `### 문서 링크 검증` 절의 꼬리이고 "위 가드" 는 그 절의 docs 가드를 가리킨다. 새 절이 그 사이에 들어와 인용 블록이 NERV 미러 절 아래로 밀렸고 "위 가드" 의 앞 문맥이 바뀌었다. 경고 28 의 제안은 "문서 링크 검증 절 아래에 두라" 였다
  - 제안: 새 절을 `:421-426` 인용 블록 뒤, `### Playwright flaky surfacing` 앞으로 옮긴다

- **[INFO]** 훅 docstring 의 전환 단계 목록이 라운드 2 제안보다 넓다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-21`
  - 상세: 참고 11 의 제안은 "단계 목록을 4e · 5 까지 늘린다" 였다. 수정은 0 · 1 · 2 · 3 · 4a~4g · 5 와 NERV Task 키 열두 개를 적었다. 이 PR 이 참조하는 단계는 1 · 4e · 5 뿐이고 나머지는 이 변경과 무관한 로드맵이다. 정본은 NERV Task 이므로 이 목록은 복제본이고, 그 Task 가 재편되면 훅 docstring 이 낡는다. `pull.py:9-11` 이 "목록 전체는 훅 docstring 에 있다" 고 가리켜 이 복제본을 기준점으로 굳힌다
  - 제안: 1 · 4e · 5 만 남기고 "전체는 NERV 의 `[전환 N]` Task" 로 가리킨다. 넓혀 둘 이유가 있으면 그대로 둬도 동작에는 영향이 없다

- **[INFO]** 요청에 없던 문장부호 교체가 실질 변경에 섞여 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:51-52`(`검증한다. 따옴표나…` — 줄표에서 마침표로), `.claude/tests/test_nerv_mirror_pull.py:776`(`CiWiringTest` docstring, 같은 교체)
  - 상세: 어떤 지적에도 대응하지 않는 줄표 → 마침표 교체 두 곳이다. 같은 hunk 의 실질 변경(`:431-433` `-g` · `--proto`, `_curl_value` 문구)과 섞여 있다. 같은 변경이 새로 넣은 문장(`guard_nerv_owned_paths.py:74` 의 "None — 하네스가…")은 줄표를 그대로 쓴다. 동작 영향은 없다
  - 제안: 조치 불요. 다음부터는 문체 교체를 실질 변경과 분리한다

## 경계 준수 확인

- 훅의 `path` 키 폴백 제거(`guard_nerv_owned_paths.py:79`)는 경고 6 이 "테스트로 고정하거나 지운다" 고 제시한 선택지 중 하나를 고른 것이고 `test_malformed_payloads_pass_quietly` 가 고정한다. 차단 범위를 줄이는 방향의 동작 변경이지만, 편집 도구 네 종(`file_path` · `notebook_path`)이 쓰지 않는 키라 범위 이탈로 보지 않는다.
- `--basis` 제거로 `cmd_all` 시그니처가 바뀌었다(`basis` 인자 삭제, `nerv=` 추가). 호출부는 `main` 과 테스트뿐이고 모두 갱신됐다. 라운드 2 범위 INFO 가 권한 조치다.
- `spec-link-checks.yml` 의 `sparse-checkout` 은 참고 31 의 제안 그대로다. 잡이 `spec/` 과 `pull.py` 만 읽는다는 주석과 일치한다.
- `CLE-ENG-SPECEVIDENCE` 미러 변경은 경고 11(SPEC-DRIFT)이 지시한 경로다. 미러에 든 문서는 모두 `status: "draft"` 이고 `read_as: "approved_fallback"` 이라 `--all` 도 같은 본문을 받으므로 미러와 기본 받기 사이에 갈림은 없다.

## 요약

이번 범위는 라운드 2 의 경고 11건과 참고 대부분에 일대일로 대응하고, 무관한 파일 수정 · 포맷팅 변경 · 사용하지 않는 import · 설정 변경은 찾지 못했다. `codebase/**` 접촉은 주석과 테스트 픽스처로 한정된다. 지적이 넘은 곳은 세 가지다. `--check` 에 요청받지 않은 비미러 파일 탐지를 더한 것(CI 실패 표면 확대, 스펙 R-12 열거 누락), 훅 docstring 이 제안보다 넓은 로드맵 복제본이 된 것, 요청에 없던 문장부호 교체다. 그리고 RESOLUTION 참고 26 이 "네 곳 fixed" 라 적은 문구 중 CI 잡 주석 한 곳이 실제로는 그대로이며, `PROJECT.md` 의 새 절이 기존 인용 블록을 자기 절 아래로 밀어냈다. 모두 정보 수준이고 동작 회귀를 만들지 않는다.

## 위험도

LOW

(저장소 트리는 변경하지 않았다. 읽기 · grep · `pull.py --check`(쓰기 없음) · ast 검사만 했고 `git status --short` 는 시작 때와 같다.)
