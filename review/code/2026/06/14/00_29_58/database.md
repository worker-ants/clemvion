# 데이터베이스(Database) 리뷰 결과

## 발견사항

- **[INFO]** V095 partial 인덱스 스펙 추가 — 설계 적절
  - 위치: `spec/data-flow/3-execution.md` §2.1 Schema 매핑 표, `node_execution` 행
  - 상세: `(execution_id, status) WHERE status IN ('waiting_for_input', 'running')` partial 인덱스를 스펙에 공식 선언함. 이 인덱스는 `§1.4 폼·버튼 인터랙션 재개` 흐름에서 `SELECT node_execution WHERE execution_id+(node_id)+status='waiting_for_input'` 조회(publisher 측 사전 검증)와, 상태 전이 시 활성 노드 조회에 직접 대응한다. partial 조건이 완료(`completed`, `failed`, `cancelled`, `skipped`)된 다수 행을 인덱스에서 제외하므로 write-heavy 워크로드에서 인덱스 크기와 vacuum 비용이 유의미하게 감소한다. 기존 `(execution_id)` 단순 인덱스(V006) 및 `(execution_id, node_id, started_at DESC)` composite(V034)와 중복 없이 용도가 명확히 구분된다.
  - 제안: 스펙 차원 설계에는 이슈 없음. 실제 마이그레이션(V095)이 구현될 때 `CREATE INDEX CONCURRENTLY`로 생성해야 잠금 없이 운영 중 적용 가능함을 구현 명세에 명기하도록 권장(현재 스펙에 없음). 또한 PostgreSQL에서 partial 인덱스의 `WHERE` 조건과 쿼리 술어가 정확히 일치해야 플래너가 사용함을 보장하기 위해, `status = 'waiting_for_input'` 단일 조건 조회와 `status IN ('waiting_for_input','running')` 양 경우를 커버 테스트로 검증하는 것을 권고함.

## 요약

이번 변경은 `spec/data-flow/3-execution.md` Markdown 명세 파일에서 `node_execution` 테이블 인덱스 목록에 V095 partial 인덱스 `(execution_id, status) WHERE status IN ('waiting_for_input','running')`를 추가한 것이다. 실제 마이그레이션 SQL이나 애플리케이션 코드 변경은 포함되지 않는다. 인덱스 설계 자체는 활성 노드 조회 경로(publisher 사전 검증, 상태 전이)의 핫패스를 정확히 겨냥하고 있으며, partial 조건으로 종료 상태 행을 배제해 인덱스 효율이 높다. 기존 인덱스와 역할이 겹치지 않아 스키마 설계 상 문제 없음. 구현 단계에서 `CONCURRENTLY` 적용 여부만 확인이 필요하나 이는 현재 변경 범위 밖이다.

## 위험도

LOW
