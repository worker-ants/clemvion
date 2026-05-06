---

## 발견사항

### **[INFO]** `turnConfig`에 feature-out된 필드가 여전히 전달됨
- **위치**: `handler.ts:839–841` (`processMultiTurnMessageInner`)
- **상세**: `turnConfig`에 `toolNodeIds: state.toolNodeIds`, `toolOverrides: state.toolOverrides`가 포함되어 `buildTools`에 전달된다. `buildTools`가 해당 필드를 이미 무시하므로 동작에는 영향이 없지만, feature-out 범위 내에서 이 전달 자체도 제거하거나 주석 처리가 일관성상 더 명확하다.
- **제안**: 별도 후속 PR 범위이며 현재 PR 범위를 벗어나지 않아 허용 가능하나, 이후 정리 시 함께 처리 권장.

---

### **[INFO]** `multiTurnStateBase`의 `toolOverrides` 타입이 `unknown[]`으로 약하게 선언됨
- **위치**: `handler.ts:739`
- **상세**: `toolOverrides: [] as unknown[]`으로 선언되어 있으나, `buildTools` 내부의 동일 변수는 `Array<{ nodeId: string; toolName: string; toolDescription: string }>` 타입이다. feature-out 목적으로 빈 배열을 강제하는 것은 동일하나 타입 표현이 불일치한다.
- **제안**: 빈 배열이므로 런타임 영향 없음. 향후 feature-in 복원 시 타입 불일치가 혼란을 줄 수 있으므로 `[] as Array<{ nodeId: string; toolName: string; toolDescription: string }>` 또는 구체 타입으로 통일 권장.

---

### **[INFO]** `conditionToolCalls` 처리 시 `toolCallCount` 증가 비대칭
- **위치**: `handler.ts:966` (multi-turn) vs. `handler.ts:575` (single-turn)
- **상세**: single-turn에서는 condition tool call에 `toolCallCount++`를 하지 않고 주석에도 "does not count"가 명시되어 있다. multi-turn(`processMultiTurnMessageInner`)에서는 condition tool call에도 `toolCallCount++`가 적용된다. feature-out 범위와 직접 관련은 없으나 동작 비대칭이 있다.
- **제안**: 이번 PR 범위 외의 선재 코드로 보이면 범위 이탈 아님. 만약 이번 변경에서 수정된 경우라면 의도 확인 필요.

---

### **[INFO]** `readSingleTurnMeta` 헬퍼가 spec 하단에 추가됨
- **위치**: `handler.spec.ts:2081–2084`
- **상세**: 테스트 전용 유틸 함수로, feature-out 테스트가 아닌 기존 "LLM 비호출 검증" 테스트(`line:151`)에서도 사용된다. feature-out 목적의 테스트 지원 코드이나 기존 테스트의 assertion 방식을 변경하는 형태로 일부 범위를 넘는다.
- **제안**: 테스트 파일 내 유틸 수준의 변경으로 영향 범위가 제한적. 허용 가능.

---

## 요약

세 파일의 변경사항은 전반적으로 선언된 범위(toolNodeIds/toolOverrides feature-out — schema UI 숨김 + 핸들러 빈 배열 강제)에 잘 수렴한다. schema에서는 `hidden: true`와 힌트 추가, handler에서는 `buildTools`와 `multiTurnStateBase` 두 지점에서 빈 배열 강제 처리, spec에서는 feature-out 회귀 가드 테스트 추가와 관련 케이스 skip 처리가 일관되게 이루어졌다. 일부 사소한 타입 비대칭(`unknown[]`)과 condition tool call의 multi/single-turn 간 `toolCallCount` 증가 비대칭은 이번 PR 범위를 직접 벗어나지 않는 선재 코드이거나 허용 가능 수준의 편차이다.

## 위험도

**LOW**