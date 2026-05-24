---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: planner
---

# Spec — Chat Channel inbound-signing naming 통합

세 provider (Telegram / Slack / Discord) 의 webhook 출처 검증용 자료를 **단일 generic role-based naming** 으로 통합. 본 plan 은 [`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) 직후 사용자 검토에서 발견된 naming 비일관성을 해소.

---

## 0. 배경

[`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) 완료 직후, 세 provider 가 같은 role (inbound webhook 출처 검증) 의 자원을 보유하지만 naming pattern 이 비일관:

| Provider | 변경 전 ref | 자원 성격 |
|---|---|---|
| Telegram | `secret://triggers/{id}/webhook-secret` | server 발급 shared secret (`setWebhook.secret_token`) |
| Slack | `secret://triggers/{id}/slack-signing-secret` | Slack 발급 shared secret (HMAC key) |
| Discord | `secret://triggers/{id}/discord-public-key` | Discord 발급 public key (ed25519 verification) |

- Telegram 만 generic 이름, 나머지는 provider prefix.
- ChatChannelConfig 도 `secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?` 3개 필드 — 각각 1개 provider 만 사용.

사용자 결정 (2026-05-24):
1. **Role 기반 generic 이름 통합** — 세 provider 모두 `secret://triggers/{id}/inbound-signing` 단일 슬롯. config 도 `inboundSigningRef?: string` 단일 optional 필드.
2. **Migration 불필요** — production data 없음. 단순 rename.

## 1. 산출물

| 파일 | 변경 |
|---|---|
| `spec/conventions/secret-store.md` | §1 예시 표 — 3행 삭제 후 `inbound-signing` 1행 추가. Changelog 갱신. |
| `spec/conventions/chat-channel-adapter.md` | §2.3 ChatChannelConfig — `secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?` 3 필드 제거 + `inboundSigningRef?: string` 단일 추가 (provider 별 의미 주석). Changelog 갱신. |
| `spec/5-system/15-chat-channel.md` | §4.1 config 예시 갱신. §5.5 Inbound HTTP Contract 표의 인증 실패 행 (provider별 헤더 명시 부분) 유지 — 검증 알고리즘은 backend 분기, ref 는 단일. |
| `spec/4-nodes/7-trigger/providers/telegram.md` | §3.1 setupChannel 의 `secretToken` 변수 → `inboundSigning` 로 갱신. §6 보안 의 `secretTokenRef` 표현 → `inboundSigningRef`. Rationale R1 본문 (의미 동일, 이름만 갱신). |
| `spec/4-nodes/7-trigger/providers/slack.md` | §6 의 `signingSecretRef` → `inboundSigningRef`. 본문 ref 경로 갱신. Rationale R-S-1 본문 보강 (naming 통합 결정 반영). |
| `spec/4-nodes/7-trigger/providers/discord.md` | §6 의 `publicKeyRef` → `inboundSigningRef`. 본문 ref 경로 갱신. Rationale R-D-1 본문 보강. |
| `spec/1-data-model.md §2.21.1` | 용도 목록 — 3종 (`webhook-secret` / `slack-signing-secret` / `discord-public-key`) 통합. |

## 2. 영역 권한

- `spec/**` Write
- `plan/**` Write
- `codebase/**` Read only — Telegram backend 의 `chat_channel.secretToken` 변수 / `secretTokenRef` config 필드는 본 spec 변경에 따라 후속 impl plan 에서 rename 필요 (`chat-channel-telegram-inbound-signing-rename-impl.md`).

## 3. Phase

### Phase 1 — secret-store.md 갱신 ✅
- [x] §1 예시 표 — 3행 (`webhook-secret` / `slack-signing-secret` / `discord-public-key`) → 단일 `inbound-signing` 1행 + name 예시 (`webhook-secret` → `inbound-signing`)
- [x] §5.5 신 절 — `inboundSigningRef` 초기화 두 경로 (server-issued vs provider-issued) 코드 예시
- [x] Changelog 갱신

### Phase 2 — chat-channel-adapter.md 갱신 ✅
- [x] §2.3 ChatChannelConfig — 3 필드 (`secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?`) 제거 + `inboundSigningRef?: string` 단일 추가 (provider 별 의미·발급 주체·검증 알고리즘 분기 표 주석)
- [x] §2.4 SetupResult — `issuedSecretToken` → `issuedInboundSigning` rename + provider-issued 케이스 (필드 비움) 주석 명시
- [x] §6 보안 본문의 `secretTokenRef` / `issuedSecretToken` → 새 이름
- [x] Changelog 갱신

### Phase 3 — 시스템·provider·data-model spec 갱신 ✅
- [x] `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-03 + §4.1 config 예시 + §4.1 설명
- [x] `spec/4-nodes/7-trigger/providers/telegram.md` §3.1 / §6
- [x] `spec/4-nodes/7-trigger/providers/slack.md` §6 / Rationale R-S-1 + Changelog
- [x] `spec/4-nodes/7-trigger/providers/discord.md` §6 / Rationale R-D-1 + Changelog
- [x] `spec/1-data-model.md §2.21.1` 용도 목록
- [x] `spec/2-navigation/2-trigger-list.md` UI 미노출 정책 텍스트 2곳

### Phase 4 — `/consistency-check --spec` 실행 ✅
§6 결과 절 참조 — 잔여 진짜 1건 (`secret-store.md §5.5` 보강) 해소 완료.

### Phase 5 — commit + plan complete
- [x] commit: `docs(spec): chat channel — inbound-signing naming 통합 (3종 → 1종)` + 후속 commit `chore(plan): mark spec-chat-channel-inbound-signing-rename complete`
- [x] `git mv plan/in-progress/spec-chat-channel-inbound-signing-rename.md plan/complete/`

## 4. 후속 impl plan

- [ ] `plan/in-progress/chat-channel-telegram-inbound-signing-rename-impl.md` (status: backlog, optional) — Telegram backend `secretToken` / `secretTokenRef` 변수·config·entity 컬럼 rename. migration 불필요 (사용자 결정), 코드만 rename. Slack/Discord impl plan 은 본 spec 변경을 transitively 반영하므로 별 plan 불필요.

## 5. 위험

- Telegram backend 의 `chat_channel_secret_token_ref` 같은 DB 컬럼명이 V062 migration 으로 이미 존재할 가능성 — production data 없으므로 컬럼 rename migration 도 부담 없음. 후속 impl plan 의 책임.
- Slack/Discord 는 아직 impl plan 이 backlog (구현 미시작) — 본 spec 변경이 impl 진입 전에 일어나므로 추가 비용 없음.
- **Backlog plan 의 stale 참조** — 본 rename 의 결과로 다음 plan 들이 구 필드명을 참조하게 됨 (consistency-check W-2/W-3/I-1 / 본 plan 범위 외 — 후속 grooming):
  - `plan/in-progress/chat-channel-secret-store-infra.md` Phase 4 의 `secretTokenRef` 언급 — backlog 진입 시 갱신.
  - `plan/in-progress/trigger-list-chat-channel-ui.md` / `spec-telegram-chat-channel-ui-polish.md` — PR MERGED 후 stale, `plan/complete/` 로 cleanup 권장. 본 plan 과 무관한 별 grooming.

## 6. Phase 4 — `/consistency-check --spec` 결과 (2026-05-24)

2차 실행 산출: `review/consistency/2026/05/24/11_36_25/SUMMARY.md`.

| Checker | 결과 |
|---|---|
| `cross_spec` | CRITICAL 2 / WARNING 3 — **모두 false positive** (checker 가 갱신된 spec 상태와 plan 의 "변경 예정" 기술 사이의 시간차를 충돌로 판정. 실제 산출물은 정합) |
| `rationale_continuity` | INFO 3 — 위험도 NONE. 기각된 3-필드 안 (R-S-1 / R-D-1 의 기각 안 2) 의 재도입이 아니라 "현재 과도기 구현을 기각 안으로 식별해 제거" 임을 명확히 확인 |
| `convention_compliance` | WARNING 2 / INFO 4 — WARNING 2건 모두 같은 false positive (checker stale view) |
| `plan_coherence` | WARNING 4 / INFO 1 — 모두 backlog plan grooming (W-2/W-3/W-4/I-1) 으로 본 plan 범위 외. 본 plan §5 위험 절로 인계 |
| `naming_collision` | ISSUE 1 — INFO level, 충돌 없음 |

**진짜 잔여 해소 (1건)**:
- `secret-store.md §5.5` 신 절 추가 — Chat Channel `inboundSigningRef` 초기화 두 경로 (server-issued vs provider-issued) 코드 예시. checker 의 INFO ("`§5.1` 흐름 미포함") 보강.

## 7. Phase 5 — commit + plan complete

- [ ] commit: `docs(spec): chat channel — inbound-signing naming 통합 (3종 → 1종)`
- [ ] `git mv plan/in-progress/spec-chat-channel-inbound-signing-rename.md plan/complete/`
