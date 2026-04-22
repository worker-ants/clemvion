## 발견사항

### [WARNING] SwitchHandler `meta` 응답 스키마 파괴적 변경
- **위치**: `switch.handler.ts`, execute() 반환값
- **상세**: `meta` 필드 구조가 변경됨. 이전: `{ expression, value, matchedCase }` → 이후: `{ mode, matchedCase, value? }`. `expression` 필드가 제거되어, 이 필드를 소비하는 프론트엔드나 다운스트림 서비스가 있다면 `undefined`를 받게 됨.
- **제안**: 프론트엔드나 NodeExecution 저장소에서 `meta.expression`을 참조하는 코드를 확인하고 마이그레이션하거나, 임시로 `expression: switchValue` 필드를 유지해 점진적 제거를 적용할 것.

### [WARNING] `toEngineFlatShape` — `port`/`status` 우선순위 역전
- **위치**: `handler-output.adapter.ts`, `toEngineFlatShape()`
- **상세**: 이전에는 핸들러가 `port`/`status`를 명시하지 않았을 때만 output 객체 내 동명 필드가 유지됐지만(`base.port === undefined` 조건), 이제는 핸들러 선언이 무조건 덮어씀. pass-through 핸들러가 `output: input`으로 upstream의 `port`를 의도적으로 전달하고 싶은 경우 동작이 달라짐.
- **제안**: 이 변경은 버그 수정(form resume 후 switch가 stale port를 상속하는 문제)으로 정당화되지만, pass-through 패턴에 의존하는 기존 핸들러가 있는지 전수 검사 필요. 테스트 `'still preserves inherited port when adapted does not declare one'`이 커버하고 있으나, `output` 내 `port`를 의도적으로 쓰는 핸들러 케이스는 미커버.

### [INFO] `SwitchConfig.switchValue` 타입 변경 (required → optional)
- **위치**: `switch.handler.ts`, `SwitchConfig` 인터페이스
- **상세**: `switchValue: unknown` → `switchValue?: unknown`. TypeScript 인터페이스 레벨에서는 하위 호환적이나, 런타임 validate()는 여전히 `mode: 'value'`일 때 필수 검증을 수행함. 두 계층의 계약이 일치하지 않아 타입 추론 오류를 유발할 수 있음.
- **제안**: 인터페이스를 `{ mode: 'value'; switchValue: unknown } | { mode: 'expression' }` 형태의 discriminated union으로 표현하면 타입과 런타임 계약이 일치함.

### [INFO] 새 필드 `mode`, `strictComparison` — 하위 호환 추가
- **위치**: `switch.handler.ts`, `if-else.handler.ts`
- **상세**: 두 필드 모두 optional이며 기본값이 적용됨(`mode ?? 'value'`, `strictComparison === true`). 기존 클라이언트가 보내지 않아도 동작이 동일하므로 하위 호환적.

### [INFO] `condition-evaluator.util` 추출 — 내부 계약 공유
- **위치**: `condition-evaluator.util.ts`
- **상세**: `IfElseHandler`와 `SwitchHandler`가 동일한 `evaluateCondition`을 공유. `Condition` 인터페이스가 공개 exported type이 됨. 이 타입이 외부로 노출되는 API DTO나 DB 스키마와 연결된다면 타입 변경 시 영향 범위가 넓어짐.

---

## 요약

이번 변경은 HTTP REST API가 아닌 실행 엔진 내부의 노드 핸들러 계약을 다루므로, 외부 클라이언트에 대한 직접적인 API 파괴는 없다. 그러나 두 가지 내부 계약 변경이 주목할 만하다: SwitchHandler `meta` 응답 스키마에서 `expression` 필드 제거(프론트엔드 또는 실행 이력 뷰어가 소비할 수 있음)와 `toEngineFlatShape`의 `port`/`status` 우선순위 역전(의도적 버그 수정이나 side-effect 가능성 존재). 전반적으로 변경 방향은 올바르며 회귀 테스트로 잘 커버되어 있으나, `meta.expression` 소비 코드에 대한 마이그레이션 확인이 필요하다.

## 위험도

**LOW**