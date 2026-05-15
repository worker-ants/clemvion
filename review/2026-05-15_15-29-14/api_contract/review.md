### 발견사항

---

**[WARNING] 알림 `resourceType` 변경 — 기존 소비자 breaking change**
- 위치: `background-execution.processor.ts` — `dispatchFailureNotification()` 변경부
- 상세: background 실패 알림의 `resourceType`이 `'execution'` → `'background_run'`으로 변경됨. 기존에 `resourceType: 'execution'`으로 필터링하던 클라이언트(알림 목록, 읽음 처리, 외부 웹훅 등)는 이후 발생하는 background 실패 알림을 수신하지 못함. 레거시 알림(`resourceType: 'execution'`)은 `fetchNotifications`가 `resourceType: 'background_run'`만 조회하므로 모니터링 API 응답의 `notifications`에도 표시되지 않음 — 이전 실패 이력 누락.
- 제안: `notifications` 필드에서 레거시 attribution(`resourceType: 'execution'`)도 OR 조건으로 조회하거나, CHANGELOG/마이그레이션 가이드에 명시적 breaking change 표기. `resourceType` 변경 전에 기존 알림 컨슈머 목록을 확인할 것.

---

**[WARNING] `cancelled` 상태가 타입에 존재하지만 구현에서 도달 불가**
- 위치: `background-run-response.dto.ts` L5, `background-runs.service.ts` — `deriveBackgroundRunStatus()`
- 상세: `BackgroundRunStatus` 타입과 Swagger `@ApiProperty` enum에 `'cancelled'`가 포함되어 있으나, `deriveBackgroundRunStatus()`는 `pending | running | completed | failed` 중 하나만 반환. spec §8.2에 `maxDurationMs` 초과를 `cancelled` 원인으로 명시했지만, 현재 processor는 타임아웃 시 `'failed'`로만 emit. API 계약 상 `cancelled`를 기대하는 클라이언트는 영구히 이 값을 받지 못함.
- 제안: (a) 타임아웃 처리 로직을 추가해 `cancelled` 반환을 구현하거나, (b) 현 구현 범위에서는 타입·enum·spec에서 `cancelled`를 제거하고 이후 PR에서 추가.

---

**[WARNING] 역할(Role) 인가 미구현 — spec과 불일치**
- 위치: `background-runs.controller.ts`, `background-runs.service.ts` — `verifyExecutionAccess()`
- 상세: spec §8.4는 "Editor 이상 멤버 또는 실행 시작자"만 조회 가능으로 규정. 현재 구현은 워크스페이스 소속 여부(`workflow.workspaceId === userWorkspaceId`)만 확인하고 역할을 검증하지 않음. Viewer 권한 멤버도 조회 가능한 상태. spec이 문서화한 403 `FORBIDDEN_BACKGROUND_RUN` 응답도 현재 코드에서 반환되지 않음.
- 제안: 기존 execution 엔드포인트의 RBAC 가드 패턴(`@Roles()` 또는 서비스 레이어 역할 검증)을 동일하게 적용. 또는 접근 정책을 "워크스페이스 멤버 전체 허용"으로 공식적으로 변경하고 spec을 수정.

---

**[WARNING] `BackgroundExecutionJob.backgroundRunId` 필드 — 큐 직렬화 호환성**
- 위치: `background-execution.queue.ts` — `BackgroundExecutionJob` 인터페이스
- 상세: `backgroundRunId`가 `string` (required, non-optional)으로 추가됨. BullMQ는 job payload를 Redis에 JSON으로 직렬화하므로, 이 필드 없이 이미 큐에 적재된 기존 job은 역직렬화 후 `backgroundRunId: undefined`가 됨. TypeScript 타입은 `string`을 요구하지만 런타임에서는 `undefined` 전달 가능. processor가 `if (!data.backgroundRunId) return` 패턴으로 방어하고 있어 실행은 되지만, 타입 계약과 런타임 동작이 불일치.
- 제안: `backgroundRunId: string` → `backgroundRunId?: string` 또는 `backgroundRunId: string | undefined`로 타입을 수정해 실제 런타임 동작을 반영.

---

**[INFO] cursor 내부 키 명세와 주석 불일치**
- 위치: `query-background-run.dto.ts` JSDoc, `background-runs.service.ts` — `CursorPayload` 인터페이스
- 상세: DTO 주석은 `{ lastCreatedAt, lastId }`로 cursor 구조를 설명하지만, 실제 구현은 `{ s: string; i: string }` (s=ISO8601 startedAt, i=NodeExecution.id)를 사용. 정렬 기준도 `createdAt`이 아닌 `startedAt`. 클라이언트가 cursor 내용을 파싱하면 안 되지만(opaque), 내부 문서가 구현과 다르면 유지보수 혼란 유발.
- 제안: DTO 주석을 `{ s: ISO8601 startedAt, i: NodeExecution.id }`로 수정.

---

**[INFO] spec §8.7의 403 코드 vs 구현의 일관된 404 처리**
- 위치: spec `12-background.md §8.7`, `background-runs.service.ts`
- 상세: spec은 "워크스페이스 비멤버 또는 Editor 미만"에 대해 403 `FORBIDDEN_BACKGROUND_RUN`을 명시하나, 구현은 IDOR 차단 목적으로 모든 접근 불가 케이스에 404를 반환. 두 동작 중 하나가 옳지만 spec과 구현이 다른 HTTP 코드를 약속하고 있어 API 계약 문서로서 신뢰도 저하.
- 제안: spec §8.7에서 403 항목을 제거하고 "워크스페이스 미소속 포함 모든 권한 실패 → 404 (IDOR 차단)" 정책을 명시적으로 기술.

---

### 요약

신규 Background 모니터링 API(`GET /executions/:executionId/background-runs/:backgroundRunId`) 자체는 RESTful URL 설계, cursor 기반 페이지네이션, ParseUUIDPipe 입력 검증, Swagger 문서화 등 API 계약 관점의 기본 요건을 대체로 잘 충족한다. 그러나 기존 background 실패 알림의 `resourceType` 변경은 기존 알림 소비자에게 조용한 breaking change를 유발하며, `cancelled` 상태가 타입 계약에는 존재하지만 구현에서 도달 불가능한 상태로 방치되어 있다. 역할 기반 인가(Editor+ 제한)가 spec에 명시되어 있음에도 구현되지 않았고, BullMQ job 직렬화 호환성도 타입 계약과 불일치한다. 추가 엔드포인트나 기존 엔드포인트의 응답 구조 자체는 변경되지 않아 하위 호환성 리스크는 알림 attribution 변경에 집중된다.

### 위험도

**MEDIUM**