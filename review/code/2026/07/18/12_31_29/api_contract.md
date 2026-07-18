### 발견사항

해당 없음.

리뷰 대상 5개 파일 — `.claude/tools/bootstrap-session.sh`(SessionStart bootstrap 셸 스크립트), `.claude/tests/test_bootstrap_mermaid_install.py`(위 스크립트의 Python unittest), `.github/dependabot.yml`(Dependabot 스케줄 설정), `.claude/tools/mermaid-lint/package-lock.json`(npm lockfile — `dompurify` 3.4.7→3.4.12, `undici` 7.27.0→7.28.0 버전 범프), `PROJECT.md`(거버넌스 서술 1문장 추가) — 는 모두 하네스 개발 도구 인프라·CI 의존성 관리·문서에 국한된다.

`git diff origin/main...HEAD` 로 실제 변경분을 직접 확인했다. 5개 파일 어디에도 다음에 해당하는 코드가 없다:
- HTTP controller, route handler, DTO, request/response 스키마 정의
- API 버전 네임스페이스(`/v1/...` 등), OpenAPI/Swagger 데코레이터
- 에러 응답 포맷·HTTP 상태 코드
- 요청 파라미터/바디 유효성 검증 로직 (`class-validator`, zod 등)
- REST 경로 설계, 페이지네이션 파라미터
- 인증/인가 미들웨어·가드

`bootstrap-session.sh`는 Claude Code 하네스가 SessionStart 훅으로 로컬 실행하는 셸 스크립트로, 외부에 노출되는 네트워크 API 가 아니라 환경변수(`MERMAID_INSTALL_RETRY_SEC` 등)를 입력으로 받는 CLI 성격의 내부 도구다. 이번 diff 는 그 스크립트 안에 `_lock_hash()` 함수를 추가해 설치완료 마커의 내용을 "존재 유무"에서 "package-lock.json 의 SHA-256 해시"로 바꾼 것으로, 이는 프로세스 간 셸 스크립트 계약이지 클라이언트가 소비하는 API 계약이 아니다. 환경변수 인터페이스 자체도 기존 변수는 그대로 유지되고 신규 변수 추가도 없어 이 각도에서도 breaking 요소는 없다.

`.github/dependabot.yml`·`package-lock.json`은 각각 CI 설정과 의존성 lockfile 이며, `PROJECT.md`는 그 거버넌스 경계를 설명하는 문서 갱신이다. 셋 다 API 계약과 무관하다.

### 요약
이번 변경 세트는 mermaid-lint 하네스 툴링의 npm 트리에 대한 보안 패치(undici HIGH, dompurify moderate) 적용과 그 패치가 기존 checkout 에도 전파되도록 하는 설치 마커 로직 개선, 그리고 Dependabot 커버리지 편입에 관한 것으로, REST/HTTP API 표면(컨트롤러, DTO, 라우트, 인증/인가, 페이지네이션, 에러 응답 등)을 전혀 건드리지 않는다. API 계약 관점에서 검토할 대상이 없다.

### 위험도
NONE
