### 발견사항

- **[INFO]** `system-prompt.ts` 및 `candidate-lookup.service.ts` docstring 정렬 변경
  - 위치: `system-prompt.ts` diff +274~276, `candidate-lookup.service.ts` diff +20~24
  - 상세: 기능 변경과 무관한 bullet 앞 공백 정렬 수정 (`- integration-selector:` → `- integration-selector :` 등). 내용 변경은 아니지만 scope 외 수정.
  - 제안: 무시하거나 별도 포맷팅 커밋으로 분리 가능. 리뷰 차단 사유는 아님.

- **[INFO]** `buildPickerSubmissionValue`가 `export` 로 공개됨
  - 위치: `assistant-message.tsx` +37
  - 상세: 모듈 내부 헬퍼이지만 `export` 키워드가 붙어 있음. plan에 `assistant-message.test.ts` 테스트 케이스가 TODO로 남아 있어 테스트 가능성을 위해 공개한 것으로 보임. 그 자체로 over-engineering은 아니나 미완 TODO와 연결된 구조임.
  - 제안: `assistant-message.test.ts` 테스트가 추가될 때까지 `export` 여부 재검토. 현재 TODO 항목(`plan/in-progress`)이 미완으로 남아 있는 상태.

- **[INFO]** `detect-pending-user-config.spec.ts` — 기존 테스트 fixture에 `mcpServers` 추가
  - 위치: diff +88 `knowledgeBaseIds: [], mcpServers: [{ integrationId: 'int-1' }]`
  - 상세: `'flags empty arrays as empty for kb-selector'` 테스트가 `mcpServers`를 채워서 격리하는 처리. 기능 구현으로 인해 기존 테스트 결과가 달라질 수 있어 필요한 수정이며 scope 내 정당한 변경.
  - 제안: 해당 없음.

- **[INFO]** `plan/in-progress/` TODO 항목 미완
  - 위치: `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` TODO 섹션
  - 상세: `[ ] TEST WORKFLOW`, `[ ] REVIEW WORKFLOW`, `[ ] plan/complete 로 이동`, `[ ] assistant-message.test.ts` 등이 미체크 상태. plan 문서 라이프사이클 상 `in-progress/` 유지는 정상이나, TEST WORKFLOW 결과 없이 리뷰가 요청된 것으로 보임.
  - 제안: lint/unit/build 통과 여부 확인 후 리뷰 마무리 권장.

---

### 요약

변경 범위는 plan 문서(`ai-assistant-pending-config-mcp-multi.md`)에 명시된 두 가지 결함(MCP 서버 누락, 다중 선택 불가) 수정에 정확히 집중되어 있다. Backend의 `UserActionWidget` 확장, `selectionMode` 신설, `lookupMcpServers` 메서드 추가, Frontend의 `CandidatePicker` 체크박스 분기 및 타입 변경 모두 의도된 범위 내이며, 관련 없는 파일 수정이나 사전 협의 없는 리팩토링은 없다. docstring 정렬 변경 몇 건과 `buildPickerSubmissionValue` export 여부가 경미한 관찰 사항이나 기능 정확성에 영향을 주지 않는다.

### 위험도

**LOW**