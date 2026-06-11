# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### **[INFO]** `audit-action.const.ts` — 동사 시제 혼재가 주석에 명시돼 있으나 일관성 없음
- 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 전체
- 상세: `INTEGRATION_*` 계열은 과거분사(`created`, `updated`, `deleted`, `rotated`, `scope_changed`, `reauthorized`), `WORKSPACE_TRANSFER_OWNERSHIP`은 동사원형 스네이크케이스 혼합, `EXECUTION_RE_RUN`은 복합형, `AUTH_CONFIG_*`는 현재형 동사원형이다. 주석에 "도메인별 일관"이라 명시했으나, 미래에 새 도메인을 추가할 때 어느 시제를 따라야 하는지 판단 근거가 주석만으로는 불충분하다. 특히 `WORKSPACE_TRANSFER_OWNERSHIP`은 다른 계열과 패턴이 달라 레거시인지 의도인지 불명확하다.
- 제안: 주석에 "각 도메인의 첫 번째 action 을 추가할 때 그 도메인의 시제 기준을 직접 나열" 하거나, `WORKSPACE_TRANSFER_OWNERSHIP`이 왜 과거분사/현재형이 아닌 동사원형 복합명사인지 근거를 주석에 보충.

---

### **[INFO]** `auth-configs.controller.ts` — `create` 핸들러에만 인라인 주석, 나머지 3개 핸들러는 무주석
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` L268-270 (`create` 핸들러 내부 주석) vs `update`/`regenerate`/`remove`
- 상세: `create` 핸들러에만 `// userId(@CurrentUser sub) + req.ip — CRUD 감사 로그(auth_config.*)의 주체·IP 기록용. // 4개 변경 핸들러(create/update/regenerate/remove) 공통 패턴.` 주석이 있다. 주석 자체가 "4개 공통 패턴"이라 설명하므로, 나머지 세 핸들러에는 동일 주석 반복이 불필요하다는 의도는 이해된다. 그러나 `create` 에만 있으면 `update`/`regenerate`/`remove`를 처음 읽는 개발자는 해당 파라미터가 왜 추가됐는지 참조가 없다.
- 제안: 주석을 `create` 핸들러가 아닌 컨트롤러 클래스 레벨 또는 `create` 시그니처의 JSDoc `@see` 체인으로 올리거나, 현재처럼 `create`에만 두되 나머지 핸들러에 `// audit 로그용 — create 핸들러 주석 참조` 한 줄 추가.

---

### **[INFO]** `auth-configs.service.ts` — 중복된 audit record 호출 블록 패턴 (4회 반복)
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L137-144, L159-166, L191-198, L211-218
- 상세: `create`, `update`, `regenerate`, `remove` 각각에서 아래 구조가 거의 그대로 반복된다.
  ```ts
  await this.auditLogsService.record({
    workspaceId,
    userId,
    action: AUDIT_ACTIONS.AUTH_CONFIG_XXX,
    resourceType: 'auth_config',
    resourceId: ...,
    ipAddress,
  });
  ```
  `resourceType: 'auth_config'` 문자열 리터럴이 4군데에 하드코딩돼 있다. 향후 `resourceType` 값을 바꾸거나 스펙이 변경될 경우 4곳을 모두 수정해야 한다.
- 제안: 두 가지 접근 모두 허용 범위:
  1. `private recordAuthConfigAudit(action, resourceId, userId, workspaceId, ipAddress?)` 헬퍼 메서드로 추출해 반복 제거. 현재 서비스 규모에서 오버 엔지니어링 논란은 있지만 `'auth_config'` 리터럴 단일화에는 효과적.
  2. 최소한 `const RESOURCE_TYPE = 'auth_config' as const` 를 파일 상단 상수로 선언하고 4곳에서 참조.

---

### **[INFO]** `auth-configs.service.ts` — `getUsage` 내 매직 넘버 `20`
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L498 `.limit(20)`
- 상세: `recentCalls` 의 최대 20건 제한이 인라인 숫자로 하드코딩돼 있다. 컨트롤러 주석(`최근 호출 20건`)과 서비스 구현이 일치하고 있어 현재 동작에는 문제 없지만, API 문서와 구현의 동기화 지점이 리터럴로 분산돼 있다.
- 제안: `const RECENT_CALLS_LIMIT = 20` 상수 선언 후 서비스와 Swagger 설명에서 함께 참조하거나, 현재처럼 두되 상수 선언 없이 인라인으로 유지할 경우 코드 리뷰 시 이 숫자가 Swagger 설명과 연계됨을 주석으로 명시.

---

### **[INFO]** `auth-configs.service.spec.ts` — `userId = 'user-1'` 중복 선언
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L809 (`const USER = 'user-1'`) vs L705 (`const userId = 'user-1'` — `reveal` describe 블록 내부)
- 상세: 파일 최상단 `const USER = 'user-1'`(신규 추가)과 `reveal` describe 스코프 내 `const userId = 'user-1'`가 동일 값을 각각 선언한다. 두 상수가 의미하는 대상이 동일한데도 별개 이름으로 존재한다.
- 제안: `reveal` describe 블록 내 `const userId = 'user-1'` 를 제거하고 상위 스코프의 `USER` 상수를 사용하도록 통일.

---

### **[INFO]** `auth-configs.service.ts` — `crypto` 이중 임포트
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L8-9
  ```ts
  import * as crypto from 'crypto';
  import { randomBytes } from 'crypto';
  ```
- 상세: 같은 모듈에서 namespace import와 named import를 동시에 사용한다. `randomBytes`는 `crypto.randomBytes`로도 접근 가능하므로 두 라인이 동시에 필요하지 않다.
- 제안: `import { randomBytes } from 'crypto'` 를 제거하고 `crypto.randomBytes(...)` 로 통일하거나, 반대로 `import * as crypto` 를 없애고 필요한 심볼만 named import 로 열거. 현재 코드베이스의 다른 서비스가 어느 패턴을 따르는지 확인 후 일관성 있게 적용.

---

## 요약

이번 변경은 `auth_config` CRUD 액션 4종을 상수로 추가하고, 컨트롤러와 서비스에 `userId`/`ipAddress` 파라미터를 전파해 감사 로그를 기록하는 패턴을 일관되게 적용한 작업이다. 변경 범위 대비 코드 구조가 명확하고, 상수 SoT 관리, best-effort 감사 계약 문서화, 테스트 커버리지 추가까지 모두 포함돼 있어 전반적으로 유지보수성이 양호하다. 다만 `'auth_config'` 문자열 리터럴의 4중 반복, `crypto` 이중 임포트, 테스트 파일 내 `userId`/`USER` 중복 선언은 점진적으로 정리하면 더 깔끔한 코드베이스가 된다. 발견된 항목 모두 INFO 수준이며 즉각적인 차단 사유는 없다.

## 위험도

LOW
