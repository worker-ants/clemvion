해당 없음

변경된 파일들은 데이터베이스와 직접적인 관련이 없습니다. 이번 변경사항은 다음 범주에 속합니다:

- **error-codes.ts / error-codes.spec.ts**: 서브 워크플로우 전용 에러 코드 3개 추가 (`SUB_WORKFLOW_NOT_FOUND`, `SUB_WORKFLOW_TIMEOUT`, `SUB_WORKFLOW_QUEUE_FAILED`) — 순수 TypeScript 상수 정의
- **workflow.handler.ts / workflow.handler.spec.ts**: 서브 워크플로우 실행 핸들러 로직 변경 (sync 결과 래핑, async 출력 보강, 에러 코드 세분화) — 워크플로우 오케스트레이션 레이어
- **workflow.schema.ts**: Zod 스키마 필드명 변경 (`target`/`source` → `paramName`/`expression`)
- **flow.mdx / flow.en.mdx**: 문서 업데이트
- **plan 문서 / spec 문서**: 작업 진행 상태 기록

데이터베이스 쿼리, 스키마 마이그레이션, ORM, 커넥션 관리 등 DB 관련 코드가 포함되지 않습니다.

### 위험도
NONE