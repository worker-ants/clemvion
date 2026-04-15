### 발견사항

해당 없음

이번 변경사항은 다음 내용으로 구성되어 있습니다:
- `zod` 의존성 추가 및 패키지 버전 업데이트 (`package.json`, `package-lock.json`)
- `NodeComponentRegistry` 도입 및 노드 핸들러 등록 방식 리팩토링 (`execution-engine.service.ts`, `execution-engine.module.ts`)
- 노드 컴포넌트 구조 정의 파일 추가 (`nodes/core/**`, `nodes/{ai,data,flow,...}/**`)
- `GET /nodes/definitions` API 엔드포인트 추가 (`nodes.controller.ts`)
- 스펙 문서 갱신 (`spec/4-nodes/0-overview.md`)

변경된 코드 중 데이터베이스와 직접 관련된 요소(ORM 쿼리, 스키마 마이그레이션, 트랜잭션, 커넥션 관리, SQL 등)는 존재하지 않습니다.

### 요약

본 변경사항은 순수하게 노드 컴포넌트 레지스트리 아키텍처 리팩토링과 Zod 기반 스키마 검증 도입에 관한 것으로, 데이터베이스 레이어에는 영향을 주지 않습니다.

### 위험도
NONE