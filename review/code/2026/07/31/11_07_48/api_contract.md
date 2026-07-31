# API 계약(API Contract) 리뷰

## 검토 범위 확인

변경 파일 11개 전량 확인 (`git diff origin/main...HEAD --stat`):

- `.claude/hooks/_lib/review_guard.py`
- `.claude/hooks/guard_review_before_stop.py`
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/README.md`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_review_changeset_warning.py`
- `.claude/tests/test_review_guard_hardening.py`
- `.claude/tests/test_stop_guard_failopen.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
- `plan/in-progress/harness-review-gate-ci-backstop.md`

전부 `.claude/`(hooks·skills 스크립트·harness 자체 테스트) 또는 `plan/in-progress/`(계획 문서) 범위이며, `codebase/backend`, `codebase/frontend`, `codebase/packages`, `codebase/channel-web-chat` 등 제품 코드 경로는 이번 변경에 전혀 포함되지 않았다. REST/HTTP 엔드포인트, 컨트롤러, 라우트, 요청/응답 스키마, 인증/인가 미들웨어 등 네트워크 API 표면과 관련된 코드는 존재하지 않는다.

프롬프트에 diff 본문이 비어 있던 파일 1(`review_guard.py`)·파일 3(`code_review_orchestrator.py`)도 실제 저장소에서 `git diff origin/main...HEAD`로 직접 대조했다. 두 파일 모두 harness 내부 Python 함수(`evaluate_review`의 `in_flight_ok` 키워드 인자 추가, `warn_if_committed_work_is_missing` stderr 경고 헬퍼 추가)에 대한 변경으로, HTTP 요청/응답이나 CLI 외부 계약이 아닌 프로세스 내부 함수 시그니처·기본값 변경이다. 이 변경들은 Stop hook / push hook / 오케스트레이터 스크립트 간의 내부 호출 계약이며, 외부에 노출되는 API 계약(REST/GraphQL 등)이 아니다.

## 발견사항

없음 — 리뷰 대상 파일 전체가 API 계약 관점의 점검 항목(하위 호환성, 버전 관리, 응답 형식, 에러 응답, 요청 검증, URL/경로 설계, 페이지네이션, 인증/인가)이 적용될 네트워크 API 코드를 포함하지 않는다.

## 요약

이번 변경은 Claude Code harness의 리뷰 게이트(Stop/Push hook)·코드 리뷰 및 consistency 오케스트레이터·관련 테스트·plan 문서에 한정된 내부 도구 개선이다. `evaluate_review()`에 `in_flight_ok` 키워드 인자를 추가해 in-flight 리뷰 억제를 Stop 훅 전용으로 좁히고, consistency 번들 우선순위 재정렬, `--prepare` 기본 changeset이 커밋된 브랜치 작업을 누락할 때 경고를 추가하는 등의 변경이 전부다. 제품의 REST/HTTP API, 요청/응답 스키마, 인증·인가, 페이지네이션 등에 영향을 주는 코드는 이번 diff에 포함되어 있지 않으므로 API 계약 관점에서 해당 없음.

## 위험도

NONE
