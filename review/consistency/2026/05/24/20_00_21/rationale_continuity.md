# Rationale 연속성 검토 결과

검토 모드: `--impl-done`
Scope: `spec/5-system/15-chat-channel.md` (구현 대상)
Diff base: `origin/main`
검토 일시: 2026-05-24

---

## 발견사항

### 발견사항 없음 — CRITICAL / WARNING 0건

아래에 확인한 교차 점검 항목과 INFO 등급 보완 제안을 기술한다.

---

### [INFO] spec §5.5 pseudocode vs 구현의 순서 차이 — 의도적이나 주석 미비
- **target 위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create()` / `setupChatChannel()` 의 provider-issued 처리 순서
- **과거 결정 출처**: `spec/conventions/secret-store.md §5.5 (b)` pseudocode
- **상세**: spec §5.5 (b) 의 예시 코드는 `repo.save(trigger)` 후 `dto.chatChannel.inboundSigningPlaintext` 를 조건으로 `secrets.rotate()` 를 호출한다. 구현은 `setupChatChannel()` 내부에서 plaintext 를 처리하는 방식을 택했다 — `createChatChannelTrigger` pseudocode 의 1차 save 후 rotate → 이어서 setupChatChannel 호출의 "두 단계 rotate" 패턴과 달리, `setupChatChannel` 단일 함수 안에서 provider-issued rotate 와 server-issued rotate 를 연속 처리한다. 이는 ss-SE-01 보장(plaintext 미기록) 관점에서 `stripChatChannelPlaintext` 를 `mergeExternalConfig` 전에 적용하는 이중 방어로 보완되어 있어 결과는 spec 의도와 정합하다. 그러나 "pseudocode 와 구현 순서가 다른 이유"가 코드 주석에 명시되어 있지 않다 (단순히 "setupChatChannel 내부 통합 처리" 라는 언급만 있음).
- **제안**: `setupChatChannel` 메서드 상단에 "provider-issued rotate 를 setupChannel 호출 전에 선행하는 이유 (idempotency + SS-SE-01 이중 방어)" 를 한 줄 추가하면 pseudocode 와의 의도적 차이가 명확해진다. spec 변경은 불필요.

---

### [INFO] R-CC-14 ID 미존재 — 프롬프트 헤더 cross-link 요청의 R-CC-14 는 spec 에 없음
- **target 위치**: 검토 요청 헤더 `R-S-1 / R-CC-13 / R-CC-14 / R-CC-10 / R-12 / R8`
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §Rationale` (R-CC-10, R-CC-11, R-CC-12, R-CC-13 까지 존재; R-CC-14 없음)
- **상세**: 프롬프트 헤더의 `R-CC-14` 는 현재 spec 에 존재하지 않는다. R-CC-13 (Discord v1 CCH-MP-01 부분 유예, 2026-05-24) 이 가장 최근 항목이며, R-CC-14 는 미신설 상태다. 구현 diff 에서 이 ID 를 인용하거나 의존하는 코드 경로는 없으므로 구현 자체에 문제는 없다. orchestrator 쪽 프롬프트 헤더 작성 오류로 보인다.
- **제안**: 해당 Rationale 항목이 실제로 신설 예정이라면 spec 에 먼저 작성 후 구현 주석에 인용할 것. 단순 오기라면 프롬프트 헤더에서 R-CC-14 를 제거.

---

### [INFO] R-CC-13 참조 — Discord v1 제약 UI 노출 방식
- **target 위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` Callout 블록
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md R-CC-13` + `spec/4-nodes/7-trigger/providers/discord.md R-D-3`
- **상세**: R-CC-13 은 "Discord v1 의 자유 텍스트 DM 미지원을 provider spec R-D-3 에서 normative 하게 기술하며, CCH-MP-01 본문에 예외 절 추가를 기각했다"고 결정한다. 구현의 discord.en.mdx 는 이 제약을 `<Callout type="warn">` 으로 노출하고, 내부 주석에 `R-CC-13 + R-D-3` 를 교차 참조하고 있다. R-D-3 기각 대안 ("CCH-MP-01 본문에 예외 절 추가") 을 재도입하거나 우회하지 않는다 — 제약 안내를 provider 문서에 위치시키는 방향이다. Rationale 연속성 정합.

---

### [INFO] R-S-1 (단일 `inboundSigningRef` 슬롯) 구현 정합 확인
- **target 위치**: `triggers.service.ts setupChatChannel()` — `buildSecretRef({ name: 'inbound-signing' })` 단일 ref 사용
- **과거 결정 출처**: `spec/4-nodes/7-trigger/providers/slack.md R-S-1` + `spec/4-nodes/7-trigger/providers/discord.md R-D-1` (기각: `signingSecretRef` / `publicKeyRef` 별 필드)
- **상세**: R-S-1 / R-D-1 은 Telegram / Slack / Discord 의 inbound webhook 인증 자원을 단일 `inboundSigningRef` ref 슬롯으로 통합했다. 구현은 `buildSecretRef({ name: 'inbound-signing' })` 단일 경로로 세 provider 모두를 처리하며, 기각된 `signingSecretRef` / `publicKeyRef` 별도 필드를 도입하지 않는다. 정합.

---

### [INFO] R-CC-10 (rotate-bot-token single-path) 구현 정합 확인
- **target 위치**: `assertChatChannelInputSafe()` — `botTokenRef` 외부 입력 차단
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md R-CC-10` (기각: PATCH + rotate 양쪽 허용)
- **상세**: R-CC-10 은 "bot token 변경은 항상 `rotate-bot-token` API 단일 경로" 를 채택하고 PATCH body 직접 변경을 차단한다. 구현의 `assertChatChannelInputSafe` 는 `botTokenRef` 외부 입력을 400 으로 차단한다. 기각 대안 "PATCH + rotate 양쪽 허용" 재도입 없음. 정합.

---

### [INFO] R8 (Chat Channel 별도 카드 분리) vs. 생성 dialog 단일 블록 — 생성 vs. 상세 UI 문맥 구분
- **target 위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` — 생성 dialog 의 Chat Channel 섹션
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md R-8` (상세 drawer 의 "별도 카드 분리"; 기각: Webhook Configuration 카드 흡수)
- **상세**: R-8 은 **상세 drawer** 에서 Chat Channel 을 Webhook Configuration 과 분리된 별도 카드로 표시할 것을 결정한다. 구현 diff 는 **생성 dialog** 의 Chat Channel 섹션이며, dialog 안의 단일 `<div>` 블록 안에 provider select + bot token + inboundSigningPlaintext 를 모아두는 구조다. 생성 dialog 와 상세 drawer 는 다른 UI 표면이므로 R-8 의 "drawer 별도 카드" 결정이 생성 dialog 에 적용될 의무는 없다 — R-8 은 drawer 에 한정된 결정이다. 연속성 문제 없음.

---

## 요약

이번 diff (`trigger-create-multi-provider-ui` — slack / discord provider 추가, `inboundSigningPlaintext` 입력 경로 신설, frontend 생성 dialog UI 확장) 는 Rationale 연속성 관점에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 사항이 발견되지 않는다. 핵심 결정인 `inboundSigningRef` 단일 슬롯 (R-S-1 / R-D-1), rotate-bot-token single-path (R-CC-10), SS-SE-01 plaintext 미기록 불변식, R-CC-13 의 Discord v1 제약 위치화 원칙 모두 구현에서 올바르게 계승되었다. 유일한 관찰은 spec §5.5 pseudocode 와 구현의 함수 경계 배치가 다르지만 결과적 동작은 동일하며, 이중 방어 설계가 이를 보완한다는 점이다 (INFO 등급). 프롬프트 헤더에 언급된 R-CC-14 는 현재 spec 에 미존재하는 ID 임을 별도 주지.

## 위험도

NONE

---

STATUS: OK
