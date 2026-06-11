# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### **[WARNING]** `crypto` 이중 임포트 — namespace import 와 named import 혼용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L8-9
- 상세: `import * as crypto from 'crypto'` 와 `import { randomBytes } from 'crypto'` 가 동시에 존재한다. `randomBytes` 는 `crypto.randomBytes` 로 완전히 대체 가능하며, 두 임포트 경로가 동일 모듈을 중복 참조한다. 빌드 도구에 따라 번들 중복이 없더라도 임포트 스타일 불일치가 코드베이스 일관성을 해친다.
- 제안: `import { randomBytes } from 'crypto'` 를 제거하고 `create` 및 `regenerate` 메서드 내의 `randomBytes(...)` 를 `crypto.randomBytes(...)` 로 교체하거나, 반대로 `import * as crypto` 를 제거하고 필요한 심볼(`randomBytes`, `timingSafeEqual`, `createHmac`)을 named import 로 일괄 열거. 프로젝트 다른 서비스가 어느 패턴을 따르는지 확인 후 일관성 있게 적용.

---

### **[INFO]** `audit-action.const.ts` — 도메인별 동사 시제 혼재가 규약 주석에만 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/audit-action.const.ts` L6-11
- 상세: `INTEGRATION_*` 계열은 과거분사(`created`/`updated`/`deleted`/`rotated`/`scope_changed`/`reauthorized`), `WORKSPACE_TRANSFER_OWNERSHIP` 은 동사원형 복합명사, `EXECUTION_RE_RUN` 은 복합형, `AUTH_CONFIG_*` 는 현재형 동사원형이다. 이 혼재는 도메인별 의도적 선택이고 헤더 JSDoc 에 이유가 서술돼 있다. 그러나 `WORKSPACE_TRANSFER_OWNERSHIP` 에 대한 시제·형식 근거는 주석에 없어, 새 도메인 추가자가 이 항목을 레거시로 오인하거나 잘못된 패턴을 따를 수 있다.
- 제안: 헤더 JSDoc 의 도메인 열거에 `workspace` 도 추가해 "workspace 는 동사원형 복합명사 형태" 임을 명시. 예: `workspace 는 명령형 복합명사 \`transfer_ownership\`.`

---

### **[INFO]** `auth-configs.service.ts` — 감사 record 호출 블록 4중 반복 (리팩토링 기회)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L140-147, L162-169, L194-201, L214-221
- 상세: `create`/`update`/`regenerate`/`remove` 모두 동일한 구조의 `auditLogsService.record({...})` 호출을 인라인으로 반복한다. `AUTH_CONFIG_RESOURCE_TYPE` 상수로 `resourceType` 리터럴은 이미 단일화됐지만, 호출 패턴 자체(`workspaceId`, `userId`, `action`, `resourceType`, `resourceId`, `ipAddress` 6개 필드)가 4회 복제돼 있다. 현재 규모에서는 기능 결함이 없지만, 향후 감사 페이로드에 필드가 추가되거나 변경될 때 4곳을 모두 수정해야 한다.
- 제안: `private async recordAudit(action: AuditAction, resourceId: string, userId: string, workspaceId: string, ipAddress?: string): Promise<void>` 헬퍼 추출. 서비스 내 `reveal` 의 직접 호출도 동일 헬퍼로 통합하면 5개 메서드가 일관된 경로를 사용. 단, 현재 코드가 동작 중이므로 차기 PR 또는 위생 커밋에서 처리해도 무방.

---

### **[INFO]** `auth-configs.controller.ts` — `create` 핸들러에만 인라인 주석, 나머지 3개 핸들러는 참조 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` L103-104
- 상세: `create` 핸들러에만 `// userId(@CurrentUser sub) + req.ip — CRUD 감사 로그(auth_config.*)의 주체·IP 기록용. // 4개 변경 핸들러(create/update/regenerate/remove) 공통 패턴.` 주석이 있다. "4개 공통 패턴" 언급이 의도를 전달하나, `update`/`regenerate`/`remove` 를 처음 읽는 개발자는 해당 파라미터가 왜 추가됐는지 직접 참조가 없다.
- 제안: 나머지 3개 핸들러에 `// audit 로그용 — create 핸들러 주석 참조` 한 줄 추가하거나, 현재처럼 유지하되 `create` 주석의 "4개 공통 패턴" 표현을 좀 더 명확하게 `// 하단 update/regenerate/remove 에도 동일 적용` 형태로 보완. INFO 수준으로 즉각 수정 불필요.

---

### **[INFO]** `auth-configs.service.ts` — `getUsage` 내 매직 넘버 `20`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L500 (`.limit(20)`)
- 상세: `recentCalls` 상한이 인라인 리터럴 `20` 으로 하드코딩돼 있다. 컨트롤러의 Swagger 설명("최근 호출 20건")과 일치하고 있어 현재 동작에는 문제 없다. 그러나 이 숫자가 변경될 경우 서비스 코드와 API 문서 두 곳을 각각 수정해야 한다. 이 항목은 본 PR 이전부터 존재하는 pre-existing 사항이며 이번 변경으로 새로 도입된 문제는 아니다.
- 제안: `const RECENT_CALLS_LIMIT = 20` 모듈 레벨 상수 선언 후 서비스 쿼리와 Swagger description 에서 공유하거나, 인라인으로 유지할 경우 숫자 옆에 출처 Swagger 설명과 연계됨을 주석으로 명시. 차기 리팩토링 배치로 처리 가능.

---

### **[INFO]** `auth-configs.service.spec.ts` — `USER = 'user-1'` 과 `userId = 'user-1'` 중복 선언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` (파일 상단 `const USER` 와 `reveal` describe 내부 `const userId`)
- 상세: 신규 추가된 모듈 레벨 `const USER = 'user-1'` 과 기존 `reveal` describe 블록 내부의 `const userId = 'user-1'` 이 동일 값을 별개 이름으로 선언한다. 두 상수가 같은 테스트 사용자를 가리키는데도 이름이 달라 독자 혼란을 야기하며, 향후 값 변경 시 두 곳을 수정해야 한다.
- 제안: `reveal` describe 블록 내 `const userId = 'user-1'` 을 제거하고 상위 스코프의 `USER` 상수를 사용하도록 통일. 낮은 비용으로 중복 제거 가능.

---

### **[INFO]** `auth-configs.service.ts` — `update` 메서드에서 `Object.assign` 을 사용해 모든 필드 덮어쓰기
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L160 (`Object.assign(config, data)`)
- 상세: `data: Partial<AuthConfig>` 를 직접 `Object.assign` 하므로 `data` 에 포함된 모든 키가 엔티티에 적용된다. DTO 레벨 화이트리스트가 controller 에서 이미 `UpdateAuthConfigDto` 로 적용되므로 정상 경로에서는 안전하지만, 코드 자체는 허용 필드를 명시적으로 제한하지 않아 가독성(메서드를 읽을 때 무엇이 변경되는지 불명확) 측면의 유지보수성 이슈가 있다. 이 항목도 pre-existing 사항.
- 제안: 중기 리팩토링 시 허용 필드 destructuring pick 방식으로 교체 권장. 현재 PR 범위 밖이므로 이월.

---

## 요약

이번 변경은 `auth_config` CRUD 4종에 감사 로그 기록 패턴을 추가한 작업으로, 상수 SoT 관리(`AUTH_CONFIG_RESOURCE_TYPE`)·best-effort 계약 JSDoc·`{@link}` 참조 체인까지 유지보수성을 고려한 흔적이 뚜렷하다. 주요 유지보수성 문제는 `crypto` 이중 임포트(WARNING) 한 건이며, 나머지는 모두 INFO 수준 — 감사 호출 블록 4중 반복(헬퍼 추출 기회), 테스트 `USER`/`userId` 중복 선언, 매직 넘버 `20`, 동사 시제 근거 주석 보강 등이다. `crypto` 이중 임포트는 기존 코드에서 비롯된 것이나 본 PR 변경 파일에 포함되어 있으므로 이번 기회에 정리하는 것이 권장된다. 전반적인 유지보수성 수준은 양호하며 즉각적인 차단 사유는 없다.

## 위험도

LOW
