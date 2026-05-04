### 발견사항

- **[INFO]** 구현 주석과 실제 출력 포맷 불일치
  - 위치: `llm-call-trace.ts` `fromConversationMessages` 함수 내 주석 (line ~101)
  - 상세: 주석에 `"호출 1/N · 2/N · …"` 라고 적혀 있지만 실제 `labelForCall` 출력은 `"Turn N · 호출 K/T"` 형태. 구분자(`·`)와 포맷이 다름
  - 제안: 주석을 실제 출력 예시 (`"Turn 1 · 호출 1/2"`) 로 교정

- **[INFO]** 테스트 케이스 주석의 오탈자
  - 위치: `llm-call-trace.test.ts` 새 테스트 블록 상단 주석
  - 상세: `"호출 1/2 / 2/2"` — 두 레이블을 `/` 로 구분했지만 실제 assertion은 `"호출 1/2"` · `"호출 2/2"`. 혼동 여지가 있음
  - 제안: 주석을 `"호출 1/2" and "호출 2/2"` 등으로 명확히 수정

- **[INFO]** 새 테스트에서 `durationMs` carry-over 미검증
  - 위치: `llm-call-trace.test.ts` 새 테스트 assertions
  - 상세: 기존 fallback 테스트는 `durationMs: 42` 를 검증하지만, 새 tool-loop 테스트는 `durationMs` (30ms, 40ms) 를 검증하지 않음. 기능상 회귀는 아니지만 테스트가 전체 shape를 커버하지 않음
  - 제안: `expect(calls[0]).toMatchObject({ turnIndex: 1, callIndexInTurn: 0, durationMs: 30 })` 형태로 보완

- **[INFO]** `turnIndex === 0` 인 메시지 처리 동작 미문서화
  - 위치: `fromConversationMessages` 전반
  - 상세: `Map` 키로 `0` 도 유효하므로 동작 자체는 올바르지만, `turnIndex` 가 `0` 인 경우가 실제로 발생하는지, 발생 시 `"Turn 0 · 응답"` 레이블이 UI 상 적절한지 명시된 스펙이 없음
  - 제안: `ConversationItem.turnIndex` 가 항상 1-based임을 타입 주석 또는 spec에 명시하거나 방어 로직 추가

---

### 요약

핵심 버그(tool loop에서 동일 턴 내 다수 어시스턴트 메시지가 모두 `callIndexInTurn: 0` 으로 기록되어 레이블이 중복되던 문제)를 `Map<turnIndex, counter>` 패턴으로 정확히 수정했으며, 새 테스트가 정상 흐름과 `labelForCall` 출력까지 검증한다. 필터 조건(`null` 페이로드 제외)과 기존 경로(`flattenTurnDebug`, `_llmCalls`)는 변경이 없어 회귀 위험이 없다. 발견된 사항은 모두 주석·테스트 완성도 수준의 INFO 항목으로, 기능 요구사항은 충분히 충족되어 있다.

### 위험도

**LOW**