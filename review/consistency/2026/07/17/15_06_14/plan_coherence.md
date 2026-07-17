# Plan 정합성 검토 — `is-conversation-output-restructure.md`

> 검토 대상: `plan/in-progress/is-conversation-output-restructure.md` (live 버전, 2026-07-17 — E-3b/E-6/E-7/Phase 1 §1 갱신 반영 후 상태. `cross_spec.md`·`convention_compliance.md` 가 먼저 실행되어 그 WARNING 들에 대한 대응이 이미 target 문서에 반영돼 있음을 확인했다.)

## 발견사항

이번 검토에서 CRITICAL/WARNING 등급 발견사항은 없다. 아래는 지시된 4개 점검 관점 각각에 대한 실측 결과다 (모두 "충돌 없음" 판정이나, 근거를 기록해 둔다).

### [INFO] (a) `node-output-redesign/**` — endReason 유니온을 바꾸는 계획 없음 (정독 확인 완료)

- target 위치: 근본 원인 표 (backend 4곳 선언) · §설계 전체
- 관련 plan: `plan/in-progress/node-output-redesign/{README,ai-agent,information-extractor}.md`
- 상세: `node-output-redesign/**` 는 28개 노드의 `output`/`meta`/`config` **shape** 을 `spec/conventions/node-output.md` 11원칙에 대조하는 **진단 전용** plan 이다(각 노드 문서 §"종합 개선안"). `endReason`/`interactionType` 키워드로 전수 grep 한 결과:
  - `endReason` 은 `ai-agent.md`·`information-extractor.md` 두 곳에만 등장하며, 전부 **현재 값이 spec 과 이미 일치("정합")한다는 확인 문구**다. 두 문서의 미해결(`[ ]`) 항목 중 `endReason` **값 자체**를 추가/제거/재정의하려는 항목은 0건.
  - `information-extractor.md` §"종합 개선안"(L226-236)에 `timeout` 관련 항목이 전혀 없다 — target 의 "`timeout` 은 죽은 값이지만 파생 유니온에 보존한다" 결정과 겹치는 미해결 결정이 없다.
  - `ai-agent.md` §"종합 개선안"(L211-221)의 유일한 CRITICAL 잔여(single-turn `llmService.chat` try/catch 미적용, P0)는 해소 시 `port:'error'` 로 라우팅하는 것이 목표이고 여기 쓰이는 값은 이미 `AiAgentEndReason` 4값에 포함된 기존 `'error'` 다 — 신규 endReason 값을 요구하지 않는다. target 의 유니온 정의(`'user_ended'|'max_turns'|'condition'|'error'`)와 충돌 없음.
  - D6(PR #157, 2026-05-17 머지 완료)이 다룬 것은 `output.messages` 의 **중첩 위치**(top-level → `output.result.messages`)이지 `endReason` **값 자체**가 아니다 — 축이 다르다.
- 결론: **충돌 없음.** `node-output-redesign` 은 endReason 도메인에 대해 어떤 미해결 결정도 갖고 있지 않으므로 target 이 그 위에 "얹혀 깨질" 선행 결정이 존재하지 않는다.

### [INFO] (a-부속) `spec-drift-ai-agent-outport-countmax.md` Critical 1 — 근접하지만 다른 축, 충돌 아님

- target 위치: §유니온 분기 (L124-127) — `'out'` 은 endReason 유니온에 포함하지 않는다는 결정
- 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 — "Multi Turn 모드에 `out` **포트**가 존재하는지" 가 spec 내부에서 정반대로 서술된 미해결 항목
- 상세: 두 항목 모두 `'out'` 을 다루지만 서로 다른 것을 가리킨다 — spec-drift plan 의 미해결 사안은 **multi-turn 모드에서 `out` 포트가 존재하는가**(조건 0개일 때의 하위호환 포트)이고, target 의 `'out'` 은 **단일턴 종결 시의 `endReason` 리터럴**(`ai-turn-executor.ts:1883` 등, 유니온으로 선언된 적 없는 인라인 `as const`)이다. multi-turn 의 4개 endReason(`user_ended`/`max_turns`/`condition`/`error`) 중 어디에도 `'out'` 은 없으므로, spec-drift plan 의 미해결 여부와 무관하게 target 의 파생 유니온 구성은 변하지 않는다.
- 제안: 충돌은 아니지만 두 plan 이 같은 파일(`ai-turn-executor.ts`)·같은 리터럴(`'out'`)을 다른 의미로 다루므로, target 의 §유니온 분기 각주에 "이 `'out'` 은 spec-drift-ai-agent-outport-countmax.md Critical 1 의 포트 논쟁과 무관한 별개 축(endReason vs port)" 한 줄을 추가하면 다음 사람의 혼동을 예방할 수 있다 (강제 아님, INFO).

### [INFO] (b) `'timeout'` 죽은 값 보존 결정 — 충돌하는 미해결 결정 없음

- target 위치: §화이트리스트를 패키지가 소유한다 각주 (L165) · §결정 기록
- 관련 plan: 전체 `plan/in-progress/**` 전수 grep (`timeout`·`information-extractor` 교차)
- 상세: `information-extractor` 의 `endReason` 도메인이나 `'timeout'` 값을 다루는 다른 in-progress 항목은 `node-output-redesign/information-extractor.md` 를 포함해 전무하다. "죽은 값을 빼려면 IE 유니온에서 지우는 게 옳다"는 target 의 판단을 무효화하거나 선점하는 plan 이 없다.

### [INFO] (c) E-1(기존 가드 거짓 음성 수정) 포함 — 파일 충돌 없음

- target 위치: Phase 2 E-1 (L185-197)
- 관련 plan: 전체 `plan/in-progress/**` 전수 grep (`interaction-type-exhaustiveness`·`WaitingInteractionType`·`ConversationTurnSource`)
- 상세: `interaction-type-exhaustiveness.test.ts` 또는 두 타입(`WaitingInteractionType`/`ConversationTurnSource`)을 동시에 건드리려는 다른 in-progress 항목이 없다. E-1 이 이 파일을 "같은 파일·같은 결함 계열" 이유로 함께 고치는 scope 결정은 다른 plan 과의 파일 경합·순서 의존을 만들지 않는다.
- 참고(참고용, 판단 아님): E-1 은 가드를 **양방향 강제**로 바꾸므로, 현재 `WaitingInteractionType`/`ConversationTurnSource` 의 타입 유니온과 `ENUM_VALUES` 배열이 완전히 동기화돼 있지 않다면 이 PR 안에서 그 drift 가 새로 드러날 수 있다(target 스스로 "회귀 검증 의무" 로 mutation 테스트를 요구하므로 이미 인지·대비돼 있음). 이는 plan 충돌이 아니라 구현 리스크이므로 code-review 단계에서 다룰 사안.

### [INFO] (d) 두 발견 사실의 파급 — target 이 이미 자체 처리, 다른 plan 후속 항목 없음

- target 위치: E-6 (L260-266, `interaction-type-registry.md` 등록 + 거짓 보증 정정), E-3b (L221-235, `output-shape.ts` → `REGISTRY_SITES` 추가)
- 관련 plan: 전체 `plan/in-progress/**` 전수 grep (`interaction-type-registry`·`MULTI_TURN_INTERACTION_TYPES`·`ai_form_render`)
- 상세:
  - ① `interaction-type-registry.md:125` "3중 가드가 영구히 차단" 거짓 보증 — 이를 사실로 전제하고 의존하는 다른 in-progress plan 은 없다(`interaction-type-registry.md` 를 참조하는 유일한 다른 plan 은 `eia-context-schema-followups.md` 이며, 그 참조는 DTO 파일 경로 각주 갱신 건으로 무관). target 의 E-6 이 이미 자체 문서 내에서 정정을 계획하고 있어 별도 plan 갱신 불필요.
  - ② `output-shape.ts` 가 `REGISTRY_SITES` 밖이라 `MULTI_TURN_INTERACTION_TYPES` 가 무가드 — 이 상태를 전제로 하거나 이 목록에 새 interactionType 값을 추가하려는 다른 in-progress plan 도 없다. target 의 E-3b 가 이미 처리 계획을 갖고 있다.
- 결론: 두 사실 모두 target 문서 **내부**에서 완결되며, 다른 `plan/in-progress/**` 문서의 후속 항목을 새로 만들거나 무효화하지 않는다.

## 검증 완료 (plan 충돌 없음 — 참고용)

- `pnpm-migration-followups.md` — §1~§4 전체 완료(2026-07-16, 잔여는 사용자의 branch-protection 등록 1건뿐). target 의 E-2(`graph-warning-rules` 템플릿 재사용)·E-5(`node-linker=isolated`·injected `pnpm deploy`·`packages-checks.yml` matrix 확장)는 이 plan 이 확립한 현재 배선 상태를 정확히 전제로 삼고 있어 정합적. 패키지명(`node-output-contract`)·워크스페이스 배선도 이 plan 이 남긴 4-패키지 CI matrix 패턴과 충돌 없이 5번째로 편입 가능한 구조.
- `marketplace-and-plugin-sdk.md` — 미착수(`worktree: (unstarted)`), `packages/sdk`·`@workflow/*` 참조 없음. `codebase/packages/sdk`(`@workflow/sdk`, EIA client SDK)는 이번 target 과 무관한 별개 패키지. 충돌 없음.
- `rag-quality-improvement.md` — RAG 검색 품질 개선(리랭킹·청킹) 주제로 `endReason`/`isConversationOutput`/패키지 관련 언급 0건. 충돌 없음.

## 요약

`plan/in-progress/**` 전 문서(23개 파일 + `node-output-redesign/` 27개 노드 문서)를 대상으로 `endReason`·`isConversationOutput`·`CONVERSATION_END_REASONS`·`WaitingInteractionType`·`ConversationTurnSource`·`interaction-type-registry`·`node-output-contract`·관련 파일 경로(`node-handler.interface.ts`·`ai-turn-executor.ts`·`information-extractor.handler.ts`·`interaction-type-exhaustiveness.test.ts`)를 전수 grep 하고, 명시적으로 지목된 `node-output-redesign/ai-agent.md`·`information-extractor.md`는 해당 섹션을 직접 읽어 확인했다. 미해결 결정을 우회하는 사례, 선행 plan 미해소 사례, 후속 항목 누락 사례 어느 것도 발견되지 않았다 — `node-output-redesign` 은 endReason 값 자체에 대해 아무 미해결 결정도 갖고 있지 않고(순수 shape 진단), `pnpm-migration-followups`는 target 이 의존하는 배선을 이미 완결해 뒀으며, `marketplace-and-plugin-sdk`·`rag-quality-improvement`는 주제가 겹치지 않는다. target 문서 자체도 이번 검토 세션에서 먼저 실행된 `cross_spec`·`convention_compliance` 체커의 WARNING(레지스트리 등록·backlink·CI matrix 확장 서술)을 이미 E-3b/E-6/E-7/Phase 1 §1 로 흡수한 상태라, plan 정합성 관점에서 추가로 막을 미해결 충돌이 없다.

## 위험도

NONE
