# Plan 정합성 검토 — spec/4-nodes/3-ai (--impl-done)

## 발견사항

- **[WARNING]** Multi-turn `out` 포트 유무 자기모순 — 여전히 미해소 (durable anchor 존재, 반복 노출)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 (실제 파일 라인 217 "Multi Turn 모드에는 **`out` 포트가 존재하지 않는다**… 조건이 0개인 경우에도 동일" + 라인 231 마이그레이션 절 "기존 `multi_turn` + 조건 없음 노드의 `out` 포트에 연결된 엣지는 dangling")
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` "Critical 1 — Multi Turn `out` 포트 유무가 요구사항 vs 기술 spec 정반대" (체크박스 미완료)
  - 상세: `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24 (라인 84)와 `spec/4-nodes/_product-overview.md` ND-AG-24(root, 라인 215)는 여전히 "조건 0개 시 `out` + `error` 제공 (**하위 호환**)"이라고 서술해, target 문서(1-ai-agent.md §3.2 + 마이그레이션 절)의 "Multi Turn 모드에는 `out` 포트가 존재하지 않는다(조건 0개도 동일)"와 정반대다. 이 drift 는 `spec-drift-ai-agent-outport-countmax.md` 문서 자체가 "consistency plan_coherence 4회 연속 WARNING" 때문에 durable anchor 로 분리했다고 명시한 항목이며, 이번 확인 시점(2026-07-18)에도 여전히 미체크 상태로 남아 있다. 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts`)를 SoT 로 확정해 어느 한쪽을 정정하는 처분이 계속 지연 중.
  - 제안: 이번 PR 의 diff 범위(IE errorPayload 계약, spec_impact: none)와는 무관하므로 이번 PR 을 막을 필요는 없다. 다만 `spec-drift-ai-agent-outport-countmax.md` Critical 1 을 다음 project-planner 턴에서 실제로 처분(코드 확인 후 `_product-overview.md` 두 곳 정정 또는 `1-ai-agent.md` §3.2 정정)하도록 우선순위를 올릴 것을 권고 — 5회째 반복 노출 전에 해소 필요.

- **[WARNING]** §7.3 single-turn `error` 포트가 미구현 상태인데 target 문서가 무조건 사실처럼 서술
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 "Single Turn 모드 — 오류 (`error` 포트)" (라인 632-664, `status`/`port` 를 "handler return" 으로 명시하며 "미구현" 캐비어 없음)
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` "CRITICAL (single-turn 잔여) — `executeSingleTurn` 의 `llmService.chat` 호출을 `try/catch` 로 감싸 `output.error` 반환… 근거: `ai-turn-executor.ts:1209`(첫 호출)·`:1439`(tool-loop) — 현 throw 미캡처" (2026-05-16 최초 발견, 2026-06-25 재확인, 여전히 미완료 `[ ]`)
  - 상세: single-turn 경로의 LLM 호출은 실제로 try/catch 로 감싸여 있지 않아 예외가 엔진 `FAILED` 로 직행하고 `port: 'error'` 라우팅이 발생하지 않는다(멀티턴 경로는 엔진 `handleAiTurnError` 로 이미 구현·회귀 테스트 보유, single-turn 만 잔여). 그러나 target 문서 §7.3 은 이 케이스를 아무 조건 없이 "발생 조건" 표(§3.2)에도 포함하고 JSON 예시를 사실처럼 제시한다. 동일 문서 §8 캔버스 요약처럼 "⚠ 미구현(Planned)" 캐비어를 붙이는 관례가 이 절에는 적용되지 않았다. 이 gap 은 오늘(2026-07-18 11:19) 동일 세션의 `ie-endmultiturn-errorpayload-contract.md` impl-prep 검토에서 "C2" 로 재확인되어 out-of-scope bypass 로 사용자 승인된 상태 — 새로운 발견은 아니나 여전히 미해소.
  - target `1-ai-agent.md` frontmatter 의 `pending_plans` 는 `ai-agent-tool-connection-rewrite.md`·`spec-drift-ai-agent-outport-countmax.md` 두 건만 링크하고 `node-output-redesign/ai-agent.md` 는 누락돼 있어, 이 문서를 편집하는 다음 사람이 이 열린 gap 을 알기 어렵다.
  - 제안: (a) `1-ai-agent.md` frontmatter `pending_plans` 에 `plan/in-progress/node-output-redesign/ai-agent.md` 추가해 discoverability 확보, (b) §7.3 본문에 "single-turn 은 현재 uncaught throw → engine FAILED (Planned: try/catch 래핑)" 같은 캐비어를 붙여 실제 동작과의 괴리를 명시 — 둘 다 project-planner 트랙, 이번 PR 블로킹 대상 아님.

- **[WARNING]** §5.5 Multi Turn `resumed` 스냅샷도 동일 패턴 — 미구현인데 target·frontmatter 모두 무조건 사실처럼 서술
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5.5 "Case: Multi Turn 재개 (`status: 'resumed'`)" (라인 393-421, "1 회 emit 되는 observability-only 스냅샷" — 조건 없이 사실 진술). frontmatter (`status: implemented`, `pending_plans` 필드 자체가 없음)
  - 관련 plan: `plan/in-progress/node-output-redesign/information-extractor.md` "spec §5.5 는 여전히 documented but unimplemented (ai-agent §7.5 와 동일 미흡)" (2026-05-16 최초 발견 → 2026-06-25 6차 갱신에도 잔여 → 2026-07-18 오늘 세션 impl-prep 에서 "C3" 로 재확인)
  - 상세: 엔진 `ai-turn-orchestrator.service.ts::processAiResumeTurn`/`handleAiMessageTurn` 은 AI 대화 turn 에서 `message_received` interaction 이나 `status:'resumed'` structured snapshot 을 emit 하지 않는다(form/buttons 경로만 emit). `3-information-extractor.md` 는 이 target 문서 스코프(`spec/4-nodes/3-ai`) 안에 있음에도 이번 bundling 에는 포함되지 않았으나, 직접 파일을 확인한 결과 frontmatter 에 `pending_plans` 필드가 전혀 없어 — 3개의 열린 plan(`node-output-redesign/information-extractor.md` 포함) 중 어느 것도 링크되어 있지 않다. `status: implemented` 라는 top-level 라벨도 이 미구현 케이스를 감안하면 다소 낙관적이다.
  - 제안: `3-information-extractor.md` frontmatter 에 `pending_plans: [plan/in-progress/node-output-redesign/information-extractor.md]` 추가 권고. §5.5 본문에도 미구현 캐비어 필요. AI Agent §7.5 (동일 패턴, 이미 "run-history observability 한정"으로 재정의되어 완화됨)과 달리 IE §5.5 는 아직 그 재정의를 거치지 않은 상태.

- **[WARNING]** `0-common.md` §5/§9 "(Principle 11)" 오귀속 — 추적 plan 이 곧 사라질 예정(anchor 부재)
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §5 헤더(라인 81 "## 5. 응답 형식 규약 (Principle 11)")·본문(라인 83)·§9 교차링크(라인 144)
  - 관련 plan: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` "impl-prep 결과" 절이 이 오귀속을 WARNING 으로 적발("`0-common.md §5`/§9 '(Principle 11)' 오귀속 → '(Principle 1.1/3.2/4.4/8.2)' 정정")했으나, C1/C2/C3 와 달리 이 WARNING 만 별도 durable 추적 plan 이 지정되지 않았다.
  - 상세: 실제 `spec/conventions/node-output.md` 를 확인하면 Principle 11 은 "출력 예시 문서화 규칙"(JSON 예시의 `undefined` 필드 생략·5필드 외 top-level key 금지)이고, `output.result.*`/`output.error.*`/`output.interaction.*` wrapper 컨트랙트는 실제로 Principle 1.1(직교)·3.2(에러 표준형)·4.4(resumed 상태)·8.2(1차 네이밍)에 해당한다. (참고로 같은 디렉토리의 `3-information-extractor.md:181`·`2-text-classifier.md:130` 의 "CONVENTIONS Principle 11 포맷" 인용은 반대로 **정확** — JSON 예시 포맷팅 규칙을 가리키는 것이므로 혼동 주의.) `ie-endmultiturn-errorpayload-contract.md` 는 워크플로 체크리스트상 `ai-review`·`consistency-check --impl-done` 두 항목만 남아 곧 `plan/complete/` 로 이동할 예정 — 이동 시 이 WARNING 의 유일한 텍스트가 소실된다. `spec-drift-ai-agent-outport-countmax.md` 가 정확히 이 실패 패턴(4회 WARNING 후에야 durable anchor 분리)을 반복하지 않도록 사전 조치가 필요.
  - 제안: 이 WARNING 을 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` (이미 spec 자기모순 anchor 로 존재)에 "Critical/Warning 3" 항목으로 추가하거나, 별도 plan 신설 없이 `0-common.md §5/§9` 본문을 지금 바로 정정(코드 변경 없는 순수 spec 오타 수준 fix)하는 편이 더 간단 — project-planner 트랙.

## 요약

이번 PR(`ie-endmultiturn-errorpayload-contract`, spec_impact: none)은 spec 본문을 편집하지 않고 IE `endMultiTurnConversation` 의 무시 인자 계약을 코드 docblock·테스트로만 명문화했으므로, target 스코프(`spec/4-nodes/3-ai`)에 대한 새로운 plan 충돌은 없다. 다만 실제 target 파일(`1-ai-agent.md`/`3-information-extractor.md`/`0-common.md`)을 직접 대조한 결과, 이미 열린 3개의 `node-output-redesign/*` 및 `spec-drift-ai-agent-outport-countmax.md` plan 이 지적한 spec-vs-구현 괴리(멀티턴 `out` 포트 자기모순, single-turn error 포트 미구현, IE `resumed` 스냅샷 미구현) 가 모두 여전히 미해소 상태로 target 문서에 "이미 구현된 사실"처럼 서술돼 있고, 그중 일부(`node-output-redesign/*.md`)는 target 의 `pending_plans` frontmatter 에 링크조차 되어 있지 않다. 추가로 오늘 세션의 impl-prep 이 적발한 "(Principle 11)" 오귀속 WARNING 은 그 근거가 된 plan(`ie-endmultiturn-errorpayload-contract.md`)이 곧 complete 로 이동할 예정이라 durable 추적처가 없다 — `spec-drift-ai-agent-outport-countmax.md` 를 만들게 된 것과 동일한 소실 위험 패턴이다. 이번 PR 자체를 막을 사유는 없으나, project-planner 트랙에서 (1) `spec-drift-ai-agent-outport-countmax.md` Critical 1 실제 처분, (2) 두 `node-output-redesign/*.md` 를 대상 문서 frontmatter 에 cross-link, (3) Principle 11 오귀속에 durable anchor 부여를 다음 우선순위로 권고한다.

## 위험도

LOW
