# Testing Review — impl-workflow-list-gaps

## 발견사항

### **[WARNING]** 프론트엔드 정렬 기능에 대한 단위 테스트 전무
- 위치: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`
- 상세: 이번 PR의 핵심 변경인 `NativeSelect` 정렬 드롭다운(`sortKey` 상태, `SORT_OPTIONS` 매핑, `sort`/`order` 파라미터 송신)에 대한 단위 테스트가 `workflows-page.test.tsx`에 전혀 추가되지 않았다. 기존 테스트는 pagination·ownership·reset CTA만 다룬다.
- 제안: 다음 케이스를 `workflows-page.test.tsx`에 추가한다:
  1. 기본 상태(created)에서 `sort`/`order` 파라미터가 API 호출에 포함되지 않음
  2. "Recently updated" 선택 시 `sort=updated_at&order=desc` 송신
  3. "Last run" 선택 시 `sort=last_run&order=desc` 송신
  4. 정렬 변경 시 `page`가 1로 리셋됨

---

### **[WARNING]** `hasActiveFilters`가 `sortKey`를 반영하지 않아 테스트가 이 논리 버그를 검증하지 않음
- 위치: `/codebase/frontend/src/app/(main)/workflows/page.tsx` 332~335행
- 상세: `hasActiveFilters`는 `sortKey !== "created"` 조건을 포함하지 않는다. 사용자가 정렬을 "Last run"으로 바꾼 후 결과가 비어 있을 때 "Reset Filters" CTA가 나타나지 않고, `handleResetFilters()`가 `setSortKey("created")`를 수행하지만 그 트리거(hasActiveFilters 연계)가 일관성 없이 동작한다. 이 논리 결함을 드러내는 테스트가 없어 회귀로 남는다.
- 제안: `hasActiveFilters`에 `sortKey !== "created"` 조건을 추가하고, 이를 검증하는 테스트를 작성한다:
  - 정렬이 "created" 외 값일 때 빈 결과 → "Reset Filters" CTA 표시
  - "Reset Filters" 클릭 시 정렬이 "created"로 복귀

---

### **[INFO]** backend 단위 테스트: `sort='name'` 및 `sort='updated_at'` 케이스 미검증
- 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- 상세: 새로 추가된 세 테스트(기본 `created_at`, `last_run`, injection fallback)는 핵심 경로를 충분히 다루지만, `sort='name'`, `sort='updated_at'`처럼 `getSortColumn` 화이트리스트 통과 분기를 직접 검증하는 테스트는 없다. 이 경로는 기존 로직(`getSortColumn`)으로 처리되지만, `orderDir` 를 결정하는 `order.toUpperCase() === 'ASC'` 분기는 `order='asc'`인 케이스에서만 테스트되고 기본 `desc` 방향은 암묵적으로만 검증된다.
- 제안: `sort='name', order='asc'` 케이스로 `orderBy('w.name', 'ASC')` 검증을 추가하면 화이트리스트 분기와 order 방향 변환이 모두 커버된다.

---

### **[INFO]** e2e 테스트가 정렬 상호작용을 다루지 않음
- 위치: `codebase/frontend/e2e/workflows/list.spec.ts`
- 상세: 기존 e2e는 렌더, 빈 상태, 검색 debounce만 검증한다. 정렬 드롭다운 표시·선택·API 파라미터 전달은 e2e 레벨에서 미검증 상태다.
- 제안: 필수 e2e는 아니나, "Last run" 옵션 선택 후 `?sort=last_run`이 API 요청 URL에 포함되는지 `requests` 배열로 확인하는 테스트 1건을 추가하면 end-to-end 신뢰도가 높아진다. (기존 검색 테스트 패턴 재사용 가능)

---

### **[INFO]** `last_run` subquery 테스트: `stringContaining`으로 부분 일치 검증 — 서브쿼리 전체 문자열 고정은 없음
- 위치: `workflows.service.spec.ts` 45~59행 (새로 추가된 `last_run` 테스트)
- 상세: `expect.stringContaining('SELECT MAX(e.started_at) FROM execution e WHERE e.workflow_id = w.id')`는 핵심 SQL 부분을 커버하지만, 서브쿼리에 괄호가 포함된 형태(`(SELECT ...)`)인지, 테이블 alias가 일치하는지 전체를 고정하지 않는다. 현재 구현(`'(SELECT MAX(e.started_at) FROM execution e WHERE e.workflow_id = w.id)'`)과는 기능적으로 일치하나, 추후 괄호 제거 등 포맷 변경 시 테스트가 통과해도 런타임 SQL이 달라질 수 있다.
- 제안: 허용 가능한 수준이나, `toHaveBeenCalledWith(expect.stringMatching(/^\(SELECT MAX\(e\.started_at\)/)`, ...)처럼 정규식으로 시작 문자를 고정하면 포맷 회귀에 더 민감해진다.

---

### **[INFO]** i18n 사전 parity 검증 — `sort.*` 키에 대한 ko/en 동기화 테스트 부재
- 위치: `codebase/frontend/src/lib/i18n/__tests__/ui-label-parity.test.ts`
- 상세: 기존 parity 테스트가 `sort.*` 신규 키(5개: `aria`, `createdDesc`, `updatedDesc`, `nameAsc`, `lastRunDesc`)를 자동으로 포함하는지 확인이 필요하다. 파일 내에 sort 관련 키가 보이지 않는다.
- 제안: parity 테스트가 Dict 타입 기반 재귀 비교라면 자동으로 커버된다. 만약 명시적 key list 방식이라면 `sort.*` 키를 추가해야 한다.

---

## 요약

backend 단위 테스트(`workflows.service.spec.ts`)는 이번 변경의 핵심 서버 로직(기본 정렬·`last_run` subquery·injection 폴백)을 적절하게 검증하며, mock 격리·독립 실행·가독성 모두 양호하다. 반면 frontend(`page.tsx`)의 정렬 기능에 대한 단위 테스트가 전혀 추가되지 않아, 정렬 드롭다운의 파라미터 송신 로직·page 리셋·`hasActiveFilters` 미포함 버그가 테스트로 검증되지 않는 공백이 발생한다. 특히 `hasActiveFilters`가 `sortKey !== "created"` 조건을 누락한 논리 결함이 테스트 없이 방치되어 있어 회귀 위험이 있다.

## 위험도

MEDIUM
