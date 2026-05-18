# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `PresentationDetail` 및 `SystemDetail` 컴포넌트에 JSDoc 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `PresentationDetail`, `SystemDetail` 함수
  - 상세: `PresentationCardBody` 에는 명시적 JSDoc이 잘 달려 있으나, `PresentationDetail` 과 `SystemDetail` 은 문서 없이 추가됨. 두 함수는 공개 컴포넌트 계층의 렌더 책임을 담당하며, `PresentationCardBody` 와 동일한 수준의 스펙 참조 주석이 있어야 일관성이 유지됨.
  - 제안: 각 함수 상단에 최소한 스펙 참조(`spec/conventions/conversation-thread.md §9.1`)와 역할(source 분기 렌더 진입점) 을 기술하는 한 줄 JSDoc 추가.

- **[INFO]** `use-execution-events.ts` 의 `conversationThread` 인라인 타입 선언에 문서 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `payload` 타입 확장 블록 (라인 +974~+979)
  - 상세: 인라인 주석으로 스펙 섹션 참조는 되어 있으나, `conversationThread.turns` 의 의미(Preview 1차 소스), `nextSeq`, `totalChars` 의 역할이 주석 없이 선언만 되어 있음. 특히 `totalChars` 는 어떤 용도인지 맥락이 전혀 없음.
  - 제안: 각 필드에 1줄 인라인 주석 추가. 예: `/** Running total of all turn text lengths; used for quota display. */`

- **[WARNING]** `execution-store.ts` 의 `ConversationItem.type` 확장 — `"system"` 타입 설명 중 v1 상태 정보가 코드 주석과 상충 가능
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` — `ConversationItem` JSDoc 블록
  - 상세: 추가된 JSDoc은 `"system"` 에 대해 "v1 has no automatic push but the UI shape is reserved" 라고 명시하고 있음. 이는 정확하나, 동일 타입 정의에 이미 `"presentation"` 의 상세 설명이 JSDoc 블록 위에 있고 `"system"` 설명은 그 블록 안에 포함되어 있어, 향후 `system` 이 활성화될 때 주석 갱신을 잊을 위험이 있음. 특히 "UI shape is reserved" 문구는 기능 구현 후에도 삭제되지 않은 채 오래된 주석으로 남을 수 있음.
  - 제안: JSDoc 에 `@deprecated` 또는 `@todo` 태그로 향후 갱신 시점 명시. 예: `* @todo Remove "reserved" note when system-source automatic push ships (v2).`

- **[INFO]** `stripInlineMarkers` 함수의 JSDoc이 `undefined` 입력 동작을 명시하지 않음
  - 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `stripInlineMarkers` 함수 (라인 +696~+699)
  - 상세: JSDoc 본문은 레거시 호환 목적과 동작 원리를 잘 설명하고 있으나, `undefined` 입력 시 `""` 를 반환한다는 동작이 문서화되지 않음. 테스트(`conversation-utils.test.ts`) 에서는 `undefined` 케이스를 명시적으로 검증하고 있으므로, 공개 API 계약으로 문서화할 가치가 있음.
  - 제안: `@param` 과 `@returns` 태그 추가. 예: `@param s - Raw string, may be undefined. @returns Cleaned string; empty string for undefined/falsy input.`

- **[INFO]** `threadTurnsToConversationItems` 의 `interactionType` 추론 로직에 인라인 주석이 있으나 엣지 케이스 설명 부족
  - 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `presentation_user` case 내부 (라인 +772~+781)
  - 상세: `url` + `buttonId` 의 공존 여부로 `button_continue` 를 추론하는 로직에 주석은 있으나, `data` 가 `null` 인 경우의 폴백(`form_submitted`)이 의도된 것인지 방어 코드인지 명시가 없음. 또한 `buttonId` 없이 `url` 만 있는 경우(이론적 엣지)에 대한 언급 없음.
  - 제안: 주석에 "If `data` is null/undefined, falls back to `form_submitted` (defensive default)" 추가.

- **[INFO]** i18n 딕셔너리 키 추가 시 키 목록 문서화 없음
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/editor.ts`, `codebase/frontend/src/lib/i18n/dict/ko/editor.ts`
  - 상세: `cardButtonClicked`, `cardFormSubmitted`, `cardLinkContinue`, `cardSystemNote` 4개 키가 추가됨. 인라인 주석(`// Source-specific card labels (spec §9.1)`)은 있으나, 이 키들의 사용처(어떤 컴포넌트에서 소비되는지)가 기록되지 않음. 대규모 딕셔너리에서 미사용 키를 발견하기 어려워지는 문제가 있음.
  - 제안: 현재 인라인 주석 수준으로 충분하나, 향후 i18n 키 목록 관리 문서 (`spec/` 또는 별도 convention)가 없다면 도입 검토 권장 (이번 변경에서 필수는 아님).

- **[INFO]** `plan/in-progress/conversation-turn-render.md` — Phase 4 의 "CHANGELOG / README 영향 검토" 항목이 체크리스트로만 존재하며 결론 없음
  - 위치: `plan/in-progress/conversation-turn-render.md` — Phase 4 (라인 +1162)
  - 상세: "CHANGELOG / README 영향 검토" 항목이 `[ ]` 미완으로 남아있어, 이번 PR 에서 해당 검토가 실제로 이루어졌는지 불분명함. 이번 변경은 conversation Preview 동작의 사용자-가시적 변경(표시 방식 전환)을 포함하므로 CHANGELOG 기재 여부 판단이 필요함.
  - 제안: Phase 1 구현이 완료된 이번 PR 에서 CHANGELOG 기재 여부를 명시적으로 결정하고, plan 항목에 결론("CHANGELOG 불필요 — 내부 UI 개선으로 공개 API 변경 없음" 등)을 기록.

- **[WARNING]** README 업데이트 필요성 미검토 — WebSocket payload 형태 변경(additive) 및 conversation Preview 동작 변경
  - 위치: 프로젝트 루트 `README.md` 및 관련 설치/사용 문서
  - 상세: `plan/in-progress/conversation-turn-render.md` §영향범위에 "WebSocket payload shape 변경 없음 (additive)" 라고 명시되어 있으나, conversation Preview 탭의 표시 방식이 chat bubble → 회색 시스템 카드 + source 분기로 변경됨. 사용자-가시적인 UX 변경임에도 README 갱신 여부 판단이 plan 에 `[ ]` 로만 남아있음.
  - 제안: README 에 conversation Preview 탭 동작 설명이 있다면 업데이트 필요. 없다면 명시적으로 "README 영향 없음" 으로 plan 항목을 닫을 것.

- **[INFO]** `RagDetail` 함수에 기존 인라인 주석이 있으나, 신규 추가된 `PresentationDetail` / `SystemDetail` 과 스타일 불일치
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`
  - 상세: `RagDetail` 은 함수 내부에 `// content 첫 줄에서 chunk 개수 힌트…` 식의 설명이 있는 반면, 신규 컴포넌트들은 함수 본문 주석 없이 JSX 로 바로 진입함. 일관성 측면에서 경미한 불일치.
  - 제안: 신규 컴포넌트에도 동일 수준의 간략한 본문 주석 추가(선택적).

## 요약

전반적으로 이번 변경은 문서화 수준이 양호한 편이다. `ConversationTurn` 타입과 `threadTurnsToConversationItems`, `stripInlineMarkers` 등 핵심 공개 API에는 스펙 참조가 포함된 JSDoc이 작성되어 있으며, 복잡한 `interactionType` 추론 로직에도 인라인 주석이 달려 있다. i18n 키 추가 시에도 스펙 섹션 참조 주석이 포함되었다. 다만 `PresentationDetail` / `SystemDetail` 컴포넌트의 JSDoc 누락, `stripInlineMarkers` 의 `undefined` 처리 계약 미명시, `system` 타입의 "v1 reserved" 주석이 향후 오래된 주석으로 굳어질 위험, 그리고 plan 의 CHANGELOG/README 검토 항목이 미결인 점은 개선이 권장된다. 특히 conversation Preview 의 표시 방식이 사용자-가시적으로 변경된 만큼 CHANGELOG 기재 여부를 명시적으로 결론 내릴 필요가 있다.

## 위험도

LOW
