### 발견사항

---

**[WARNING] `TooltipProvider` 암묵적 의존성 — 숨겨진 컴포넌트 계약**
- 위치: `custom-node.tsx:9` (import), `workflow-canvas.tsx:368,544`
- 상세: `CustomNode`는 `Tooltip`을 내부적으로 사용하지만 `TooltipProvider`는 부모 컴포넌트인 `WorkflowCanvas`에 위임되어 있습니다. 이는 암묵적 컨텍스트 계약으로, `CustomNode`를 `WorkflowCanvas` 외부에서 렌더링하면 Tooltip이 조용히 실패합니다. 테스트 파일이 Tooltip 전체를 Mock 처리하여 이 결합이 테스트에서 검증되지 않는 점도 문제입니다.
- 제안: `CustomNode` 내부에 `TooltipProvider`를 포함시키거나(성능 비용 미미), 컴포넌트 Props 타입 레벨에서 문서화하여 소비자가 명시적으로 인지하도록 강제하세요.

---

**[WARNING] 노드 설정 유효성 로직과 노드 정의의 분리 — 이중 소스**
- 위치: `node-config-summary.ts` 전체 (특히 `httpRequestSummary`, `aiAgentSummary` 등)
- 상세: 각 formatter는 노드가 "설정된 상태"인지의 기준(예: `http_request`는 `url` 필수, `ai_agent`는 `model` 필수)을 암묵적으로 정의합니다. 이 비즈니스 로직은 `node-definitions`와 완전히 별개로 존재하여 두 곳이 동기화되지 않으면 drift가 발생합니다.
- 제안: 노드 정의에 `requiredFields` 또는 `validate(config)` 함수를 추가하고 `getConfigSummary`가 이를 참조하도록 합니다. 이렇게 하면 노드 정의가 자신의 유효성 기준을 소유하게 됩니다.

---

**[INFO] `manual_trigger` 명시적 가드 — 중복 방어**
- 위치: `node-config-summary.ts:getConfigSummary` 첫 번째 조건
- 상세: `manual_trigger`가 `FORMATTERS`에 없으므로 `if (!formatter) return null;`이 동일하게 처리합니다. 명시적 가드가 의도를 표현하려 하지만 코드 상 중복이 됩니다.
- 제안: 의도를 명확히 하려면 `NO_SUMMARY_NODES = new Set(["manual_trigger"])` 같은 명시적 집합으로 분리하거나, 단순히 레지스트리 방어로 통합하고 주석으로 의도 기록.

---

**[INFO] `LANG_DISPLAY` 맵을 함수 내부에 정의 — 매 호출마다 재생성**
- 위치: `node-config-summary.ts:codeSummary` 내부
- 상세: `const LANG_DISPLAY: Record<string, string> = { javascript: "JavaScript" }`가 함수 본문 안에 있어 매번 객체가 새로 생성됩니다. 현재 엔트리가 1개뿐이지만 언어 지원이 늘어날수록 낭비가 커집니다.
- 제안: 모듈 스코프 상수로 이동.

---

**[INFO] 평탄한 단일 파일 formatter 구조 — 확장성 한계**
- 위치: `node-config-summary.ts` 전체 (25개 formatter)
- 상세: 현재 25개 노드 타입의 formatter가 단일 파일에 선형적으로 나열되어 있습니다. 노드 타입이 증가할수록 파일 크기와 탐색 비용이 선형적으로 증가합니다. OCP 원칙상 레지스트리 패턴 자체는 우수하나, 파일 수준의 모듈 경계가 없습니다.
- 제안: 도메인별(logic, integration, ui, ai)로 formatter 파일을 분리하고, `node-config-summary.ts`는 레지스트리 조립과 공개 API만 담당하도록 재구성.

---

**[INFO] `tableSummary` pagination 기본값 불일치 가능성**
- 위치: `node-config-summary.ts:tableSummary`
- 상세: `if (pagination === false)`를 사용하므로 `pagination: undefined`(미설정 상태)도 "pagination" 포함 텍스트를 출력합니다. 노드의 실제 기본값이 pagination 없음이라면 요약이 실제 동작을 잘못 표현하게 됩니다.
- 제안: 노드 정의의 기본값과 일치시키거나, `if (!pagination)`으로 변경.

---

### 요약

전반적인 아키텍처는 견고합니다. `node-config-summary.ts`의 레지스트리 패턴은 OCP를 잘 준수하며 확장이 용이합니다. 핵심 우려 사항은 두 가지입니다: `CustomNode`가 `TooltipProvider` 컨텍스트를 암묵적으로 요구하는 숨겨진 계약(재사용 시 무음 실패 위험), 그리고 노드 설정 유효성 기준이 `node-definitions`와 `node-config-summary` 두 곳에 분산된 이중 소스 문제입니다. 나머지 이슈들은 코드 유지보수성과 관련된 개선 사항 수준입니다.

### 위험도

**LOW**