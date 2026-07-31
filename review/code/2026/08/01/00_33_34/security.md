# Security Review

## 발견사항

- **[INFO]** `retry_state.save_state()` 의 원자적 쓰기(temp file + `os.replace`)가 심볼릭 링크 선점(symlink pre-planting)에 안전하지 않음
  - 위치: `.claude/_shared/retry_state.py:65-69` (`tmp = f"{state_file}.tmp.{os.getpid()}"` ~ `os.replace(tmp, state_file)`)
  - 상세: `open(tmp, "w", ...)` 은 `O_EXCL`/`os.O_NOFOLLOW` 없이 열리므로, 동일 디렉터리에 쓰기 권한을 가진 다른 로컬 프로세스/사용자가 그 경로(파일명은 `state_file` + `.tmp.` + PID 로 결정적)에 미리 심볼릭 링크를 심어두면 JSON 내용이 심볼릭 링크가 가리키는 임의 파일에 쓰이고, 뒤이은 `os.replace(tmp, state_file)` 이 그 심볼릭 링크 자체를 `state_file` 위치로 옮겨 이후 읽기/쓰기도 계속 그 타깃을 향하게 만든다(CWE-59/CWE-377 계열). 다만 이 저장소의 위협 모델상 실질 위험은 낮다 — `.claude/` 하네스는 단일 사용자 로컬 개발 도구이고, 이 공격이 성립하려면 공격자가 이미 같은 리포지토리 디렉터리에 쓰기 권한을 가져야 하는데 그 경우 `_retry_state.json` 을 직접 조작하는 것이 더 쉬우므로 새로운 권한 경계를 넘는 것은 아니다. 참고로 이전 코드(`open(state_file, "w")` 직접 쓰기)도 동일한 심볼릭 링크 추종 특성을 이미 갖고 있었으므로 이번 PR 이 새로 만든 노출면이 아니라, 원자성 개선 과정에서 같은 패턴이 임시 경로 하나에 더 얹힌 것뿐이다.
  - 제안: 실사용 위험은 낮지만 심층방어 차원에서 `tempfile.mkstemp(dir=os.path.dirname(state_file))` 로 교체하면 배타적 생성(O_EXCL, 0600 권한)이 보장된다. 지금 당장 막을 필요는 없음(정보성).

- **[INFO]** 신설된 "하향 금지" 기계적 backstop 은 설계상 경고 전용 — 판정을 바꾸지 않음
  - 위치: `.claude/_shared/block_integrity.py:22-26` (docstring "Why it warns instead of blocking"), `.claude/hooks/_lib/review_guard.py:756-759`(`notes.append(...)`) 및 `:964-998`(`ReviewDecision` 생성 시 `blocked` 은 그대로, `notes` 만 추가)
  - 상세: `consistency-summary.md` §요약 지침 3 이 금지하는 "checker `[CRITICAL]` → SUMMARY `BLOCK: NO` 하향"이 실제로 재발해도, 이번 backstop 은 `push`/`Stop` 훅의 stdout/stderr 에 경고 문구만 얹을 뿐 `blocked` 값 자체는 바꾸지 않는다. 즉 모델이나 사람이 그 경고를 무시하면 하향된 세션은 여전히 게이트를 통과한다. 이는 코드 결함이 아니라 문서화된 의도적 트레이드오프이며(정당하게 중복 병합·등급 상향이 있을 수 있어 하드 블록은 과잉 차단이라는 근거가 docstring 에 명시됨), 오히려 기존에 전혀 없던 가시성을 추가한 보안-긍정적 변경이다. 다만 "리뷰 파이프라인 자체의 무결성"이라는 관점에서 잔여 위험(경고 묵살 시 우회 지속)을 명시적으로 남긴다는 점은 기록해 둘 가치가 있다.
  - 제안: 조치 불요(의도된 설계). 향후 이 경고가 실제로 몇 번 무시되는지 계측되면 하드 블록으로 승격할지 재검토할 근거가 된다.

이 외 아래 항목은 조사했으나 문제 없음(발견 없음):
- **인젝션**: 신규/변경 코드의 `subprocess` 호출은 전부 리스트 인자 + `shell=True` 미사용이라 커맨드 인젝션 경로 없음. SQL/LDAP/XSS 는 해당 코드 경로에 없음(웹 요청·DB 접근 없는 로컬 CLI/훅). 마커 파일명 생성(`_sanitize_component`, 이번 diff 로 변경되지 않음)은 `/` 를 제거해 경로 탈출을 이미 차단.
- **하드코딩 시크릿**: `api_key`/`password`/`token=`/PEM 헤더/AWS 키 패턴 등 grep 결과 없음. 유일하게 매칭된 `token` 은 git branch 식별자를 담는 변수명일 뿐 인증 토큰이 아님.
- **인증/인가**: 해당 코드는 로컬 git hook·orchestrator 스크립트로 별도 인증/세션 개념이 없음. `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 우회는 이번 diff 로 변경되지 않은 기존 설계(문서화된 로컬 개발자 전용 escape hatch)라 이번 리뷰 범위 밖.
- **입력 검증**: 새 정규식(`_CRITICAL_TAG`, `_BLOCK_AT_LINE_START/END`)은 리터럴/문자클래스 반복만 사용해 ReDoS 형태의 backtracking 폭발 소지 없음. 신규 모듈들이 파일을 읽는 경로(`session_dir`, checker 리포트 파일명)는 전부 고정 상수(`ALL_CHECKERS`/`CHECKER_REPORTS`)거나 호출자가 스스로 지정하는 로컬 경로로, 외부(원격) 사용자 입력이 개입하지 않음.
- **암호화**: 이번 diff 에 해시/암호화 관련 코드 없음(`hashlib.md5`/`sha1` 등 취약 알고리즘 신규 사용 없음).
- **에러 처리**: 예외는 전부 로컬 stderr 로만 노출되고(`traceback.print_exc(file=sys.stderr)`), 네트워크로 전달되지 않음. 오히려 이번 PR 의 핵심 취지가 "실패를 조용히 삼키지 않고 드러내기"라 기존보다 관측성이 개선됨.
- **의존성 보안**: 신규 서드파티 의존성 추가 없음(`.claude/tests/README.md` 에 명시된 대로 표준 라이브러리만 사용하는 하네스 관례 유지).

## 요약

이번 변경은 code-review/consistency-checker/merge-coordinator 세 orchestrator 가 각각 들고 있던 `_retry_state.json` bookkeeping 5개 함수를 `.claude/_shared/retry_state.py` 로 통합하고, "SUMMARY 가 `BLOCK: NO` 인데 checker 가 `[CRITICAL]` 을 남긴" 하향 사례를 기계적으로 감지해 push/Stop 훅에 경고를 노출하는 `block_integrity.py` backstop 을 신설한 리팩터링 + 관측성 개선 PR이다. 순수 로컬 개발 하네스 코드(웹 요청·DB·인증 세션이 없는 git hook/CLI)이며, 신규 `subprocess` 호출은 전부 리스트 인자 방식이라 커맨드 인젝션 경로가 없고, 하드코딩된 시크릿·안전하지 않은 암호화·신규 서드파티 의존성도 발견되지 않았다. 유일하게 기록해 둘 값어치가 있는 것은 (1) `retry_state.save_state()` 의 임시파일 원자적 쓰기가 교과서적 심볼릭 링크 경합 패턴을 갖고 있으나 이 도구의 단일 사용자 위협 모델에서 실익이 없다는 점, (2) 신설된 하향 감지 backstop 이 설계상 "경고만" 하고 판정을 바꾸지 않아 경고가 무시되면 우회가 계속 가능하다는 점 — 둘 다 코드 결함이 아니라 문서화된 의도적 설계이므로 정보성으로만 남긴다. 전반적으로 이번 diff 는 보안 관점에서 중립적이며, 오히려 이전까지 조용히 통과되던 리뷰-하향 사례를 가시화한다는 점에서 리뷰 파이프라인 무결성에 소폭 긍정적이다.

## 위험도

LOW
