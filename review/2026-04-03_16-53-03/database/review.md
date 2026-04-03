해당 없음

이번 변경사항은 데이터베이스와 무관합니다. 변경 내용은 전적으로 워크플로우 실행 엔진의 인메모리 데이터 처리 로직에 해당합니다:

- `table.handler.ts`: 테이블 노드의 컬럼 필드에 대한 표현식 평가 및 중첩 경로(dot-path) 지원 추가
- `table.handler.spec.ts`: 신규 기능에 대한 단위 테스트 추가
- `expression-exclusions.ts`: 표현식 해석 제외 설정에 `table.columns` 추가
- `node-handler.interface.ts`: `ExecutionContext` 인터페이스에 `expressionContext` 필드 추가
- `execution-engine.service.ts`: 핸들러에 표현식 컨텍스트 전달
- `evaluator.ts`: `ExpressionContext`에 테이블 전용 변수(`$dataSource`, `$sourceItem`, `$sourceItemIndex`) 타입 추가

데이터베이스 쿼리, 스키마 변경, ORM 접근, 커넥션 관리 등과 관련된 코드가 전혀 없습니다.

### 위험도
NONE