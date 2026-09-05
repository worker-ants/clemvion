---
title: notification_secret_v2 — 내 첫 진단이 반증됐다. 이탈한 것은 §7.1 한 문장이다
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
  - spec/data-flow/15-external-interaction.md
  - spec/5-system/15-chat-channel.md
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

## ② 결정 — **첫 진단이 반증됐다.** 이탈한 것은 구현이 아니라 §7.1 한 문장이다

첫 판에서 나는 *"설계는 처음부터 ref 였고 notification 구현만 그 설계를 따르지 않았다"* 고
썼다. 근거는 `secret-store.md §1` 에 `notification-signing.v2` **ref 이름이 등재돼 있다**는
것 하나였다. `--spec` 이 그 전제를 잡았고, 지목된 두 Rationale 을 읽으니 **틀렸다.**

### 반증 1 — `chat-channel.md` R-K 가 두 컬럼이 **다른 것을 담는다**고 적는다

> **귀속 범위 주의** (`20_17_57` W1): R-K 가 **소유한 결정은 컬럼 *명명*** 이다
> (제목: *"`chat_channel_token_v2` 컬럼 **명명**의 semantic 비대칭"*). 저장 형태를 결정한
> 문서가 아니다 — 다만 그 이유를 적으며 **한쪽을 `secret`, 다른 쪽을 `reference` 라고
> 부른다**. 저장 형태 예외의 SoT 는 이번 턴이 세운 `secret-store.md §1` 비대상 등재이고,
> §7.1 정정문도 그렇게 적었다. 첫 판은 R-K 에 저장 형태 결정까지 귀속시켰다.

> `notification_secret_v2` 는 HMAC signing **secret** 의 v2 (rotation grace 기간 신규
> secret), `chat_channel_token_v2` 는 외부 provider bot token **reference** 의 v2 …
> 두 컬럼은 **의미상 직교** (signing secret vs external bot token) 하지만 **명명 패턴은
> 동일 유지**. 명명 일관성 우선 — 의미 차이는 컬럼 description 으로 명시.

내가 *"같은 규약의 두 구현이 갈렸다"* 고 부른 것이 **의도적으로 직교하게 둔 두 컬럼**이다.
`15-chat-channel.md` 의 DDL 주석도 같은 말을 한다 — *"semantic: bot token reference —
notification_secret_v2 와 **의미 상이**하나 명명 패턴 동일 (Rationale §R-K)"*.

### 반증 2 — `data-flow §1.5` 의 승격 경로가 평문을 **전제**한다

> `secrets.rotate(canonical ref, **v2**)` 로 secret store 내용을 교체하고 …

이 문장은 **v2 컬럼 값을 secret store 에 넣는다**는 뜻이다. v2 가 ref 라면 성립하지
않는다. 즉 설계상 그 컬럼은 **grace 동안 비밀을 들고 있다가 승격 시 store 로 옮겨지는
staging 슬롯**이다.

### 그래서 바뀌는 결론

| | 첫 판 | 정정 |
|---|---|---|
| 무엇이 이탈했나 | 구현(평문 저장) | **§7.1 의 "ref 만 보관" 한 문장** |
| `secret-store.md §1` | 손대지 않는다 | **예외 등재가 필요하다** |
| 후속 코드 작업 | ref 화 PR | **없다** — 코드는 설계대로다 |

`notification_secret_v2` 는 `secret://` 을 우회해 평문을 보관하는데 §1 예외 목록에 없다.
R-K 는 **semantic 직교**를 결정했지 **저장 정책 예외**를 등재한 것이 아니다 — 두 문서가
각자 반쪽씩 알고 있었고, 그래서 §7.1 이 반대로 적혀도 아무도 못 잡았다.

### 등재 근거 — `itk_*` 문단을 재사용하지 않고 새로 세운다

§1 은 *"(a)~(c) 를 함께 만족하지 않는 세 번째 필드가 **같은 문단을 근거로** 예외를 얻는
것이 이 등재의 실패 모드"* 라 경고한다. 그 경고를 지킨다 — `itk_*` 의 (a)~(c) 를 인용하지
않고 **이 필드 고유의 근거**를 적는다:

1. **durable home 이 아니라 staging 슬롯이다.** 승격되면 값은 `secrets.rotate` 로 store 에
   들어가고 컬럼은 `null` 로 초기화된다 (§1.5 · `promoteRotatedNotificationSecrets`).
   `itk_*` 처럼 **영구 평문 보관**을 요청하는 것이 아니다.
2. **노출 창이 24h 로 닫혀 있다** — cron 이 grace 종료 시 정리한다. 값의 수명이 정책으로
   제한되는 점이 `AuthConfig.config`(영구·암호화)·`itk_*`(영구·평문) 어느 쪽과도 다르다.
3. **서버 발급·1회 노출·영향 범위가 트리거 하나** — `wsk_` + `randomBytes(32)` 이고
   `rotateNotificationSecret` 응답에만 실린다. 사용자가 입력한 외부 자격증명이 아니다.
4. **primary 는 여전히 store 를 경유한다** — 이 예외는 grace 창의 **secondary 서명 키**에만
   적용되며 `signing.secretRef` 정책을 건드리지 않는다.

> **(1) 이 이 등재를 `itk_*` 와 가르는 축이다.** `itk_*` 는 "평문이 종착지" 라 (c) 로
> 버텨야 했지만, 이쪽은 **평문이 경유지**다. 다음 필드가 이 문단을 근거로 삼으려면
> "승격되어 store 로 들어가고 컬럼이 비워지는가" 를 만족해야 한다.

### 왜 3.5개월간 아무도 못 잡았나

§7.1 의 "ref 만 보관" 은 `ad0ea7cdb`(#264, 2026-05-22 secret store 전환)에서 들어왔고,
평문 rotation 코드는 **그보다 앞서** 있었다. 즉 처음부터 코드와 무관한 **aspirational
서술**이었다 — 전환 PR 이 "이 축은 앞으로 이렇게 된다" 를 현재형으로 적은 것이다.

잡히지 않은 이유는 **양쪽 문서가 반쪽씩만 알고 있어서**다. R-K 는 두 컬럼이 다른 것을
담는다고 적었지만 **저장 정책을 등재하지 않았고**, `secret-store.md §1` 은 ref 이름만
카탈로그에 올렸을 뿐 **이 컬럼이 그 밖에 있다는 사실을 몰랐다**. 어느 문서도 혼자서는
§7.1 이 거짓임을 알 수 없었다.

### 그래도 남는 것 — 정의됐지만 안 쓰이는 ref

§1 표의 `secret://triggers/{triggerId}/notification-signing.v2` 행은 **현행 구현이 쓰지
않는다**(승격은 canonical ref 를 회전한다). 이 행이 내 첫 오진의 직접 원인이다 — 이름이
등재돼 있으니 설계가 ref 라고 읽었다. 행을 지우지 않고 **"현행 미사용"** 을 명기한다.

## ③ 변경안

### `spec/5-system/14-external-interaction-api.md` §7.1

앵커: *"`notification_secret_v2` 컬럼도 동일하게 ref 만 보관 (rotation grace 기간)"*
(줄 번호로 특정하지 않는다 — 이 draft 가 그 문서를 편집하므로 실행 시점에 낡는다).

- 그 문장을 **"컬럼은 grace 동안 신규 secret 을 평문으로 들고 있다"** 로 정정
- 근거로 R-K(semantic 직교) · §1.5(승격 경로) · `secret-store.md §1`(신규 예외 등재) 상호 링크
- **EIA-NX-12 와 혼동 방지 한 줄** — 그쪽은 *"rotate 응답에 1회 평문 반환"* 이고 이쪽은
  *"컬럼 자체가 평문"* 이다 (`--spec` INFO#3)

### `spec/conventions/secret-store.md` §1

**세 번째 예외로 등재한다** — `Trigger.notification_secret_v2`. 근거는 위 §② 의 (1)~(4)
이며 `itk_*` 문단을 인용하지 않는다. 아울러 `notification-signing.v2` ref 행에 **"현행
미사용"** 을 명기한다.

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

> **선행 의존** — 그 5필드 선언은 아직 `origin/main` 에 없다
> (`claude/sweep-response-contract-5ba0ad`). **그 브랜치가 머지된 뒤에 반영한다**
> (`--spec` W6). 캐비엇도 함께 적는다: `consecutiveNetworkFailures` 는 FE 미소비라
> **제거 후보로 별도 추적 중**이므로 나머지 4개와 동급으로 문서화하지 않는다 (W7).

## `--spec` 반영 (`review/consistency/2026/09/05/19_40_29` — BLOCK: YES · C1 · W7 · I7)

### Critical — 내 전제가 틀렸고, 그 지적이 이 draft 의 결론을 뒤집었다

지적: *"이미 살아있는 두 Rationale 을 인용도 갱신도 없이 뒤집는다."* 두 문서를 직접 읽고
**전제가 반증됐음을 확인했다** — 위 §② 에 그 과정을 그대로 적었다.

첫 판의 근거는 `secret-store.md §1` 에 `notification-signing.v2` **이름이 있다**는 것
하나였다. 이름의 존재를 설계 의도로 읽은 것인데, 그 의도를 실제로 결정한 문서
(`chat-channel.md` R-K)는 **반대**를 말하고 있었다. 내가 **선례에 없는 근거를 소급
부여**했다.

→ 결정을 (b)에서 **(a) 계열로 뒤집었다.** `spec_impact` 에 두 문서를 추가했고, 두 문서는
**갱신하지 않는다** — 그 판정이 옳았고 §7.1 한 문장만 그것과 어긋나 있었기 때문이다.
(checker 가 제시한 해소안 (i)/(ii) 중 **(ii)** 에 해당한다.)

### 나머지 지적 반영

| # | 지적 | 반영 |
|---|---|---|
| W1 | 두 파일이 `spec_impact` 누락 | **추가** |
| W2 | `## Rationale` 이 마지막 섹션이어야 하는데 번들 관찰이 뒤에 붙음 | **재배치** — 관찰을 Rationale 앞으로 |
| W3·W5 | 이탈 해소 후속이 `pending_plans` 로 연결 안 됨 | **전제 소멸.** 결정이 뒤집혀 **코드측 후속이 없다** — 코드는 설계대로다. 대신 아래 "후속" 에 문서 정리 1건만 남는다 |
| W4 | 인접 plan 의 *"§5.4 를 시행하는 유일한 코드"* 서술을 W2 가 반증 | **아래 후속에 등재** — 그 문장은 미머지 브랜치에 있어 이 PR 에서 못 고친다 |
| W6 | W3 전제가 미머지 브랜치에 의존 | **순서 명기** (§③) |
| W7 | `consecutiveNetworkFailures` 제거 후보 캐비엇 | **명기** (§③) |
| INFO#2 | `1-data-model.md §2.8` 의 인접 서술 | 아래 후속 |
| INFO#3 | EIA-NX-12 와 혼동 가능 | **§7.1 정정문에 상호 참조 한 줄** (§③) |
| INFO#4 | R-K 가 secret-store 전환 하루 전 작성 | 확인했으나 **R-K 본문은 유효** — semantic 직교 판정은 전환과 무관하다 |
| INFO#6 | 줄 번호 인용이 stale 될 수 있다 | **앵커 문구로 교체** (§③) |

### 후속 (이 PR 밖)

- ~~**미머지 브랜치 문구 정정**~~ → **2차 반영 I6 에서 해소.** 그 문장은 `983fd0ade` 로
  이 브랜치에 이미 있었고 여기서 고쳤다 — *"미머지라 못 고친다"* 는 내 사유가 틀렸다.
- **`1-data-model.md §2.8`** 의 `notification_secret_v2` 행에 저장 형태 한 줄 (INFO#2).

## `--spec` 2차 반영 (`19_59_16` — BLOCK: YES · C1 · W3 · I6)

### Critical — 내가 쓴 **안전 근거**가 현행 코드에서 거짓이었다

예외 근거 (3) 에 *"서버 발급·**1회 노출** … rotate 응답에만 실린다"* 라고 썼다. 두 checker 가
독립적으로 반증했다 — `notification_secret_v2` 는 `GET/POST/PATCH /api/triggers` ·
`GET /api/schedules`(트리거 조인) 응답에 **매 요청** 실린다. 이 브랜치(= `origin/main`)에
컬럼 스트립이 **0건**임을 확인했다.

**이것이 "문서한 보장이 구현보다 넓다" 의 교과서적 형태다.** 예외를 정당화하려고 쓴 문장이
그 정당화의 전제를 실제로는 만족하지 않았다.

조치:

- 근거 (3) 에서 "1회 노출" 을 빼고, **노출 창이 아직 안 닫혔다는 사실**을 blockquote 로 적었다.
- **§1.1 을 신설**해 *"비대상 등재는 **저장 위치** 예외이지 **노출** 예외가 아니다"* 를 규범
  문장으로 세웠다 — `--spec` W1 이 지적한 대로 그 요구가 `spec/**` 어디에도 없었다(실측 0건).
  ref 도 대상에 넣고, `select:false` 를 쓰지 않는 이유(내부 읽기 경로가 조용히 깨진다)도 적었다.
- 유출을 닫는 **코드 항목을 트래커에 등재**해 spec 등재와 짝지었다. 수정은 이미 병행
  브랜치에 있으므로 *"머지되면 닫고, 아니면 백포트한다"* 로 조건을 적었다.

### 나머지

| # | 지적 | 반영 |
|---|---|---|
| W1 | 응답 노출 금지가 정규 문장으로 없음 | **§1.1 신설** (위) |
| W2 | 인용 라벨이 파일 관례(`[Chat Channel §R-K]`)와 다름 | **통일** |
| W3 | §9.1 반영이 후속 목록에 없음 | **트래커에 항목 등재** (머지 순서·캐비엇 포함) |
| I4 | R-K·§1.5 → secret-store 역방향 링크 부재 | **하지 않는다.** 두 문서를 갱신하지 않기로 한 결정의 범위 밖이고, 링크 하나를 위해 남의 Rationale 을 여는 것은 이 턴의 일이 아니다 |
| I5 | 정정 기록이 파일 관례(취소선 인라인)와 형태 다름 | **하지 않는다.** 이 정정은 한 문장 교체가 아니라 **왜 거짓이었는지**를 남겨야 해서 blockquote 가 맞다. 취소선 인라인은 짧은 자구 교체용이다 |
| I6 | *"미머지 브랜치라 못 고친다"* 가 부정확 | **맞다 — 여기서 고쳤다.** 그 문장은 `983fd0ade` 로 이 브랜치에 이미 있었다. "유일한 코드" → **"런타임으로 시행하는 유일한 코드"** 로 좁혔다. 내 사유가 틀렸다 |

## `--spec` 번들 관찰 (실행 전 실측)

이 draft 의 `spec_impact` 두 문서가 프롬프트에 거의 실리지 않았다. **본문 기준**으로 쟀다
(그 문서에만 있는 헤딩·코드 라인):

| 문서 | 판정 문자열 | 5개 프롬프트 중 적재 |
|---|---|---|
| `spec/conventions/secret-store.md` | `## 1. URI Scheme` | **1** (`convention_compliance` 만) |
| `spec/5-system/14-external-interaction-api.md` | `notification_secret_v2  TEXT NULL` | **0** |

> 지난 라운드에는 문자열 **언급 횟수**를 세어 "적재됨" 으로 오판했다. 언급은 다른 문서의
> 링크 참조일 수 있다 — 본문에만 있는 문자열로 물어야 한다.

이미 등재된 harness 결함의 재현이고, 이번엔 `5-system/` 문서까지 빠졌다. **그럼에도
checker 가 Critical 을 잡았다** — `rationale_continuity` 가 번들에 없던
`chat-channel.md` R-K 와 `data-flow/15-external-interaction.md` §1.5 를 직접 찾아 읽었다.
번들 결함이 이 라운드의 판정을 무디게 하지 않았다는 증거로 기록한다.

## Rationale

### 기각한 대안 — (b) 코드측 ref 화 요구

**첫 판이 택했던 안이고, 실측으로 기각됐다.** R-K 가 두 컬럼의 semantic 직교를 명시적으로
결정했고 §1.5 의 승격 경로가 v2 의 평문을 전제한다. 코드는 그 결정대로 구현돼 있다 —
바꿔야 할 것은 코드가 아니라 그것과 어긋난 §7.1 한 문장이다.

> **이 기각은 "위험 인수" 가 아니라 "이탈 부재 판정" 이다.** 평문 보관이 더 낫다고
> 주장하는 것이 아니라, **그것이 이미 정착된 동작**이며 이 턴의 일이 아니라는 뜻이다.
> 저장 형태 자체를 재검토하려면 이번 턴이 세운 `secret-store.md §1` 비대상 등재를 다시
> 여는 별도 결정이어야 한다 (R-K 가 아니다 — 위 "귀속 범위 주의" 참조).

### 기각한 대안 — §7.1 만 고치고 `secret-store.md` 는 두기

문장 하나만 고치면 *"이 컬럼은 왜 `secret://` 밖에 있나"* 에 답하는 자리가 여전히 없다.
R-K 는 **semantic**(무엇의 v2 인가)을 결정했지 **저장 정책**(왜 store 밖인가)을 등재한
것이 아니다. 두 문서가 반쪽씩 알고 있었던 것이 §7.1 의 거짓을 아무도 못 잡은 이유다.

### 왜 `itk_*` 의 (a)~(c) 를 재사용하지 않는가

§1 이 그 재사용을 **실패 모드로 지목**했다. 그래서 이 필드 고유의 근거를 세웠고, 그중
(1)(**평문이 종착지가 아니라 경유지**)이 `itk_*` 와 가르는 축이다. 다음 필드가 이 문단을
인용하려면 "승격되어 store 로 들어가고 컬럼이 비워지는가" 를 만족해야 한다 — 근거가
넓어지지 않게 그 조건을 등재문에 함께 적는다.

### 이 draft 자신이 남기는 교훈

**이름의 존재를 설계 의도로 읽었다.** `secret-store.md §1` 에 `notification-signing.v2`
행이 있으니 "설계는 ref" 라고 결론지었는데, 그 의도를 실제로 결정한 문서는 따로 있었고
반대를 말했다. 규약의 **카탈로그**(무엇이 정의됐나)와 **결정**(왜 그렇게 하나)은 다른
층이고, 후자를 안 읽으면 전자만으로 반대 결론에 닿을 수 있다.
