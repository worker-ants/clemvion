# Code Review 통합 보고서 (2차 — fix 커버)

## 전체 위험도
**MEDIUM** (행위보존 fail-closed 전환 재리뷰 — Critical 0 · Warning 3). 모든 Warning 은
correctness 결함이 아니라 운영 모니터링 권고·테스트 nicety·pre-existing 패턴 선택. 상세 reviewer
결과는 본 세션 디렉토리 개별 *.md 참조. 처분은 RESOLUTION.md.

## Critical
_없음_

## 경고 (WARNING)
- **W-1 (운영 안전, side_effect, MEDIUM)**: fail-closed 로 미마이그레이션 호출자가 차단될 수 있음.
  → 구현 전 호출경로 전수 trace 로 프로덕션 호출처 전부 컨텍스트 공급 입증 + dockerized e2e 34/202 통과.
  배포 후 `WORKFLOW_FORBIDDEN_WORKSPACE` 빈도 모니터 권고는 운영 항목으로 수용.
- **W-2 (maintainability)**: 명시적 격리 테스트(mismatch ws-attacker / match ws-1) 2건이 `__workspaceId`
  인라인 주입. → 보안 시나리오 가독성 위해 리터럴 유지(withWorkspace 채택 선택). 비차단.
- **W-3 (에러 타입)**: `WorkflowForbiddenWorkspaceError` 전용 클래스 부재(인라인 string prefix).
  → 동일 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드 재사용으로 분류 안정. typed-error 리팩터는 별도 후속.

## 참고 (INFO 9건)
SPEC-DRIFT(planner) / 에러메시지 sanitize(상위레이어, pre-existing) / `__workspaceId` 네임스페이스
(pre-existing architecture) / 로그 식별자(pre-existing) / it 제목 언어 혼재 / withWorkspace in-place 변이
(테스트 헬퍼 의도) / applyContinuation stale JSDoc(pre-existing, diff 외) / **assertSameWorkspace 중복
JSDoc → 반증(인접 MAX_RECURSION_DEPTH JSDoc 오독, 단일 정의)** / mockWorkflow 기본 workspaceId.

## 라우터
9 reviewer 실행, 5 제외. 전 reviewer success.

> main Claude 멱등 persist (worktree isolation guard 로 workflow terminal write 차단).
