---
title: TriggerDto.workflow 의 "생성 응답에만 부재" 를 캐너리로 고정
worktree: trigger-workflow-ref-canary-96ae33
started: 2026-09-10
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

# `TriggerDto.workflow` 캐너리 (developer 턴)

`spec-draft-nullable-notation-followups.md` 단일 항목(2026-09-10 등재).
등재 경위: [#1304](https://github.com/worker-ants/clemvion/pull/1304) 에서 `ScheduleDto` 쪽 註를
쓰다가 **두 축의 고정 상태가 다르다**는 것을 실측했다.

## 왜 이 축이 위험한가 — 전제가 이미 한 번 깨졌다

`triggers.service.ts` 의 `update()` 는 PATCH 바디에 `chatChannel` 이 있으면(`if (chatChannel)`)
`setupChatChannel` 뒤에 트리거를 **재조회해 `saved` 를 통째로 갈아치운다.** 그 재조회가 한때
`relations` 를 빼고 읽었고, 그래서 **`chatChannel` 을 포함한 PATCH 응답에서만** `workflow` 가
사라졌다 (`review/code/2026/09/06/01_13_50` W4). `TriggerDto.workflow` JSDoc 은 *"생성 응답에만
없다"* 고 보장하는데 **그 보장이 구현보다 넓었다.**

구현은 `relations: ['workflow']` 를 실어 닫았다. **그런데 캐너리는 세우지 않았다.**
부재가 §5.4 **키 생략형**이라 응답-계약 검증자는 부재를 위반으로 보지 않는다 — 그 자리를
무는 것은 **양성 대조뿐**이다.

## 착수 전 재판정 (2026-09-10)

`origin/main` = `2ebd8a86e`(#1307).

| 잰 것 | 값 |
|---|---|
| `relations: ['workflow']` 를 단언하는 테스트 | **0건** (유일 등장은 무관한 가드의 fixture `repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`) |
| 트리거용 `withWorkflow` 헬퍼 | **없음** — 스케줄 쪽 `shared/testing/schedule-trigger-ref.ts` 만 존재 |
| `chatChannel` 을 **PATCH 바디로** 보내는 e2e | **0건** (전 e2e grep) |

델타 있음. 진행한다.

## 등재한 처방의 전제 두 개가 틀렸다 (실측)

### ① "`webhook-trigger.e2e-spec.ts` 에 건다" — **그 파일에는 걸 자리가 없다**

등재 시 그렇게 적었다. 실제로 그 파일은 **webhook 수신 경로 전용**이다 — `it()` **18개**가
202/404/401/409/410/413 과 AuthConfig 4종을 다루고, **GET 목록·GET 단건·PATCH(일반) 테스트가
아예 없다.** 유일한 PATCH(`:293`)는 410 테스트를 위해 트리거를 비활성화하는 준비 동작이다.

트리거 읽기·수정 표면은 지금 **세 파일에 흩어져 있다**:

| 표면 | 현재 위치 |
|---|---|
| GET 목록 | `schedule-trigger.e2e-spec.ts:249` (`?type=schedule`) |
| GET 단건 | `chat-channel-trigger-create.e2e-spec.ts:127` |
| PATCH (isActive) | `schedule-trigger.e2e-spec.ts:373,407` · `webhook-trigger.e2e-spec.ts:293` |
| PATCH (chatChannel 포함) | **없음** |

### ② "양성 4 + 음성 1 을 기존 파일에 얹는다" — **얹으면 세트가 안 보인다**

네 자리에 흩뿌리면 *"이 축은 네 형태로 고정된다"* 는 사실이 **어느 파일에서도 읽히지 않는다.**
자매 축(스케줄)이 성립하는 이유가 그 반대다 — `schedule-trigger.e2e-spec.ts` 안에 네 단언이
모여 있어 하나를 지우면 나머지 셋이 대조군으로 남는다.

**그래서 전용 파일을 신설한다** — `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`.
`jest-e2e.json` 이 `testRegex: ".e2e-spec.ts$"` 이므로 배선은 불필요하다(실측).

## 설계

### T-1. 헬퍼 — `shared/testing/trigger-workflow-ref.ts`

자매와 **성격이 다르다는 것**을 먼저 적어 둔다. 스케줄 쪽 `expectNarrowedScheduleTriggerRef` 는
`ScheduleDto.trigger` **참조 객체 전체의 키셋**을 등가 비교한다(그 객체가 좁혀졌는지가 관심사).
트리거 쪽은 응답이 **`TriggerDto` 전체**이므로 키셋 등가 비교가 성립하지 않는다 — 고정할 것은
`workflow` **유무**와 그 참조의 **shape** 다.

```ts
export function expectTriggerWorkflowRef(
  dto: unknown,
  opts: { present: boolean },
): void
```

- `present: true` → `dto.workflow` 가 있고 키셋이 **정확히 `['id','name']`**
  (`TriggerWorkflowRefDto`). `id` 는 UUID, 둘 다 비어 있지 않다.
- `present: false` → **키 자체가 없다.** `null` 이어도 실패시킨다 — §5.4 **키 생략형**이므로
  `null` 은 다른 표현이고, 그 구분이 이 단언의 존재 이유다.
- 양쪽 공통: 트리거 비밀 컬럼(`notificationSecretV2`·`chatChannelTokenV2`)이 `dto` 최상위에
  없음. 자매 헬퍼가 같은 목록을 갖는 이유와 같다 — 실패 메시지가 *무엇이* 샜는지 말하게 한다.

> **왜 `test/helpers/` 가 아니라 `shared/testing/` 인가** (`convention_compliance` WARNING).
> `PROJECT.md` 문면은 신규 e2e 헬퍼를 `codebase/backend/test/helpers/<name>.ts` 로 보낸다. 그 문면을
> 그대로 따르면 **T-2 self-spec 이 어느 러너에도 안 걸린다** — unit jest 는 `rootDir: 'src'` 라
> `test/` 를 스캔하지 않고, `test/jest-e2e.json` 은 `testRegex: '.e2e-spec.ts$'` 라 평범한
> `*.spec.ts` 를 안 잡는다. 즉 `test/helpers/*.spec.ts` 는 **존재하지만 영구히 돌지 않는다.**
> `src/shared/testing/**` 는 unit jest 안이라 self-spec 이 실제로 돌고(기존 4개가 그 자리에서
> 돈다), `tsconfig.build.json` 이 그 디렉터리를 **통째로** exclude 해 dist 유출도 없다.
> 이 근거를 헬퍼 docstring 에도 한 줄 남긴다 — 문서를 문면대로 따른 다음 사람이 죽은 테스트를
> 만들지 않도록.

### T-2. 헬퍼 자신의 스펙 — `shared/testing/trigger-workflow-ref.spec.ts`

자매가 이걸 갖는 이유가 실측으로 등재돼 있다 (`review/code/2026/09/06/01_13_50` W6):
**헬퍼가 무르게 바뀌면 모든 호출 자리가 동시에 조용히 통과한다.** 통과 경로만 보지 않고
실패해야 하는 경로를 각각 문다 — 여분 키 · `null` 로 온 `workflow` · shape 위반(`id` 누락,
여분 필드) · 비밀 컬럼 혼입 · `present:false` 인데 키가 있는 경우.

> **헬퍼 docstring 에 장래 명명 규칙을 못박는다** (`naming_collision` WARNING). 지금은
> `expectTriggerWorkflowRef` 와 자매 `expectNarrowedScheduleTriggerRef` 가 검증 깊이가 달라
> 혼동 여지가 낮다. 그런데 장래 스케줄 쪽 **nested** workflow shape 검증이 필요해지면 같은
> 관례로 `expectScheduleTriggerWorkflowRef` 가 되어 **접두어 하나 차이**가 된다 — 두 DTO 가
> "갈아 끼우지 말 것" 이라 경고하는 그 패턴이 함수명으로 전이된다. 그때는 `Narrowed` 를 유지해
> (`expectNarrowedScheduleTriggerWorkflowRef`) 접두어-only 충돌을 피하라고 미리 적어 둔다.

### T-3. e2e — `test/trigger-workflow-ref.e2e-spec.ts`

한 파일에 **양성 4 + 음성 1**. 각 `it()` 이 자기가 무는 경로를 이름에 적는다.

| # | 경로 | 기대 |
|---|---|---|
| 1 | `POST /api/triggers` (생성) | **음성** — `workflow` 키 없음 |
| 2 | `GET /api/triggers?type=webhook` (목록, `findAll` join) | 양성 |
| 3 | `GET /api/triggers/:id` (단건, `findById` relations) | 양성 |
| 4 | `PATCH /api/triggers/:id` — `{ name }` (일반, `findById` 로 시작) | 양성 |
| 5 | `PATCH /api/triggers/:id` — **`{ chatChannel }` 포함** | 양성 — **깨졌던 그 경로** |

**#1~#4 는 chatChannel 없는 평범한 webhook 트리거로 돈다** — 네트워크 호출 0회.
`chatChannel` 이 붙는 두 자리(생성 · #5 PATCH)만 `setupChatChannel` → provider API 를 때린다.

> **비용 추정을 실측이 낮췄다.** `cross_spec` INFO 를 받아 telegram client 의 **5초 timeout ×
> 3회 + 백오프 1s/2s** 를 근거로 호출당 최악 ~18초, #5 가 두 번이니 ~36초를 예상했다. **실측은
> #5 가 271~302ms** 이고 파일 전체가 **2초 미만**이다 — e2e 망에서 `api.telegram.org` DNS 가
> **즉시 실패**해 timeout 까지 가지 않는다. 넉넉한 타임아웃(`beforeAll` 120초 · #5 60초)은
> 그대로 둔다: CI 망에서 DNS 가 즉시 실패하지 않고 실제로 timeout 을 태울 수 있고, 그때
> **캐너리가 flaky 로 죽으면 원인을 재조회 분기가 아니라 테스트 탓으로 오진한다.** 보험 비용은 0 이다.

teardown 은 이웃 e2e 파일들의 보일러플레이트를 그대로 따른다(`afterAll` 에서 생성 트리거 삭제 +
`db.end()`). `convention_compliance` 는 ephemeral schema 가 자동 truncate 하므로 row 삭제가
불필요하다고 봤지만, **이웃 파일이 관찰상 전부 삭제하고 있어** 일관성을 택한다.

**5번이 이 작업의 존재 이유다.** 1~4 만 걸면 정확히 그때 깨졌던 경로를 안 무는 캐너리가 된다.
5번은 `if (chatChannel)` 재조회 분기를 실제로 통과해야 하므로, telegram chatChannel 을 가진
webhook 트리거를 만든 뒤 `chatChannel.uiMapping` 을 PATCH 한다 —
`chat-channel-trigger-create.e2e-spec.ts` 가 같은 생성 경로를 e2e 환경에서 이미 성공시키고 있어
외부 호출 배선이 필요 없다(그 파일의 telegram 케이스 참조).

### 구현 중 실측으로 갈린 것 — chatChannel PATCH 는 `botToken` 을 생략할 수 없다

#5 를 처음 `chatChannel: { provider, uiMapping }` 으로 보냈더니 **400** 이었다. 진단 로그로 본문을
찍어 원인을 확정했다:

```
400 VALIDATION_ERROR
details: [{ field: 'chatChannel.botToken', message: 'botToken must be a string' }, …]
```

`ChatChannelConfigDto` 가 `botToken` 을 **필수 문자열**로 요구한다. 사전 분석에서 서비스 층의
`assertChatChannelInputSafe` 와 `setupChatChannel` 의 try 앞 검증만 훑고 **DTO 층을 안 봤다** —
"검증 세 가지 다 통과한다" 고 적었는데 네 번째 층이 있었다. 바디에 `botToken` 을 넣어 통과시켰고,
그 사실을 e2e 주석에 실측과 함께 남겼다.

> **부수 관찰 — 등재한다(단정하지 않는다).** §5.4.1/R-CC-10 은 bot token 변경을
> `POST /triggers/:id/chat-channel/rotate-bot-token` **단일 경로**로 규정하고 PATCH 의
> `botTokenRef` 를 400 으로 막는다. 그런데 PATCH 는 **plaintext `botToken` 을 필수로 받고**
> `setupChatChannel` 이 그것을 `secrets.rotate(botTokenRef, …, chatChannel.botToken ?? '')` 로
> 저장한다. 즉 PATCH 로 토큰 값을 갈 수 있어 보이는데, 그것이 24h grace 를 우회하는지 아니면
> 정책이 "ref 지정 금지" 만 뜻하는지는 **내가 판정할 수 있는 범위가 아니다.** 트래커에 질문으로
> 등재한다 — 이 캐너리의 스코프를 넓히지 않는다.

### T-4 는 이 PR 에서 빼낸다 — 자기-반증형 소정정을 쓸 수 없다

**초안은 §T-4 에서 `CLAUDE.md` §자기-반증형 소정정을 적용하려 했고, 그 조건 1 판정이 틀렸다.**
`--impl-prep` 의 **세 checker 가 독립적으로 CRITICAL** 로 올렸다
(`plan_coherence` · `rationale_continuity` · `convention_compliance`).

조건 1 은 *"대상 문장을 **developer 자신이** 그 문서에 썼다"* 다. 초안은 근거로 *"#1304,
`git blame` 으로 확인 가능"* 을 적었다. **둘 다 틀렸다:**

| 신호 | 실측 | 가리키는 역할 |
|---|---|---|
| 그 커밋(`dc77317cd`)의 diff 스코프 | `codebase/` **0건** — 순수 spec | planner |
| 그 커밋이 인용한 게이트 | **`--spec`**(`11_13_14`) = planner 의무 게이트 | planner |
| 그 작업 plan 의 `owner:` | `spec-draft-schedule-trigger-ref-nav.md` → **`owner: planner`** | planner |

**그리고 `git blame` 은 애초에 이 판별에 쓸 수 없다** — 이 저장소는 모든 역할의 커밋이 같은
git author(`worker-ants`)를 쓴다. blame 은 "언제 들어왔나" 만 말하고 **"어떤 역할 턴이 썼나" 는
구분하지 못한다.** 초안이 조건 1 의 검증 방법으로 든 것이 **구조적으로 성립하지 않는 방법**이었다.

> **같은 세션이 이 패턴을 이미 올바르게 처리했다.** `#1292` 커밋 본문 — *"자기-반증형 소정정
> 예외는 쓸 수 없다 … 그 문장은 planner 턴이 등재한 것이라 조건 1이 깨진다. 우회하지 않고
> planner 턴을 열었다."* 맞게 한 판단을 몇 시간 뒤 뒤집었다.
>
> **더 나쁜 것은 등재 문장 자체가 자기모순이었다** — 트래커에 *"자기-반증형 소정정 조건 1~5
> **해당** — 그 문장은 **planner 가 썼으므로** planner 턴이거나…"* 라고 한 문장에 양쪽을 같이
> 적었고, 오늘 그중 **틀린 절반을 골랐다.** 등재할 때 조항 해당 여부를 단정한 것이 원인이다.

**처분 — 두 PR 로 가른다.** `CLAUDE.md` 의 일반 규칙("구현 중 spec 변경 필요 시 developer 는
멈추고 project-planner 위임")을 따른다.

| | 이 PR (developer) | 후속 planner 턴 |
|---|---|---|
| 내용 | T-1 헬퍼 · T-2 헬퍼 스펙 · T-3 e2e 5건 | ① §3 문장 정정(취소선 + 실측) ② `code:` 에 새 e2e 등재 ③ `PROJECT.md` 헬퍼 위치 규칙 한 줄 |
| `spec_impact` | **`none`** | `spec/2-navigation/2-trigger-list.md` |
| 게이트 | `--impl-prep`(완료) → `/ai-review` + `--impl-done` | `--spec` |

**부수 효과가 오히려 낫다** — `code:` 등재는 원래 소정정 범위 밖이라 따로 등재할 예정이었는데,
이제 **세 spec/문서 편집이 한 planner 턴에 묶인다.** 그 셋을 아래 「후속으로 넘기는 것」에 적었다.

> `rationale_continuity` 가 조건 1 이 해소된 뒤에도 남는 문제를 하나 더 짚었다 — **조건 2 도
> 애매하다.** 그 문장이 속한 문단은 §5.4 부재-표현 판정 근거와 `id`/`name` 비대칭 **계약 설명**과
> 한 문단에 섞여 있어, "문장만 떼면 예고, 문단으로 보면 계약" 이다. planner 턴이 그 경계를
> 판정해 한 줄로 기록할 것.

## 후속으로 넘기는 것 (planner 턴 1개로 묶임)

1. **§3 문장 정정.** 현재 문언: *"자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다 — 그쪽은
   네 응답 형태를 양성/음성으로 고정한다. 보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께
   적는다."* 캐너리가 서면 **비대칭 자체가 없어지므로 뒤 근거절까지 한 단위로** 낡는다.
   `3-schedule.md §4` 에 있는 **재검토 신호**(optimistic update 로 create 응답을 소비하기
   시작하면 전제가 무너진다) 한 줄도 트리거 축에 없으니 그때 같이 맞춘다(`rationale_continuity` INFO).
2. **`code:` 에 새 e2e 등재.** `3-schedule.md` 가 세운 선례 — *"註에 'e2e 가 고정한다' 고 적으면서
   그 파일을 등재하지 않으면 보장의 근거가 추적 불가다"*. `2-trigger-list.md` 에는 아직 없다
   (`naming_collision` INFO).
3. **`PROJECT.md` §e2e 파일 위치 규칙 한 줄.** 지금 문면은 신규 e2e 헬퍼를 `test/helpers/` 로
   보내는데, **self-spec 을 동반하면 그 자리는 죽은 테스트가 된다** — 아래 T-1 각주 참조
   (`convention_compliance` WARNING).

## 완료의 기계적 증거

`triggers.service.ts` 의 `relations: ['workflow']` 를 지운 뮤턴트에서 **T-3 #5 가 RED** 여야
한다. **오늘은 GREEN 이다** — 그것이 이 항목의 전제 증명이다.

| 측정 | 예측 | 실측 |
|---|---|---|
| 뮤턴트 전, T-3 전체 | GREEN | **5/5 GREEN** |
| **뮤턴트 후, T-3 #5** | **RED** | **RED** — `Object.hasOwn(record,'workflow')` 가 `false` (헬퍼 84행, spec 192행에서 호출) |
| 뮤턴트 후, T-3 #1~#4 | GREEN (그 경로는 재조회를 타지 않는다) | **4 passed** |
| 원복 후 재실행 | GREEN | **5/5 GREEN** |

**세 번째 줄이 판별 증거다** — 넷이 같이 RED 면 캐너리가 다른 것을 물고 있다는 뜻이다.
뮤턴트는 `chatChannel` 재조회에서 `relations: ['workflow']` 만 지웠고(W4 가 고친 바로 그 자리),
`backend-e2e` 가 baked 이미지라 뮤턴트마다 `make e2e-up` 으로 재빌드했다. 원복은 `cp` + 절대경로.

**전체 backend e2e 도 돌렸다** — `52 suites / 305 tests` 전부 통과(기존 51 + 신규 1).
두 타입체크 ratchet 도 baseline 일치(backend 197건/36파일 · frontend 52건/15파일).

세 번째 줄이 중요하다 — #5 만 RED 여야 캐너리가 **그 분기**를 무는 것이 증명된다. 넷이 같이
RED 면 다른 것을 물고 있다는 뜻이다. 뮤테이션 원복은 `cp` + 절대경로로 한다(`git checkout` 금지).

## 무엇을 하지 않나

- **기존 세 e2e 파일의 트리거 단언을 옮기거나 통합하지 않는다.** 그 파일들의 관심사는 각각
  webhook 수신·스케줄 동기화·chat-channel 생성이고, `workflow` 참조는 그 관심사가 아니다.
- **스케줄 쪽 헬퍼를 일반화해 공유하지 않는다.** 두 단언은 성격이 다르다(위 T-1) — 억지로
  합치면 한쪽 계약이 다른 쪽 형태로 끌려간다. 이 저장소가 `User` 투영 상수에서 같은 판단을
  내린 선례가 있다(4개 shape 중 2개만 우연히 일치).
- **`chatChannel` PATCH 의 다른 축(hasBotToken·inboundSigningRef 최신성)은 이 파일에서 안 본다.**
  그건 재조회의 *원래* 목적이고 별 관심사다. 이 캐너리는 `workflow` 한 축만 문다.

---

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/10/13_48_39` (5/5).
      **Critical 3건(동일 사안: 자기-반증형 소정정 조건 1 오판정)** → T-4 를 이 PR 에서 빼내
      planner 후속으로 분리해 해소. Warning 2 · INFO 다수 반영
- [x] T-1 헬퍼 + T-2 헬퍼 스펙 — self-spec **8 테스트** 통과. 헬퍼의 `null`-vs-부재 가드를
      무르게 하는 뮤턴트에서 **그 한 테스트만 RED**(예측 RED = 실측 RED)
- [x] T-3 e2e 5건 — 생성 음성은 **두 서브경로**(평범한 생성 · chatChannel 생성)를 각각 문다.
      `cross_spec` 이 후자를 짚어 하나 늘렸다
- [x] **뮤턴트 실측 채움** — `relations` 제거 시 **#5 만 RED**, #1~#4 GREEN, 원복 후 5/5 GREEN
- [x] ~~T-4 `2-trigger-list.md §3` 문장 정정~~ → **planner 후속으로 이관** (조건 1 불성립)
- [x] 두 타입체크 ratchet 직접 실행 — backend 197건/36파일 · frontend 52건/15파일, **baseline 일치**
- [x] 전체 backend e2e **52 suites / 305 tests 통과**. unit 전체도 454 suites / 9,517 통과
- [ ] `run-test.sh` 4단계
- [ ] `/ai-review` + `--impl-done` (상시 승인된 강제 단계). **scope 는 `codebase/` 기준** —
      `spec_impact: none` 이므로 spec 파일을 포함하는 대체 scope 조항은 적용되지 않는다
- [ ] 자매 트래커 항목 플립
