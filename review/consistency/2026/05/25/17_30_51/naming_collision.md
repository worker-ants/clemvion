# 신규 식별자 충돌 검토 — `spec/5-system/15-chat-channel.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-25
대상 scope: `spec/5-system/15-chat-channel.md`

---

## 발견사항

### [INFO] `CHAT_CHANNEL_ENDPOINT_REQUIRED` — spec §5.4 에러 코드 표에서 누락

- target 신규 식별자: `CHAT_CHANNEL_ENDPOINT_REQUIRED` (error code)
- 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:511, 782` 에서 코드로 발사되고 있고, `triggers.service.spec.ts:1369` 에서 테스트도 존재함
- 상세: `spec/5-system/15-chat-channel.md §5.4` 의 Bot Token Rotation API 실패 응답 표에는 `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 4종만 열거되어 있다. 그러나 codebase 에는 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 코드가 추가로 존재하며, `triggers.service.ts` 주석 (`§5.4`)에도 명시되어 있다. spec 의 에러 코드 표와 codebase 의 실제 코드 집합 사이에 1개 항목 누락 drift 가 있다.
- 제안: `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표에 `CHAT_CHANNEL_ENDPOINT_REQUIRED` (400, chatChannel 트리거에 `endpoint_path` 미설정) 행 추가 — codebase 와 spec 동기화.

---

### [INFO] `SS-SE-01` — 타 spec 요구사항 ID 를 본 spec 본문에서 직접 인용

- target 신규 식별자: `SS-SE-01` (본문 2곳에서 인용: §4.1 코드블록 주석, §5.4.1.1 표)
- 기존 사용처: `spec/conventions/secret-store.md` 에서 정식 정의된 요구사항 ID
- 상세: `SS-SE-01` 은 본 spec 이 새로 부여하는 식별자가 아니라 `spec/conventions/secret-store.md` 에서 이미 정의된 것을 cross-ref 형태로 참조하고 있다. 의미 충돌은 없으나, 링크 없이 문자열만 인용되어 (spec 링크 컨벤션 준수 여부 보완 필요) 있는 점이 일관성 관점에서 열등하다.
- 제안: `SS-SE-01` 인용 2곳 모두 `[SS-SE-01](../conventions/secret-store.md#ss-se-01)` 형태의 링크 anchor 로 교체 권장. 현재 `chat-channel-adapter.md §2.3` 이미 동일 방식으로 링크하고 있으므로 일관성 확보 차원.

---

### [INFO] `ChatChannelInternalEvent` — 신규 타입명이 codebase 에는 아직 미구현

- target 신규 식별자: `ChatChannelInternalEvent` (TypeScript 타입명, Convention §1.3 신설)
- 기존 사용처: spec/conventions/chat-channel-adapter.md §1.3 에서 이번 PR 과 함께 신설됨. codebase 에서는 아직 존재하지 않는다 (검색 결과 미확인).
- 상세: 식별자 충돌은 아니며 신규 정의다. 단, `codebase/backend/src/modules/chat-channel/types.ts` 에 아직 해당 타입이 정의되지 않았으므로, 구현 착수 시 타입 파일 신설이 필요하다.
- 제안: 구현 PR 에서 `types.ts` 에 `ChatChannelInternalEvent` union type 을 추가할 것을 명시 (plan 의 "구현: chat-channel/types.ts type 보강" 항목과 정합). 충돌은 없음.

---

### [INFO] `CCH-AD-07` / `CCH-MP-06` — 신규 요구사항 ID 연속성 확인

- target 신규 식별자: `CCH-AD-07` (§3.1 추가), `CCH-MP-06` (§3.3 추가)
- 기존 사용처: `CCH-AD-01`~`CCH-AD-06` (§3.1), `CCH-MP-01`~`CCH-MP-05` (§3.3) 이 이미 spec 에 정의됨. 각각 다음 순번인 `07`, `06` 이 신규 추가됨.
- 상세: `CCH-AD-07` 은 기존 `CCH-AD-01`~`CCH-AD-06` 의 연속 번호이며 충돌 없음. `CCH-MP-06` 은 기존 `CCH-MP-01`~`CCH-MP-05` 의 연속 번호이며 충돌 없음. `plan/complete/spec-draft-chat-channel-template-render-outbound.md` 에도 "C-1: CCH-AD-06 ID 충돌 → CCH-AD-07 로 교체" 가 명시되어 있어 이미 검토된 사항이다.
- 제안: 충돌 없음. 조치 불필요.

---

### [INFO] `R-CC-16` Rationale ID — 기존 R-CC-N 시리즈와 연속성

- target 신규 식별자: `R-CC-16` (§Rationale 신설)
- 기존 사용처: `R-CC-10`~`R-CC-15` 가 이미 spec 에 정의됨
- 상세: `R-CC-16` 은 `R-CC-15` 의 다음 번호로 충돌 없음. `14-external-interaction-api.md §R10` 도 `R-CC-16` 을 cross-link 로 참조하여 양방향 일관성이 확보되어 있다. `R1`~`R9` / `R-K` 의 prefix 없는 구 형식과 혼동 가능성은 본 spec `§Rationale ID 컨벤션 (2026-05-23)` 절에서 이미 설명됨.
- 제안: 충돌 없음. 조치 불필요.

---

## 요약

`spec/5-system/15-chat-channel.md` 가 도입하거나 참조하는 신규 식별자들 — `CCH-AD-07`, `CCH-MP-06`, `R-CC-16`, `ChatChannelInternalEvent`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `SS-SE-01` 등 — 은 기존 코퍼스에서 다른 의미로 사용되는 충돌 사례가 없다. CRITICAL 또는 WARNING 등급의 충돌은 발견되지 않았다. 다만 (1) `CHAT_CHANNEL_ENDPOINT_REQUIRED` 에러 코드가 codebase 에는 존재하나 spec §5.4 실패 응답 표에서 누락된 drift 가 1건 있으며, (2) `SS-SE-01` cross-ref 가 hyperlink 없이 문자열로만 인용된 점이 소수 INFO 수준 보완 사항이다. 구현 착수를 차단하는 식별자 충돌은 없다.

---

## 위험도

LOW
