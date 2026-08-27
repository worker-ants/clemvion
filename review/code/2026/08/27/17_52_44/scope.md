# 변경 범위(Scope) Review — doclink-guard-scope

## 발견사항

- **[INFO]** 공유 인프라 모듈(`test_harness_checks_paths_coverage.py`)에 대한 변경이 표면상 무관한 파일로 보일 수 있음
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:199-224` (`_GIT_GLOB_MAGIC` 상수 + `filter_covers_file` 의 `:(glob)` strip 로직)
  - 상세: 이 파일은 원래 `harness-checks.yml` 전용 커버리지 가드지만, `filter_covers_file` 헬퍼는 `test_required_check_skip_jobs.py` 의 `DeadFilterTest`(`CONVERTED` 워크플로 전체 — `spec-link-checks.yml` 포함)가 재사용한다(`grep` 로 확인: `.claude/tests/test_required_check_skip_jobs.py:190,205,215,225,416,455,463`). 이번 PR 이 `.github/workflows/spec-link-checks.yml` 의 `pathspecs` 에 `:(glob)*.md` 를 새로 추가했는데(파일 4), 이 매직 접두를 모델링하지 않으면 GitHub-strict 정규식이 그 pathspec 을 "tracked 파일과 전혀 안 맞는 죽은 필터"로 오판해 `test_no_pathspec_is_a_dead_filter` 가 깨진다. 즉 이 변경은 **드리프트가 아니라 파일 4의 직접적 필수 후속**이다.
  - 제안: 없음 — 스코프 위반 아님. 다만 리뷰어가 "왜 이 파일이 diff 에 있는가"를 한 번에 알기 어려우므로, PR 설명/커밋 메시지에 두 파일의 인과관계(`:(glob)` 도입 → dead-filter 가드 대응)를 한 줄로 명시하면 향후 리뷰 시간을 줄일 수 있음(선택 사항).

## 요약

이번 변경은 plan 항목("doc-link 검사기가 `CLAUDE.md`·`.claude/**` 를 안 훑는다", `plan/in-progress/spec-sync-external-interaction-api-gaps.md`)의 집행으로, 단일 목표— spec-link-integrity 가드에 "거버넌스 문서(root `*.md` + `.claude/**`)" 스코프를 추가하고 CI 트리거를 배선하며 중복된 구식 스크립트를 제거하는 것—에 정확히 수렴한다. 핵심 구현(파일 6·7: `collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 추가, 실측 기반 vacuous-pass 방지 테스트, `mkdtemp` 런타임 fixture로 제외 규칙 검증)은 기능 자체이고, CI 배선(파일 4: `spec-link-checks.yml` pathspecs 확장 + `:(glob)` 필수성 설명)과 그로 인해 필연적으로 뒤따르는 공유 dead-filter 가드 보정(파일 3)은 정확히 필요한 만큼만 건드렸다. 새 가드가 첫 실행에서 실제로 잡아낸 4건의 깨진 링크 수정(파일 1·2·5의 앵커/상대경로 정정)과 그 수정 내용을 반영한 문서 갱신(파일 5의 "문서 링크 검증" 절 재작성)은 같은 작업의 직접 산물이며, 중복·무배선이던 `scripts/check-doc-links.py` 삭제(파일 9)는 plan(파일 8)에 뮤테이션 테스트로 고유 기능 0을 확인한 근거와 함께 기록되어 있다. plan 파일(파일 8) 편집도 해당 체크박스 1건과 그 실행 근거 섹션에 국한되어 있어 같은 문서의 무관한 다른 항목을 건드리지 않았다. 포맷팅 전용 변경, 불필요한 리팩토링, 사용하지 않는 임포트, 관련 없는 설정 변경은 발견되지 않았다.

## 위험도

NONE
