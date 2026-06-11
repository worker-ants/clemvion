# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: audit-action.const.ts

- **[INFO]** 네이밍 일관성 — 상수 키와 런타임 값 사이의 시제 혼재
  - 위치: 파일 전체 (`AUDIT_ACTIONS` 객체 내부)
  - 상세: `INTEGRATION_CREATED` → `'integration.created'` (과거분사), `WORKSPACE_TRANSFER_OWNERSHIP` → `'workspace.transfer_ownership'` (동사원형), `EXECUTION_RE_RUN` → `'execution.re_run'` (동사원형). JSDoc 에 "도메인 관례를 따른다"고 명시했으나, 이 예외를 처음 읽는 개발자는 키 이름만 보고 값 형태를 예측하기 어렵다. 특히 `WORKSPACE_TRANSFER_OWNERSHIP` 은 키가 동사원형이고 값도 동사원형이라 integration 계열과 다르다는 사실을 주석 없이는 파악하기 어렵다.
  - 제안: 현 규약(도메인별 시제 허용)을 유지하되, JSDoc 의 예외 사유를 조금 더 명확히 서술하거나, 향후 `workspace.ownership_transferred` 처럼 과거분사 통일을 고려한다. 이 자체가 결함은 아니지만 신규 action 추가 시 혼선의 씨앗이 될 수 있다.

- **[INFO]** `AuditAction` 타입 노출 방식 — 추가적인 타입 가드 부재
  - 위치: line 61 (`export type AuditAction = ...`)
  - 상세: `AuditAction` 은 union of string literals 이며 컴파일 타임 강제는 충분하다. 런타임에서 외부 입력(예: DB 에서 읽어온 문자열)을 `AuditAction` 으로 narrowing 할 때는 별도 type guard 나 `isAuditAction(v)` 헬퍼가 없어 수작업 캐스팅이 필요하다. 현재 사용 패턴(service 내부에서만 기록)에서는 문제없지만, 쿼리 필터 파라미터(`QueryAuditLogDto.action`)가 `string` 타입인 점과 대비된다.
  - 제안: 당장 필요하지 않지만 `QueryAuditLogDto.action` 을 `AuditAction` 또는 `AuditAction | undefined` 로 좁히는 리팩터를 follow-up 으로 고려한다.

---

### 파일 2: audit-logs.service.ts

- **[INFO]** `findAll` 의 매직 기본값
  - 위치: lines 155–156 (`page = 1`, `limit = 20`, `sort = 'created_at'`, `order = 'desc'`)
  - 상세: `limit = 20` 이 두 군데(여기, `auth-configs.service.ts` 의 `findAll`)에서 반복된다. 현재는 동일 모듈 내에서 패턴 일치이지만, 나중에 기본 페이지 크기가 변경될 경우 누락 지점이 생길 수 있다.
  - 제안: 공통 `DEFAULT_PAGE_SIZE = 20` 상수를 `common/constants` 에 두거나, `PaginationQueryDto` 기본값으로 일원화한다.

- **[INFO]** `getSortColumn` 허용 컬럼 목록이 내부에 하드코딩
  - 위치: lines 231–238
  - 상세: `allowed` 객체의 키가 외부(컨트롤러/DTO)에서 허용하는 정렬 파라미터와 동기화되어 있는지 컴파일 타임에 확인할 방법이 없다. 허용 목록이 두 곳에 관리된다.
  - 제안: `QueryAuditLogDto` 의 `@IsIn([...])` 검증 목록을 exported 상수로 추출해 `getSortColumn` 의 `allowed` 에서 재사용한다.

---

### 파일 3: audit-log-response.dto.ts

- **[INFO]** `action` 필드 타입이 `string` 으로 느슨하게 선언
  - 위치: line 301 (`action: string`)
  - 상세: 응답 DTO 의 `action` 이 `string` 이어서 OpenAPI schema 에도 단순 string 으로 노출된다. `AuditAction` union 을 `@ApiProperty({ enum: Object.values(AUDIT_ACTIONS) })` 로 노출하면 API 문서 품질이 높아지고 클라이언트 SDK 자동생성 시에도 유리하다.
  - 제안: `action: AuditAction` + `@ApiProperty({ enum: Object.values(AUDIT_ACTIONS) })` 로 변경한다. 이미 `audit-action.const.ts` 에 SoT 가 있으므로 중복 없이 참조 가능하다.

---

### 파일 4: auth-configs.service.ts

- **[INFO]** 이중 import — `crypto` 네임스페이스와 named import 혼용
  - 위치: lines 362–363 (`import * as crypto from 'crypto'` + `import { randomBytes } from 'crypto'`)
  - 상세: `crypto.createHmac`, `crypto.timingSafeEqual` 은 네임스페이스로, `randomBytes` 는 named import 로 각각 사용한다. 두 가지 방식이 같은 파일에 공존하면 스타일이 불일치하고 신규 기여자가 어느 패턴을 따를지 혼란스럽다.
  - 제안: `import { randomBytes, createHmac, timingSafeEqual } from 'crypto'` 로 통일하거나, `import * as crypto from 'crypto'` 하나만 남기고 `crypto.randomBytes` 로 사용한다.

- **[INFO]** `create` 메서드의 type 별 분기 중복 — `regenerate` 와 거의 동일한 구조
  - 위치: `create` (lines 462–481) 과 `regenerate` (lines 494–509)
  - 상세: `api_key` → `wfk_…`, `bearer_token` → `wft_…`, `hmac` → `whs_…` 를 생성하는 로직이 두 메서드에서 반복된다. `create` 는 `header`/`algorithm` 기본값 설정이 추가되어 완전히 동일하지는 않지만, secret 생성 로직은 추출 가능하다.
  - 제안: `private generateSecret(type: string): string` 같은 헬퍼를 추출해 두 메서드가 호출하면 중복이 제거되고 prefix 규칙이 한 곳에서 관리된다.

- **[INFO]** `getUsage` 의 매직 숫자 `20`
  - 위치: line 793 (`.limit(20)`)
  - 상세: `recentCalls` 최대 20건이 인라인으로 하드코딩되어 있다. 이름 있는 상수가 없어 변경 시 검색에 의존해야 한다.
  - 제안: `const RECENT_CALLS_LIMIT = 20` 또는 모듈 상단의 공통 page size 상수로 관리한다.

---

### 파일 5: executions-rerun.service.spec.ts

- **[INFO]** `workspaces` 의존성이 일부 테스트에서 누락 상태로 시작
  - 위치: line 908 (`service = new ExecutionsService(... workspaces as never)`)
  - 상세: `serviceWithRealAudit` 생성(line 1243–1251) 시 `workspaces` 인자가 누락된 채 `new ExecutionsService(... realAudit as never)` 로 8개 인자만 전달된다. 현재 해당 테스트 경로에서 `workspaces` 를 호출하지 않아 통과하지만, 생성자 인자 수 불일치는 향후 인자 추가 시 조용히 깨질 수 있다.
  - 제안: `serviceWithRealAudit` 생성 시에도 `workspaces as never` 를 명시적으로 포함한다.

- **[INFO]** `action` 값이 테스트에서 리터럴 문자열로 중복 선언
  - 위치: lines 982, 985 (`action: 'execution.re_run'`)
  - 상세: 테스트가 `AUDIT_ACTIONS.EXECUTION_RE_RUN` 상수 대신 리터럴 문자열 `'execution.re_run'` 을 직접 사용한다. 상수 값이 변경될 경우 테스트가 false-positive 를 낼 수 있다.
  - 제안: `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'` 을 추가해 `action: AUDIT_ACTIONS.EXECUTION_RE_RUN` 로 참조한다.

---

### 파일 6: executions.module.ts

발견된 유지보수성 이슈 없음. 주석이 변경된 액션 이름을 정확히 반영하고 있다.

---

### 파일 7: executions.service.spec.ts

- **[INFO]** 주석이 리터럴 문자열로 작성됨
  - 위치: line 1564 (`// auditLogsService (execution.re_run)`)
  - 상세: 파일 5와 동일 패턴. 테스트 코드의 주석은 영향이 작지만 일관성 차원에서 언급한다. 실제 assertions 에서는 문자열 리터럴 사용이 없으므로 현재 이 파일의 실질적 위험은 낮다.
  - 제안: 일관성을 위해 주석도 상수 이름(`AUDIT_ACTIONS.EXECUTION_RE_RUN`)을 인용한다.

---

## 요약

이번 변경의 핵심인 `AUDIT_ACTIONS` 상수 도입과 `action: string → AuditAction` 강제는 유지보수성 관점에서 긍정적이다. 인라인 리터럴을 단일 SoT 로 집중시키는 방향이며, JSDoc 에 규약과 미구현 항목까지 기록한 점은 모범적이다. 주요 개선 여지는 (1) 테스트에서 리터럴 문자열 대신 상수를 참조하지 않아 SoT 효과가 테스트까지 전파되지 않는 점, (2) 응답 DTO 의 `action` 필드가 여전히 `string` 으로 느슨해 OpenAPI 문서에서 가능한 값이 드러나지 않는 점, (3) `auth-configs.service.ts` 의 `crypto` 이중 import 와 secret 생성 로직 중복이다. 치명적 문제는 없으며 전반적인 유지보수성은 향상되었다.

## 위험도

LOW
