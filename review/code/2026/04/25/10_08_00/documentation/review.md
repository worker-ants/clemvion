### 발견사항

---

**[WARNING]** `buildReviewChecklist` 독스트링이 점검 개수를 잘못 기술
- 위치: `review-workflow.ts`, `buildReviewChecklist` 함수 JSDoc (~line 240)
- 상세: 독스트링에 "여섯 개 점검을 순차 실행" 및 순서 목록이 명시되어 있으나, 실제 구현은 `NODE_CONFIG_WARNINGS`가 추가되어 **7개** 점검이 실행된다. `NODE_CONFIG_WARNINGS`가 `PENDING_USER_CONFIG_UNMENTIONED` 이후에 삽입됐는데 독스트링 목록에는 없다.
- 제안:
  ```ts
  // 수정: "여섯 개" → "일곱 개", 목록에 6) NODE_CONFIG_WARNINGS 추가 후 7) REQUEST_COVERAGE_LOW로 변경
  ```

---

**[WARNING]** `renderNodeCatalog` JSDoc이 ED-AI-40 변경 이후 구식(stale)
- 위치: `system-prompt.ts`, `renderNodeCatalog` 함수 JSDoc
- 상세: 현재 주석은 "LLM이 `add_edge` 전에 `get_node_schema`로 실제 포트를 먼저 확인해야 함을 인지하도록 한다"고 기술한다. 그러나 실제 프롬프트(`STATIC_BLOCK_2_CONTRACTS`)는 `add_node`/`update_node` 응답의 `result.ports`가 권위 있는 소스이며 `get_node_schema` 선행 호출이 더 이상 불필요하다고 가르친다. 이 JSDoc은 카탈로그의 `[dynamic-ports]` 마커의 역할을 오해하게 만든다.
- 제안:
  ```ts
  /**
   * 노드 카탈로그 요약. isDynamicPorts / dynamicPorts 노드에는 `[dynamic-ports]`
   * 마커를 붙여 LLM 이 런타임에 config 에 따라 포트가 달라질 수 있음을 인지하도록 한다.
   * 편집 직후 실제 포트는 result.ports 로 공급되므로 get_node_schema 선행 호출은
   * 불필요 — 이번 턴에 편집하지 않는 스냅샷 노드에 한해서만 필요.
   */
  ```

---

**[INFO]** `REQUEST_COVERAGE_THRESHOLD = 0.3` 임계값 근거 미기술
- 위치: `review-workflow.ts`, 상수 선언부
- 상세: `MAX_UNRESOLVED`, `MAX_ORPHANS` 등 상한 상수들은 의도가 명확한 반면, `REQUEST_COVERAGE_THRESHOLD`는 왜 0.3인지 설명이 없다. 향후 튜닝 시 근거가 없어 임의 변경될 위험이 있다.
- 제안: `/** 토큰 30 % 미만 일치 시 비차단 경고. 실험치 — 짧은 요청의 false positive 를 줄이면서 명백한 누락을 잡는 하한. */`

---

**[INFO]** `TODO(ED-AI-39)` 제거 조건이 구체적이지 않음
- 위치: `review-workflow.ts`, `collectUnmentionedPendingUserConfig` 내 TODO 주석
- 상세: "세션 메시지가 회전(retention)되어 전부 새 shape이 되면" 이라는 조건이 추상적이다. 어떤 구체적 조건(날짜, 마이그레이션 완료 기준, 티켓 번호)으로 판단해야 하는지 불명확하다.
- 제안: 조건에 `candidates` 필드가 항상 배열로 보장되는 시점(예: 특정 메시지 엔티티 마이그레이션 완료 여부)을 명시하거나 선행 이슈 번호를 기재.

---

**[INFO]** `buildSystemPrompt` 반환문에 블록 경계 주석 없음
- 위치: `system-prompt.ts`, `buildSystemPrompt` 함수 반환 템플릿 리터럴
- 상세: 함수 JSDoc에서 5블록 구조를 명확히 설명하지만, 실제 return 문의 템플릿 리터럴 안에 블록 4(Reference — node catalog)와 블록 5(Dynamic state)의 경계가 주석 없이 인라인으로 혼재한다. 블록 1~3는 상수명으로 자명하지만 4~5는 암묵적이다.
- 제안: 반환 템플릿 내부에 `// BLOCK 4` / `// BLOCK 5` 에 해당하는 마커 주석을 한 줄씩 추가해 5블록 구조가 실제 코드에서도 식별 가능하게 함.

---

### 요약

전반적으로 문서화 품질은 높다. JSDoc이 공개 타입·함수 전반에 걸쳐 존재하고, 복잡한 비즈니스 규칙(ED-AI-40, ED-AI-39 등)에 대한 인라인 설명이 충실하며, 테스트 파일의 `it` 설명 자체가 살아있는 사용 예시 역할을 한다. 그러나 `buildReviewChecklist` 독스트링의 "여섯 개 점검" 오기술과 `renderNodeCatalog` JSDoc의 구식 설명은 독자가 구현 의도를 잘못 이해할 수 있는 실질적인 리스크를 가진다 — 특히 `renderNodeCatalog` 주석은 ED-AI-40으로 역전된 동작을 여전히 구습으로 기술하고 있어 프롬프트 유지보수 시 혼란을 줄 수 있다.

### 위험도
**LOW**