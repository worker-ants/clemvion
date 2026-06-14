## 발견사항

- **[INFO]** spec/data-flow/3-execution.md §2.1 인덱스 셀 갱신 — 내용 정확
  - 위치: `spec/data-flow/3-execution.md` 라인 191 (`node_execution` 행 인덱스 컬럼)
  - 상세: V095 partial 복합 인덱스 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 가 "인덱스 / 제약" 셀에 추가되었다. 설명 문구 `활성 노드 조회/전이` 는 마이그레이션 SQL 주석(`resolveWaitingNodeExecutionId` + running 조회/UPDATE 핫 경로) 및 `spec/1-data-model.md §3` 인덱스 표(라인 796)와 일치한다.
  - 제안: 해당 없음 — 기술적으로 정확하며 기존 인덱스 두 항목(`(execution_id)`, V034 composite)과 동일한 형식·수준으로 병렬 기재됐다.

- **[INFO]** spec/1-data-model.md 와의 교차 일관성 양호
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/spec/1-data-model.md` 라인 796
  - 상세: 데이터 모델 §3 인덱스 표에 동일 인덱스가 이미 등재되어 있으며, 두 문서 간 설명 수준·레퍼런스 번호(V095)가 일치한다. 단일 진실 원칙에 위반 없음.
  - 제안: 없음.

- **[INFO]** 마이그레이션 SQL 인라인 주석 충분
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql` 라인 1-19
  - 상세: SQL 헤더 주석이 (1) 핫 경로 설명, (2) partial 범위 선택 이유, (3) CONCURRENTLY 비트랜잭션 모드 운영 주의사항, (4) DOWN 절차까지 모두 기록하고 있다. `.conf` 파일(`executeInTransaction=false`)도 동봉되어 운영자가 실행 컨텍스트를 잘못 이해할 여지가 없다.
  - 제안: 없음.

- **[INFO]** CHANGELOG 에 V095 항목 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/CHANGELOG.md`
  - 상세: 현재 CHANGELOG 에는 V093/V094 같은 스키마 변경은 별도 Unreleased 섹션으로 기재되어 있으나, V095 partial 인덱스 추가는 등재되지 않았다. 이 변경은 Breaking change 가 없고, 인덱스는 CREATE INDEX CONCURRENTLY 로 무중단이며, 애플리케이션 코드 계약·API surface 변경이 없다. 기존 CHANGELOG 정책 기준으로 "성능 최적화 인덱스 추가" 는 엔드 유저·운영자에게 통보해야 할 변경사항으로 보기 어렵다(Breaking change / API shape 변경 / 설정 추가 없음). 따라서 CHANGELOG 항목 부재는 허용 가능한 수준이다. 단, 운영 팀이 DDL 변경 전체를 CHANGELOG 로 추적하는 정책이 있다면 추가를 권장한다.
  - 제안: 필수 아님. 운영 정책에 따라 `## Unreleased — perf(node-execution): 활성 status partial 인덱스 (V095)` 항목을 CHANGELOG 에 선택적으로 추가할 수 있다.

- **[INFO]** data-flow/3-execution.md §2.1 셀 내 cross-reference 연결 누락 가능성 검토
  - 위치: `spec/data-flow/3-execution.md` 라인 238 (수정된 행)
  - 상세: 기존 인덱스 V034 항목은 `V034` 식별자만 기재되고 별도 링크 없음. 신규 V095 항목도 동일 형식을 따르고 있어 일관성 유지. `spec/1-data-model.md §3` 인덱스 표가 상세 SoT 역할을 하므로 별도 링크 추가는 과잉이다.
  - 제안: 없음.

## 요약

이번 변경은 `spec/data-flow/3-execution.md` §2.1 스키마 매핑 표의 `node_execution` 인덱스 셀에 V095 partial 복합 인덱스 항목 하나를 추가하는 단순 문서 동기화다. 신규 인덱스의 설명 문구·식별자·용도 기재가 `spec/1-data-model.md` 및 마이그레이션 SQL 주석과 모두 일치하며, 기존 인덱스 항목들과 형식이 통일되어 있다. 독스트링·JSDoc·README·API 문서·환경변수·예제 코드 관점에서는 영향 범위 밖이다. CHANGELOG 에 V095 항목이 없으나, 이 인덱스는 Breaking change·API surface·설정 변경이 없는 성능 최적화이므로 필수 기재 대상이 아니다. 문서화 전반에 걸쳐 결함이 없다.

## 위험도

NONE
