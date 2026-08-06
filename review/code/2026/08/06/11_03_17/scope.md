# 변경 범위(Scope) 리뷰 — round 5

## 검증 방법

프롬프트의 8개 파일은 전부 "전체 파일 컨텍스트"로만 제공되고 diff 블록이 없어, 실제 변경분은
`git diff origin/main..HEAD`(로컬 6개 커밋, PR 전체 범위)로 직접 확인했다. `--stat`으로
`review/code/**`(커밋된 리뷰 산출물, 이 저장소 관행상 정상)를 제외한 코드/설정 변경 파일이
프롬프트가 나열한 8개와 **정확히 일치**함을 먼저 확인했다 — 다른 파일로 새는 변경은 없다.

```
.claude/tests/README.md                            |  13 +-
.claude/tests/test_block_integrity.py              |  24 +-
.claude/tests/test_review_gate_ci.py               | 553 +++++++++++++++++++++
.claude/tests/test_stop_guard_failopen.py          |   4 +
.github/workflows/harness-checks.yml               |   9 +-
.github/workflows/review-gate.yml                  |  74 +++
plan/in-progress/harness-review-gate-ci-backstop.md |  73 ++-
scripts/check-review-gate.py                       | 130 +++++
```

### 발견사항

- **[INFO]** `PyYamlPinsAgreeTest` 는 round 5 작업 범위(전체 문서 정확 일치 + 판정자 행위 검증)
  밖의 부가 하드닝
  - 위치: `.claude/tests/test_review_gate_ci.py:530` (클래스), `:541`
    (`test_every_workflow_pins_the_same_version`)
  - 상세: 이번 라운드의 명시 과제는 "네 번 뚫린 배선 가드를 문서 전체 정확 일치로 반전"과
    "판정자 단일성을 행위로 고정"이다. `PyYamlPinsAgreeTest`는 그와 무관하게 `.github/workflows/*.yml`
    **전체**(`review-gate.yml`·`harness-checks.yml`뿐 아니라 이 PR이 건드리지 않는
    `deps-security-checks.yml` 등도 포함)를 순회해 PyYAML pin 버전이 서로 일치하는지 검사한다.
    클래스 docstring 스스로 "단일 진실화(`constraints.txt`)가 더 낫지만 범위 밖"이라고 적어,
    작성자도 이상적 해법은 이번 범위 밖으로 인지하면서 축소판 체크는 추가했다. 판단을 내리기
    어려운 만큼 CRITICAL/WARNING은 아니고, 테스트 전용 추가라 배선 자체에 위험을 더하지 않는다.
  - 제안: 유지해도 무방하나, PR 설명/커밋 메시지에 "겸사겸사 추가"임을 명시하거나 별도 후속
    항목으로 분리하는 편이 리뷰 추적성에 낫다.

- **[INFO]** `test_block_integrity.py` / `test_stop_guard_failopen.py` 변경은 CI 백스톱
  기능과 무관한 다른 백스톱(Critical 하향 금지)의 기존 가드 버그 수정
  - 위치: `.claude/tests/test_block_integrity.py:640`(`PlanStubsMirrorTheRealInterfaceTest`),
    `:680`(`"\n" in n.value` 마커 자기매칭 배제), `:653`~`:698`(join→per-stub 스코프 변경);
    `.claude/tests/test_stop_guard_failopen.py:49`, `:135`(`push_blocks = False` 추가)
  - 상세: `PlanStubsMirrorTheRealInterfaceTest`는 저장소 전역의 `test_*.py`를 스캔해
    `evaluate_plan`/`evaluate_review` 스텁이 `push_blocks`를 갖는지 확인하는 **기존** 가드다.
    이번 PR에서 다른 파일에 새 스텁을 추가하는 과정에서 이 가드 자체의 두 가지 결함(①가드가
    참조하는 marker 튜플 문자열을 스텁으로 오인, ②파일 단위 join 검사라 한 파일 내 여러 스텁 중
    하나만 조건을 만족해도 통과)이 드러났고, 그 김에 `test_stop_guard_failopen.py`의 기존 스텁
    2곳에 누락돼 있던 `push_blocks`도 함께 채워졌다. CI 백스톱(review-gate.yml/
    check-review-gate.py) 기능과는 직접 관련이 없는 별도 백스톱(`block_integrity`, Stop 훅
    fail-open)의 코드를 건드린다는 점에서 엄밀히는 "요청 범위 밖"이지만, 커밋 메시지(2R)와
    인라인 주석 모두 "가드 두 개가 또 뚫렸다"는 이유를 명시하고, 변경 자체는 좁고(한 클래스 +
    두 줄) 대상 파일의 기존 계약을 유지 보수하는 성격이라 리스크는 낮다.
  - 제안: 조치 불필요. 다만 향후 유사 상황에서는 커밋 메시지에 "부수 발견"임을 한 줄로 명시하는
    관행을 유지할 것.

## 그 외 확인한 항목 (문제 없음)

- `WorkflowWiringTest`의 필드별 비교 → 전체 문서 비교로의 전환(`test_review_gate_ci.py:358`~
  `474`)과 `VerdictComesFromTheGateTest`(`:477`~`527`)는 이번 라운드에 명시적으로 요청된 작업
  그 자체이며, `plan/in-progress/harness-review-gate-ci-backstop.md:20`~`40`(§배선 가드) 서술과
  1:1로 대응한다. over-engineering 논란은 있을 수 있으나(4라운드에 걸친 정적 우회 시도 이력이
  근거) 그것은 "품질/견고성" 관점이지 "요청 범위 이탈"이 아니다.
- `.github/workflows/harness-checks.yml`의 `paths:`에 `scripts/check-review-gate.py` 추가와
  주석 재작성(`:1`~`9`, `:55`~`58` 부근)은 신규 파일이 CI에서 실제로 트리거되게 하는 필수
  배선이며, 기존 6회 반복된 실패 클래스(파일 추가 후 harness-checks 트리거 누락)를 막는
  목적과 정확히 일치한다.
- `.claude/tests/README.md`의 수정은 `test_review_gate_ci.py` 신규 행 추가와 PyYAML 예외
  서술 갱신뿐으로, 포맷팅·재정렬·무관한 문구 수정은 없다.
- `plan/in-progress/harness-review-gate-ci-backstop.md`에 추가된 §배선 가드 표는 라운드별
  우회 이력을 기록하는 것으로, 실제 코드 변경(라운드 4→5)과 서술이 정합한다(별도 근거 확인:
  `git log -S`로 각 라운드 커밋 메시지와 표 내용 대조 완료).
- 사용하지 않는 import, 죽은 코드, 불필요한 주석 삭제/추가, 포맷팅-only 변경, 설정 파일의
  의도치 않은 부수 변경은 발견되지 않았다.

## 요약

이번 라운드(round 5)의 diff는 `git diff origin/main..HEAD --stat`으로 프롬프트가 나열한 8개
파일과 정확히 일치함을 확인했고, 다른 파일로의 누출은 없다. 핵심 변경(`WorkflowWiringTest`의
필드별→전체 문서 정확 일치 전환, `VerdictComesFromTheGateTest`)은 이번 라운드에 명시적으로
요청된 작업 그 자체다. 두 가지 경미한 부가 항목 — ①타 워크플로까지 훑는 `PyYamlPinsAgreeTest`
신설, ②CI 백스톱과 무관한 기존 스텁-완결성 가드(`PlanStubsMirrorTheRealInterfaceTest`)의 버그
수정 — 은 "요청 이상의 변경"에 해당하나 둘 다 테스트 전용이고, 코드 내 주석으로 근거가
분명하며, 대상 배선의 리스크를 늘리지 않는다. 불필요한 리팩토링, 포맷팅 뒤섞임, 무관한
파일·설정 변경, 기능 확장(over-engineering이라 부를 수 있는 부분은 있으나 이는 범위 문제가
아니라 반복 방어의 정당한 결과)은 관찰되지 않았다.

## 위험도

LOW
