# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `userId` 파라미터가 서비스 메서드 내에서 중간 위치에 삽입됨
- 위치: `auth-configs.service.ts` — `create(workspaceId, data, userId, ipAddress?)`, `update(id, workspaceId, data, userId, ipAddress?)`, `regenerate(id, workspaceId, userId, ipAddress?)`, `remove(id, workspaceId, userId, ipAddress?)`
- 상세: 4개 메서드가 감사 로그를 위해 `userId` + `ipAddress?` 를 추가로 받는데, `remove` 와 `regenerate` 는 `(id, workspaceId, userId, ip?)` 순이고 `update` 는 `(id, workspaceId, data, userId, ip?)` 순이어서 파라미터 위치가 메서드마다 미묘하게 다르다. 4개 모두 감사 컨텍스트를 공유하므로 별도 `AuditContext` 타입 `{ userId: string; ipAddress?: string }` 객체로 묶으면 호출부 가독성과 타입 안전성이 높아진다.
- 제안: 선택적으로 `AuditContext` 인터페이스 도입. 단, 현재 패턴도 NestJS 관용 코드 범위 내이므로 강제 사항은 아님.

### [INFO] 감사 로그 패턴이 4개 메서드에 걸쳐 수작업 반복
- 위치: `auth-configs.service.ts` 내 `create`, `update`, `regenerate`, `remove` 메서드 각각의 `auditLogsService.record(...)` 호출
- 상세: 각 메서드에서 `workspaceId / userId / action / resourceType / resourceId / ipAddress` 6개 필드를 매번 나열한다. `resourceType: AUTH_CONFIG_RESOURCE_TYPE` 는 상수로 이미 뽑혀 있으나, 공통 필드 조합(workspaceId·userId·resourceType·ipAddress)을 한 곳에서 만드는 헬퍼가 없어, 필드 추가/제거 시 4곳을 모두 수정해야 한다.
- 제안: private helper `buildAuditPayload(action, resourceId, workspaceId, userId, ipAddress?)` 도입을 검토할 수 있다. 단, 현재 코드 수준(6필드)에서는 복잡도가 크지 않고 기존 `reveal` 메서드도 동일 패턴을 직접 쓰므로 우선순위는 낮다.

### [INFO] `reveal` 테스트의 `userId` 지역 변수와 모듈 상단 상수 `USER` 가 동일한 값 `'user-1'`을 중복 선언
- 위치: `auth-configs.service.spec.ts` 603번째 줄 `const userId = 'user-1';` (reveal describe 내부)
- 상세: 파일 상단에 `const USER = 'user-1'` 이 이미 선언됐으나 `reveal` 블록 안에서 `const userId = 'user-1'` 이 별도로 선언되어 있다. 두 변수가 같은 값이므로 혼란을 줄 수 있다. `userId` 를 `USER` 상수를 재사용하도록 정리하면 `user-1` 문자열이 파일 내 단일 SoT 가 된다.
- 제안: `reveal` describe 블록 내 `const userId = 'user-1'` 을 제거하고 `userId` 참조를 `USER` 로 교체.

### [INFO] `regenerate` 메서드 — `basic_auth` 타입에 대한 분기 없이 조용히 skip
- 위치: `auth-configs.service.ts` `regenerate` 메서드 내 if-else if 체인 (라인 ~1813–1820)
- 상세: `api_key / bearer_token / hmac` 세 타입만 처리하고 `basic_auth` 는 아무 키도 갱신하지 않은 채 그대로 `save` + audit 기록을 남긴다. 현재 동작이 의도적이라면(basic_auth 는 사용자 입력값이라 자동 갱신 없음) 인라인 주석이 없어 독자가 누락으로 오인할 수 있다. 이는 유지보수 시 실수를 유발할 수 있는 침묵적 분기다.
- 제안: `basic_auth` 케이스에 `// basic_auth: 사용자 입력 자격증명 — 자동 재발급 없음` 주석 또는 `else { throw new BadRequestException(...) }` 로 명시적 처리 추가.

### [INFO] `getUsage` 내 매직 넘버 `20`
- 위치: `auth-configs.service.ts` `getUsage` 메서드, `.limit(20)` 라인
- 상세: 최근 실행 조회 상한값 `20` 이 인라인 리터럴로 사용된다. 스펙 문서(navigation/6-config.md)에 "최근 호출 20건" 으로 명시된 값이지만, 코드에서는 상수명 없이 숫자만 등장한다.
- 제안: `const USAGE_RECENT_CALLS_LIMIT = 20;` 으로 추출. 현재 변경 범위와 무관하나 동일 파일 내 잔여 매직 넘버로 기록.

## 요약

이번 변경은 `AUDIT_ACTIONS` 상수 추가, 컨트롤러 파라미터 전파, 서비스 4개 메서드에 감사 로그 호출 삽입, 테스트 보강으로 구성된다. 코드 구조는 전반적으로 명확하고 기존 NestJS 패턴을 잘 따른다. `AUTH_CONFIG_RESOURCE_TYPE` 상수를 도입해 인라인 문자열 중복을 제거한 점, JSDoc으로 best-effort 계약을 명시한 점은 긍정적이다. 유지보수 관점에서 눈에 띄는 문제는 `reveal` 테스트 블록 내 `USER`/`userId` 이중 선언(혼란 소지), `regenerate`의 `basic_auth` 케이스가 주석 없이 묵시적으로 pass-through되는 점, 4개 메서드에 걸쳐 감사 로그 호출 6-필드 패턴이 수작업으로 반복되는 점이다. 이들 모두 Critical/Warning 수준은 아니며, 전체 유지보수성은 양호하다.

## 위험도

LOW
