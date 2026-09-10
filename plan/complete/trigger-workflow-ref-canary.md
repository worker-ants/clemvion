---
title: TriggerDto.workflow 의 "생성 응답에만 부재" 를 캐너리로 고정
worktree: trigger-workflow-ref-canary-96ae33
started: 2026-09-10
owner: developer
status: complete
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
| A | `POST /api/triggers` (생성) | **음성** — `workflow` 키 없음 |
| B | `GET /api/triggers?type=webhook` (목록, `findAll` join) | 양성 |
| C | `GET /api/triggers/:id` (단건, `findById` relations) | 양성 |
| D | `PATCH /api/triggers/:id` — `{ name }` (일반, `findById` 로 시작) | 양성 |
| E | `PATCH /api/triggers/:id` — **`{ chatChannel }` 포함** | 양성 — **깨졌던 그 경로** |

**A~D 는 chatChannel 없는 평범한 webhook 트리거로 돈다** — 네트워크 호출 0회.
`chatChannel` 이 붙는 두 자리(생성 · E PATCH)만 `setupChatChannel` → provider API 를 때린다.

> **라벨은 숫자가 아니라 문자다.** 초안은 `1.`~`5.` 로 썼는데, 저장소를 실측하니 `it()` 라벨에
> `origin/main` 의 e2e 는 **20파일 / 132개 라벨**이 전부 문자(`A.`·`B-1.`)고, 숫자 라벨은 내
> 파일 하나(5개)뿐이었다(`maintainability` INFO). 문자로 맞췄다 — 이 문서의 `E` 도 그 라벨이다.
> 적용 후 재측정: **21파일 / 137 라벨 전부 문자, 숫자 0.**
>
> **처음 여기 "133개" 라고 적었다 — 틀렸다, 132개다.** 커밋 직전에 다시 세서 잡았다. 이 세션에서
> 개수를 틀린 것이 이것으로 다섯 번째다(앵커 116→96 · 헤딩 8/2→9/3 · 길이 표 2회 · Warning 2→4 ·
> 여기). **문서에 쓰는 그 시점에 실제로 세는 것**이 유일한 방어다.

> **비용 추정을 실측이 낮췄다.** `cross_spec` INFO 를 받아 telegram client 의 **5초 timeout ×
> 3회 + 백오프 1s/2s** 를 근거로 호출당 최악 ~18초, E 가 두 번이니 ~36초를 예상했다. **실측은
> E 가 271~302ms** 이고 파일 전체가 **2초 미만**이다 — e2e 망에서 `api.telegram.org` DNS 가
> **즉시 실패**해 timeout 까지 가지 않는다. 넉넉한 타임아웃(`beforeAll` 120초 · E 60초)은
> 그대로 둔다: CI 망에서 DNS 가 즉시 실패하지 않고 실제로 timeout 을 태울 수 있고, 그때
> **캐너리가 flaky 로 죽으면 원인을 재조회 분기가 아니라 테스트 탓으로 오진한다.** 보험 비용은 0 이다.

teardown 은 이웃 e2e 파일들의 보일러플레이트를 그대로 따른다(`afterAll` 에서 생성 트리거 삭제 +
`db.end()`). `convention_compliance` 는 ephemeral schema 가 자동 truncate 하므로 row 삭제가
불필요하다고 봤지만, **이웃 파일이 관찰상 전부 삭제하고 있어** 일관성을 택한다.

> **그 추론은 한 테이블을 빠뜨렸다** (`side_effect` W2, 리뷰 라운드에서 지적).
> `chatChannel` 이 붙은 트리거는 `setupChatChannel` 이 외부 호출 **이전에**
> `secrets.rotate()` 로 `secret_store` 에 row 를 쓴다 — provider 호출이 실패해도 남는다.
> 그 정리는 `TriggersService.remove()` 의 `deleteByPrefix` 만 하고 `secret_store` 는 FK 가
> 없어(application-level cascade) raw `DELETE FROM trigger` 로는 **고아 row 가 남는다.**
> 자매 `chat-channel-trigger-create.e2e-spec.ts` 도 동일하므로 이 PR 의 신규 결함은 아니고,
> 관례를 그대로 유지했다. **다만 "불필요" 판정이 `secret_store` 까지 검증한 것은 아니다** —
> 그 경계를 e2e 주석과 후속 트래커 항목에 명시했다.

**E 가 이 작업의 존재 이유다.** A~D 만 걸면 정확히 그때 깨졌던 경로를 안 무는 캐너리가 된다.
E 는 `if (chatChannel)` 재조회 분기를 실제로 통과해야 하므로, telegram chatChannel 을 가진
webhook 트리거를 만든 뒤 `chatChannel.uiMapping` 을 PATCH 한다 —
`chat-channel-trigger-create.e2e-spec.ts` 가 같은 생성 경로를 e2e 환경에서 이미 성공시키고 있어
외부 호출 배선이 필요 없다(그 파일의 telegram 케이스 참조).

### 구현 중 실측으로 갈린 것 — chatChannel PATCH 는 `botToken` 을 생략할 수 없다

E 를 처음 `chatChannel: { provider, uiMapping }` 으로 보냈더니 **400** 이었다. 진단 로그로 본문을
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
4. **캐너리가 무는 것이 계약인지 구현인지 한 줄로 적는다** (`api_contract` W2, 리뷰 라운드에서
   추가). 캐너리는 *"생성 응답에만 `workflow` 가 없다"* 를 고정하는데, 그것은 **§5.4 가 요구하는
   계약이 아니라 현재 구현의 반영**이다 — 장래 생성 응답도 `workflow` 를 싣도록 강화하는 것은
   additive 개선이고 계약 위반이 아니다. 지금 캐너리는 그 강화를 RED 로 막는다. 그 자체는 SDD
   프로세스 게이트로 바람직하지만, **spec 이 그것을 계약처럼 읽히게 두면 안 된다** — §3 註에
   *"이 비대칭은 현재 구현의 반영이며, 바꾸려면 spec 개정이 필요하다"* 한 줄을 붙인다.

## `/ai-review` 라운드 — 내 주장 셋이 반증됐고 단언 하나가 vacuous 였다

`review/code/2026/09/10/14_34_18` (8 reviewer, router 가 6명 skip). **Critical 2건은 둘 다
이 PR 밖의 사전 존재 프로덕션 결함**이고 (`api_contract` HIGH), 이 diff 자체는 scope NONE ·
나머지 7명 LOW 다. 코드 수정 12건을 적용했다.

> **이 절의 "12건" 은 1라운드 시점 값이다.** 이후 `--impl-done` 이 1건, 2라운드가 5건을 더
> 요구해 **누적 18건**이 됐다 — 아래 두 절 참조. 처음 이 문서를 12건에서 갱신하지 않아
> `review/**` 세 문서가 13번째를 기록하는데 **1차 사료인 이 plan 만 12건에 머물러 문서 권위가
> 역전**됐고, `review/code/2026/09/10/15_52_06` documentation W2 가 그것을 잡았다.

**내가 틀린 것 — 세 개 다 "내가 쓴 근거 문장" 이었다**:

| # | 내가 쓴 문장 | 반증 |
|---|---|---|
| 1 | *"부재가 §5.4 키 생략형이라 `assertMatchesContract` 는 그 자리를 물지 못한다"* | 그 검증자는 optional-non-nullable 필드의 `null` 을 **잡는다**(`response-contract.ts` 의 `visit()`, `kind:'null'`). 참인 사실은 **"이 분기에 그 검증자를 거는 기존 호출이 0건"** 이다 — 무능이 아니라 미배선 (`requirement` W2) |
| 2 | *"`tsconfig.build.json` 이 그 디렉터리를 통째로 exclude 해 dist 유출도 없다"* | `exclude` 는 **root 파일 후보만** 거른다. exclude 되지 않은 프로덕션 파일이 이 경로를 `import` 하면 tsc 가 프로그램에 편입시켜 **`dist/` 로 emit 한다** — reviewer 가 scratch 에서 실제 `tsc --listFiles` 로 재현했다. 게다가 `@types/jest` 가 ambient 라 컴파일 에러도 안 난다 (`side_effect` W1) |
| 3 | *"`User` 투영 상수 선례"* | 문면이 일치하는 커밋 없음 — 소급 부여였다. 철회 (`maintainability` W1) |

**단언 하나는 아무도 물지 않았다** (`testing` W3). 헬퍼의 `expect(typeof ref.name).toBe('string')`
을 지워도 self-spec 이 **8/8 GREEN 을 유지**했다 — 뒤따르는 `String(ref.name).length` 검사가
`String(42)`→`"42"` 로 통과시키기 때문이다. `id` 쪽은 `isUuidShaped` 가 간접 방어하지만 `name`
에는 그런 이차 방어가 없다(**비대칭**). self-spec 에 비-문자열 케이스 4건을 추가해 대조군을 만들고,
새 단언 세 개(`name` 타입 · identity · 최상위 `null`)를 각각 지우는 뮤턴트에서 **정확히 1건씩 RED**
임을 확인했다(각 `Tests: 1 failed, 11 passed`). self-spec 은 8 → **12 테스트**.

그 밖에 반영한 것: `isUuidShaped`(정본) 로 손으로 짠 UUID 정규식 교체 — 내 최초 grep 이
`shared/`·`test/helpers/` 만 봐서 `common/utils/` 를 놓쳤다(`maintainability` W2). `it()` 라벨
숫자→문자. `expectedWorkflowId` 로 identity 고정 — shape 만 보면 **엉뚱한 relation 에서 채워진
그럴듯한 UUID+이름이 통과**한다(`testing` W1). 최상위 `null` 거부(`toBeDefined()` 는 `null` 을
안 거른다, `testing` W2). 비밀 컬럼 목록을 self-spec 에 **일부러 다시 적는다**는 것을 헤더에
명시 — 헬퍼 상수를 import 해 순회하면 목록이 줄어도 스펙이 통과해 vacuous 가 된다.

`documentation` 은 이 세션의 **`--impl-prep` SUMMARY.md 누락**을 잡았다(`--spec` 두 세션은
썼는데 이 하나만 빠뜨렸다 — 빈/부분 세션이 게이트를 거짓 통과시키는 형태다). 함께 stale
`_retry_state.json` 과 트래커의 "Warning 2"(실제 4건) 오집계도 정정했다.

## 후속 트래커에 등재한 것 (전부 이 PR 밖)

`spec-draft-nullable-notation-followups.md` 에 등재. **Critical 2건이 이 PR 을 막지 않는 이유는
둘 다 이미 배포된 프로덕션 로직이고 이 diff(테스트 3파일)가 그 코드를 건드리지 않기 때문**이다.

| 항목 | 성격 | 요지 |
|---|---|---|
| bot token PATCH 우회 | **CRITICAL** (질문 → 판정 완료) | `botTokenRef` 만 막히고 plaintext `botToken` 은 PATCH 필수 — 24h grace 백업 · 전용 audit action · `chatChannelRotatedAt` 셋을 건너뛴 채 토큰이 교체된다 |
| `ChatChannelCard` 저장 400 | **CRITICAL** (신규 버그) | 프런트가 `botToken` 을 optional 로 가정해 생략 → 서버 DTO 는 필수 → **편집-저장이 항상 400**. 서버가 응답에서 strip 하니 재전송도 불가 |
| 비밀 컬럼 3중 복사 | 하드닝 | 정본 `TRIGGER_RESPONSE_STRIP_COLUMNS` + 헬퍼 2개. 결속 없음 → repo-guard |
| schedule 타입 `workflow` 양성 커버리지 | 회귀 방어 | 저장소 전체 **0건**. 지금은 in-place mutate 라 안전하지만 spread 리팩터가 오면 두 캐너리 다 못 잡는다 |
| `production-build-devdep-guard` 사각지대 | 하드닝 | `exclude` 된 디렉터리가 `import` 로 도달 가능 — 가드가 이 형태를 못 본다 |
| e2e teardown `secret_store` 고아 row | 관례 정비 | "ephemeral schema 라 불필요" 추론이 이 테이블을 안 덮는다 |

## 2라운드가 잡은 것 — **내 수정 자체가 vacuous 했다**

`testing` 이 1라운드에서 vacuous 단언을 찾았고, 내가 그것을 고치려 넣은 `id` 비-문자열 케이스가
**그 자체로 vacuous** 했다. 헬퍼의 `expect(typeof ref.id).toBe('string')` 을 지워도 self-spec 이
**12/12 GREEN 을 유지**한다 — fixture 가 `id: 42` 라 다음 줄 `isUuidShaped(String(42))` 가 `'42'`
를 어차피 거부해 `.toThrow()` 를 만족시키기 때문이다. 즉 그 케이스는 타입 단언이 아니라 **기존
「`id` 가 UUID 가 아니면」 테스트와 같은 축**을 재검증할 뿐이었다.

reviewer 가 판별 fixture 까지 실증했다 — `{ id: { toString: () => WF_ID } }` 는 `String()` 변환이
UUID 모양이면서 `typeof` 는 문자열이 아니라, **두 가드가 이 값에서만 갈린다.** 교체 후 재측정:

| 측정 | 예측 | 실측 |
|---|---|---|
| 뮤턴트 전 | GREEN | **12/12 GREEN** |
| `typeof ref.id` 제거 | **RED 1건** | **`Tests: 1 failed, 11 passed`** — 그 케이스만 |
| 원복 후 | GREEN | **12/12 GREEN** |

**`.toThrow()` 는 "무엇이 던졌는지" 를 안 본다** — 그래서 인접 가드가 같은 입력을 다른 이유로
거부하면 대조군이 조용히 사라진다. *vacuous 를 고치려 넣은 케이스가 그 자체로 vacuous 했다.*

나머지 4건도 전부 내 산출물에 대한 지적이었다:

| # | reviewer | 지적 | 반영 |
|---|---|---|---|
| 14 | `maintainability` W1 | **고아 JSDoc.** 62줄짜리 핵심 설계 근거가 함수 선언에 안 붙어 있어(중간에 상수 2개+docstring 이 낀다) 에디터 hover 에 `@param` 10줄만 보인다. 게다가 **내 13건 수정이 정확히 그 고아 블록을 38→62줄로 키웠다.** 이 저장소가 세 번 겪은 결함 클래스다 | 파일 스코프 서술(배치 근거)은 `//` 註로, 함수 서술은 함수 docstring 으로 분리 |
| 15 | `requirement` W1 | 내가 방금 쓴 R-CC-10 경고문의 엔드포인트 경로에 **`/api/` 가 빠졌다**. spec 원문과 코드 6곳은 전부 포함 | 정정. **내 근거 문장이 부정확한 네 번째 사례** |
| 16 | `maintainability` W2 | `assertMatchesContract` 근거와 identity 근거가 헬퍼·e2e 양쪽에 있는데 **13건 수정이 두 사본을 각각 따로 확장**해 드리프트 표면을 넓혔다 | 헬퍼를 SoT 로 두고 e2e 쪽을 포인터로 축약 |
| 17 | `maintainability` W3 | 신규 4케이스가 기존 8케이스의 암묵 관례(**테스트 순서 = 가드 실행 순서**)를 두 지점에서 깼다 | 전체를 가드 순서로 재배열하고 **그 관례를 describe docstring 에 명시**했다 — 암묵을 명시로 바꾸는 것이 재발 방어다 |

`documentation` 은 **개수를 또 틀린 것**(이 세션 여섯 번째)과 **문서 권위 역전**을 잡았다 —
13번째 수정이 `review/**` 세 문서엔 있는데 1차 사료인 이 plan 엔 없었다. 둘 다 정정했다.

> **수렴 판단.** 1라운드는 **동작**(vacuous 단언 · identity 구멍 · `null` 구멍), 2라운드는
> **구조·문서**(고아 JSDoc · 중복 · 조립 순서 · 집계)다. 발견의 성격이 동작→구조→문서로
> 이동했으므로 수렴으로 본다 — "발견 0" 이 아니라 성격이 기준이다. 다만 2라운드가 **동작**
> 결함(vacuous fixture)을 하나 냈으므로 그것만은 뮤턴트로 다시 증명했다(위 표).

## 3라운드 — 규약을 세우자 그 규약 문장이 틀렸다

4명이 **NONE** 이고 2라운드 지적 셋(고아 JSDoc · 근거 중복 · 조립 순서)은 각각 실측으로 해소가
확인됐다. `scope` 는 주석·빈 줄을 제거하고 정렬해 diff 해서 **실행 코드 라인 집합이 before/after
완전 동일**함을(재배치가 재배치에만 머물렀음을) 기계적으로 증명했고, `side_effect` 는 옮긴 서술이
**문자 단위로 보존**됐음을 정규화 diff 로, `maintainability` 는 헬퍼 가드와 spec 케이스 순서의
**1:1 일치**를 한 줄씩 대조했다. `//` 註 선택도 저장소 선례(`waiting-surface-guard.spec.ts` 의 같은
배너 스타일)와 `@fileoverview` 사용 0건으로 관례에 맞는다고 확인됐다.

**그런데 셋이 걸렸고, 셋 다 내가 2라운드에 새로 쓴 문장이다.**

| # | reviewer | 내가 쓴 것 | 실측 |
|---|---|---|---|
| 19 | `documentation` W1 | 가드 실행 순서 **명시 규약** 목록(10단계) | 실제는 **11단계** — ⑤ `workflow` not-null 을 빠뜨렸다. **누락을 막으려고 신설한 목록이 그 자체로 불완전했다** |
| 20 | `testing` W1 | (같은 자리) 가드-테스트 1:1 대응 | ⑤ 는 **독립 판별이 원리적으로 불가능**하다 — 그 줄을 지운 뮤턴트에서 **12/12 GREEN 유지**. 다음 줄 `workflow ?? {}` 가 `null` 을 `{}` 로 바꾸므로 ⑥ 키셋 검사가 항상 대신 던지고, `workflow: null` 이면서 키셋을 통과하는 값은 만들 수 없다 |
| 21 | `requirement` W1 | *"고아 JSDoc 을 이 저장소가 이미 **세 번** 겪었다"* | **네 번**이다 — 그 문장이 근거로 든 `15_52_06` maintainability W1 **자체가 네 번째 사례**다. 같은 커밋이 몇 줄 아래에선 `/api/` 오기를 "네 번째" 로 맞게 세면서 이 줄만 안 고쳤다 |

**⑤ 는 지우지 않고 예외로 명시했다.** 진단 가치가 있기 때문이다 — ⑤ 가 없으면 `workflow: null`
의 실패 메시지가 *"keys [] ≠ ['id','name']"* 이 되어 **`null` 인지 `{}` 인지 말해 주지 않는다.**
이 헬퍼의 존재 이유 절반이 `null` 과 부재를 가르는 것이므로 검출력이 없어도 남기는 것이 맞고,
**그 사실과 측정을 규약 옆에 적어** 다음 사람이 재발견하지 않게 했다. 두 reviewer 가 서로 다른
경로(문서 완전성 / 뮤테이션)로 **같은 한 자리**에 도달한 것이 이 라운드의 특징이다.

> **개수를 틀린 것이 이것으로 일곱 번째다** — 앵커 116→96 · 헤딩 8/2→9/3 · 길이 표 2회 ·
> Warning 2→4 · 라벨 133→132 · INFO 3→2 · 고아 JSDoc 3→4. 일곱 번 다 원인이 같다:
> **세어 보지 않고 기억으로 적었다.** 이번 라운드 `documentation` 이 내 정량 주장 전부(누적 18 ·
> self-spec 12 · reviewer 7 · Critical 0)를 전수 재계산해 **일치**를 확인한 것과 대조된다 —
> 내가 센 것은 맞고, 안 센 것만 틀렸다.

> **여기서 멈추는 규칙을 미리 정한다.** 게이트 산술상 코드를 고치면 반드시 라운드가 하나 더
> 필요하다(리뷰 세션 디렉터리 시각이 마지막 `codebase/` 커밋보다 뒤여야 한다). 4라운드를 마지막으로
> 하고, **그 라운드가 내는 주석-수준 이하 발견은 브랜치에서 고치지 않고 후속으로 등재**한다.
> 수렴 근거: 1R **동작** → 2R **구조** → 3R **주석의 사실성**. 발견의 성격이 단조롭게 얕아졌다.

## 완료의 기계적 증거

`triggers.service.ts` 의 `relations: ['workflow']` 를 지운 뮤턴트에서 **T-3 E 가 RED** 여야
한다. **오늘은 GREEN 이다** — 그것이 이 항목의 전제 증명이다.

| 측정 | 예측 | 실측 |
|---|---|---|
| 뮤턴트 전, T-3 전체 | GREEN | **5/5 GREEN** |
| **뮤턴트 후, T-3 E** | **RED** | **RED** — 헬퍼의 `expect(Object.hasOwn(record, 'workflow')).toBe(true)` |
| 뮤턴트 후, T-3 A~D | GREEN (그 경로는 재조회를 타지 않는다) | **4 passed** |
| 원복 후 재실행 | GREEN | **5/5 GREEN** |

**세 번째 줄이 판별 증거다** — 넷이 같이 RED 면 캐너리가 다른 것을 물고 있다는 뜻이다.
뮤턴트는 `chatChannel` 재조회에서 `relations: ['workflow']` 만 지웠고(W4 가 고친 바로 그 자리),
`backend-e2e` 가 baked 이미지라 뮤턴트마다 `make e2e-up` 으로 재빌드했다. 원복은 `cp` + 절대경로.

**전체 backend e2e 도 돌렸다** — `52 suites / 305 tests` 전부 통과(기존 51 + 신규 1).
두 타입체크 ratchet 도 baseline 일치(backend 197건/36파일 · frontend 52건/15파일).

세 번째 줄이 중요하다 — E 만 RED 여야 캐너리가 **그 분기**를 무는 것이 증명된다. 넷이 같이
RED 면 다른 것을 물고 있다는 뜻이다. 뮤테이션 원복은 `cp` + 절대경로로 한다(`git checkout` 금지).

### 리뷰 라운드 뒤 **같은 실험을 다시 했다** — 헬퍼가 바뀌었으니 판별 속성도 다시 증명해야 한다

리뷰 반영으로 헬퍼에 `expectedWorkflowId`(identity) 인자와 단언 세 개를 더했다. 그러면
**위 표는 옛 헬퍼에 대한 측정**이 된다 — 그 상태로 남겨 두면 "판별한다" 는 주장이 현재
코드에 대해 미검증이다. 그래서 뮤턴트 주입 → `make e2e-up` 재빌드 → 캐너리 재실행을 다시 했다.

| 측정 | 예측 | 실측 (갱신된 헬퍼) |
|---|---|---|
| 뮤턴트 후, E | RED | **RED** — `Tests: 1 failed, 4 passed` |
| 뮤턴트 후, A~D | GREEN | **4 passed** (288ms 에 E 만 실패) |
| 원복 + 재빌드 후 | GREEN | **5/5 GREEN** |

**판별 속성은 유지된다.** 단언을 세 개 늘렸는데도 A~D 가 그 분기를 안 타는 성질은 그대로다 —
늘어난 단언이 전부 `present: true` 분기 *안쪽*이라 부재 판정에 영향을 주지 않기 때문이다.

## 무엇을 하지 않나

- **기존 세 e2e 파일의 트리거 단언을 옮기거나 통합하지 않는다.** 그 파일들의 관심사는 각각
  webhook 수신·스케줄 동기화·chat-channel 생성이고, `workflow` 참조는 그 관심사가 아니다.
- **스케줄 쪽 헬퍼를 일반화해 공유하지 않는다.** 두 단언은 성격이 다르다(위 T-1) — 억지로
  합치면 한쪽 계약이 다른 쪽 형태로 끌려간다.
  > **여기에 붙였던 선례 인용은 철회한다** (`maintainability` W1). *"이 저장소가 `User` 투영
  > 상수에서 같은 판단을 내렸다(4개 shape 중 2개만 우연히 일치)"* 라고 적었는데, reviewer 가
  > grep + `git log` 로 추적해 **문면이 일치하는 커밋을 찾지 못했다.** 근거 없는 선례를
  > 소급 부여한 것이므로 지운다 — 함수를 합치지 않는 이유는 위 두 문장(성격 차이)으로 충분하고,
  > 선례가 필요한 자리가 아니었다. **그리고 그 인용의 형태("shape 가 일부만 겹치므로")는
  > 비밀 컬럼 리스트 3중 복사에는 성립하지 않는다** — 그쪽은 완전히 동일한 2개 값이라
  > 통합이 옳고, `CREATOR_PROJECTION` 선례가 그 방향이다(후속 등재).
- **`chatChannel` PATCH 의 다른 축(hasBotToken·inboundSigningRef 최신성)은 이 파일에서 안 본다.**
  그건 재조회의 *원래* 목적이고 별 관심사다. 이 캐너리는 `workflow` 한 축만 문다.

---

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/10/13_48_39` (5/5).
      **Critical 3건(동일 사안: 자기-반증형 소정정 조건 1 오판정)** → T-4 를 이 PR 에서 빼내
      planner 후속으로 분리해 해소. Warning 2 · INFO 다수 반영
- [x] T-1 헬퍼 + T-2 헬퍼 스펙 — self-spec **12 테스트** 통과(리뷰 반영으로 8 → 12). 헬퍼의 `null`-vs-부재 가드를
      무르게 하는 뮤턴트에서 **그 한 테스트만 RED**(예측 RED = 실측 RED)
- [x] T-3 e2e 5건 — 생성 음성은 **두 서브경로**(평범한 생성 · chatChannel 생성)를 각각 문다.
      `cross_spec` 이 후자를 짚어 하나 늘렸다
- [x] **뮤턴트 실측 채움** — `relations` 제거 시 **E 만 RED**, A~D GREEN, 원복 후 5/5 GREEN.
      **리뷰 반영으로 헬퍼가 바뀐 뒤 같은 실험을 다시 했다** — 판별 속성 유지 확인
- [x] ~~T-4 `2-trigger-list.md §3` 문장 정정~~ → **planner 후속으로 이관** (조건 1 불성립)
- [x] 두 타입체크 ratchet 직접 실행 — backend 197건/36파일 · frontend 52건/15파일, **baseline 일치**
- [x] 전체 backend e2e **52 suites / 305 tests 통과**. unit 전체도 454 suites / **9,521** 통과
      (신규 self-spec 4건 반영 — 리뷰 전 9,517)
- [x] `run-test.sh` 4단계 — lint(56s) · build(163s, ratchet 2개 baseline 일치) ·
      unit(82s, 454 suites / 9,521) · e2e(235s, `tests=305` + playwright) 전부 PASS
- [x] `/ai-review` — `review/code/2026/09/10/14_34_18` (8 reviewer). scope NONE · 7명 LOW ·
      `api_contract` HIGH(Critical 2 = **둘 다 사전 존재 프로덕션 결함**, 이 diff 밖).
      코드 수정 12건 적용 후 재검증
- [x] `--impl-done` — `review/consistency/2026/09/10/15_23_41` (5/5, **BLOCK: NO**, Critical 0).
      `rationale_continuity` W1 이 **13번째 코드 수정**을 요구했다 — case E docstring 에
      R-CC-10 위반 재현 경고. 그 파일에 `R-CC-10`·`rotate-bot-token`·`우회` 가 grep **0건**
      이었다: CRITICAL 1 의 맥락이 plan 에만 있고 코드엔 없었다
- [x] **`/ai-review` 2라운드** — `review/code/2026/09/10/15_52_06` (7 reviewer, router 가 7명 skip).
      1라운드 수정을 검토한 리뷰가 없었기 때문에 게이트가 push 를 막았고, 그것이 옳았다.
      Critical 0 · scope/security/side_effect **NONE** · testing/requirement/maintainability LOW ·
      documentation MEDIUM. **코드 수정 5건 추가 → 누적 18건**
- [x] **`/ai-review` 3라운드** — `review/code/2026/09/10/16_26_57` (7 reviewer). Critical 0 ·
      **security·scope·maintainability·side_effect 4명 NONE** · testing/documentation/requirement LOW.
      2라운드 W1·W2·W3 해소를 각각 실측 재검증받았다. **코드 수정 3건 추가 → 누적 21건** —
      세 건 다 *내가 2라운드에 새로 쓴 산문의 사실 오류*다
- [x] 자매 트래커 항목 플립 — 캐너리 항목 갱신 + 후속 6건 등재
