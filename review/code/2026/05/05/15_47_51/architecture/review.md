### 발견사항

- **[INFO]** `keyValueSchema` 내부 스키마 직접 export
  - 위치: `http-request.schema.ts:14` — `export const keyValueSchema`
  - 상세: 테스트 접근성을 위해 노드 내부 스키마를 public API로 승격했다. 현재는 문제없지만, 주석에서 스스로 언급하듯(`다른 노드 (form, carousel) 와 동일하게`) 동일한 key-value 패턴이 세 노드 이상에서 반복된다면 `src/nodes/core/schemas/key-value.schema.ts` 같은 공유 위치로 이동해야 할 시점을 검토해야 한다. 현재는 각 노드가 독립적 정의를 갖고 있어 drift가 발생할 수 있다.
  - 제안: 단기적으로 현 구조 유지. 동일 패턴이 3개 노드를 초과하면 공유 스키마로 추출하고 각 노드는 import하여 재사용.

- **[INFO]** UI 관심사가 스키마 레이어 default값에 혼재
  - 위치: `form.schema.ts:13` — `value: z.unknown().default('')`
  - 상세: 변경 이유(React controlled-input warning 방지)가 UI 프레임워크 제약에서 비롯된 것으로, 스키마의 도메인 의미(옵션의 기본 값)와는 다른 레이어의 관심사다. 주석에서 명시하고 있어 의도는 명확하지만, 스키마 레이어가 UI 렌더링 계층의 요구사항에 의해 변경되는 패턴이 굳어지면 향후 비-React 클라이언트 추가 시 부작용이 생길 수 있다.
  - 제안: 허용 가능한 트레이드오프로 현 구조 유지하되, 주석을 "UI 계층 요구에 의한 기본값" 으로 명시 (이미 주석이 있으므로 현재 충분함).

- **[INFO]** `.passthrough()` 전략의 누적 — 타입 안전성 희생
  - 위치: 전 파일 공통
  - 상세: `keyValueSchema`, `optionSchema`, `httpRequestNodeConfigSchema`, `formNodeConfigSchema`, `httpRequestNodeOutputSchema`, `formNodeOutputSchema` 모두 `.passthrough()` 적용. 미래 필드 추가 시 schema 변경 없이 흡수하는 유연성은 확보되나, TypeScript 타입이 extra 필드를 `Record<string, unknown>`으로만 인식해 IDE 지원과 컴파일 타임 검증이 약화된다. 테스트에서 `as Record<string, unknown>` 캐스팅이 필요한 것이 이를 반영.
  - 제안: `.passthrough()` 적용 범위를 "실제로 런타임에 알 수 없는 서드파티 메타데이터를 받는 경계"로 제한하고, 내부적으로 알려진 필드(`description`, `enabled`)는 schema에 선언적으로 추가하는 방향을 검토.

---

### 요약

변경사항은 기존 노드 스키마 패턴(`passthrough`, export-for-test)을 일관되게 따르고 있으며, 계층 간 책임 분리와 모듈 경계 측면에서 문제는 없다. 단, 동일한 key-value 패턴이 여러 노드에 분산 정의되기 시작했고(http-request · form · carousel 언급), 이 패턴이 더 확산될 경우 공유 스키마 미추출로 인한 drift 위험이 생긴다. UI 레이어 요구(React controlled-input default)가 스키마 default 값으로 반영된 것은 실용적 결정이지만 이 패턴이 반복되면 스키마 레이어의 응집도가 흐려질 수 있다. 현재 규모에서는 허용 가능한 수준이며 즉각적인 리팩토링보다는 공유 스키마 추출 시점을 명시적으로 정의해두는 것이 적절하다.

### 위험도

**LOW**