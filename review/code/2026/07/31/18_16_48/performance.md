# Performance Review

## 발견사항

- **[WARNING]** `block_integrity` 통합이 SUMMARY.md 중복 읽기 + 세션당 최대 5개 추가 파일 I/O 를 유발 — 이미 전체 이력을 순회하는 blocking 게이트(hot path) 위에 얹힘
  - 위치: `.claude/hooks/_lib/review_guard.py:720` (`_summary_block_is_no(summary)` 호출 — 이 시점에 이미 SUMMARY.md 전체를 읽어 `BLOCK: NO` 를 확정함), `:728` (`note = _block_integrity.contradiction_note(session_dir)`); `.claude/_shared/block_integrity.py:79` (`downgraded_criticals`가 SUMMARY.md 를 **재차** 여는 지점), `:83-84` (`CHECKER_REPORTS` 5개 파일을 새로 여는 루프)
  - 상세: `_newest_resolved_impl_done_mtime`(review_guard.py:707) 루프는 `_iter_consistency_summaries`로 `review/consistency/**` 전체를 `os.walk`(측정치: 732 세션, 이 값 자체가 docstring 에 적혀 있음)한 뒤, 세션마다 `_is_impl_done_session`(meta.json 오픈)·`_summary_block_is_no`(SUMMARY.md 오픈)로 필터링한다. 지금까지는 세션당 파일 오픈이 2회였다. 이번 diff 가 그다음에 추가한 `contradiction_note(session_dir)` → `downgraded_criticals(session_dir)`(block_integrity.py:72)는 **인자로 세션 경로만** 받고 이미 읽은 텍스트를 재사용할 방법이 없어, 79번 줄에서 SUMMARY.md 를 통째로 다시 열고, 83-84번 줄에서 `cross_spec.md`/`rationale_continuity.md`/`convention_compliance.md`/`plan_coherence.md`/`naming_collision.md` 5개를 전부 새로 연다. 즉 "impl-done && BLOCK:NO" 조건을 만족하는 세션 하나당 파일 I/O 가 2회 → 최대 8회로 4배 늘어난다(N+1 성격: 세션 루프 안에서 세션마다 고정 5개 파일을 순회).
    이 게이트는 spec-linked 코드가 바뀔 때마다 **매 `git push`(hard block, `guard_review_before_push.py`)와 매 Stop 이벤트(`guard_review_before_stop.py`)**에서 동기적으로 실행되고, `review/consistency/**` 세션 디렉터리는 CLAUDE.md 관례상 커밋되어 영구 보존되며(prune 없음) BLOCK:NO(정상 통과) 세션이 다수를 차지할 것이므로 이 subset 은 프로젝트 수명 동안 단조 증가한다. 세션 하나당 원가는 마이크로초~저밀리초 단위로 작지만, 캐시 없이 매 훅 호출마다 전체를 재계산하는 구조 위에 얹힌 4배 증폭이라 이력이 쌓일수록 push 지연으로 누적 체감될 소지가 있다.
  - 제안: `downgraded_criticals`/`contradiction_note`에 이미 읽은 SUMMARY 텍스트를 선택적으로 전달할 수 있게 해(예: `contradiction_note(session_dir, summary_text=text)`) review_guard.py 쪽의 중복 읽기부터 제거한다. 근본적으로는 세션이 immutable(SUMMARY/RESOLUTION 확정 후 내용 불변)하다는 성질을 활용해 판정 결과(모순 여부)를 세션당 1회만 계산해 두는 캐시/인덱스를 검토할 가치가 있다.

- **[INFO]** 위 증폭이 얹히는 기반 자체가 캐시 없는 전수 스캔 구조
  - 위치: `.claude/hooks/_lib/review_guard.py:383-391`(`_iter_summaries`), `:672-680`(`_iter_consistency_summaries`)
  - 상세: 두 함수 모두 `review/code/**`·`review/consistency/**` 전체를 매 훅 호출마다 `os.walk`하며, 훅 호출(=매번 새 프로세스) 간 캐시가 전혀 없다. 이는 이번 diff 가 만든 결함이 아니라 기존 구조이지만, 위 WARNING 이 그 위에 원가를 얹는 이유이기도 하다.
  - 제안: 이번 PR 스코프는 아니지만, 이력이 계속 커진다면 세션별 판정(리졸브 여부·모순 여부)을 결과가 확정된 시점에 1회 기록해두는 사이드카 인덱스가 장기적으로 필요할 수 있다.

## 요약

이번 변경의 실질적 신규 로직은 `_shared/block_integrity.py`(BLOCK:NO 하향 감지)와 `review_guard.py`에 추가된 13줄의 통합 지점뿐이며, `_shared/retry_state.py` 및 두 orchestrator 의 상태 관리 함수 위임은 AST 비교로 검증된 순수 중복 제거(동작 변경 없음)라 성능 영향이 없다. 알고리즘 복잡도·메모리·캐싱 측면에서 새 코드 자체(`count_critical_tags`, 정규식 컴파일, 5개 고정 파일 순회)는 가볍고 안전하지만, 통합 지점이 이미 `SUMMARY.md`를 읽어 `BLOCK: NO`를 확정한 직후 같은 파일을 다시 열고 체커 리포트 5개를 추가로 여는 중복 I/O 를 세션마다 발생시키며, 이 루프 자체가 `review/consistency/**` 전체 이력을 캐시 없이 순회하는 blocking git-push/Stop 게이트 위에 있다는 점이 유일한 실질적 우려다. 절대적 비용은 세션당 저밀리초 수준으로 즉각적 장애나 타임아웃을 유발하지는 않지만, 세션 이력이 영구 보존·단조 증가하는 프로젝트 관례상 시간이 지날수록 누적 지연으로 체감될 수 있어 조기에 손보는 편이 저렴하다.

## 위험도

LOW
