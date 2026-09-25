# 변경 범위(Scope) 리뷰 — harness-probe-isolation

## 검토 방법

`git diff origin/main...HEAD --stat` (17 files, +747/-108)로 프롬프트 번들과 실제 diff 가 정확히
일치함을 확인했다. 저장소 파일은 읽기만 했고 뮤테이션·쓰기는 하지 않았다(`git status --short` 상
변경 없음, 확인 완료).

## 발견사항

- **[INFO]** 트래커가 "둘" 이라 적은 대상을 넷으로 넓혔다 — 문서화된 정당한 확장
  - 위치: `plan/in-progress/harness-probe-isolation.md:18` (`## A. 전수 — 트래커는 «둘» 이라
    했지만 넷이다`)
  - 상세: 원 트래커 항목(`spec-draft-nullable-notation-followups.md`)은 "하네스 테스트 **둘**이
    실제 저장소 트리에 프로브를 쓴다"만 지목했는데, 이 PR 은 `test_router_decision_trust.py` ·
    `test_consistency_target_validation.py` 두 파일을 추가로 발견해 함께 고쳤다. 감사 훅
    census + mtime census 두 가지 실측으로 전수를 재확인하고 그 근거를 §A 표에 남겼으므로,
    이것은 은밀한 스코프 확장이 아니라 조사 후 문서화된 확장이다. 단, "변경 범위" 관점에서는
    원 트래커 문구만 보고 diff 를 판단하면 놓칠 수 있는 지점이라 기록해 둔다.
  - 제안: 조치 불필요 — 이미 plan 본문(§A)에 근거가 있고 커밋 메시지 `84782583e`("프로브
    테스트 넷이 이 체크아웃에 쓰지 않게 한다")도 "넷"을 명시한다.

- **[INFO]** 체크인된 consistency-check 산출물이 최종 코드와 다른 함수명(`make_probe_repo`)을
  인용한다 — 시점 스냅샷이라 정상
  - 위치: `review/consistency/2026/09/25/09_56_00/SUMMARY.md:22-23`,
    `review/consistency/2026/09/25/09_56_00/plan_coherence.md:18,34,40`,
    `review/consistency/2026/09/25/09_56_00/convention_compliance.md:43` — 모두
    `make_probe_repo` 를 인용. 실제 구현은 `.claude/tests/_harness.py:138`
    `make_temp_repo_copy`.
  - 상세: 사전 `--plan` 검토(09:56:00)가 돌 때는 헬퍼 이름이 `make_probe_repo` 였고, 그 검토의
    WARNING 2("기존 `make_temp_git_repo` 와 이름·역할이 겹침")를 받아들여 개발자가
    `make_temp_repo_copy` 로 개명했다(`plan/in-progress/harness-probe-isolation.md:143` §G
    W2 "반영" 항목에 명시). 리뷰 세션 파일은 그 순간의 스냅샷이므로 사후에 개명해도 고치지
    않는 것이 이 저장소의 관례(리뷰 산출물은 사후 편집하지 않는다)와 일치한다. 스코프 위반이
    아니라 정상적인 이력 기록이다.
  - 제안: 조치 불필요.

- **[INFO]** 각 파일 변경이 "프로브 격리" 단일 목적에 정확히 묶여 있다
  - `.claude/tests/README.md` / `_harness.py` / 4개 테스트 파일: 전부 "이 체크아웃에 쓰지
    않는다"는 동일 축의 변경이며, 무관한 리팩터링·포맷팅·주석 정리·임포트 정리가 섞여 있지
    않다. 오히려 이제 쓰지 않는 `import shutil`(`test_consistency_spec_draft_snapshot.py`) ·
    `import os`(`test_router_decision_trust.py` 의 한 테스트 함수)가 제거된 것도 격리 리팩터의
    직접 부산물이지 드라이브바이 정리가 아니다.
  - `CHANGELOG.md` 항목, `plan/in-progress/harness-probe-isolation.md`(신규 plan),
    `plan/in-progress/harness-review-gate-followups.md`(3줄 상호참조 추가),
    `review/consistency/2026/09/25/09_56_00/**`(사전 검토 세션 산출물)는 모두 이 저장소의
    표준 워크플로가 요구하는 부산물(CHANGELOG 항목 의무, plan 추적, harness-only 변경의
    `--plan` 사전 검토)이지 무관한 파일 수정이 아니다.

## 요약

17개 파일 전부가 "병렬 하네스 실행이 실제 저장소 트리에 프로브를 남긴다"는 단일 문제를 향해
묶여 있다. 코드 변경(README·`_harness.py`·테스트 4종)은 격리 메커니즘 도입에 정확히 국한되고
불필요한 리팩터링·기능 확장·무관한 포맷팅/주석/임포트 변경이 섞이지 않았다. CHANGELOG·plan·
consistency 세션 산출물은 모두 이 저장소가 관례로 요구하는 워크플로 부산물이다. 트래커 대비
대상 확장("둘"→"넷")과 체크인된 리뷰 산출물의 옛 함수명 인용은 둘 다 스코프 이탈이 아니라
plan 본문에 실측·근거로 기록된 정당한 사항이라 INFO 로만 남긴다.

## 위험도

NONE
