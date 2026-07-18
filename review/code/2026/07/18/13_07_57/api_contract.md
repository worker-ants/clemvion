# API 계약(API Contract) 리뷰

## 리뷰 대상

- `.claude/tools/bootstrap-session.sh` (SessionStart 부트스트랩 셸 스크립트)
- `.claude/tests/test_bootstrap_mermaid_install.py` (위 스크립트의 mermaid-lint 설치 가드 단위 테스트)
- `.claude/tests/README.md` (테스트 커버리지 문서)

### 해당 없음, 위험도 NONE

세 파일 모두 harness/개발 도구 계층(git hooks 배선, mermaid-lint npm 의존성 설치 idempotency 가드, 상태 마커 GC, 병합된 worktree reap)에 속하며, 그 테스트·문서다. REST/GraphQL 엔드포인트, 컨트롤러, DTO, 요청/응답 스키마, HTTP 상태 코드, 인증/인가, 페이지네이션, URL 라우팅 등 API 계약 관점의 대상이 되는 코드가 전혀 없다. `npm install` 호출은 npm 레지스트리를 소비하는 것일 뿐 이 프로젝트가 설계·노출하는 API 표면이 아니다.

## 발견사항

없음.

## 요약

이번 변경은 세션 부트스트랩 셸 스크립트의 mermaid-lint 설치 가드(마커 기반, lockfile 해시 바인딩, 실패 throttle)와 그에 대한 Python 단위 테스트, 테스트 커버리지 문서 갱신으로 구성된다. 애플리케이션 API(백엔드 컨트롤러/DTO, 프론트엔드 API 클라이언트, 응답 스키마, 인증/인가, 페이지네이션 등)를 다루는 코드가 전혀 포함되어 있지 않아 API 계약 관점에서 검토할 대상이 없다.

## 위험도

NONE
