# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `default` 신규 선언(ModelConfig.kind, WorkflowAssistantSession.lastInteractionAt)의 런타임 영향(`ReturningResultsEntityUpdator` 가 insert 뒤 `RETURNING` 으로 값을 채움)을 검증하는 전용 단위/통합 테스트가 없다 — plan(`plan/in-progress/entity-column-declaration-drift.md` "런타임 영향" 절)도 "e2e 전체로 확인한다"로만 적어, 이 구체적 동작을 타겟하는 단언은 없다.
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`(`kind` default 추가), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`(`lastInteractionAt` default 추가)
  - 상세: 확인해 보니 두 필드 모두 애플리케이션 코드가 항상 명시적으로 값을 채운다 — `kind` 는 `CreateModelConfigDto`/서비스 파라미터에서 필수(`codebase/backend/src/modules/model-config/dto/create-model-config.dto.ts:37`), `lastInteractionAt` 은 `workflow-assistant-session.service.ts` `create()` 에서 `lastInteractionAt: now` 로 매번 명시된다(`codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:94`). 즉 이번 `default` 선언이 실제 insert 경로의 값을 바꾸는 시나리오는 현재 코드베이스에 없어 리스크는 낮지만, 그 사실 자체(=insert 시 값이 항상 명시된다)를 확인하는 테스트도 "RETURNING으로 defaults 가 채워진다"를 확인하는 테스트도 없다. 전체 e2e 통과는 이 특정 경로가 실제로 실행됐다는 보장이 약하다(회귀가 생겨도 다른 통과 테스트들에 가려질 수 있다).
  - 제안: 필수는 아니나, 두 엔티티 중 하나라도 향후 값 생략 경로가 생기면 대비해 "필드 생략 후 save() → 반환 엔티티에 DB 기본값이 채워진다"를 확인하는 좁은 e2e/통합 테스트를 추가하면 이 특정 회귀(예: 나중에 누군가 `default` 를 지워도 이 테스트가 안 잡던 경로)를 별도로 잡을 수 있다.

- **[INFO]** 컬럼 층 가드의 마지막 테스트(`entity-schema-declarations.e2e-spec.ts` "컬럼 — TypeORM 스키마 비교기가...")가 TypeORM 의 비공개 내부 API(`driver.createSchemaBuilder().log()`, `SqlInMemory`)에 의존한다 — 주석 자체가 "공개 계약이 아니라 소스로 확인한 것"이라고 명시한다.
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `entity-schema-declarations.e2e-spec.ts:526`(`it('컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다...')`)
  - 상세: TypeORM 마이너/패치 업그레이드 시 `createSchemaBuilder()` 시그니처나 `log()` 동작이 바뀌면 이 테스트가 컴파일/런타임에서 깨질 수 있다. 다만 이미 두 겹 방어(읽기 전용 세션 + 카탈로그 해시 비교)로 "조용히 DB 를 바꾸는" 실패 모드는 막혀 있고, RO1 뮤턴트(읽기 전용 세션에서 DDL 실행 시도 → RED)로 그 전제를 직접 검증했다. API 자체가 사라지거나 반환 타입이 바뀌는 경우는 방어 대상이 아니라 타입체크/CI 가 잡을 문제라 실사용 리스크는 낮다. 테스트 용이성 관점에서 참고 사항으로만 남긴다.
  - 제안: 별도 조치 불요. TypeORM 버전 업그레이드 PR 체크리스트에 "이 e2e 파일 재확인" 한 줄을 남겨두면 좋다.

- **[INFO]** `COLUMN_LEVEL_SAMPLES` 의 `caught` 항목이 정확 문자열 일치(`UNDECLARED_COLUMNS.has(q)`)에 의존한다 — TypeORM 이 향후 DDL 문구를 미세하게 바꾸면(예: `DROP COLUMN` 에 `CASCADE` 추가) 정상적으로 실패(RED)하게 설계돼 있어 안전 쪽으로 치우쳐 있지만, 유지보수 비용(문자열 갱신)이 TypeORM 업그레이드마다 발생할 수 있다.
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:46-55`(`UNDECLARED_COLUMNS`), `:526-565`(비교 테스트)
  - 상세: 결함이 아니라 설계 트레이드오프 — 조용한 통과(false green)보다 시끄러운 실패를 택한 것으로, 이 리뷰 관점에서는 오히려 바람직한 선택이다. 참고로만 기록.
  - 제안: 조치 불요.

## 요약

컬럼 층 가드 확장은 두 차례 리뷰 라운드(WARNING → 패턴 판별력 대조군 추가, 카탈로그 탐지 → 읽기 전용 세션 예방)를 거치며 테스트 자체의 결함을 스스로 드러내고 고친 이력이 뚜렷하다. 아홉 개 엔티티 수정 각각을 되돌리는 뮤턴트(C1~C9)가 전부 RED, 다섯 정규식 패턴이 실제 채집 표본으로 개별 검증됨(P1~P4), `log()` 가 DB 를 바꾸지 않는다는 전제는 읽기 전용 세션(예방)과 카탈로그 해시(탐지)로 이중 검증됨(RO1)까지 — 회귀 테스트 근거가 충분히 축적돼 있다. 새 e2e 테스트는 기존 3개 테스트와 격리돼 있고(각자 로컬 `problems` 배열, `readOnly` DataSource 는 `finally` 로 반드시 정리), unit/e2e 계층 분리도 `jest-e2e.json` 으로 명확하다. 발견된 갭은 모두 INFO 수준 — `default` 선언의 RETURNING 런타임 영향을 타겟하는 전용 테스트 부재(다만 애플리케이션 코드가 항상 값을 명시해 실제 리스크는 낮음)와 TypeORM 비공개 API·정확 문자열 매칭에 대한 의존(이미 문서화·이중 방어됨)이다. 전체적으로 이 diff 는 테스트 관점에서 모범적인 수준이다.

## 위험도
LOW
