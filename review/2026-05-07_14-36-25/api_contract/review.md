### 발견사항

- **[WARNING]** `CandidatePicker.onConfirm` prop 시그니처가 breaking change
  - 위치: `candidate-picker.tsx` (`onConfirm` prop), `candidate-picker.test.tsx`
  - 상세: `(selectedId: string) => void` → `(selection: CandidatePickerSubmission) => void` 로 변경됨. 유일한 소비자인 `assistant-message.tsx`는 이미 업데이트되었고 테스트도 반영되어 있으나, TypeScript 타입 레벨에서 breaking change다. 향후 이 컴포넌트를 직접 사용하는 코드가 추가될 경우 실수 가능성이 존재한다.
  - 제안: 문서 없음. `@since` JSDoc 또는 컴포넌트 레벨 변경 이력 주석으로 명시할 것.

- **[WARNING]** `buildPickerSubmissionValue`에서 `includeResources`, `includePrompts` 기본값 하드코딩
  - 위치: `assistant-message.tsx:45–50` (`mcp-server-selector` 브랜치)
  - 상세: `{ integrationId, includeResources: true, includePrompts: true }` 기본값이 이 함수에 고정되어 있다. 주석에서 "settings panel `McpServerSelector.add()` 의 default 와 동치"라고 명시하지만, `mcpServerRefSchema` Zod 스키마의 `.default(...)` 값이나 settings panel 코드와 **별개 위치**에서 유지된다. 두 곳이 다른 기본값을 사용하게 되면 동일 사용자 행위가 서로 다른 config를 생성하는 API 계약 위반이 발생한다.
  - 제안: `mcpServerRefSchema` 의 기본값을 공유 상수(예: `MCP_SERVER_REF_DEFAULTS`)로 추출하거나, settings panel 컴포넌트의 기본값과 동일 함수에서 파생하도록 단일 출처로 통합할 것.

- **[INFO]** `UserActionWidget` 타입 union 확장의 exhaustive check 영향
  - 위치: `frontend/src/lib/api/assistant.ts`, `backend/src/nodes/core/node-component.interface.ts`
  - 상세: `'mcp-server-selector'` 추가는 additive change다. `SETTINGS_HREF` Record가 `Record<UserActionWidget, string>` 타입이라 TypeScript가 새 값 누락을 컴파일 에러로 잡아주며 이미 반영됨. 하위 호환성은 유지된다.
  - 제안: 현재 대응 방식은 적절하다. 향후 widget 추가 시에도 동일 패턴을 유지할 것.

- **[INFO]** `selectionMode?: 'single' | 'multi'` optional 추가는 안전하게 처리됨
  - 위치: `detect-pending-user-config.ts`, `frontend/src/lib/api/assistant.ts`
  - 상세: 프론트엔드가 `undefined` → `'single'` fallback 처리하여 legacy DB row와의 하위 호환성을 명시적으로 확보하고, 백엔드 docstring에도 동일하게 문서화됨. 적절한 계약 관리다.

- **[INFO]** `mcp-server-selector` 후보 응답에 `sublabel` 미포함
  - 위치: `candidate-lookup.service.ts` `lookupMcpServers`
  - 상세: 다른 selector(`integration-selector`, `llm-config-selector`)는 `sublabel`을 포함하는데 MCP는 포함하지 않는다. `CandidateEntry.sublabel`이 optional이므로 타입 계약 위반은 아니며, 주석에 "모두 동일하게 'mcp'라 중복 정보"라는 이유가 명시됨. 의도적 설계다.

---

### 요약

이번 변경은 새 `mcp-server-selector` widget과 `selectionMode` 필드를 추가하는 additive extension으로, 외부 HTTP API 엔드포인트는 변경되지 않는다. `PendingUserConfigField` 응답 DTO의 optional 필드 추가는 하위 호환이 유지되며, legacy row 처리도 양단에서 명시적으로 처리된다. 주요 위험은 내부 컴포넌트 인터페이스(`CandidatePicker.onConfirm`) 의 breaking change인데 유일한 소비자가 이미 업데이트되어 실질 영향은 없다. 그러나 `buildPickerSubmissionValue`에서 MCP 서버 config 기본값(`includeResources`, `includePrompts`)을 하드코딩하여 settings panel과 별도로 유지하는 점은 단일 출처 원칙 위반으로 향후 두 곳이 drift 될 경우 동일 사용자 행위가 다른 config를 생성하는 계약 불일치가 발생할 수 있다.

### 위험도
LOW