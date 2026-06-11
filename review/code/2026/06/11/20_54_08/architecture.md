### 발견사항

- **[INFO]** `AUDIT_ACTIONS` 상수 파일 신설 — 단일 책임 + 개방-폐쇄 원칙 충족
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts`
  - 상세: audit action 식별자를 단일 `as const` 객체와 `AuditAction` union 타입으로 집중 관리한다. 새 action 추가 시 본 파일만 수정하면 되고, `AuditLogsService.record` 의 타입 시그니처가 union 강제를 통해 인라인 문자열 사용을 컴파일 단계에서 차단한다. 개방-폐쇄 원칙(기존 코드 변경 없이 확장)을 잘 따른다.
  - 제안: 현재 구조 유지. 향후 action 수가 많아지면 `integration`, `execution`, `workspace`, `auth_config` 등 resource 별 sub-object 로 분리하는 것도 고려 가능하나 현 규모에서는 과도한 추상화다.

- **[INFO]** `AuditLogsService.record` action 타입 강화 — 의존성 방향 적절
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L207
  - 상세: 서비스 레이어가 도메인 타입(`AuditAction`)을 입력 계약으로 사용하고, 호출자(`IntegrationsService`, `ExecutionsService`, `AuthConfigsService`, `WorkspacesService`)가 같은 모듈의 상수를 import 한다. 의존 방향이 항상 `audit-logs` 모듈 방향으로 단방향이며 순환 의존성이 없다.
  - 제안: 없음.

- **[INFO]** 다수 도메인 서비스가 `AUDIT_ACTIONS` 를 직접 import — 결합도는 수용 가능
  - 위치: `auth-configs.service.ts`, `executions.service.ts`, `integrations.service.ts`, `workspaces.service.ts`
  - 상세: 4개 서비스가 `audit-logs/audit-action.const` 에 직접 의존한다. 이는 순환이 아닌 단방향 cross-module 상수 참조이므로 NestJS 모듈 경계를 해치지 않는다. `AUDIT_ACTIONS` 는 런타임 동작이 없는 순수 상수/타입 파일이라 결합도 영향이 최소화된다.
  - 제안: 없음.

- **[INFO]** `AuditLogDto.action` 필드가 `string` 유지 — 프레젠테이션 레이어 적절한 느슨함
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L261
  - 상세: 응답 DTO 의 `action` 은 `AuditAction` union 이 아닌 `string` 을 유지한다. DB 에 저장된 레거시 action 문자열(예: 구버전 `re_run_initiated` row) 이나 미래 확장을 응답 레이어에서 과도하게 제약하지 않는 올바른 설계다. 읽기(응답)와 쓰기(record 호출) 의 타입 계약을 분리했다.
  - 제안: 없음.

- **[INFO]** `AuthConfigsService` 의 `reveal` 메서드가 `userId` 를 직접 받는 반면 `create/update/remove/regenerate` 는 `userId` 파라미터 부재
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L452–L514
  - 상세: audit 기록이 필요한 나머지 CRUD 메서드에 `userId` 가 없어 audit 기록을 추가할 수 없는 구조적 갭이 존재한다. 이는 기존 문제이며 `plan/in-progress/auth-config-webhook-followups.md` 에 backlog 로 명시되어 있어 인지된 기술부채다. 본 PR 범위 외.
  - 제안: 추후 `create/update/remove/regenerate` 시그니처에 `userId` 추가 + controller 에서 `@CurrentUser('sub')` 전파 후 `AUDIT_ACTIONS.AUTH_CONFIG_CREATE` 등 상수를 `AUDIT_ACTIONS` 에 먼저 추가 (타입 강제 덕분에 const 추가 없이는 컴파일 차단됨).

- **[INFO]** `ExecutionsModule` 주석이 `re_run_initiated` 에서 `execution.re_run` 으로 동기화 완료
  - 위치: `codebase/backend/src/modules/executions/executions.module.ts` L1337
  - 상세: 모듈 레벨 주석이 실제 action 명과 일치하도록 갱신됐다. 문서와 코드 간 드리프트가 제거됐다.
  - 제안: 없음.

- **[INFO]** spec 과 코드의 SoT 연결이 명시적
  - 위치: `spec/5-system/1-auth.md §4.1`, `spec/5-system/13-replay-rerun.md §11`
  - 상세: spec 에 `audit-action.const.ts` 경로가 직접 링크되어 있어 "구현 단일 진실" 위치가 spec 에서도 추적 가능하다. spec↔코드 정합성 유지에 긍정적.
  - 제안: 없음.

---

### 요약

본 변경은 audit action 식별자를 인라인 문자열에서 `AUDIT_ACTIONS` 상수 + `AuditAction` union 타입으로 중앙화하는 아키텍처 위생 개선이다. 단일 책임(상수 파일이 action 명세를 독점), 개방-폐쇄(새 action 추가 = const 파일 확장만), 의존성 역전(호출자 서비스가 추상화된 union 타입에 의존)이 모두 올바르게 적용됐다. 모듈 간 의존 방향은 단방향이며 순환 참조가 없고, 프레젠테이션(DTO)과 비즈니스(service) 레이어의 타입 계약 분리도 적절하다. 유일한 구조적 갭인 `AuthConfigsService` CRUD 메서드의 `userId` 누락은 기존 기술부채로 이미 backlog 에 등재되어 있으며 본 PR 범위 외다.

### 위험도

NONE
