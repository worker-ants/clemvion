# 아키텍처(Architecture) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`, `plan/in-progress/harness-guard-followups.md`

## 발견사항

- **[WARNING]** `if __name__ == "__main__":` 블록이 파일 끝에 중복 존재 (dead code)
  - 위치: `.claude/hooks/guard_review_before_push.py:491-496`
  - 상세: 리팩터가 `main()` 을 `_run_gates`/`_report_fail_open` 으로 나누며 새 `if __name__ == "__main__": sys.exit(main())` 블록(491-492행)을 추가했는데, 원래 파일 끝에 있던 동일 블록(495-496행)을 제거하지 않아 정확히 같은 코드가 두 번 남았다. 실제 파일을 직접 읽어 확인:
    ```
    491|if __name__ == "__main__":
    492|    sys.exit(main())
    493|
    494|
    495|if __name__ == "__main__":
    496|    sys.exit(main())
    ```
    기능적으로는 무해하다 — 첫 블록에서 `sys.exit(main())` 이 `SystemExit` 을 던지며 모듈 최상위 실행을 즉시 종료시키므로 두 번째 블록에 도달하지 않고, `main()` 이 두 번 호출되는 일도 없다. 다만 diff 가 정리되지 않은 상태로 커밋 준비됐다는 신호이며, 향후 편집자가 "왜 두 번 있지?"로 혼란을 겪거나 한쪽만 수정해 drift 를 만들 위험이 있다(DRY 위반, 불필요한 인지 부하).
  - 제안: 중복된 블록 중 하나(예: 491-493행)를 제거해 파일 끝에 `if __name__ == "__main__": sys.exit(main())` 이 한 번만 남도록 정리.

- **[INFO]** 새 fail-open 관측 로직이 `_lib/` 분리 패턴을 따르지 않고 훅 본체에 인라인
  - 위치: `.claude/hooks/guard_review_before_push.py:363-472` (`_state_path`~`_run_gates`)
  - 상세: 이 훅은 REVIEW/PLAN 게이트의 도메인 판정 로직을 각각 `_lib/review_guard.py`, `_lib/plan_guard.py` 로 분리해 두었다. 반면 이번에 추가된 fail-open streak 상태관리·보고(`_state_path`/`_read_streak`/`_write_streak`/`_report_fail_open`)는 훅 파일에 직접 인라인됐다. 저장소의 다른 훅(`guard_default_branch_bash.py`, `mark_resolution_in_flight.py`)도 `.claude/state/` 상태 관리를 자기 파일에 인라인하는 것이 기존 관례이므로 이 자체가 규약 위반은 아니지만, 이 fail-open 관측 패턴("연속 N회 카운트 + 임계치 에스컬레이션 + try/except 전체 감싸기")은 §E 커밋 메시지가 언급하는 다른 fail-open 경로(예: mermaid-lint 의 W4 import fail-open)에도 재사용될 여지가 있는 범용 개념이다. 지금처럼 훅에 박아두면 두 번째 소비처가 생길 때 같은 로직을 다시 손으로 짜게 될 가능성이 있다.
  - 제안: 지금 당장 추출할 필요는 없다(소비처가 1곳뿐이라 YAGNI). 다만 두 번째 fail-open 관측 소비처가 생기면 `_lib/failopen_observability.py` 같은 공유 모듈로 승격을 고려할 것 — plan 파일에 이미 유사한 향후-공유 패턴(§C `_lib/git_command_detection.py`)이 기록되어 있으므로 같은 결을 유지하는 편이 일관적이다.

- **[INFO]** `_run_gates(degraded)` 가 출력 파라미터(output parameter)로 결과를 전달
  - 위치: `.claude/hooks/guard_review_before_push.py:431-471`
  - 상세: `_run_gates` 는 exit code 는 `return` 하면서, "어떤 게이트가 degraded 했는가"는 호출자가 넘긴 리스트를 in-place mutate 해서 전달한다(`degraded.append(...)`). 두 가지 산출물(종료 코드, degraded 목록)을 서로 다른 채널(반환값 vs 부작용)로 내보내는 방식이라, 호출부(`main()`)를 읽을 때 `degraded` 가 채워진다는 사실을 함수 시그니처만으로는 알 수 없고 docstring 을 봐야 한다. 함수 자체는 결정적이고 테스트도 충분하지만, 순수성이 낮아 향후 확장(예: degraded 외에 다른 진단 정보 추가) 시 시그니처가 계속 암묵적 계약에 의존하게 된다.
  - 제안: `def _run_gates() -> tuple[int, list[tuple[str, str]]]` 형태로 반환값에 명시적으로 포함시키는 편이 호출부에서 더 읽기 쉽다. 다만 현재 규모에서는 사소한 스타일 이슈이며 시급하지 않다.

- **[INFO]** REVIEW/PLAN 두 게이트 블록의 보일러플레이트가 계속 복제됨(이번 diff 로 신규 도입된 문제는 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py:438-469` (`_run_gates` 내부 REVIEW 블록과 PLAN 블록)
  - 상세: `_run_gates` 로 옮겨진 두 게이트 블록은 "BYPASS 확인 → None 체크(=degraded) → try/except(예외=degraded) → 판정 조건 → 메시지 출력 후 return 2" 라는 동일한 5단계 구조를 그대로 반복한다. 이 구조는 리팩터 이전에도 `main()` 안에 있던 중복이라 이번 변경이 새로 만든 결함은 아니지만, 마침 이 블록들을 별도 함수로 뽑아내는 리팩터를 하면서도 중복 자체는 해소하지 않았다. 세 번째 게이트가 추가되면 같은 5단계를 또 손으로 베껴 쓰게 된다(OCP 관점에서 "새 게이트 추가"가 기존 코드 복제를 요구).
  - 제안: 시급하지 않음(게이트가 2개뿐이고 각 메시지 포맷·데이터클래스 필드가 달라 억지로 통합하면 오히려 가독성이 떨어질 수 있음). 세 번째 게이트가 실제로 추가될 때 `_run_single_gate(name, evaluate_fn, bypass_env, is_blocking, msg_template)` 같은 공통 헬퍼로의 추출을 재검토할 것.

## 요약

이번 변경은 기존 `main()` 에 인라인돼 있던 REVIEW/PLAN 게이트 순차 실행을 `_run_gates()` 로 뽑아내고, `main()` 을 "입력 파싱 → push 여부 판정 → 게이트 실행/보고" 로 얇게 정리한 뒤, `try/finally` 로 fail-open 발생을 항상 관측·기록하도록 감싼 구조로, 기존 계층(엔트리포인트 `main()` vs 도메인 판정 `_lib/*_guard.py`)과 정책 결정(§E, 사용자 확정)에 부합하는 합리적인 확장이다. 새로 추가된 관측 로직(`_state_path`/`_read_streak`/`_write_streak`/`_report_fail_open`) 전체가 `try/except: pass` 로 감싸여 "관측이 관측 대상을 깨뜨리지 않는다"는 설계 제약을 지키고 있고, BYPASS_* 를 degraded 에서 명시적으로 제외해 신호 오염을 막은 점도 SRP·의도 분리 측면에서 견고하다. 유일하게 실질적으로 지적할 부분은 diff 정리 과정에서 파일 끝에 `if __name__ == "__main__":` 블록이 중복으로 남은 것(기능 영향은 없으나 정리 필요)이며, 그 외에는 향후 재사용/확장 시 고려하면 좋을 스타일 수준의 개선 여지(출력 파라미터, 게이트 보일러플레이트 중복, 인라인 상태관리의 향후 공유화)만 남아 있다.

## 위험도
LOW
