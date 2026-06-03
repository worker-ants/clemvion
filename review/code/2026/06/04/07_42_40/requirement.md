# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 앵커 수정 전체 — 실제 heading 과 일치 확인 (재검증 완료)

이번 변경의 핵심 앵커 수정 항목을 실제 spec 파일 heading 과 대조 검증했다.

**검증 완료 (정확)**:
- `#1-condition-구조` — `spec/4-nodes/1-logic/0-common.md` 줄 33: `## 1. Condition 구조` (수정 정확)
- `#7-dry-run-모드-정의` — `spec/5-system/13-replay-rerun.md` 줄 140: `## 7. dry-run 모드 정의` (수정 정확)
- `#71-외부-부수효과-노드-분류` — `spec/5-system/13-replay-rerun.md` 줄 142: `### 7.1 외부 부수효과 노드 분류` (수정 정확)
- `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` — `spec/5-system/6-websocket-protocol.md` 줄 356: `### 4.4 사용자 입력 대기 이벤트 상세 (execution.waiting_for_input)` (수정 정확)
- `#44-알림-이벤트-server--client--계획미구현` — `spec/5-system/6-websocket-protocol.md` 줄 721: `### 4.4 알림 이벤트 (Server → Client) — _계획·미구현_` (수정 정확)
- `#7-데이터-모델` — `spec/5-system/14-external-interaction-api.md` 줄 564: `## 7. 데이터 모델` (수정 정확)
- `#71-trigger-엔티티-확장` — `spec/5-system/14-external-interaction-api.md` 줄 566: `### 7.1 Trigger 엔티티 확장` (수정 정확)
- `#73-interactiontoken-in-memory--redis` — `spec/5-system/14-external-interaction-api.md` 줄 606: `### 7.3 InteractionToken (in-memory + Redis)` (수정 정확)
- `#3-인가-authorization` — `spec/5-system/1-auth.md` 줄 282: `## 3. 인가 (Authorization)` (수정 정확)
- `#4-trigger-등록-페이로드-확장` — `spec/5-system/14-external-interaction-api.md` 줄 157: `## 4. Trigger 등록 페이로드 확장` (수정 정확)
- `#83-allowlist-mcpserversenabledtools` — `spec/4-nodes/4-integration/4-cafe24.md` 줄 407: `### 8.3 allowlist (mcpServers[].enabledTools)` (수정 정확)
- `#93-노드의-resourceoperation-메타데이터-위치` — `spec/4-nodes/4-integration/4-cafe24.md` 줄 449: `### 9.3 노드의 Resource/Operation 메타데이터 위치` (수정 정확)
- `#2-캔버스-요약-미구현--planned` — `spec/4-nodes/7-trigger/0-common.md` 줄 57: `## 2. 캔버스 요약 (미구현 — Planned)` (수정 정확)
- `#31-어댑터-라이프사이클` — `spec/5-system/15-chat-channel.md` 줄 49: `#### 3.1 어댑터 라이프사이클` (수정 정확)
- `#r-cc-13-discord-v1-의-cch-mp-01-부분-유예--interactions-webhook-only-의-결과` — `spec/5-system/15-chat-channel.md` 줄 622 heading 존재 확인 (수정 정확)
- `#r-d-3-v1--interactions-webhook-only-gateway-는-v2` — `spec/4-nodes/7-trigger/providers/discord.md` 줄 344: `### R-D-3. v1 = Interactions Webhook only, Gateway 는 v2` (수정 정확)
- `#r-s-6-form--5-fields-native-modal-6-또는-multi_step-opt-out-시-다단계` — `spec/4-nodes/7-trigger/providers/slack.md` 줄 333: `### R-S-6. Form — ≤5 fields native modal, 6+ 또는 multi_step opt-out 시 다단계` (수정 정확)
- `#3-eia--internal-event--rendernode-매핑` — `spec/conventions/chat-channel-adapter.md` 줄 329: `## 3. EIA / Internal Event → renderNode 매핑` (수정 정확)
- `#23-적용-범위-push-vs-inject-구분` — `spec/conventions/conversation-thread.md` 줄 143: `### 2.3 적용 범위 (push vs inject 구분)` (수정 정확)
- `#5-출력-구조` — `spec/4-nodes/3-ai/3-information-extractor.md` 줄 159: `## 5. 출력 구조` (수정 정확)
- `#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix` — `spec/4-nodes/3-ai/0-common.md` 줄 157: `## 11. AI 노드 시스템 프롬프트 자동 prefix (System Context Prefix)` (수정 정확)
- `#62-저장-전략` — `spec/5-system/4-execution-engine.md` 줄 704: `### 6.2 저장 전략` (수정 정확)
- `#82-websocket-명령-클라이언트--서버` — `spec/3-workflow-editor/3-execution.md` (전수 확인, 수정 정확)
- `parallel-p2-followups.md` — 실제 plan 파일명 변경을 반영한 링크 수정 (정확)
- `#7-integration-노드-4종` — `spec/4-nodes/_product-overview.md`: `## 7. Integration 노드 (4종)` (수정 정확)
- `#9-presentation-노드-5종` — `spec/4-nodes/_product-overview.md`: `## 9. Presentation 노드 (5종)` (수정 정확)
- `#4-marketplace-마켓플레이스--미구현-planned` — `spec/4-nodes/4-integration/_product-overview.md` 줄 155: `## 4. Marketplace (마켓플레이스) — 미구현 (Planned)` (수정 정확)

---

### [INFO] 상대 경로 수정 — 모두 정확

- 위치: `spec/2-navigation/6-config.md` 줄 43, 98
- 상세: `../../1-data-model.md` → `../1-data-model.md`. `spec/2-navigation/` 에서 `spec/1-data-model.md` 를 참조하는 정확한 경로. `spec/1-data-model.md` 파일 실존 확인.

- 위치: `spec/5-system/15-chat-channel.md`
- 상세: `../4-execution-engine.md` → `4-execution-engine.md`. `spec/5-system/` 내 동일 폴더 파일 참조로 정확.

---

### [INFO] spec/5-system/_product-overview.md — 16개 spec 맵 추가, 파일 전수 실존 확인

- 위치: `spec/5-system/_product-overview.md`
- 상세: plan item 6 명세("시스템 영역 spec 맵 16개 전부 추가")와 정확히 일치. 16개 파일 (`1-auth.md` ~ `16-system-status-api.md`) 모두 실존 확인.

---

### [INFO] spec/2-navigation/_product-overview.md — 내비게이션 spec 맵 14개 추가

- 위치: `spec/2-navigation/_product-overview.md`
- 상세: plan item 6 명세("내비게이션 화면 spec 맵 14개 추가")와 정확히 일치. 14개 링크가 추가됐으며 해당 파일들 모두 실존한다.

---

### [INFO] `spec/2-navigation/_product-overview.md` — `0-dashboard.md` spec 맵 미포함

- 위치: `spec/2-navigation/_product-overview.md` 내비게이션 화면 spec 맵
- 상세: `spec/2-navigation/` 디렉토리에는 `0-dashboard.md` 가 실존하지만 신규 spec 맵에 포함되지 않았다. plan item 6 은 "14개" 를 명시하므로 `0-dashboard.md` 를 의도적으로 제외한 것인지 여부가 spec 맵 내에서 불명확하다. 단, item 6 이 명시한 수("14개")가 실제 추가된 수와 일치하므로 계획 범위를 벗어나지 않는다.
- 제안: INFO 수준. `0-dashboard.md` 제외가 의도적이라면 spec 맵 하단에 주석("대시보드 spec 별도 관리" 등)을 추가하거나, 포함이 누락이라면 plan item 6 의 "14개" 를 "15개" 로 갱신 후 링크 추가. 현재 범위 외로 별도 판단 필요.

---

### [WARNING] `spec/conventions/node-cancellation.md` — §5.1 의 `WebSocket §4.4` 앵커가 의미적으로 부정확

- 위치: `spec/conventions/node-cancellation.md` 줄 109 (변경 후)
- 상세: 변경 후 앵커가 `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` 으로 수정됐다. 그러나 해당 §5.1 의 문맥("타임라인이 `running` 에 영구 잔류하지 않도록 한다")은 `execution.node.cancelled` WS 이벤트를 설명하는 것으로, 이 이벤트의 정의는 `§4.4 사용자 입력 대기 이벤트 상세`가 아니라 `§4.3 노드 상태 이벤트` 또는 `§4.1 실행 제어 이벤트` 등 node 상태 전이를 다루는 섹션에 있을 가능성이 높다. 현재 앵커 `#44-사용자-입력-대기-이벤트-상세` 는 `execution.waiting_for_input` 전용 섹션이므로 `execution.node.cancelled` 이벤트 정의를 찾는 독자를 올바른 위치로 안내하지 않을 수 있다.
- 조사: 이번 변경이 기존의 `#44-실행-진행-이벤트` 를 일괄 `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` 으로 교체한 것이라면, 원래의 `#44-실행-진행-이벤트` 도 정확하지 않았을 수 있다 — 즉, 이 링크의 의미 부정확성은 pre-existing 문제일 수 있다.
- 제안: `spec/5-system/6-websocket-protocol.md` 에서 `execution.node.cancelled` 이벤트가 실제로 정의된 섹션(예: §4.3 또는 §4.1)을 확인하여 해당 앵커로 수정. 코드가 틀린지 spec 섹션 구조가 재정비돼야 하는지 project-planner 가 판단해야 한다.

---

### [WARNING] `spec/conventions/spec-impl-evidence.md` §4 — "5건, 모두 build 차단" 제목과 §4.0 내용 경계 불명확

- 위치: `spec/conventions/spec-impl-evidence.md` §4 제목 및 §4.0
- 상세: 이전 리뷰(`review/code/2026/06/04/00_10_01/RESOLUTION.md` warning #9)에서 이미 식별·"수정 완료" 처리된 항목이다. 변경 후 §4 제목은 "Build-time 가드 (5건, 모두 build 차단)" 이고 본문에 "(§4.0 의 인접 가드·Gate D 는 이 5건 카운트에 포함되지 않는다 — 별개 항목.)" 이라는 괄호 주석이 추가됐다. 이는 warning 을 해소하려는 시도다.
- 현황 재평가: 제목 자체("5건, 모두 build 차단")와 §4.0 의 `spec-link-integrity.test.ts`·`spec-area-index.test.ts`·`plan-frontmatter.test.ts` 세 항목도 "build 차단"으로 표기되어 있어, 독자가 "5건" 이 §4.0 을 포함하는지 여부를 본문 괄호 주석을 읽기 전까지 확신하기 어렵다. WARNING 수준의 혼동 가능성이 잔존한다.
- 제안: §4 제목을 "Build-time 가드 (총 8건: §4 테이블 5건 + §4.0 인접 3건)" 또는 "Build-time 가드 — frontmatter-evidence 5건 (§4.0 인접 가드 별도)" 처럼 구조를 명시하거나, §4.0 을 "§5 인접 지식저장소 가드" 로 번호를 분리하는 방안 검토. 수정은 project-planner 위임.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` — `§7.1`/`§7.3` 앵커 수정: SoT 링크 텍스트와 실제 섹션 내용 일치 확인

- 위치: `spec/2-navigation/2-trigger-list.md` 줄 149, 150, 222
- 상세: 이전 리뷰(2026-06-04 00:10:01 RESOLUTION warning #6)에서 "§7 이 시크릿 회전→데이터 모델로 retopic" 됐음을 확인하고 rotate-secret → §7.1 Trigger 엔티티 확장, revoke-token → §7.3 InteractionToken 으로 정밀 repoint 했다. 이번 변경에서 실제로 `#71-trigger-엔티티-확장`, `#73-interactiontoken-in-memory--redis` 로 각각 수정됐고, EIA spec 줄 566, 606 에서 해당 heading 이 실존함을 확인했다. 수정 정확.

---

### [INFO] `spec/7-channel-web-chat/_product-overview.md` — 구성요소 spec 4개 링크 실존 확인

- 위치: `spec/7-channel-web-chat/_product-overview.md`
- 상세: 추가된 `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` 모두 `spec/7-channel-web-chat/` 하위에 실존 확인. plan item 6 의 "구성요소 spec 4개" 명세와 정확히 일치.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` — Gate C 명세와 테스트 구현 일치

- 위치: `spec/conventions/spec-impl-evidence.md` §4 Gate C 행, `plan/in-progress/knowledge-base-quality-improvements.md` item 7
- 상세: spec-impl-evidence 의 Gate C 행("started ≥ 2026-06-04 인 완료 plan 은 frontmatter spec_impact 선언 필수, grandfather: cutoff 이전 시작 plan 면제")이 plan item 7 의 명세("date cutoff grandfather, 현 상태 즉시 green, 미래 완료부터 강제")와 일치한다. `code:` frontmatter 에 `spec-plan-completion.test.ts` 경로 추가도 self-consistent 갱신으로 정확.

---

## 요약

이번 변경의 핵심은 세 가지다: (1) spec 내부 cross-reference 앵커 30여 건 수정, (2) 영역 index `_product-overview.md` 세 곳에 spec 맵 추가, (3) spec-impl-evidence §4 에 Gate C/D 문서화. 요구사항 충족 관점에서 plan item 1(in-body 링크·앵커 무결성), item 6(영역 index 완전성), item 7(Gate C/D 문서화) 세 항목 모두 의도한 바를 정확히 구현하고 있다. 앵커 수정은 전수 검증을 통해 실제 heading 과 일치함이 확인됐으며, 상대 경로 수정도 모두 정확하다. 기능·로직·데이터 계약 변경은 없다. 주요 잔여 우려사항은 두 가지: (a) `node-cancellation.md §5.1` 의 `WebSocket §4.4` 앵커가 `execution.node.cancelled` 이벤트 정의가 아닌 `execution.waiting_for_input` 전용 섹션을 가리키는 의미 부정확 가능성(pre-existing 일 수 있음), (b) spec-impl-evidence §4 제목과 §4.0 의 카운트 경계 혼동 가능성. 두 항목 모두 기능 동작에 영향을 주지 않는 문서 정합성 이슈다.

## 위험도

LOW

---

STATUS=success
