# 동시성(Concurrency) Review

## 발견사항

- **[WARNING]** `_record_fatal` 의 sentinel 해제 분기가 "누가 fatal 로 만들었는지" 를 확인하지 않고 자기 `status` 값만으로 무조건 해제한다 — 동일 agent 이름에 대한 두 개의 겹치는 `--update` 호출이 서로 다른 최종 상태를 주장할 때, 방금 확립된 fatal 판정이 sentinel·JSON 양쪽에서 동시에 사라질 수 있다.
  - 위치: `.claude/_shared/retry_state.py:277`(`apply_status_update` 정의) ~ `:288`(`_record_fatal(sd, agent, status == "fatal")` 호출), 그리고 `_record_fatal` 본체 `.claude/_shared/retry_state.py:145`(정의) / `:178`~`:189`(sentinel 생성·해제 로직)
  - 상세: 재현 시퀀스 —
    1. P1, P2 가 같은 `agent="x"` 에 대해 거의 동시에 `apply_status_update` 를 호출한다. 둘 다 `load_state` 로 "x 는 아직 pending" 인 스냅샷을 읽는다.
    2. P1 이 `status="fatal"` 로 완주한다: `_record_fatal(sd, "x", True)` 가 sentinel 파일을 만들고, 버킷을 옮긴 뒤 `save_state` 로 JSON 에도 `agents_fatal=["x", ...]` 를 기록한다.
    3. P2 는 `status="rate_limit"`(또는 `success`) 로 뒤늦게 완주한다. P2 의 `_record_fatal(sd, "x", False)` 는 P1 이 방금 만든 sentinel 을 **무조건** 지운다 — P2 는 P1 의 존재를 모르고 자기 `status` 값만 본다. 이어서 P2 는 **P1 이전에 읽은 stale 스냅샷**을 그대로 `save_state` 하므로, JSON 의 `agents_fatal` 목록에서도 "x" 가 빠진 채로 디스크에 덮어써진다.
    4. 결과: JSON 도 "x" 를 fatal 로 기록하지 않고, sentinel 도 없다. 이후 `reconcile_state_with_disk` 의 `fatal_recorded = JSON ∪ sentinel` 합집합 계산은 두 소스 모두에서 증거를 찾지 못하므로 "x" 의 fatal 판정을 **영구히 복구하지 못한다**.
  - 이 시나리오는 이번 변경이 명시적으로 다루는 두 가지 이미 알려진 잔여 리스크와는 결이 다르다. plan(`plan/in-progress/harness-review-gate-followups.md` §10 "잔여 2")과 `test_clearing_fatal_is_still_unprotected_against_a_lost_update` 캐너리는 "의도적인 해제(demote)가 유실되어 fatal 이 잘못 유지되는" 방향만 고정해 두었다. 반대로 위 시나리오는 **막 확립된 fatal 판정 자체가, 같은 agent 이름에 대한 무관한(또는 stale) 후속 업데이트에 의해 완전히 지워지는** 방향이다 — 이 sentinel 기능이 원래 막으려던 바로 그 실패 모드(§10 원 버그: "한 번 유실되면 어떤 reconcile 로도 복구 불가")가 새 경로로 재발할 수 있다는 뜻이다.
  - `FatalSurvivesALostUpdateTest`/`test_clearing_fatal_is_still_unprotected_against_a_lost_update` 를 포함해 `.claude/tests/test_retry_state_shared.py` 의 모든 레이스 재현 테스트는 서로 **다른** agent 이름("a" 는 fatal 대상, "b" 는 끼어드는 writer)으로만 인터리빙을 구성한다 — 동일 agent 이름에 대한 겹치는 두 `--update` 호출은 테스트 스위트에 없다.
  - 실무적으로 이 경로가 얼마나 자주 발생할지는 CLAUDE.md 의 "독립적인 tool 호출을 병렬로 배치" 가이드가 reviewer 당 하나의 Agent 호출 → 하나의 `--update` 를 전제하므로, 정상 흐름에서는 같은 agent 이름이 겹쳐 업데이트될 일이 없어 보인다. 다만 중복 `ScheduleWakeup`, 재시도 로직의 이중 호출, 수동 재실행과 자동 `/loop` 재개의 경합 같은 비정상 경로에서는 발생 가능하며, 코드 자체는 이를 막지 않는다.
  - 제안: 다음 중 하나로 좁힐 것을 권장한다. (a) 이 경로를 명시적으로 "지원하지 않음"으로 문서화하고 — 같은 agent 이름에 대한 겹치는 `--update` 는 호출자 계약 위반이라고 `apply_status_update`/`_record_fatal` docstring 에 못박기, 또는 (b) `_record_fatal` 의 해제 분기가 무조건 지우지 않고 sentinel 의 mtime 이 자신이 읽은 `state` 스냅샷보다 최신이면(즉 자신보다 더 최근에 다른 writer 가 fatal 로 만들었으면) 해제를 보류하도록 방어. (b) 는 이미 plan 에 등록된 "잔여 2"(해제 방향 설계 — `_cleared/` 마커 또는 mtime 비교)와 같은 설계 축이므로, 그 후속 설계에 이 시나리오도 함께 포함시키는 편이 자연스럽다.

- **[INFO]** (이미 추적됨, 새 발견 아님) `agents_fatal` 의 "해제(clear)" 방향은 여전히 lost-update 로부터 보호되지 않는다 — 코드·docstring·테스트가 이를 정확히 인지하고 캐너리(`test_clearing_fatal_is_still_unprotected_against_a_lost_update`)로 고정해 두었다.
  - 위치: `.claude/_shared/retry_state.py:161`~`:168` (`_record_fatal` docstring 의 비대칭 서술)
  - 상세: `agents_success`/`agents_fatal`(becoming) 은 디스크 파생 값과의 합집합/재도출로 수렴하지만, "fatal 이 아니게 됨" 은 sentinel 의 **부재**로만 표현되고 부재는 증거가 되지 못하므로, 해제 의도가 담긴 쓰기가 유실되면 stale JSON 이 그 이름을 되살린다. plan 문서(`plan/in-progress/harness-review-gate-followups.md` §10)에도 "리뷰가 잡음(concurrency 등 3명 수렴)" 으로 기록돼 있어, 이번 라운드가 처음 지적하는 사항이 아니다.
  - 제안: 이미 등록된 후속 설계(`_cleared/` 마커, sentinel mtime 대 상태파일 비교)를 그대로 진행하되, 위 WARNING 항목의 "동일 agent 동시 갱신" 케이스도 같은 설계에서 함께 커버할 것.

- **[INFO]** git 프로브(`_run_git`, `_run_git_raw`, `branch_diff_files`)는 동시성 관점에서 위험이 없다 — 순수 동기 `subprocess.run` 호출이고 공유 가변 상태·락·스레드가 전혀 없으며, 여러 orchestrator 가 동시에 같은 저장소에서 읽기 전용 `git diff` 를 호출해도 서로 간섭하지 않는다. `errors="surrogateescape"` 도입과 `except` 범위 원복은 동시성이 아니라 예외 처리/인코딩 정확성 이슈이며 이번 diff 안에서 이미 고쳐졌다(plan 문서상 requirement reviewer 가 별도로 포착).

- **[INFO]** `save_state` 의 원자적 쓰기(`os.replace`)와 `_record_fatal` 의 파일별(agent 당 1개) sentinel 설계는 견고하다. `os.makedirs(..., exist_ok=True)` 는 동시 디렉터리 생성 경쟁에 안전하고, sentinel 존재 여부만 확인하는 소비자(`fatal_on_disk`)는 파일 내용의 torn write 를 신경 쓸 필요가 없다(존재만 검사하므로). `fcntl.flock` 을 도입하지 않기로 한 결정("모든 훅 경로에 블로킹 프리미티브를 두게 된다")은 이 저장소의 훅 경로 특성상 타당한 트레이드오프로 판단된다.

- 해당 없음: async/await, 이벤트 루프, 스레드 풀/커넥션 풀 — 이번 변경 범위(Python 동기 스크립트, 문서, git 서브프로세스 래퍼)에는 비동기 코드·스레딩·풀링이 존재하지 않는다.

## 요약

이번 변경의 핵심은 세 orchestrator 가 공유하는 `_retry_state.json` read-modify-write 에 `_fatal/<name>` sentinel 파일을 추가해 "fatal 로 전이됨" 을 디스크에서 독립적으로 재도출 가능하게 만든 것과, 두 orchestrator 에 중복돼 있던 git branch-diff 프로브를 `_shared/git_probe.branch_diff_files` 로 통합한 것이다. 전체적으로 락 없는 RMW 의 트레이드오프를 매우 정밀하게 문서화하고 캐너리 테스트로 잔여 리스크(해제 방향 미보호)를 고정해 둔 점은 견고하다. 다만 `_record_fatal` 의 해제 분기가 자신의 `status` 값만으로 무조건 sentinel 을 지우는 구조여서, 이미 문서화된 "의도적 해제 유실" 과는 다른 방향의 레이스 — 동일 agent 이름에 대한 겹치는 두 `--update` 호출이 막 확립된 fatal 판정 자체를 사라지게 하는 경로 — 가 코드상 존재하며 테스트 스위트가 이를 커버하지 않는다. 발생 조건이 좁고(정상 배치 패턴에서는 agent 이름이 겹치지 않음) 크래시가 아닌 "영구 실패로 판정돼야 할 checker 가 재시도됨" 이라는 완화된 영향이라 CRITICAL 로 보지는 않지만, 이 변경의 핵심 목적(§10 원 버그 해소)과 정확히 같은 실패 모드를 다른 경로로 재도입할 수 있어 WARNING 으로 표시했다. git 프로브·오케스트레이터 배선 변경 자체는 동기·상태 비공유 코드라 동시성 위험이 없다.

## 위험도
MEDIUM
