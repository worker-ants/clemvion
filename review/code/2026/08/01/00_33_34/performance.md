# 성능(Performance) Review

## 검토 방법

`git diff origin/main...HEAD` (15개 파일) 전수 확인. 프롬프트에서 크기 제한으로 잘린 4개 파일
(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`)은 `Read`/`grep -n`으로 직접 열어 실제 소스 줄 번호를 확인했다.
또한 이 브랜치는 1R/2R/3R 세 차례 리뷰-수정 이력을 git log 로 확인할 수 있었고, 직전 라운드들
(`review/code/2026/07/31/18_16_48`, `19_03_11`)이 이번 diff의 핵심 성능 이슈(아래 발견사항 1)를
이미 발견→수정→검증까지 마친 상태였다. 그 결론을 그대로 옮기지 않고, 현재 HEAD 코드를 직접
읽고 이 저장소에서 실제 함수를 호출해 실측치를 다시 뽑아 독립적으로 재확인했다.

## 발견사항

- **[INFO]** 신규 backstop(`block_integrity`) 통합은 전체 이력 재스캔을 피하도록 이미 O(1)로 유계 설계됨 — 조치 불요
  - 위치: `.claude/hooks/_lib/review_guard.py:718-760` (`_newest_resolved_impl_done_mtime`, 특히 `745-759`의 `best_dir`/`notes` 처리), `.claude/_shared/block_integrity.py:110-143` (`downgraded_criticals`/`contradiction_note`)
  - 상세: `evaluate_review()`(`review_guard.py:964-968`)는 spec-linked 변경이 있을 때만 이 함수를 호출한다. 함수 본문은 `_iter_consistency_summaries`로 `review/consistency/**` 전체를 `os.walk`한 뒤 세션마다 `meta.json`(`_is_impl_done_session`)과 `SUMMARY.md`(`_summary_block_is_no`)를 열어 "impl-done && BLOCK:NO 인 가장 최근 세션"을 찾는다 — 이 루프 자체는 세션 수에 비례(O(N), 아래 발견사항 2 참고). 이번 diff가 새로 추가한 `contradiction_note()` 호출(`:756-759`)은 그 루프 **밖에서, 루프가 채택한 단 하나의 세션에 대해서만** 실행되도록 설계돼 있어, 이 backstop 자체가 얹는 추가 비용은 세션 수와 무관한 O(1)이다. 주석(`:745-749`)이 "전 이력을 재검사했다면 +0.39초(732 세션 기준) 늘어난다"는 실측치를 남기고 있고, `test_only_the_session_the_gate_adopts_is_checked`(`.claude/tests/test_block_integrity.py:247-264`)가 이 성질을 회귀 테스트로 고정해 뒀다. 알고리즘 복잡도 관점에서 정확한 설계이며, 이 판단은 직전 라운드(`19_03_11`)의 결론과도 일치한다.
  - 제안: 없음(현행 유지).

- **[INFO]** 위 backstop 이 얹히는 기반 — `review/code`·`review/consistency` 전체 이력을 매 게이트 호출마다 캐시 없이 재스캔 — 은 이번 diff 가 도입/악화한 것은 아니지만, 이번 diff 가 직접 확장한 함수이자 매 `git push`·매 턴 종료(Stop hook)마다 동기 실행되는 hot path 라 성장 추세를 실측해 기록한다
  - 위치: `.claude/hooks/_lib/review_guard.py:389-397`(`_iter_summaries`), `:678-686`(`_iter_consistency_summaries`), `:524-554`(`_newest_resolved_review_mtime` — 세션마다 `_retry_state.json`+`SUMMARY.md` 를 열어 forced-coverage·위험도까지 파싱), `:718-760`(`_newest_resolved_impl_done_mtime`)
  - 상세: 코드 수정 없이 이 worktree에서 실제 함수를 직접 호출해 측정했다(현재 이 worktree에 물리적으로 존재하는 세션: `review/consistency/**` 732개, `review/code/**` 769개).
    ```
    _iter_consistency_summaries          : 732개, 0.0225s
    _newest_resolved_impl_done_mtime      : 0.0804s (best_dir 탐색 + O(1) backstop 포함)
    _iter_summaries (code review)        : 769개, 0.0203s
    _newest_resolved_review_mtime        : 0.1351s
    evaluate_review() 전체 (3회 반복)     : 0.1069s → 0.0968s → 0.0950s 로 수렴
    ```
    절대값은 여전히 작고 hang·timeout 은 관측되지 않았지만, `review/**` 세션 디렉터리는 CLAUDE.md 관례상 영속(prune 없음)이라 이 비용은 프로젝트 수명 동안 단조 증가하며, 이 훅은 사람이 트리거하는 게 아니라 **매 대화 턴 종료마다** 자동 실행되는 지점이다(`guard_review_before_stop.py`). 부수적으로, push 커맨드가 다른 worktree 브랜치를 명시적으로 언급하면 `_push_targets()`(`.claude/hooks/guard_review_before_push.py:646-667`)가 반환하는 target 수만큼 `evaluate_review()`가 반복 호출돼(통상 1개, 드물게 2개 이상) 위 비용이 target 수만큼 곱해진다.
  - 제안: 지금 당장 조치는 불필요 — 오히려 이번 PR은 이 기반 위에 새 비용을 얹지 않도록 잘 설계됐다(발견사항 1). 세션 수가 한 자릿수 더 늘거나(수만 개 규모) `ALL_CHECKERS` 로스터가 커지는 시점에는, 세션별 판정(리졸브 여부/모순 여부)을 확정 시점에 1회만 계산해 두는 사이드카 인덱스, 또는 최소한 디렉터리명(타임스탬프)으로 내림차순 정렬 후 첫 적격 세션에서 조기 종료하는 방식으로 O(N)→O(1)에 가깝게 전환하는 것을 고려할 것.

- **[INFO]** `contradiction_note` 경로가 채택된 세션 1건에 한해 이미 읽은 `SUMMARY.md` 를 다시 읽음 — 유계이므로 실질 영향 없음
  - 위치: `.claude/hooks/_lib/review_guard.py:715`(`_summary_block_is_no`에서 최초 read+파싱), `.claude/_shared/block_integrity.py:117`(`downgraded_criticals`에서 동일 파일 재-read+재파싱)
  - 상세: `evaluate_review()` 1회 호출당 정확히 1개 세션(게이트가 채택하는 세션)에 한해 `SUMMARY.md`가 두 번 열리고 `BLOCK:` 판정이 두 번 파싱된다 — N+1이 아니라 "1+1". 파일 크기가 작아(수 KB) 측정 가능한 지연은 없다.
  - 제안: 선택 사항 — `_newest_resolved_impl_done_mtime`이 이미 읽은 텍스트를 `contradiction_note(session_dir, summary_text=text)` 형태로 전달할 수 있게 하면 이 중복도 제거되지만 우선순위는 낮음.

- **[INFO]** `_evaluate_over_targets`의 advisory 중복 제거가 형태상 O(targets × notes) — 실사용 범위에서 둘 다 한 자릿수라 무영향
  - 위치: `.claude/hooks/guard_review_before_push.py:847-859`
  - 상세: `for note in getattr(result, "notes", ()) or (): if note not in notes: notes.append(note)`는 리스트 멤버십 검사를 반복하지만, `targets`(같은 push 가 걸치는 worktree 수)와 advisory 종류(현재 1종 — downgrade contradiction) 모두 실운영 범위가 작아 유의미한 비용이 아니다.
  - 제안: 없음(advisory 종류가 여러 개로 늘어나면 `dict.fromkeys` 기반 순서보존 set 검토 — 지금 당장은 불필요).

## 참고: 이번 diff의 나머지 구조는 성능에 중립적

`.claude/_shared/retry_state.py` 신설 + 세 orchestrator(`code_review_orchestrator.py`,
`consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`)의 위임 전환은 AST 비교(문서화됨,
docstring 제외 비교)로 4/5 함수가 byte-identical 임을 확인한 뒤 옮긴 순수 추출이며, `git diff`로
직접 대조한 결과도 알고리즘·I/O 패턴 변경이 없다. `save_state()`는 이번에 임시파일(`f"{state_file}.tmp.{os.getpid()}"`)
+ `os.replace` 원자적 쓰기로 바뀌어 있는데, 추가 비용은 rename 시스템콜 1회뿐이고 torn-write를
구조적으로 막아주므로 성능/신뢰성 트레이드오프가 아니라 순수 이득이다. `emit_summary_state`의
`extra_fields` 콜백 설계도 `reconcile_state_with_disk`가 정확히 1회만 호출되도록 보장해, "호출자가
먼저 reconcile하고 공유 함수가 또 reconcile" 하는 이중 계산을 구조적으로 피한다. 신규 정규식
(`_CRITICAL_TAG`, `_BLOCK_AT_LINE_START`, `_BLOCK_AT_LINE_END`)은 중첩 quantifier가 없는 단순 anchored
패턴으로 ReDoS 위험이 없고 모듈 임포트 시 1회만 컴파일된다. 새 테스트 2종을 직접 실행해 확인한 결과도
`test_block_integrity.py` 23 tests / 0.168s, `test_retry_state_shared.py`(subprocess 기반) 4 tests / 0.255s로
빠르고 안정적이다.

## 요약

이번 변경의 실질 성능 표면은 (1) `_shared/retry_state.py`로의 상태 bookkeeping 추출(AST 검증된 순수
리팩터, 알고리즘 변화 없음)과 (2) `block_integrity` Critical-하향 backstop 신설 + `review_guard.py` 통합
두 가지다. (2)는 자칫 전체 리뷰 이력(현재 732/769개 세션)을 순회하며 세션마다 최대 5개 체커 리포트를
추가로 여는 O(N) 증폭이 될 뻔했지만, 코드 주석과 전용 회귀 테스트가 보여주듯 이미 "게이트가 실제
채택하는 세션 1개"로만 유계화돼 있어 세션이 아무리 쌓여도 이 backstop 자체의 원가는 O(1)로 고정된다.
이 저장소에서 직접 재현 측정한 결과 `evaluate_review()` 전체는 약 95~110ms 수준으로 수렴했고 hang·timeout
은 없었다. 유일하게 계속 주시할 가치가 있는 구조적 지점은 이 backstop이 얹히는 기반 자체 —
`review/code/consistency/**` 전체를 캐시 없이 매번 `os.walk`하는 기존 패턴(이번 diff가 만들거나 악화시킨
것은 아님) — 인데, 세션 디렉터리가 영구 보존되는 프로젝트 관례상 이 비용은 push·턴종료마다 단조
증가한다. 지금은 부담이 크지 않지만 세션 수가 한 자릿수 더 늘어나면 세션별 판정을 1회만 계산해두는
인덱스/캐시가 필요해질 것이다. CRITICAL/WARNING 급 신규 회귀는 발견되지 않았다.

## 위험도

NONE
