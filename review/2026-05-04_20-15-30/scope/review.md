### 발견사항

- **[INFO]** `waiting_for_input` 브랜치에서 기존 필드 3개가 제거되고 새 구조로 교체됨
  - 위치: `execution-engine.service.ts` diff 1687~1704
  - 상세: `requestPayload`, `responsePayload`, `durationMs` → `...buildAiMessageDebugFromResumeState(resumeState)` 로 교체. WS 페이로드 shape 변경이므로 프론트엔드가 기존 필드(`requestPayload`, `responsePayload`)를 소비하고 있었다면 breaking change
  - 제안: 프론트엔드의 해당 필드 소비 코드 존재 여부 확인 필요 (grep: `requestPayload`, `responsePayload` in `frontend/`)

- **[INFO]** 터미널 emit 브랜치가 이 diff에 포함되지 않음
  - 위치: `execution-engine.service.ts` 주석 "Shape mirrors the terminal-emit branch below"
  - 상세: 주석과 spec 모두 "두 분기 모두 동일 shape으로 직렬화"라고 명시하는데, 터미널 emit 브랜치(diff에서 잘림)에서 이미 `llmCalls`를 사용하고 있는지 확인이 어려움. 커밋 메시지(`waiting_for_input AI_MESSAGE 에 llmCalls 직렬화`)로 봤을 때 해당 브랜치만 변경하는 것이 의도인 듯하나, 터미널 브랜치가 이미 일치하는 shape인지 명시적으로 드러나지 않음
  - 제안: 터미널 emit 코드가 `llmCalls` 형식을 이미 사용 중임을 diff 범위에 포함하거나 주석으로 참조 라인 번호 기입

- **[INFO]** `buildAiMessageDebugFromResumeState`의 파라미터 타입이 `Record<string, unknown>`으로 느슨함
  - 위치: `execution-engine.service.ts` L182
  - 상세: `buildConversationMetaFromResumeState`와 동일한 패턴이므로 기존 설계를 따른 것이나, `resumeState` 전용 인터페이스가 정의되어 있다면 타입 안전성을 더 높일 수 있음
  - 제안: 현행 코드베이스 일관성을 해치지 않는 범위에서 수용 가능

- **[INFO]** 테스트 주석이 구현 설명 수준을 초과함
  - 위치: `execution-engine.service.spec.ts` 3215~3219 (describe 블록 첫 주석)
  - 상세: "waiting_for_input emit 분기와 terminal emit 분기가 동일 shape..." 등 3줄 블록 주석이 CLAUDE.md 규약("코드가 하는 일을 설명하는 주석 금지") 위반 소지
  - 제안: 주석 제거 또는 "spec §4.4 참조" 한 줄로 축약

---

### 요약

변경 범위는 명확히 정의된 목표(waiting_for_input AI_MESSAGE emit에 `llmCalls` 직렬화 추가)에 집중되어 있다. 새 helper 함수 추가, 해당 브랜치 적용, 테스트 5건, spec 업데이트가 하나의 일관된 단위로 묶여 있으며 무관한 리팩토링이나 기능 확장은 없다. 다만 기존 `requestPayload`/`responsePayload` 필드가 WS 페이로드에서 제거되는 breaking change이므로 프론트엔드 소비 코드 확인이 필요하고, 터미널 emit 브랜치의 일치 여부가 diff 밖에 있어 완전한 검증이 어렵다.

### 위험도

**LOW**