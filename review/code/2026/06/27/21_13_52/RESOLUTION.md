# RESOLUTION — ai-review (21_13_52) 후속 처리

대상 review: `review/code/2026/06/27/21_13_52/SUMMARY.md` (전체 위험도 LOW, Critical 0).
처리 방식: 수동 (main). Critical 0 이라 코드 revert 없음 — WARNING/INFO 채택분 fix.

## 조치 항목

| SUMMARY # | 분류 | 조치 | fix commit |
|---|---|---|---|
| W#1 SPEC-DRIFT | FIX | `spec/5-system/17-agent-memory.md` §3·§7(실현됨)·§7(Rationale) 4곳의 AGM-08 watermark 경로를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 갱신 + in-flight 폴백 병기 (SPEC-DRIFT back-flow — 구현 I12 에 spec 정합) | `107b7617c` |
| W#2 Security (prompt injection) | 무대응 | 기존 문서화된 구조적 한계(W-2). DATA_FENCE 완화책 적용 중. 본 PR 무관 | — |
| W#3 Architecture (AdminService SRP) | 이월 | Batch 3(프론트/어드민) 에서 처리 예정. 본 PR 범위 밖 (기존 백로그) | — |
| W#4 Side Effect (saveMemories 시그니처 파괴) | 대응 | 의도된 변경(I3). TS 컴파일이 누락 호출부 감지(빌드 PASS). `embedCfgSource` JSDoc 추가로 계약 명시 | `107b7617c` |
| W#5 Maint/Test (buildCosineMatch 파라미터 순서) | FIX | recall/dedup 파라미터 순서 계약($1=vector…$4=임계) 직접 어설션 테스트 2건 추가 | `107b7617c` |
| W#6 Test (IE hydrateState 폴백 미검증) | FIX | 구 평면 키 `_resumeState.lastExtractionTurnSeq` 로 resume 시 watermark 폴백 통합 테스트 추가 | `107b7617c` |
| W#7 Doc (readExtractionWatermark JSDoc) | 확인 | JSDoc 이미 존재(신 namespace 우선/구 평면 키 폴백/undefined 반환 계약 기술). reviewer 가 diff 미포함으로 미확인했을 뿐 — 추가 조치 불필요 | — |
| INFO #3 | 채택 | `updateSummaryState` "두 필드 함께 제공" 계약 JSDoc 추가 | `107b7617c` |
| INFO #5 | 채택 | IE `hydrateState` IIFE → `const extractionSeq` 분리(스타일 통일) | `107b7617c` |
| INFO #9 | 채택 | `readExtractionWatermark` seq=0 경계(유효 watermark) 테스트 추가 | `107b7617c` |
| INFO #10 | 채택 | `updateSummaryState` 빈 객체 호출 시 필드 클리어 테스트 추가 | `107b7617c` |
| INFO #11 | 채택 | `memoryState` 병합 시 타 키 보존 테스트 추가 | `107b7617c` |
| INFO #12 | 채택 | `saveMemories.embedCfgSource` JSDoc 추가 | `107b7617c` |
| INFO #15 | 채택 | 테스트 헬퍼 `wmOf` → `getWatermark` 개명 | `107b7617c` |
| INFO #1,2,4,6,13,14,16 | 비채택 | SQL dim 화이트리스트/typeof 방어 충분·narrow 타입/Zod 는 신뢰경계 변경 시·whereClause 공백 무해·태그 범례 plan 존재. 현 상태 안전 — 근거 SUMMARY 기재 | — |

> scope reviewer 출력 미착지(재시도 필요)는 변경 성격상 무위험: diff 14파일 전부 agent-memory/conversation-thread/ai 노드 모듈 한정으로 scope creep 없음.

## TEST 결과

resolution fix 후 재수행:
- lint: 통과 (`_test_logs/lint-20260627-213137.log`)
- unit: 통과 (`_test_logs/unit-20260627-213233.log`) — 관련 12 suites / 309 tests green
- build: 통과 (`_test_logs/build-20260627-213323.log`)
- e2e: 통과 215 tests (`_test_logs/e2e-20260627-213515.log`)

## 보류·후속 항목

- W#3 AgentMemoryAdminService 분리 → Batch 3(프론트/어드민)에서 처리 (이미 plan 백로그 항목).
- W#2 간접 프롬프트 인젝션 → 기존 구조적 한계, 별도 로드맵.
