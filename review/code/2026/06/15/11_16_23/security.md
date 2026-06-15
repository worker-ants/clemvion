# Security Review — Workflow Test Datasets

## 발견사항

### **[INFO]** `input` 필드: 비정형 JSONB 크기 제한 부재
- 위치: `create-workflow-test-dataset.dto.ts` (`@IsObject() input: Record<string, unknown>`), `update-workflow-test-dataset.dto.ts` 동일, `V097__workflow_test_dataset.sql` (`data JSONB`)
- 상세: `input` 필드는 `@IsObject()` 만 적용되어 있어 키/값 개수·중첩 깊이·전체 페이로드 크기에 제한이 없다. Postgres JSONB 는 단일 값 최대 1GB 를 허용하므로 악의적인 요청자가 대형 JSON 을 반복 저장해 DB I/O 및 메모리 부하를 유발할 수 있다(OASv3 `maxItems`/`maxProperties` 미명시 포함).
- 제안: `@MaxLength` 를 직접 적용하기 어려운 JSONB 특성상, `@ValidateNested` + 커스텀 파이프 또는 글로벌 request body size limit(NestJS `body-parser limit`)으로 최대 바이트 수를 제한한다. 추가로 `ValidationPipe({ transform: true })` 의 `forbidNonWhitelisted: true` 가 적용된 파이프라인인지 확인 권장.

---

### **[INFO]** `ownerId` 응답에 포함 — 내부 식별자 노출
- 위치: `workflow-test-dataset-response.dto.ts` (`ownerId: string`)
- 상세: `ownerId`(내부 UUID) 를 API 응답에 노출한다. 이 자체로는 보안 취약점은 아니나, 사용자가 다른 유저의 UUID 를 수집하는 attack surface 가 된다. `isOwner` 불리언이 이미 있어 클라이언트 로직에 `ownerId` 는 불필요한 경우가 많다.
- 제안: 클라이언트 요구사항 재검토 후 `ownerId` 노출이 필요하지 않다면 응답 DTO 에서 제거하거나 선택적으로만 포함하는 것을 권장.

---

### **[INFO]** `assertWorkflow` 미적용 경로 — update/remove/clone
- 위치: `workflow-test-datasets.service.ts`, `update()`, `remove()`, `clone()` 메서드
- 상세: `assertWorkflow`(워크플로우 존재·워크스페이스 귀속 검증)는 `list`와 `create` 에서만 호출된다. `update`, `remove`, `clone` 은 `findAccessible` 이 `workspaceId` 필터를 WHERE 절에 포함(`where: { id, workspaceId }`)해 workspace 격리를 간접 달성하고 있어 현재 동작은 올바르다. 그러나 향후 `findAccessible` 시그니처가 변경될 때 이 격리 보장이 암묵적으로 해제될 위험이 있다.
- 제안: 코드 의존이 아니라 명시적 의도를 남기는 주석("workspaceId 격리는 findAccessible WHERE 절로 보장됨") 또는 테스트 케이스 E 의 검증을 모든 변이 동사(update/remove/clone)에 각각 추가.

---

### **[INFO]** `findAccessible` 의 `workspaceId` 분리 미검증
- 위치: `workflow-test-datasets.service.ts`, `findAccessible` 내 `this.datasetRepository.findOne({ where: { id, workspaceId } })`
- 상세: `workspaceId` 는 JWT/세션이 아닌 요청 헤더(`X-Workspace-Id`)로부터 주입된다(컨트롤러의 `@WorkspaceId()` 데코레이터). 이 헤더가 middleware/guard 에서 JWT 클레임과 교차 검증되지 않을 경우 공격자가 임의 `workspaceId` 를 헤더에 지정해 다른 워크스페이스의 데이터에 접근을 시도할 수 있다. 본 변경 파일 범위 안에서는 `@WorkspaceId()` 데코레이터 내부 구현을 확인할 수 없으나, 기존 모듈들이 동일 패턴을 사용하므로 이미 검증 로직이 있다면 INFO 수준이다.
- 제안: `@WorkspaceId()` 데코레이터가 JWT `workspaceId` 클레임과 헤더 값을 대조하거나, guard 에서 멤버십을 검증하는지 확인. 그렇지 않으면 해당 guard 에 워크스페이스 멤버십 검증 추가 필요.

---

### **[INFO]** 에러 메시지 구조 — 내부 코드 키 노출
- 위치: `workflow-test-datasets.service.ts`, 모든 예외 throw (`{ code: 'RESOURCE_NOT_FOUND', message: ... }`, `{ code: 'FORBIDDEN', ... }`, `{ code: 'DUPLICATE_NAME', ... }`)
- 상세: NestJS 기본 예외 필터는 이 객체를 `{ statusCode, message, error }` 형태로 직렬화한다. `code` 필드가 그대로 응답에 포함되면 내부 에러 분류 키가 노출된다. 현재 설계 의도(클라이언트가 code 를 사용)라면 의도적이나, 이 code 체계가 문서화·표준화되어 있는지 확인 필요.
- 제안: 이미 코드베이스 전체가 이 패턴을 쓴다면 INFO 수준으로 수용. 그렇지 않다면 전역 exception filter 가 code 를 노출·은닉하는 방식을 통일.

---

## 요약

이번 변경은 `workflow_test_dataset` 테이블 신설 및 CRUD API 구현을 포함한다. 보안 관점에서 전반적으로 견고한 설계를 보인다. TypeORM 파라미터 바인딩으로 SQL 인젝션이 차단되며(`createQueryBuilder` 의 named parameter 사용), UUID PrimaryKey + `ParseUUIDPipe` 로 파라미터 타입이 강제된다. 인가는 `@Roles('editor')` 가드 + `findAccessible` 내 ownerId/workspaceId 이중 필터로 IDOR 및 권한 우회를 방어하고, 비소유 private 데이터셋에는 404 존재 은닉(information hiding)을 적용해 열거 공격을 억제한다. 하드코딩된 시크릿, 평문 전송, 안전하지 않은 해시 알고리즘 사용 사례는 없다. 발견된 사항은 모두 INFO 수준으로, 즉시 수정이 필요한 Critical/Warning 취약점은 없다.

## 위험도

LOW
