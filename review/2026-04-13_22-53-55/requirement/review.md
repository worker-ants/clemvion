### 발견사항

- **[WARNING]** 미사용 `WARNING` 상수 (dead code)
  - 위치: `node-config-summary.ts` — `const WARNING = Object.freeze<ConfigSummaryResult>({ text: "\u26a0 Not configured", isWarning: true })`
  - 상세: 모든 formatter가 이제 `warning(detail)` 함수를 직접 호출하므로 기존 `WARNING` 상수는 어디에서도 참조되지 않음. `getConfigSummary` 내부의 `if (!result) return { ...WARNING }` 분기도 함께 dead code가 됨
  - 제안: `WARNING` 상수 및 `if (!result) return { ...WARNING }` 분기 제거. FORMATTERS 타입도 `Record<string, (config: NodeConfig) => ConfigSummaryResult>` 로 갱신

- **[INFO]** `carouselSummary` 반환 타입 불일치
  - 위치: `node-config-summary.ts` — `function carouselSummary(config: NodeConfig): ConfigSummaryResult | null`
  - 상세: 나머지 모든 formatter는 이번 변경에서 `ConfigSummaryResult | null` → `ConfigSummaryResult`로 갱신되었으나 `carouselSummary`만 여전히 `| null` 유지. 실제로 null을 반환하는 경로는 없음
  - 제안: 반환 타입을 `ConfigSummaryResult`로 통일

- **[INFO]** `text_classifier` — `llmConfigId` 단독 설정 케이스 테스트 누락
  - 위치: `node-config-summary.test.ts` — `text_classifier summary` 섹션
  - 상세: `ai_agent`와 `information_extractor`는 모두 `llmConfigId` 단독 케이스 테스트가 있으나 `text_classifier`는 없음. `{ llmConfigId: "cfg-1", categories: [{ name: "a" }] }` 입력 시 카테고리 수만 표시하는지 검증이 빠져 있음
  - 제안: `information_extractor`의 `"accepts llmConfigId alone when model override is empty"` 패턴 동일하게 추가

---

### 요약

기능 완전성 측면에서 이번 변경은 요구사항 ED-ND-10을 충실히 충족한다. spec에 정의된 25개 노드 유형의 모든 경고 메시지가 구현체(`node-config-summary.ts`)와 테스트(`node-config-summary.test.ts`, `custom-node.test.tsx`)에 빠짐없이 반영되어 있으며, Merge·Chart·Text Classifier·Information Extractor의 복합 경고 분기도 정확히 처리된다. PRD와 spec 문서도 구현에 맞게 갱신되어 문서-코드 정합성이 유지된다. 다만 `WARNING` 상수와 null 분기가 dead code로 남아 있고 `carouselSummary` 반환 타입이 다른 formatter와 다른 것은 코드 품질상 불필요한 혼선을 유발할 수 있다.

### 위험도

**LOW**