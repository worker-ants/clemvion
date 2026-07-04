# Security Review — workflow cap validated write DTO (fresh re-review)

세션: `review/code/2026/07/04/21_28_18` (fresh re-review; INFO fixes: swagger thunk, CHANGELOG, boundary test)

## 리뷰 대상 요약

- `WorkflowSettingsDto` 신설: `maxConcurrentExecutions?: number` (`@IsOptional @IsInt @Min(1)`).
- `UpdateWorkflowDto.settings`: opaque `@IsObject() Record<string, unknown>` → `@ValidateNested @Type(() => WorkflowSettingsDto)` nested validated DTO 로 전환.
- `WorkflowsService.update`: `settings` 를 `Object.assign` 전체교체 대신 `{ ...(workflow.settings ?? {}), ...settings }` spread-merge.
- 부수: CHANGELOG 항목, swagger `type: () => WorkflowSettingsDto` thunk 전환, unit/e2e 경계값(0/-1/1.5/미지키/boundary=1) 테스트 추가.

payload 는 실제 diff(`update-workflow.dto.ts`, `workflow-settings.dto.ts`, `workflows.service.ts`, 관련 spec/e2e, CHANGELOG, plan 문서)와 정확히 일치 — 범위 이상 없음. `git diff origin/main...HEAD` fallback 불필요.

## 점검 관점별 분석

**1. 인젝션 취약점** — 해당 없음. `maxConcurrentExecutions` 는 `@IsInt` 로 강제되는 순수 숫자 필드이며 SQL/커맨드/경로 등에 직접 흘러가지 않고 TypeORM JSONB 컬럼(`workflow.settings`)에 저장된다. ORM 파라미터 바인딩 경유 — 인젝션 벡터 없음.

**2. 하드코딩된 시크릿** — 해당 없음.

**3. 인증/인가** — 변경 없음. 기존 `PATCH /api/workflows/:id` 의 Editor+ 권한 가드는 그대로 유지되며 본 diff 는 이를 건드리지 않는다.

**4. 입력 검증** — 이 변경의 핵심 목적이자 강화 지점.
   - 종전: `settings` 가 opaque `Record<string, unknown>` 로 무검증 통과 → 런타임 `resolveConcurrencyCap` 의 backstop(부적합 값을 defaultCap 으로 무시)에만 의존.
   - 이후: nested DTO 검증(`@IsInt @Min(1)`)이 write 경계에서 선차단, 전역 `whitelist + forbidNonWhitelisted` 파이프가 미지 키를 400 거부. 계약이 넓어지는 방향이 아니라 좁아지는(strict화) 방향 — 보안 관점에서 순수하게 개선.
   - `class-validator`/`class-transformer` 의 `plainToInstance` + `whitelist` 조합에서 `WorkflowSettingsDto` 로 선언되지 않은 키(`__proto__`, `constructor`, `prototype` 포함)는 대상 클래스에 없는 속성이므로 whitelist 단계에서 제거되거나 `forbidNonWhitelisted`로 400 거부된다 — 검증 통과 객체는 `{ maxConcurrentExecutions?: number }` 형태만 가능.

**5. OWASP Top 10 (A03 Injection 외)** — 아래 prototype pollution 항목 참고. 그 외 해당 사항 없음.

**6. 암호화** — 해당 없음(암호화/해시 관련 코드 변경 없음).

**7. 에러 처리** — `class-validator` 기본 400 응답은 필드명·제약조건만 노출(예: `maxConcurrentExecutions must be a positive integer`). 스택트레이스·내부 경로 등 민감정보 노출 없음. 기존 전역 예외 필터 동작과 동일.

**8. 의존성 보안** — 신규 외부 의존성 없음 (`class-validator`/`class-transformer`/`@nestjs/swagger` 기존 의존성 재사용).

### Prototype pollution 심층 확인 (spread-merge 도입 지점)

`workflows.service.ts`:
```ts
workflow.settings = { ...(workflow.settings ?? {}), ...settings };
```
`settings` 는 `WorkflowSettingsDto` 인스턴스(검증 통과)이므로 `...settings` spread 는 인스턴스의 own-enumerable 속성만 복사한다. `whitelist:true` 단계에서 `WorkflowSettingsDto` 에 선언되지 않은 키(`__proto__` 등 pollution 페이로드 포함)는 이미 제거되어 인스턴스에 존재하지 않는다. 따라서 이 spread-merge 는 검증된 단일 숫자 필드(`maxConcurrentExecutions`)만 병합 대상이 되며, prototype pollution 벡터가 없다. `workflow.settings` (병합 좌변, DB 기존 값)도 신뢰 저장소에서 온 값이라 위험이 없다.

### 계약 narrowing 의 회귀 안전성 (보안과 무관하지만 확인)

`ImportWorkflowDto.settings` 는 여전히 opaque — 이는 이번 diff 의 범위 밖이며 plan 에 후속 항목으로 명시되어 있다. 이번 PATCH 경로 강화가 opaque import 경로의 취약점을 새로 만들지는 않는다(기존 상태 유지).

## 발견사항

없음.

## 요약

이번 변경은 opaque `Record<string, unknown>` write DTO 를 강타입 nested DTO(`@IsInt @Min(1)`)로 전환하고 전역 `whitelist+forbidNonWhitelisted` 파이프 하에서 미지 키를 거부하도록 좁히는 순수 방어 강화(hardening)다. 신규 spread-merge 로직은 검증을 통과한 단일 숫자 필드만 병합하므로 prototype pollution 이나 임의 키 주입 경로가 생기지 않으며, 인증/인가·에러 처리·암호화·의존성 측면에서도 변경으로 인한 새로운 위험이 확인되지 않았다. INFO 후속 조치(swagger thunk, CHANGELOG, 경계값 테스트)도 보안적으로 중립적인 품질 보강이다. Critical/Warning 없음.

## 위험도

NONE

STATUS: SUCCESS
