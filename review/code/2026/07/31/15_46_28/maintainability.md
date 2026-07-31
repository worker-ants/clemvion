# 유지보수성(Maintainability) Review

## 발견사항

- **[CRITICAL]** 2단 truncation 이 "총 줄 수" 를 재계산할 때, 이전 truncation 이 붙여놓은 안내문 텍스트를 실제 코드 줄로 착각해 잘못된 숫자를 보고한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:637-640` (1차: 파일 단위 `max_file_size` truncation, `_truncated_note` 로 안내문 append) 및 `:746`, `:751-757` (2차: 프롬프트 총예산 truncation, `build_files_section`)
  - 상세: `build_files_section` 은 큰 파일을 **두 번** 자를 수 있다. 1차(파일 캡)에서 `full_content, kept, total = line_anchors.truncate_to_line_boundary(full_content, max_file_size)` 로 정확한 `total`(원본 파일의 실제 총 줄 수)을 구하고, 여기에 `_truncated_note(kept, total, "파일 크기 제한")` 문자열(선두에 `\n` 하나 포함)을 이어붙여 `file_parts[i]["full_content"]` 에 저장한다. 이 파일이 전체 프롬프트 예산에도 안 맞으면 2차 truncation 이 실행되는데, 이때 `line_count = file_parts[i]["full_content"].count("\n") + 1` (line 746) 로 "총 줄 수" 를 **다시** 계산한다 — 그런데 이 문자열은 이미 1차 안내문이 섞여 있는 **가공된 텍스트**라서, 안내문이 만든 개행 1개가 실제 코드 줄인 것처럼 더해진다. 이어서 `line_anchors.truncate_to_line_boundary(file_parts[i]["full_content"], available)` (line 752-754) 를 **같은 오염된 문자열**에 다시 호출해 최종 `kept, total` 을 얻고, 이 값으로 새 안내문을 붙인다(line 755-757) — 1차가 만든 정확한 "kept/total" 문구는 그대로 **폐기**된다.
    실측: 이 리뷰 세션 자체를 `build_agent_prompt_body('maintainability', ...)` 로 재현하면 `code_review_orchestrator.py`(실제 1531줄, `wc -l` 확인)에 대해 프롬프트에 `"프롬프트 크기 제한으로 907/1148 줄만 표시"` 가 나온다. 그러나 `"1531"`, `"1147/1531"` 은 최종 프롬프트 어디에도 없다 — 즉 사용자(reviewer)가 실제로 받는 숫자는 파일의 진짜 총 줄 수보다 **383줄(약 25%) 적게** 보고되고, 애초에 정확했던 1차 안내문은 조용히 사라진다. 이는 바로 옆 `_charge_notice` 헬퍼(같은 PR, 같은 파일)가 명시적으로 막으려 한 것과 **같은 부류의 결함**("네 벌 산술이 두 번 어긋난 축", line 561-577 docstring 참고)이지만, 그 리팩터링은 "바이트 예산" 쪽만 단일화했고 "총 줄 수" 파생값은 여전히 가공된 문자열에서 즉석으로 재계산한다.
  - 제안: 1차 truncation 시점에 원본 `total`(원본 파일의 실제 총 줄 수)을 `file_parts[i]` 딕셔너리에 별도 필드(예: `full_content_total_lines`)로 저장해두고, 2차 truncation 에서는 그 값을 그대로 재사용하도록 고친다. "이미 안내문이 붙은 문자열"을 다시 `truncate_to_line_boundary`/`count("\n")` 로 스캔해 총량을 재도출하는 패턴 자체를 제거해야, 이번처럼 겉보기엔 동작하지만 조용히 틀린 숫자를 내보내는 회귀를 막을 수 있다.

- **[WARNING]** `build_files_section` 함수가 약 190줄(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607`~`794`)로 지나치게 길고, 서로 성격이 다른 3가지 경로(예산 무제한 통과 / 헤더+diff 만으로도 예산 초과인 overflow 처리 / 파일별 예산 배분 + 2단계 안내문 회계를 갖는 본 경로, 그 안에 다시 `_render` 중첩 클로저)를 한 함수 안에 담고 있다. 중첩 루프·조건 분기가 여러 겹이라 순환 복잡도가 높고, 위 CRITICAL 같은 버그가 바로 이 함수의 가장 깊은 분기(line 738-757)에 숨어 있었다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607` (`def build_files_section`)
  - 상세: 세 경로(무제한/overflow/예산배분)를 각각 별도 helper 로 분리하면 각 경로를 독립적으로 테스트·추론할 수 있어, "이 truncation 이 어떤 total 을 기준으로 하는가" 같은 질문에 답하기 쉬워진다.
  - 제안: 최소한 "overflow 전용 경로"(line 664-703)와 "예산 배분 경로의 재귀적 truncation 로직"(line 738-759)을 이름 있는 함수로 추출.

- **[WARNING]** 두 orchestrator 사이에 상태-버킷 관리 로직(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_emit_summary_state`/`_apply_status_update`)이 거의 그대로 중복되어 있고, 주석이 "Mirrors X. Change both." 로 수동 동기화를 요구한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:183-374` (총 약 146줄) ↔ `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:87-192` (총 약 103줄, `_apply_status_update` 는 docstring 만 빠졌을 뿐 로직은 동일)
  - 상세: `_reconcile_state_with_disk`/`_apply_status_update` 는 두 파일에서 로직이 사실상 동일(공백·docstring 차이 정도)하다. 두 스크립트는 이미 `lib/session.py`, `_shared/report_paths.py` 등 공유 모듈을 쓰고 있으므로, 이 상태-버킷 로직도 같은 방식으로 `lib/`(또는 `_shared/`) 아래 공유 모듈로 뽑아낼 수 있는 조건이 갖춰져 있다. 지금 구조는 한쪽만 고치고 다른 쪽을 잊는 drift 를 구조적으로 허용한다(코드베이스 자체가 다른 파일들에서 이미 "공유 안 하면 drift 난다"는 교훈을 근거로 `report_paths.py` 를 공유 모듈화한 전례가 있다).
  - 제안: 두 orchestrator 가 공유하는 `lib/retry_state.py`(가칭)로 5개 함수를 이동하고 각 orchestrator 는 `session_dir`/버킷 이름만 넘기도록 좁힌다.

- **[WARNING]** `consistency_orchestrator.py` 의 `_reconcile_state_with_disk` 가 참조하는 `agents_skipped` 키는 이 파일 안 어디에서도 설정되지 않는 죽은 코드(카피-페이스트 잔재)다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:116`
  - 상세: `skipped = set(state.get("agents_skipped", []))` 는 `code_review_orchestrator.py` 쪽 router-skip 개념(`_apply_routing`, line 509 등)을 그대로 옮겨온 흔적인데, consistency-checker 에는 router 도 `_apply_routing` 도 `agents_skipped` 를 채우는 코드도 없다(`prepare_session` 의 `retry_state` 리터럴에도 이 키가 없음, line 862-876 부근). 실행 결과는 항상 빈 집합이라 버그는 아니지만, consistency-checker 의 상태 머신을 그 파일만 보고 이해하려는 사람에게는 "여기 skip 개념이 있나?" 하는 혼란을 준다.
  - 제안: 이 줄을 제거하거나, 왜 남겨두는지(예: 향후 라우터 도입 대비) 주석으로 명시.

- **[WARNING]** 신규 테스트 두 파일이 "fresh interpreter 서브프로세스로 orchestrator 실행" 패턴(`_PREAMBLE` + `run_in_orchestrator`)을 거의 그대로 복붙했고, 그 과정에서 한쪽에만 있는 안전장치(`timeout`)를 다른 쪽에 있다고 잘못 기술한 주석이 생겼다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:56-63` (특히 61-62줄 주석 `"Sibling suites set one too — without it a hang in the target code blocks the run forever instead of failing."`) vs `.claude/tests/test_consistency_context_budget.py:72-79` (`run_in_orchestrator` 의 `subprocess.run` 호출에 `timeout=` 인자 자체가 없음 — 파일 전체에 `"timeout"` 문자열 0회)
  - 상세: 두 파일 모두 "같은 이유로 fresh interpreter 를 쓴다"고 서로의 docstring 에서 언급하며(`test_line_anchors 는 같은 충돌을 같은 방식으로 피한다` 등), `test_consistency_bundle_priority.py` 는 `timeout=30.0` 을 넣으면서 "형제 스위트도 이미 넣었다"고 적었지만, 실제로 확인한 두 후보(`test_consistency_context_budget.py`, `test_line_anchors.py`) 모두 `subprocess.run` 호출에 timeout 이 전혀 없다. 즉 이 두 파일에서 orchestrator 쪽 코드가 hang 하면 테스트가 무한 대기한다 — 주석이 실제로 없는 안전장치를 있다고 서술해, 다음에 이 파일을 보는 사람이 "다른 곳도 이미 되어 있으니 괜찮다"고 오판할 위험이 있다.
  - 제안: 공용 fresh-interpreter 헬퍼(예: 기존 `_harness.py`에 `run_in_fresh_interpreter()` 추가)로 통합하고 `timeout` 을 그 헬퍼 한 곳에 박아, 새 테스트 파일을 추가할 때마다 복붙 여부에 안전장치가 좌우되지 않게 한다. 최소한 `test_consistency_context_budget.py` 에도 동일 `timeout=30.0` 을 추가.

- **[INFO]** `naming_collision` checker 가 여러 코퍼스를 받는다는 특수 규칙이 서로 다른 두 함수에 독립적으로 하드코딩돼 있다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:745` (`_corpus_keys` — 예산 배분 대상 키 목록 결정) 및 `:779-780` (`_checker_corpus` — 실제 코퍼스 문자열 조립)
  - 상세: 두 곳 모두 `if checker_name == "naming_collision":` 로 분기하며 어느 코퍼스 3종(`related_specs`, `plan_in_progress`, `conventions`)을 쓸지 각자 나열한다. 공유 상수/매핑이 없어 향후 다른 checker 가 다중 코퍼스를 받게 되면 두 곳을 동시에 고쳐야 하고, 하나만 고치면 "예산은 배분했는데 실제 프롬프트엔 안 실림"(또는 반대) 형태로 조용히 어긋난다.
  - 제안: `{"naming_collision": ("related_specs", "plan_in_progress", "conventions")}` 형태의 단일 매핑을 두고 두 함수 모두 그것을 참조.

- **[INFO]** git 서브프로세스 호출의 `timeout` 값이 파일 안에서 설명 없이 제각각이고(`10`/`15`/`30`), truncation 포함 여부 판단 임계값도 마법의 숫자다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:938` (`_git` 기본값 `timeout=10`), `:989`/`:1012`/`:1035` (`timeout=30`), `:1045` (`timeout=15`); `:751` (`if available > 200:`)
  - 상세: 이 파일은 다른 곳에서는 매직 넘버를 만나면 상세한 근거 주석(`_GUTTER_OVERHEAD`, `CHECKER_BUDGET_RATIO` 등)을 다는 습관이 있는데, 위 timeout 차등과 `200` 임계값에는 그런 설명이 없다. 왜 어떤 git 호출은 10초, 어떤 건 15초, 어떤 건 30초가 적절한지, 왜 200자 미만이면 잘린 조각도 포기하는지 다음 유지보수자가 추측해야 한다.
  - 제안: 공용 상수(예: `_GIT_TIMEOUT_SEC = 30`) 로 통일하거나, 차등을 유지할 이유가 있다면 그 이유를 주석으로 남긴다.

## 요약

전반적으로 이 변경분은 문서화 밀도가 매우 높고(각 함수·상수마다 "왜"를 설명하는 주석, 실측치 인용), 유사한 실패를 방지하려는 의도가 뚜렷하다. 다만 그 노력에도 불구하고 `build_files_section` 의 2단 truncation 경로에서 "총 줄 수"를 이미 가공된 문자열에서 재도출하는 CRITICAL 결함이 실측으로 확인됐다 — 이번 리뷰 세션 자체의 프롬프트에서 재현되며, 정확했던 1차 안내문을 조용히 틀린 값으로 덮어쓴다. 이는 해당 함수가 너무 길고 여러 책임(무제한/overflow/배분 경로 + 2회의 독립적 truncation)을 한 곳에 몰아넣은 구조적 결과이기도 하다. 그 외에는 두 orchestrator 간 상태-관리 보일러플레이트 중복(수동 동기화 요구), 신규 테스트 파일 간의 안전장치 불일치 + 부정확한 주석, 소소한 매직 넘버·이중 하드코딩 등이 관찰된다 — 모두 지금 당장 기능을 깨지는 않지만 "다음 변경에서 한쪽만 고치고 잊는다" 류의 drift 위험을 안고 있다.

## 위험도

HIGH
