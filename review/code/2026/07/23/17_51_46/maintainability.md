# 유지보수성(Maintainability) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`
(+ `.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md` — 문서 동기화 확인)

리뷰 범위: `origin/main...HEAD` 3커밋(`dd4311678` fail-open 관측성 도입 → `e617a19a0` 1차 리뷰 Warning 9건 반영
→ `af849ba25` 2차 리뷰 CRITICAL 1건 + Warning 5건 반영)의 최종 결과물. 실제 워크트리 파일을 직접 `Read` 해
게이트 라인 번호를 확인했다(프롬프트에 diff 가 생략된 파일 1·3 포함).

## 사전 확인 — 이전 라운드 지적사항 재검증

이전 두 라운드(16_55_04, 17_22_18)의 maintainability 관련 지적 중 다음은 실제로 해소됨을 최종 파일에서
직접 확인했다: `if __name__ == "__main__":` 중복 제거(현재 583-584행 1회만 존재), `_write_streak` 매개변수명
`gates`→`degraded` 통일(399행), `os.path.exists`+`os.remove` TOCTOU → `try/except FileNotFoundError`(447-450행),
`_state_path`/`_read_streak`/`_write_streak` docstring 추가(384/390/400행), 모듈 최상단 docstring 에 fail-open
관측 정책 반영(25-33행), `_FAILOPEN_ESCALATE_AT=3` 근거 주석(377-380행).

## 발견사항

- **[INFO]** 게이트 식별자 `"REVIEW"`/`"PLAN"` 이 이름 있는 상수 없이 8곳에 리터럴 문자열로 반복됨
  - 위치: `.claude/hooks/guard_review_before_push.py:376`(`_ALL_GATES = frozenset({"REVIEW", "PLAN"})`), `:511,514,521,523`(REVIEW), `:530,533,540,542`(PLAN)
  - 상세: `_run_gates()` 안에서 `outcome.bypassed.append("REVIEW")` / `degraded.append(("REVIEW", ...))` / `outcome.answered.append("REVIEW")` 가 각각 리터럴 `"REVIEW"` 를 재입력하고, `_ALL_GATES` 의 리셋 판정(`set(outcome.answered) != _ALL_GATES`, 445행)이 이 문자열들과 정확히 일치해야 성립한다. 이 리셋 술어는 바로 이번 3라운드에 걸쳐 세 번 틀렸던(v1 BYPASS 가 지움 → v2 아무 게이트나 답하면 지움 → v3 REVIEW 차단이 지움) 지점이라, "네 번째로 틀리는 방식"이 오탈자(`"Review"` 등)로 발생할 여지가 구조적으로 남아 있다. 다행히 현재 테스트(`test_a_fully_clean_push_still_resets`, `test_bypass_does_not_clear_an_existing_streak` 등 35건 중 다수)가 answered 세트 비교의 실제 동작을 검증하므로 오탈자가 있었다면 스위트가 잡았을 것이다 — 지금 당장 버그는 아니다.
  - 제안: `_GATE_REVIEW = "REVIEW"` / `_GATE_PLAN = "PLAN"` 상수(또는 `_ALL_GATES` 원소를 그대로 재사용)로 8곳의 리터럴을 대체하면 오탈자 클래스 자체를 컴파일 타임에 준하는 수준으로 제거할 수 있다. 급하지 않음(테스트가 안전망 역할을 하고 있음).

- **[INFO]** 동일 게이트를 가리키는 표기가 두 배너 사이에서 대소문자가 다름
  - 위치: fail-open 배너 — `.claude/hooks/guard_review_before_push.py:460`(`f"      {gate} gate — {reason}"`, `gate` 는 `"REVIEW"`/`"PLAN"` 대문자) vs BLOCKED 배너 — `:325`(`_REVIEW_MSG`, `"(review gate)"` 소문자), `:347`(`_PLAN_MSG`, `"(plan gate)"` 소문자)
  - 상세: 같은 개념("REVIEW 게이트")이 사용자에게 보이는 두 메시지에서 `REVIEW gate`(대문자) / `(review gate)`(소문자)로 다르게 표기된다. 둘 다 각각 테스트(`test_push_blocked_by_review_gate`: `"(review gate)"`, `test_import_failure_is_announced_and_counted`: `"REVIEW gate"`)로 고정돼 있어 의도된 배선이지만, 로그를 grep 하는 사람이 대소문자를 다르게 시도해야 하는 사소한 비일관이다.
  - 제안: 우선순위 낮음. 다음에 배너 문구를 만질 때 한 가지 표기로 통일 고려.

- **[INFO]** "fail-open 은 유지하되 관측 가능하게" 라는 정책 설명이 세 계층에서 중복 서술됨
  - 위치: 모듈 최상단 docstring `:25-33`, 섹션 헤더 주석 `:364-372`, `_report_fail_open` docstring 리셋 규칙 단락 `:413-441`
  - 상세: 같은 정책 근거(왜 fail-open 을 유지하는지, 왜 3회에 에스컬레이션하는지, 왜 리셋이 "모든 게이트 응답"을 요구하는지)가 세 위치에서 각각 다른 상세도로 반복 설명된다. 이 파일 특유의 "왜"를 남기는 스타일과 일치하고 지금은 세 서술이 서로 모순되지 않지만, 향후 정책이 다시 바뀌면(이 리셋 술어처럼 이미 세 번 바뀐 이력이 있다) 세 곳을 모두 동기화해야 하는 drift 표면이 된다.
  - 제안: 지금 정리할 필요는 없음. 다만 리셋 규칙을 다시 손볼 때는 세 서술을 함께 검색(`grep -n "ALL_GATES\|모든 게이트\|EVERY gate"`)해 갱신할 것을 유념.

- **[INFO]** `main()` 최상위 `try` 가 `_read_payload`/`_is_git_push` 뿐 아니라 `_run_gates()` 호출 자체도 감싸, 그 안에서 발생하는(이미 캐치되는 `evaluate_*()` 예외가 아닌) 미지의 버그까지 `"DETECTION"` 으로 라벨링될 수 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:559-578`(`main()` try/except), 특히 `:567`(`exit_code = _run_gates(outcome)`)가 `:569`(`except Exception as exc:`) 안에 있음
  - 상세: 주석(`:570-575`)은 "anything unhandled above — payload read, or push DETECTION itself" 라고 정확히 "위에서 처리 안 된 모든 것"이라 말하고 있어 틀린 서술은 아니다. 다만 `_run_gates` 내부의 `evaluate_review()`/`evaluate_plan()` 호출은 이미 자체 try/except 로 감싸여 있어(516-521행, 535-540행) 이 외부 except 에 도달할 일이 없고, 실제로 도달하는 경로는 `_read_payload`/`_is_git_push`(설계 의도대로) 이거나 `_run_gates` 자체의 제어 흐름 버그(예: `outcome.answered.append` 오타로 인한 `AttributeError` 등, 가능성은 낮음)뿐이다. 후자가 발생하면 streak 파일·배너 모두 `"DETECTION"` 으로 기록되어, 실제로는 push 탐지 로직이 아니라 게이트 오케스트레이션 자체에 버그가 있었음을 나중에 디버깅하는 사람이 오인할 수 있다.
  - 제안: 현재로선 조치 불요(발생 가능성 낮고, fail-open 정책상 라벨의 정확도보다 "관측되는 것" 자체가 더 중요). `_run_gates` 에 새 분기를 추가할 때 이 catch-all 범위를 기억해 둘 것.

- **[INFO, 이전 라운드에서 이미 검토·의도적 보류됨 — 재확인만]** `_run_gates()` REVIEW/PLAN 블록의 4단 중첩과 구조적 중복, 예외 사유 포맷 문자열(`f"{type(exc).__name__}: {exc}"`) 3중 중복, `_Outcome` 클래스의 전방 참조(`_report_fail_open`이 490행에 정의될 `_Outcome`을 413행에서 타입으로 먼저 사용) — 전부 `review/code/2026/07/23/17_22_18/maintainability.md` 가 이미 지적했고 해당 RESOLUTION(`review/code/2026/07/23/17_22_18/RESOLUTION.md` INFO #14/#15/#16/#17)이 "3번째 게이트가 생기면/다음 터치에" 로 의식적으로 보류하기로 결정한 항목이다. 최종 파일에서 그대로 남아 있음을 확인했으나(506-550행, 521·540·577행, 413행 vs 490행), 이미 근거를 남기고 내린 결정이므로 이번 라운드에서 재차 지적하지 않는다.

## 요약

이번 diff(§E fail-open 관측가능화, 3커밋 누적)는 REVIEW/PLAN 게이트를 `_run_gates()`로 분리하고
`_Outcome`으로 상태를 명확히 구조화했으며, `main()`을 `try/except/finally`로 감싸 배너·리셋·에스컬레이션이
정확히 원하는 경로에서만 발동하도록 만들었다. 실제 워크트리 파일을 직접 읽어 확인한 결과 앞선 두 라운드가
지적한 실질적 결함(`__main__` 중복, 매개변수명 불일치, TOCTOU, docstring 공백, 리셋 술어 세 번의 오류)은
모두 해소되어 있다. 이번 라운드에서 새로 찾은 사항은 전부 INFO 수준의 방어적 개선 여지 — 게이트 식별자
문자열의 무상수 반복(오탈자 위험이 있으나 테스트가 안전망), 두 배너 사이 대소문자 비일관, 정책 설명의
3중 중복 서술, 그리고 `main()`의 catch-all 이 `_run_gates` 내부의 (가상의) 미래 버그까지 "DETECTION"으로
라벨링할 수 있다는 점 — 이며, 어느 것도 현재 동작의 정확성이나 가독성을 실질적으로 해치지 않는다. 함수
길이·순환 복잡도는 도메인 대비 적정 수준이고, 파일 전체의 "왜"를 남기는 주석 문화와 네이밍 컨벤션도
일관되게 유지되고 있다.

## 위험도
LOW
