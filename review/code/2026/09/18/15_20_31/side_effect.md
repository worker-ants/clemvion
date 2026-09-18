# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `CREATE/DROP INDEX CONCURRENTLY` 는 트랜잭션 밖에서 실행되며 `entity`/`relation` 테이블에 `SHARE UPDATE EXCLUSIVE` 락을 잠깐 건다 — 배포 시점의 실제 운영 부작용
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:24-27`, `V118__relation_evidence_chunk_id_index.sql:24-27`, `V119__relation_head_entity_id_index.sql:24-26`, `V120__relation_tail_entity_id_index.sql:23-25` (각 파일 게이트 번호 기준), 동봉 `.conf` 4개(`executeInTransaction=false`)
  - 상세: 이 넷은 트랜잭션 비활성화(`executeInTransaction=false`)로 실행되므로, `DROP`↔`CREATE` 사이에 배포 프로세스가 죽으면 그 순간 인덱스가 부재한 상태(짧은 창)로 남을 수 있다. 다만 이는 새로 도입된 위험이 아니라 `migrations/README.md` §5(“신규 추가에도 0) 을 둡니다”)에 문서화된 기존 컨벤션이고 V111~V116 선례와 동일한 패턴이다. `IF NOT EXISTS`/`IF EXISTS` 가드와 재실행 시 self-heal 절차도 README 에 이미 있다.
  - 제안: 조치 불요 — 기존에 승인된 컨벤션을 그대로 따른 것이며 consistency-check(BLOCK: NO, Critical 0)도 이미 이를 검토했다. 배포 러너북에 "V117~V120 도 CONCURRENTLY 비-트랜잭션 그룹"이라는 사실만 인지하면 충분.

- **[INFO]** FK 인덱스 추가는 `ON DELETE SET NULL`/`ON DELETE CASCADE` 트리거의 **탐색 경로만** 바꾸고 그 동작(부모 삭제 시 자식 컬럼을 NULL 로 만들거나 자식 행을 지우는 것) 자체는 바꾸지 않는다
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql`, `V118__relation_evidence_chunk_id_index.sql`, `V119__relation_head_entity_id_index.sql`, `V120__relation_tail_entity_id_index.sql`
  - 상세: 순수 성능 인덱스 추가이며 스키마의 제약조건·FK 정의·애플리케이션 코드는 변경되지 않았다(`git diff --stat`으로 `codebase/` 내 변경이 마이그레이션 8개 파일 + e2e 테스트 1개로 한정됨을 확인). 함수 시그니처·공개 API·이벤트/콜백 변경 없음.
  - 제안: 없음(정상).

- **[INFO]** `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 의 변경은 `pg_index`/`pg_class`를 읽는 `SELECT`뿐이며 DB 상태를 변경하지 않는다
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:79-89` (전체 파일을 `Read`로 직접 열어 확인)
  - 상세: `EXPECTED` 배열에 4개 항목이 추가되고 `describe` 제목이 갱신됐을 뿐, 테스트 바디(쿼리·assertion 로직)는 그대로다. 전역 상태·파일시스템·환경변수·네트워크 호출 없음.
  - 제안: 없음(정상).

- **[INFO]** `spec/*.md` 3개 파일과 `plan/in-progress/spec-draft-graph-fk-indexes.md`, `review/consistency/**` 산출물은 순수 문서 변경/워크플로 산출물이며 side effect 관점의 실행 코드가 아니다
  - 위치: `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`, `plan/in-progress/spec-draft-graph-fk-indexes.md`, `review/consistency/2026/09/18/14_54_15/**`, `review/consistency/2026/09/18/15_04_02/**`
  - 상세: 이 파일들은 프로젝트 CLAUDE.md 규약(`consistency-check --spec`, `--impl-prep`)이 요구하는 정상 산출물이며, 저장소 관례상 커밋 대상이다(gitignore 대상 아님). 부작용 심사 대상인 "예상치 못한 파일 생성"에 해당하지 않는다.
  - 제안: 없음.

## 검증용 뮤테이션

이번 리뷰는 정적 분석(`Read`, `grep`, `git diff --stat`)만으로 충분히 판단 가능했으므로 저장소 파일을 뮤테이션하지 않았다. `git status --short` 로 확인한 결과 이 세션이 만든 워킹트리 변경은 없다(리뷰 대상 diff 자체는 이미 커밋/스테이지된 상태).

## 요약

이번 변경은 그래프 RAG 삭제 연쇄용 FK 인덱스 4개(V117~V120, `entity.last_seen_chunk_id` / `relation.evidence_chunk_id` / `relation.head_entity_id` / `relation.tail_entity_id`)를 `CONCURRENTLY`로 추가하는 DB 마이그레이션, 이를 검증하는 e2e 테스트 확장, 그리고 spec/plan/리뷰 문서 갱신으로 구성된다. `git diff --stat` 확인 결과 애플리케이션 코드(서비스·컨트롤러·모듈)는 전혀 건드리지 않았고, FK 트리거의 동작(SET NULL/CASCADE)도 그대로이며 인덱스 추가는 탐색 경로 최적화에 그친다. `executeInTransaction=false` 비-트랜잭션 DDL 패턴은 새로 도입된 위험이 아니라 README §5에 문서화되고 V111~V116에서 선례가 있는 컨벤션을 그대로 따른 것이다. 전역 변수·환경 변수·네트워크 호출·공개 API·함수 시그니처·이벤트/콜백 변경은 발견되지 않았다.

## 위험도
NONE
