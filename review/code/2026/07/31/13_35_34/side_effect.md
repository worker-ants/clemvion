# 부작용(Side Effect) 리뷰

## 발견사항

- **[CRITICAL]** 이전(pre-fix) `code_review_orchestrator.py` 의 바이트 단위 완전 복제본이 신규 파일로 그대로 커밋됐다 (의도치 않은 파일시스템 부작용)
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 추가 파일 전체, 1304줄 — 이 파일은 프롬프트 크기 제한으로 리뷰 페이로드에 내용이 전혀 실리지 않아 게이트 숫자가 없다. 직접 `Read`/`git show` 로 확인)
  - 상세: `git rev-parse origin/main:.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 와 `git rev-parse HEAD:.claude/skills/code-review-agents/scripts/_probe_main.py` 가 **완전히 동일한 blob 해시**(`8aedb8eb8f1a4f19cc0d15bafd7aedee7ee530f0`)를 반환한다 — 즉 `_probe_main.py` 는 이번 PR 이 고치는 버그(예산 초과 시 생략 안내 누락, `warn_if_committed_work_is_missing` 부재 등)를 **그대로 담은** 수정 전 `code_review_orchestrator.py` 의 복제본이다. `d19e01880`("3R 리뷰 반영") 커밋에서 1,304줄 추가로 처음 등장했고, 커밋 메시지에는 이 파일에 대한 언급이 전혀 없다. 저장소 전체에서 `import`·테스트·SKILL.md·plan 어디에도 참조가 0건이다(grep 확인). 이 프로젝트가 문서화한 "가드 mutation 은 `cp`+절대경로로 원복" 워크플로에서 편집 전 스냅샷을 떠 둔 파일이 정리되지 않고 그대로 `git add` 된 것으로 보인다.
    - 부수적으로 아이러니한 점: 이 파일 자체가 55,309자로 커서 이번 리뷰 세션의 14개 reviewer 프롬프트 전원에게 "내용이 전혀 실리지 않았습니다" 로만 노출됐다 — 정확히 이 PR 이 고치는 "생략 안내" 결함과 같은 경로다. 즉 이 죽은 복제본은 누구도 `Read` 로 직접 열어보지 않는 한 앞으로도 리뷰를 계속 통과할 수 있다.
  - 제안: `_probe_main.py` 를 삭제한다. 편집 전 비교용 스냅샷이 필요했다면 `.gitignore` 대상 경로(예: 로컬 임시 디렉터리)에 두고 커밋 대상에서 제외할 것.

- **[INFO]** `evaluate_review()` 시그니처 변경 — 검증됨, 안전
  - 위치: `.claude/hooks/_lib/review_guard.py:862`(`def evaluate_review(cwd: str | None = None, *, in_flight_ok: bool = False)`), 호출부 `.claude/hooks/guard_review_before_stop.py:344`
  - 상세: 기존 `evaluate_review(cwd=None)` 에 keyword-only `in_flight_ok: bool = False` 가 추가됐다. 기본값이 `False` 로 바뀌면서 **기존 동작(in-flight 세션이면 무조건 허용)이 사라지고** push 가드는 이제 더 엄격해진다 — 이것이 이 변경의 의도된 CRITICAL 수정(리뷰 세션 디렉터리만 만들어 두면 30분간 push 가 열리던 결함)이다. 저장소 전체에서 `evaluate_review(` 호출부는 push 가드(`guard_review_before_push.py:846`, `_evaluate_over_targets` 경유 — kwarg 미전달로 `in_flight_ok=False` 유지)와 stop 가드(`guard_review_before_stop.py:344`, `in_flight_ok=True` 명시) 단 둘뿐임을 확인했다(grep). `_accepts_cwd()` 가 참조하는 `cwd` 파라미터는 여전히 POSITIONAL_OR_KEYWORD 라 시그니처 탐지 로직도 영향 없다. 양방향 모두 `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`, `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession` 로 고정돼 있다. 시그니처 변경이지만 영향 범위가 완전히 통제됐다.
  - 제안: 없음(정보 제공용).

- **[INFO]** `consistency_orchestrator.collect_context()` — `--diff-base` 의 부작용 범위가 전 모드로 확장
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452`(`_rank_changed = _branch_changed_rels(diff_base, root)`), 헬퍼 정의는 `:249`(`_branch_changed_rels`)·`:275`(`prioritize_bundle_files`)
  - 상세: 기존엔 `diff_base`(`git diff` subprocess 호출)가 `--impl-done` 분기 안에서만 계산됐다. 이번 변경은 `collect_context` 최상단으로 끌어올려 **`--spec`/`--plan`/`--impl-prep`/`--impl-done` 모든 모드에서 무조건** `git diff --no-renames --name-only <base>...HEAD -- .` 서브프로세스 호출 + `plan/in-progress/**` 전체 markdown 파일 읽기를 수행한다(번들 우선순위 계산용). 실패 시 빈 set 반환(fail-safe)이고 SKILL.md 에도 "이 base 는 전 모드 공통으로 번들 우선순위 산정에도 쓰인다" 로 정확히 반영돼 문서 drift 는 없다. 다만 이전엔 `--impl-done` 이외 모드를 호출하던 사용자에게 `--diff-base` 가 사실상 no-op 이었는데, 이제는 실제로 결과(번들 정렬 순서)에 영향을 준다 — 의도된 확장이지만 "모드-무관 신규 서브프로세스/파일 읽기 부작용" 이라는 점에서 부작용 리뷰 관점에서 기록해 둔다.
  - 제안: 없음(문서화 완료, fail-safe 확인됨).

- **[INFO]** `code_review_orchestrator.collect_change_infos()` — 기본 경로에 신규 stderr 부작용 추가
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1214`(`warn_if_committed_work_is_missing`), 호출부는 `collect_change_infos` 내 `else` 분기(인자 없는 기본 `--prepare` 경로), 헬퍼 `_default_branch_ref` 는 `:1190`
  - 상세: 인자 없이 `--prepare` 를 호출하는 기본 경로에서만 새 stderr 경고(브랜치 diff 대비 누락 파일 나열)가 추가됐다. `--staged`/`--commit`/`--range`/`--branch` 명시 모드에서는 발화하지 않도록 `DefaultPathIsWiredTest` 로 고정돼 있고, git 실패 시 조용히 넘어가도록 설계돼 있다(`_default_branch_ref` try/except). changeset 자체·반환값·시그니처는 변경되지 않아 호출자 영향은 stderr 출력 추가뿐이다.
  - 제안: 없음(의도된 advisory, 회귀 테스트로 고정됨).

- **[INFO]** `.claude/agents/consistency-summary.md` / `.claude/skills/consistency-checker/SKILL.md` — 요약 에이전트의 출력 계약(인터페이스) 확장
  - 위치: `.claude/agents/consistency-summary.md` §요약 지침 3·4, §출력 형식의 신규 `## planner 인계` 표
  - 상세: sub-agent 프롬프트 규약에 "하향 금지" + "§planner 인계" 표가 신설됐다. `review_guard.py` 의 `_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)")` 는 `BLOCK:` 한 줄만 정규식으로 찾으므로 새 표/문구 추가가 기존 파서와 충돌하지 않음을 확인했다. 코드 레벨 부작용은 없고 sub-agent 행동 계약 변경이다.
  - 제안: 없음.

## 요약

핵심 코드 변경(`evaluate_review` 의 `in_flight_ok` opt-in화, `build_files_section`/`prioritize_bundle_files` 의 예산·정렬 로직, `warn_if_committed_work_is_missing` 신설)은 전부 의도가 분명하고 호출자 영향이 정확히 스코프되어 있으며 양방향 회귀 테스트로 고정돼 있어 부작용 관점에서 문제되지 않는다. 그러나 이번 diff 에는 명백히 의도치 않은 부작용이 하나 섞여 있다 — `_probe_main.py` 라는 신규 파일이 수정 전 `code_review_orchestrator.py` 와 **완전히 동일한 git blob** 으로 커밋됐고, 저장소 어디에서도 참조되지 않는 죽은 복제본이다. 이는 이 PR 이 고치는 "대용량 파일이 리뷰 프롬프트에서 조용히 생략된다" 결함의 실제 사례이기도 해서(이 파일 자체가 14개 reviewer 전원에게 생략됐다), 방치하면 향후 리뷰에서도 계속 눈에 띄지 않을 위험이 있다. 병합 전 삭제를 권고한다.

## 위험도
CRITICAL — `_probe_main.py` 삭제 전까지 (원인 파악·재현 확인 완료, 조치는 파일 삭제 한 줄로 간단하지만 미처리 시 저장소에 죽은 코드/혼란을 영구적으로 남긴다)
