# 보안(Security) 코드 리뷰

## 리뷰 대상

- `.claude/tests/README.md` (문서, 테이블 행 추가)
- `.claude/tests/test_mermaid_lint_ready.py` (신규 테스트 클래스 `PostToolUseImportFailOpenTest`)
- `.claude/tests/test_tests_readme_catalog.py` (신규 파일 — README 카탈로그 drift 가드)
- `plan/in-progress/harness-guard-followups.md` (plan 문서, 체크박스/서술 갱신)

네 파일 모두 하네스 자체의 **테스트/문서** 변경이며, 프로덕션 코드(`codebase/`)나 외부 사용자 입력을 다루는
경로가 아니다. 실행 경로는 로컬 개발자 워크스테이션에서 `python3 -m unittest`로만 트리거되고, 네트워크·DB·
인증 경계를 넘지 않는다. 이 전제로 각 관점을 점검했다.

### 발견사항

- **[INFO]** 서브프로세스 호출은 전부 리스트 인자 + `shell=True` 미사용
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` L399-402 (`subprocess.run([sys.executable, self.hook], ...)`), L663-666 (동일 패턴 재사용)
  - 상세: 신규 `PostToolUseImportFailOpenTest`가 실행하는 `subprocess.run`은 모두 인자 리스트 형태이고 `shell=` 옵션을 쓰지 않는다. 커맨드 인젝션 표면이 없다. `env` 딕셔너리에 주입되는 값(`MERMAID_LINT_TOOL_DIR`, `NODE_CALL_LOG`, `NODE_EXIT_CODE`)도 전부 테스트 자신이 생성한 `tempfile.mkdtemp()` 경로/상수이며 외부·사용자 입력이 아니다.
  - 제안: 없음 (현행 패턴 유지 권장).

- **[INFO]** 임시 파일/디렉토리 처리가 안전한 stdlib 패턴을 따름
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` L357-359 (`setUp` — `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ..., ignore_errors=True)`)
  - 상세: `tempfile.mkdtemp()`는 예측 불가능한 이름 + 소유자 전용 권한(0o700)으로 생성되어 심볼릭 링크·경쟁 공격에 안전하다. 픽스처가 쓰는 "깨진 헬퍼" 소스 문자열(`_BROKEN_LIB`, L355: `"raise RuntimeError('simulated mermaid_lint_ready import failure')\n"`)은 고정 리터럴이며 외부 입력을 파일에 그대로 써넣는 구조가 아니어서 임의 코드 주입 경로가 아니다.
  - 제안: 없음.

- **[INFO]** 새 테스트가 의도적으로 traceback을 stderr에 노출시키는 assertion
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` L419-423 (`self.assertIn("Traceback", r.stderr, ...)`)
  - 상세: "삼킨 import 오류가 조용히 죽지 않아야 한다"는 의도로 stderr에 Python traceback이 남는지 단언한다. 이 훅(`lint_mermaid_posttooluse.py`)은 Claude Code PostToolUse 훅으로 개발자 로컬 세션에서만 실행되며, 원격 사용자나 CI 아티팩트로 노출되는 에러 채널이 아니다. 따라서 "에러 메시지의 민감 정보 노출" 관점에서 실질 위험은 없다 — 다만 향후 이 훅이 CI 로그나 공유 아티팩트에 stderr를 그대로 적재하도록 바뀐다면 재검토 대상이다.
  - 제안: 현재는 조치 불필요. 훅의 실행 컨텍스트가 바뀌면 재평가.

- **[INFO]** README 카탈로그 파서(`test_tests_readme_catalog.py`)의 정규식은 ReDoS 표면이 없음
  - 위치: `.claude/tests/test_tests_readme_catalog.py` L29 (`_ROW = re.compile(r"^\|\s*`(test_[a-z0-9_]+\.py)`\s*\|", re.M)`)
  - 상세: 신뢰 가능한 저장소 자체 파일(`README.md`)만 입력으로 받고, 패턴 자체도 중첩 수량자·재앙적 백트래킹 구조가 없는 단순 문자 클래스 반복이라 ReDoS 우려가 없다. 입력이 외부에서 오지 않으므로 공격 표면으로도 성립하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 4개 파일 전체
  - 상세: diff 전역을 검토했으나 API 키, 토큰, 비밀번호, 인증서 등 시크릿으로 분류될 문자열은 없다. `env=dict(os.environ)` 방식으로 현재 프로세스 환경을 복제해 서브프로세스에 넘기는 패턴(L393-397, L657-661 등)도 로컬 테스트 실행 컨텍스트에 한정되며 시크릿을 파일에 영속화하지 않는다.
  - 제안: 없음.

- **[INFO]** 인증/인가/암호화/의존성 관점은 해당 없음
  - 위치: 전체 diff
  - 상세: 이번 변경은 세션 인증, 권한 검증, 암호화 알고리즘, 의존성 버전과 무관한 순수 테스트 커버리지 확충 + 카탈로그 문서 갱신 + plan 진행상황 기록이다. `plan/in-progress/harness-guard-followups.md`의 "§F mermaid-lint npm 취약점(undici HIGH·dompurify moderate)" 서술은 **이미 별 PR에서 처리 완료**로 기록된 이력 텍스트일 뿐, 이번 diff가 의존성을 변경하지 않는다.
  - 제안: 없음.

### 요약

이번 변경분은 하네스 자체의 unittest 커버리지 확충(`PostToolUseImportFailOpenTest`로 mermaid-lint PostToolUse 훅의 import-실패 fail-open 분기를 실행 기반으로 검증), README "What's covered" 카탈로그의 양방향 drift 가드 신설, 그리고 이를 반영한 plan 문서 갱신으로 구성된다. 모든 서브프로세스 호출은 인자 리스트 기반(`shell=True` 미사용)이고, 임시 파일/디렉토리는 `tempfile.mkdtemp()`의 안전한 기본 권한을 사용하며, 정규식 파서는 신뢰 가능한 로컬 저장소 파일만을 입력으로 받아 인젝션·ReDoS·경로 탐색 표면이 성립하지 않는다. 하드코딩된 시크릿, 인증/인가 로직 변경, 암호화 관련 변경도 없다. 전반적으로 보안 관점에서 우려할 만한 패턴이 발견되지 않았다.

### 위험도
NONE
