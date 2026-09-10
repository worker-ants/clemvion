---
title: "트리거 캐너리 착지 후속 — §3 註 정정 + code: 등재 + 비밀-부재 단언 인벤토리"
worktree: spec-trigger-canary-nav-4b7e21
started: 2026-09-10
owner: planner
status: applied
priority: P2
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/3-schedule.md
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/secret-store.md
---

# 트리거 캐너리 착지 후속 (planner 턴)

출처: `spec-draft-nullable-notation-followups.md` 의 「planner: 캐너리 착지 후속 5건」.
`#1308` 이 머지되면서 `spec/` 쪽에 남은 것들이다.

## 착수 전 재판정 (`origin/main` = `5b458b1ec`)

| # | 대상 | 현재 상태 | 델타 |
|---|---|---|---|
| 1 | `2-trigger-list.md §3` 註 | *"이 축에는 캐너리가 아직 없다"* 가 **그대로 있다**(`:182`) | 있음 |
| 2 | `2-trigger-list.md` `code:` | 신규 e2e·헬퍼 **미등재** | 있음 |
| 3 | `PROJECT.md` §e2e 파일 위치 | `신규 헬퍼: …test/helpers/<name>.ts` 그대로(`:315`) | 있음 — **단 이 턴 밖**(아래) |
| 4 | `2-trigger-list.md §3` 註 | 계약/구현 구분 문장 **없음** | 있음 |
| 5 | `14-external-interaction-api.md §7.1` | 단언 자리를 `schedule-trigger-ref.ts` **하나만** 열거(`:935`) | 있음 |

다섯 다 살아 있다. 병렬 세션이 먼저 처리한 것은 없다.

## 3번은 이 턴에서 못 한다 — **`PROJECT.md` 는 developer 소유다**

트래커가 3번을 planner 항목으로 등재했는데 **그 배정이 틀렸다.** 두 SKILL 의 경로 표를 실측했다:

| 문서 | `PROJECT.md` 권한 |
|---|---|
| `.claude/skills/developer/SKILL.md:33` | `\| README.md, PROJECT.md \| Read/Write \|` — **명시적으로 developer** |
| `.claude/skills/project-planner/SKILL.md` 경로 표 | **항목 자체가 없다.** planner 거버넌스 범위는 `.claude/docs/**` · `.claude/skills/**/SKILL.md` · `CLAUDE.md` 뿐 |

`CLAUDE.md §Skill 체계` 도 같은 방향이다. **`--spec` 게이트의 세 checker(`convention_compliance` ·
`plan_coherence` · `rationale_continuity`)가 각각 독립으로 이 재배정이 옳다고 확인했다** —
`rationale_continuity` 는 `git log --follow` 로 §3 문장의 도입 커밋(`dc77317cd`)이 planner 턴임까지
재확인했다.

**등재 근거였던 reviewer 문장도 틀렸다.** `--impl-done` `15_23_41` 의 `convention_compliance` 가
*"`PROJECT.md` 갱신은 planner 턴 권고"* 라 적었고 내가 그것을 **실측 없이 트래커로 옮겼다.**

> **`#1308` 의 T-4 와 같은 클래스이고 방향만 반대다.** 그때는 planner 가 쓴 문장을 developer 턴에서
> 고치려 했고, 이번엔 developer 소유 문서를 planner 턴에 배정했다. 공통 원인은 **역할 배정을 실측
> 없이 단정한 것**이다 — 트래커에 *"등재할 때 조항 해당 여부를 단정하지 말 것"* 이라 적어 두고 같은
> 세션에서 또 어겼다. **차이는 쓰기 전에 잡았다는 것뿐이다.**

**처분**: 3번을 **트래커에 신규 developer 항목으로 등재**하고 원 항목을 "4건 planner 적용 + 1건
developer 분리" 로 갱신한다 — `plan_coherence` W1 이 지적한 대로, draft 에 *"분리한다"* 만 쓰고
등재하지 않으면 원 항목이 체크되는 순간 3번이 **추적 불가로 소실**된다(이 저장소가 겪은 형태다).

## 조건 2 경계 판정 (`rationale_continuity` 가 `#1308` 에서 남긴 숙제)

**판정: 그 문장만 떼면 예고가 맞다 — 조건 2 는 충족했고, 깨진 것은 조건 1 뿐이다.**

근거: *"이 축에는 캐너리가 아직 없다"* 는 **테스트 커버리지의 현재 상태 진술**이고 제품 정의·
요구사항·API 계약 중 어느 것도 아니다. 같은 blockquote 의 다른 두 문단(§5.4 판정 근거 · `id`/`name`
비대칭)은 계약이지만, **문단이 섞여 있다는 사실이 조건 2 를 무효화하지 않는다** — 그 혼재를 다루는
조항은 조건 **4**("정정은 그 문장에 국한된다")다. 조건 2 는 *문장의 성격*을, 조건 4 는 *정정의
범위*를 묻는다. 둘을 합쳐 "애매하다" 로 두면 다음 사람이 조건 2 를 커버리지 진술에까지 넓게
해석한다. (`rationale_continuity` 가 조항 문면과 정합함을 확인했다. 이번 턴에는 적용 대상이 없는
정리이지만 — 정규 planner 편집이므로 — 선례로 남긴다.)

## 변경안

### A. `2-trigger-list.md §3` 註 — 캐너리 착지 반영 + 계약/구현 구분 (1번 + 4번)

**옛 문단을 취소선으로 남기지 않고 교체한다. 근거를 처음 틀리게 적었으므로 여기 정정한다.**

초안은 *"취소선 보존은 자기-반증형 소정정 조건 4 의 요구이고 이 턴은 그 예외가 아니니 안 쓴다"* 고
적었다. **틀렸다** — `CLAUDE.md` 는 *"그 예외를 쓸 때는 취소선을 쓴다"* 만 규정하고 *"그 예외가
아니면 취소선을 못 쓴다"* 는 규정하지 않는다. 반례가 **같은 문서 안에** 있다: **R-2** 가
`ee96a90de`(`#1299`, `codebase/` 0줄의 **순수 planner 턴**)에서 취소선으로 보존됐고, 그 커밋이 적은
사유는 자기-반증형 소정정과 무관하다 — *"`R-CC-10` 이 이 절을 대조군으로 인용한다. 그 대조는 자원
성격의 대조라 설계가 폐기돼도 유효하다."*

**즉 이 저장소의 실제 판정축은 「다른 문서가 옛 텍스트를 대조군·참조로 인용하는가」다.** 그 축으로
실측했다 — `grep -rn "캐너리가 아직 없다\|비대칭을 함께 적는다" spec/ plan/` 결과 **출처 자신뿐**이고,
§3 을 가리키는 인용 4곳(`3-schedule.md:161` · `3-error-handling.md:234,238` · `15-chat-channel.md:380`)
은 모두 §3 전체나 PATCH 설명을 가리키며 **이 문장을 대조군으로 쓰지 않는다.** 교차문서 의존이 없으니
교체 + 이력 Rationale 이관이 맞다. (`convention_compliance` W1 이 근거의 오류를 잡았다. 결론은
그대로 유효하다고 판정받았다.)

종전:

> 구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았지만, **자매 스케줄 축과 달리 이 축에는
> 캐너리가 아직 없다** — 그쪽은 네 응답 형태를 양성/음성으로 고정한다(`3-schedule.md §4`).
> 보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다.

변경 후 — 뒤 근거절까지 **한 단위로** 교체하고, 계약/구현 구분을 새 문단으로 둔다:

> 구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았고, **이제 e2e 가 네 반환 경로를 다섯
> 케이스(양성 4 + 생성 음성 1)로 고정한다** — PATCH 만 일반/chatChannel 두 케이스이며, 후자가
> 정확히 그때 깨졌던 분기다.
>
> **단 캐너리가 고정하는 것은 계약이 아니라 현재 구현이다** ([R-17](#r-17-이-축의-캐너리가-고정하는-것은-구현이지-계약이-아니다)).
> §5.4 는 이 필드를 키 생략형으로 선언하라고 요구할 뿐 *"어느 경로에서 생략되는가"* 는 규정하지
> 않는다 — 생성 응답도 `workflow` 를 싣도록 강화하는 것은 계약 위반이 아니라 additive 개선이다.
> 그런데 지금 캐너리의 음성 케이스가 그 강화를 RED 로 막는다. **의도된 프로세스 게이트**이지만
> (이 문장을 함께 고치지 않고는 동작을 못 바꾼다) 계약으로 읽지 말 것.

### B. `2-trigger-list.md` frontmatter `code:` (2번)

```yaml
  # 응답 형태 시행 — §3 註가 주장하는 `TriggerDto.workflow` 의 다섯 케이스를 고정한다.
  # 註에 "e2e 가 고정한다" 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가다.
  - codebase/backend/test/trigger-workflow-ref.e2e-spec.ts
  # 헬퍼도 등재 — 단언의 정본(키셋 `['id','name']` · 비밀 컬럼 목록)이 헬퍼에 있어 e2e 만 넣으면
  # 그 정본이 `code:` 밖에 남는다. glob 이 self-spec(`.spec.ts`)까지 무는 것은 의도다 —
  # 같은 문서의 `endpoint-path-conflict-wrap*.ts` 가 정본+테스트를 함께 무는 선례와 같다.
  - codebase/backend/src/shared/testing/trigger-workflow-ref*.ts
```

### C. `3-schedule.md` frontmatter `code:` — **범위 확장, 사유를 적는다**

B 의 근거("단언의 정본이 헬퍼에 있다")는 **축과 무관한 일반 규칙**이다. 스케줄 축도 똑같이
`schedule-trigger.e2e-spec.ts:12` 가 `shared/testing/schedule-trigger-ref.ts` 를 import 하는데
`code:` 에는 e2e 만 있다. 트리거 축에만 헬퍼를 넣으면 **두 문서 사이에 새 비대칭이 생긴다** —
하필 §3 註가 원래 비대칭을 정직하게 적으려던 자리라 앞뒤가 안 맞는다.

```yaml
  # 헬퍼도 등재 — 위 e2e 가 쓰는 단언의 정본이 여기 있다(트리거 축과 같은 규칙).
  # glob 이 self-spec 까지 무는 것도 같은 이유로 의도다.
  - codebase/backend/src/shared/testing/schedule-trigger-ref*.ts
```

> **트래커 항목이 요구한 범위를 넘는다.** 항목은 트리거 축만 적었다. 넘긴 이유는 위 한 문단이고,
> 넘기지 않으면 이 PR 이 스스로 만든 비대칭을 다음 턴이 다시 처리해야 한다.
> `cross_spec` 이 이 확장을 *"기존 `code:` 관례 및 §5.4 자체 원칙과 부합"* 으로 확인했다.

### D. `14-external-interaction-api.md §7.1` 인벤토리 (5번)

종전(`:934-936`)은 단언 자리를 **하나만** 열거한다. 모순은 아니지만 — 그 문단이 *"런타임 캐너리는
없다"* 고 단언한 적은 없다 — **열거가 불완전하면 다음 사람이 직접 축엔 정적 스트립만 있다고 읽는다.**

**원 정정 문단의 헤딩을 건드리지 않고 중첩 블록쿼트로 보강한다.** 초안은
`정정 (2026-09-08 · 2026-09-10 보강)` 으로 두 날짜를 한 괄호에 합쳤는데, 그 표기는 `spec/` 전체에
**선례 0건**이고 이 저장소는 "원 날짜 문단 + 별도 후속 날짜 문단" 패턴을 쓴다(`convention_compliance`
INFO). `#1307` 의 §10.4 갱신도 그 패턴이었다.

> **정정 (2026-09-08)**: *(원문 그대로 유지)*
>
> > **(2026-09-10 보강)** — 단언 자리는 이제 **둘**이다. 스케줄 조인 축은
> > `shared/testing/schedule-trigger-ref.ts`, **트리거 직접 축은
> > `shared/testing/trigger-workflow-ref.ts`**(`#1308`). 두 헬퍼가 같은 컬럼 목록을 각각 단언한다.

### E. `spec/conventions/secret-store.md §1` — **같은 문장의 쌍둥이** (`cross_spec` W1)

`cross_spec` 이 찾았다: EIA §7.1 의 종전 문장과 **문구가 사실상 같은 사본**이 `secret-store.md §1`
3번 항목 blockquote(`:69-72`)에 있고, 거기도 `schedule-trigger-ref.ts` 하나만 열거한다. 실측으로
확인했다 — `grep -rn "schedule-trigger-ref.ts" spec/` 결과가 정확히 이 두 자리다.

**D 만 하고 E 를 빼면 내 문제의식("불완전한 열거는 오독을 만든다")이 고쳐지지 않은 쪽에 그대로
남는다.** C 에서 내린 판단과 같은 형태(축과 무관한 일반 근거를 한 자리에만 적용)라 같은 처분을 한다.
D 와 같은 중첩 블록쿼트 형식으로 보강한다.

### F. `2-trigger-list.md` 신설 Rationale — **단일 항목 `### R-17.`**

`convention_compliance` W2: 이 문서의 Rationale 16개가 **예외 없이** `### R-N. <제목>` 이다. 아래
세 갈래를 별 `###` 로 쓰면 그 문서에서 유일하게 번호 없는 헤딩이 된다. **R-2 의 로컬 관례(하나의
`### R-N.` 아래 여러 단락으로 "왜"·"기각한 대안"까지)를 따라 한 항목으로 통합한다.**

`### R-17. 이 축의 캐너리가 고정하는 것은 구현이지 계약이 아니다` — 담을 것:

1. **판정**: §5.4 는 키 생략형 *선언*을 요구할 뿐 경로별 분포를 규정하지 않는다. 따라서 "생성
   응답에만 부재" 는 계약이 아니라 현재 구현의 반영이고, 생성 응답도 채우는 것은 additive 개선이다.
2. **왜 그래도 캐너리를 그대로 두는가 — 기각한 대안**: *"계약이 아니라면 음성 케이스를 빼면 되지
   않나"* 는 성립하지 않는다. **A 를 지우면 「부재는 생성 응답에만 있다」는 경계 주장 자체가
   무근거로 남는다** — 양성 4건은 *"채워진다"* 만 말하고 *"어디서는 안 채워진다"* 는 말하지 않는다.
   즉 문제는 캐너리가 아니라 **spec 이 그 사실을 계약처럼 읽히게 두는 것**이고, 그래서 처방이
   spec 문장이다.
3. **재검토 신호**: 생성 응답에도 `workflow` 가 필요해지는 구체적 계기(optimistic update 로 create
   응답을 그대로 화면에 쓰기 시작하면 `workflow.name` 이 필요해진다)와, 그때 *"테스트가 막으니 못
   한다"* 가 아니라 *"§3 註를 함께 고치면 된다"* 가 맞는 판단이라는 것. 자매 축은 이 신호를 이미
   갖고 있다(`spec/2-navigation/3-schedule.md §4`) — 상호 참조를 양쪽에 한 줄씩 둔다
   (`rationale_continuity` INFO: 같은 논지의 쌍둥이가 한쪽은 본문, 한쪽은 Rationale 에 있다).

## Rationale (이 draft 의 결정 근거)

### `--spec` 게이트가 잡은 것 — Warning 6건이 전부 내 근거 문장이었다

Critical 0(BLOCK: NO). 그런데 다섯 checker 가 낸 Warning 6건 중 **여섯 건 다 편집 내용이 아니라
내가 쓴 근거·수치**였다. spec 에 쓰기 전이라 수정 비용이 0 이다.

| checker | 지적 | 처분 |
|---|---|---|
| `convention_compliance` W1 | *"취소선은 자기-반증형 소정정 전용"* 일반화가 **같은 문서 R-2**(순수 planner 턴)에 반증됨. 실제 판정축은 **교차문서 인용 의존** | A 의 근거를 실측으로 교체. 결론은 유지 |
| `convention_compliance` W2 | 자유 서술형 `###` 세 개가 그 문서의 `### R-N.` 관례를 깬다 | F — 단일 `R-17` 항목으로 통합 |
| `convention_compliance` INFO | `정정 (날짜 · 날짜)` 합침 표기가 선례 0건 | D·E — 중첩 블록쿼트로 |
| `cross_spec` W1 | 같은 문장의 **쌍둥이**가 `secret-store.md §1` 에 있다 | E 신설 |
| `rationale_continuity` W1 | *"양성 4건 … **셋 다** 있어야 다섯 형태"* — 4+1=5 인데 셋이라 썼다 | 문장 재작성(F-2) |
| `rationale_continuity` W2 | **W4 를 잘못 귀속했다** — A 를 지워도 W4 는 case E 가 잡는다 | F-2 를 정확한 사유로 교체 |
| `plan_coherence` W1 | 분리한 3번이 **등재되지 않았다** | 트래커 신규 항목 + 원 항목 갱신 |
| `naming_collision` W1 | 신설 `R-17` 이 EIA 의 `R17`(하이픈 없음, 20문서 인용)과 근접 | 아래 |

### `R-17` 을 접두어로 바꾸지 않는 이유

`naming_collision` 이 근접 충돌을 지적했다 — EIA 의 `R17` 은 응답/emit 마스킹 SoT 로 **20개 문서가
인용**하고, 하이픈 하나가 grep 결과를 완전히 가른다. 그래도 `R-TL-17` 류 접두어는 **안 쓴다**:
그 문서 자신의 R-1~R-16 시퀀스를 깨서 내부 일관성이 더 나빠진다. checker 가 측정한 완화 근거도
충분하다 — `2-trigger-list.md` Rationale 을 외부에서 인용하는 곳은 **1건**(`15-chat-channel.md` 의
R-2 인용)이고 그것도 **파일 경로를 동반**한다. 이 저장소의 인용 관례가 이미 방어한다.
**단 커밋·plan 에서 "R-17" 을 적을 때 하이픈 누락에 주의한다** — 같은 시기 EIA §R17 논의가 활발하다.

### 후속으로 넘기는 것

- **`secret-store.md` `code:` 에 두 헬퍼를 등재해야 하는가** (`cross_spec` INFO 에서 갈라 나온 질문).
  §5.4 의 원칙은 *"검증자가 **서로 다른 두 문서의 규칙**을 시행하면 그 두 문서 모두에 등재"* 이고
  사유는 *"한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다"* 다. 두 헬퍼가 시행하는
  규칙은 (i) `2-trigger-list.md`/`3-schedule.md` 의 참조 shape 와 (ii) **`secret-store.md §1.1`** 의
  비밀 미노출인데, **(ii) 쪽 문서에는 등재가 없다.** 선례는 `user-secret-absence.ts` 축이다 —
  그쪽이 `1-data-model.md §2.1.1` 을 규범 소유자로 인용하는데 그 문서 `code:` 에 등재돼 있는지
  실측해 판정해야 한다. **이번 턴에서 추측으로 넣지 않는다.**
  > EIA `code:` 등재는 이 질문에 포함하지 않는다 — EIA §7.1 은 그 규칙의 **소유자가 아니라 인용자**다
  > (그 문단 자신이 *"금지 규범은 `secret-store.md §1.1` 이 그대로 소유한다"* 고 적는다).
- **bot-token DTO 분리 PR 이 §3 註를 재확인할 것** (`plan_coherence` INFO). 그 처방이 case E 의
  요청 바디를 바꾸는데, 새로 쓰는 §3 註의 "다섯 케이스" 구조 자체는 무효화되지 않는다 — 그래도
  그 PR 체크리스트에 문구 재확인을 남긴다.

---

## 체크리스트

- [x] 착수 전 재판정 — 5건 전부 델타 있음 확인(`origin/main` = `5b458b1ec`)
- [x] **역할 재판정** — 3번(`PROJECT.md`)은 developer 소유. 두 SKILL 경로 표 실측,
      `--spec` 세 checker 가 독립 확인
- [x] `/consistency-check --spec` — `review/consistency/2026/09/10/19_35_47`, **BLOCK: NO**
      (Critical 0 · Warning 7). **Warning 이 전부 편집 내용이 아니라 내가 쓴 근거**여서
      spec 쓰기 전에 8항목 전부 반영했다
- [x] A — §3 註 교체(캐너리 착지 + 계약/구현 구분). 근거를 `convention_compliance` W1 로 정정
- [x] B — `2-trigger-list.md` `code:` 에 e2e + 헬퍼 glob
- [x] C — `3-schedule.md` `code:` 에 헬퍼 glob (**범위 확장**, 사유 기록)
- [x] D — EIA §7.1 인벤토리 보강(중첩 블록쿼트, 원 정정 문단 불변)
- [x] E — `secret-store.md §1` **쌍둥이** 보강 (`cross_spec` W1 이 찾았다)
- [x] F — 신설 `R-17` 단일 항목 (`convention_compliance` W2 로 세 헤딩을 하나로 통합)
- [x] 조건 2 경계 판정 기록 — *그 문장만 떼면 예고가 맞다. 깨진 것은 조건 1 뿐이고,
      문단 혼재는 조건 4 가 다룬다*
- [x] docs 가드 — 21파일 / **3,218 tests PASS**. 가드가 잡은 2건은 둘 다 이 draft 파일의
      문제였다(YAML `title:` 안의 콜론 · plan 에서 spec 을 상대링크로 쓴 자리)
- [x] 트래커 갱신 — 원 항목을 "4건 적용 + 1건 재배정" 으로, 3번을 **신규 developer 항목**으로
      등재(`plan_coherence` W1). `secret-store.md` `code:` 질문과 bot-token PR 의 §3 註 재확인도 등재
- [x] `plan/complete/` 이동
