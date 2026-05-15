## 성능 코드 리뷰 결과

### 발견사항

- **[INFO]** `WARNING` 상수 — 사용되지 않는 데드 코드
  - 위치: `node-config-summary.ts:36` — `const WARNING = Object.freeze<ConfigSummaryResult>(...)`
  - 상세: 모든 포매터 함수가 이제 `null` 대신 항상 `ConfigSummaryResult`를 반환하도록 변경되었으므로, `getConfigSummary` 내부의 `if (!result) return { ...WARNING }` 분기는 영원히 실행되지 않는 데드 코드가 되었습니다. freeze된 객체가 메모리를 점유하고, `{ ...WARNING }` 스프레드 복사도 호출될 수 없습니다.
  - 제안: `WARNING` 상수 및 `getConfigSummary`의 해당 fallback 분기를 제거하세요.

- **[INFO]** `warning()` 함수 — 호출마다 새 객체 할당
  - 위치: `node-config-summary.ts` — `warning()` 함수 및 각 포매터의 경고 반환 경로
  - 상세: 기존에는 단일 frozen 객체(`WARNING`)를 재사용하여 추가 힙 할당이 없었습니다. 변경 후에는 `warning(detail)` 호출마다 새 객체와 템플릿 리터럴 문자열이 생성됩니다. 캔버스에 미설정 노드가 다수 존재하고 리렌더링이 빈번한 경우 GC 부담이 소폭 증가합니다. 각 포매터의 경고 메시지는 런타임에 바뀌지 않으므로 모듈 레벨에서 사전 계산이 가능합니다.
  - 제안: 아래처럼 모듈 초기화 시 경고 객체를 1회만 생성하도록 캐싱하세요.
    ```typescript
    // 모듈 상단에 캐싱
    const W = {
      conditionNotSet: warning("Condition not set"),
      countNotSet: warning("Count not set"),
      urlNotSet: warning("URL not set"),
      // ...
    } as const;

    // 포매터 내부
    function loopSummary(config: NodeConfig): ConfigSummaryResult {
      if (!count) return W.countNotSet;  // 재사용
      ...
    }
    ```

- **[INFO]** 테스트의 정규식 사용 — `/^⚠/`
  - 위치: `custom-node.test.tsx:123, 147, 179`
  - 상세: 정확한 문자열 비교 `"\u26a0 Not configured"`에서 정규식 `/^⚠/`로 변경되었습니다. 정규식은 문자열 동등 비교보다 약간 비용이 높으나, 테스트 환경에서는 실질적 영향이 없습니다. 단, 이 패턴은 임의의 경고 텍스트 모두에 매칭되므로, 특정 경고 메시지를 검증하려는 의도라면 정밀도가 낮아지는 트레이드오프가 있습니다.
  - 제안: 테스트 성능 자체는 무시할 수준입니다. 다만 경고 텍스트 전체를 검증하고 싶다면 `/^⚠ Count not set$/` 같은 구체적 정규식이나 정확한 문자열을 사용하는 것이 회귀 감지에 더 효과적입니다.

---

### 요약

이번 변경은 성능보다 UX 품질(구체적 경고 메시지) 개선에 초점을 둔 리팩터링으로, 전반적인 성능 영향은 매우 낮습니다. 가장 주목할 점은 **`WARNING` 상수와 `getConfigSummary`의 null-check 분기가 이제 완전히 도달 불가능한 데드 코드**가 되었다는 것입니다. 함께 제거해야 코드가 일관성을 유지합니다. `warning()` 함수의 매 호출마다 객체가 새로 생성되는 부분은, 반환 메시지가 정적이므로 모듈 레벨 상수로 캐싱하면 렌더마다 발생하는 미세한 GC 부담을 원천적으로 없앨 수 있습니다.

### 위험도

**LOW**