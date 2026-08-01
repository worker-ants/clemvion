# Concurrency Review — harness-block-backstop (2026-08-01 00:33:34)

## 발견사항

- **[WARNING]** `apply_status_update()` 의 `agent_history`/`rate_limit_episodes`/`last_reset_hint_sec` 갱신이 동시 writer 에 대해 원자적이지 않음 (lost update)
  - 위치: `.claude/_shared/retry_state.py:158-188` (특히 171-172, 174-175, 180 — 세 필드의 read-modify-write), 원인 논의는 `retry_state.py:56-60` (`save_state` 독스트링) 에 이미 서술됨.
  - 상세: `apply_status_update` 는 `load_state()`(파일 read) → 메모리에서 버킷/이력/한도 필드 mutate → `save_state()`(마지막에 `os.replace` 로 원자적 rename) 순서로 동작한다. `os.replace` 자체는 "부분 쓰기"를 막아주지만, **두 프로세스가 동시에 이 함수를 호출하면 나중에 쓴 프로세스가 먼저 쓴 프로세스의 변경을 통째로 덮어쓴다** — 전형적인 read-modify-write 경쟁이다. `agents_success`/`agents_pending`/`agents_fatal` 세 버킷은 `reconcile_state_with_disk()` 가 디스크의 리포트 존재 여부로부터 매 read 시점에 재계산하므로(파일 79-116) 유실된 갱신이 있어도 다음 reconcile 에서 진실 상태로 수렴한다. 그러나 `agent_history`(호출 이력)와 `rate_limit_episodes`/`last_reset_hint_sec`(백오프 힌트)는 그런 수렴 경로가 전혀 없다 — 코드 자신의 주석이 정확히 이렇게 인정한다: "agent_history and the rate-limit fields have no such convergence and can still be lost under a true race — tracked, not solved here." 이 경쟁은 이론적 시나리오가 아니다: CLAUDE.md 자체가 "독립적인 도구 호출은 같은 응답에서 병렬로 호출" 하라고 지시하므로, 여러 sub-agent 가 같은 턴에 완료된 뒤 각각의 `--update --agent X --status success` 를 병렬 Bash 호출로 묶어 실행하는 경로가 실제로 존재한다. 유실되면 `last_reset_hint_sec` 이 실제보다 작은 값으로 남아 `/loop` 가 rate-limit 이 아직 안 풀렸는데 너무 이르게 재시도해 rate-limit 을 반복 유발할 수 있고, `agent_history` 의 일부 항목이 조용히 사라져 사후 감사 근거가 빠진다.
  - 제안: 이미 인지되고 문서화된 트레이드오프이므로 즉시 수정을 요구하기보다, (1) `--update` 호출부(오케스트레이터를 부르는 쪽, 예: developer/consistency-checker SKILL 워크플로)에 "동일 세션의 `--update` 호출은 병렬 배치하지 말 것" 이라는 명시적 caveat 을 추가하거나, (2) 파일 자체에 상태 파일 갱신용 경량 `fcntl.flock` 을 두는 것을 고려. 후자를 택하지 않기로 결정했다면 `.claude/hooks/_lib/failopen_state.py:111-115` 의 "Not worth `fcntl.flock` for an observability counter" 근거와 상호 참조를 남겨, 같은 트레이드오프가 두 파일에서 따로 재발견되지 않게 할 것을 권장.

- **[INFO]** 동일 클래스의 미잠금 read-increment-write — `failopen_state.py` 의 연속 fail-open 카운터
  - 위치: `.claude/hooks/_lib/failopen_state.py:63-84` (`read_streak`/`write_streak`), `.claude/hooks/_lib/failopen_state.py:97-116` (`report()` 독스트링의 "Known residual (accepted)" 단락)
  - 상세: push 훅과 stop 훅이 동시에(예: 두 터미널에서 거의 동시에 `git push`) 같은 상태 파일을 read-increment-write 하면 한 번의 증가분이 유실돼 `ESCALATE_AT`(3연속) 배너가 한 번 늦게 뜰 수 있다. 이미 코드 주석이 정확히 이 residual 을 인지하고 "관측용 카운터에 `fcntl.flock` 은 과함" 이라고 명시적으로 근거를 남긴 상태라 — 판단 자체는 타당하다(배너가 조금 늦게 뜨는 것뿐, 게이트의 차단/허용 판정에는 영향 없음).
  - 제안: 조치 불요. 리뷰 관점에서 근거가 명시돼 있고 blast radius 가 관측성 배너 지연으로 국한됨을 확인.

- **[INFO]** 세션 내 재실행 시 nudge 마커의 check-then-act (TOCTOU)
  - 위치: `.claude/hooks/guard_review_before_stop.py:208-240` (`_already_nudged` → `_mark_nudged` → `_nudge_once`)
  - 상세: `os.path.exists(marker)` 확인과 `open(marker, "w")` 마킹이 원자적으로 묶여 있지 않다. 현재 아키텍처에서는 동일 `(session_id, branch, kind)` 조합에 대해 Stop 훅이 진짜로 동시에 두 번 실행되는 경로가 없어(한 세션의 turn-end 는 순차적으로 한 번씩 발생) 실질적으로 트리거되지 않는다.
  - 제안: 현재로선 조치 불요. 다만 훅 호출 모델이 향후 비동기/다중 세션 동시 실행으로 바뀔 경우를 대비해 `os.open(marker, os.O_CREAT | os.O_EXCL)` 로 "마커 선점" 을 원자화하는 방법이 있음을 남겨둔다.

- **[INFO]** `merge_coordinator_orchestrator.py` 에는 `reconcile_state_with_disk` 자기치유가 없음 (신규 결함 아님, 이미 추적됨)
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:108-124` (특히 108-112 주석), 관련 추적: `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 항목 9번.
  - 상세: 이번 PR 은 `code_review_orchestrator.py`/`consistency_orchestrator.py` 의 상태 bookkeeping 5종을 `.claude/_shared/retry_state.py` 로 추출했고, `merge_coordinator_orchestrator.py` 도 `_load_state`/`_save_state`/`_apply_status_update` 는 같은 공유 모듈에 위임하도록 갱신됐다. 그러나 이 세 번째 오케스트레이터는 애초부터 (이번 PR 이전부터) `reconcile_state_with_disk` 를 구현한 적이 없어서, `Agent` tool 로 직접 fan-out 된 merge-coordinator 세션은 `_retry_state.json` 이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 가 실제 성공을 보고하는 모순을 여전히 겪을 수 있다 — 다른 두 오케스트레이터가 이미 고친 것과 동일한 stale-state 클래스다. 코드 주석 자체가 "다른 skill 의 동작 변경이라 별도 PR 로 분리" 라고 명시하고, 같은 changeset 에 포함된 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 후속 9번 항목이 이를 기록해 두었으므로 이번 diff 가 만들거나 악화시킨 결함이 아니다.
  - 제안: 이미 계획된 후속 작업이므로 이번 PR 에서는 조치 불요. 후속 PR 에서 처리 시 `_shared/retry_state.py` 에 `reconcile_state_with_disk` 를 두고 세 오케스트레이터가 모두 그것을 공유하도록 하면 이 항목도 함께 닫힌다.

## 검토한 설계에서 확인된 양호한 점 (참고)

- `retry_state.save_state()` 는 같은 디렉터리의 임시 파일 + `os.replace` 로 "쓰기 도중 읽음" 에 의한 half-written JSON 을 구조적으로 제거한다 (`.claude/_shared/retry_state.py:65-75`).
- `resolution_in_flight` 마커는 `tool_use_id` 로 파일명을 분리해 동시 dispatch 가 서로 다른 파일에 쓰도록 만들어 read-modify-write 경쟁 자체가 없다 (`.claude/hooks/mark_resolution_in_flight.py:70-73`, `.claude/hooks/_lib/review_guard.py:841-892` 의 "race-free" 서술과 일치함을 직접 확인).
- `ReviewDecision.notes`/`Outcome.notes` 는 exit code 에 따라 stdout/stderr 를 명시적으로 갈라(`.claude/hooks/guard_review_before_push.py:733-746`, `.claude/hooks/guard_review_before_stop.py`), Stop 훅의 JSON 프로토콜(stdout)이 advisory 출력으로 오염되지 않도록 스트림 선택을 정확히 반영했다.
- 이번 diff 의 핵심(`code_review_orchestrator.py`/`consistency_orchestrator.py` 의 상태 함수를 `_shared/retry_state.py` 로 추출) 은 AST 비교로 동작 동일성이 사전 검증됐고(독스트링에 명시), 전용 회귀 테스트(`test_retry_state_shared.py`)가 두 오케스트레이터의 CLI 출력(stdout 줄 + "reconciled" stderr 알림)이 추출 후에도 동일함을 subprocess 로 고정한다 — 리팩터 자체가 새 동시성 결함을 도입하지 않았다는 근거가 테스트로 뒷받침된다.
- 어떤 리뷰 대상 파일에도 thread/asyncio/multiprocessing 직접 사용이 없음을 확인했다(전 파일 grep 0건) — 실질적 동시성 표면은 전부 "여러 프로세스가 같은 파일을 공유"하는 형태이고, 위 발견사항들이 그 표면을 모두 다룬다.

## 요약

이번 변경은 `code_review_orchestrator.py`/`consistency_orchestrator.py` 의 중복 상태-bookkeeping 코드를 `.claude/_shared/retry_state.py` 로 추출하고(AST 검증된 동작 보존 리팩터), `[CRITICAL]` 하향을 잡아내는 `block_integrity.py` 백스톱을 `review_guard.py`/두 훅에 배선한 작업으로, 스레드·asyncio·멀티프로세싱 코드는 전혀 도입하지 않았다. 실질적인 동시성 표면은 전부 "여러 프로세스가 같은 상태 파일을 공유"하는 형태(`_retry_state.json`, fail-open streak 카운터, resolution-in-flight 마커, one-shot nudge 마커)이며, 그중 정합성에 영향을 주는 버킷(`agents_success/pending/fatal`)은 디스크 기준 재계산으로 이미 수렴하도록 설계돼 있다. 다만 `agent_history`/`rate_limit_episodes`/`last_reset_hint_sec` 세 필드는 그런 수렴 경로가 없어 동시 `--update` 호출 시 유실될 수 있다는 점을 코드 스스로 인지·문서화("tracked, not solved here")한 상태이고, 실제로 CLAUDE.md 의 "독립 호출은 병렬로" 관행이 그 트리거 시나리오를 현실적으로 만든다는 점에서 WARNING 으로 표기했다. 나머지(failopen 스트릭 경쟁, Stop 훅 마커 TOCTOU, merge-coordinator 의 reconcile 부재)는 이미 근거가 서술돼 있거나 별도 plan 항목으로 추적 중인 저-blast-radius 잔여 사항으로 INFO 수준이다. CRITICAL 급 데드락·경쟁조건·await 누락은 발견되지 않았다.

## 위험도
LOW
