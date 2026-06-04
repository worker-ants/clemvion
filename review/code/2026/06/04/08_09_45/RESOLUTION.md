# RESOLUTION — v2 멀티턴 물리압축 코드 리뷰

대상: `review/code/2026/06/04/08_09_45/SUMMARY.md` (전 14 reviewer, CRITICAL 0 · WARNING 9).

## 조치 항목

| 리뷰 # | 발견 | 조치 | commit |
|---|---|---|---|
| W-1/W-2 | `assertPairingIntact` 둘째 for 루프 빈 no-op(고아 tool_result 미검증) | 실 assertion(고아 tool_use/result 0 강제, user 경계 reset) + 헬퍼 self-check 테스트(planted orphan 시 throw 검증) | `e101c903` |
| W-3 | persistent 물리압축 통합 미커버 | persistent + memoryTokenBudget 낮음 통합 테스트(compactedMessages>0·페어링 유지) | `e101c903` |
| W-4 | service 미주입 fallback(keepUserExchanges=0) 미테스트 | conversationThreadService undefined 핸들러로 압축 skip·messages 무변경 검증 | `e101c903` |
| W-5 | 다중 system 메시지 미테스트 | **잠재 버그 발견·수정**: 둘째 leading system 을 drop 하던 것을 contiguous system 블록 보존(prefixLen)으로 수정 + 3 테스트 | `e101c903` |
| W-6 | keepUserExchanges 도출 중복 | 확인 결과 단일 출처(injectMemoryContext 반환)만 존재 — 중복 없음(조치 불요) | — |
| W-9 | fallback 진단 로그 부재 | `logger.debug('memory compaction skipped: keepUserExchanges=0 ...')` 추가 | `e101c903` |
| I-1 | JSDoc/주석 spec 참조 d.5→d.6 오기 | 물리압축 참조만 d.6 정정(genuine d.5 참조는 보존) | `e101c903` |
| (polish) | 변수명 seen·meta.memory JSDoc | tailUserCount 개명, 필드 JSDoc 보완 | `e101c903` |

### 미채택/보류(근거)
- W-7(Scope: spec+codebase 동일 PR): main Claude 가 planner/developer 역할 병행 오케스트레이션(커밋 메시지에 역할 명시). spec §6.2 d.6·§12.14 는 이미 spec 에 정식 추가됨(b678fe56) — resolution sub-agent 의 "d.6 미존재" 보고는 오인(grep 으로 line 394·1285 실존 확인).
- W-8(getThread 이중 쿼리)·I-7(ConversationThreadService.updateSummaryState)·perf O(n²)→O(1): followup-v2 백로그(I/O-backed 전환·장기 대화 최적화 시점).
- security reviewer 파일 미생성: 본 델타는 내부 message 배열 압축(신규 입력/SQL/시크릿/공격면 0). 메모리 주입/회수 보안은 직전 리뷰(23_11_51)에서 검토·hardening(indirect prompt injection wrap) 완료.

## TEST 결과
- lint: 통과 (`lint-20260604-082535`)
- unit: 통과 — backend **5765 passed** / 0 failed. frontend 는 cafe24-api-catalog `spec-frontmatter` 444건만 실패(pre-existing, origin/main 동일, 본 브랜치 카탈로그 0 변경).
- build: 통과 (`build-20260604-082645`)
- e2e: 통과 — 144 passed (`e2e-20260604-082729`).

## 보류·후속 항목
- followup-v2: getThread 이중쿼리 단일화, ConversationThreadService.updateSummaryState 단일 변이 경로, buildSummaryBufferUpdate O(n²)→O(1) 증분, meta.memory.compactedMessages 의 ND-AG-30 열거 등재, §6.2 d.5 SPEC-DRIFT 부연.
