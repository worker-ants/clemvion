# 보안(Security) 리뷰 결과

**대상 변경**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, LlmCallRecord 공유 타입 전환, TurnRagDelta rename
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] 에러 메시지에 workspaceId 포함 — 외부 직렬화 여부 확인 권장
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L183-184
- **상세**: `WorkflowForbiddenWorkspaceError` 생성자 메시지에 `targetWorkspaceId` 와 `callerWorkspaceId` 가 포함된다. 기존 inline `Error` 와 동일한 패턴이므로 신규 노출은 없다. 단, 에러가 외부 API 응답에 직렬화될 경우 공격자가 workspace UUID 를 확인하여 다른 workspace 의 ID 를 추론하는 데 활용할 여지가 이론상 존재한다. workspaceId 는 UUIDv4 로 추정되며 비밀 시크릿은 아니나 정보 노출 최소화 원칙 관점에서 검토가 필요하다.
- **제안**: 에러 핸들러 레이어(HTTP 응답 직렬화 경로)에서 `WorkflowForbiddenWorkspaceError.message` 가 외부 클라이언트에 그대로 전달되지 않는지 확인. 외부 응답에는 에러 코드(`WORKFLOW_FORBIDDEN_WORKSPACE`)만 전달하고 메시지 본문은 서버 로그에만 기록하는 패턴이 바람직하다. 기존 inline Error 와 동일 수준이므로 회귀 아님.

### [INFO] LlmCallRecord all-optional 전환 — 감사 추적 정적 보장 약화
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2413
- **상세**: 기존 인라인 타입 `Array<{ requestPayload: unknown; responsePayload: unknown; durationMs: number; startedAt?: string; finishedAt?: string }>` 에서 `LlmCallRecord[]` 로 전환 시 `requestPayload` / `responsePayload` / `durationMs` 가 모두 optional 이 되면 정적 타입 수준의 감사 추적 완전성 보장이 제거된다. LLM 요청/응답 페이로드는 보안 감사 측면에서 중요한 데이터이므로 required 여부가 의미 있다. 현재 push site 가 항상 전 필드를 공급하므로 런타임에는 문제가 없으나, 미래 push site 추가 시 누락될 경우 감사 레코드에 구멍이 생길 수 있다.
- **제안**: `LlmCallRecord` 에 required subset(`requestPayload`, `responsePayload`, `durationMs`)과 optional extension 을 분리하는 인터페이스 설계를 중기적으로 검토. 단기적으로는 push site 에 타입 단언 또는 명시적 Pick 으로 required 필드를 강제하는 방안 고려. 기능적 취약점은 아님.

### [INFO] mapSubWorkflowError 메시지 backstop — 문자열 포함 매칭 정밀도
- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L382-384
- **상세**: `lower.includes('workflow_forbidden_workspace')` 문자열 매칭은 외부 executor 가 plain Error 로 던진 경우를 처리하는 방어적 backstop 이다. `includes` 는 정확한 prefix 매칭이 아니므로 이론상 다른 에러 메시지에 해당 토큰이 우연히 포함될 경우 오분류될 수 있다. 단, 동반된 음성 테스트(`'workspace quota exceeded'` → `SUB_WORKFLOW_FAILED`)가 이미 좁은 토큰(`workflow_forbidden_workspace` 전체) 검사를 확인하므로 실제 오분류 가능성은 매우 낮다. 보안 관점에서는 격리 강화 코드가 오분류되어 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 아닌 `SUB_WORKFLOW_FAILED` 로 처리될 위험보다 오히려 다른 에러가 잘못 격리 코드로 분류될 역방향 위험이 낮다.
- **제안**: 현재 구현 수용 가능. 필요 시 `startsWith` 또는 `includes('workflow_forbidden_workspace:')` 로 구분자까지 포함해 정밀도를 높이는 것을 선택적으로 고려.

---

## 요약

이번 변경은 W-6 workspace 격리 실패 차단(fail-closed)을 generic `Error` 에서 typed `WorkflowForbiddenWorkspaceError` 클래스로 승격하는 보안 강화 방향의 리팩토링이다. 새로운 공격 표면이나 취약점은 도입되지 않았으며, 오히려 `instanceof` 기반 타입 분기 도입으로 에러 분류 정확성이 향상되었다. 에러 메시지 내 workspaceId 포함은 기존 코드와 동일한 패턴이므로 회귀가 아니나 외부 직렬화 경로 확인이 권장된다. LlmCallRecord optional 전환은 감사 추적 정적 보장 측면에서 미미한 후퇴이지만 런타임 영향은 없다. 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, OWASP Top 10 해당 사항, 안전하지 않은 암호화, 알려진 취약 의존성 등은 이번 변경 범위 내에서 발견되지 않았다.

---

## 위험도

LOW
