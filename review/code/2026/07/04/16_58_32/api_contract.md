# API 계약(API Contract) Review

## 발견사항

- **[WARNING]** `GET /api/workspaces/:id/settings` 응답에 신규 `maxConcurrentExecutions` 필드 누락 (PATCH/GET 왕복 비대칭)
  - 위치:
    - `codebase/backend/src/modules/workspaces/workspaces.service.ts:368-386` (`getWorkspaceSettings`)
    - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:36-44` (`WorkspaceSettingsDto`)
    - `codebase/backend/src/modules/workspaces/workspaces.controller.ts:177-199` (`GET :id/settings`)
    - vs `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:39-59` (`UpdateWorkspaceSettingsDto.maxConcurrentExecutions`)
    - `codebase/backend/src/modules/workspaces/workspaces.service.ts:350-357` (`updateWorkspaceSettings` 저장 로직)
  - 상세: `UpdateWorkspaceSettingsDto` 에 `maxConcurrentExecutions`(양의 정수, `@IsInt` `@Min(1)`)가 추가되어 `PATCH /api/workspaces/:id/settings` 로 설정 가능해졌고, `updateWorkspaceSettings()` 는 이를 `workspace.settings.maxConcurrentExecutions` 에 병합 저장한다. 그런데 조회 전용 `getWorkspaceSettings()` 는 여전히 `interactionAllowedOrigins` 와 `timezone` 만 명시적으로 골라 반환하고 `maxConcurrentExecutions` 는 리턴 객체 구성에서 빠져 있다. 결과적으로 클라이언트가 PATCH 로 cap 을 설정해도 `GET :id/settings` 로 그 값을 확인할 방법이 없다(PATCH 응답은 `settings: ws.settings` 전체를 그대로 반환하므로 PATCH 직후 응답에는 보이지만, 이후 GET 조회 시에는 사라지는 비대칭). Swagger 스키마(`WorkspaceSettingsDto`)에도 필드가 선언돼 있지 않아 API 문서상으로도 확인 불가능하다. 설정 화면에서 "현재 값 표시"가 목적인 GET 엔드포인트가 실제로는 새로 추가한 동시성 cap 값을 숨기는 형태가 되어, 사용자가 설정한 cap 을 UI 에서 재확인·재로드할 수 없는 실질적 UX/계약 결함이다.
  - 제안: `getWorkspaceSettings()` 리턴 타입에 `maxConcurrentExecutions?: number` 를 추가하고 `workspace.settings?.maxConcurrentExecutions` 를 (타입 가드 후) 포함시킨다. `WorkspaceSettingsDto` 에도 `@ApiPropertyOptional` 로 필드를 추가해 Swagger 스키마를 동기화한다. (참고: `timezone` 역시 서비스 리턴에는 있으나 `WorkspaceSettingsDto` 스키마에는 없는 기존 gap이 존재 — 이번 기회에 함께 정리 권장.)

- **[INFO]** Workflow-level `maxConcurrentExecutions` 는 이번 변경분에 API 표면(DTO/서비스) 자체가 없음
  - 위치: spec 표 `spec/5-system/4-execution-engine.md:1076` (`Workflow.settings.maxConcurrentExecutions` — `PATCH /api/workflows/:id`, Editor+)
  - 상세: admission gate 코드(`execution-engine.service.ts` `admitExecutionOrDefer`)는 `workflow?.settings` 로부터 `resolveConcurrencyCap` 을 호출해 workflow cap 도 읽지만, 이번 diff 에는 workflow 쪽 PATCH DTO(`update-workflow` 계열)에 해당 필드를 노출하는 변경이 포함되어 있지 않다(리뷰 대상 파일 목록에 workflow DTO 파일 없음). 즉 workflow 관리자는 API 로 `maxConcurrentExecutions` 를 직접 설정할 방법이 아직 없고 시스템 기본값(3)만 적용된다. 이는 이번 PR 의 의도된 스코프 축소일 수 있으나(백엔드 enforcement 우선 구현, DTO 노출은 workspace 만 우선), spec 표는 두 레벨 모두 API 로 설정 가능하다고 서술하므로 workflow 쪽 DTO 는 후속 PR 에서 반드시 짝을 맞춰야 한다.
  - 제안: 후속 작업으로 `UpdateWorkflowDto`(또는 동등 workflow settings DTO)에 동일한 `maxConcurrentExecutions` 필드·검증(`@IsInt` `@Min(1)`)을 추가하고, spec §8 표와 일치시킨다. 이번 PR 범위에서 벗어난다면 plan 문서에 잔여 작업으로 명시할 것.

- **[INFO]** `resolveConcurrencyCap` 은 `undefined`/`null`/미양의정수 입력을 모두 조용히 defaultCap 으로 fallback — 클라이언트에 유효성 실패 피드백 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:56-64` (`resolveConcurrencyCap`)
  - 상세: 이 함수 자체는 admission gate 내부에서 저장된(이미 DTO 검증을 통과한) `settings.maxConcurrentExecutions` 를 읽는 방어적 파서이므로, 요청 검증 관점에서는 문제 없음 — `UpdateWorkspaceSettingsDto` 의 `@IsInt` `@Min(1)` 이 PATCH 요청 단계에서 이미 이를 보장한다. 다만 과거에 DTO 검증 없이 직접 DB 에 기록된 legacy `settings` row(비정수·0·음수 값)가 있다면 이 함수가 조용히 기본값으로 대체하므로 "설정한 값이 실제로 적용되는지" 를 클라이언트가 인지하기 어렵다. Critical 은 아니며 현재 신규 경로에서는 발생하지 않는다.
  - 제안: 별도 조치 불필요(신규 경로는 DTO 가 보장). 참고 사항으로만 기록.

- **[INFO]** 에러 응답 형식 일관성은 양호
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1193-1236` (`markQueueWaitTimeout`)
  - 상세: 큐 대기 타임아웃 취소는 기존 `EXECUTION_CANCELLED` 이벤트 경로·`{ code, message }` 에러 포맷(`ExecutionError` 계약, spec §7.5 rehydration cancel 과 동일 패턴)을 재사용한다. 신규 HTTP 엔드포인트가 아니라 WS/이벤트 경로이므로 HTTP 상태 코드 영향 없음. 기존 `ExecutionError` 계약과 일관되게 고정 client-safe 메시지를 사용해 문제 없음.

## 요약

이번 변경은 새 HTTP 엔드포인트를 추가하지 않고 기존 `PATCH /api/workspaces/:id/settings` 에 `maxConcurrentExecutions` 필드를 하위 호환적으로(optional, 미제공 시 기존 동작 보존) 추가한 것으로 breaking change 는 없다. 요청 검증(`@IsInt` `@Min(1)`)도 적절하다. 다만 동일 리소스의 GET 엔드포인트(`getWorkspaceSettings` / `WorkspaceSettingsDto`)가 새로 추가된 설정 필드를 응답에 포함하지 않아 PATCH 로 설정한 값을 GET 으로 재확인할 수 없는 왕복 비대칭이 있다 — 클라이언트(설정 화면)가 새로고침 시 저장된 cap 값을 잃어버리는 실질적 문제로 이어질 수 있어 WARNING 등급으로 반영한다. 또한 spec §8 표가 요구하는 workflow-level `maxConcurrentExecutions` API 노출은 이번 diff 범위 밖으로 보이며, 후속 PR 에서 짝을 맞출 필요가 있다(INFO). 그 외 버전 관리·URL 설계·인증/인가·페이지네이션 관점에서는 특이사항 없음.

## 위험도

MEDIUM
