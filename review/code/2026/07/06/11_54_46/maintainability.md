# 유지보수성 리뷰 — /triggers 딥링크 소비 (c75077ec5)

대상: `codebase/frontend/src/app/(main)/triggers/page.tsx`
비교 기준: `origin/main...HEAD`

## 발견사항

- **[INFO]** `useSearchParams` import 위치가 관례상 그룹핑과 어긋남
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx:48`
  - 상세: 같은 코드베이스의 다른 페이지(`models/page.tsx:4`, `integrations/page.tsx:5`, `use-page-param.ts:4`)는 `next/navigation` 계열 훅을 파일 최상단 import 그룹(React/Next 프레임워크 import 블록)에 모아 배치한다. 이번 변경은 `import { useSearchParams } from "next/navigation";`를 파일 하단부, `@/lib/api/triggers`와 `@/lib/hooks/use-page-param` 사이(로컬 모듈 import들 틈)에 끼워 넣어 시각적으로 프레임워크 import 와 로컬 import 가 분리되어 있던 기존 구획을 흐트러뜨린다.
  - 제안: `useSearchParams` import 를 파일 상단 React/Next 계열 import 근처(또는 향후 `usePathname`/`useRouter`가 필요해질 경우를 대비해 한 줄로 통합 가능한 위치)로 옮겨 일관성을 회복한다. 기능에는 영향 없는 스타일 이슈.

- **[INFO]** `usePageParam`과의 관계가 이름만으로는 드러나지 않음
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx:164-167` vs `codebase/frontend/src/lib/hooks/use-page-param.ts`
  - 상세: 같은 파일 안에 URL 파라미터를 다루는 두 가지 서로 다른 패턴이 공존한다 — `usePageParam()`(매 렌더 시 URL을 재조회해 페이지 번호와 동기 유지, `router.replace`로 양방향 반영)과 신규 `useState(() => searchParams.get("triggerId"))`(마운트 1회 seed, 이후 URL과 독립, drawer close 시에도 URL 미정리). 두 패턴이 왜 다른지는 주석으로 설명되어 있어 읽으면 이해 가능하지만, 향후 유지보수자가 "왜 `selectedTriggerId`는 `usePageParam`처럼 훅으로 추출하지 않았는가"를 궁금해할 수 있는 지점. 현재 규모(단일 페이지, 단일 사용처)에서는 훅 추출이 오버엔지니어링이라 문제 삼을 정도는 아님.
  - 제안: 별도 조치 불요. 딥링크 seed 패턴이 다른 페이지에서도 재사용되기 시작하면 그때 `useDeepLinkParam` 류 훅으로 추출 검토.

## 각 검토 관점별 평가

1. **`useSearchParams` 직접 import + `useState(() => ...)` 지연 초기화 적절성**: 적절하다. `usePageParam`은 URL을 "지속적으로 동기화해야 하는 상태"(페이지 번호, 뒤로가기/새로고침에도 유지)로 다루는 반면, 이번 딥링크 요구사항은 "최초 진입 시 1회 seed 후 URL과 무관하게 로컬 UI 상태로 전환"이라는 명확히 다른 의미론이다. `useEffect(() => setSelectedTriggerId(searchParams.get("triggerId")), [])` 같은 effect-내-setState로 구현했다면 불필요한 리렌더 1회 + effect 의존성 lint 이슈(빈 배열 lint 경고 억제 필요)가 발생했을 것이다. 지연 초기화 함수(`useState(() => ...)`)는 React 공식 관용구로, 마운트 시 정확히 1회만 평가되는 것이 보장되어 "1회 소비, 이후 독립"이라는 요구를 가장 단순하고 부작용 없이 만족시킨다. effect-내-setState 룰 회피가 아니라 애초에 effect가 필요 없는 케이스를 올바르게 식별한 것.

2. **주석의 정확성**: 정확하다. 주석은 "마운트 시 1회 URL 파라미터를 초기 selection 으로 소비한다(이후 사용자 조작은 URL 과 독립)"이라고 명시하며, 실제 구현(`useState` 지연 초기화, drawer `onClose`가 `setSelectedTriggerId(null)`만 호출하고 URL은 건드리지 않음)과 정확히 일치한다. 과장되거나 실제 동작과 어긋나는 서술 없음.

3. **`searchParams` null 가능성**: Next.js App Router의 `useSearchParams()`는 client component에서 `ReadonlyURLSearchParams`(URLSearchParams 서브클래스)를 반환하며 `null`을 반환하지 않는다(`.get()`은 키가 없을 때 `null`을 반환하는 것이지 `searchParams` 자체가 null이 되는 게 아님). 코드의 `searchParams.get("triggerId")`는 안전하다. Suspense boundary 부재로 인한 정적/스트리밍 렌더링 이슈는 이론상 존재하지만 같은 저장소의 `models/page.tsx`, `integrations/page.tsx`도 동일하게 Suspense 없이 `useSearchParams`를 사용하는 기존 패턴이므로, 이번 변경이 새로 도입한 유지보수성 결함은 아니다(기존 관례를 그대로 따름).

## 요약

변경은 작고 목적이 분명하며, 코드베이스에 이미 존재하는 "URL 파라미터를 읽는" 관용구(`usePageParam`)와 의도적으로 다른 의미론(1회 seed vs 지속 동기화)을 정확히 구분해 적용했다. 지연 초기화 `useState` 사용은 이 요구사항에 대한 올바르고 관용적인 React 패턴이며, 주석은 실제 동작과 일치한다. 유일한 지적 사항은 import 배치의 사소한 일관성 문제로 기능적 영향은 없다.

## 위험도

NONE
