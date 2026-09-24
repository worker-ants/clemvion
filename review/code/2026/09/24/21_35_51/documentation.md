# 문서화(Documentation) 코드 리뷰 — docs-guard-trigger (2라운드, RESOLUTION 확인)

## 검토 배경

이번 diff(33개 파일)는 1라운드(`review/code/2026/09/24/21_16_58`)에서 나온 Warning 4건에 대한
`RESOLUTION.md` 조치(커밋 `32b97f944`)와, 조치 이전 산출물(`21_16_58/*`, `review/consistency/2026/09/24/21_04_26/*`,
`review/consistency/2026/09/24/20_34_01/meta.json` 정정)를 함께 포함한다. 실질적인 신규 소스 변경은
파일 1~6(`.claude/tests/README.md`, `.claude/tests/test_spec_link_checks_scope.py`,
`.github/workflows/spec-link-checks.yml`, `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/docs-guard-trigger.md`)
이고, 나머지(파일 7~33)는 리뷰/컨시스턴시 산출물(읽기 전용 기록)이다.

1라운드 documentation 리뷰(파일 15, `review/code/2026/09/24/21_16_58/documentation.md`)가 지적한
Warning 2건(헤더 stale, CHANGELOG 누락)이 `RESOLUTION.md`(파일 7)에 조치 완료로 기록돼 있어, 저장소를
직접 열어 그 조치가 실제로 반영됐는지, 그리고 새로 추가된 산출물 자체에 새 결함이 없는지를 검증했다.
**저장소에 어떤 뮤테이션도 가하지 않았다** — 전부 `Read`/`grep`/기존 `pytest` 실행(읽기 전용)으로
확인했고, 세션 종료 시점 `git status --short` 는 이 세션 자신의 출력 디렉터리(`review/code/2026/09/24/21_35_51/`)
외에 어떤 변경도 남기지 않았다.

## 검증 결과

- **헤더 stale 수정 확인** — `.github/workflows/spec-link-checks.yml` 최상단(현재 1~29행)을 직접
  읽어 "spec-link-integrity 가드로 검증" / "가드 vitest 하나만" 이라는 옛 진술이 "docs 가드 전체를…
  돌린다" / "docs 가드 vitest 만 도는" 으로 정정돼 있고, 옛 범위는 괄호로 남아 있음을 확인했다(파일 3
  게이트 1~14행). 본문 하단 2026-09-24 단락(게이트 21~32행)과 이제 모순 없음.
- **CHANGELOG 신설 확인** — `CHANGELOG.md` 상단에 "plan/spec 만 바꾼 PR 에서 docs 가드가 하나도 돌지
  않던 것" 항목이 실제로 존재하며(파일 4 게이트 3~29행), 선행 두 항목과 동일한 형식(`## Unreleased —
  <설명>` 반복)을 따른다 — 저장소 기존 관례(`grep '^## ' CHANGELOG.md` 로 10건 이상 같은 패턴 확인)와
  일치한다.
- **`meta.json` scratch 경로 정정 확인** — `review/consistency/2026/09/24/20_34_01/meta.json`(파일 25)이
  세션 전용 scratch 절대경로 대신 저장소 상대경로(`spec/conventions/spec-impl-evidence.md`)로 정정됐고,
  `scope_note` 필드로 사본으로 돌린 사실·이유를 보존했다(게이트 3~4, 12행) — 기록을 지우지 않고
  정정하는 방식으로 적절하다.
- **회귀 테스트 신설·정합성 확인** — `test_spec_link_checks_scope.py`(파일 2)를 전문 확인했다.
  모듈 docstring 이 결함의 배경·두 회귀 형태·근거(`#1387`)·검증 방법(같은 파서 import)을 정확히
  서술하고, 실제 구현(`_docs_guard_run_commands`, 두 테스트 메서드)과 docstring 의 주장이 일치한다.
  실행 확인: `python3 -m pytest .claude/tests/test_spec_link_checks_scope.py -v` → **2 passed, 2
  subtests passed**. 전체 하네스 `python3 -m pytest .claude/tests -q` → **1140 passed, 1257 subtests
  passed** — `RESOLUTION.md`(파일 7) TEST 결과 섹션의 주장과 정확히 일치.
- **README 카탈로그 등재 확인** — `.claude/tests/README.md`(파일 1) 신규 행(게이트 47행)이 새 테스트
  파일의 실제 동작(narrow 단언 2종, `parse_pathspecs_block` import 재사용)을 정확히 요약하고,
  `test_tests_readme_catalog.py`(README 등재를 강제하는 카탈로그 가드)를 포함한 전체 스위트가 통과함을
  확인해 등재 누락이 없음을 검증했다.
- **`PROJECT.md` 동기화 확인** — §문서 링크 검증(파일 5, 게이트 377~388행)이 "docs 가드 전체" 로
  갱신되고 명령 예시도 디렉터리 실행으로 바뀌었으며, `codebase/frontend/src/lib/docs/__tests__/` 경로가
  실제 디렉터리와 일치함을 `ls` 로 확인했다.

## 발견사항

- **[INFO]** plan 체크리스트의 하네스 통과 개수(1138)가 현재 실측치(1140)와 다르다
  - 위치: `plan/in-progress/docs-guard-trigger.md` 게이트 86행 ("하네스 가드 통과 — `python3 -m
    pytest .claude/tests -q` 1138 passed")
  - 상세: 이 체크리스트 항목은 `RESOLUTION.md` 조치(회귀 테스트 2건 신설)가 반영되기 **이전** 시점의
    실측이라 1138 이 기록됐고, 조치 이후 실제로는 1140 이다(직접 재실행으로 확인). `RESOLUTION.md`
    자신의 TEST 결과 섹션은 1140 으로 최신화돼 있어 최종 근거는 정확하지만, plan 파일의 체크박스
    문장 자체는 시점이 지난 숫자를 그대로 담고 있다. 오도할 가능성은 낮다 — plan 체크리스트는
    "그 시점에 이 명령을 돌렸다"는 이력이지 최종 상태 선언이 아니고, 최종 숫자는 같은 PR 의
    `RESOLUTION.md` 에 정확히 남아 있다.
  - 제안: 조치 불요(경미). 굳이 정정하려면 plan 체크박스 문장 옆에 "(RESOLUTION 이후 1140)" 을
    괄호로 덧붙이는 정도로 충분하다.

CRITICAL/WARNING 급 신규 발견 없음. 1라운드에서 지적된 Warning 2건(문서화 관점)은 커밋 `32b97f944`
에서 정확하고 완전하게 조치됐으며, 새로 추가된 회귀 테스트·README 카탈로그 행·CHANGELOG 항목·
`meta.json` 정정 모두 실제 동작과 서술이 일치함을 직접 재현으로 확인했다. 나머지 리뷰/컨시스턴시
산출물(파일 7~33)은 프로젝트 관례(`CLAUDE.md` §정보 저장 위치)에 따라 `review/**` 에 보존되는
읽기 전용 기록이며, 코드 문서화 결함의 대상이 아니다.

## 요약

1라운드 documentation 리뷰가 지적한 두 Warning(워크플로 헤더 stale, CHANGELOG 누락)은 커밋
`32b97f944`에서 정확히 해소됐다 — 헤더 최상단 2줄이 실제 실행 범위(디렉터리 전체)를 반영하도록
갱신됐고, CHANGELOG 에 선례와 동일한 형식의 신규 항목이 추가됐다. 함께 신설된 회귀 테스트
(`test_spec_link_checks_scope.py`)는 docstring 이 결함·근거·검증 방법을 정확히 서술하며 실제 구현과
일치함을 직접 실행으로 확인했고, README 카탈로그 등재·`PROJECT.md` 동기화·`meta.json` scratch 경로
정정도 모두 저장소 실상태와 부합한다. 새로 발견된 것은 plan 체크리스트의 시점이 지난 테스트 개수
표기(1138 vs 현재 1140) 하나뿐이며, 이는 이력 기록의 성격상 오도 가능성이 낮아 조치 불요 수준의
INFO 다. 문서화 관점에서 이 변경 세트를 차단할 사유는 없다.

## 위험도
NONE
