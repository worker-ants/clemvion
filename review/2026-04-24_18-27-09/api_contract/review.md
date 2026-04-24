## 발견사항

### [INFO] ShadowResult 인터페이스의 `hint` 필드 확장 — additive-only 변경
- **위치**: `shadow-workflow.ts`, `updateNode` (line ~383), `removeNode` (line ~431), `addEdge` (line ~493)
- **상세**: 기존에는 `hint`가 cascading NODE_NOT_FOUND 케이스(`add_edge` + `recentFailedAddNodeLabels` 비어있지 않을 때)에만 실렸다. 이번 변경 이후 `update_node` / `remove_node` / `add_edge` 세 곳에서 label-lookalike 감지 시에도 `hint`가 추가된다. `hint?: string`은 이미 optional 필드이므로 기존 호출자는 영향을 받지 않는다.
- **제안**: 현재 패턴 유지 적합. 단, `ShadowResult`의 JSDoc이 "hint가 실릴 수 있는 조건"을 열거하고 있어(`hint` 필드 주석) 새 케이스(label-lookalike)가 누락돼 있음 — 문서 동기화 권고.

### [INFO] `addEdge`의 hint 우선순위 계약 — 명시적 but 테스트 의존
- **위치**: `shadow-workflow.ts` ~493, `shadow-workflow.spec.ts` "prefers cascading failed-add_node hint over label-lookalike"
- **상세**: cascading > label-lookalike 우선순위 계약이 코드 주석과 테스트로만 보장된다. `ShadowResult` 인터페이스나 공개 타입 수준에서는 이 우선순위가 드러나지 않는다. 내부 계약이라 현재로선 충분하나, 향후 추가 hint 소스가 생길 경우 우선순위 체계를 `ShadowResult` 레벨에서 타입으로 표현하면 소비자 코드가 더 명확해진다.
- **제안**: 당장 변경 불필요. 힌트 소스가 3종 이상으로 늘어날 시점에 `hintSource?: 'cascading' | 'label-lookalike' | ...` 필드 도입 검토.

### [INFO] `buildSystemPrompt` — 시그니처·반환 타입 무변경, API 계약 안전
- **위치**: `system-prompt.ts`
- **상세**: 함수 시그니처 `(nodeDefs, snapshot, activePlanContext?)` 및 반환 타입 `string` 불변. 새 UUID-vs-label 블록은 프롬프트 문자열 내부 텍스트 추가이므로 호출자에게 투명하다.

---

## 요약

변경 대상은 HTTP API 엔드포인트가 아닌 내부 `ShadowWorkflow` 클래스와 LLM 시스템 프롬프트 빌더다. `ShadowResult.hint`는 이미 optional 필드로 선언되어 있고, 이번 변경은 해당 필드가 채워지는 케이스를 `update_node`·`remove_node`·`add_edge`의 label-lookalike 경로로 확장한 additive 변경에 해당한다. 에러 코드(`NODE_NOT_FOUND`)와 `ShadowResult` 인터페이스 구조는 그대로 유지되므로 기존 소비자 코드에 breaking change가 없다. 우선순위(cascading > label-lookalike) 계약은 테스트로 고정되어 있어 회귀 방어는 갖춰져 있다.

## 위험도

**LOW**