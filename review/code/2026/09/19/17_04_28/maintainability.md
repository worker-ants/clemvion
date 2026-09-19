# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `default: () => 'now()'` 소문자 표기가 코드베이스 관례(대문자 `NOW()`)와 다르다
  - 위치: `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:78` (`lastInteractionAt` 컬럼)
  - 상세: 같은 SQL 함수 리터럴 기본값을 표현하는 다른 엔티티들은 전부 대문자를 쓴다 — `codebase/backend/src/modules/execution-engine/entities/execution-node-log.entity.ts:35`, `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:63`, `codebase/backend/src/modules/executions/entities/execution.entity.ts:52,56` 는 모두 `default: () => 'NOW()'`. 이번 diff 는 `default: () => 'now()'` 로 소문자다. Postgres 는 함수명 대소문자를 구분하지 않고 TypeORM 스키마 비교기도 이번에 추가된 컬럼-층 가드 테스트를 GREEN 으로 통과시키므로 **기능상 문제는 없다** — 순수하게 동일 개념의 표기 컨벤션이 파일마다 갈리는 일관성 문제다.
  - 제안: 신규 코드에서는 기존 다수 관례(`NOW()` 대문자)를 따르거나, 이 기회에 어느 쪽이 정본인지 `spec/conventions/` 나 코드 주석에 한 줄로 못박아 다음에 또 갈리지 않게 한다.

- **[INFO]** `UNDECLARED_COLUMNS` 의 키가 TypeORM 이 내는 원문 SQL 문자열 그대로다 — 드라이버 출력 포맷에 강하게 결합
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:44-53` (`UNDECLARED_COLUMNS` 상수)
  - 상세: 예외 목록의 키가 `'ALTER TABLE "document_chunk" DROP COLUMN "embedding"'` 같은 공백-정규화된 완전한 DDL 문자열이다. `{table, column}` 같은 구조화된 값 대신 TypeORM 스키마 비교기가 내는 정확한 문구(따옴표·공백·키워드 순서)에 의존한다. 같은 파일의 두 번째 `expect`(예외 목록이 낡지 않았는지 확인)가 포맷이 바뀌면 즉시 RED 로 잡아 주므로 **조용한 실패는 아니지만**, TypeORM 버전업으로 출력 포맷(예: `ADD COLUMN` vs `ADD`, 따옴표 스타일)이 바뀌면 이 상수와 주석을 함께 고쳐야 하는 결합이 생긴다.
  - 제안: 현재로선 자기검증 단언이 있어 당장 고칠 필요는 없다 — 다음에 TypeORM 을 올릴 때 이 상수가 가장 먼저 깨질 자리라는 점만 인지하면 충분하다.

- **[INFO]** 엔티티 컬럼 선언 수정(파일 1~8) — 전부 기존 파일 내 형제 컬럼 패턴과 정확히 일치, 긍정적 관찰
  - 위치: `codebase/backend/src/modules/{alerts,edges,integrations,llm,model-config,nodes,workflow-assistant,workspaces}/entities/*.entity.ts`
  - 상세: `type: 'uuid'` 추가는 같은 파일에 이미 있는 다른 uuid FK 컬럼(`workflowId`, `createdBy` 등)의 표기와 동일하고, `enumName` 추가는 코드베이스에 존재하는 유이한 두 enum 컬럼(`Node.category`, `Edge.type`) 모두에 일관되게 적용됐다(`grep` 결과 이 둘 외 `type: 'enum'` 컬럼 없음). 각 diff 가 1줄 단위로 국소적이라 가독성·리뷰 부담이 낮다.
  - 제안: 없음 — 그대로 두면 됨.

- **[INFO]** 신규 컬럼-층 가드 테스트(`entity-schema-declarations.e2e-spec.ts:474-486`)는 짧고 단일 책임, 기존 세 테스트와 스타일 일관
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:474`
  - 상세: 새 `it` 블록은 13줄, 중첩 없이 `map`/`filter` 체인 두 번과 `expect` 두 번으로 끝난다. 파일 상단 docstring 을 "인덱스·제약 층은 한쪽" / "컬럼 층은 양방향" 두 문단으로 나눠 갱신한 것도 명확하다. `COLUMN_LEVEL` 정규식 배열과 주석이 무엇을 걸러내고 무엇을 의도적으로 제외하는지(FK/인덱스/유니크 이름 차이, `COMMENT ON`) 설명해 다음 사람이 왜 그 목록만 있는지 추론할 필요가 없게 했다.
  - 제안: 없음.

## 요약

이번 diff 는 아홉 곳의 엔티티 컬럼 선언 정정(각 1~5줄의 국소 patch)과 그 회귀를 막는 e2e 가드 확장(약 40줄 추가)으로 구성되며, 전체적으로 유지보수성 관점에서 흠잡을 곳이 거의 없다. 엔티티 수정은 모두 같은 파일 내 기존 패턴을 그대로 따라 새 컨벤션을 만들지 않았고, 가드 테스트 확장은 목적·범위·제외 대상을 상수 옆 주석과 파일 상단 docstring에 명확히 남겨 가독성이 높다. 유일하게 짚을 점은 `default: () => 'now()'` 의 대소문자가 코드베이스 다수 관례(`NOW()`)와 다르다는 것과, 새 예외 목록이 TypeORM 이 내는 원문 SQL 문자열에 의존해 향후 TypeORM 업그레이드 시 함께 깨질 결합이 생긴다는 것인데, 둘 다 기능 결함이 아니고 자기검증 장치(두 번째 assert)가 있어 조용히 썩지 않는다.

## 위험도
LOW
