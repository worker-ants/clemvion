# Consistency Check SUMMARY — KB WebSocket 이벤트 count drift 정정 (`--impl-done`)

- 모드: `--impl-done`, scope `spec/5-system/`
- 대상 diff: `git diff origin/main..HEAD` (base=2aa4c8093, HEAD=`31bbd1d3a` — 구현 `8c3e95319` + ai-review fix `31bbd1d3a`)
- checker: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision (5/5)

## BLOCK: NO

Critical 0. 5개 checker 전부 위험도 **NONE**.

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING)

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## Checker별 결과

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | NONE | 수정된 4개 spec 서술이 backend union(11)·실제 emit(5+5)·권위 기록 data-flow §2.5 와 정확히 일치. spec 전수 grep 결과 잔존 drift 0 (매칭은 전부 무관 FP: Logic 12종, "12개월" 등) |
| rationale_continuity | NONE | #443(`6898c4b3c`)이 제거한 것은 `graph_error` 한 줄뿐 — `embedding_error` 는 제거·재도입 이력 자체가 없어 결정 번복 불성립. embedding_error 유지는 data-flow §2.5 권위 기록과 정합, #443 은 일반 원칙이 아닌 1회성 dead-code 정리라 위반 근거 없음 |
| convention_compliance | NONE | 이벤트 명명(콜론+언더스코어)·spec 3단 구조·CHANGELOG `## Unreleased` 포맷·코드/테스트/spec 동일 커밋셋 모두 규약 준수 |
| plan_coherence | NONE | `plan/in-progress/**` 전수 스크리닝 — 이 이벤트 집합/카운트를 전제하는 진행 plan 없음. `spec-sync-websocket-protocol-gaps.md`(§4.3 외)·rag-* 등과 충돌 없음 |
| naming_collision | NONE | 신규 export `KB_EVENT_NAMES` 는 전역 사전 사용례 없는 순수 신규(closure-local 승격). union 리터럴·이벤트명 신규 추가 0 |

## INFO (참고, 조치 불필요/선택)

- rationale_continuity: `embedding_error` 유지 근거를 `6-websocket-protocol.md ## Rationale` 에 한 문장 백필하면 재질문 차단 가능(선택). → data-flow §2.5(권위 기록)·§4.3 본문·backend JSDoc 에 이미 충분히 기술돼 있어 미채택(중복 회피, 게이트 재무장 방지).
- naming_collision: 같은 디렉터리 `use-background-run.ts` 의 `BACKGROUND_RUN_EVENT_NAMES` 는 module-scope 이나 미export 인 비대칭(무관, 참고).
