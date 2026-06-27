# Testing Review

## 발견사항

### [WARNING] `ParseEnumPipe` 거부 경로(400)의 e2e 커버리지 부재
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L124-126 (`listModels` `@Query('type', new ParseEnumPipe(...))`)
- 상세: `ParseEnumPipe`는 유효하지 않은 `type` 값(`'video'`, `'text'`, `'auto'` 등)을 400 BadRequest로 거부하는 HTTP 입력 유효성 검증 경계를 신설한다. NestJS 파이프는 핸들러 호출 이전에 프레임워크 계층에서 실행되므로 컨트롤러 단위 테스트(`llm-model-config.controller.spec.ts`)에서는 구조적으로 테스트 불가능하다. 문제는 e2e 레벨에서도 이 거부 경로를 검증하는 케이스가 없다는 점이다. `GET /api/model-configs/:id/models?type=invalid` → 400 응답을 확인하는 e2e 테스트가 `workspace-rbac.e2e-spec.ts`나 다른 e2e 파일 어디에도 존재하지 않는다. 정상 경로(유효 값 `'chat'`·`'embedding'`, 생략)는 단위 위임 테스트가 커버하지만, 파이프가 실제로 동작하는지(wiring 자체)는 검증되지 않는다.
- 제안: `workspace-rbac.e2e-spec.ts` 또는 별도 `model-config-llm.e2e-spec.ts`에 `GET /api/model-configs/:id/models?type=invalid_value` → 400 응답 케이스를 추가한다. 파이프가 선택적(`optional: true`)으로 설정돼 있으므로 `type` 파라미터 생략 → 200 케이스도 함께 확인하면 happy path 와 rejection path를 동시에 보장할 수 있다.

### [WARNING] `testConnection` 의 `@Roles('editor')` 메타데이터 단언 누락
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` L85-94 (현재 `@Roles` 메타데이터 단언 블록)
- 상세: 컨트롤러 현행 파일(전체 파일 컨텍스트 L173-175)에는 `testConnection`에 `@Roles('editor')`가 이미 부착돼 있다. 그런데 단위 테스트의 `@Roles` 메타데이터 단언은 `previewModels`만 검사하고 `testConnection`은 검사하지 않는다. `plan/in-progress/refactor/02-architecture.md`의 authz follow-up 항목이 "컨트롤러 spec `@Roles` 메타데이터 단언(test=editor / listModels=none)"을 명시적으로 요구했으나 현재 spec 파일에 반영되지 않은 상태다. 이 단언이 없으면 `@Roles('editor')`가 향후 실수로 제거되어도 단위 테스트가 무증상 통과한다.
- 제안: `llm-model-config.controller.spec.ts`의 `@Roles decorator presence` describe 블록에 두 케이스를 추가한다: (1) `testConnection` 메서드에 `Reflect.getMetadata('roles', LlmModelConfigController.prototype.testConnection)`가 `'editor'`를 포함하는지, (2) `listModels` 메서드에 roles 메타데이터가 없거나 빈 값인지(Viewer+ 접근 보장 역기제).

### [WARNING] `listModels` Viewer+ 접근 (roles 부재) 단언 누락
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` L85-94
- 상세: spec 및 코드 주석(L197-199)은 `listModels`에 `@Roles`를 의도적으로 적용하지 않아 Viewer+ 이상 접근을 허용한다고 명시한다. 그러나 이 부재(absence) 자체를 검증하는 테스트가 없다. 누군가 `@Roles('editor')`를 잘못 추가하더라도 단위 테스트는 이를 감지하지 못한다. `previewModels`의 `@Roles('editor')` 존재를 단언하는 것과 대칭적으로, `listModels`의 역할 제한 부재도 단언해야 인가 의도가 회귀 보호된다.
- 제안: `Reflect.getMetadata('roles', LlmModelConfigController.prototype.listModels)`가 `undefined` 또는 `[]`임을 단언하는 테스트를 추가한다.

### [INFO] `PROVIDER_PROBE_THROTTLE` 공유 정책 검증 부재
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L45, 그리고 세 핸들러의 `@Throttle(PROVIDER_PROBE_THROTTLE)` 데코레이터
- 상세: 세 핸들러(previewModels·testConnection·listModels)가 동일 스로틀 정책을 공유한다는 것이 이번 변경의 의도(SoT 단일화)다. 현재 단위 테스트는 throttle 메타데이터를 전혀 단언하지 않는다. 상수 추출 자체는 동작 변경이 없어 즉각 위험은 낮지만, 향후 누군가 한 핸들러만 `@Throttle({...})` 인라인 리터럴로 재작성할 경우 상수-핸들러 간 정책 불일치가 발생해도 감지되지 않는다.
- 제안: 단위 테스트가 throttle 데코레이터 메타데이터 자체를 검사하는 것은 NestJS 내부 구현에 의존하게 돼 깨지기 쉬우므로 의무적이지는 않다. 다만 코드 리뷰 체크리스트로 관리하거나, 상수를 `export`해 spec 파일에서 동일 참조를 단언하는 가벼운 패턴을 고려할 수 있다.

### [INFO] `ParseEnumPipe` 비표준 배열 리터럴 사용 - 테스트 용이성 미영향이나 문서성 약함
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L124
- 상세: `new ParseEnumPipe(['chat', 'embedding'], { optional: true })`는 TypeScript enum 객체 대신 배열 리터럴을 전달한다. NestJS 내부가 `Object.values(enumType)`으로 유효 값 목록을 추출하므로 배열에서도 동작하지만, 이는 NestJS `ParseEnumPipe`의 공식 API 사용 패턴이 아니다. 테스트 가독성 측면에서 "이 파이프가 chat/embedding만 허용한다"는 의도가 파이프 생성 코드를 읽지 않으면 자명하지 않다. TypeScript `enum` 또는 `as const` 유니온 타입으로 정의하면 타입 시스템의 지원을 받으면서 테스트에서도 참조할 수 있다.
- 제안: `export const ModelType = { chat: 'chat', embedding: 'embedding' } as const` 형태의 상수를 추출하거나 `enum ModelType { chat = 'chat', embedding = 'embedding' }`을 정의해 `ParseEnumPipe(ModelType, ...)`으로 전달하면, e2e 테스트 작성 시 유효/무효 값을 코드에서 참조할 수 있어 테스트 가독성과 유지보수성이 개선된다.

---

## 요약

이번 변경의 핵심 테스트 문제는 `ParseEnumPipe` 추가가 새로운 HTTP 입력 유효성 검증 경계를 만들었음에도 그 거부 경로(400 BadRequest)를 검증하는 e2e 테스트가 없다는 점이다. NestJS 파이프는 핸들러 이전에 실행되므로 단위 테스트가 이를 커버할 수 없고, 현재 e2e 스위트에도 `?type=invalid` 케이스가 없다. 추가로 plan이 명시적으로 요구한 `testConnection`의 `@Roles('editor')` 단언 및 `listModels`의 역할 부재 단언이 컨트롤러 spec에 반영되지 않아, 향후 인가 데코레이터를 잘못 수정해도 단위 테스트가 이를 감지하지 못하는 구조적 공백이 남아 있다. `PROVIDER_PROBE_THROTTLE` 상수 추출은 동작 불변 리팩터링이라 테스트 영향이 없다.

## 위험도

MEDIUM
