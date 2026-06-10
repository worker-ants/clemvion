# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 인라인 템플릿 리터럴로 className 동적 조합
  - 위치: `/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L359–363
  - 상세: `className={\`flex flex-wrap ... ${inProgress ? "..." : "..."}\`}` 패턴은 렌더마다 문자열을 새로 생성한다. 이 컴포넌트는 `reembedStatus` prop이 바뀌지 않는 한 동일한 결과를 반환하므로 사실상 동일 문자열을 매 렌더에서 재생성하는 낭비가 있다. 단, 이 컴포넌트는 KB 상세 페이지에서 **최대 1개** 인스턴스만 렌더되고 빈도가 낮아 체감 비용은 없다.
  - 제안: 성능보다 가독성을 이유로 `clsx` / `cn()` 유틸을 쓰거나, 두 className 상수를 파일 최상위에 선언해두면 재생성 자체를 없앨 수 있다. 우선순위는 낮음.

- **[INFO]** `useT()` 훅 호출 시 번역 딕셔너리 전체 구독
  - 위치: `unsearchable-banner.tsx` L353
  - 상세: `useT()`가 내부적으로 locale store 전체를 구독하는 경우, 관련 없는 로케일 변경에도 배너가 리렌더될 수 있다. 단, 이는 해당 컴포넌트 고유 문제가 아니며 프로젝트 전체가 동일 패턴을 사용하는 기존 설계다. 본 PR이 새로 도입한 성능 우려가 아니다.
  - 제안: 기존 `useT()` 구현을 확인해 selector 방식으로 좁혀지지 않는다면, 별건으로 추적. 본 PR 범위 밖.

- **[INFO]** 조건 렌더 게이트가 부모(`[id]/page.tsx`)에 위치 — 적절
  - 위치: `[id]/page.tsx` L44
  - 상세: `kb && kb.embeddingDimension == null` 조건이 JSX 단락에서 먼저 평가되므로, 배너 컴포넌트 자체(아이콘 import, i18n 호출 포함)는 조건 미충족 시 렌더되지 않는다. 지연 로딩 관점에서 올바른 구조다.
  - 제안: 없음.

- **[INFO]** `Loader2`, `AlertTriangle`, `RefreshCw` 아이콘 동시 import
  - 위치: `unsearchable-banner.tsx` L328
  - 상세: 세 아이콘이 항상 번들에 포함된다. `Loader2`는 `inProgress` 상태에서만, `RefreshCw`는 `!inProgress && canEdit` 에서만 쓰이지만 `lucide-react`는 tree-shaking을 지원하므로 named import 방식(현재 코드 그대로)이면 미사용 심볼은 번들에서 제거된다. 실질적 문제 없음.
  - 제안: 없음.

## 요약

이번 변경은 KB 상세 페이지에 최대 1개 인스턴스가 렌더되는 순수 presentational 배너를 추가한 것으로, 알고리즘 복잡도 증가·N+1 쿼리·메모리 할당·블로킹 I/O 등 실질적 성능 위험이 없다. 신규 API 호출이나 폴링 로직도 없고, 기존 `kb` 데이터에서 두 필드(`embeddingDimension`, `reembedStatus`)만 읽어 조건 분기하는 O(1) 연산이다. 인라인 className 문자열 생성과 `useT()` store 구독은 INFO 수준의 개선 여지이나 해당 패턴은 코드베이스 전반에 이미 사용 중이며 본 PR이 새로 도입한 위험이 아니다.

## 위험도

NONE
