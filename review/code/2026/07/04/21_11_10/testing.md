# 테스트(Testing) Review

리뷰 대상: `workflow-cap-dto-bca77e` — Workflow.settings.maxConcurrentExecutions nested validated DTO 도입.
Payload 스코프 확인: `_prompts/testing.md` 에 담긴 8개 파일(DTO 2·spec 3·service·e2e·plan/consistency 산출물)이 실제 변경 diff 와 일치. 미스코핑 아님 — `git diff origin/main...HEAD` 폴백 불필요.

## 발견사항

- **[INFO]** `settings` 에 non-object 값(문자열/배열/숫자)을 보낼 때의 검증 경로가 테스트되지 않음
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts` (`settings (WorkflowSettingsDto)` describe 블록), `codebase/backend/test/workflow-crud.e2e-spec.ts` B2
  - 상세: `UpdateWorkflowDto.settings` 는 `@IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` 조합이다. `settings: "oops"` 같은 문자열은 `@IsObject()` 에서 걸러지지만, `settings: []` (배열)는 JS 런타임에서 `typeof [] === 'object'` 이므로 `class-validator`의 `IsObject`를 통과할 수 있고 이후 `plainToInstance`가 배열을 `WorkflowSettingsDto` 인스턴스로 감싸면서 `maxConcurrentExecutions` 필드가 없는 채로 통과(또는 예상 밖의 동작)할 가능성이 있다. 현재 스펙에는 `mk(settings)` 헬퍼가 오직 plain object 형태만 사용하므로 이 조합(배열/문자열/숫자 top-level settings)에 대한 회귀 방지가 없다. 리스트에 있는 케이스(0/-1/1.5/non-numeric/unknown-key)는 모두 `maxConcurrentExecutions` 필드 자체의 값 검증이고, `settings` 필드 자체의 타입(스칼라/배열) 검증은 다루지 않는다.
  - 제안: `workflow-dto-validation.spec.ts` 에 `settings: 'not-an-object'` 및 `settings: []` 케이스를 `it.each` 로 추가해 `@IsObject()` 가 실제로 이 값들을 막는지(혹은 배열이 통과해버리는 known-gap 인지) 확인. 배열이 통과한다면 WARNING 상향 대상이며 DTO 쪽에 `@IsNotEmptyObject`/커스텀 validator 보강 검토 필요.

- **[INFO]** cap 상한(대칭적 상한값, 예: `Number.MAX_SAFE_INTEGER` 또는 매우 큰 정수) 테스트 없음
  - 위치: `workflow-settings.dto.ts` (`@IsInt() @Min(1)` — 상한 제약 없음)
  - 상세: 구현 자체가 상한을 두지 않으므로(의도된 설계 — `resolveConcurrencyCap` 이 런타임에서 별도 방어) 테스트 부재가 커버리지 갭이라기보다는 구현과 일치하는 자연스러운 결과다. 다만 "cap boundary=1(최소 경계)"이 accept 케이스로 명시적으로 다뤄지지 않는다 — 현재 accept 테스트는 `5`(임의의 양수)만 사용한다. `@Min(1)` 이 정확히 1을 허용하는지(off-by-one 오류 없는지)는 boundary 값 자체로 검증되지 않았다.
  - 제안: `it('accepts maxConcurrentExecutions=1 (@Min(1) 경계값)', ...)` 를 unit spec 에 추가해 `Min` 데코레이터의 inclusive 경계를 명시적으로 고정. 현재는 5 만 테스트되어 "0/-1 은 거부, 1 이상은 허용"이라는 경계 자체가 암묵적으로만 검증됨(0 이 거부되는 것으로 간접 추론 가능하나 직접 assertion 은 없음).

- **[INFO]** e2e B2 는 `unknownKey` 케이스에서 `maxConcurrentExecutions` 를 동반하지 않고 `bogusKey` 단독 전송 — 워크플로우 서비스단 merge 로직과 결합된 경로(정상 키 + 미지 키 동시 전송)는 e2e 로 커버되지 않음
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` B2, `unknownKey` 요청
  - 상세: unit spec(`workflow-dto-validation.spec.ts`)에는 `{ maxConcurrentExecutions: 3, bogusKey: 1 }` 조합이 있어 이 부분은 DTO 레벨에서 커버된다. 다만 e2e 는 `{ bogusKey: 1 }` 단독으로만 400 을 확인해 "혼합 payload가 실 HTTP 파이프라인에서도 거부되는지"는 검증하지 않는다. 이는 사소한 갭이며 unit 이 이미 그 조합을 커버하므로 실제 리스크는 낮다.
  - 제안: 필수는 아니나, e2e 케이스를 unit 과 대칭으로 `{ maxConcurrentExecutions: 3, bogusKey: 1 }` 로 바꾸면 "부분적으로 유효한 값이 섞여도 전체가 거부된다"는 실 HTTP 계약을 한 번에 검증할 수 있음.

- **[INFO]** `workflows.service.spec.ts` 의 3개 merge 테스트가 `save` 호출 인자만 검증하고 반환값(service.update 의 리턴값)은 검증하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` `update — settings spread-merge (§8 cap DTO)` describe
  - 상세: `mockRepository.save` 는 `jest.fn().mockImplementation((data) => Promise.resolve({ id: 'new-id', ...data }))` 로 구현되어 있어 실제로는 `service.update(...)` 반환값도 검증 가능한 상태다. 현재 세 테스트 모두 `await service.update(...)` 의 반환값을 버리고 `expect(mockRepository.save).toHaveBeenCalledWith(...)` 만 확인한다. `save` 호출 인자 검증만으로 merge 로직 정확성은 충분히 검증되므로 CRITICAL 은 아니지만, 반환값도 함께 assert 하면 "저장 호출은 맞았지만 실제로 caller 에 반환되는 객체가 다르다"는 유형의 회귀(예: service 가 `save`의 반환이 아닌 사전 계산된 workflow 객체를 리턴하는 실수)까지 잡을 수 있다.
  - 제안: 필요 시 `const result = await service.update(...); expect(result.settings).toEqual(...)` 추가. 우선순위 낮음(low-value, save 인자 검증으로 이미 핵심 로직은 커버됨).

- **[INFO]** `mockRepository.findOne` 이 `settings: null` / `settings: { existingKey: 'keep' }` / `settings: undefined`(미설정) 3가지 초기 상태를 모두 다루지만, `workflow.settings` 가 `{}` (빈 객체, `mockWorkflow` 의 기본값)인 케이스는 새 describe 블록에서 별도로 다루지 않음
  - 위치: `workflows.service.spec.ts` 상단 `mockWorkflow` 는 `settings: {}` 를 기본값으로 두고 있으나, 신규 3개 테스트는 각각 `findOne` 을 `mockResolvedValueOnce` 로 override 하여 `{existingKey:'keep'}`/`null` 두 케이스만 명시적으로 검증한다.
  - 상세: 실질적으로 `{}` 케이스는 `existingKey: 'keep'` 케이스와 병합 로직상 동일 분기(`workflow.settings ?? {}`)를 타므로 별도 테스트가 주는 추가 신뢰도는 낮다. 커버리지 갭이라기보다는 사소한 중복 회피로 판단됨 — 상향 조정 불필요.

## 격리·가독성·회귀 평가

- **테스트 격리**: `workflow-dto-validation.spec.ts` 신규 블록은 `mk()` 헬퍼로 각 테스트가 독립적인 `plainToInstance` 호출을 수행하며 공유 mutable 상태가 없다. `workflows.service.spec.ts` 는 `beforeEach` 에서 `jest.clearAllMocks()` 를 수행하고 `mockRepository.findOne` 을 `mockResolvedValueOnce` 로 매 테스트마다 재설정하므로 테스트 간 의존성 없음. e2e B2 는 매 테스트 시작 시 신규 workflow 를 생성해 격리를 확보(다른 e2e it 블록과 공유 자원 없음).
- **Mock 적절성**: `mockRepository.save` 의 `mockImplementation` 이 실제 TypeORM 의 저장 동작(전달된 객체를 그대로 반환)을 단순화해 근사하고 있어 merge 로직 검증 목적에 적합하다. 과도하게 정교하지도, 실제와 괴리되지도 않음.
- **회귀 테스트**: 기존 `folderId transform`/`validation` describe 블록은 변경 없이 유지되며 `UpdateWorkflowDto` 의 다른 필드 검증에 영향 없음. `settings` 필드 타입이 `Record<string, unknown>` → `WorkflowSettingsDto` 로 좁혀졌지만 `as UpdateWorkflowDto` 캐스팅을 사용하는 `workflows.service.spec.ts` 테스트 호출부(`{ settings: {...} } as UpdateWorkflowDto`)는 컴파일타임 타입 체크를 우회하고 있어 타입 변경에 따른 컴파일 에러를 감추지는 않는지 확인 필요 — 다만 실제 값(`{ maxConcurrentExecutions: N }`)이 `WorkflowSettingsDto` shape 과 구조적으로 호환되므로 실질적 문제는 없음.
- **테스트 가독성**: `it.each([0, -1, 1.5])` 파라미터화 및 한국어 주석(`§8 admission gate`, `workspace 대칭` 등 spec 참조)이 의도를 명확히 표현. e2e B2 도 단계별 한국어 주석으로 "0 → 400", "미지 키 → 400", "양의 정수 → 200 + 영속" 순서를 명확히 구분.
- **테스트 용이성**: `WorkflowSettingsDto` 를 별도 파일로 분리하고 `@Type(() => WorkflowSettingsDto)` 를 사용한 구조는 nested DTO 단위 테스트를 용이하게 한다. 의존성 주입 구조상 서비스 테스트도 리포지토리 mock 교체만으로 충분히 격리됨.

## 요약

DTO 검증(0/-1/1.5/non-numeric/unknown-key), 서비스 merge(3 케이스: 병합/미변경/초기화), e2e(400 on invalid, 200+영속)로 구성된 3계층 테스트는 PR 이 도입한 핵심 변경(nested validated DTO 전환 + spread-merge)의 주요 경로를 빠짐없이 커버하며, mock 구성과 실제 구현(`update()`, `CustomValidationPipe`) 사이의 괴리도 없다. 발견된 갭은 모두 INFO 수준으로, `settings` 필드 자체가 배열/스칼라일 때의 `@IsObject()` 동작 미검증과 `@Min(1)` 경계값(=1) 자체의 명시적 accept 테스트 부재가 가장 실질적인 보강 후보이나 두 경우 모두 기존 로직의 오동작 가능성을 시사하는 CRITICAL/WARNING 급 증거는 없다. 전체적으로 테스트는 명확하고 격리되어 있으며 기존 회귀 테스트에 영향을 주지 않는다.

## 위험도

LOW
