## 발견사항

### [WARNING] 미정의 변수 동작의 Breaking Change
- **위치**: `execution-engine.service.ts`, `expression-exclusions.ts`
- **상세**: 기존 `TemplateHandler`는 `{{ name }}`에서 `name`이 입력에 없으면 빈 문자열(`''`)로 조용히 대체했습니다. 새 구현은 표현식 엔진을 사용하므로, 정의되지 않은 참조 시 오류가 발생합니다 (`expression-resolver.service.spec.ts`의 `'throws for undefined reference'` 테스트가 이를 확인). 기존 템플릿이 암묵적 빈 값 동작에 의존하고 있다면 런타임 오류가 발생할 수 있습니다.
- **제안**: 오류 정책에서 template 노드에 대한 fallback 처리를 추가하거나, 미정의 변수를 빈 문자열로 처리하는 옵션을 도입하세요.

---

### [WARNING] `{{ name }}` 단축 문법에 대한 통합 테스트 누락
- **위치**: `execution-engine.service.ts` (~530~550줄)
- **상세**: 코드 주석에서 명시적으로 `{{ name }}`이 `{{ $input.name }}`과 함께 동작한다고 기술하고 있으나, 이 전체 파이프라인(엔진 서비스가 input 데이터를 루트 컨텍스트에 스프레드 → 표현식 엔진이 해석)을 검증하는 테스트가 없습니다. `expression-resolver.service.spec.ts`의 테스트는 표현식 엔진 단위만 검증하며, `template.handler.spec.ts`는 이미 해석된 컨텐츠만 테스트합니다.
- **제안**: `execution-engine.service.ts` 또는 통합 테스트에서 `nodeType === 'template'`이고 `nodeInput = { name: 'Alice' }`일 때 `{{ name }}`이 `Alice`로 해석되는 엔드-투-엔드 시나리오를 테스트하세요.

---

### [WARNING] 배열 입력 시 예상치 못한 컨텍스트 스프레딩
- **위치**: `execution-engine.service.ts` (~545줄)
- **상세**: `nodeInput`이 배열인 경우 `Object.entries(nodeInput as Record<string, unknown>)`는 `'0'`, `'1'` 같은 숫자 키를 컨텍스트에 주입합니다. 배열 입력은 `typeof [] === 'object'`이므로 조건을 통과하며, 이 동작은 의도된 것인지 불명확합니다.
- **제안**: 조건을 `!Array.isArray(nodeInput) && typeof nodeInput === 'object' && nodeInput !== null`으로 수정하거나, 배열 입력에 대한 테스트 케이스를 추가하여 의도를 명확히 하세요.

---

### [INFO] `validate()`가 표현식 값을 가진 `outputFormat` 처리 불가
- **위치**: `template.handler.ts:7~15`, `execution-engine.service.ts`
- **상세**: `validate()`는 해석 전 원본 `node.config`에서 실행됩니다. `outputFormat`이 `'{{ $input.format }}'`처럼 표현식이면 유효성 검사에서 실패합니다. 이 변경에서 새롭게 도입된 문제는 아니지만, template 핸들러의 표현식 엔진 통합으로 인해 이 문제가 더 부각됩니다.
- **제안**: 표현식 형식(`{{ ... }}`)인 경우에는 유효성 검사를 건너뛰는 처리를 추가하세요.

---

### [INFO] 빈 템플릿 테스트와 `validate()` 동작 불일치
- **위치**: `template.handler.spec.ts` — `'should handle empty template content'`
- **상세**: `validate({ template: '' })`는 실패(`'template is required and must be a string'`)하지만, 이 테스트는 `execute()`를 직접 호출하여 검증을 우회합니다. 실제 실행 흐름에서는 빈 템플릿이 유효성 검사 단계에서 거부됩니다.
- **제안**: 테스트 설명을 `'execute() handles empty string (validation bypassed)'`처럼 명확하게 수정하거나, 빈 문자열이 실제로 유효한 요구사항이라면 `validate()`를 수정하세요.

---

### [INFO] 경로 리팩토링 (ai-review.md, settings.json)
- **위치**: `.agents/commands/ai-review.md`, `.claude/settings.json`
- **상세**: `.claude/plugins/skills/` → `.claude/skills/`로의 순수한 경로 변경입니다. 두 파일이 일관성 있게 업데이트되어 있어 기능적 문제는 없습니다. 실제 파일 시스템 경로가 존재하는지 확인이 필요합니다.

---

### [INFO] TypeScript 타입 캐스팅 수정 (websocket.gateway.spec.ts)
- **위치**: `websocket.gateway.spec.ts:203`
- **상세**: `mockEngine.continueExecution.mockImplementation` → `(mockEngine.continueExecution as jest.Mock).mockImplementation` 수정은 타입 안전성을 높이는 올바른 변경입니다.

---

## 요약

이번 변경의 핵심은 `TemplateHandler`의 자체 `{{ }}` 파서를 제거하고 공통 표현식 엔진으로 통합한 것입니다. 아키텍처적으로는 합리적인 방향이며, template 노드가 `$input`, `$var`, `$node` 등 전체 표현식 문법을 지원하게 되는 기능적 개선입니다. 그러나 미정의 변수 처리 동작의 Breaking Change(조용한 빈 문자열 → 예외 발생)와 핵심 기능인 `{{ name }}` 단축 문법에 대한 통합 테스트 누락이 운영 안정성에 위험 요소입니다. 배열 입력에 대한 스프레딩 동작도 명시적으로 문서화되거나 제어되어야 합니다.

## 위험도

**MEDIUM**