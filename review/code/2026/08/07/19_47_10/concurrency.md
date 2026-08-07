# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `agents_fatal` 재도출(union)이 "fatal 로 전이"는 유실에서 복구시키지만, "fatal 해제"는 대칭적으로 보호하지 못한다
  - 위치: `.claude/_shared/retry_state.py:182-189`(`reconcile_state_with_disk` 의 union 계산), `.claude/_shared/retry_state.py:137-164`(`_record_fatal`), `.claude/_shared/retry_state.py:260-285`(`apply_status_update` 의 호출 순서)
  - 상세: `_record_fatal` 은 `save_state` **이전에** sentinel 을 두는 방식으로 "fatal 로 전이했다"는 사실을 JSON 저장 유실(레이스든 크래시든)에도 살아남게 만든다 — 이 방향은 테스트(`FatalSurvivesALostUpdateTest`)로 결정적으로 재현·검증돼 있고 잘 설계돼 있다.
    다만 반대 방향 — 이미 `fatal` 이던 agent 를 **나중에 non-fatal(`rate_limit`/`pending`)로 재판정**하는 경로 — 는 같은 보호를 받지 못한다. 그 경로에서도 `_record_fatal(sd, agent, False)` 가 sentinel 을 지워 "이제 fatal 아님"을 즉시(durable) 기록하지만, 바로 뒤 `save_state()` 호출이 유실(다른 agent 를 다루던 동시 writer 가 이 전이 이전 시점의 stale snapshot 을 뒤늦게 덮어쓰거나, 이 호출 자체가 sentinel 삭제 직후·`save_state` 이전에 죽는 경우)되면, JSON 은 여전히 그 agent 를 `agents_fatal` 에 남긴다. 이후 `reconcile_state_with_disk` 의 `fatal_recorded = set(state["agents_fatal"]) | set(fatal_on_disk(...))` 는 **OR(합집합)** 이므로, sentinel 이 없어도 JSON 쪽에 남아있는 값 하나만으로 그 agent 는 계속 `fatal` 로 재도출된다 — 즉 "sentinel 부재"는 "명시적으로 해제됨"의 증거로 쓰이지 않는다(설계상 의도적으로 그렇다 — `test_a_committed_session_with_no_sentinel_keeps_its_fatal` 이 이를 고정한다: sentinel 이 없는 옛 세션도 JSON 의 fatal 을 신뢰해야 하기 때문).
    결과적으로, 사람이 "이 agent 는 재시도 가치가 있다"고 판단해 fatal 을 해제하려는 시도가 이 좁은 창(레이스 또는 그 지점의 크래시)에 걸리면 **`/loop` 는 그 agent 를 영구 실패로 계속 취급**하고, 어떤 후속 reconcile 도 스스로 복구하지 못한다(오직 실제 리포트 파일이 나중에 생겨 `on_disk` 에 들어가는 경우에만 `missing` 에서 빠져 우회적으로 풀린다). 이는 이번 PR 이 없애려던 바로 그 실패 유형("디스크와 JSON 이 조용히 어긋나고 아무도 복구 못함")을 반대 방향으로 남긴 것이다. `save_state`/`_record_fatal` docstring 은 "agents_fatal … converges too"(치환된 전체 파일 62-89, 137-152행)라고 서술하는데, 이는 SET 방향에만 성립하고 CLEAR 방향에는 성립하지 않아 서술이 실제보다 강하다.
  - 제안: (a) 최소한 docstring 에 이 비대칭을 명시(SET 방향만 유실에 강하다는 스코프 한정)하거나, (b) sentinel 에 "명시적으로 클리어됨" 을 나타내는 양성 신호(예: 별도 `_cleared/<name>` 파일 또는 sentinel mtime 과 JSON 저장 시각 비교)를 추가해 union 계산이 "JSON 이 sentinel 보다 stale 하면 무시"할 수 있게 하는 방향을 검토. 발생 조건이 좁아 시급하지는 않지만, 회귀 테스트가 이 방향(레이스로 "clear" 유실 → reconcile 로도 복구 안 됨)을 아직 커버하지 않는다는 점도 함께 기록해 둘 만하다.

- **[INFO]** `_record_fatal` 의 sentinel 쓰기는 `save_state` 와 달리 원자적(temp+rename)이 아니다
  - 위치: `.claude/_shared/retry_state.py:156-160`
  - 상세: 현재는 모든 소비자(`fatal_on_disk`)가 파일 **존재 여부**만 확인하고 내용을 파싱하지 않으므로 torn write 자체는 기능적으로 무해하다. 다만 향후 sentinel 내용(타임스탬프)을 실제로 읽어 판단 로직에 쓰는 코드가 추가되면 이 비원자성이 표면화될 수 있다.
  - 제안: 현재로선 조치 불필요. 다만 sentinel 내용을 소비하는 코드를 추가할 계획이 있다면 그때 `save_state` 와 같은 temp+`os.replace` 패턴으로 맞출 것.

- **[INFO]** 동일 agent 이름에 대한 두 `apply_status_update` 호출이 겹치는 경우는 설계 범위 밖
  - 위치: `.claude/_shared/retry_state.py:137-147`(`_record_fatal` docstring 의 "the one the caller most recently asked for" 서술)
  - 상세: 이 PR 이 다루는 "동시 writer" 시나리오는 CLAUDE.md 의 "독립적인 tool 호출은 병렬 배치" 지침에 따른 **서로 다른 agent** 간의 겹침이다. 같은 agent 이름에 대해 두 `--update` 호출이 실제로 겹치는 경로(예: 재시도 로직의 이중 호출 버그)가 생기면 `_record_fatal` 이 같은 sentinel 파일에 경합하며 마지막 쓰기가 이기는데, 이는 JSON 쪽 마지막 저장자와 반드시 일치한다는 보장이 없다. 현재 코드베이스에서 이 경로가 실제로 발생한다는 근거는 없어 정보성으로만 남긴다.

## 요약

이번 변경의 핵심은 `.claude/_shared/retry_state.py` 의 `apply_status_update` — 잠금 없는 read-modify-write — 가 갖는 이미 알려진 lost-update 문제 중, 그동안 복구 불가능했던 `agents_fatal` 버킷을 `_fatal/<name>` sentinel 파일(에이전트당 1개, `save_state` 이전에 기록)로 디스크에 별도 기록해 재조정 가능하게 만든 것이다. `fcntl.flock` 을 다시 채택하지 않기로 한 결정(모든 훅 경로에 블로킹 프리미티브를 두게 된다는 이유)은 타당하고, 레이스를 스레드/sleep 없이 재진입으로 결정적으로 재현하는 테스트 기법도 견고하다. 다만 새로 추가된 union(`agents_fatal` JSON ∪ sentinel) 재도출 로직은 "fatal 로 전이"하는 방향의 유실만 대칭적으로 보호하며, "fatal 을 해제"하는 방향의 유실은 여전히 무방비다 — sentinel 부재가 "해제됨"의 증거로 쓰이지 않기 때문이다. 크래시나 레이스가 그 좁은 창에 걸리면 사람이 재시도를 의도한 agent 가 조용히 영구 fatal 로 고착될 수 있다. 그 외 `git_probe.py`(subprocess 기반 git 프로브 분리/신설)와 세 orchestrator 의 위임 변경, 신규 테스트들은 순차 실행 코드이며 스레드/락/async 관련 새로운 위험을 도입하지 않는다.

## 위험도

LOW
