# Trigger Chat Channel Provider Catalog

> 관련 문서: [Spec Chat Channel](../../../5-system/15-chat-channel.md) · [Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md) · [Spec Trigger 공통 규약](../0-common.md) · [Spec Webhook 트리거](../../../5-system/12-webhook.md)

Webhook 트리거의 `config.chatChannel.provider` 로 선택할 수 있는 **외부 chat 플랫폼 provider 카탈로그**. 각 provider 의 구체 명세 (Bot API 매핑, UI 매핑, 명령 처리) 는 이 디렉토리의 개별 파일이 단일 진실이다.

---

## 1. Supported providers (v1)

`supported` = spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료.

| provider 식별자 | 명세 | 상태 |
|---|---|---|
| `telegram` | [`telegram.md`](./telegram.md) | supported (v1) |
| `slack` | [`slack.md`](./slack.md) | supported (v1) |
| `discord` | [`discord.md`](./discord.md) | supported (v1) |

## 2. Spec-defined / impl-pending

spec 본문은 신설됐으나 adapter 구현체가 아직 등록되지 않은 provider. 현재 v1 에서는 비어 있음.

| provider 식별자 | 명세 | 후속 impl plan |
|---|---|---|
| _(none)_ | — | — |

## 3. Future candidates (spec 미작성)

사용자 요청 시 spec 부터 신설 검토:

- `kakao-talk` — 카카오 i 오픈빌더 + 채널 채팅
- `whatsapp` — WhatsApp Business Cloud API

신규 provider 추가 절차:

1. **Spec 신설** (§2 진입): `<name>.md` 작성 — [`telegram.md`](./telegram.md) 와 동일한 **8섹션 + Rationale** 구조 채택 (Overview / §3 API 호출 매핑 / §4 명령 매핑 / §5 인터랙션 노드 UI 매핑 / §6 보안 / §7 명령 처리 / §8 비기능 / Rationale). 본 카탈로그 §2 "Spec-defined / impl-pending" 표에 행 추가.
2. **Impl 착수** (§2 → §1 승격 직전): adapter 구현 + registry 등록 + e2e 테스트 완료. 이 시점에 [`spec/conventions/chat-channel-adapter.md §5 Adapter Registry`](../../../conventions/chat-channel-adapter.md) 절차에 따라 어댑터 등록.
3. **§1 supported 승격**: 본 카탈로그 §2 행 제거 + §1 표에 `supported (v1)` 로 추가. spec frontmatter `code:` 에 구현 경로 cross-link.

---

## 4. provider 식별자 컨벤션

- lower-case
- kebab-case (단어 사이 `-`)
- 외부 플랫폼 브랜드명을 직관적으로 표현 (예: `telegram`, `kakao-talk`, `whatsapp`)

`provider` 문자열의 단일 진실은 본 카탈로그 §1 표 + 어댑터 구현체 (`ChatChannelAdapter.provider` 필드).

---

## Rationale

### `_overview.md` 를 v1 단계에서 함께 도입한 이유

provider 가 v1 에 1개 (telegram) 뿐인 시점이지만 인덱스 파일을 함께 도입했다. 이유:

- 두 번째 provider 가 추가될 때 인덱스 도입을 "별 작업" 으로 미루면 누락 위험. v1 부터 catalog 패턴을 자리잡아두면 두 번째 추가 시 갱신만으로 정합.
- `spec/conventions/cafe24-api-catalog/_overview.md` 의 패턴과 동일 — catalog 디렉토리는 단일 진실 분리 + 진입점 명시.
- 인덱스 자체가 짧으므로 over-engineering 비용이 거의 없음.

### `spec-defined / impl-pending` 단계 도입

`supported` ↔ `spec-defined / impl-pending` ↔ `future candidates` 3 단계로 spec 본문 신설과 adapter 구현체 등록을 분리한다. spec 만 있는 provider 와 완전 동작 provider 를 같은 표에 두면 `Trigger.config.chatChannel.provider` 입력 시 사용자가 spec-only provider 도 선택할 수 있는 오인 가능성이 있고, UI 가이드 표시에서도 두 단계를 명확히 구분해야 하므로 분리한다. catalog 가 단계를 표면화하지 못하면 spec 파일 존재와 drift 가 발생한다.

근거: spec 신설과 impl 등록의 라이프사이클 분리가 본 monorepo 의 표준 패턴 (`status: spec-only` frontmatter 와 의미 정렬). catalog 가 단계를 표면화함으로써 사용자·운영자·개발자 모두에게 가시성 제공.
