# Resolution — review/code/2026/07/23/16_49_22

대상 커밋: `5d62e5979` · `bd7213457` · `7e7bc8e1e`
SUMMARY 위험도: **MEDIUM** / CRITICAL 0 / WARNING 2 / INFO 7
forced reviewer 7명 전원 결과 확보. 직전 라운드 CRITICAL 은 해소 확인됨.

## WARNING 1 — 가드가 여전히 "Forced reviewers 컬럼" 을 실질 검증 못 함 → **반영**

리뷰어들이 **직접 mutation 으로 재현**해서 보고했고, 나도 재현해 확인했다. 두 경로였다:

- **(a) README 쪽 무검증** — `test_readme_table_has_the_same_rows_as_the_docstring` 가 행
  **개수**만 비교했다. README:68 의 소스 행에서 `testing` 하나를 지워도 12개 테스트 전원
  green. (실측 재현: SURVIVED)
- **(b) docstring 쪽 union 비교** — 표 전체의 reviewer 이름을 **합집합**으로만 대조해서,
  지운 이름이 다른 행에 남아 있으면 탐지 실패. "Package manifest" 행에서 `documentation`
  을 지워도 "Doc file" 행이 그 이름을 갖고 있어 통과. (실측 재현: SURVIVED)

이건 이 PR 계열이 통틀어 막으려던 결함 클래스와 정확히 같다 — 가드가 자기가 막는
종류의 drift 를 다시 놓친 것.

### 조치 — 행 단위 대조로 교체

union 을 쓴 이유는 "행↔규칙을 산문으로 짝짓는 건 추측" 이라서였다. 그런데 실측해보니
**표 행 순서가 `_RULES` 순서와 정확히 일치**한다 (행 0 = source-code, 행 1~8 =
`_RULES[0..7]`, 행 9 = unclassified). 추측이 아니라 검증 가능한 사실이었으므로 위치 기반
짝짓기로 전환했다:

- `test_docstring_table_rows_match_their_rules_one_by_one` — 각 행의 reviewer 집합 ==
  그 행이 서술하는 규칙의 reviewer 집합.
- `test_readme_rule_rows_match_their_rules_one_by_one` — README 도 동일하게 규칙과 직접
  대조 (docstring 과의 미러 비교만으로는 **두 문서가 같이 어긋나면** 통과하므로).
- `test_readme_table_rows_match_the_docstring_row_by_row` — 행 개수가 아니라 **셀 내용**을
  행별 비교.
- `test_readme_source_row_matches_the_constant_directly` — README 소스 행도 상수 직접 대조.

부수 구현 이슈: `requirement (+ documentation via doc rule above)` 같은 셀은 괄호 안이
다른 행으로의 상호참조라 그대로 세면 `documentation` 을 오탐한다 → `_reviewers_named_in()`
이 괄호를 먼저 제거하도록 수정.

## WARNING 2 — `_all_agents()` 미캐시 → **반영**

`_router_safety_values()` 는 `setUpClass` 에서 1회 캐시되는데 `_all_agents()` 는 행마다
subprocess 를 새로 띄우고 있었다. `cls.agents` 로 통일.

## INFO — 1건 반영, 6건 미조치

- **INFO 1 (docstring 이 "재조준을 잡는다" 고 과장) — 반영.** union 검사를 행 단위로
  교체하면서 해당 문구 자체가 실제 동작이 됐고, 옛 한계와 그것이 어떻게 발각됐는지를
  docstring 에 기록했다. `.claude/tests/README.md` 행도 갱신.
- INFO 2·3 (subprocess 인젝션 표면 / `runpy` 부작용) — 조치 불요로 리뷰어가 직접 판정.
- INFO 4 (헬퍼 보일러플레이트, 정규식 결합도, 클래스가 3개 축 담당) — 경미·즉시 조치
  불요로 분류. 축별 클래스 분리는 후속 후보.
- INFO 5 (3번째 커밋의 선제 확장) — "은폐된 스코프 이탈 아님" 으로 리뷰어가 판정. 커밋
  메시지·RESOLUTION 에 이미 "리뷰 발견 아님, 선제 점검" 으로 명시돼 있다.
- INFO 6 (직전 세션 리뷰 산출물 커밋 포함) — CLAUDE.md 규약 부합, 조치 불요.
- INFO 7 (`16_30_52/_retry_state.json` 이 `routing_status: pending` 으로 커밋) — 세션이
  한 turn 안에 완료돼 상태파일이 재작성되지 않은 것. SUMMARY/RESOLUTION 은 `done` 서술로
  정확하며 이번 PR 결함 아님. 참고 기록.

## 중복 테스트 처리

`test_table_row_names_the_real_forced_reviewers` 가 신규 행 단위 테스트의 행 0 검사와
겹치게 됐다. 삭제하는 대신 `test_source_row_reviewers_via_independent_parse` 로 개명하고
의도를 명시했다 — 다른 모든 행 단언이 `_policy_rows` 에 의존하므로, 그 파서가 조용히
잘못된 행을 반환하면 전부 같이 무력화된다. 가장 중요한 행만 정규식이라는 **독립 경로**로
한 번 더 짚는다.

## 검증

- harness suite **448 green** (반영 전 446 → 신규 테스트 3건 순증).
- mutation **6/6 killed**:
  - **G1·G2 = 리뷰어가 재현한 두 갭** (README 소스행 `testing` 삭제 / docstring
    Package행 `documentation` 삭제) — 이제 둘 다 잡힌다.
  - G3 README Package행 `documentation` 삭제 · G4 docstring Docker행
    `security`→`performance` · G5 `_RULES` 재조준 후 두 표 모두 stale · G6 README spec행
    `requirement`→`scope`.

## 수렴 근거 — 전수 mutation sweep

두 라운드 연속으로 이 가드가 자기가 막는 종류의 drift 를 놓쳤으므로(1라운드 CRITICAL,
2라운드 WARNING), 3라운드 리뷰를 또 도는 대신 **재발 모드를 직접 전수 검사**했다.

두 문서의 정책표 **모든 행 × 그 행이 명명한 모든 reviewer** 에 대해 이름 하나씩을 지우는
뮤턴트를 기계적으로 생성해 가드가 잡는지 확인:

    mutants: 32   SURVIVED: 0

이전 두 라운드의 실패는 전부 "특정 행·특정 문서가 무검증" 이었고, 그 클래스가 이제
전수로 닫혔다. 표본 점검이 아니라 조합 전수라 같은 방식의 잔여 구멍은 없다.

## 잔여

없음 (WARNING 2건 + INFO 1건 반영, INFO 6건은 위 사유로 미조치).
