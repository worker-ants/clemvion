# API 계약(API Contract) 리뷰

## 발견사항

(해당 없음)

## 요약

이번 변경분 15개 파일(`.claude/agents/consistency-summary.md`, `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_stop.py`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/SKILL.md`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/tests/**`, `plan/in-progress/harness-*.md`)은 모두 리뷰/일관성 검토 하네스 내부 도구(git hook, sub-agent 오케스트레이션용 Python CLI 스크립트, 에이전트·스킬 정의 markdown, 작업 추적 plan 문서)이다. `git diff --name-only origin/main...HEAD` 로 전수 확인한 결과 `codebase/backend`·`codebase/frontend` 등 실제 제품 코드(REST/HTTP API 엔드포인트가 존재할 수 있는 위치)는 단 한 파일도 포함되지 않았다. 변경 내용은 (1) `evaluate_review(cwd=None, *, in_flight_ok=False)` 처럼 Stop 훅과 Push 훅이 공유하는 내부 Python 함수에 opt-in 키워드 인자를 추가해 in-flight 억제 범위를 Stop 전용으로 좁힌 것, (2) `consistency-summary` 에이전트 출력 형식에 "§planner 인계" 섹션을 추가하고 Critical 하향 금지 규약을 명문화한 것, (3) 리뷰/일관성 체커에 전달되는 프롬프트 번들의 파일 우선순위 산정(`prioritize_bundle_files`)과 생략 파일 고지(`build_files_section` 누락 알림) 로직을 추가한 것, (4) 기본 `--prepare` changeset 이 커밋된 브랜치 diff 를 놓치는 경우 경고를 내는 것이다. 이들은 sub-agent 호출 규약(prompt_file/output_file/STATUS 라인)이나 CLI 인자 등 "내부 계약"으로 볼 여지는 있으나, 본 리뷰 관점이 명시한 하위 호환성/버전관리/응답스키마/에러 HTTP 상태코드/요청 검증/RESTful URL 설계/페이지네이션/인증·인가는 모두 HTTP 기반 서비스 API를 전제로 하며 이번 변경에는 대응 대상이 존재하지 않는다. 참고로 `evaluate_review` 의 신규 인자는 키워드 전용(keyword-only)이고 기본값이 기존 동작(억제 없음, 즉 push 가드 쪽 호출부는 무변경)을 보존하므로, 내부 함수 시그니처 관점에서도 하위 호환은 유지된다.

## 위험도
NONE
