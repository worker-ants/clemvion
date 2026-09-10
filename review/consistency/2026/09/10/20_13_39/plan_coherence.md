# Plan 정합성 검토 — spec-draft-chat-channel-patch-token.md

대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md` (spec_impact: `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`)
출처 tracker: `plan/in-progress/spec-draft-nullable-notation-followups.md` — CRITICAL 항목 두 개(line 1894, line 1972)

## 발견사항

### [WARNING] 트래커 CRITICAL 항목의 등재 처방이 draft 의 D-2 를 반영하지 않은 채 남아 있다

- target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md` §"등재된 처방이 그대로면 **토큰을 파괴한다**" (13~53행), 결정 D-2 (72~80행)
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1894-1969`(CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다), 특히 **1949~1952행**:
  > "처방은 DTO 분리가 유일하게 일관된 해법이다 ... **PATCH 전용 `ChatChannelConfigDto` 변형(`botToken` 제외)** 은 R-CC-10 의 의도와 정확히 일치하며 아래 `ChatChannelCard` 버그까지 같은 수정으로 닫힌다."
- 상세: 트래커에 **이미 등재되고 developer 수정 대기 상태**(1897행 "developer 수정 대기")로 표시된 처방은 "`botToken` 을 DTO 에서 제외" 만 서술한다. draft 는 이 처방만 구현하면 `setupChatChannel` 의 무조건 `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` 호출 때문에 **저장된 봇 토큰이 파괴된다**는 것을 실측으로 새로 밝혀 D-2(PATCH 경로는 `secrets.rotate` 를 호출하지 않는다)를 추가했다. 이는 등재된 처방을 **뒤집는 것이 아니라 불완전함을 보완**하는 결정이지만, 트래커 항목 텍스트 자체는 아직 D-2 를 모르는 상태로 남아 있다. 이 항목은 이미 "developer 수정 대기"로 실행 가능 상태로 표시돼 있어, 이 문구만 보고 착수하면 D-1 만 구현하고 D-2 를 놓칠 위험이 문서 구조상 존재한다.
- 제안: 이 spec 변경을 반영하는 커밋(또는 그 직후)에서 `spec-draft-nullable-notation-followups.md:1950-1952` 의 처방 문장을 D-1+D-2 를 모두 포함하도록 갱신하거나, 최소한 "처방은 `spec-draft-chat-channel-patch-token.md` 의 D-1/D-2 결정을 따른다" 로 교체해야 한다. 현재 draft 문서 자체에는 "커밋 후 트래커를 갱신한다"는 명시적 체크리스트 항목이 없다 — "적용 단계 예정"이 구두 계획으로만 존재하고 문서화된 스텝이 아니므로, draft 의 Rationale 에 이 갱신을 명시적 TODO 로 남길 것을 권한다.

### [WARNING] 후속 3건 중 2건이 "별 항목으로 등재한다"는 산문만 있고 실제 체크리스트 항목이 어디에도 없다

- target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md:135-142` "이 turn 에서 하지 않는 것"
- 관련 plan: 없음 — `plan/in-progress/*.md` 전체를 grep 했으나 "형제 세 필드의 `details.field` 규약 이탈 정정"과 "`secrets.rotate` 빈 값 가드"에 대응하는 `- [ ]` 체크리스트 항목이 draft 자신을 제외하면 0건이다.
- 상세: draft 는 다음 두 항목을 "별 항목"/"별 후속으로 등재한다"고 적는다:
  1. "형제 세 필드의 `details.field` 규약 이탈 정정" (138행)
  2. "`secrets.rotate` 에 빈 값 가드 추가" (141~142행)

  그러나 이 문장들은 **선언일 뿐 등재가 아니다** — `spec-draft-nullable-notation-followups.md` 에도, 다른 어떤 in-progress plan 에도 이 두 항목에 대응하는 체크박스가 없다. 이 저장소가 이미 겪은 패턴과 동일하다(`review/` 는 SoT 아님, 미룬 항목은 그 턴에 `plan/` 에 적지 않으면 유실된다 — 과거 5건을 잃을 뻔한 사례가 기록돼 있다). 세 번째 항목("구현")은 트래커의 기존 CRITICAL 체크박스(1894행)가 이미 그 역할을 하므로 문제 없다(단, 위 첫 발견처럼 텍스트 갱신은 필요).
- 제안: 이 draft 를 `complete/` 로 옮기기 전에 `spec-draft-nullable-notation-followups.md` (또는 다른 적절한 in-progress plan)에 위 두 항목에 대응하는 `- [ ]` 체크리스트를 실제로 추가해야 한다. "별 항목으로 등재한다"는 문장 자체는 등재가 아니다.

### [WARNING] 신설 예정 Rationale ID `R-CC-17` 이 이미 다른(무관한) 항목에 점유돼 있다

- target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md:109` "C. `15-chat-channel.md` 신설 Rationale `R-CC-17`"
- 관련 target(spec): `spec/5-system/15-chat-channel.md:689` — `### R-CC-17. \`render_form\` v1 임시 텍스트 fallback + presentation renderer shape 처리` (기존에 이미 존재, 이번 draft 와 무관한 주제). 현재 문서의 마지막 사용 ID 는 `R-CC-20`(720행, `CCH-SE-02 dedup`)이다. (`R-CC-14` 는 결번 — 별도 사유로 이미 없음, 확인만 하고 이 리뷰의 대상은 아님.)
- 상세: draft 는 "신설"이라고 명시적으로 적었지만 그 번호는 이미 `render_form` fallback 주제로 쓰이고 있다. 그대로 반영하면 같은 문서에 `### R-CC-17` 헤딩이 두 개 생겨 anchor(`#r-cc-17-...`)가 충돌하고, 향후 어느 문서가 `R-CC-17` 을 인용하든 모호해진다. 이는 plan 간 결정 충돌이 아니라 target(spec) 내부 ID 공간과의 충돌이지만, draft 의 변경안이 문자 그대로 실행되면 실패하는 구체적 결함이라 여기서 함께 보고한다.
- 제안: 새 Rationale 번호를 `R-CC-21`(다음 미사용 번호)로 교체.

### [INFO] `ChatChannelCard` 항목 — spec 변경만으로는 안 닫히고, 구현 대기가 정확한 처분이다

- target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md:139-140`
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1972-2005`("버그: `ChatChannelCard` 편집-저장이 항상 400이다")
- 상세: draft 는 "프런트 코드 변경 불요"라고만 주장하며, "그 카드가 코드 변경 없이 통과한다"는 문장의 범위를 정확히 프런트 코드로 좁혔다 — 백엔드의 DTO 분리(D-1)·rotate 스킵(D-2) 구현이 실제로 배선돼야 저장이 성공하고, 이는 developer 턴의 일이라고 draft 스스로 명시했다(137행 "구현 — DTO 분리·`setupChatChannel` 분기는 developer 턴"). 판정: **spec 변경만으로는 버그가 실제로 닫히지 않는다.** 트래커 체크박스(1972행)는 spec 결정이 서더라도 구현 전까지 unchecked 로 유지해야 한다(스코프가 정확해 별도 조치는 불필요, 갱신 시 조기 체크만 주의).

### [INFO] "착수 전 브라우저 재현" 선행조건은 developer 턴 것이 맞다 — 이 planner 턴에는 적용되지 않는다

- target 위치: 해당 없음(draft 는 이 선행조건을 언급하지 않는다)
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1990-1995`
  > "reviewer 는 정적 대조로만 확인했다 ... 나도 그 컴포넌트 코드를 직접 열어 `botToken` 생략과 두 주석을 확인했지만 **브라우저에서 재현하지는 않았다.** 착수 시 먼저 재현할 것"
- 상세: 이 조건은 "(developer, 2026-09-10 등재)" 항목에 딸려 있고, 실제 코드 수정 + 회귀 검증(e2e/브라우저) 단계에 적용되는 조건이다. 이번 draft 는 정적 코드 분석(서버 DTO 필수 필드 + 프런트 컴포넌트의 `botToken` 생략, 이미 tracker 가 확인한 사실)만으로 D-1/D-2 를 결정했고 새로운 런타임 주장을 추가하지 않으므로, 이 선행조건은 이 **planner 턴에는 적용되지 않는다.** 다만 트래커 항목을 갱신할 때 이 문구가 삭제되지 않고 developer 인수인계 항목으로 그대로 보존돼야 한다(재현 실패가 부재의 증거가 아니라는 이 저장소의 기존 원칙과 일치).

### [INFO] spec_impact 두 파일에 대한 동시 편집 — 텍스트 겹침 없어 실질 충돌 아님

- target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md` frontmatter `spec_impact`
- 관련 plan: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`(spec_impact 에 `spec/5-system/15-chat-channel.md` 포함)와 출처 tracker `spec-draft-nullable-notation-followups.md`(같은 두 파일을 spec_impact 로 가짐) 모두 로컬 in-progress plan 목록에서 확인됨.
- 상세: `spec-draft-eia-notification-payload-contract.md` 는 `15-chat-channel.md:76` 근방(EIA notification envelope 의 `line 536` 참조 제거)을 대상으로 하며, 이 draft 가 편집하는 §5.4.1 표·정당화 문단·신설 Rationale(§512 이후)과 섹션이 겹치지 않는다. 출처 tracker 자신도 같은 두 파일을 spec_impact 로 갖지만, 그 문서 안에서 `2-trigger-list.md`/`15-chat-channel.md` 를 대상으로 한 **다른 모든 체크리스트 항목은 이미 `[x]` 완료** 상태이고, 미해결로 남은 것은 이 draft 가 다루는 두 CRITICAL 항목뿐이다(1894행, 1972행). 즉 동일 파일을 겨냥한 미해결·중첩 편집은 확인되지 않는다.
- 제안: 없음(정보성).

## 요약

이 draft 는 트래커에 이미 등재·판정된 CRITICAL 항목을 뒤집지 않고 **정당하게 보완**한다 — 등재 처방(DTO 분리)이 놓친 `secrets.rotate` 무조건 호출을 실측으로 새로 찾아 D-2 로 막았고, `ChatChannelCard` 항목도 스코프(프런트 불필요, 백엔드 구현은 developer 턴)를 정확히 나눴다. 다만 이 보완이 아직 **문서로 착지하지 않았다**: (1) 트래커의 CRITICAL 항목 처방문이 D-2 없이 남아 있어 "developer 수정 대기" 라벨과 결합하면 스테일 처방이 실행될 위험이 구조적으로 존재하고, (2) 후속 2건("형제 details.field 정정" · "rotate 빈 값 가드")은 "별 항목으로 등재한다"는 서술만 있고 실제 체크리스트가 어디에도 없어 이 draft 가 `complete/` 로 이동하면 유실될 수 있으며, (3) 신설하려는 Rationale ID `R-CC-17` 은 이미 다른 주제(`render_form` fallback)가 점유하고 있어 그대로 적용하면 anchor 충돌이 난다. 이 세 가지는 draft 를 최종 커밋/적용하기 전에 반드시 손봐야 하는 실무적 결함이며, 나머지(선행조건 귀속·spec_impact 중첩)는 이미 올바르게 처리돼 있다.

## 위험도

MEDIUM

STATUS: success
