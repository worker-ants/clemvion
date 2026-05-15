# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `refresh()` 의 단일 atomic UPDATE SQL 은 동시성 관점에서 올바른 설계
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L6-17
  - 상세: 기존 코드의 SELECT → UPDATE 2단계 비원자 패턴을 단일 `UPDATE ... SET col = (SELECT COUNT(*))` 로 교체함으로써, 동시 호출 시 발생할 수 있는 읽기-수정-쓰기 경쟁 조건을 PostgreSQL 엔진 레벨에서 차단한다. RETURNING 절도 동일 statement 내에서 처리되므로 추가적인 레이스 윈도우가 없다.
  - 제안: 현재 구현 유지. 다만 동시 호출이 빈번할 경우 동일 `knowledgeBaseId` 에 대한 직렬화가 DB row-level lock 에만 의존하므로, 향후 처리량이 늘면 애플리케이션 레벨에서 per-KB debounce/throttle 도입을 검토할 수 있다 (현재 범위 밖, 필수 아님).

- **[INFO]** 삭제된 WebSocket broadcast 블록의 `try/catch` 패턴은 동시성 위험 없음 — 제거로 오히려 단순화
  - 위치: 삭제된 `kb-stats.helper.ts` L41-49 (이전 코드)
  - 상세: 삭제된 블록은 단순 best-effort emit 이었고 내부적으로 공유 뮤터블 상태를 갖지 않았다. 제거 후 `refresh()` 는 DataSource 쿼리 하나만 수행하므로 동시성 복잡도가 감소했다.
  - 제안: 해당 없음 (긍정적 변경).

## 요약

이번 변경의 핵심인 `kb-stats.helper.ts` 는 동시성 관점에서 기존보다 명확히 개선되었다. 2단계(SELECT + UPDATE) 비원자 카운트 갱신이 단일 atomic UPDATE SQL 로 통합되어 동시 호출에 따른 경쟁 조건이 DB 레벨에서 원천 차단된다. 테스트 파일(`kb-stats.helper.spec.ts`)은 `dataSource.query` 를 동기 mock 으로 대체하므로 비동기 누락·Promise 체인 오류의 소지가 없으며, 각 테스트케이스가 `await` 를 올바르게 사용하고 있다. 계획 문서(`plan/in-progress/...`) 는 동시성 코드와 무관하다. 전체적으로 동시성 위험이 제거 또는 감소한 방향의 변경이며, 추가 조치가 필요한 결함은 발견되지 않았다.

## 위험도

LOW
