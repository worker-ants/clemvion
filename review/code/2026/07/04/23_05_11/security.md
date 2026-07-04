# 보안(Security) Review 결과

## 리뷰 대상

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` — `ImportWorkflowDto.settings` 를 opaque `@IsObject() Record<string, unknown>` 에서 strict `WorkflowSettingsDto`(`@ValidateNested @Type`)로 전환
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — 대상 DTO 본체(`maxConcurrentExecutions?: number` — `@IsInt @Min(1)` 단일 필드)
- `codebase/backend/src/modules/workflows/workflows.service.ts` — `importWorkflow` 에서 `settings: dto.settings ?? {}` → `settings: { ...dto.settings } as Record<string, unknown>` 로 flatten
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, `test/workflow-crud.e2e-spec.ts` — 신규/보강 테스트
- `CHANGELOG.md` — 문서

## 발견사항

없음 (no findings).

### 검토 근거

1. **입력 검증 (강화 방향)** — 이번 변경은 정확히 그 반대 방향의 리스크(과소 검증)를 좁히는 hardening 커밋이다. 종전 `@IsObject() Record<string, unknown>` 은 임의 키/값을 허용해 `Workflow.settings` jsonb 에 임의 payload 가 그대로 저장될 수 있었다. 신규 `WorkflowSettingsDto` 는 `maxConcurrentExecutions?: number`(`@IsInt @Min(1)`) 단일 필드만 선언하고, 전역 `ValidationPipe` 가 `whitelist: true, forbidNonWhitelisted: true` 로 구성되어 있어(테스트의 `VALIDATE_OPTIONS` 및 기존 `UpdateWorkflowDto` 패턴과 동일) 미지 키·오프타입 값은 `400`으로 차단된다. Prototype-pollution 성 키(`__proto__`, `constructor`, `prototype`)도 whitelist 미등재 키이므로 동일하게 거부 대상이다 — class-validator whitelist 단계에서 알려진 키 목록에 없으면 제거/거부되므로 별도 우려 없음.

2. **`{ ...dto.settings } as Record<string, unknown>` flatten (service)** — `dto.settings` 는 이 시점에 이미 `ValidationPipe`(전역, 컨트롤러 진입 전 실행)를 통과한 `WorkflowSettingsDto` 클래스 인스턴스이며, 그 인스턴스가 가질 수 있는 own-enumerable 프로퍼티는 DTO 에 선언된 `maxConcurrentExecutions` 뿐이다(그 외 키는 이미 400 으로 걸러짐). Spread(`{ ...x }`)는 own-enumerable property 만 복사하므로 여기서 prototype 오염이나 예기치 않은 키 유입 경로가 새로 생기지 않는다. `as Record<string, unknown>` 은 순수 컴파일타임 타입 단언이며 런타임 동작에 영향 없음(jsonb 컬럼 저장 목적의 shape 일치). `UpdateWorkflowDto`(PATCH, PR #805)의 기존 대칭 패턴과 동일한 저장 방식이라 신규 공격면이 아니다.

3. **인젝션** — `settings` 값은 SQL/커맨드/경로 등으로 직접 해석되지 않고 TypeORM 을 통해 jsonb 컬럼에 파라미터 바인딩되어 저장된다(리뷰 대상 diff 범위 내 raw SQL 조합 없음). `maxConcurrentExecutions` 은 숫자 admission-gate 파라미터로만 소비되며(§8 `resolveConcurrencyCap`), 문자열 template/셸/쿼리 조합에 관여하지 않는다.

4. **인가/인증** — 이번 diff 는 `POST /api/workflows/import` 의 기존 인가 경로(컨트롤러 `@Roles`/workspace 가드)를 변경하지 않는다. DTO 레벨 검증 강화 외 접근 제어 변경 없음.

5. **하드코딩 시크릿·암호화·에러 노출** — 해당 없음. `400 VALIDATION_ERROR` 응답은 표준 에러 봉투를 사용하며(class-validator 표준 `property`/`constraints` 기반), 스택 트레이스나 내부 경로 등 민감 정보 노출 소지 없음.

6. **의존성 보안** — 이번 변경은 `class-validator`/`class-transformer` 기존 사용 패턴(`@ValidateNested`, `@Type`)을 다른 nested DTO(`ImportNodeDto`, `ImportEdgeDto` 등)와 동일하게 적용한 것으로, 신규 의존성 도입 없음.

7. **DoS/리소스 소모** — `WorkflowSettingsDto` 는 필드 1개(scalar number)뿐이라 깊은 재귀 검증이나 큰 페이로드로 인한 검증 비용 증가 우려 없음. 기존 `ImportWorkflowDto` 전체 구조(nodes/edges 배열) 검증 부담과 비교해 무시할 수준.

## 요약

이번 변경은 `ImportWorkflowDto.settings` 를 opaque `Record<string, unknown>` 에서 strict whitelist 된 `WorkflowSettingsDto`(`maxConcurrentExecutions: @IsInt @Min(1)` 단일 필드)로 전환하고, 서비스 계층에서 이 검증된 인스턴스를 jsonb 저장을 위해 plain object 로 flatten 하는 hardening 성격의 변경이다. 전역 `whitelist+forbidNonWhitelisted` pipe 가 이미 적용되어 있어 미지 키·비양수·비정수 값은 400 으로 차단되며, spread 연산은 이미 검증된 인스턴스의 own-enumerable 프로퍼티만 복사하므로 prototype pollution 이나 임의 키 유입 경로를 새로 열지 않는다. 인젝션·인가·시크릿·에러 노출·의존성 관점에서 새로운 취약점을 도입하지 않으며, 오히려 기존의 opaque 검증 갭(import vs patch 비대칭)을 해소하는 방향이다. 페이로드는 스코프대로 온전히 확인되어 `git diff origin/main...HEAD` fallback 은 불필요했다.

## 위험도

NONE

STATUS: SUCCESS
