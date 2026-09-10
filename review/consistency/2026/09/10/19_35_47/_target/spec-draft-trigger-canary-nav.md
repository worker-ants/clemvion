---
title: 트리거 캐너리 착지 후속 — §3 註 정정 + code: 등재 + EIA §7.1 인벤토리
worktree: spec-trigger-canary-nav-4b7e21
started: 2026-09-10
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/3-schedule.md
  - spec/5-system/14-external-interaction-api.md
---

# 트리거 캐너리 착지 후속 (planner 턴)

출처: `spec-draft-nullable-notation-followups.md` 의 「planner: 캐너리 착지 후속 5건」.
`#1308` 이 머지되면서 `spec/` 쪽에 남은 것들이다.

## 착수 전 재판정 (`origin/main` = `5b458b1ec`)

| # | 대상 | 현재 상태 | 델타 |
|---|---|---|---|
| 1 | `2-trigger-list.md §3` 註 | *"이 축에는 캐너리가 아직 없다"* 가 **그대로 있다**(`:182`) | 있음 |
| 2 | `2-trigger-list.md` `code:` | 신규 e2e·헬퍼 **미등재**(전 항목 확인) | 있음 |
| 3 | `PROJECT.md` §e2e 파일 위치 | `신규 헬퍼: codebase/backend/test/helpers/<name>.ts` 그대로(`:315`) | 있음 — **단 이 턴 밖**(아래) |
| 4 | `2-trigger-list.md §3` 註 | 계약/구현 구분 문장 **없음** | 있음 |
| 5 | `14-external-interaction-api.md §7.1` | 단언 자리를 `schedule-trigger-ref.ts` **하나만** 열거(`:935`) | 있음 |

다섯 다 살아 있다. 병렬 세션이 먼저 처리한 것은 없다.

## 3번은 이 턴에서 못 한다 — **`PROJECT.md` 는 developer 소유다**

트래커가 3번을 planner 항목으로 등재했는데 **그 배정이 틀렸다.** 두 SKILL 의 경로 표를 실측했다:

| 문서 | `PROJECT.md` 권한 |
|---|---|
| `.claude/skills/developer/SKILL.md:33` | `\| README.md, PROJECT.md \| Read/Write \|` — **명시적으로 developer** |
| `.claude/skills/project-planner/SKILL.md` 경로 표(`:20-26`) | **항목 자체가 없다.** planner 의 거버넌스 문서는 `.claude/docs/**` · `.claude/skills/**/SKILL.md` · `CLAUDE.md` 뿐 |

`CLAUDE.md §Skill 체계` 도 planner 의 거버넌스 범위를 그 셋으로 열거하고 `PROJECT.md` 를 넣지 않는다.

**등재 근거였던 reviewer 문장도 틀렸다.** `--impl-done` `15_23_41` 의 `convention_compliance` 가
*"`PROJECT.md` 갱신은 planner 턴 권고"* 라 적었고 내가 그것을 **실측 없이 트래커로 옮겼다.**

> **이것은 `#1308` 의 T-4 와 같은 클래스이고 방향만 반대다.** 그때는 planner 가 쓴 문장을
> developer 턴에서 고치려 했고, 이번엔 developer 소유 문서를 planner 턴에 배정했다. 공통 원인은
> **역할 배정을 실측 없이 단정한 것**이다 — 트래커에 이미 *"등재할 때 조항 해당 여부를 단정하지
> 말 것"* 이라 적어 뒀는데 같은 세션에서 그 규칙을 또 어겼다. **차이는 쓰기 전에 잡았다는 것뿐이다.**

**처분**: 3번을 developer 후속으로 분리한다. 내용은 그대로 유효하다 — 현 문면을 따르면 self-spec 이
어느 러너에도 안 걸려 죽은 테스트가 된다(unit jest `rootDir: 'src'` · e2e jest `.e2e-spec.ts$`).

## 조건 2 경계 판정 (`rationale_continuity` 요구)

`#1308` 의 `--impl-prep` 에서 `rationale_continuity` 가 남긴 숙제 — *"그 문장이 §5.4 판정 근거·
`id`/`name` 비대칭 계약과 한 문단에 섞여 있어 예고 vs 계약이 애매하다"* 를 한 줄로 판정한다.

**판정: 그 문장만 떼면 예고가 맞다 — 조건 2 는 충족했고, 깨진 것은 조건 1 뿐이다.**

근거: *"이 축에는 캐너리가 아직 없다"* 는 **테스트 커버리지의 현재 상태 진술**이고 제품 정의·
요구사항·API 계약 중 어느 것도 아니다. 같은 blockquote 의 다른 두 문단(§5.4 판정 근거 · `id`/`name`
비대칭)은 계약이지만, **문단이 섞여 있다는 사실은 조건 2 를 무효화하지 않는다** — 그 혼재를 다루는
조항은 조건 **4**("정정은 그 문장에 국한된다")다. 조건 2 는 *문장의 성격*을, 조건 4 는 *정정의
범위*를 묻는다. 둘을 합쳐서 "애매하다" 로 두면 다음 사람이 조건 2 를 커버리지 진술에까지 넓게
해석하게 된다.

## 변경안

### A. `2-trigger-list.md §3` 註 — 캐너리 착지 반영 + 계약/구현 구분 (1번 + 4번)

**옛 문단을 취소선으로 남기지 않고 교체한다.** planner SKILL §5 가 *"옛 내용을 정리해 latest 만
남김 (history 가 아님)"* 이라 규정한다. 취소선 보존은 **자기-반증형 소정정 조건 4** 의 요구인데
이 턴은 그 예외를 쓰지 않는(쓸 수 없는) 정규 planner 편집이다. 이력은 `## Rationale` 이 받는다.

종전:

> 구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았지만, **자매 스케줄 축과 달리 이 축에는
> 캐너리가 아직 없다** — 그쪽은 네 응답 형태를 양성/음성으로 고정한다(`3-schedule.md §4`).
> 보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다.

변경 후 — 뒤 근거절까지 **한 단위로** 교체하고, 그 자리에 계약/구현 구분을 새 문단으로 둔다:

> 구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았고, **이제 e2e 가 네 반환 경로를 다섯
> 케이스(양성 4 + 생성 음성 1)로 고정한다** — PATCH 만 일반/chatChannel 두 케이스이며, 후자가
> 정확히 그때 깨졌던 분기다.
>
> **단 캐너리가 고정하는 것은 계약이 아니라 현재 구현이다.** §5.4 는 이 필드를 키 생략형으로
> 선언하라고 요구할 뿐 *"어느 경로에서 생략되는가"* 는 규정하지 않는다 — 생성 응답도 `workflow` 를
> 싣도록 강화하는 것은 계약 위반이 아니라 additive 개선이다. 그런데 지금 캐너리의 음성 케이스가
> 그 강화를 RED 로 막는다. **의도된 프로세스 게이트**이지만(이 문장을 함께 고치지 않고는 동작을 못
> 바꾼다) 계약으로 읽지 말 것.

### B. `2-trigger-list.md` frontmatter `code:` (2번)

`3-schedule.md` 선례를 따르되 **헬퍼까지** 넣는다.

```yaml
  # 응답 형태 시행 — §3 註가 주장하는 `TriggerDto.workflow` 의 다섯 케이스를 고정한다.
  # 註에 "e2e 가 고정한다" 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가다.
  - codebase/backend/test/trigger-workflow-ref.e2e-spec.ts
  # 헬퍼도 등재한다 — 단언의 정본(키셋 `['id','name']` · 비밀 컬럼 목록)이 헬퍼에 있어
  # e2e 만 넣으면 그 정본이 `code:` 밖에 남는다. self-spec 이 헬퍼와 같은 glob 에 걸린다.
  - codebase/backend/src/shared/testing/trigger-workflow-ref*.ts
```

### C. `3-schedule.md` frontmatter `code:` — **범위 확장, 사유를 적는다**

B 의 근거("단언의 정본이 헬퍼에 있다")는 **축과 무관한 일반 규칙**이다. 스케줄 축도 똑같이
`schedule-trigger.e2e-spec.ts` 가 `shared/testing/schedule-trigger-ref.ts` 를 import 하는데
(`:12` 실측) `code:` 에는 e2e 만 있다. 트리거 축에만 헬퍼를 넣으면 **두 문서 사이에 새 비대칭이
생긴다** — §3 註가 원래 비대칭을 정직하게 적으려던 문서에서 그러는 것은 앞뒤가 안 맞는다.

```yaml
  # 헬퍼도 등재 — 위 e2e 가 쓰는 단언의 정본이 여기 있다(트리거 축과 같은 규칙).
  - codebase/backend/src/shared/testing/schedule-trigger-ref*.ts
```

> **트래커 항목이 요구한 범위를 넘는다.** 항목은 트리거 축만 적었다. 넘긴 이유는 위 한 문단이고,
> 넘기지 않으면 이 PR 이 스스로 만든 비대칭을 다음 턴이 다시 처리해야 한다.

### D. `14-external-interaction-api.md §7.1` 인벤토리 (5번)

종전(`:934-936`)은 단언 자리를 **하나만** 열거한다. 모순은 아니지만 — 그 문단이 *"런타임 캐너리는
없다"* 고 단언한 적은 없다 — **열거가 불완전하면 다음 사람이 직접 축엔 정적 스트립만 있다고 읽는다.**

> **정정 (2026-09-08 · 2026-09-10 보강)**: **이 컬럼은 더 이상 응답에 나가지 않는다.** `#1291` 이
> 응답 경계 스트립(`TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS`)을 세웠고, **두 축이 각각
> 같은 목록으로 부재를 단언한다** — 스케줄 조인 축은 `shared/testing/schedule-trigger-ref.ts`,
> 트리거 직접 축은 `shared/testing/trigger-workflow-ref.ts`(`#1308`). 금지 규범은 … *(이하 동일)*

## Rationale

### 왜 §3 註의 이력을 본문에 안 남기고 Rationale 로 보내나

planner SKILL §5 의 *"latest 만 남김"* 이 본문 규칙이고, `## Rationale` 이 *"결정 배경·근거·폐기된
대안"* 을 받는 자리다. `2-api-convention.md §10.4`(`#1307`)에서 같은 형태를 썼다 — 본문은 교체,
이력은 Rationale 항목에 갱신 블록쿼트로.

### 신설 `R-17` — 캐너리가 고정하는 것은 구현이지 계약이 아니다

이 구분을 註 한 줄로 끝내지 않고 Rationale 에 남기는 이유는, **다음 사람이 마주칠 상황이 구체적**
이기 때문이다: 생성 응답에도 `workflow` 를 싣고 싶어질 때(예: optimistic update 로 create 응답을
그대로 화면에 쓰기 시작하면 `workflow.name` 이 필요해진다) 캐너리 음성 케이스가 RED 가 된다.
그때 *"테스트가 막으니 못 한다"* 가 아니라 *"spec §3 註를 함께 고치면 된다"* 가 맞는 판단이고,
그 판단의 근거가 어디 있는지를 적어 두는 것이 이 항목의 목적이다.

자매 축은 이 재검토 신호를 이미 갖고 있다(`3-schedule.md §4` — optimistic update 로 create 응답을
소비하기 시작하면 전제가 무너진다). 트리거 축에 없어서 이번에 맞춘다.

### 기각한 대안 — 캐너리의 생성 음성 케이스를 지우는 것

*"계약이 아니라면 음성 단언을 빼면 되지 않나"* 는 성립하지 않는다. 그 케이스가 없으면
**「생성 응답에만 부재」가 실제로 그러한지** 아무도 안 물게 되고, 그러면 `#1308` 이 닫은 W4 회귀
(chatChannel PATCH 에서만 사라짐)가 다시 조용히 새는 자리로 돌아간다. 음성 케이스는 **양성 4건의
대조군**이라 셋 다 있어야 "이 축은 다섯 형태로 고정된다" 가 성립한다. 즉 문제는 캐너리가 아니라
**spec 이 그 사실을 계약처럼 읽히게 두는 것**이고, 그래서 처방이 spec 문장이다.
