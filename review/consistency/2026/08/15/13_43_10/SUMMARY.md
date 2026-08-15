# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — Critical 없이 impl-prep 착수 가능하나, "자매 트래커 미동기화" 패턴이 같은 durationMs 작업 계열에서 이번이 다섯 번째 재발 위험(plan_coherence WARNING)이라 구현 착수 전 plan 문서 보강을 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `spec/conventions/node-cancellation.md` §2.4 매트릭스·Rationale 이 `finalizeCancelledExecution` 의 guard 완결성을 실제보다 넓게 서술 — plan 이 고치는 진짜 결함(item①: guarded UPDATE 결과 미확인 후 무조건 emit)이 이 문서만 보면 이미 처리된 것처럼 읽힘. 또한 이 문서가 plan 의 `spec_impact` 에서 누락 | `plan/in-progress/eia-db-wire-invariant.md` §① 및 frontmatter `spec_impact` | `spec/conventions/node-cancellation.md` L197 구현현황 매트릭스(`finalizeCancelledExecution` 미등재), L208-209 Rationale("guarded UPDATE 가 이미 terminal 인 행을 걸러낸다" — emit 미소비 한계 언급 없음) | `spec_impact` 에 `node-cancellation.md` 추가. item① 구현 완료 시 L197 매트릭스에 `finalizeCancelledExecution` 추가 + L208-209 문장을 EIA §6.5 의 "(2026-08-15 해소)" 캐비엇과 같은 패턴으로 정정 |
| 2 | rationale_continuity | plan 체크리스트 "§6.5 의 '알려진 예외 1건' 문구 제거" 지시가 이 저장소 및 같은 spec 파일이 세운 "취소선+해소노트 보존" 관행과 충돌할 문구로 읽힘 | `plan/in-progress/eia-db-wire-invariant.md` ② 체크리스트 두 번째 항목 | `spec/5-system/14-external-interaction-api.md` L577(durationMs 캐비엇, `~~...~~ **(2026-08-15 해소)**` 패턴), §6.5 L816 자기 서술("알려진 갭은 invariant 옆에 적는다"), `13-replay-rerun.md`·`17-agent-memory.md`·`8-embedding-pipeline.md` 의 동형 패턴 | 체크리스트 문구를 "§6.5 알려진 예외 1건 단락을 취소선 + (YYYY-MM-DD 해소) 노트로 전환 (577행과 동일 패턴, 원문 보존)" 으로 구체화 |
| 3 | plan_coherence | 새 plan `eia-db-wire-invariant.md` 의 항목 ①②③이 이미 "정본" 트래커에 거의 동일 문구로 등재돼 있는데 참조·상호 링크 없이 재등재 — 같은 durationMs 작업 계열에서 자매 트래커 미동기화가 이미 4회 반복된 패턴의 5번째 재발 조건 | `plan/in-progress/eia-db-wire-invariant.md` 전체(①②③, frontmatter) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:221-249,305-310`, `spec-draft-eia-notification-payload-contract.md:108`, `backend-lint-gate-broken-on-main.md:774-780`, 선례 `eia-terminal-payload.md:201,283-294,319-321`("네 번째다" 기록) | "다른 plan 과의 관계" 절 추가해 정본 트래커·자매 문서 명시적 링크. 체크리스트에 "자매 트래커 동시 갱신" 항목 추가. 구현 커밋과 같은 턴에 양쪽 문서 함께 닫을 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | `--impl-prep` 번들 조립이 컨텍스트 예산 초과로 이번 라운드의 실질 target(`14-external-interaction-api.md`, `4-execution-engine.md` 등)을 통째로 생략함 — 직접 Read 로 보완해 판정에는 영향 없었음 | `_prompts/*.md` 조립 payload | orchestrator 가 `spec_impact` 로 명시된 파일은 예산 절단에서 우선 보존하도록 개선 검토 |
| 2 | plan_coherence | 검토 시점 워킹트리 코드(`execution-engine.service.ts`/`retry-turn.service.ts`)가 이미 항목①②를 구현 중이나 plan 체크리스트는 전항목 미체크 — 같은 plan 계열이 이미 3회 겪은 "체크리스트-커밋 시차" 패턴 | `plan/in-progress/eia-db-wire-invariant.md:72-79` | 커밋 직전 체크박스를 함께 스테이징하는 절차 준수 |
| 3 | plan_coherence | `retry-turn-terminal-guard.md`(`cancelledBy` 추가, P2 미완료)·`backend-lint-gate-broken-on-main.md` 가 같은 `failRetryExecution`/`emitCancellationEvent` 호출부를 겨냥하는 별도 열린 항목 — 병합 시 리베이스 마찰 가능성만 인지 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` | 조치 불요, 순서만 인지 |
| 4 | convention_compliance | `spec/5-system/` 17개 파일 중 6개가 `## Overview` 대신 `## 1. 개요` 로 시작 — 기존 상태, 이번 작업과 무관 | `2-api-convention.md`·`16-system-status-api.md`·`6-websocket-protocol.md`·`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md` | 이번 PR 범위 밖. 향후 `spec/5-system/` 정리 백로그로 남길 만함 |
| 5 | naming_collision | `durationMs` 가 Execution(상위)·노드/LLM 호출(하위) 스코프에서 다른 시간 종류를 가리키지만, target 문서가 이미 §6.5·`1-data-model.md` 에 명시적 캐비엇으로 경고해 둠 | `spec/5-system/14-external-interaction-api.md` §6.5, `spec/1-data-model.md` `duration_ms` | 조치 불요, 참고용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `node-cancellation.md` 가 `finalizeCancelledExecution` guard 완결성을 실제보다 넓게 서술 |
| rationale_continuity | LOW | §6.5 "문구 제거" 지시가 취소선+해소노트 관행과 충돌할 위험 |
| convention_compliance | NONE | 정식 규약(에러코드·Redis 키·감사 액션·Swagger·API 포맷) 전부 준수 확인 |
| plan_coherence | MEDIUM | 자매 트래커(`spec-sync-external-interaction-api-gaps.md`) 미동기화 5번째 재발 위험 |
| naming_collision | NONE | 신규 식별자 충돌 없음, `durationMs` 의미 편차는 이미 문서화됨 |

## 권장 조치사항
1. `eia-db-wire-invariant.md` 에 "다른 plan 과의 관계" 절 추가 — `spec-sync-external-interaction-api-gaps.md`·`spec-draft-eia-notification-payload-contract.md` 링크 + "자매 트래커 동시 갱신" 체크리스트 항목 (plan_coherence WARNING 해소)
2. 항목 ② 체크리스트 문구를 "§6.5 취소선 + (해소) 노트 전환" 으로 구체화 — 삭제가 아니라 보존이 목적임을 명시 (rationale_continuity WARNING 해소)
3. `spec_impact` 에 `spec/conventions/node-cancellation.md` 추가하고, item① 구현 완료 시 §2.4 매트릭스·Rationale 문장을 EIA §6.5 캐비엇 패턴으로 정정 (cross_spec WARNING 해소)
4. 구현 커밋과 plan 체크리스트 갱신을 같은 턴에 동기화 (INFO #2 예방)
5. (선택) orchestrator 의 impl-prep 번들 예산 배분에서 `spec_impact` 파일 우선 보존 검토 (INFO #1)