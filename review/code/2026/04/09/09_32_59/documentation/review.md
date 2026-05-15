### 발견사항

---

**[WARNING]** `buttonConfig.buttonItemMap` 구조가 미정의
- 위치: `spec/4-nodes/6-presentation-nodes.md` — 실행 로직 §1.3 6-2항
- 상세: `아이템 버튼 ID → 아이템 인덱스 매핑을 buttonConfig.buttonItemMap에 저장`으로 언급되지만, 해당 필드의 타입·형식(`Record<string, number>` 등)이 어디에도 정의되어 있지 않음. 출력 형식 예시에도 포함되어 있지 않아 구현자가 스키마를 추정해야 함
- 제안: ButtonConfig 구조체에 `buttonItemMap` 필드를 추가 정의하거나, 출력 형식 예시에 해당 필드를 포함

---

**[WARNING]** `source` 필드의 필수/선택 여부 불일치
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Config 테이블 L16과 실행 로직 §1.3
- 상세: Config 테이블에서 `source`의 필수 여부가 "dynamic 모드 시 ✓"(필수)로 표시되어 있으나, 실행 로직 §1.3 3-1항에서는 "미설정 시 입력 데이터를 직접 사용 (하위호환)"으로 선택 처리. 테이블과 로직이 모순됨
- 제안: 하위호환을 위해 선택 항목(`✗`)으로 수정하거나, 신규 워크플로우에서는 필수임을 명시하는 마이그레이션 가이드 추가

---

**[WARNING]** Static 모드 `ItemDef.buttons`와 dynamic 모드 `itemButtons`의 관계 불명확
- 위치: `spec/4-nodes/6-presentation-nodes.md` — ItemDef 테이블 vs Config 테이블
- 상세: `ItemDef.buttons`는 Static 모드 아이템별 버튼, `itemButtons`는 Dynamic 모드 전용 공통 버튼인데, 포트 정의 테이블에서 "Item Button Port (Static): 각 아이템의 port 타입 버튼마다 개별 포트"로만 기술. 두 버튼 유형이 공존할 때의 포트 수·라우팅 우선순위가 문서화되지 않음
- 제안: 글로벌 `buttons` / Static `ItemDef.buttons` / Dynamic `itemButtons` 세 유형을 비교하는 요약 표 추가

---

**[INFO]** `NodeExecution.error` 형식이 불완전하게 기술됨
- 위치: `spec/5-system/3-error-handling.md` — §3.1 Skip Node 분기
- 상세: `NodeExecution.error = { message: "..." }`로 추가되었으나, §3.2에서 정의된 에러 포트 데이터 구조(`code`, `nodeId`, `timestamp` 등 다수 필드 포함)와 형식이 다름. 참조 없이 단독 기술되어 구현자가 어느 형식을 사용해야 할지 모호
- 제안: 기존 에러 구조(`§3.2` 또는 `§2.2`)를 참조하는 링크 추가: `→ NodeExecution.error = 에러 객체 보존 (형식은 §2.2 참조)`

---

**[INFO]** `_selectedPort` 스트리핑 시점이 불명확
- 위치: `spec/5-system/4-execution-engine.md` — §2.1 추가 섹션
- 상세: "`_selectedPort`는 다운스트림 노드의 input으로 전달될 때 자동으로 제거된다"고 기술되어 있으나, 어느 레이어(Worker, gatherNodeInput, ExpressionResolver 등)에서 제거하는지 명시되지 않음. §5.4 Worker 실행 흐름과의 관계가 불분명
- 제안: §5.4 Worker 실행 흐름에 해당 스트리핑 단계를 명시적으로 추가 (예: "5.5 `_selectedPort` 제거 후 다음 노드 입력 전달")

---

**[INFO]** 실행 내역 스펙과 구현 간 `waiting_for_input` 필터 불일치가 문서에 미반영
- 위치: `spec/2-navigation/14-execution-history.md` — §2.3 필터 테이블
- 상세: 스펙에 `Waiting` 필터가 정의되어 있으나, requirement 리뷰에서 해당 필터 버튼이 구현에 누락된 것으로 확인됨. 스펙 자체에 "구현 확인 필요" 또는 TODO 표시가 없어 신규 개발자가 구현 완료로 오해할 수 있음
- 제안: 구현 누락 사항은 RESOLUTION.md에 조치 기록 후 스펙과의 동기화 확인 필요

---

**[INFO]** `execution-history.md` 3.5절의 API Error 상태가 구현에 미반영
- 위치: `spec/2-navigation/14-execution-history.md` — §3.5
- 상세: 스펙에 "API Error → 'Failed to load execution. Please try again.' + Back 버튼" 처리가 정의되어 있으나, requirement 리뷰에서 `executionQuery.isError` 처리가 구현에 없다고 확인됨. 스펙이 구현보다 앞서 있어 문서 신뢰성 저하
- 제안: RESOLUTION.md에 미구현 사항으로 기록

---

### 요약

Spec 문서들은 전반적으로 구조화가 잘 되어 있고, 새로 추가된 `14-execution-history.md`는 API 응답 형식·UI 모형·라우팅까지 포함한 충실한 문서다. 주요 문서화 이슈는 `presentation-nodes.md`에 집중되어 있으며, `buttonConfig.buttonItemMap`의 스키마 미정의, `source` 필드의 필수/선택 불일치, Static `ItemDef.buttons`와 Dynamic `itemButtons` 간 관계 미명시가 구현 시 혼란을 야기할 수 있다. 에러 처리 스펙과 실행 엔진 스펙의 추가분은 소규모이나 기존 정의와의 참조 연결이 부족하다. 스펙이 현재 구현보다 앞서 있는 항목(`waiting_for_input` 필터, API Error 처리)이 있으므로 RESOLUTION.md와의 동기화가 필요하다.

### 위험도

**LOW**