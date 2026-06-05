# 부작용(Side Effect) 코드 리뷰

대상 diff: `9f30216f..HEAD`
리뷰 일시: 2026-06-05
리뷰어: side-effect-reviewer

---

## CRITICAL

없음.

---

## WARNING

### [WARNING-1] clearScope — 대상 없어도 204 반환 (멱등성 vs 잠재적 오조작 은폐)

- **위치**: `agent-memory.controller.ts` `clearScope` 핸들러 (line 156–169), `agent-memory.service.ts` `clearScope` (line 650–658)
- **상세**: `DELETE /agent-memories?scopeKey=<key>` 는 해당 scope 의 메모리가 0건이어도 204 No Content 를 반환한다. 반환값(`deletedCount`)을 컨트롤러가 버리기 때문에 클라이언트는 실제 삭제 여부를 알 수 없다. `deleteMemory` 단건 삭제가 `affected === 0` 을 404로 변환하는 것과 일관성이 없다. 존재하지 않는 scopeKey 를 잘못 입력해도 성공 응답이 나오며, UI(toast "scope 의 메모리를 모두 삭제했어요")가 오표시된다.
- **제안**: 스펙 §6 의도가 "idempotent bulk delete" 이면 현 동작을 문서화하고 UI toast 를 "삭제 요청 전송됨" 수준으로 낮추거나, 또는 `deletedCount` 를 204 body/헤더(`X-Deleted-Count`)로 전달해 0건임을 UI 가 별도 안내할 수 있도록 개선한다.

### [WARNING-2] WorkspaceId 데코레이터 — X-Workspace-Id 헤더 클라이언트 스푸핑 허용 (pre-existing, 신규 노출 증가)

- **위치**: `workspace.decorator.ts` line 14–15; 신규 노출: `agent-memory.controller.ts` 전 라우트
- **상세**: `@WorkspaceId()` 는 `X-Workspace-Id` 헤더를 JWT 보다 우선한다. 인증된 사용자가 헤더에 타 워크스페이스 ID 를 임의로 입력하면 다른 워크스페이스의 scope/memory 를 열람(GET)할 수 있다. 단, `GET` 은 `@Roles` 가 없어 RolesGuard 가 workspaceId 검증을 수행하지 않고, 서비스 SQL 의 `workspace_id = $ws` 필터만이 cross-workspace 데이터 노출을 막는다. `DELETE` 에는 `@Roles('editor')` 가 있어 RolesGuard 가 해당 workspaceId 의 멤버십을 확인하므로 삭제 경로는 추가 방어가 있다. GET 경로는 헤더 조작으로 타 워크스페이스 scope 목록을 조회할 수 있는 가능성이 있다.
- **제안**: 이 패턴은 기존 여러 컨트롤러(executions, background-runs 등)와 동일하며 pre-existing 이슈이나, GET 엔드포인트에 최소한 `@Roles()` (viewer+) 를 명시적으로 붙여 RolesGuard 가 workspaceId 멤버십을 검증하도록 강화하는 것을 권고한다.

---

## INFO

### [INFO-1] AgentMemoryService 기존 메서드/시그니처 — 변경 없음 확인

- **위치**: `agent-memory.service.ts` 전체
- **상세**: 이번 diff 에서 추가된 메서드(`listScopes`, `listMemories`, `deleteMemory`, `clearScope`)는 서비스의 기존 메서드(`scheduleExtraction`, `resolveScopeKey`, `recall`, `saveMemories`)에 대해 시그니처 변경, 반환값 변경, 내부 상태 변경이 없다. 기존 호출부(`ai-agent.handler.ts`: `recall/resolveScopeKey/scheduleExtraction`, `agent-memory-extraction.processor.ts`: `saveMemories`) 는 영향 없다.

### [INFO-2] module 등록 변경 — controllers 배열에 AgentMemoryController 추가만

- **위치**: `agent-memory.module.ts` line 28
- **상세**: `providers`, `exports`, `imports` 는 변경 없다. `AgentMemoryService` export 유지. `execution-engine.module.ts` 가 `AgentMemoryModule` 을 import 해 사용하는 `AgentMemoryService` 주입에는 영향 없다.

### [INFO-3] i18n dict index 변경 — additive only, 기존 키 변경 없음

- **위치**: `dict/en/index.ts`, `dict/ko/index.ts`, `dict/en/sidebar.ts`, `dict/ko/sidebar.ts`
- **상세**: 기존 키(`sidebar.authentication`, `sidebar.statistics` 등)를 수정하지 않고 `agentMemory` 네임스페이스와 `sidebar.agentMemory` 키만 추가한다. `Dict` 타입이 `ko` 를 소스 오브 트루스로 쓰는 구조적 패턴이므로 ko/agentMemory.ts 가 추가된 이상 en/agentMemory.ts 가 `Dict["agentMemory"]` 를 만족해야 하며, en 파일이 `Dict["agentMemory"]` 타입 어노테이션을 명시하고 있어 컴파일타임에 검증된다.

### [INFO-4] sidebar.tsx navItems — satisfies 타입 검사로 TranslationKey 불일치 컴파일 오류 보장

- **위치**: `sidebar.tsx` line 120–127
- **상세**: `navItems` 는 `as const satisfies ReadonlyArray<{ labelKey: TranslationKey; ... }>` 로 선언돼 있어 `"sidebar.agentMemory"` 가 `TranslationKey` 에 없으면 컴파일 오류가 발생한다. ko/en 양 dict 에 `agentMemory` 키가 추가돼 있으므로 타입 확인이 보장된다.

### [INFO-5] hard delete 비가역성 — 의도된 동작, 사용자 확인 UI 존재

- **위치**: `agent-memory.service.ts` `deleteMemory`/`clearScope`, `page.tsx` `ConfirmModal`
- **상세**: 두 삭제 메서드는 `DELETE ... RETURNING id` raw SQL 로 영구 삭제한다. soft-delete 컬럼(`deleted_at`)이나 트랜잭션 롤백 경로가 없다. 다른 테이블이 `agent_memory(id)` 를 FK 참조하지 않아 cascade 위험 없다. 프론트엔드는 `ConfirmModal`(`destructive` prop) 로 2-step 확인을 요구한다. 현재 구현은 spec §6 AGM-13 의 hard delete 명세와 일치한다.

### [INFO-6] `DELETE /agent-memories` vs `DELETE /agent-memories/:id` 라우팅 충돌 없음

- **위치**: `agent-memory.controller.ts` `@Delete()` / `@Delete(':id')`
- **상세**: NestJS 는 정적 경로(`DELETE /agent-memories`)와 파라미터 경로(`DELETE /agent-memories/:id`)를 구분하므로 충돌이 없다. 다만 `DELETE /agent-memories` 에 `:id` 없이 `?scopeKey=` 쿼리가 필수인 설계이므로, `scopeKey` 누락 시 class-validator + 방어 코드 두 겹으로 400 이 반환된다.

### [INFO-7] `backend-labels.ts` 추가 — 기존 번역 맵 변경 없음

- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` line 106, 229–231
- **상세**: `LABEL_KO` 에 `"Embedding Model"` 키, `HINT_KO` 에 임베딩 모델 힌트 문자열만 추가. 기존 엔트리 수정 없음. 기존 번역 조회 로직에 영향 없다.

---

## 요약

이번 diff 는 `AgentMemoryService` 에 4개의 신규 read/delete 메서드를 추가하고, 이를 노출하는 `AgentMemoryController` 를 모듈에 등록하며, 프론트엔드 admin UI 페이지와 i18n/sidebar 를 추가하는 순수 additive 변경이다. 기존 저장·회수·추출 경로(`scheduleExtraction`, `recall`, `saveMemories`, `resolveScopeKey`)의 시그니처·반환값·부작용에 대한 변경은 없으며, 기존 호출부(`ai-agent.handler`, `agent-memory-extraction.processor`, `execution-engine.module`)는 영향을 받지 않는다. 주목할 부작용 이슈는 두 가지: (1) `clearScope` 가 0건 삭제 시에도 204 를 반환해 UI 가 오표시할 수 있는 점, (2) GET 엔드포인트에 `@Roles` 미부착으로 헤더 스푸핑 시 cross-workspace 데이터 열람이 가능한 점. 두 이슈 모두 데이터 파괴나 서비스 장애 수준은 아니지만 정보 은닉 측면에서 보강이 권고된다.

---

## 위험도

**LOW**

BLOCK: NO
