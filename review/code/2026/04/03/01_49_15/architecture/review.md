### 발견사항

---

**[WARNING] executeNode()에 노드 타입 특화 로직 삽입 (OCP/SRP 위반)**
- 위치: `execution-engine.service.ts` `:530~568` (`executeNode` 내 template 분기)
- 상세: `ExecutionEngineService`가 `template` 노드 타입의 구체적인 동작(입력 데이터를 표현식 컨텍스트 루트에 전개)을 직접 알고 처리함. 향후 다른 핸들러가 유사한 컨텍스트 커스터마이징을 필요로 할 경우, 이 메서드에 `if (node.type === 'xxx')` 분기가 계속 추가되는 구조가 됨. 이는 Strategy 패턴으로 구성된 핸들러 아키텍처의 일관성을 깨고, 실행 엔진이 각 핸들러의 내부 관심사를 알아야 하는 결합도를 생성함.
- 제안: `NodeHandler` 인터페이스에 선택적 메서드 추가:
  ```typescript
  enrichExpressionContext?(
    context: Record<string, unknown>,
    input: unknown,
  ): void;
  ```
  `TemplateHandler`가 이를 구현하고, `executeNode()`는 `handler.enrichExpressionContext?.(exprContext, nodeInput)`를 호출하는 방식으로 변경. 실행 엔진은 타입을 알 필요가 없어짐.

---

**[WARNING] 핸들러와 실행 엔진 간 암묵적 계약 (Implicit Contract)**
- 위치: `template.handler.ts` 전체, `execution-engine.service.ts` 컨텍스트 전개 로직
- 상세: `TemplateHandler.execute()`는 `config.template`이 이미 표현식 엔진에 의해 해석된 상태임을 전제함. 그러나 이 전제는 코드 어디에도 명시적으로 표현되지 않음. 핸들러 단독으로 테스트하거나 실행 엔진 외부에서 호출하면, 미해석된 `{{ }}` 문자열이 그대로 출력됨. `execute()`의 주석(`// config.template is already resolved by the expression engine`)이 이를 문서화하고 있으나, 계약이 인터페이스 수준에서 강제되지 않음.
- 제안: 이 계약을 인터페이스나 타입 수준에서 표현하거나, 적어도 `NodeHandler` 기본 문서에 "핸들러가 수신하는 config는 표현식이 이미 해석된 상태"임을 명시.

---

**[INFO] 표현식 제외 목록 제거는 아키텍처적으로 올바른 방향**
- 위치: `expression-exclusions.ts`
- 상세: `template` 핸들러를 표현식 제외에서 제거한 것은, 이전에 핸들러 내부에 자체 파서를 두었던 이중 파싱 구조를 통합한 것. 중복 책임을 제거하고 표현식 해석 책임을 단일 서비스(`ExpressionResolverService`)로 집중시킨 점은 응집도 향상에 기여함.

---

**[INFO] 경로 변경 (`.claude/plugins/skills` → `.claude/skills`)은 영향 없음**
- 위치: `ai-review.md`, `settings.json`
- 상세: 플러그인 경로 정규화로, 아키텍처적 영향 없음.

---

**[INFO] WebSocket 게이트웨이 스펙 타입 캐스팅 수정**
- 위치: `websocket.gateway.spec.ts` `:203`
- 상세: `(mockEngine.continueExecution as jest.Mock)` 명시적 캐스팅은 TypeScript 타입 안전성 관점에서 올바른 방향. 기존 암묵적 의존은 컴파일 옵션에 따라 오류가 될 수 있었음.

---

### 요약

이번 변경의 핵심 의도(템플릿 렌더링 책임을 핸들러 내부에서 표현식 엔진으로 이관)는 아키텍처적으로 올바른 방향이며, `TemplateHandler`의 단순화와 표현식 제외 목록 정리는 응집도를 높인다. 그러나 구현 방식에서 `executeNode()` 내부에 `node.type === 'template'` 분기를 직접 삽입한 것은 Strategy 패턴 기반의 핸들러 아키텍처와 충돌하며, 향후 다른 노드 타입이 유사한 요구를 가질 경우 실행 엔진에 타입별 분기가 누적되는 OCP 위반 구조로 발전할 위험이 있다. `NodeHandler` 인터페이스에 선택적 컨텍스트 확장 훅을 추가하는 방식으로 이 결합을 제거하는 것을 권장한다.

### 위험도

**MEDIUM**