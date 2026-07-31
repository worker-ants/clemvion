# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 이번 라운드에 배정된 44개 파일은 전부 이전 4회 리뷰 세션의 산출물(마크다운 리포트·JSON 상태 스냅샷)이며, 신규 외부 의존성 표면이 전혀 없다
  - 위치: 44개 파일 전체 — `review/code/2026/08/01/00_03_38/**`(8건), `review/code/2026/08/01/00_33_34/**`(17건), `review/code/2026/08/01/01_17_35/**`(17건), `review/code/2026/08/01/01_17_47/_retry_state.json`·`meta.json`(2건)
  - 상세: `git diff --stat origin/main...HEAD`로 이 브랜치 전체(95 files changed)를 직접 확인했다. `.claude/` 하네스의 실제 소스 — `_shared/block_integrity.py`(신규), `_shared/retry_state.py`(신규), 훅 5개(`review_guard.py`/`failopen_state.py`/`guard_review_before_push.py`/`guard_review_before_stop.py`), orchestrator 3개, 테스트 3개, `plan/in-progress/harness-review-gate-ci-backstop.md` — 는 이 브랜치의 앞선 커밋들(`30cc0f738` → `7b54b088a` → `e364b4159` → `a0dcebea2` → `780e0837e` → `b06982ec4` → `179263dd2` → `7dd4ad8c7` → `8b3be3ce6`)에서 이미 전부 커밋 완료됐고, 이번 세션(01_49_32)의 diff 베이스에는 포함되지 않는다. 이번 라운드에 실제로 배정된 44개 파일은 모두 `.md`(리뷰 리포트 프로즈)와 `.json`(`meta.json`/`_retry_state.json`, 하네스 자체 진행 상태 bookkeeping)뿐이며, `import`/`require` 구문도 `package.json`/`requirements*.txt`/`pyproject.toml`/lockfile 류 변경도 전무하다(`git diff --stat origin/main...HEAD -- '*.json' '*requirements*.txt' '*pyproject.toml*' '*.lock'`를 review 산출물 제외 조건으로 재확인해도 매치 0건). 같은 세션(01_49_32)의 다른 리뷰어(maintainability, security)도 독립적으로 "실제 하네스 소스는 이 라운드 diff 베이스 밖에 있다"는 동일 결론에 도달했음을 그 리포트에서 확인했다. 버전 고정·라이선스·취약점·번들 크기·빌드 시간·기존 의존성과의 호환성(점검 관점 2~7) 은 이번 diff 대상에 코드가 없어 전부 N/A 다.
  - 제안: 없음.

- **[INFO]** 앞선 라운드들이 반복 지적한 "merge-coordinator 의 `_shared/retry_state.py` 부분 위임"(내부 의존성, 점검 관점 8) 서술은 현재 HEAD 기준으로도 정확하며, 그중 "위임 경로 무테스트"로 지적됐던 하위 우려는 이 라운드 diff 밖의 후속 커밋에서 이미 해소됐음을 직접 확인
  - 위치: `review/code/2026/08/01/00_33_34/dependency.md:35-48`(INFO 최초 기록) → `review/code/2026/08/01/01_17_35/dependency.md:10-13`(WARNING 으로 격상) → `review/code/2026/08/01/01_17_35/RESOLUTION.md:40`(W18 처분 기록: "merge-coordinator `--summary-state` 무테스트 … 테스트 2개 추가")
  - 상세: 세 리포트 모두 "`merge_coordinator_orchestrator.py`는 `load_state`/`save_state`/`apply_status_update` 3개 함수만 `_shared/retry_state.py`에 위임하고, self-healing `reconcile_state_with_disk`는 위임받지 못했다"고 서술한다. 이번 세션은 이 44개 파일 자체에는 검증할 코드가 없지만, 그 서술이 가리키는 실제 소스가 여전히 이 저장소에 존재하므로 `Read`로 직접 열어 현재성(staleness)을 확인했다 — `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-112`의 주석이 지금도 "has no `_reconcile_state_with_disk` at all"이라 명시하고, 113/117/121행 정의가 정확히 3개 함수만 위임한다(`_reconcile_state_with_disk` 호출은 파일 전체에 0건, grep 으로 재확인). 이 비대칭은 `plan/in-progress/harness-review-gate-ci-backstop.md:76-83`(후속 항목 9)에 지금도 정확히 등재돼 있어 은폐된 리스크가 아니다. 다만 `01_17_35/dependency.md`가 같은 항목에서 함께 지적했던 하위 문제 — "이 위임 경로가 이 PR 테스트 어디에서도 실행되지 않는다" — 는 그 이후 커밋(`RESOLUTION.md`의 5R, `7dd4ad8c7`)에서 `.claude/tests/test_retry_state_shared.py:142-214`에 `MergeCoordinatorUsesTheSharedStateTest`(정상 `--update`/`--summary-state` 경로 + state 파일 부재 시 `sys.exit(1)` 계약을 검증하는 테스트 메서드 3개)가 추가되며 실제로 닫혔음을 직접 확인했다. 즉 여러 리뷰 라운드에 걸쳐 누적된 이 내부-의존성 서술은 정확하고 stale 하지 않다 — "구조적 비대칭(항목 9, self-healing 부재)은 의도적으로 여전히 열려 있고, 그 아래의 테스트-커버리지 우려만 이미 닫혔다"는 현재 상태를 다음 라운드를 위해 기록해 둔다.
  - 제안: 조치 불요(정보성 확인). 항목 9(self-healing 자체)는 여전히 의도된 별도 후속 스코프이므로 이번 라운드에서 추가로 요구할 것은 없다.

- **[INFO]** 리뷰 리포트가 인용하는 Python 호환성 관련 주장("`removesuffix` 의도적 회피")도 현재 HEAD 기준 사실과 일치
  - 위치: `review/code/2026/08/01/01_17_35/dependency.md`(INFO "Python 버전 호환성 보존" 항목) — 근거 소스는 `.claude/_shared/block_integrity.py:146`
  - 상세: `.claude/`(hooks/skills/tests 전체)를 `removesuffix|removeprefix` 로 grep 한 결과 실제 호출은 여전히 0건이고, 유일한 매치는 `block_integrity.py:146`의 회피 사유를 설명하는 주석 자체다. 리뷰 리포트의 서술과 현재 소스가 어긋나지 않는다.
  - 제안: 없음.

## 요약

이번 세션(01_49_32)에 dependency 리뷰어로 배정된 44개 파일은 코드가 아니라 이 브랜치의 앞선 4회 리뷰 세션(`00_03_38`, `00_33_34`, `01_17_35`, `01_17_47`)이 만든 산출물 — 리뷰 리포트 마크다운, `meta.json`/`_retry_state.json` bookkeeping, `RESOLUTION.md` — 뿐이다. `git diff --stat origin/main...HEAD`로 이 브랜치 전체를 대조한 결과 실제 하네스 소스(`_shared/block_integrity.py`, `_shared/retry_state.py`, 훅, orchestrator, 테스트, plan 문서)는 이미 앞선 커밋들에서 커밋 완료돼 이번 라운드 diff 베이스 밖에 있으며, 이 브랜치 전체를 통틀어 `package.json`/`requirements*.txt`/`pyproject.toml`/lockfile 변경은 단 한 건도 없다. 따라서 신규 의존성·버전 고정·라이선스·취약점·불필요한 의존성·번들 크기·기존 의존성과의 호환성(점검 관점 1~7)은 이번 diff 에 전부 해당 사항이 없다. 유일하게 실질적으로 다룰 만한 항목은 "내부 의존성"(관점 8)인데, 이 44개 파일이 반복해서 서술하는 "merge-coordinator 는 `_shared/retry_state.py` 5개 함수 중 3개만 위임하고 self-healing(`reconcile_state_with_disk`)은 위임받지 못했다"는 내용을 실제 현재 소스(`merge_coordinator_orchestrator.py:100-122`)와 plan 문서(항목 9, 76-83행)에 대조해 정확하며 은폐되지 않았음을 확인했고, 같은 항목이 함께 지적했던 "위임 경로 무테스트"라는 하위 우려는 이 라운드 diff 밖의 후속 커밋(5R, `7dd4ad8c7`)에서 `test_retry_state_shared.py`의 신규 테스트 클래스로 이미 해소됐음도 직접 확인했다. 같은 세션의 maintainability·security 리뷰어도 독립적으로 "이번 라운드 diff에는 실제 코드 표면이 없다"는 동일 결론에 도달해 교차 일관성이 있다. 결론적으로 이번 diff는 의존성 관점에서 검토할 실질적 대상이 없으며, 앞선 라운드가 남긴 유일한 내부-의존성 후속 사항도 정확히 추적 중이거나 이미 해소된 상태다.

## 위험도

NONE
