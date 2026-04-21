## 발견사항

### [WARNING] 테스트 파일 모듈 레벨 JSDoc 미갱신
- **위치**: `workflow-assistant-stream.service.spec.ts`, 5~13번째 줄 (파일 상단 주석)
- **상세**: 파일 상단의 블록 주석은 테스트가 커버하는 시나리오를 명시적으로 나열하고 있으나, 이번에 추가된 `get_current_workflow` 관련 두 테스트(redact 검증, 인턴 편집 반영)가 목록에 반영되지 않았다. 주석이 테스트 수가 늘었음에도 4개 항목 그대로다.
- **제안**:
  ```ts
  /**
   * ...
   *   - `get_current_workflow` → shadow 스냅샷 반환 + redactConfig 적용 확인
   *   - `add_node` 이후 `get_current_workflow` → 같은 턴 편집이 결과에 반영됨
   *   - missing LLM config → `error` event without touching history
   */
  ```

---

### [WARNING] 서비스 클래스 JSDoc의 explore 처리 설명 누락
- **위치**: `workflow-assistant-stream.service.ts`, 클래스 상단 JSDoc 주석 중 `4. LlmService.chatStream 루프` 항목
- **상세**: 현재 주석은 `explore: ExploreToolsService로 위임 → 결과를 tool_result 메시지로 주입`으로 단일 경로만 기술하고 있다. 이번 변경으로 `get_current_workflow`는 `ExploreToolsService`를 우회하여 shadow 스냅샷을 직접 반환하는 별도 경로가 추가됐지만, 이 분기가 클래스 주석에 언급되지 않았다.
- **제안**:
  ```ts
  //   - explore: `get_current_workflow`는 shadow 스냅샷을 직접 반환(DB 조회 없음);
  //             그 외는 ExploreToolsService로 위임 → tool_result 메시지로 주입
  ```

---

### [INFO] `buildCurrentWorkflowResult` private 메서드 주석 부재
- **위치**: `workflow-assistant-stream.service.ts`, `buildCurrentWorkflowResult` 메서드
- **상세**: private 메서드이지만 config redact 적용이라는 보안 정책 결정이 내재되어 있다. "왜 redact를 여기서 적용하는가(= 시스템 프롬프트 스냅샷과 동일 정책)"가 메서드 자체에는 기술되어 있지 않다. 호출부 인라인 주석에는 설명이 있어 참조 가능하지만, 메서드 단독으로 읽힐 때 의도가 불명확할 수 있다.
- **제안**: 한 줄 주석으로도 충분하다.
  ```ts
  // 시스템 프롬프트 스냅샷과 동일 보안 정책 — config는 redact 적용
  private buildCurrentWorkflowResult(shadow: ShadowWorkflow): unknown {
  ```

---

### [INFO] spec 문서의 §5.3 이벤트 테이블과 `tool_call` 이벤트 정의 불일치 가능성
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md`, §5.3 이벤트 테이블
- **상세**: §5.3 테이블에서 `tool_call (kind=explore)` 이벤트가 별도 행으로 명시되어 있으나, `get_current_workflow`에 대한 `tool_call` 이벤트가 발행된다는 점(서비스 코드 상 `if (kind === 'edit' || kind === 'explore')` 브랜치)은 언급되지 않았다. 프론트엔드 개발자 입장에서 `get_current_workflow`의 SSE 이벤트 처리 여부가 모호할 수 있다.
- **제안**: §5.3 또는 §4.1 노트에 "탐색 배지는 `get_current_workflow` 포함 모든 explore 도구에 표시된다"는 한 줄을 추가하면 명확해진다.

---

## 요약

전반적으로 문서화 품질은 양호하다. spec 문서(`4-ai-assistant.md`)는 `get_current_workflow` 추가를 도구 테이블, 2-tier 조회 구조 노트, 시스템 프롬프트 섹션, few-shot 항목에 걸쳐 일관되게 반영했으며 구현과의 정합성도 높다. 다만 서비스 클래스 JSDoc과 테스트 파일 헤더 주석이 새로운 분기를 언급하지 않아, 코드를 처음 읽는 개발자가 explore 경로에 두 갈래가 있음을 놓칠 수 있다. `package-lock.json` 변경은 자동 생성 파일이므로 문서화 대상이 아니다.

## 위험도

**LOW**