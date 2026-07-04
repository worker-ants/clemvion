# 부작용(Side Effect) Review

## 검증 대상

`codebase/backend/src/modules/workflows/workflows.service.ts` `importWorkflow()`:

```diff
-        settings: dto.settings ?? {},
+        // 검증된 WorkflowSettingsDto 인스턴스를 jsonb Record 로 평탄화(값은 동일).
+        settings: { ...dto.settings } as Record<string, unknown>,
```

## 동일성(behavior parity) 검증

- `dto.settings === undefined` (import 시 settings 생략): `{ ...undefined }` → `{}`. 종전 `dto.settings ?? {}` → `{}` 와 동일. `workflows.service.spec.ts` 신규 테스트(`'defaults settings to {} when the import omits it'`, L973-992)가 `mockTransactionManager.save` 인자 `settings: {}` 로 이를 직접 assert.
- `dto.settings = { maxConcurrentExecutions: 4 }` (검증 통과 후 `class-transformer` 가 `@Type(() => WorkflowSettingsDto)` 로 만든 인스턴스): `WorkflowSettingsDto` 는 단일 optional scalar 필드(`maxConcurrentExecutions?: number`)만 갖는 plain class(getter/method 없음, `workflow-settings.dto.ts` 확인) — spread 는 own enumerable property 만 복사하므로 `{ maxConcurrentExecutions: 4 }` 로 정확히 동일 결과. 신규 테스트(`'persists validated settings.maxConcurrentExecutions...'`, L951-971)가 `expect.objectContaining({ settings: { maxConcurrentExecutions: 4 } })` 로 이를 확인.
- 두 경로 모두 값 수준에서 종전 `?? {}` 와 동치. `as Record<string, unknown>` 캐스트는 컴파일 타임 타입 단언일 뿐 런타임 동작에 영향 없음.
- `WorkflowSettingsDto` 인스턴스가 class-validator/`@IsInt @Min(1)` 데코레이터 메타데이터(예: `Reflect` metadata, 클래스 prototype 메서드)를 담고 있다 해도, 스프레드는 `Object.keys`/own-enumerable 기준이라 prototype 체인·데코레이터 메타는 애초에 복사 대상이 아님 — 인스턴스 자체를 그대로 jsonb 컬럼에 write 하던 종전 방식(암묵적 `JSON.stringify` 직렬화, TypeORM jsonb)과 최종 저장되는 JSON 형태도 동일(둘 다 own enumerable property 만 직렬화).

결론: 이 한 줄 변경 자체는 **행동적으로 완전히 동치**이며 부작용을 일으키지 않는다. 코멘트가 명시하듯 "검증된 인스턴스를 평탄화, 값은 동일"이 정확하다.

## 시그니처/인터페이스 영향

- `importWorkflow(workspaceId, userId, dto)` 시그니처 자체는 무변경. 유일한 호출자는 `workflows.controller.ts:526`. 내부 `settings` write 로직만 조정.
- `dto.settings` 의 **컴파일 타임 타입**이 `Record<string, unknown>` → `WorkflowSettingsDto` 로 바뀌었으나, 이는 `ImportWorkflowDto` (파일 2) 변경으로 이미 반영된 타입이고 서비스 코드는 이를 그대로 소비할 뿐 추가 타입 영향 없음.

## 계약 narrowing (unknown → 400) 영향

- `ImportWorkflowDto.settings` 가 opaque `@IsObject() Record<string, unknown>` 에서 strict `@ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환되어, 전역 `whitelist+forbidNonWhitelisted` pipe(`VALIDATE_OPTIONS` 동등 설정, main.ts 전역 `CustomValidationPipe`)가 `POST /api/workflows/import` 요청에 대해 미지 `settings` 키·비정수/비양수 `maxConcurrentExecutions` 를 이제 `400 VALIDATION_ERROR` 로 거부한다.
- 이것은 **의도된 API 계약 narrowing**(공개 API breaking-ish 이지만 CHANGELOG 에 명시됨, PR #805 `UpdateWorkflowDto` 와의 검증 강도 대칭 목적)이다. 외부에서 이 엔드포인트로 미지 settings 키를 보내던 클라이언트만 영향받는다. export→import round-trip 은 payload/CHANGELOG 근거대로 안전(export 가 emit 하는 키는 `maxConcurrentExecutions` 뿐).
- 이 narrowing 자체는 이번 요청의 "부작용" 관점에서 신규 side effect(전역 상태/파일시스템/네트워크/이벤트)를 만들지 않는다 — 순수하게 요청 검증 계층에서 거부 응답을 조기 반환하는 것으로, 기존 whitelist pipe 인프라를 재사용한다.

## 기타 점검 관점

- **전역 변수**: 도입/수정 없음.
- **파일시스템**: 변경 없음.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **네트워크 호출**: 변경 없음(서비스 로직은 순수 DB write 준비 단계).
- **이벤트/콜백**: 변경 없음.
- CHANGELOG.md 변경은 문서 전용, 부작용 없음.
- 테스트 파일(`workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`) 추가는 검증 로직에 한정, 프로덕션 부작용 없음.

## 발견사항

없음 (no findings).

## 요약

`importWorkflow()` 의 `dto.settings ?? {}` → `{ ...dto.settings } as Record<string, unknown>` 변경은 undefined/정의된-값 두 경로 모두에서 기존 동작과 값 수준으로 완전히 동치이며, 신규 테스트가 이를 직접 검증한다. `ImportWorkflowDto.settings` 의 strict DTO 전환에 따른 "unknown 키 → 400" narrowing 은 의도된 API 계약 변경으로 CHANGELOG 에 명시되어 있고, 서비스 계층에는 부작용을 유발하지 않는다. 시그니처·전역 상태·파일시스템·환경변수·네트워크·이벤트 콜백 어느 관점에서도 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
