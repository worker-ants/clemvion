# 유지보수성(Maintainability) 리뷰 — harness-probe-isolation

리뷰 대상은 `.claude/tests/` 하네스 4개 테스트 파일 + `_harness.py` 신규 헬퍼
`make_temp_repo_copy` + 관련 문서(`README.md`, `CHANGELOG.md`, plan 문서)다.
`review/consistency/2026/09/25/09_56_00/**` 는 이 plan 이 스스로를 target 으로 돌린
consistency-check 산출물(생성 리포트)이라 유지보수성 코드 리뷰 대상에서 제외했다.

## 발견사항

- **[WARNING]** `_harness.make_temp_repo_copy(...)` 부트스트랩 스니펫이 서로 다른
  테스트 5곳에서 인자까지 완전히 동일하게 반복된다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:641, 679, 717, 771, 876`
    (모두 `root = str(_harness.make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/5-system"))`)
  - 상세: 다섯 곳 모두 `import os, tempfile` → `with tempfile.TemporaryDirectory() as tmp:`
    → `_harness.make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/5-system")` 3줄
    보일러플레이트를 문자 그대로 반복한다. `_harness.py` 상단 주석(169~180행)이 밝히듯
    이 파일은 "서로 44~70% 만 비슷한" 오케스트레이터 프리앰블은 일부러 통합하지 않는
    철학을 갖고 있지만, 이 다섯 곳은 그 경우와 달리 **바이트 단위로 완전히 동일**하다.
    이번 PR 이 다섯 곳을 전부 손댄 김에 `_harness` 쪽에 문자열 상수(예:
    `REPO_COPY_SPEC5_SNIPPET = 'root = str(_harness.make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/5-system"))'`)
    로 뽑아 각 스니펫에 삽입했다면, 향후 `subtrees` 인자나 경로 구성이 바뀔 때 다섯 곳을
    각각 손으로 맞추다 하나를 놓치는 drift 를 원천 차단했을 것이다. 다만 이 중복은
    이번 PR 이 새로 만든 것이 아니라 고치기 전 `cp` 백업/복원 패턴에서도 (더 적은 개수로)
    이미 존재했던 구조를 그대로 계승한 것이다 — 그래서 CRITICAL 이 아니라 WARNING 이다.
  - 제안: `_harness.py` 에 스니펫 상수를 하나 두고 다섯 호출부가 그것을 `.format()` 또는
    문자열 삽입으로 재사용하게 하거나, 최소한 다섯 곳 중 하나가 바뀌면 나머지도 함께
    바꿔야 한다는 주석을 `_harness.make_temp_repo_copy` docstring 에 남긴다.

- **[INFO]** `make_temp_repo_copy` 는 기존 `make_temp_git_repo` 와 이름·역할이 근접하지만
  이미 위임 관계로 정리돼 있어 문제 없음 — 확인만 기록
  - 위치: `.claude/tests/_harness.py:138-166`
  - 상세: 사전 consistency-check(`review/consistency/2026/09/25/09_56_00`) W2 가 지적했던
    "새 헬퍼가 `make_temp_git_repo` 와 이름·역할이 겹친다" 는 이미 이 diff 에서
    `make_probe_repo` → `make_temp_repo_copy` 로 개명하고 내부에서 `make_temp_git_repo` 를
    호출하도록 위임해 반영됐다(139행 docstring 첫 줄이 상위집합 관계를 명시). 재차 지적할
    필요 없음 — 이름·설계 모두 명확하다.
  - 제안: 없음(이미 해결됨).

- **[INFO]** 각 테스트 함수 내부에 `import os, tempfile` 등 로컬 import 가 반복되지만
  이는 파일 전체의 기존 관례(`run_in_orchestrator` 로 넘기는 코드 스니펫은 각각 독립된
  서브프로세스 소스이므로 최상단에서 공유 import 를 뽑을 수 없음)와 일치한다. 새로
  지적할 사항 없음.

## 요약

이번 변경은 harness 테스트가 실제 저장소 트리에 프로브를 남기던 구조적 문제를
`_harness.make_temp_repo_copy` 라는 단일 책임의 작은 헬퍼(원래 `make_temp_git_repo` 를
그대로 위임)로 해소하고, 4개 테스트 파일의 `try/finally` 기반 수동 `cp` 백업·복원
패턴을 `tempfile.TemporaryDirectory` 기반의 훨씬 단순한 구조로 치환했다. 각 함수는
단일 책임을 유지하고 길이도 적절하며, 중첩 깊이·순환 복잡도 모두 낮다. 네이밍은
일관되고(`make_temp_repo_copy`, `_prepare_over(cwd=...)`, `_session_dir(proc, cwd)`),
docstring 은 "왜"를 실측치와 함께 남기는 이 저장소의 기존 관례를 그대로 따른다. 유일한
아쉬운 점은 새 헬퍼를 호출하는 부트스트랩 3줄이 다섯 개 테스트에 걸쳐 완전히
동일하게 복제된 것으로, 이번에 다섯 곳을 전부 손댄 김에 상수로 뽑았으면 더 좋았을
기회비용성 지적이다. Critical 급 가독성·복잡도·매직넘버 문제는 발견되지 않았다.

## 위험도

LOW
