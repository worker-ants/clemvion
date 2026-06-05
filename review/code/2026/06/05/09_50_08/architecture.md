# Architecture Review — agent-memory-admin-ui-455467

diff range: `9f30216f..HEAD`
date: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### W-1 서비스의 이중 책임 — admin 조회/삭제 로직이 기존 저장/회수/forgetting 서비스에 공존

- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L479–L658
- **상세**: `AgentMemoryService` 는 현재 두 개의 뚜렷이 다른 책임군을 보유한다.
  1. AI Agent 런타임 경로 — `recall`, `saveMemories`, `scheduleExtraction`, `resolveScopeKey` (hot path, 임베딩/큐 의존)
  2. Admin 관리 경로 — `listScopes`, `listMemories`, `deleteMemory`, `clearScope` (cold path, 임베딩·큐 의존 없음)

  두 책임군은 의존성 집합이 다르다. Admin 메서드는 `LlmService`, `extractionQueue`, `embedOne`, `findSimilarFact`, `evictExpiredAndOldest` 등 런타임 핵심 의존성을 전혀 사용하지 않는다. SRP(단일 책임 원칙) 위반이며, 서비스가 성장하면 응집도 저하가 심화된다.
- **제안**: `AgentMemoryAdminService`(또는 `AgentMemoryQueryService`)를 별도 파일로 추출해 `DataSource`만 주입받도록 분리한다. 컨트롤러가 이 신규 서비스를 주입받고, `AgentMemoryModule`이 둘 다 프로바이더로 등록하면 된다. 현재 코드가 동작에는 문제 없으나 장기 유지보수를 위한 예방적 분리다.

### W-2 페이지네이션 쿼리 파라미터 관례 불일치 — 프로젝트 표준 `page` vs 신규 `offset`

- **위치**: `codebase/backend/src/modules/agent-memory/dto/list-agent-memories.query.ts`, `dto/list-agent-memory-scopes.query.ts`; `agent-memory.controller.ts` L78, L104
- **상세**: 프로젝트의 모든 기존 페이지네이션 쿼리 DTO는 `PaginationQueryDto`(page-based: `page`, `limit`)를 상속하고, 서비스에서 `(page-1)*limit` 으로 오프셋을 파생한다 (`audit-logs`, `integrations`, `workflows`, `schedules`, `executions` 등). 이번 신규 DTO는 독립적으로 `offset`/`limit`을 직접 노출한다. 컨트롤러가 `Math.floor(offset / limit) + 1`로 page를 역산해 `PaginatedResponseDto.create`에 전달하지만, `offset`이 `limit`의 배수가 아닌 경우(예: offset=5, limit=20) page가 1로 고정되어 응답의 `pagination.page` 가 부정확해진다. 프론트엔드는 `useInfiniteQuery` + `offset` 누적 방식을 쓰므로 실질 오류는 발생하지 않지만, 외부 API 소비자가 응답 `pagination.page` 를 신뢰하면 혼란이 생긴다.
- **제안**: `PaginationQueryDto`를 상속하거나 그 관례를 따라 `page`/`limit` 기반으로 통일하고, offset은 서비스 내부에서 파생한다. 프론트엔드 `useInfiniteQuery`의 `pageParam`은 서버에 `page` 번호로 매핑하도록 변경한다. 이미 `useInfiniteQuery` + `getNextPageParam` 로직이 `loaded < totalItems` 조건으로 offset을 순증시키는 구조이므로, `page` 기반으로 전환해도 로직 복잡도는 동일하다.

### W-3 LIMIT/OFFSET 파라미터 번호 동적 분기 — SQL 가독성·유지보수 취약

- **위치**: `agent-memory.service.ts` L521, L573–L601
- **상세**: `listScopes`와 `listMemories`에서 조건 필터(`q`, `kind`) 유무에 따라 `$2`/`$3`/`$4` 등 파라미터 번호를 문자열 삼항 보간으로 동적으로 결정한다 (`LIMIT ${q ? '$3' : '$2'} OFFSET ${q ? '$4' : '$3'}`). 이 패턴은 조건 분기가 추가될 때마다 오류 가능성이 높고, 검토·테스트가 어렵다. SQL 인젝션 위험은 없으나(바인딩 값은 파라미터 배열로 전달), 파라미터 인덱스 불일치 버그는 런타임까지 드러나지 않는다.
- **제안**: 조건별로 파라미터 배열과 SQL 절을 분기 대신, 조건을 고정 배열로 누적하는 helper(`buildParams`)를 도입하거나 QueryBuilder를 활용해 파라미터 번호를 자동 관리한다. 또는 `q`/`kind` 없는 경우를 항상 `NULL`로 바인딩하고 SQL에서 `($N IS NULL OR col = $N)` 패턴을 쓰면 파라미터 번호가 상수로 고정된다.

---

## INFO

### I-1 프론트엔드 페이지 — hook 분리 없이 page 컴포넌트에 data-fetching 직접 구현

- **위치**: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` L60–L117
- **상세**: 기존 `triggers/page.tsx`, `llm-configs/page.tsx` 등도 동일하게 `useInfiniteQuery`/`useMutation`을 page 컴포넌트에 직접 작성하는 패턴을 따른다. 프로젝트 전반의 관례와 일치하므로 불일치 문제는 없다. 단, 화면이 복잡해질 경우(현재 scope 목록 + memories 목록 + 2개 mutation이 단일 컴포넌트) hook을 별도 파일로 추출하면 테스트 가능성과 재사용성이 올라간다.
- **제안**: 현 단계에서는 관례 일치이므로 변경 불필요. 이후 화면에 기능이 추가될 경우 `useAgentMemoryScopes`, `useAgentMemories` custom hook으로 추출을 고려한다.

### I-2 응답 DTO에 `@Expose()` 또는 직렬화 전략 부재

- **위치**: `codebase/backend/src/modules/agent-memory/dto/responses/agent-memory-response.dto.ts`
- **상세**: 기존 `AgentMemoryScopeDto`, `AgentMemoryItemDto`는 `@ApiProperty`만 선언하고 `@Expose()` 가 없다. 프로젝트가 `class-transformer` excludeExtraneous를 전역으로 사용하는지 확인이 필요하다. 현재는 다른 응답 DTO도 동일 패턴을 따르므로 일관성은 있다. embedding 벡터가 절대 직렬화되지 않는 것은 SQL 레벨(`SELECT` 컬럼 명시)에서 보장되어 응답 DTO 직렬화 계층에 의존하지 않는 구조는 적절하다.
- **제안**: 프로젝트 전반 DTO 관례와 일치하므로 별도 조치 불필요.

### I-3 `AgentMemoryResponseDto` 파일에서 `ListAgentMemoriesQueryDto` 역방향 import

- **위치**: `codebase/backend/src/modules/agent-memory/dto/responses/agent-memory-response.dto.ts` L2
- **상세**: 응답 DTO가 쿼리 DTO(`list-agent-memories.query`)의 `AGENT_MEMORY_KINDS` 상수를 import 한다. 논리적으로 `AGENT_MEMORY_KINDS`는 도메인 상수이므로 공유 위치(예: `agent-memory.constants.ts`)에 두고 양쪽 DTO가 참조하는 것이 더 명확한 의존 방향이다. 현재는 하위 디렉토리(`responses/`)에서 상위 디렉토리 파일을 참조하므로 순환 의존성은 없으나 의존 방향이 다소 어색하다.
- **제안**: `AGENT_MEMORY_KINDS`와 `AgentMemoryKind`를 `agent-memory.constants.ts` 또는 `agent-memory.types.ts`로 추출하고 두 DTO가 이를 import하도록 리팩터링한다. 기능 영향은 없으나 명확성 개선이다.

### I-4 프론트엔드 api client — `paginated.ts` 의존 일관성

- **위치**: `codebase/frontend/src/lib/api/agent-memories.ts` L4–5
- **상세**: `normalizePagedResponse`와 `PagedResult` 재사용이 기존 `knowledge-bases.ts` 등 다른 api 클라이언트와 동일한 패턴을 따른다. 일관성 적절.

---

## 요약

이번 diff는 기존 `AgentMemoryService`에 admin 조회/삭제 메서드 4개를 추가하고, 전용 컨트롤러와 DTO 3종, 프론트엔드 page + api client를 구성했다. 컨트롤러-서비스-DTO 계층 분리와 workspace_id 격리 강제 구조는 명확하며 보안 경계가 올바르게 설정되어 있다. 프론트엔드는 기존 프로젝트 패턴(page 컴포넌트에 직접 react-query 사용, lib/api 분리)을 충실히 따른다. 다만 단일 서비스 클래스에 런타임(임베딩/큐)과 admin(순수 SQL) 두 책임군이 공존하는 SRP 이슈(W-1)와, 기존 프로젝트 `page`-기반 페이지네이션 관례를 따르지 않고 `offset`을 직접 노출한 불일치(W-2), 조건 분기 파라미터 번호 동적 보간의 유지보수 취약점(W-3)이 중기 유지보수 리스크로 존재한다. Critical 이슈는 없다.

---

## 위험도

LOW

---

BLOCK: NO
