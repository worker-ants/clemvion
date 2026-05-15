## 발견사항

### [WARNING] `WARNING` 상수가 사실상 dead code로 전락
- **위치**: `node-config-summary.ts` line 36 (`const WARNING = Object.freeze(...)`)
- **상세**: 모든 개별 포매터 함수들이 기존 `null` 반환 대신 `warning(...)` 객체를 직접 반환하도록 변경됨. `getConfigSummary` 말미의 `if (!result) return { ...WARNING }` 분기는 이제 `carouselSummary` 가 `null`을 반환하는 경우에만 도달 가능한데, 현재 `carouselSummary` 구현은 항상 비-null 값을 반환함. 결과적으로 `WARNING` 상수와 해당 분기는 실행되지 않는 코드가 됨.
- **위험**: `carouselSummary`만 여전히 `ConfigSummaryResult | null` 시그니처를 유지하고 있어, 미래에 해당 함수가 진짜로 `null`을 반환하는 경로가 추가되면 새 경고 메시지 시스템을 우회하여 구 메시지(`"⚠ Not configured"`)가 노출될 수 있음.
- **제안**: `WARNING` 상수를 제거하거나, `carouselSummary` 반환 타입을 `ConfigSummaryResult`로 좁히고 fallback 분기를 제거하여 일관성 확보.

---

### [WARNING] `FORMATTERS` 레지스트리 타입과 실제 함수 시그니처 불일치
- **위치**: `node-config-summary.ts` — `FORMATTERS` 선언부
- **상세**: 레지스트리 타입은 `Record<string, (config: NodeConfig) => ConfigSummaryResult | null>`로 선언되어 있으나, `carousel` 을 제외한 모든 포매터 함수는 이제 `ConfigSummaryResult`(non-null)를 반환함. TypeScript상 컴파일 오류는 아니지만(반환 타입 좁히기는 할당 가능), 타입 정보가 실제 동작을 정확히 반영하지 않음.
- **위험**: 타입만 보고 로직을 추론하는 경우 `null` 반환 가능성을 오해할 수 있음.
- **제안**: 레지스트리 타입을 실제 반환 타입 중 더 넓은 것으로 통일하거나, `carousel`의 반환 타입을 non-null로 변경 후 레지스트리 타입도 좁힘.

---

### [INFO] 테스트 매처 범위 확장으로 인한 잠재적 위음성
- **위치**: `custom-node.test.tsx` — lines 120, 147, 176
- **상세**: `"\u26a0 Not configured"` 정확 문자열 매처가 `/^⚠/` 정규식으로 교체됨. `⚠`로 시작하는 텍스트를 가진 모든 요소를 대상으로 쿼리하므로, 향후 다른 경고 메시지가 렌더링되는 경우에도 동일 요소들이 포함됨.
  - `queryAllByText(/^⚠/).some((el) => el.tagName === "P")` 검증은 "어떤 경고도 `<p>` 태그로 렌더링되지 않는다"는 의미로 넓어짐. 의도한 바와 일치하지만, 의도치 않은 경고 메시지가 `<p>` 태그에 렌더링되어도 기존 테스트와 동일하게 실패함.
- **위험**: 낮음. 의도된 변경이며 경고 메시지 체계 개편에 맞는 방향.

---

### [INFO] `mergeSummary` 부분 설정 경고 우선순위 변경
- **위치**: `node-config-summary.ts` — `mergeSummary` 함수
- **상세**: 기존에는 `inputCount == null || !strategy` 조건으로 둘 중 하나만 없어도 동일한 `null`(→ `"⚠ Not configured"`)을 반환. 변경 후 `inputCount == null && !strategy`(둘 다 없음), `inputCount == null`(inputCount만 없음), `!strategy`(strategy만 없음) 세 경우를 구별함.
- **위험**: 없음. 의도된 UX 개선이며 테스트에서 명시적으로 검증됨.

---

## 요약

이번 변경은 경고 메시지 일반화(`"⚠ Not configured"`)에서 노드별 구체적 메시지로의 전환으로, 사이드 이펙트 위험은 전반적으로 낮음. 모든 포매터 함수가 `null` 대신 구체적 경고 객체를 반환하도록 변경되어 실제 런타임 동작은 의도대로 개선되었음. 다만 `WARNING` 상수와 `getConfigSummary`의 fallback 분기가 사실상 dead code가 되었고, `carouselSummary`만 예외적으로 `| null` 시그니처를 유지하여 이 상수가 유일하게 실행될 수 있는 경로로 남아 있음. 이 구조적 불일치를 정리하지 않으면 향후 carousel 수정 시 구 메시지(`"⚠ Not configured"`)가 유출될 위험이 있음. 공개 API(`getConfigSummary` 반환 타입 `ConfigSummaryResult | null`)는 변경되지 않아 외부 호출자에 대한 breaking change는 없음.

## 위험도

**LOW**