# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `computeAttentionBreakdown`이 매 렌더링 시 전체 목록을 선형 순회함
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeAttentionBreakdown` 함수 (diff +453~+480)
  - 상세: `page.tsx`의 `useMemo`로 감싸져 있어 `integrations` 배열이 바뀔 때만 재실행되므로 실제 문제는 없다. 그러나 함수 자체는 O(n) 순회 + `needsAttention()` 내부 호출이 중첩되는 구조다. 현재 페이지 한도가 30건이므로 규모 측면에서 영향은 미미하다.
  - 제안: 현행 구조(memoized + 페이지네이션 30건)로 충분하다. 만약 페이지 한도가 수백 건 이상으로 늘어날 경우 `needsAttention` 판정 로직을 인라인화하면 함수 호출 오버헤드를 줄일 수 있다.

- **[INFO]** `AttentionBanner` 내부에서 `useT()` 훅과 문자열 필터링을 매 렌더마다 수행
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` — `AttentionBanner` 컴포넌트 (diff +574~+636)
  - 상세: 배너가 표시되는 경우에만 렌더링되므로(`attention.total > 0` 조건부) 불필요한 렌더는 원천 차단된다. 내부의 `.filter(Boolean).join(" · ")` 패턴은 최대 4개 요소에 대해 O(1)이므로 문제 없다.
  - 제안: 현행 설계는 적절하다. 특별한 조치 불필요.

- **[INFO]** 백엔드 `attention` 필터 SQL에서 `NOW()` 함수를 동일 쿼리 내에서 두 번 호출
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `attention` 분기 (diff +143~+149)
  - 상세: `i.token_expires_at > NOW()` 와 `i.token_expires_at <= NOW() + INTERVAL '7 days'` 에서 `NOW()`가 두 번 평가된다. PostgreSQL은 단일 쿼리 내에서 `NOW()`를 트랜잭션 시작 시점으로 고정하므로 두 번 호출하더라도 실제로는 동일한 값을 반환하고, 추가 시스템 콜이 발생하지 않는다. 일관성과 성능 모두 문제없다.
  - 제안: 현행 코드로 충분하다. 가독성 목적으로 `:now` 바인드 파라미터를 쓰는 방법도 있으나 성능상 이득은 없다.

- **[INFO]** `computeAttentionBreakdown` 결과에서 `mostUrgentId`는 배너가 단순 표시 용도로만 쓰일 때도 항상 결정됨
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeAttentionBreakdown` (diff +467~+469)
  - 상세: `mostUrgentId` 연산(rank 비교)이 `total > 1`인 경우에도 매 요소마다 수행된다. 이는 O(n) 루프 내 분기 추가에 불과하고, 현실적 데이터셋 크기(30건)에서는 무시할 수준이다.
  - 제안: 현행 구조 유지. `total === 1` 확인 후에만 `mostUrgentId`를 사용하는 호출부 패턴이 이미 올바르게 구현되어 있다.

## 요약

이번 변경은 "Attention" 가상 필터를 도입해 백엔드 SQL 분기 1개와 프론트엔드 집계 함수 1개를 추가하는 소규모 변경이다. 성능 관점에서 주목할 위험 요소는 없다. 백엔드 쿼리는 기존 단일 `status =` 비교를 OR 결합 조건으로 대체하는 수준이며, `(i.status, i.token_expires_at)` 복합 인덱스가 존재한다면 인덱스 활용에 지장이 없다. 프론트엔드의 `computeAttentionBreakdown`은 `useMemo`로 적절히 메모이제이션되어 있고, 배너 컴포넌트는 `attention.total > 0`일 때만 마운트되어 불필요한 렌더를 방지한다. 테스트 코드는 단순 mock 기반이므로 런타임 성능에 영향을 주지 않는다. 전반적으로 알고리즘 복잡도, 메모리 할당, 캐싱, 블로킹 I/O, N+1 쿼리 어느 관점에서도 우려 사항이 없는 깔끔한 구현이다.

## 위험도

NONE
