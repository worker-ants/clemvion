# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `TriggerListParams.type` / `status` 타입 narrowing — 호출부 호환성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` 인터페이스
- 상세: `type?: string` → `type?: "webhook" | "schedule" | "manual"`, `status?: string` → `status?: "active" | "inactive"` 로 좁혔다. 기존에 `string` 타입으로 임의 값을 넘기던 호출부가 있다면 typecheck 에러가 발생할 수 있다. 단, 커밋 메시지가 "typecheck PASS" 로 명시하고 있으며, 허용 범위를 좁히는 방향은 런타임 동작 변경 없이 컴파일 타임 안전성을 높이는 것이므로 의도치 않은 부작용으로 보기 어렵다.
- 제안: 없음. 의도적 narrowing이고 typecheck PASS 확인됨.

### [INFO] `triggersApi.create` — `Promise<void>` 반환으로 응답 바디 소실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `create` 함수
- 상세: `await apiClient.post("/triggers", body)` 의 응답값을 버린다. 이번 변경 전부터 동일한 동작이었고(behavior-preserving), 현재 호출부는 queryKey 무효화로 목록 재조회하므로 실제 부작용 없다. 다만 향후 생성된 ID 를 즉시 활용하는 UX 추가 시 시그니처 변경이 필요하다.
- 제안: JSDoc 에 이미 "응답 바디는 버린다 — 호출부가 `triggers` queryKey 무효화로 재조회한다" 가 추가되어 의도가 명시됨. 현재 단계에서 부작용 없음.

### [INFO] 테스트 파일 `vi.mock("../client", ...)` — 모듈 전역 모킹 범위
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/__tests__/triggers.test.ts` — `vi.mock("../client", ...)` 블록
- 상세: `vi.mock` 은 Vitest 의 모듈 레지스트리를 교체한다. 단, 이 파일은 독립 테스트 파일이며 `beforeEach(() => vi.clearAllMocks())` 가 선언되어 각 테스트 간 mock 상태가 초기화된다. 타 테스트 파일의 `apiClient` 모킹에는 영향을 주지 않는다(Vitest 는 파일 단위 격리). 의도치 않은 전역 상태 오염 없음.
- 제안: 없음.

### [INFO] `page.tsx` 주석 추가 — 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/page.tsx` — 라인 226–227 추가 주석
- 상세: 주석 2줄 추가만으로 런타임 동작·렌더링·쿼리에 일체 영향 없음.
- 제안: 없음.

---

## 요약

이번 변경(M-8 1단계 review fix)은 순수 behavior-preserving 리팩터의 후속 강화 커밋이다. 실질적 코드 변경은 (1) `TriggerListParams.type`/`status` 리터럴 유니온 narrowing(typecheck PASS 확인), (2) `triggersApi.create` JSDoc 추가(시그니처 무변경), (3) `page.tsx` 에 설명 주석 2줄 추가, (4) `triggers.test.ts` 신규 테스트 파일 추가다. 전역/공유 상태 변경, 파일시스템 부작용, 환경 변수 접근, 예상치 못한 네트워크 호출, 이벤트/콜백 변경은 전혀 없다. 공개 API 시그니처(`triggersApi` 객체의 모든 메서드)는 기존과 완전히 동일하게 유지된다. 기존 호출부(`page.tsx`, `trigger-detail-drawer.tsx`)에 영향을 미치는 변경이 없으므로 의도치 않은 부작용 위험은 없다.

---

## 위험도

NONE
