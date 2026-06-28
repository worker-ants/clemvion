# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### INFO: `REASON_TO_DETAIL` 맵에서 `e.reason`을 두 번 조회
- 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L79-80
- 상세: `toTriggerParameterErrorDetails` 내부에서 `REASON_TO_DETAIL[e.reason].code`와 `REASON_TO_DETAIL[e.reason].message`를 별도로 두 번 참조한다. 런타임 비용은 무시할 수준이지만, 중간 변수로 구조 분해하면 한 번의 맵 조회로 의도를 더 명확히 표현할 수 있다.
- 제안:
  ```ts
  return errors.map((e) => {
    const { code, message } = REASON_TO_DETAIL[e.reason];
    return { field: e.field, code, message };
  });
  ```

### INFO: 테스트 케이스 3번이 케이스 1번과 중복 검증
- 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts` L230-239
- 상세: `'every field code is UPPER_SNAKE_CASE'` 케이스는 세 `reason` 값을 모두 넣어 regex로 검증하는데, 이 세 `reason`에 대한 매핑 결과는 케이스 1번(`'maps internal reasons...'`)에서 이미 exact match로 검증되어 있다. regex 검증이 케이스 1번의 exact 검증보다 약하므로 독립적으로 추가된 가치가 제한적이다. 컨벤션 준수 의도를 문서화하는 용도라면 주석으로 대체하거나 케이스 1번에 통합할 수 있다.
- 제안: 케이스 3번을 제거하거나, 케이스 1번에 `expect(details.every(d => /^[A-Z][A-Z0-9_]*$/.test(d.code))).toBe(true)` 한 줄을 추가하고 별도 케이스를 삭제한다.

### INFO: `hooks.service.spec.ts` 응답 타입 리터럴 중복
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` diff L464-467, L484-487
- 상세: `{ code: string; details: Array<{ field: string; code: string; message: string }> }` 인라인 타입이 두 테스트 케이스에 동일하게 반복된다. 이 타입은 `TriggerParameterErrorDetail`(이미 export 됨)과 구조가 동일하므로 공유 타입을 재사용하면 타입 변경 시 두 곳을 동시에 수정해야 하는 위험을 제거할 수 있다.
- 제안: 테스트 파일 상단에서 `TriggerParameterErrorDetail`을 import하고 `{ code: string; details: TriggerParameterErrorDetail[] }` 형태로 사용한다.

### INFO: e2e 테스트 B3의 워크플로 설정이 직접 DB 조작에 의존
- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` L1341-1355
- 상세: `manual_trigger` 노드에 `required` 파라미터를 주입하기 위해 `db.query(UPDATE node SET config = $1 ...)` 직접 쿼리를 사용한다. 워크플로 설정 API가 있거나 향후 스키마 변경 시 테스트가 조용히 깨질 수 있다. 파일 내 다른 e2e 테스트들은 API만 사용하므로 일관성 측면에서도 이질적이다.
- 제안: 노드 설정을 API로 업데이트하는 경로가 있다면 그 경로를 우선한다. 불가피하게 DB 직접 조작이 필요하다면 `setupNodeWithParameters(wfId, params)` 같은 헬퍼 함수로 추출해 의도를 명시하고 재사용성을 높인다.

### INFO: `WorkflowsController.execute` 메서드의 `rawValues` 추출 로직이 복잡
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` L877-882 (전체 파일 컨텍스트)
- 상세: 이 변경 범위에 직접 포함되지는 않지만, 변경된 `execute` 메서드 내 `rawValues` 결정 로직(`body?.parameterValues ?? (body?.input && typeof body.input === 'object' ...)`  3단계 fallback)은 인라인으로 두기에 파악이 어렵다. 함수 내 다른 부분(Shutdown gate, schema 로드, 파라미터 resolve, executionInput 구성)과 뒤섞여 있어 단일 책임 밀도가 높다.
- 제안: `rawValues` 추출을 `extractRawParameterValues(body)` 같은 private 또는 별도 유틸 함수로 분리한다. 이는 이번 diff의 범위를 벗어나는 리팩터링이므로 참고 수준의 제안이다.

---

## 요약

이번 변경은 내부 `reason` 문자열과 공개 `UPPER_SNAKE_CASE` 필드 코드를 명확히 분리하는 의도가 잘 드러나며, `REASON_TO_DETAIL` 상수 맵과 `toTriggerParameterErrorDetails` 함수가 단일 책임을 갖고 있어 가독성이 양호하다. JSDoc 주석이 spec 참조까지 포함해 맥락을 충실히 설명한다. 다만 `toTriggerParameterErrorDetails` 내부에서 동일 키를 두 번 조회하는 사소한 패턴, 테스트 케이스 간 중복 검증, 인라인 타입 리터럴 반복, e2e 직접 DB 조작의 일관성 이탈이 있다. 이 모두 INFO 수준이며 기능·안전성에는 영향을 주지 않는다.

## 위험도

LOW
