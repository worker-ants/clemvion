# RESOLUTION — fresh ai-review (21_40_18)

대상: `review/code/2026/06/27/21_40_18/SUMMARY.md` (LOW, Critical 0). 수동 처리.
이 fresh review 는 21_13_52 의 resolution 커밋(107b7617c)을 커버하며, requirement·scope
리뷰어가 이전 RESOLUTION 전 항목 이행 + SPEC-DRIFT 해소를 직접 확인했다.

## 조치 항목

| SUMMARY # | 조치 | commit |
|---|---|---|
| W-1 (saveMemories 무음 no-op) | FIX — `saveMemories` 첫줄 `if (typeof args !== 'object' \|\| args === null) throw`. 구 포지셔널 오용 시 throw. 테스트 `I3/W-1` 추가 | `20771c845` |
| W-2 (updateSummaryState 무조건 대입) | 문서 수용 — JSDoc "두 필드 함께 제공" 계약(이전 resolution 에서 추가). 타입 narrow 는 caller 의 `string\|undefined` 와 마찰이라 미채택. 유일 호출부는 항상 둘 다 전달 | — |
| W-3 (buildCosineMatch 파라미터 순서) | 처리완료 — recall/dedup 파라미터 순서 어설션 테스트로 계약 고정(이전 resolution). 리뷰어도 "테스트로 고정됨" 인정 | — |
| W-4 (AgentMemoryService SRP) | 이월 — Batch 3 (기존 plan 백로그) | — |
| W-5 (spec changeset 미포함) | 거짓양성 — 요구사항 리뷰어가 17-agent-memory.md §3·§7 갱신 직접 확인. 본 PR 에 17-agent-memory.md 포함됨 | — |
| INFO I-10 | 채택 — readExtractionWatermark memoryState 원시값 폴백 테스트 추가 | `20771c845` |
| 기타 INFO | 비채택(현 상태 안전·규모 미미) 또는 후속 확장 시점 안내 | — |

## 별건 후속 (behind-base 충돌 회피 — 현재 main 기준 별도 spec PR)

impl-done consistency(21_39_37)가 발견한 IE spec / node-output.md 정합 2건은 **본 Batch 2
branch(merge-base 8c5fdf257, #726 이전)가 깨끗이 편집할 수 없는 파일**(#726 가 main 에서 이미
수정)이라 현재 main 기준 별도 spec PR 로 처리한다:
1. `node-output.md` meta.memory 행: `ai_agent / information_extractor` → **`ai_agent` 단독** 정정.
   IE 핸들러는 meta.memory 를 emit 하지 않음(코드 검증). Batch 1(#726) 오류.
2. `3-information-extractor.md` l.163·l.684: `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq`.

## TEST 결과 (resolution round 2 후 재수행)
- lint: 통과 (`_test_logs/lint-20260627-215658.log`)
- unit: 통과 (`_test_logs/unit-20260627-215748.log`) — 관련 120 tests green
- build: 통과 (`_test_logs/build-20260627-215850.log`)
- e2e: 통과 215 (`_test_logs/e2e-20260627-220045.log`)

## 보류·후속 항목
- 위 별건 spec PR 2건 (node-output IE / IE watermark) — Batch 2 직후 처리.
- W-4 AgentMemoryAdminService 분리 → Batch 3.
