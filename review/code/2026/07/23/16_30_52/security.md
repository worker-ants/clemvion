### 발견사항

이번 변경분(`router_safety.py` 정책 매트릭스 docstring 오탈자 수정 24→44, `README.md` 문서 표 갱신, 신규 테스트 `test_router_safety_policy_doc.py`)은 harness 자체 도구(`.claude/`) 영역이며 `codebase/` 제품 코드가 아니다. 사용자 입력·네트워크 경계·인증/인가·DB 접근이 관여하지 않는 순수 내부 dev-tooling/문서/테스트 변경이라 보안 관점에서 유의미한 취약점은 발견되지 않았다.

- **[INFO]** `subprocess.run` 을 통한 동적 파이썬 스크립트 실행 — 프로세스 격리 방식 검토
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` 함수 `_router_safety_values`(파일 게이트 39~56행), `_all_agents`(파일 게이트 59~68행)
  - 상세: `str(SKILL_DIR)!r` / `str(ORCH)!r` 형태로 경로를 repr 이스케이프해 `-c` 스크립트 문자열에 삽입한 뒤 `subprocess.run([sys.executable, "-c", script], ...)` (shell=True 아님, 리스트 인자)로 실행한다. `runpy.run_path(ORCH)` 는 `code_review_orchestrator.py` 의 모듈 최상위 코드를 그대로 실행한다. 두 값(`SKILL_DIR`, `ORCH`) 모두 `REPO_ROOT`(harness 자신이 계산하는 로컬 경로)에서 파생되며 외부/사용자 입력이 아니므로 인젝션 표면은 없다. shell 미사용이라 커맨드 인젝션 우려도 없다. 다만 테스트가 대상 모듈의 최상위 코드를 부작용째로 실행하는 패턴이므로, 향후 `router_safety.py`/`code_review_orchestrator.py` 최상위에 부작용 있는 코드가 추가되면 테스트 실행 시 그대로 함께 실행된다는 점만 인지해두면 된다(리포지토리 내 기존 `test_router_decision_trust.py` 도 동일 패턴 사용, README §Conventions 에 문서화됨).
  - 제안: 현 상태로 문제 없음. 별도 조치 불요 — 참고용 기록.

- **[INFO]** 에러 메시지에 하위 프로세스 stderr 노출
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` — `_router_safety_values`/`_all_agents` 의 `raise AssertionError(f"... {r.stderr[-1500:]}")`
  - 상세: 실패 시 stderr 최대 1500자를 그대로 assertion 메시지에 포함한다. 로컬 개발자 대상 테스트 실패 로그이며 외부 사용자에게 노출되는 경로가 아니고, 시크릿을 다루는 경로도 아니라 실질 위험은 없다.
  - 제안: 조치 불요.

- 그 외 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가, 암호화, 의존성 관련 발견사항 없음. `router_safety.py` 의 diff 는 docstring 표의 숫자(24→44)만 수정한 것으로 실제 `_SOURCE_CODE_EXTENSIONS`(이미 44개) 상수·로직에는 변화가 없어 라우팅 정책의 실동작(예: `security` 리뷰어가 모든 소스 코드 변경에 강제 포함되는 규칙)에 영향이 없다. `README.md` 변경은 표에 테스트 파일 설명 행 추가일 뿐이다.

### 요약
이번 diff 는 코드 리뷰 harness 내부의 정책 문서-코드 drift(24 vs 44)를 바로잡는 docstring/문서 수정과, 그 drift 재발을 막는 신규 자기검증 테스트 추가로 구성된다. 제품 코드(`codebase/`)나 외부 입력 경계를 건드리지 않으며, 신규 테스트의 `subprocess`/`runpy` 사용은 shell 미사용 + 신뢰 가능한 로컬 경로만 다뤄 인젝션 표면이 없다. 시크릿 하드코딩, 인증/인가 로직 변경, 암호화 관련 변경도 없다.

### 위험도
NONE
