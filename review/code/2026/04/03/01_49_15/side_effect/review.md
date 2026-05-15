## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] 템플릿 기존 동작 파괴 — Expression 해석 오류 발생 가능**
- **위치**: `expression-exclusions.ts` — `template: new Set(['template'])` 제거  
- **상세**: 이전에는 `template` 핸들러의 `template` 키가 expression 해석에서 제외되어 `{{ name }}` 같은 패턴이 그대로 출력되었음. 변경 후 동일 패턴이 expression으로 해석되며, `name`이 `exprContext`에 없으면 `Expression error in config.template` 예외가 발생하여 워크플로우 실행이 중단됨. 기존에 저장된 워크플로우 데이터에 영향을 줌.  
- **제안**: 마이그레이션 가이드 또는 fallback 처리 추가. 예: expression 실패 시 원본 문자열 유지 옵션.

---

**[WARNING] `exprContext` 객체 직접 변이(Mutation)**
- **위치**: `execution-engine.service.ts:553–561`  
- **상세**: `buildExpressionContext()`가 반환한 `exprContext` 객체에 `nodeInput`의 키-값을 직접 추가함. 현재는 로컬 객체이므로 문제없지만, 향후 `buildExpressionContext`가 캐싱 또는 공유 객체를 반환하도록 변경될 경우 다른 노드 실행에 오염될 수 있음. 또한 `$`로 시작하지 않는 `nodeInput` 키(예: `uppercase`, `lowercase`)가 expression 엔진 내장 함수명과 충돌할 가능성 있음.  
- **제안**: 직접 변이 대신 spread로 새 객체 생성: `const enrichedContext = { ...exprContext, ...spreadVars };`

---

**[WARNING] `template` 핸들러 `validate()`가 unresolved 상태에서 실행됨**
- **위치**: `execution-engine.service.ts` — validate → buildContext → resolve 순서  
- **상세**: `validate(node.config)`는 expression이 해석되기 **전**의 config를 검증함. 만약 template이 `{{ $var.myTemplate }}`처럼 동적으로 지정된 경우, 검증 시점에는 문자열이므로 통과하지만 실제 resolve 후 빈 값이나 비문자열이 될 수 있음. handler의 `execute`는 이를 그대로 `content`로 반환하므로 빈 출력이 조용히 발생할 수 있음.  
- **제안**: `execute` 내에서 `content`가 string인지 재확인하거나, 해석 후 재검증 레이어 추가.

---

**[INFO] plugin 경로 변경 — 경로 미존재 시 silent failure**
- **위치**: `.agents/commands/ai-review.md`, `.claude/settings.json`  
- **상세**: `.claude/plugins/skills/code-review-agents` → `.claude/skills/code-review-agents`로 경로 변경. 신규 경로에 파일이 없으면 `ai-review` 스킬 실행 시 Python 오류 발생. 이전 경로 파일이 남아있을 경우 혼란 발생 가능.  
- **제안**: 이전 경로 정리 여부 확인 및 신규 경로의 파일 존재 여부 검증.

---

**[INFO] `TemplateHandler.execute` 파라미터 무시 — 인터페이스 계약 약화**
- **위치**: `template.handler.ts:20`  
- **상세**: `execute(...[, config]: Parameters<NodeHandler['execute']>)`로 `input`과 `context`를 완전히 무시함. 현재는 resolution이 상위 레이어에서 완료되므로 의도적이나, `NodeHandler` 인터페이스 구현체로서 계약이 약화됨. 향후 context가 필요한 기능 추가 시 누락 위험.  
- **제안**: 명시적으로 `_input` `_context`로 선언하여 의도를 드러내는 것이 가독성 측면에서 바람직.

---

**[INFO] websocket.gateway.spec.ts 타입 캐스트 수정**
- **위치**: `websocket.gateway.spec.ts:203`  
- **상세**: `(mockEngine.continueExecution as jest.Mock)` 캐스트 추가는 TypeScript 타입 오류 수정으로 런타임 부작용 없음. 안전한 변경.

---

### 요약

이번 변경의 핵심은 `TemplateHandler`의 자체 `{{ }}` 렌더링 로직을 제거하고, 공통 expression resolver로 통합한 것이다. 구조적으로는 올바른 방향이나, `EXPRESSION_EXCLUSIONS`에서 `template` 항목 제거가 **기존 저장된 워크플로우**에 대한 하위 호환성 파괴를 일으킬 수 있다는 점이 가장 중요한 부작용이다. 특히 `$input.` 접두사 없이 `{{ name }}` 형태로 작성된 템플릿들이 expression 해석 실패로 워크플로우를 중단시킬 수 있다. `exprContext` 직접 변이도 현재는 안전하지만 미래 리팩토링 시 위험 요소가 될 수 있으므로 방어적 코드로 개선하는 것이 권장된다.

### 위험도

**MEDIUM**