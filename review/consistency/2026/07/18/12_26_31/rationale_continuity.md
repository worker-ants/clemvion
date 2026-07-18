# Rationale 연속성 검토 — spec-draft-ai-agent-nodes-drift-disposition

대상: `plan/in-progress/spec-draft-ai-nodes-drift-disposition.md` (spec_impact: `spec/4-nodes/3-ai/{0-common,1-ai-agent,2-text-classifier,3-information-extractor,_product-overview}.md`, `spec/4-nodes/_product-overview.md`)

## 조사 방법

- target 이 인용하는 코드 SoT·durable drift plan(`plan/in-progress/spec-drift-ai-agent-outport-countmax.md`, `plan/in-progress/node-output-redesign/{ai-agent,information-extractor}.md`)을 원문 대조.
- 4개 항목이 편집을 예고하는 실제 spec 파일(`spec/4-nodes/3-ai/1-ai-agent.md` §3.2/§7.3/§7.5/§12, `3-information-extractor.md` §5.5/frontmatter, `0-common.md` §5/§9, `spec/conventions/node-output.md` Principle 1.1/3.2/4.4/4.5/8.2/11) 원문 확인.
- git log(`-S`)로 ND-AG-24 "하위 호환" 문구의 이력 추적 — 별도 Rationale 결정이 아니라 `refactor(docs): prd/ 전체를 spec/ 으로 흡수` 커밋에서 유입된 PRD 잔재임을 확인 (target 의 "번복이 아니라 잔재 정정" 주장 뒷받침).

## 발견사항

- **[WARNING]** "cross-node 대칭" 근거로 IE 를 낮추면서 정작 ai-agent 본문엔 동형 caveat 미적용
  - target 위치: 항목 3 (Edit 3a/3b, `3-information-extractor.md` frontmatter `status→partial`+`pending_plans`, §5.5 뒤 caveat 삽입)
  - 과거 결정 출처: `plan/in-progress/node-output-redesign/information-extractor.md:177` — "(2026-06-25) ... `resumed` status 를 AI 대화 turn 에서 emit 안 함 ... spec §5.5 는 여전히 documented but unimplemented (ai-agent §7.5 와 동일 미흡)" 및 `plan/in-progress/node-output-redesign/ai-agent.md:217` — "잔여 선택지: AI 메시지 경로에도 form/buttons 처럼 structured `setStructuredOutput(resumed)` 1회 emit 을 추가할지 (conventions §4.4/§4.5 통일성) — 미결정"
  - 상세: 두 durable plan 문서 모두 `ai_agent` §7.5 와 `information_extractor` §5.5 의 "structured `resumed` 스냅샷 미emit" gap 이 **동일**하다고 명시하며, IE plan 은 "ai-agent 와 동시 처리 권고"까지 적어 두었다. 그러나 target 의 Edit 3b 는 IE `§5.5` 에만 "structured `resumed` 스냅샷 미emit(Planned)" 캐비어를 삽입하고, `1-ai-agent.md` §7.5(현재 line 757-793, 캐비어 없이 JSON 예시를 확정 서술)는 이번 draft 범위에서 전혀 건드리지 않는다. 결과적으로 동일한 미구현 gap 에 대해 IE 문서는 "Planned"로 명시적 caveat 를 갖고 ai-agent 문서는 여전히 구현된 것처럼 서술되는 비대칭이 생긴다 — "cross-node 대칭"을 status 하향의 근거로 쓰면서 그 대칭을 caveat 수준까지는 적용하지 않은 것.
  - 제안: (a) 같은 draft 범위 안에서 `1-ai-agent.md` §7.5 뒤에도 동형 "(Planned)" 캐비어를 추가해 완전한 대칭을 이루거나 (두 plan 문서의 "동시 처리 권고"를 그대로 이행), (b) IE 만 우선 처리할 의도라면 §12.17(신규 Rationale) 또는 항목 3 자체에 "ai-agent §7.5 caveat 는 별도 후속으로 분리한다"는 명시적 scope 제한 근거를 남겨 향후 재검토 시 의도된 축소임을 알 수 있게 한다.

- **[WARNING]** Principle 4.4 / 4.5 귀속 자기모순을 0-common.md §5 안에 새로 생성
  - target 위치: 항목 4, Edit 4b (`0-common.md:83` 본문 개정)
  - 과거 결정 출처: `0-common.md:89`(target 스스로 "이미 올바르게 귀속 → 무변경"이라 명시한 라인) — `output.interaction.{type, data, receivedAt}` 을 **Principle 4.5** 로 귀속. `spec/conventions/node-output.md` Principle 4.4("Resumed 상태의 `output` 내용")·4.5("`interaction.data` payload 규격") 의 정의 분리.
  - 상세: Edit 4b 는 §5 도입부에서 wrapper 3분류(result/error/interaction)의 근거를 "(CONVENTIONS Principle 1.1/3.2/4.4/8.2 — result 네이밍·error·interaction·category 분담)" 으로 재서술하며 interaction 을 **4.4** 에 귀속한다. 그런데 바로 6줄 아래 표는 동일한 `output.interaction.{type, data, receivedAt}` 항목을 "**Principle 4.5**"로 귀속하고 있고, target 자신이 이 라인(L89)을 "이미 올바른 귀속이라 무변경"으로 판정했다. 같은 섹션(§5) 안에서 동일 개념(`output.interaction` wrapper)에 대해 도입부는 4.4, 본문 표는 4.5 로 서로 다른 Principle 번호가 병존하게 된다. 이번 항목 4 자체가 "Principle 오귀속 정정"을 목적으로 하므로, 그 정정이 새로운 내적 불일치를 남기는 것은 목적과 상충한다. (부수: "1.1(config↔output 직교/result 네이밍)"도 이중 개념을 한 번호에 묶어 정밀도가 다소 낮다 — `output.result.*` 명명 자체의 원 소스는 Principle 8.2/1 에 더 가깝다.)
  - 제안: §5 도입부의 괄호 표기를 "Principle 1.1/3.2/**4.4~4.5**/8.2" 로 병기하거나, 4.4 를 쓰려는 의도(구조적 개념 도입)와 4.5(payload shape)의 구분을 한 문장으로 명시해 L83·L89 가 서로 다른 근거로 읽히지 않게 한다.

- **[INFO]** durable drift-tracking plan(`spec-drift-ai-agent-outport-countmax.md`) 미동기화
  - target 위치: draft 전체(항목 1, Edit 1a/1b/1c) — frontmatter/plan 파일 갱신 미포함
  - 과거 결정 출처: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 (미해결 체크박스) 및 `1-ai-agent.md` frontmatter `pending_plans` 의 해당 항목
  - 상세: 항목 1 은 정확히 이 durable plan 의 Critical 1 이 제시한 처분 (a)("실제 코드가 §3.2 를 지지하면 두 `_product-overview.md` 의 하위호환 문구 삭제")를 그대로 수행한다. 그러나 target 은 그 plan 문서의 체크박스 갱신([ ] → [x] + 해소 근거)이나 `1-ai-agent.md` frontmatter 의 `pending_plans: [..., plan/in-progress/spec-drift-ai-agent-outport-countmax.md]` 항목 정리를 포함하지 않는다. 이 plan 자체가 "consistency `plan_coherence` 4회 연속 WARNING으로 재발견됐다"는 이력을 이미 갖고 있어(파일 상단 메모), 미동기화 시 동일한 반복 탐지 루프가 재발할 소지가 있다.
  - 제안: 이번 draft 적용 시 `spec-drift-ai-agent-outport-countmax.md` Critical 1 을 `[x]` 로 갱신 + §12.17 참조 링크 기록, Critical 2 가 이미 해소된 상태이므로 두 Critical 이 모두 닫히면 plan 을 `complete/` 로 이동, `1-ai-agent.md` frontmatter `pending_plans` 에서 해당 항목 제거를 함께 반영.

## 요약

Draft 는 4건 모두 대체로 견고한 코드 SoT 근거와 명시적 Rationale 갱신(§12.17 신설, "번복 아닌 잔재 정정" 논증)을 갖추고 있으며, 항목 1(§3.2 자기모순)은 실제로 코드·기존 §3.2 본문·durable drift plan 의 처분 옵션과 정확히 일치해 재기각 대안 재도입이나 invariant 위반이 없다. 다만 항목 3 은 자신이 근거로 삼는 두 개의 node-output-redesign plan 문서가 "ai-agent 와 동시 처리"를 권고함에도 실제로는 IE 에만 caveat 를 적용해 스스로 내세운 "cross-node 대칭" 논거를 문서 표면에서는 불완전하게 이행하고, 항목 4 는 Principle 오귀속을 정정하려다 §5 안에서 4.4/4.5 라는 새로운 소규모 귀속 불일치를 만든다. 둘 다 결정을 "뒤집는" 수준은 아니고 원칙 적용의 철저함/일관성 문제이므로 CRITICAL 로 보기는 어렵지만, spec 확정 전에 보완할 가치가 있다. 부수적으로 항목 1 이 해소하는 durable drift-tracking plan 의 체크박스·frontmatter 동기화 누락은 향후 반복 탐지 루프 재발 위험이 있어 INFO 로 남긴다.

## 위험도

MEDIUM
