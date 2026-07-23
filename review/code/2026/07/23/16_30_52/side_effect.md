# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 신규 테스트가 서브프로세스로 `code_review_orchestrator.py` 전체를 `runpy.run_path`로 로드함 — 모듈 최상위 코드 실행 여부 확인 필요
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:59-68` (`_all_agents()`)
  - 상세: `runpy.run_path(ORCH)` 는 `run_name` 을 지정하지 않으므로 `__name__` 이 `"__main__"` 이 아닌 `"<run_path>"` 로 설정되어, 대상 스크립트 하단의 `if __name__ == "__main__": main()` 가드는 트리거되지 않는다. `code_review_orchestrator.py` 의 모듈 최상위(줄 1~101, `sys.path.insert`, `ALL_AGENTS` 리스트, `debug_log = session.make_debug_logger(...)` 등)를 직접 확인한 결과 파일 I/O·네트워크 호출·env 변경은 없고 `sys.path` 삽입과 클로저 생성만 발생한다 — 둘 다 해당 서브프로세스 내부에 격리되어 실제 부작용은 없음. 다만 향후 orchestrator 상단에 부작용 있는 코드(예: 로그 파일 즉시 open, config 파일 write)가 추가되면 이 테스트가 매 실행마다 그 부작용을 트리거하게 되므로 잠재적 회귀 지점으로 기록해 둔다.
  - 제안: 현재는 문제 없음(검증 완료). 다만 이 위험을 테스트 docstring 이나 orchestrator 상단 주석에 "이 파일은 `runpy.run_path`로 임포트되므로 모듈 최상위에 부작용을 두지 말 것" 이라고 한 줄 남겨두면 향후 회귀를 막을 수 있음(선택 사항, 필수 아님).

- **[INFO]** `subprocess.run(..., cwd=str(REPO_ROOT))` 두 곳이 매 테스트 실행마다 별도 파이썬 인터프리터를 기동
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` `_router_safety_values()` 및 `_all_agents()`
  - 상세: 리포지토리 외부 네트워크 호출이나 영속적 부작용은 없음(순수 계산 후 JSON 출력). docstring 에 근거(두 `_lib` 패키지 이름 충돌로 in-process import 불가)가 명시되어 있어 의도된 격리이며, 기존 `test_router_decision_trust.py` 등 동일 스킬 내 다른 테스트와 같은 패턴이다.
  - 제안: 없음(정보성 기록).

- **[NONE]** `router_safety.py`, `.claude/tests/README.md` 변경은 docstring/표 텍스트만 수정 — 실행 로직·시그니처·전역 상태 변경 없음
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py:36` (표의 "24 extensions" → "44 extensions" 텍스트 수정), `.claude/tests/README.md:37` (신규 테스트 설명 행 추가)
  - 상세: 두 변경 모두 `_SOURCE_CODE_EXTENSIONS`(44개, 코드는 원래부터 44였음)와 문서 숫자 간의 불일치를 바로잡는 순수 문서 정정이다. 함수 시그니처·공개 API·환경 변수·네트워크 호출·전역 변수 어디에도 영향 없음.
  - 제안: 없음.

## 요약

이번 변경은 (1) `router_safety.py` 문서용 표의 숫자 오기(24→44) 정정, (2) `.claude/tests/README.md` 표에 신규 테스트 설명 행 추가, (3) 그 불일치를 회귀 방지하는 신규 테스트 `test_router_safety_policy_doc.py` 추가로 구성된 순수 문서/테스트 인프라 커밋이다. 실제 런타임 로직(`compute_forced_agents`, `_RULES`, `_SOURCE_CODE_EXTENSIONS` 등)은 전혀 수정되지 않았고, 함수 시그니처·공개 인터페이스·전역 변수·환경 변수·네트워크 호출 어디에도 변화가 없다. 신규 테스트가 서브프로세스로 `router_safety` 모듈과 `code_review_orchestrator.py` 를 실행하지만, 두 경우 모두 대상 모듈 최상위 코드를 직접 확인해 파일시스템/네트워크 부작용이 없음을 검증했고 `runpy.run_path` 가 `__main__` 가드를 우회하지 않는다는 점도 확인했다. 전반적으로 부작용 관점의 리스크는 사실상 없다.

## 위험도
NONE
