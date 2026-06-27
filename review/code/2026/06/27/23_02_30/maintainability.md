# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] 동적 SQL 파라미터 슬롯 이동 패턴 — 유지보수 취약 구조
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` `listScopes` (L381–384), `listMemories` (L461–463)
- 상세: 선택적 필터(`q`, `kind`) 유무에 따라 파라미터 번호(`$2`/`$3`, `$3`/`$4`, `$4`/`$5`)를 문자열 리터럴로 직접 변경하는 패턴을 사용한다. 새 선택적 필터를 추가할 때 `filterSql`, `limitParam`, `offsetParam` 세 곳의 리터럴과 파라미터 배열 순서를 동시에 올바르게 변경해야 한다. 하나라도 어긋나면 런타임 파라미터 바인딩 오류가 발생하며 컴파일 시점에 감지되지 않는다. `listScopes`의 `LIMIT ${limitParam} OFFSET ${offsetParam}` 인터폴레이션도 파라미터화된 쿼리에 템플릿 리터럴을 혼용하는 형태라 처음 읽는 개발자가 SQL injection 리스크를 의심할 수 있어 가독성을 해친다.
- 제안: 파라미터를 배열에 순서대로 push 하고 `$${params.length}`로 슬롯을 동적으로 할당하는 헬퍼 패턴(`buildWhereClause` 등)을 도입한다. 이 패턴은 이미 프로젝트 내 다른 raw SQL 경로에서 사용 가능하며, 필터 추가 시 단일 배열 push 만으로 완결된다.

### [WARNING] `AgentMemoryAdminService.logger` 선언 후 미사용
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` L358
- 상세: `private readonly logger = new Logger(AgentMemoryAdminService.name);` 가 선언되어 있으나 `listScopes`, `listMemories`, `deleteMemory`, `clearScope` 어디에도 `this.logger`를 호출하는 코드가 없다. NestJS `Logger` 인스턴스를 보유하면 향후 로그를 추가할 의도임을 암시하지만, 현재 상태에서는 dead code다.
- 제안: 로그가 필요한 경우(예: 삭제 건수 0 경계 케이스)를 식별하여 실제 호출을 추가하거나, 사용 계획이 없다면 선언을 제거해 코드베이스 잡음을 줄인다.

### [WARNING] 두 패널 컴포넌트의 로딩/에러/빈 상태 렌더 패턴 중복
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/scope-list-panel.tsx` L63–79, `memory-list-panel.tsx` L110–126
- 상세: 두 패널 모두 동일한 구조(`isLoading → Loader2 스피너`, `isError → 오류 문구`, `!isLoading && !isError && items.length === 0 → 빈 상태`)를 JSX로 반복한다. 스피너 크기(`h-5 w-5`), 컨테이너 padding(`py-10`), 에러 색상 클래스까지 동일하다. 세 번째 패널이 추가될 때 동일 패턴이 다시 복사될 위험이 있다.
- 제안: `AsyncListState` 또는 `PanelAsyncContent` 같은 공유 컴포넌트로 추출한다. `isLoading`/`isError`/`isEmpty`/`emptySlot` prop을 받아 분기 렌더를 위임하면 두 패널 모두 단일 컴포넌트 호출로 교체 가능하다.

### [INFO] `page.tsx`에서 패널에 전달하는 `onLoadMore` 인라인 화살표 함수
- 위치: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` L3100, L3114 (diff 기준)
- 상세: `onLoadMore={() => scopesQuery.fetchNextPage()}`, `onLoadMore={() => memoriesQuery.fetchNextPage()}` 가 매 렌더마다 새로운 함수 참조를 생성한다. 현재 패널 컴포넌트가 `React.memo`로 래핑되어 있지 않아 실질적 성능 문제는 없지만, 향후 패널이 메모화되면 불필요한 재렌더를 유발하는 잠재적 함정이 된다.
- 제안: `useCallback`으로 감싸거나, `scopesQuery.fetchNextPage`를 직접 prop으로 전달한다(`onLoadMore={scopesQuery.fetchNextPage}`). `fetchNextPage`는 TanStack Query에서 안정적 참조를 보장한다.

### [INFO] `clearScope` 컨트롤러의 이중 검증 — 의도 명시 부족
- 위치: `codebase/frontend/src/app/(main)/agent-memory/agent-memory.controller.ts` L1160–1165
- 상세: `class-validator`가 `scopeKey` 필수를 1차 검증하는데 컨트롤러가 `!query.scopeKey?.trim()` 로 한 번 더 차단한다. 주석이 이를 설명하지만, 언제 class-validator를 우회하는 빈 문자열이 도달 가능한지 구체적 경로가 명시되지 않는다. 미래 개발자가 "왜 두 번?" 이라는 의문을 갖게 된다.
- 제안: 주석에 "DTO의 `@IsNotEmpty()`는 undefined/null을 잡지만, 공백만으로 구성된 값은 `@IsNotEmpty()`를 통과할 수 있어 방어 추가" 같은 구체적 이유를 기술한다. 또는 DTO에 `@Transform(({ value }) => value?.trim())` + `@MinLength(1)` 조합으로 한 곳에서 해결한다.

### [INFO] `memory-list-panel.tsx`의 `KIND_OPTIONS` 불필요 export
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/memory-list-panel.tsx` L2244
- 상세: `KIND_OPTIONS`가 `export const`로 선언되어 있으나 현재 `page.tsx`를 포함한 외부에서 임포트하는 코드가 없다. `KIND_META`도 동일하다. export는 공개 API 계약을 암시하므로 불필요한 노출은 컴포넌트 경계를 흐린다.
- 제안: 외부에서 실제로 사용하지 않으면 `export` 제거. 향후 다른 컴포넌트가 kind 목록이 필요하다면 `@/lib/api/agent-memories`의 `MemoryKind` 타입 수준에서 도출하는 방향이 더 적절하다.

### [INFO] `agent-memories.ts` clearScope의 `res.headers` 타입 캐스트 패턴
- 위치: `codebase/frontend/src/lib/api/agent-memories.ts` L3309–3311
- 상세: `(res.headers as Record<string, unknown> | undefined)?.[...]` 패턴에서 axios의 `headers`는 실제로 `undefined`가 되지 않으므로 optional chaining이 불필요하다. 또한 `AxiosResponseHeaders` 타입을 직접 활용하지 않고 `unknown`으로 강제 변환해 타입 안정성을 약화시킨다.
- 제안: `const raw = res.headers["x-deleted-count"] as string | undefined;`처럼 실제 axios 타입을 그대로 활용하는 편이 가독성과 타입 신뢰도 모두 높다.

### [INFO] `max-h-[60vh]` 매직 값 두 파일 중복
- 위치: `scope-list-panel.tsx` L2511, `memory-list-panel.tsx` L2349
- 상세: `max-h-[60vh]`가 두 패널에 하드코딩되어 있다. 디자인 변경 시 두 곳을 동시에 수정해야 한다.
- 제안: 공유 Tailwind 플러그인 설정, CSS variable, 또는 공통 wrapper 컴포넌트로 추출해 단일 진실 원칙을 유지한다.

---

## 요약

이번 변경의 핵심인 `AgentMemoryAdminService` SRP 분리와 `page.tsx` 패널 분해는 유지보수성을 크게 개선한 올바른 방향이다. 서비스 JSDoc과 테스트 설명도 충실하며 코드 의도를 잘 전달한다. 다만 `listScopes`/`listMemories`의 조건부 SQL 파라미터 슬롯 이동 패턴은 새 필터 추가 시 오류를 유발하기 쉬운 구조로, 파라미터 빌더 헬퍼로 개선이 필요하다. 프론트엔드 패널 두 개가 공유하는 로딩/에러/빈 상태 JSX 패턴은 추후 세 번째 패널 등장 시 중복이 심화되므로 공통 컴포넌트 추출을 권장한다. 나머지 발견사항들은 코드 동작에 영향을 주지 않는 소규모 정리 사항이다.

## 위험도

MEDIUM
