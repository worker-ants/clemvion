# 성능(Performance) Review

## 발견사항

- **[INFO]** `fatal_on_disk` 를 `missing` 이 아닌 `known` 전체에 대해 호출 — 이미 리포트가 있는(성공한) 에이전트에도 불필요한 `os.path.isfile` stat 콜 발생
  - 위치: `.claude/_shared/retry_state.py:188` (`reconcile_state_with_disk` 내부 `fatal_recorded = set(state.get("agents_fatal", [])) | set(fatal_on_disk(sd, known))`)
  - 상세: 바로 아래 줄(189)에서 `fatal = [n for n in missing if n in fatal_recorded]` 로 결과를 `missing` 으로 다시 필터링한다. 즉 `on_disk`(이미 성공 리포트가 있는) 에이전트에 대한 sentinel stat 결과는 이 필터에서 항상 버려지는데, `fatal_on_disk(sd, known)` 호출 시점에는 이미 `has_report()` 를 통해 어떤 이름이 `on_disk` 인지 알고 있음에도 그 이름들까지 다시 파일시스템을 stat 한다. 현재 에이전트 수(14개 reviewer, 4개 analyzer)에서는 syscall 수십 회 수준이라 체감 영향은 없지만, `reconcile_state_with_disk` 는 `--summary-state`/`--resume`/`emit_summary_state` 매 호출마다 실행되므로 세션당 반복 호출 시 누적된다.
  - 제안: `fatal_on_disk(sd, known)` 대신 `fatal_on_disk(sd, missing)` 으로 좁혀 이미 성공이 확정된 이름에 대한 stat 을 생략. (기능적으로 동일 — `on_disk` 이름이 sentinel 을 갖고 있어도 `missing` 필터에 의해 항상 제외되므로 결과는 불변.)

- **[INFO]** `apply_status_update` 가 모든 상태 전이(성공·rate_limit·pending 포함)마다 동기 파일시스템 I/O 를 추가로 수행 — 기존에는 순수 인메모리/JSON 경로였음
  - 위치: `.claude/_shared/retry_state.py:263` (`_record_fatal(sd, agent, status == "fatal")` 호출부), 구현은 `.claude/_shared/retry_state.py:137-164` (`_record_fatal`)
  - 상세: `is_fatal=False` 분기에서도 `os.path.exists(path)` 로 매번 stat 을 수행한다(대부분의 호출에서 sentinel 파일이 애초에 존재하지 않아 이 stat 은 항상 "없음"으로 끝남). `apply_status_update` 는 orchestrator 가 `--update` CLI 로 노출하는 subprocess 진입점이라 매 호출마다 Python 인터프리터 기동 비용(수십 ms)이 이미 지배적이므로, 이 stat 1회 추가는 실질적으로 무시 가능한 수준이다. lost-update 복구라는 목적을 위한 의도된 트레이드오프이고, `fcntl.flock` 대신 이 경로를 선택한 근거(주석·plan)도 합리적이다 — 다만 "hot path 에 blocking I/O 가 늘었다"는 사실 자체는 기록해 둔다.
  - 제안: 현재 스케일(에이전트 수 십여 개, 세션당 상태 전이 수십 회)에서는 조치 불필요. 향후 reviewer/analyzer 수가 크게 늘거나 `apply_status_update` 가 훨씬 더 빈번한 hot path(예: 매초 poll)로 쓰이게 되면 `status == "fatal"` 인 경우에만 `_record_fatal` 을 호출하도록 좁히는 것을 고려(단, 그 경우 fatal→non-fatal 복귀 시 sentinel 정리가 안 되는 문제를 새로 만들므로 재설계가 필요 — 지금 당장 바꿀 이유는 없음).

- **[INFO]** `report_path()` 의 `subagent_invocations` 선형 탐색이 `reconcile_state_with_disk` 루프 안에서 이름마다 반복 호출되어 사실상 O(N²) — 이번 diff 로 새로 생긴 패턴은 아니지만, 이번 변경(`fatal_on_disk` 추가)이 같은 루프에 또 하나의 O(N) 스캔을 얹었다
  - 위치: `.claude/_shared/report_paths.py` (`report_path`, `has_report`) — `.claude/_shared/retry_state.py:182`(`on_disk = [n for n in known if _report_paths_lib.has_report(sd, n, state)]`)와 결합
  - 상세: `has_report` → `report_path` 는 매 호출마다 `state["subagent_invocations"]` 리스트를 처음부터 선형 탐색해 이름이 일치하는 항목을 찾는다. `reconcile_state_with_disk` 는 이 함수를 `known` 의 각 이름에 대해 호출하므로 전체는 O(N²)다. 다만 N(에이전트 수)이 현재 14~18 수준으로 고정되어 있고 사실상 이번 PR 이 만든 회귀가 아니라 기존 구조이므로 즉각적인 위험은 없다.
  - 제안: 참고용 기록만. `subagent_invocations` 를 이름→항목 dict 로 한 번 만들어 재사용하면 O(N) 으로 줄일 수 있으나, 이번 PR 범위(공유 모듈 추출 + fatal sentinel)와는 무관하므로 별도 후속으로 남기는 편이 적절하다.

- **[INFO]** `git_probe.branch_diff_files` / `_run_git_raw` 는 호출당 subprocess 1회로 기존과 동일 — 새로운 N+1 이나 배율 증가 없음
  - 위치: `.claude/_shared/git_probe.py:123-212`
  - 상세: 공유 모듈 추출 전후로 `code_review_orchestrator.get_git_branch_diff_files` / `consistency_orchestrator._branch_changed_rels` 각각 자신의 git subprocess 를 1회씩 실행하던 것을 그대로 `branch_diff_files` 위임으로 대체했을 뿐, 호출 횟수·타임아웃 상한(30s, 기존 두 값 중 더 큰 쪽 채택)에 성능 저하 요인은 없다. `out.split("\n")` 로 만든 리스트 컴프리헨션도 파일 목록 크기에 선형이라 문제 없음. 별도 조치 불필요, 확인 목적으로만 기재.

## 요약

이번 변경은 (1) git 브랜치-diff 프로브를 두 orchestrator 간 중복 제거 후 `_shared/git_probe.py` 로 통합하고, (2) `_retry_state.json` 의 `agents_fatal` lost-update 를 `_fatal/<name>` sentinel 파일 기반 disk 재도출로 보강하고, (3) `merge_coordinator_orchestrator` 에 누락돼 있던 `reconcile_state_with_disk` 자기치유를 추가한 것이 핵심이다. 세 변경 모두 하나의 subprocess 호출 또는 소수의 파일 stat/write 를 늘리는 수준이며, 이 시스템이 다루는 N(reviewer/analyzer 수 십여 개, 세션당 상태 전이 수십 회)에서는 알고리즘 복잡도·N+1·캐싱·블로킹 I/O 어느 관점에서도 실질적 회귀가 없다. `fcntl.flock` 을 다시 채택하지 않고 disk 기반 합집합(JSON ∪ sentinel) 재도출을 선택한 설계는 hook 경로에 블로킹 프리미티브를 두지 않겠다는 기존 원칙과 일관되며, 그 대가로 늘어난 I/O(파일 존재 확인·sentinel 쓰기)는 트레이드오프로서 합리적이다. 발견된 항목은 전부 INFO 수준의 마이크로 최적화 여지(`fatal_on_disk` 대상 범위 축소 등)이며 병목이라 부를 수준은 아니다.

## 위험도

LOW
