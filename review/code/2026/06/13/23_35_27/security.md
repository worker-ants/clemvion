# Security Review

## 발견사항

### **[INFO]** DB 커넥션 풀 파라미터 환경변수 노출 (`DB_POOL_MAX` 등)
- 위치: `codebase/backend/.env.example` 추가 라인, `codebase/backend/src/common/config/database.config.ts`
- 상세: `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` 가 환경변수로 노출된다. `nonNegativeIntEnv` 헬퍼가 음수·NaN·빈 문자열에 기본값으로 폴백하므로 잘못된 입력에 대한 파싱 안전성은 확보되어 있다. `DB_POOL_CONNECTION_TIMEOUT_MS=0` 이 "무한 대기"를 의미한다는 점이 `.env.example` 에 명시되어 있어 운영자가 의도치 않게 무한 대기를 설정하거나 DoS 유발 위험이 있으나, 이는 설계상 의도된 값(pg 기본 동작)이고 주석으로 경고가 기재되어 있다.
- 제안: 운영 환경에서 `DB_POOL_CONNECTION_TIMEOUT_MS`를 0 이 아닌 적절한 timeout 값(예: 5000ms)으로 설정하도록 운영 가이드에 추가 권장. `DB_POOL_MAX` 상한값 검증(예: 최대 100 이상 거부)을 `nonNegativeIntEnv` 또는 별도 가드로 추가하는 것을 고려할 수 있으나 현재 구현이 spec 요구사항을 충족한다.

### **[INFO]** 재귀 CTE 쿼리 사이클 방어 (`computeChainDepth`)
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `computeChainDepth` 메서드
- 상세: `WITH RECURSIVE` CTE에서 `WHERE c.depth < $2` ($2 = `RERUN_CHAIN_WALK_MAX`) 가드로 사이클 시 무한 재귀를 차단한다. 파라미터 바인딩(`$1`, `$2`)을 통해 SQL 인젝션 위험이 없다. `executionId`는 UUID로 관리되므로 직접 인젝션 가능성은 없다.
- 제안: 현재 구현이 적절하다. `RERUN_CHAIN_WALK_MAX` 상수값이 코드베이스 내에서 명확히 정의되어 있는지 확인 권장.

### **[INFO]** `updateExecutionStatus` guarded raw UPDATE — 파라미터 바인딩 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (라인 9307–9331)
- 상세: `status IN ('pending', 'running', 'waiting_for_input')` 가드가 SQL 리터럴로 하드코딩되어 있다. 이 값들은 상수 enum 값이고 외부 입력이 삽입되지 않으며, 나머지 모든 값(`$1`~`$7`)은 파라미터 바인딩으로 처리된다. `JSON.stringify`를 통해 jsonb 파라미터도 안전하게 직렬화된다. SQL 인젝션 위험 없음.
- 제안: 해당 없음.

### **[INFO]** keyset 배치 페이징 커서 초기값 (`ZERO_UUID`)
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 상세: `ZERO_UUID = '00000000-0000-0000-0000-000000000000'`를 keyset cursor 시작점으로 사용하며, TypeORM `MoreThan` 연산자를 통해 파라미터 바인딩으로 처리된다. 외부 입력이 cursor에 직접 반영되지 않으므로 인젝션 위험 없음. `lastId`는 DB에서 조회된 실제 레코드 id이므로 UUID 포맷이 보장된다.
- 제안: 해당 없음.

### **[INFO]** `embedding_status` 롤백 raw UPDATE (`enqueueEmbedChunked`)
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `enqueueEmbedChunked` 메서드
- 상세: `UPDATE document SET embedding_status = 'failed' WHERE id = ANY($1::uuid[])` 쿼리는 `slice` (string[] 배열)를 `$1`로 파라미터 바인딩하며 `::uuid[]` 타입 캐스팅으로 uuid 형식 검증이 DB 레벨에서 이루어진다. 값들은 이전 단계 DB 조회 결과이므로 외부 입력이 아니다. SQL 인젝션 위험 없음.
- 제안: 해당 없음.

### **[INFO]** `WorkflowVersionListItemDto` 에 `creator.email` 포함
- 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`, `workflow-version-response.dto.ts`
- 상세: 목록 조회(`findByWorkflow`)의 `select` 필드에 `creator: { id: true, name: true, email: true }`가 포함되어 작성자 이메일이 버전 목록 응답에 반환된다. 워크플로 버전 목록은 인증된 워크스페이스 멤버만 접근 가능하므로(JwtAuthGuard + assertWorkspaceOwnership 확인됨) 이메일 노출 범위는 동일 워크스페이스 멤버로 제한된다. 이는 이전 `WorkflowVersionDto`에서도 동일하게 노출되던 필드다.
- 제안: 인증/워크스페이스 격리가 확인되므로 현재 수준에서 허용 가능하다. 필요 시 이메일을 마스킹하거나 제외하는 것을 고려할 수 있다.

### **[INFO]** `.env.example`의 `DB_PASSWORD=workflow_dev` 기본값
- 위치: `codebase/backend/.env.example` (기존 값, 이번 변경에서 신규 추가된 것은 아님)
- 상세: 예제 파일이므로 실 운영 시크릿이 아니지만, `database.config.ts`의 코드 폴백(`|| 'workflow_dev'`)이 동일한 약한 패스워드를 기본값으로 사용한다. 이는 이번 변경 이전부터 존재하던 패턴이며 이번 변경에서 신규 도입된 것이 아니다.
- 제안: 운영 환경에서 반드시 강력한 패스워드로 교체되도록 배포 체크리스트 항목에 포함되어야 한다. 코드 기본값 폴백 자체는 개발 편의를 위한 것이나, 운영 배포에서 `.env` 없이 기동하는 경우를 방지하는 startup 가드(미설정 시 부팅 거부)를 고려할 수 있다.

## 요약

이번 변경은 데이터베이스 커넥션 풀 환경변수 노출, 실행 엔진의 guarded raw UPDATE 도입, keyset 배치 페이징, 재귀 CTE 기반 chain depth 계산, embedding 큐 청크 분할 등 주로 DB 성능·일관성 개선에 집중되어 있다. 검토한 모든 raw 쿼리는 파라미터 바인딩(`$1`, `$2`, `ANY($1::uuid[])`)을 일관되게 사용하여 SQL 인젝션 위험이 없다. 인증/인가 측면에서는 기존 JwtAuthGuard, RolesGuard, assertWorkspaceOwnership 체인이 유지되며 신규 엔드포인트나 퍼블릭 라우트가 추가되지 않았다. 하드코딩된 시크릿은 없으며, 에러 처리에서 민감 정보 노출 위험도 없다. 작성자 이메일이 버전 목록 응답에 포함되는 점은 워크스페이스 멤버 범위로 제한되어 설계상 허용 가능한 수준이다. `DB_POOL_CONNECTION_TIMEOUT_MS=0`(무한 대기 허용)은 운영 환경에서 적절히 설정되어야 하는 운영 위험이나 구현 결함은 아니다.

## 위험도

LOW
