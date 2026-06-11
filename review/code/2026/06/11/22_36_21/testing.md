# 테스트(Testing) 리뷰 결과

## 발견사항

### **[WARNING]** `regenerate` audit 테스트에 `workspaceId` 검증 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 243-253 (`regenerate → auth_config.regenerate 기록` 케이스)
- 상세: `create`, `update`, `remove` 테스트는 `expect.objectContaining`에 `workspaceId: WS`를 포함하지만, `regenerate` 테스트만 누락됐다. 서비스 코드는 `workspaceId`를 올바르게 전달하므로 기능 결함은 아니나, 테스트 패턴이 불일치해 누락처럼 보인다. 마찬가지로 `remove` 테스트도 `workspaceId` 없이 `expect.objectContaining`을 쓰고 있어 동일한 불일치가 존재한다.
- 제안: `regenerate`와 `remove` 테스트의 `expect.objectContaining({...})`에 `workspaceId: WS`를 추가해 4개 CRUD 테스트 패턴을 통일한다.

### **[WARNING]** 컨트롤러 스펙에 `userId`/`req.ip` 전파 경로 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`
- 상세: 컨트롤러 스펙(`auth-configs.controller.spec.ts`)은 `@Roles` 메타데이터만 검증한다. 변경 후 `create/update/regenerate/remove` 4개 핸들러가 `@CurrentUser('sub')`·`@Req()`를 추가로 받아 서비스에 전파하는데, 이 인자 전파 경로에 대한 단위 테스트가 전혀 없다. 컨트롤러가 서비스 메서드를 호출할 때 `userId`와 `ipAddress`를 올바른 위치 인자로 넘기는지 검증하지 않으므로, 향후 인자 순서 변경 등에 취약하다.
- 제안: 컨트롤러 스펙에 서비스 mock을 주입하고 각 핸들러가 서비스를 호출할 때 `userId`와 `req.ip`를 정확한 위치 인자로 전달하는지 검증하는 케이스를 추가한다. 현재 `@Roles` 전용 메타데이터 테스트와 병행 가능하다.

### **[INFO]** `ipAddress=undefined` 케이스 테스트가 `create`에만 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 192-207
- 상세: `create → ipAddress 미지정(trust proxy 미설정 시 req.ip=undefined) 시에도 기록` 케이스가 `create`에만 추가됐다. `update/regenerate/remove`는 `ipAddress` optional 처리가 동일함에도 `ipAddress=undefined` 경로를 각자 검증하지 않는다. 서비스 코드가 4개 메서드 모두 동일 패턴을 사용하므로 `create` 1개로 패턴 입증이 충분하다는 판단은 합리적이나, 일관성이 필요한 사람에게는 불분명할 수 있다.
- 제안: 현재 `create`에 `ipAddress=undefined` 케이스가 있으므로 동일 패턴을 다른 메서드에 반복하지 않아도 된다. 단, 테스트 describe 블록 상단 주석에 "ipAddress undefined 검증은 create 케이스로 대표" 한 줄을 명시하면 의도가 더 명확해진다.

### **[INFO]** `reveal` 테스트 내 `const userId = 'user-1'` 이 상위 스코프 `const USER = 'user-1'`와 중복 선언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 604
- 상세: 파일 최상위 스코프에 `const USER = 'user-1'`(라인 47)이 선언돼 있고, `reveal` describe 블록 내에서 `const userId = 'user-1'`이 별도로 선언(라인 604)된다. 두 상수가 같은 값을 중복 선언하고 있어, 향후 test fixture를 바꿀 때 한쪽만 수정하면 불일치가 발생할 위험이 있다. 테스트 격리에는 영향이 없으나 유지보수성을 저하시킨다.
- 제안: `reveal` describe 블록 내 `const userId = 'user-1'`을 제거하고 상위 스코프의 `USER` 상수를 직접 참조한다.

### **[INFO]** `basic_auth` 타입의 `regenerate` 동작 테스트 없음 — pass-through but audit 기록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — `regenerate` describe 블록
- 상세: `regenerate` 테스트는 `hmac`과 `api_key`만 다룬다. 서비스 코드에서 `basic_auth` 타입은 키 교체 없이 기존 config를 그대로 save하고 `auth_config.regenerate` audit를 기록한다. 이 동작이 의도적인지(패스스루), 아니면 버그(BadRequestException을 던져야 하는지)에 대한 테스트가 없어 코드 의도를 검증하지 못한다.
- 제안: `basic_auth: regenerate 호출 시 config 변경 없이 저장되고 audit는 기록됨` 케이스 또는 반대로 BadRequestException을 기대하는 케이스를 추가해 현재 동작을 명시적으로 고정(pin)한다.

### **[INFO]** `update/remove` NotFound 경로에서 audit 미호출 검증 없음
- 위치: `auth-configs.service.spec.ts` — `CRUD audit 기록` describe 블록
- 상세: `findById`가 `NotFoundException`을 던지는 경우(존재하지 않는 id), `auditLogsService.record`가 호출되지 않는 것이 올바른 동작이다. 현재 서비스 코드는 `findById` → save → record 순이므로 NotFound 시 record에 도달하지 않아 구조적으로 보장된다. 그러나 이를 명시적으로 검증하는 테스트가 없다.
- 제안: 위험도가 낮으므로 필수는 아니나, `update(invalid-id)` NotFound 케이스에 `audit.record not.toHaveBeenCalled()` 검증을 추가하면 구조적 보장을 테스트로 문서화할 수 있다.

### **[INFO]** `reveal` 성공 시 `audit.record`가 정확히 1회 호출됨을 검증하지 않음
- 위치: `auth-configs.service.spec.ts` 라인 622-632 (`올바른 비밀번호 → 평문 config 반환 + audit 기록`)
- 상세: `reveal` 성공 테스트에서 `audit.record`가 `auth_config.reveal` 액션으로 호출됐음을 `toHaveBeenCalledWith`로 검증하지만, `create` 단계의 `auth_config.create` 기록이 함께 남아 있어 실제로는 2번 호출된 상태다. `toHaveBeenCalledTimes(2)` 또는 `mockClear` 후 `toHaveBeenCalledTimes(1)` 검증이 없어, reveal 경로에서 중복 audit가 발생해도 이 테스트는 통과한다.
- 제안: `reveal` 성공 테스트에서도 `create` 이후 `audit.record.mockClear()`를 호출한 뒤 reveal을 실행하거나, `toHaveBeenCalledTimes(1)` 검증을 추가한다. `reveal` 실패 테스트들은 이미 `mockClear()`를 사용하고 있어 성공 케이스만 불일치한다.

## 요약

`auth-configs.service.spec.ts`는 CRUD 4종의 audit 기록 핵심 경로를 검증하는 신규 describe 블록을 포함하고 있으며, `ipAddress=undefined` 엣지 케이스도 `create`를 통해 커버하는 등 전반적으로 충실하다. 그러나 컨트롤러 스펙(`auth-configs.controller.spec.ts`)이 `@Roles` 메타데이터 검증에만 집중하고 변경된 인자 전파(`userId`/`req.ip` → 서비스 호출)를 전혀 검증하지 않는다는 점이 WARNING 수준 갭이다. 서비스 레벨에서는 `regenerate`와 `remove` 테스트의 `workspaceId` 누락이 패턴 불일치를 만들어 유지보수 시 혼란을 야기할 수 있다. `reveal` 성공 케이스의 `mockClear` 누락, `basic_auth regenerate` 동작 미검증, `reveal` 내 `userId`/`USER` 중복 선언은 INFO 수준으로 즉각 차단 사유는 아니나 정리가 권장된다. 단위 테스트 통과(47개), 빌드, e2e(188개) 모두 통과한 상태이므로 회귀 위험은 낮다.

## 위험도

LOW
