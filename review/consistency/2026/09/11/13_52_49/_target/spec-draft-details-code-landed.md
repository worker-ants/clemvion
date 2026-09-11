---
title: 배선이 끝났으니 SoT 를 그 상태로 맞춘다 — 시제 3곳 · code 병기 carve-out · 예시 9곳 · botToken 형식 서술 정정
status: in-progress
owner: project-planner
worktree: .claude/worktrees/spec-details-code-landed-4b7e2c
started: 2026-09-11
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/3-error-handling.md
  - spec/2-navigation/2-trigger-list.md
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
---

## 왜 이 턴인가

`#1317`(developer) 이 `details[].code` 를 **15자리에 배선**했다. 그 PR 의 `--impl-done`
(`review/consistency/2026/09/11/12_58_03`)·`/ai-review` 4라운드가 **spec 쪽 잔여 5축**을
지목했고, 전부 **developer 권한 밖**(`spec/`)이라 이 턴으로 넘어왔다.

**자기-반증형 소정정은 쓸 수 없었다** — 대상 문장들은 `#1316` **planner 턴**이 썼고, 역할은
`git blame` 이 아니라 **diff 스코프·게이트 종류·plan owner** 로 갈린다(조건 1 불성립). 규약이
*"조건 1 이 깨지면 예외 말고 두 PR 로 분리"* 라 적으므로 이 PR 이 그 분리다.

## (a) 시제 — 「배선 전 관측값」 3곳. **술어를 갈라 잔존 범위를 확정했다**

`#1317` 의 2·3·4라운드에서 **reviewer 둘이 잔존 범위를 다르게 보고**했다(`requirement`:
*"§5.4.1.2 만"* / `documentation`: *"세 곳"*). 직접 재측정하니 **서로 다른 술어**를 재고 있었다:

| 술어 | 자리 | 배선 후 상태 |
|---|---|---|
| ① *"위 「`code` 없음」은 **배선 전 관측값**이다"* 라벨 | §5.4.1 「토큰 변경 (rotation)」 행 · §5.4.1.1 「회전 (rotation)」 행 — **2곳** | **거짓은 아니다.** 그 측정은 실제로 배선 전이었다. 다만 현재형으로 읽혀 *"지금도 안 실린다"* 로 오독된다 |
| ② *"그 PR 이 머지되기 전까지 이 문단은 「아직 안 실린다」를 서술할 뿐"* 시한 절 | §5.4.1.2 닫는 문단 — **1곳** | **명백히 거짓이 된다.** 그 PR 이 머지됐다 |

→ `requirement` 는 ②에 대해 맞고, `documentation` 은 ①까지 세어 맞다. **②가 필수, ①은
일관성**이다. 세 곳 다 고친다.

**원문은 취소선으로 남기지 않는다** — 취소선은 *자기-반증형 소정정*의 조건 4(원문 보존)가
요구하는 형식이고, 이 턴은 그 예외가 아니라 **정규 planner 턴**이다. 대신 **배선 시점과 PR
번호**를 적어 무엇이 언제 바뀌었는지 추적 가능하게 한다.

## (b) `authConfigId` — `details.code` 병기가 §5.3 의 「겹쳐 쓰지 않는다」에 걸리는가

### 실측

`#1317` 이 `details[].code` 를 실은 13자리의 top-level 을 전수 확인했다:

| top-level | 자리 |
|---|---|
| `VALIDATION_ERROR` (400 상태 기본값) | **12곳** |
| **`AUTH_CONFIG_NOT_FOUND`** (도메인 특화) | **1곳** — `assertAuthConfigInWorkspace` |

developer 가 스스로 찾아 **코드를 고치지 않고** 앵커 주석 + 트래커로 넘겼다. 옳은 판단이다 —
걸리는지 자체가 **이 결정의 대상**이고, 코드로 선점하면 규약을 코드가 정하게 된다.

### 판정 — 걸리지 않는다. 그리고 **판별 기준**을 적는다

§5.3 의 금지 문면은 *"top-level 을 특화 코드로 바꾸면서 **같은 사유**를 `details[].code` 에도
넣으면 소비자가 어느 쪽으로 분기할지 갈린다"* 다. 금지의 **해악은 사유의 중복**이고, 중복이
낳는 것은 **분기 대상의 모호성**이다.

`AUTH_CONFIG_NOT_FOUND` + `INVALID_FIELD` 조합에는 그 모호성이 없다:

| 자리 | 값 | 소비자가 얻는 것 |
|---|---|---|
| top-level `code` | `AUTH_CONFIG_NOT_FOUND` | **도메인 사유** — 분기 대상 |
| `details[].code` | `INVALID_FIELD` | *"이것은 필드 수준 문제다"* 라는 **generic 표지** — 사유가 아니다 |
| `details[].field` | `authConfigId` | **어느 필드**인가 |

`INVALID_FIELD` 는 경쟁하는 사유를 싣지 않으므로 *"어느 쪽으로 분기할지"* 가 갈리지 않는다.

**그래서 `#1316` 이 쓴 「형태와 무관하다」 를 좁히지 않고, 판별 기준을 덧붙인다**:
`details[].code` 가 **top-level 과 같은 사유를 반복**하면 금지, **generic 표지**면 허용.
그 기준이 없으면 다음 사람이 이 자리를 보고 같은 조사를 반복한다.

> **`#1316` 의 문면이 과도하게 넓었던 것은 사실이다** — 나는 그 규칙에 *"top-level 이 이미
> 특화 코드인 경우"* 를 생각하지 않고 썼다. 다만 처방은 **규칙을 좁히는 것이 아니라 기준을
> 더하는 것**이다: 좁히면 `authConfigId` 만 `details.field` 에 generic 표지가 없는 **특례**가
> 되어 소비자가 그 필드를 따로 처리해야 한다.

### 부수 — `AUTH_CONFIG_NOT_FOUND` 가 카탈로그에 없다

§5.3 은 *"어느 쪽을 택하든 **에러 처리 §1 카탈로그에 등재**한다. 등재되지 않은 코드는 소비자가
존재를 알 방법이 없다"* 고 적는다. 그런데 **실측: `3-error-handling.md` 0건 ·
`conventions/error-codes.md` 0건.** pre-existing 갭이고 `#1317` 이 만든 것이 아니지만, 위
판정이 이 코드를 규약의 정식 갈래로 확정하므로 **같은 턴에 등재**한다.

## (c) 예시 9곳이 `details.code` 를 빠뜨린다

배선이 끝났으니 그 응답을 인용하는 문서들이 **불완전**해졌다. `--impl-done` 이 3문서를
지목했고 전수 확인했다:

| 문서 | 자리 | 무엇을 서술하나 |
|---|---|---|
| `providers/slack.md` | hex32 형식 위반 → 400 | **생성 시점 서비스 가드**(`assertInboundSigningPlaintextByProvider`) |
| `providers/discord.md` | hex64 형식 위반 → 400 | 같음 |
| `2-navigation/2-trigger-list.md` | `details.field='…'` **7자리** | §2.3.1 표 2곳 · §3 PATCH 註 4곳 · `R-12` 1곳 |

> **`#1315` 의 판정을 뒤집는 것이 아니다.** 그때 나는 *"`providers/{slack,discord}.md` 의 flat
> 표기는 손대지 않았다 — 그 둘은 **생성 시점 서비스 가드**를 서술하므로 flat 이 맞다"* 고
> 적었다. 그 판정은 **여전히 참**이다(경로 형태 축). 이번은 **`code` 축**이고, 그 가드들이 지금
> `code` 를 싣는다 — 축이 다르다.

**`2-trigger-list.md:179` 의 `details.field='endpoint_path'` 는 건드리지 않는다** — 그 자리는
이미 자기 세부 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)를 적고 있고 §1.10 이 SoT 다.

## (d) `botToken` 형식 검증 서술이 세 가지로 틀렸다

`2-trigger-list.md` §2.3.1 `botToken` 행:

> 형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$` ([Spec Chat Channel §5.4](…))

**전부 실측했다**:

1. **인용 target 에 그 정규식이 없다** — `15-chat-channel.md` 전역 **0건**. §5.4 는
   *"Bot token rotation API 응답 계약"* 이고 형식 절이 아니다. §4.1(`Trigger.config.chatChannel`)
   도 `botToken` 을 `"<provider 발급 plaintext>"` 로만 적는다.
2. **provider 무자격** — 그 정규식은 telegram BotFather 형식인데 행의 주어는 **3 provider**다
   (slack `xoxb-*` · discord Developer Portal). 바로 위 `inboundSigning` 행은 provider 를
   가르는데 이 행만 안 가른다.
3. **구현이 없다** — 그 정규식은 `content/docs/06-integrations-and-config/telegram{,.en}.mdx` ·
   `i18n/dict/{ko,en}/triggers.ts` **4곳(문서·i18n)에만** 있고 **코드에 0건**이다. 그리고 그
   문서들이 약속하는 `BOT_TOKEN_INVALID` 는 **형식 검사에서 나오지 않는다** —
   `triggers.service.ts` 가 `setupChannel` 의 **외부 API 401/403** 을 그 코드로 번역한다.

즉 *"형식 위반 시 400 `BOT_TOKEN_INVALID`"* 는 **메커니즘이 틀린 서술**이다. 결과는 비슷해도
(잘못된 토큰 → 400 `BOT_TOKEN_INVALID`) **언제·무엇이 거부하는지**가 다르다: 형식 게이트는
없고 **외부 provider 호출이 실패해서** 그 코드가 나온다.

**처방**: spec 은 **없는 검증을 광고하지 않는다.** 행을 *"서버는 형식을 검증하지 않는다 —
잘못된 토큰은 `setupChannel` 의 외부 API 401/403 에서 `BOT_TOKEN_INVALID` 로 드러난다"* 로
고치고, telegram 형식은 **입력 안내(user-guide)** 라고 성격을 밝힌다.
**user-guide MDX·i18n 4곳의 같은 서술 정정은 `codebase/**` 라 developer 몫** — 트래커에 남긴다.

## 결정

> **별 결정 라벨을 만들지 않는다.** 결정 번호 = 변경안 번호다. 이 체인에서 라벨 네임스페이스를
> 두 번 틀렸다 — `D-*`(`15-chat-channel.md` 의 `R-CC-21 / D-1`·`D-2` 와 충돌) · `CV-*`
> (`CCH-CV-0N`·`ED-CV-0N` 요구사항 ID 계열과 토큰 공유). 이번에도 후보를 grep 으로 먼저 쟀다:
> 편집 대상 `15-chat-channel.md` 에 `D-1`·`D-2`·`D-3`·`D-9` 가 **살아 있고**, `DEC-*` 는
> `#1316` 의 plan 이 **이미 쓴다**. **세 번째 재발이면 산문 규율 말고 구조를 바꾸는 것**이
> 맞다 — 번호를 하나만 쓰면 충돌할 이름 자체가 없다.


- **결정 1** — `15-chat-channel.md` 세 자리를 **배선 완료** 상태로 갱신. §5.4.1.2(명백히 거짓)가
  필수, §5.4.1·§5.4.1.1(라벨)은 일관성. 배선 PR 번호와 날짜를 함께 적는다.
- **결정 2** — `2-api-convention.md §5.3` 에 **판별 기준**을 덧붙인다: `details[].code` 가
  top-level 과 **같은 사유를 반복**하면 「겹쳐 쓰기」 금지에 해당, **generic 표지**면 해당 없음.
  「형태와 무관하다」는 **좁히지 않는다**. `authConfigId` 를 그 기준의 실례로 인용.
- **결정 3** — `3-error-handling.md` 에 **`AUTH_CONFIG_NOT_FOUND` 등재**. §5.3 의 등재 의무를
  이행한다. §1.10(트리거 endpointPath) 옆 신규 `§1.11` — 같은 `triggers` 도메인이고 같은
  「도메인 spec 참조」 형식이다.
- **결정 4** — 예시 9곳에 `details.code='INVALID_FIELD'` 병기 (`slack.md` 1 · `discord.md` 1 ·
  `2-trigger-list.md` 7). `endpoint_path` 자리는 **제외**(자기 세부 코드 보유).
- **결정 5** — `2-trigger-list.md` `botToken` 행의 형식 검증 서술을 **실측대로** 정정. 없는 검증을
  광고하지 않고, 실제 거부 메커니즘(외부 API 401/403)을 적는다.

### 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| **「형태와 무관하다」 를 *"top-level 이 상태 기본값일 때만"* 으로 좁힌다** | `authConfigId` 만 `details.field` 에 generic 표지가 없는 **특례**가 되어 소비자가 그 필드를 따로 처리해야 한다. 이 PR 이 사려던 균일성을 스스로 깎는다 |
| **`authConfigId` 의 `details.code` 를 제거** (코드 변경 요청) | 위와 같은 이유 + 코드는 이미 머지됐고 되돌릴 결함이 아니다. §5.3 이 그 조합을 **허용**한다는 것이 판정이다 |
| **`botToken` 형식 정규식을 `15-chat-channel.md` 에 **추가**해 인용을 살린다** | **구현이 없다.** spec 에 적으면 *"문서한 보장이 구현보다 넓다"* 를 한 층 더 쌓는다 — 구현 여부는 별 결정이고 트래커에 있다 |
| **`2-trigger-list.md` 행을 telegram 전용으로 좁히기만 한다** | provider 무자격만 고치고 **구현 없음**과 **메커니즘 오기**는 남는다. 셋이 같은 문장에 있다 |
| **취소선으로 원문 보존** | 그 형식은 **자기-반증형 소정정**의 조건 4 요구다. 이 턴은 정규 planner 턴이라 해당 없음 — 대신 배선 시점·PR 번호를 적는다 |

## 변경안

| # | 결정 | 자리 | 조치 |
|---|---|---|---|
| **1a** | 1 | `15-chat-channel.md §5.4.1` 「토큰 변경 (rotation)」 행 | 라벨 → 배선 완료 서술 |
| **1b** | 1 | `§5.4.1.1` 「회전 (rotation)」 행 | 같음 |
| **1c** | 1 | `§5.4.1.2` 닫는 문단 | **시한 절 제거** → 배선 완료 + `code` 값 명시 |
| **2** | 2 | `2-api-convention.md §5.3` 「`field` 를 실으면…」 절 | **판별 기준** 문단 신설 + `authConfigId` 실례 |
| **3** | 3 | `3-error-handling.md` 신규 **`§1.11`** | `AUTH_CONFIG_NOT_FOUND` 등재 + `2-trigger-list` 역링크 |
| **4a** | 4 | `providers/slack.md` hex32 행 | `details.code` 병기 |
| **4b** | 4 | `providers/discord.md` hex64 행 | 같음 |
| **4c** | 4 | `2-trigger-list.md` **7자리** | 같음 (`endpoint_path` 제외) |
| **5** | 5 | `2-trigger-list.md` §2.3.1 `botToken` 행 | 형식 검증 서술 정정 + 인용 교체 |

## 이 턴에 하지 않는 것

- **user-guide MDX·i18n 4곳의 `botToken` 형식 서술** — `codebase/**` 라 developer 몫. 결정 5 와
  **같은 사실**을 말하므로 반드시 짝으로 처리돼야 한다 → 트래커에 그 결속을 적는다.
- **provider 별 형식 검증 구현 여부** — 별 결정. 하면 문서가 참이 되고, 안 하면 문서를 고쳐야
  한다. 결정 5 는 **현재 상태를 정확히** 적는 것까지다.
- **`common/` 리터럴 vs `modules/` canonical 상수 비대칭 Rationale** — `--impl-done` INFO 2.
  근거가 코드 주석에 있고 spec 에 없어도 거짓이 아니다. 다음 `error-codes.md` 갱신 턴에.
- **`15-chat-channel.md` frontmatter `code:` 에 신규 상수 파일 추가** — `--impl-done` INFO 3.
  빌드 가드 강제 대상이 아니고 `/spec-coverage` 가 훑는 알려진 갭 클래스다.

## 체크리스트

- [ ] `/consistency-check --spec` BLOCK: NO
- [ ] 변경안 1a·1b·1c · 2 · 3 · 4a·4b·4c · 5 적용
- [ ] docs 가드 (`spec-link-integrity` — 신규 앵커 뮤테이션으로 판별력 확인)
- [ ] 트래커 `spec-draft-nullable-notation-followups.md`:
  - [ ] *"「배선 전 관측값」 서술 3곳"* 항목 종결
  - [ ] *"`authConfigId` 자리가 top-level 특화 코드 + generic `details.code`"* 항목 종결
        (판정 + §5.3 문면 보강 + 카탈로그 등재 셋 다)
  - [ ] *"`details.code` 배선을 다른 spec 문서 3곳이 예시에서 누락"* 항목 종결
  - [ ] *"`botToken` provider 별 형식 검증이 문서에만 있고 코드에 없다"* — **planner 갈래만
        종결**, developer 갈래(user-guide 4곳 + 구현 여부)는 존속
- [ ] `plan/complete/` 이동
