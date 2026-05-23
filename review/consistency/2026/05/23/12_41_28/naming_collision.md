# 신규 식별자 충돌 검토 결과

> target: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
> 검토 시각: 2026-05-23
> 검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `visualNode` enum 값 `text_only` → `text` rename — 기존 config JSONB 와의 충돌

- **target 신규 식별자**: `"text" | "photo" | "auto"` (결정 3)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig.uiMapping.visualNode?: "photo" | "text_only"` (line 150)
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` §4.1 JSONC 예시 `"visualNode": "photo"` (line 162, `text_only` 는 enum 멤버)
- **상세**: target 이 `text_only` 를 `text` 로 rename 하고 `auto` 를 신규 추가한다. 기존 두 파일은 `"text_only"` 를 enum 값으로 이미 사용하고 있다. target plan 이 spec 4 파일에 모두 교체를 명시하고 있으나, (1) 기존 DB `config` JSONB 에 `"visualNode": "text_only"` 로 저장된 운영 데이터와의 하위 호환 처리가 target 에 언급되어 있지 않고, (2) `chat-channel-adapter.md` 의 코드 예시와 typescript 타입 정의가 갱신 대상 목록(`영향 spec 파일` 표)에 포함되어 있으나, 기존 값 `text_only` 가 DB 에 저장된 경우 어댑터가 `"text"` 를 기대하는 조건 분기에서 silent mismatch 가 발생할 수 있다.
- **제안**: spec 에 "기존 `text_only` 값을 읽는 어댑터는 `text` 로 normalize 한다 (read-time migration)" 를 명시하거나, DB migration script 또는 Flyway 마이그레이션으로 `config` JSONB 의 `text_only` 를 `text` 로 일괄 변환하는 단계를 결정 3 의 Rationale 에 추가한다.

---

### [WARNING] `chatChannelHealth` (UI 필드명) vs `chat_channel_health` (DB 컬럼명) — 대소문자 불일치 형태의 혼용 위험

- **target 신규 식별자**: `chatChannelHealth` (결정 1, §2.3.1 매트릭스 row)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.8 Trigger 테이블 컬럼명 `chat_channel_health` (line 773)
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` §4.2 SQL ALTER 예시 `chat_channel_health` (line 186)
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` CCH-SE-01 요구사항에서 `chatChannelHealth` camelCase 혼용 (line 60)
- **상세**: DB 컬럼은 `chat_channel_health` (snake_case), API DTO 및 UI 표시용 필드는 `chatChannelHealth` (camelCase) 로 이미 혼용 중이다. target plan 이 매트릭스 row 에 `chatChannelHealth` 를 추가하는 것은 기존 패턴과 일치하지만, target 이 같은 row 에 `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` 도 추가한다 — 이 명칭들의 DB 대응 컬럼이 `chat_channel_last_error` / `chat_channel_setup_at` / `chat_channel_rotated_at` 임을 spec 에서 명확히 교차 참조해야 reader 혼선을 막을 수 있다. 현재 target 에는 이 교차 참조가 없다.
- **제안**: 매트릭스에 `(DB: chat_channel_last_error)` 식의 주석 컬럼을 추가하거나, 본문에 "이하 필드명은 API/UI camelCase — DB 컬럼은 [Spec Data Model §2.8](../1-data-model.md#28-trigger) 참조" 한 줄을 추가해 혼선을 방지한다.

---

### [WARNING] Rationale 번호 R-8 — 기존 R-7 다음 번호 확인 필요

- **target 신규 식별자**: `R-8` (결정 1, `spec/2-navigation/2-trigger-list.md` Rationale 신설)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/2-navigation/2-trigger-list.md` Rationale 섹션: R-1 ~ R-7 이 이미 정의됨 (마지막 R-7 은 line 232 "detail drawer 에서 Recent Calls 카드 제거")
- **상세**: target 이 R-8 을 신설하는 것은 번호 순서상 적절하다. 실제 충돌은 없다. 다만 `spec/2-navigation/2-trigger-list.md` 의 현재 R-7 이 2026-05-22 에 추가된 최신 Rationale 이므로, 본 plan 이 병행 진행 중인 다른 spec PR 과 동시에 R-8 을 추가하려 할 경우 충돌 가능성이 있다 (현재로서는 다른 plan 이 2-trigger-list.md 에 Rationale 을 추가할 계획이 있는지 확인 필요).
- **제안**: PR 머지 직전에 `2-trigger-list.md` 의 최신 Rationale 번호를 재확인해 R-8 이 여전히 다음 번호인지 검증한다.

---

### [WARNING] Rationale R10/R11/R12 — `spec/5-system/15-chat-channel.md` 기존 최신 Rationale 번호 확인

- **target 신규 식별자**: `R10`, `R11`, `R12` (결정 2·4, `spec/5-system/15-chat-channel.md` Rationale 추가)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` Rationale 섹션: R1~R9, R-K 가 정의됨 (마지막 번호 R9 는 line 407, R-K 는 별도 의미 식별자)
- **상세**: 기존 15-chat-channel.md 의 Rationale 은 R1~R9 + R-K (명명 비대칭 설명) 형태다. target 이 R10/R11/R12 를 추가하는 것은 번호 연속성은 맞으나, 기존 `R-K` 가 알파벳 suffix 를 쓰는 반면 신규는 숫자 suffix — 혼합 naming convention 이 혼선을 줄 수 있다. R-K 는 특정 컬럼 명명 비대칭에 대한 일회성 레이블이므로 큰 문제는 없지만, 새 Rationale 도 알파벳 suffix (R-J, R-L 등) 를 사용할지 숫자 suffix 만 사용할지 정책을 통일하는 것이 바람직하다.
- **제안**: 신규 Rationale 을 R10/R11/R12 (숫자 연속) 로 추가하고, R-K 형태는 기존 레거시로 남기는 방향을 Rationale 첫 줄 주석에 명시하거나, 신규도 R-J/R-L 방식을 사용해 일관성을 유지한다.

---

### [INFO] `hasBotToken` 신규 boolean 필드 — 기존 API DTO 에서 미정의

- **target 신규 식별자**: `chatChannel.hasBotToken: true` (결정 2, `GET /api/triggers/:id` 응답)
- **기존 사용처**: 없음 (신규 도입). 기존 `Trigger.config.chatChannel` 에는 `botTokenRef` 만 존재하고, `hasBotToken` 은 DB 또는 config 어디에도 없는 새 derived 필드다.
- **상세**: 충돌은 없다. 그러나 이 필드가 API 응답 DTO 에 어떻게 노출될지 (derived field vs stored field) 가 target spec 에 상세히 기술되어 있지 않다. `spec/1-data-model.md §2.10` 의 `autoRefresh: boolean` 응답 DTO 전용 derived 필드 패턴 (line 843) 과 동일하게 처리되어야 함을 spec 에 명시해야 한다.
- **제안**: `hasBotToken` 이 DB 컬럼이 아닌 "응답 DTO 전용 derived 필드" 임을 `spec/5-system/15-chat-channel.md §5.4` 또는 `spec/2-navigation/2-trigger-list.md §2.3.1` 매트릭스 비고 컬럼에 명시한다.

---

### [INFO] `BOT_TOKEN_INVALID` 에러 코드 — 이미 정의된 코드와 동일 이름

- **target 신규 식별자**: `BOT_TOKEN_INVALID` (결정 2, 형식 검증 실패 시 400)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 `BOT_TOKEN_INVALID` (line 264) — **이미 정의됨**
- **상세**: 충돌이 없다. target 결정 2 는 `BOT_TOKEN_INVALID` 를 신규 도입으로 기술하고 있으나 실제로는 이미 §5.4 에 정의되어 있다. target 이 "이미 15-chat-channel.md §5.4 에 정의됨" 이라고 명시하고 있어 의도된 인용이다. spec 본문 작성 시 "신규 정의" 가 아닌 "기존 정의 인용" 임을 명확히 표기하는 것이 독자에게 도움이 된다.
- **제안**: 결정 2 의 해당 항목에 "(기존 정의 — §5.4 에서 이미 명시됨, 재정의 아님)" 을 명시한다.

---

### [INFO] `VALIDATION_ERROR` + `details.field='botTokenRef'` — 기존 에러 코드 패턴과의 정합

- **target 신규 식별자**: `VALIDATION_ERROR` with `details.field='botTokenRef'` (결정 2, PATCH body 차단)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/2-navigation/2-trigger-list.md` §3 API 표 주석 `400 VALIDATION_ERROR (details.field='type')` (line 118)
  - `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` (간접 참조)
- **상세**: `VALIDATION_ERROR` 는 기존 에러 코드이며, `details.field` 패턴도 기존에 사용 중이다. 충돌 없음. 새 케이스 (`botTokenRef` 필드 변경 차단) 는 같은 패턴의 정합 활용이다.
- **제안**: 별도 조치 불필요.

---

### [INFO] `§5.5 "Inbound HTTP Contract"` 신설 섹션 번호 — 기존 §5.4 다음 배치

- **target 신규 식별자**: `§5.5` 섹션 (결정 4, `spec/5-system/15-chat-channel.md` 에 신설)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` 의 현재 최상위 섹션 구조: §1 개요, §2 사용시나리오, §3 요구사항(CCH-*), §3.1~§3.5, §4 데이터모델(§4.1~§4.3), §5 Identity/보안(§5.1~§5.4), §6 EIA관계, §7 구현파일구조, §8 호환성, Rationale
- **상세**: 현재 §5 는 "Identity / 보안" 섹션이고 §5.4 까지 존재한다 (line 234). 신규 §5.5 를 보안 섹션 안에 "Inbound HTTP Contract" 로 추가하는 것은 섹션 의미와 맞지 않을 수 있다 (HTTP 응답 계약은 보안·인증 섹션보다 별도 섹션이 더 적합). 충돌은 없으나 배치 적절성 검토 필요.
- **제안**: §5.5 를 §5 보안 섹션의 하위 절로 추가하는 대신 §6 으로 독립 섹션화하고 기존 §6(EIA관계)~§8(호환성) 을 §7~§9 로 밀거나, §5.5 를 §5 안에 유지하되 "보안 — Inbound Auth 응답 계약" 으로 제목을 조정해 섹션 맥락과 정합시킨다.

---

## 요약

target plan 이 도입하는 신규 식별자 중 완전한 충돌(동일 의미로 사용 중인 다른 식별자와 동명)은 발견되지 않았다. 그러나 두 가지 주목할 WARNING 이 있다: (1) `visualNode` enum 값 `text_only` → `text` rename 시 기존 DB `config` JSONB 에 저장된 `"text_only"` 값에 대한 하위 호환 처리가 target spec 에 미기술되어 있어 운영 환경에서 silent mismatch 가 발생할 수 있고, (2) camelCase UI 필드명(`chatChannelHealth` 등)과 snake_case DB 컬럼명 간의 교차 참조가 target 에 부재해 독자 혼선 가능성이 있다. Rationale 번호 충돌은 현 시점에서는 없으나, 병행 PR 상황에서 R-8 / R10~R12 번호가 중복 배정될 가능성을 머지 직전 재확인해야 한다. 그 외 INFO 항목들은 기존 패턴과의 정합성 보완 제안으로, 차단 사유가 없다.

---

## 위험도

MEDIUM
