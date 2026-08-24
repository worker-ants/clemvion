# RESOLUTION — `16_41_05` (`--spec` 2회차, BLOCK: YES)

CRITICAL 1 · WARNING 4 · INFO 3. **Critical 은 지적이 옳았고, 내 각주가 틀렸다.**

## CRITICAL 1 — 나는 기각된 대안을 **재해석으로 되살렸다**

지적: B3 각주가 *"Principle 1.1.4 는 `{type,data}` **래퍼**만 금지하지 이름은 무관"* 이라는,
**원문에 없는 해석**으로 `nodeOutput.nodeType` 을 정당화했고, 그건 WS 자신의 C3 가 명시적으로
기각한 패턴이다.

**직접 확인했다. 맞다.**

- C3 원문: *"노드 종류는 상위 `payload.nodeType` 로 이미 식별되므로 `nodeOutput` 안의 `type`
  판별자는 **불필요·중복**"*
- 코드 실측(`discord-message.renderer.ts:322` 외 2 provider): `buttonConfig.nodeOutput?.nodeType`
  의 값 공간이 `chart`/`table`/`carousel` — **`payload` 의 노드 종류와 같다.**

내가 쓴 *"렌더 서브타입이라 별개"* 라는 구분은 **코드에 없다. 내가 지어냈다.** 이 저장소가
`Rationale` 에서 반복해 경계하는 *"선례에 없는 근거를 소급 부여"* 그 자체이고, 하필
**문서 정합화가 목적인 PR** 이 그 원칙을 무력화할 뻔했다.

### 다만 사실관계는 한 겹 더 있다 — 그래서 각주를 지우지 않고 **다시 썼다**

checker 는 *"레이어 분리(핸들러 output vs wire 조립)"* 로 논거를 바꾸라고 제안했는데,
그 프레임도 정확하지 않다. 측정해 보면:

| 층 | 상태 |
|---|---|
| 엔진(emit·영속) | `nodeType` 을 `nodeOutput` **안에 넣지 않는다** — `nodeType:` 대입은 전부 envelope 레벨. 실 DB 조회(e2e 285건, `output_data` 84 object 행)에서 top-level `nodeType` **0행** |
| chat-channel 렌더러 | `nodeOutput?.nodeType` 을 **읽는다**(3 provider) — legacy flat shape 방어 |
| fanout allowlist | 통과 목록에 둔다 — 그 방어를 깨지 않으려는 **예방적 허용** |

**즉 엔진은 C3 를 이미 지키고 있다.** wire 조립 레이어가 얹는 것도 아니다 — 아무도 안 넣는다.
그러니 *"레이어가 달라서 예외"* 가 아니라 **"C3 는 지켜지고 있고, allowlist 항목은 읽는 쪽의
방어를 깨지 않으려는 예방적 허용일 뿐"** 이 정확하다.

새 각주는 그렇게 적었고, **"새 코드가 `nodeOutput.nodeType` 을 쓰는 것은 여전히 C3 위반"**
을 명시했다. 초판이 C3 를 약화시켰다면 새 각주는 C3 를 **강화**한다.

표 행의 포인터(*"이 금지와 무관하다"*)도 같은 오류라 함께 고쳤다 — **각주를 고치면 그것을
가리키는 문구도 미러다.** 이번엔 먼저 셌다(`grep` 1건, 정정 후 0건).

## WARNING 1 — `{runId}` 는 내 plan 자신의 결정과도 어긋났다

B5 판정문에 *"브래킷은 그 문서 컨벤션 `{id}`"* 라고 써 놓고 **`{runId}` 로 썼다**. §3.3 형제
행도 `{id}` 다. `{id}` 로 정정. 세 checker 가 독립으로 같은 걸 짚었다.

## WARNING 3 — B1 각주의 "코드 주석과 같은 문구" 주장이 부정확

*"갈래 라벨은 그 상수의 주석과 같은 문구를 쓴다"* 고 적었는데, 실제로는 **EIA §R17 의 긴형**을
베꼈고 코드 JSDoc 은 **축약형**(`wire 전용 (위젯)`)이다. 문장을 *"EIA §R17 과 같은 문구,
코드 JSDoc 은 축약형"* 으로 정정했다. **키 배열 자체는 정확히 일치**하므로 기능 위험은 없고,
라벨 통일은 후속 developer 턴 몫으로 남긴다(INFO 1 과 같은 항목).

*"코드를 봤다"* 고 쓰고 실은 스펙을 베낀 것 — 이 세션이 반복 기록한 **프록시를 재고 실측이라
적는** 형태다.

## WARNING 2 — `payload.nodeType` vs `waitingNodeType`

대기 이벤트의 실제 wire 필드명은 `waitingNodeType` 인데 각주가 `payload.nodeType` 으로만
적었다. 새 각주에 **실제 필드명을 명시**하고 EIA §R17 상호 참조를 넣었다.

## WARNING 4 — 4개 conventions 의 `## Rationale` 이 이번에도 미적재

**직전 커밋에서 이미 정정·등재한 항목**이다(예산이 아니라 **후보 미도달**). checker 가
독립으로 같은 결론에 도달했고 *"payload 만 소비하는 다른 라운드는 계속 사각지대"* 라는
지적이 정확하다. 트래커 항목에 그 문장을 반영한다.

**이번 라운드가 그 완화책의 유효성을 실증했다** — 나는 C3 와 Principle 1.1.4 를 직접 `Read`
했고, checker 도 그렇게 해서 Critical 을 잡았다. 번들에 없어도 게이트가 작동한다.

## INFO

- **#1** (코드 JSDoc 라벨 축약형) — W3 과 같은 항목. 후속 developer 턴.
- **#2** (`node-output.md` 3섹션 구조 부재) — pre-existing, 범위 밖.
- **#3** (트래커 대비 전수 일치) — 확인 기록.
