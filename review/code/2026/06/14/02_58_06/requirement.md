# 요구사항(Requirement) Review

## 발견사항

### **[WARNING]** `hasActiveFilters` 가 `sortKey` 비기본값을 포함하지 않음
- 위치: `/codebase/frontend/src/app/(main)/workflows/page.tsx` 라인 332–336
- 상세: `hasActiveFilters` 계산식이 `sortKey !== "created"` 를 포함하지 않는다. 비기본 정렬 옵션이 선택된 상태에서 결과가 0건이면 EmptyState 는 "Reset Filters" 버튼이 아니라 "Create Workflow" 버튼을 표시한다 — 정렬을 필터로 인식하지 못하기 때문. `handleResetFilters` 는 `setSortKey("created")` 를 이미 올바르게 포함하고 있어 리셋 로직 자체는 완전하지만, 발동 경로가 빠져 있다. 사용자는 정렬 옵션만 바꾸고 결과가 없을 때 안내를 받지 못한다.
- 제안: `hasActiveFilters` 에 `sortKey !== "created"` 조건을 추가한다.

```ts
const hasActiveFilters =
  !!debouncedSearch ||
  filter !== "all" ||
  sortKey !== "created" ||
  (isTeamWorkspace && ownership !== "all");
```

---

### **[INFO]** `last_run` 이 `PaginationQueryDto.sort` 의 `@Matches` 정규식 통과 여부
- 위치: `/codebase/backend/src/common/dto/pagination.dto.ts` 라인 59 + `workflows.service.ts` 라인 1442
- 상세: `sort` 필드는 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 로 검증되며 `last_run` 은 이 패턴을 만족한다. 서비스 코드에서 `sort === 'last_run'` 을 명시적으로 처리하므로 `getSortColumn` 화이트리스트 폴백 전에 분기된다 — SQL injection 없이 정상 동작. 다층 방어가 일관적으로 작동함.

---

### **[INFO]** `[SPEC-DRIFT]` spec §2.4 테이블 "구현 상태" 컬럼 — "이름순" 방향 표기 변경
- 위치: `spec/2-navigation/1-workflow-list.md` §2.4 정렬 테이블 + `/codebase/frontend/src/app/(main)/workflows/page.tsx` `SORT_OPTIONS`
- 상세: 구 spec 은 "이름순 → 오름차순/내림차순(양방향)" 으로 기술했으나, 신규 구현 `SORT_OPTIONS` 에서 `name` 은 `order: "asc"` 고정(단방향) 으로 구현됐다. spec 은 이미 갱신 PR 에서 "이름순 | 오름차순" 단방향으로 정정됐다 — 코드와 spec 이 이미 일치함. 코드 되돌리기 불필요. 이 항목은 추가 갱신 필요 없음을 확인하는 INFO.

---

### **[INFO]** `[SPEC-DRIFT]` spec §2.4 에 "기본 외 옵션에만 sort/order 송신" 최적화 미기재
- 위치: `spec/2-navigation/1-workflow-list.md` §2.4 + `page.tsx` 라인 153–114
- 상세: 구현은 `sortKey !== "created"` 일 때만 `params.sort` / `params.order` 를 추가하고, 기본값(`created_at` desc)은 파라미터 없이 서버 기본값에 위임한다. spec §2.4 본문은 이 최적화를 "기본 외 옵션 선택 시에만 파라미터를 보낸다" 고 이미 기술하고 있어 코드·spec 일치. 추가 조치 불필요.

---

### **[INFO]** `last_run` subquery 정렬 시 `NULLS LAST` 방향 한정 문제
- 위치: `workflows.service.ts` 라인 1446–1450
- 상세: `NULLS LAST` 는 `ASC` / `DESC` 양방향에 동일하게 적용된다. UI 는 현재 `lastRun` 을 `order: "desc"` 고정으로 노출하나, backend API 상으로는 `order=asc` 도 허용된다. `ASC NULLS LAST` 는 "미실행 워크플로를 오름차순 정렬에서도 마지막" — 직관적으로 합리적. 양방향 모두 `NULLS LAST` 를 적용하는 것은 의도적 설계로 보임. spec §2.4 는 "미실행 워크플로는 NULLS LAST" 만 명시하고 방향 한정 언급 없음 — 일치.

---

### **[INFO]** spec §2.4 정렬 테이블 갱신이 PR 내 spec 파일 변경에 포함됨
- 위치: `spec/2-navigation/1-workflow-list.md` diff
- 상세: §2.4 정렬 테이블이 "미구현" 상태에서 "구현 완료" 로 정확히 갱신됐다. spec 본문과 구현이 line-level 로 일치한다.

---

### **[INFO]** 테스트 — injection 폴백 케이스의 DTO 레벨 차단 가능성
- 위치: `workflows.service.spec.ts` 라인 335–346 + `pagination.dto.ts` 라인 59
- 상세: 테스트는 `sort: 'name; DROP TABLE workflow;--'` 를 직접 서비스 메서드에 전달한다. 실제 요청 경로에서는 `PaginationQueryDto` 의 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 가 이 입력을 DTO 레벨에서 400 으로 먼저 차단한다. 즉 서비스 레벨 폴백 테스트는 "DTO 검증 통과 후 서비스 단독 단위 테스트" 로 유효하며, 다층 방어를 검증하는 의미 있는 케이스다. 중복 방어가 의도적임을 주석으로 보완하면 가독성이 높아지나 기능상 결함은 없다.

---

## 요약

이번 변경은 spec §2.4 의 정렬 UI/백엔드 미구현 갭 두 항목을 완전히 구현했다. 백엔드 `findAll` 에 `last_run` correlated subquery 정렬(NULLS LAST, 고정 문자열 — injection 안전), frontend `NativeSelect` 드롭다운, i18n(ko/en), 단위 테스트(3케이스), spec 본문 갱신, plan 체크박스 전환이 모두 포함됐다. 주요 발견사항은 `hasActiveFilters` 에서 `sortKey` 비기본값 조건 누락(WARNING)이며, 정렬된 상태에서 결과가 없을 때 EmptyState 가 잘못된 CTA 를 표시한다. 나머지 항목은 INFO 수준이다.

## 위험도

LOW
