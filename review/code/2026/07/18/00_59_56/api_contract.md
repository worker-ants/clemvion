# API 계약(API Contract) 리뷰

## 검토 대상 요약

이번 변경은 다음 6개 파일로 구성된다.

1. `.claude/hooks/_lib/mermaid_lint_ready.py` — mermaid-lint 설치 완료 여부를 판정하는 공유 Python 모듈(`is_ready()` 함수 + CLI)
2. `.claude/hooks/lint_mermaid_posttooluse.py` — Claude Code PostToolUse 훅(stdin 으로 JSON 페이로드를 받아 mermaid 블록을 정적 검사)
3. `.claude/tools/bootstrap-session.sh` — SessionStart 부트스트랩 스크립트(githooks 활성화, mermaid-lint 의존성 설치, 상태 마커 GC, worktree reap)
4. `.githooks/pre-commit` — git pre-commit 훅(브랜치 가드 + mermaid lint 위임)
5. `.claude/tests/test_bootstrap_mermaid_install.py` — bootstrap 설치 가드 테스트
6. `.claude/tests/test_mermaid_lint_ready.py` — 공유 readiness 모듈 테스트

전부 리포지토리 내부 개발자 워크플로용 스크립트/훅/테스트이며, HTTP/REST 엔드포인트, 컨트롤러, 라우터, DTO, 클라이언트 SDK 등 네트워크 API 표면은 존재하지 않는다. Claude Code PostToolUse 훅이 stdin 으로 받는 JSON 페이로드는 Claude Code 하니스가 정의한 외부 프로토콜을 그대로 소비할 뿐(이 리포지토리가 그 스키마의 제공자가 아님), git pre-commit 훅과 bootstrap 스크립트는 로컬 프로세스 실행·파일시스템 마커·환경변수 기반 내부 규약으로 동작한다. 이는 모두 "하위 호환성 / 버전관리 / 응답형식 / 에러응답(HTTP 상태코드) / 요청검증 / URL·경로설계 / 페이지네이션 / 인증·인가" 라는 API 계약 리뷰 관점의 대상이 되는 네트워크 API 계층이 아니다.

## 발견사항

없음 (API 계약 관점에서 검토할 코드 변경 없음).

## 요약

이번 변경은 Claude Code 훅·git pre-commit 훅·SessionStart 부트스트랩 스크립트·관련 유닛테스트로 구성된 순수 개발자 도구 체인이며, HTTP/REST API 엔드포인트, 요청/응답 스키마, 인증/인가, 페이지네이션 등 API 계약 리뷰 대상이 되는 코드가 전혀 포함되어 있지 않다. 해당 없음.

## 위험도

NONE
