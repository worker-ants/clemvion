# Architecture Review

## 발견사항

- **[INFO]** 인덱스 메타데이터의 단일 spec 문서 내 일관성
  - 위치: `spec/data-flow/3-execution.md` 라인 36, `§2.1 Schema 매핑` 테이블 `node_execution | 노드 실행 시작` 행
  - 상세: V095 partial 인덱스 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 가 `spec/1-data-model.md §3 인덱스 목록` (라인 796) 과 마이그레이션 파일 `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql` 에 이미 정의되어 있었고, 이번 변경이 data-flow 실행 엔진 spec 의 Schema 매핑 테이블에 동일 내용을 보조 참조로 추가한 것이다. 세 곳(data-model §3, 마이그레이션, data-flow §2.1)의 인덱스 정의가 모두 일치하므로 단일 진실 원칙 위반이 아니며, data-flow 문서는 실행 흐름 맥락에서 필요한 인덱스를 참조하는 용도로 적절히 사용되었다.
  - 제안: 현행 구조 유지. 다만 향후 인덱스 조건 변경 시 data-model §3, data-flow §2.1, 마이그레이션 세 곳을 동시 갱신해야 한다는 점을 주석이나 Rationale 에 명시하면 유지보수 실수를 줄일 수 있다.

- **[INFO]** 레이어 책임 분리 — 인덱스 명세 위치
  - 위치: `spec/data-flow/3-execution.md §2.1`
  - 상세: 이 파일은 data-flow 레이어(Source→Sink 흐름, 상태 전이, 외부 의존)를 기술하는 문서다. 인덱스 정보를 Schema 매핑 테이블의 마지막 컬럼으로 포함하는 것은 "이 흐름에서 어떤 인덱스가 쿼리를 지원하는가"를 설명하는 맥락 정보이므로 레이어 책임에 부합한다. data-model §3이 인덱스의 정의(SoT)를 담고, data-flow §2.1이 그 인덱스가 실행 흐름에서 어떻게 활용되는지를 보조 기술하는 역할 분리가 명확하다.
  - 제안: 없음.

- **[INFO]** V095 partial 인덱스의 설계 적절성
  - 위치: 마이그레이션 파일 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql`
  - 상세: `WHERE status IN ('waiting_for_input','running')` 조건이 `resolveWaitingNodeExecutionId`의 실제 쿼리 술어(`status = WAITING_FOR_INPUT`)와 running 조회·UPDATE 핫 경로를 정확히 커버한다. completed/failed/cancelled/skipped(장기 누적 대다수)를 인덱스에서 제외해 크기와 write amplification을 최소화한 결정은 데이터 특성(활성 행 < 전체 행)에 부합하는 올바른 partial 인덱스 설계다. V034가 이미 `(execution_id, node_id, started_at DESC)` 복합 인덱스로 completed 계열 조회를 커버하고 있으므로 인덱스 중복 없이 보완 관계를 형성한다.
  - 제안: 없음.

## 요약

이번 변경은 `spec/data-flow/3-execution.md` Schema 매핑 테이블의 `node_execution` 행에 V095 partial 인덱스 참조 한 줄을 추가하는 단순 spec 문서 갱신이다. 아키텍처 관점에서 실질적인 구조 변경은 없으며, 기존 `spec/1-data-model.md §3`과 마이그레이션 SQL에 정의된 인덱스를 data-flow 실행 문서에 참조로 기입한 것이다. 세 위치의 인덱스 정의가 일치하고, data-model이 SoT 역할을 유지하며 data-flow가 흐름 맥락 보조 역할을 수행하는 레이어 책임 분리도 적절하다. SOLID, 결합도/응집도, 순환 의존성, 모듈 경계, 확장성 등 다른 관점에서 이슈가 될 변경사항은 없다.

## 위험도

NONE
