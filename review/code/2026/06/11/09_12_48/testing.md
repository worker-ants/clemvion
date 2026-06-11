# Testing Review

## 발견사항

### [INFO] `it.each` 확장으로 role hierarchy 회귀 커버리지 향상
- 위치: `unsearchable-banner.test.tsx` lines 1077–1088 (변경 hunk)
- 상세: 기존 `admin` 단일 케이스에서 `["admin", "owner"]` 두 역할을 `it.each`로 파라미터화해 커버리지를 확장했다. `owner` 역할에 대한 회귀 보호가 추가된 점은 긍정적이다.
- 제안: 현재 변경사항 자체에는 문제 없음.

### [INFO] `viewer` 역할에서 null role (비인증) 케이스 미커버
- 위치: `unsearchable-banner.test.tsx` — `setRole` 헬퍼는 `null`을 지원하나 미사용
- 상세: `setRole(null)`(비인증/로그아웃 상태)에서 배너 렌더링 여부를 검증하는 테스트가 없다. `RoleGate`가 `null`을 어떻게 처리하는지(CTA 숨김 여부)를 명시적으로 검증하지 않는다.
- 제안: `setRole(null)` 케이스를 추가해 비인증 상태에서 CTA 미노출을 명시 검증.

### [WARNING] `STATE_CONFIG` 확장 가능성 — 새 `reembedStatus` 값 추가 시 테스트 누락 위험
- 위치: `unsearchable-banner.tsx` `STATE_CONFIG` + `unsearchable-banner.test.tsx`
- 상세: `ReembedStatus = KnowledgeBaseData["reembedStatus"]`가 현재 `"idle" | "in_progress"` 두 값이라 `Record<ReembedStatus, ...>` 테이블이 컴파일 타임 완전성을 보장한다. 그러나 API 타입에 세 번째 값(예: `"failed"`)이 추가될 때 테스트 파일에는 새 상태에 대한 케이스가 자동으로 추가되지 않는다. 테스트 측은 컴파일 가드 없이 수동 관리 의존.
- 제안: 테스트에 상태 배열 completeness 검증을 추가하거나, `it.each` 로 `STATE_CONFIG`의 키를 동적으로 열거해 각 상태에 대한 렌더 스모크 테스트를 실행하는 패턴 고려.

### [INFO] `page.tsx` 변경은 주석만 수정 — 테스트 대상 변경 없음
- 위치: `knowledge-bases/[id]/page.tsx` lines 567–569 (변경 hunk)
- 상세: 실제 렌더링 로직 변경은 없으며, 코드 주석에 "출처가 의도적으로 다르며 배너는 KB 자체 상태만 반영"이라는 설명이 추가됐다. 이 주석이 설명하는 동작(배너는 `kb.reembedStatus`를, 진행 박스는 `embeddingStats.reembedStatus`를 참조)은 기존 동작이며 테스트 갭을 신규 생성하지 않는다.
- 제안: 해당 변경에 대한 추가 테스트 불필요.

### [WARNING] KB 상세 페이지(`[id]/page.tsx`)에 대한 통합 테스트 부재
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/` — 디렉터리 내 `__tests__` 없음
- 상세: KB 상세 페이지(`KnowledgeBaseDetailPage`)에 대한 테스트가 전혀 없다. `UnsearchableBanner` 렌더 조건(`kb.embeddingDimension == null`)이 페이지 레벨에서 실제로 적용되는지 — 즉 `embeddingDimension`이 `null`일 때 배너가 마운트되고 `not null`일 때 마운트되지 않는지 — 를 검증하는 테스트가 없다.
- 제안: `[id]/__tests__/kb-detail-page.test.tsx`를 추가해 최소한 `embeddingDimension == null` 조건 분기(배너 노출/비노출)를 커버하는 smoke 테스트 작성 권장.

### [INFO] `pending` prop이 `undefined`(기본값)일 때 동작 테스트 존재
- 위치: `unsearchable-banner.test.tsx` — `pending` 미전달 케이스 다수
- 상세: 대부분의 테스트가 `pending` prop 없이 렌더하며 `pending={true}` 케이스(`idle + editor + pending`)도 별도 케이스로 존재한다. `pending=false` 명시 케이스는 없으나 의미상 `undefined`와 동일하므로 갭이 아님.
- 제안: 현재 수준으로 충분.

### [INFO] `in_progress` + `editor` 조합에서 버튼이 없음을 검증하는 기존 테스트가 유효
- 위치: `unsearchable-banner.test.tsx` 테스트 "in_progress: shows 're-embedding…' progress text, no CTA"
- 상세: 리팩터링 후 `showCta: false` 로직이 `STATE_CONFIG`로 이동했으나, 기존 테스트가 동일 동작을 검증하므로 회귀가 발생하지 않는다. `in_progress` 상태에서 버튼 없음, 아이디어 경고 텍스트 없음이 모두 검증됨.
- 제안: 현재 테스트로 충분.

### [INFO] `cleanup()` 호출 방식 — `beforeEach`에서 명시적 cleanup
- 위치: `unsearchable-banner.test.tsx` line 115 (`beforeEach` 블록)
- 상세: `cleanup()`을 `beforeEach`에서 수동 호출하는 패턴은 vitest + `@testing-library/react`에서 `afterEach` 자동 cleanup이 기본 설정된 경우 중복일 수 있다. 단, 명시적 호출은 자동 cleanup 미설정 환경에서 안전망 역할을 하므로 해롭지 않다.
- 제안: 프로젝트 vitest 설정에서 `globals: true` + `@testing-library/jest-dom` 설정 확인 후 불필요하면 제거 고려 (필수 아님).

---

## 요약

`unsearchable-banner.test.tsx`의 변경은 `admin` 단일 케이스를 `["admin", "owner"]` 파라미터화 테스트로 확장해 역할 계층 회귀 커버리지를 적절히 높였다. `unsearchable-banner.tsx`의 리팩터링(이중 삼항 → `STATE_CONFIG` 테이블)에 대응하는 기존 테스트들은 동작을 충분히 검증하며 회귀 위험은 낮다. 주된 갭은 두 가지다: (1) KB 상세 페이지 레벨에서 `embeddingDimension == null` 조건 분기를 검증하는 통합 테스트가 전혀 없고, (2) `STATE_CONFIG` 키(reembedStatus 유니온)가 확장될 때 테스트 측에는 completeness 보장이 없어 수동 추가에만 의존한다. 변경 자체의 결함은 없으나 페이지 레벨 테스트 부재는 향후 배너 조건 변경 시 회귀를 감지하지 못할 위험을 내포한다.

## 위험도

LOW
