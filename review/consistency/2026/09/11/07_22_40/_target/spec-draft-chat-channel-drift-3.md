---
title: 구현이 실측으로 확정한 것을 spec 에 반영한다 — details.field 두 갈래 · 신규 400 두 분기 · store()→rotate()
status: in-progress
owner: project-planner
worktree: .claude/worktrees/spec-chat-channel-drift-3-4d19bc
started: 2026-09-11
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/2-navigation/2-trigger-list.md
  - spec/conventions/secret-store.md
  - spec/conventions/chat-channel-adapter.md
  - spec/4-nodes/7-trigger/providers/telegram.md
  - spec/4-nodes/7-trigger/providers/slack.md
---

## 왜 이 턴인가

구현 PR `#1314`(`fad828884`)가 세 가지를 **실측으로 확정**했고, 그 셋 다 `spec/` 문면이
developer 권한 밖이라 planner 후속으로 등재돼 있었다. 세 라운드의 `--impl-done` 이
같은 지적을 반복했다(`review/consistency/2026/09/11/{00_21_57,00_45_19,01_10_44,02_06_14}`).

**SoT 가 파생 문서보다 뒤처져 있다** — 사용자 가이드 8파일과 CHANGELOG 는 이미 확정값을
공개했는데 spec 표는 *"미확정"* 이거나 틀린 표기를 유지한다.

## 열거를 층까지 확인했다 — 형식만 보면 맞는 것을 틀리게 만든다

이 세션 체인이 **여섯 번** *"축은 대칭인데 한쪽만"* 을 반복했다. 그래서 이번엔
`grep` 결과를 그대로 대상으로 삼지 않고 **각 자리가 어느 층을 서술하는지** 확인했다.

### (a) `details.field` — flat 표기가 전부 틀린 게 아니다

실측(`trigger-dto-validation.spec.ts` 의 `[실측]` 2건):

| 보낸 값 | 어디서 거부 | `details.field` | `details` 형태 | `details[].code` |
|---|---|---|---|---|
| 비어있지 않은 문자열 | 전역 `CustomValidationPipe` | **중첩** `chatChannel.<field>` | **배열** | `INVALID_FIELD` |
| `null` · `''` | `@IsEmpty()` **통과** → 서비스 가드 | **flat** `<field>` | **단일 object** | **없음** |

> **세 번째 열은 이 턴에 새로 측정했다.** 직전 턴의 두-갈래 표는 경로와 형태 두 축만 적었다.
> 파이프의 `flattenErrors` 는 원소마다 `code: 'INVALID_FIELD'` 를 싣고
> (`validation.pipe.ts:58`), 서비스 가드는 `details: { field: … }` 만 던져 **`code` 를 아예
> 넣지 않는다**(`triggers.service.ts:655,662,670,702,710`). `2-api-convention.md:205` 는
> `details[].code` 를 *"사유가 어느 필드에 붙는지가 정보의 일부일 때"* 쓰라고 하므로 파이프
> 쪽이 규약대로다 — 서비스 가드 쪽 `code` 부재는 **별 축의 갭**이라 이 턴에서 정하지 않고
> 후속으로 등재한다(코드 변경이 필요하다).

`grep` 이 준 chat-channel `details.field` 자리 여섯 곳을 층으로 갈랐다:

| 자리 | 무엇을 서술하나 | 판정 |
|---|---|---|
| `15-chat-channel.md:375` (§5.4.1 rotation 행) | **PATCH 차단** | **정정 대상** — flat `botTokenRef` + `botToken` 미확정 |
| `15-chat-channel.md:392` (§5.4.1.1 rotation 행) | **PATCH 차단** | **정정 대상** — 미확정 placeholder |
| `2-trigger-list.md:176` (PATCH 註) | **PATCH 차단** | **정정 대상** |
| `2-trigger-list.md:119,120` (§2.3.1 표) | 필드 편집 가능성 표 | **정정 대상** — PATCH 차단 서술을 포함 |
| `providers/slack.md:275` | **생성 시점** hex 정규식 검증(`assertInboundSigningPlaintextByProvider`) | **손대지 않는다** — 그 검사는 **서비스 층**이라 flat 이 맞다 |
| `providers/discord.md:297` | 위와 동일 | **손대지 않는다** |

> **뒤 둘을 고치면 맞는 것을 틀리게 만든다.** 생성 경로에서는 DTO 가 길이만 보고 통과시키고
> 형식 위반은 서비스가 잡으므로 **flat 이 실제 값**이다. 형식(flat/중첩)만 보고 일괄 치환하려던
> 것이 이 턴에서 처음 세운 계획이었고, 층을 확인하면서 철회했다.

### (b) 신규 400 두 분기 — 어디에도 등재되지 않았다

구현이 신설한 두 차단이 SoT 표에 없다:

| 분기 | `details.field` | 이유 |
|---|---|---|
| `chatChannel` 미설정 트리거에 PATCH 로 **사후 부착** 시도 | `chatChannel` | 최초 설정은 생성 POST 한정(§5.4.1 표 1행) |
| `provider` 를 바꾸려 함 | `provider` | `botTokenRef` 는 trigger id 로만 재유도되므로 **다른 provider 의 토큰을 넘기게 된다**. `2-trigger-list.md` R-12 도 *"변경하려면 트리거 삭제·재생성"* 이라 이미 적는다 |

**첫 행의 응답은 400 이다 — 문장을 갈라 적는다**(`convention_compliance` W1):

- **현재(가드 있음)**: `assertChatChannelAlreadySetUp` 이 **400 `VALIDATION_ERROR`**
  (`details.field='chatChannel'`)를 던진다. `details` 는 §5.3 상 **에러 봉투 전용**이므로
  이 행은 400 표에 속한다.
- **반사실(가드 없었다면)**: PATCH 는 비밀을 실을 수 없어 `setupChannel` 이 반드시 실패하고,
  그 실패가 CCH-SE-01 의 best-effort catch 에 삼켜져 **`chatChannelHealth='degraded'` 로
  200** 이 됐다. 가드를 넣은 이유가 이것이다 — 두 문장을 한 줄에 섞으면 **실제 응답이
  400 인지 200 인지** 읽는 사람이 알 수 없다.

**두 행 공통**: top-level code 는 기존 **`VALIDATION_ERROR` 재사용**이라 §1 카탈로그
신규 등재는 **불필요**하다. `details[].code` 는 위 3축 표의 *"서비스 가드 → 없음"* 갈래다
(`convention_compliance` INFO 2·3).

둘 다 **R-CC-21 의 필연적 귀결**이라 결정 신설이 아니라 **문서화 누락**이다.

### (c) `store()` → `rotate()` — 9곳이 아니라 **10곳**이다

출현 횟수로 전수 세면 `spec/` 에 `(SecretResolver|secrets|this.secrets).store` 가 **10회**다:

| 파일 | 줄 | 축 |
|---|---|---|
| `15-chat-channel.md` | 200 · 201 · 373 · 390 | chat-channel |
| `conventions/chat-channel-adapter.md` | 354 · 359 | chat-channel |
| `providers/telegram.md` | 58 · 219 | chat-channel |
| `providers/slack.md` | 278 | chat-channel |
| `conventions/secret-store.md` | 301 | **notification** |

> **10번째를 새로 측정했다.** 직전 턴은 `secret-store.md:301` 이 notification 경로라
> *"그 경로가 `store()` 를 쓰는지는 측정하지 않았다"* 로 남겨 뒀고, 트래커에 *"chat-channel
> 9곳"* 으로 등재했다. 이번에 재 보니
> `normalizeNotificationSecretRef` 도 **`secrets.rotate(...)`** 다 — 그 예시도 틀렸다.
> `secret-store.md §2.1` 자신이 *"`rotate()` 권장"* 이라 적으므로 **자기 문서 안에서 모순**이다.

`setupChannel` 은 생성·활성화·`chatChannel` PATCH 세 갈래에서 재호출되는 **멱등** 함수다.
문자 그대로 `store()`(중복 시 throw)라면 두 번째 호출부터 깨져야 하는데 깨지지 않는다 —
실제 호출이 전부 `rotate()`(UPSERT)이기 때문이다.

## 결정

- **D-1** — `details.field` 는 **값의 형태에 따라 갈린다**는 것을 SoT 에 적는다. 한쪽만 적으면
  다음 사람이 반대 갈래에서 틀린 문서를 읽는다(직전 턴이 실제로 그 실수를 했다).
  **트래커가 물었던 *"파이프 선언과 서비스 가드 중 하나를 SoT 로 정하라"* 에 대한 답은
  「정하지 않는다」다** — 두 층은 **서로 다른 입력을 받는다**(비어있지 않은 값 vs `null`/`''`).
  하나를 SoT 로 고르면 다른 입력에서 문서가 거짓이 된다. **갈린다는 사실 자체가 확정 설계**이고,
  그 문장을 §5.4.1 에 명시한다(`plan_coherence` INFO 5).
- **D-2** — 신규 400 두 분기를 §5.4.1 표와 `2-trigger-list.md` PATCH 註에 등재한다.
  R-12 에는 provider 축 cross-link 을 건다.
- **D-3** — `store()` **10곳**을 `rotate()` 로 정정한다. 각 자리에 *"UPSERT — 멱등 재호출"*
  근거를 한 번만(정본 자리에) 남기고 나머지는 표기만 바꾼다.
- **D-4** — `details.field` 의 근거 표현을 *"후속 e2e 확인 대기"* → **"단위 테스트 실측"** 으로
  정확히 한다. 실제 HTTP round-trip 은 아직 e2e 로 안 봤다(`--impl-done` `01_10_44` 지적).

### 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| **flat 표기를 `spec/` 전체에서 일괄 치환** | `providers/{slack,discord}.md` 의 flat 은 **생성 경로 서비스 가드**라 **맞다**. 형식만 보고 치환하면 맞는 것을 틀리게 만든다 |
| **두 갈래 중 "흔한 쪽"(중첩)만 적고 단순화** | 직전 턴이 정확히 그렇게 했다가 `--impl-done` 이 잡았다. `null`/`''` 는 클라이언트가 실제로 보내는 형태다 |
| **`secret-store.md:301` 을 chat-channel 축이 아니라며 이 턴에서 제외** | 같은 결함 클래스이고 **한 번 열거해 둔 것을 다음 턴에 다시 찾게** 만든다. 측정까지 끝났으므로 여기서 닫는다 |

## 변경안 — 자리 단위

| # | 자리 | 조치 |
|---|---|---|
| **A1** | `15-chat-channel.md:375` §5.4.1 rotation 행 | `details.field` 를 **두 갈래 표기**로. flat `botTokenRef` 는 *"`null`/`''` 일 때"* 로 한정 |
| **A2** | `15-chat-channel.md:392` §5.4.1.1 rotation 행 | 미확정 placeholder → 두 갈래 확정. 근거를 *"단위 테스트 실측"* 으로 |
| **A3** | `15-chat-channel.md` §5.4.1 표 | **신규 두 행**: `chatChannel` **사후 부착** 차단 · `provider` 전환 차단. 각 행에 **R-CC-21 · R-12 cross-link** (`rationale_continuity` INFO 4). 레이블에 *"최초"* 를 쓰지 않는다 — 기존 373·390 행이 *"최초 트리거 생성(POST)"* 이라 **POST 성공 케이스와 PATCH 차단을 같은 시점으로 오독**시킨다(`naming_collision` W3) |
| **A4** | `15-chat-channel.md:200,201,373,390` | `store()` → `rotate()` (4곳) |
| **B1** | `2-trigger-list.md:176` PATCH 註 | 두 갈래 표기 + 신규 두 400 사유 |
| **B2** | `2-trigger-list.md:119,120` §2.3.1 표 | 두 갈래 표기 반영 |
| **B3** | `2-trigger-list.md` R-12 | `provider` PATCH 차단 → 400 `details.field='provider'` cross-link |
| **C1** | `conventions/chat-channel-adapter.md:354,359` | `store()` → `rotate()` (2곳) |
| **C2** | `conventions/secret-store.md:301` | `store()` → `rotate()` — **notification 축, 이번에 새로 측정** |
| **C3** | `providers/telegram.md:58,219` | `store()` → `rotate()` (2곳) |
| **C4** | `providers/slack.md:278` | `store()` → `rotate()` (1곳) |

**손대지 않는 자리**: `providers/slack.md:275` · `providers/discord.md:297` (생성 경로
서비스 가드 → flat 이 정확) · `15-chat-channel.md:358` (`X-Workspace-Id` 헤더, 무관).

## 이 턴에 하지 않는 것

- **`chat-channel-adapter.md §1.1` 의 `setupChannel` "멱등 = yes" 각주** — 멱등성이
  *레지스트리 등록 안전성*이지 *시크릿 값 불변*이 아니라는 각주. 트래커 등재 유지.
- **`swagger.md §1` 의 `Update` 접두 규약화** — 별 결정 사안(명문 규칙 부재).
- **frontmatter `code:` 배선 4파일** — 가드 비강제 완결성 항목.
- **동시 PATCH lost update** — 코드 사안(developer).

## 체크리스트

- [x] `/consistency-check --spec` 1R `07_11_12` — **BLOCK: NO** (Critical 0 / Warning 3).
      셋 다 반영: 반사실/실제 분리 · 트래커 라인 명시 · 레이블 어휘 충돌. INFO 4건도 반영
- [ ] `/consistency-check --spec` 2R (`convention_compliance` + `cross_spec` 타겟) —
      1R 이 BLOCK: NO 였으므로 규약상 진행 가능하지만, **이 개정에서 새로 넣은 3축 실측
      (`details[].code`)은 어떤 checker 도 보지 않았다.** W1 을 낸 `convention_compliance` 와
      실측 주장을 검증하는 `cross_spec` 두 명에게만 확인받는다
- [ ] 변경안 A1~A4 · B1~B3 · C1~C4 적용
- [ ] docs 가드
- [ ] **트래커 종결 — 파일·라인을 지목한다**(`plan_coherence` W2, stale 체크박스 방지):
      `plan/in-progress/spec-draft-nullable-notation-followups.md`
      - `:2034` `details.field` 항목 → `[x]` + 3축 실측표 링크
      - `:2073` `assertChatChannelInputSafe` dead-code 항목 → SoT 질문 결론(「정하지 않는다」) 반영
      - `:2137-2166` `store()`→`rotate()` 항목 → `[x]`
      - **`:2159-2160` 의 *"정정 대상은 chat-channel 9곳뿐"* 문장이 이 턴으로 거짓이 된다** —
        `secret-store.md:301` 을 10번째로 포함하므로 **10곳으로 정정**한다
- [ ] **후속 신규 등재**: 서비스 가드의 `details[].code` 부재(코드 사안 — 파이프는 `INVALID_FIELD`
      를 싣는데 가드는 `code` 를 안 넣는다. `2-api-convention.md:205` 대비 갭)
- [ ] `plan/complete/` 이동
