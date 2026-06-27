# 문서화(Documentation) Review

## 발견사항

### [INFO] 프론트엔드 신규 테스트 파일 — spec/AGM 참조 헤더 부재
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/memory-list-panel.test.tsx` L1, `scope-list-panel.test.tsx` L1
- 상세: 두 파일 모두 `describe` 블록 레이블에 spec 섹션이나 AGM 참조가 없다. 백엔드 테스트가 `describe('AgentMemoryAdminService (spec §6, AGM-12/13)', ...)` 형식을 일관되게 사용하는 것과 대비된다. 컴포넌트가 검증하는 요구사항(AGM-12 조회 패널 동작, AGM-13 삭제 UX)을 추적하기 어렵다.
- 제안: `describe("MemoryListPanel (spec §6, AGM-12/13)", ...)` / `describe("ScopeListPanel (spec §6, AGM-12/13)", ...)` 로 백엔드 패턴 통일. 최소한 파일 상단 주석으로 `// spec/5-system/17-agent-memory.md §6, AGM-12` 한 줄 추가.

### [INFO] i18n 목(mock) 구현 두 테스트 파일에 verbatim 중복 — 주석 없음
- 위치: `memory-list-panel.test.tsx` L5-19, `scope-list-panel.test.tsx` L5-19
- 상세: `vi.mock("@/lib/i18n", ...)` 블록이 두 파일에 동일한 내용으로 복사되어 있다. i18n dict 구조 변경 시 두 곳을 모두 수정해야 하는 유지보수 부채이며, 왜 공유 fixture 로 추출하지 않았는지 설명이 없다. 테스트 setup 파일이나 `__mocks__/i18n.ts` 에 있어야 할 로직이다.
- 제안: 단기적으로는 두 파일 중 하나 또는 두 파일 상단에 `// @/lib/i18n 공유 mock — vitest setup 이전에 이 블록을 직접 정의해야 테스트 파일 단위 격리가 보장됨` 등 이유를 주석으로 명시. 장기적으로 `src/__mocks__/i18n.ts` 또는 vitest `setupFiles` 로 추출.

### [INFO] `exposedHeaders` JSDoc — 예시가 단일 헤더만 언급
- 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L24-28
- 상세: 추가된 JSDoc은 `X-Deleted-Count` 를 구체적 예시로 언급하며 배경을 잘 설명한다. 다만 `exposedHeaders` 는 배열 타입이므로 미래에 다른 헤더가 추가될 가능성이 있는데, 현재 예시가 "현재 유일한 헤더" 인지 "예시" 인지 명확하지 않다. 사소한 수준.
- 제안: `예: agent-memory clearScope 의 \`X-Deleted-Count\`` 문구가 충분히 명확하므로 즉시 수정 불필요. 다른 헤더가 추가될 경우 주석을 갱신하는 것으로 충분.

### [INFO] `agent-memories.test.ts` 신규 describe 블록 — 기존 블록과 스타일 불일치
- 위치: `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` L559-622
- 상세: 기존 `describe("agentMemoriesApi.clearScope (X-Deleted-Count)", ...)` 는 헤더 이름까지 명시하는 방식인 반면, 신규 `describe("agentMemoriesApi.listScopes / listMemories", ...)` 는 HTTP 동작 세부사항 주석이 없다. 기능보다 메서드명 나열에 가깝다.
- 제안: `describe("agentMemoriesApi.listScopes / listMemories — GET /agent-memories/scopes, GET /agent-memories", ...)` 처럼 엔드포인트를 포함하거나, 현재 수준도 충분히 의미 전달되므로 이월 가능.

---

## 요약

이번 커밋의 핵심 문서화 추가 — `web-chat-cors.ts` 의 `exposedHeaders` JSDoc, `main.ts` 의 CORS 인라인 설명 주석, `agent-memory-admin.service.spec.ts` W10 테스트의 "flat-array 방어 분기" 설명 — 는 모두 적절하고 명확하다. `AgentMemoryAdminService` 의 클래스/메서드 JSDoc(spec 섹션 참조, 격리 의무, 동작 계약)은 이전 커밋에서 완비되어 있으며, logger 제거는 오히려 불필요한 dead-code 주석 가능성을 없앴다. 발견 사항은 모두 INFO 수준으로, 프론트엔드 신규 테스트 파일의 spec 참조 부재와 i18n mock 중복에 대한 설명 주석 누락이 주요 개선 기회다. 어느 항목도 이해 또는 유지보수를 즉각 저해하지 않는다.

## 위험도
NONE
