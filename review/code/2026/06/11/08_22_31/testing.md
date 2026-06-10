# Testing Review

## 발견사항

### [INFO] `pending=true` 상태(CTA 비활성화) 테스트 미존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`
- 상세: `UnsearchableBanner`는 `pending` prop이 `true`일 때 버튼을 `disabled` 처리하고 Loader2 아이콘으로 교체한다. 그러나 이 `pending=true` 브랜치를 검증하는 테스트 케이스가 없다. `unsearchable-banner.tsx` 64~67행의 `disabled={pending}` 및 Loader2 조건 분기가 테스트에서 누락된 코드 경로다.
- 제안: `it("idle + editor + pending: CTA is disabled", ...)` 케이스를 추가해 `pending={true}` 렌더 시 버튼이 `disabled` 속성을 가지는지 확인한다.

### [INFO] `owner`/`admin` 역할에 대한 CTA 노출 명시적 테스트 없음
- 위치: `unsearchable-banner.test.tsx`
- 상세: `setRole` 헬퍼가 `"owner" | "admin" | "editor" | "viewer" | null` 타입을 모두 지원하나, 실제 테스트는 `editor`와 `viewer` 두 케이스만 다룬다. `RoleGate(minRole="editor")` 계층(editor < admin < owner)에서 admin·owner도 CTA가 노출되어야 하는데 명시적 검증이 없다. 현재 `RoleGate` 구현 특성상 editor 케이스가 통과하면 admin/owner도 통과하지만, 의도를 문서화하는 테스트로서의 가치는 낮다.
- 제안: 낮은 우선순위이나, `admin` 또는 `owner` 역할로도 CTA가 보이는 케이스를 단 1개라도 추가하면 역할 계층 변경 시 회귀 탐지가 명확해진다.

### [INFO] `role=null`(미인증/워크스페이스 없음) 케이스 미검증
- 위치: `unsearchable-banner.test.tsx`
- 상세: `RoleGate`는 `role`이 `null`이면 fallback(기본 `null`)을 렌더한다. `setRole(null)`로 워크스페이스 미설정 상태를 만들면 CTA가 렌더되지 않아야 한다. `viewer` 케이스로 간접 보증은 되지만 명시적 케이스가 없다.
- 제안: `it("no workspace role: banner text visible but no CTA", ...)` 케이스를 추가한다. 중요도는 낮다.

### [INFO] 설명 텍스트(desc 단락) 렌더 검증 없음
- 위치: `unsearchable-banner.test.tsx`
- 상세: `unsearchable-banner.tsx`의 `<p>` 단락(`unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc`)은 현재 테스트에서 전혀 검증되지 않는다. 제목 텍스트만 `getByText`로 확인하고 설명 단락은 누락. i18n 키 오타 등으로 설명이 빠져도 테스트가 통과한다.
- 제안: 각 상태 케이스에 `screen.getByText(/excluded from search/)` 또는 `screen.getByText(/in progress/)` 정도의 desc 텍스트 검증을 추가한다.

### [INFO] `page.tsx`의 배너 조건 분기(게이트)에 대한 페이지 레벨 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` (570~575행)
- 상세: `[id]/page.tsx`의 `UnsearchableBanner` 연동(embeddingDimension == null 게이트, onReembed → setShowKbReEmbedConfirm, pending 전달)은 별도 테스트 없이 component 단위 테스트에만 의존한다. 해당 디렉토리(`[id]/`)에 `__tests__` 폴더 자체가 없다. `knowledge-bases-page.test.tsx`는 목록 페이지(`/knowledge-bases`)를 테스트하며 상세 페이지와 무관하다. embeddingDimension이 null인 KB 상세 진입 시 배너 노출 → "Re-embed entire KB" 버튼 클릭 → ConfirmModal 열림 흐름이 통합 레벨에서 검증되지 않는다.
- 제안: `[id]/__tests__/knowledge-base-detail-page.test.tsx`를 신설해 최소한 (1) embeddingDimension=null 시 배너 노출, (2) embeddingDimension≠null 시 배너 비노출, (3) 배너 CTA 클릭 → ConfirmModal 열림 흐름을 커버한다. 다만 해당 페이지가 매우 큰 컴포넌트임을 감안하면, 최소 smoke 테스트 수준이라도 추가 가치가 있다.

### [INFO] `useWorkspaceStore.getState().reset()` 호출 순서 잠재적 오해
- 위치: `unsearchable-banner.test.tsx` 18~22행 (beforeEach)
- 상세: `beforeEach`에서 `cleanup()` 후 `useWorkspaceStore.getState().reset()`을 호출하는데, 각 테스트 케이스는 `setRole()`을 `beforeEach` 이후에 개별 호출한다. 순서 자체는 올바르다. 다만 `reset()`이 store를 완전히 초기화하지 않고 `loaded: false`로만 되는 경우 RoleGate가 null 처리를 할 수 있으므로 `reset()` 구현에 따른 암묵적 의존성이 있다. 현재 동작은 이상 없으나 store 구현 변경 시 테스트 격리 보장이 명시적이지 않다.
- 제안: `useWorkspaceStore.setState(...)` 직접 초기화로 교체하거나 reset() 의미를 주석으로 명시해 의도를 명확히 한다.

---

## 요약

`UnsearchableBanner` 컴포넌트에 대한 단위 테스트(4종)는 핵심 동작(idle+editor CTA 노출/클릭, viewer CTA 숨김, in_progress 진행 표시, X 버튼 부재)을 잘 커버한다. TDD 선작성이 적절히 이루어졌고 테스트 격리와 가독성도 양호하다. 주요 갭은 세 가지다: (1) `pending=true` 브랜치가 단위 테스트에서 누락, (2) `[id]/page.tsx`의 배너 게이트·CTA 배선을 검증하는 페이지 레벨 테스트 부재, (3) 배너 내 설명 단락(desc) 렌더 미검증. 이 중 (2)가 회귀 위험도 측면에서 가장 크며, (1)은 추가 비용이 낮아 즉시 보완 가능하다. 전반적으로 컴포넌트 테스트 품질은 충분하나 통합 연동 경로 커버리지에 갭이 있다.

## 위험도

LOW
