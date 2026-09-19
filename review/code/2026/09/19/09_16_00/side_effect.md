# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 새 e2e 가드가 엔티티 메타데이터 문자열을 이스케이프 없이 DDL 에 직접 이어 붙인다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `normalizedPredicate`(205~224행), `normalizedCheck`(227~243행)
  - 상세: `CREATE INDEX ... WHERE ${where}`, `ALTER TABLE ... ADD CONSTRAINT ... CHECK (${expression})` 처럼 `where`/`expression` 문자열을 파라미터 바인딩 없이 그대로 SQL 에 삽입한다. 지금은 입력이 엔티티 데코레이터의 컴파일타임 리터럴(TypeORM 메타데이터)뿐이라 인젝션 경로가 없고, 파일 상단 주석(200~202행)에 "외부 입력을 넘기는 용도로 쓰지 말 것"이라고 명시적으로 경고까지 해 뒀다 — 작성자가 위험을 인지하고 범위를 좁힌 상태다. 다만 이 두 헬퍼가 `test/helpers/` 가 아니라 스펙 파일 내부에 있어 다른 e2e 스펙이 값을 넘겨 재사용하기 쉬운 위치이므로, 향후 재사용 시 이 경고 주석을 지우지 않도록 유의가 필요하다.
  - 제안: 현재 변경분 자체는 조치 불요(주석으로 이미 방어). 이 헬퍼를 공용 helper 로 승격하는 후속 PR 이 생기면 그 시점에 이스케이프/화이트리스트 가드를 추가할 것.

- **[INFO]** 새 e2e 스펙이 DB 커넥션을 두 개(raw `pg.Client` + TypeORM `DataSource`) 새로 여는데, 기존 관례와 일치함을 확인
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `beforeAll`/`afterAll` (121~141행)
  - 상세: `createDbClient()` 와 별도로 `new DataSource({...})` 를 만들어 `ROOT_ENTITIES` 를 그대로 로드한다. 같은 디렉터리의 `trigger-deletion-releases-resources.e2e-spec.ts`, `trigger-update-save-window.e2e-spec.ts` 도 동일하게 raw client + 별도 `DataSource` 를 여는 패턴이라 새로운 부작용 표면이 아니다. `afterAll` 이 `ds?.destroy()`/`db?.end()` 로 optional chaining 을 써서 `beforeAll` 이 중간에 실패해도 안전하게 정리를 시도하는 점도 확인.
  - 제안: 없음(확인 목적 기록).

- **[NONE 확인]** 엔티티 데코레이터 변경(`@Check`/`@Index`/`@Unique`/`onDelete`) 은 `synchronize: false` 로 인해 런타임/DB 부작용이 없음을 직접 확인
  - 위치: `codebase/backend/src/app.module.ts:112`(`synchronize: false`), `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts:49`, `codebase/backend/src/scripts/encrypt-auth-config.ts:53` 도 동일
  - 상세: TypeORM 0.3.31 소스(`node_modules/.pnpm/typeorm@0.3.31.../decorator/Check.js`, `metadata-builder/RelationJoinColumnBuilder.js` 등)를 열어 `onDelete`/`@Check`/`@Index` 메타데이터가 schema-builder(즉 `synchronize()`) 경로에서만 소비되고 query-builder/persistence 쪽에서는 읽지 않음을 확인했다 — `onDelete: 'CASCADE'` 추가가 `remove()` 시 앱 레벨 cascade 삭제를 유발하지 않는다. `integration_expiry_dispatch_key`·`IDX_node_workflow_label`·`UQ_node_workflow_label` 이름을 참조하는 코드도 grep 으로 전무함을 확인(주석 외 참조 없음) — 제거·이름 변경이 다른 호출부에 영향 없음.
  - 제안: 없음(리스크 없음 확인).

- **[INFO]** `node.entity.ts` 의 `Index` import 제거가 잔존 참조 없이 안전함을 확인
  - 위치: `codebase/backend/src/modules/nodes/entities/node.entity.ts` (import 블록, `@Index('IDX_node_workflow_label', ...)` 제거 지점)
  - 상세: `grep -n "Index" node.entity.ts` 결과 남은 참조는 제거 사유를 적은 주석 한 줄뿐이라 미사용 import 잔존이나 컴파일 오류 위험 없음.
  - 제안: 없음.

뮤테이션 검증은 수행하지 않았다(코드를 직접 고쳐 재현할 필요가 없는, 정적 대조+소스 열람만으로 판단 가능한 변경이었다). 저장소 트리에 어떤 파일도 쓰거나 고치지 않았다 — `git status --short` 로 리뷰 시작 시점과 동일함을 확인.

## 요약
리뷰 대상 8곳의 엔티티 데코레이터 정정(`@Check`/`@Index`/`@Unique` 이름·컬럼·부분조건, `onDelete: 'CASCADE'`)은 모두 `synchronize: false` 하에서 TypeORM 메타데이터만 바꾸는 선언이며, 실제 DB DDL·런타임 cascade 동작에는 영향을 주지 않음을 TypeORM 소스 직접 열람으로 확인했다. 제거된 이름(`IDX_node_workflow_label`·`UQ_node_workflow_label`·`integration_expiry_dispatch_key`)을 참조하는 다른 코드도 없어 시그니처·인터페이스·전역 상태 관점의 부작용은 없다. 새로 추가된 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 임시 테이블 생성과 롤백 트랜잭션 안에서만 DDL 프로브를 실행해 실제 스키마에 흔적을 남기지 않고, 두 개의 DB 커넥션을 여는 패턴도 같은 디렉터리의 기존 e2e 스펙과 동일한 관례다. 유일하게 짚어 둘 점은 DDL 문자열에 엔티티 메타데이터를 이스케이프 없이 직접 이어 붙이는 헬퍼 두 개인데, 현재는 입력이 컴파일타임 리터럴뿐이고 작성자가 그 사실을 주석으로 명시해 위험 범위를 좁혀 두었다. 전역 변수·파일시스템·환경 변수·네트워크 호출·이벤트/콜백 관점에서는 특이사항이 없었다.

## 위험도
NONE
