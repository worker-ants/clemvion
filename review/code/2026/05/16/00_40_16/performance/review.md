# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `RETURNING` 결과를 버리고 있어 불필요한 데이터 전송이 발생한다
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L12-20 (`refresh` 메서드)
  - 상세: 현재 `UPDATE … RETURNING entity_count, relation_count` SQL은 DB가 두 칼럼 값을 직렬화·네트워크 전송·드라이버 역직렬화까지 수행하지만, 호출자는 그 결과를 전혀 사용하지 않는다. 이전 코드에서 WebSocket emit 용도로 결과를 받아 쓰던 것이 dead path 제거와 함께 없어졌으므로, `RETURNING` 절은 순수한 네트워크·직렬화 오버헤드만 남긴다. 단일 행 조작이라 운영 수준의 병목은 아니지만, 호출이 빈번할 경우(chunk 처리마다 1회) 불필요한 payload가 누적된다.
  - 제안: `RETURNING` 절을 제거하거나, 향후 호출자가 반환값을 필요로 하는 경우를 위해 `Promise<{ entityCount: number; relationCount: number } | null>` 형태의 반환 타입을 정의해 결과를 실제로 활용하도록 설계한다. 단순 fire-and-forget 갱신이 목적이라면 `RETURNING` 없이 `UPDATE … WHERE id = $1` 만으로 충분하다.

- **[INFO]** 단일 `$1` 파라미터가 SQL 내 3곳에서 반복 참조된다
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L13-19 (SQL 본문)
  - 상세: `$1`이 `entity` 서브쿼리, `relation` 서브쿼리, `WHERE` 절에 총 3회 등장한다. PostgreSQL 플래너는 동일 파라미터를 올바르게 처리하므로 기능 이슈는 없다. 다만, `knowledgeBaseId` 를 바인딩 배열에 한 번만 넘기면서 SQL 내 3회 참조하는 구조는 파라미터 수가 늘어날 경우 인덱스 불일치 오류를 유발하기 쉬운 패턴이다. 현재 단일 파라미터이므로 실제 위험은 낮다.
  - 제안: 현재 구조를 유지하되, 향후 파라미터가 추가될 때 각 참조 위치의 `$n` 번호를 명시적으로 맞추는 주석 또는 상수를 두어 인덱스 오류를 방지한다.

- **[INFO]** 테스트에서 `Test.createTestingModule().compile()` 이 `beforeEach` 마다 호출된다
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` L9-15 (`beforeEach` 블록)
  - 상세: `KbStatsHelper`는 상태가 없는(stateless) 단순 helper이고 테스트 케이스가 현재 3개에 불과하므로 실질적인 성능 문제는 없다. 그러나 테스트 수가 늘어날 경우 매 테스트마다 NestJS DI 컨테이너 초기화 비용이 반복된다.
  - 제안: `beforeAll` + `afterAll` 로 전환하거나, `jest.mock` 과 직접 인스턴스 생성(`new KbStatsHelper(dataSource as any)`)을 사용해 NestJS 컨테이너 오버헤드를 완전히 제거한다. 단, mock을 매 테스트마다 초기화(`jest.clearAllMocks()` 또는 `beforeEach(() => dataSource.query.mockReset())`)하는 것은 유지한다.

## 요약

이번 변경의 핵심은 dead path(도달 불가 WebSocket broadcast)와 불필요한 의존성(`WebsocketService`)을 제거하는 것으로, 성능 관점에서 전반적으로 긍정적인 방향이다. 이전 코드의 `try-catch`로 감싼 best-effort emit은 예외 억제로 인한 숨겨진 오버헤드를 내포했으나 제거되었다. 남은 `refresh()` 메서드는 단일 atomic SQL 한 번으로 카운트 갱신을 완료하므로 N+1 쿼리·블로킹 I/O·메모리 누수 등의 주요 성능 리스크는 없다. 다만 `RETURNING` 절이 더 이상 사용되지 않는 결과를 전송하는 소규모 낭비가 남아 있으며, 이는 해당 절 제거 또는 반환값 활용 설계 중 하나로 정리하면 된다.

## 위험도

LOW
