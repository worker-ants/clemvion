## 보안 코드 리뷰 결과

### 발견사항

- **[INFO]** `rawOut?.messages != null` 조건이 `isCompletedConversation` 판별 로직에 포함됨
  - 위치: `result-detail.tsx`, `isCompletedConversation` 조건식
  - 상세: `rawOut?.messages != null` 조건은 최상위 `outputData`에 `messages` 필드가 있으면 무조건 `isCompletedConversation`으로 처리합니다. 이는 `config`/`output` 래핑 구조와 무관하게 작동하므로, 임의의 노드 출력에 `messages` 키가 포함된 경우 의도치 않게 대화 인스펙터가 렌더링될 수 있습니다. 공격자가 HTTP 응답 등 외부 데이터를 통해 `messages` 필드를 주입할 수 있는 경우, 실제 대화 UI가 비정상 데이터를 렌더링하게 됩니다.
  - 제안: `rawOut?.messages != null` 조건을 제거하고, `innerMeta?.interactionType === "ai_conversation"` 조건만으로 판별하도록 단순화하세요. 판별 기준을 명시적 타입 필드로 통일하면 의도치 않은 렌더링을 방지할 수 있습니다.

- **[INFO]** `isLiveNode` 조건에서 `nodeType` 검사 제거
  - 위치: `result-timeline.tsx`, `isLiveNode` 계산 (`result.status === "waiting_for_input"` 단독 사용)
  - 상세: 기존 코드는 `result.nodeType === "ai_agent"`를 함께 검사했으나, 변경 후에는 `waiting_for_input` 상태인 모든 노드가 `isLiveNode`로 처리됩니다. 폼 입력 대기 중인 일반 노드(form, carousel 등)가 대화형 노드처럼 렌더링될 수 있습니다. 보안 위협보다는 로직 오류에 가깝지만, 잘못된 컨텍스트에서 `conversationMessages`가 렌더링되는 정보 노출 리스크가 있습니다.
  - 제안: `isLiveNode` 조건에 노드 타입 또는 `isMultiTurn` 여부를 함께 검사하도록 보완하세요: `ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurn`.

- **[INFO]** 테스트 데이터에 실제 모델명 하드코딩
  - 위치: `result-detail.test.tsx` L282, L303 (`"model": "gpt-4"`)
  - 상세: 보안 취약점은 아니나, 테스트 픽스처에 외부 서비스명이 노출됩니다. 실제 운영 환경에서 어떤 AI 모델을 사용하는지 코드베이스 외부로 유출될 수 있는 정보입니다.
  - 제안: `"model": "test-model"` 등 중립적인 값으로 대체하세요.

- **[INFO]** `as Record<string, unknown>` 타입 캐스팅 다수 사용
  - 위치: `result-detail.tsx` L322–L343, `result-timeline.tsx` L67–L75
  - 상세: 런타임 검증 없이 `as` 캐스팅을 반복 사용하므로, 서버로부터 예상치 못한 타입의 데이터가 수신될 경우 런타임 오류 또는 의도치 않은 렌더링이 발생할 수 있습니다. 현재는 `?.` 옵셔널 체이닝으로 크래시를 방지하고 있으나, 데이터 신뢰 경계가 명확하지 않습니다.
  - 제안: Zod 등의 런타임 검증 라이브러리를 통해 `outputData`의 구조를 검증하거나, 파싱 유틸리티(`output-shape.ts`의 `unwrapNodeOutput` 등)를 일관되게 사용하세요.

---

### 요약

이번 변경사항은 `information_extractor` 노드 타입 지원 확장을 위한 UI 로직 수정으로, 심각한 보안 취약점은 발견되지 않았습니다. 다만 `isCompletedConversation` 판별 로직에서 `rawOut?.messages != null` 조건이 과도하게 넓어 외부 데이터의 `messages` 필드만으로 대화 UI가 트리거될 수 있는 점, `isLiveNode` 조건에서 노드 타입 검사가 제거되어 의도치 않은 노드가 대화 모드로 렌더링될 수 있는 점은 향후 데이터 신뢰 경계 강화 측면에서 보완이 권장됩니다. 전반적으로 XSS, 인젝션, 인증 우회 등의 직접적인 보안 위협은 없으며, 코드 품질과 로직 견고성 관점의 개선이 주요 과제입니다.

---

### 위험도

**LOW**