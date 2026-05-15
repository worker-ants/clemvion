## 발견사항

- **[INFO]** 외부 패키지 추가 없음 — 순수 내부 의존성 재조정
  - 위치: 전체 diff
  - 상세: 13개 파일 전체에서 새로운 `npm` 패키지 `import`가 단 한 건도 없음. `mcp-server-selector` 후보 조회는 이미 주입된 `IntegrationsService.findAll`을 `serviceType: ['mcp']` 필터만 추가해 재사용함.
  - 제안: 유지

- **[INFO]** `CandidatePickerSubmission` 타입이 `candidate-picker.tsx`에서 정의·export되고 `assistant-message.tsx`가 이를 import
  - 위치: `candidate-picker.tsx` 32행 / `assistant-message.tsx` import 섹션
  - 상세: UI 컴포넌트 간 타입 의존이 생김. 이 타입은 picker → parent 콜백 계약이므로 `frontend/src/lib/api/assistant.ts`(API 타입 SSOT)에 두는 편이 방향성이 일관됨. 현재 위치에서도 기능 문제는 없으나, 이후 `assistant.ts`의 `PendingUserConfigField`와 함께 변경될 때 두 파일을 동시에 수정해야 한다는 점이 숨겨진 결합.
  - 제안: 선택적 개선 — `CandidatePickerSubmission`을 `assistant.ts`로 이동 후 `candidate-picker.tsx`에서 re-import

- **[INFO]** `UserActionWidget` 타입이 백엔드(`detect-pending-user-config.ts`)와 프런트엔드(`assistant.ts`)에 중복 선언, 이번 변경에서 양측 동시 갱신됨
  - 위치: 두 파일의 `UserActionWidget` union
  - 상세: 기존 패턴의 연장선이며 이번 PR은 양쪽을 정확히 동기화했음. 신규 위험 없음. 단, 향후 widget 추가 시 두 파일을 반드시 함께 수정해야 한다는 암묵적 계약이 문서화되어 있지 않음.
  - 제안: plan 문서 또는 코드 주석에 "두 파일 동시 수정 필수" 경고 한 줄 추가 권장

- **[INFO]** `buildPickerSubmissionValue`의 MCP 변환 로직(`includeResources: true, includePrompts: true`)이 `mcp-server-selector.tsx`의 기본값에 암묵적으로 의존
  - 위치: `assistant-message.tsx` `buildPickerSubmissionValue` 함수
  - 상세: 코드 주석에 "settings panel `McpServerSelector.add()` 의 default 와 동치"라고 명시되어 있어 인지는 하고 있음. `McpServerRef` 스키마 기본값이 바뀌면 이 함수도 함께 바꿔야 하지만, 컴파일러가 잡아주지 않는 의존.
  - 제안: `McpServerRef`의 기본 객체를 공유 상수로 추출해 두 곳이 동일 참조를 쓰도록 하면 드리프트 방지 가능 (필수 아님, 스키마 변경 빈도가 낮다면 현 수준으로 충분)

---

## 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않았으며**, 기존에 주입된 `IntegrationsService` 하나를 `serviceType` 필터만 달리해 재사용함으로써 의존성 증가 없이 기능을 확장한 점이 가장 두드러진 특징이다. 내부 의존성 측면에서는 `CandidatePickerSubmission` 타입의 위치(컴포넌트 파일 내 정의, 상위 컴포넌트 import)와 두 언어 경계에 중복된 `UserActionWidget` union이 유지보수 시 누락 포인트가 될 수 있으나, 모두 기존 패턴의 연장이고 이번 PR에서 정확히 동기화되었다.

## 위험도

**LOW**