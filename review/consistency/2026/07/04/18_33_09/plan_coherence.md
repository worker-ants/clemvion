# Plan 정합성 검토 — priority 3-tier (triggerType threading)

- 검토 모드: --impl-prep, scope=spec/5-system/
- 대상 후속 항목: `plan/in-progress/exec-intake-followups.md` §"PR2b 후속" 첫 항목 — **priority 3-tier (webhook/schedule 세분화)**
- 참조 spec: `spec/5-system/4-execution-engine.md` §4.2(PR1 jobId·triggerType 구현 메모), §4.3(수평 확장 표 "우선순위"), §8(동시 실행 제한 — admission gate 원자성 단락), §9.3(BullMQ 큐 목록), §Rationale("priority 3-tier 분리")

## 페이로드 결함 (선행 확인)

**본 세션에 전달된 `_prompts/plan_coherence.md` payload 는 target 이 `spec/5-system/` 전체(meta.json `target_path`)라고 선언하지만, 실제 첨부된 target 문서 청크는 `1-auth.md` 와 `10-graph-rag.md` 단 2개뿐이다.** 정작 이번 검토 대상인 `spec/5-system/4-execution-engine.md`(priority 3-tier §4.2/§4.3/§8/§9.3 이 위치한 문서)는 payload 에 전혀 포함되어 있지 않다. 이는 orchestrator 의 payload 조립 단계 결함으로 보이며(대용량 --impl-prep scope 를 청크 분할하다 누락 가능), 이 checker 세션만으로는 target 문서를 볼 수 없는 상태였다.

- 조치: 이 결함을 우회하기 위해 워크트리 파일시스템에서 `spec/5-system/4-execution-engine.md` 와 관련 `plan/in-progress/*.md` 를 직접 읽어 분석을 완료했다. 아래 발견사항은 이 직접 열람에 근거한다.
- 제안: orchestrator/payload 빌더가 `--impl-prep spec/5-system/` 같은 광범위 scope 를 청크 분할할 때 실제 변경 대상 파일(이번 케이스: `4-execution-engine.md`)이 누락되지 않도록 payload 조립 로직 점검 필요. 재발 시 checker 가 무관한 파일(auth/graph-rag)만 보고 실제 대상은 놓치는 거짓 PASS 위험이 있다.

## 발견사항

- **[INFO]** payload 조립 누락 — target 문서 미첨부
  - target 위치: 이 세션의 `_prompts/plan_coherence.md` (target 문서 섹션 전체)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` (검토 대상 항목 자체)
  - 상세: 위 "페이로드 결함" 참조. 이번 검토는 파일시스템 직접 열람으로 대체 완료했으므로 이번 결과 자체는 유효하나, orchestrator 파이프라인의 재발 방지가 필요.
  - 제안: consistency-checker 호출 스크립트/orchestrator 점검 (project-planner 또는 도구 관리자 영역, plan 문서 변경 아님).

### 1. 미해결 결정과의 충돌 — 없음

- `spec-draft-concurrency-cap-pr2b.md` (PR2b spec 선행 plan) 는 "사용자 결정(2026-07-04)" 으로 **priority 3-tier(triggerType threading)를 PR2b 스코프에서 명시적으로 제외**하고 "별도 후속 PR 로 분리" 라고 이미 기록했다 (`spec-draft-concurrency-cap-pr2b.md` L18, L21, L37, L56 — "ExecuteOptions·trigger payload·queue option 3레이어 변경이라 cap gate 와 직교").
- `4-execution-engine.md` §Rationale 도 동일 결정을 "priority 3-tier 분리" 항목으로 기록 (L1537).
- `exec-intake-followups.md` 의 첫 항목은 바로 이 기 분리된 후속을 그대로 인수하는 것이며, 새로운 결정을 일방적으로 내리는 게 아니라 **이미 합의된 분리 결정을 이행**하는 것이다. 충돌 없음.
- spec 본문(§4.2 L411)이 이미 설계까지 명시함: `Trigger.type`(webhook/manual/schedule) 어휘 기반 3-tier + `ExecuteOptions.triggerType` 필드 신설 → `resolveExecutionRunPriority(triggerType)` 매핑. "결정 필요" 로 열린 하위 질문(예: 큐 파티셔닝 여부)은 §4.3 표에서 이미 "후속(P2)" 로 별도 분리되어 있어 이번 항목 범위와 겹치지 않는다.

### 2. 선행 plan 미해소 — 없음 (전제 조건 충족)

- 이 항목이 가정하는 사전 조건: (a) `EXECUTION_RUN_PRIORITY` 상수 존재, (b) PR1 의 `manual` vs 트리거 2-tier priority 계산 로직 존재, (c) `execution-engine.service.ts` 에 `TODO(PR2)` 지점 존재.
- `4-execution-engine.md` §4(L379) "구현 상태" 단락에 따르면 PR1(§4.1–4.3)·PR2a·PR2b·PR3·PR4 가 모두 구현 완료 상태로 기록되어 있고, "우선순위 3-tier(webhook/schedule 세분화)만 여전히 Planned" 라고 명시한다 — 즉 이 항목의 실행에 필요한 모든 선행 인프라(intake 큐, admission gate, jobId=executionId, stalled-job 재배달)가 이미 완료돼 있다.
- `execution-engine-residual-gaps.md`(G1/G2/G3) 는 이 항목과 무관한 별개 표면(WS shutdown gate, errorPolicy continue, Redis TTL)이라 전제 충돌 없음.
- 결론: 선행 plan 미해소 없음 — 착수 가능 상태.

### 3. 후속 항목 누락 — 경미 (WARNING 아님, 확인 권고)

- `exec-intake-followups.md` 항목 설명은 `resolveExecutionRunPriority(triggerType)` 함수 신설 + `execute()` 호출부 변경만 언급한다. 그러나 spec §9.3 (BullMQ 큐 목록, L1139)의 관측 문구 "BullMQ job priority `manual`>트리거 (webhook/schedule 3-tier 세분화는 PR2)" 도 이 구현 완료 후 갱신 대상이다. plan 항목 자체에는 "spec §4.3/§8 3-tier" 라고만 적혀 있어 **§9.3 큐 목록 표의 "PR2" 미완료 문구 갱신이 명시적으로 나열되지 않았다** — 구현 완료 후 spec 갱신 시 이 표까지 함께 손대야 완전하다.
  - target 위치: `spec/5-system/4-execution-engine.md` §9.3 (BullMQ 큐 목록 표, `execution-run` row)
  - 관련 plan: `exec-intake-followups.md` "priority 3-tier" 항목
  - 상세: 누락되어도 구현 자체를 막지는 않으나, 구현 완료 후 spec 동기화 시 §4.2/§4.3/§8 세 곳 외에 §9.3 표까지 갱신 대상에 포함해야 spec 이 "구현 완료" 상태를 정확히 반영한다.
  - 제안: `exec-intake-followups.md` 항목 설명에 "§9.3 큐 목록 표 문구 갱신" 을 각주로 추가하거나, 구현 PR 의 spec 동기화 체크리스트에 §9.3 을 포함하도록 developer 에게 안내 (plan 필수 갱신은 아니고 권고 수준).

## 요약

이번 검토의 실제 target(priority 3-tier / triggerType threading)에 대해 `exec-intake-followups.md` 첫 항목은 미해결 결정을 우회하지 않는다 — 오히려 `spec-draft-concurrency-cap-pr2b.md` 에서 2026-07-04 사용자 결정으로 이미 명시적으로 분리된 후속을 그대로 인수하는 것이며, spec(§4.2/§Rationale)도 동일한 분리 결정과 설계(`Trigger.type` → `ExecuteOptions.triggerType` → priority 매핑)를 이미 기록하고 있다. 선행 인프라(PR1/PR2a/PR2b/PR3/PR4)는 모두 완료 상태로 spec 에 반영돼 있어 착수 전제 조건도 충족한다. 유일한 경미한 갭은 구현 완료 후 spec 동기화 시 §9.3 큐 목록 표의 "PR2" 문구도 함께 갱신 대상에 포함해야 한다는 점(사소한 문서 완결성 이슈). 단, 이 세션에 전달된 payload 자체가 실제 target 문서(`4-execution-engine.md`)를 포함하지 않고 무관한 파일(auth/graph-rag)만 담고 있었다는 process 결함을 발견했으며, 직접 파일시스템 열람으로 우회해 분석을 완료했다.

## BLOCK: NO

- Critical: 0
- Warning: 0 (payload 조립 결함은 INFO 로 분류 — 이번 검토 자체의 결과는 직접 열람으로 확보했으므로 결과 신뢰도에는 영향 없음)
- Info: 2 (payload 누락 재발 방지 권고, §9.3 표 갱신 권고)

STATUS: SUCCESS
