# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**scope**: `spec/5-system/15-chat-channel.md`
**검토 일시**: 2026-05-23

---

## 발견사항

### [WARNING] data-flow/10-triggers.md 의 Webhook 엔드포인트 경로 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 / CCH-AD-04` — `POST /api/hooks/:endpointPath`
- **충돌 대상**: `spec/data-flow/10-triggers.md` lines 14, 25, 54 — `/api/webhooks/:path` 사용. `spec/5-system/12-webhook.md WH-EP-02` — `{base_url}/api/hooks/{endpoint_path}` 사용
- **상세**: Chat Channel spec (`15-chat-channel.md`) 은 Webhook spec(`12-webhook.md`) 을 그대로 따라 `/api/hooks/:endpointPath` 경로를 사용한다. 그런데 `data-flow/10-triggers.md` 는 동일 엔드포인트를 `/api/webhooks/:path` 로 기술하고 있다(line 14, 25, 54). 두 경로 중 어느 것이 실제 라우터에 등록된 SoT 인지 data-flow 문서만으로는 불명확하다. Webhook spec 이 SoT 라면 data-flow 문서가 구식 경로를 참조하고 있는 것이고, 구현 착수 시 어느 경로를 기준으로 작성해야 하는지 혼동을 일으킬 수 있다.
- **제안**: `data-flow/10-triggers.md` 의 경로 표기를 `/api/hooks/:path` (또는 `WH-EP-02` 와 동일한 `{base_url}/api/hooks/{endpoint_path}`) 로 정정한다. 또는 두 경로가 모두 유효한 alias 라면 Webhook spec 에 해당 사실을 명시한다.

---

### [INFO] data-flow/10-triggers.md 가 Chat Channel 분기를 기술하지 않음

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 전체 시퀀스`
- **충돌 대상**: `spec/data-flow/10-triggers.md §1.2 Webhook 진입` 시퀀스
- **상세**: Chat Channel spec 은 `config.chatChannel` 가 설정된 Webhook 트리거의 경우 `parseUpdate → ChannelConversation 조회 → 분기(새 execution or InteractionService.interact)` 라는 별도 처리 흐름을 정의한다. 그러나 `data-flow/10-triggers.md §1.2` 시퀀스 다이어그램은 일반 Webhook 진입 경로만 기술하고 Chat Channel 분기는 언급이 없다. 기능 충돌은 아니지만 구현 담당자가 data-flow 문서를 참조할 때 Chat Channel 분기가 누락된 그림을 보게 된다.
- **제안**: `data-flow/10-triggers.md §1.2` 에 Chat Channel 분기(alt 블록 또는 sub-sequence 참조 링크)를 추가하거나, "Chat Channel 분기는 `spec/5-system/15-chat-channel.md §3.1` 참조" 주석을 달아 동기화한다.

---

### [INFO] spec/0-overview.md 문서 맵에 Chat Channel spec 미등재

- **target 위치**: `spec/5-system/15-chat-channel.md` (파일 전체)
- **충돌 대상**: `spec/0-overview.md §8 문서 맵` 및 `§6.1 구현 완료 목록`
- **상세**: `spec/0-overview.md §8` 의 문서 맵 표(`비기능 요구사항` 행 — "영역별 spec") 와 `§4 영역별 진입 문서` 표는 `spec/5-system/` 하위 문서들을 개별로 열거하지 않고 폴더 단위 참조를 사용하기 때문에 직접 충돌은 아니다. 그러나 `§6.1 구현 완료 목록` 은 각 기능을 명시적으로 등재하며, 기존 Webhook, External Interaction API, Graph RAG 등의 내용이 상세히 기술되어 있다. Chat Channel 은 `§6.1` 또는 `§6.3` 어디에도 등재되어 있지 않아 구현 범위를 파악하려는 독자에게 가시성이 낮다. 기능 충돌은 없으나 동기화 권장.
- **제안**: `spec/0-overview.md §6` 에 Chat Channel 을 적절한 분류(v1 구현 완료 또는 In-Progress)로 추가한다.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` 의 `botToken` UI 필드 마스킹 형식과 Chat Channel spec 간 동기화 확인 필요

- **target 위치**: `spec/5-system/15-chat-channel.md §5.4.2` — `hasBotToken: boolean` 만 노출, plaintext / ref 미노출
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §2.3.1` — `hasBotToken: boolean` 참조 + 마스킹 placeholder `"•••• <last4>"` 기술
- **상세**: Chat Channel spec §5.4.2 는 `botTokenRef` / `botToken` plaintext 는 응답에 포함하지 않고 `hasBotToken: boolean` 만 노출한다고 명시한다. 그런데 trigger-list spec §2.3.1 의 필드 권한 매트릭스에는 마스킹 placeholder `"•••• <last4>"` 가 언급되어 있다. `last4` 가 있으려면 bot token 의 마지막 4자를 응답에 포함해야 하는데, 이는 `hasBotToken: boolean` 만 반환한다는 Chat Channel spec 과 사실 모순일 수 있다.

  단, trigger-list spec 의 해당 문구는 `hasBotToken` 만 받아 UI 가 placeholder 를 자체 합성하는 방식으로도 해석이 가능하다. 두 spec 이 의미하는 것이 "서버에서 `last4` 를 내려준다" 인지 "UI 가 자체적으로 마스킹 텍스트를 표시한다" 인지가 명확하지 않다. 구현 전에 이 점을 확인하지 않으면 API 응답 shape 을 잘못 구현할 위험이 있다.
- **제안**: `spec/5-system/15-chat-channel.md §5.4.2` 또는 `spec/2-navigation/2-trigger-list.md §2.3.1` 중 하나에 "UI 는 `hasBotToken: true` 시 고정 placeholder(`"•••• ••••"` 또는 `"등록됨"`)를 자체 표시하며 서버는 `last4` 를 포함하지 않는다" 또는 "서버가 `last4` 를 응답에 포함한다" 중 한 쪽을 명시하여 API 계약을 단일 진실로 확정한다.

---

### [INFO] `spec/4-nodes/7-trigger/providers/` 디렉토리 참조가 있으나 대상 파일 존재 여부

- **target 위치**: `spec/5-system/15-chat-channel.md §R5` — `4-nodes/7-trigger/providers/telegram.md` 참조
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/` 디렉토리
- **상세**: Chat Channel spec 은 `spec/4-nodes/7-trigger/providers/telegram.md` 를 Telegram 어댑터의 구체 구현 명세 SoT 로 여러 곳에서 참조한다(§3.2 CCH-MP-04, §R4, §R5 등). 디렉토리(`spec/4-nodes/7-trigger/providers/`)는 존재하나 `telegram.md` 파일이 실제로 존재하는지 확인이 필요하다. 구현 착수 직전 단계에서 이 파일이 stub 이거나 부재라면 Telegram 어댑터 구현 시 참조 문서가 없어 구현자가 Chat Channel spec 의 추상 기술에만 의존해야 한다.
- **제안**: `spec/4-nodes/7-trigger/providers/telegram.md` 의 존재 및 완성도를 확인한다. 아직 없다면 Chat Channel 구현 착수 전에 stub 이라도 작성해야 한다.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `spec/1-data-model.md §2.8`, `spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/2-navigation/2-trigger-list.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/secret-store.md` 등 관련 영역 spec 과 대부분 정합한다. 데이터 모델의 5개 신규 컬럼, SecretStore URI 스키마, EIA 인증 예외 조항, Bot Token single-path 정책, API 응답 형식 모두 cross-spec 수준에서 일관성이 유지되어 있다. 발견된 주요 잠재 충돌은 `data-flow/10-triggers.md` 가 Webhook 엔드포인트 경로로 `/api/webhooks/:path` 를 사용하는 반면 `12-webhook.md` 와 `15-chat-channel.md` 는 `/api/hooks/:endpointPath` 를 SoT 로 사용하는 경로 불일치(WARNING)이다. 그 외 UI `botToken` 마스킹 형식의 API 계약 모호성(INFO), data-flow 문서의 Chat Channel 분기 누락(INFO), overview 문서 미등재(INFO), telegram.md 파일 존재 여부(INFO) 는 구현 전 확인·동기화가 권장된다. Critical 수준의 직접 모순은 발견되지 않았다.

---

## 위험도

LOW
