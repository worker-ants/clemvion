# 보안(Security) Review

## 리뷰 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — `settings` 필드를 `Record<string, unknown>` → `WorkflowSettingsDto` (nested, `@ValidateNested` + `@Type`) 로 강화
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — 신규, `maxConcurrentExecutions?: number` (`@IsInt @Min(1)`) 단일 필드
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts` — 위 검증 테스트 추가
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — `update()` 의 `settings` spread-merge 테스트 추가
- (테스트에서 참조하는 실제 로직) `codebase/backend/src/modules/workflows/workflows.service.ts:172-187` `update()` — `settings` spread-merge
- (참고) `codebase/backend/src/modules/workflows/workflows.controller.ts:164-185` `PATCH :id` — `@Roles('editor')`, `workspaceId` 스코프
- (참고) `codebase/backend/src/modules/execution-engine/execution-limits.ts:52-60` `resolveConcurrencyCap` — 런타임 backstop
- (참고) `codebase/backend/src/common/pipes/validation.pipe.ts:30-31` 전역 `whitelist + forbidNonWhitelisted`

## 발견사항

없음.

검토한 근거:

- **입력 검증**: `WorkflowSettingsDto.maxConcurrentExecutions` 는 `@IsOptional @IsInt @Min(1)` 로 타입·범위가 강제된다. 이전에는 `settings?: Record<string, unknown>` 로 임의 키/값이 그대로 JSONB 에 저장될 수 있었으나, nested DTO 도입으로 화이트리스트된 단일 필드만 허용된다. 전역 `CustomValidationPipe`(`codebase/backend/src/common/pipes/validation.pipe.ts:30-31`)가 `whitelist: true, forbidNonWhitelisted: true` 이므로 `@ValidateNested() @Type(() => WorkflowSettingsDto)` 조합에서 미지 키·중첩 객체는 400 으로 거부된다(`workflow-dto-validation.spec.ts:222-229` 로 검증됨). `class-transformer` 의 known nested-DTO whitelist bypass 이슈(속성이 최상위에 선언되지 않은 경우 우회 가능했던 구버전 CVE 류)는 해당 없음 — `settings` 필드 자체가 `UpdateWorkflowDto` 에 명시 선언되어 있고 `@Type()` 이 명시 지정되어 있어 표준 안전 패턴을 따름.
- **Mass assignment / 프로토타입 오염**: `workflows.service.ts:184` 의 `workflow.settings = { ...(workflow.settings ?? {}), ...settings }` 는 검증을 통과한 `WorkflowSettingsDto` 인스턴스만 스프레드한다. DTO 가 단일 non-prototype-polluting 숫자 필드만 가지므로 `__proto__`/`constructor` 같은 키를 주입할 표면이 없다(애초에 `forbidNonWhitelisted` 가 임의 키를 막음). 기존 workspace `updateWorkspaceSettings` 와 대칭 패턴이라는 주석대로 기존 검증된 관례를 재사용.
- **인가**: `PATCH /workflows/:id` 는 `@Roles('editor')` + `findById(id, workspaceId)` 로 workspace 스코프 소유권을 확인한 뒤에만 `update()` 를 호출한다(`workflows.controller.ts:164-185`, `workflows.service.ts:177`). 이번 변경은 컨트롤러/가드 로직을 건드리지 않았고 기존 인가 경로를 그대로 통과한다.
- **DoS 방어 관점(참고, 이번 diff 범위 밖이지만 연관)**: `maxConcurrentExecutions` 는 실행 동시성 상한이라 이론상 매우 큰 값(`Number.MAX_SAFE_INTEGER` 등)을 넣어 cap 을 사실상 무력화할 수 있으나, `@Min(1)` 만 있고 상한(`@Max`)은 없다. 다만 이는 "cap 을 높게 설정"하는 것으로, editor 권한을 가진 사용자가 자신의 workflow 동시성 제한을 완화하는 것에 불과해 권한 상승이나 타 workspace 영향이 없다. 별도 workspace-level 상한이 admission gate 어딘가에서 강제되는지는 이번 diff 범위 밖이라 낮은 우선순위의 INFO 성격 — 별도 심각도로 보고하지 않음(cap 상한 자체는 기능 설계 문제이지 보안 취약점은 아님).
- **런타임 backstop**: `execution-limits.ts:52-60` `resolveConcurrencyCap` 이 `typeof raw === 'number' && Number.isInteger(raw) && raw > 0` 재검증 후 아니면 `defaultCap` 폴백 — DTO 검증 우회 시(예: DB 직접 조작, 마이그레이션 데이터 오염)에도 안전한 defense-in-depth 가 유지된다.
- **에러 처리**: 검증 실패 시 `class-validator` 표준 400 오류만 반환되며 스택트레이스·내부 경로 등 민감정보 노출 없음(전역 파이프 공통 동작, 이번 diff 로 변경되지 않음).
- **하드코딩된 시크릿 / 암호화 / 인젝션 / 의존성**: 해당 diff 는 DTO 검증 스키마와 서비스의 얕은 병합 로직만 변경하며 SQL·쉘·경로 조작, 시크릿, 암호화 관련 코드는 포함하지 않음.

## 요약

이번 변경은 `Workflow.settings` 를 임의 `Record<string, unknown>` 에서 명시적 화이트리스트 nested DTO(`WorkflowSettingsDto`)로 좁히는 것으로, 오히려 기존보다 입력 검증 표면을 강화하는 방향의 개선이다. 전역 `whitelist+forbidNonWhitelisted` 파이프와 nested `@ValidateNested`/`@Type` 조합이 표준적이고 안전하게 적용되어 있고, 서비스의 spread-merge 는 검증된 단일 숫자 필드만 다루므로 mass-assignment/프로토타입 오염 표면이 없다. 인가 경로(role + workspace 스코프)는 이번 diff 로 변경되지 않았으며 기존 보호가 그대로 유지된다. 보안 관점에서 지적할 결함을 발견하지 못했다.

## 위험도

NONE

STATUS: SUCCESS
