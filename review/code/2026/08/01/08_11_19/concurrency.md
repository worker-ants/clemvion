# 동시성(Concurrency) Review

## 방법론 메모 (라운드 8 지침에 대한 대응)

라운드 7이 지적한 두 결함 — (a) `BLOCK:` 정규식의 O(n²) 백트래킹, (b) `_evaluate_over_targets`의
early-return advisory 드롭 — 은 "코멘트를 읽고 판단하지 말라"는 지침에 따라 **직접 실행/실측**으로
재검증했다. 둘 다 이번 라운드 코드에서는 이미 수정되어 있고, 회귀 테스트로 고정돼 있음을 확인했다
(아래 발견사항 5). 이 검증에 근거해, 이번 리포트의 핵심은 (1) 그 수정이 진짜인지 확인 + (2) 나머지
동시성 표면(주로 공유 JSON 상태 파일)에서 진짜 레이스를 찾는 것으로 구성했다.

## 발견사항

- **[WARNING]** `_shared/retry_state.py` — 잠금 없는 read-modify-write로 인한 동시 `--update` 호출 시 상태 유실(lost update). 실측으로 재현함.
  - 위치: `.claude/_shared/retry_state.py:174`(`apply_status_update`), `:94`(`reconcile_state_with_disk`), `:50`(`save_state`)
  - 상세: `apply_status_update`는 `load_state` → 메모리 변경 → `save_state`의 read-modify-write이며 잠금이 없다. 두 프로세스가 같은 초기 상태를 읽은 뒤 서로 다른 필드를 갱신하면 나중에 쓰는 쪽이 먼저 쓴 쪽의 변경을 덮어쓴다. 직접 재현: 프로세스1이 agent `a`를 fatal로 전이(commit)한 직후 프로세스2가 (그 이전 스냅샷을 들고 있던 채로) agent `b`를 success로 전이해 저장하면, 최종 상태에서 `a`의 fatal 전이가 사라지고 `a`는 다시 `agents_pending`으로 돌아간다(재현 스크립트로 확인). `save_state`의 원자적 쓰기(`os.replace`)는 **찢어진 읽기**만 막을 뿐 **동시 쓰기 유실**은 막지 못하며, `agents_success`는 디스크의 리포트 파일에서 매 읽기마다 재도출되어 자가치유되지만 `agents_fatal`/`agent_history`/`rate_limit_episodes`/`last_reset_hint_sec`는 순수 in-memory 필터링이라 유실되면 `reconcile_state_with_disk`를 다시 돌려도 복구되지 않음을 별도로 재현·확인했다(즉 `/loop`가 이미 영구 실패 판정된 checker를 무한정 재시도할 수 있다). CLAUDE.md 자체가 "batch independent tool calls in parallel"을 지시하므로 동시 `--update`는 사고실험이 아니라 실제 경로다 — 파일의 docstring도 정확히 이렇게 말한다. **다만 이 리스크는 이미 `plan/in-progress/harness-review-gate-ci-backstop.md`의 신규 후속 #10("`_retry_state.json`의 lost update — 잠금이 없다")으로 추적·의도적으로 defer된 상태**이며, `fcntl.flock`을 훅의 블로킹 경로에 두지 않겠다는 근거도 이 코드베이스의 다른 상태 파일들과 일관된 판단이다.
  - 제안: 즉시 조치를 요구하는 것은 아님(이미 tracked). 다만 계획대로 `<name>.fatal` sentinel 파일 등으로 `agents_fatal`도 디스크에서 재도출 가능하게 만드는 설계가 이 write 경로에 짧은 파일 잠금을 추가하는 것보다 이 코드베이스의 기존 철학(자가치유 > 잠금)에 더 부합한다.

- **[WARNING]** `merge_coordinator_orchestrator.py` — 세 번째 상태 사본에 `reconcile_state_with_disk` 자가치유가 아예 없음(위 항목보다 더 노출된 형태).
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:87-100` (delegation 주석 블록)
  - 상세: 이 orchestrator도 `_load_state`/`_save_state`/`_apply_status_update`를 `_shared/retry_state.py`에 위임하지만, 다른 두 orchestrator(`code_review_orchestrator.py`, `consistency_orchestrator.py`)가 갖는 `_reconcile_state_with_disk` 위임이 이 파일에는 없다. 코드 자체의 주석이 이를 정확히 인지하고 있다: "Agent tool로 직접 fan-out한 세션이 prepare 시점 스냅샷에 멈춘 채 SUMMARY는 실제 성공을 보고하는, 다른 두 orchestrator가 이미 고친 모순을 그대로 겪는다." 이는 위 항목의 "부분 유실"보다 심한 "전면 미반영" 형태다. 이미 plan 문서 신규 후속 #9로 추적되어 있고, 별도 skill의 동작 변경이라는 이유로 이번 PR 범위에서 의도적으로 분리됐다.
  - 제안: 이미 등재된 대로 별도 PR에서 `_reconcile_state_with_disk` 위임을 추가해 다른 두 orchestrator와 동일한 자가치유 보장을 갖출 것.

- **[INFO]** `_lib/failopen_state.py` — `write_streak`이 원자적 쓰기가 아니어서 `_retry_state.json`(`save_state`)과 비대칭.
  - 위치: `.claude/hooks/_lib/failopen_state.py:77-88`(`write_streak`), `:67-74`(`read_streak`)
  - 상세: 이 저장소의 다른 공유 JSON 상태 파일(`_retry_state.json`)은 temp 파일 + `os.replace`로 찢어진 읽기를 막지만, `push_guard_failopen.json`/`stop_guard_failopen.json`은 truncating `open(path, "w")`를 그대로 쓴다. 동시 쓰기 도중 `read_streak`이 읽으면 `json.load`가 `JSONDecodeError`를 던질 수 있지만 `except Exception: return 0`으로 조용히 흡수되어 크래시는 없다 — 방향은 안전(과소집계일 뿐 과대집계·크래시 없음)하다. `report()`의 docstring(주석 115~119줄)이 "read-increment-write가 잠기지 않아 lost update가 날 수 있다"고 이미 인정하지만, 그 프레이밍은 "증가분 유실"이지 "쓰기 도중 읽어 파싱 실패"는 아니다 — 메커니즘은 다르지만 결과(과소집계, 안전한 방향)는 동일해 심각도는 낮다.
  - 제안: 고칠 필요성은 낮다(문서 자체가 "관측용 카운터에 `fcntl.flock`은 과하다"고 이미 결론). 다만 주석에 이 케이스도 함께 명시해두면 다음 리뷰에서 같은 걸 다시 찾는 비용을 아낄 수 있다.

- **[INFO]** `guard_review_before_stop.py` — `_already_nudged`/`_mark_nudged`가 check-then-act로 원자적이지 않아, 이론상 동일 (session, branch, kind)에 중복 nudge 가능.
  - 위치: `.claude/hooks/guard_review_before_stop.py:214-215`(`_already_nudged`), `:218-224`(`_mark_nudged`), `:237-246`(`_nudge_once`)
  - 상세: 두 개의 인터리빙된 호출을 흉내 낸 재현 스크립트로 확인 — 둘 다 `_already_nudged() == False`를 통과한 뒤 각자 `_mark_nudged()`를 호출하면, 모듈 docstring(17~22줄)이 선언한 "세션당 1회" 계약이 깨지고 동일 nudge가 두 번 발화한다. 실제로 이 경로가 진짜 동시에 재진입될 개연성은 낮다(Stop은 통상 턴 종료 시 한 번만 발화) — 하지만 코드 자체에는 그 가정을 강제하는 원자성이 없다.
  - 제안: `os.open(marker, os.O_CREAT | os.O_EXCL)`로 확인+생성을 한 syscall로 묶으면 TOCTOU를 제거할 수 있다. 영향이 "중복 안내 문구 출력" 수준(데이터 손상·차단 오작동 없음)이라 우선순위는 낮다.

- **[검증 완료 — 결함 아님]** 라운드 7이 발견한 두 결함은 이번 코드에서 실제로 수정돼 있고, 회귀 테스트로 고정돼 있음을 직접 실측·실행으로 확인.
  - 위치: `.claude/_shared/block_integrity.py:79-84`(`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`), `.claude/hooks/guard_review_before_push.py:809-883`(`_evaluate_over_targets`)
  - 상세 (a) 정규식: `("> " * 3 + "\n") * n`(n=1000~32000, 문서 자체가 인용하는 적대적 입력)으로 두 정규식을 직접 벤치마크한 결과 선형 스케일을 확인했다(n=1000→32000, 32배 입력에 시간도 약 32배: START 0.0001s→0.0023s, END 0.0000s→0.0008s — quadratic이면 ~1000배가 되어야 함). 문자 클래스가 `\s`(개행 포함) 대신 `[ \t>#*_\`-]`로 개행을 배제해 라운드 7이 지적한 백트래킹 경로가 실제로 제거되어 있다. `.claude/tests/test_block_integrity.py::VerdictParserStaysLinearTest`가 20,000줄 입력 + 5초 서브프로세스 타임아웃으로 이 회귀를 고정한다.
    (b) advisory 드롭: `_evaluate_over_targets`를 실제 모듈에서 import해 3-target stub(첫 target이 차단, 이후 target들이 각자 다른 note를 반환)으로 직접 구동한 결과, 차단 메시지는 첫 차단 target 것을 쓰면서도 **모든** target의 note가 살아남음을 실행으로 확인했다. 소스에서도 루프 안에 `return`이 없고(`blocked = render(...)`만 하고 `continue`), 루프가 끝까지 순회함을 재확인했다. `test_block_integrity.py::NotesFromLaterTargetsSurviveAnEarlierBlockTest`의 docstring이 정확히 이 라운드 8 지침이 말하는 "거울상 케이스"를 명명한다: "The comment defending the feature only covered the other arrangement (the blocking target's *own* notes)" — 즉 예전 방어 주석은 "차단한 target 자신의 note"만 지킨다고 주장했을 뿐 "차단 *이후* 다른 target의 note"까지 살아남는지는 별도로 검증하지 않았었고, 지금은 두 방향 모두 테스트로 못박혀 있다. 두 항목 모두 이번 라운드 코드에서 실제 결함이 아니다.

## 요약

이번 diff는 대부분 harness 자체 리뷰/일관성-체크 파이프라인(훅 + orchestrator + 공유 상태 라이브러리)이라, 진짜 동시성 표면은 "여러 프로세스/훅 호출이 같은 JSON 상태 파일(`_retry_state.json`, `*_failopen.json`, nudge marker)을 잠금 없이 read-modify-write" 하는 지점에 집중된다. 라운드 7이 남긴 두 실동작 결함(정규식 O(n²), advisory early-return 드롭)은 코드를 직접 벤치마크·실행해 검증한 결과 이미 고쳐졌고 회귀 테스트까지 갖춰져 있다. 나머지로 발견한 것은 (1) `_shared/retry_state.py`의 잠금 없는 상태 갱신으로 인한 lost-update — 실제로 재현되지만 이미 plan 문서에 후속 #10으로 추적된 의도적 defer, (2) `merge_coordinator_orchestrator.py`가 다른 두 orchestrator의 disk-reconcile 자가치유를 갖지 못해 더 노출된 형태 — 역시 이미 후속 #9로 추적, (3)-(4) `failopen_state.py`의 비원자적 스트릭 쓰기와 Stop guard 중복-nudge TOCTOU — 둘 다 새로 관찰했지만 영향이 "과소집계"/"중복 안내문" 수준으로 데이터 손상이나 차단 오동작으로 이어지지 않는다. 데드락 가능성은 없다(이 코드베이스는 명시적으로 잠금(`fcntl.flock`) 자체를 쓰지 않기로 결정했으므로 락 순서로 인한 교착은 애초에 발생할 수 없고, 대신 "잠금 없이 최종쓰기가 이긴다"는 트레이드오프를 택했다). async/await·이벤트 루프·스레드/커넥션 풀 관련 항목은 이 Python 파일 집합에는 해당 사항이 없다(실제 서브에이전트 병렬 fan-out은 이 diff에 포함되지 않은 별도 Workflow(JS) 엔진이 담당).

## 위험도

LOW
