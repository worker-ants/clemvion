# 아키텍처(Architecture) 리뷰

## 발견사항

### 백엔드

- **[INFO]** `listMemories` 는 두 번의 DB 쿼리(rows SELECT + COUNT) 를 사용하고, `listScopes` 는 단일 `COUNT(*) OVER()` 윈도우 쿼리로 통합되어 있다. 동일 서비스 내 페이지네이션 구현 전략이 일치하지 않는다.
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` — `listMemories` (L441~516) vs `listScopes` (L368~431)
  - 상세: `listScopes` 는 CTE + `COUNT(*) OVER()` 단일 패스로 total 을 집계하는 반면, `listMemories` 는 rows 쿼리 후 별도 `COUNT(*)` 쿼리를 추가로 실행한다. 같은 서비스 내에서 동일 문제를 두 가지 방식으로 해결해 이후 유지보수자에게 혼선을 줄 수 있다.
  - 제안: `listMemories` 도 `COUNT(*) OVER()` 패턴으로 단일 쿼리 통합 (또는 코드 주석으로 의도적 불일치 이유 명시).

- **[INFO]** `AgentMemoryController` 가 구체 클래스 `AgentMemoryAdminService` 에 직접 의존한다. NestJS 관행상 허용되나, 인터페이스/추상 클래스 없이 구체 타입 의존은 테스트 교체성이 약간 낮다.
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` — L46 `constructor(private readonly adminService: AgentMemoryAdminService)`
  - 상세: NestJS DI 자체가 추상화를 제공하므로 실제 문제는 아니나, 추후 admin 서비스를 확장하거나 교체할 때 컨트롤러 코드도 변경해야 하는 구조다.
  - 제안: 현재 규모에서는 INFO 수준. 서비스가 복잡해질 경우 `IAgentMemoryAdminService` 토큰+인터페이스 도입 고려.

- **[INFO]** `clearScope` 엔드포인트에서 `@Res({ passthrough: true })` 로 Express `Response` 를 직접 주입해 `X-Deleted-Count` 헤더를 설정한다. 이는 컨트롤러에 HTTP 응답 조작 책임이 일부 포함되는 구조다.
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` — `clearScope` (L153~183)
  - 상세: `passthrough: true` 덕분에 NestJS 인터셉터는 유지된다. 단, 플랫폼을 Express 에 명시적으로 묶고, 추후 Fastify 마이그레이션 시 교체 지점이 된다. 더 추상적인 접근(커스텀 인터셉터 or 헤더 설정 헬퍼)이 가능하지만 단일 헤더를 위한 과도한 추상화가 될 수 있다.
  - 제안: 현재 규모에서는 수용 가능. 헤더 응답 패턴이 여러 엔드포인트로 확산될 경우 커스텀 `@SetHeader` 인터셉터 도입 검토.

### 프론트엔드

- **[INFO]** `ScopeListPanel` (10개) 과 `MemoryListPanel` (11개) 의 Props 수가 많다. 상태·콜백이 모두 부모(`AgentMemoryPage`)에 집중되어 prop-drilling 구조를 형성한다.
  - 위치: `codebase/frontend/src/app/(main)/agent-memory/components/scope-list-panel.tsx` — `ScopeListPanelProps`; `memory-list-panel.tsx` — `MemoryListPanelProps`
  - 상세: 현재 구조(page=오케스트레이터, 패널=순수 표현)는 Container/Presenter 패턴을 정확히 따른다. Props 수가 많은 것은 이 패턴의 트레이드오프이며, 테스트 용이성 측면에서는 오히려 유리하다. 단, Props 객체 그룹화(예: `queryState: { isLoading, isError, hasNextPage, isFetchingNextPage }`)가 가독성을 높일 수 있다.
  - 제안: 단기에는 수용 가능. 패널이 더 복잡해지면 Props 를 논리 그룹으로 묶거나 컨텍스트(React Context) 분리 검토.

- **[INFO]** `KIND_META` / `KIND_OPTIONS` / `FALLBACK_KIND_CLASS` / `kindBadgeClass` 가 `page.tsx` 에서 `memory-list-panel.tsx` 로 이동했다. `KIND_OPTIONS` 는 export 되어 있으나, 이 상수들이 `agent-memories.ts` API 타입(`MemoryKind`)과 중복 정의를 형성한다.
  - 위치: `codebase/frontend/src/app/(main)/agent-memory/components/memory-list-panel.tsx` — L8~28
  - 상세: `KIND_OPTIONS: MemoryKind[]` 는 API 레이어의 `MemoryKind = "fact" | "preference" | "entity"` 를 배열로 반복한다. 타입과 배열이 분리되어 있어 새로운 kind 추가 시 두 곳을 모두 수정해야 한다.
  - 제안: `KIND_OPTIONS` 를 `api/agent-memories.ts` 에서 `as const` 배열로 관리하고 `MemoryKind` 를 거기서 파생하거나, 별도 상수 파일로 단일 진실 관리.

## 요약

이번 변경은 `AgentMemoryService` 에서 admin read/delete 책임을 `AgentMemoryAdminService` 로 분리하고(SRP), 프론트엔드 모놀리식 `page.tsx` 를 `ScopeListPanel` / `MemoryListPanel` 로 분해(Container/Presenter)하며, `X-Deleted-Count` 헤더 기반 멱등 삭제 UX를 계층 전반에 걸쳐 일관되게 구현하는 작업이다. 계층 책임 분리(컨트롤러-서비스-데이터), 모듈 경계(admin 서비스 비공개), 의존 방향(컨트롤러→admin 서비스만 주입), 순환 참조 없음 등 핵심 아키텍처 기준을 모두 충족한다. `listMemories` 의 2-쿼리 패턴이 `listScopes` 의 단일 윈도우 쿼리와 불일치하는 것이 유일한 설계 일관성 결함이나, 기능 정확성에는 영향이 없다. 전반적으로 아키텍처 품질은 양호하다.

## 위험도

LOW
