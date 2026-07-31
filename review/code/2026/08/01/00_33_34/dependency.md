# Dependency Review

## 발견사항

- **[INFO]** 신규 외부(서드파티) 의존성 없음 — 확인 완료
  - 위치: `.claude/_shared/block_integrity.py:29-32`, `.claude/_shared/retry_state.py:31-38`
  - 상세: 이번 diff(15개 파일, `origin/main...HEAD`)에서 추가된 `import`/`from` 구문을 전수 grep 했다.
    신규 모듈 `_shared/block_integrity.py`(`os`, `re`), `_shared/retry_state.py`(`json`, `os`, `sys`,
    `datetime`, 그리고 패키지 내부 상대 임포트 `from . import report_paths`), 신규 테스트 2종
    (`test_block_integrity.py`, `test_retry_state_shared.py`: `unittest`, `tempfile`, `shutil`,
    `subprocess`, `io`, `contextlib`, `dataclasses`, 그리고 하네스 내부 헬퍼 `_harness`)까지 전부
    표준 라이브러리 또는 프로젝트 내부 모듈이다. `package.json`/`requirements*.txt`/`pyproject.toml`/
    lockfile 류 변경도 0건(`git diff --stat` 확인). `.claude/tests/README.md` 가 명시하는 하네스 컨벤션
    ("Python 은 서드파티 의존성 0, hooks 는 bare `python3` 위에서 동작") 을 그대로 준수한다.
  - 제안: 없음(그대로 두면 됨). 라이선스·취약점·버전 고정 관점 모두 "신규 의존성 없음"으로 N/A.

- **[INFO]** 내부 모듈 의존성 리팩터링 — 방향성·중복 제거 모두 정확하게 마무리됨
  - 위치: `.claude/_shared/retry_state.py`(신규) · `.claude/_shared/block_integrity.py`(신규) ·
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` ·
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` ·
    `.claude/hooks/_lib/review_guard.py:129-131`
  - 상세: `code_review_orchestrator.py`/`consistency_orchestrator.py`가 "Change both" 주석으로만
    동기화하던 5개 함수(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/
    `_apply_status_update`/`_emit_summary_state`)를 `_shared/retry_state.py`로 추출했고,
    `review_guard.py`의 로컬 `_BLOCK_LINE` 정규식(구 버전)도 신규 `_shared/block_integrity.py`로
    이관됐다. 두 orchestrator 의 diff 를 직접 대조한 결과 위임 후 로컬 중복 구현이 고아 코드로
    남지 않았고(예: `consistency_orchestrator.py`에서 더 이상 쓰이지 않는
    `from _shared import report_paths as _report_paths_lib` 임포트도 함께 제거됨 — 참조 누락 없음),
    `_shared/__init__.py`가 명시한 규칙("`_shared`는 `hooks/`나 `skills/`를 import 하지 않는다")도
    깨지지 않았다(`_shared/*.py` 임포트 전수 확인: stdlib + 패키지 내부 상대 임포트뿐).
    `test_block_integrity.py:96`의 "the dependency direction (`_shared` must not import a skill)
    has to stay" 주석과 일치.
  - 제안: 없음(정상).

- **[INFO]** `merge_coordinator_orchestrator.py`는 세 orchestrator 중 유일하게 self-healing
  (`reconcile_state_with_disk`) 미적용 — 이미 plan 에 후속 항목으로 추적됨
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-112`,
    `plan/in-progress/harness-review-gate-ci-backstop.md`(§9)
  - 상세: 이 파일도 `_load_state`/`_save_state`/`_apply_status_update`는 `_shared/retry_state.py`로
    위임하도록 이번 diff 에서 갱신됐지만, `_emit_summary_state`는 로컬 구현(branch/base 필드 포함)을
    유지하고 `reconcile_state_with_disk` 호출이 아예 없다. 그 결과 `Agent` tool 로 직접 fan-out 한
    merge-coordinate 세션은 `_retry_state.json`이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 는 실제
    성공을 보고하는, 다른 두 orchestrator 가 이미 고친 것과 동일한 모순을 여전히 겪을 수 있다.
    다만 이는 이번 diff 가 은폐한 회귀가 아니라 — 코드 주석과 plan 문서(§9) 양쪽에 "별도 skill 의
    동작 변경이라 별도 PR 로 분리한다"고 명시적으로 기록돼 있다.
  - 제안: 이번 PR 범위에서 조치 불필요(의도적 defer, 이미 추적됨). 후속 PR 에서
    `merge_coordinator_orchestrator.py`에도 `reconcile_state_with_disk` 위임을 마저 적용할 것.

- **[INFO]** 하네스 Python 최소 버전이 명문화돼 있지 않음 — 이번 PR 은 올바르게 회피했으나 구조적
  재발 방지책은 없음
  - 위치: `.claude/_shared/block_integrity.py:133-136`
  - 상세: `contradiction_note()`에서 `str.removesuffix()`(Python 3.9+) 대신
    `k[:-3] if k.endswith('.md') else k`를 쓴 이유를 주석으로 남겼다 — "이 트리 최초 사용이 되어
    하네스의 실효 최소 버전을 조용히 끌어올릴 것"이라는 근거다. grep 으로 확인한 결과
    `removesuffix`/`removeprefix`는 `.claude/**` 전체에서 정말 미사용이라 이 주장은 사실과 일치한다.
    다만 저장소 어디에도 `.claude/**` 스크립트의 최소 Python 버전을 못박은 문서/설정이 없고,
    `.github/workflows/harness-checks.yml`의 `python-version: '3.x'`는 최신 3.x로 뜨기 때문에 CI는
    이런 종류의 회귀(로컬 구버전 `python3`에서만 깨지는 3.9+ 전용 stdlib 호출)를 애초에 잡을 수 없다.
    이번 PR 의 결정 자체는 정확하지만, 다음 기여자가 같은 함정을 인지하지 못하고 3.9+ 전용 API 를
    다시 도입하면 CI 는 통과하고 오래된 로컬 `python3`에서만 조용히 깨질 수 있다(코드 주석이 지적하듯
    `except Exception`이 넓어 REVIEW 게이트를 통째로 fail-open 시키는 방식으로).
  - 제안: 이번 PR 에서 조치할 필요는 없음(회귀 아님, 사전 예방적 관찰). 여유가 있을 때
    `.claude/tests/README.md` 또는 별도 convention 문서에 최소 Python 버전을 한 줄로 명문화하는 것을
    고려.

## 요약

이번 변경은 harness(`.claude/**`) 내부의 Python 오케스트레이터/훅 리팩터링 + 신규 backstop 기능
추가로, 애플리케이션(`codebase/**`) 의존성과는 무관하다. `git diff --stat`·전수 import grep 으로
확인한 결과 신규 외부 패키지·버전 고정·라이선스·취약점 이슈는 전혀 발생하지 않았으며(패키지 매니페스트
변경 0건), 신규 모듈 2종(`_shared/block_integrity.py`, `_shared/retry_state.py`)은 표준 라이브러리만
사용해 "하네스 Python 은 서드파티 의존성 0" 컨벤션을 그대로 지킨다. 오히려 이 PR 의 핵심은 내부
의존성 위생 개선이다 — 두 orchestrator 가 "Change both" 주석으로만 동기화하던 5개 함수와
`review_guard.py`의 중복 `BLOCK:` 파서를 `_shared/`로 추출해 단일 진실 원천으로 만들었고, 계층 방향
(`_shared`는 `hooks`/`skills`를 참조하지 않음)도 깨지지 않았다. 유일한 잔여 비대칭은
`merge_coordinator_orchestrator.py`가 self-healing 위임을 부분적으로만 받았다는 점인데, 이는 코드
주석과 plan 문서 양쪽에 의도적 defer 로 이미 명시돼 있어 은폐된 리스크가 아니다. Python 최소 버전
미문서화는 이번 PR 이 만든 문제가 아니라 이번 PR 이 잘 피해간 기존 잠재 리스크다.

## 위험도

NONE
