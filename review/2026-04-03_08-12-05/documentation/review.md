### 발견사항

- **[INFO]** `getConfigSummary` 공개 함수에 JSDoc 없음
  - 위치: `node-config-summary.ts` — `getConfigSummary` 함수
  - 상세: 매개변수, 반환값, `null` vs `WARNING` 반환 구분에 대한 설명이 없음. 특히 `null`(요약 없음)과 `WARNING`(미설정 경고)의 의미 차이가 호출자에게 불명확함
  - 제안:
    ```ts
    /**
     * Returns a display summary for a node's current config.
     * - Returns `null` if the node type has no summary (e.g. manual_trigger, unknown types).
     * - Returns `{ isWarning: true }` if the node type supports summaries but required fields are missing.
     */
    ```

- **[INFO]** `truncateSummary` 공개 함수에 JSDoc 없음
  - 위치: `node-config-summary.ts` — `truncateSummary` 함수
  - 상세: `maxLen` 기본값 40의 근거(노드 너비 180px 기준)와 반환 객체의 `isTruncated` 필드 용도가 문서화되지 않음
  - 제안: `@param maxLen` 기본값 선택 이유와 `isTruncated`가 툴팁 표시 여부 결정에 사용됨을 명시

- **[INFO]** 줌 임계값 매직 넘버 설명 없음
  - 위치: `custom-node.tsx:35` — `s.transform[2] >= 0.5`
  - 상세: `0.5`가 50% 줌을 의미한다는 것이 코드만으로는 즉시 파악하기 어려움. `transform[2]`가 줌 스케일임도 자명하지 않음
  - 제안:
    ```ts
    // transform[2] is the zoom scale; hide summary below 50% zoom to avoid clutter
    const showSummary = useStore((s) => s.transform[2] >= 0.5);
    ```

- **[INFO]** `LANG_DISPLAY` 매핑 불완전성 문서화 없음
  - 위치: `node-config-summary.ts` — `codeSummary` 함수 내 `LANG_DISPLAY`
  - 상세: `javascript`만 매핑되고 나머지는 `charAt(0).toUpperCase()` 폴백으로 처리. 이 의도적 설계(점진적 확장)가 문서화되지 않아 버그처럼 보일 수 있음
  - 제안: 간단한 인라인 주석 추가: `// Extend as needed; unlisted languages are title-cased automatically`

- **[INFO]** `ConfigSummaryResult` 타입 필드 문서화 없음
  - 위치: `node-config-summary.ts:3-6`
  - 상세: `isWarning` 플래그가 UI에서 어떻게 사용되는지(amber 색상 표시, 컨테이너 노드 배치 결정) 타입 정의에 명시되지 않음
  - 제안: JSDoc 주석으로 `isWarning`의 렌더링 의미 설명

- **[INFO]** `tooltip.tsx` 신규 파일에 모듈 설명 없음
  - 위치: `tooltip.tsx` 상단
  - 상세: Radix UI `@radix-ui/react-tooltip`을 래핑한 컴포넌트임을 나타내는 출처 주석 없음. shadcn/ui 기반 프로젝트에서는 관례적으로 출처를 명시함
  - 제안: 파일 상단에 `// Radix UI tooltip wrapper — see https://www.radix-ui.com/docs/primitives/components/tooltip` 추가

- **[INFO]** `TooltipProvider` `delayDuration` 근거 없음
  - 위치: `workflow-canvas.tsx:368` — `<TooltipProvider delayDuration={300}>`
  - 상세: 300ms 선택 이유가 없음. 노드 드래그 중 의도치 않은 툴팁 표시 방지 목적이라면 주석으로 명확히 할 것
  - 제안: `{/* 300ms delay prevents tooltip flicker during node drag */}` 추가

---

### 요약

이번 변경은 노드 설정 요약 표시 기능을 추가하는 잘 구조화된 코드로, 테스트 커버리지도 충실하다. 문서화 관점에서는 치명적인 문제는 없으나, `getConfigSummary`/`truncateSummary` 등 공개 API 함수에 JSDoc이 전혀 없어 `null`과 `WARNING` 반환값의 의미 차이를 외부에서 파악하기 어렵고, 줌 임계값(`0.5`)과 `LANG_DISPLAY` 불완전 매핑처럼 의도적 설계 결정이 주석 없이 남겨져 있어 향후 유지보수 시 혼란을 야기할 수 있다. 모두 INFO 수준이며 기능 동작에는 영향이 없다.

### 위험도
**LOW**