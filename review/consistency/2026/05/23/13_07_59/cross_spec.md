# Cross-Spec 일관성 검토 결과

**Target**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
**검토 일시**: 2026-05-23
**검토자**: consistency-checker (cross-spec)

---

## 발견사항

### [WARNING] 결정 3 — `visualNode` enum 교체 시 `chat-channel-adapter.md §2.3` 현행 타입과 직접 충돌
- **target 위치**: 결정 3 §1 — `spec/conventions/chat-channel-adapter.md §2.3` 변경 기술
- **충돌 대상**: `/spec/conventions/chat-channel-adapter.md §2.3` `ChatChannelConfig.uiMapping.visualNode` 현행 정의
- **상세**: 현행 `chat-channel-adapter.md §2.3` 의 `visualNode` 타입은 `"photo" | "text_only"` (2개 값). target 이 제안하는 신규 enum 은 `"text" | "photo" | "auto"` (3개 값, `text_only` → `text` rename + `auto` 신설). target plan 문서는 이 변경을 "원자적 동시 갱신 의무 3 파일" 로 명시하고 있으며, 실제 spec PR 이 작성되기 전까지는 `chat-channel-adapter.md §2.3` 와 plan 의 enum 정의가 충돌 상태로 존재한다. 이 자체는 plan ↔ 현행 spec 간의 의도된 delta 이므로 CRITICAL 은 아니지만, plan 이 채택되면 다음 연쇄 갱신 의무가 발생한다:
  - `spec/4-nodes/7-trigger/providers/telegram.md §5.4` 의 Carousel/Chart/Table 매트릭스가 현재 `visualNode` 컬럼 없이 "v1 렌더 방식 / v2" 2컬럼으로만 구성되어 있음 — target 은 `visualNode` enum 값별 컬럼 직접 추가를 요구함. 현재 telegram.md §5.4 표는 이 컬럼을 포함하지 않으므로, plan 에서 정의한 "5 파일 한 PR" 원자성을 지키지 않으면 telegram.md §5.4 와 chat-channel-adapter.md §2.3 가 서로 모순된 상태로 독립 머지될 위험이 있음.
  - `spec/5-system/15-chat-channel.md §4.1` 의 JSONB 예시는 현재 `"visualNode": "photo"` 로 기술 — 신규 enum default `"auto"` 와 불일치. 이 역시 동일 PR 내에서 갱신해야 한다.
- **제안**: spec PR 작성 시 chat-channel-adapter.md / 15-chat-channel.md / telegram.md 의 세 파일을 plan 에 명시된 대로 한 commit 으로 묶는 것이 필수. 개별 파일의 단독 머지 금지 조건을 PR description 에 명기할 것. 검토 체크리스트: telegram.md §5.4 표에 `text(v1·v2)` / `photo v1` / `photo v2` / `auto v1` / `auto v2` 컬럼이 실제로 추가되었는지, 15-chat-channel.md §4.1 예시의 `visualNode` 값이 갱신되었는지.

---

### [WARNING] 결정 4 — `WH-EP-07` 본문 교체 방식이 기존 webhook spec 의 처리 흐름 step 5 와 비대칭
- **target 위치**: 결정 4 §2 — `spec/5-system/12-webhook.md` 동시 갱신 기술, §7 처리 흐름 step 5
- **충돌 대상**: `/spec/5-system/12-webhook.md §7` 처리 흐름 현행 step 5
- **상세**: 현행 `12-webhook.md §7` step 5 는 `"Trigger.isActive === false → 410 Gone"` 이다. target plan 은 이 step 5 를 `"config.chatChannel 가 있으면 step 7 로 진입(어댑터 분기 안에서 silent skip), 없으면 410 Gone"` 으로 원문 교체할 것을 요구한다. 그러나 현행 §7 step 7 은 chat-channel 분기(`config.chatChannel 가 있으면`) 를 이미 포함하고 있다(step 7 a~f). step 5 에서 "step 7 로 진입" 이라는 참조를 추가하면 step 순서상 인증 검증(step 6) 을 건너뛰는 것처럼 읽힐 수 있다. plan 본문은 "어댑터 분기 안에서 silent skip" 이라고 적시했으나, 인증(step 6) 을 통과한 뒤 step 7 로 가는 것인지, 인증 전에 바로 step 7 로 가는 것인지가 step 5 의 묘사만으로는 불분명하다. target plan 의 케이스 매트릭스에서는 `X-Telegram-Bot-Api-Secret-Token` 누락/불일치가 401 을 반환하므로, 인증은 step 5(isActive 체크) **이전** 또는 **이후** 어느 위치에서도 수행해야 한다. 현행 흐름은 인증이 step 6 이므로 비활성 트리거에 대한 인증 시도 순서가 결정 4 케이스 매트릭스와 충돌할 가능성이 있다.
- **제안**: `12-webhook.md §7 step 5` 원문 교체 시, 비활성 chatChannel 트리거의 경우 인증(step 6) 을 **먼저** 수행한 뒤 step 7 의 어댑터 분기로 진입하는 순서인지를 명시적으로 서술할 것. 혹은 케이스 매트릭스에서 "비활성 트리거(chatChannel 경로) → 202" 케이스를 "인증 통과 후" 조건으로 명기할 것. 처리 흐름 단계 순서(인증 → isActive 체크 → chatChannel 분기)가 변경되는지 여부를 명확히 해야 WH-EP-07 예외 조항이 정합되게 작성될 수 있다.

---

### [WARNING] 결정 2 — `hasBotToken` derived 필드의 canonical 위치와 `spec/1-data-model.md §2.8` cross-link 갱신 범위 불명확
- **target 위치**: 결정 2 §2 — "영향 받지 않는 부분" 에서 `spec/1-data-model.md §2.8` 에 cross-link 한 줄 추가 언급
- **충돌 대상**: `/spec/1-data-model.md §2.8` (Trigger 컬럼 목록) 현행 정의
- **상세**: 현행 `1-data-model.md §2.8` 의 Trigger 표는 `config` JSONB 필드에 대해 `chatChannel 서브 필드는 [Spec Chat Channel §4.1] 참조` 라는 cross-link 를 이미 보유하고 있다. target plan 은 "§2.8 의 `config` JSONB 설명 하단에 `hasBotToken` DTO 파생 필드 cross-link 한 줄 추가" 를 결정 2 범위 안이라고 기술했으나, `hasBotToken` 의 canonical 정의 위치는 `15-chat-channel.md §5.4` 임을 동시에 명시한다. `1-data-model.md §2.8` 은 "영향 받지 않는 부분" 섹션에서 "컬럼 변경 없음, cross-link 추가만" 이라고 분류하면서도, 영향 spec 파일 표에는 포함되지 않는다. 이로 인해 spec PR 에서 `1-data-model.md §2.8` 의 cross-link 추가가 누락될 위험이 있다.
- **제안**: 영향 spec 파일 표에 `spec/1-data-model.md` 를 추가하거나(소규모 변경이라도 추적 가능하도록), 또는 "영향 받지 않는 부분" 섹션 설명을 "§2.8 에 cross-link 한 줄 추가 포함" 으로 명시해 PR 작성자가 누락하지 않도록 할 것.

---

### [WARNING] 결정 4 케이스 매트릭스 — `12-webhook.md §3.1` 응답 코드 표에 기재된 현행 410 Gone 예외 없음 조항과 모순
- **target 위치**: 결정 4 §2 — `12-webhook.md §3.1 응답 코드 표 (line 186)` 갱신 기술
- **충돌 대상**: `/spec/5-system/12-webhook.md §3.1` 에러 응답 표, 현행 `| 410 Gone | 트리거가 비활성 상태 |` 행
- **상세**: 현행 `12-webhook.md §3.1` 에러 응답 표의 `410 Gone` 행은 단순히 "트리거가 비활성 상태" 로 기술되어 있고 어떠한 예외도 명시하지 않는다. target plan 은 이 행을 `"트리거가 비활성 상태 (단, config.chatChannel 트리거는 §5.5 적용 — 비활성도 202 + ignored)"` 로 교체할 것을 요구한다. 이것은 plan 이 명시한 "본문 원문 교체" 이므로 cross-link 추가만이 아니라 실제 행 내용 변경이다. 현행 spec 과의 충돌은 의도된 것이며 plan 이 이를 명시하고 있으나, WH-EP-07 요구사항 행(§3.1 요구사항 표, line 45)도 동시에 갱신해야 한다: 현재 `WH-EP-07 | 비활성 트리거로의 요청은 410 Gone 응답 반환 | 필수` 만 기술되어 있고 chatChannel 예외가 없다. target plan 은 WH-EP-07 **본문** 갱신을 지시하지만(§3.1 WH-EP-07 본문 교체), 요구사항 ID 행(표 안의 ID 컬럼)도 같이 변경해야 표 전체의 일관성이 유지된다.
- **제안**: spec PR 에서 `12-webhook.md §3.1` 의 두 위치 — (a) 요구사항 표의 WH-EP-07 행과 (b) 에러 응답 코드 표의 410 Gone 행 — 를 모두 갱신했는지 검토할 것.

---

### [INFO] 결정 1 — `spec/2-navigation/2-trigger-list.md §2.3.1` 필드 권한 매트릭스에 신규 9 row 추가 시 기존 "Webhook Configuration" 카드 경계 명확화 필요
- **target 위치**: 결정 1 §2.3.1 — "Chat Channel" 카드를 "Webhook Configuration" 카드와 형제로 분리
- **충돌 대상**: `/spec/2-navigation/2-trigger-list.md §2.3.1` 현행 필드 권한 매트릭스
- **상세**: 현행 `2-trigger-list.md §2.3.1` 의 카드 목록은 Overview / Webhook Configuration / Schedule Configuration / External Interaction(Notification) / External Interaction(Interaction) / Auth Config 로 구성된다. target plan 은 "Chat Channel" 카드를 "Webhook Configuration 카드와 형제 위치" 에 별도 추가하도록 지시하므로 카드 목록이 변경된다. 현행 §2.3 텍스트("Webhook 상세", "Schedule 상세", "인증 설정" 3섹션 기술)도 "Chat Channel" 섹션 추가에 따라 갱신이 필요하다. target plan 은 §2.3 카드 분리와 §2.3.1 매트릭스 row 추가를 모두 언급하지만, §2.3 의 상위 섹션 표(현재 4행)에도 "Chat Channel" 행을 추가해야 한다는 내용이 명시적으로 기술되지 않았다. 자동으로 처리될 수 있으나 누락 위험.
- **제안**: spec PR 에서 `2-trigger-list.md §2.3` 의 섹션 표와 §2.3.1 필드 권한 매트릭스 두 위치를 모두 갱신했는지 확인할 것.

---

### [INFO] 결정 2 — `botTokenRef` PATCH 차단 정책과 기존 PATCH 허용 키 목록과의 명시적 정합
- **target 위치**: 결정 2 §2 — PATCH body 에서 `config.chatChannel.botTokenRef` 변경 차단 (400 VALIDATION_ERROR)
- **충돌 대상**: `/spec/2-navigation/2-trigger-list.md §3` API 표 하단 PATCH 허용 키 목록
- **상세**: 현행 `2-trigger-list.md §3` 의 PATCH 설명은 `config` 키에 대해 "Deep merge — `config.authType` / `config.hmacHeader` / `config.hmacSecret` / `config.bearerToken` / `config.notification` / `config.interaction` 등 서브 키 단위 부분 갱신" 이라고 기술하고, `config.chatChannel` 은 현재 이 목록에 포함되지 않는다(WH-MG-08 이 추가될 계획). target plan 은 `config.chatChannel.botTokenRef` 의 PATCH 변경을 차단하는 정책을 도입한다. 그러나 `config.chatChannel` 의 다른 서브 필드(예: `uiMapping`, `rateLimitPerMinute`, `languageHints`) 는 PATCH 로 변경 가능해야 한다. 이 허용/차단 경계가 `2-trigger-list.md §3` 의 PATCH 설명에 명시되지 않으면, 구현자가 `config.chatChannel` 전체를 PATCH 차단으로 오해할 위험이 있다.
- **제안**: `2-trigger-list.md §3` PATCH 설명에 `config.chatChannel` 서브 키 갱신 허용 범위와 `botTokenRef` 차단 예외를 명시할 것.

---

### [INFO] 결정 4 — Inbound HTTP Contract 에서 `202 Accepted` 와 WH-RS-01 (`202 Accepted + executionId`) 의 본문 형식 차이
- **target 위치**: 결정 4 케이스 매트릭스 — `{ ignored: true }` 응답 본문
- **충돌 대상**: `/spec/5-system/12-webhook.md §3.1 WH-RS-01`, `§3.1 성공 응답 예시`
- **상세**: 현행 `12-webhook.md §3.1` 의 WH-RS-01 은 `202 Accepted + executionId` 를 성공 응답으로 정의하며, 성공 응답 예시는 `{ "executionId": "uuid", "message": "Webhook received, workflow execution started" }` 이다. target plan 의 케이스 매트릭스에서 "새 execution 시작" 케이스는 `202 + { executionId }` 로 일관되나, "기존 execution forwarding" 및 "무시" 케이스는 `202 + { ignored: true }` 를 반환한다. `{ ignored: true }` 는 현행 WH-RS-01 에 정의되지 않은 응답 shape 이다. 이 새 응답 shape 은 `15-chat-channel.md §5.5` 에 신설될 예정이지만, `12-webhook.md §3.1` 의 성공 응답 예시가 유일한 성공 응답 형태("항상 executionId 포함") 처럼 보이는 현행 기술과 논리적 긴장이 있다.
- **제안**: `12-webhook.md §3.1` 성공 응답 설명에 "chatChannel 트리거는 §5.5 의 형식이 적용 — `{ ignored: true }` 또는 `{ executionId }` 가능" 이라는 cross-link 추가를 검토할 것. WH-RS-01 본문에 예외 조항을 추가하거나, 적어도 성공 응답 예시 아래에 주석을 달 것.

---

### [INFO] Rationale ID `R-CC-10 / R-CC-11 / R-CC-12` 와 기존 `15-chat-channel.md` Rationale 목록과의 충돌 가능성
- **target 위치**: Rationale ID 컨벤션 섹션 — `R-CC-10 / R-CC-11 / R-CC-12` 신설
- **충돌 대상**: `/spec/5-system/15-chat-channel.md` Rationale 섹션 현행 항목 (R1~R9, R-K)
- **상세**: 현행 `15-chat-channel.md` 의 Rationale 항목은 `R1, R2, ... R9, R-K` 형태의 prefix 없는 또는 다른 패턴의 ID 를 사용한다. target plan 은 신규 Rationale 에 `R-CC-10 / R-CC-11 / R-CC-12` prefix 를 사용하기로 결정했으며, 기존 `[EIA §R10]` 등 외부 참조와의 혼동을 방지하기 위한 목적임을 설명하고 있다. 이 자체는 합리적인 컨벤션 결정이나, 기존 `R1 ~ R9` 와 `R-CC-10` 의 번호 체계가 혼용되어 향후 Rationale 항목 추가 시 혼란을 줄 수 있다. `R9` 다음에 `R10` 이 아니라 `R-CC-10` 이 오는 이유를 문서 자체에 주석으로 남기지 않으면 후속 작성자가 번호 체계를 오해할 수 있다.
- **제안**: `15-chat-channel.md` Rationale 섹션 도입부에 "신규 로컬 Rationale 은 `R-CC-N` prefix 사용 (기존 `[EIA §RN]` 외부 참조와 구분)" 이라는 한 줄 주석을 추가할 것.

---

## 요약

target plan(`spec-telegram-chat-channel-ui-polish.md`) 은 전반적으로 기존 spec 구조를 잘 이해하고, 의도된 변경(WH-EP-07 예외, `visualNode` enum 확장, `hasBotToken` DTO 파생 필드 신설, 단일 경로 botToken 정책)과 기존 spec 의 충돌 지점을 명시적으로 인식하고 있다. 특히 "원자적 동시 갱신 의무"와 "영향 받지 않는 부분" 구분이 세밀하게 기술되어 있어 전반적인 위험은 낮다. 다만 다음 4개 WARNING 이 spec PR 작성 단계에서 주의가 필요하다: (1) `visualNode` enum 3파일 원자 갱신에서 telegram.md §5.4 컬럼 추가가 실제로 반영되었는지; (2) `12-webhook.md §7 step 5` 원문 교체 시 인증 단계(step 6) 와의 순서 관계가 명확히 기술되었는지; (3) `1-data-model.md §2.8` cross-link 추가가 영향 파일 추적에서 누락되지 않았는지; (4) `12-webhook.md §3.1` 의 요구사항 표(WH-EP-07 행) 와 응답 코드 표 두 위치가 모두 갱신되었는지. 이 WARNING 들은 모두 spec PR 내 교정 가능하며, CRITICAL 수준의 직접 모순(두 spec 이 동시에 채택 불가 수준의 모순)은 발견되지 않았다.

## 위험도

MEDIUM

---

*본 검토는 target plan 의 결정 4건이 draft 상태임을 전제로, 현행 spec 과의 충돌 지점을 사전 식별한 것이다. spec PR 작성 후 실제 본문이 확정되면 추가 일관성 검토를 권장한다.*
