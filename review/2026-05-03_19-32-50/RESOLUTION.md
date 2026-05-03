# RESOLUTION — 2026-05-03 ai-review 조치 내역

리뷰 보고서 `SUMMARY.md` 의 Warning 14건 + Info 15건 중, **모든 Warning** 과 정리 가치가 큰 Info 다수를 본 라운드에서 처리했다. Warning #1 의 권고 (`useEffect`) 는 React 19 의 `react-hooks/set-state-in-effect` 룰에 정면 충돌하므로 React 공식 "Storing information from previous renders" 패턴 (render-time setState) 으로 대신 정리하고 의도를 주석으로 남겼다.

## Warning 조치

| # | 리뷰 항목 | 조치 | 위치 |
|---|----------|------|------|
| 1 | 렌더 중 setState (3회 직접 호출) | React 권장 "Storing information from previous renders" 패턴 유지 + 의도/링크 주석 추가. `useEffect` 로 옮기면 React 19 새 룰 위반 + 한 사이클 깜빡임 | `result-detail.tsx` `ResultDetail` |
| 2 | `aiMetadata` / `turnRefIndex` 미메모이제이션 | 둘 다 `useMemo` 로 감쌈 (`[result]`, `[aiMetadata]` 의존성) | `result-detail.tsx` `ResultDetail` |
| 3 | 듀얼 어큐뮬레이터 동기화 불변식 컴파일러 미보호 | `RagAccumulatorGroup` 도입 — `pushSources` / `pushDiagnostic` 한 번 호출로 node + turn 양쪽 동시 갱신. dual push 4개소 → group push 4개소로 교체 | `ai-agent.handler.ts` |
| 4 | `ReferencesChip` 단위 테스트 없음 | `result-detail.test.tsx` 의 References 탭 통합 테스트에서 chip 노출 / 클릭 / dedup 동작을 함께 검증 | `__tests__/result-detail.test.tsx` |
| 5 | `ReferencesTabContent` scroll/highlight `useEffect` 테스트 없음 | `Element.prototype.scrollIntoView` mock + chip 클릭 시나리오로 `scrollIntoView` 호출 검증 | `__tests__/result-detail.test.tsx` |
| 6 | 단일턴 no-KB `turnDebug[0]` 미검증 | 신규 spec `"emits turnDebug[0] with empty ragSources when LLM responds directly (no KB)"` 추가 — `attempted=false`, `skipReason='empty_kb_list'` 검증 | `ai-agent.handler.spec.ts` |
| 7 | chip 클릭 → 탭 전환 통합 테스트 없음 | 신규 spec `"jumps to References tab when assistant message chip is clicked"` 추가 — 클릭 후 Turn 그룹이 보이는지 + scrollIntoView 호출 검증 | `__tests__/result-detail.test.tsx` |
| 8 | KB 청크 `turnDebug` 경로 추가 노출 | 노드 결과 자체가 워크플로 owner 만 접근 가능 (spec 라인 426) — 기존 권한 모델로 보호됨. 별도 변경 없음 (검증 결과 LOW 위험) | spec `4-nodes/3-ai-nodes.md` |
| 9 | LLM 제어 query 무결성 미검증 | `parseKbArgs` 에 `MAX_KB_QUERY_LENGTH = 2000` 상수 + `trim().slice(0, MAX)` 적용. 기존 `RagSearchService` 는 임베딩 인자로만 사용 | `kb-tool-provider.ts` |
| 10 | Output / Meta 탭 RAG 섹션 제거 의도 불명 | spec 두 곳 (`5-system/9-rag-search.md`, `4-nodes/3-ai-nodes.md`) 에 References 탭 통합 + Preview chip 노출을 명시. UX 의사결정으로 spec 화 | spec |
| 11 | `SummaryView` 이중 `!` non-null assertion | IIFE 로 `turnSources` 로컬 변수에 좁힌 뒤 length 체크 → 타입 안전, non-null assertion 제거 | `conversation-inspector.tsx` `SummaryView` |
| 12 | `NodeDetailTabs` required props 4개 추가 | grep 로 다른 호출처 부재 확인 (유일한 caller: `ResultDetail`). 테스트도 외부 인터페이스 `ResultDetail` 만 사용해 영향 없음 | n/a |
| 13 | References 탭 재진입 스크롤 미복원 | `scrollKey` 카운터 도입 — `handleJumpToReferences` 호출 시마다 +1, `useEffect([highlightTurnIndex, scrollKey])` 로 같은 turn 재점프 시에도 effect 재실행 | `result-detail.tsx` |
| 14 | spec `_turnDebugHistory` JSON 예시 미갱신 | `_turnDebugHistory` 예시 코드 블록에 `ragSources` / `ragDiagnostics` 필드 추가 | `spec/4-nodes/3-ai-nodes.md` |

## Info 조치 (선별)

| # | 리뷰 항목 | 조치 |
|---|----------|------|
| 1 | 단일턴 ragAcc/turnRagAcc 이중 누적 | `RagAccumulatorGroup` 도입 시 자연스럽게 한 줄 push 로 정리됨 |
| 5 | KB tool 이름 LLM context 반사 노출 | `unknown_kb_tool` 고정 코드만 반환, 원본 `call.name` 은 `logger.warn` 으로만 기록 |
| 6 | `MAX_VISIBLE_DOC_NAMES` 매직 넘버 | 모듈 상수 + JSDoc 추가 |
| 7 | `refMap` stale ref cleanup 없음 | ref callback 에서 `el ? set : delete` 로 cleanup |
| 9 | `SummaryView` Map 키 이중 조회 | Warning #11 조치 IIFE 안에서 한 번만 lookup |
| 10 | `extractTurnDebug` `turnIndex: 0` edge case 미검증 | 단위 테스트 `"preserves turnIndex: 0 (falsy but valid)"` 추가 |
| 11 | 한 턴 KB 다중 호출 시 `turnRagAcc` 누적 미검증 | 신규 spec `"accumulates multiple KB tool calls within the same turn into turnDebug delta"` 추가 |
| 13 | `extractTurnDebug` JSDoc 누락 | `turnIndex 없는 항목 silently dropped` 명시 추가 |
| 14 | `ReferencesChip` `compact` prop 미문서화 | JSDoc 에 SummaryView 인라인 버블용 한 줄 추가 |
| 15 | `useState("preview")` 초기값 placeholder 패턴 미문서화 | `ResultDetail` 의 useState 선언 위에 의도 주석 추가 |

## 보류 / Not Applicable

| # | 항목 | 사유 |
|---|------|------|
| Info #2 | 3단계 prop drilling | 현재 깊이 (3) 에서 Context 도입은 over-engineering. 향후 더 깊어질 때 재검토 |
| Info #3 | NodeDetailTabs 기본 탭 결정 로직 부모 이동 | 현재 lifted activeTab 구조의 자연스런 결과. 반대 방향으로 옮기면 chip 점프 콜백이 훨씬 복잡해짐 |
| Info #4 | `sanitizeKbId` 다대일 충돌 | 현재 KB ID 는 UUID v4 라 `[^a-zA-Z0-9_]` 매칭이 `-` 만 발생, `_` 와 충돌하지 않음. UUID 정책 변경 시 재검토 |
| Info #8 | 단일/멀티턴 turnRagAcc 패턴 복제 | `RagAccumulatorGroup` 도입으로 복제 위험 감소. 추가 추상화는 현 단계 over-engineering |
| Info #12 | `KbToolProvider.execute()` KB 메타 중복 조회 | 워크스페이스당 KB 수가 소규모 (~10) 이고 캐싱 도입은 별도 설계 — 본 변경 범위 밖 |

## 검증

- `backend npm run lint` — clean (auto-fix 6건 적용)
- `backend npm test` — 150 suites / 2383 tests pass (신규 4 추가)
- `backend npm run build` — clean
- `frontend npx eslint` — clean
- `frontend npx vitest run` — 96 files / 1058 tests pass (신규 6 추가)
- `frontend npm run build` — clean

## 관련 파일

- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`
- `backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`
- `backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.spec.ts`
- `frontend/src/components/editor/run-results/result-detail.tsx`
- `frontend/src/components/editor/run-results/conversation-inspector.tsx`
- `frontend/src/components/editor/run-results/output-shape.ts`
- `frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx`
- `frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
- `spec/4-nodes/3-ai-nodes.md`
- `spec/5-system/9-rag-search.md`
