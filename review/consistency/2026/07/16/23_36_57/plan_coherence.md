# Plan 정합성 Check — spec-draft-plan-grooming (D1/D2/D3)

## 사전 확인 (실제 저장소 상태 대조)

target draft 는 "2026-07-16 plan grooming" 이 이미 `git add`로 staged 된 상태(rename)에서 spec 측 후속을 다루는 draft다. 실측 확인 결과:

- `plan/in-progress/rag-dynamic-cut.md` → `plan/complete/` staged rename 확인 (D1 전제 충족).
- `plan/in-progress/spec-sync-mcp-client-gaps.md` → `plan/complete/` staged rename 확인 (D2 전제 충족).
- `plan/in-progress/parallel-p2-followups.md` → `plan/complete/` staged rename 확인 (D3 전제 충족).
- `spec/5-system/9-rag-search.md` frontmatter 는 **아직** `pending_plans: [plan/in-progress/rag-dynamic-cut.md]` (dead 경로) — D1 미적용 상태, draft 가 다루는 gap 과 일치.
- `spec/5-system/11-mcp-client.md` frontmatter 는 **아직** `status: partial` / `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` (dead 경로) — D2 미적용 상태, draft 와 일치.
- D3 의 5개 dead-link 위치(`10-parallel.md` L211/L230, `execution-context.md` L45, `node-cancellation.md` L18, `cross-node-warning-rules.md` L20) 전부 실측 확인 — 정확히 일치. §2-E stale 앵커 주장도 확인(현재 `parallel-p2-followups.md` 구조: §1/§2~4/§5/§6/§7, §2-E 없음).
- `rag-quality-improvement.md` 의 "side effect: 이미 반영" 주장도 실제 staged diff 로 확인됨(§7 머리말 2026-07-16 노트 존재).
- `parallel-p2-followups.md` 를 `pending_plans` 로 참조하는 spec 은 전수 검색 결과 0건 — D3 의 "status 승격 파급 없음" 주장 확인.
- D2 의 won't-do 근거(§3.3 "hint 일 뿐", 6주 무불만, JSONB infra 비용)는 `plan/complete/spec-sync-mcp-client-gaps.md` 자체의 종결 노트와 문구 수준으로 일치. call-phase errors[] 등 인접 잔여도 `plan/complete/mcp-client-diagnostics-followups.md` 로 이미 별도 완결되어 고아 없음.

이상은 모두 target 과 plan 상태가 일치함을 뒷받침한다.

## 발견사항

- **[WARNING]** D1 이 `rag-quality-improvement.md` 에 승계시킨 4개 미구현 표면 중 2개가 실제 추적 항목(체크박스)이 없음
  - target 위치: draft D1 "근거" 3~4번째 bullet ("이 4건의 실제 책임 plan 이 `rag-quality-improvement.md`(SoT 로드맵, §7.B/C/E)다")
  - 관련 plan: `plan/in-progress/rag-quality-improvement.md` §7 머리말(2026-07-16 갱신 노트, L188-193)
  - 상세: 노트가 승계했다고 선언하는 4건 — ① 멀티-KB 리랭크, ② `ef_search` clamp 정밀 튜닝, ③ D2 escalate 정량 임계 A/B, ④ 모델 변경 시 자동 재임베딩 트리거 — 중 **③은 §7.C 에, ②는 §7.E 마지막 bullet 에 실제 체크박스로 존재**하지만, **①(멀티-KB 리랭크)과 ④(자동 재임베딩 트리거)는 plan 본문 어디에도 체크박스/Phase 항목이 없다** — 오직 이 2026-07-16 요약 노트 문장 안에서만 언급된다(전수 grep 확인: "멀티-KB"·"재임베딩 트리거" 는 §7 머리말 문장 이외 등장 0회). `9-rag-search.md §3.3.2`(멀티-KB 리랭크는 후속)과 `§Rationale`(자동 재임베딩 트리거는 "비용·UX 정책 결정이 더 필요해 별도 후속으로 분리")이 실제 원문에서 언급하는 항목인데, 그 "후속"의 착지점이 서사적 선언뿐이고 실행 가능한 추적 단위가 없다.
  - 제안: `rag-quality-improvement.md` §7(예: §7.E 리뷰 backlog 또는 신규 §7.F)에 이 2건을 명시적 `[ ]` 항목으로 추가한다. 이는 D1 자신의 논리와도 정합적이다 — D1 은 "`pending_plans` 를 비우면 거짓 `implemented` 승격이 강제된다"는 이유로 `partial` 유지를 택했는데, 같은 논리가 `rag-quality-improvement.md` 내부에도 적용된다: 이 plan 이 (다른 §7 체크박스들이 모두 닫혀) `complete/` 로 이동하는 시점에 ①·④가 체크박스로 존재하지 않으면 "잔여 0" 판정이 실제로는 거짓이 되고, `9-rag-search` 가 실제로는 미구현 표면이 남았는데도 `implemented` 로 승격될 위험이 생긴다.

- **[INFO]** `execution-engine-residual-gaps.md` G2 절이 이미 삭제된 `parallel-p2.md` 를 "아직 in-progress(미완료)" 전제로 인용 (target 과 직접 무관, 참고용)
  - target 위치: 해당 없음(이 draft 는 다루지 않음)
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` L56 ("전제 미해소: errorPolicy schema 노출 선행 plan `parallel-p2.md §1` 이 아직 `plan/in-progress/` (미완료)")
  - 상세: `parallel-p2.md`(본체)는 git 이력상 오래전(`chore(plan): parallel-p2.md 삭제`) 삭제되었고 현재 저장소에 존재하지 않는다 — L56 문구는 stale. 다만 같은 절 상단(L47, 2026-07-03 사용자 결정)이 이미 "G2 본질(errorPolicy='continue' 분기)은 defer 확정"이라 별도로 명시해 실질적 차단은 이미 해소·확정된 상태이며, D3(parallel-p2-followups.md 종결)와도 직접 연동되지 않는다(별개 파생 문서인 `parallel-p2.md`를 인용할 뿐 `parallel-p2-followups.md` 자체는 인용 안 함).
  - 제안: 본 grooming PR 의 필수 처리 대상은 아니나, 다음 `execution-engine-residual-gaps.md` 접촉 시 L56 을 "defer 확정(2026-07-03)" 최신 문구로 정리하는 것을 권장(추적 메모).

## 요약

target draft(D1/D2/D3)는 실제 staged plan 이동(rag-dynamic-cut·spec-sync-mcp-client-gaps·parallel-p2-followups → complete/) 및 관련 plan 문서 내용과 문구 수준까지 정합하며, 검증 가능한 5개 dead-link 위치·§2-E stale 앵커·pending_plans 소유권 주장 모두 실측과 일치했다. `ai-agent-tool-connection-rewrite` 등 다른 in-progress plan 의 "결정 필요" 항목과의 충돌도 없다(도메인이 겹치지 않음 — mcp_*/tool_* prefix 분리, rag-search 무관). 유일한 실질적 갭은 D1 이 `rag-quality-improvement.md` 에 위임한 4개 책임 항목 중 2개(멀티-KB 리랭크·자동 재임베딩 트리거)가 그 plan 본문에 실행 가능한 추적 단위 없이 서사적 선언으로만 남아있다는 점 — D1 자신이 방지하려던 "거짓 `implemented` 승격" 위험을 내부적으로 재현할 소지가 있어 WARNING 으로 표기했다. plan 이동 자체나 D2/D3 의 정합성에는 문제가 없다.

## 위험도
LOW
