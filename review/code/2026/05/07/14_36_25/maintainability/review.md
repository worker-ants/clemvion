## 발견사항

### WARNING: `buildPickerSubmissionValue`의 반환 타입이 `unknown`으로 너무 넓음
- 위치: `assistant-message.tsx:48` — `buildPickerSubmissionValue`
- 상세: 반환 타입이 `unknown`이라 컴파일러가 소비 지점에서 타입 오류를 잡지 못함. `string | string[] | McpServerRef[]` 등으로 좁혀 두면 `updateNodeConfigField` 호출부에서 타입 불일치를 빌드 시점에 잡을 수 있음.
- 제안:
  ```ts
  type McpServerRef = { integrationId: string; includeResources: boolean; includePrompts: boolean };
  export function buildPickerSubmissionValue(
    widget: UserActionWidget,
    selection: CandidatePickerSubmission,
  ): string | string[] | McpServerRef[]
  ```

---

### WARNING: `extractSelectedIds`가 MCP 전용 shape(`{integrationId}`)를 범용 유틸에 포함
- 위치: `candidate-picker.tsx:57-76` — `extractSelectedIds`
- 상세: 함수 이름은 "id 뽑기"이지만 내부에서 `"integrationId"` 키 존재 여부를 직접 검사함. MCP 데이터 모양이 변경되면 이 유틸과 `buildPickerSubmissionValue` 두 곳을 동시에 수정해야 함. 도메인 지식이 범용 유틸에 스며들어 응집도가 낮아짐.
- 제안: `extractSelectedIds`를 순수하게 `string | string[]` 정규화로 제한하고, `{integrationId}` 언패킹은 `confirmed` 렌더링 경로에서 별도 함수(`extractMcpIds`)로 분리.

---

### WARNING: multi-select 판정 로직이 세 곳에 산재
- 위치: 백엔드 `detect-pending-user-config.ts`의 `MULTI_SELECT_WIDGETS` / 프론트엔드 `candidate-picker.tsx`의 `mode === "multi"` / `assistant-message.tsx`의 `buildPickerSubmissionValue`
- 상세: 새 배열 필드 widget(`array-selector` 류)이 추가될 때 최소 세 파일을 동시에 수정해야 함. `selectionMode`를 백엔드가 payload에 내려주기 때문에 런타임 동기화는 보장되지만, 코드 검색 관점에서 "어느 widget이 multi인가?"에 대한 단일 출처(SSOT)가 없음.
- 제안: 현재 구조상 허용 범위이나, `candidate-picker.tsx`의 분기 주석에 "새 widget 추가 시 `assistant-message.tsx:buildPickerSubmissionValue`도 함께 수정"을 명시하는 것을 권장.

---

### INFO: `lookupMcpServers`와 `lookupIntegrations`의 로직 중복
- 위치: `candidate-lookup.service.ts:146-168` vs 110-132
- 상세: 두 메서드가 `IntegrationsService.findAll` → `slice(MAX_CANDIDATES)` → `map()` 흐름을 공유하지만 반환 shape이 달라 (`mcp`는 `sublabel` 없음) 단순 추출이 어려움. 현재 수준의 중복은 허용 범위.
- 제안: 변경 불필요. 단, 세 번째 유사 메서드가 추가된다면 공통 헬퍼로 추출 검토.

---

### INFO: `CandidatePicker`에서 `selectedId`·`selectedIds` 두 state 모두 항상 초기화
- 위치: `candidate-picker.tsx:88-91`
- 상세: 컴포넌트는 `mode`가 결정되면 한 branch만 사용하지만 두 state가 모두 생성됨. 실 동작상 문제는 없으나 mode 전환이 불가능한 컴포넌트에서 미사용 state가 존재함.
- 제안: 현 구조 유지. `mode`는 prop에서 고정되어 변경되지 않으므로 렌더 비용은 무시 가능.

---

### INFO: 계획 문서(`plan/in-progress`)의 TODO 항목이 미체크 상태로 잔재
- 위치: `plan/in-progress/ai-assistant-pending-config-mcp-multi.md:62-69`
- 상세: `검증: node-component.interface.ts` 부터 `REVIEW WORKFLOW` 까지 7개 항목이 `[ ]`인 채로 구현이 완료된 상태. plan 라이프사이클 규약(CLAUDE.md)에 따르면 미체크 항목이 있으면 `in-progress`에 유지해야 하고, 완료 시 `complete/`로 `git mv` 해야 함.
- 제안: 각 단계 완료 시 체크박스를 즉시 업데이트하고, 모든 항목 완료 후 `git mv`로 이동.

---

## 요약

변경 전반이 기존 코드베이스의 패턴을 일관되게 따르고 있으며, `MULTI_SELECT_WIDGETS` Set과 `selectionMode` payload를 통한 widget→mode 매핑은 명확하고 확장성 있는 설계다. 주요 유지보수 리스크는 multi-select 판정 로직이 백엔드 Set·프론트엔드 picker·message 변환 함수 세 곳에 분산된 점과, `extractSelectedIds`가 MCP 도메인 지식을 범용 유틸에 포함한 점이다. `buildPickerSubmissionValue`의 `unknown` 반환 타입은 타입 안전성을 낮추므로 구체 타입으로 좁히는 것을 권장한다.

## 위험도

**LOW**