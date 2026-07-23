### 발견사항

이번 changeset 은 code-review-agents harness 자체(`.claude/`) 의 정책 문서-코드 drift(소스 확장자 개수 "24"→실제 "44") 정정과, 그 drift 재발을 막는 신규 회귀 가드 테스트(`test_router_safety_policy_doc.py`) 추가, 그리고 그 발견 과정의 이전 리뷰 세션 산출물(`review/code/2026/07/23/16_30_52/*`) 커밋으로 구성된다. `codebase/` 제품 코드, 사용자 입력 경계, 인증/인가, DB, 네트워크 전송이 전혀 관여하지 않는 순수 내부 dev-tooling/문서/테스트 변경이다.

- **[INFO]** `subprocess.run([sys.executable, "-c", script], ...)` 로 정책 상수를 별도 인터프리터에서 조회
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` 함수 `_router_safety_values`(파일 게이트 46~65행), `_all_agents`(파일 게이트 68~77행)
  - 상세: `f"sys.path.insert(0, {str(SKILL_DIR)!r})"` 형태로 `repr()` 이스케이프한 로컬 경로를 `-c` 스크립트 문자열에 삽입해 실행한다. `shell=True` 가 아니고 인자가 리스트로 전달되므로 셸 인젝션 표면은 없으며, 삽입되는 값(`SKILL_DIR`, `SKILL_DIR.parent`, `ORCH`)은 모두 harness 자신이 계산하는 `REPO_ROOT` 파생 로컬 경로로 외부/사용자 입력이 아니다. `_all_agents()` 의 `runpy.run_path(ORCH)` 역시 `code_review_orchestrator.py` 의 모듈 최상위 코드를 그대로 실행하는 패턴이나 동일하게 로컬 신뢰 경로 범위 내다. 기존 `test_router_decision_trust.py` 와 동일한 확립된 패턴.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** 서브프로세스 실패 시 stderr 최대 1500자를 assertion 메시지에 그대로 노출
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` — `_router_safety_values`/`_all_agents` 의 `raise AssertionError(f"... {r.stderr[-1500:]}")`
  - 상세: 로컬 개발자 대상 테스트 실패 로그이며 외부 사용자 노출 경로가 아니고, 시크릿을 다루는 경로도 아니라 실질 위험은 없다.
  - 제안: 조치 불요.

- 그 외 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 민감정보 에러 노출, 취약 의존성 도입 등 OWASP Top 10 관련 발견사항 없음. `router_safety.py`/`README.md` diff 는 docstring·표의 숫자(24→44) 및 테스트 파일 설명 행 추가뿐으로, 실제 `_SOURCE_CODE_EXTENSIONS` 상수·라우팅 로직(예: `security` 리뷰어가 모든 소스 코드 변경에 강제 포함되는 규칙)에는 변화가 없다. 커밋되는 리뷰 세션 산출물(`review/code/.../16_30_52/*`)도 텍스트 보고서·JSON 메타데이터일 뿐 시크릿·자격증명 포함 없음을 확인했다.

### 요약
이번 diff 는 code-review-agents harness 내부의 정책 문서-코드 drift(24 vs 44)를 바로잡는 문서/docstring 수정과, 그 drift 재발을 막는 신규 자기검증 테스트(`test_router_safety_policy_doc.py`) 추가, 그리고 관련 이전 리뷰 세션 아카이브 커밋으로 구성된다. 제품 코드나 외부 입력 경계를 건드리지 않으며, 신규 테스트의 `subprocess`/`runpy` 사용은 `shell=True` 미사용 + 전량 로컬 신뢰 경로만 다뤄 인젝션 표면이 없다. 시크릿 하드코딩, 인증/인가 로직 변경, 암호화 관련 변경도 발견되지 않았다. 이는 동일 changeset 을 검토한 이전 세션(`review/code/2026/07/23/16_30_52/security.md`)의 NONE 판정과도 일치한다.

### 위험도
NONE
