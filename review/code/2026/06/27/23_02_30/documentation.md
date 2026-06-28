# 문서화(Documentation) Review

## 발견사항

### [INFO] `agentMemoriesApi` 객체 내 JSDoc 불일치 — `clearScope` 만 문서화
- 위치: `codebase/frontend/src/lib/api/agent-memories.ts` — `listScopes`, `listMemories`, `remove` 메서드
- 상세: `clearScope` 에는 JSDoc이 추가됐으나 같은 객체 내 나머지 세 메서드(`listScopes`, `listMemories`, `remove`)는 주석 없음. API 클라이언트 진입점 함수들이 혼재된 문서화 수준을 보인다.
- 제안: `listScopes` / `listMemories` / `remove` 에도 파라미터·반환값·spec 참조(AGM-12/13) 한 줄 JSDoc 추가 또는 `clearScope` 수준으로 통일. 최소한 `remove` 는 `deleteMemory` 와 다른 이름이므로 "단건 hard delete" 의미임을 한 줄 명시 권장.

### [INFO] `@ApiHeader` schema 타입 부정확 — `type: 'integer'` vs 실제 문자열 헤더
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` 내 `clearScope` 메서드의 `@ApiHeader` 데코레이터
- 상세: HTTP 응답 헤더는 항상 문자열이다. 컨트롤러는 `res.setHeader('X-Deleted-Count', String(deleted))` 로 문자열을 전송하지만 Swagger 스펙에는 `schema: { type: 'integer' }` 로 선언돼 있다. OpenAPI 코드 생성기가 이를 소비할 경우 실제 string 을 기대하는 코드가 숫자 타입으로 생성될 수 있어 잠재적 혼란 원인이 된다.
- 제안: `schema: { type: 'string', example: '5', description: 'string-encoded integer' }` 로 수정하거나, `description` 필드에 "문자열 인코딩된 정수" 임을 명시.

### [INFO] `AgentMemoryModule` JSDoc에 `AgentMemoryAdminService` 미언급
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.module.ts` 모듈 클래스 상단 JSDoc
- 상세: 모듈 주석은 `AgentMemoryService`(저장·회수·forgetting)와 BullMQ 큐에 대해서만 설명하고, 이번에 추가된 `AgentMemoryAdminService`(admin read/delete surface) 에 대한 언급이 없다. 새 기여자가 providers 목록만 보고 각 서비스의 책임을 파악해야 한다.
- 제안: 모듈 JSDoc 마지막에 "관리(조회·삭제) surface 는 `AgentMemoryAdminService` — SRP 분리, §6 AGM-12/13" 한 줄 추가.

### [INFO] `ScopeListPanelProps` / `MemoryListPanelProps` 콜백 prop 문서 부재
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/scope-list-panel.tsx`, `memory-list-panel.tsx`
- 상세: 인터페이스에 컴포넌트 수준 JSDoc이 있으나 개별 prop, 특히 `onRequestClearScope: (scope: AgentMemoryScopeData) => void`, `onRequestDeleteMemory: (id: string) => void` 같은 콜백 시그니처에 대한 설명이 없다. 부모(`AgentMemoryPage`)에서 어떤 side effect(모달 열기, mutation 트리거 등)가 예상되는지 명확하지 않다.
- 제안: 각 콜백 prop 위에 한 줄 인라인 주석(`/** 삭제 확인 모달을 열기 위해 부모가 제공한다 */`) 추가. 의무적이진 않으나 컴포넌트가 공용화될 때 온보딩에 도움.

### [INFO] `KIND_OPTIONS` export 사유 주석 부재
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/memory-list-panel.tsx` — `KIND_OPTIONS` 상수
- 상세: `KIND_OPTIONS` 가 `export` 로 선언돼 있으나 왜 내보내는지(부모 사용, 테스트 접근 등) 설명이 없다. 내부 상수라면 `export` 제거가 맞고, 부모/테스트에서 필요하다면 그 이유를 주석으로 남겨야 한다.
- 제안: `// page.tsx 가 kindFilter 초기값 목록으로 참조` 등 한 줄 주석 또는 `export` 제거 검토.

### [INFO] `system-status.e2e-spec.ts` 큐 추가 이유 인라인 주석 부재
- 위치: `codebase/backend/test/system-status.e2e-spec.ts`, `EXPECTED_QUEUE_NAMES` 배열 내 `'workspace-invitations-pruner'` 추가 라인
- 상세: 파일 상단 주석("큐 추가 시 본 목록도 갱신")이 안내를 제공하지만, 어느 PR·티켓에서 이 큐가 등록됐는지 표시가 없다. 다른 항목들(예: `'alerts-evaluator'`)도 동일하게 주석 없이 나열된다.
- 제안: 선택적. 변경된 줄 뒤에 `// W7 — WorkspaceInvitationsPrunerService (trigger-review-deferred-fixes)` 한 줄 추가 시 미래 유지보수자가 추적 가능.

---

## 요약

전체적으로 이번 변경은 문서화 수준이 높다. 신규 `AgentMemoryAdminService` 클래스와 모든 공개 메서드에 spec 섹션 참조·격리 의무·동작 계약을 명시한 JSDoc이 완비됐고, 컨트롤러의 `@ApiHeader`·`@ApiOperation` Swagger 데코레이터가 새 `X-Deleted-Count` 동작을 API 문서 수준에서도 커버한다. 프론트엔드 신규 컴포넌트(`ScopeListPanel`, `MemoryListPanel`) 는 인터페이스·컴포넌트 JSDoc을 갖추고, `clearScope` API 클라이언트 변경도 JSDoc으로 설명된다. 발견된 사항은 모두 INFO 등급으로, `@ApiHeader schema.type` 의 기술적 부정확(string vs integer)이 가장 주목할 만하지만 런타임 동작에는 영향이 없다.

## 위험도

LOW
