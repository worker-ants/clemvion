# Consistency (--impl-done) 통합 — IE persistent 메모리

**BLOCK: NO** — Critical 0 (rationale 의 CRITICAL 2건은 FALSE POSITIVE, git 반증). 5 checker.

## 조치한 legit 발견
| # | checker | 발견 | 조치 |
|---|---|---|---|
| 1 | convention(W) | `3-information-extractor.md` status:implemented 인데 pending_plans 보유(exec-park dangling + 본 plan) — spec-impl-evidence §3 위반 | 본 plan 완료 이동(plan/complete + spec_impact) + 4개 spec pending_plans 에서 제거 + 3-IE dangling exec-park 제거 → 3-IE implemented·pending 없음 valid |
| 2 | plan-coherence(W) | followup-v2 의 IE memoryStrategy 항목 미갱신 | `[x] IE persistent 완료 + text_classifier 영구 제외` 로 갱신 |
| 3 | cross-spec(INFO) | 0-common §10 callout·17-agent Overview 의 `∈{summary_buffer,persistent}`/superset 표현이 IE 에 summary_buffer 있는 듯 오독 | IE=persistent 만, superset 은 AI Agent 문맥 명시 |

## 무조치(minor/style)
- convention(W): 0-common §10 memoryStrategy Type 셀의 노드별 inline 표기 — 내용이 명확·정확해 유지(스타일 선택).
- cross-spec(INFO): 3-IE §5.1/§5.6 meta.memory echo — IE 가 recalledCount 를 meta.memory 로 echo 안 함. backlog(관찰성 nicety).
- naming: NONE(IE memory 필드·메서드 ai_agent 동일명은 의도적 공유, 별 클래스/로컬타입이라 충돌 없음).

## ⚠️ FALSE POSITIVE (rationale-continuity, merge-base 미사용 오귀속 — git 반증)
rationale 가 본 PR diff 밖(타 PR 머지분)을 본 PR 로 오귀속. **검증: `git diff 21fa8194..HEAD` 에 `1-ai-agent.md`·`execution-engine.md`·`1-data-model.md` 변경 0, summaryModel/extractionModel 삭제 0, conversation-thread.md 는 순수 additive(§7 로드맵의 §8.4·contextScope·summaryModel "채택 완료" 전부 유지+IE 추가).**
- rationale CRITICAL "summaryModel/extractionModel §12.12 재역전" → FP (1-ai-agent 미변경).
- rationale CRITICAL "contextScope 세 노드 출하 철회·§5 제목 축소·공유유틸 삭제" → FP (conversation-thread additive, A2 유지).
- rationale WARNING "§8.4 Execution.conversation_thread 삭제"·"IE _resumeCheckpoint 역전"·"Phase B 후퇴" → FP (해당 파일 본 PR 미변경).

## checker별 BLOCK: cross-spec NO · rationale NO · convention NO · plan-coherence NO · naming NO
