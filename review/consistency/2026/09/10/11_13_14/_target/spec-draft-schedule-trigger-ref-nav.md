---
title: ScheduleDto·TriggerDto 의 참조 필드 — §5.4 가 요구하는 키-생략 사유를 nav-spec 으로
worktree: spec-schedule-dto-nav-6c2f18
started: 2026-09-10
owner: planner
status: in-progress
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

두 `create` 래퍼가 **응답 바디를 통째로 버리고** 호출부가 `queryKey` 무효화로 재조회한다
(`triggers/page.tsx:262·303`). 즉 **키가 빠지는 유일한 응답(생성)은 프런트엔드가 읽지 않는
응답이다.**

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
> `#291-trigger--schedule-동기화-규칙` 이다(같은 저장소의 기존 인용 2건이 그 형태를 쓴다).
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

## 체크리스트

- [ ] `--spec` 게이트 BLOCK:NO 확인
- [ ] D-1 `3-schedule.md §4` 응답 형태 註 (2행 표 + 참조 비대칭)
- [ ] D-2 `2-trigger-list.md §3` 같은 註 (트리거 쪽)
- [ ] D-3 `2-trigger-list.md §2.1` 데이터 출처 한 절 — **그 행은 단일 물리 라인이다**(GFM 표),
      개행 없이 이어붙이고 적용 후 재측정
- [ ] 문서 가드 — 신규 앵커(`#291-trigger--schedule-동기화-규칙`·`#4-api`·`#3-api`·
      §5.4 두 앵커) 실재
- [ ] 자매 트래커 항목 플립
- [ ] `--impl-done` 발화 여부는 게이트에 물어 판정
