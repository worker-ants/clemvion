# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

검토 대상 7개 파일은 모두 저장소 내부 harness/git-hooks 자동화 계층에 속한다 (SessionStart bootstrap 셸 스크립트, PostToolUse mermaid-lint 파이썬 훅, 훅 간 공유되는 readiness SoT 모듈, `.githooks/pre-commit`, 이를 커버하는 GitHub Actions 워크플로, 그리고 이들에 대한 unittest). 다음 중 어느 것도 존재하지 않는다:

- REST/GraphQL/RPC 엔드포인트, 컨트롤러, 라우터 정의
- HTTP 요청/응답 DTO·스키마
- 클라이언트가 호출하는 공개 API 버전 관리 대상
- 페이지네이션이 적용될 목록 조회 API
- 인증/인가 미들웨어나 가드가 적용되는 네트워크 엔드포인트

`mermaid_lint_ready.py` 의 `python3 mermaid_lint_ready.py <tool_dir>` CLI 인터페이스(exit 0/1)와 PostToolUse 훅의 stdin JSON 페이로드/exit code 계약(0/2/기타)은 Claude Code 하네스와 로컬 프로세스 간의 내부 프로세스 계약이며, 본 리뷰 관점이 다루는 "API 계약"(클라이언트-서버 네트워크 API의 하위 호환성·버전·응답 스키마·에러 응답·요청 검증·URL 설계·페이지네이션·인증인가)의 대상이 아니다. `codebase/backend`·`codebase/frontend` 등 실제 서비스 API 표면에 대한 변경은 diff에 포함되어 있지 않다.

## 요약

이번 변경은 API 계약 관점의 검토 대상이 아니다. 7개 파일 전부가 리포지토리 내부 개발자 도구(세션 부트스트랩, mermaid 린트 훅, pre-commit 훅, CI 워크플로, 관련 유닛테스트)이며 네트워크로 노출되는 REST/GraphQL 엔드포인트나 클라이언트가 소비하는 응답 스키마를 전혀 포함하지 않는다. 내부 CLI/훅 실행 계약(exit code, JSON stdin)이 존재하긴 하나 이는 프로세스 간 계약이지 API 계약 리뷰의 대상(하위 호환성, 버전 관리, 응답 형식, 에러 응답, 요청 검증, URL 설계, 페이지네이션, 인증/인가)에 해당하지 않는다.

## 위험도

NONE
