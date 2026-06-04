# Code Review (코드 범위, 전 14 reviewer) 통합 보고서

**RISK: MEDIUM · CRITICAL 0 · WARNING 5** (전부 Testing 갭). routing=skipped(전수).

## WARNING (Testing)
1. summary_buffer multi-turn 경로 unit 미작성 (runningSummary 저장→재사용)
2. selectVolatileTail 빈 배열 엣지(summarizedUpToSeq ≥ last seq, []입력)
3. recall 실패 시 핸들러 graceful 처리 통합 케이스 부재
4. 크로스 워크스페이스 격리 명시 unit 부재(ws-2 요청 시 ws-1 미포함)
5. stripMemoryBlocks round-trip(블록 중첩 누적 방지) 미검증

## INFO 핵심
- Security(spec): 회수/추출 content sanitization 구현 확인 권장(1차 리뷰 W-2 연계).
- e2e: persistent + BullMQ 추출 enqueue e2e 시나리오(중기).
- plan: Phase G 완료 후 auto.md complete 이동.

## 1차(spec) 리뷰와 합산한 코드 조치 대상
- 보안 W-2: 회수·추출 메모리 content 를 systemPrompt 주입 전 untrusted marker 로 wrap.
- 보안 W-1: scope_key 길이 상한(≤512)/검증.
- Testing 1~5: unit 추가.
