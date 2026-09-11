# RESOLUTION — `review/code/2026/09/11/18_42_05` (2라운드, `--route=all`)

**입력**: CRITICAL **0** · WARNING 3 · SPEC-DRIFT 1(기등재 확인) · INFO 16 · RISK **LOW** ·
reviewer 14/14 · forced 누락 0 · unfinished 0.

1라운드 대비 위험도가 MEDIUM → **LOW** 로 내려갔고, 지적의 성격이 *"새로 만든 위험 표면"* 에서
*"값 단언 갭 + 문서 stale"* 로 이동했다.

---

## WARNING 1 — `rotateBotToken` 이 **어떤 config 키를 읽는지** 아무도 안 본다

**분류**: 해소. **1라운드 W1 과 달리 이번엔 타입이 안 덮는다 — 직접 재현했다.**

| 뮤턴트 | tsc | jest (수정 전) | jest (수정 후) |
|---|---|---|---|
| `'app.url'` → `'frontend.url'` | **통과(무검출)** | **GREEN(생존)** | **RED** |

1라운드의 인자 *순서* 는 두 인자의 타입이 달라 `tsc` 가 잡았지만, **키는 그냥 문자열**이라
타입이 원리적으로 못 본다. reviewer 지적이 정확했다.

**원인은 mock 이었다.** 이 describe 의 `ConfigService` mock 이 `get: jest.fn(() => 'http://localhost:3000')`
— **키를 무시하고** 아무 키에나 같은 값을 돌려준다. 그래서 URL 값을 단언해도 키 스왑을 못
가른다. *"판별 fixture 는 두 경우를 **다르게** 판정하는 값이어야 한다"* 가 이것이다.

두 가지를 함께 고쳤다:

1. mock 을 **키 인식형**으로 (`key === 'app.url' ? … : undefined`) — `app.url` 반환값은 그대로라
   다른 테스트에 영향 없다(실측: `configService.get` 사용처는 코드 전체에서 **2곳뿐, 둘 다
   `'app.url'`**).
2. `expect(mockAdapter.setupChannel).toHaveBeenCalled()` → **넘긴 URL 값까지** 단언.

**선례를 따랐다** — 같은 파일의 `webhook callbackUrl 조립 (app.url 사용 회귀 방지)` describe 가
이미 키 인식 mock(`buildService((key) => …)`)으로 같은 회귀를 막고 있었다. **그 describe 가
`setupChatChannel` 경로만 덮고 있었던 것**이 reviewer 가 말한 비대칭의 실체다.

## WARNING 2 — `@param` 태그가 없는 파라미터를 가리킨다

**분류**: 해소. 1라운드에서 위치 인자 → 이름 인자로 바꾸면서 `@param baseUrl` / `@param endpointPath`
태그를 그대로 뒀다. **구조분해 인자는 최상위 이름이 없으므로** 그 태그는 존재하지 않는 것을
가리킨다 — *"내 수정이 다음 결함이 된다"* 의 전형이다.

`@param` 태그를 없애고 **타입 리터럴의 각 프로퍼티에 JSDoc** 을 달았다(TS 관용). 태그 이름을
`params.baseUrl` 로 바꾸는 대안은 실제로 `params` 라는 식별자가 없으므로 여전히 거짓이다.

## WARNING 3 — plan 의 코드 스케치가 옛 시그니처

**분류**: 해소. 1라운드가 체크리스트는 갱신했는데 §설계의 스케치 두 줄은 안 고쳤다.
스케치를 이름 인자로 고치고, **왜 바뀌었는지**를 각주로 달았다(그냥 고치면 착수 시점엔 저랬다는
사실이 사라진다).

---

## SPEC-DRIFT 1건 — 기등재 확인

reviewer 가 트래커의 planner 항목을 직접 열어 등재를 확인하고 *"추가 조치 불요"* 로 판정했다.
자기-반증형 소정정 조건 1 불성립(그 문장들은 이전 planner 턴이 썼다)이라는 내 판단도 함께 확인됐다.

## INFO 16건 — 처분

대부분 기등재 또는 이관된 기존 결함이다. 새로 등재하는 것은 **2건**:

- **INFO 7** — 내가 만든 테스트 헬퍼 `makeBinder(adapter, has: boolean)` 의 **두 번째 인자가
  위치 기반 boolean** 이다. 같은 PR 이 프로덕션 코드에서는 *"인자 순서를 형태로 없앤다"* 고
  해 놓고 **테스트 헬퍼엔 그 원칙을 안 적용했다.** 호출부가 2곳뿐이라 지금은 위험이 낮지만
  **일관성이 없다는 지적이 맞다.**
- **INFO 8** — `Logger.prototype.warn` spy 의 `mockRestore()` 가 **단언 통과 후에만** 실행된다.
  단언이 실패하면 spy 가 전역에 남는다. 지금은 파일 마지막 테스트라 전파가 없지만 **약한 관례**다.
  `afterEach(() => jest.restoreAllMocks())` 로 바꾸는 것이 맞다.

둘 다 `codebase/**` 수정이라 **이 라운드에서 함께 고친다** — 다음 라운드를 stale 시키지 않으려면
같은 커밋에 넣는 것이 맞고, 둘 다 내가 이번에 새로 쓴 코드다.

## INFO 14·15 — **리뷰어의 워크트리 오염이 3번째다. 내 처방이 틀렸다**

reviewer 가 `triggers.service.ts` 에 **미커밋 +555/-38**(T2 를 부분적으로 되감는 형태)을
관측했고, 다른 reviewer 는 teardown 테스트가 일시적으로 실패하는 것을 봤다(재실행 시 통과).

**워킹트리는 깨끗하다 — 실측했다**: `git status --short` 는 신규 리뷰 세션 디렉토리만,
`triggers.service.ts` 는 HEAD 와 **1,351줄로 동일**.

**중요한 건 이번 라운드엔 내가 뮤테이션을 안 돌렸다는 것이다.** 1라운드 후 트래커에 적은
처방은 *"뮤테이션은 리뷰 완료 후에만"* — **내 규율**이었다. 그걸 지켰는데 **또 났다.**
따라서 원인은 내가 아니라 **reviewer sub-agent 들이 검증하려고 공유 워크트리를 직접 뮤테이션하는
것**이다. 트래커 항목의 처방을 그 방향으로 고쳐 적는다(프롬프트에 scratch 사본 강제).

---

## 검증

- `'app.url'` → `'frontend.url'` 뮤턴트: **GREEN(생존) → RED**.
- 트리거 스위트 257 passed 유지(테스트 수 불변 — 단언을 **강화**했지 추가하지 않았다).
- 4단계 결과는 커밋 본문.
