# 보안(Security) 리뷰 결과

## 대상 변경 개요

`code-review-agents` 하네스(router_safety.py, code_review_orchestrator.py, ai-review.js)와 그 테스트에 대한 변경으로, 라우터(LLM)가 강제 포함(forced) 리뷰어를 `selected=false`로 반환하거나 결정에서 누락시키는 경우 해당 라우팅 결정 전체를 폐기하고 전체 리뷰어를 실행하도록 하는 신뢰성(trust) 가드를 추가한다. 애플리케이션 런타임 코드(`codebase/**`)가 아니라 개발 워크플로 내부의 CI/에이전트 오케스트레이션 스크립트다.

## 발견사항

- **[INFO]** 이번 변경은 그 자체로 보안 하드닝 성격의 커밋 — 부정적 발견 아님
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_routing_distrust_reason` 함수, `.claude/workflows/ai-review.js` `routingDistrustReason` 함수
  - 상세: 라우터(LLM)가 (프롬프트 인젝션·모델 혼동 등으로) `security` 등 강제 리뷰어를 임의로 비활성화해도, 그 결정이 계약 위반으로 감지되어 전량 실행으로 폴백한다. 즉 "AI 리뷰 파이프라인이 스스로의 보안 게이트를 우회당하지 않도록" 만드는 방어 코드다.
  - 제안: 없음(긍정적 발견이므로 유지 권장).

- **[INFO]** subprocess 호출은 전부 배열 인자 형태(`shell=True` 미사용)
  - 위치: `.claude/tests/test_router_decision_trust.py` `_run`, `_prepare_over`, `test_both_paths_agree_on_a_matrix_of_decisions`; `.claude/tests/test_line_anchors.py` `_git`, `_run_prepare`; `.claude/tests/test_orchestrator_state.py` `_run`
  - 상세: `test_both_paths_agree_on_a_matrix_of_decisions`가 `subprocess.run([sys.executable, "-c", f"...{decisions!r}..."])` 및 `["node", "-e", f"...{json.dumps(decisions)}..."]` 형태로 테스트 데이터를 문자열 보간해 넘긴다. 이 데이터는 테스트 내부에 하드코딩된 고정 매트릭스(`cases = [(["a","b","c"], ["a"], []), ...]`)이며 외부 입력이 아니고, Python `repr()`/`json.dumps()`로 이스케이프되어 `-c`/`-e` 스크립트에 삽입되므로 임의 코드 실행 위험은 없다. 다만 향후 이 패턴(문자열 보간으로 서브프로세스 스크립트 생성)이 외부/사용자 유래 데이터로 확장될 경우 코드 인젝션 벡터가 될 수 있어, 재사용 시 데이터 출처가 고정 테스트 매트릭스로 한정됨을 유지해야 한다.
  - 제안: 현재로선 조치 불요. 향후 이 헬퍼를 실제 라우터 응답(모델이 생성한 `name`/`selected` 등 자유 문자열) 검증용으로 재사용할 경우, `repr()`/`json.dumps()` 이스케이프에만 의존하지 말고 값의 문자 집합을 화이트리스트로 제한하거나 별도 파일로 데이터를 전달하는 방식으로 바꿀 것.

- **[INFO]** 파일 경로 분류기(`_is_source_file`/`source_files`)는 실제 파일 접근이 아니라 확장자 문자열 매칭에만 사용
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py:308-325` (`_is_source_file`, `source_files`)
  - 상세: `git diff`에서 수집된 상대 경로 문자열에 대해 `os.path.splitext`/`fnmatch`만 수행하고 이 경로들로 실제 파일을 열거나 쓰지 않으므로, 경로 탐색(path traversal)이나 임의 파일 접근으로 이어지는 표면이 없다.
  - 제안: 없음.

- **[INFO]** 신규 JSON 스키마(`ROUTING_SCHEMA`)는 `additionalProperties: true`로 관대함
  - 위치: `.claude/workflows/ai-review.js` `ROUTING_SCHEMA` (변경 파일 내 기존 정의, 이번 diff로 신규 도입된 것은 아니나 `routingDistrustReason`이 그 출력을 그대로 소비)
  - 상세: 라우터가 반환하는 `decisions[].name`에 임의 문자열이 허용되며, `routingDistrustReason`은 `forcedSet.has(d.name)` 비교만 하므로 위조된 이름이 있어도 잘못된 리뷰어를 실행시키는 정도이지 코드 실행이나 권한 상승으로 이어지지 않는다.
  - 제안: 조치 불요 (기능적 엄격성 문제일 뿐 보안 취약점 아님).

## 점검했으나 해당 없음/문제 없음

- 인젝션(SQL/XSS/커맨드/LDAP/경로탐색): 대상 코드는 DB·웹·쉘 호출이 없고, 서브프로세스는 전부 리스트 인자 형태. 해당 사항 없음.
- 하드코딩된 시크릿: 발견 없음.
- 인증/인가: 이 변경은 하네스 내부 리뷰 라우팅 로직으로, 사용자 인증/세션과 무관. 다만 "라우터의 강제 규칙 우회를 신뢰하지 않는다"는 점에서 인가(authorization)와 유사한 방어적 성격을 가지며, 오히려 강화됨(위 INFO 참고).
- 입력 검증: 라우터 응답은 JSON 스키마로 최소 형태 검증됨(`required: ['decisions']`, `required: ['name','selected']`).
- 암호화: 해당 코드 경로 없음.
- 에러 처리: 에러/로그 메시지(`log(...)`, `routing_skip_reason` 등)에 리뷰어 이름·상태만 포함되고 비밀값·토큰·경로 외 민감정보 노출 없음.
- 의존성 보안: 신규 서드파티 의존성 추가 없음(표준 라이브러리만 사용, 테스트 컨벤션과 일치).

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 AI 코드 리뷰 하네스의 라우팅 신뢰성 로직이며, 인젝션·시크릿·인가·암호화 등 전통적 보안 취약점 표면이 사실상 없다. 오히려 라우터(LLM)가 강제 리뷰어(특히 `security`)를 부당하게 배제하는 것을 계약 위반으로 감지해 전체 실행으로 폴백시키는 방어적 하드닝으로, 리뷰 파이프라인 자체의 신뢰성/무결성을 높인다. Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
