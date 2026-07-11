# Consistency SUMMARY — impl-done: EIA 클라이언트 context 타입 + 링크 가드

- 모드: `--impl-done` (scope `spec/5-system/14-external-interaction-api.md`)
- diff: `1682777fe..HEAD` (4커밋)
- checker: 5/5 SUCCESS

## BLOCK: NO (Critical 0)

Critical 0 · Warning 3(실질 1). rationale NONE · naming NONE · cross_spec/plan/convention WARNING.

## 실질 조치

### W1. §4.2 SoT + test 주석이 frontend/src 누락 (cross_spec·convention·naming 수렴)
`dedc411fd` 에서 `CODEBASE_SOURCE_ROOTS` 에 `codebase/frontend/src` 를 추가했으나, `spec-impl-evidence.md §4.2` 표(428134b64 시점)와 `spec-link-integrity.test.ts` 주석이 3-루트로 stale. 문서-코드 불일치.
→ **fixed**: 둘 다 `{backend,frontend,channel-web-chat,packages}` 로 정정.

### W2. plan item 2·4 체크박스 `[ ]` (plan_coherence)
구현+테스트+리뷰 완료인데 미체크.
→ **fixed**: `[x]` flip + 완료 노트.

### W3. W-spec-edit 후속 미등재 (plan_coherence)
developer 의 `spec-impl-evidence.md §4.2` 편집이 durable follow-up 으로 plan 에 없음.
→ **fixed**: `§리뷰 후속` 에 "편집 절차 사후 확인(planner/사용자)" 등재.

## 절차 이슈 (acknowledged)

### convention WARNING2 — developer 가 spec/ 편집
CLAUDE.md 상 `spec/` 는 planner 트랙. 본 PR 에서 §4.2 를 developer 가 직접 편집. checker 지적: self-justify 의 "subagent write isolation" 논리가 Agent-tool write 격리와 CLAUDE.md session handoff 를 혼동. 
→ **판단**: 가드 확장에 수반된 SoT 정합화라 내용은 정확(impl-done 이 검증). 절차 경계는 후속(§리뷰 후속 등재)에서 planner 사후 확인. **사용자에게 보고** — 향후 유사 정합화는 planner handoff 권장.

## 정합 확인 (위반 없음)

- rationale NONE: discriminator 미재도입·conversationThread null 미정규화·과잉 DTO 없음·wire 무변경. deferred 항목(additionalProperties:false, buildWaitingContext) 미유입.
- naming NONE: `ButtonsContext`/`NodeOutputContext`/`WaitingContext` 신조어, cross-package homonym = `ExecutionStatus` 선례. 가드 헬퍼명 충돌 0.
- cross_spec: client `WaitingContext` shape = backend `ExecutionStatusDto.context`(#904) 필드 parity. §5.4·§R17·§1-4 준수. wire 무변경.

§4.2 정정으로 W1 해소 → impl-done 재실행으로 수렴.
