# 변경 범위(Scope) 리뷰

## 대상

`origin/main...HEAD` diff, 9개 code 파일 (review/** 산출물 제외):

- `.claude/tests/README.md`
- `.claude/tests/test_block_integrity.py`
- `.claude/tests/test_review_gate_ci.py` (신규)
- `.claude/tests/test_stop_guard_failopen.py`
- `.claude/tests/test_workflow_yaml_structure.py`
- `.github/workflows/harness-checks.yml`
- `.github/workflows/review-gate.yml` (신규)
- `plan/in-progress/harness-review-gate-ci-backstop.md`
- `scripts/check-review-gate.py` (신규)

의도된 범위: "리뷰 게이트의 훅-독립 CI 백스톱" 도입 + 배선 가드를 라운드마다 발견된 우회에 맞춰
경화(1R~6R 누적). `git diff --stat origin/main...HEAD -- . | grep -v '^ review/'` 로 확인한
비-리뷰산출물 변경분은 위 9개 파일뿐이며, 각 파일을 원본과 대조해 다음을 확인했다.

## 발견사항

- **[INFO]** `PyYamlPinsAgreeTest` (워크플로 간 PyYAML pin drift 가드)는 "워크플로 배선 우회 경화"라는
  이번 라운드 표제와 직접적 인과관계가 없어 보이지만, `git log -S`로 도입 커밋(`eeaf94503`, 4R)의
  메시지를 확인하면 `[W4] pyyaml pin 이 세 곳에 손으로 중복돼 있고 묶는 테스트가 없었다 — 수렴 가드
  추가`로, 같은 라운드 리뷰에서 나온 WARNING 발견을 그 자리에서 처분한 것이다. 이 저장소의 표준
  절차("구현 완료 후 리뷰 발견 fix 는 같은 턴에 처리")를 따른 것이므로 범위 위반은 아니다 — 다만
  워크플로 우회 방지축과는 성격이 다른 관심사(SoT 드리프트)라서, 별도 커밋으로 분리했더라면 더
  명확했을 것이라는 점만 기록해 둔다.
  - 위치: `.claude/tests/test_review_gate_ci.py` — `PyYamlPinsAgreeTest` 클래스 (게이트 숫자 561~590행, 파일 9번째 아님 — 파일 3번째: `.claude/tests/test_review_gate_ci.py` 게이트 561|)
  - 상세: 위 서술대로, 근거는 있으나 커밋 경계상 성격이 다른 두 관심사(배선 우회 방지 vs 의존성
    버전 drift)가 하나의 라운드 커밋에 섞였다.
  - 제안: 조치 불필요 (이미 근거가 커밋 로그와 파일 docstring에 남아 있음). 향후 유사 라운드에서는
    "이번 라운드가 고치는 CRITICAL 목록"과 "부수 WARNING 목록"을 커밋 메시지에서 계속 분리해 표기하는
    현재 관행을 유지할 것.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md`의 "§배선 가드 — 네 라운드에
  걸친 경화 이력" 표(게이트 24~30행)가 1R~4R까지만 기록하고, 이미 별도 커밋(`8ce96e72b`,
  "CI 백스톱 5R")으로 반영된 5R(harness-checks.yml 전 워크플로 확대, discovery 명령 고정,
  environ/getenv/argv 차단)은 plan 문서에 반영되지 않았다. 이는 "범위 밖 변경"이 아니라 반대로
  "실제로 한 작업이 plan에 누락"된 것이라 scope 관점의 창의(추가) 위반은 아니지만, 서술이 실제
  코드 상태보다 뒤처져 있다는 사실은 기록해 둔다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` 게이트 17~30행 (banner 표)
  - 상세: 표의 마지막 행이 "1R~4R 진행 중"으로 멈춰 있으나 `test_workflow_yaml_structure.py`의
    `test_no_guard_workflow_swallows_its_own_failure` / `test_job_conditions_are_registered` /
    `test_the_harness_suite_is_invoked_over_every_test_file`, 그리고
    `test_review_gate_ci.py`의 environ/getenv/argv 차단 + hostile-env 행위 테스트는 모두 5R 커밋에서
    landed된 것으로 코드에는 반영돼 있다.
  - 제안: scope 항목은 아니므로 발견만 남긴다 (문서 동기화는 별도 축 — 일관성 검토자 영역에 더
    가깝다).

- 그 외 전 파일 검토 결과 별도 발견 없음. 아래 근거로 판단했다.
  - `README.md` diff(13줄)는 신규 `test_review_gate_ci.py`용 표 행 추가와 PyYAML 예외 문구를
    "두 파일"→"파일 개수를 세지 않는 서술"로 일반화한 것뿐 — 신규 파일 추가에 따른 필연적 갱신.
  - `test_block_integrity.py` diff(24줄)는 `PlanStubsMirrorTheRealInterfaceTest`를 "파일 단위
    join 검사"에서 "스텁 단위 검사"로 좁힌 변경으로, 이번 라운드에서 `test_review_gate_ci.py` /
    `test_stop_guard_failopen.py`에 새로 추가된 손으로 쓴 스텁 리터럴들을 그 가드가 실제로
    검사하게 만드는 데 필요한 수정이다. 무관한 리팩토링이 아니라 새 스텁 도입의 직접 결과.
  - `test_stop_guard_failopen.py` diff(4줄)는 위 가드 강화로 드러난, 기존 스텁 2곳에 빠져 있던
    `push_blocks` 필드를 채운 것 — 새로 강화된 불변식을 만족시키기 위한 최소 수정.
  - `harness-checks.yml` diff(14줄)는 신규 `scripts/check-review-gate.py` / `test_review_gate_ci.py`를
    CI trigger `paths:`에 등재하는 주석+엔트리뿐 — 신규 파일 추가에 따른 필연적 갱신이며 다른
    필드는 손대지 않았다.
  - `review-gate.yml` / `scripts/check-review-gate.py` / `test_review_gate_ci.py`는 전량 신규
    파일로, 기존 코드를 건드리지 않는다.
  - 포맷팅·주석·임포트 축: diff 전역에서 로직과 무관한 개행/공백 재정렬, 불필요한 주석 삽입/삭제,
    미사용 import 추가는 발견되지 않았다. `test_review_gate_ci.py`의 import 목록(`ast, os, shutil,
    subprocess, sys, tempfile, unittest, _harness`)은 파일 내 모든 클래스가 실사용한다.
  - 설정 변경 축: `.github/workflows/*.yml` 두 파일의 변경은 모두 이번 기능(CI 백스톱)과 직접
    관련된 `paths:`/`if:`/`continue-on-error` 등재이며, 무관한 워크플로 설정(예: 다른 job의
    `runs-on`, `timeout-minutes` 등)은 손대지 않았다.

## 요약

`git diff --stat origin/main...HEAD -- . | grep -v '^ review/'`로 확인한 비-리뷰산출물 변경은 9개
파일이며, 전부가 "리뷰 게이트 CI 백스톱 도입 + 배선 우회 경화"라는 표제 작업에 직접 종속된다 —
3개 신규 파일(워크플로, 스크립트, 테스트)과 그 신규 파일이 요구하는 필연적 갱신(CI trigger 등재,
README 표 행, 강화된 스텁-검증 가드에 맞춘 기존 스텁 보정)뿐이다. 무관한 리팩토링·기능 확장·
포맷팅 잡음·불필요한 주석/임포트 변경은 발견되지 않았다. 유일하게 경계선에 있는 것은
`PyYamlPinsAgreeTest`(동일 라운드 리뷰 WARNING 처분, 정당화됨)와 plan 문서가 5R 이후 갱신되지
않은 점(범위 위반이 아니라 문서 지연 — 일관성 검토 영역)이며, 둘 다 INFO 수준으로만 기록한다.

## 위험도

NONE
