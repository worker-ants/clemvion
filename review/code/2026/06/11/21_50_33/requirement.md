# Requirement Review

## 발견사항

### 1. **[WARNING]** `remove` 엔드포인트 Swagger 설명과 실제 권한 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` 라인 224
- 상세: `@Delete(':id')` 핸들러가 `@Roles('admin')`으로 보호되어 있으나 `@ApiForbiddenResponse({ description: 'Editor 미만 권한' })`으로 기술되어 있다. 실제 제한 경계는 "Admin 미만 권한"이 맞다. `spec/5-system/1-auth.md §3.2` 권한 매트릭스는 Auth Config의 Delete(D) 권한이 Admin+ 에게만 있음을 명시한다. 같은 파일의 `create`(라인 96)·`update`(라인 119)도 `@Roles('admin')` + `'Editor 미만 권한'`으로 기술되어 있는데, 이 두 엔드포인트도 실제로는 Admin+ 만 허용하므로 Swagger 설명이 오해를 유발한다. 단, `regenerate`(라인 167)와 `reveal`(라인 195)은 `'Admin 미만 권한'`으로 올바르게 기술됨.
- 제안: `remove`, `create`, `update` 핸들러의 `@ApiForbiddenResponse` description 을 `'Admin 미만 권한'`으로 통일한다. 단 `create`·`update` 기존 문자열이 PR 이전부터 존재했다면 본 PR scope 로 한정할 수 있으나, `remove`의 설명은 이번 변경 컨텍스트에서 직접 영향을 받는다.

---

### 2. **[INFO]** `regenerate` audit 테스트에 `workspaceId` 검증 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — `describe('CRUD audit 기록')` > `'regenerate → auth_config.regenerate 기록'` (라인 981~998)
- 상세: `create`·`update`·`remove` 의 audit 기록 검증 테스트는 `workspaceId: WS` 를 `expect.objectContaining` 에 포함하지만, `regenerate` 테스트만 `workspaceId` 검증이 누락됐다. 서비스 코드(auth-configs.service.ts 라인 1732-1740)에서는 `workspaceId` 가 `record` 호출에 올바르게 전달되고 있으므로 기능 결함은 아니지만, 테스트 일관성이 떨어진다.
- 제안: `'regenerate → auth_config.regenerate 기록'` 테스트의 `expect.objectContaining({...})` 에 `workspaceId: WS` 를 추가한다.

---

### 3. **[INFO]** `ipAddress` optional 파라미터 - `req.ip` null/undefined 가드 없음
- 위치: `auth-configs.controller.ts` 전체 변경 핸들러들 (create/update/regenerate/remove)
- 상세: `req.ip` 는 NestJS/Express에서 일반적으로 `string | undefined`이다 (로드 밸런서 환경, trusted proxy 미설정 시 `undefined` 반환 가능). `ipAddress?` 가 optional 로 선언되어 있고 `AuditLogsService.record` 도 이를 optional 로 받으므로 런타임 오류는 없으나, `req.ip` 가 `undefined`인 경우 audit 로그에 IP가 기록되지 않는다. spec/data-flow/1-audit.md §1.1 주석("auth_config 계열은 모두 `ipAddress` 를 함께 전달")이 IP 기록을 기대함을 시사하므로, IP 추출 미배포 환경에서 감사 로그 품질이 저하될 수 있다.
- 제안: 현재 `optional` 처리는 best-effort 계약과 일치하므로 기능 결함으로 보기 어렵다. spec/2.3 세션 정책의 CF-Connecting-IP → X-Forwarded-For → req.ip 순 추출 전략을 auth-configs 컨트롤러에도 적용할지 검토를 후속 이슈로 등록 권장.

---

### 4. **[INFO]** [SPEC-DRIFT] `spec/data-flow/1-audit.md §1.1` call site 수 기술 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/1-audit.md` §1.1 (라인 "4개 모듈 9개 call site 전수")
- 상세: 본 PR이 `auth_config.create/update/delete/regenerate` 4종을 추가하여 call site 가 기존 5개 (integration 6 + workspace 1 + execution 1 + auth_config.reveal 1 = 9)에서 13개로 증가했다 (auth_config.* 5종 = reveal 포함). `§1.1` 본문 "4개 모듈 9개 call site" 표현이 이제 구식이 됐다.
- 제안: 코드는 옳다. `spec/data-flow/1-audit.md §1.1` 의 "9개 call site" 수치를 현행 숫자로 갱신 (spec-drift, project-planner 영역).

---

### 5. **[INFO]** `basic_auth` type 에 대한 `regenerate` 동작 미정의
- 위치: `auth-configs.service.ts` `regenerate` 메서드 (라인 1721-1728)
- 상세: `regenerate` 는 `api_key`·`bearer_token`·`hmac` 세 타입에 대해서만 새 값을 발급한다. `basic_auth` 타입에 대해서는 아무 처리 없이 기존 config 를 저장한다. 이 경우 audit 로그에는 `auth_config.regenerate`가 기록되지만 실제 자격증명 교체는 일어나지 않는다. spec/5-system/1-auth.md 및 data-model에서 `basic_auth`의 `regenerate` 시나리오가 정의되지 않은 것으로 보인다 (spec 침묵 영역이므로 INFO).
- 제안: `basic_auth`에 대해 regenerate 를 허용하지 않도록 `BadRequestException`을 던지거나, spec에 허용 여부를 명시하는 방향으로 정리 권장.

---

## 요약

본 PR은 `AuthConfigsService`의 create/update/regenerate/remove 4개 메서드에 `userId`·`ipAddress` 파라미터를 추가하고 `AuditLogsService.record`를 호출하도록 수정하며, 대응하는 controller 의 `@CurrentUser('sub')`·`@Req()` 전파, `AUDIT_ACTIONS`에 4종 상수 추가, spec §4.1 및 data-flow §1.1 갱신, 그리고 CRUD audit mock 검증 테스트(4케이스) 신규 추가를 포함하고 있다. 코드 구현, spec 갱신, 테스트 세 영역이 상호 일치하며 기능 완전성은 높다. 주요 위험은 `remove`(`@Delete`) 핸들러의 `@ApiForbiddenResponse` 설명이 `'Editor 미만 권한'`으로 실제 `@Roles('admin')` 보호와 불일치하는 것(WARNING)이며, `regenerate` audit 테스트의 `workspaceId` 검증 누락(INFO) 및 `basic_auth` 타입 대상 regenerate의 무동작-but-audit-기록 불일치(INFO)가 후속 정리 대상이다. spec 자체는 이번 변경을 정확히 반영하여 갱신됐고, `auth_config.*` 5종 전체가 구현됨 상태로 이동한 것이 확인된다.

## 위험도

LOW
