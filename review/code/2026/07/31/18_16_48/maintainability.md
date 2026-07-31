# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `BLOCK: YES/NO` 판정 로직이 새 공유 모듈과 기존 hook 에 이중 구현됨 (같은 diff 안에서)
  - 위치: `.claude/_shared/block_integrity.py:42`(`_BLOCK_LINE` 정규식), `:66-69`(`summary_block_verdict`) / `.claude/hooks/_lib/review_guard.py:141`(동일한 `_BLOCK_LINE` 정규식), `:693-704`(`_summary_block_is_no`)
  - 상세: `_shared/block_integrity.py` 가 `_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)` 를 새로 선언하고 `summary_block_verdict()` 로 감쌌는데, `review_guard.py` 는 바이트 단위로 동일한 정규식을 이미 `_BLOCK_LINE`(141행)으로 갖고 있고 `_summary_block_is_no()`(693-704행)에서 같은 판정을 한 번 더 수행한다. 더구나 이번 diff 자체가 `review_guard.py` 에 `from _shared import block_integrity as _block_integrity`(131행)를 새로 추가했으므로, 재사용을 막는 계층 제약은 없다 — 그냥 두 곳에 같은 규칙이 남아 있을 뿐이다. 이 저장소는 바로 이 PR 의 `retry_state.py` 추출("Change both" 주석으로 5개 함수를 두 orchestrator 가 각자 들고 있다가 실제로 갈라졌던 사례)로 정확히 이 패턴을 없애는 작업을 하고 있는데, 같은 diff 안에서 동일한 패턴(‘BLOCK: 파싱 규칙’)을 하나 더 만든 셈이다. 향후 `BLOCK:` 판정 규칙이 바뀌면(예: 새 토큰 추가) 한쪽만 고치고 다른 쪽을 놓칠 위험이 있고, 이를 묶어주는 테스트도 없다.
  - 제안: `review_guard._summary_block_is_no()` 를 `return _block_integrity.summary_block_verdict(text) == "NO"` 형태로 바꾸고 `review_guard.py` 자체의 `_BLOCK_LINE` 상수를 제거해 정본을 하나로 합친다.

- **[WARNING]** checker 목록이 `ALL_CHECKERS` 와 `CHECKER_REPORTS` 두 곳에 나뉘어 있고 동기화를 강제하는 장치가 없음
  - 위치: `.claude/_shared/block_integrity.py:44-50`(`CHECKER_REPORTS` 튜플) vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:50-56`(`ALL_CHECKERS` 리스트)
  - 상세: 두 리스트는 지금은 내용이 같지만(`cross_spec`, `rationale_continuity`, `convention_compliance`, `plan_coherence`, `naming_collision`, 접미사 `.md` 유무만 다름) 서로 import 관계도, 이를 묶는 테스트도 없다. checker 가 추가/이름 변경되면 `ALL_CHECKERS` 만 갱신하고 `CHECKER_REPORTS` 를 잊기 쉬운데, 그 경우 `downgraded_criticals()` 가 새 checker 의 `[CRITICAL]` 하향을 조용히 놓치게 되어 이번 PR 이 막으려는 바로 그 실패 모드(하향이 감지되지 않음)를 재생산한다. 이 저장소는 `test_agent_consistency.py`, `test_router_safety_policy_doc.py` 등에서 "N 곳에 흩어진 동일 목록" 드리프트를 여러 번 실측·수정한 전례가 있다.
  - 제안: `CHECKER_REPORTS` 를 `ALL_CHECKERS` 에서 파생시키거나(예: `_shared` 쪽으로 checker 목록의 SoT 를 옮기고 orchestrator 가 그것을 import), 최소한 두 목록이 일치하는지 검사하는 유닛 테스트 한 줄을 추가한다.

- **[INFO]** `_shared` import 별칭 컨벤션 불일치
  - 위치: `.claude/hooks/_lib/review_guard.py:130-131`
  - 상세: 저장소 전체에서 `_shared` 모듈 import 는 예외 없이 `as _<module>_lib` 형태를 쓴다(`_report_paths_lib`, 그리고 이번 diff 가 추가한 `_retry_state_lib` 도 code_review_orchestrator.py/consistency_orchestrator.py 양쪽에서 동일). 그런데 바로 옆 줄에서 새로 추가된 `from _shared import block_integrity as _block_integrity` 만 그 컨벤션을 따르지 않는다(단순히 앞에 `_` 만 붙임).
  - 제안: `as _block_integrity_lib` 로 통일.

- **[INFO]** 같은 PR 에서 신설된 두 `_shared` 모듈 간 타입 힌트 스타일이 불일치
  - 위치: `.claude/_shared/retry_state.py:41,50,55,96,138` (모든 함수 시그니처에 타입 힌트 없음) vs `.claude/_shared/block_integrity.py:53,58,66,72,90` (모든 함수가 완전히 타입 힌트됨)
  - 상세: 두 파일 모두 이번 변경으로 "harness 전역이 공유하는 `_shared/` 정본"이라는 같은 역할로 신설됐지만, `retry_state.py` 는 (docstring 이 밝히듯 4개 함수를 "verbatim" 이동한 결과) 타입 힌트가 전혀 없고 `block_integrity.py` 는 전부 있다. verbatim 보존이라는 선택은 합리적이지만, 두 신설 모듈의 스타일 차이가 남아 향후 `retry_state.py` 를 touch 하는 사람이 어느 컨벤션을 따라야 할지 애매해진다.
  - 제안: 당장 바꿀 필요는 없으나, `retry_state.py` 를 다음에 수정할 기회에 `block_integrity.py` 수준의 타입 힌트를 맞추는 것을 권장.

- **[INFO]** `emit_summary_state` 의 `extra_fields` 해석 한 줄이 다소 밀도가 높음
  - 위치: `.claude/_shared/retry_state.py:130-131`
  - 상세: `for key, value in ((extra_fields(state) if callable(extra_fields) else extra_fields) or {}).items():` 한 줄에 삼항 조건 + fallback + 순회가 모두 압축되어 있다. 바로 위 주석이 "왜 callable 인가"는 잘 설명하지만, 코드 자체의 가독성은 살짝 희생됐다.
  - 제안: `resolved = extra_fields(state) if callable(extra_fields) else extra_fields` 로 이름 붙인 중간 변수를 뽑고 `for key, value in (resolved or {}).items():` 로 나누면 동작 변경 없이 읽기 쉬워진다.

- **[INFO]** `_newest_resolved_impl_done_mtime` 의 docstring 이 새로 추가된 부수효과(stderr 경고 출력)를 언급하지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:707-712`(docstring) vs `:722-733`(신규 side effect)
  - 상세: 함수 docstring 은 여전히 "가장 최근 resolved 리뷰의 authoritative time 을 반환" 이라는 순수 조회 함수처럼 서술돼 있지만, 이번 diff 로 루프 안에서 `_block_integrity.contradiction_note()` 결과를 stderr 로 출력하는 부수효과가 생겼다. 호출부 인라인 주석은 "왜" 를 잘 설명하지만, 함수를 처음 읽는 사람이 보는 docstring 에는 이 사실이 없다. 호출 지점이 하나뿐이라 실질 위험은 낮다.
  - 제안: docstring 에 "SUMMARY 가 checker 의 [CRITICAL] 을 하향한 세션을 만나면 stderr 에 경고를 남긴다" 한 줄을 추가.

## 요약

이번 변경은 두 축으로 구성된다 — (1) `code_review_orchestrator.py`/`consistency_orchestrator.py` 가 "Change both" 주석으로 유지하던 5개 상태-북키핑 함수를 `_shared/retry_state.py` 로 추출(AST 비교로 4/5 가 동일함을 실측한 뒤 진행)한 리팩터, (2) `SUMMARY.md` 의 `BLOCK: NO` 가 checker 의 `[CRITICAL]` 태그를 조용히 하향하는 사례를 잡아내는 신규 `_shared/block_integrity.py` + `review_guard.py` 연동 12줄. 두 축 모두 함수가 짧고 단일 책임이며 중첩이 얕고, 각 설계 결정(왜 verbatim 이동인지, 왜 callable 파라미터인지, 왜 하향은 차단이 아니라 경고인지)이 코드 옆 주석과 docstring 에 실측 수치와 함께 꼼꼼히 남아 있어 전반적 가독성·의도 전달은 우수하다. 다만 이번 PR 이 스스로 "동일 규칙의 두 사본"이라는 문제를 하나 없애면서(`retry_state.py`), 같은 diff 안에서 그 문제의 축소판(`BLOCK:` 파싱 정규식 이중 선언, checker 목록의 세 번째 사본)을 하나 더 만들었다는 점이 이 리뷰의 핵심 지적이다. 두 건 모두 기능적으로는 지금 당장 문제를 일으키지 않고 수정 비용도 작지만, 이 저장소가 반복적으로 겪어온 "동기화되지 않은 N-곳 목록/규칙" 실패 유형과 정확히 같은 모양이라 WARNING 으로 표시한다. 나머지는 네이밍 컨벤션·타입 힌트 스타일·docstring 완결성 수준의 사소한 지적이다.

## 위험도
LOW
