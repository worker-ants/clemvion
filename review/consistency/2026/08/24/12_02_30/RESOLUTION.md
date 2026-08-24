# RESOLUTION — `12_02_30` (`--impl-done spec/5-system/`, BLOCK: NO)

CRITICAL 0 · WARNING 2. **둘 다 처리**했다.

## WARNING 1 (cross_spec) — 또 미러 스윕이었다

이번 PR 이 WS §4.1 에서 *"wire `output` = `NodeHandlerOutput` **래퍼 전체**, 도메인 값은
`output.output`"* 로 정정했는데, **같은 주장을 담은 형제 문서 둘을 안 고쳤다**:

| 자리 | 종전 서술 |
|---|---|
| `spec/conventions/chat-channel-adapter.md:180` | `/** NodeHandlerOutput.output — 예: Template 의 {rendered, …} */` |
| `spec/5-system/15-chat-channel.md:81` (CCH-MP-06) | *"`template` 은 `output.rendered` 텍스트 그대로"* |

둘 다 **한 겹 얕다**. 런타임 파손은 없다 — `renderPresentationByType` 이
`payload → output → config → flat` 우선순위로 훑어 래퍼든 도메인 값이든 찾아낸다. 하지만
리뷰어 지적대로 **그 주석을 SoT 로 믿고 `event.output.rendered` 를 직접 읽으면 `undefined`**
다. 타입 주석은 사람이 새 코드를 짤 때 읽는 계약이라, 코드가 방어적이라는 것이 면죄부가
아니다.

둘 다 정정하고 **왜 파손이 없었는지**(우선순위 훑기)까지 적었다 — 그게 없으면 다음 사람이
"그럼 지금까지 깨져 있었나" 로 읽는다.

### 과잉 정정은 하지 않았다

`output.rendered` 를 저장소 전체에서 훑으니 `slack.md`·`telegram.md`·`discord.md`·
`5-template.md` 등에도 나온다. **그쪽은 그대로 둔다** — 그 문서들은 wire envelope 이 아니라
**`NodeHandlerOutput` 자체**를 서술하는 자리라 `output.rendered` 가 맞다. 래퍼/도메인값
구분은 **wire 맥락에서만** 성립한다. 스윕이 잡은 히트를 전부 고치면 이번엔 반대 방향으로
틀린다.

## WARNING 2 (plan_coherence) — 자기-반증형 소정정의 후행 게이트 미이행

정확한 지적이다. `conversation-thread.md` §8.4 정정은 CLAUDE.md 예외를 원용했고, 그 **조건
5** 가 *"`--impl-done` 을 그 spec 파일이 포함되는 scope 로 반드시 돌린다"* 인데 이 라운드
시점까지 실행 기록이 없었다. 선례(`sse-nodeoutput-allowlist`)는 그 라운드 ID(`00_26_17`)를
체크리스트에 인용해 뒀다.

**이 RESOLUTION 직후 `--impl-done spec/conventions/` 를 실행하고 라운드 ID 를 plan
체크리스트에 인용한다.** 마침 W1 정정이 `chat-channel-adapter.md`(같은 스코프)를 건드렸으니
한 번의 실행이 둘을 함께 덮는다.

## INFO

- **#1** (CHANGELOG 중첩 인용 위치) — 지시대상이 흐려진다는 지적이 맞다. 다만 정정 블록을
  단락 끝으로 옮기면 *"어느 문장을 정정하는가"* 가 멀어져 반대 문제가 생긴다. **앵커 문구를
  넣는 쪽**을 택했다면 더 나았을 텐데, 이 라운드에서는 넘기고 다음에 그 단락을 만질 때
  처리한다(강제 아님, 사실관계 오류 아님).
- **#2** (`completed` 행만 Principle 3.2 산문 인용) — 같은 diff 의 자매 행이 링크형이라
  편차가 맞다. 이 파일을 다음에 열 때 링크화한다. 강제 아님.
- **#3** (KB 이벤트 표기) · **#4** (`node-output` 접두 공유) — 조치 불요. #4 는 리뷰어도
  *"실질 충돌 아님"* 으로 판정했고, 스코프가 다르다(egress 필터링 vs 도메인 shape).
