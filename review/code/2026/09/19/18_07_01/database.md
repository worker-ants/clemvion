# Database 리뷰

## 개요

이번 변경은 TypeORM 엔티티 8개의 컬럼 데코레이터 선언(`type: 'uuid'` · `enumName` · `default`)을 실제 Postgres DB 상태와 일치시키는 정정과, 그 drift 를 잡는 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)를 "인덱스·제약 층(선언→DB 단방향)"에서 "컬럼 층(양방향)"까지 확장한 것이다. **마이그레이션 파일 변경은 없다** (`git diff --stat` 확인) — `synchronize: false` 환경에서 엔티티 메타데이터만 실제 DB 스키마(Flyway 마이그레이션이 이미 만든 상태)에 맞춘 것이라 스키마 자체는 바뀌지 않는다.

## 발견사항

- **[INFO]** e2e 가드가 인덱스 부분조건 · CHECK 식을 파라미터 바인딩 없이 문자열 결합으로 DDL 에 이어붙인다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `normalizedPredicate`(276~296행) · `normalizedCheck`(298~315행) — `` `CREATE INDEX ${probe}_idx ON ${probe} (${cols}) WHERE ${where}` `` / `` `ALTER TABLE ${probe} ADD CONSTRAINT ${probe}_chk CHECK (${expression})` ``
  - 상세: `where`/`expression` 은 엔티티 `@Index({ where })` · `@Check()` 데코레이터의 문자열 리터럴(개발자가 소스에 직접 적은 값)에서만 오고, 외부 입력이나 DB 데이터가 아니다. 코드도 273~274행 주석으로 "이스케이프 없이 이어붙인다 — 외부 입력을 넘기는 용도로 쓰지 말 것"이라고 스코프를 명시한다. DDL(인덱스 predicate, CHECK 식)은 Postgres 프로토콜상 파라미터 바인딩이 불가능한 영역이라 이 설계 자체는 합리적이다. 다만 앞으로 이 헬퍼가 다른 곳(예: 사용자 입력이 섞인 마이그레이션 검증 스크립트)에 재사용될 경우 이 전제가 깨질 수 있다.
  - 제안: 현재 범위(e2e, 개발자가 작성한 데코레이터 메타데이터만 소비)에서는 조치 불필요. 재사용 시 이 함수 이름에 `TrustedExpressionOnly` 같은 표식을 남기거나 JSDoc 경고를 유지하면 향후 오용을 막을 수 있다.

- **[INFO]** 컬럼에 `default` 를 새로 선언하면 INSERT 시 `RETURNING` 대상 컬럼이 늘어난다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46` (`kind` → `default: 'chat'`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`last_interaction_at` → `default: () => 'now()'`)
  - 상세: TypeORM 은 `default` 가 선언된 컬럼을 insert 후 `ReturningResultsEntityUpdator` 로 다시 읽어 엔티티 객체에 채운다. 실제 DB 컬럼 기본값(`DEFAULT 'chat'`, `DEFAULT now()`)은 이미 마이그레이션으로 존재했으므로 값 자체는 바뀌지 않지만, INSERT 문의 `RETURNING` 절 컬럼 수가 늘어 왕복 데이터가 미세하게 증가한다. plan 문서(`plan/in-progress/entity-column-declaration-drift.md`)가 이 영향을 명시하고 전체 e2e 로 검증했다고 밝혀, 인지·검증된 변경이다.
  - 제안: 이미 조치됨(문서화 + e2e 검증). 추가 조치 불필요.

- **[INFO]** 커넥션 관리는 견고하다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `it('컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다…')`(527~569행)
  - 상세: 비교기 전용 `readOnly` DataSource 를 테스트 안에서 새로 열고 `try/finally` 로 `isInitialized` 체크 후 반드시 `destroy()` 한다. 세션 자체를 `default_transaction_read_only=on` 으로 열어 `log()` 가 혹시 DDL 을 실제로 실행하려 해도 Postgres 가 거부하게 만든 이중 방어(예방+탐지)도 확인했다 — 공유 e2e DB 를 오염시킬 위험을 잘 차단했다.

## 검토했으나 문제 없음

- **컬럼 층 정정 8건 자체**: `type: 'uuid'`(alert-rule/workspace-invitation/integration-usage-log ×2/llm-usage-log) · `enumName`(edge/node) · `default`(model-config/workflow-assistant-session) 모두 실제 DB 컬럼 정의와 일치시키는 방향이며, `synchronize: false` 라 이 커밋만으로는 어떤 DDL 도 실행되지 않는다. 무중단 배포 관점에서 lock·데이터 손실 위험이 없다.
- **트랜잭션 사용**: 인덱스/유니크/CHECK 검증 세 테스트는 `BEGIN`+`ROLLBACK`(SAVEPOINT 로 개별 실패 격리)으로 임시 테이블·인덱스를 남기지 않는다. FK 검증은 카탈로그 read-only 조회뿐이라 트랜잭션이 필요 없다는 것도 주석으로 근거를 남겼다 — 적절하다.
- **N+1**: `ds.entityMetadatas` 순회 안에서 테이블별 인덱스/제약 조회가 반복되지만, 대상은 스키마 카탈로그(엔티티 수 × 상수 수준, 수십~백 단위)이고 프로덕션 데이터가 아니라 테스트 목적상 문제 삼을 수준이 아니다.
- **대량 데이터/페이지네이션**: 이번 변경에 신규 쿼리·엔드포인트가 없어 해당 관점 영향 없음.
- **인덱스**: 기존 인덱스 선언(`idx_alert_rule_workspace` 등)에 변화 없음, 신규 인덱스 필요성도 없음.

## 요약

여덟 엔티티의 컬럼 데코레이터가 실제 DB 스키마와 어긋나 있던 것(uuid 추론 실패, enum 타입 이름 불일치, 누락된 기본값)을 바로잡는 순수 메타데이터 정정이며, `synchronize: false` 환경이라 런타임 DDL 이나 마이그레이션 위험은 없다. 동반된 e2e 가드 확장은 TypeORM 스키마 비교기(`log()`, DDL 미실행)를 읽기 전용 세션 + 카탈로그 해시 비교로 이중 방어하며 컨트롤·트랜잭션 사용이 견고하다. DDL 문자열 결합(파라미터화 불가 영역, 신뢰된 메타데이터만 소비) 등 사소한 INFO 몇 건 외에 데이터베이스 관점의 실질적 위험은 없다.

## 위험도

LOW
