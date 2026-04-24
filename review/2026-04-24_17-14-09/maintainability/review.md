### 발견사항

---

**[INFO]** `lookupLlmConfigs` 의 `Record<string, unknown>` 타입 우회 처리
- 위치: `candidate-lookup.service.ts:130–148`
- 상세: `LlmConfigService.findAll` 반환 타입이 약해 `typeof cfg.id === 'string'` 같은 방어 코드가 필요해졌다. 서비스 자체 타입이 강화되면 이 분기들이 dead code 가 된다.
- 제안: `LlmConfigService`에 typed return interface를 추가하거나, 최소한 내부 타입 cast 헬퍼로 분리해 "이 우회는 서비스 타입 약화 때문"임을 명시하면 미래 제거가 쉬워진다.

---

**[INFO]** `evaluateReviewGuard` 내 전체 노드 prefetch 루프
- 위치: `workflow-assistant-stream.service.ts:1301–1321`
- 상세: review guard 진입 시 `snapshot.nodes` 전체에 대해 `collectPendingUserConfigWithCandidates`를 `Promise.all`로 실행한다. 노드 수가 수십 개가 되면 DB 조회 burst가 발생한다. 현재는 문서화도 없고, skip 조건(trivial edit 등)이 앞에서 걸러지는지 코드 흐름을 따라가야만 알 수 있다.
- 제안: 함수 상단에 "review가 이미 skip될 경우를 먼저 판정한 뒤 prefetch" 순서를 명시하거나, skip 판정을 prefetch 앞으로 올려 불필요한 조회를 차단한다.

---

**[WARNING]** `collectPendingUserConfigWithCandidates` / `collectPendingUserConfig` 이름 분화로 인한 혼란
- 위치: `workflow-assistant-stream.service.ts:1237–1260, 1228–1236`
- 상세: 두 메서드가 이름만 다르고 하나가 다른 하나를 래핑하는 구조다. 호출 지점이 세 곳(tool_result 주입, review prefetch, review 콜백)에 흩어져 있으며, "어디서 candidates가 채워지는가"를 파악하려면 모든 호출 지점을 추적해야 한다.
- 제안: 두 메서드를 `_withCandidates` 접미사 대신 `collectPending` / `fillCandidates` 같이 책임이 명확한 이름으로 정리하거나, 내부 문서에 "review 경로는 prefetch Map 사용, tool_result 경로는 직접 호출" 차이를 기술한다.

---

**[INFO]** `extractWorkflowItems` 모듈 외부 노출 위치
- 위치: `candidate-lookup.service.ts:176–188`
- 상세: `ExploreToolsService.listWorkflows`의 반환 타입이 `unknown`이어서 필요한 type narrowing 헬퍼가 파일 최하단 자유 함수로 배치되어 있다. 이 함수는 `CandidateLookupService`에만 종속되지만 `export` 없이 모듈 스코프에 있어 테스트에서 직접 검증되지 않는다.
- 제안: `private static` 메서드로 클래스 내부로 올리거나, `ExploreToolsService` 자체 반환 타입을 강화해 헬퍼 자체를 제거한다.

---

**[INFO]** `candidate-picker.tsx` 내 `confirmed` 상태와 `currentValue` 의 이중 진실 공급원
- 위치: `candidate-picker.tsx:57–60`
- 상세: `useState<boolean>(isFilled(currentValue))`로 초기화하지만, `currentValue`가 외부에서 변경되어도 `confirmed` state는 갱신되지 않는다. 메시지 목록이 rehydrate될 때 picker가 이미 `confirmed=true`로 마운트되면 괜찮지만, 부모가 `currentValue`를 나중에 변경하는 경우 state가 stale해진다.
- 제안: `useEffect`로 `currentValue` 변화를 감지하거나, `confirmed`를 derived state(`const confirmed = isFilled(currentValue) || localConfirmed`)로 분리해 단일 진실 공급원을 유지한다.

---

**[INFO]** `SETTINGS_HREF` 상수가 컴포넌트 파일(assistant-message.tsx)에 인라인 정의
- 위치: `assistant-message.tsx:22–28`
- 상세: widget → 경로 매핑이 `assistant-message.tsx`에만 있어 `CandidatePicker`를 다른 곳에서 재사용할 때 매핑을 복사해야 한다.
- 제안: `candidate-picker.tsx` 또는 별도 `candidate-picker.config.ts`로 이동해 `CandidatePicker`와 함께 export 하면 소비자가 직접 경로를 알 필요가 없다.

---

**[INFO]** `collectPickerEntries` 내 `as` 캐스트 패턴
- 위치: `assistant-message.tsx:262–284`
- 상세: `call.result`를 인라인 인터페이스로 캐스팅하는 패턴이 `collectPickerEntries`와 테스트 코드에서 각각 중복된다. `result` 타입이 변경되면 두 곳을 모두 수정해야 한다.
- 제안: `AssistantToolCallRecord`의 `result` 타입을 `unknown` 대신 discriminated union 또는 최소한 `NodeEditResult`로 좁혀 캐스트를 제거한다.

---

**[INFO]** `system-prompt.ts` 인라인 규칙 조건(`candidates: []`)의 반복
- 위치: `system-prompt.ts` — 여러 섹션에 동일한 `candidates: []` 조건 설명이 반복됨
- 상세: "candidates가 빈 배열일 때만 mention" 규칙이 §Closing the turn, §pendingUserConfig, §self-review, §예시(두 군데) 총 4곳에 각각 산문으로 기술되어 있다. 프롬프트 수정 시 한 곳만 바꾸면 불일치가 발생할 위험이 있다.
- 제안: 규칙을 한 곳(`### pendingUserConfig` 섹션)에서 선언하고 나머지 섹션은 "→ 위 규칙 참조"로 cross-reference한다.

---

### 요약

전체적으로 ED-AI-39 스펙을 명확한 레이어 분리(detect → fill candidates → review guard → frontend picker)로 구현했으며, 불변 반환, error degradation, explicit confirmation 등 견고한 설계 결정이 코드에 잘 반영되어 있다. 유지보수 관점의 주요 리스크는 두 가지다: `WorkflowAssistantStreamService` 내 `collectPendingUserConfig` / `collectPendingUserConfigWithCandidates` 이름 분화와 review guard 내 전체 노드 prefetch 루프로 인해 "어느 경로에서 candidates가 채워지는가"를 파악하는 데 문서 없이는 시간이 필요하다. 프론트엔드의 `confirmed` 이중 진실 공급원과 `SETTINGS_HREF` 위치 문제는 낮은 위험이나 향후 재사용 시 혼란의 씨앗이 될 수 있다. 전반적으로 새 기능 코드의 가독성과 테스트 커버리지는 충분히 높다.

### 위험도

**LOW**