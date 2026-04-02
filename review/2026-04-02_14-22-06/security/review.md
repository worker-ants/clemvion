## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] localStorage에 저장된 값의 입력 검증 미흡**
- 위치: `run-results-drawer.tsx` - `getStoredHeight()` 함수
- 상세: localStorage에서 읽은 값을 `Number()` 변환 후 `MIN_HEIGHT` 이상인지만 확인하고, 상한 검증이 없음. 공격자가 직접 localStorage를 조작하여 비정상적으로 큰 값(예: `Infinity`, `Number.MAX_SAFE_INTEGER`)을 주입할 경우 `panelHeight` 상태로 유입될 수 있음.
- 제안:
  ```ts
  if (!Number.isNaN(parsed) && parsed >= MIN_HEIGHT && parsed <= window.innerHeight * MAX_HEIGHT_RATIO) return parsed;
  ```

---

**[WARNING] `dangerouslySetInnerHTML` 사용 — DOMPurify 적용 범위 확인 필요**
- 위치: `presentation-renderers.tsx` - `ChartContent`, `TemplateContent`
- 상세: 서버에서 내려오는 `outputData.rendered` 필드를 DOMPurify로 sanitize한 뒤 `dangerouslySetInnerHTML`로 렌더링함. 현재 구조는 적절하나, 이 변경으로 `outputData` 전체가 WebSocket 이벤트의 `output` 필드에서 직접 넘어오게 됨 (이전에는 presentation 노드만 필터링). **이제 모든 노드의 `outputData`가 저장소에 들어오므로** non-presentation 노드의 output이 Chart/Template 렌더러로 진입하는 경로가 `nodeType` 기반으로 차단되는지 확인 필요. `result-detail.tsx`의 `PRESENTATION_TYPES` 세트로 분기하므로 현재는 안전하나, 향후 렌더러 추가 시 취약해질 수 있음.
- 제안: `ChartContent`, `TemplateContent` 내부에 `typeof rendered === "string"` 체크가 이미 있으나, DOMPurify 설정에서 허용 태그를 명시적으로 제한하는 것을 권장:
  ```ts
  DOMPurify.sanitize(html, { ALLOWED_TAGS: [...], ALLOWED_ATTR: [...] })
  ```

---

**[WARNING] WebSocket 이벤트 페이로드의 타입 캐스팅 — 입력 검증 없음**
- 위치: `use-execution-events.ts` - `handleNodeStarted`, `handleNodeCompleted`, `handleNodeFailed`, `handleNodeSkipped`
- 상세: WebSocket으로 수신된 데이터를 `data as { nodeId?: string; nodeType?: string; ... }`로 단순 타입 캐스팅 후 사용. `nodeType`이 매우 긴 문자열이거나, `nodeLabel`에 제어 문자가 포함되더라도 검증 없이 저장소에 저장됨. 렌더링 시 React가 자동 이스케이프하므로 XSS 위험은 낮으나, `nodeCategory`가 `getNodeDefinition()`의 lookup key로 사용되므로 prototype pollution 가능성 검토 필요.
- 제안:
  ```ts
  const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : undefined;
  const nodeType = typeof payload.nodeType === "string" ? payload.nodeType.slice(0, 64) : "unknown";
  const nodeLabel = typeof payload.nodeLabel === "string" ? payload.nodeLabel.slice(0, 256) : nodeId ?? "unknown";
  ```

---

**[WARNING] `getCategoryForType`에서 임의 문자열이 `CATEGORY_COLORS` 키로 사용**
- 위치: `use-execution-events.ts` → `result-detail.tsx`, `result-timeline.tsx` - `CATEGORY_COLORS[result.nodeCategory]`
- 상세: `getNodeDefinition(nodeType)?.category ?? "unknown"`에서 반환된 값이 `CATEGORY_COLORS` 객체의 키로 직접 사용됨. `getNodeDefinition`이 임의 `nodeType`을 받을 경우 `__proto__`, `constructor` 등이 키로 사용될 수 있으나, 실제로는 색상 문자열 fallback(`?? "#6B7280"`)이 있어 위험도는 낮음.
- 제안: `CATEGORY_COLORS`를 `Object.create(null)`로 생성하거나 `Object.hasOwn()` 체크 추가:
  ```ts
  const categoryColor = Object.hasOwn(CATEGORY_COLORS, result.nodeCategory)
    ? CATEGORY_COLORS[result.nodeCategory]
    : "#6B7280";
  ```

---

**[INFO] 백엔드: `nodeLabel` 정보가 WebSocket 이벤트에 노출**
- 위치: `execution-engine.service.ts` - `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED` 이벤트
- 상세: 이번 변경으로 `nodeType`, `nodeLabel`이 WebSocket 이벤트에 추가됨. 사용자가 인가된 워크플로우 실행의 이벤트를 구독하는 것이므로 원칙적으로 안전하나, WebSocket 채널 구독 시 실행 소유자 검증이 올바르게 수행되는지 확인 필요 (해당 코드는 이번 변경 범위 밖).
- 제안: WebSocket 게이트웨이에서 `execution:${executionId}` 채널 구독 시 요청자가 해당 execution의 소유자임을 검증하는 로직 존재 여부를 별도 확인.

---

**[INFO] `executions.service.ts`: `relations: ['node']` 추가로 데이터 노출 범위 확대**
- 위치: `executions.service.ts` - `findById()`
- 상세: `NodeExecution`에 `node` relation이 포함되어 API 응답에 노드 메타데이터(`type`, `label`)가 추가됨. 현재 API 응답 DTO에서 직렬화 범위가 명시되지 않은 경우 노드의 다른 민감 필드(노드 설정값 등)가 함께 노출될 수 있음.
- 제안: `node` relation에서 선택적으로 필요한 컬럼만 select하거나 응답 DTO에서 명시적으로 필드를 제한:
  ```ts
  select: { node: { id: true, type: true, label: true } }
  ```

---

**[INFO] `PdfContent`의 외부 URL 링크**
- 위치: `presentation-renderers.tsx` - `PdfContent`
- 상세: `isHttpUrl()` 검증으로 `javascript:` 프로토콜은 차단됨. `rel="noreferrer"`로 referrer 노출도 방지됨. 현재는 적절히 처리됨.

---

### 요약

이번 변경의 핵심은 Run Results 드로어를 presentation-only에서 all-node timeline으로 전환한 것으로, 보안 측면에서 큰 취약점은 발견되지 않았다. 주요 리스크는 WebSocket에서 수신한 `nodeType`, `nodeLabel` 등 외부 입력에 대한 길이/형식 검증이 부재하다는 점과, localStorage 값의 상한 검증 누락이다. DOMPurify를 통한 HTML sanitize는 유지되어 XSS 위험은 통제되고 있으나, 허용 태그를 명시적으로 제한하면 방어 깊이가 개선된다. 백엔드에서 `node` relation을 추가로 join할 때 응답에 포함되는 노드 데이터 범위를 DTO로 명시적으로 제한하는 것도 권장된다.

### 위험도

**LOW**