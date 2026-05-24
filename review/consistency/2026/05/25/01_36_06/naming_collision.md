# 신규 식별자 충돌 검토 — 구현 착수 전 (--impl-prep)

검토 대상: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

### [WARNING] 동일 파일 내 bare `R8` Rationale ID가 `spec/5-system/14-external-interaction-api.md` 의 `R8` 와 혼동 가능

- **target 신규 식별자**: `spec/5-system/15-chat-channel.md §Rationale R8` — "Fan-out facade 의 분리 — 사실상 이미 완료, per-trigger listener 정책만 v1 적용 (2026-05-22, 갱신 2026-05-24)"
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md §Rationale R8` (line 868) — "Idempotency-Key 와 `submit_form` 검증 실패의 관계 (2026-05-21)"
- **상세**: 두 spec 파일이 모두 `### R8.` 의 bare 정수 prefix 를 사용한다. EIA (`14-...`) 와 Chat Channel (`15-...`) 는 같은 폴더 (`spec/5-system/`) 안에 있고 서로를 빈번하게 교차 참조한다. 독자가 "R8" 만 언급된 컨텍스트를 볼 때 어느 파일의 R8 인지 즉시 판단하기 어렵다. `15-chat-channel.md` 자체의 "Rationale ID 컨벤션" 절 (line 537–539) 이 이 위험을 인지하고 신규 항목은 `R-CC-N` prefix 를 사용하기로 결정했으나, 기존 `R1–R9` 는 "하위 호환" 이유로 rename 하지 않은 채 남아 있다. 따라서 `R8` 이라는 식별자가 두 파일에서 서로 다른 의미로 공존한다.
- **제안**: `15-chat-channel.md` 의 `### R8.` 헤딩을 `### R-CC-8.` (또는 스펙이 이미 채택한 `R-CC-N` 패턴에 맞는 번호) 로 교체하고, 파일 내 `R8` 참조 (Rationale §R8 cross-link 등) 를 일괄 갱신한다. EIA 의 `R8` 은 변경 없음 — 충돌 회피의 책임은 후발 spec 인 `15-chat-channel.md` 에 있다.

---

### [INFO] `CCH-*` 요구사항 ID prefix — 중복 없음 확인

- **target 신규 식별자**: `CCH-AD-01~06`, `CCH-CV-01~05`, `CCH-MP-01~05`, `CCH-SE-01~04-C`, `CCH-NF-01~03`
- **기존 사용처**: 검색 결과 `spec/` 전체에서 `CCH-` prefix 는 `15-chat-channel.md` 와 이를 cross-reference 하는 provider 문서 (`telegram.md`, `slack.md`, `discord.md`) 및 `14-external-interaction-api.md` 에만 나타남. 동일 prefix 를 다른 의미로 사용하는 파일 없음.
- **상세**: 충돌 없음. 참고로 기록.
- **제안**: 이대로 유지.

---

### [INFO] 신규 API endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` — 기존 endpoint 와 충돌 없음

- **target 신규 식별자**: `POST /api/triggers/:id/chat-channel/rotate-bot-token`
- **기존 사용처**: `spec/5-system/2-api-convention.md` §RPC-style 예외 표 (line 44) 에 이 endpoint 가 등재되어 있음. `spec/2-navigation/2-trigger-list.md` §3 API 표 (line 136) 에도 동일 endpoint 정의. `spec/5-system/14-external-interaction-api.md` 의 `notification/rotate-secret` 와 URL 구조가 달라 충돌 없음.
- **상세**: 동일 endpoint 가 세 파일에서 서로 일관되게 참조됨. 정의의 단일 진실(SoT) 은 `15-chat-channel.md §5.4` 이며 다른 파일들은 cross-link. 충돌 없음.
- **제안**: 이대로 유지.

---

### [INFO] 신규 DB 컬럼 5개 (`chat_channel_*`) — `notification_*` 컬럼 군과 명명 패턴 공유, 의미 분리됨

- **target 신규 식별자**: `chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_token_v2`, `chat_channel_rotated_at`
- **기존 사용처**: `spec/1-data-model.md §2.8 Trigger` 에 `notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at` 컬럼 군이 기존에 정의되어 있음. `chat_channel_*` 5개는 동일 Trigger 테이블에 추가되는 신규 컬럼.
- **상세**: `chat_channel_token_v2` 와 `notification_secret_v2` 는 `_v2` suffix 패턴이 동일하지만 자원 의미가 다르다 (`notification_secret_v2` = HMAC signing secret, `chat_channel_token_v2` = external provider bot token reference). `15-chat-channel.md §Rationale R-K` 에서 이 semantic 비대칭을 의도적으로 문서화하고 "명명 패턴 일관성 우선" 결정을 내린 상태. `1-data-model.md §2.8` 에도 동일 cross-link 기록됨. 실제 충돌(같은 이름, 다른 의미)은 없음.
- **제안**: 이대로 유지. 이미 Rationale 에서 명시적으로 인정·문서화된 의미 차이.

---

### [INFO] Redis key prefix `chat-channel:{triggerId}:{conversationKey}` — 기존 Redis key 공간과 충돌 없음

- **target 신규 식별자**: `chat-channel:` Redis key prefix (`spec/5-system/15-chat-channel.md §4.3`)
- **기존 사용처**: `spec/` 전체에서 Redis key 를 명시적으로 정의하는 문서를 검색한 결과 `chat-channel:` prefix 는 본 spec 이 처음 도입. 다른 Redis key 패턴 (예: `execution:*`, `session:*`) 과 prefix 충돌 없음.
- **상세**: 충돌 없음.
- **제안**: 이대로 유지.

---

### [INFO] `ChannelListenerRegistry` 타입명 — 기존 영역에서 다른 의미로 사용되지 않음

- **target 신규 식별자**: `ChannelListenerRegistry` (클래스/인터페이스명, `spec/5-system/15-chat-channel.md §Rationale R8`)
- **기존 사용처**: `spec/` 전체에서 `ChannelListenerRegistry` 를 다른 의미로 사용하는 문서 없음.
- **상세**: 충돌 없음.
- **제안**: 이대로 유지.

---

### [INFO] `secret://triggers/{id}/bot-token`, `secret://triggers/{id}/inbound-signing` SecretStore key — `1-data-model.md §2.21.1` 과 일관성 확인

- **target 신규 식별자**: `secret://triggers/{id}/bot-token`, `secret://triggers/{id}/bot-token.v2`, `secret://triggers/{id}/inbound-signing`
- **기존 사용처**: `spec/1-data-model.md §2.21.1 SecretStore` "용도" 목록 (line 1096–1099) 에 위 세 ref 가 이미 명시되어 있음. `spec/conventions/secret-store.md` 가 `SecretResolver` 단일 진실.
- **상세**: 충돌 없음. `1-data-model.md` 가 미리 cross-link 를 포함하고 있어 정합성 유지됨.
- **제안**: 이대로 유지.

---

### [INFO] `11-mcp-client.md`, `6-websocket-protocol.md` — 신규 식별자 없음

- 두 target 문서 (`spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`) 는 기존 spec 파일로, 본 검토의 구현 준비 범위에서 변경 없이 참조만 되는 문서. 신규 식별자를 도입하지 않으므로 추가 충돌 검토 항목 없음.

---

## 요약

`spec/5-system/15-chat-channel.md` 가 도입하는 신규 식별자 중 실제 충돌 위험은 **`R8` Rationale 번호** 하나뿐이다. 동일 폴더의 `14-external-interaction-api.md` 도 `### R8.` 을 다른 의미로 정의하고 있어 독자 혼동 가능성이 있다. `15-chat-channel.md` 자체가 이 위험을 인지하고 신규 항목에는 `R-CC-N` prefix 를 채택했지만, 기존 `R1–R9` 의 rename 을 보류한 상태다. 나머지 식별자(`CCH-*` 요구사항 ID, DB 컬럼 5개, Redis key, SecretStore ref, API endpoint, 타입명) 는 기존 사용처와 충돌 없이 일관되게 정의되어 있다. `11-mcp-client.md` 와 `6-websocket-protocol.md` 는 본 검토 범위에서 신규 식별자를 추가하지 않는다.

## 위험도

LOW
