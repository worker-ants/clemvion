## 발견사항

### **[WARNING]** Plan 문서가 구현 완료 상태를 반영하지 않음
- **위치**: `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` — TODO 체크박스 전부 미체크
- **상세**: 실제 코드 변경은 backend/frontend 구현·테스트를 모두 포함하지만, plan 문서의 `[ ] backend 테스트 선작성`, `[ ] backend 구현`, `[ ] frontend 테스트 선작성`, `[ ] frontend 구현` 항목이 여전히 미체크 상태다. CLAUDE.md 규약("작업이 끝나면 결과에 맞춰 갱신")을 위반한다.
- **제안**: 완료된 항목을 `[x]`로 갱신하고, `TEST WORKFLOW`·`REVIEW WORKFLOW`·`plan/complete 이동` 항목만 미체크 상태로 유지. 모두 완료되면 `git mv`로 `plan/complete/`로 이동.

---

### **[WARNING]** `assistant-message.test.ts` 누락 — `buildPickerSubmissionValue`의 MCP 매핑 로직이 테스트되지 않음
- **위치**: Plan 문서 변경 범위 항목: "`assistant-message.test.ts` — mcp-server-selector multi-confirm 시 McpServerRef 객체 배열로 매핑되는지"
- **상세**: Plan에 명시된 이 테스트 파일이 diff에 없다. `buildPickerSubmissionValue`에서 `mcp-server-selector` + multi 조합이 `{integrationId, includeResources: true, includePrompts: true}[]`로 변환되는 핵심 비즈니스 로직이 무검증 상태다. 함수가 `export`로 공개되어 있어 단위 테스트 작성이 용이하다.
- **제안**: `assistant-message.test.ts`에 최소 3개 케이스 추가 — single 모드, kb-selector multi 모드(string[]), mcp-server-selector multi 모드(McpServerRef[]).

---

### **[WARNING]** `buildPickerSubmissionValue`의 MCP 기본값 (`includeResources: true, includePrompts: true`) 검증 불가
- **위치**: `assistant-message.tsx:61-66`
- **상세**: 코드 주석에 "settings panel `McpServerSelector.add()`의 default와 동치"라고 명시되어 있으나, 참조 컴포넌트(`frontend/src/components/integrations/mcp-server-selector.tsx`)가 diff에 없어 실제 default 값과 일치하는지 확인 불가. 만약 settings panel의 default가 다르다면(예: `includeResources: false`) 두 경로에서 서로 다른 초기 설정이 주입된다.
- **제안**: `mcp-server-selector.tsx`의 `add()` 기본값을 확인하거나, 두 곳에서 동일 상수를 import해 단일 출처를 보장.

---

### **[INFO]** `lookupMcpServers`의 이중 상한 적용 — 불필요한 중복
- **위치**: `candidate-lookup.service.ts:157-161`
- **상세**: `limit: MAX_CANDIDATES`를 쿼리에 이미 전달하고 있음에도 `.slice(0, MAX_CANDIDATES)`를 한 번 더 적용한다. `lookupIntegrations`도 같은 패턴이지만, 이는 DB 레이어가 limit을 무시하는 경우에 대한 방어적 코딩으로 볼 수 있다.
- **제안**: 의도적 방어 코드라면 짧은 주석으로 명시. 그렇지 않으면 둘 중 하나만 유지.

---

### **[INFO]** `confirmed` 상태이면서 `extractSelectedIds`가 빈 배열을 반환하는 엣지 케이스
- **위치**: `candidate-picker.tsx:119-126`
- **상세**: `currentValue`가 `[{unknownField: 'x'}]`처럼 `integrationId`가 없는 객체 배열이면 `isFilled`는 true지만 `extractSelectedIds`는 `[]`를 반환한다. 결과적으로 `confirmed` 뷰에서 label이 `field.label`(예: "MCP Servers")로 대체되어 실제 선택값이 무엇인지 표시되지 않는다.
- **제안**: 운영 경로에서는 도달 불가하나, rehydrate 방어로 `ids.length === 0`일 때 fallback 메시지를 별도 처리하거나 raw id라도 표시.

---

### **[INFO]** System prompt 테스트가 kb-selector multi-select 설명 추가를 검증하지 않음
- **위치**: `system-prompt.spec.ts:344-354` / `system-prompt.ts:274`
- **상세**: `system-prompt.ts`에 `kb-selector`의 "Multi-select — the picker accepts several KBs in one Confirm" 설명이 추가됐지만, spec 테스트는 `mcp-server-selector` 문자열 등장만 검증하고 이 multi-select 설명은 assert하지 않는다.
- **제안**: `expect(prompt).toMatch(/Multi-select/)` 혹은 더 구체적인 매처 추가.

---

## 요약

요구사항 충족 관점에서 이번 변경의 핵심 두 기능 — MCP 서버 picker 추가와 KB·MCP 다중 선택 지원 — 은 backend(detector, lookup, system-prompt)·frontend(picker UI, submission 변환, API 타입) 전 계층에 일관되게 구현되어 있다. selectionMode 레거시 호환, 체크박스 순서 결정론적 정렬, settingsHref sanitize 등 세부 엣지 케이스도 전반적으로 잘 처리됐다. 그러나 plan 문서가 완료된 작업을 반영하지 않고, `buildPickerSubmissionValue`의 MCP 매핑 로직(핵심 비즈니스 규칙)에 대한 전용 단위 테스트가 누락되어 있어 요구사항 추적성과 회귀 방지에 공백이 있다.

## 위험도

**LOW** — 기능 구현은 완전하나, 테스트 갭과 plan 미갱신이 후속 유지보수 시 혼선을 유발할 수 있다.