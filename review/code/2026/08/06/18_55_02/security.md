# 보안(Security) 리뷰 — CI 백스톱 / packages prepare 계약

## 리뷰 대상 요약

- `.claude/tests/README.md` — 신규 테스트 카탈로그 문서 갱신 (텍스트만)
- `.claude/tests/test_packages_prepare_contract.py` — 신규 harness 자체 테스트 (내부 패키지 `prepare` 스크립트의 계약 검증)
- `.github/workflows/harness-checks.yml` — `paths:` 트리거에 `codebase/packages/*/package.json` 추가
- `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` — `prepare` 스크립트를 `[ -d dist ] || tsc` (디렉터리 존재만 확인) 에서 `node -e "..."` (typescript resolvable 여부로 분기) 로 교체

## 발견사항

- **[INFO]** `prepare` 스크립트가 `child_process.execSync('tsc', {stdio:'inherit'})` 를 PATH 기반으로 호출
  - 위치: 예시로 `codebase/packages/ai-end-reason/package.json:9` (동일 패턴이 나머지 6개 `package.json` 에도 반복)
  - 상세: 호출 문자열 `'tsc'` 는 하드코딩된 리터럴이며 사용자 입력이나 외부 데이터가 문자열에 삽입되지 않으므로 커맨드 인젝션 표면은 없다. 다만 `execSync` 는 내부적으로 셸(`/bin/sh -c`)을 거치고, `tsc` 실행 파일은 `require.resolve('typescript/package.json')` 로 존재만 확인한 뒤 PATH 상의 `tsc` 를 그대로 호출한다 — 이론적으로 PATH 순서를 조작할 수 있는 공격자(예: 사전에 침해된 dependency 가 `node_modules/.bin` 앞쪽에 동명의 바이너리를 심는 경우)라면 위조된 `tsc` 가 실행될 수 있다. 그러나 이는 변경 전 형태(`[ -d dist ] || tsc`, 그리고 `sdk` 패키지가 이미 쓰던 `node -e` 형태)에서도 동일하게 존재하던 기존 패턴이며, 이번 diff 가 새로 도입한 위험이 아니다.
  - 제안: 조치 불필요(기존 패턴과 동등). 강화하려면 `require.resolve('typescript/bin/tsc')` 로 확인한 실행 파일을 직접 spawn 하는 방법이 있으나 이는 harness 규약(Windows 호환 `node -e` 형태, review #231) 과 충돌할 수 있어 별도 논의 필요.

- **[INFO]** GitHub Actions 액션이 메이저 버전 태그(`@v7`)로 고정, 커밋 SHA 고정 아님
  - 위치: `.github/workflows/harness-checks.yml:103,107` (`actions/checkout@v7`, `actions/setup-python@v7`), `.github/workflows/harness-checks.yml:128` 부근 (`actions/setup-node@v7`)
  - 상세: 서플라이체인 공급망 강화 관점에서는 액션을 커밋 SHA 로 고정하는 편이 태그 재바인딩(tag re-pinning) 공격에 더 안전하다. 다만 이는 저장소 전역 기존 컨벤션이며 이번 diff 는 `paths:` 트리거 한 줄만 추가했을 뿐 해당 스텝 자체를 건드리지 않았다.
  - 제안: 조치 불필요(이번 변경 범위 밖, 기존 컨벤션).

- **[INFO]** 신규 테스트가 저장소 소스의 `prepare` 문자열을 `subprocess.run(["sh", "-c", self.prepare], ...)` 로 실행
  - 위치: `.claude/tests/test_packages_prepare_contract.py:141-144` (`_run` 메서드 내부)
  - 상세: `self.prepare` 값은 리포지토리 내 `codebase/packages/*/package.json` 에서 읽은 값으로, 외부/사용자 입력이 아니라 이미 코드 리뷰·머지 과정을 거친 신뢰된 소스다. 실행은 `tempfile.TemporaryDirectory()` (임의 이름, 0700 권한)로 격리된 격리 환경에서 이루어지고 `PATH` 앞에만 스텁 `bin/tsc` 를 추가해 실제 `tsc` 호출을 가로챈다. 커맨드 인젝션·경로 탈출 표면 없음 — harness 자체 테스트로서 통상적인 패턴.
  - 제안: 조치 불필요.

## 요약

이번 변경은 harness CI 백스톱(신규 GitHub Actions 트리거 경로 등재), harness 자체 테스트 신설, 그리고 내부 workspace 패키지 7개의 `prepare` 빌드 스크립트를 "디렉터리 존재만 확인"에서 "typescript 설치 여부에 따라 항상 재컴파일/no-op/명시적 실패로 분기"하는 형태로 바꾼 것이다. 사용자 입력을 받는 애플리케이션 코드(SQL/HTTP 핸들러, 인증/인가 로직, 암호화 로직 등)는 전혀 포함되어 있지 않으며, 신규 `prepare` 스크립트의 셸 명령 문자열은 전부 하드코딩된 리터럴로 외부/사용자 데이터가 삽입되지 않아 커맨드 인젝션 위험이 없다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출, 알려진 취약 의존성 도입 등 OWASP Top 10 관련 이슈도 발견되지 않았다. PATH 기반 `tsc` 실행이라는 미세한 서플라이체인 표면이 있으나 이는 변경 전부터 존재하던 기존 패턴을 유지한 것으로 이번 diff 가 새로 만든 위험이 아니다.

## 위험도

NONE
