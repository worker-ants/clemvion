---
title: "planner 턴 doc 묶음 7건 — allowlist 시리즈가 남긴 문서 부채를 한 번에"
status: in-progress
worktree: planner-doc-batch-dd163d
started: 2026-08-24
owner: project-planner
spec_impact:
  - spec/conventions/node-output.md
  - spec/conventions/egress-masking.md
  - spec/conventions/chat-channel-adapter.md
  - spec/conventions/conversation-thread.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/14-external-interaction-api.md
  - spec/4-nodes/7-trigger/providers/telegram.md
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
---

# planner 턴 doc 묶음 (`#1204`~`#1209` 잔여)

`nodeOutput`/`envelope.output` allowlist 시리즈(`#1205`·`#1208`·`#1209`)가 **developer 권한
밖**이라 남긴 문서 항목들. 정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
에 개별 등재돼 있고, **전부 `spec/**` 이라 한 planner 턴으로 묶는 것이 자연스럽다.**

## 왜 묶는가

일곱 건이 **같은 시리즈가 남긴 부채**이고 대상 문서가 겹친다(`node-output.md` 는 B1·B6 이,
`6-websocket-protocol.md` 는 B3·B5·B6 이 건드린다). 갈라서 내면 같은 파일을 세 번 열고,
그때마다 `--spec` 게이트를 한 바퀴씩 돈다.

## 항목 (fresh `origin/main` 재판정 완료 — 2026-08-24, `99b9bd908` 기준)

| # | 항목 | 재판정 |
| --- | --- | --- |
| B1 | Principle 0 이 **wire-only 8키**(`formConfig` 등)가 5필드 계약 밖임을 모른다 | `grep -c 'formConfig\|interactionType\|buttonConfig' node-output.md` → **0** |
| B2 | `egress-masking.md` §2 파이프라인 순서가 3단계로 낡음 | `grep -c 'allowlistFanoutNodeOutput\|nodeOutput allowlist'` → **0** |
| B3 | WS §4.4 `buttonConfig.nodeOutput` 행에 `nodeType` carve-out 각주 없음 | 해당 행에 `carve-out` → **0** |
| B4 | ~~`conversation-thread.md` `code:` 에 `websocket.service.ts` 추가~~ | **won't-do 로 판정** (아래 §B4) |
| B5 | `background:run:{id}` 가 WS §3.2 "채널 패턴" 표에 없음 | 문서 전체 **1회**(§3.3 인가 표에만) |
| B6 | 래퍼/도메인 구분 사본을 정본 링크로 대체 | 미전환 **3곳** — WS §4.1-a 는 **이미 링크됨**(`13_30_49` W3 정정) |
| B7 | provider 표의 `output.X` 가 wire 기준인지 **판정** | 판정 완료 (아래) |

> **B1 은 `#1209` 가 넣은 래퍼/도메인 각주(`node-output.md` line 31)와 다른 각주다.**
> 그쪽은 *"래퍼가 한 겹 더 있다"*, B1 은 *"5필드 밖 키가 얹힌다"*. `13_30_49` convention
> CRITICAL 이 둘을 같은 것으로 읽었는데, **내 초판 근거가 용어 grep(`wire 전용|wire-only`)
> 이라 두 각주를 구분하지 못했기 때문**이다 — 그 용어는 #1209 각주에도 없다. 위 표의 근거를
> **주장 기반**(8키 자체가 언급되는가)으로 바꾸고 검색어를 남겼다.

## B7 은 "고친다" 가 아니라 "판정한다"

`telegram.md:160`·`slack.md:233`·`discord.md:256` 의 CCH-MP-06 행이 *"`output.rendered` 를
escape 후 발송"* 이라 적는다. **실측된 것**: `extractRendered` 는
`rendered` → `payload.rendered` → `output.rendered` **세 후보를 훑는다** — 즉 **동작은 어느
shape 이든 맞다.**

남은 질문은 **그 문장의 주어**다:

- *"노드가 무엇을 만드나"* → 현행이 맞다(도메인 값 `NodeHandlerOutput.output.rendered`)
- *"렌더러가 어디서 읽나"* → 한 겹 얕다(wire 래퍼 기준 `output.output.rendered`)

**표의 다른 행들과 함께 봐야 갈린다.** `#1209` 에서 이 셋을 그냥 고치지 않은 이유가 그것이고
(같은 라운드에 `5-template.md` 등을 안 고친 것과 같은 판단), 이번에 **표 전체를 읽고
판정한다.** 판정이 "현행 유지" 로 나와도 그 근거를 남기는 것이 산출물이다.

### 판정 (2026-08-24, 세 파일 표 전수 판독) — **경로는 현행 유지, 프레임을 명시한다**

세 provider 의 같은 표(`telegram.md:157-160` · `slack.md:230-233` · `discord.md:253-256`)를
행 단위로 읽었다. 네 행이 일관되게 이렇게 적는다:

| 행 | 표기 |
|---|---|
| `chart` | `output.payload.{title, series, labels}` |
| `carousel` | `output.items[]` |
| `table` | `output.{rows, columns}` |
| `template` | `output.rendered` |

**주어는 "노드가 무엇을 만드나" 다.** 열 머리가 `nodeType` 이고 행이 노드 타입별로 갈리는
**출력 shape 표**이지, 렌더러의 접근 경로 표가 아니다. 따라서 `output.rendered` 는 도메인
값(`NodeHandlerOutput.output.rendered`)을 가리키는 **정확한 표기**다.

**`output.output.*` 로 고치면 틀린다** — 같은 표의 나머지 세 행과 어긋나고, 노드 spec
(`5-template.md` 등)의 표기와도 어긋난다. `#1209` 가 이 셋을 안 고친 판단이 옳았다.

**그럼 무엇이 문제였나**: 표가 **어느 계층을 서술하는지 말하지 않는다**. 그 침묵 때문에
checker 가 wire 기준으로 읽을 수 있었고, 실제로 그렇게 읽었다. 그래서 **경로는 그대로 두고
표에 프레임 한 줄**을 단다 — *"이 표는 핸들러 출력(`NodeHandlerOutput.output`) 기준이다.
wire envelope 에 실릴 때는 래퍼가 한 겹 더 붙는다"* + 정본 링크.

## B5 택일 판정 — **§3.2 에 행을 추가한다** (포인터를 돌리지 않는다)

`12_02_30` convention W1 이 두 선택지를 줬다: (a) §3.2 표에 행 추가, (b) `redis-keys.md` §4
포인터를 `12-background.md §8.5` 로 정정.

**(a) 로 정한다. 근거는 `redis-keys.md:84` 의 실제 모양이다:**

> \| `background:run:<id>` · `execution:<id>` · `workflow:<id>` \| **Socket.IO 채널** \| [WebSocket §채널] \|

**세 채널이 한 행에 묶여 한 곳을 가리킨다.** (b) 를 택하면 그 행을 셋으로 쪼개거나 링크를
둘로 갈라야 하고, *"이 셋은 Redis 키가 아니라 Socket.IO 채널"* 이라는 그 행의 **요지가
흐려진다**(그 문서 121행이 초안의 오등재를 정정한 이력까지 달고 있다).

그리고 §3.2 는 제목이 **"채널 패턴"** 이다. 인가 표(§3.3)에 있고 실제로 존재하는 채널이
패턴 표에만 없는 것은 **분류 문제가 아니라 누락**이다. 누락은 채워야 한다.

## B4 판정 — **won't-do**. 등재 자체가 잘못됐다

`spec-impl-evidence.md` §2.1 은 `code:` 를 **"본 spec 이 약속한 surface 의 구현 경로"** 로
정의한다 — **인용 추적성이 아니다.**

- `websocket.service.ts` 는 conversation-thread 가 약속한 surface 를 구현하지 않는다.
  fanout envelope 조립은 **EIA §R17 의 surface** 다.
- 그 문서의 기존 `code:` **16개 항목이 전부 conversation-thread 도메인 파일**이다(thread
  서비스 · AI 핸들러 · 프런트 대화 UI · `interaction.service.ts`). 넣으면 일관성이 깨지고
  `spec-code-paths.test.ts` 가드의 신호가 흐려진다.
- 원래 근거(`00_26_17` INFO 4)는 *"§8.4 정정 blockquote 가 `toFanoutEnvelope` 를 인용하는데
  glob 이 안 걸린다"* 였다. 그건 **인용 추적성**이고 §8.4 본문의 인라인 링크가 이미 그
  역할을 한다. `code:` 로 풀 문제가 아니었다.

**트래커 항목을 won't-do 로 닫는다.** `13_30_49` cross_spec W1 이 덧붙인 *"실제 로직을 가진
execution-engine 4파일이 `code:` 에서 빠져 있다"* 는 **별개의 더 큰 질문**이라 후속 등재한다.

## 작업

- [x] `/consistency-check --spec` **1회차(쓰기 전)** — `13_30_49` **BLOCK: YES** →
      `RESOLUTION.md`. Critical 1 은 반박(오탐), Critical 2 는 반영.
- [ ] `/consistency-check --spec` **2회차(쓴 뒤)** — 1회차는 `--diff-base` 랭킹이
      *"이 브랜치가 바꾼 파일 우선"* 이라 **대상 문서를 구조적으로 못 싣는다**(예산 900k
      로도 107개 절단). 쓴 뒤 돌려야 실제로 적재된다.
- [x] B1 Principle 0 — **wire-only 8키** 각주. 라벨은 기존 taxonomy 재사용
      (`wire 전용 (위젯 파서)` / `wire 전용 (chat-channel 렌더러)`) — 세 번째 표현 금지
- [x] B2 `egress-masking.md` §2 순서 + §1 좌표계 표. **line 77 의 `ws-event-types-extract.md`
      미해결 캐비엇은 유지**(`13_30_49` plan INFO 4)
- [x] B3 WS §4.4 `nodeType` carve-out 각주 — **"동일 이름·다른 계층"** 명시 +
      EIA §R17 · Principle 0 교차 참조 (W4)
- [x] ~~B4~~ **won't-do 판정** (위 §B4)
- [x] B5 WS §3.2 채널 패턴 표에 행 추가. 브래킷은 **그 문서 컨벤션 `{id}`**
- [x] B6 미전환 **3곳** → 정본 링크 (WS §4.1-a 는 **이미 링크됨, 손대지 않는다**)
- [x] B7 판정 적용 — **표 상단 각주 1회로 4행 전체**(chart/carousel/table/template) 커버 (W5)
- [x] 트래커 항목 7건 종결 동기화 (+ B4 won't-do, 파생 후속 2건 등재)
- [ ] `/ai-review`

## 검증 기준

- **코드 변경 0줄** — 순수 문서 작업이다. `codebase/**` 를 건드리면 그 순간 이 PR 의 성격이
  바뀐다.
- **각 항목은 "고쳤다" 가 아니라 "무엇을 근거로 그렇게 정했나" 를 남긴다** — B5·B7 은
  택일 판정이 포함돼 있어 특히 그렇다.
- 미러 스윕은 **주장 기반**으로. `#1209` 가 네 라운드에 걸쳐 놓친 축(대상의 종류 · 매칭 방식 ·
  스윕 단위 · 스윕 범위)을 전부 통과하도록 훑는다.
