# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 영역: spec/3-workflow-editor

## 발견사항

### [INFO] `EXECUTION_NOT_FOUND` 도구 결과 코드와 실행 엔진 HTTP 에러 코드 명칭 공유
- target 신규 식별자: `EXECUTION_NOT_FOUND` (`/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 — `get_execution_details` 도구 반환 에러코드)
- 기존 사용처: `spec/5-system/3-error-handling.md` 실행 엔진 HTTP 에러 코드 섹션 (동일한 의미의 에러코드 패턴, `EXECUTION_*` prefix 계열)
- 상세: 두 코드는 동일한 의미(실행을 찾을 수 없음)이나 다른 계층에서 사용된다 — 하나는 도구 result 페이로드 내부 (`{ok: false, error: 'EXECUTION_NOT_FOUND'}`), 다른 하나는 HTTP 4xx 응답 body. 의미적 일관성이 오히려 설계 의도이며, 네임스페이스가 완전히 분리되어 있으므로 런타임 충돌은 없다.
- 제안: 현 상태 유지. 두 계층에서 동일한 코드명을 사용하는 것은 의미 일관성을 높인다. 변경 불필요.

### [INFO] `CYCLE_DETECTED` / `UNKNOWN_NODE_TYPE` / `CONTAINER_INVALID_CHILD` — 실행 엔진 에러코드와 도구 결과 에러코드 명칭 공유
- target 신규 식별자: `CYCLE_DETECTED`, `UNKNOWN_NODE_TYPE`, `CONTAINER_INVALID_CHILD` (`/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 — `add_edge` / `add_node` 도구 반환 에러코드)
- 기존 사용처:
  - `CYCLE_DETECTED`: `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/14-external-interaction-api.md` (실행 엔진 수준 에러코드)
  - `UNKNOWN_NODE_TYPE`: `spec/5-system/4-execution-engine.md` (미등록 nodeType 조회 에러)
  - `CONTAINER_INVALID_CHILD`: `spec/1-data-model.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/data-flow/11-workflow.md` (컨테이너 유효성 검사 에러)
- 상세: 세 코드 모두 실행 엔진 / 그래프 유효성 검사 계층과 어시스턴트 도구 결과 계층 양쪽에서 동일한 의미로 사용된다. 이는 shadow workflow 검증 레이어가 실행 엔진과 동일한 검증 로직을 재사용하는 설계에서 자연스럽게 나오는 패턴이다. 의도적 재사용으로 충돌 아님.
- 제안: 현 상태 유지. 동일 의미를 계층 간에 같은 코드명으로 표현하는 것은 일관성 향상에 기여한다.

### [INFO] `auto_resume` SSE 이벤트와 WebSocket `execution.resumed` 이벤트의 개념적 유사성
- target 신규 식별자: `event: auto_resume` (`/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/4-ai-assistant.md` §5.3 — Assistant SSE 이벤트)
- 기존 사용처: `event: execution.resumed` (`spec/3-workflow-editor/3-execution.md` §8.1 — 실행 WebSocket 이벤트, waiting_for_input 후 재개)
- 상세: 두 이벤트는 채널이 다름 (SSE vs WebSocket), 트리거도 다름 (어시스턴트 stall 자동 복구 vs 사용자 입력 후 실행 재개). 이름 자체도 `auto_resume` vs `execution.resumed`로 구분된다. 혼동 가능성 낮음.
- 제안: 현 상태 유지. 충분히 구분되는 컨텍스트이며 이름 변경 불필요.

## 요약

spec/3-workflow-editor 영역은 오랫동안 확립된 스펙 영역으로, impl-prep 관점에서 신규 식별자 충돌이 없다. M-3 리팩터링이 도입하는 `AssistantToolRouter` 클래스명은 이미 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts`에 구현되어 있어 스펙-코드 간 정합이 유지된다. API 엔드포인트(`/api/workflow-assistant/sessions/*`), SSE 이벤트명, 에러 코드(`ASSISTANT_` 접두사), 도구명 모두 기존 사용처와 충돌하지 않는다. 발견된 3건은 모두 INFO 수준의 참고 사항으로, 실행 엔진과 도구 결과 계층 간의 의도적 에러코드 재사용 패턴이다. 구현 차단 사유 없음.

## 위험도

NONE
