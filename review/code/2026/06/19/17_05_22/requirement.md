# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [SPEC-DRIFT] [WARNING] W-6 fail-closed 전환: spec 본문이 "callerWorkspaceId 누락 시 차단" 행동을 명시하지 않음
- 위치: `spec/4-nodes/2-flow/1-workflow.md` line 75 (W-6 callout box)
- 상세: spec 본문은 "대상 워크플로우가 호출자(부모)와 다른 워크스페이스이면 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 throw" 라고만 기술한다. `callerWorkspaceId` 자체가 없을 때(미마이그레이션 진입) fail-closed 로 거부하는 새 동작은 spec 에 명시돼 있지 않다. 코드 변경(fail-open warn-after-return → fail-closed throw)은 보안 측면에서 합리적이며 의도적인 강화이므로 되돌리는 것이 오답이다. spec 이 낡은 상태다.
- 제안: 코드 유지 + spec 반영. `spec/4-nodes/2-flow/1-workflow.md` §2 W-6 callout box 에 "callerWorkspaceId 누락 시에도 격리 증명 불가로 `WORKFLOW_FORBIDDEN_WORKSPACE` 차단 (fail-closed)" 행동을 추가한다. `spec/5-system/4-execution-engine.md` workspace-isolation 관련 절도 동일하게 갱신 필요.

---

### [INFO] SubWorkflowOptions.parentWorkspaceId 는 여전히 optional 타입
- 위치: `codebase/backend/src/nodes/core/workflow-executor.interface.ts` line 13
- 상세: `parentWorkspaceId?: string` 으로 선언돼 있으며 JSDoc 도 "옛 동작과의 호환을 위해 optional"이라 명시한다. 그러나 이번 변경에서 `assertSameWorkspace` 가 fail-closed 로 전환됨에 따라 런타임 상에서는 `parentWorkspaceId` 미전달 시 항상 throw 된다. 타입 레벨에서는 optional 이므로 컴파일 타임 누락 감지가 불가하다. 현재 모든 알려진 호출자에 `parentWorkspaceId` 가 주입됐다면 기능 동작에 이상은 없으나 향후 새 호출자가 optional 을 무시하고 전달하지 않으면 런타임 예외가 발생할 수 있다.

---

### [INFO] 테스트 픽스처 — withWorkspace 패턴 두 곳에 독립 선언
- 위치: 테스트 파일 `describe('executeInline — Sub-Workflow parent linking')` 내 `withWorkspace` 함수 vs `describe('_callStack push/pop')` 블록 인라인 반복(lines 12468, 12512, 12550, 12579)
- 상세: 동일한 `context.variables.__workspaceId = 'ws-1'` 주입 패턴이 두 가지 형태로 공존한다. 기능상 올바르며 차단 사유가 아니다.

---

## 요약

두 파일의 변경은 W-6 workspace 격리를 "fail-open(warn + pass)" 에서 "fail-closed(throw WORKFLOW_FORBIDDEN_WORKSPACE)"로 전환하는 목적을 일관되게 달성한다. 프로덕션 코드(`execution-engine.service.ts`)의 `assertSameWorkspace` 변경은 `callerWorkspaceId` 부재 시 throw 하도록 명확히 수정됐고, 테스트 파일은 (1) 모든 기존 `executeInline` 테스트에 `withWorkspace` 헬퍼를 적용해 통과시키고, (2) `executeSync`/`executeAsync` 에 `parentWorkspaceId: 'ws-1'` 를 주입하고, (3) callerWorkspaceId 누락 시 차단을 검증하는 새 음성 테스트를 추가함으로써 기능 완전성을 만족한다. 엣지 케이스(누락·불일치·일치 3가지 모두)가 명시적으로 커버된다. spec 쪽 미반영 항목(fail-closed 전환)이 SPEC-DRIFT WARNING 1건으로 식별됐으나 코드 수정이 아닌 spec 문서 갱신으로 해소해야 한다. 코드 자체의 요구사항 충족도는 높다.

## 위험도

LOW
