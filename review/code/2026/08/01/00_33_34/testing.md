# 테스트(Testing) 리뷰 — harness-block-backstop

## 검증 방법

정적 코드 확인 외에, 핵심 발견 1건은 실제 mutation 실험으로 검증했다: `review_guard.py`의
`evaluate_review()` 마지막 반환문에서 `tuple(notes)` 인자를 제거한 뒤(`cp` 로 원본 백업 후 복원)
`.claude/tests/` 전체(738개)를 재실행했고, **전부 통과**했다. 이는 이 PR 이 도입한 backstop 기능의
가장 중요한 배선 지점이 어떤 테스트로도 지켜지지 않는다는 것을 실측으로 확인한 것이다(상세는
발견사항 1). 그 외 두 신규 테스트 파일(`test_block_integrity.py` 23건, `test_retry_state_shared.py`
4건)은 개별 실행·전체 스위트 실행 모두 clean 하게 통과함을 확인했다.

## 발견사항

- **[WARNING]** `evaluate_review()`의 notes 전파 배선이 실제로는 어떤 테스트도 거치지 않는다 —
  mutation 실험으로 확인(738/738 통과)
  - 위치: `.claude/hooks/_lib/review_guard.py` (`evaluate_review` 함수) — `notes: list[str] = []`
    (964행), `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)` 호출(968행),
    차단 반환 2곳(969-978행, 979-986행, 둘 다 `notes=` 미전달), 최종 허용 반환의
    `tuple(notes),`(998행)
  - 상세: 이번 PR 의 핵심 목적(Critical 하향이 조용히 게이트를 통과하는 것을 막는 backstop)이
    실제로 신호를 내보내는 유일한 경로가 `evaluate_review()` 내부에서 `_newest_resolved_impl_done_mtime`
    이 채운 `notes` 리스트를 최종 `ReviewDecision`까지 실어 나르는 부분인데, 이 경로를 실제
    함수 호출로 검증하는 테스트가 하나도 없다.
    - `.claude/tests/test_review_guard.py`의 `SpecConsistencyGateTest`(369-409행)는
      `_newest_resolved_impl_done_mtime`을 `mock.patch.object(..., return_value=impl_done_mtime)`
      (383-384행)로 완전히 대체한다 — plain `return_value`라 `notes` out-param을 전혀 건드리지
      않고, 4개 테스트 케이스 어디서도 `d.notes`를 단언하지 않는다.
    - `.claude/tests/test_block_integrity.py`의 `GateSurfacesTheContradictionTest`(약 208-264행)는
      `RG._newest_resolved_impl_done_mtime(root, dirty=set(), notes=notes)`를 **직접** 호출해
      헬퍼 자체는 잘 검증하지만 `evaluate_review()`를 완전히 우회한다.
    - 같은 파일의 `NotesReachBothHooksTest`(약 307-375행)는 `evaluate_review` 자체를 손으로 쓴
      stub(`_STUB`, 늘 `blocked=False`이고 `notes`가 하드코딩된 `_D` dataclass)으로 갈아끼워
      훅 쪽 배선(`_evaluate_over_targets`→`outcome.notes`→`_report_notes`)만 검증한다.
    - 실측: `review_guard.py` 988-998행의 `return ReviewDecision(False, ..., tuple(notes))`에서
      `tuple(notes)`를 제거해도(원복 완료) `python3 -m unittest discover -s .claude/tests` 738개
      전부 그대로 통과했다. 이 PR 이 명시적으로 경계하는 바로 그 실패 클래스
      ("Deleting the collection block ... left all 735 tests GREEN" — `test_block_integrity.py`
      `NotesReachBothHooksTest` 자신의 docstring)가 한 단계 위(= `evaluate_review()` 내부)에서
      그대로 재발할 수 있는데 아무 테스트도 못 잡는다.
    - 부수 관찰: Gate 2 의 두 차단 반환(969-978행 `newest_impl_done <= 0.0`,
      979-986행 `newest_impl_done < newest_spec_code`)은 `ReviewDecision(True, ...)`을
      `notes=` 없이 만든다. 그 시점까지 `_newest_resolved_impl_done_mtime`이 이미 하향 모순을
      발견해 `notes`에 담았더라도, 차단 시엔 항상 버려진다 — 허용 경로와 비대칭이며 의도인지
      결함인지 어떤 테스트도 명시하지 않는다.
  - 제안: 실제(non-mock) `evaluate_review()`를 spec-linked 변경 + `review/consistency/**`에 심은
    진짜 하향-모순 `--impl-done` 세션으로 호출해 반환된 `ReviewDecision.notes`가 비어있지 않음을
    단언하는 통합 테스트를 추가한다(`test_review_guard_hardening.py`의 real-git-repo 패턴을
    Gate 2 에도 적용하는 형태가 자연스럽다). 아울러 차단 경로에서 notes 를 버리는 것이 의도인지
    결정하고 그 결정을 테스트로 고정한다.

- **[WARNING]** `retry_state.save_state()`의 신규 atomic-write 보장이 전혀 검증되지 않는다
  - 위치: `.claude/_shared/retry_state.py:50-75` (`save_state`)
  - 상세: 모듈 docstring(8-23행)은 이 추출을 "behavior-preserving"이라 서술하지만, `save_state`
    자체는 새 동작이다. 리팩터 전 `code_review_orchestrator.py`/`consistency_orchestrator.py`의
    원본 `_save_state`는 단순 truncating `open(state_file, "w")`였다(각 파일 diff 로 확인:
    `-    with open(state_file, "w", ...) as f: json.dump(...)`). 새 구현은 `{state_file}.tmp.{pid}`에
    쓴 뒤 `os.replace`, `finally`에서 tmp 정리 — 함수 자신의 docstring이 "동시 reader 가 반쯤
    쓰인 파일을 보는 창을 없앤다"고 그 존재 이유를 설명할 만큼 의미 있는 안전성 속성이다.
    그런데 이를 검증하는 테스트가 없다: `grep -rn "save_state\|os.replace\|\.tmp\." .claude/tests/*.py`
    결과 `test_retry_state_shared.py`를 포함해 아무 파일에서도 `save_state`의 쓰기 메커니즘(tmp
    파일 생성/정리, 쓰기 실패 시 원본 보존, `os.replace` 실제 호출 여부)을 직접 확인하지 않는다.
    `test_retry_state_shared.py`는 CLI 의 stdout/stderr 문자열만 확인하므로, 이 함수가 다시
    plain truncating write 로 조용히 퇴행해도 그 테스트들은 여전히 통과한다.
  - 제안: `json.dump`를 mock 해 쓰기 도중 예외를 강제하고 (a) 원본 `_retry_state.json` 내용이
    보존되는지, (b) `.tmp.*` 파일이 `finally`에서 정리되는지 단언하는 테스트, 그리고 정상 경로에서
    `os.replace`가 실제로 호출되는지 pin 하는 테스트를 추가한다.

- **[WARNING]** `merge_coordinator_orchestrator.py`의 `_shared/retry_state.py` 위임에는 대응
  테스트가 전혀 없다
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:113-122`
    (`_load_state`/`_save_state`/`_apply_status_update`가 `_retry_state_lib`로 위임)
  - 상세: 3개 orchestrator 중 `code_review_orchestrator.py`/`consistency_orchestrator.py`는 이번
    리팩터 후 신규 `test_retry_state_shared.py` + 기존 `test_orchestrator_state.py`/
    `test_consistency_orchestrator_state.py`(둘 다 subprocess 로 실제 CLI 를 구동, `--update`/
    `--summary-state` 커버)로 회귀 안전망을 갖는다. 반면 `merge_coordinator_orchestrator.py`를
    다루는 테스트 파일은 아예 없다 — `.claude/tests/` 전체에서 "merge_coordinator" 문자열이
    나오는 곳은 `test_summary_agent_contract.py`가 `skills/merge-coordinator/SKILL.md` 경로를
    참조하는 1건뿐이고 이 리팩터와 무관하다. 즉 세 번째 소비자가 공유 라이브러리로 갈아탄 이
    diff 자체는 어떤 자동 테스트로도 지켜지지 않는다. (수동으로 `--summary-state`/`--update`를
    직접 실행해 현재는 정상 동작함을 확인했으나, 이는 회귀 안전망이 아니라 1회성 확인일 뿐이다.)
  - 제안: `test_retry_state_shared.py`에 `MERGE = .../merge_coordinator_orchestrator.py`를 추가해
    최소한 `--update`(`_apply_status_update`) CLI 경로를 다른 두 orchestrator 와 나란히 검증하거나,
    전용 `test_merge_coordinator_orchestrator.py`를 신설한다.

- **[INFO]** 동일 사실을 서술하는 두 문서(consistency-summary.md / SKILL.md)의 drift 를 잡는
  테스트가 없다
  - 위치: `.claude/agents/consistency-summary.md` §요약 지침 3, `.claude/skills/consistency-checker/SKILL.md`
    §4 BLOCK 처리 단락
  - 상세: 이번 PR 로 두 문서가 각각 "게이트가 이제 checker 의 `[CRITICAL]`과 모순되면 경고를
    낸다"는 같은 사실을 별도 문장으로 갱신했다. 이 프로젝트는 다른 곳(`test_router_safety_policy_doc.py`,
    `test_summary_agent_contract.py`)에서 "같은 사실을 말하는 여러 문서는 drift 를 테스트로
    고정한다"는 관행을 채택하고 있는데, 이 두 문장에는 적용되지 않았다. 지금은 표현이 다르지만
    내용이 일치하나, 향후 `block_integrity.py`의 조건(예: 경고 대상 확장)이 바뀌어도 두 곳이
    함께 갱신된다는 보장이 없다.
  - 제안: 우선순위는 낮음(짧은 괄호 부연 수준이라 drift 위험 자체가 낮다) — 향후 3번째 문서가
    이 사실을 언급하게 되면 재고할 것.

## 긍정적으로 평가할 부분

`test_block_integrity.py`는 이 리뷰에서 가장 견고한 테스트 파일이다. 실제 732개 consistency
세션을 측정해 얻은 수치(698/24/10)를 docstring 에 남기고, `VerdictIsAnchoredTest`의 6개 케이스는
실제 프로덕션 세션(`review/consistency/2026/07/05/19_27_28` 등 4건)의 텍스트를 그대로 재현해 만든
것이며, `CountCriticalTagsTest.test_ignores_prose_and_the_risk_scale`은 "경고가 오탐이면 아무도 안
읽는다"는 설계 근거 자체를 테스트로 박아 넣었다. 무엇보다 `NotesReachBothHooksTest`는 "훅 배선
삭제가 735개 테스트를 그대로 GREEN 으로 남긴다"는, 이 프로젝트가 반복적으로 겪은 실패 클래스를
정확히 겨냥해 실제 서브프로세스로 push/stop 훅을 구동하는 end-to-end 회귀 테스트다 — 다만 위
발견사항 1 이 지적하듯, 그 회귀 테스트가 막는 지점(훅 레벨 수집)과 실제로 뚫려 있는 지점
(`evaluate_review()` 내부 배선)이 다르다. `retry_state.py` 추출 자체도 AST 비교로 "정말 동일한
코드만 추출했는지"를 측정 후 진행했다는 점에서 방법론적으로 신뢰할 만하다.

## 요약

이번 변경은 "Critical 하향이 조용히 게이트를 통과"하는 실제 결함 클래스를 기계적 backstop
(`block_integrity.py`)으로 막고, 3개 orchestrator 의 중복 state-bookkeeping 을 `_shared/retry_state.py`
로 통합한 것이다. `block_integrity.py` 자체의 핵심 로직(태그 카운팅, 판정 앵커링, 하향 탐지)은
실제 프로덕션 사례를 재현한 테스트로 두텁게 커버되어 있고, 훅 레벨 스트림 라우팅(`_report_notes`)과
훅 배선(`NotesReachBothHooksTest`)도 실제 서브프로세스로 검증된다. 그러나 mutation 실험으로 실측한
바, 그 backstop 신호가 실제 `evaluate_review()`를 통해 만들어지는 배선 — 즉 기능 전체의 "마지막
한 뼘" — 은 어떤 테스트도 거치지 않는다(관련 기존 테스트가 헬퍼 함수를 통째로 mock 하기 때문).
같은 리팩터의 부산물인 `retry_state.save_state()`의 신규 atomic-write 안전성과, 세 번째 소비자
`merge_coordinator_orchestrator.py`의 회귀 안전망도 비어 있다. 셋 다 "현재 동작이 틀렸다"는
증거는 아니고(직접 확인 결과 현재 코드는 올바르게 동작한다) 순수하게 회귀 안전망의 공백이며,
전부 harness/CI 도구 코드에 한정되어 제품 코드에는 영향이 없다.

## 위험도

MEDIUM
