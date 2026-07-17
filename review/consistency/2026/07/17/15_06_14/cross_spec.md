# Cross-Spec 일관성 검토 결과

対象 target: `plan/in-progress/is-conversation-output-restructure.md` (`isConversationOutput` 화이트리스트 drift 구조적 차단 — 백로그 E, 옵션 B 채택)

## 발견사항

### [WARNING] 신규 cross-cutting enum(`endReason`) 이 기존 `interaction-type-registry.md` 거버넌스 모델을 우회 — 매트릭스·doc-sync 미등록

- **target 위치**: 결정 기록 "옵션 B(공유 패키지) 채택", Phase 2 E-1·E-2, §설계
- **충돌 대상**: `spec/conventions/interaction-type-registry.md` (특히 §1·§2·§4 Rationale), `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 행 134), `.claude/config/doc-sync-matrix.json`
- **상세**:
  이 저장소는 "cross-cutting enum 값 추가 시 N개 처리 위치 중 일부를 누락"하는 정확히 이 버그 계열에 대해 **이미 하나의 공식·CI-강제 메커니즘**을 보유한다 — `spec/conventions/interaction-type-registry.md`. 이 문서는 자신을 "cross-cutting **enum 값** 의 단일 진실 + **처리 분기 위치 매트릭스**"라 선언하고, `WaitingInteractionType`·`ConversationTurnSource`·`PresentationType` 3개 enum 을 (a) 매트릭스 표 + (b) AST grep 가드(`interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES`) + (c) TypeScript exhaustive switch 3중으로 거버닝한다. `PROJECT.md` 의 "변경 유형 → 갱신 위치 매핑" 표는 이를 **machine-verified**(`.claude/tests/test_doc_sync_matrix.py` 가 행 수·참조 실존을 빌드에서 검증)로 등록해 뒀다: `신규 cross-cutting enum 값 추가 (WaitingInteractionType / ConversationTurnSource / PresentationType 등) → interaction-type-registry.md 매트릭스에 행 추가 + 처리 분기 동시 갱신 + AST 가드 통과`.

  target(draft)이 다루는 `endReason` 은 구조적으로 **동일한 문제**다 (draft 스스로 "`error`·`condition` 누락은 구조의 필연" 이라 진단하고, `WaitingInteractionType`/`ConversationTurnSource` 가드를 "같은 파일·같은 결함 계열"로 지목해 E-1 에서 함께 고친다). 그런데 draft 는 이 기존 governance 를 확장하는 대신 **완전히 다른 메커니즘**(shared package + `satisfies`/`Exclude` 양방향 compile 강제)을 새로 도입하면서:
  1. `interaction-type-registry.md` 의 매트릭스에 `endReason` 을 등록하지 않는다 (등록 대상 enum 목록에 없음).
  2. `PROJECT.md` 표(및 그 SSOT `doc-sync-matrix.json`)에 "신규 endReason 값 추가" 행을 신설하지 않는다 — 검증했음: 두 파일 어디에도 `endReason`/`node-output-contract` 문자열이 없다.
  3. 왜 `endReason` 만 다른 메커니즘을 택했는지에 대한 근거를 Rationale 에 남기지 않는다.

  더 구체적으로, draft E-1 은 `interaction-type-exhaustiveness.test.ts` 를 직접 수정한다 — 이 파일은 `interaction-type-registry.md` 가 "3중 가드가 같은 패턴의 회귀를 영구히 차단한다"(§4 Rationale)고 명시한 바로 그 가드다. draft 의 자체 실측(§"추가 발견")은 그 신뢰성 주장이 (적어도 `WaitingInteractionType`/`ConversationTurnSource` 의 `_typecheck`/`_sourceTypecheck` 어서션에 대해) **거짓이었음**을 보인다. 이는 `interaction-type-registry.md` 가 governing 하는 코드에 대한 정정 사항이므로, 그 문서 자체가 spec 갱신 대상에 포함돼야 자연스럽다.
- **제안**: Phase 1(spec) 범위를 `conversation-thread.md §9.10` 단독에서 다음 중 하나로 확장:
  (a) `interaction-type-registry.md` 에 E-1 이 발견한 가드 결함(및 수정 후 구조)을 Rationale 로 기록 — 이 문서가 다루는 코드가 실제로 바뀌므로.
  (b) `endReason` 을 왜 `interaction-type-registry.md` 매트릭스 방식이 아니라 별도 shared-package 방식으로 거버닝하기로 했는지 결정 근거를 draft(또는 향후 `node-output.md`/`conversation-thread.md` Rationale)에 명문화.
  (c) `PROJECT.md` "변경 유형 → 갱신 위치 매핑" 표(+ `doc-sync-matrix.json`)에 "신규 endReason 값 추가 → `@workflow/node-output-contract` 패키지 갱신 (컴파일 실패로 강제, 별도 매트릭스 불필요)" 행을 신설해 이 새 거버넌스 경로를 공식 등록.

### [WARNING] 패키지가 code-level SoT 가 돼도 AI Agent/IE spec 산문의 값 열거는 별개 SoT 로 잔존 — backlink 부재

- **target 위치**: §화이트리스트를 패키지가 소유한다, Phase 2 E-2·E-3
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2(포트 표)·§7(케이스 색인), `spec/4-nodes/3-ai/3-information-extractor.md` §3.2(포트 표)·§5.6(종결 4종), `spec/conventions/node-output.md`
- **상세**: 실측 결과 `endReason` 값은 spec 산문에도 **이미 열거**돼 있다:
  - AI Agent §3.2: single turn `out`/`{condition.id}`/`error`, multi turn `{condition.id}`/`user_ended`/`max_turns`/`error`. §3.2 는 "`timeout` 포트는 존재하지 않음" 을 명시적으로 못박는다.
  - Information Extractor §3.2·§5.6: single `out`, multi turn 4종결 `completed`/`user_ended`/`max_turns`/`max_retries` + 별도 `error`.
  즉 spec 자체가 (draft 가 지적한 backend 4곳과 별개로) **다섯 번째 방식의 열거**를 이미 보유한다 — 다만 지금은 코드 위반이 아니라(spec 은 정확) product 문서로서 자연스러운 열거다.

  이 저장소의 기존 shared-package 관례는 이런 산문 열거가 있는 spec 문서에 "이 도메인의 code-level 단일 진실은 packages/X" 형태의 명시적 backlink 를 남긴다 — 예: `spec/conventions/cross-node-warning-rules.md` "타입·평가 유틸·Parallel rule 의 단일 진실은 shared package `@workflow/graph-warning-rules`", `PROJECT.md` "표현식 언어 ... 는 `codebase/packages/expression-engine` SSOT". draft 의 Phase 1 은 `conversation-thread.md §9.10` 에 CT-S21 회귀 시나리오 1건만 추가할 뿐, 위 두 노드 spec 문서(§3.2/§7, §3.2/§5.6)나 `node-output.md` 어디에도 신규 패키지를 SoT 로 지목하는 backlink 를 계획하지 않는다. 이 backlink 가 없으면 향후 spec 갱신자가 "이 값 목록을 어디서 갱신해야 하는가" 를 코드 grep 없이 알 수 없다 — 이번 drift(#959·#961) 의 근본 원인("손으로 유지되는 목록이 여러 곳에 흩어짐")이 spec 층에서 형태만 바꿔 재발할 위험.
- **제안**: `1-ai-agent.md §3.2` / `3-information-extractor.md §3.2·§5.6` (또는 두 문서 공통으로 `0-common.md` §9 출력 구조 색인) 에 "`endReason`/포트 값의 code-level 단일 진실은 `@workflow/node-output-contract`" 1줄 추가.

### [INFO] `information-extractor.md` 내부에 이미 존재하는 'timeout' 관련 자기모순 — draft 가 다루지 않음

- **target 위치**: §유니온 분기 각주 ("`'timeout'` 은 현재 죽은 값이지만 ...")
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md` §1 (line 49) vs §4.2 step 5 (line 174)
- **상세**: 같은 spec 문서 안에 서로 다른 서술이 공존한다.
  - §1: "`multi_turn` 모드에서 사용자 응답은 무제한 대기한다 (**외부 cancel 외에는 타임아웃이 발생하지 않음**)."
  - §4.2 step 5: "`endMultiTurnConversation(_resumeState, endReason)` — engine 이 사용자가 명시 종료(`execution.end_conversation`) **또는 timeout 등을 만났을 때** 호출."
  실측 코드(§5.6·`portForEndReason`)와 draft 의 감사 결과, `'timeout'` 은 IE 유니온에 선언만 있고 실제 생산 경로가 없는 죽은 값이며 §5.6 의 "4 가지 종결 사유" 목록에도 등장하지 않는다. 즉 §4.2 step 5 의 "timeout" 언급은 §1 의 "타임아웃 미발생" 서술과 이미 모순돼 있었고(draft 이전부터), draft 가 패키지에 `'timeout'` 을 그대로 보존하기로 한 결정(⊇ 방향 강제 근거)이 이 기존 모순을 해소하지 않고 그대로 물려받는다.
- **제안**: 필수는 아니나, Phase 1 이 이 영역을 건드리는 김에 §4.2 step 5 문구를 "engine 이 사용자 명시 종료를 만났을 때 호출 (향후 timeout 도입을 대비해 `endReason` 계약은 값을 예약하나 현재 미발생)" 식으로 §1 과 정합시키면 패키지가 "무엇의 SoT 인지"가 더 명확해진다.

### [INFO] `conversation-thread.md §9.10` 파일 스코프 목록에 실제 수정 대상 `output-shape.ts` 가 없음

- **target 위치**: Phase 1 "`conversation-thread.md` §9.10 회귀 시나리오 ... CT-S21"
- **충돌 대상**: `spec/conventions/conversation-thread.md` §9.10 도입부 (line 637)
- **상세**: §9.10 은 "본 절을 변경하거나 conversation timeline 관련 코드(`conversation-inspector.tsx`, `conversation-utils.ts`, `use-execution-events.ts`, `result-timeline.tsx`, `conversation-timeline-item.tsx`, `result-detail.tsx`)를 수정하는 PR 은 CT-S* 단위 테스트 통과가 의무" 라고 적용 대상 파일을 명시 열거한다. `isConversationOutput`/`CONVERSATION_END_REASONS` 의 실제 정의처인 `output-shape.ts` 는 이 목록에 없다 (실측: `result-detail.tsx`·`result-timeline.tsx` 가 `output-shape.ts` 를 import 해서 간접 커버되긴 하나, E-4 가 직접 수정하는 파일 자체는 목록 밖). CT-S9/CT-S15~17(Inv-8 관련) 시나리오가 사실상 `isConversationOutput` 의 동작에 의존하는데도 그 정의 파일이 명시되지 않은 기존 문서 갭이며, draft 가 CT-S21 을 추가하고 이 파일을 직접 고치는 시점이 이를 명문화하기 좋은 지점이다.
- **제안**: §9.10 line 637 파일 목록에 `output-shape.ts` 추가.

### [INFO] 향후 확장 예고(`interactionType`·backend `ConversationTurnSource`) 가 기존 SoT(`interaction-type-registry.md`)와 겹침

- **target 위치**: §"범위 한정" ("패키지명이 넓은 건 향후 `interactionType`·backend `ConversationTurnSource` 등을 받을 자리를 열어두기 위함")
- **충돌 대상**: `spec/conventions/interaction-type-registry.md` §1·§2 (두 enum 의 현재 "단일 진실 위치"는 backend/frontend 개별 파일 + 매트릭스 + AST grep, shared package 아님)
- **상세**: 지금 당장 충돌은 아니다(draft 는 이번 PR 범위를 endReason 으로 명시적으로 한정). 다만 향후 실제로 `interactionType`/`ConversationTurnSource` 를 이 패키지로 이관한다면, 그 시점에 `interaction-type-registry.md §1.1`("Backend/Frontend 두 위치, 신규 값 추가 시 두 위치를 동시 변경") 과 `PROJECT.md` 표 행 134 를 함께 개정해야 한다 — 지금 이 사실을 결정 기록에 남겨두지 않으면 후속 작업자가 두 메커니즘(매트릭스+grep vs 패키지+Exclude)의 공존/치환 여부를 다시 조사해야 한다.
- **제안**: 필요 시 결정 기록에 "향후 이관 시 `interaction-type-registry.md` 개정 동반" 한 줄만 추가해도 충분.

## 검증 완료 (충돌 없음)

- **요구사항 ID**: `CT-S21` 은 `conversation-thread.md §9.10` 기존 최대 ID `CT-S20` 다음으로, spec/plan 전체에서 미사용 확인 (grep 전수) — 충돌 없음.
- **'out'(단일턴) 처리**: AI Agent §7.1·IE §5.1 이 `endReason: 'out'` 을 이미 명시하고, 두 spec 모두 이 값이 `result.messages` 를 동반하지 않는 단일턴 케이스임을 확인 — draft 의 "out 은 무해" 판정과 정합. `ConversationEndReason` 파생 유니온이 `'out'` 을 제외하는 설계도 이와 일치.
- **backend 코드 실측**: `node-handler.interface.ts:428`(`user_ended|max_turns|condition|error`), `information-extractor.handler.ts:55-61`(`completed|max_turns|user_ended|timeout|max_retries|error`), `portForEndReason`(default→`'error'`, `'timeout'` case 없음), frontend `output-shape.ts` `CONVERSATION_END_REASONS`(6값, `timeout` 없음) — draft 의 서술과 모두 일치.
- **다른 소비처 파급 (위젯/EIA)**: `codebase/channel-web-chat/**`, `codebase/backend/src/modules/external-interaction/**` 전수 grep 결과 `endReason` 참조 0건. `conversation-thread.md §9.1` 각주가 위젯은 backend `ConversationTurnSource` 5값만 수신하고 §9.1~9.2 규약(즉 `endReason` 기반 게이팅과 무관한 2-way 말풍선 축약)을 따르지 않음을 이미 명시하므로, 이번 패키지 도입은 위젯·EIA 에 파급되지 않는다 — draft 의 "endReason 만 담는다" 범위 한정과 정합.
- **RBAC/API 계약**: 변경 없음 (엔드포인트·권한 모델 무관).
- **패키지 신설 절차**: `spec/conventions/` 에 전용 절차 문서는 없으나, `PROJECT.md`("공유 패키지 ... workspace:* 참조") + 기존 4개 패키지 선례(특히 `graph-warning-rules` 의 "TypeORM/앱 비의존 pure shape" 패턴)가 사실상의 관례이며, draft E-2 는 이를 템플릿으로 그대로 따른다 — 절차 위반 없음.

## 요약

가장 무게 있는 발견은, 이 저장소가 "cross-cutting enum 값 하나 추가 시 여러 처리 위치 중 일부가 누락되는" 문제 계열에 대해 이미 `interaction-type-registry.md` + `PROJECT.md` doc-sync-matrix 로 공식화·CI-강제한 거버넌스를 갖고 있는데, draft 가 구조적으로 동일한 문제(`endReason`)를 별도 메커니즘(shared package)으로 해결하면서 그 기존 거버넌스 등록·backlink 를 하지 않는다는 점이다. E-1 이 그 기존 거버넌스가 의존하는 정확히 그 가드 파일을 고치는 만큼, 이 간극은 실무적으로 작지만 spec 문서 간 "이 값은 어디서 관리되는가"에 대한 답이 두 갈래로 갈라지는 잠재적 재발 지점이다. 값 자체('out'·'timeout' 포함)와 backend 코드 실측은 draft 의 서술과 완전히 일치하며 API/RBAC/다른 소비처(위젯·EIA)로의 파급도 없다 — 이번 검토에서 CRITICAL(직접 모순으로 어느 한쪽이 작동 불가한 수준)은 발견되지 않았다.

## 위험도

MEDIUM
