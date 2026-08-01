# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[WARNING]** `_retry_state.json` 공유 상태 파일에 대한 read-modify-write 가 원자적이지 않다 (락도 atomic rename 도 없음)
  - 위치: `.claude/_shared/retry_state.py:41-52`(`load_state`/`save_state`), `:138-167`(`apply_status_update`)
  - 상세: `apply_status_update()`(138-167)는 `load_state()`(41-47)로 JSON 을 읽어 메모리에서 버킷을 옮긴 뒤 `save_state()`(50-52, `open(file, "w")` 로 즉시 truncate 후 `json.dump`)로 파일 전체를 덮어쓴다. `code_review_orchestrator`·`consistency_orchestrator`·(로컬 사본을 쓰는) `merge_coordinator_orchestrator` 셋 다, sub-agent 하나당 별도 OS 프로세스로 `--update <session_dir> --agent <name> --status <s>` CLI 를 호출하는 fallback 경로를 갖고 있고(`code-review-agents/SKILL.md`·`consistency-checker/SKILL.md` 가 이를 "`test_orchestrator_state.py` 류로 검증되는 안정 인터페이스"라고 명시), 이 하네스 자체가 "독립적인 호출은 같은 응답 블록에 모아서 호출하라" 를 표준 관례로 삼는다. 즉 main 세션이 여러 sub-agent 의 STATUS 를 연이어 받은 뒤 그 결과들에 대한 `--update` 호출 여러 개를 한 턴에서 병렬 실행할 가능성이 이 하네스의 정상 동작 모델 안에 있다.
    두 프로세스가 같은 세션의 `_retry_state.json` 에 동시에 `apply_status_update` 를 실행하면 (1) 나중에 쓴 프로세스가 이기고 먼저 쓴 프로세스의 버킷 전이·`agent_history` 항목이 조용히 사라지는 고전적 lost-update, (2) 그 창 사이에 다른 프로세스(`reconcile_state_with_disk`/`--summary-state`/`load_state` 자체)가 같은 파일을 읽으면 `open(mode="w")` 가 방금 비운 직후이거나 `json.dump` 스트리밍 도중의 잘린 내용을 볼 수 있어 `json.load` 가 `JSONDecodeError` 를 던진다 — `load_state`(41-45)는 "파일이 아예 없음"만 방어하고 "있지만 깨짐"은 방어하지 않으므로 이 예외는 잡히지 않고 그대로 호출자 프로세스를 죽인다.
    이번 diff 가 만든 결함은 아니다 — `code_review_orchestrator`/`consistency_orchestrator` 각각의 byte-identical 사본을 그대로 옮긴 것이고, 모듈 자체 docstring(8-14행)이 AST 비교로 이를 확인해 두었다. 다만 지금이 바로 세 소비자가 한 구현으로 모이는 시점이라, 이후로도 계속 세 곳에 같은 결함을 복제하지 않고 한 번만 고칠 수 있는 가장 싼 기회이기도 하다. 심각도를 누르는 완화 요인 둘: (a) 주 경로인 `Workflow` tool(`.claude/workflows/ai-review.js` 등)은 이 CLI 의 `--update` 를 아예 거치지 않는다(grep 확인 — 세 workflow 스크립트 어디에도 `--update` 호출 없음, 주석에 "manual ... --update ... dance" 를 대체한다고 명시), (b) `code_review_orchestrator`/`consistency_orchestrator` 는 `reconcile_state_with_disk` 로 다음 읽기 때 실제 리포트 파일 기준으로 자가 치유되므로 lost-update 가 곧 최종 판정 오류로 이어지지는 않는다.
  - 제안: `save_state()` 를 `tempfile.NamedTemporaryFile(dir=os.path.dirname(state_file), delete=False)` + `os.replace()` 패턴으로 바꿔 최소한 "쓰다 만 파일을 읽고 크래시"하는 창을 없앨 것. lost-update(마지막 쓰기가 이김) 자체를 완전히 막으려면 `fcntl.flock` 류의 락이 필요하지만, 이 프로젝트가 이미 다른 곳(`test_bootstrap_mermaid_install.py` — mermaid-lint 설치 가드의 `mkdir` 락을 stale-lock steal 문제로 걷어내고 "락 대신 수렴 설계"를 의도적으로 택한 전례, README 명시)에서 같은 선택을 했으므로, 락을 새로 들이기보다는 atomic write 로 크래시만 막고 lost-update 자체는 기존 철학대로 `reconcile_state_with_disk` 류의 자가 치유에 맡기는 편이 이 코드베이스 컨벤션과 일관적이다.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 같은 read-modify-write 를 로컬 사본으로 중복 보유 + 자가치유(`reconcile_state_with_disk`) 없음
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-147`
  - 상세: `_apply_status_update`(118-147)는 `_shared/retry_state.apply_status_update` 로 위임하지 않고 동일한 read-modify-write-overwrite 로직을 그대로 복제 보유한다(주석 103-109 가 스스로 이유를 밝힘 — branch/base 필드가 달라 그대로 옮기지 못했다). 그리고 이 파일에는 `reconcile_state_with_disk` 가 아예 없다. 즉 위 WARNING 의 race 로 update 하나를 잃거나 Agent tool 로 직접 fan-out 해 `--update` 를 아예 안 부른 세션이든, code-review/consistency 두 orchestrator 가 가진 "다음 읽기 때 디스크 기준으로 재계산" 수렴 경로가 이 세 번째 소비자에는 없어 상태가 그대로 굳는다. 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 에 "별도 PR 로 분리" 로 명시적으로 등재돼 있어 이번 diff 에서 손대지 않은 것은 의도된 스코프 결정으로 보인다 — 새로 발견한 결함이 아니라 그 후속의 동시성 노출면을 확인차 기록한다.
  - 제안: 해당 후속 PR 에서 `reconcile_state_with_disk` 를 이식할 때 위 WARNING 의 atomic-write 도 함께 적용할 것.

- **[INFO]** 동시 호출을 실제로 재현하는 테스트 부재
  - 위치: `.claude/tests/test_retry_state_shared.py`
  - 상세: `test_neither_announces_when_nothing_changed` 등은 같은 세션 디렉토리에 대해 CLI 를 **순차** 2회 실행해 검증하며, 두 프로세스가 같은 `_retry_state.json` 을 동시에 건드리는 시나리오는 이 테스트 파일 어디에도 없다. 이 프로젝트는 다른 곳(`test_bootstrap_mermaid_install.py::test_concurrent_cold_start_converges_and_then_stops_reinstalling`)에서 정확히 "락 없이도 수렴하는지" 속성을 실제 동시 서브프로세스로 고정해 둔 전례가 있다 — `retry_state.py` 에도 같은 처방이 적용 가능하며, 지금은 그 속성이 docstring 산문(25-28행 "Disk is the arbiter throughout")으로만 주장돼 있을 뿐 테스트로 고정되어 있지 않다.
  - 제안: 최소 "서로 다른 agent 이름으로 두 프로세스가 동시에 `--update` 를 호출해도 (또는 `--summary-state` 재조정 후) 두 업데이트 모두 살아남는지" 를 고정하는 회귀 테스트 하나.

## 요약

이번 diff 는 code-review·consistency 두 orchestrator 가 각자 들고 있던 `_retry_state.json` bookkeeping 5종을 `.claude/_shared/retry_state.py` 로 추출(AST 동일성 확인 완료)하고, 새 순수 함수 모듈 `block_integrity.py`(파일 읽기·정규식 매칭만, 부작용 없음)를 추가하고, 새 `notes` 어드바이저리를 exit code 에 맞는 stream(stdout/stderr)으로 배선한 것이 골자다. 스레드/asyncio/멀티프로세싱은 어디에도 쓰이지 않고, 모든 git/subprocess 호출에 timeout 이 설정돼 있으며, `_evaluate_over_targets` 의 다중-target(worktree) 순회도 순차 for-loop 라 락 경합이나 데드락 가능성은 없다(애초에 락을 쓰는 곳이 없다). 유일하게 실질적인 동시성 우려는 세 orchestrator 가 공유하는 `_retry_state.json` 의 read-modify-write-overwrite 패턴에 락도 atomic rename 도 없다는 점인데, 이는 이번 diff 가 만든 결함이 아니라 byte-identical 추출로 그대로 옮겨온 기존 패턴이고, 주 경로(`Workflow` tool)는 이 CLI 를 아예 거치지 않으며, 두 orchestrator 는 디스크 기준 자가 치유(`reconcile_state_with_disk`)로 완충된다. 다만 세 소비자가 한 구현으로 모인 지금이 `tempfile`+`os.replace` 로 최소한 "쓰다 만 파일을 읽고 크래시"하는 창만이라도 한 번에 닫을 수 있는 가장 싼 시점이라 WARNING 으로 남긴다. `merge_coordinator_orchestrator.py` 는 이 자가 치유가 없는 세 번째 소비자로 남아 있으나 이미 계획 문서에 별도 후속으로 추적 중이다.

## 위험도

LOW
