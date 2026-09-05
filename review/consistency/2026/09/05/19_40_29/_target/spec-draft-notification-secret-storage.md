---
title: notification_secret_v2 는 spec 이 아니라 구현이 이탈했다 — 예외를 만들지 않는다
worktree: spec-notification-secret-storage-7768dd
started: 2026-09-05
owner: planner
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/secret-store.md
  - spec/5-system/2-api-convention.md
  - spec/2-navigation/4-integration.md
---

# `notification_secret_v2` 저장 형태 — 결정과 정정 (planner 턴)

`review/consistency/2026/09/05/19_08_19` 의 **Critical 1 · W2 · W3** 집행.
Critical 은 `sweep-response-contract` 브랜치의 push 를 막고 있는 사유다.

## ① 사실관계 — 직접 실측했다

checker 의 지적은 *"spec 은 ref 만 보관이라는데 실제는 평문"* 이었다. 코드로 확인했다.

### 쓰는 쪽 — 평문을 컬럼에 그대로 넣는다

```ts
// triggers.service.ts  rotateNotificationSecret()
const newSecret = `wsk_${randomBytes(32).toString('hex')}`;
trigger.notificationSecretV2 = newSecret;   // ← SecretResolver 미경유, 암호화 없음
await this.triggerRepository.save(trigger);
```

### 읽는 쪽 — 컬럼 값을 HMAC 키로 직접 쓴다

```ts
// notification-webhook.processor.ts
const primarySecret = await this.resolveSigningSecret(config, triggerId); // ref 경유
const secondarySecret =
  typeof trigger.notificationSecretV2 === 'string'
    ? trigger.notificationSecretV2                                        // 평문 직접
    : null;
```

**primary 는 SecretResolver 를 타고 secondary 는 안 탄다.** 같은 서명 목적의 두 값이 한
요청 안에서 서로 다른 보호 수준으로 다뤄진다.

### 그런데 자매 경로는 규약대로 하고 있다

| 컬럼 | 저장 내용 | 엔티티 주석 |
|---|---|---|
| `chat_channel_token_v2` | **ref** (`chatChannelTokenV2 = v2RefUsed`) | *"secret store ref … **plaintext 아님**"* |
| `notification_secret_v2` | **평문** (`= newSecret`) | *"신규 secret"* |

그리고 `secret-store.md §1` 은 **두 ref 이름을 이미 정의해 두었다**:

> `secret://triggers/{triggerId}/notification-signing.v2` — EIA HMAC signing (rotation grace)

즉 **설계는 처음부터 ref 였고, notification 쪽 구현만 그 설계를 따르지 않았다.**

## ② 결정 — 예외를 만들지 않는다. spec 이 옳고 구현이 이탈했다

checker 는 두 경로를 제시했다:

- **(a)** `secret-store.md §1` 에 세 번째 예외로 등재하고 §7.1 문구를 "평문" 으로 정정
- **(b)** 코드측 ref 화를 요구

**(b) 를 택한다.** 근거:

1. **설계가 이미 ref 다.** `notification-signing.v2` ref 이름이 규약에 등재돼 있고 자매
   구현(chat-channel)이 그대로 따른다. (a) 는 *"둘 중 잘못 구현된 쪽에 맞춰 규약을
   내리는"* 것이 된다.
2. **§1 이 그 실패 모드를 이름으로 경고한다.** 원문: *"(a)~(c) 를 함께 만족하지 않는
   **세 번째 필드**가 같은 문단을 근거로 예외를 얻는 것이 이 등재의 실패 모드다."*
   이 건이 정확히 그 세 번째 필드다.
3. **(a)~(c) 를 다 만족하지도 않는다.** `itk_*` 예외의 실질 근거는 (c)(서버 발급·닫힌 값
   공간·1회 노출·영향 범위가 트리거 하나)였다. `notificationSecretV2` 는 (c) 를 만족하나
   **(a) 가 성립하지 않는다** — 요청마다 검증하는 hot-path bearer 토큰이 아니라 발송 시점에
   한 번 쓰는 서명 키이고, 그 자매인 primary 는 **이미 ref 경유로 같은 자리에서 resolve
   된다**(성능이 문제였다면 primary 부터 걸렸어야 한다).
4. 비대칭의 비용이 실재한다 — 이번 스윕이 이 컬럼을 **응답 유출**로 먼저 만났다. 평문이라
   유출 등급이 ref 보다 높았고, 그래서 CHANGELOG 에 "회수되지 않는다" 를 적어야 했다.

### 그러나 지금 문서가 거짓인 것은 즉시 고친다

(b) 는 코드 변경이고 그것은 developer 트랙의 별도 PR 이다. 그때까지 §7.1 이 *"ref 만
보관"* 이라고 **단정하는 것은 사실이 아니다** — 다음 사람이 그 문장을 믿고 "그러니 응답에
나가도 ref 라 괜찮다" 고 판단할 수 있다(이번 스윕에서 내가 실제로 그 근처까지 갔다).

→ 문장을 **"설계는 ref, 현재 구현은 평문 — 알려진 이탈"** 로 정정하고, 정정문에 실측을
싣는다. 규약(`secret-store.md`)은 **건드리지 않는다** — 예외를 만들지 않기로 했으므로.

## ③ 변경안

### `spec/5-system/14-external-interaction-api.md` §7.1

L922 의 `notification_secret_v2` 절을 사실로 정정 + 이탈 blockquote 신설:
- 설계 목표는 ref(`notification-signing.v2`) — 규약 §1 에 이름이 등재돼 있다
- **현재 구현은 평문 컬럼**이며 소비 측도 SecretResolver 를 우회한다 (실측 인용)
- 자매 `chat_channel_token_v2` 는 ref 로 구현돼 있어 **같은 규약의 두 구현이 갈렸다**
- 해소 전까지의 실무 함의: 이 컬럼은 **ref 가 아니라 비밀 그 자체**로 다룬다

### `spec/conventions/secret-store.md`

§1 예외 목록은 **변경 없음**. 대신 `notification-signing.v2` 행에 *"현행 구현은 이 ref 를
아직 쓰지 않는다"* 는 한 줄(EIA §7.1 로 링크). 규약이 자기 미이행 상태를 알고 있게 한다.

### `spec/5-system/2-api-convention.md` (W2)

frontmatter `code:` 에 **정적 가드** 등재:

```yaml
- codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts
```

직전 planner 턴이 *"한쪽만 등재하면 사각지대가 남는다"* 며 런타임 검증자를 양쪽 문서에
넣었는데, **그 원칙을 세운 문서가 자기 짝을 빠뜨렸다.** §5.4 "검증 층" 표가 두 검증자를
나란히 적고 있으므로 `code:` 도 둘 다여야 한다.

### `spec/2-navigation/4-integration.md` §9.1 (W3)

`IntegrationDto` 가 최근 선언한 필드(`mallId`·`tokenExpiresAt`·`lastRotatedAt`·
`lastUsedAt`·`consecutiveNetworkFailures`)는 **신규 노출이 아니라 선언이 뒤늦게 정합된
것**이다. §9.1 표를 전부 늘리는 대신 `1-data-model.md §2.10` 포인터 한 줄을 둔다.

## Rationale

### 기각한 대안 — (a) 예외 등재

`secret-store.md §1` 의 예외 블록은 **자기가 남용될 방식을 이름으로 적어 두었다**. 그
경고를 쓴 문서에 그 경고가 가리키는 바로 그 형태를 추가하려면, `itk_*` 때처럼 **독립 근거
(a)~(c)** 를 새로 세워야 한다. 세워지지 않는다 — 위 §② 3 참조. 근거 없이 등재하면 다음
필드는 "notification_secret_v2 도 됐잖아" 를 근거로 삼는다.

### 기각한 대안 — 문서를 그대로 두고 코드 PR 만 등재

*"어차피 고칠 거니 문서는 그대로"* 는 그 사이 기간을 무방비로 둔다. 이번 스윕이 그 위험을
실증했다 — 나는 그 컬럼을 응답에서 빼면서 **"ref 라 등급이 한 단계 낮다"** 고 적을 뻔했다
(자매 `chat_channel_token_v2` 는 실제로 그렇다). 엔티티 주석을 읽고서야 평문임을 알았다.
문서가 거짓인 기간이 길수록 그 착각이 코드 판단으로 굳는다.

### 왜 `secret-store.md` 의 예외 목록을 안 늘리면서 §1 표에는 한 줄을 넣는가

예외 등재(규범 완화)와 **미이행 사실 고지**(현황 기록)는 다른 것이다. 후자는 규약을 약화
하지 않으면서 *"이 ref 는 정의됐지만 아직 안 쓰인다"* 는 사실을 그 ref 를 찾는 사람에게
알려 준다.
