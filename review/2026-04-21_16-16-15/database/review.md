### 발견사항

- **[WARNING]** `appendMessage` — 트랜잭션 없는 3단계 DB 쓰기
  - 위치: `workflow-assistant-session.service.ts`, `appendMessage()` 메서드
  - 상세: `messageRepo.save` → `sessionRepo.update(timestamps)` → `sessionRepo.increment(messageCount)` 3개 작업이 개별 쿼리로 분리되어 있다. 첫 번째 저장 후 두 번째나 세 번째 쿼리가 실패하면 메시지는 저장됐으나 `message_count`나 `last_interaction_at`이 갱신되지 않은 상태로 남는다. 비정규화 필드(`message_count`)가 실제 행 수와 diverge하면 세션 목록 UI가 잘못된 값을 표시한다.
  - 제안: `@Transaction()` 데코레이터 또는 `dataSource.transaction()`으로 3개 작업을 감싸거나, `sessionRepo.update`와 `sessionRepo.increment`를 단일 SQL (`UPDATE … SET message_count = message_count + 1, last_interaction_at = NOW()`)으로 통합.

- **[WARNING]** `findLatestActive` — 인덱스 커버리지 부재
  - 위치: `workflow-assistant-session.service.ts`, `findLatestActive()` / migration `V019`
  - 상세: 쿼리 조건이 `(workspaceId, userId, workflowId, status = 'active')` + `ORDER BY last_interaction_at DESC`인데, 생성된 인덱스는 `(workflow_id, status, last_interaction_at DESC)`로 `user_id`가 빠져 있다. 워크플로우에 다수 사용자의 세션이 쌓이면 인덱스 스캔 후 `user_id` 필터링이 행 단위로 발생한다.
  - 제안: `CREATE INDEX idx_workflow_assistant_session_workflow_user_active ON workflow_assistant_session (workflow_id, user_id, status, last_interaction_at DESC);` 추가.

- **[INFO]** `loadMessages` / `findDetail` — 메시지 페이지네이션 없음
  - 위치: `workflow-assistant-session.service.ts`, `loadMessages()`, `findDetail()`
  - 상세: 세션 내 모든 메시지를 `take` 제한 없이 전부 로드한다. 장기 세션에서 수천 건의 메시지가 쌓이면 메모리 압박 및 응답 지연 발생 가능.
  - 제안: 초기 로드는 최근 N건(예: `take: 100, order: DESC`)으로 제한하고, 스크롤 업 시 cursor 기반 페이지네이션 적용.

- **[INFO]** `appendMessage` — session UPDATE 2회 분리
  - 위치: `workflow-assistant-session.service.ts`, `appendMessage()`
  - 상세: `sessionRepo.update(timestamps)` 와 `sessionRepo.increment(messageCount)`가 별도 라운드트립으로 실행된다. DB 왕복 비용 증가 및 두 업데이트 사이 타 요청이 세션을 읽으면 일시적으로 불일치한 상태를 볼 수 있다.
  - 제안: 단일 `UPDATE … SET message_count = message_count + 1, last_interaction_at = $1, updated_at = $1` 쿼리로 통합.

- **[INFO]** `listWorkflows` — `ILIKE '%…%'` 인덱스 미활용
  - 위치: `explore-tools.service.ts`, `listWorkflows()`
  - 상세: `w.name ILIKE :s`에 `%prefix%` 패턴은 B-tree 인덱스를 사용하지 못한다. 워크플로우 수가 수천 건 이상이면 seqscan으로 전환.
  - 제안: 빠른 개선은 `pg_trgm` 확장 + `GIN` 인덱스, 또는 검색 범위를 `name ILIKE :s%`(접두어 검색)로 제한하는 것으로 충분히 대응 가능.

- **[INFO]** `uuid_generate_v4()` 의존성 미검증
  - 위치: `V019__workflow_assistant.sql`
  - 상세: `uuid-ossp` 확장이 이전 마이그레이션에서 이미 활성화된 것으로 가정한다. 마이그레이션 파일 자체에 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`가 없으므로, 신규 환경 셋업 시 마이그레이션 실패 가능성 존재.
  - 제안: V019 상단에 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` 추가하거나, PostgreSQL 13+라면 `gen_random_uuid()`(내장 함수)로 교체.

---

### 요약

마이그레이션 자체는 새 테이블 추가만 수행하므로 무중단 배포 안전성 문제는 없다. 스키마 설계(JSONB 활용, ON DELETE CASCADE, 비정규화 필드 분리)도 전반적으로 적절하다. 그러나 `appendMessage`의 3단계 쓰기 연산이 트랜잭션 없이 분리되어 있어 장애 시 `message_count` drift가 발생할 수 있고, `findLatestActive` 쿼리에 필요한 복합 인덱스(`workflow_id, user_id, status`)가 누락되어 다중 사용자 환경에서 성능 저하 가능성이 있다. 페이지네이션 부재와 `ILIKE` 전체 스캔은 데이터 증가 시 점진적으로 문제가 될 수 있다.

### 위험도
**MEDIUM**