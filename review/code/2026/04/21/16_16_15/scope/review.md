### 발견사항

- **[WARNING]** LLM 스트리밍이 공유 인프라 계층에 추가됨
  - 위치: `llm-client.interface.ts`, `anthropic.client.ts`, `openai.client.ts`, `llm.service.ts`
  - 상세: `stream()` 메서드가 `LLMClient` 인터페이스의 공개 계약에 추가됨. Assistant 기능에 필요한 변경이지만, 공유 LLM 모듈의 퍼블릭 API를 변경하는 범위가 Assistant 단독 기능보다 넓음. 특히 `thinkingTokens` (OpenAI reasoning tokens) 추적은 Assistant 스펙과 무관한 추가 기능임
  - 제안: `thinkingTokens` 추적은 별도 PR로 분리하거나, 현재 PR 범위 외 기능임을 명시적으로 문서화

- **[WARNING]** `snapshotForApproval` prop 선언되었으나 미사용
  - 위치: `assistant-message.tsx:14` — `snapshotForApproval?: AssistantWorkflowSnapshot`
  - 상세: `AssistantMessageViewProps`에 선언되어 있으나 컴포넌트 본문 어디에서도 참조되지 않음. 데드 코드
  - 제안: prop 제거 또는 `onApprovePlan` 콜백에 snapshot을 전달하는 실제 사용처 추가

- **[WARNING]** `role='system'` 및 `role='tool'` 스키마 사전 등록 (미사용)
  - 위치: `V019__workflow_assistant.sql`, `workflow-assistant-message.entity.ts`
  - 상세: SQL 코멘트에 "role=system은 미래 감사용으로 예약, 현재는 저장하지 않음"이라고 명시. `role='tool'`도 실제 메시지 플로우(`tool_calls` JSONB 방식)와 별개로 등록됨. 현재 미사용 상태인 enum 값을 미리 스키마에 추가하는 것은 범위 초과
  - 제안: 현재 실제로 사용하는 `user`·`assistant`만 허용하고, `tool`/`system`은 사용 시점에 마이그레이션으로 추가

- **[INFO]** 플랜 승인 메시지 하드코딩 한국어
  - 위치: `assistant-store.ts` — `get().sendMessage("계획대로 진행해 주세요.", snapshot)`
  - 상세: 프로젝트 전체가 `useT()` i18n 시스템을 사용하는데, `approveActivePlan`의 트리거 메시지만 하드코딩된 한국어
  - 제안: `en.ts`/`ko.ts`에 키 추가 후 store 레벨에서 번역 키를 참조하거나, 이 메시지를 사용자에게 노출하지 않는 방식으로 처리

- **[INFO]** 키보드 단축키 `Mod+/` 스펙 참조 불확실
  - 위치: `workflow-editor.tsx` — `if (isMod && e.key === "/")`
  - 상세: Assistant 패널 토글 단축키가 추가됨. 스펙 문서(`spec/3-workflow-editor/4-ai-assistant.md`)에 명시되어 있으면 범위 내, 없으면 독단적 추가
  - 제안: 스펙에 단축키 명세가 있는지 확인 필요

---

### 요약

변경사항은 전반적으로 Workflow AI Assistant 기능 구현이라는 의도된 범위 내에 잘 집중되어 있다. 신규 모듈(`workflow-assistant/`)과 관련 프론트엔드 컴포넌트·스토어는 기능 경계가 명확하고, 기존 모듈에 대한 변경(app.module.ts 등록, editor-store 확장)도 최소한으로 이루어졌다. 다만 LLM 공유 인프라에 `stream()` 인터페이스가 추가되면서 범위가 Assistant 단독을 초과해 전체 LLM 모듈에 영향을 주는 점, `role='system'/'tool'` 선제 등록과 `snapshotForApproval` 데드 코드가 경미한 범위 초과에 해당한다.

### 위험도

**LOW**