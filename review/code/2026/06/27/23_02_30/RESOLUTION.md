# RESOLUTION — ai-review (Batch 3, 23_02_30)

대상: `review/code/2026/06/27/23_02_30/SUMMARY.md` (MEDIUM, Critical 0). 수동 처리.
동반: impl-done(23_02_31) BLOCK:NO — WARNING 은 전부 #738 webhook spec 부채(범위 밖).

## 조치 항목

| # | 조치 |
|---|------|
| W1 (CORS X-Deleted-Count) | **FIX** — `main.ts` defaultOptions + `web-chat-cors.ts` CorsOptionsLike 에 `exposedHeaders: ['X-Deleted-Count']` 추가. cross-origin 브라우저가 헤더를 읽어 0/다건 토스트 분기가 실제 동작하도록(미수정 시 항상 0 폴백 — 기능 무력화). |
| S1 (SPEC-DRIFT) | **FIX** — `17-agent-memory.md §6`(X-Deleted-Count echo 행+노트) + `2-navigation/16-agent-memory.md §2`(0건 중립 토스트) 반영. |
| W6 (dead logger) | **FIX** — AgentMemoryAdminService 미사용 logger 필드+import 제거. |
| W8 (MemoryListPanel 테스트) | **FIX** — memory-list-panel.test.tsx (placeholder/로딩/빈/kind fallback/삭제 콜백/load more 6케이스). |
| W9 (ScopeListPanel 테스트) | **FIX** — scope-list-panel.test.tsx (로딩/빈/선택/삭제/load more 5케이스). |
| W10 (deletedRowCount flat-array) | **FIX** — admin spec flat-array 분기 케이스 추가. |
| W11 (listScopes/listMemories api 테스트) | **FIX** — agent-memories.test.ts 3케이스(scopes q포함/q미지정, memories kind) 추가. |
| W2 (admin 메서드 외부 소비자) | **검증완료 non-issue** — 외부(execution-engine·ai-memory-manager·processor)는 recall/saveMemories/scheduleExtraction 만 호출. admin 메서드 호출 0(grep). |
| W12 (clearScope res 파라미터) | **검증완료 non-issue** — 직접 호출자 0(grep). NestJS 라우터 무영향. |
| W3·W4 (scope creep — #738 보정) | **의도적 found-breakage 조치** — #738 이 Gate C(spec_impact 누락) + system-status e2e(큐 미갱신)로 main 을 red 로 만들어 본 PR unit/e2e 를 차단. 무관하나 차단 해소 위해 동봉(developer 규약 "발견 이슈 조치"). |
| W5 (동적 SQL 슬롯) | **이월** — 기존 패턴 verbatim 이동(신규 아님). buildWhereClause 추출은 별도 cleanup. |
| W7 (패널 JSX 중복) | **이월** — PanelAsyncContent 추출은 방금 분해한 패널의 추가 추상화, 후속. |
| INFO 다수 | 이월/비채택 (현 상태 안전 — SUMMARY 기재). |

## TEST 결과 (resolution 후 재수행)
- lint: 통과 (`_test_logs/lint-20260628-003859.log`)
- unit: 통과 (`_test_logs/unit-20260628-004030.log`) — backend agent-memory 152, frontend 4735(신규 패널/api 테스트 포함)
- build: 통과 (`_test_logs/build-20260628-004125.log`)
- e2e: 통과 218 (`_test_logs/e2e-20260628-004435.log`)

## 보류·후속 항목
- W5 buildWhereClause / W7 PanelAsyncContent 추출 → 별도 cleanup.
- #738 webhook UUID spec 부채(impl-done W-1/W-2/W-3) → webhook track (본 PR 무관).
