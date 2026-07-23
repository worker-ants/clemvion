# 동시성(Concurrency) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`, `plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/23/16_55_04/*`(이전 라운드 산출물 — 메타 문서, 동시성 관점 재검토 대상 아님)

이 훅은 스레드가 아니라 **git push 시마다 별도 프로세스로 재기동되는 동기 스크립트**다. 따라서 in-process 스레드 세이프티·async/await·이벤트 루프·리소스 풀링 관점은 해당 없음 — 실질 동시성 표면은 여러 push 시도(예: 같은 세션의 병렬 Bash 호출, 또는 같은 worktree 를 쓰는 복수 세션)가 **동일한 공유 상태 파일**(`.claude/state/push_guard_failopen.json`)에 겹쳐 접근하는 프로세스간 레이스뿐이다.

## 발견사항

- **[WARNING]** streak 카운터의 read-increment-write 가 락 없이 수행되어 lost-update 가능
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` L440-441 (`streak = _read_streak() + 1` → `_write_streak(streak, degraded)`), 읽기/쓰기 구현은 `_read_streak()` L386-393, `_write_streak()` L396-407
  - 상세: 두 push 프로세스가 겹치는 시간대에 둘 다 degraded 상태로 종료하면, 둘 다 같은 streak 값을 읽어 같은 값+1 을 쓰는 고전적 lost-update(TOCTOU) 가 발생한다 — 두 번의 연속 열화가 카운터에는 한 번만 반영될 수 있다. 코드 자체가 이를 docstring(L423-427)에서 "Known residual (accepted)" 로 명시하고, 근거로 "1차 신호인 per-push stderr 배너는 레이스와 무관하게 항상 출력되고, 레이스로 잃을 수 있는 건 누적 카운트뿐이며 최악의 결과는 3회 에스컬레이션이 한 push 지연되는 정도" 라고 서술한다. 이 근거를 코드로 검증한 결과 정확하다 — `print(...)` (L462)는 `try` 블록 안에서 `degraded` 가 비어있지 않으면 무조건 실행되고, 레이스는 오직 `streak` 카운트 값에만 영향을 준다. 즉 **판정(차단/허용)에는 영향이 없고, 관측용 보조 카운터의 정확도에만 영향** — 위험도를 낮게 보는 근거가 실측과 일치한다.
  - 제안: 현 상태(문서화된 의도적 잔여 위험)로 충분. 만약 향후 카운트 정확도가 실제로 중요해지면(예: 알림·자동화가 streak 값을 그대로 소비하는 방향으로 확장될 경우) `fcntl.flock` 또는 `tempfile`+`os.replace` 기반 원자적 read-modify-write 로 승격 검토.

- **[INFO]** `_write_streak()` 가 원자적 쓰기(tempfile+rename)가 아니라 대상 경로에 직접 `open(path, "w")` 로 덮어쓴다
  - 위치: `.claude/hooks/guard_review_before_push.py:396-407`
  - 상세: `"w"` 모드는 파일을 먼저 truncate 하므로, 동시에 다른 프로세스가 같은 파일을 읽는 시점과 겹치면 그 프로세스는 빈 파일 또는 잘린 JSON 을 볼 수 있다(torn read). 다만 `_read_streak()` 이 `except Exception: return 0` 으로 모든 파싱 실패를 흡수해 self-heal 되도록 설계돼 있어(L392-393), 이 torn-read 의 최악 결과는 "streak 가 실제보다 낮게 읽혀 카운트가 한 번 덜 올라가는 것" 으로 위 WARNING 항목과 같은 급의 영향(관측 카운터 정확도)에 그친다. 크래시나 예외 전파는 없다.
  - 제안: 조치 불요. 락을 도입하는 시점에 `tempfile.NamedTemporaryFile` + `os.replace` 로 함께 원자화하는 것을 권장.

- **[INFO]** 문서화된 잔여 레이스(lost-update)를 실제로 겹치는 두 프로세스로 재현하는 회귀 테스트가 없음
  - 위치: `.claude/tests/test_guard_review_before_push_main.py` (`test_consecutive_fail_opens_accumulate_and_escalate` 등은 subprocess 를 순차적으로만 실행 — L292-322 부근)
  - 상세: 현재 테스트 스위트는 순차 호출로 streak 누적·에스컬레이션·리셋·bypass 비계수 등 정상 경로를 잘 검증하지만, 의도적으로 받아들인 동시성 레이스 자체(두 프로세스를 실제로 동시에 fork 해 lost-update 를 재현)는 어떤 테스트도 exercising 하지 않는다. 다만 이는 결함이 아니라 "fcntl 은 과설계" 라는 명시적 정책 결정(RESOLUTION W4)의 자연스러운 결과이며, 동시성 레이스를 결정적으로 재현하는 테스트는 그 자체로 flaky 해지기 쉬워 트레이드오프가 합리적이다.
  - 제안: 조치 불요(우선순위 낮음). 필요하면 `threading`/`multiprocessing` 으로 두 호출을 동시 기동해 "streak 가 2 미만으로 나올 수 있다" 는 완화된 assertion(비결정적 상한선 없는 검증)만 남기는 정도가 현실적.

그 외 관점 점검 결과: 데드락(락 자체가 없어 해당 없음), 동기화 프리미티브(mutex/semaphore 미사용 — 관측 카운터의 목적에 비해 과설계라는 판단이 타당), async/await(코드베이스에 비동기 실행경로 없음), 원자성(위 두 항목 외 복합 연산 없음), 이벤트 루프·리소스 풀링(해당 없음 — 단발성 동기 스크립트)에서는 추가로 지적할 사항이 없다. `_run_gates()`/`_Outcome` 은 단일 프로세스 내에서만 생성·사용되는 로컬 객체라 in-process 공유 상태 문제는 없다.

## 요약

이 변경의 핵심 동시성 표면은 fail-open 관측용 카운터 파일에 대한 락 없는 read-increment-write 이며, 이는 코드 docstring 과 RESOLUTION.md 양쪽에서 이미 의도적 잔여 위험으로 명시적으로 승인·문서화되어 있다. 실제 코드를 검증한 결과 그 근거(레이스가 판정 자체에는 영향을 주지 않고, per-push stderr 배너는 무조건 출력되며, 최악의 결과는 카운트 부정확·에스컬레이션 지연에 그친다)는 정확하다. 비원자적 파일 쓰기(torn write) 역시 `_read_streak()` 의 전면적 예외 흡수로 self-heal 되어 크래시나 오판정으로 이어지지 않는다. 스레드 세이프티·async/await·데드락·리소스 풀링 등 다른 동시성 축은 이 코드의 실행 모델(프로세스당 1회 동기 실행)상 해당하지 않는다. 전반적으로 이번 diff 는 동시성 관점에서 즉시 조치가 필요한 결함이 없고, 유일한 레이스는 저위험·저영향으로 이미 적절히 문서화·수용되었다.

## 위험도
LOW
