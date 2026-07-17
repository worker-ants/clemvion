# Security Review — report-paths-shared

## 발견사항

- **[WARNING]** `report_paths.has_report()`가 대상 경로가 "일반 파일"인지 검증하지 않고 `os.path.getsize() > 0` 만으로 "리포트 존재"를 판정 — 디렉터리를 리포트로 오판할 수 있어, 이 모듈 자신이 막으려는 "looks done, isn't"(`touch security.md`) 문제와 같은 모양의 게이트 우회를 재도입한다.
  - 위치: `.claude/_shared/report_paths.py` `report_path()`(115-129행) / `has_report()`(144-149행). 이 결함은 세 소비처 전부에 전파됨 — `.claude/hooks/_lib/review_guard.py::_forced_coverage_missing`(push/stop 게이트), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py::_reconcile_state_with_disk`/`_verify_coverage`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py::_reconcile_state_with_disk`.
  - 상세: `report_path()`는 `output_file`(또는 `f"{name}.md"` 폴백)에 `os.path.basename()`을 적용해 일반적인 `../../etc/passwd` 류 경로 탈출은 올바르게 막는다. 그러나 `os.path.basename()`은 값이 `/`로 끝나면 빈 문자열을, `..`로 끝나거나 정확히 `..`이면 `".."`를 그대로 반환한다 — 두 경우 모두 `os.path.join(session_dir, ...)` 결과가 **파일이 아니라 디렉터리**(세션 디렉터리 자신, 또는 그 부모)가 된다. 실측(코드 실행, macOS):
    ```
    output_file="/some/where/"   → basename("")   → 경로=session_dir 자신     → has_report=True
    output_file="/some/where/.." → basename("..")  → 경로=session_dir 의 부모  → has_report=True, missing_reports=[]
    ```
    디렉터리의 `os.path.getsize()`는 대부분의 POSIX 파일시스템에서 0이 아니며(로컬 실측 64~96 bytes), `os.path.isfile()`은 정확히 `False`를 반환한다. 즉 실제 리포트 파일이 전혀 없어도 커버리지가 "충족"으로 판정된다.
    이는 **회귀(regression)** 이기도 하다: 리팩터 이전 `code_review_orchestrator.py`의 `_reconcile_state_with_disk`/`_verify_coverage`는 `os.path.isfile(outputs[n])`을 사용해 이 케이스를 정상적으로 걸러냈다(디렉터리는 `isfile()=False`). 공유 모듈로 위임하면서 그 `isfile()` 체크가 사라졌고, 세 소비처 모두 `review_guard.py`가 리팩터 이전부터 갖고 있던(가장 취약했던) `getsize()`-only 판정을 그대로 물려받았다 — "가드와 CLI가 같은 답을 내도록" 통일하는 과정에서 더 안전했던 쪽(`isfile()` 사용) 대신 더 약한 쪽(`getsize()`-only)으로 수렴한 셈이다. `.claude/tests/test_report_paths_shared.py`의 `AgreementTest`도 trailing `/`·`..` 케이스는 다루지 않아 이 회귀를 잡지 못한다.
    실제 악용 난이도는 낮지 않다: `_retry_state.json`의 `output_file`을 직접 조작할 수 있는 행위자는 이미 그 자리에 그럴듯한 비어있지 않은 `<name>.md` 파일을 직접 써넣는 더 간단한 방법으로 동일한 결과(게이트 통과)를 얻을 수 있다. 또한 정상 오케스트레이터 플로우에서 `output_file`은 항상 고정된 checker/reviewer 이름 + `.md` 로만 생성되므로 이 경로에 자연 발생적으로 도달하지 않는다 — 손상되었거나 수기로 편집된 `_retry_state.json`, 혹은 향후 다른 호출자가 실수로 디렉터리 경로를 `output_file`에 넣는 버그를 통해서만 발현된다. 다만 이 모듈의 명시된 존재 이유가 정확히 "존재 + 비어있지 않음을 위조 불가능하게 판정"하는 것이므로, 그 계약을 깨는 이 gap 은 의도된 리뷰 관점(인증/인가·게이트 무결성)에 해당한다.
  - 제안: `has_report()`를 `return os.path.isfile(p) and os.path.getsize(p) > 0`로 강화. 추가로 `report_path()`에서 `os.path.basename(recorded)`가 빈 문자열이거나 `"."`/`".."`이면 안전한 폴백(`f"{name}.md"`)으로 대체하는 방어도 고려. `test_report_paths_shared.py`에 trailing `/`·`..` 값을 가진 `output_file` 회귀 테스트 추가 권장.

- **[INFO]** 세 스크립트가 `sys.path.insert(0, _CLAUDE_DIR)`로 `.claude/` 최상위를 모듈 검색 경로 맨 앞에 추가한다.
  - 위치: `.claude/hooks/_lib/review_guard.py:281-283`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:676`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:771`
  - 상세: 이론상 `.claude/` 아래에 쓰기 권한이 있는 누구나 sys.path 상의 다른 이름(`_shared` 등)과 충돌하는 모듈을 배치해 shadowing할 여지가 있으나, 이는 같은 파일들이 이미 갖고 있던 `sys.path.insert(0, _SKILL_DIR)` / `_SKILLS_DIR` 패턴과 동일한 성격이라 이번 변경이 새로 여는 위협면은 아니다. 로컬 신뢰된 체크아웃에서만 동작하는 개발 하네스이므로 원격/비인가 공격자에게 노출되는 표면도 아니다.
  - 제안: 조치 불필요 — 참고용 기록.

- **[INFO]** `review_guard.py`의 `from _shared import report_paths` import를 의도적으로 try/except로 감싸지 않고 "실패 시 크게 터뜨림(fail loudly)"으로 설계한 점은 긍정적 보안 설계다. 이 모듈의 나머지 로직은 "내부 오류 시 fail-open(차단하지 않음)"을 원칙으로 삼는데(문서화된 정책), 이 특정 import만은 그 원칙에서 의도적으로 벗어나야 함을 정확히 인지하고 주석으로 근거를 남겼다 — silent import failure가 커버리지 게이트를 전부 통과시키는 fail-open으로 이어지는 것을 방지한다. 조치 불필요, 좋은 패턴으로 기록.

- 그 외 확인 결과: 하드코딩된 시크릿(API 키/비밀번호/토큰) 없음. SQL/커맨드/LDAP 인젝션 없음 — `subprocess.run`은 전부 리스트 인자(`shell=True` 미사용)로 호출됨(예: `_run_git`, `test_report_paths_shared.py`의 `_cli_blocks`). 인증/인가 로직 자체(세션 관리, 로그인 등)는 이 diff에 포함되지 않음. 안전하지 않은 암호화/해시 사용 없음. 에러 메시지를 통한 민감정보 노출 없음(`OSError`를 조용히 `False`로 처리, 스택트레이스 미노출). 의존성 추가/버전 변경 없음. 프론트엔드 테스트 파일(`sidebar-nav-href.test.tsx`, `sidebar-test-utils.tsx`, `sidebar.test.tsx`) 변경은 테스트 전용 mock 헬퍼 추출(`stubMatchMedia`/`createWrapper`/`renderSidebar` 공유화)로 런타임 코드·보안에 영향 없음. `plan/**` 문서 이동/작성은 코드가 아님.

## 요약

이번 변경은 review/consistency 게이트와 오케스트레이터 CLI가 "리포트가 실제로 존재하는가"를 판정하는 로직을 `.claude/_shared/report_paths.py`로 단일화하는 리팩터다. 경로 조합에 항상 `os.path.basename()`을 적용해 `output_file` 필드를 통한 일반적인 디렉터리 탈출(`../../etc/passwd` 류 임의 경로 지정)은 올바르게 차단한다. 다만 `basename()`이 `/`로 끝나는 값이나 `..`는 그대로 통과시키는 특수 케이스가 있고, `has_report()`가 `isfile()` 없이 `getsize() > 0`만으로 판정하기 때문에 세션 디렉터리 자신이나 그 상위 디렉터리를 "리포트 있음"으로 오판할 수 있음을 실행 검증으로 확인했다. 이는 특히 이 리팩터로 인해 기존에 `isfile()`을 쓰던 `code_review_orchestrator.py`/`consistency_orchestrator.py` 두 곳에서 안전하던 체크가 약화되는 회귀이며, 신규 테스트(`AgreementTest`)도 이 edge case는 커버하지 않는다. 다만 트리거하려면 오케스트레이터가 정상적으로 생성하지 않는 형태의 `output_file` 값이 `_retry_state.json`에 있어야 하고, 그 정도 접근권을 가진 행위자는 더 간단한 우회(직접 비어있지 않은 리포트 파일 작성)가 이미 가능해 실질적 악용 매력도는 낮다. 그 외 하드코딩 시크릿, 인젝션, 인증/인가 우회, 암호화, 에러 노출, 의존성 취약점은 발견되지 않았고, `sys.path` 조작은 기존 패턴과 일관되며 신규 위험을 추가하지 않는다. 전반적으로 로컬 신뢰 환경에서만 동작하는 내부 개발 하네스 코드로 위협 표면이 좁고, 발견된 문제도 게이트의 정확성/방어심층 결함 수준이라 즉각적인 심각 위험은 아니지만, 이 모듈의 존재 이유(게이트 무결성 통일)를 정면으로 훼손하는 재현 가능한 결함이므로 수정을 권고한다.

## 위험도
LOW
