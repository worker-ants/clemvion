# 동시성(Concurrency) Review — harness-block-backstop (2026-08-01 01:49:32)

## 발견사항

없음.

## 요약

이번 세션(`review/code/2026/08/01/01_49_32`)에 배정된 changeset(`meta.json`, 44개 파일)은
전부 `review/code/2026/08/01/{00_03_38,00_33_34,01_17_35,01_17_47}/**` 아래의 **이전 리뷰
라운드 산출물**이다 — 각 라운드의 `*.md` 리포트, `_retry_state.json`, `meta.json`, 그리고
`01_17_47` 세션의 `_prompts/*.md` 까지 전부 `new file mode 100644` 로 신규 생성된 마크다운/
JSON 문서다. 스레드·프로세스·락·async 코드가 존재할 수 없는 산문/데이터 파일이므로, 이번
라운드 자체의 changeset 에는 동시성 관점이 적용될 코드가 없다.

다만 이 changeset 산정 방식(직전 세션 이후 증분)이 실제 소스 변경을 누락할 수 있다는 점이
이 브랜치 자신의 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)에 별도로
기록된 기존 결함 클래스이기도 해서, 그 가능성을 배제하기 위해
`git diff --stat origin/main...HEAD -- . ':!review/**'` 로 직접 재확인했다. 그 결과
`.claude/_shared/retry_state.py`·`block_integrity.py`·`_lib/review_guard.py`·
`guard_review_before_{push,stop}.py`·`_lib/failopen_state.py`·orchestrator 3종·신규 테스트
2종 등 16개 하네스 소스 파일이 `origin/main` 대비 실제로 달라져 있음을 확인했다. 이 소스
diff 자체는 이미 앞선 두 라운드(`00_33_34`→LOW, `01_17_35`→LOW)의 concurrency reviewer 가
상세히 다뤘고, 그 사이 5R RESOLUTION(`01_17_35/RESOLUTION.md`)이 CRITICAL 1건 — Stop 훅의
하향-경고 중복억제 마커가 `enumerate` 인덱스로 키잉되어(`notes` 는 세션당 최대 1개라
인덱스가 항상 0) 브랜치의 첫 하향 경고 이후 **다른 세션·다른 checker·다른 문구의 모든 후속
경고가 영구 억제**되던 결함 — 을 처분한 뒤 커밋(`7dd4ad8c7`, `8b3be3ce6`)됐으므로, 그 처분이
실제로 반영됐는지 현재 HEAD 소스를 직접 `Read` 로 재확인했다:

- `.claude/hooks/guard_review_before_stop.py` (마커 생성 루프, `_marker_path(session_id,
  token, f"note{digest}")` 호출부) — 마커 키가 이제
  `hashlib.sha1(note.encode("utf-8")).hexdigest()[:12]` 이다. 인덱스 키잉 CRITICAL 은
  해소됨 — 코드 주석도 "It keyed on `enumerate`'s index until a review measured what that
  actually did" 로 그 이력을 명시한다.
- `.claude/_shared/retry_state.py` (`save_state` 함수 docstring) — 5R RESOLUTION W5 가
  지적한 "버킷들이 디스크에서 재도출된다" 는 과대 서술이 정정되어, 이제 `agents_success`
  만 disk-derived(자기치유) 이고 `agents_fatal`/`agent_history`/`rate_limit_episodes`/
  `last_reset_hint_sec` 는 동시 `--update` 경합 시 유실될 수 있다는 점을 정확히 서술한다.

남는 것은 전부 이미 인지·문서화되고 이 브랜치의 plan 문서(§후속 9, §후속 10)에 별도
후속으로 등재된 **기존** trade-off이며, 이번 라운드가 새로 만들거나 악화시킨 것이 아니다:

- `apply_status_update()` 의 read-modify-write 는 여전히 파일 잠금이 없다 —
  `agents_success` 를 제외한 필드(`agents_fatal` 전이, `agent_history`, rate-limit 힌트)는
  동시 writer 경합 시 유실될 수 있음(plan §후속 10, 의도적 accept — `fcntl.flock` 은 모든
  훅 경로에 블로킹 프리미티브를 두는 비용 때문에 기각됨).
- `block_integrity.downgraded_criticals()` 는 `SUMMARY.md` 와 5개 checker 리포트를 서로
  다른 시점에 개별 `_read()` 하는 non-atomic 다중 읽기라, 세션이 아직 쓰이는 중이면 이론상
  `[CRITICAL]` 을 놓칠 수 있다 — 경고 전용(비차단)이고 레이스 윈도우가 좁아 이미 INFO 로
  처리됨(`01_17_35/concurrency.md`).
- `guard_review_before_stop.py` 의 `_already_nudged`/`_mark_nudged` 는
  `os.path.exists`→`open(..., "w")` 사이 원자성이 없는 TOCTOU 지만, 최악의 결과가 "동일
  경고 중복 출력"에 그치고 Stop 훅이 한 세션에서 순차 실행되어 실질 트리거 빈도가 낮다
  (기존 INFO 판정 유지).
- `merge_coordinator_orchestrator.py` 는 세 orchestrator 중 유일하게
  `reconcile_state_with_disk` self-heal 이 없다 — 코드 주석과 plan §후속 9 양쪽에 "다른
  skill 의 동작 변경이라 별도 PR 로 분리" 라고 명시된 의도적 defer.

이번 diff(review-artifact 전용) 자체에는 신규 스레드/asyncio/멀티프로세싱·신규 락·신규
공유 가변 상태가 전혀 없고, 위 소스 재확인 결과도 이전 라운드가 발견한 CRITICAL 이 올바르게
처분됐음을 확인했을 뿐 새 결함은 없다. 따라서 동시성 관점에서 이번 라운드는 해당 없음이다.

## 위험도

NONE
