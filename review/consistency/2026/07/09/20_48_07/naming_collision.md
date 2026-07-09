# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 요약

이번 diff(#501 회귀 수정, `fix-resume-turn-usage-log-attribution`)는 spec 문서 변경이 없는
순수 코드 변경(`구현 대상 spec 영역: (없음)`)이다. 도입된 유일한 신규 "식별자"는
`ReentryStateDriver.buildRetryReentryState` opts / `resumeStateSchema` /
`CREDENTIAL_CONTEXT_FIELDS` 에 추가된 필드 `nodeExecutionId` 이며, 아래와 같이 이미 spec
전역에서 동일 의미로 광범위하게 확립된 식별자의 재사용임을 확인했다.

## 발견사항

### 확인만 하고 CRITICAL/WARNING 없음 — `nodeExecutionId` 필드는 기존 spec 의미와 완전 일치

- **[INFO]** `nodeExecutionId` 재사용은 충돌이 아니라 기존 계약의 정합적 복원
  - target 신규 식별자: `resumeStateSchema.nodeExecutionId` (zod, `resume-state.schema.ts:119`) +
    `CREDENTIAL_CONTEXT_FIELDS` 항목 + `ReentryStateDriver.buildRetryReentryState` 의
    `opts.nodeExecutionId?: string` (`engine-driver.interface.ts:89`, `execution-engine.service.ts:4852`)
  - 기존 사용처(동일 의미 — NodeExecution row PK, usage-log 귀속 키):
    - `spec/2-navigation/4-integration.md:831` — `ActivityItem.nodeExecutionId: UUID?` = `integration_usage_log.node_execution_id`
    - `spec/2-navigation/4-integration.md:1074` — "엔진은 각 노드 실행 직전 `ExecutionContext.nodeExecutionId`를 주입하여 usage 로그의 귀속을 보장한다"
    - `spec/3-workflow-editor/3-execution.md:422,426` — WS 이벤트 payload 의 `nodeExecutionId` (NodeExecution row 1:1 대응 식별자)
    - `spec/4-nodes/4-integration/0-common.md:76` — `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, ...})`
    - `spec/3-workflow-editor/4-ai-assistant.md:236,1443`, `spec/4-nodes/3-ai/1-ai-agent.md:719` — 동일 의미 재사용
    - 코드: `codebase/backend/src/nodes/core/node-handler.interface.ts:51` — `ExecutionContext.nodeExecutionId?: string` (기존 필드, 이번 diff 대상 아님)
  - 상세: diff 는 이 기존 필드와 **동일한 이름·동일한 의미**(NodeExecution row PK → usage-log 귀속)를 resume/retry 재구성 경로에 재주입하도록 복원한다. 신규 개념이 아니라 이미 spec 이 SoT 로 규정한 필드를 회귀 이전 상태로 되돌리는 수정이다. `spec/2-navigation/4-integration.md:1074` 문구("엔진은 각 노드 실행 직전 주입")와 코드 주석("nodeExecutionId 는 노드 단위 값이라 context 가 운반하지 않으므로...")은 언뜻 상충해 보이나, 전자는 **정상 라이브 dispatch 경로**(매 노드 실행 직전 세팅), 후자는 **checkpoint 로부터 재구성된 resume 경로**(그 세팅 사이클을 안 거침)를 가리켜 서로 다른 코드 경로에 대한 설명이라 모순이 아니다. 이름 충돌 아님.
  - 제안: 없음 (정합). 참고로 코드 주석의 `(§1.3)` 인용은 4-execution-engine.md §1.3("블로킹/재개 컨트랙트")이 아니라 §6.2("저장 전략")/§7.2("체크포인트 기반 Resume")를 가리키는 것으로 보이는 앵커 부정합 가능성이 있으나, 이는 **신규 식별자 충돌**이 아닌 **cross-reference 정확성** 관점이라 별도 checker(anchor/cross-reference) 소관으로 넘긴다.

- **[INFO]** `#501` 은 요구사항 ID 가 아니라 PR/커밋 참조 번호 — 확립된 관례와 일치
  - target 신규 식별자: 코드 주석·테스트명의 `#501`
  - 기존 사용처: `git log` 커밋 `5e0c5e449 feat(execution-engine): PR-B2b ... (#501)`, `fbad181e2 fix(execution-engine): resume 턴 통합 usage-log attribution 복원 (#501 회귀)`, `plan/in-progress/fix-resume-turn-usage-log-attribution.md`, `plan/complete/exec-park-polish.md`, `plan/complete/exec-park-b2a-followup.md`
  - 상세: `#501` 은 spec 요구사항 ID 체계(`WH-MG-XX`, `NF-OB-XX` 등)와 별개인 GitHub PR 번호이며, 모든 참조처가 동일 PR(중첩 sub-workflow durable resume, exec-park D6)을 가리켜 일관적이다. 요구사항 ID 로 오인될 여지 없음.
  - 제안: 없음.

### 기타 점검 관점 (엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로)

- 엔티티/DTO/인터페이스 신규 도입 없음 — 기존 `ReentryStateDriver` opts 타입에 optional 필드 1개 추가일 뿐.
- API endpoint 신규/변경 없음.
- webhook/queue/SSE 이벤트명 신규 도입 없음.
- ENV var·config key 신규 도입 없음(`CREDENTIAL_CONTEXT_FIELDS`, `resumeStateSchema` 는 spec 미참조 구현 내부 상수이며 신규 식별자와 이름 충돌 대상 자체가 spec 에 없음).
- spec 파일 경로 변경 없음(`구현 대상 spec 영역: (없음)` — 이번 PR 은 target spec 문서를 건드리지 않음).

## 요약

이번 변경은 spec 문서 자체를 수정하지 않는 순수 버그 수정(#501 회귀 복원)이며, 유일하게 새로
등장하는 필드명 `nodeExecutionId` 는 `spec/2-navigation/4-integration.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/4-integration/0-common.md`, `spec/3-workflow-editor/4-ai-assistant.md`,
`spec/4-nodes/3-ai/1-ai-agent.md` 및 기존 `ExecutionContext.nodeExecutionId` 코드 필드 전반에서
이미 "NodeExecution row PK / usage-log 귀속 키"로 확립된 이름을 **정확히 동일한 의미**로
재사용한다. 새 요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로 중 어느 것도 신규
도입되지 않았으므로 신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING 이 없다.

## 위험도
NONE
