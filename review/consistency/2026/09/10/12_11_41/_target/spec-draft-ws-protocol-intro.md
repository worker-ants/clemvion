---
title: 6-websocket-protocol.md 도입 산문 — 개요 없이 §1 로 바로 들어가는 마지막 문서
worktree: spec-ws-protocol-intro-530258
started: 2026-09-10
owner: planner
status: in-progress
priority: P3
spec_impact:
  - spec/5-system/6-websocket-protocol.md
---

# `6-websocket-protocol.md` 에 도입 산문 (planner 턴)

`spec-draft-nullable-notation-followups.md` 단일 항목(2026-09-05 등재, `--impl-prep 12_48_13`
W1 의 처분에서 분리 재등재).

원 지적은 *"`5-system/` 12개는 로컬 `## Overview` 를 두는데 6개는 없다"* 였는데, 그 실측이
**전제를 반증했다** — 6개 중 4개는 `## 1. 개요` / 무제목 도입문으로 **내용이 있었고**, 제목
표기만 갈렸다. 내용이 진짜로 없는 것은 `2-api-convention.md` 와 `6-websocket-protocol.md`
둘이었다. 앞은 그 턴이 어차피 열어서 처리했고(`983fd0ade`, #1289), **이 문서가 남은 하나**다.

## 착수 전 재판정 (2026-09-10)

`origin/main` = `c7ccdb9c7`(#1305).

| 잰 것 | 값 |
|---|---|
| 2026-09-04 이후 이 파일을 건드린 커밋 | **0건** — 다른 세션이 손대지 않았다 |
| 현재 구조 | `# Spec: …` → `> 관련 문서:` → `---` → **`## 1. 연결`**. 도입 산문 0줄 |
| 자매 선례(`2-api-convention.md`) | `983fd0ade`(#1289) 에서 `## Overview (제품 정의)` + 2단락 추가됨 — 실재 확인 |

델타 있음. 진행한다.

## 제목 표기를 실측으로 골랐다 — `## Overview (제품 정의)` 가 아니라 순수 `## Overview`

트래커 항목은 *"형태는 그 문서 관행을 따르면 되고 `## Overview` 헤딩이어야 할 이유는 없다"* 고
적었다. 그래서 세 후보를 다 재봤다.

| 후보 | `5-system/` 내 사용 | 이 문서에 쓸 수 있나 |
|---|---|---|
| `## 1. 개요` (번호형) | `5-expression-language` · `7-llm-client` · `11-mcp-client` | **불가.** 아래 참조 |
| `## Overview (제품 정의)` | 8개 (`2-api-convention` · `12-webhook` · `9-rag-search` · `10-graph-rag` · `14-external-interaction-api` · `17-agent-memory` · `13-replay-rerun` · `15-chat-channel`) | 가능하나 성격이 안 맞다 |
| 순수 `## Overview` | 2개 (`4-execution-engine` · `3-error-handling`) | **채택** |

**`## 1. 개요` 가 불가한 이유는 취향이 아니라 비용이다.** 이 문서의 §1 은 이미 `## 1. 연결`
이라, 개요를 §1 로 넣으면 §1~§9 가 전부 한 칸씩 밀린다. 저장소가 이 문서의 **번호 앵커를
인용하는 자리가 116건**이다:

```
29  #42-실행-제어-명령-client--server
28  #44-사용자-입력-대기-이벤트-상세-executionwaiting
 7  #446-messagessource-마커      7  #41-실행-이벤트-server--client
 5  #71-에러-코드                  5  #22-서버--클라이언트-이벤트-래퍼
 4  #45-알림-이벤트-server--client   3  #445-conversation-thread-snapshot-conversationthread
 2  #rationale                    2  #62-놓친-이벤트-복구
 1  #47-외부-표면-매핑-external-interaction-api   1  #4-이벤트-목록
```

번호 없는 `## Overview` 는 기존 번호를 **한 개도** 건드리지 않는다.

**둘 중 순수 `## Overview` 를 고른 근거**: 그 표기를 쓰는 두 문서(`4-execution-engine` ·
`3-error-handling`)는 **내부 계약·정책 문서**이고, `(제품 정의)` 를 쓰는 8개는 사용자가
인지하는 **제품 표면**(웹훅·RAG 검색·채팅 채널·EIA…)이다. wire 프로토콜은 앞쪽이다. 게다가
`4-execution-engine.md` 의 Overview 는 **이미 이 문서의 §4.2 를 WS ack SoT 로 인용**한다 —
둘은 같은 층의 자매 문서다.

> **`(제품 정의)` 가 8:2 로 다수인데 소수를 고른다.** 다수결이 아니라 **판별 기준**으로
> 골랐다는 것을 적어 둔다 — 다음 사람이 "8개가 저렇게 쓰는데 왜" 를 되짚지 않도록.

## 변경안

### 삽입 위치

`> 관련 문서:` 註 뒤의 `---` 와 `## 1. 연결` **사이**. `2-api-convention.md`·
`4-execution-engine.md` 와 같은 자리다(둘 다 `---` → `## Overview` → 본문 → `---` → `## 1.`).

### 본문

```markdown
## Overview

본 문서는 **실행 중인 워크플로우와 프런트엔드 사이의 양방향 채널**을 정의한다 — 서버가 실행
진행 상황을 밀어 보내고(§4.1), 클라이언트가 실행 제어 명령을 보내고(§4.2), 노드가 사용자 입력을
기다릴 때 그 왕복을 중개한다(§4.4). 구독 단위는 execution·workflow·notifications·kb 채널이며
(§3), 놓친 이벤트는 `seq` 기반으로 복구한다(§6.2).

읽기 전에 두 가지를 알아야 한다. **첫째, 전송 계층은 Socket.IO 다** — 본문의
`{ type, id, payload }` 프레임 표기는 논리적 메시지 형태를 보이기 위한 추상화이고, raw
WebSocket 프레이밍을 전제한 항목들(§1.2 서브프로토콜 인증 · §8 close 코드 등)은 **비채택**이다.
그 경계의 SoT 는 바로 아래 §1 의 「전송 계층 (구현 현실)」 註다. **둘째, 같은 실행 상태가 두
표면으로 나간다** — 내부 WS 와 외부 EIA 의 REST + SSE + Outbound Notification 이며, 명령·이벤트
매핑의 권위는 §4.7 이 갖는다. 외부 표면은 내부 WS 경로를 facade 로 감싼 **단일 구현 경로**여야
하므로, **이벤트나 명령의 형태를 고칠 때 한 표면만 보고 고치면 두 표면의 의미가 갈린다.**

실행 상태 전이 자체(Execution/NodeExecution 상태 머신·블로킹/재개 계약)는
[실행 엔진](./4-execution-engine.md) 이, 에러 코드 어휘 규약은
[conventions/error-codes.md](../conventions/error-codes.md) 가, 외부 호출자용 REST 표면은
[External Interaction API](./14-external-interaction-api.md) 가 SoT 다. 본 문서는 그것들이
**wire 에서 어떤 프레임으로 보이는가**를 정한다.
```

## 왜 이 세 단락인가 — 중복을 피해 고른 내용

§1 의 「전송 계층」 註가 이미 Socket.IO caveat 를 길게 적고 있으므로 **그 내용을 반복하지 않고
가리킨다**. 도입문이 새로 주는 값은 두 가지다:

1. **문서가 무엇을 정하는 문서인지** — 지금은 `## 1. 연결` 로 시작해 "연결 방법 문서" 처럼
   읽히지만, 실제 무게중심은 §4(이벤트·명령, 약 750줄)다.
2. **두 표면 경고를 앞으로 끌어올린다** — §4.7 은 878행이다. 이벤트 형태를 고치러 온 사람이
   §4.1 만 보고 편집하면 EIA SSE 와 갈린다. 이 위험은 문서 끝이 아니라 **입구**에 있어야 한다.

세 번째 단락(SoT 경계)은 `3-error-handling.md`·`4-execution-engine.md` 의 Overview 가 둘 다
같은 자리에 같은 성격의 문장을 두는 관행을 따른 것이다.

## 준비 중 한 번 되돌렸다 — 무관한 트래커 편집이 이 세션의 게이트를 오염시켰다

처음 이 브랜치는 `harness-review-gate-followups.md` 의 산술 정정을 **함께** 담고 있었다.
그 상태로 `--spec` 을 준비하니 `cross_spec` 이 **적재 7 / 생략 106** 이었고, 생략 쪽에
**대상 `6-websocket-protocol.md` 가 들어 있었다.**

원인은 tier 1 신호의 정의다 — *"이 브랜치가 건드린 plan 이 이름을 언급함"*. 그 트래커가
거론하는 spec 6개(`1-data-model`·`2-trigger-list`·`3-schedule`·`1-auth`·`2-database-query`·
`2-api-convention`)가 전부 tier 1 로 올라와, 자연순으로 앞서는 것들이 **대상보다 먼저 예산을
먹었다**(누적 적재 290,327자에서 대상이 잘렸다).

처분: 정정을 **단독 PR 로 분리**했다([#1305](https://github.com/worker-ants/clemvion/pull/1305)).
무관한 두 변경을 가르는 것이 원래 맞고, 오염은 그 부수 효과로 사라진다. 이 초안의 체크리스트도
대상이 아닌 파일 이름을 본문에서 뺐다 — **`--spec` 을 받을 문서에 적는 파일 이름은 곧 예산
청구서다.**

## 무엇을 하지 않나

- **번호 섹션을 건드리지 않는다.** 위 116건 때문이다. `## Overview` 는 번호 밖이다.
- **§1 의 「전송 계층 (구현 현실)」 註를 옮기거나 줄이지 않는다.** 그 註가 그 caveat 의 SoT 로
  이미 다른 문서에서 인용되는 자리이고, 도입문은 가리키기만 한다.
- **`spec/5-system/` 의 나머지 표기 분열을 통일하지 않는다.** 원 항목의 처분(2026-09-05)이
  이미 (a)"6개에 Overview 추가"와 (b)"현 상태를 규약으로 인정"을 **둘 다 기각**하고, 내용이
  진짜 없는 두 개만 채우기로 정했다. 그 결정을 다시 열지 않는다.
- **`plan/complete/archive/` 의 stale 앵커 2건은 고치지 않는다** — 실측 중 발견했다:
  `from-followup-conversation-reconcile/spec-draft-conversation-reconcile-doc.md` 가
  `#44-실행-진행-이벤트` 를 인용하는데 그 heading 은 `### 4.4 사용자 입력 대기 이벤트 상세`
  로 개명돼 실재하지 않는다. 그러나 그 디렉터리는 CLAUDE.md 가 **"1회성·역사 문서 보관"** 으로
  규정한 자리고, 당시 문서가 당시 heading 을 인용한 것은 **기록으로서 맞다**. 사후 개작하지
  않는다(문서 가드도 `spec/` 만 훑으므로 main 은 green 이다).

---

## 체크리스트

- [ ] `--spec` 게이트 BLOCK:NO 확인 — **번들 예산을 먼저 계산**하고 `_prompts` 를 파싱해
      **대상 적재를 확인한 뒤** 판정을 받는다. 대상 `6-websocket-protocol.md` 는 **100,324자**
      이고, 이 초안이 표기 비교 근거로 `5-system/` 파일 15개를 이름으로 거론해 **그 전부가
      tier 1 로 승격된다**(자연순 prefix 누적 ~433,000자 + 생략 고지 ~19,000자 → corpus
      ~452,000자 → 예산 ≈ **1,130,000**). 배경: [`harness-review-gate-followups.md`
      §"승격은 됐는데 굶는다"](harness-review-gate-followups.md)
- [ ] `## Overview` 3단락 삽입 (`---` 와 `## 1. 연결` 사이, 뒤에 `---` 유지)
- [ ] **번호 앵커 116건 무변경 확인** — 삽입 전/후로 `^#{2,4} [0-9]` heading 목록을 떠서 동일 대조
- [ ] 도입문이 인용하는 링크 실재 — `./4-execution-engine.md` · `../conventions/error-codes.md` ·
      `./14-external-interaction-api.md` (앵커 없는 파일 링크 3건)
- [ ] 자매 트래커 항목 플립
- [ ] `--impl-done` 발화 여부는 게이트에 물어 판정 (`spec/`-only 예상)
