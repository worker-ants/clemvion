# API 계약(API Contract) 리뷰 결과 (RE-VERIFY)

## 재검증 대상

이전 라운드 WARNING: `GET /api/workspaces/:id/settings` 응답 + `WorkspaceSettingsDto` Swagger 스키마에 신규 `maxConcurrentExecutions` 필드가 누락되어 PATCH/GET round-trip 이 비대칭(설정은 되나 조회로 재확인 불가)하다는 지적.

## 재검증 결과: 해결 확인 (RESOLVED)

다음 두 지점 모두에서 `maxConcurrentExecutions` 가 반영되어 있음을 diff 및 워크트리 실파일 대조로 확인했다.

1. **서비스 응답 (`getWorkspaceSettings`)** — `codebase/backend/src/modules/workspaces/workspaces.service.ts:368-402`
   - 반환 타입 시그니처에 `maxConcurrentExecutions?: number` 추가됨 (L370-374).
   - `workspace.settings?.maxConcurrentExecutions` 를 읽어(L394) `typeof cap === 'number'` 가드 후 반환 객체에 조건부 스프레드로 포함(L401).
   - PATCH 경로(`updateWorkspaceSettings`, L353-359)의 병합 로직과 대칭 — `dto.maxConcurrentExecutions !== undefined` 일 때만 병합, 미제공 시 기존 값 보존.

2. **Swagger 스키마 (`WorkspaceSettingsDto`)** — `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:41-49`
   - `@ApiProperty({ type: Number, required: false, example: 10, description: '워크스페이스당 동시 실행(running Execution) 상한 (미설정 시 기본 10, §8)' }) maxConcurrentExecutions?: number;` 필드 추가 확인.
   - 컨트롤러(`workspaces.controller.ts:184`)가 `@ApiOkWrappedResponse(WorkspaceSettingsDto, ...)` 로 이 DTO 를 GET 엔드포인트의 응답 스키마로 참조하므로, 서비스 실반환값과 Swagger 문서가 일치한다.

두 지점 모두 워크트리 실제 파일 내용을 직접 읽어 diff 와 동일함을 재확인했다(stale diff 아님). 인가(GET 은 멤버 read, PATCH 는 `assertAdmin`)에도 변경 없이 기존 가드가 그대로 적용된다.

## 잔여 관찰 사항 (참고용, 비차단)

- **[INFO]** Workflow-level `maxConcurrentExecutions` 는 이번 변경 범위에 여전히 API 쓰기 표면(DTO)이 없음 (workspace 쪽만 노출). Admission 로직(`execution-engine.service.ts`)은 `workflow.settings` 도 읽지만 `PATCH /api/workflows/:id` 쪽에는 검증된 전용 필드가 없어 `Record<string, unknown>` passthrough 로만 설정 가능. 기존에 이미 알려진 스코프 축소이며 이번 재검증 대상은 아니다. 필요 시 후속 PR 에서 workspace 와 동일한 패턴(`@IsInt @Min(1)` 전용 필드)으로 정합을 맞출 것을 권장.
- **[INFO]** `timezone` 필드는 `getWorkspaceSettings` 서비스 리턴에는 포함되지만 `WorkspaceSettingsDto` Swagger 스키마에는 여전히 선언돼 있지 않음(`workspace-response.dto.ts` 확인 — `timezone` `@ApiProperty` 없음). 이는 이번 PR 이전부터 있던 기존 gap 으로, 금번 diff 의 변경 대상이 아니며 `maxConcurrentExecutions` 재검증과는 무관하다. 별도 이슈로 향후 정리 권장(차단 아님).

## 결론

지적된 WARNING(PATCH/GET round-trip 비대칭)은 코드 수정으로 해소되었다. 재검증 시점 기준 신규 CRITICAL/WARNING 없음.

STATUS: SUCCESS
