# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] DI 토큰을 평문 문자열 상수로 정의
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/workflow-executor.interface.ts` line 84
- 상세: `WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'` 는 NestJS 관용 패턴이다. 단순 문자열 토큰은 이름 충돌 시 의도치 않은 다른 provider 로 바인딩될 수 있다. 현재 프로젝트의 다른 토큰들(`SHUTDOWN_GRACE_MS`, `CONTINUATION_DLQ_MONITOR_CONFIG`)도 같은 패턴을 사용하므로 코드베이스 전체의 일관성 위반은 아니다. 다만 토큰 네임스페이스 충돌 리스크가 존재하며, Symbol 사용 시 이 리스크가 원천 제거된다.
- 제안: `export const WORKFLOW_EXECUTOR = Symbol('WORKFLOW_EXECUTOR');` 로 전환하면 런타임 이름 충돌 가능성이 원천 제거된다. 즉각적인 보안 위협은 아니나 방어 심층 관점에서 권장.

### [INFO] `assertSameWorkspace` 의 옵셔널 칼러 ID 통과 정책
- 위치: `execution-engine.service.ts` `assertSameWorkspace` 메서드 (lines 1177~1193, 변경 없음 — 기존 코드 맥락)
- 상세: `callerWorkspaceId` 가 undefined 이면 WARN 로그만 남기고 통과한다. 이 코드는 이번 PR 에서 변경되지 않았으나, `WORKFLOW_EXECUTOR` 토큰으로 bootstrap 된 node handler 들이 `WorkflowExecutor.executeAsync` / `executeInline` 을 호출할 경로가 확장되는 맥락에서 재확인할 필요가 있다. 기존 호출자 중 `parentWorkspaceId` 를 전달하지 않는 경우 크로스-워크스페이스 sub-workflow 호출이 허용될 수 있다.
- 제안: 이번 PR 범위 밖이지만, 후속 PR 에서 node handler 로부터 `executeAsync`/`executeInline` 을 호출하는 경로가 추가될 때 `parentWorkspaceId` 전달을 필수화(fail-closed 전환)하는 일정을 plan 에 명시하는 것을 권장.

### [INFO] 에러 로그의 내부 식별자 노출 수준
- 위치: `execution-engine.service.ts` `rehydrateAndResume` 내 catch 블록 (line 1590 영역, 변경 없음)
- 상세: `RehydrationError` 처리 시 `err.code`, `executionId`, `nodeExecutionId` 를 structured params 로 분리해 `logger.warn` 하는 패턴(W19 comment)은 올바르다. 이번 PR 에서 이 코드는 변경되지 않았으며 보안적으로 퇴행 없음.
- 제안: 없음.

## 요약

이번 PR 은 순수 구조적 리팩터링(god-class → NodeBootstrapService 분리, WORKFLOW_EXECUTOR DI 토큰 신설)이며, 새로운 사용자 대면 입력 경로·인증/인가 경계·암호화 로직·외부 의존성 추가가 전혀 없다. 변경된 코드에서 인젝션 취약점·하드코딩 시크릿·OWASP Top 10 관련 위험 요소는 발견되지 않는다. `WORKFLOW_EXECUTOR` 토큰이 평문 문자열인 점은 NestJS 코드베이스 전반의 기존 관용을 따른 것으로 즉각적 위협은 없으며, Symbol 전환은 선택적 개선 사항이다. `assertSameWorkspace` 의 fail-open 정책은 기존 코드이고 이번 PR 에서 변경되지 않았으나, 후속 PR(PR2~PR4)에서 node handler 가 executor 호출 경로를 더 활발히 사용하게 될 때 fail-closed 전환 일정을 함께 검토하도록 권장한다.

## 위험도

NONE

STATUS: SUCCESS
