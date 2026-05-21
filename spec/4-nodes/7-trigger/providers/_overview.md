# Trigger Chat Channel Provider Catalog

> 관련 문서: [Spec Chat Channel](../../../5-system/15-chat-channel.md) · [Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md) · [Spec Trigger 공통 규약](../0-common.md) · [Spec Webhook 트리거](../../../5-system/12-webhook.md)

Webhook 트리거의 `config.chatChannel.provider` 로 선택할 수 있는 **외부 chat 플랫폼 provider 카탈로그**. 각 provider 의 구체 명세 (Bot API 매핑, UI 매핑, 명령 처리) 는 이 디렉토리의 개별 파일이 단일 진실이다.

---

## 1. Supported providers (v1)

| provider 식별자 | 명세 | 상태 |
|---|---|---|
| `telegram` | [`telegram.md`](./telegram.md) | supported (v1) |

## 2. Planned providers

현재 계획된 추가 provider 는 없다. 사용자 요청이 있을 때 다음 후보를 우선 검토:

- `slack` — Slack Bolt + Block Kit
- `kakao-talk` — 카카오 i 오픈빌더 + 채널 채팅
- `discord` — Discord Bot + Interaction
- `whatsapp` — WhatsApp Business Cloud API

신규 provider 추가 절차:

1. 본 카탈로그의 §1 표에 새 행 추가 (`<name> | <link> | supported`).
2. 본 카탈로그의 §2 에서 해당 항목 제거.
3. `<name>.md` 신설 — [`telegram.md`](./telegram.md) 와 동일한 섹션 구조 채택 (Overview / Bot API 매핑 / 명령 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 비기능 / Rationale).
4. [`spec/conventions/chat-channel-adapter.md`](../../../conventions/chat-channel-adapter.md) 의 §5 Adapter Registry 절차에 따라 어댑터 등록.

---

## 3. provider 식별자 컨벤션

- lower-case
- kebab-case (단어 사이 `-`)
- 외부 플랫폼 브랜드명을 직관적으로 표현 (예: `telegram`, `kakao-talk`, `whatsapp`)

`provider` 문자열의 단일 진실은 본 카탈로그 §1 표 + 어댑터 구현체 (`ChatChannelAdapter.provider` 필드).

---

## Rationale

### `_overview.md` 를 v1 단계에서 함께 도입한 이유 (2026-05-21)

provider 가 v1 에 1개 (telegram) 뿐인 시점이지만 인덱스 파일을 함께 도입했다. 이유:

- 두 번째 provider 가 추가될 때 인덱스 도입을 "별 작업" 으로 미루면 누락 위험. v1 부터 catalog 패턴을 자리잡아두면 두 번째 추가 시 갱신만으로 정합.
- `spec/conventions/cafe24-api-catalog/_overview.md` 의 패턴과 동일 — catalog 디렉토리는 단일 진실 분리 + 진입점 명시.
- 인덱스 자체가 짧으므로 over-engineering 비용이 거의 없음.
