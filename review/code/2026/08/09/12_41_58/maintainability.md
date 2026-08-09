### 발견사항

- **[WARNING]** `scripts/ci-paths-changed.sh` — "fail-safe 로 `true` 를 emit 하고 종료" 3줄 블록(`echo "!! ...(fail-safe)."`/`emit true`/`exit 0`)이 5곳에서 거의 동일하게 반복된다.
  - 위치: `scripts/ci-paths-changed.sh:66-68`(push 신규 브랜치), `72-74`(비-PR/비-push 이벤트), `79-81`(SHA 부재), `86-88`(merge-base 실패), `92-94`(git diff 실패)
  - 상세: 이미 파일 안에 `emit()` 이라는 소형 헬퍼가 있는데(`42-45`), 정작 더 자주 반복되는 "메시지 출력 + `emit true` + `exit 0`" 패턴은 추출되지 않고 5번 손으로 복제됐다. 이 스크립트는 required check 데드락 해소의 핵심 판정자라 신뢰도가 중요한데, 다섯 곳 중 한 곳만 메시지 포맷이나 종료 로직을 바꾸고 나머지를 놓치는 실수가 나기 쉬운 형태다(예: 향후 종료 코드를 구분해야 하는 요구가 생기면 5곳을 각각 고쳐야 한다).
  - 제안: `fail_safe() { echo "!! $1 — 검사를 수행한다(fail-safe)."; emit true; exit 0; }` 같은 헬퍼를 `emit()` 바로 아래 추가하고 5곳을 `fail_safe "push before=0…0 (신규 브랜치)"` 형태의 한 줄 호출로 교체하면 ~15줄이 ~5줄로 줄고 다섯 지점의 동작이 항상 동기화된다.

- **[INFO]** 두 워크플로에 동일한 2줄 근거 주석 + 동일한 "무관한 변경 — 검사 생략" no-op 스텝이 각각 3회/1회, 합계 4회 그대로 복제되어 있다.
  - 위치: `.github/workflows/deps-security-checks.yml:76-78`·`102-104`·`129-131`(주석), `:82-84`·`108-110`·`135-137`(no-op 스텝) / `.github/workflows/frontend-checks.yml:57-59`(주석), `:63-65`(no-op 스텝)
  - 상세: `changes` 잡을 스텝마다 다시 게이팅해야 하는 것은 GitHub Actions 자체의 제약이라 불가피한 반복이지만, 여기 붙은 **설명 주석**과 **no-op 안내 스텝**까지 워드 단위로 복제된 것은 그 제약과 무관한 문서 중복이다 — 근거 문구가 바뀌면 4곳을 손으로 동기화해야 한다. 이 이슈는 architecture 리뷰(1차, `review/code/2026/08/09/11_40_34/architecture.md`)가 이미 "changes 잡 wiring 복제"로 지적했고 plan(`plan/in-progress/ci-required-check-skip-jobs.md` §후속)에 "3번째 워크플로 전환 시점에 reusable workflow 로 추출" 로 명시 추적 중이다. 재차 WARNING 으로 올리지는 않되, 그 추출 범위에 이 주석/no-op 스텝까지 포함하도록 상기시킬 가치는 있다.
  - 제안: 조치 불요(이미 추적됨). 3번째 전환 시 reusable workflow 로 뺄 때 이 주석·no-op 스텝 텍스트도 함께 파라미터화할 것.

- **[INFO]** `scripts/ci-paths-changed.sh` 의 `case "${GITHUB_EVENT_NAME:-}" in` 문에서 분기별 제어 흐름 스타일이 섞여 있다.
  - 위치: `scripts/ci-paths-changed.sh:56-76`
  - 상세: `pull_request)` 분기는 변수만 채우고 `esac` 이후로 실행이 이어지는 반면, `push)` 분기는 조건부로(`BASE_SHA` 가 all-zero 일 때) `case` 안에서 곧장 `exit 0` 하고, `*)` 기본 분기는 무조건 `case` 안에서 `exit 0` 한다. "이 분기는 계속 흐른다"와 "이 분기는 여기서 끝난다"가 섞여 있어, 함수 없이 스크립트를 위에서 아래로 읽는 독자가 각 분기를 개별적으로 추적해야 실행이 `esac` 이후로 이어지는지 판단할 수 있다. 현재는 뮤테이션 테스트로 동작이 고정돼 있어 버그는 아니고 순수 가독성 이슈다.
  - 제안: 심각하지 않으므로 즉시 조치 불요. 후속 리팩터링 시 `pull_request)` 분기에도 "여기만 아래로 흘러간다"는 한 줄 주석을 남기거나, 판정 로직을 함수로 뽑아 `return`/`echo` 로 명시적 결과를 반환하는 형태로 정리하면 좋다.

- **[INFO]** `.claude/tests/test_ci_paths_changed.py` 의 `git()` 헬퍼(임시 저장소용 subprocess 호출)와 `run_script()` 헬퍼가 `PATH="/usr/bin:/bin:/usr/local/bin"` 와 `GIT_CEILING_DIRECTORIES` 를 각각 독립적으로 하드코딩한다.
  - 위치: `.claude/tests/test_ci_paths_changed.py:29-38`(`git()` 의 `env=` 딕셔너리), `:40-56`(`run_script()` 의 `env` 딕셔너리, 특히 `44-49`)
  - 상세: 두 헬퍼가 같은 "안전한 최소 PATH + ceiling 디렉터리" 정책을 공유하지만 코드로 묶여 있지 않다. 지금은 두 곳 다 같은 값이라 문제가 없지만, 향후 셋 중 하나만(예: PATH 에 항목 추가) 갱신되면 두 헬퍼가 서로 다른 환경에서 git 을 실행하게 되어 재현 어려운 테스트 불일치를 만들 수 있다.
  - 제안: `_BASE_ENV = {"PATH": "/usr/bin:/bin:/usr/local/bin"}` 같은 모듈 상수를 만들어 두 곳에서 `{**_BASE_ENV, "GIT_CEILING_DIRECTORIES": ...}` 형태로 합성하면 단일 진실 지점이 된다. 우선순위는 낮음(테스트 전용 코드, 현재 값 일치).

### 요약

핵심 변경(`scripts/ci-paths-changed.sh` 판정 스크립트, 두 워크플로의 skip-job 전환, 두 신규 테스트 파일, `test_workflow_yaml_structure.py` 의 예외 규칙 추가)은 전반적으로 가독성이 높고 함수/테스트 메서드가 짧게 유지되며, 조건문 중첩도 얕고 매직 넘버도 거의 없다(`timeout-minutes: 3` 같은 값은 관례적 수준). 네이밍은 저장소 컨벤션(`*Test` 접미사, 등록부 상수 `_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP`)을 잘 따르고, README 카탈로그도 새 테스트 두 건을 반영해 최신 상태다. 유일하게 실질적인 개선 여지는 `ci-paths-changed.sh` 자체 내부의 "fail-safe emit+exit" 3줄 블록이 5회 복제된 것으로, 헬퍼 함수 하나로 쉽게 정리 가능하다. 나머지 워크플로 YAML 의 주석/no-op 스텝 중복은 이미 이전 리뷰 라운드에서 발견되어 plan 에 명시적으로 추적 중이므로 재차 차단 사유로 삼지 않았다. Critical 급 유지보수성 문제는 없다.

### 위험도
LOW
