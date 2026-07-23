# 테스트(Testing) 리뷰 — push guard fail-open observability

## 발견사항

- **[WARNING]** 에스컬레이션 임계값(`_FAILOPEN_ESCALATE_AT = 3`)의 경계 조건에 대한 부재(negative) 단언이 없음 — 뮤테이션 생존 가능
  - 위치: `.claude/hooks/guard_review_before_push.py` 418-423행 (`if streak >= _FAILOPEN_ESCALATE_AT:` 에스컬레이션 분기) / `.claude/tests/test_guard_review_before_push_main.py` 292-300행 (`test_consecutive_fail_opens_accumulate_and_escalate`)
  - 상세: 이 테스트는 3회 반복 후 마지막(`streak==3`) 응답에만 `"‼️"` 가 **존재함**을 단언한다. 그러나 streak 이 1, 2 일 때 `"‼️"` 가 **부재함**은 어떤 테스트도 확인하지 않는다. 따라서 `_FAILOPEN_ESCALATE_AT` 비교 연산자를 `>= 1`(항상 에스컬레이션) 이나 `> 0` 등으로 바꾸는 off-by-one 회귀가 있어도 현재 스위트는 전부 통과한다. plan 문서(`plan/in-progress/harness-guard-followups.md` 229-231행)가 스스로 "보고 호출 제거 뮤턴트 6개 중 5개 포착"이라고 밝히고 있어 뮤테이션 검증이 이미 시도됐지만, 이 특정 경계 뮤턴트는 대상에 포함되지 않은 것으로 보인다.
  - 제안: 루프의 1·2회차 응답에도 `self.assertNotIn("‼️", r.stderr)` 를 추가해 "한 번의 blip 과 사실상 꺼진 게이트가 같게 읽히면 안 된다"는 이 기능의 핵심 의도를 경계값 양쪽에서 고정한다.

- **[WARNING]** BYPASS_* 가 "진짜 고장난" 게이트의 degraded 판정 자체를 건너뛰는지가 검증되지 않음 (현재는 "정상 동작하지만 차단한" 게이트로만 검증)
  - 위치: `.claude/hooks/guard_review_before_push.py` 431-437행(`_run_gates` docstring — "A gate the user consciously bypassed with BYPASS_* is NOT degraded") / `.claude/tests/test_guard_review_before_push_main.py` 311-317행 (`test_conscious_bypass_is_not_counted_as_degradation`)
  - 상세: 이 테스트는 `review="blocked"`(정상 동작하지만 `blocked=True`) + `bypass_review=True` 조합만 사용한다. 즉 "정상 게이트를 의식적으로 건너뛰는" 경로만 검증하고, "실제로 import 에 실패했거나 예외를 던지는(`review="import_error"` 또는 `"raise"`) 게이트를 BYPASS 로 건너뛸 때도 degraded 로 집계되지 않는지"는 어떤 테스트도 확인하지 않는다. 이 조합이야말로 이 기능이 명시적으로 구분하려는 핵심 계약("의식적 우회 ≠ 조용한 실패")이므로, 정확히 그 경계를 찌르는 테스트가 빠져 있다.
  - 제안: `self._run(_PUSH, review="import_error", plan="clean", bypass_review=True)` 형태로 실행해 `returncode==0`, `"fail-open" not in stderr`, streak 파일 미생성을 단언하는 테스트를 추가.

- **[WARNING]** 두 게이트가 동시에 degraded 되는 시나리오 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py` 402-404행 (`_write_streak(streak, degraded)` — `degraded` 는 여러 항목을 담을 수 있는 리스트) / 기존 테스트 `test_both_gate_imports_fail_allows_the_push`(파일 249-252행 부근, 이번 diff 밖의 기존 테스트)는 `returncode==0` 만 확인
  - 상세: `review="import_error"`, `plan="import_error"` 를 동시에 주는 기존 테스트가 있지만 이번 diff 이전부터 있던 테스트라 fail-open 관측(§E) 관점의 단언이 전혀 없다. streak 카운터가 실행 1회당 정확히 1만 증가하는지(게이트 2개가 동시에 degraded 돼도 2가 아니라 1), stderr 에 "REVIEW gate"와 "PLAN gate" 줄이 모두 출력되는지, state 파일의 `"gates"` 리스트에 두 항목이 모두 기록되는지는 어느 테스트도 확인하지 않는다.
  - 제안: 새 테스트 1건 추가 — 양쪽 다 `import_error` 로 설정 후 `self._streak() == 1`, `"REVIEW gate" in r.stderr`, `"PLAN gate" in r.stderr` 를 단언.

- **[INFO]** `_read_streak`/`_write_streak`/`_state_path` 에 대한 직접 단위 테스트 부재 — 손상된 state 파일 케이스가 subprocess E2E 로만 간접 커버됨
  - 위치: `.claude/hooks/guard_review_before_push.py` 372-378행 (`_read_streak` — `isinstance(value, int) and value > 0` 방어 로직)
  - 상세: 이 함수는 `streak` 값이 정수가 아니거나(예: 문자열), 음수이거나, JSON 최상위가 dict 가 아니거나, 파일이 손상된 JSON 일 때를 명시적으로 방어하도록 작성돼 있다. 그러나 현재 테스트 스위트는 이 함수를 항상 스스로 쓴 정상 형식의 파일로만 간접 실행하며, 방어 코드가 실제로 의도한 입력(손상/비정수/음수 streak)에서 0 을 반환하는지 직접 검증하는 테스트는 없다. 이 파일은 subprocess E2E 만 쓰는 것이 문서화된 설계 원칙(파일 docstring)이라 방향 자체는 타당하지만, 순수 함수 수준의 값싼 단위 테스트로 보강할 여지가 있다.
  - 제안: (선택) `.claude/state/push_guard_failopen.json` 에 `{"streak": "abc"}`, `{"streak": -1}`, `["not", "a", "dict"]`, 손상된 JSON 텍스트를 직접 써 넣은 뒤 훅을 실행해 streak 이 0 부터 다시 시작함을 확인하는 케이스 1~2건 추가.

- **[INFO]** `CLAUDE_PROJECT_DIR` 미설정 시 `os.getcwd()` 폴백 분기가 어떤 테스트에서도 실행되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 367-369행 (`_state_path` — `os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()`)
  - 상세: 모든 테스트가 `env["CLAUDE_PROJECT_DIR"] = self.tmp` 를 명시적으로 설정한다(테스트 격리를 위해 옳은 선택). 그 결과 이 fallback 분기(`CLAUDE_PROJECT_DIR` 가 비어 있을 때 `os.getcwd()` 사용)는 테스트에서 전혀 도달하지 않는다. 이 분기가 실제 운영 환경에서 실행되면 상태 파일이 훅을 호출한 프로세스의 cwd(임의의 실제 저장소 디렉토리일 수 있음)에 쓰이므로, 최소한 폴백 자체가 예외 없이 동작함을 확인하는 테스트가 있으면 좋다.
  - 제안: `env.pop("CLAUDE_PROJECT_DIR", None)` 후 `cwd=self.tmp` 로 subprocess 를 실행해 `.tmp/.claude/state/...` 에 파일이 생기는지 확인하는 케이스 1건 (우선순위 낮음).

- **[INFO]** `guard_review_before_push.py` 파일 말미에 `if __name__ == "__main__": sys.exit(main())` 블록이 중복 — diff 병합 흔적으로 보이는 죽은 코드
  - 위치: `.claude/hooks/guard_review_before_push.py` 491-496행
  - 상세: 실제 파일을 직접 확인한 결과 다음과 같이 동일 블록이 두 번 존재한다.
    ```
    491|if __name__ == "__main__":
    492|    sys.exit(main())
    493|
    494|
    495|if __name__ == "__main__":
    496|    sys.exit(main())
    ```
    첫 블록의 `sys.exit()` 가 `SystemExit` 을 던져 프로세스를 즉시 종료시키므로 두 번째 블록은 절대 도달하지 않는 죽은 코드이며 기능적 영향은 없다. 다만 어떤 테스트나 린트도 이런 구조적 중복을 잡아내지 못하며(구문상 유효하므로 `py_compile` 도 통과), 실수로 남은 diff 병합 잔재로 보인다.
  - 제안: 중복 블록 하나 제거. (기능 결함은 아니므로 이 리뷰의 위험도 판정에는 반영하지 않되, 다른 관점(코드 품질) 리뷰어가 별도로 지적할 수 있음.)

- **[INFO]** `_run_gates(degraded)` 가 뮤터블 리스트를 out-parameter 로 받는 부작용 기반 설계라 순수 단위 테스트가 어려움
  - 위치: `.claude/hooks/guard_review_before_push.py` 431-471행 (`_run_gates`)
  - 상세: `degraded` 리스트를 인자로 받아 append 하고 반환값은 exit code 만인 설계라, 이 함수를 직접 단위 테스트하려면 호출 후 리스트 내용을 따로 확인해야 한다. 현재는 이 함수가 subprocess E2E 로만 검증되므로 당장 문제는 아니지만, `(exit_code, degraded)` 를 함께 반환하는 순수 함수 형태였다면 `main()` 을 거치지 않는 더 빠른 단위 테스트도 가능했을 것이다.
  - 제안: 없음(현행 유지 가능) — 향후 이 함수의 분기가 늘어날 경우 리팩터링 검토.

## 요약

새로 추가된 fail-open 관측 기능(`_state_path`/`_read_streak`/`_write_streak`/`_report_fail_open`/`_run_gates`)은 기존 테스트 파일의 문서화된 전략(실제 훅을 subprocess 로 실행하는 E2E 방식)을 그대로 따라 7건의 신규 테스트로 주요 경로 — import 실패·evaluate 예외의 계수, 연속 누적과 3회 에스컬레이션, 정상 판정 시 리셋, BYPASS 의 비-집계, 차단 경로에서도 보고됨, state 디렉토리 쓰기 실패 시에도 판정 불변 — 를 잘 커버한다. 기존 20건의 테스트도 `CLAUDE_PROJECT_DIR` 격리를 정확히 추가해 회귀 없이 유지된다. 다만 세 가지 뮤테이션-생존 가능 지점이 남아 있다: (1) 에스컬레이션 임계값의 경계(1·2회차에 `‼️` 가 없음을 확인하지 않음), (2) "BYPASS 가 진짜 고장난 게이트도 degraded 로 세지 않는다"는 핵심 계약이 "정상이지만 차단된" 게이트로만 검증됨, (3) 두 게이트가 동시에 degraded 되는 경우 streak 이 1회만 증가하고 두 게이트 모두 보고되는지 미검증. 이들은 모두 이 기능의 존재 이유(신호를 놓치지 않는 것)와 직결되는 지점이라 WARNING 으로 분류했다. 그 외 손상된 state 파일 파싱, `CLAUDE_PROJECT_DIR` 미설정 폴백, 파일 말미의 죽은 코드 중복 등은 우선순위가 낮은 INFO 다. 전반적으로 테스트 가독성과 격리는 양호하고, 회귀 위험은 낮다.

## 위험도
LOW
