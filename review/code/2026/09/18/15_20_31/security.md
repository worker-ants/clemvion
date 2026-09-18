# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V119__relation_head_entity_id_index.{conf,sql}`
- `codebase/backend/migrations/V120__relation_tail_entity_id_index.{conf,sql}`
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (기존 e2e 에 V117~V120 케이스 추가)
- `plan/in-progress/spec-draft-graph-fk-indexes.md`, `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md` (문서)
- `review/consistency/2026/09/18/14_54_15/**`, `review/consistency/2026/09/18/15_04_02/**` (consistency-checker 산출물, 자동 생성)

전체 변경은 `entity`/`relation` 테이블의 FK 컬럼(`last_seen_chunk_id`, `evidence_chunk_id`, `head_entity_id`, `tail_entity_id`)에 대한 정적 DDL 인덱스 추가와, 그 인덱스 존재/유효성을 검증하는 e2e 테스트, 그리고 관련 spec/plan 문서 갱신이다. 애플리케이션 코드(컨트롤러·서비스·인증 미들웨어 등) 변경은 없음.

## 발견사항

관점별 점검 결과, 보고할 만한 취약점을 발견하지 못했다.

- **인젝션**: 4개 SQL 파일 모두 사용자 입력이 개입하지 않는 정적 `DROP INDEX CONCURRENTLY IF EXISTS` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS` DDL이며, 컬럼명·테이블명·인덱스명이 전부 마이그레이션 파일에 하드코딩된 리터럴이다. 동적 문자열 조합·`EXECUTE` 패턴 없음. e2e 테스트(`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:79-85`)의 `pg` 쿼리도 `name` 을 `$1` 파라미터 바인딩으로 전달해 SQL 인젝션 표면이 없다(값 자체도 테스트 파일 내 상수 배열 `EXPECTED` 에서만 온다 — 외부 입력 아님).
- **하드코딩된 시크릿**: 신규/변경 파일 어디에도 API 키·비밀번호·토큰·인증서 문자열 없음(`review/consistency/**` 의 세션 경로·타임스탬프는 로컬 경로 메타데이터일 뿐 시크릿 아님).
- **인증/인가**: 인증·인가 관련 코드 변경 없음(DB 스키마 레벨 인덱스만 추가). 마이그레이션은 Flyway 를 통해 배포 파이프라인이 실행하는 것을 전제로 하며, 이 PR 범위에서 실행 권한 모델 변경 없음.
- **입력 검증**: 사용자 입력을 받는 신규 경로 없음.
- **암호화**: 해시/암호화 알고리즘, 평문 전송과 무관한 변경.
- **에러 처리**: e2e 테스트의 단언(`expect(res.rows).toHaveLength(1)` 등)이 실패해도 Jest 표준 에러만 노출되며 민감정보 유출 없음.
- **동시성/가용성 관련 참고(보안 등급 아님, INFO)**: `V117~V120` 모두 `executeInTransaction=false` 로 `CREATE/DROP INDEX CONCURRENTLY` 를 트랜잭션 밖에서 실행하도록 했고, 선행 실패 시 잔존하는 invalid 인덱스를 `DROP ... IF EXISTS` 로 먼저 정리하는 패턴은 V111~V116 선례와 동일하다. 이는 가용성/운영 관점의 표준 관례이며 보안 취약점은 아니다.

## 요약

이번 변경은 그래프 RAG 삭제 연쇄 성능 개선을 위한 순수 DB 인덱스 추가(DDL 4건)와 이를 검증하는 e2e 테스트, 관련 spec/plan 문서 갱신으로 구성된다. 사용자 입력 처리 경로, 인증/인가 로직, 시크릿, 암호화 관련 코드가 전혀 포함되어 있지 않으며, SQL 은 전부 정적 리터럴 DDL 또는 파라미터 바인딩된 조회 쿼리다. 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
