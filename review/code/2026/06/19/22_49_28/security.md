# 보안(Security) 리뷰 결과

**대상 변경**: C-1 dev 잔꼬리(1b) — WorkflowForbiddenWorkspaceError 타입화, LlmCallRecord 공유 타입 전환, TurnRagDelta rename, plan/review 문서 추가

**검토 일시**: 2026-06-19

---

## 발견사항

### [INFO] 에러 메시지에 내부 식별자(workspaceId) 노출
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L88-93, `WorkflowForbiddenWorkspaceError` 생성자
- **상세**: `targetWorkspaceId` 와 `callerWorkspaceId` 가 에러 메시지 문자열에 직접 포함된다 (`Sub-workflow ${targetWorkspaceId} is not accessible from workspace ${callerWorkspaceId}`). 이 메시지가 클라이언트에 그대로 노출되면 내부 워크스페이스 ID 구조가 유출될 수 있다. 단, 변경 전(inline `new Error(...)`) 에서도 동일한 문자열이 사용되었으므로 이번 변경이 새로운 취약점을 도입한 것은 아니다. `mapSubWorkflowError` 가 에러 코드(`WORKFLOW_FORBIDDEN_WORKSPACE`)로 변환하고 메시지 자체는 클라이언트로 흘러가지 않는 구조라면 실질 위험은 낮다.
- **제안**: 에러 클래스에 `targetWorkspaceId`·`callerWorkspaceId` 를 구조화 필드(readonly)로 보존하는 것은 적절하다. 다만 에러 핸들러 레이어에서 이 필드가 외부 API 응답에 직렬화되지 않는지 별도 확인 권장. 로그 수준에서도 워크스페이스 ID 가 과도하게 기록되지 않도록 주의.

### [INFO] 메시지 기반 백스톱(message string matching)의 부분적 보안 의존성
- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L282-284 (`lower.includes('workflow_forbidden_workspace')`)
- **상세**: 타입 분기(`instanceof WorkflowForbiddenWorkspaceError`)가 우선 적용되고, 메시지 매칭은 외부 레이어가 plain `Error` 로 던지는 경우에만 사용되는 defensive backstop 이다. 에러 메시지 접두사를 기준으로 분류를 결정하는 것은 원칙적으로 취약하나, (a) 동일 프로세스 내부 호출이고, (b) 결과는 `WORKFLOW_FORBIDDEN_WORKSPACE` vs `SUB_WORKFLOW_FAILED` 중 하나일 뿐 "허용" 분기가 없으므로 실질 보안 우회 시나리오가 성립하지 않는다.
- **제안**: 장기적으로 외부 레이어도 typed error 를 throw 하도록 통일하면 메시지 기반 백스톱 자체를 제거할 수 있다.

### [INFO] `LlmCallRecord` 타입 완화(type loosening) — 감사 추적 완결성
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2410
- **상세**: 기존 인라인 타입(`Array<{ requestPayload: unknown; responsePayload: unknown; durationMs: number; ... }>`)에서 `LlmCallRecord[]`(all-optional superset)로 전환되었다. `requestPayload`·`responsePayload` 가 optional 화되면 LLM 요청/응답 원문(민감 정보 포함 가능)의 감사 추적이 누락될 위험이 있다. plan 주석("push site 는 항상 전 필드를 공급한다")이 런타임 보장이 되려면 빌드 단계 캐스케이드 검증이 충분한지 확인 필요.
- **제안**: `requestPayload`·`responsePayload` 는 보안 감사 관점에서 항상 존재해야 하는 필드이므로 `LlmCallRecord` 에서 non-optional 로 유지하거나 push site 에 명시적 타입 단언 추가를 검토. 단순 디버그/트레이스 목적이라면 현재 수준도 수용 가능.

---

## 나머지 점검 관점 결과

1. **인젝션 취약점**: 변경된 코드에서 사용자 입력을 SQL·HTML·커맨드·경로로 삽입하는 처리 없음. 해당 없음.
2. **하드코딩된 시크릿**: API 키·비밀번호·토큰·인증서 등 하드코딩 없음. 해당 없음.
3. **인증/인가**: `assertSameWorkspace` 함수가 fail-closed(deny-by-default) 방향으로 강화된 것은 보안 개선이다. 인증 우회 가능성 신규 도입 없음.
4. **입력 검증**: 변경 범위에서 사용자 입력을 직접 처리하는 코드 없음. 해당 없음.
5. **OWASP Top 10**: 특이사항 없음.
6. **암호화**: 암호화·해시 알고리즘 관련 변경 없음. 해당 없음.
7. **에러 처리**: INFO-1(workspaceId 노출)에서 다뤘다. 에러 메시지가 클라이언트로 전달되는 경로가 차단되어 있다면 실질 위험 없음.
8. **의존성 보안**: 신규 외부 의존성 추가 없음. 해당 없음.

---

## 요약

이번 변경의 핵심은 보안 강화(workspace 격리 fail-closed 전환)와 코드 정제(타입 중복 제거, 이름 통일)이다. 새로운 보안 취약점은 도입되지 않았다. `WorkflowForbiddenWorkspaceError` 에 워크스페이스 ID 가 포함된 에러 메시지가 있으나, 이는 기존 inline Error 와 동일한 패턴이며 외부 노출 여부는 에러 핸들러 레이어 구성에 달려 있다. `LlmCallRecord` 타입 완화는 정적 계약이 느슨해진 것이나 LLM 요청/응답 페이로드의 감사 추적이 누락되지 않도록 push site 보장이 런타임에도 유지되는지 확인이 필요하다. 메시지 기반 백스톱은 보안 결정과 무관한 분류 목적이며 현 맥락에서 실질 위험 없음. 전반적으로 보안 위험이 낮고, workspace 격리가 강화된 긍정적 변경이다.

---

## 위험도

LOW
