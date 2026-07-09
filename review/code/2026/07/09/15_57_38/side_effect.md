# 부작용(Side Effect) 리뷰 — buildEditorHref 콜사이트 slug 회귀 테스트 3곳

대상 커밋: `9a7fb1644e4d0e028fc1db839212cac57cb4d1a8`
대상 파일:
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/usage-node-list.test.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/__tests__/triggers-page.test.tsx` (기존 파일에 테스트 1개 추가)
- `codebase/frontend/src/components/triggers/cards/__tests__/overview-card.test.tsx` (신규)

## 사전 검증

- `git show --stat`으로 커밋 범위를 확인한 결과 변경 파일 3개 전부 `__tests__/*.test.tsx`이며 프로덕션 코드 변경은 0건 — 커밋 메시지의 "production 무변경" 주장과 일치.
- 이 테스트들이 실제로 소비하는 소스(`usage-node-list.tsx`, `overview-card.tsx`, `use-workspace-slug.ts`)를 읽어 `next/navigation`에서 실제 호출하는 것은 `useParams` 하나뿐임을 확인 — 아래 partial mock 이 안전한 이유.

## 발견사항

- **[INFO]** 전역 Zustand 스토어(`useWorkspaceStore`) `setState` 직접 호출 — 파일 내 격리로 안전
  - 위치: `overview-card.test.tsx:601-609` (`beforeEach`), `triggers-page.test.tsx:352-359`의 신규 `it`이 속한 `describe("TriggersPage — RBAC")` 블록의 기존 `setRole`/`reset()` 패턴
  - 상세: `useWorkspaceStore.setState(...)`는 모듈 레벨 싱글턴 스토어를 직접 변경하는 전역 상태 변경이다. `overview-card.test.tsx`는 `afterEach`로 되돌리지 않지만, Vitest 기본값(`isolate: true`, 파일별 별도 모듈 레지스트리)에서는 파일 간 상태 누수가 없고, 해당 파일 안에는 `describe`가 하나뿐이라 파일 내부 오염 위험도 없다. `triggers-page.test.tsx` 쪽은 기존 `describe("TriggersPage — RBAC")`의 `beforeEach`가 이미 `useWorkspaceStore.getState().reset()`을 호출하는 기존 패턴을 그대로 재사용한 것이라 신규 위험이 추가되지 않는다.
  - 제안: 조치 불필요. 다만 향후 `overview-card.test.tsx`에 테스트가 늘어나 여러 `describe`가 생기면 `afterEach(() => useWorkspaceStore.getState().reset())` 추가를 권장.

- **[INFO]** `next/navigation`의 partial `vi.mock` (신규 2개 파일: `usage-node-list.test.tsx`, `overview-card.test.tsx`) — `useParams`만 스텁하고 `useRouter`/`usePathname`/`useSearchParams`는 미제공
  - 위치: `usage-node-list.test.tsx:54-56`, `overview-card.test.tsx:575-577`
  - 상세: 렌더 트리 어딘가(피테스트 컴포넌트 또는 그 하위 UI 컴포넌트)가 `next/navigation`의 다른 export를 호출하면 `undefined is not a function`으로 즉시 실패한다. 실제로 `UsageNodeList`/`OverviewCard`와 그 하위 임포트(`role-gate`, `use-card-edit-toggle`, `ui/card`·`badge`·`button`·`input`)를 확인한 결과 `next/navigation`을 쓰는 곳은 `useWorkspaceSlug` 내부의 `useParams` 하나뿐이라 현재는 안전하다. 또한 이 partial-mock 스타일은 `src/lib/workspace/__tests__/use-workspace-slug.test.tsx` 등 코드베이스 전반에 이미 존재하는 기존 관례라 이번 diff가 새로 도입한 위험이 아니다.
  - 제안: 조치 불필요. 향후 이 컴포넌트들이 `useRouter`/`usePathname` 등을 추가로 쓰게 되면 그때 mock을 확장하면 된다(사전 대응 불필요).

- **[NONE]** 시그니처/공개 API 변경, 파일시스템 부작용, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경
  - 상세: 세 파일 모두 순수 신규/추가 테스트이며 프로덕션 함수 시그니처·공개 인터페이스를 건드리지 않는다. `OverviewCard`의 `useMutation`은 `mutate()` 호출 시에만 발동하는데 신규 테스트는 `mutate()`를 트리거하지 않으므로 마운트만으로 실제/모의 네트워크 호출이 발생하지 않는다(그리고 `@/lib/api/client`도 이 두 신규 파일에서 별도로 모킹하지 않음 — 호출 경로 자체가 없으므로 문제 없음). 파일시스템 쓰기, 환경 변수 읽기/쓰기, 전역 콜백 등록/해제도 없다.

## 요약

세 파일 모두 순수 회귀 테스트 추가/보강이며(커밋 stat로 프로덕션 변경 0건 확인), 부작용 관점에서 실질적 위험은 없다. 전역 Zustand 스토어를 직접 `setState`하는 지점이 있으나 Vitest 파일 격리 및 기존 파일 내 `reset()`/단일 `describe` 구조 덕에 파일 간·테스트 간 오염 가능성은 없다. `next/navigation`의 partial mock도 실제 컴포넌트 의존성 표면과 일치하고 코드베이스 전반의 기존 관례를 따른 것이라 문제되지 않는다. 시그니처·공개 API·네트워크·파일시스템·환경 변수·이벤트 콜백 어느 것도 변경되지 않았다.

## 위험도

NONE
