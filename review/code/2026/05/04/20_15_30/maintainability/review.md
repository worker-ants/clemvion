## 발견사항

### [WARNING] 호출부에서 페이로드 필드 가시성 손실
- **위치**: `execution-engine.service.ts` diff 내 `waiting_for_input` 분기 emit 호출
- **상세**: `requestPayload`, `responsePayload`, `durationMs` 3개의 명시적 필드가 `...buildAiMessageDebugFromResumeState(resumeState)`로 대체되면서, emit 호출부만 봤을 때 어떤 필드가 페이로드에 포함되는지 즉시 파악이 불가능해졌다. 함수 내부를 열어봐야만 전송되는 키를 알 수 있다.
- **제안**: 추출 결과를 중간 변수로 이름 붙여 노출하거나, 타입 반환을 더 구체적인 named interface로 정의해 호출부에서 IDE가 shape를 드러내도록 한다.

---

### [WARNING] `totalDurationMs` → `durationMs` 필드명 변환이 암묵적
- **위치**: `buildAiMessageDebugFromResumeState` 내 `lastTurnDebug?.totalDurationMs`
- **상세**: 입력 상태의 필드는 `totalDurationMs`이고 반환 객체는 `durationMs`다. 이 매핑이 함수 본문 중간에 묻혀 있어, 호출자나 테스트 작성자가 혼동할 가능성이 있다. 인접 함수 `buildConversationMetaFromResumeState`도 동일 변환을 암묵적으로 수행하므로 패턴이 굳어질 경우 나중에 추적이 어려워진다.
- **제안**: JSDoc의 `@param` 또는 인라인 주석에 `state.turnDebugHistory[].totalDurationMs → result.durationMs` 매핑을 한 줄로 명시한다.

---

### [INFO] 반환 타입의 `unknown[]` 사용
- **위치**: `buildAiMessageDebugFromResumeState` 반환 타입 `{ llmCalls?: unknown[]; durationMs?: number }`
- **상세**: `buildConversationMetaFromResumeState`도 `Record<string, unknown>` 반환이므로 일관성은 있다. 다만 `llmCalls`의 원소 구조(`requestPayload`, `responsePayload`, `durationMs`)가 테스트에서만 암시되고, 공유 인터페이스로 정의되어 있지 않아 향후 프론트엔드 연동 시 별도 타입 협의가 필요하다.
- **제안**: 즉시 수정 필요는 아니지만, `LlmCallDebugEntry` 같은 인터페이스를 shared 위치에 정의해두면 spec 명세의 JSON 예시와 코드 타입이 자동으로 연동된다.

---

### [INFO] JSDoc 주석 길이의 스타일 불일치
- **위치**: `buildAiMessageDebugFromResumeState` JSDoc (10줄) vs `buildConversationConfigFromOutput` JSDoc (1줄)
- **상세**: 같은 파일 내 유사한 역할의 헬퍼 함수들이 현저히 다른 주석 밀도를 가진다. 과도한 주석은 코드가 바뀔 때 동기화 부담이 된다.
- **제안**: "spec 링크 + 핵심 계약"만 남기고 나머지는 제거한다. `Returns empty object when ...` 같은 자명한 경우 설명은 테스트가 대신한다.

---

### [INFO] 스펙 내 `llmCalls` 설명 중복
- **위치**: `spec/5-system/6-websocket-protocol.md` — 이벤트 목록 표 셀과 §4.4 본문 단락
- **상세**: `llmCalls` 동작 설명이 표의 셀(한 문장)과 §4.4 절의 별도 단락(동일 내용의 확장)에 중복 기술되어 있다. 동작이 변경될 때 두 곳을 동시에 수정해야 한다.
- **제안**: 표 셀에는 "see §4.4" 참조만 남기고 본문에서 한 번만 기술한다.

---

## 요약

`buildAiMessageDebugFromResumeState`는 기존 `buildConversationMetaFromResumeState` 패턴을 충실히 따르고 있고, 5개의 테스트가 경계 조건(히스토리 없음, 빈 배열, llmCalls 누락)을 모두 커버한다. 주요 유지보수성 우려는 기능적 결함이 아니라 **spread 주입으로 인한 호출부 가독성 저하**와 **필드명 변환의 묵시성**에 있으며, 향후 이벤트 payload 구조가 변경될 때 변경 영향 범위를 추적하기가 어려워질 수 있다.

## 위험도

**LOW**