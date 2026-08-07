# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** git 경로 필터(`-- .`) 제거가 "순수 중복 제거" 리팩터링에 곁들여진 동작 변경
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:254` (`_branch_changed_rels` 의 `return set(_git_probe.branch_diff_files(...))` 블록, 옛 `cmd = [..., "--", "."]` 를 대체)
  - 상세: `_branch_changed_rels` 는 기존에 `git diff ... -- .` 로 pathspec 을 걸었으나, 공유 함수 `_shared/git_probe.branch_diff_files` 로 위임하면서 이 pathspec 이 빠졌다. 새 함수의 docstring(같은 커밋, `git_probe.py:194-197`)이 "`root` 가 프로세스 cwd 이고 orchestrator 가 repo root 에서 실행될 때만 참이었던 제약이라 제거해도 현재는 동작이 같다" 고 명시적으로 근거를 남기고 있어 의도적·문서화된 결정이며 은폐된 변경은 아니다. 다만 "두 orchestrator 의 git 호출을 하나로 합친다"는 §6 백로그 항목의 목표를 "동작을 하나로 통일한다"는 더 넓은 결정으로 조용히 확장한 지점이라, 순수 스코프 관점에서는 경계선에 있다.
  - 제안: 이미 근거가 문서화되어 있고 테스트(`test_branch_diff_shared.py`)로 두 orchestrator 의 일치가 고정돼 있으므로 추가 조치는 불필요. 다만 향후 이 함수가 `root != cwd` 인 호출부에서 재사용될 경우 이 지점을 우선 재검토 대상으로 삼을 것.

## 요약

이번 변경은 `plan/in-progress/harness-review-gate-followups.md` 의 명시적 잔여 백로그 §6(브랜치-diff 헬퍼 중복 통합)·§9(`merge_coordinator_orchestrator` 자기치유 부재)·§10(`_retry_state.json` lost update — `agents_fatal` 미수렴)을 처리한 것으로, 코드 6개·신규/확장 테스트 2개·README 2개·plan 3개(완료 이동·인계 문서 정리·본체 상태 갱신) 총 12개 파일이 모두 위 세 항목 중 하나에 직접 대응된다. 무관한 파일 수정, 요청 밖 기능 추가, 임포트 정리, 설정 변경, 의미 없는 포맷팅 혼입은 발견되지 않았다. README·테스트 카탈로그·plan lifecycle 갱신은 이 저장소의 정식 규약(문서-코드 미러, `test_tests_readme_catalog.py` 가드, plan 완료 이동)이 요구하는 동반 갱신이라 스코프 이탈이 아니라 필수 수반 작업으로 판단한다. 유일하게 언급할 만한 지점은 브랜치-diff 통합 과정에서 `-- .` pathspec 을 제거한 것으로, 이는 문서화·테스트로 뒷받침된 의도적 결정이지만 "중복 제거" 범위를 살짝 넘어 "동작 통일"까지 포함한다는 점에서 INFO 로 기록한다.

## 위험도

LOW
