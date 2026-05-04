### 발견사항

- **[INFO]** 신규 외부 패키지 없음
  - 위치: 전체 diff
  - 상세: `buildAiMessageDebugFromResumeState`는 순수 TypeScript로 구현되어 있으며, 새로운 npm 의존성이 전혀 추가되지 않았습니다. 기존 모듈 임포트에 함수명 하나만 추가되는 방식입니다.

- **[WARNING]** `Record<string, unknown>` 타입으로 인한 암묵적 내부 의존성
  - 위치: `execution-engine.service.ts:L170-183` (`buildAiMessageDebugFromResumeState` 함수 본문)
  - 상세: 함수가 `state.turnDebugHistory[n].llmCalls`와 `state.turnDebugHistory[n].totalDurationMs`에 타입 단언(`as unknown[]`, `as number`)으로 접근합니다. AI 핸들러의 `_resumeState` 구조체에서 해당 속성명이 변경될 경우 컴파일 에러 없이 `{}` 를 반환하며 조용히 실패합니다. 두 파일 간 암묵적 계약(implicit contract)이 타입 시스템에 의해 보호되지 않습니다.
  - 제안: `TurnDebugEntry`와 같은 인터페이스를 별도 타입 파일에 정의하여 양쪽이 공유하는 것이 바람직합니다. 최소한 `Pick<ResumeState, 'turnDebugHistory'>` 형태의 타입을 인수로 받으면 의존 관계가 명시적이 됩니다.

- **[WARNING]** 터미널 emit 분기의 변경 여부 미확인
  - 위치: `execution-engine.service.ts` diff (단일 `@@ -1656` hunk만 존재)
  - 상세: 스펙 문서와 함수 주석 모두 "waiting_for_input emit 분기와 terminal emit 분기가 동일 shape으로 직렬화"된다고 명시합니다. 그러나 diff에는 `waiting_for_input` 분기의 단일 call site만 노출되어 있으며 terminal emit 분기(대화 종료 시점의 `execution.ai_message` 발행)가 동일하게 변경되었는지 확인할 수 없습니다. 두 분기가 동기화되지 않으면 클라이언트 디버그 타임라인이 불일치합니다.
  - 제안: 터미널 분기의 call site도 동일하게 `...buildAiMessageDebugFromResumeState(resumeState)` 로 대체되었는지 명시적으로 검증하는 테스트를 추가하거나, diff 범위에 포함시켜야 합니다.

- **[WARNING]** 기존 `requestPayload`/`responsePayload` 필드 제거 — breaking change 가능성
  - 위치: `execution-engine.service.ts:L1704-1706` (삭제된 라인)
  - 상세: `execution.ai_message` 이벤트 페이로드에서 `requestPayload`와 `responsePayload` 키가 제거되고 `llmCalls[]`로 대체됩니다. 스펙 문서는 동시 갱신되었으나, 프론트엔드 코드나 외부 통합(모니터링, 로그 파이프라인 등)이 해당 키를 직접 참조하고 있다면 런타임에서 조용히 깨집니다.
  - 제안: 프론트엔드 소비 코드에서 `requestPayload`/`responsePayload` 참조를 검색(`grep`)하여 동시 마이그레이션 여부를 확인해야 합니다.

- **[INFO]** 테스트의 임포트 경로가 구현 파일과 동일 모듈을 공유
  - 위치: `execution-engine.service.spec.ts:L7`
  - 상세: `buildAiMessageDebugFromResumeState`를 `export`로 노출하여 테스트가 직접 단위 테스트할 수 있습니다. 5개 케이스(정상, tool-loop, 히스토리 없음, 빈 배열, llmCalls 없음)가 커버되어 있으며 의존성 관점에서 적절한 설계입니다.

---

### 요약

이번 변경은 신규 외부 패키지를 일절 추가하지 않고 내부 헬퍼 함수 하나를 추출한 리팩터링으로, 의존성 측면의 구조적 위험은 낮습니다. 그러나 `Record<string, unknown>` 기반의 느슨한 타입 계약이 AI 핸들러 내부 상태 구조와의 암묵적 결합을 만들며, `requestPayload`/`responsePayload` 제거가 클라이언트 코드에 실질적인 breaking change를 유발할 수 있습니다. 터미널 emit 분기가 이번 변경 범위에 포함되었는지 별도로 확인이 필요합니다.

### 위험도

**LOW**