## 문서화 코드 리뷰

### 발견사항

---

- **[WARNING]** `WARNING` 상수가 사실상 도달 불가능한 코드(dead code)이나 삭제되지 않고 잔존
  - 위치: `node-config-summary.ts:33`
  - 상세: 모든 포매터 함수가 `null` 대신 `warning(detail)` 를 반환하도록 변경됐으나, `const WARNING = Object.freeze(...)` 와 `getConfigSummary` 내부의 `if (!result) return { ...WARNING }` 폴백이 그대로 남아 있음. 등록된 노드 타입 중 `carouselSummary` 만 반환 타입이 `| null`로 선언되어 있고 실제로는 null을 반환하지 않으므로, 이 폴백이 실행되는 상황은 현재 코드베이스에서 발생하지 않음. 새로운 기여자가 읽을 때 "왜 generic `⚠ Not configured` 가 존재하는가"에 대한 혼란을 야기할 수 있음.
  - 제안: `WARNING` 상수 및 `if (!result)` 폴백에 아래와 같은 주석 추가, 또는 `carouselSummary` 타입을 `ConfigSummaryResult`로 좁히고 두 코드를 제거
    ```ts
    // Legacy safety-net: formatters that still declare `| null` in their return type
    // will fall through here. All registered formatters should return a specific warning
    // via warning() rather than null.
    if (!result) return { ...WARNING };
    ```

---

- **[INFO]** 신규 `warning()` 헬퍼에 인라인 문서 없음
  - 위치: `node-config-summary.ts:35–37`
  - 상세: `WARNING` 상수에서 `warning(detail)` 팩토리 함수로 교체하는 것이 이번 변경의 핵심인데, 함수 자체에 의도를 설명하는 주석이 없음.
  - 제안:
    ```ts
    /** Returns a warning ConfigSummaryResult with a human-readable detail string (e.g. "URL not set"). */
    function warning(detail: string): ConfigSummaryResult {
    ```

---

- **[INFO]** `getConfigSummary` JSDoc가 변경된 동작을 반영하지 않음
  - 위치: `node-config-summary.ts` 하단 export 함수
  - 상세: 현재 JSDoc은 `"or null if no summary applies (e.g. manual_trigger)"` 만 언급. 이번 변경으로 등록된 노드가 미설정 상태일 때 `null` 이 아니라 구체적인 경고 결과를 반환하도록 의미가 달라졌음.
  - 제안:
    ```ts
    /**
     * Returns a config summary for the given node type.
     * - Returns `null` for manual_trigger and unknown node types.
     * - Returns a specific `isWarning: true` result (e.g. "⚠ URL not set") when
     *   required fields are missing on a registered node type.
     * - Returns a normal summary when the config is sufficiently populated.
     */
    ```

---

- **[INFO]** `carouselSummary` 반환 타입 선언이 다른 포매터와 일관성 없음
  - 위치: `node-config-summary.ts` `carouselSummary` 함수
  - 상세: 다른 모든 포매터가 `ConfigSummaryResult`(non-nullable)로 업데이트됐으나, `carouselSummary` 만 `ConfigSummaryResult | null` 타입을 유지. 함수 본문에서 실제로 `null`을 반환하는 경로는 존재하지 않음. 타입과 실제 동작의 불일치가 문서화 혼란을 초래함.
  - 제안: 반환 타입을 `ConfigSummaryResult`로 좁히거나, 의도적으로 `null` 반환 가능성을 보존하는 경우 그 이유를 주석으로 명시

---

- **[INFO]** 테스트 헬퍼 `warningOf` 함수에 용도 설명 없음
  - 위치: `node-config-summary.test.ts:4–6`
  - 상세: `NOT_CONFIGURED` 상수에서 `warningOf(detail)` 팩토리로의 전환은 테스트 가독성을 높이는 좋은 변경이나, 함수 의도를 설명하는 짧은 주석이 있으면 처음 보는 기여자가 파악하는 데 도움이 됨. 테스트 코드이므로 낮은 우선순위.
  - 제안: `// Test factory: builds the expected warning result shape for a given detail string.` 한 줄 추가

---

- **[INFO]** PRD·Spec 문서 업데이트는 구현과 정합성이 잘 유지됨 (긍정 평가)
  - `prd/2-workflow-editor.md`에 `ED-ND-10` 요구사항이 추가됐고, `spec/3-workflow-editor/0-canvas.md` 에 노드별 경고 메시지 전체 표가 신설됨. 구현(`node-config-summary.ts`)의 모든 경고 문구, 누락 조건이 문서와 1:1 대응하여 추적 가능성이 높음.

---

### 요약

이번 변경은 generic `"⚠ Not configured"` 에서 노드별 구체적 경고 메시지로 전환한 작업으로, PRD와 Spec이 구현과 잘 동기화되어 있어 문서화 완성도가 높다. 다만 기존 `WARNING` 상수와 폴백 분기가 삭제되지 않고 잔존하여 코드를 읽는 사람에게 "왜 두 가지 경고 메커니즘이 공존하는가"에 대한 혼란을 줄 수 있고, 신규 `warning()` 헬퍼와 `getConfigSummary` JSDoc이 변경된 동작 의미를 반영하지 못하고 있다. `carouselSummary` 의 반환 타입 선언과 실제 동작 불일치도 미세한 문서화 부채로 남는다.

### 위험도

**LOW**