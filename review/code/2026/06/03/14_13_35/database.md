# Database Review

## 발견사항

- **[INFO]** `secret_store` CHECK 제약 추가 스키마의 마이그레이션 안전성
  - 위치: `spec/conventions/secret-store.md` — `ALTER TABLE secret_store ADD CONSTRAINT chk_secret_store_ref_format CHECK (ref ~ '^secret://...$')` (V063)
  - 상세: 기존 테이블에 CHECK 제약을 추가하는 `ALTER TABLE ... ADD CONSTRAINT CHECK` 는 PostgreSQL 에서 테이블 전체 스캔(validation scan)을 수행하며 짧은 `AccessShareLock` 보다 무거운 `AccessExclusiveLock` 을 획득한다. 데이터 건수가 많지 않은 `secret_store` 테이블이라면 실운영 영향은 낮지만, 기존 행 중 CHECK 조건을 위반하는 ref 가 있으면 migration이 실패한다. `spec/conventions/migrations.md` 의 "무중단 배포" 원칙에 비추어, 기존 데이터 정합성을 migration 실행 전에 application 단에서 보장(또는 사전 검증 쿼리)하는 절차가 문서에 없다.
  - 제안: V063 migration 주석 또는 spec에 "기존 secret_store rows 가 CHECK 패턴을 이미 만족함을 확인한 후 배포" 절차를 명시. 대안으로 `NOT VALID` 옵션을 사용해 기존 행 검증을 별도 단계로 분리(`VALIDATE CONSTRAINT`)하는 방식도 고려 가능.

- **[INFO]** `login_history.event` CHECK 제약 DROP+ADD 패턴 문서화
  - 위치: `spec/data-flow/1-audit.md` Rationale — "webauthn_failed 추가는 V058 에서 CHECK 제약을 DROP + ADD 로 갱신했다"
  - 상세: `ALTER TABLE ... DROP CONSTRAINT ... ; ALTER TABLE ... ADD CONSTRAINT CHECK (...)` 패턴은 각각 단독 `ALTER TABLE` 로 실행하면 두 번의 `AccessExclusiveLock` 획득이 발생한다. 단일 `ALTER TABLE ... DROP CONSTRAINT ..., ADD CONSTRAINT CHECK (...)` 트랜잭션으로 묶으면 잠금 횟수를 줄일 수 있다. 현재 spec은 패턴만 언급하고 실행 방식에 대한 가이드가 없다. `login_history` 테이블은 인증 이벤트를 빈번하게 INSERT 하므로 잠금 시간은 가능한 한 짧아야 한다.
  - 제안: `spec/conventions/migrations.md` 또는 `spec/data-flow/1-audit.md` Rationale에 "CHECK enum 확장은 단일 ALTER TABLE 문으로 DROP + ADD 를 묶어 잠금 노출을 최소화한다" 가이드 추가.

- **[INFO]** PostgreSQL in-flight 쿼리 중단(cancellation) 미구현 명시
  - 위치: `spec/conventions/node-cancellation.md` §2.1 표 — PostgreSQL 행, §6 구현 현황 표
  - 상세: 스펙이 "현재 DB 노드는 진입 직전 `abortSignal?.aborted` 사전 체크만, in-flight 쿼리 중단은 미구현(Planned)"임을 명확히 문서화했다. 이는 DB 관점에서 관찰할 위험이 아니라 알려진 제한 사항이다. 다만, in-flight PostgreSQL 쿼리가 AbortSignal 수신 후에도 계속 실행될 경우 커넥션이 장기간 점유될 수 있으며 커넥션 풀 고갈로 이어질 수 있다. `client.cancel()` 구현 시 커넥션 반환 시점과 풀 관리를 함께 고려해야 한다.
  - 제안: 향후 `database-query.handler.ts` 에 `client.cancel()` 구현 시 `finally` 블록에서 커넥션 풀 반환을 보장하는 패턴을 spec에 명시.

## 요약

이번 변경은 전부 `spec/` 내 마크다운 문서 업데이트이며, 실제 DB 마이그레이션 SQL, TypeORM 엔티티, 쿼리 코드는 포함되어 있지 않다. DB 관련 실코드 변경은 없으므로 인덱스 누락, N+1 쿼리, 트랜잭션 미사용, SQL 인젝션, 커넥션 미해제 같은 구현 레벨 위험은 해당 없다. 스펙 문서에 기술된 `secret_store` CHECK 제약 추가(V063)와 `login_history.event` CHECK DROP+ADD 패턴은 운영 환경에서 잠금 노출 위험이 있으나, 이는 실코드가 아닌 문서에 기재된 내용이며 테이블 규모가 크지 않아 실질 위험도는 낮다. 전반적으로 DB 관련 스펙 변경은 현황을 정확히 문서화하는 방향이며 설계상 결함은 발견되지 않았다.

## 위험도

LOW
