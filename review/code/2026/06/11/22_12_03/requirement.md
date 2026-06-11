# 요구사항(Requirement) 리뷰

리뷰 대상: AuthConfig CRUD audit 기록 구현
- `audit-action.const.ts` — AUTH_CONFIG CRUD 4종 상수 추가
- `auth-configs.controller.ts` — `@CurrentUser('sub')`·`@Req()` 전파, 권한 설명 수정
- `auth-configs.service.spec.ts` — CRUD audit mock 검증 테스트 추가
- `auth-configs.service.ts` — create/update/regenerate/remove 에 userId·ipAddress·record() 추가
- `plan/in-progress/auth-config-webhook-followups.md` — §1 진행 상황 업데이트
- `spec/5-system/1-auth.md` — §4.1 액션 표 업데이트

---

## 발견사항

### **[INFO]** `regenerate` 엔드포인트에 `@ApiForbiddenResponse` 없음
- 위치: `auth-configs.controller.ts` `regenerate` 핸들러 (line 338–360 기준)
- 상세: `create`·`update`·`remove` 에는 diff 에서 `@ApiForbiddenResponse({ description: 'Admin 미만 권한' })` 변경이 확인되지만, `regenerate` 핸들러의 diff 에는 해당 변경이 없다. 전체 파일 컨텍스트(line 167)에서는 `@ApiForbiddenResponse({ description: 'Admin 미만 권한' })` 가 있는 것으로 보이나, diff 상으로는 이전 버전이 명시되지 않아 기존에 이미 'Admin' 이었는지 또는 이번 변경에 포함됐는지 추적이 어렵다. 기능 동작에는 영향이 없으며 Swagger 문서 수준 일관성이 확인된다.
- 제안: diff 누락 여부를 확인해 일관성 보증. 기능 결함은 아님.

### **[INFO]** `remove` 핸들러 명시적 반환값 없음
- 위치: `auth-configs.controller.ts` `async remove(...)`
- 상세: `await this.authConfigsService.remove(...)` 호출 후 명시적 `return` 없음. `@HttpCode(HttpStatus.NO_CONTENT)` + void 반환이 의도된 동작이므로 기능 결함 아님. NestJS 는 204 No Content 를 정상 처리한다.
- 제안: 현행 유지.

### **[INFO]** `ipAddress` 가 `undefined` 일 때 audit record 의 `ipAddress` 필드 처리
- 위치: `audit-logs.service.ts` line 90 기준 `if (entry.ipAddress) log.ipAddress = entry.ipAddress;`
- 상세: `ipAddress` 가 `undefined` 면 `AuditLog` 엔티티의 `ipAddress` 컬럼에 할당되지 않는다. 테스트에서 `ipAddress: undefined` 기대값을 `objectContaining` 으로 검증하고 있어 서비스 계층에서의 `undefined` 전달은 허용된다. trust proxy 미설정 시 `req.ip` 가 `undefined` 가 될 수 있음을 테스트가 명시적으로 커버하고 있다(spec §4.1 의 ipAddress 선택 필드 부합).
- 제안: 현행 유지.

### **[WARNING]** spec §3.2 권한 매트릭스와 `@ApiForbiddenResponse` 설명 불일치 가능성
- 위치: `auth-configs.controller.ts` diff — `create`·`update`·`remove` 의 `@ApiForbiddenResponse` 를 'Editor 미만 권한' → 'Admin 미만 권한' 으로 변경
- 상세: `spec/5-system/1-auth.md §3.2` 권한 매트릭스는 "Auth Config | CRUD | CRUD | R | R" 로 Owner/Admin 이 CRUD 가능, Editor 는 R 만 가능하다고 명시한다. 이전 Swagger 설명 'Editor 미만 권한' 은 잘못된 설명이었으며 이번 수정이 spec 과 일치한다. 코드의 `@Roles('admin')` 데코레이터 자체는 이미 기존에 정확했으므로(전체 파일 컨텍스트 확인), 이번 변경은 Swagger 문서 정확도를 올바르게 수정한 것. spec fidelity 관점에서 코드·Swagger 모두 spec §3.2 와 정렬됨. **이슈 없음**.
- 제안: 현행 유지. 이전 'Editor 미만 권한' 설명이 어느 시점에 도입됐는지 이력 추적은 불요.

### **[INFO] [SPEC-DRIFT]** `data-flow/1-audit.md §1.1` writer 표에 `auth_config.*` 5종이 이미 반영됨
- 위치: `spec/data-flow/1-audit.md` lines 53–57
- 상세: 본 PR 의 구현과 함께 `data-flow/1-audit.md §1.1` writer 표(auth_config.create/update/delete/regenerate/reveal 5종)가 업데이트된 것이 확인된다. 코드와 spec 이 정렬돼 있다. 단, plan 체크리스트(파일 5, line 2213)에는 "spec §4.1 4종 Planned→구현됨 이동 + data-flow §1.1 writer 표 동기화" 가 완료(✅)로 표시돼 있어, spec 변경이 이미 반영됐음을 확인한다.
- 제안: 코드 유지. spec 이미 반영됨.

### **[INFO]** `basic_auth` 타입 `regenerate` 동작 미정의
- 위치: `auth-configs.service.ts` `regenerate` 메서드 (line 1814–1821 기준)
- 상세: `regenerate` 는 `api_key`·`bearer_token`·`hmac` 에 대해 각각 키/토큰/시크릿을 교체한다. `basic_auth` 타입에 대한 분기가 없어 `regenerate` 호출 시 save 는 되지만 config 변경 없이 `auth_config.regenerate` audit 가 기록된다. spec/5-system/1-auth.md §A나 데이터 모델에서 `basic_auth` 에 대한 regenerate 동작을 명시하지 않으므로 정의되지 않은 동작으로 간주된다.
- 제안: `basic_auth` 의 `regenerate` 동작을 spec 에서 정의하거나(변경 없이 성공 처리 vs. 400 오류), 코드에 의도를 주석으로 명시. 현재 동작(노-옵 save + audit 기록)은 데이터 안전성 문제는 없으나 호출자에게 오해를 유발할 수 있다. spec 반영은 `project-planner` 위임.

---

## 요약

AuthConfig CRUD audit 기록 구현은 `spec/5-system/1-auth.md §4.1` 이 정의한 5종 감사 액션(`auth_config.create/update/delete/regenerate/reveal`) 을 모두 구현했다. `AUDIT_ACTIONS` 상수 추가 → service 메서드 시그니처 확장(userId·ipAddress 선택) → controller `@CurrentUser`·`@Req` 전파 → audit mock 검증 테스트(CRUD 4종 + reveal 음성 mockClear) 흐름이 일관되게 구현됐다. spec §3.2 권한 매트릭스(Auth Config CRUD = Admin+)와 `@Roles('admin')` 데코레이터·Swagger 설명이 정렬됐으며, `spec/data-flow/1-audit.md §1.1` writer 표도 동기화됐다. `ipAddress` 가 undefined 인 엣지케이스 테스트가 추가됐고, 삭제 후 resourceId 보존 패턴도 검증됐다. `basic_auth` 타입 `regenerate` 에 대한 동작 정의가 spec 에 없는 회색지대가 존재하나, 데이터 안전성 문제는 없으며 INFO 수준이다. 전체적으로 요구사항 충족 완성도가 높다.

---

## 위험도

LOW
