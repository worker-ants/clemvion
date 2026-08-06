# 변경 범위(Scope) Review — round 11

## 조사 방법

프롬프트에 diff 섹션이 없어(전 파일이 "전체 파일 컨텍스트"로만 제공됨) `git merge-base HEAD origin/main`
기준으로 15개 대상 파일 전체를 직접 `git diff`로 재구성해 무엇이 이 브랜치의 변경분인지 확정한 뒤,
각 변경을 `plan/in-progress/harness-review-gate-ci-backstop.md`의 1R~10R 이력 서술과 대조했다.
대부분(git_probe 추출, branch_guard/plan_guard 위임화, workflow 배선 가드 확대, check-review-gate.py
본체, test_review_gate_ci.py 전체)은 그 plan 문서가 라운드별로 명시적으로 기록한 항목과 1:1로
대응하며, 별도 지적할 스코프 이탈이 없었다. 아래 2건만 문서화되지 않은 경계선 사례로 남는다.

## 발견사항

- **[WARNING]** git_probe 통합(9R/10R)이 남긴 죽은 조건문 — `if True:`
  - 위치: `.claude/_shared/git_probe.py:140`
  - 상세: `_default_branch()`가 예전 `review_guard.py`/`plan_guard.py`에서 `_origin_default_branch`를
    `try/except ImportError`로 선택적 import하던 시절의 방어 코드(`if _origin_default_branch is not None:`)를
    그대로 옮기면서 조건만 `if True:`로 남았다. 이제 `_origin_default_branch`는 같은 모듈
    (`git_probe.py`) 안에 항상 정의돼 있으므로 이 조건은 절대 거짓이 될 수 없고, 들여쓰기 한 단만
    남은 죽은 분기다. 동작에는 영향이 없지만 이번 라운드(9a7b28764, `git log -S "if True:"` 확인)의
    통합 작업 자체가 만든 정리 잔재이며, "손-동기 사본을 줄인다"는 이 PR의 취지와 반대로 읽는 사람에게
    "왜 여기 조건이 있지"라는 불필요한 질문을 남긴다.
  - 제안: `if True:` 줄을 지우고 `try:` 블록을 한 단 내어쓰기(dedent)한다. 순수 코드 정리이므로
    별도 논의 없이 이번 라운드에서 바로 정리 가능.

- **[WARNING]** `ResolutionMarkerPathIsConsistentTest` — 이 티켓(CI 백스톱)과 무관한 서브시스템의
  결함 수정이 동봉됨
  - 위치: `.claude/tests/test_review_guard_hardening.py` — 클래스 `ResolutionMarkerPathIsConsistentTest`
    (파일이 45,882자 초과로 게이트 없이 프롬프트에서 생략되어 클래스명으로 기재. 직접 Read + `git log -S`
    로 확인: 라운드 10 커밋 `9a7b28764`에서 신규 추가, 커밋 메시지 `[W10]`)
  - 상세: 이 테스트는 `review_guard.RESOLUTION_MARKER_SUBDIR`(`.claude/state/resolution_in_flight`)가
    `mark_resolution_in_flight.py` / `clear_resolution_in_flight.py` / 이 테스트 헬퍼 네 곳에 손으로
    복제돼 있다는 사실을 고정한다. 이 마커는 "resolution-applier fix 진행 중 Stop 리뷰 nudge 억제"
    기능(#699, 이 브랜치와 무관하게 이미 origin/main에 존재)이고, `scripts/check-review-gate.py`나
    `.github/workflows/review-gate.yml`, `git_probe.py` 어디에서도 참조되지 않는다
    (`grep -rn "RESOLUTION_MARKER\|resolution_in_flight"` 실측 — CI 백스톱 3파일에 0건).
    즉 이 티켓의 주제("훅-독립 CI 백스톱")와 코드 경로가 완전히 분리된, 별개 기능의 잠복 결함이다.
    커밋 메시지에는 "10R 리뷰어가 뮤테이션으로 디렉터리명을 바꿔도 111개 테스트가 GREEN임을 실증"
    이라고 투명하게 적혀 있어 은폐된 변경은 아니고, 이 프로젝트의 "구현 완료 후 리뷰 발견 즉시 처분"
    관행과도 부합한다 — 다만 `plan/in-progress/harness-review-gate-ci-backstop.md`는 다른 모든 라운드
    발견(1R~10R, 관측 1·2, 재발관측 8번째 등)을 표로 촘촘히 기록해 왔는데 이 항목만 그 배너에
    반영되지 않았다(`grep -n "RESOLUTION_MARKER\|resolution_in_flight\|마커" plan/...md` → 0건).
  - 제안: 기능적으로 문제는 없으므로 되돌릴 필요는 없다. 다만 plan 배너의 라운드 10 행(또는 별도
    한 줄)에 "W10: resolution 마커 4중 손-동기 정합성 테스트 추가 — 티켓 주제와 무관한 별도 결함,
    review 중 발견해 즉시 처분"이라고 짧게 남겨, 이후 이 티켓의 diff를 "CI 백스톱 전용"으로
    가정하고 재검토하는 사람이 놀라지 않게 한다.

## 요약

브랜치 전체 diff(15개 파일, ~1,954줄)를 origin/main 대비로 재구성해 대조한 결과, 절대다수의 변경은
`plan/in-progress/harness-review-gate-ci-backstop.md`가 라운드별로 명시한 "판정자 단일성 확보"와
"손-동기 사본 제거"라는 티켓의 정착된 주제 안에 있다 — git_probe 공유 모듈 추출, branch_guard/plan_guard의
위임화, workflow 배선 가드를 파일 단위에서 전 워크플로 단위로 넓힌 것, `harness-checks.yml`
paths/permissions 갱신 모두 이전 라운드가 겪은 우회의 직접적 후속 조치로 문서화돼 있어 임의 확장으로
보기 어렵다. 다만 두 가지 경계 사례가 있다: (1) 이번 라운드 리팩토링 자체가 남긴 죽은 `if True:` 잔재는
정리가 안 끝난 채 커밋됐고, (2) `ResolutionMarkerPathIsConsistentTest`는 커밋 메시지에는 투명하게
밝혀졌지만 이 티켓의 주제(CI 백스톱)와 코드 경로가 전혀 겹치지 않는 별개 서브시스템의 수정이며 plan
문서 이력에는 빠져 있다. 둘 다 기능적 위험이나 우회 가능성은 없고, CRITICAL로 올릴 사안이 아니다.

## 위험도

LOW
