---
title: ScheduleDto·TriggerDto 의 참조 필드 — §5.4 가 요구하는 키-생략 사유를 nav-spec 으로
worktree: spec-schedule-dto-nav-6c2f18
started: 2026-09-10
owner: planner
status: complete
priority: P3
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/3-schedule.md
---

# `ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화 (planner 턴)

`spec-draft-nullable-notation-followups.md` 단일 항목(2026-09-05 등재, `21_40_38` W1 ·
대상 확장 `22_25_00` W2).

**§5.4 의 요구는 이것이다**: *"키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, **그 필드를
문서화하는 절에 사유를 명시**한다."* 코드 쪽은 2026-09-05 에 끝났고 **남은 것은 그 사유가
spec 에 없다는 것**이다.

## 착수 전 재판정 (2026-09-10)

`origin/main` = `8a2ad2f20`(#1303).

| 잰 것 | 값 |
|---|---|
| `ScheduleDto.trigger` 선언 | **기본형** `@ApiProperty` — 항목이 적은 대로 코드는 정리됨 |
| `ScheduleTriggerRefDto.workflow` | **키 생략형** `@ApiPropertyOptional` + 사유가 JSDoc 에만 |
| `TriggerDto.workflow` | **키 생략형** + 사유가 JSDoc 에만 (자매 항목, `22_25_00` W2) |
| `3-schedule.md §4` | 응답 형태 서술 **0줄** — 표에 엔드포인트만 |
| `2-trigger-list.md §3` | `workflow` 언급 **0건** (grep) |
| `trigger` 상시 존재 주장 | **참** — `schedules.service.ts:206` `saved.trigger = savedTrigger`(무조건) · `:266` update 도 대입 |

## 사유 (b) 의 근거가 DTO 주석보다 강하다 — 실측으로 갈렸다

두 DTO 의 JSDoc 은 사유를 *"소비처가 부재를 정상 경로로 다룬다 — `?? \"\"` 로 읽는다"* 로
적는다. 그건 참이지만 **더 강한 사실이 있다**:

```
codebase/frontend/src/lib/api/triggers.ts:174    create: … Promise<void>   // 응답 바디를 버린다
codebase/frontend/src/lib/api/schedules.ts:66    create: … Promise<void>   // 〃
```

두 `create` 래퍼가 **응답 바디를 통째로 버리고** 호출부가 `queryKey` 무효화로 재조회한다 —
각 화면의 `createMutation` 이 `onSuccess` 에서 `invalidateQueries` 를 부른다
(`triggers/page.tsx` `:300`→`:303` · `schedules/page.tsx` `:571`→`:580`). 즉 **키가 빠지는
유일한 응답(생성)은 프런트엔드가 읽지 않는 응답이다.**

> 처음엔 이 자리를 `triggers/page.tsx:262·303` 으로만 인용했는데 **`:262` 는 create 가 아니라
> `isActive` toggle(=`update`) 핸들러의 invalidate** 였고, 두 래퍼를 논하면서 schedules 쪽
> 근거를 아예 안 달았다(`cross_spec` INFO). 주장은 양쪽에서 참이지만 **인용이 한 파일에
> 쏠려 있으면 다음 사람이 자매 경로를 다시 조사한다** — 이 초안이 없애려는 바로 그 비용이다.

`?? ""` 폴백은 그 다음 방어선이고(목록/상세를 읽는 자리), 진짜 근거는 *"부재하는 형태가
소비 경로에 도달하지 않는다"* 다. **spec 에는 후자를 적는다** — 전자만 적으면 다음 사람이
*"빈 문자열이 화면에 보이나?"* 를 다시 조사한다.

## 변경안

### D-1. `3-schedule.md §4` — 표 아래 응답 형태 註

§4 는 엔드포인트 표만 있고 `ScheduleDto` 의 형태를 한 줄도 적지 않는다. 표 뒤에 붙인다:

```markdown
> **응답 형태 — `ScheduleDto` 의 참조 필드.** 스케줄 응답은 연결된 트리거를 **참조 수준으로
> 좁혀** 동봉한다(엔티티 전체가 아니다 — 조인을 타고 트리거 비밀 컬럼이 새던 것을 닫은
> 결과다, [API 규약 §5.4 검증 층](../5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가)).
>
> | 필드 | 부재 표현 | 근거 |
> |---|---|---|
> | `trigger` | **상시 존재**(기본형) | `Schedule.trigger_id` 가 NOT NULL 1:1 이고([데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙)) 응답을 내는 네 경로가 전부 채운다 — `findAll`(join) · `findById`(relations) · `create`/`update`(저장 직후 대입, **`isActive` 무관**) |
> | `trigger.workflow` | **키 생략** ([§5.4](../5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략) 기준 (b)) | **생성 응답에만 없다** — `create()` 는 방금 저장한 트리거를 붙이므로 그 관계가 로드되지 않는다. 그리고 **그 응답은 프런트엔드가 읽지 않는다**: `schedulesApi.create` 가 바디를 버리고 호출부가 `schedules` queryKey 무효화로 재조회한다. 목록·상세·수정 응답에는 채워지며 e2e 가 세 형태를 각각 고정한다 |
>
> `trigger.workflow` 는 **`name` 하나만** 담는다. 트리거 응답의 자매 참조
> ([`2-trigger-list.md §3`](./2-trigger-list.md#3-api))는 `id` 도 싣는데 **의도적으로 다르다** —
> 각 참조는 그 응답의 소비처가 실제로 읽는 필드만 담는다(스케줄 화면은 이름만 표시, 트리거
> 화면은 이름에 링크를 걸 `id` 가 더 필요하다). 한쪽을 다른 쪽으로 갈아 끼우지 말 것.
```

### D-2. `2-trigger-list.md §3` — 같은 註 (트리거 쪽)

§3 표 아래에는 이미 `> PATCH … 본문은` 註가 있다. 그 인접에 응답 쪽 註를 붙인다:

```markdown
> **응답 형태 — `workflow` 참조는 키 생략형이다** ([§5.4](../5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략) 기준 (b)).
> 목록·상세·**수정**(`update()` 가 `findById` 로 시작한다) 응답에는 채워지고 **생성 응답에만
> 없다** — 그리고 그 응답은 프런트엔드가 읽지 않는다: `triggersApi.create` 가 바디를 버리고
> 호출부가 `triggers` queryKey 무효화로 재조회한다.
>
> 이 참조는 `id` 와 `name` 을 담는다 — 스케줄 응답의 자매 참조
> ([`3-schedule.md §4`](./3-schedule.md#4-api))는 `name` 하나만 담고 **의도적으로 다르다**(그쪽
> 화면은 이름만 표시한다). 한쪽을 다른 쪽으로 갈아 끼우지 말 것.
```

### D-3. `2-trigger-list.md §2.1` "연결된 워크플로우" 행에 데이터 출처 — **판단해서 넣는다**

그 행은 지금 *"→ 워크플로우 이름 형태로 표시. 클릭 시 해당 에디터로 이동"* 만 적는다.
**같은 표의 자매 행(인증/AuthConfig)은 데이터 출처를 명시한다** — *"데이터 출처: 목록 응답의
`authConfigId` (§3 GET /api/triggers) 와 …"*. 그 선례에 맞춰 한 절 덧붙인다:

```markdown
| 연결된 워크플로우 | "→ 워크플로우 이름" 형태로 표시. 클릭 시 해당 에디터로 이동. 데이터 출처: 목록 응답의 `workflow.name`([§3](#3-api) — 키 생략형이고 목록 응답에는 채워진다) |
```

**왜 넣나**: §5.4 요구는 D-1·D-2 로 충족된다. 이 행은 **UI 를 읽는 사람이 그 이름이 어디서
오는지** 알게 하는 것이고, 자매 행이 이미 그렇게 적고 있어 **비대칭을 남기지 않는 쪽**이 맞다.
한 절이라 비용도 없다.

> **앵커를 한 번 잘못 짚었다 — 기록해 둔다.** 초안은 §2.9.1 을 `#291-schedule-trigger-관계`
> 로 적었는데 실제 heading 은 `### 2.9.1 Trigger ↔ Schedule 동기화 규칙` 이라
> `#291-trigger--schedule-동기화-규칙` 이다. **기존 인용 4건**이 그 형태를 쓴다 —
> `2-trigger-list.md` 2건 · `3-schedule.md` 1건 · `5-system/12-webhook.md` 1건. 처음 이 각주에
> "2건" 이라 적었는데 `2-trigger-list.md` 안만 세고 **저장소 전수를 세지 않은** 탓이다
> (`cross_spec` INFO). 계수는 판정에 영향이 없지만, 이 앵커가 옳다는 근거의 **크기**가 두 배다
> — 정본 문서 가드가 main 에서 4곳을 통과시키고 있다는 뜻이므로.
> 겸사겸사 **NOT NULL 근거가 어느 절에 있는지도 다시 쟀다** — §2.9 표의 `trigger_id` 행은
> `FK → Trigger` 만 적고, *"NOT NULL — 반드시 Trigger와 1:1 매핑"* 은 **§2.9.1** 에 있다.
> 인용 대상이 맞았던 것은 우연이 아니라 §2.9.1 이 실제로 그 문장의 소유자여서다.

## 무엇을 하지 않나

- **`ScheduleDto`/`TriggerDto` 의 전 필드 인벤토리를 nav-spec 에 옮기지 않는다.** §5.4 가
  요구하는 것은 **키 생략 필드의 사유**뿐이고, 나머지는 OpenAPI(`/docs`)와 DTO 선언이 SoT 다.
  직전 배치(`#1303` §9.1)에서 확인한 것과 같은 규율이다 — 인벤토리를 spec 에 복제하면 drift
  소스가 하나 늘 뿐이다.
- **`1-data-model.md §2.9.1` 은 건드리지 않는다.** 항목은 *"`3-schedule.md §4`(또는
  `1-data-model.md §2.9.1`)"* 로 택일을 열어 뒀는데, 키 생략은 **wire 표현**이고 §2.9.1 은
  **DB 관계**를 기술한다. §4 가 맞고, §4 에서 §2.9.1 을 NOT NULL 근거로 인용한다.

---

## 반영 중 갈린 것 두 가지

**① §5.4 (b) 의 위계를 뒤집어 적었다 — 두 checker 가 독립적으로 같은 곳에 수렴.**
초안은 *"생성 응답을 프런트엔드가 읽지 않는다"* 를 (b) 를 **대체하는** 진짜 근거로 적고
"spec 에는 후자를 적는다" 고 했다. `rationale_continuity` 와 `convention_compliance` 가 각각
짚었다: (b) 의 판정 기준은 **"소비자가 부재를 정상 경로로 다룬다"** 이고, "안 읽는다" 는
optimistic update 도입 하나로 무너지는 **우발적** 사실이다. 그대로 박으면 다음 사람은 (b) 를
만족하는지 되짚어야 한다.

반영문은 순서를 바꿨다 — (b) 의 기준(`?? ""` 폴백을 읽는 자리)을 먼저 세우고, "안 읽는다" 를
**그 기준의 극단적 인스턴스**(읽히지 않는 응답에는 부재를 다뤄야 할 코드 경로 자체가 없다)
**+ 재검토 신호**로 강등했다. 등급은 둘 다 INFO 였지만 **두 독립 checker 의 수렴 자체**가
등급보다 강한 신호다.

**② 트리거 축에는 캐너리가 없다 — checker 가 아니라 내가 실측했다.**
註를 쓰다가 스케줄 축과 트리거 축의 고정 상태를 재봤다:

| 축 | 고정 |
|---|---|
| 스케줄 (`ScheduleTriggerRefDto.workflow`) | `schedule-trigger.e2e-spec.ts` 4건 — 상세·목록·수정 **양성** + 생성 **음성 대조** |
| 트리거 (`TriggerDto.workflow`) | **0건.** `relations: ['workflow']` 를 단언하는 테스트 없음 |

트리거 쪽 PATCH 는 chatChannel 재조회에서 관계를 빼고 읽어 **그 응답에서만** `workflow` 가
사라진 적이 있고(리뷰 `01_13_50` W4), 구현은 `relations: ['workflow']` 로 닫았지만 캐너리는
안 세웠다. 부재가 §5.4 키 생략형이라 **응답-계약 검증자도 이 자리를 물지 못한다.**
D-2 註는 그 비대칭을 **숨기지 않고 적었고**, 고정은 자매 트래커의 신규 developer 항목으로
넘겼다(뮤턴트 RED 를 완료 증거로 명시).

## 체크리스트

- [x] `--spec` 게이트 BLOCK:NO 확인 — `review/consistency/2026/09/10/11_13_14`.
      Critical 0 / Warning 0. **번들 결함을 먼저 고쳐야 했다**: 기본 예산에서 `cross_spec` 이
      `1-data-model.md` 하나만 싣고 대상 3파일을 떨궈(적재 1 / 생략 112), 예산 800,000 으로
      재생성하고 폐기 세션 `11_08_19` 은 삭제했다. 하네스 항목으로 등재
      ([`harness-review-gate-followups.md`](../in-progress/harness-review-gate-followups.md))
- [x] D-1 `3-schedule.md §4` 응답 형태 註 (2행 표 + (b) 연결 문장 + 참조 비대칭)
- [x] D-2 `2-trigger-list.md §3` 같은 註 (트리거 쪽 + 캐너리 부재 고지)
- [x] D-3 `2-trigger-list.md §2.1` 데이터 출처 — 자매 행 선례에 맞춰 **라벨 있는 링크**
      (`[§3 GET /api/triggers](#3-api)`) 사용. 단일 물리 라인 유지 확인: 52자 → **141자**
      (262바이트), 파이프 3개
- [x] **D-4 (반영 중 신설)** `3-schedule.md` frontmatter `code:` 에
      `codebase/backend/test/schedule-trigger.e2e-spec.ts` 등재 — §4 註가 *"e2e 가 고정한다"* 고
      주장하는데 그 파일이 spec-linked 가 아니었다. e2e 를 `code:` 에 싣는 선례는
      `slack.md`·`discord.md`·`15-chat-channel.md` 에 있다
- [x] 문서 가드 — 신규 앵커 **6/6 정확**. `convention_compliance` 가 정본 알고리즘
      (remark `mdast-util-from-markdown` → `github-slugger`)을 재현해 대조했다. 이 워크트리엔
      `node_modules` 가 없어 내가 직접 못 돌린 검증이라, 그쪽 실행이 유일한 정본 증거다
- [x] 자매 트래커 항목 플립 — 21 → 21 (1건 종결 + 트리거 캐너리 1건 신규, **순증 0**.
      착수 전 커밋의 같은 파일과 대조해 확인했다)
- [x] `--impl-done` 발화 여부 — 게이트에 직접 물었다. `evaluate_review()` →
      `blocked=False`, 사유 *"no codebase/ changes on this branch — allowed"*.
      `codebase/` 변경 0건이므로 `/ai-review` 와 두 타입체크 ratchet 도 이 축에 대상이 없다
