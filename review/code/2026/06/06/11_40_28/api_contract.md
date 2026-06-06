# API 계약(API Contract) 리뷰

## 해당 없음

리뷰 대상 파일 6개는 모두 내부 Claude 훅 인프라에 해당한다.

- `.claude/hooks/_lib/branch_guard.py` — git 워크트리/브랜치 가드 라이브러리
- `.claude/hooks/_lib/review_guard.py` — 코드 리뷰 커버리지 가드 라이브러리
- `.claude/hooks/guard_review_before_stop.py` — Stop 훅 (nudge throttle 개선)
- `.claude/hooks/lint_mermaid_posttooluse.py` — PostToolUse Mermaid 린터 훅
- `.claude/tests/test_review_guard_hardening.py` — 위 라이브러리 단위 테스트
- `.claude/tools/bootstrap-session.sh` — 세션 시작 부트스트랩 스크립트

어떤 파일도 HTTP/REST/RPC 엔드포인트, 요청/응답 스키마, 인증 미들웨어, API 버전, URL 라우트, 페이지네이션, 또는 외부 API 에러 응답 구조를 정의하거나 변경하지 않는다. 모든 변경은 순수한 로컬 프로세스 간 상호작용(git 명령, 파일시스템 상태 마커, subprocess 타임아웃 조정)에 국한된다.

## 발견사항

해당 없음.

## 요약

본 변경 세트는 API 계약과 무관한 내부 훅 인프라의 강화 작업으로, HTTP API 엔드포인트·스키마·버전·인증/인가·에러 응답·페이지네이션·URL 설계 어느 항목에도 영향을 미치지 않는다.

## 위험도

NONE
