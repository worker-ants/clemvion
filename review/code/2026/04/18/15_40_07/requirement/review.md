### 발견사항

- **[WARNING]** `dropStaleEdges`의 wildcard 로직이 빈 Set을 반환하여 unknown 타입 노드에 연결된 엣지를 실제로 검증하지 않음
  - 위치: `edge-utils.ts` `validOutputs()` / `validInputs()`
  - 상세: `size > 0` 체크로 빈 Set은 검증을 건너뛰는 의도이나, "unknown 타입 → 허용"과 "알려진 타입이지만 포트가 없음 → 허용"이 동일하게 처리됨. 미래에 포트 없는 노드가 추가될 경우 잘못된 엣지가 살아남을 수 있음
  - 제안: wildcard 여부를 별도 boolean으로 구분 (`const UNKNOWN_NODE = Symbol()`)

- **[WARNING]** `enrichInfoExtractorOutputSchema`가 `baseSchema`에 `properties.output`이 없으면 enrichment 없이 반환하지만, `information_extractor` 스키마에서 `output`이 항상 존재한다고 가정
  - 위치: `use-expression-context.ts:93` (`if (!outputNode || typeof outputNode !== "object") return cloned`)
  - 상세: Information Extractor의 `outputSchema` 구조가 `{ output: { extracted: ... } }` 계층을 갖지 않으면 silent fail하며 enrichment가 무시됨. 사용자가 config에 outputSchema 필드를 정의해도 autocomplete에서 보이지 않음
  - 제안: 경고 로그 추가 또는 조건 명시 문서화

- **[WARNING]** `getExpressionToken`의 역방향 탐색에서 `between[i - 1]`이 `i === 0`일 때 `undefined`를 참조
  - 위치: `use-expression-suggestions.ts:65,75` (`between[i - 1] !== "\\"`)
  - 상세: `i`가 0일 때 `between[-1]`은 `undefined`이므로 이스케이프 체크가 부정확. `\"`로 시작하는 토큰 처리 시 오작동 가능
  - 제안: `i > 0 && between[i - 1] !== "\\"` 조건 추가

- **[INFO]** `nodeAccessorMatch` 패턴이 `$node["..."].`에서 accessor를 매칭하지만, 먼저 실행되는 `nodeAccessorDrillMatch`와 우선순위 겹침 구간에서 regex 모호성 존재
  - 위치: `use-expression-suggestions.ts` 두 regex match 순서
  - 상세: `$node["X"].output.` 입력 시 `nodeAccessorDrillMatch`가 먼저 매칭되나, 정규식 `(.*)$`이 빈 문자열도 허용하므로 `$node["X"].output.` (trailing dot)에서 두 번째 regex도 매칭될 수 있음. 현재 순서상 문제없으나 유지보수 시 취약
  - 제안: 주석으로 우선순위 의존성 명시

- **[INFO]** `aiAgentNodeOutputSchema`의 `condition` 필드가 `.partial()`이지만 passthrough 없음 — 다른 object들과 일관성 불일치
  - 위치: `ai-agent.schema.ts:313-319`
  - 상세: 다른 nested object들(`conversationConfig`, `metadata`)은 `.partial().passthrough()`인 반면 `condition`은 `.partial()`만 적용. AI Agent가 향후 condition 출력에 추가 필드를 보낼 경우 Zod 파싱에서 탈락
  - 제안: `.partial().passthrough()` 적용

- **[INFO]** `informationExtractorNodeOutputSchema` 주석에서 "legacy port selector `{ port, data: { config, output, meta } }`"를 언급하지만 실제 schema에는 최상위에 `config`, `output`, `meta`가 직접 있음
  - 위치: `information-extractor.schema.ts` JSDoc
  - 상세: 주석이 `data.config`, `data.output`처럼 한 단계 더 깊은 경로를 암시하나 스키마는 flat함. 문서와 구현 불일치

- **[INFO]** `dropStaleEdges` 테스트의 `beforeAll`이 전역 store에 `ai_agent`/`template` definition을 추가하지만, `configSchema: {}`로 설정됨 — 실제 dynamic ports 테스트에서 `resolveDynamicPorts`가 mode에 따른 포트를 올바르게 결정하는지 확인 필요
  - 위치: `edge-utils.test.ts:250`
  - 상세: `configSchema: {}`는 실제 AI Agent schema와 다름. `resolveDynamicPorts`가 `dynamicPorts.kind === "ai-agent-conditional"`을 통해 ports를 결정하면 문제없으나, schema 의존 경로가 있다면 테스트가 실제 동작을 반영하지 못함

---

### 요약

이번 변경은 노드 출력/설정 스키마를 백엔드에서 정의하고 프론트엔드 자동완성에 활용하는 기능과, 워크플로우 로드 시 stale edge를 자동 정리하는 기능을 구현한 것으로, 전반적으로 설계 의도와 구현이 일치하고 테스트도 충분히 작성되어 있습니다. 다만 `dropStaleEdges`의 unknown 타입 판별 로직의 모호성, `getExpressionToken`의 경계 인덱스 미검증, `enrichInfoExtractorOutputSchema`의 silent fail 등 소수의 엣지 케이스 처리 취약점이 발견되었으며, `condition` 객체의 `.passthrough()` 누락 및 주석과 구현 간 일부 불일치도 확인됩니다.

### 위험도
**LOW**