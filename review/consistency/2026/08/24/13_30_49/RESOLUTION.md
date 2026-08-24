# RESOLUTION — `13_30_49` (`--spec`, BLOCK: YES)

CRITICAL 2 · WARNING 5 · INFO 8. **Critical 1 은 반박**하고 나머지는 전부 반영했다.
반박에도 내 잘못이 섞여 있어 함께 적는다.

## CRITICAL 1 — **오탐이다. 단 원인은 내 plan 이 만들었다**

지적: *"B1 이 요구하는 wire-only 각주가 `99b9bd908` 에 이미 있다(`node-output.md` line 31).
집행하면 중복 생성된다."*

**실측:**

| 확인 | 결과 |
|---|---|
| `node-output.md` line 31 의 실제 내용 | *"wire envelope 은 이 래퍼를 통째로 싣는다 — 도메인 값은 한 겹 아래"* = **래퍼/도메인 각주**(#1209 산출) |
| B1 이 요구하는 것 | *"wire 조립 레이어가 얹는 **8키**(`formConfig` 등)는 `NodeHandlerOutput` 5필드 계약 **밖**"* |
| `formConfig`/`interactionType`/`buttonConfig` 언급 | **0건** |

**둘은 다른 각주다.** 하나는 *"래퍼가 한 겹 더 있다"*, 다른 하나는 *"5필드 밖 키가 얹힌다"*.
B1 은 여전히 미해결이고, 그대로 집행해도 중복이 생기지 않는다.

### 그런데 checker 가 그렇게 읽은 것은 **내 plan 탓**이다

- B1 행의 근거를 *"언급 0건"* 이라고만 적고 **무엇을 grep 했는지** 안 남겼다. 실제 검색어는
  `wire 전용|wire-only|EIA wire 조립` 이었고, 이 용어들은 **인접한 #1209 각주에도 없다** —
  즉 그 근거로는 두 각주를 **구분할 수 없다**. INFO 3 이 정확히 이 점을 짚었다.
- B1 과 B6 이 같은 파일·같은 절을 건드리는데 **무엇이 다른지 plan 이 말하지 않았다.**

**고친 것**: B1 행에 *"이것은 래퍼/도메인 각주(#1209)와 **다른** 각주"* 를 명시하고, 근거를
용어 grep 이 아니라 **주장 기반**(8키 자체가 언급되는가 → 0건)으로 다시 적었다. 재현 가능한
검색어도 남겼다.

이 세션이 네 라운드에 걸쳐 겪은 *"매칭 방식으로 미러를 놓친다"* 와 **같은 실패가 재판정
근거에서 재발**한 것이다 — 이번엔 방향만 반대였다(놓친 게 아니라 남의 것을 내 것으로 셀 뻔).

## CRITICAL 2 — 4개 conventions 의 `## Rationale` 미적재. **직접 읽었다**

정확한 지적이고, 내가 plan 에 *"예산 절단 확인"* 을 체크리스트로 넣어 뒀는데도 **확인만 하고
대응은 안 했다**. `--diff-base` 랭킹이 *"이 브랜치가 바꾼 파일 우선"* 이라 **아직 아무것도
안 쓴 planner 첫 게이트에서는 대상 문서가 구조적으로 뒤로 밀린다**(예산을 900k 로 올려도
`node-output.md` 본문은 안 들어왔다 — 107개 절단).

**대응**: (a) 착수 전 4개 문서를 직접 Read/grep 했고(아래 W2 참조), (b) spec 을 쓴 뒤
`--spec` 을 한 번 더 돌린다.

> **정정 (2026-08-24, 2회차 실측)**: ~~그때는 변경 파일이 랭킹 1순위라 실제로 적재된다~~ —
> **틀렸다.** 2회차에도 `node-output.md` 본문은 0건이다. 프롬프트를 뜯어 보니 그 파일은
> **bundle 113개에도 절단 목록 110개에도 없다** = *"예산 부족으로 잘림"* 이 아니라
> **`related_specs` 후보 선정이 도달하지 못함**이다. 예산을 900k 로 올려도, 랭킹을 바꿔도
> 소용없다(랭킹은 후보를 재정렬할 뿐이다). 반면 `6-websocket-protocol.md` 는 절단 목록에
> 있으니 그쪽은 진짜 예산 문제다 — **두 고장을 하나로 뭉뚱그린 것이 내 진단 오류**였다.
> 실효 대응은 프롬프트 자신이 지시하는 **직접 `Read`** 뿐이고, 그건 (a) 로 이미 했다.

## WARNING 2 — B6 이 cafe24/makeshop mirror-dedup 철회 선례와 같은 형태인가 → **아니다**

이 저장소는 과거 *"cafe24/makeshop 미러 중복 ~1,600줄은 의도된 것"* 으로 DRY 통합을
**철회**한 이력이 있다. 그 선례에 걸리는지 `chat-channel-adapter.md` `## Rationale` 을 직접
읽었다.

- **재진술을 의무화하는 근거는 없다**(grep + Rationale 판독).
- 오히려 그 문서 Rationale 이 *"알고리즘 상세를 `15-chat-channel.md` 본문에 인라인하지 않는
  이유는 형식 규약이라 Convention 거주가 자연스럽기 때문"* 이라며 **한 곳 + 참조** 패턴을
  스스로 채택한다. B6 과 같은 방향이다.
- **선례와 형태가 다르다**: 그쪽은 **두 provider 통합 코드**의 의도적 미러(각자 독립 진화),
  B6 은 **하나의 계약을 세 문서가 산문으로 재진술**하는 것. 전자는 사본이 서로 달라질 수
  있어야 하고, 후자는 달라지면 그게 결함이다 — 실제로 이번 시리즈가 그 결함을 네 번 겪었다.

## WARNING 3 — B6 개수가 틀렸다. **4곳 → 3곳**

실측: `6-websocket-protocol.md` §4.1-a 는 **이미 정본을 링크**한다(#1209 에서 넣었다).
미전환은 **3곳** — EIA §R17 · `conversation-thread.md` §9.7 · `chat-channel-adapter.md`
(node-output.md 링크 **0건**). plan 을 3곳으로 정정하고 *"WS 는 손대지 않는다"* 를 명시했다.

또 *"열어 본 것만 세고"* 형태다(이번 세션 세 번째).

## WARNING 1 — B4 는 **하지 않는다 (won't-do)**

지적이 근본을 짚었다. `spec-impl-evidence.md` §2.1 이 `code:` 를 **"본 spec 이 약속한
surface 의 구현 경로"** 로 정의한다 — **인용 추적성이 아니다.**

- `websocket.service.ts` 는 conversation-thread 가 약속한 surface 를 구현하지 않는다.
  fanout envelope 조립이라는 **EIA §R17 의 surface** 다.
- `conversation-thread.md` 의 기존 `code:` 16개 항목이 전부 conversation-thread 도메인
  파일(thread 서비스·AI 핸들러·프런트 대화 UI·`interaction.service.ts`)이다 — 넣으면 그
  일관성이 깨지고 `spec-code-paths.test.ts` 가드의 신호가 흐려진다.
- B4 의 **원래 근거**(`00_26_17` INFO 4)는 *"§8.4 정정 blockquote 가 `toFanoutEnvelope` 를
  인용하는데 glob 이 안 걸린다"* 였다. 그건 **인용 추적성**이고, §8.4 본문의 인라인 링크가
  이미 그 역할을 한다. `code:` 로 해결할 문제가 아니었다.

**등재 자체가 잘못된 항목이었다.** 트래커 항목을 won't-do 로 닫고 근거를 남긴다.
checker 가 덧붙인 *"실제 로직을 가진 execution-engine 4파일이 `code:` 에서 빠져 있다"* 는
**별개의 더 큰 질문**이라 후속으로 등재한다 — 이 PR 에서 판정할 범위가 아니다.

## WARNING 4 — B3 각주에 "동일 이름·다른 계층" 명시

`nodeType` 이 envelope-level(`payload.nodeType`, 판별자 래퍼 금지 대상)과
`nodeOutput.nodeType`(wire-only carve-out) 두 계층에 있다. 각주가 carve-out 만 말하면
§4.4 의 *"판별자 래퍼는 두지 않는다"* 와 표면 충돌로 읽힌다. 각주에 계층 구분을 넣고
EIA §R17 · Principle 0 wire-only 각주(B1 산출) 로 교차 참조하도록 plan 을 고쳤다.

## WARNING 5 — B7 을 `template` 행만이 아니라 **표 4행 전체**로

정확하다. `template` 행만 프레임을 달면 같은 표에서 행마다 표기 깊이가 달라 보인다.
**B7 판정(경로 유지 + 프레임 명시)을 표 상단 각주 1회로** 적용해 4행(chart/carousel/table/
template)을 한 번에 덮도록 plan 을 고쳤다 — 원래 의도도 그것이었으나 plan 이 `template` 만
지목해 좁게 읽혔다.

## INFO

- **#3** (재판정 검색어를 남겨라) — Critical 1 의 원인이라 **채택**했다. 각 B 항목에 검색어·
  범위를 남겼다.
- **#4** (`egress-masking.md` line 77 캐비엇 보존) — 채택. B2 는 파이프라인 순서 문단만
  건드리고 `ws-event-types-extract.md` 미해결 캐비엇은 **유지**한다고 plan 에 명시했다.
- **#8** (기존 taxonomy 재사용) — 채택. B1 각주는 `wire 전용 (위젯 파서)`/
  `wire 전용 (chat-channel 렌더러)` 라벨을 **그대로** 쓴다. 세 번째 표현을 만들지 않는다.
- **#7** (브래킷 표기 `{id}` vs `<id>`) — B5 는 WS §3.2 에 넣으므로 **그 문서 컨벤션
  `{id}`** 를 따른다.
- **#1·#2·#5** — 정합 확인 기록, 조치 불요.
- **#6** (`### 4.4` 헤딩 중복) — pre-existing, 이 PR 책임 아님. 후속 등재.
