# 동시성(Concurrency) Review — round 9

## 검증 방법

- 프롬프트가 잘라낸 6개 파일(`review_guard.py`, `guard_review_before_push.py`,
  `code_review_orchestrator.py`, `consistency_orchestrator.py`,
  `merge_coordinator_orchestrator.py` 후반부, `test_block_integrity.py`)은 전부 `Read` 로
  직접 열람했다.
- `git diff origin/main...HEAD -- .claude/ plan/` 로 18개 파일 각각의 **실제 변경분만** 분리해,
  번들에 실린 "전체 파일" 중 무엇이 이번 PR 이 새로 넣은 코드이고 무엇이 기존 코드인지 구분했다.
- `.claude/_shared/retry_state.py` 의 동시성 속성은 **직접 실행**으로 확인했다 — 코드를 읽고
  추론하는 대신, (a) 12개 스레드(같은 PID)와 (b) 12개 프로세스(`multiprocessing.get_context
  ("fork")`, 서로 다른 PID)로 동일 세션 디렉터리에 `apply_status_update` 를 동시 호출해 결과를
  직접 관측했다.
- `block_integrity.py` 의 정규식 회귀 3종은 **실제 커밋에서 직접 추출**해 재현했다 — 처음에는
  docstring 서술을 근거로 "과거 패턴"을 손으로 재구성했는데, 그 재구성이 부정확해 거짓
  신호(false positive)를 만들었다는 것을 `git show 5526fc8f8:.claude/_shared/block_integrity.py`
  (7R 이후/8R 이전 실제 코드)로 대조하고 나서야 발견했다 — 아래 발견사항 3에 기록.
- 저장소를 건드린 모든 임시 조작은 스크래치 디렉터리에만 파일을 쓰고, 저장소 내 파일은 `cp` 로
  스왑한 뒤 즉시 `cp` 로 원복 + `diff`(무출력)·`git status --porcelain`(무출력)으로 바이트 단위
  복원을 확인했다. 최종적으로 `git status`/`git diff --stat` 는 리뷰 산출물 디렉터리 외
  변경사항 없음.

## 발견사항

- **[WARNING]** `_shared/retry_state.py::save_state` 의 임시파일명이 `os.getpid()` 만으로
  유일성을 보장 — 프로세스 간에는 안전하지만 **스레드 간에는 파일 손상/크래시**를 일으킨다
  (현재는 잠복 상태, 실제 트리거되는 호출부 없음)
  - 위치: `.claude/_shared/retry_state.py:81` (`tmp = f"{state_file}.tmp.{os.getpid()}"`),
    관련 원자성 주장은 `:56-57`("`os.replace` is atomic on the same filesystem, which removes
    that window without needing a lock").
  - 상세: 직접 재현했다. 같은 세션 디렉터리에 12개 에이전트 이름으로 `apply_status_update` 를
    동시 호출했을 때 —
    - **프로세스 12개(서로 다른 PID, `multiprocessing` fork)**: 예외 0건. 다만 12건 중 6건만
      `agents_success` 에 반영(50% 유실) — 이는 아래 발견사항 2의 "이미 문서화된 lost update"
      와 정확히 일치하는, 안전한(따로 다루는) 결과다.
    - **스레드 12개(같은 PID, `threading`)**: `agents_success` 에 2건만 반영되고 나머지 10건
      중 7건이 예외를 던졌다 — `FileNotFoundError`(6건, `os.replace(tmp, state_file)` 호출 시
      다른 스레드가 **같은 경로의** tmp 파일을 이미 replace 로 소비해버려서 발생) ·
      `JSONDecodeError('Expecting value: line 1 column 1 (char 0)')`(1건, 두 스레드가 같은 tmp
      경로를 동시에 `open(..., "w")` 로 열어 truncate 한 결과 replace 직후 read 가 빈 파일을
      만난 것).
    - 즉 `save_state` 의 원자성 주장("removes that window without needing a lock")은
      **프로세스 간 동시성에서만** 성립하고, 스레드 간 동시성에서는 정확히 그 docstring 이
      막으려던 "찢어진 읽기/쓰기" 를 **다른 경로로 재도입**한다. 이 사실은 파일 어디에도
      명시돼 있지 않다 — docstring 은 "Lost updates between concurrent writers" 만 다루고,
      "같은 프로세스 안에서 동시 호출되면 안 된다" 는 불변식은 적혀 있지도, 강제되지도 않는다.
    - 다만 **현재는 잠복(latent)**: `grep -rln "ThreadPoolExecutor\|import threading\|
      concurrent\.futures\|multiprocessing" .claude/` 결과 0건 — 이 저장소의 모든 호출부는
      `python3 <orchestrator>.py --update ...` 형태의 **독립 서브프로세스** 뿐이라, 오늘 시점엔
      이 경로가 실제로 트리거되지 않는다. 하지만 그 불변식이 코드에 강제돼 있지 않으므로,
      향후 어떤 caller(테스트 헬퍼든, in-process 병렬화를 택한 새 오케스트레이션이든)가 스레드로
      호출하면 조용히 상태 파일이 깨진다 — 그리고 `load_state` 는 `json.load` 호출을
      `try/except` 로 감싸지 않으므로(`파일 없음`만 잡음), 손상된 JSON 은 이후 그 세션의
      **모든** `--update`/`--summary-state`/`--resume` 호출을 예외로 죽인다(내 재현에서
      실제로 확인).
    - 기존 테스트(`test_retry_state_shared.py:98-139` `AtomicWriteTest`)는 이 경로를 다루지
      않는다 — 두 테스트 모두 단일 스레드/단일 호출이다.
  - 제안: `tmp` 이름에 스레드 구분자를 추가(`f"{state_file}.tmp.{os.getpid()}.
    {threading.get_ident()}"`) 하거나 `tempfile.mkstemp(dir=os.path.dirname(state_file),
    prefix=os.path.basename(state_file)+".tmp.")` 로 OS 가 유일성을 보장하도록 바꿀 것. 값싼
    수정이고, 위 스레드 재현을 그대로 회귀 테스트로 추가하면 향후 이 불변식이 깨질 때 바로 잡힌다.

- **[INFO]** 위 발견사항과 별개로, **이미 문서화·백로그 등재된**(`plan/in-progress/
  harness-review-gate-ci-backstop.md:84-93` 항목 10) "lost update" 자체는 실측으로 크기까지
  확인 — 새 결함 아님, 참고용
  - 위치: `.claude/_shared/retry_state.py:59-74`(docstring) · `:174-198`
    (`apply_status_update`, 잠금 없는 read-modify-write) · `:94-133`(`reconcile_state_with_disk`).
  - 상세: 위 재현의 "프로세스 12개" 결과가 정확히 이 잔여 리스크다 — 서로 다른 프로세스가
    각자 옛 상태를 읽고 자기 변경만 반영한 뒤 마지막에 `os.replace` 한 쪽이 이기므로, 12건 중
    6건(50%)이 조용히 유실됐다. CLAUDE.md 가 "독립 도구 호출은 병렬 배치" 를 규약으로 못박고
    있고, 이 저장소 자체가 "14명 리뷰어 동시 실행"·"5개 checker 병렬" 같은 팬아웃을 정상
    운영 패턴으로 삼으므로, 이 정도 동시성은 드문 코너케이스가 아니라 흔한 완료 시점 패턴이다.
    다만 `agents_success` 는 디스크의 리포트 파일에서 매번 재도출돼 자가치유되고(`agents_fatal`
    /`agent_history`/`rate_limit_*` 만 진짜로 영구 유실), `fcntl.flock` 을 모든 훅 경로에 두지
    않기로 한 팀의 결정(모든 훅 경로에 블로킹 프리미티브를 놓지 않기 위함)도 타당하다 — 이미
    백로그 항목으로 등재돼 있으므로 이번 라운드에서 다시 차단 사유로 삼지 않는다. 수치만
    기록으로 남긴다.

- **[INFO]** (동시성 범주 밖, 성능 리뷰와 교차검증) `.claude/tests/test_block_integrity.py`
  의 `VerdictParserStaysLinearTest` 3종 중 tail 케이스는 실제로 vacuous — 성능 리포트의 판정과
  독립적으로 동일 결론에 도달, 단 내 첫 시도는 방법론 오류로 반대 결론을 낼 뻔했다
  - 위치: `.claude/tests/test_block_integrity.py:543-546`
    (`test_a_trailing_run_after_a_real_verdict_returns_fast`) vs
    `.claude/_shared/block_integrity.py:100-102`(`_BLOCK_AT_LINE_END`).
  - 상세: 이 항목은 레이스/락/원자성이 아니라 ReDoS(정규식 재앙적 백트래킹) 성능 이슈라 본래
    성능 리뷰어 영역이지만, 라운드 지시("고쳤다는 항목은 실측으로 확인")에 따라 나도 직접
    검증했고, 결과가 이미 제출된 성능 리포트와 **상충할 뻔했다가 방법론을 바로잡자 일치**했다는
    점을 기록해 둔다. 실제 커밋에서 직접 추출해 측정(`git show 5526fc8f8:...`=7R 이후/8R
    이전, HEAD=8R 이후):
    - middle-gap(`"BLOCK:" + " "*45000`): 7R 이후/8R 이전 **29.17초** → HEAD **0.0017초**.
      확실히 진짜 이차이고 확실히 고쳐졌다 (`test_a_bare_block_followed_by_a_long_run_
      returns_fast` 유효).
    - tail(`"BLOCK: YES" + " "*45000 + "x"`): 7R 이후/8R 이전 **0.0008초** → HEAD
      **0.0006초** — 유의미한 차이 없음. 즉 `test_a_trailing_run_after_a_real_verdict_
      returns_fast` 는 자신이 막는다고 주장하는 회귀를 실제로는 막지 못한다(성능 리포트
      `performance.md` 의 판정과 일치).
    - 내 첫 시도는 이걸 놓쳤다: docstring 의 "`\s*\**\s*` 였다" 는 서술을 그대로 tail 에도
      적용해 `\s*\**\s*$` 로 손수 재구성한 뮤턴트를 만들었더니 5초 근방에서 실제로 이차처럼
      보였다. 그런데 실제 7R 이후 커밋을 열어보니 tail 의 실제 옛 패턴은 `\**\s*$`(앞쪽
      `\s*` 없음)였다 — `\**` 가 입력에 `*` 문자가 하나도 없어 사실상 무동작이라 겹치는
      quantifier 가 하나뿐이 되고, 그러면 이차가 아니라 선형이다. **손으로 재구성한 "과거
      패턴"은 실제 git 이력과 대조해야 한다**는 걸 스스로 재확인한 사례라 남겨둔다.
  - 제안: 성능 리포트가 이미 낸 제안(tail 테스트의 docstring 을 correctness 테스트로 재분류하거나
    실제로 이차가 되는 입력을 다시 찾을 것)에 동의. 이 항목은 내 리포트의 판단으로 추가 조치를
    요구하지 않는다 — 성능 리포트 쪽 처리를 따르면 된다.

- **[INFO]** `guard_review_before_stop.py` 의 신규 note 스로틀 — 기존 마커 파일 TOCTOU 패턴을
  새 용도(다이제스트별 억제)로 재사용, 위험은 무시할 수준
  - 위치: `.claude/hooks/guard_review_before_stop.py:198-246`(`_marker_path`/
    `_already_nudged`/`_mark_nudged`, 기존 헬퍼) · `:366-392`(신규 note 순회 루프, 이번 PR 추가).
  - 상세: `_already_nudged(marker)` 체크 후 `_mark_nudged(marker)` 쓰기 사이에 락이 없어
    check-then-act 경쟁이 가능하지만, (동일 session_id+branch 조합의) Stop 훅이 실제로
    겹쳐 실행되는 경우는 사실상 없고, 겹치더라도 최악의 결과는 같은 advisory 문구가 한 번 더
    stderr 에 찍히는 것뿐이다(하드 게이트는 push 쪽이며 이 로직을 참조하지 않는다). 새 코드는
    기존에 이미 받아들여진 패턴을 그대로 재사용한 것이라 새로운 위험 등급을 부여하지 않는다.

- **[정보/해당없음]** 나머지 점검 관점은 이번 변경분에 해당 사항 없음 — 확인 결과 기록
  - **데드락**: 이 diff 전체에 락 사용이 전무하다(`grep -rn "lock\|Lock"` 결과 `retry_state.py`
    docstring 의 산문 언급 3건뿐, 실제 락 객체 없음). 여러 락을 동시에 잡는 코드가 없으므로
    데드락 가능성 자체가 없음.
  - **async/await**: `.claude/` 전체에 `asyncio`/`async def`/`await` 사용 없음(순수 동기 Python
    CLI/hook 스크립트). 해당 없음.
  - **스레드/커넥션 풀**: `ThreadPoolExecutor`/`multiprocessing`/`concurrent.futures` 사용
    전무(`grep -rln` 0건, 위 재현 검증 시 확인). 해당 없음.
  - **이벤트 루프 블로킹**: Node 이벤트 루프 위에서 도는 코드가 아니라 훅마다 독립 프로세스로
    실행되는 동기 Python 스크립트라 이 항목 자체가 구조적으로 해당 없음. 인접 개념인 ReDoS
    (동기 실행을 오래 묶어두는 것)는 위 세 번째 항목에서 별도로 다룸.
  - **`in_flight_ok` 게이팅**(`review_guard.py:934-976`, "async-review ↔ synchronous-Stop
    race" 로 스스로 명명)는 이번 PR 의 diff 가 아니라 `origin/main` 에 이미 존재하는 코드다
    (`git log origin/main -- .claude/hooks/_lib/review_guard.py` 로 확인). push 훅
    (`guard_review_before_push.py:896-903`, `evaluate(target)` 위치 인자만 사용)은
    `in_flight_ok` 를 넘기지 않고, stop 훅(`guard_review_before_stop.py:350`)만
    `in_flight_ok=True` 를 넘긴다 — 두 호출부가 여전히 올바르게 분리돼 있음을 확인, 회귀 없음.

## 요약

이번 라운드는 애플리케이션 스레드/프로세스 풀이나 async 코드가 아니라 순수 동기 Python
훅·오케스트레이터라 전형적 동시성 표면(데드락·async 오용·이벤트 루프 블로킹)은 대부분 해당
사항이 없다. 실질적으로 유일하게 의미 있는 신규 동시성 코드는 `_shared/retry_state.py` 의
원자적 쓰기(`os.replace`)이며, 이는 현재 실제 호출 패턴(오케스트레이터당 독립 서브프로세스)
기준으로는 의도대로 동작함을 프로세스 기반 재현으로 직접 확인했다. 다만 그 원자성 보장이
"스레드 안 씀" 이라는 강제되지 않은 전제에 기대고 있다는 것을 스레드 기반 재현으로 새로 밝혔고
(현재는 잠복 상태), 이미 문서화·백로그 등재된 "lost update" 잔여 리스크는 12-way 동시 쓰기에서
50% 유실이라는 구체 수치로 확인했다(팀의 무잠금 결정 자체를 재론하지는 않음). 그 밖에
`block_integrity.py` 정규식 성능 회귀 테스트에 대한 교차검증(성능 리포트와 독립적으로 동일
결론 도달)과 Stop 훅의 마커 재사용은 위험이 낮거나 해당 없음으로 판단한다.

## 위험도
LOW
