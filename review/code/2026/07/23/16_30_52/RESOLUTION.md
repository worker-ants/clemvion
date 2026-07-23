# Resolution — review/code/2026/07/23/16_30_52

대상 커밋: `5d62e5979` (router_safety 정책표 확장자 개수 24→44 정정 + 미러 drift 가드)
SUMMARY 위험도: **CRITICAL** / CRITICAL 1 / WARNING 2 / INFO 6
forced reviewer 7명 전원 결과 확보 (`forced_missing: []`, `unfinished: []`).

## CRITICAL 1 — 지적이 정확했다. **반영**

### 내용

`README.md:68` 의 정책표 행이 여전히 `| 소스 파일 (24 확장자) |` 로 stale 이었다. 그리고
신설 가드는 **그 지점을 검사하지 않아 green 으로 통과**했다 — 자신이 막으려던 바로 그
drift 를 놓친 것이다.

### 왜 놓쳤나 (실측)

두 겹의 실수였다.

1. **grep 이 한 가지 철자만 봤다.** 나는 `24 extensions` · `24개` · `Source-code
   extensions` 로 훑었는데 README 는 한국어로 `24 확장자` 라 적혀 있어 **어느 패턴에도
   걸리지 않았다.** 그래서 "README 는 목록만 있고 개수는 없다" 고 잘못 결론지었다.
2. **가드가 검사한 것과 주장한 것이 달랐다.** `_readme_extension_list()` 는 README **79행의
   나열 목록**(이미 44개, 정확)만 파싱하고 `test_table_states_the_real_extension_count` 는
   **docstring 표**만 봤다. 그런데 모듈 docstring 과 `.claude/tests/README.md` 행에는
   "both docs" 라고 적었다. 커버리지보다 넓은 주장을 문서에 남긴 것.

### 조치

- `README.md:68` → `44 확장자` 정정.
- `test_readme_table_states_the_real_extension_count` 신설 — README 표 행의 개수를
  `len(_SOURCE_CODE_EXTENSIONS)` 와 대조.
- `test_no_stale_extension_count_survives_anywhere` 신설 — **철자 비의존 sweep**.
  두 문서 안의 모든 `(N 확장자)` · `(N extensions` 를 찾아 전부 실제 개수와 대조한다.
  애초의 miss 가 "한 철자만 grep" 에서 왔으므로, 하나의 표현을 믿는 대신 형태를 열거한다.
- 모듈 docstring 과 `.claude/tests/README.md` 행의 "both docs" 서술을 실제 커버리지에
  맞게 정정하고, 이 miss 자체를 근거로 기록.

## WARNING 1 — 정책표 9행 중 2행만 검증 → **반영**

지적대로 나머지 행의 Forced reviewers 컬럼은 무검증이었다. 행↔`_RULES` 를 산문으로
짝짓는 건 추측이 되므로, 대신 집합·개수 수준 불변식으로 덮었다:

- `test_docstring_table_has_a_row_per_rule` — 표 행 수 == `len(_RULES) + 2`
  (source-code 행 + unclassified 행). 규칙 추가/삭제 시 표 미갱신을 잡는다.
- `test_docstring_table_names_exactly_the_reviewers_the_rules_force` — 표가 광고하는
  reviewer 집합 == `_RULES` ∪ `_SOURCE_FORCED_REVIEWERS` 가 실제로 강제할 수 있는 집합.
  규칙이 다른 reviewer 로 재조준됐는데 표는 옛 이름을 유지하는 경우를 잡는다.
- `test_readme_table_has_the_same_rows_as_the_docstring` — 미러 선언을 행 수로 강제.

구현 중 두 가지를 실측으로 교정했다: (a) README 에는 무관한 표가 여럿이라 "아무 마크다운
표" 가 아니라 source-code 행을 앵커로 정책표만 특정, (b) `requirement (+ documentation
via doc rule above)` 같은 산문 셀 때문에 raw 토큰화가 "via"·"rule"·"above" 를 reviewer 로
오인 → 실제 로스터(`ALL_AGENTS`)와 교집합.

## WARNING 2 — `.claude/tests/README.md` 행의 "both docs" 문구 → **반영**

CRITICAL 과 동일 원인의 부수 효과. 실제 커버리지를 나열하도록 정정하고, 가드 자신의 첫
버전이 놓쳤다는 사실도 함께 기록했다(같은 함정을 다음 사람이 반복하지 않도록).

## INFO — 1건 반영, 5건 미조치

- **INFO 1 (미사용 `from pathlib import Path`) — 반영.** 6개 리뷰어 공통 지적, 실제
  미사용 확인 후 제거.
- INFO 2 (subprocess 인젝션 표면) — 조치 불요로 리뷰어가 직접 판정. 경로가 전부 로컬
  `REPO_ROOT` 파생이고 shell 미사용.
- INFO 3 (stderr 1500자 노출) — 조치 불요 판정. 로컬 테스트 실패 로그.
- INFO 4 (`runpy.run_path` 가 orchestrator 최상위 실행) — 현재 부작용 없음을 리뷰어가
  확인. "최상위에 부작용 두지 말 것" 주석은 선택 사항이며, orchestrator 는 이미
  `if __name__ == "__main__"` 가드가 있어 별건으로 둔다.
- INFO 5 (subprocess 헬퍼 보일러플레이트 중복) — 기존 스위트와 동일 스타일. 즉시 조치
  불요로 리뷰어가 분류.
- INFO 6 (정규식 문서 파싱의 결합도) — "문서가 곧 스펙" 컨벤션 예외로 의도된 트레이드오프,
  현행 유지.

## 검증

- harness suite **445 green** (반영 전 440 → 신규 테스트 5건).
- mutation **7/7 killed**. 그중 **E1 은 이 가드가 놓쳤던 결함을 그대로 재현**
  (README 표 44→24) 하여 이제 잡힘을 실증한다. 나머지: docstring 표 개수 되돌림 ·
  집합에만 확장자 추가 · `_RULES` 항목 추가 후 표 미갱신 · 규칙 재조준 · 표 행에서
  reviewer 누락 · README 정책 행 삭제.
- E7 은 첫 시도에서 치환이 실패해 "SURVIVED" 로 보고됐다 — **무효 뮤턴트**였다. 유효한
  형태로 다시 적용해 killed 확인.

## 잔여

없음 (CRITICAL 1 + WARNING 2 + INFO 1 반영, INFO 5건은 위 사유로 미조치).
