# 유지보수성 코드 리뷰 — agent-memory admin UI

**diff**: `9f30216f..HEAD`
**리뷰 일시**: 2026-06-05
**리뷰어 역할**: 유지보수성 (maintainability)

---

## CRITICAL

없음.

---

## WARNING

### W-1 · page.tsx 412줄 단일 컴포넌트 — 분해 필요
- **위치**: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` 전체
- **상세**: `AgentMemoryPage` 하나가 412줄에 걸쳐 다음 책임을 모두 포함한다: 상태 관리 6개, infinite query 2개, mutation 2개, 렌더링 로직(Scope 패널 + Memory 패널 + 2개 ConfirmModal). Scope 목록 패널(line 159–255)과 Memory 목록 패널(line 258–375)이 각각 독립적으로 분리 가능하다. 두 패널 모두 `isLoading` 스피너 → `isError` 메시지 → empty state → 아이템 목록 → "Load more" 버튼 구조가 거의 동일하게 중복된다(로딩/에러/empty 블록 각 2쌍, 총 10개 분기). 현재 구조로는 Scope 패널 UI를 수정할 때 Memory 패널 코드를 탐색해야 한다.
- **제안**: `ScopePanelSection`, `MemoryPanelSection` 서브 컴포넌트로 추출하고 쿼리 훅을 각각의 커스텀 훅(`useAgentMemoryScopes`, `useAgentMemories`)으로 분리. 반복되는 로딩/에러/empty 패턴은 공용 `QueryStatusPanel` 헬퍼로 추출.

### W-2 · 동일 switch 로직 두 곳 분산 — `kindBadgeClass` / `kindLabel`
- **위치**: `page.tsx` line 32–43 (`kindBadgeClass`), line 124–135 (`kindLabel`)
- **상세**: 두 함수 모두 `"fact" | "preference" | "entity"` 3가지 케이스를 switch로 분기한다. `kind` 값 추가 시 두 곳을 동시에 수정해야 한다. 이미 `KIND_OPTIONS` 상수로 열거형을 집중 관리하지만 switch 분기는 중복으로 존재한다.
- **제안**: `KIND_META` 레코드(`Record<MemoryKind, { label: string; className: string }>`)로 합산. 예: `const KIND_META: Record<MemoryKind, {...}> = { fact: {...}, preference: {...}, entity: {...} }`. 함수를 `kindMeta(kind).label`, `kindMeta(kind).className`으로 단순화하면 kind 추가 시 한 곳만 수정.

### W-3 · 기본값(limit=30) 세 계층 동시 정의
- **위치**:
  - `dto/list-agent-memory-scopes.query.ts` line 34: `limit?: number = 30`
  - `dto/list-agent-memories.query.ts` line 60: `limit?: number = 30`
  - `agent-memory.controller.ts` line 71, 97: `const limit = query.limit ?? 30`
  - `agent-memory.service.ts` line 501, 569: `const limit = opts.limit ?? 30`
- **상세**: `30`이라는 값이 DTO 기본값, 컨트롤러 fallback, 서비스 fallback 세 곳에 하드코딩되어 있다. 동일 코드베이스의 다른 모듈(`auth/login-history.service.ts`)은 `const DEFAULT_LIMIT = 50`처럼 named constant를 사용한다. `30`을 변경할 때 세 계층을 모두 찾아 수정해야 한다.
- **제안**: `agent-memory.constants.ts` (또는 기존 DTO 파일 상단)에 `export const AGENT_MEMORY_LIST_DEFAULT_LIMIT = 30` 상수 선언 후 세 파일에서 참조. 단, DTO 기본값이 있으면 컨트롤러·서비스의 `?? 30` fallback은 실질적으로 불필요하므로 컨트롤러만 DTO 기본값에 의존하고 서비스 내 `?? 30`은 제거하는 것도 고려.

### W-4 · 동적 SQL 파라미터 번호 수동 계산 — 오류 유발 패턴
- **위치**: `agent-memory.service.ts` line 521 (`listScopes`), line 573–575 (`listMemories`)
- **상세**: 선택적 필터(`q`, `kind`) 유무에 따라 `$2`, `$3`, `$4` 등 파라미터 번호를 삼항 연산자로 수동 변환한다. 예: `LIMIT ${q ? '$3' : '$2'} OFFSET ${q ? '$4' : '$3'}`. 필터 조건이 하나 추가되면 이후 모든 번호를 수동으로 재계산해야 하며 컴파일 타임 검증이 없다. `listMemories`의 count 쿼리(line 612)에도 동일 패턴이 반복된다. TypeORM raw SQL 경로이므로 named parameter 지원이 없지만, params 배열을 동적으로 쌓고 번호를 `params.length`로 추적하는 헬퍼 패턴이 유지보수성에서 유리하다.
- **제안**: 
  ```ts
  const params: unknown[] = [workspaceId];
  let filterSql = '';
  if (q) { params.push(q); filterSql = `AND am.scope_key ILIKE '%'||$${params.length}||'%'`; }
  params.push(limit); const limitPos = params.length;
  params.push(offset); const offsetPos = params.length;
  // SQL: `LIMIT $${limitPos} OFFSET $${offsetPos}`
  ```
  이 패턴은 파라미터 추가 시 번호 재계산이 자동화된다.

### W-5 · `scopes.count` i18n 키를 메모리 총 건수 표시에 재사용
- **위치**: `page.tsx` line 291
- **상세**: 메모리 패널 헤더의 총 건수 표시에 `t("agentMemory.scopes.count", { count: memoryTotal })`를 사용한다. `scopes.count`는 scope 행의 메모리 수를 나타내는 키이며 한국어 사전에서 `"{{count}}건"`이다. 의미적으로 같은 포맷이지만 scope용 키를 memories 카운터에 혼용하면, 향후 scope count 포맷을 변경(`"메모리 {{count}}건"` 등)할 때 메모리 패널 헤더도 의도치 않게 변경된다.
- **제안**: `agentMemory.memories.count` 키를 별도 추가(값은 현재와 동일 `"{{count}}"` / `"{{count}}건"`로 시작해도 무방). 또는 프로젝트 공용 `common.count` 키가 있다면 그것을 사용.

---

## INFO

### I-1 · `page.tsx` 내 CSS 불투명도 표기 불일치
- **위치**: `page.tsx` line 35 vs line 206
- **상세**: 같은 파일 안에서 두 가지 다른 CSS 불투명도 표기가 혼재한다.
  - line 35: `"bg-[hsl(var(--primary)/0.15)]"` — 불투명도가 `hsl()` 함수 **안**에 위치 (CSS Level 4 표준, Tailwind 권장)
  - line 206: `"bg-[hsl(var(--accent))/0.5]"` — 불투명도가 `hsl()` 함수 **밖**에 위치 (두 번째 패턴은 Tailwind arbitrary value `/opacity` 수식자가 아니라 브라우저 CSS로 `hsl(var(--accent)) / 0.5`로 해석되어 렌더링이 다를 수 있음)
  - 코드베이스 전체로도 동일 불일치가 34건(바깥) vs 22건(안쪽)으로 pre-existing하게 분포하므로 이번 PR의 독자적 문제는 아니나, 신규 코드에서도 동일 불일치가 재현되었다.
- **제안**: 신규 코드에서는 `hsl(var(--x)/0.15)` 형식(안쪽)으로 통일. 코드베이스 전체 정규화는 별도 정리 이슈로 처리.

### I-2 · 프론트엔드 `PAGE_SIZE=20` vs 백엔드 DTO `default=30` 불일치
- **위치**: `page.tsx` line 29 (`PAGE_SIZE = 20`) vs `list-agent-memories.query.ts` line 60 (`limit?: number = 30`)
- **상세**: 프론트엔드가 `limit: 20`을 명시적으로 전달하므로 백엔드 기본값이 실제로 적용되지는 않는다. 그러나 두 숫자가 다르면 API 문서 독자나 다른 클라이언트 개발자가 혼란을 겪는다. 의도적 차이라면 주석이 없어 이유를 알 수 없다.
- **제안**: 의도가 같다면 둘 중 하나를 맞춤. 다른 이유(UI 밀도, 성능 등)가 있다면 `PAGE_SIZE` 상수에 주석 추가.

### I-3 · `agentMemory.memories.title` / `memories.createdAt` i18n 키 정의 후 미사용
- **위치**: `codebase/frontend/src/lib/i18n/dict/en/agentMemory.ts` line 19, 23; `ko/agentMemory.ts` 동일
- **상세**: `memories.title: "Memories"`, `memories.createdAt: "Created"` 두 키가 사전에 존재하지만 `page.tsx`에서 `t("agentMemory.memories.title")`, `t("agentMemory.memories.createdAt")`로 참조하는 곳이 없다. `createdAt` 데이터는 백엔드에서 반환되지만 UI에 표시되지 않는다.
- **제안**: 미사용 키를 삭제하거나, 향후 UI에서 사용할 예정이라면 `TODO` 주석 추가. `memories.title`은 향후 패널 헤더로 활용 가능성이 있다.

### I-4 · 에러 처리 일관성 — 서비스 에러 catch 분기 불일치
- **위치**: `agent-memory.service.ts` `recall()` (line 345–349), `findSimilarFact()` (line 710–714) vs `saveMemories()` (line 377–476), `deleteMemory()`, `clearScope()`
- **상세**: `recall`과 `findSimilarFact`는 내부에서 try/catch 후 graceful 반환(빈 배열, null)을 한다. 반면 `saveMemories`의 트랜잭션 내부에서는 embedding 실패 시 `throw new Error('Embedding vector is empty')`로 예외를 전파한다. admin 경로(listScopes, listMemories, deleteMemory, clearScope)는 try/catch 없이 예외를 컨트롤러로 그대로 전파한다. 이 불일치는 의도적이며(핫패스 vs 관리 경로) 각 함수 주석에 근거가 있지만, 신규 기여자가 에러 처리 방침을 파악하기 어렵다.
- **제안**: 서비스 클래스 상단 주석에 에러 처리 방침("hot-path 메서드: graceful catch+warn / admin 조회·삭제 메서드: 예외 전파")을 한 줄로 명시.

---

## 요약

전반적으로 코드는 명확하게 작성되어 있으며, 인터페이스 이름·함수명·SQL 주석 등 문서화 수준이 높다. 가장 큰 유지보수 부담은 `page.tsx`가 412줄 단일 컴포넌트로 Scope 패널과 Memory 패널의 로딩/에러/empty 패턴을 중복 구현한다는 점(W-1)이다. 백엔드에서는 기본값 `30`이 DTO·컨트롤러·서비스 세 계층에 동시 하드코딩된 것(W-3)과 조건부 SQL 파라미터 번호를 삼항 연산자로 수동 계산하는 패턴(W-4)이 향후 필터 추가 시 오류 위험을 높인다. `kindBadgeClass`/`kindLabel` 중복 switch(W-2), `scopes.count` 키 재사용(W-5)은 낮은 위험이나 수정 비용도 낮다. 하드 블로커 수준의 결함은 없으며 기능 정확성에는 영향이 없다.

---

## BLOCK: NO
