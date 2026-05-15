### 발견사항

- **[WARNING]** `ShadowResult.hint` 인터페이스 JSDoc 미갱신
  - 위치: `shadow-workflow.ts` — `ShadowResult.hint` 필드 (전체 파일 기준 약 120~130행)
  - 상세: `hint` 필드의 JSDoc은 세 가지 케이스만 열거한다 (`UNKNOWN_NODE_TYPE`, `LABEL_CONFLICT`, `NODE_NOT_FOUND`의 cascading 경로). 이번 변경으로 두 가지 케이스가 추가되었다: (1) `update_node` / `remove_node`에서 id 값이 기존 노드의 label과 일치하는 경우, (2) `add_edge`에서 cascading FIFO가 비었을 때의 label-lookalike fallback. 두 경우 모두 문서에 없다.
  - 제안:
    ```ts
    /**
     * 복구 지침 한-문장. 여러 에러 케이스에서 설정될 수 있다:
     *  - `UNKNOWN_NODE_TYPE` — suggestedType 사용 안내.
     *  - `LABEL_CONFLICT` (repeatCount ≥ 2) — 재시도 멈춤 안내.
     *  - `NODE_NOT_FOUND` (add_edge, 최근 실패한 add_node 가 있을 때) — cascading 실패 안내.
     *  - `NODE_NOT_FOUND` (update_node / remove_node / add_edge, id 슬롯에 label 입력) —
     *    label-lookalike 감지, 실제 UUID 안내 ("Tool arguments use UUIDs, not labels").
     * ...
     */
    hint?: string;
    ```

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` 업데이트 여부 불명확
  - 위치: `shadow-workflow.spec.ts` 신규 `describe` 블록 주석 `// ED-AI: LLM 이 update_node({id: "SendEmail", ...})...`
  - 상세: 다른 테스트들은 spec 섹션(`§4.1` 등)을 직접 참조하는 반면, label-lookalike hint 기능은 spec 파일에 대응 섹션이 존재하는지 확인되지 않는다. 런타임 동작 계약(hint 구조, 우선순위 규칙)을 spec에 기재하면 나중에 서버 동작을 수정할 때 단일 참조점으로 사용할 수 있다.
  - 제안: `spec/3-workflow-editor/4-ai-assistant.md`에 `NODE_NOT_FOUND label-lookalike hint` 절을 추가하고, cascading hint 우선순위 규칙(cascading > label-lookalike)도 함께 명시.

- **[INFO]** `system-prompt.spec.ts` 신규 테스트가 커버하는 spec 섹션 미참조
  - 위치: `system-prompt.spec.ts:96` 신규 `it` 블록
  - 상세: 다른 테스트들은 `// (spec/3-workflow-editor/4-ai-assistant.md §N)` 형식으로 대응 spec 절을 주석에 표기한다. 신규 테스트는 "Contracts 블록의 'Label vs identifier' 섹션이 커버해야 한다"고 서술하지만 spec 문서 경로는 명시하지 않는다. 일관성 면에서 참조를 추가하면 좋다.
  - 제안: 주석에 `(spec/3-workflow-editor/4-ai-assistant.md §Contracts — Label vs identifier)` 형식의 참조 추가.

---

### 요약

전반적으로 문서화 수준이 높다. `labelLookalikeHint` 메서드는 JSDoc·보안 고려사항·반환 조건이 모두 명시되어 있고, 시스템 프롬프트의 새 섹션도 예시와 금지 사례가 포함되어 자체 설명적이다. 단, `ShadowResult.hint` 인터페이스 JSDoc이 새로운 두 가지 hint 케이스를 반영하지 않아 이 필드만 보는 독자는 label-lookalike 경로를 알 수 없는 상태이며, 이것이 유일한 실질적 문서 누락이다.

### 위험도

**LOW**