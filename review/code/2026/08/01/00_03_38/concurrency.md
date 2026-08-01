# Concurrency Review

## 범위 요약

대상 14개 파일은 하네스(harness) 자동화 스크립트/훅/에이전트 정의이며, 실질 로직 변경은 대부분
"세 orchestrator(`code_review_orchestrator.py` / `consistency_orchestrator.py` /
`merge_coordinator_orchestrator.py`)가 각자 들고 있던 `_retry_state.json` bookkeeping 5종
함수를 `.claude/_shared/retry_state.py` 로 추출"하는 리팩터다. 저자 자신이 AST 비교로
"4/5 함수가 byte-identical, `_emit_summary_state` 만 차이"임을 실측해 남겼고, `git diff
origin/main...HEAD` 로 직접 대조한 결과도 동일 결론이었다 — 즉 이 diff 는 **동작을 보존하는
이동**이며 새 스레드/프로세스/락 primitive 를 도입하지 않는다. In-process 스레딩·asyncio·
커넥션 풀 사용은 8개 대상 스크립트 전체에서 grep 0건이었다 (`ThreadPoolExecutor`/`asyncio`/
`threading`/`multiprocessing`/`concurrent.futures` 전부 없음). 따라서 본 리뷰가 다루는 "동시성"은
스레드 레벨이 아니라 **여러 독립 프로세스(sub-agent, `--update` CLI 호출 등)가 같은 파일을
공유 상태로 read-modify-write** 하는 프로세스 간 경쟁 조건이다.

## 발견사항

- **[WARNING]** `_retry_state.json` 에 대한 락 없는 read-modify-write — 동시 `--update` 호출 시
  lost update 가능
  - 위치: `.claude/_shared/retry_state.py:141-171` (`apply_status_update`), `:55-93`
    (`reconcile_state_with_disk`), `:41-52` (`load_state`/`save_state`)
  - 상세: `apply_status_update` 는 `load_state` → 메모리 딕셔너리 수정 → `save_state` 순서를
    어떤 락·CAS·파일 잠금도 없이 수행한다. `code-review-agents/SKILL.md:98` 와
    `consistency-checker/SKILL.md` 의 "(fallback) 수동 Agent 경로"가 이 함수를 부르는 실제
    시나리오를 명시한다 — main 이 `Agent` tool 로 여러 sub-agent 를 **병렬** fan-out 한 뒤 각각의
    결과를 `--update <session_dir> --agent <name> --status <s>` 로 보고한다. 프로젝트 CLAUDE.md/
    도구 안내 자체가 "독립적인 호출은 같은 응답에서 병렬로 실행" 을 권장하므로, 서로 다른
    agent 에 대한 두 `--update` 프로세스가 겹쳐 실행되는 것은 가상의 시나리오가 아니라 문서화된
    경로다. 구체적 인터리빙: 두 프로세스가 같은 초기 상태를 각각 읽고(A: `security` 성공 처리,
    B: `performance` fatal 처리), A 가 먼저 저장한 뒤 B 가 **자신이 읽은 stale 상태 전체**를
    저장하면 A 의 변경(‘security’ 를 success 로 이동 + 해당 `agent_history` 항목)이 통째로
    사라진다 — 전형적 lost-update. 영향 범위는 필드마다 다르다: 게이트가 실제로 참조하는
    `agents_success`/`agents_pending`/`agents_fatal` 3개 버킷은 다음 읽기(`--summary-state`/
    `--resume`/`emit_summary_state` 가 호출하는 `reconcile_state_with_disk`)에서 디스크의 실제
    리포트 파일 존재 여부(`has_report`)로 재계산되므로 **자가 치유**된다. 그러나 `agent_history`
    (감사 추적)와 `rate_limit_episodes`/`last_reset_hint_sec`(`/loop` 의 backoff 스케줄링 입력)는
    `reconcile_state_with_disk` 가 건드리지 않는 필드라 디스크 진실 소스가 없고, 경쟁이 나면
    **영구적으로 조용히 유실**된다 — 두 프로세스가 동시에 `rate_limit` 상태를 보고하면
    `rate_limit_episodes` 증가분 하나가 사라지고, 더 큰 `reset_hint`로 `max()` 를 계산한 쪽이
    저장되지 못하면 `/loop` 가 실제보다 짧은 대기 후 재시도해 다시 rate limit 을 맞을 수 있다.
    이 패턴은 이번 diff 가 새로 만든 것이 아니다 — `code_review_orchestrator.py` /
    `consistency_orchestrator.py` 의 옛 사본에도 byte-identical 하게 이미 있었다(diff 로 확인).
    다만 이제 세 orchestrator(code-review·consistency·merge-coordinator)가 **한 함수**를
    공유하므로, 고치기에 지금이 가장 싼 지점이다. 참고로 이 저장소는 유사하지만 더 낮은 위험도의
    카운터(`_lib/failopen_state.py:106-110`)에 대해 "Not worth `fcntl.flock` for an observability
    counter" 라고 **의도적으로** 락을 배제한 전례가 있다 — 다만 그 결정은 "1회 유실이 escalation
    을 한 박자 늦출 뿐" 이라는 명시적 근거가 있었고, 여기 `agent_history`/`rate_limit_episodes`
    는 그런 자가 치유 경로가 없어 같은 논리를 그대로 적용하기 어렵다.
    동시 `--update` 를 재현하는 회귀 테스트도 없다 (`test_retry_state_shared.py` 는 순차 호출만
    검증).
  - 제안: (a) 이 read-modify-write 구간에 `fcntl.flock` advisory lock 을 추가하거나, (b) 최소한
    `failopen_state.report` 의 docstring 처럼 "Known residual (accepted): …" 형태로 이 잔여
    위험을 명시적으로 문서화해 의도된 결정처럼 보이게 할 것. `agent_history`/`rate_limit_episodes`
    처럼 자가 치유가 없는 필드가 있다는 점에서 failopen 카운터와 동일 결론(락 불필요)으로
    단정하기보다 재검토를 권함.

- **[WARNING]** `save_state()` 비원자적 쓰기 — 동시 reader 가 깨진 JSON 을 볼 수 있고
  `load_state()` 는 그 경우를 처리하지 않음
  - 위치: `.claude/_shared/retry_state.py:41-47` (`load_state`), `:50-52` (`save_state`)
  - 상세: `save_state` 는 `open(state_file, "w")` 로 대상 파일을 즉시 truncate 한 뒤 `json.dump`
    로 스트리밍한다 — 임시 파일 + `os.replace` 원자적 치환이 아니다. 위 발견사항과 같은 동시
    `--update`/`--summary-state` 시나리오에서, 한 프로세스가 쓰기 중인 순간 다른 프로세스의
    `load_state()` 가 같은 파일을 열면 잘려나간/비어 있는 JSON 을 읽게 된다. `load_state()` 는
    파일이 아예 없는 경우(43-45줄)는 `sys.exit(1)` + 명확한 stderr 메시지로 부드럽게 처리하지만,
    바로 다음 줄의 `json.load(f)` (47줄) 는 어떤 `try/except` 로도 감싸지 않았다 — 즉 "파일 없음"
    은 우아하게 처리되면서 "파일이 쓰기 도중이라 깨져 있음" 은 처리되지 않는 비대칭이다. 이 경우
    해당 CLI 호출은 `json.JSONDecodeError` traceback 과 함께 그대로 죽는다.
  - 제안: 같은 디렉터리에 임시 파일(`f"{state_file}.tmp.{os.getpid()}"`)로 먼저 쓰고
    `os.replace()` 로 교체. 락이 전혀 필요 없고 모든 동시 reader 가 "완전한 옛 파일" 또는
    "완전한 새 파일" 중 하나만 보게 되어 torn-read 크래시 자체를 구조적으로 제거한다 — 이
    저장소가 선호하는 "손으로 짠 락보다 단순한 설계" 원칙과도 부합한다.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 자가 치유(`reconcile_state_with_disk`)가
  아예 없다 (이미 추적됨)
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` —
    `_load_state`/`_save_state`/`_apply_status_update` 만 `_shared/retry_state.py` 에 위임하고
    `_reconcile_state_with_disk` 위임은 없음(diff 에도 추가되지 않음)
  - 상세: 위 첫 번째 발견사항의 자가 치유 경로(`agents_success/pending/fatal` 가 디스크 리포트로
    재계산됨)가 세 orchestrator 중 이 파일에는 없다. 즉 merge-coordinator 는 lost-update 경쟁이
    나면 gating 버킷조차 자가 치유되지 않는다 — 다만 이 갭 자체는 이번 PR 이
    `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 9번 항목으로 이미 등재해 별도
    PR 로 분리하기로 명시했으므로 신규 결함으로 별도 집계하지 않는다. 위 WARNING 항목을 고칠 때
    이 파일이 상대적으로 더 취약하다는 점만 참고할 것.
  - 제안: 후속 9번 항목 처리 시 위 WARNING 수정과 함께 검토.

- **[INFO]** 확인했으나 문제 없음 — 명시적으로 배제
  - 데드락: 이 diff 전체에서 락 primitive 자체가 하나도 없다(0개 사용) → 데드락 표면 없음.
  - 스레드 안전성/async/await/이벤트 루프/리소스 풀링: 8개 대상 Python 스크립트에
    `threading`/`asyncio`/`ThreadPoolExecutor`/`multiprocessing` 사용이 전무. 훅·orchestrator
    는 전부 단발성 동기 CLI(`argparse` + `sys.exit`)이고, 관찰된 동시성은 스레드가 아니라
    OS 프로세스 레벨(병렬 sub-agent 호출)에서만 발생한다.
  - `guard_review_before_push.py`/`guard_review_before_stop.py` 의 `outcome.notes` 리스트
    append(`_evaluate_over_targets:809-867` 부근)는 `for target in targets` 순차 루프 내부라
    단일 프로세스 내 경쟁 없음.
  - `_shared/block_integrity.py` 의 `_read()`(88-93줄)는 SUMMARY.md/checker 리포트를 읽기만
    하며 이 diff 로 새로 생기는 쓰기 경쟁은 없다. 다른 프로세스가 그 파일을 쓰는 도중 읽으면
    부분 텍스트를 볼 수 있으나 정규식 매칭이 실패하는 방향(과소 카운트)으로만 기울고, 이 모듈은
    스스로 "차단이 아니라 경고" 설계임을 문서화하고 있어(파일 최상단 docstring) 허용 가능한
    fail-soft 로 판단.

## 요약

이번 diff 의 실질 핵심은 세 orchestrator 가 중복 보유하던 `_retry_state.json` bookkeeping
5개 함수를 `_shared/retry_state.py` 로 추출한 것으로, 저자의 AST 비교와 본 리뷰의 직접 diff
대조 모두 "동작 보존 이동" 임을 확인했다 — 즉 이 리팩터 자체가 새 동시성 결함을 만들지는
않는다. 다만 이동한 코드에 원래부터 있던 두 가지 프로세스 간 경쟁(락 없는 read-modify-write
로 인한 lost update, 그리고 `save_state` 의 비원자적 쓰기로 인한 torn-read 크래시)은 여전히
남아 있고, 세 orchestrator 가 이제 한 함수를 공유하는 지금이 가장 싸게 고칠 수 있는 시점이다.
영향은 필드별로 갈린다 — 게이트 판정에 실제로 쓰이는 success/pending/fatal 버킷은 다음 읽기의
디스크 기반 reconcile 로 자가 치유되지만, `/loop` 재시도 스케줄링에 쓰이는
`rate_limit_episodes`/`last_reset_hint_sec` 와 감사용 `agent_history` 는 자가 치유 경로가 없어
경쟁 시 조용히 영구 유실될 수 있다. 이 diff 범위 밖에서는 in-process 스레딩·asyncio·이벤트
루프·리소스 풀 사용이 전혀 없어 해당 관점들은 적용 대상이 아니다(NONE).

## 위험도

LOW
