# Rationale 연속성 검토 결과

**대상**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-05-23

---

## 발견사항

### [CRITICAL] 결정 4 — 비활성 트리거 처리 흐름 변경 시 인증 단계 bypass 위험

- **target 위치**: 결정 4, `spec/5-system/12-webhook.md §7 처리 흐름 step 5` 갱신안
- **과거 결정 출처**: `spec/5-system/12-webhook.md §7` 처리 흐름 (step 5 → step 6 → step 7 순서), `spec/5-system/12-webhook.md §3.1 WH-SC-04` (인증 실패 시 401)
- **상세**:
  현행 `§7 처리 흐름`은 step 5 에서 `isActive === false → 410 Gone`, step 6 에서 인증 검증, step 7 에서 `config.chatChannel` 분기를 처리하는 순서다. Target 의 결정 4 는 step 5 를 "isActive === false → config.chatChannel 있으면 **step 7 로 바로 진입**, 없으면 410 Gone" 으로 교체하려 한다. 이 흐름 변경은 `isActive === false` + `config.chatChannel` 있는 트리거에 대해 **step 6 인증 검증을 완전히 건너뛰게** 만든다.

  Target 의 케이스 매트릭스에는 `X-Telegram-Bot-Api-Secret-Token 누락/불일치 → 401` 이 별도 행으로 존재하므로, 인증 검증이 비활성 여부 확인과 무관하게 선행되어야 함을 의도한 것으로 보인다. 그러나 제안하는 step 5 번경은 인증 단계(step 6)를 skip 하고 step 7 로 점프하는 문장으로 작성되어 있어, 인증 없는 외부 요청이 비활성 chatChannel 트리거에 202 를 받을 수 있는 attack surface 가 열린다.

  기존 `WH-SC-04` ("인증 실패 시 401 Unauthorized") 는 비활성 여부와 무관하게 전 케이스에 적용되는 invariant 이며, 이를 우회하는 흐름은 명시적 Rationale 없이 도입되는 invariant 위반이다.

- **제안**:
  처리 흐름 step 수정안을 다음 순서로 재설계한다:
  1. (기존 step 5) `isActive === false` → config.chatChannel 있으면 **step 6(인증 검증) 으로 그대로 진행** (인증 통과 후 step 7c 에서 silent skip), 없으면 410 Gone.
  2. 즉, isActive 분기와 인증 순서를 바꾸지 않고 step 7c 의 silent skip 경로에서 비활성 케이스를 처리한다.
  또는 step 5 변경 내용에 "인증 검증(step 6) 은 isActive 에 무관하게 항상 선행한다" 를 명문화하고, step 순서 재정렬이 아닌 step 7c 확장으로 구현한다.
  R-CC-12 Rationale 에도 "비활성 chatChannel 트리거는 인증 통과 후에만 202 를 받는다" 를 명시한다.

---

### [WARNING] 결정 2 — `config` deep-merge 정책과 `botTokenRef` PATCH 차단의 충돌 지점

- **target 위치**: 결정 2, `spec/2-navigation/2-trigger-list.md §3` PATCH 설명 cross-link 추가
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md §3` API 표 하단 주석 ("config (Deep merge — config.authType / config.hmacHeader / config.hmacSecret / config.bearerToken / config.notification / config.interaction 등 서브 키 단위 부분 갱신)")
- **상세**:
  기존 §3 주석은 `config` PATCH 가 서브 키 단위 deep-merge 임을 명시하며, 나열된 서브 키 목록에 `config.chatChannel.*` 에 대한 언급이 없다. Target 은 "cross-link 한 줄 추가" 로 `botTokenRef` PATCH 차단을 인용하려 하는데, 기존 deep-merge 주석 자체를 갱신하지 않으면 독자는 `config.chatChannel` 도 동일 deep-merge 로 동작한다고 오해할 수 있다. 특히 `config.chatChannel.botTokenRef` 는 현재 deep-merge 주석의 나열 예시와 같은 패턴이라 혼동이 쉽다.

  이는 기존 "config deep-merge 는 서브 키 단위" 원칙을 `botTokenRef` 에 대해 조용히 예외 처리하는 형태가 되어, 원칙의 암묵적 가정("config 서브 키는 PATCH 로 갱신 가능")을 무근거하게 위반한다.

- **제안**:
  `spec/2-navigation/2-trigger-list.md §3` PATCH 설명 주석에 다음을 추가한다: "`config.chatChannel.botTokenRef` 는 PATCH 불가 — [Spec Chat Channel §5.4]` 의 single-path 정책 (rotate API 전용)". cross-link 한 줄 외에 deep-merge 주석의 예외 목록에 명시적으로 포함시켜야 "서브 키 단위 부분 갱신" 원칙과의 경계가 명확해진다.

---

### [WARNING] 결정 3 — `text_only` → `text` rename 시 carousel imageUrl 처리 동작 변화의 Rationale 부재

- **target 위치**: 결정 3, 노드타입 × enum × 버전 완전 매트릭스, Carousel / `text` (v1·v2) 열
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-04` ("carousel 은 카드 N장 sequential ChannelMessage (image url 있으면 sendPhoto, 없으면 sendMessage)"), `spec/4-nodes/7-trigger/providers/telegram.md §5.4` carousel v1 렌더 방식 ("imageUrl 있으면 sendPhoto")
- **상세**:
  기존 CCH-MP-04 와 telegram.md §5.4 의 carousel v1 동작 정의는 "imageUrl 있으면 sendPhoto, 없으면 sendMessage" 이다. Target 의 `text` (구 `text_only`) enum 의 carousel 동작은 "sequential MarkdownV2 카드 (imageUrl 무시)" 로 정의되어 있다. 이는 기존 `text_only` 의 의미("모든 시각형 노드를 MarkdownV2 텍스트/monospace 로 fallback") 와는 일관하지만, 기존 CCH-MP-04 / telegram.md §5.4 의 v1 default carousel 동작 (`auto` 와 `text_only` 의 구분 없는 단일 기술)과 충돌한다.

  현행 spec 은 `visualNode` 가 `photo`/`text_only` 두 값만 있고 `auto` 가 없어서 "default carousel 동작" 이 어느 enum 에 속하는지 명시되지 않았다. Target 의 매트릭스 주석("auto + Carousel v1 = §5.4 의 현행 동작 그대로") 이 이를 해소하지만, CCH-MP-04 의 기존 v1 정책 기술이 `auto` 와 `text` 로 분기되는 새 의미를 반영하지 않은 채 남아 있는 한, 두 spec 이 동일 `carousel v1` 을 다르게 기술하게 된다.

  Rationale 신설 항목 (a)(b)는 rename 과 `auto` 신설을 다루지만, `text` 에서 imageUrl 이 무시되는 이유 (기존 CCH-MP-04 에서 `text_only` 가 imageUrl 을 무시했는지 여부) 에 대한 Rationale 가 없다.

- **제안**:
  결정 3 의 Rationale 신설 항목에 "(e) `text` enum 에서 carousel imageUrl 무시 이유: `text_only` 는 '모든 시각형 노드를 텍스트 fallback' 이 명시적 의도이므로 imageUrl 전송도 하지 않는다. `auto` 가 현행 carousel imageUrl 동작을 보존하는 별도 enum 이 된 이유" 를 추가한다. 또한 `15-chat-channel.md §3.3 CCH-MP-04` 의 v1 정책 기술을 "enum 값에 따른 분기" 로 갱신해야 `telegram.md §5.4` 와 정합이 유지된다 (현재 plan 에는 §4.1 의 config JSONB 예시와 §3.3 의 CCH-MP-04 본문 갱신이 언급되지만, CCH-MP-04 v1 정책 기술 자체의 enum 분기 갱신이 명시되어 있지 않다).

---

### [WARNING] 결정 2 — `hasBotToken` DTO 파생 필드의 위치가 `chat-channel-adapter.md §2.3` 갱신 의무와 불일치

- **target 위치**: 결정 2, `hasBotToken` canonical 정의 위치
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` ("Trigger.config.chatChannel 의 in-memory representation"), 동 §7 변경 관리 ("본 인터페이스 변경은 15-chat-channel.md + providers/<name>.md 두 외부 spec 동시 갱신 의무")
- **상세**:
  Target 은 `hasBotToken` 이 `ChatChannelConfig` in-memory type 에 포함되지 않는다고 명시한다 ("DTO 전용 — 변환 layer 는 backend response interceptor 책임"). 이는 기존 `chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` 인터페이스가 `Trigger.config.chatChannel` 의 in-memory representation 으로 정의되어 있어, DTO 파생 필드가 해당 타입 경계 밖에 있음을 의미한다.

  그러나 `chat-channel-adapter.md §7 변경 관리` 는 "본 인터페이스 변경은 15-chat-channel.md + providers/<name>.md 두 외부 spec 동시 갱신 의무" 를 규정한다. `hasBotToken` 자체는 `ChatChannelConfig` 를 변경하지 않지만, 이 필드가 API 응답에서 `chatChannel` 오브젝트에 포함되는 형태라면 `ChatChannelConfig` ↔ API DTO 의 경계가 convention 에 문서화되어 있지 않다. Convention 은 현재 `ChatChannelConfig` 가 API 응답의 chatChannel 필드와 어떻게 다른지 설명하지 않아, 구현자가 `hasBotToken` 을 어댑터 코드 어디에서 주입해야 하는지 불명확.

- **제안**:
  `chat-channel-adapter.md §2.3` 에 다음을 추가한다: `ChatChannelConfig` 는 어댑터 내부 in-memory 표현이며 API 응답 DTO 와 다를 수 있음을 명시하고, API 응답 전용 파생 필드(예: `hasBotToken`) 는 본 타입 밖의 response interceptor/transformer 가 추가함을 한 줄 주석으로 명시. 이 추가는 `chat-channel-adapter.md §7 변경 관리` 의 "15-chat-channel.md 동시 갱신" 의무와 별개로, convention 자체의 경계 명시를 위한 것이므로 결정 2 의 영향 spec 파일 목록에 포함되어야 한다.

---

### [INFO] 결정 3 — `auto` default 설정 시 기존 `text_only` 사용자의 동작 기대 변화

- **target 위치**: 결정 3, enum 의미 및 기존 데이터 하위 호환
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §4.1` `uiMapping.visualNode: "photo"` (예시, `text_only` 가 현행 타입에 포함), `spec/conventions/chat-channel-adapter.md §2.3`
- **상세**:
  기존 `visualNode` 가 미설정된 트리거는 `text_only` 가 default 로 동작했다고 추정되나, 현행 spec 의 `§4.1` 예시는 `"photo"` 를 보여주고 default 를 명시하지 않는다. Target 은 새 default 를 `"auto"` 로 설정한다. `visualNode` 가 미설정된 기존 트리거가 있다면 동작이 `text_only` 에서 `auto` 로 바뀌게 되어 carousel imageUrl 이 있는 경우 sendPhoto 가 시작될 수 있다. 기존 데이터 하위 호환 섹션은 `text_only` 가 DB 에 저장된 경우만 다루고, 미설정(null/absent) 케이스의 default 변화를 명시하지 않는다.

- **제안**:
  결정 3 의 "기존 데이터 하위 호환" 항목에 "`visualNode` 가 미설정(null/absent)인 기존 트리거에 대해서는 어댑터가 어떤 값을 적용하는지 (default `auto` vs 기존 동작 유지를 위한 `text` 임시 fallback)" 를 명시한다. 만약 DB 에 미설정 트리거가 존재할 가능성이 있다면 이 케이스의 normalize 정책도 developer plan 에 전달한다.

---

### [INFO] 결정 4 — `202 Accepted` vs `200 OK` 채택 근거, WH-RS-01 과의 명시적 연결 보완

- **target 위치**: 결정 4, Rationale R-CC-12 (a)
- **과거 결정 출처**: `spec/5-system/12-webhook.md §3.3 WH-RS-01` ("요청 수신 즉시 202 Accepted + executionId 반환"), `spec/5-system/12-webhook.md §7 step 10` ("202 Accepted + { executionId } 반환")
- **상세**:
  Target 의 R-CC-12 (a) 는 "기존 12-webhook.md §7 step 7c·step 10 이 202 를 SoT 로 정의" 라고 하지만, 정작 가장 먼저 찾아야 할 상위 요구사항 WH-RS-01 ("202 Accepted") 을 인용하지 않는다. WH-RS-01 이 spec 체계에서 202 의 진원지이므로 이를 명시적으로 인용하면 "왜 202 인가" 의 체인이 완결된다. 현재 기술은 step 7c/10 이라는 구현 흐름 기준으로만 근거를 설명해 요구사항 계층과 연결이 약하다.
- **제안**:
  R-CC-12 (a) 에 "WH-RS-01 이 202 Accepted 를 webhook 수신 응답 표준으로 정의 (요구사항 계층 SoT)" 를 명시적으로 인용한다.

---

### [INFO] 결정 1 — `botTokenRef` / `secretTokenRef` 내부 ref 노출 금지 정책의 Rationale 위치

- **target 위치**: 결정 1, 내부 ref 노출 금지 + Rationale 명시
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-03` (ref 만 config 에 보관, plaintext 금지), `spec/conventions/chat-channel-adapter.md §6 보안` (ref 만 보관, plaintext 어댑터 밖 노출 금지)
- **상세**:
  Target 의 결정 1 은 "내부 ref (`botTokenRef`, `secretTokenRef`) 는 사용자에게 절대 노출 금지 — 매트릭스 표기 X + Rationale 명시" 를 요구한다. 이 원칙은 기존 CCH-SE-03 + chat-channel-adapter.md §6 에 이미 합의된 것이므로 새 Rationale 추가는 "중복" 이 아니라 nav-layer spec 에서의 연결이다. Rationale 을 `2-trigger-list.md` 의 R-8 에 포함시킬 때 CCH-SE-03 을 cross-reference 하면 "왜 이 원칙이 UI 레이어에서도 강제되는가" 의 연결이 명확해진다.
- **제안**:
  `2-trigger-list.md` 의 신설 R-8 에서 CCH-SE-03 을 인용하고 "이 UI 레이어 결정은 CCH-SE-03 의 UI 표현 차원 적용" 임을 명시한다.

---

## 요약

Target 문서는 전반적으로 기존 Rationale 을 인지하고 번복하는 결정(결정 2 의 single-path, 결정 4 의 WH-EP-07 예외)에 새로운 근거를 함께 제공하고 있어 Rationale 연속성이 대체로 유지된다. 그러나 결정 4 의 `12-webhook.md §7` 처리 흐름 step 재정렬 방식이 step 5 에서 step 7 로 직접 점프하는 구조를 취해, step 6 의 인증 검증(WH-SC-04 invariant)을 비활성 chatChannel 트리거에 대해 우회하는 결과를 초래한다. 이는 기존 인증 정책의 암묵적 invariant("모든 경로에서 인증은 선행")를 이유 없이 위반하는 CRITICAL 수준의 설계 결함이다. 추가로 기존 `config` deep-merge 정책의 예외 명시 부족, carousel `text` enum 에서의 imageUrl 처리 변화에 대한 Rationale 공백, `hasBotToken` 의 `ChatChannelConfig` 경계 문서화 누락이 WARNING 수준으로 발견됐다. 이 사항들을 plan 문서 및 후속 spec PR 에 반영하여 구현 단계에서의 혼동을 예방해야 한다.

---

## 위험도

**HIGH**

(CRITICAL 발견 1건 — 처리 흐름 step 재정렬로 인한 인증 bypass 가능성. WARNING 3건 — config deep-merge 예외 문서화 부족, carousel text enum imageUrl 동작 Rationale 부재, hasBotToken ChatChannelConfig 경계 불명확. INFO 2건 — 참고 수준.)
