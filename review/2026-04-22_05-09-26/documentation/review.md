## 문서화 리뷰 결과

### 발견사항

---

- **[WARNING]** `AssistantToolKind` 타입 주석이 `clear_plan` 추가 후 부정확해짐
  - 위치: `tool-definitions.ts:11` — `"plan: \`propose_plan\` 단일 도구"`
  - 상세: `clear_plan` 이 'plan' kind 로 등록되었으나 타입 상단 JSDoc 설명은 여전히 "propose_plan 단일 도구" 로 표기되어 실제 동작과 불일치
  - 제안: `"plan: propose_plan / clear_plan — 채팅 UI에만 영향, shadow 변경 없음"` 으로 수정

---

- **[WARNING]** `spec §4.3` finish 도구 설명이 `clear_plan` bypass 를 미반영
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md`, §4.3 `finish` 행 설명
  - 상세: 서버 guard 로직이 `planClearedThisTurn` 플래그로 우회되는 경우(화제 전환 후 finish 즉시 허용)가 spec 에 기술되지 않음. §2.2 의 Active plan context 섹션에는 `cleared` 상태 설명이 있지만 §4.3 의 guard 규칙과 연결되지 않아 스펙 독자가 동작을 오해할 수 있음
  - 제안: `finish` 설명에 "`clear_plan` 호출 후에는 pending step 이 있어도 guard 가 발동하지 않음" 한 줄 추가

---

- **[INFO]** `buildSystemPrompt` 함수 파라미터 JSDoc 누락
  - 위치: `system-prompt.ts`, `buildSystemPrompt` 함수 선언부
  - 상세: 모듈 상단 JSDoc 은 섹션 번호를 포함해 잘 갱신되었으나, 새로 추가된 `activePlanContext` 파라미터에 대한 `@param` 설명이 없음. 선택적 파라미터이므로 기본값 `null` 의 의미(섹션 생략)를 명시하면 호출 측에서 의미를 명확히 파악할 수 있음
  - 제안: 함수 JSDoc 에 `@param activePlanContext null 이면 Active plan context 섹션이 생략됨` 추가

---

- **[INFO]** `deriveStatus` 의 `forceCleared` 파라미터가 항상 `false` 로 호출됨
  - 위치: `active-plan-context.ts`, `deriveStatus` 함수 및 두 호출 지점
  - 상세: 함수 시그니처에 `forceCleared: boolean` 이 존재하지만 현재 코드 전체에서 `false` 로만 전달됨. 의도가 미래 확장용 플레이스홀더라면 명시적 주석이 없어 코드 독자가 버그인지 의도인지 판단하기 어려움. `cleared` 판정이 호출부(`findActivePlanContext`의 null return)에서 이미 처리되므로 이 파라미터는 현재 기능적으로 데드 코드
  - 제안: 파라미터를 제거하거나 "// future: clear_plan-in-flight 판정용 예약" 등 한 줄 주석으로 의도를 명시

---

- **[INFO]** `hasClearPlanAfter` 범위 경계가 문서화 없이 `planIndex` 포함
  - 위치: `active-plan-context.ts`, `history.slice(planIndex)` 라인
  - 상세: `planIndex` 를 포함한 slice 이므로, 이론상 plan 메시지 자체에 `clear_plan` tool call 이 함께 존재하면 즉시 null 을 반환함. 비정상 케이스이지만 동작이 문서화되지 않아 `slice(planIndex + 1)` 과의 차이를 설명하는 짧은 주석이 있으면 의도를 명확히 할 수 있음
  - 제안: `// planIndex 포함 — propose_plan 메시지 자체에 clear_plan 이 공존하는 비정상 상태도 cleared 처리` 주석 추가

---

- **[INFO]** `workflow-assistant-stream.service.ts` 클래스 JSDoc 이 `clear_plan` 처리를 미언급
  - 위치: `workflow-assistant-stream.service.ts`, 클래스 수준 JSDoc(`@Injectable` 앞)
  - 상세: 클래스 설명에 `evaluateFinishGuard` 동작이 언급되어 있으나 `planClearedThisTurn` 플래그 및 `clear_plan` 처리 경로가 흐름 설명에 없음. 현재 수준의 주석 밀도에서는 INFO 수준이나 향후 유지보수 시 오해 소지가 있음
  - 제안: `evaluateFinishGuard` 설명 뒤에 "`clear_plan` 호출 시 `planClearedThisTurn` 플래그로 guard 를 우회" 한 줄 추가

---

### 요약

전반적으로 문서화 품질은 높습니다. 신규 `active-plan-context.ts` 모듈은 모듈 JSDoc, 인터페이스 필드 주석, 비자명한 `isOkResult` 레거시 처리 주석까지 갖추었고, spec 문서는 새 도구(`clear_plan`)·상태 모델(active/cleared/completed)·시그니처 변경을 모두 반영했습니다. 주요 gaps 는 `tool-definitions.ts` 의 타입 주석(단일 도구 → 복수)과 spec §4.3 의 guard bypass 미기술 두 건이며, 나머지는 `forceCleared` 데드 파라미터·`@param` 누락 등 INFO 수준입니다.

### 위험도

**LOW**