## 발견사항

- **[WARNING]** `parallel-p2-followups.md` in-progress→complete 이동 후 `plan/complete/` 내부에 남은 dead 백링크 5곳 (target 자신이 고친 것과 동일한 원인, 동일 종류의 링크가 plan 쪽에는 미반영)
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 (본 diff 의 신규 정정 문구 — "plan-coherence-checker 가 담당하는 것은 `plan/**` **문서 내부**의 링크 위생이지 spec→plan 링크가 아니다"). target 이 스스로 이 책임 범위를 명문화했다.
  - 관련 plan: `plan/complete/parallel-p2-followups-done.md:5`, `plan/complete/cross-node-warning-rules.md:4,69,79`, `plan/complete/backend-msg-i18n-impl.md:12` — 전부 `[...](../in-progress/parallel-p2-followups.md)` 형태의 markdown link.
  - 상세: 이번 변경분(커밋 `ceaaf2d69`)이 `plan/in-progress/parallel-p2-followups.md` 를 `plan/complete/parallel-p2-followups.md` 로 rename 했다. `spec/conventions/{cross-node-warning-rules,execution-context,node-cancellation}.md` 4곳의 동일 링크는 새 경로(`plan/complete/...`)로 정확히 갱신됐음을 실측 확인했으나(`git diff origin/main...HEAD`), 같은 옛 경로를 참조하는 `plan/complete/` 문서 3개(5개 링크 인스턴스)는 갱신되지 않아 실제로 dead path 다(`ls plan/in-progress/parallel-p2-followups.md` → 파일 없음). `spec-link-integrity.test.ts` 는 `collectSpecMarkdown()` 이 `spec/**.md` 만 스캔하므로(코드 확인 완료) 이 dead link 들은 어떤 build 가드도 잡지 않는다. 직전 plan-coherence 실행(`review/consistency/2026/07/16/23_36_57/plan_coherence.md`)도 "5개 dead-link 위치"로 `spec/` 쪽 4곳만 검증했을 뿐 `plan/complete/` 내부 backlink 는 점검 범위에 없어 이번에 처음 드러났다.
  - 부가: `plan/complete/cross-node-warning-rules.md` 의 "종결 결정"·"수용 기준" 절은 "3중 가드를 한 흐름으로 묶는 browser+HTTP 통합 e2e" 를 `parallel-p2-followups.md §2~4` 가 "소유·추적 중"이라고 서술하지만, 그 plan 이 종결되며(`ceaaf2d69` 커밋 메시지 ④) 해당 e2e 는 실제로 **won't-do**(에디터 e2e 인프라 부재)로 확정됐다. 위임 서술이 아직 "다른 곳에서 진행 중"인 것처럼 읽혀 후속 항목이 실질적으로 무효화된 사실이 반영되지 않았다.
  - 제안: 5개 링크를 `../complete/parallel-p2-followups.md` 로 정정. `cross-node-warning-rules.md` 의 위임 서술도 "미이행·won't-do 로 종결(2026-07-16)" 로 갱신 권장.

- **[INFO]** (추적 메모 이월, 비차단) `execution-engine-residual-gaps.md:56` 이 이미 삭제된 `plan/in-progress/parallel-p2.md §1` 을 "아직 in-progress(미완료)" 전제로 인용 — 2026-07-03 defer 확정 문구로 미정리된 채 이전 감사(`23_36_57`)에서 지적된 그대로 잔존. 본 target 변경과 직접 연동되지 않고 필수 처리 대상 아님(이전 판정 유지).

## 요약
target(`spec/conventions/`)의 실제 diff(`origin/main...HEAD`)는 `audit-actions.md`·`cafe24-api-catalog/*` 전면이 아니라 `cross-node-warning-rules.md`/`execution-context.md`/`node-cancellation.md`/`spec-impl-evidence.md` 4개 파일의 소규모 정정 — `parallel-p2-followups.md` in-progress→complete 이동(커밋 `ceaaf2d69`)에 따른 plan 링크 경로 갱신과 `spec-link-integrity.test.ts` 스캔 범위(plan-coherence-checker 책임 경계) 정정 문구다. 직전 consistency-check 세션(`23_36_57`)이 지적했던 두 WARNING(`10-parallel.md` §2-E 유실 커밋먼트, `rag-quality-improvement.md` 미체크박스 후속)은 모두 이번 커밋에서 실측 확인상 정확히 해소됐다. 다만 동일한 plan 이동이 유발한 dead link 가 `spec/` 쪽만 고쳐지고 `plan/complete/` 내부의 형제 문서(3개 파일, 5개 링크)에는 반영되지 않았다 — target 문서 자신이 이번에 "plan/** 내부 링크 위생은 plan-coherence-checker 소관"이라고 명문화했다는 점에서 이 갭은 본 검토의 정확한 소관 영역이다. 활성 미해결 결정과의 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도
LOW