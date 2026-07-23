# 변경 범위(Scope) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`, `.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/23/{16_55_04,17_22_18}/*`

## 확인 방법

`review/code/.../_prompts/scope.md` 페이로드는 크기 제한으로 파일 1(`guard_review_before_push.py`)과 파일 3(`test_guard_review_before_push_main.py`)의 diff 본문을 생략했으므로, 실제 워크트리에서 `git diff origin/main..HEAD`(3-commit 범위: `dd4311678`→`e617a19a0`→`af849ba25`)를 직접 열어 전체 diff·커밋 메시지·plan 문서·README 를 대조했다.

## 발견사항

- **[INFO]** 커밋 3개가 하나의 §E 기능을 "구현 → 리뷰 라운드1 수정 → 리뷰 라운드2 수정"으로 순차 확장
  - 위치: `dd4311678`(구현) / `e617a19a0`(16_55_04 Warning 9건 반영) / `af849ba25`(17_22_18 Critical 1 + Warning 5 반영)
  - 상세: 세 커밋 모두 plan `§E`(fail-open 관측가능화) 범위 안이며, 후속 두 커밋은 각각 직전 리뷰 세션(`16_55_04`, `17_22_18`)이 지적한 항목에 1:1로 대응한다(커밋 메시지가 W1~W9, CRITICAL/W2/W3 을 항목별로 나열). 이는 본 저장소 CLAUDE.md 가 명시한 "구현 완료 후 `/ai-review` + Critical/Warning fix 는 상시 강제 의무" 워크플로 그대로이며, 임의의 추가 기능·무관 리팩터가 섞여 있지 않다.
  - 제안: 해당 없음(정상 워크플로).

- **[INFO]** `main()` → `_run_gates()`/`_Outcome` 클래스 분리는 리팩터처럼 보이지만 기능 요구사항의 직접 파생물
  - 위치: `.claude/hooks/guard_review_before_push.py` (`_Outcome` 클래스, `_run_gates()`)
  - 상세: §E 요구사항은 "차단 경로를 포함한 모든 종료 경로에서 관측이 실행"되어야 하므로 `main()` 전체를 `try/finally` 로 감싸야 하고, 게이트별 `degraded`/`answered`/`bypassed` 3분류를 게이트 실행부와 리포팅부 사이에서 전달할 매개체가 필요하다. `main()` 분해와 출력 파라미터→객체(`_Outcome`) 전환은 이 요구사항을 구현하기 위한 최소 구조 변경이며, 관련 없는 코드 정리가 아니다.
  - 제안: 해당 없음.

- **[INFO]** 리뷰 산출물(`review/code/2026/07/23/16_55_04/*`, `17_22_18/*`) 커밋은 관례에 부합
  - 위치: 두 세션 디렉토리의 `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/각 reviewer `.md`
  - 상세: `git status`/`git log` 대조 결과 이번 diff 에 포함된 파일은 실제로 §E 작업 세션 중 생성된 리뷰 산출물뿐이며, 무관한 area 의 review 디렉토리나 과거 세션 잔재는 포함돼 있지 않다. CLAUDE.md·MEMORY 모두 "review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋" 을 명시하므로 이는 scope violation 이 아니다.
  - 제안: 해당 없음.

- **[INFO]** 임포트·포맷팅·주석 변경 중 무관한 항목 없음
  - 위치: 전체 diff
  - 상세: `git diff --ignore-all-space` 결과와 일반 diff 결과의 라인 수 차이가 미미해(273→256줄) 의미 없는 공백/개행 재포맷팅이 실질 변경과 섞여 있지 않음을 확인했다. import 문 추가/삭제도 0건(문자열 "import" 매칭 1건은 신규 docstring 내 단어일 뿐 실제 import 라인 아님). `.claude/tests/README.md`/plan 체크리스트 diff 도 이번 §E 구현 내용만 정확히 반영하며 다른 트래커 항목(F, G, I 등)은 컨텍스트 라인으로만 등장하고 실제로 수정되지 않았다.
  - 제안: 해당 없음.

- **[INFO]** (참고) 이전 라운드가 발견했던 파일 끝 `if __name__ == "__main__":` 중복은 현재 HEAD 에서 이미 해소됨
  - 위치: `.claude/hooks/guard_review_before_push.py:583` (`grep -n '__main__'` 결과 1건만 존재)
  - 상세: `16_55_04` 라운드에서 다수 reviewer(1개는 CRITICAL)가 지적한 diff 정리 누락(중복 진입점 블록)은 `e617a19a0` 커밋의 W1 항목으로 이미 제거되어 현재 diff 최종 상태에는 존재하지 않는다. 이번 라운드(`17_51_46`) 관점에서는 재지적할 잔여 결함이 아니다.
  - 제안: 해당 없음(확인용 기록).

## 요약

3개 커밋(`dd4311678`/`e617a19a0`/`af849ba25`) 전체가 plan `harness-guard-followups.md` §E(fail-open 관측가능화) 단일 범위 안에 있으며, 코드(`guard_review_before_push.py`)·테스트(`test_guard_review_before_push_main.py`)·문서(`tests/README.md`, plan 체크리스트)·리뷰 산출물(`review/code/**`) 모두 이 기능과 직접 연결된다. `main()`→`_run_gates()`/`_Outcome` 구조 변경은 "모든 종료 경로에서 관측 보장"이라는 요구사항의 필연적 파생이지 무관한 리팩터가 아니며, 후속 두 커밋은 직전 리뷰 세션이 지적한 항목에만 정밀 대응한다(항목별 1:1 매핑이 커밋 메시지에서 확인됨). 임포트·포맷팅·주석의 무관한 변경, 요청 밖 기능 확장, 설정 파일 drift 는 발견되지 않았다. 리뷰 산출물 커밋도 저장소 관례에 부합한다.

## 위험도
NONE
