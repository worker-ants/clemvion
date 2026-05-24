# Cross-Spec 일관성 검토 결과

검토 모드: impl-prep (구현 착수 전)
대상: `spec/5-system/15-chat-channel.md` 및 관련 스펙 6개
검토 일시: 2026-05-24

---

## 발견사항

### [CRITICAL] `spec/2-navigation/2-trigger-list.md §2.3.1` 의 "v1 은 telegram 만" 문구가 providers/_overview.md §1 와 직접 모순

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, 99번째 행
  ```
  | Chat Channel | `provider` | read-only (생성 후 변경 불가) | v1 은 `telegram` 만. 변경하려면 트리거 삭제·재생성 |
  ```
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md §1 Supported providers (v1)`
  ```
  | telegram | ... | supported (v1) |
  | slack    | ... | supported (v1) |
  | discord  | ... | supported (v1) |
  ```
  그리고 `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01`:
  ```
  v1 supported: telegram / v1 spec-defined: slack, discord — impl pending
  ```
  ※ CCH-AD-01 의 "impl pending" 설명 자체도 _overview.md §1 의 "supported (v1)" 와 엇갈리는 추가 불일치 (아래 WARNING 참조).
- **상세**: `2-trigger-list.md §2.3.1` 의 `provider` 행 비고 컬럼이 "v1 은 `telegram` 만" 이라고 명시한다. 그러나 `providers/_overview.md §1` 은 slack·discord 를 모두 `supported (v1)` 으로 선언하고, 현재 이 plan 은 바로 그 slack·discord 진입점을 여는 구현을 대상으로 한다. 이 plan 의 구현이 완료되면 UI 는 slack·discord 를 생성 가능하게 되지만, spec 문서는 여전히 "v1 은 telegram 만" 이라고 기술하게 된다. spec 의 기술과 실제 시스템 동작이 정반대로 갈린다.
- **제안**: `spec/2-navigation/2-trigger-list.md §2.3.1` 의 해당 행 비고를 갱신:
  ```
  v1 은 `telegram` 만. → v1 은 `telegram` / `slack` / `discord`. 변경하려면 트리거 삭제·재생성
  ```
  단, 이 문서는 spec-only 영역이므로 `developer` 가 직접 수정할 수 없다. `project-planner` 위임이 필요하다. 구현 착수 전 이 spec 을 수정하여 CRITICAL 을 해소한 후 impl 진입을 권장한다.

---

### [CRITICAL] `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01` 의 provider 상태 설명이 _overview.md §1 과 모순

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.1 CCH-AD-01 (라인 35)
  ```
  v1 supported: telegram / v1 spec-defined: slack, discord — impl pending
  ```
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md §1`
  ```
  | slack   | ... | supported (v1) |
  | discord | ... | supported (v1) |
  ```
  그리고 동일 _overview.md §2 "Spec-defined / impl-pending":
  ```
  | _(none)_ | — | — |
  ```
- **상세**: `_overview.md §1` 은 slack·discord 를 `supported (v1)` 으로 선언하고 §2 (spec-defined / impl-pending) 는 비어 있다. _overview.md 의 `supported` 정의는 "spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료" 다. 반면 `CCH-AD-01` 은 slack·discord 를 "v1 spec-defined: impl pending" 으로 기술하고 있어 두 spec 문서가 동일 사실에 대해 정반대 상태를 기술한다. plan 자체도 "backend adapter 가 PR #300/#303 으로 셋 다 registry 에 등록" 으로 확인하고 있어 CCH-AD-01 의 설명이 구식 정보를 담고 있다.
- **제안**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01` 을 갱신하여 `_overview.md §1` 과 동기화:
  ```
  v1 supported: telegram / slack / discord — providers/_overview.md §1 단일 진실
  ```
  이 또한 `project-planner` 위임 필요. 구현 착수 전 해소 권장.

---

### [WARNING] `codebase/.../chat-channel-config.dto.ts:27` 의 `CHAT_CHANNEL_PROVIDERS` 가 spec 의 "supported" 정의와 불일치

- **target 위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:27`
  ```typescript
  export const CHAT_CHANNEL_PROVIDERS = ['telegram'] as const;
  ```
  및 동 파일 라인 83:
  ```
  description: '어댑터 식별자. v1 은 telegram 만 지원.',
  ```
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md §1` (slack·discord supported v1), `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01`
- **상세**: DTO 가 `['telegram']` 만 허용하여 slack·discord 입력 시 `400 VALIDATION_ERROR` 를 반환한다. 이것은 plan 에서 Commit 1 이 메우기로 예정된 정확한 갭이다. 이 발견은 구현 대상의 정확한 식별로, BLOCK 사유가 아니라 구현이 필요한 지점의 확인이다. 단, DTO 의 주석 "v1 은 telegram 만 지원" 도 함께 갱신해야 한다.
- **제안**: Commit 1 에서 `['telegram', 'slack', 'discord']` 로 확장 시 swagger `description` 도 동시 갱신 ("v1 은 telegram / slack / discord 지원").

---

### [WARNING] `codebase/.../chat-channel-config.dto.ts` 의 `inboundSigning` / `inboundSigningRef` 에 대한 `@IsEmpty` 가 slack·discord provider 전용 입력 흐름과 충돌

- **target 위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:135-155`
  ```typescript
  @IsEmpty({
    message: 'inboundSigningRef 는 외부 입력이 금지된 내부 필드입니다.',
  })
  inboundSigningRef?: string;

  @IsEmpty({
    message: 'inboundSigning 은 setupChannel 시 자동 발급되는 내부 필드입니다...',
  })
  inboundSigning?: string;
  ```
- **충돌 대상**:
  - `spec/4-nodes/7-trigger/providers/slack.md §6 보안` — "signing secret 은 사용자가 OAuth Install 단계에서 받아 별도 입력 — 어댑터가 발급하지 않음" + "사용자 입력값이 직접 `SecretResolver.store` 로 들어가고 ref 만 config 에 set"
  - `spec/4-nodes/7-trigger/providers/discord.md §6 보안` — "public key 는 Discord Developer Portal 에서 사용자가 복사해 입력" + `SetupResult.issuedInboundSigning` 은 비움
  - `spec/conventions/chat-channel-adapter.md §2.4 SetupResult.issuedInboundSigning` — "Slack / Discord 처럼 사용자가 manual 입력 (provider-issued) 하는 provider 는 본 필드를 채우지 않는다"
  - `spec/4-nodes/7-trigger/providers/slack.md Rationale R-S-1` — "사용자 입력 plaintext 가 직접 `SecretResolver.store` 로 들어가고 ref 만 config 에 set"
- **상세**: `inboundSigning` 필드는 slack·discord 에서 사용자가 명시적으로 입력해야 하는 값 (Slack Signing Secret hex 32 chars / Discord Application Public Key hex 64 chars) 을 받는 경로다. 그러나 현재 DTO 의 `@IsEmpty` decorator 가 이 필드에 어떤 값이 들어와도 `400 VALIDATION_ERROR` 를 반환한다. 이것은 Commit 1 이 해소해야 할 핵심 갭이다. spec R-S-1 은 이 입력이 service 단에서 `SecretResolver.store` 로 바로 처리되어야 함을 명시하고 있으므로, DTO 의 `@IsEmpty` 를 `@ValidateIf(o => o.provider === 'telegram')` 로 조건부 변환하거나 service 단에서 provider 별 분기 처리해야 한다.
- **제안**: plan Commit 1 의 "검증 방법 후보 (a) vs (b)" 결정 시 spec R-S-1 의 "service 단 분기" 방향 (b) 가 spec 과 정합. DTO 는 형식 검증만 담당하도록 설계 의도와도 일치. `inboundSigning` 필드의 `@IsEmpty` 를 제거하고 service 에서 provider 별 분기 후 `SecretResolver.store` 호출.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md §3 API` 의 `PATCH` 허용 서브키 목록에 `config.chatChannel.inboundSigning` 에 대한 명시 없음

- **target 위치**: `spec/2-navigation/2-trigger-list.md §3` PATCH 설명 (라인 137)
  ```
  config.chatChannel.uiMapping / config.chatChannel.rateLimitPerMinute / config.chatChannel.languageHints 등 서브 키 단위 부분 갱신
  ```
- **충돌 대상**: 이 plan 의 Commit 1 이 slack·discord 에서 `inboundSigning` 을 생성 POST body 에서만 받고 PATCH 에서는 받지 않도록 설계 (`spec/5-system/15-chat-channel.md §5.4.1 single-path` 의 `botTokenRef` 차단과 유사)
- **상세**: spec §3 의 PATCH 허용 서브키 목록에 `inboundSigning` (또는 그 차단 정책) 에 대한 명시가 없다. slack·discord 의 signing secret / public key rotation 은 "별 spec 신설 후 별 impl plan" 으로 미뤄져 있으므로 (plan 의 "의식적 boundary" 참조), PATCH body 에서 `inboundSigning` 이 들어올 경우 차단해야 하는지 허용해야 하는지 spec 에 명시가 없다. 이 gap 이 구현 결정을 모호하게 만들 수 있다.
- **제안**: `spec/2-navigation/2-trigger-list.md §3` PATCH 설명에 "단, `config.chatChannel.inboundSigning` 는 PATCH 로 변경 불가 — v1 에는 rotation API 미구현, 별 spec 신설 대기" 를 추가. spec 변경이므로 `project-planner` 위임. 구현 시에는 PATCH body 에서 `inboundSigning` 을 수신하면 현재 silent strip 또는 400 중 하나로 처리하고 plan 또는 commit 메시지에 노트.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.botIdentity` 의 `teamId` 필드 Changelog 와 _overview.md 의 `supported` 시점 불일치

- **target 위치**: `spec/conventions/chat-channel-adapter.md` Changelog 마지막 행 (2026-05-24):
  ```
  §2.3 ChatChannelConfig.botIdentity 에 teamId?: string optional 필드 추가 — ... impl-prep cross-spec W-1 해소 (slack.md §3.1 와의 일치)
  ```
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/slack.md §3.1 setupChannel 구체`:
  ```
  → config.chatChannel.botIdentity = { botId: bot_id, username: user, teamId: team_id }
  ```
- **상세**: Changelog 에 "impl-prep cross-spec W-1 해소" 로 기재되어 있어 이미 알려진 불일치이고 해소 완료로 표시되어 있다. 이 INFO 는 `chat-channel-adapter.md §2.3` Changelog 의 W-1 해소 기재가 실제로 반영되었는지 확인 목적으로만 기록한다. 확인 결과 `ChatChannelConfig.botIdentity` 에 `teamId?: string` 이 정상 추가되어 있어 (`conventions/chat-channel-adapter.md` 166번째 행) 실질적인 불일치는 없다.
- **제안**: 추가 조치 불필요.

---

### [INFO] Discord e2e spec 의 PING 케이스 응답 코드 기술

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` Commit 5, Discord e2e 항목:
  ```
  POST /api/hooks/:path (ed25519 signed body) → 202 또는 200 (PING 케이스)
  ```
- **충돌 대상**: `spec/5-system/15-chat-channel.md §5.5 Inbound HTTP Contract`:
  ```
  Discord PING (type: 1) → 200 OK + { type: 1 } JSON
  ```
  `spec/4-nodes/7-trigger/providers/discord.md §3.1`:
  ```
  PING handshake — parseUpdate 가 body.type === 1 시 null 반환 + 호출자(HooksService) 가 { type: 1 } JSON 으로 200 OK 응답
  ```
- **상세**: plan 의 e2e 기술에서 PING 케이스를 "202 또는 200" 으로 기술했으나 spec 은 명확하게 `200 OK` 만 허용한다 (`202` 는 Discord 가 실패로 처리). 이것은 plan 본문의 표현 문제이며 실제 구현 spec 에는 이미 명확히 정의되어 있다.
- **제안**: e2e 테스트 작성 시 PING 케이스는 `200 OK + body { type: 1 }` 로 단일하게 검증해야 한다 (plan 의 "202 또는 200" 표현은 구현 시 `200` 으로 확정).

---

## 요약

본 검토에서 CRITICAL 2건, WARNING 2건, INFO 2건이 발견되었다. CRITICAL 은 모두 `spec/2-navigation/2-trigger-list.md §2.3.1` 의 "v1 은 telegram 만" 문구와 `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01` 의 "slack·discord = impl pending" 기술이 `providers/_overview.md §1` 의 "supported (v1)" 선언과 직접 모순되는 것이다. 이 두 spec 문서는 본 plan 의 구현이 완료되면 실제 시스템 동작과 완전히 반대되는 정보를 담게 된다. WARNING 은 DTO 의 provider enum 제한 및 `inboundSigning` 의 `@IsEmpty` 가드 문제로, 이는 Commit 1 의 구현 대상이지만 spec 문서 상의 두 CRITICAL 이 해소되지 않으면 구현 완료 후에도 spec-impl divergence 가 남는다. CRITICAL 2건은 `project-planner` 로 spec 수정을 위임한 후 impl 착수가 원칙이나, 이 plan 의 "spec 변경 없음" 전제와 충돌한다. 해당 spec 문구들은 이미 구식이 된 상태 (PR #300 이전 내용을 반영)이므로 spec 정정 PR 을 먼저 머지하고 본 impl 에 착수할 것을 권고한다.

---

## 위험도

**HIGH**

CRITICAL 2건: `spec/2-navigation/2-trigger-list.md §2.3.1` 라인 99 ("v1 은 telegram 만") 와 `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01` ("impl pending") 이 해소되지 않은 채로 impl 이 완료되면 spec-impl divergence 가 영구화된다. spec 수정 후 impl 진입을 권고한다 (BLOCK: 조건부 — spec 수정 위임 즉시 착수 가능).
