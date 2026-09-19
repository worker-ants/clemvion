# 유지보수성(Maintainability) 리뷰

검토 범위: 엔티티 8개 파일의 컬럼 데코레이터 정정(`alert-rule` · `edge` · `integration-usage-log` · `llm-usage-log` ·
`model-config` · `node` · `workflow-assistant-session` · `workspace-invitation`)과, 컬럼 층 가드를 추가한
`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`. `plan/**`·`review/consistency/**` 산출물은
애플리케이션 코드가 아니라 유지보수성 관점(가독성/네이밍/함수 길이/중첩/매직 넘버/중복/복잡도/일관성) 평가 대상에서 제외했다.

## 발견사항

- **[INFO]** 읽기 전용 `DataSource` 구성에 타입 단언(`as DataSourceOptions`)을 써서 컴파일러 검사를 우회한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:544` (`const readOnly = new DataSource({ ...dataSourceOptions(), extra: { ... } } as DataSourceOptions);`)
  - 상세: `dataSourceOptions()`(같은 파일 183번 줄)의 반환 타입이 넓은 유니온 `DataSourceOptions`로 선언돼 있어, `extra` 필드를 덧붙이는 스프레드가 타입 체커를 통과하지 못하고 `as`로 눌러야 한다. 단언은 `extra.options` 문자열이 잘못돼도 컴파일 타임에 잡히지 않는다는 뜻이라, 이후 이 함수를 다른 커넥션 변형에 재사용할 때 같은 캐스팅이 반복되기 쉽다.
  - 제안: `dataSourceOptions()`의 반환 타입을 `postgres` 전용 좁은 타입(예: TypeORM `PostgresConnectionOptions`)으로 좁히면 `extra` 확장 시 캐스트 없이도 타입이 통과한다. 사소한 스타일 이슈이며 테스트 코드에 한정돼 위험은 낮다.

- **[INFO]** 카탈로그 스냅샷 함수의 반환 타입이 `unknown`이라 무엇을 비교하는지 타입으로 드러나지 않는다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:533` (`const catalog = async (): Promise<unknown> => ...`)
  - 상세: 실제로는 `{ columns: string; enums: string }` 형태의 단일 행을 돌려주는데 `unknown`으로 지워 놓아, `toEqual(before)` 비교가 무엇을 검증하는지 타입 정의만 봐서는 알 수 없다. 함수 바로 위 주석이 의도(컬럼 정의·enum 타입 해시 비교)를 설명해 실질적 위험은 낮지만, 다음에 이 헬퍼를 다른 곳에서 재사용하면 타입 정보 부재가 실수를 감출 수 있다.
  - 제안: `Promise<{ columns: string | null; enums: string | null }>` 정도로 명시하면 IDE 자동완성·리팩터링 안전성이 올라간다.

- **[INFO]** 비교기 DDL 결과를 담는 지역 변수명 `log`가 로깅과 무관한데도 로거를 연상시킨다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:549` (`let log: SqlInMemory;`)
  - 상세: `SqlInMemory`는 "기록된 SQL 묶음"이라는 도메인 의미인데 변수명이 `log`라서, 파일 전반의 다른 서술적 변수명(`before`, `columnLevel`, `readOnly`)과 톤이 약간 어긋난다. 기능상 문제는 없다.
  - 제안: `ddl` 또는 `sqlMemory` 등으로 바꾸면 이름만으로 "무엇을 담는가"가 더 분명해진다.

- **[INFO]** `COLUMN_LEVEL_SAMPLES`가 특정 TypeORM 버전(0.3.31)이 낸 정확한 DDL 문자열에 결합돼 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:75-97`
  - 상세: 다섯 정규식의 판별력을 대조군 표본으로 고정한 설계 자체는 좋다(리뷰 1라운드 지적을 반영한 견고화). 다만 표본이 TypeORM이 실제로 낸 문장 그대로라, 향후 TypeORM 버전을 올려 DDL 문구가 미묘하게 바뀌면(예: 따옴표 규칙, `USING` 캐스트 표현) 이 표본 테스트가 오탐 RED를 낼 수 있다. 코드 상단 주석이 버전과 채집 경위를 명시해 둔 점은 이미 이 리스크를 인지하고 문서화한 것으로 보인다 — 추가 조치는 필요 없고, TypeORM 업그레이드 시 이 표본을 재채집해야 한다는 점만 상기시킨다.

## 검토했으나 문제 아님 (참고)

- 엔티티 8개 파일의 변경은 모두 한두 줄짜리 데코레이터 옵션 추가(`type: 'uuid'` · `enumName` · `default`)이며, 같은 파일 내 이미 존재하는 동종 컬럼(예: `alert-rule.entity.ts`의 `workflowId`·`createdBy`가 이미 `type: 'uuid'`를 쓰고 있던 것)과 표기 방식이 일치해 오히려 파일 내부 일관성이 개선됐다.
- `dataSourceOptions()` 추출(183번 줄)은 `beforeAll`에 있던 `DataSource` 생성자 인자 리터럴을 함수로 뽑아 새 테스트와 공유한 것으로, 중복 제거 방향이 맞다.
- `UNDECLARED_COLUMNS`(46번 줄)·`COLUMN_LEVEL`(62번 줄)·`isColumnLevel`(99번 줄)은 이름이 각자의 역할(선언을 생략한 컬럼 목록 / 컬럼 정의 변경 문 패턴 / 판별 함수)을 정확히 드러내고, 파일 전반의 기존 네이밍 관례(`FK_ACTION`, `reportMatch` 등 목적 중심 이름)와 일관된다.
- 새 테스트 두 개(513번 줄, 526번 줄)는 각각 "패턴 자체의 판별력"과 "실제 비교기 호출"을 분리해 검증하는데, 이는 파일 앞부분의 기존 "판별력 대조군" 패턴(330번 줄)과 같은 설계 관용구를 재사용한 것이라 일관성이 높다.
- 526번 줄 테스트는 40줄로 다소 길지만, 예방(읽기 전용 세션)·탐지(카탈로그 비교)라는 두 겹 방어를 한 테스트 안에서 순서대로 수행해야 하는 e2e 시나리오 특성상 분리하면 오히려 각 조각의 독립적 의미가 흐려진다. 같은 파일의 기존 대형 테스트(370번 줄 `@Index · @Unique` 검증)와 비교해도 과도하게 길지 않다.

## 요약

이번 변경은 규모가 작고(엔티티 8개 파일은 각각 한 속성 추가) 목적이 명확하며, 테스트 파일에 추가된 컬럼 층 가드도 기존 파일의 설계 관용구(정규화 비교, 판별력 대조군, ROLLBACK 격리)를 그대로 따라 일관성이 높다. 지적한 4건은 모두 INFO 수준으로, 타입 단언 하나를 좁은 타입으로 바꾸면 없앨 수 있는 사소한 타입-정밀도 이슈와 변수명 하나, 그리고 이미 주석으로 인지·문서화된 버전 결합 리스크뿐이다. 가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도·기존 스타일 준수 어느 관점에서도 구조적 결함은 발견되지 않았다.

## 위험도

LOW
