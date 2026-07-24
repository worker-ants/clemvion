STATUS=success plan_coherence review complete (1 WARNING, 1 INFO)
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `form.handler.ts` D1 위반의 "별건 백로그 분리" 가 실제로는 어디에도 만들어지지 않고, sibling in-progress plan 은 정반대 결론을 그대로 유지 중
  - target 위치: `plan/in-progress/presentation-thread-optout-drift.md` §비목표 두 번째 항목 ("동반 WARNING (`form.handler.ts` 의 `{ ...rawConfig }` spread 가 node-output.md §7 D1 위반) — `codebase/` 라 developer 범위다 … 별건 백로그로 분리한다")
  - 관련 plan: `plan/in-progress/node-output-redesign/form.md` (라인 138, 154) · `plan/in-progress/node-output-redesign/README.md` (라인 190, 192, 328)
  - 상세: target 은 `form.handler.ts:44` 의 `config: { ...rawConfig }` 가 `spec/conventions/node-output.md` "config echo 구현 방식 — 명시 enumeration 의무화 (D1)" 절의 **명시적 금지**("❌ 금지 — spread 패턴")를 위반한다고 정확히 진단했다(실측 확인: 코드에 현재도 존재). 그런데:
    1. target 의 체크리스트에는 이 발견을 별도 백로그로 등록하는 항목이 없고, `plan/in-progress/**` 전체를 뒤져도 이 사안을 추적하는 새 항목이 존재하지 않는다 — "별건 백로그로 분리한다" 는 서술만 있고 실제 분리(신규 plan 항목 생성)가 없다.
    2. 이 사안의 자연스러운 서식지인 `node-output-redesign/form.md` 는 **정반대 결론**을 담고 있다: "Principle 7: `{ ...rawConfig }` (`:44`) 으로 모든 raw config echo — **가장 충실한 raw echo 구현**"(라인 154, 2026-06-25 코드 재검증 갱신분 — D1 정책(commit `150d45c19`, 2026-05-17)보다 **이후** 시점). `README.md` 도 form 을 "부합 (잔여 권고 없음) 노드 (16종)"(라인 190)에 포함시키고, D1 remediation 대상 11개 노드 목록(라인 328: if-else/switch/loop/map/foreach/merge/carousel/chart/template/table/variable-modification)에는 form 이 애초에 빠져 있다. 즉 두 sibling 문서가 "이 spread 는 문제없다"는 stale 결론을 여전히 공표하고 있는데, target 이 그 반례를 새로 발견하고도 sibling 문서를 갱신하거나 최소한 참조 각주를 남기지 않는다.
  - 제안: target 체크리스트에 "form.handler.ts D1 위반 별건 백로그 등록" 항목을 실제로 추가하거나 (신규 `plan/in-progress/` 항목 또는 기존 `node-output-redesign/form.md` §종합 개선안에 `- [ ]` 추가), 최소한 `node-output-redesign/form.md:154`·`README.md:190/328` 에 "D1 재검토 필요(형제 4개 handler 는 enumeration, form 만 spread — 2026-07-23 재발견)" 각주를 달아 두 plan 문서 간 모순을 해소한다.

- **[INFO]** 선행 plan(`presentation-previousoutput-spec-drift.md`) 체크리스트는 전량 완료(`[x]`)이나 여전히 `plan/in-progress/`에 남아 있음
  - target 위치: target 문서 상단 "> 선행: PR #997 …" 인용부
  - 관련 plan: `plan/in-progress/presentation-previousoutput-spec-drift.md`
  - 상세: 해당 plan 은 체크리스트 7항목이 모두 `[x]`이고 `/ai-review`까지 완료로 기록돼 있어 실질적으로 종결 상태다. target 이 이를 "선행" 으로 정확히 인용하는 점은 문제없으나, 완료된 plan 은 `plan/complete/` 로 이관하는 것이 라이프사이클 규약이다. 미이관 상태가 target 작업을 막지는 않는다.
  - 제안: target 작업과 무관하게, 해당 plan 을 `plan/complete/` 로 이관하는 정리를 (target 또는 별도 turn 에서) 수행.

### 요약
target(`presentation-thread-optout-drift.md`)이 전제하는 선행 plan(`previousOutput` 정정, PR #997)은 체크리스트가 완전히 해소돼 있어 진짜 blocking 미해소는 없고, target 이 다루는 §4.6 opt-out 필드의 실측(런타임 게이트 vs schema 표면)도 다른 in-progress plan 의 서술(`ai-agent-tool-connection-rewrite.md`의 "신규 5필드", `conversation-thread.md` §2.4)과 충돌하지 않는다. 다만 target 이 자체적으로 발견한 "form.handler.ts 의 spread 가 D1 위반" 이라는 사실을 "별건 백로그로 분리한다"고만 적고 실제로 분리(추적 항목 생성)하지 않아, 같은 사실을 정반대로 결론 내린 sibling in-progress plan(`node-output-redesign/form.md`·`README.md`)과의 모순이 그대로 남는다 — 후속 항목 누락 1건(WARNING)으로 정리했다. 그 외 CRITICAL 급 미해결 결정 우회는 발견되지 않았다.

### 위험도
LOW
