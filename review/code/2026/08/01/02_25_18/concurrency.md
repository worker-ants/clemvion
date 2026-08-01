# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `_retry_state.json` 에 대한 read-modify-write 가 잠금 없이 이루어져 lost update 가 가능하다 (기존부터 있던 위험이 이번 라운드에 3개 오케스트레이터 공용 모듈로 중앙화·확산됨. 문서화는 그중 한 경로만 다룸)
  - 위치: `.claude/_shared/retry_state.py:174-198`(`apply_status_update` — load→메모리 수정→save, 파일 잠금 없음), 같은 파일 `94-132`(`reconcile_state_with_disk`, 동일 패턴의 conditional write), 그리고 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:340-416`(`_apply_routing` — 세 오케스트레이터 중 유일하게 `_shared/retry_state.py` 로 옮겨지지 *않은* 채 남은, 동일한 무잠금 read-modify-write 경로. 이번 diff 는 이 함수를 건드리지 않았다).
  - 상세: `save_state()`(50-91행) 자체는 temp 파일 + `os.replace` 로 원자적이라 "찢어진 읽기"(half-written JSON 을 동시 reader 가 읽는 상황)는 이미 막혀 있고, 이 속성은 `test_retry_state_shared.py::AtomicWriteTest` 가 정확히 고정한다. 그러나 "읽기→메모리 수정→쓰기" 트랜잭션 **전체**는 원자적이지 않다 — 두 프로세스가 거의 동시에 `load_state` 하면 나중에 `save_state` 하는 쪽이 먼저 쓴 변경을 통째로 덮어쓰는 고전적 lost update 가 발생한다. `retry_state.py` 자신의 `save_state` docstring(59-74행)이 이를 이미 인지하고 있고, "CLAUDE.md 가 독립적인 tool call 을 병렬 배치하라고 지시하므로 concurrent `--update` 는 사고 실험이 아니라 실제 경로" 라고 스스로 적어 두었다.
    자가치유(self-heal) 여부는 필드마다 다르다: `agents_success` 는 매 reconcile 마다 디스크의 리포트 파일에서 전량 재계산되므로 유실돼도 다음 reconcile 이 되살리지만, `agents_fatal`/`agent_history`/`rate_limit_episodes`/`last_reset_hint_sec` 는 디스크에 다른 근거가 없어 한 번 유실되면 영구 손실이다(59-74행이 정확히 이렇게 서술 — `/loop` 가 이미 영구 실패 판정된 checker 를 다시 돌리는 결과로 이어진다). `_apply_routing` 이 건드리는 `routing_status`/`agents_skipped`/`agents_pending` 도 같은 부류다: 라우터 적용(`--apply-routing`)과 forced reviewer 의 첫 완료 보고(`--update`)가 겹치면 `routing_status` 가 "pending" 에 멈추거나 `agents_skipped` 항목이 조용히 사라질 수 있는데, 이 경로는 disk-derived 자가치유 대상이 아니다.
    `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 10 이 정확히 이 위험군을 이미 등재·수용했지만(잠금 미채택 이유까지 포함), 그 서술은 `--update`(`apply_status_update`) 경로만 거명하고 `_apply_routing` 은 언급하지 않는다 — 향후 그 항목의 수정(sentinel 파일 설계 등)이 이 경로를 빠뜨리면 미완결로 남는다.
  - 제안: (1) `harness-review-gate-ci-backstop.md` 항목 10 서술에 `_apply_routing`/`reconcile_state_with_disk` 도 같은 위험군으로 명시 추가. (2) 실제 수정 시엔 `fcntl.flock`(모든 훅 경로에 블로킹 프리미티브를 두는 트레이드오프라 이미 기각됨) 대신, 이미 제안된 `<name>.fatal` 류 sentinel 파일처럼 "디스크에서 재도출 가능"한 설계를 `routing_status`/`agents_skipped` 까지 포함해 확장. (3) 지금 코드를 바꾸지 않더라도 concurrent `--update` + `--apply-routing` 조합의 lost-update 시나리오에 대한 회귀 테스트를 최소 1개 추가해 "받아들인 위험" 의 경계를 코드로 고정할 것을 권장한다(현재 `AtomicWriteTest` 는 단일 writer 의 원자성만 고정하고 동시 writer 시나리오는 다루지 않는다).

- **[INFO]** Stop 훅의 신규 note-throttle 마커가 기존과 동일한 무잠금 check-then-act(TOCTOU) 패턴을 재사용 — 이론상 경쟁이 가능하지만 최악의 결과도 "경고 중복 출력" 에 그친다
  - 위치: `.claude/hooks/guard_review_before_stop.py:380-386`(이번 라운드 신설 루프 — `for note in (...): digest = hashlib.sha1(...); marker = _marker_path(...); if _already_nudged(marker): continue; _mark_nudged(marker); print(note, ...)`), 재사용되는 헬퍼는 `_marker_path`(198행)/`_already_nudged`(214행)/`_mark_nudged`(218행)로 기존 `_nudge_once`(237행)와 동일한 이전부터의 설계.
  - 상세: `_already_nudged(marker)` 로 존재를 확인한 뒤 `_mark_nudged(marker)` 로 파일을 생성하는 전형적 TOCTOU 다. 동일한 (session_id, branch, note-digest) 조합에 대해 Stop 훅이 정말로 동시에 두 번 실행돼야 발현되는데, 이 하네스의 실행 모델상 한 세션은 턴 종료마다 훅을 순차 실행하므로 실제 발현 가능성은 낮다(같은 브랜치를 공유하는 별도 세션이 정확히 같은 순간에 턴을 끝내는 정도가 최소 조건). 발현되어도 결과는 동일한 경고 메시지가 stderr 에 한 번 더 찍히는 것뿐이며, 상태 손상이나 경고 누락은 아니다(오히려 fail-open 방향이라 안전). 이 저장소가 다른 곳(`bootstrap-session.sh` 의 mermaid install guard)에서도 "marker-only, lock 없음" 을 의도적으로 채택한 전례와 같은 계열이다.
  - 제안: 조치 불필요. 다만 이 마커 메커니즘을 향후 상태 손상 가능성이 있는 용도로 확장할 경우엔 이번처럼 "중복 출력" 정도로 끝나지 않을 수 있으니 그 시점에 재평가할 것.

- **[INFO]** `failopen_state.report()` 의 streak 카운터도 read-increment-write 무잠금 — 이미 문서화된 기존 잔여 위험이며 이번 diff 는 무관한 필드 추가뿐
  - 위치: `.claude/hooks/_lib/failopen_state.py:91-165`(`report()`), 특히 132행(`streak = read_streak(state_name) + 1`)과 160행(`write_streak(...)`) 사이의 구간. `Outcome` 클래스(36행)에 `notes` 필드(58행)가 이번 라운드에 추가됐지만 streak 로직 자체는 diff 대상이 아니다.
  - 상세: 함수 docstring(115-120행)이 "동시 실행 두 개가 겹치면 증가분 하나를 잃어 escalation 이 한 번 늦어질 수 있다" 를 이미 인지하고 있고, 배너 출력을 write 보다 먼저 실행하도록 순서를 짜 두어 "판정 신호 자체"는 경쟁의 영향을 받지 않는다(오직 누적 카운트만 영향받음). 관측성 카운터 용도이므로 `fcntl.flock` 을 붙이지 않기로 한 결정도 같은 docstring 에 명시돼 있다.
  - 제안: 조치 불필요 — 이미 의도된 트레이드오프이며 이번 diff 의 범위 밖이다.

## 요약

이번 라운드는 대부분 파일 I/O 기반 훅·오케스트레이터 스크립트로, 스레드/asyncio/커넥션 풀이 전혀 쓰이지 않아 "이벤트 루프 블로킹"·"스레드 안전성"·"async/await"·"리소스 풀링"·"데드락"(락 자체를 쓰지 않으므로) 관점은 사실상 해당 사항이 없다(모든 subprocess 호출에 명시적 timeout 이 있어 훅이 무기한 멈출 위험도 낮다). 실질적 동시성 표면은 여러 오케스트레이터 CLI 가 공유하는 `_retry_state.json` 하나뿐이며, 이번 diff 의 핵심(중복 5개 함수를 `_shared/retry_state.py` 로 추출)은 AST 비교로 동작 보존이 검증됐고, 오히려 `merge_coordinator_orchestrator.py` 의 상태 저장을 기존의 truncating write 에서 temp+`os.replace` 원자적 쓰기로 전환시켜 세 오케스트레이터 모두의 "찢어진 읽기" 창을 닫은 실질적 개선이다. 남은 것은 "읽기→수정→쓰기" 트랜잭션 전체의 무잠금 lost-update 인데, 이는 이번에 새로 도입된 결함이 아니라 코드 자신의 docstring 과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 10 이 이미 인지·수용한 잔여 위험이다 — 이 하네스가 실제로 막으려는 "가짜 성공"의 핵심 필드(`agents_success`)는 디스크에서 매번 재도출되므로 이 경쟁의 영향을 받지 않는다. 다만 그 문서가 거명하지 않은 두 번째 무잠금 write 경로(`code_review_orchestrator._apply_routing`, 및 그것이 다루는 `routing_status`/`agents_skipped` 처럼 자가치유 근거가 없는 필드)를 이번 리뷰에서 확인했으며, 향후 수정 범위에 추가로 반영할 가치가 있다. 그 외 두 건(Stop 훅의 신규 note 마커, 기존 fail-open streak 카운터)은 동일 계열의 이론적 TOCTOU 이지만 최악의 결과가 각각 "경고 중복"과 "연속 카운트 한 번 지연"에 그쳐 실질 영향이 낮다.

## 위험도

LOW
