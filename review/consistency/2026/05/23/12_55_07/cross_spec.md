# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-23

---

## 발견사항

### [CRITICAL] 결정 3 — `visualNode` enum 변경이 `conventions/chat-channel-adapter.md §2.3` 현행 값과 충돌

- **target 위치**: plan 결정 3, "enum 의미" 항 및 "원자적 동시 갱신 의무" 항
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`
- **상세**: 현행 `chat-channel-adapter.md §2.3` 의 `uiMapping.visualNode` 타입은 `"photo" | "text_only"` 로 정의되어 있다. target plan 은 이것을 `"text" | "photo" | "auto"` (default `"auto"`) 로 교체한다. plan 은 "원자적 동시 갱신 의무" 를 명시하고 3 파일을 한 commit 으로 묶도록 요구하고 있으나, plan 문서 자체가 이미 `chat-channel-adapter.md §2.3` 의 현행 enum 값과 **직접 모순** 상태다 — spec PR 이 머지되기 전까지는 두 정의가 병존한다. 또한 `spec/5-system/15-chat-channel.md §4.1` 의 `"visualNode": "photo"` JSONC 예시 (현재 `"photo" | "text_only"` 2-enum) 와도 충돌하며, `spec/4-nodes/7-trigger/providers/telegram.md §5.4` 의 v1/v2 렌더 분기 표도 새 3-enum 기준으로 재작성이 필요하다.
- **제안**: plan 이 이미 3 파일 동시 갱신을 의무화하고 있는 점은 올바른 방향이다. spec PR 착수 시 `chat-channel-adapter.md §2.3`, `15-chat-channel.md §4.1 JSONC 예시 주석`, `telegram.md §5.4` 를 한 commit 에 묶어야 하며, plan 문서의 "원자적 동시 갱신 의무" 항에 `chat-channel-adapter.md §7 Changelog` 행 추가 의무도 명시적으로 포함시켜야 한다. (현재 plan 에는 Changelog 행 추가가 `chat-channel-adapter.md` 변경 항목에 언급되어 있으나, `telegram.md` 와 `15-chat-channel.md` 에 대한 Changelog 갱신 의무는 명시되지 않음.)

---

### [CRITICAL] 결정 4 — WH-EP-07 예외 조항 추가 시 `12-webhook.md §3.1 응답 코드 표` 와 `§7 처리 흐름 step 5` 가 직접 모순 상태

- **target 위치**: plan 결정 4, "원자적 동시 갱신 의무" 항 2번 파일
- **충돌 대상**: `spec/5-system/12-webhook.md §3.1` 에러 응답 표 (`410 Gone | 트리거가 비활성 상태`) 및 `§7 처리 흐름 step 5` (`Trigger.isActive === false → 410 Gone`)
- **상세**: 현행 `12-webhook.md §3.1` 에러 응답 표는 `410 Gone` 을 조건 없이 "트리거가 비활성 상태" 로 기술하고, `§7 처리 흐름 step 5` 도 `Trigger.isActive === false → 410 Gone` 으로 단일 경로를 기술한다. target plan 은 `chatChannel` 이 설정된 트리거는 비활성 상태여도 `200 OK + { ok: true }` 를 반환한다는 예외를 추가해야 한다고 명시한다. 이 예외 조항이 spec PR 에 반영되기 전까지 `12-webhook.md` 는 예외 없는 `410 Gone` 정책을 단일 진실로 선언하는 상태이며, plan 의 결정 4 와 직접 충돌한다. plan 자체가 동시 갱신 의무를 올바르게 인식하고 있으나, 현재 상태는 CRITICAL 충돌이다.
- **제안**: plan 이 제시한 3 파일 동시 갱신 (15-chat-channel.md §5.5 신설 + 12-webhook.md WH-EP-07 본문 + telegram.md §6 cross-link) 을 spec PR 착수 시 한 commit 에 반드시 묶어야 한다. `§7 처리 흐름 step 5` 의 갱신은 plan 에 명시되어 있으나 (`§7 처리 흐름 step 5 cross-link 한 줄씩 추가`), 실제 step 5 원문 교체(`Trigger.isActive === false → 410 Gone` → 분기 처리) 가 필요한지 또는 cross-link 한 줄로 충분한지 plan 에 명확히 기술되어 있지 않다. 모호한 부분으로, spec PR 전에 명확히 해야 한다.

---

### [WARNING] 결정 2 — `hasBotToken` derived 필드의 위치 선언과 `spec/1-data-model.md §2.8` Trigger 필드 목록 간 책임 경계 불명확

- **target 위치**: plan 결정 2, "`hasBotToken` 의 canonical 정의 위치" 항
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` 엔티티 테이블
- **상세**: target plan 은 "`hasBotToken: true` 는 `spec/5-system/15-chat-channel.md §5.4` 에 신설 — 응답 DTO 전용 derived 필드 (`botTokenRef IS NOT NULL → hasBotToken: true`); DB 컬럼 아님. `spec/1-data-model.md §2.8` 의 컬럼 목록과 분리" 라고 명시한다. 현행 `spec/1-data-model.md §2.8` Trigger 표에는 `hasBotToken` 필드가 없고, plan 은 "DB 컬럼 아님" 을 명시하므로 컬럼 추가는 없다. 그러나 `spec/1-data-model.md §2.8` 에는 이미 `config` 컬럼 설명에 `chatChannel` 서브 필드 cross-link 가 존재하며, DTO 전용 derived 필드 패턴 (`autoRefresh: boolean` — `spec/1-data-model.md §2.10` Integration 참조) 이 precedent 로 존재한다. 문제는 `spec/1-data-model.md §2.8` 에 "DTO 전용 derived 필드" 섹션이 없어 `hasBotToken` 의 존재를 discovery 할 방법이 없다는 점이다. `Integration §2.10` 에는 "응답 DTO 전용 derived 필드: `autoRefresh: boolean`" 을 해당 엔티티 정의 바로 아래에 인라인으로 명시하는 패턴이 있다.
- **제안**: plan 의 spec PR 에서 `spec/1-data-model.md §2.8 Trigger` 에 "응답 DTO 전용 derived 필드" 항목으로 `hasBotToken: boolean` 을 한 줄 추가하고, SoT 는 `15-chat-channel.md §5.4` 임을 cross-link 하는 것이 `Integration §2.10` 의 기존 패턴과 일치한다. plan 현재 상태에서 이 갱신은 누락되어 있다.

---

### [WARNING] 결정 4 — 케이스 매트릭스의 "트리거 미존재 (잘못된 endpointPath)" 404 응답이 `12-webhook.md §3.1` 과 일치하나, chatChannel 경로와 일반 경로의 분기 명확성 부족

- **target 위치**: plan 결정 4 케이스 매트릭스 "트리거 미존재 (잘못된 endpointPath) | 404" 행
- **충돌 대상**: `spec/5-system/12-webhook.md §3.1` 에러 응답 표 (`WH-RS-02`) 및 `§7 처리 흐름 step 4` (`Trigger 없으면 → 404 Not Found`)
- **상세**: target plan 의 케이스 매트릭스는 "트리거 미존재 (잘못된 endpointPath)" 의 경우 chatChannel 경로도 404 를 반환한다고 명시하며 `WH-RS-02` 와 일치한다고 적시한다. 그러나 `§7 처리 흐름` (step 4) 은 `Trigger 없으면 → 404` 가 step 7 의 chatChannel 분기보다 **선행** 한다. 즉, endpointPath 로 Trigger 를 찾지 못하면 chatChannel 여부를 판단하기 전에 이미 404 가 반환된다 — 현행 처리 흐름 기준으로는 충돌이 없다. 단, `15-chat-channel.md §5.5` 신설 절에 이 케이스를 케이스 매트릭스로 재기술하면 "chatChannel 경로도 동일" 이라는 주석이 독자에게 혼란을 줄 수 있다. "chatChannel 여부가 판정되기 전(step 4)에 처리되므로 사실상 동일 경로" 임을 명시하는 설명이 없으면 두 spec 독자가 서로 다른 처리 순서를 상상할 수 있다.
- **제안**: `15-chat-channel.md §5.5` 케이스 매트릭스 또는 해당 Rationale 에 "트리거 미존재 404 는 chatChannel 분기 진입 전 `§7 처리 흐름 step 4` 에서 처리되므로 chatChannel 특수 처리와 무관" 이라는 설명을 한 줄 추가한다.

---

### [WARNING] 결정 2 — PATCH body 의 `config.chatChannel.botTokenRef` 차단 정책이 `2-trigger-list.md §3 PATCH 설명` 에 누락

- **target 위치**: plan 결정 2, "canonical 기재 위치" 항
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3 API 표` 아래 PATCH 설명 블록
- **상세**: 현행 `2-trigger-list.md §3` 의 PATCH 설명 블록은 `config` Deep merge 키 목록에 `config.chatChannel` 을 포함하지 않는다. target plan 은 이 설명 블록에 "`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가 — rotate API 사용" cross-link 한 줄 추가를 요구한다. 현재 상태에서는 `config.chatChannel` PATCH 가능 여부가 전혀 기술되지 않아 구현자가 임의로 허용할 여지가 있다. plan 이 이 갱신을 명시하고 있으므로 conflict 가 해소될 예정이나, 현재는 미정의 상태로 잠재적 구현 충돌이 있다.
- **제안**: spec PR 에서 `2-trigger-list.md §3` PATCH 설명 블록 갱신 시, `botTokenRef` 차단만이 아니라 `config.chatChannel` 의 다른 서브 키 (예: `uiMapping`, `rateLimitPerMinute`, `languageHints`) 의 PATCH 허용 여부도 함께 명시하는 것이 구현자 혼란을 최소화한다. plan 결정 1 의 필드 권한 매트릭스 9 row 중 `edit` 로 표시된 필드들은 PATCH 로 변경 가능해야 하므로, 이 일관성을 §3 PATCH 설명에 반영해야 한다.

---

### [WARNING] 결정 3 — 기존 데이터 하위 호환(`text_only` → `text` rename) 정책이 `spec/conventions/chat-channel-adapter.md §2.3` 의 현행 enum 정의와 이중 SoT 위험

- **target 위치**: plan 결정 3, "기존 데이터 하위 호환" 항
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.uiMapping.visualNode`
- **상세**: plan 은 "read-time normalize fallback: 어댑터가 입력 단계에서 `text_only` → `text` 로 변환" 을 언급하며 이를 후속 developer plan 책임으로 분리한다. 그러나 `chat-channel-adapter.md §2.3` 의 `visualNode` 타입 정의는 spec PR 머지 후 `"text" | "photo" | "auto"` 만 남고 `"text_only"` 는 제거된다. developer plan 이 `text_only` → `text` normalize 코드를 구현할 시점에 spec 에는 이미 `text_only` 가 없으므로, 구현자가 spec 을 읽으면 이 normalize 의 필요성을 인지하지 못할 수 있다. "spec 레벨은 `text` 단일 enum 만 노출" 과 "어댑터가 `text_only` 입력도 처리해야 한다" 는 사실 간의 간격이 spec 에 기술되지 않으면 developer plan 착수 시점에 이 요구사항이 휘발된다.
- **제안**: `chat-channel-adapter.md §2.3` 의 `visualNode` enum 갱신 시, 주석 또는 별도 note 로 "`text_only` 는 DB legacy 값 — 어댑터가 read-time 에 `text` 로 normalize (마이그레이션 완료 전 과도기 정책)" 를 명시한다. 또는 `15-chat-channel.md §5.4` 또는 Rationale 에 해당 note 를 둔다.

---

### [INFO] 결정 1 — `§2.1 행 표시` 의 provider 칩 + `chatChannelHealth` 배지 추가가 `2-trigger-list.md §2.1` 현행 표와 명시적 연결 없음

- **target 위치**: plan 결정 1, "§2.1 행 표시" 항
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §2.1 트리거 목록 항목` 표
- **상세**: 현행 `2-trigger-list.md §2.1` 표에는 `chatChannelHealth` 배지 또는 provider 칩 관련 행이 없다. plan 은 "notificationHealth 와 같은 영역에 나란히" 배치를 명시하지만, 현행 §2.1 표에는 `notificationHealth` 자체도 명시되어 있지 않다 — `WH-MG-07/09` 의 요구사항은 있으나 구체적인 UI 위치가 §2.1 에 표로 기술되지 않은 상태다. 이는 현행 spec 의 §2.1 이 EIA/ChatChannel 배지를 아직 반영하지 못한 불완전 상태임을 의미한다. plan 의 결정 1 이 §2.1 을 갱신하므로 충돌보다는 누락 보완에 해당한다.
- **제안**: spec PR 에서 §2.1 표를 갱신할 때, `notificationHealth` 배지 행도 함께 추가하거나 (현재 WH-MG-07 cross-link 만 있고 §2.1 표에는 없음), 최소한 기존 행이 없음을 확인하고 추가 누락이 없도록 점검한다.

---

### [INFO] `12-webhook.md §7 처리 흐름` 의 step 7c — chatChannel `null` 반환 시 `202 Accepted + { ignored: true }` 응답이 plan 결정 4 케이스 매트릭스와 미대조

- **target 위치**: plan 결정 4 케이스 매트릭스
- **충돌 대상**: `spec/5-system/12-webhook.md §7 처리 흐름 step 7c` (`update === null 이면 → 202 Accepted + { ignored: true } 즉시 반환`)
- **상세**: plan 결정 4 케이스 매트릭스에는 `parseUpdate null 반환 (group chat / 무시 대상)` 케이스가 별도 행으로 존재하지 않는다. `group/supergroup/channel chat | 200 | { ok: true } | groupChatRefusal 안내 sendMessage 발송` 행은 있으나, `from.is_bot === true | 200 | { ok: true } | silent skip` 및 `parseUpdate 미지원 update type | 200 | { ok: true } | silent skip` 행과 `12-webhook.md §7 step 7c` 의 `{ ignored: true }` 응답이 서로 다른 형태다. `§7 step 7c` 는 `202 Accepted + { ignored: true }` 인데, plan 케이스 매트릭스는 `200 OK + { ok: true }` 로 기술하고 있다. 두 spec 이 같은 케이스에 대해 다른 응답 형태를 기술하는 것은 잠재적 구현 충돌이다.
- **제안**: `15-chat-channel.md §5.5` 신설 시 또는 `12-webhook.md §7 step 7c` 갱신 시, null parseUpdate 결과에 대한 응답이 `200 OK + { ok: true }` (plan 결정 4) 인지 `202 Accepted + { ignored: true }` (현행 §7 step 7c) 인지 한 쪽을 SoT 로 결정하고 나머지를 cross-link 로 정렬한다.

---

### [INFO] `conventions/chat-channel-adapter.md §7 변경 관리` — enum 변경 시 동시 갱신 의무 대상 파일 목록이 plan 의 원자적 동시 갱신 대상과 부분 불일치

- **target 위치**: plan 결정 3, "원자적 동시 갱신 의무" 항
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §7 변경 관리`
- **상세**: `chat-channel-adapter.md §7` 은 "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: `spec/5-system/15-chat-channel.md` + `spec/4-nodes/7-trigger/providers/<name>.md`" 라고 기술한다. plan 결정 3 은 3 파일 (`chat-channel-adapter.md`, `15-chat-channel.md`, `telegram.md`) 을 동시 갱신 의무로 정의한다. 두 정의는 내용상 동일하나, `chat-channel-adapter.md §7` 의 의무 목록에 `chat-channel-adapter.md` 자체가 포함되지 않는다는 표현 문제가 있다 (자기 자신을 의무 목록에 포함할 수 없다는 자명한 이유). `spec/4-nodes/7-trigger/providers/_overview.md` 의 catalog 갱신 의무는 §7 에 언급되어 있으나 plan 의 원자적 갱신 의무에는 명시되지 않는다.
- **제안**: plan 의 "원자적 동시 갱신 의무" 항에 `spec/4-nodes/7-trigger/providers/_overview.md` 의 catalog 갱신 여부를 검토하여, visualNode enum 변경이 catalog 에 반영될 내용이 있다면 4번째 파일로 포함한다 (없다면 생략 이유를 명시).

---

## 요약

Cross-Spec 일관성 관점에서 가장 중요한 두 가지 CRITICAL 이슈는 (1) `chat-channel-adapter.md §2.3` 의 `visualNode` 현행 enum (`"photo" | "text_only"`) 과 plan 결정 3 의 신규 3-enum 간 직접 모순, (2) `12-webhook.md §7 step 5` 및 `§3.1` 의 무조건 `410 Gone` 정책과 plan 결정 4 의 chatChannel 경로 `200 OK` 예외 간 직접 모순이다. 두 이슈 모두 plan 자체가 원자적 동시 갱신 의무를 인식하고 있어 spec PR 이 올바르게 실행되면 해소되나, 현 draft 상태는 충돌 상태다. WARNING 급 이슈로는 `hasBotToken` DTO derived 필드의 `1-data-model.md §2.8` 미반영, PATCH 차단 정책의 `2-trigger-list.md §3` 미반영, `text_only` legacy 값의 normalize 요구사항 휘발 위험, `parseUpdate null` 응답의 `202+{ignored:true}` vs `200+{ok:true}` 불일치가 있다. 전반적으로 plan 의 원자적 갱신 의무 설계는 충돌 인식 수준이 높으나, 일부 세부 갱신 대상 (1-data-model.md hasBotToken 항목, §7 step 5 원문 교체 vs cross-link 차이, parseUpdate null 응답 형식) 이 명시적으로 처리되지 않아 spec PR 실행 중 gap 이 발생할 위험이 있다.

---

## 위험도

**MEDIUM**

두 개의 CRITICAL 이슈는 spec PR 의 원자적 갱신이 올바르게 이루어지면 자동 해소된다 (plan 이 이미 인식하고 있음). 구현 착수 전에 spec PR 이 완성되어야 하는 선행 조건을 고려하면, 현재 draft 상태의 충돌이 구현을 직접 차단하지는 않는다. 그러나 WARNING 급 이슈 중 parseUpdate null 응답 형식 불일치는 구현 시 실제 차이를 낳을 수 있어 spec PR 전에 명확히 해야 한다.
