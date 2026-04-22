### 발견사항

- **[INFO]** `renderNodeCatalog` 함수 추출
  - 위치: `system-prompt.ts`, 기존 `buildSystemPrompt` 내 인라인 코드 → 별도 함수
  - 상세: 카탈로그 렌더링 로직을 독립 함수로 뽑아낸 것은 5블록 재구조 자체에는 불필요한 리팩토링. 그러나 코드 가독성은 개선됨.
  - 제안: 허용 가능. 다만 이 추출이 `renderActivePlanSection`과 동일한 패턴을 맞춘 것이라면 의도 범위 내로 볼 수 있음.

- **[INFO]** `renderNodeCatalog` 내 설명 주석 삭제
  - 위치: `system-prompt.ts`, `renderNodeCatalog` 함수 (기존 `isDynamicPorts` 동작 설명 주석 3줄)
  - 상세: "isDynamicPorts 노드는 실제 출력 포트가 런타임 config에 의해 확장되므로 ... 마커를 붙여" 주석이 삭제됨. 함수 이름과 함수 상단 JSDoc으로 의미를 이전했으나, 기존 주석은 동작 이유(WHY)를 담고 있어 유지 가치가 있었음.
  - 제안: 허용 가능. 함수 레벨 JSDoc이 동등한 설명을 제공함.

- **[INFO]** `renderActivePlanSection` 내 미세 문구 정리
  - 위치: `system-prompt.ts`, RULES 항목 2, 3, 4, 6번
  - 상세: "skipped or lost" → "skipped", "or cannot be executed as written" 뒤 "etc." 삭제 등 의미 동일한 약어화. 5블록 재구조 목표와 직접적 연관은 없으나 해당 파일 전체를 손보면서 자연스럽게 포함된 것으로 보임.
  - 제안: 허용 가능. 의미 변경 없음.

- **[INFO]** `renderExpressionReferenceSection` → `getExpressionReferenceSection` 함수명 변경
  - 위치: `system-prompt.ts`
  - 상세: 캐싱 도입으로 "render"가 아닌 "get" 의미가 맞아 변경함. 범위 내 변경이며 정확한 명명.
  - 제안: 적절.

- **[INFO]** "Inspecting the current canvas" 예시 삭제
  - 위치: `system-prompt.ts`, 기존 예시 섹션 (6개 → 3개로 축소)
  - 상세: 스냅샷 JSON을 직접 읽는 방법을 설명하던 예시가 제거됨. memory 문서에 "예시 3개로 축소"가 명시되어 있어 의도된 변경. 그러나 이 예시는 "DO NOT call any tool for read-only questions"라는 핵심 행동을 가장 직접적으로 설명하던 것.
  - 제안: 허용 가능. 해당 지시문이 스냅샷 섹션 설명에 인라인으로 흡수되어 있음.

- **[INFO]** plan-only turn에서 `get_current_workflow` 등 explore 도구 금지 규칙 약화
  - 위치: `system-prompt.ts`, 기존 "plan-only turn" 불릿 → 새 turn 결정표 "Further tools this turn?" 열
  - 상세: 기존 코드는 "do NOT call `get_current_workflow` or other explore tools after `propose_plan`"을 명시적으로 서술했으나, 새 결정표는 "none — all edits return `PLAN_AWAITING_APPROVAL` and retrying loops"로만 표현. explore 도구 금지가 암시적이 됨. LLM이 plan-only 턴에 `list_integrations` 등을 여전히 호출할 여지가 생김.
  - 제안: 결정표 "Further tools this turn?" 셀을 "none (edits blocked; explore tools also waste tokens)"처럼 명시하면 더 안전함. 현재도 기능적으로 심각한 문제는 아니나 의도 손실 가능성 있음.

---

### 요약

변경 범위는 전반적으로 의도된 5블록 재구조화 목표에 잘 부합한다. 추가된 `renderNodeCatalog` 추출과 미세 문구 정리는 엄밀히는 범위 밖이지만 해당 파일 전체를 손보는 과정에서 자연스럽게 포함된 수준이며 기능 변경이 없다. 유일하게 주의할 점은 plan-only 턴에서 explore 도구 금지 규칙이 결정표 형식으로 옮기면서 명시성이 약해진 부분으로, 런타임 오동작으로 이어질 가능성은 낮지만 명확화를 권장한다. 테스트(`5-block structural layout`) 추가는 새 구조를 구조적으로 고정하는 정확한 접근이다.

### 위험도

LOW