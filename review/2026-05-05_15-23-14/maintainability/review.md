### 발견사항

---

**[WARNING] `resolveStableId` 패턴 중복 — `resolve-dynamic-ports.ts`**
- 위치: `switchPorts` (L.75), `classifierCategoriesPorts` (L.87), `aiAgentConditionalPorts` (L.160)
- 상세: `typeof c.id === 'string' && c.id.trim().length > 0 ? c.id : \`fallback_${i}\`` 패턴이 세 함수에 각각 인라인으로 박혀 있다. 게다가 `aiAgentConditionalPorts`는 `.trim()` 없이 `c.id.length > 0`만 체크해 미묘한 불일치가 존재한다. 이번 PR이 "switchPorts 와 동일 trim 기반 fallback"을 comment로 선언했음에도 기존 함수는 수정되지 않았다.
- 제안:
  ```typescript
  function resolveStablePortId(id: string | undefined, fallback: string): string {
    return typeof id === 'string' && id.trim().length > 0 ? id : fallback;
  }
  ```
  세 함수 모두 이 helper를 사용하도록 교체하면 trim 정책이 한 곳에서 관리되고, `aiAgentConditionalPorts`의 불일치도 자연히 수정된다.

---

**[WARNING] resolver ↔ handler 간 trim 동작 불일치**
- 위치: `resolve-dynamic-ports.ts:87` vs `text-classifier.handler.ts` `buildCategoryPortIds`
- 상세: resolver는 `c.id`를 그대로 반환(`trim()` 없이 원본 보존)하는 반면, handler의 `buildCategoryPortIds`는 `c.id.trim()`으로 trim된 값을 반환한다. 스키마 검증(`/^[a-zA-Z0-9_-]+$/`)이 공백을 막으므로 production에서는 차이가 없지만, comment가 "Mirrors the resolver fallback"이라고 선언하면서 실제 동작이 다르면 미래 유지보수자가 두 구현을 "동일"로 믿고 수정할 때 오해를 유발할 수 있다.
- 제안: 위 `resolveStablePortId` helper를 공유하거나, 둘 중 하나의 동작으로 맞추고 comment에서 "Mirrors" 표현을 제거.

---

**[INFO] slug 정규식 `/^[a-zA-Z0-9_-]+$/` 상수화 미적용**
- 위치: `text-classifier.schema.ts:12`, 주석에서 "switch.caseDefSchema.id 와 동일 패턴"으로 언급
- 상세: comment로 동일 패턴임을 명시하면서도 상수를 공유하지 않는다. 추후 포트 id 허용 문자 범위가 바뀌면 switch, text_classifier 스키마를 각각 수정해야 한다.
- 제안: 공통 위치(예: `node-component.interface.ts` 또는 별도 `port-id.ts`)에 `export const PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]+$/` 정의 후 참조.

---

**[INFO] `buildCategoryPortIds` comment의 "Mirrors" 표현이 부정확**
- 위치: `text-classifier.handler.ts:17-23`
- 상세: `trim()` 적용 여부 외에도, resolver는 `c.id`를 원본 그대로, handler는 `.trim()` 적용 결과를 쓴다. "Mirrors the resolver fallback"이라는 표현은 세부 동작이 동일하다는 인상을 주어 오해 소지가 있다.
- 제안: "Applies the same fallback rule as `classifierCategoriesPorts`" 수준으로 표현을 완화하거나, 실제로 동일하게 맞춤.

---

### 요약

이번 변경은 `text_classifier` 의 카테고리 안정 포트 id(`categories[*].id`) 도입을 handler·resolver·schema·spec·system-prompt 전 계층에 걸쳐 일관되게 반영했으며, `buildCategoryPortIds` 로 핵심 로직을 중앙화하고 테스트 커버리지도 단일·다중 레이블 양쪽에 추가해 전반적으로 유지보수성이 양호하다. 다만 `resolve-dynamic-ports.ts` 내 포트 id 결정 패턴이 세 함수에 인라인으로 중복되고 `aiAgentConditionalPorts`만 `.trim()` 없이 동작하는 불일치가 남아 있어, `resolveStablePortId` helper 도입으로 한 번에 제거할 수 있는 technical debt가 생겼다. 실운영 동작에 영향을 주는 버그는 없으나, 동일 파일 내 세 함수의 미묘한 동작 차이가 향후 수정 시 혼란을 줄 수 있다.

### 위험도

**LOW**