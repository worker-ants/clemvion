# Dependency Review — harness `_shared/` 추출 (block_integrity + retry_state)

## 발견사항

- **[WARNING]** `_shared/retry_state.py` 추출이 세 번째 orchestrator 를 놓쳤다 — 동일 패턴이 그대로 재복제됨
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:82-140` (`_load_state`, `_save_state`, `_emit_summary_state`, `_apply_status_update`) — 이 커밋의 diff 대상 파일은 아니지만, 이번 변경이 스스로 내세우는 근거("두 orchestrator 가 각자 사본을 들고 있었다")가 실제로는 **세 orchestrator** 중 둘에만 적용되어 있다는 점에서 이번 diff 의 완결성을 직접 평가하는 데 필요해 `Read` 로 직접 확인.
  - 상세: `.claude/_shared/retry_state.py`(신규)의 docstring 은 "`code_review_orchestrator` 와 `consistency_orchestrator` 각자 5개 함수를 사본으로 들고 'Mirrors X. Change both.' 주석으로 동기화했다"고 밝히고 이를 제거하는 것이 이번 커밋의 목적이라고 명시한다. 그런데 `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` 에도 `_load_state`/`_save_state`/`_apply_status_update` 가 **로직이 완전히 동일한(네이밍 컨벤션—언더스코어 유무—만 다름)** 세 번째 사본으로 존재하며, 이번 추출 대상에서 빠졌다. 실제로 그 파일은 "Mirror code_review_orchestrator" 라는 자기 주석까지 갖고 있어(라인 77) 스스로 사본임을 인정하고 있다. `_shared.report_paths`(이전 추출)도 이 파일은 import 하지 않는다 — 즉 이 orchestrator 는 두 차례의 `_shared/` 통합에서 연달아 누락됐다.
    추가로, merge-coordinator 의 `_emit_summary_state`(96-108행) 는 `_reconcile_state_with_disk` 호출이 아예 없다 — `_load_state` 로 읽은 스냅샷을 그대로 출력한다. 이는 이번 PR 의 `retry_state.py` docstring 이 "고쳤다"고 말하는 바로 그 문제("a self-reported status with no file behind it… the sibling SUMMARY.md reported real successes — two committed artifacts contradicting each other")가 merge-coordinator 세션에는 여전히 살아있다는 뜻이다.
  - 제안: `_shared/retry_state.py` 로의 마이그레이션을 `merge_coordinator_orchestrator.py` 에도 적용한다. `_emit_summary_state` 의 결측 필드(`branches`/`base`)는 이미 code-review 쪽 `skipped`/`routing` 을 위해 구현된 `extra_fields` 콜백 파라미터로 그대로 수용 가능해 보인다. 의도적으로 제외한 것이라면 그 사유를 `_shared/retry_state.py` 또는 `merge_coordinator_orchestrator.py` 양쪽에 남겨 다음 리뷰가 같은 질문을 반복하지 않게 한다.

- **[INFO]** `block_integrity.py` 가 harness 전체에서 처음으로 Python 3.9+ 전용 stdlib API 를 사용 — 최소 버전 요건 암묵적 인상
  - 위치: `.claude/_shared/block_integrity.py:95` (`contradiction_note` 함수, `k.removesuffix('.md')`)
  - 상세: `str.removesuffix()`는 Python 3.9(PEP 616)에서 추가됐다. `.claude/tests/README.md`(`# Run` 절)는 "hooks 는 bare `python3` 위에서 돌아야 한다"·"zero third-party dependencies" 라고만 규정할 뿐 최소 Python 버전은 명시하지 않는다. `.claude/` 트리 전체에서 `removesuffix`/`removeprefix` 사용은 이번이 유일하다(`grep -rn "removesuffix|removeprefix" .claude --include="*.py"` 로 확인) — 즉 이 한 줄이 조용히 최소 버전을 3.9 로 끌어올린다. 실질 위험은 낮다: 호출 경로(`review_guard._newest_resolved_impl_done_mtime` → `guard_review_before_push.main()`)가 최상위 `except Exception`(fail-open) 으로 감싸여 있어, 구버전 Python 에서 실행돼도 하드 크래시가 아니라 "DETECTION degraded → 통과" 로 조용히 흡수된다 — 다만 이는 크래시 대신 게이트가 매번 조용히 무력화된다는 뜻이라 발견은 더 어려워진다.
  - 제안: 저장소 어딘가(PROJECT.md 또는 `.claude/tests/README.md`)에 최소 Python 버전을 명문화하거나, `k.removesuffix('.md')` 를 `k[:-3] if k.endswith('.md') else k` 처럼 버전 무관 표현으로 대체한다.

## 점검 관점별 요약

1. **새 의존성**: 없음. 신규/변경 파일(`block_integrity.py`, `retry_state.py`, 관련 테스트 2건, `review_guard.py`/두 orchestrator 의 import 라인) 전부 표준 라이브러리(`os`, `re`, `json`, `sys`, `datetime`, `unittest`, `tempfile`, `shutil`, `subprocess`)와 내부 모듈만 사용.
2. **버전 고정**: 해당 없음(외부 패키지 미도입). Python 자체의 암묵적 최소 버전 이슈는 위 INFO 항목 참고.
3. **라이선스**: 해당 없음(외부 의존성 없음).
4. **취약점**: 해당 없음(외부 의존성 없음). `.claude/tests/README.md` 가 명시한 "zero third-party dependencies" 관례는 이번 변경으로도 유지됨을 확인.
5. **불필요한 의존성**: `merge_coordinator_orchestrator.py` 의 `_load_state`/`_save_state`/`_apply_status_update` 자체 구현은 이제 `_shared.retry_state` 로 완전히 대체 가능함(위 WARNING).
6. **의존성 크기**: 영향 없음. harness 전용 Python 파일 변경으로 번들러/빌드 파이프라인 밖(패키지 매니페스트 변경 없음).
7. **호환성**: `_shared/retry_state.py` 의 상대 import(`from . import report_paths`)와 `_shared/block_integrity.py`(상대 import 없음) 사이에 순환 의존은 없음(`report_paths.py` 는 `os` 외 아무것도 import 하지 않음, 직접 확인). 다만 `retry_state.py` 는 상대 import 때문에 `_harness.load_module_by_path` 로 단독 로드할 수 없다(패키지 컨텍스트 없이 `from .`가 실패) — 현재는 어떤 테스트도 그렇게 로드하지 않아(`test_retry_state_shared.py` 는 subprocess 로 두 orchestrator CLI 를 구동) 실제 결함은 아니지만, `block_integrity.py`(상대 import 없어 직접 로드 가능)와 다른 제약이라 향후 단위 테스트 작성 시 유의점으로 남긴다.
8. **내부 의존성**: `hooks/_lib` 와 `skills/*/scripts` 양쪽이 `_shared` 를 향해서만 의존하고 `_shared` 는 그 반대 방향 의존이 전혀 없음을 확인 — `_shared/__init__.py` 의 설계 의도("hooks/_lib 와 skills/_lib 가 서로 shadow 하니 제3의 패키지로 분리") 그대로 구현됨. 유일한 예외가 위 WARNING(merge-coordinator 미마이그레이션).

## 요약

이번 변경은 두 harness 내부 유틸리티(`block_integrity.py`, `retry_state.py`)를 신설해 기존에 여러 orchestrator/hook 에 흩어져 있던 로직을 `.claude/_shared/` 로 모으는 순수 내부 리팩터로, 외부 패키지를 전혀 추가하지 않으며 버전 고정·라이선스·취약점 축은 모두 해당 없음(N/A)이다. `_shared` 패키지 자체의 설계(제3 top-level 패키지, 단방향 의존)도 순환 없이 깔끔하다. 다만 이번 추출의 명시적 근거("두 orchestrator 가 사본을 들고 있었다")가 실제로는 `merge_coordinator_orchestrator.py` 라는 세 번째 사본을 빠뜨리고 있어, "Change both" 문제를 "Change all three 중 둘만" 상태로 절반만 해소했다는 완결성 갭이 남아 있다(WARNING). 이 외에 `block_integrity.py` 의 `removesuffix` 사용이 harness 전체에서 처음으로 Python 3.9+ 를 암묵적으로 요구하게 된 점은 문서화되지 않은 사소한 호환성 관찰이다(INFO, fail-open 경로라 실질 크래시 위험은 낮음).

## 위험도

LOW
