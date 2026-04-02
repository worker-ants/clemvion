### 발견사항

- **[WARNING]** `ExecutionEngineService`의 템플릿 노드 컨텍스트 스프레딩 로직에 단위 테스트 없음
  - 위치: `execution-engine.service.ts` +540~554 (새로 추가된 `if (node.type === 'template' ...)` 블록)
  - 상세: `nodeInput`을 루트레벨 변수로 `exprContext`에 주입하는 핵심 로직이 `ExecutionEngineService` 레벨에서 테스트되지 않음. `ExpressionResolverService` 테스트는 resolver 단독 동작만 검증하며, 실제 엔진이 context를 구성하는 방식은 검증되지 않음
  - 제안: `executeNode()`에 대한 단위 테스트 추가 — template 노드에 `{ name: 'Alice' }` 입력을 전달했을 때 `{{ name }}`이 최종 출력에 `Alice`로 치환되는지를 확인하는 케이스 필요

- **[WARNING]** 기존 컨텍스트 키 보호 로직(`if (!(key in exprContext))`) 미검증
  - 위치: `execution-engine.service.ts` +551~553
  - 상세: `$input`, `$var` 등의 기존 컨텍스트 키가 nodeInput의 동일 이름 키에 의해 덮어쓰이지 않는 충돌 방지 조건이 테스트 없이 존재함
  - 제안: `nodeInput`에 `$input` 키가 포함된 경우 기존 `exprContext.$input`이 보존되는지 검증하는 테스트 추가

- **[WARNING]** `validate()`가 빈 문자열 템플릿을 거부하지만 `execute()` 테스트는 이를 허용하는 것처럼 테스트함
  - 위치: `template.handler.spec.ts` "should handle empty template content" / `template.handler.ts` validate()
  - 상세: `!config.template`은 빈 문자열 `''`에 대해 `true`이므로 validate()는 실패를 반환함. 그러나 execute() 테스트가 빈 문자열로 직접 호출하여 성공 케이스로 검증 — 실제 런타임에서 불가능한 경로를 정상 케이스로 오해하게 만듦
  - 제안: validate() 테스트에 `template: ''` 케이스를 실패 케이스로 명시적으로 추가하거나, 빈 문자열을 허용하도록 validate() 로직을 수정하고 테스트 정합성 확보

- **[WARNING]** template 노드에서 `nodeInput`이 비객체(string, number, null)일 때 스프레딩 스킵 동작 미검증
  - 위치: `execution-engine.service.ts` +543~546
  - 상세: `typeof nodeInput === 'object' && nodeInput !== null` 조건으로 보호되나, 해당 조건이 실패하는 케이스(이전 노드가 문자열이나 숫자를 출력하는 경우)에 대한 테스트 없음
  - 제안: nodeInput이 `"hello"` 또는 `42`인 template 노드 실행 시 에러 없이 동작하는지 확인하는 테스트 추가

- **[INFO]** `template.handler.spec.ts`의 execute() 테스트는 사전 해석된 내용만 검증
  - 위치: `template.handler.spec.ts` execute describe 블록
  - 상세: 신규 아키텍처에서 handler는 이미 resolve된 문자열을 받아 pass-through하므로 테스트 자체는 올바름. 다만 `{{ name }}` 같은 미해석 표현식이 포함된 채로 execute()에 전달되었을 때의 동작(단순 pass-through, 즉 {{ name }} 문자열 그대로 반환)도 명시적으로 테스트하면 아키텍처 의도를 더 명확히 전달할 수 있음
  - 제안: `'should pass through unresolved expressions as-is'` 케이스 추가 (표현식 미해석 시 handler 책임 없음을 명시)

- **[INFO]** `websocket.gateway.spec.ts` 타입 캐스팅 수정은 적절
  - 위치: `websocket.gateway.spec.ts` +203
  - 상세: `(mockEngine.continueExecution as jest.Mock).mockImplementation(...)` 변경은 TypeScript 타입 안전성을 위한 올바른 수정이며 기능 영향 없음. 나머지 `continueExecution` mock 호출도 동일 패턴으로 통일 여부 확인 권장

---

### 요약

이번 변경의 핵심은 TemplateHandler의 자체 `{{ }}` 파서를 제거하고 전역 ExpressionResolverService에 위임하는 아키텍처 전환이며, 방향성은 올바르다. `expression-resolver.service.spec.ts`의 테스트 업데이트와 `template.handler.spec.ts` 신규 작성은 각 레이어의 단독 동작을 잘 검증하고 있다. 그러나 가장 중요한 신규 로직 — `ExecutionEngineService`에서 template 노드의 nodeInput을 exprContext에 스프레딩하는 부분 — 에 대한 통합/단위 테스트가 전혀 없어, `{{ name }}` 문법이 실제로 동작하는지를 검증할 수 없는 상태다. 또한 validate()와 execute() 테스트 간 빈 문자열 처리 정합성 문제가 실제 버그로 이어질 수 있다.

### 위험도

**MEDIUM**