# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 신규 "하향 감지" 검사를 전체 이력이 아닌 "채택된 세션" 1건으로 스코프 제한 — 회귀 없음을 실측으로 확인 (모범 사례)
  - 위치: `.claude/hooks/_lib/review_guard.py:744-759` (`_newest_resolved_impl_done_mtime` 내 `best_dir` 스코핑 블록)
  - 상세: PR 자체 주석이 "전체 히스토리(≈8개 세션)에 대해 하향 검사를 돌리면 +0.39s 실측"이라고 명시하는데, 실제 구현은 루프가 끝난 뒤 `best_dir`(gate 가 채택하는 최신 세션) 단 1건에 대해서만 `_block_integrity.contradiction_note()`를 호출하도록 스코프를 좁혔다. 이 저장소의 실제 `review/consistency/`(732개 SUMMARY.md, 823개 디렉터리)에 대해 직접 측정한 결과, `notes=None`(신규 검사 비활성)일 때 평균 69.7ms, `notes=[]`(신규 검사 활성)일 때 평균 61.0ms로 — 신규 코드가 추가한 한계 비용은 잡음(noise) 수준(수 ms 이하)이었다. 즉 "전체 세션 대조"라는 순진한 설계를 실제로 피했고, 그 판단이 옳았음을 독립적으로 재확인했다.
  - 제안: 없음 (현행 유지 권장). 다만 향후 리팩터링 시 이 스코프 제한을 되돌리지 않도록 `test_block_integrity.py::GateSurfacesTheContradictionTest.test_only_the_session_the_gate_adopts_is_checked` 를 회귀 가드로 유지할 것.

- **[WARNING]** `_newest_resolved_impl_done_mtime`/`_iter_consistency_summaries`가 의존하는 `review/consistency/` 전체 이력 스캔은 무한 성장하는 O(n) 이고, `git push` 시도마다 + turn 종료(Stop)마다 매번 실행된다
  - 위치: `.claude/hooks/_lib/review_guard.py:678-686` (`_iter_consistency_summaries` — `os.walk` 전체 순회), `:718-743` (`_newest_resolved_impl_done_mtime` 루프 — 발견된 모든 세션에 대해 `meta.json` 읽기 + `--impl-done` 세션은 `SUMMARY.md` 읽기/파싱까지 수행)
  - 상세: 이 루프 자체는 이번 diff 가 새로 만든 것이 아니라 기존 동작이며, 이번 PR 은 그 위에 올라타는 신규 검사 비용을 (위 INFO 항목처럼) 최소화했을 뿐 이 스캔 자체를 손대지 않았다. 그러나 이 함수는 이번 diff 에서 시그니처/본문이 실제로 바뀐 대상이고, PR 자신의 주석이 "세션당 실제 파일 I/O 비용"을 정량화(+0.39s / ~8세션 ≈ 세션당 ~49ms)해 두었기 때문에, 그 기반이 되는 전수 스캔의 성격을 함께 짚을 필요가 있다. 직접 실측(`_newest_resolved_impl_done_mtime(repo_root, dirty=set(), notes=...)`) 결과 현재 저장소(732 세션) 기준 호출당 약 61-98ms 가 소요된다. `review/**`는 프로젝트 컨벤션상 gitignore 되지 않고 영구 보존되므로(plan-lifecycle 참고) 이 세션 수는 시간이 지날수록 단조 증가하며, 이 게이트는 하네스에서 가장 빈번히 실행되는 게이트 중 하나(모든 `git push` 시도 + 모든 turn 종료)다. 오늘은 human-paced 트리거에 비하면 체감 지연이 크지 않지만, 세션 수가 몇 배로 늘면(예: 5000+) 이 스캔만으로 수백 ms~초 단위 지연이 push/turn-종료마다 누적될 수 있고, `_push_targets`가 여러 worktree 를 반환하는 멀티타겟 push(라인 809-866, `_evaluate_over_targets`)에서는 타겟 수만큼 이 비용이 곱해진다.
  - 제안: 지금 당장 막을 필요는 없으나, 후속 과제로 다음 중 하나를 고려: (1) "가장 최근 `--impl-done` 세션"의 식별자/타임스탬프를 캐싱하고 `review/consistency/` 트리의 최신 변경 신호(예: 최상위 세션 디렉터리들의 mtime, 또는 SUMMARY 작성 시 orchestrator 가 함께 갱신하는 소형 append-only 인덱스 파일)로 무효화, (2) 최소한 `_iter_consistency_summaries`가 연도/월 단위로 최신 N개월만 우선 스캔하고 못 찾으면 확장하는 식으로 평균 케이스를 줄이는 방법. `plan/in-progress/harness-review-gate-ci-backstop.md` 에 이미 유사한 계측 문화가 있으므로 그 항목 옆에 후속 티켓으로 등재하는 편이 자연스럽다.

- **[INFO]** 채택된 세션의 `SUMMARY.md` 가 게이트 1회 평가당 2번 읽힌다 (중복 I/O, 영향 미미)
  - 위치: `.claude/hooks/_lib/review_guard.py:715` (`_summary_block_is_no` 내부 read — `:735`에서 루프 중 호출) 그리고 `.claude/_shared/block_integrity.py:117` (`downgraded_criticals` 내부 `_read()` — `review_guard.py:757`의 `contradiction_note(best_dir)` 경유로 같은 `SUMMARY.md` 를 다시 read)
  - 상세: 루프 안에서 `_summary_block_is_no(summary)`가 이미 해당 세션의 `SUMMARY.md` 전체를 read+parse 해 `BLOCK: NO` 여부를 판정하는데, 루프가 끝난 뒤 `best_dir`(그 세션)에 대해 `contradiction_note()` → `downgraded_criticals()`가 같은 `SUMMARY.md` 를 `_read()`로 다시 열어 같은 판정(`summary_block_verdict(...) != "NO"`)을 반복한다. 파일이 "몇 KB" 수준(`block_integrity.py` 자체 주석 근거)이라 실측 영향은 무시할 만하지만(세션 1건에 대해 파일 오픈 1회 추가일 뿐, 세션 수에 비례하지 않음), 정확히는 "불필요한 연산(중복 계산)" 범주에 해당한다.
  - 제안: 급하지 않음. 리팩터링 여유가 생기면 루프에서 읽은 텍스트를 `best_dir`와 함께 보관했다가 `downgraded_criticals()`에 전달하는 방식(또는 `_read()` 결과를 세션 단위로 캐싱)으로 제거 가능. 세션 수가 늘어나는 방향(WARNING 항목)과 달리 이건 상수 비용이라 우선순위는 낮음.

- **[INFO]** `reconcile_state_with_disk` × `has_report()` 조합이 참가자 수 k 에 대해 O(k²) — 현재 규모에서는 무해
  - 위치: `.claude/_shared/retry_state.py:93` (`known = [...]`), `:101` (`on_disk = [n for n in known if _report_paths_lib.has_report(sd, n, state)]`)
  - 상세: `has_report()`가 내부적으로 `report_paths.report_path()`를 호출하고, 이는 `subagent_invocations` 리스트를 매번 선형 탐색(`next(...)`)해 해당 이름의 기록된 `output_file`을 찾는다. 따라서 `on_disk = [...]` 컴프리헨션은 `known`(체커/리뷰어 수 k) × `report_path`의 선형 탐색(역시 O(k))으로 실질 O(k²)가 된다. 이번 diff 는 이 로직을 옮겨 적었을 뿐(AST 동일성 확인됨) 새로 만든 계산이 아니고, k 는 checker 5개 / reviewer 로스터(대체로 10개 미만)로 고정되어 있어 실질 비용은 무시 가능한 수준(최악에도 비교 수십 회)이다.
  - 제안: 조치 불요. 만약 향후 로스터가 수십~수백 단위로 커지는 설계 변경이 있다면 그때 `report_path`를 `{name: output_file}` 딕셔너리로 한 번만 만들어 O(k)로 낮추는 것을 고려.

## 요약

이번 변경은 크게 (1) 3곳에 중복돼 있던 `_retry_state.json` 상태 관리 5개 함수를 `.claude/_shared/retry_state.py` 로 통합하는 순수 리팩터(동작 보존을 AST 비교로 사전 검증)와, (2) checker 의 `[CRITICAL]` 태그와 SUMMARY 의 `BLOCK:` 판정이 모순되면 경고를 내는 신규 백스톱(`block_integrity.py`)을 훅 경로에 배선하는 기능 추가로 구성된다. 성능 관점에서는 전반적으로 신중하게 설계됐다: 정규식은 모듈 로드 시 1회만 컴파일되고, 상태 파일 쓰기는 temp+`os.replace` 원자적 패턴으로 부분쓰기 경합을 없앴으며, 문자열 결합은 O(n²) 누적 없이 `join`을 사용한다. 무엇보다 신규 하향 감지 검사가 "게이트가 실제로 채택하는 세션 1건"에만 스코프를 좁혀, PR 스스로 측정해 둔 "전 이력 검사 시 +0.39s" 라는 회귀를 실제로 피했음을 이 저장소의 실제 데이터(세션 732개)로 직접 재현·확인했다(추가 한계 비용은 잡음 수준). 유일하게 짚을 만한 항목은 이 신규 검사가 올라타는 기반인 `review/consistency/` 전체 이력 `os.walk` 스캔이 세션 수에 비례해 무한 성장하고, 이 게이트가 모든 `git push` 시도와 모든 turn 종료마다 실행된다는 점이다 — 이는 이번 diff 가 새로 만든 문제는 아니고 현재 실측치(~60-100ms)도 당장 문제될 수준은 아니지만, 저장소가 커질수록 후속 조치(캐싱/인덱싱)를 고려할 가치가 있다. 그 외 두 건(SUMMARY.md 이중 read, `reconcile_state_with_disk`의 O(k²) 특성)은 모두 상수 규모에 묶여 있어 실질적 영향이 없는 INFO 수준이다. N+1 쿼리, 블로킹 I/O 오남용, 부적절한 자료구조, 과도한 선행 로딩 등 다른 체크리스트 항목에서는 새로운 문제를 발견하지 못했다 — Gate 2(`spec_linked`가 있을 때만 impl-done 스캔 실행)는 이미 지연 평가로 구성돼 있고, 훅이라는 실행 모델 특성상 동기 I/O 는 적절한 선택이다.

## 위험도
LOW
