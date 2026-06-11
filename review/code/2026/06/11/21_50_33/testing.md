### 발견사항

- **[INFO]** 컨트롤러 스펙(`auth-configs.controller.spec.ts`)에 `userId`/`req.ip` 전파 검증 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`
  - 상세: 컨트롤러 스펙은 `@Roles` 메타데이터만 검증한다. 변경 후 4개 핸들러(`create/update/regenerate/remove`)가 `@CurrentUser('sub')`·`@Req()`를 추가로 받아 서비스에 전파하는데, 이 전파 경로에 대한 단위 테스트가 없다. 컨트롤러 자체의 mock 호출 검증(`authConfigsService.create`가 `userId`, `req.ip`를 올바른 위치 인자로 받는지)이 누락된 상태다.
  - 제안: 컨트롤러 스펙에 서비스 mock을 주입하고 `create/update/regenerate/remove` 각 핸들러가 서비스를 호출할 때 `userId`와 `ipAddress`를 4번째/5번째 인자로 넘기는지 검증하는 테스트 케이스를 추가한다. `req.ip`가 `undefined`인 경우(프록시 미설정 환경)도 `ipAddress?: string` 선택 파라미터로 정상 전달되는지 확인.

- **[WARNING]** `ipAddress`가 `undefined`인 경우 audit 기록 동작을 테스트하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — CRUD audit 기록 describe 블록
  - 상세: 모든 CRUD audit 테스트는 `ipAddress: '1.2.3.4'`를 명시한다. `ipAddress`는 서비스 시그니처에서 `optional`(`ipAddress?: string`)이며 컨트롤러가 `req.ip`를 넘기는데, Express의 `req.ip`는 신뢰 프록시 미설정 시 `undefined`가 될 수 있다. `ipAddress=undefined`로 `record()`가 호출될 때 audit 로그 row가 `NULL`을 허용하는지, 혹은 서비스가 방어 처리를 해야 하는지에 대한 테스트가 없다. 현재 코드는 `ipAddress`를 그대로 전달하므로 DB 컬럼이 `nullable`이어야 한다는 암묵적 가정이 있다.
  - 제안: `ipAddress` 미전달(`undefined`) 케이스를 최소 1개 CRUD 동작(예: `create`)에 추가해 `audit.record`가 `ipAddress: undefined`를 포함한 객체로 호출되는지, 그리고 실제로 `NotFoundException` 등이 발생하지 않는지 확인한다.

- **[WARNING]** `update` audit 테스트에서 `workspaceId` 필드 검증 불일치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 968–977 (`update → auth_config.update 기록` 케이스)
  - 상세: `regenerate` 테스트는 `expect.objectContaining`에 `workspaceId`를 포함하지 않지만, `create`·`update`·`remove` 테스트는 포함한다. 이 불일치는 의도적이지 않아 보이며, `regenerate` 서비스 구현은 실제로 `workspaceId`를 `record()` 호출에 전달하므로 테스트가 해당 필드를 누락시켜 커버리지 갭이 생긴다.
  - 제안: `regenerate` audit 테스트의 `expect.objectContaining`에 `workspaceId: WS`를 추가해 다른 CRUD 케이스와 동일한 수준의 필드를 검증하도록 통일한다.

- **[INFO]** `reveal` 성공 테스트에서 `ipAddress` 필드 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 1366–1374 (`올바른 비밀번호 → 평문 config 반환 + audit 기록`)
  - 상세: `reveal` 성공 케이스는 `action`·`resourceType`·`resourceId`·`workspaceId`·`userId`를 검증하지만, 호출 시 `ipAddress: '1.2.3.4'`를 전달했음에도 audit 기록 검증에서 `ipAddress`를 `expect.objectContaining`에 포함하지 않는다. CRUD 4개 케이스는 `ipAddress`를 검증하는데 `reveal`만 빠져 일관성이 없다.
  - 제안: `reveal` 성공 케이스의 `expect.objectContaining`에 `ipAddress: '1.2.3.4'`를 추가한다.

- **[INFO]** `reveal` 실패 케이스(`passwordHash 없음`)에서 `audit.record.mockClear()` 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 1398–1410
  - 상세: `잘못된 비밀번호 → 401, audit 미기록` 케이스는 `audit.record.mockClear()`를 호출해 선행 `create`의 audit 기록을 제거하고 `reveal` audit 미기록을 순수하게 검증한다. 반면 `passwordHash 없음(OAuth-only) → 401` 케이스는 `mockClear()`를 호출하지 않아 이전 호출 상태가 남아 있다. 이 케이스도 `audit.record.not.toHaveBeenCalled()`를 검증하지 않으므로 실제 버그 방어력이 없고, `mockClear()` 누락이 이후 테스트 순서 변경 시 간섭을 일으킬 수 있다.
  - 제안: `passwordHash 없음` 케이스에도 `beforeEach`의 격리 의존 없이 명시적으로 `audit.record.mockClear()` 후 `expect(audit.record).not.toHaveBeenCalled()` 검증을 추가한다.

- **[INFO]** `AUDIT_ACTIONS` 상수에 대한 별도 단위 테스트 없음 (기존 패턴 유지)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
  - 상세: 추가된 4종 상수(`AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE`)는 `as const`로 선언되므로 TypeScript 컴파일 타임에 `AuditAction` union을 통해 강제된다. 런타임 값 오타 방어를 위한 별도 스펙이 없으나, 서비스 스펙의 audit mock 검증이 실제 문자열 값(`'auth_config.create'` 등)을 검증하므로 사실상 통합 커버된다. 독립 스펙 추가 필요 없음.

- **[INFO]** 컨트롤러 스펙에 신규 파라미터 데코레이터 타입 안전성 검증 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`
  - 상세: 현재 컨트롤러 스펙은 Reflector 기반 메타데이터 검증만 한다. 신규 `@CurrentUser('sub')`·`@Req()` 데코레이터 추가는 컨트롤러 스펙 범위 밖이나, NestJS e2e 또는 통합 테스트 레이어에서 실제 요청 헤더에서 `userId`가 올바르게 추출되는지 검증이 필요하다. 플랜 체크리스트(`auth-config-webhook-followups.md`)에 e2e 진행 중이라 표시되어 있어 이 계층에서 커버 예정임.

### 요약

이번 변경은 `AuthConfigsService`의 CRUD 4개 메서드에 `userId`/`ipAddress` 파라미터와 `AuditLogsService.record()` 호출을 추가하고, 서비스 스펙에 CRUD audit 검증 테스트 블록 4케이스를 신규 추가했다. 테스트 전략의 핵심 구조(in-memory mock repo + audit mock + 격리된 `beforeEach`)는 건전하며, 신규 audit 기록 동작의 핵심 경로(action 문자열, resourceId, userId, ipAddress)는 서비스 스펙에서 검증된다. 다만 컨트롤러 레이어에서 `userId`/`ipAddress`가 서비스로 올바르게 전파되는지에 대한 단위 테스트가 없고, `ipAddress=undefined` 엣지 케이스, `regenerate` 케이스의 `workspaceId` 필드 누락, `reveal` 케이스의 `ipAddress` 검증 누락, OAuth-only 실패 케이스의 `mockClear`/음성 단언 누락 등 부분적인 커버리지 갭이 존재한다. 이 중 `regenerate` `workspaceId` 누락은 실제 버그를 감지 못 할 수 있는 갭이다.

### 위험도
LOW
