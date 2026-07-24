# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** 공유 streak 상태 파일에 대한 read-modify-write 경쟁 조건 (lost update)
  - 위치: `.claude/hooks/guard_review_before_push.py` `_read_streak()` (L372-379), `_write_streak()` (L381-388), 호출부 `_report_fail_open()` (L391-428, 특히 L403-404 `streak = _read_streak() + 1; _write_streak(streak, degraded)`)
  - 상세: `_state_path()` 가 반환하는 `.claude/state/push_guard_failopen.json` 은 프로세스 간 공유되는 단일 파일이며, "읽기 → +1 → 쓰기" 시퀀스에 락이 전혀 없다. 이 훅은 `PreToolUse(Bash)` 로 매 `git push` 시도마다 별도 프로세스로 기동되므로, 같은 `CLAUDE_PROJECT_DIR` (동일 worktree) 안에서 두 번의 push 시도가 시간적으로 겹치면 (예: 한 턴에서 병렬로 발행된 여러 Bash 호출, 또는 동일 worktree 를 공유하는 겹치는 세션) 두 프로세스가 같은 `streak` 값(N)을 동시에 읽고 둘 다 `N+1` 을 써서 실제로는 두 번 연속 fail-open 이 발생했음에도 카운터가 한 번만 증가하는 lost-update 가 발생한다. 이 기능의 목적 자체가 "연속 fail-open 을 놓치지 않고 LOUD 하게 알리는 것"(§E 정책, 코드 주석 L354-362)이므로, 바로 그 카운터가 경쟁 조건에 취약하다는 것은 목적에 반하는 결함이다. 다행히 이 레이스는 게이트의 **차단/허용 판정 자체(`_run_gates`)에는 영향을 주지 않는다** — 각 프로세스는 자신의 판정을 독립적으로 올바르게 계산하며, 영향을 받는 것은 "연속 N회" 표시용 보조 관측 카운터뿐이다. 즉 최악의 경우도 `_FAILOPEN_ESCALATE_AT=3` 경고가 지연되거나 한두 번 덜 정확하게 세어지는 정도이며, 안전 계약(리뷰/plan 미비 push 차단)이 우회되지는 않는다.
  - 부가: L398-400 의 "정상 실행 시 streak 리셋" 로직도 `os.path.exists()` 확인 후 `os.remove()` 하는 TOCTOU 이지만, `_report_fail_open` 전체가 바깥의 `except Exception: pass` (L426-428) 로 감싸여 있어 동시 삭제로 인한 `FileNotFoundError` 는 무해하게 흡수된다.
  - 제안: 이 프로젝트에는 이미 동일 클래스의 문제에 대한 선례가 있다 (`.claude/tools/bootstrap-session.sh` 주석, L65-97: mermaid install marker 에 대해 "손으로 짠 mkdir 락은 TOCTOU 였고, 올바른 primitive 는 OS advisory lock(`fcntl.flock`, 프로세스 종료 시 자동 해제)"이라고 명시하며, 다만 그 사례는 위험이 작고 self-heal 되므로 "실제로 자주 재발하면(recurring) 그때 `fcntl.flock` 도입" 으로 의도적으로 defer 함). 본 변경도 같은 판단 기준을 적용할 수 있다: (a) 정확한 카운트가 중요해지면 `_report_fail_open` 의 read-increment-write 구간을 `fcntl.flock` 으로 감싸는 것이 이 코드베이스의 확립된 정답이다. (b) 그게 아니라면, 이 residual 을 mermaid 사례처럼 주석으로 명시적으로 승인·기록해 두는 편이 "우연히 안전한 것"과 "의도적으로 받아들인 위험"을 구분해 준다. 현재는 이 트레이드오프가 코드 주석에 드러나 있지 않다.

- **[INFO]** 상태 파일 쓰기가 원자적이지 않음 (torn write 가능성)
  - 위치: `_write_streak()` L381-388, `open(path, "w", ...)` + `json.dump(...)`
  - 상세: 임시 파일에 쓰고 `os.replace()` 로 교체하는 원자적 패턴이 아니라 대상 파일을 직접 열어 truncate 후 쓴다. 두 프로세스가 동시에 같은 파일을 "w" 모드로 열면 이론상 interleave 된 바이트로 파일이 손상될 수 있다. 다만 `_read_streak()` 이 `json.load` 실패를 포함한 모든 예외를 `except Exception: return 0` 으로 흡수하므로 (L373-378), 손상된 상태는 크래시가 아니라 "streak 를 0으로 조용히 리셋"으로 self-heal 된다 — 이는 이 모듈의 명시된 설계 원칙("Nothing here may ever raise into the guard", L361-362)과 일치하는 동작이며, 이 저장소의 다른 상태 파일들(`.claude/hooks` 전반에 `tempfile`/`os.replace` 사용 사례 없음, grep 결과 0건)과도 일관된 스타일이다. 차단 로직에는 영향 없음.
  - 제안: 우선순위 낮음. 위 WARNING 항목의 락 도입과 묶어서 처리하면 `os.replace` 로의 전환도 자연스럽게 따라온다. 별도 조치는 필수 아님.

- 긍정적 확인 사항 (결함 아님, 참고용):
  - `main()` 의 `try: return _run_gates(degraded) finally: _report_fail_open(degraded)` (L482-488) — 차단(`return 2`) 경로를 포함한 모든 종료 경로에서 리포팅이 실행되도록 `finally` 를 올바르게 사용했다. "한쪽 게이트가 차단하는 동안 다른 쪽이 fail-open 되는" 케이스를 놓치지 않는 정확한 제어 흐름이며, 테스트(`test_degradation_is_reported_even_when_the_other_gate_blocks`, L319-326)로도 검증됨.
  - 이 훅은 단일 스레드·단일 프로세스 동기 실행이 전제이며(PreToolUse 훅 계약상 빠르게 완료되어야 함) async/await, 스레드 풀, 커넥션 풀은 관련 없음. 프로세스 내부에 공유 가변 상태(전역 mutable state)도 없음 — `degraded` 리스트는 각 프로세스 로컬이라 스레드 안전성 문제 자체가 없다.
  - `_write_streak` 의 `os.makedirs(..., exist_ok=True)` 는 동시 디렉터리 생성 경쟁에 이미 안전한 관용구.

## 요약

이번 변경은 fail-open 을 "조용히 통과"에서 "시끄럽게 알리고 카운트"하는 관측성 기능을 추가하며, 훅 자체는 여전히 단일 프로세스·동기 실행이라 스레드 세이프티·async/await·데드락 관점의 위험은 없다. 유일한 실질적 동시성 관심사는 새로 도입된 `.claude/state/push_guard_failopen.json` 상태 파일에 대한 프로세스 간 read-modify-write 이다: 락 없이 "읽기 → +1 → 쓰기" 를 수행해 동시에 겹치는 두 번의 push 시도가 연속-fail-open 카운터를 lost-update 로 과소 집계할 수 있다. 다행히 이 경쟁은 게이트의 핵심 안전 계약(차단/허용 판정)에는 영향을 주지 않고 보조 관측 카운터의 정확도에만 영향을 미치며, 이 저장소에는 정확히 같은 트레이드오프를 명시적으로 검토·승인한 선례(`bootstrap-session.sh` 의 mermaid install marker, `fcntl.flock` 을 "recurring 해지면 도입"으로 defer)가 있다. 코드가 "리포팅이 가드를 절대 깨서는 안 된다"는 원칙을 예외 처리로 일관되게 지키고 있어(모든 실패 경로가 흡수됨) 심각도는 낮게 판단한다.

## 위험도

LOW
