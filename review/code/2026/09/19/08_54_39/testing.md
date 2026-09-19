# 테스트(Testing) 리뷰

## 검증 방법 메모

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 는 프롬프트에서 diff 가 생략되어 `Read` 로 원본 파일 전체(382줄)를 직접 열어 확인했다. 아래 위치의 줄 번호는 그 파일의 실제 줄 번호다.
- `ts-jest`(`test/jest-e2e.json`, `isolatedModules` 미설정 → 기본값인 풀 타입체크 모드)로 이 신규 파일을 실행해, DB 미접속(`getaddrinfo ENOTFOUND postgres`) 직전까지 컴파일이 통과함을 직접 실행 확인했다 — 타입 오류 없음, `Check`/`Index` 데코레이터 오버로드(`node_modules/typeorm` `.d.ts`)와 `IndexMetadata`/`UniqueMetadata`/`CheckMetadata` 의 `givenName`/`where`/`isUnique` 필드 존재도 대조 확인했다.
- 실제 Postgres(V001~V132 마이그레이션 적용)에 대한 재실행은 하지 않았다 — 병렬 fan-out 중 공유 워크트리에 대한 docker compose 기동은 다른 reviewer 세션과 자원을 공유할 위험이 있어 보류했다. 대신 `plan/in-progress/entity-schema-declaration-drift.md` 의 체크리스트("e2e 가드 선작성 — 고치기 전 코드에서 RED 가 정확히 여덟", "가드 뮤턴트 — … 예측과 실측이 모두 같았다", "TEST WORKFLOW — … e2e PASS 348")에 기록된 실측을 근거로 판단했다. 저장소에 쓰기는 하지 않았다(`git status --short` 로 원상태 확인 완료).

## 발견사항

- **[INFO]** `checked` 카운터가 "완전히 비었다" 만 잡고 "부분적으로 좁아졌다" 는 못 잡는다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:287`, `:326`, `:379` (`expect(checked).toBeGreaterThan(0)`)
  - 상세: 세 개의 루프(`@Index`/`@Unique`, `@Check`, FK)는 각각 `ds.entityMetadatas` 를 순회하며 `checked` 를 누적하고 `toBeGreaterThan(0)` 으로만 "vacuous 하지 않음" 을 보장한다. `ROOT_ENTITIES` 배열이 실수로 축소되거나(예: 새 엔티티 모듈 등록 시 spread 가 깨짐) `DataSource` 초기화 옵션이 잘못돼 엔티티 41개 중 극소수만 메타데이터에 잡혀도, `checked` 가 1 이상이기만 하면 이 가드는 여전히 GREEN 이다 — 이번 PR 이 고친 문제 자체가 "몇 곳을 놓쳤는지 아무도 몰랐다" 는 것이었는데, 회귀 가드의 커버리지 축소는 같은 방식으로 조용히 통과할 수 있다.
  - 제안: `checked` 하한을 상수로 박아 둔다(예: `expect(checked).toBeGreaterThanOrEqual(100)` — plan 문서가 이미 "104개" 를 실측해 뒀다) 또는 `ds.entityMetadatas.length` 를 `ROOT_ENTITIES.length` 와 대조하는 카디널리티 단언을 추가한다(`src/app.module.spec.ts` 의 "ROOT_ENTITIES 와 REQUIRED_ENTITIES 의 cardinality 가 일치한다" 패턴과 동일 아이디어).

- **[INFO]** 개발 중 검증한 10개 뮤턴트 시나리오 중 8개가 영구 회귀 테스트로 남지 않았다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:182-220` (판별력 대조군 `it`)
  - 상세: plan(`plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 "가드 뮤턴트")에 따르면 개발 중 10가지 케이스(유일성 플립·인덱스 이름 오탈자·CHECK 정규형/이름·`@Unique` 컬럼 순서/이름·FK 참조 대상/동작 등)를 실제로 코드에 주입해 전부 RED 를 확인한 뒤 `cp` 로 원복했다. 그중 영구 코드로 남아 매 실행마다 검증되는 것은 "CHECK 를 컬럼 이름으로 감싸면 만들 수 없다" 와 "부분 조건의 `IN` 표기가 정규화된다" 두 가지뿐이다(182~220줄). 나머지 8개 클래스(컬럼 누락으로 인덱스 불일치, 이름 불일치, `@Unique` 컬럼 순서 뒤집기, FK 참조 테이블 불일치, FK `onDelete` 불일치 등)는 "지금 엔티티가 실제로 그 형태로 틀려 있을 때만" `problems` 를 채우는 일반 루프(222~381줄)에 의존한다. 즉 이 판정 로직(`sameColumns`, `normalizedPredicate`, `FK_ACTION` 매핑 등) 자체가 나중에 리팩터링으로 느슨해져도(예: 컬럼 배열 비교를 길이만 보게 바꾸는 실수), 그 시점에 마침 드리프트가 없다면 아무 테스트도 실패하지 않는다 — 판정 메커니즘의 정확성을 지키는 영구 장치는 두 케이스뿐이다.
  - 제안: 최소 1~2개(예: "컬럼 하나 빠진 인덱스는 불일치로 잡힌다", "FK `onDelete` 값이 다르면 불일치로 잡힌다")는 이번 PR 이 고친 실제 결함 클래스와 겹치므로, 스캐폴딩용 임시 테이블/엔티티 메타데이터를 직접 조작해 판별력을 검증하는 케이스로 판별력 대조군에 추가해 두면 판정 로직 자체의 회귀를 영구적으로 방지할 수 있다.

- **[INFO]** FK 테스트만 다른 세 테스트와 구조가 다르다(`inRolledBackTx` 미사용)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:330` (`it('관계 FK …')`)
  - 상세: 앞의 세 `it` 은 모두 `inRolledBackTx(async () => { … })` 로 감싸는데, FK 테스트만 감싸지 않는다. FK 테스트는 임시 테이블·인덱스를 만들지 않고 순수 `SELECT` 만 하므로 트랜잭션/롤백이 실제로 불필요해 버그는 아니다. 다만 같은 파일 안에서 테스트 구조가 통일되지 않아 읽는 사람이 "왜 이것만 다른가" 를 매번 재확인해야 한다.
  - 제안: 의도적 생략이면 그 이유(쓰기 없음)를 주석 한 줄로 남기거나, 일관성을 위해 다른 세 테스트와 같은 형태로 감싼다.

- **[INFO]** 새 e2e 가드의 DB 접속 기본값이 `test/helpers/db.ts` 의 `createDbClient()` 와 별도로 하드코딩되어 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:50-60` (`new DataSource({...})`)
  - 상세: `host`/`port`/`username`/`password`/`database` 기본값(`postgres`/`5432`/`clemvion`/`clemvion-e2e`/`clemvion_e2e`)이 `createDbClient()` 와 동일한 값으로 중복 선언되어 있다. 다만 같은 패턴이 이미 `test/trigger-deletion-releases-resources.e2e-spec.ts:403`, `test/trigger-update-save-window.e2e-spec.ts:77` 에도 존재해(`new DataSource({...})` + `ROOT_ENTITIES`) 이번 PR 이 새로 만든 문제가 아니라 기존 컨벤션을 따른 것이다. 두 값이 어긋나면(예: 한쪽만 env var 이름을 바꿈) 조용히 다른 DB 에 붙는 방식으로 드리프트할 수 있다.
  - 제안: 이번 PR 범위 밖 — 기존 두 파일과 함께 공용 `DataSource` 팩토리로 묶는 별도 리팩터 후보로만 기록.

## 강점 (참고)

- 신규 가드는 "선언이 있으면 DB 에도 그대로 있다" 는 방향의 회귀 테스트로서 드물게 완성도가 높다: 고치기 전 코드로 먼저 실행해 RED 가 정확히 여덟(문서화된 발견과 1:1)임을 확인했고, 그 과정에서 가드 자체의 버그(`pg` 가 `name[]` 을 배열로 안 풀어 FK 64개가 오탐)를 발견해 `sameColumns`(112~180줄 부근)에 "배열 아니면 크게 멈춘다" 는 방어 코드로 고쳤다. 이는 사용자 메모의 "약한 증거를 받아준 탓" 교훈과 정확히 반대 방향으로 설계되어 있다.
- 고친 뒤에는 10가지 뮤턴트를 실제로 주입해 전부 예측한 대로 RED(문구까지 일치)임을 검증하고 `cp` 로 원복(md5 동일 확인)했다 — 판별력이 실측됐다.
- `checked > 0` 단언은 약하지만, 부분 조건/CHECK 식을 문자열이 아니라 Postgres 가 실제로 정규화한 정의로 비교하는 설계(임시 테이블 + `pg_get_expr`/`pg_get_constraintdef`)는 표기 차이(`!=` vs `<>`, `IN (...)` vs `= ANY(...)`) 오탐을 원천적으로 차단한다.
- 트랜잭션(`BEGIN`)과 `SAVEPOINT`(`attempt()`) 조합으로, 개별 프로브 실패가 트랜잭션 전체를 죽이지 않으면서도 `finally` 블록이 항상 `ROLLBACK` 해 테스트 간 임시 테이블·인덱스가 남지 않는다(직렬 실행 `maxWorkers: 1` 과 결합해 테스트 격리도 안전).
- 엔티티 파일 6곳의 데코레이터 변경은 전부 `synchronize: false` 하의 선언(메타데이터)만 바꾸는 것이라 서비스 레벨 유닛 테스트에는 영향이 없고, 실제로 관련 파일(`app.module.spec.ts`, `integration-expiry-scanner.service.spec.ts` 등)을 grep 해도 이번 변경으로 깨질 만한 하드코딩된 제약/인덱스 이름 참조는 없었다.

## 요약

핵심 산출물인 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 RED-먼저 작성 → 정확히 8건 재현 → 수정 → 10가지 뮤턴트로 판별력 검증 → 원복까지 거친, 이 리포지토리 기준으로도 상당히 엄격한 테스트 워크플로를 거쳤다. 남은 지적은 전부 INFO 수준의 견고성 보강 제안이다: (1) `checked > 0` 하한이 완전한 커버리지 소실만 잡고 부분적 축소는 못 잡는다, (2) 개발 중 검증한 10개 뮤턴트 중 8개가 영구 테스트로 남지 않아 판정 로직 자체의 향후 회귀를 잡을 장치가 두 개(CHECK 인용·부분조건 정규화)뿐이다, (3) FK 테스트만 트랜잭션 래퍼가 없어 파일 내부 일관성이 떨어진다(버그는 아님), (4) DB 접속 기본값 중복은 기존 컨벤션을 따른 것이라 이번 PR 책임은 아니다. 6개 엔티티 파일 변경 자체는 `synchronize: false` 로 인해 동작 불변이며 별도 유닛 테스트가 필요한 새 런타임 로직도 없다.

## 위험도

LOW
