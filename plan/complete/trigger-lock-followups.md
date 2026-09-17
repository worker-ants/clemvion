---
title: trigger-config 락의 developer 범위 후속 5건 — 이름·계약·방어 심도
status: complete
owner: developer
worktree: .claude/worktrees/trigger-lock-followups-0c79a0
started: 2026-09-15
completed: 2026-09-17
spec_impact: none
---

# `#1334` 가 남긴 developer 범위 후속 — 다섯 건

`plan/complete/trigger-config-lost-update.md` 의 `### 후속(developer 범위)` 표와
트래커 `spec-draft-nullable-notation-followups.md` 의 *"`trigger-config` advisory lock 이 남긴
developer 범위 후속"* 항목을 닫는다.

**등재된 6건 중 5건만 한다.** 첫 항목(`deleteTriggerRowLocked` 헬퍼 추출)은 등재할 때
**«세 번째 호출부가 생길 때»** 라는 조건을 붙였다. 지금 하면 내가 어제 적은 조건을 스스로
어기는 것이고, 근거(인자 셋짜리 헬퍼가 복제보다 읽기 어렵다)는 그대로 유효하다.

| # | 항목 | 출처 | 성격 |
|---|---|---|---|
| 1 | `findByIdForUpdate` 개명 | `--impl-done` `01_44_29` naming_collision W4 | **이름이 거짓말한다** |
| 2 | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 «정리 3종» 일반화 | `/ai-review` `01_42_04` documentation INFO#17 | 주석이 코드보다 넓다 |
| 3 | `acquireTriggerConfigLock` 의 `timeoutMs` 검증 | 같은 세션 security·database INFO#2 | 방어 심도 |
| 4 | `rewriteTriggerConfigLocked` 의 `affected` 미확인 | 같은 세션 database INFO#19 | **계약이 코드에 없다** |
| 5 | `SchedulesService.remove()` 의 `triggerId` falsy 분기 테스트 | 같은 세션 testing INFO#16 | 커버리지 |

## 착수 전 실측 — 각 항목이 **무엇을 주장하는지** 먼저 확인한다

이 PR 의 전신(`#1334`)에서 가장 많이 틀린 것이 «내 주장이 코드보다 넓다» 였다. 그래서 각
항목마다 **고치기 전에 그 항목의 전제를 실측**하고, 그 실측을 여기 적는다.

- **①** 이 저장소에서 `*ForUpdate` 가 정말 «행 잠금» 관용구인가 — 전수로 센다.
- **②** `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 의 소비자가 정말 둘인가, 각자 무엇을 먼저 끝내는가.
- **③** `timeoutMs` 를 넘기는 호출부가 정말 **모듈 상수만** 넘기는가.
- **④** `affected === 0` 이 실제로 도달 가능한가 — 도달 불가면 «계약을 드러내는» 변경이지
  «결함 수정» 이 아니다. 그 구분을 주장에 반영한다.
- **⑤** falsy 분기가 정말 미커버인가.

### 실측 결과 (2026-09-15)

| # | 전제 | 실측 | 판정 |
|---|---|---|---|
| ① | *"`*ForUpdate` 는 이 저장소의 확립된 행-잠금 관용구"* | **식별자로서는 선례가 없다** — `[A-Za-z_]+ForUpdate` 는 저장소 전체에 `findByIdForUpdate` **하나**(3회 등장: JSDoc 언급·선언·호출)뿐이다. 반면 **SQL 관용구** `FOR UPDATE` 는 **7개 파일**에 퍼져 있다(execution-engine · webauthn · integration-oauth 등) | **부분 수정** — 충돌 상대는 «다른 식별자» 가 아니라 «같은 저장소의 SQL 관용구» 다. 개명 근거는 유지되지만(7파일이 그 연상을 만든다) 체커 문면보다 좁게 적는다 |
| ② | 소비자가 둘 | `triggers.service.ts:1028` · `schedules.service.ts:316` **정확히 둘** | 확인 |
| ③ | 호출부가 모듈 상수만 넘긴다 | 두 자리 모두 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`. **변수·사용자 입력 경로 0건** | 확인 — 현재 익스플로잇 불가는 참이다 |
| ④ | *"`affected === 0` 은 삭제 경로 둘이 같은 락을 공유해 실무적으로 닫혀 있다"* | **반증됐다 — 아래 참조** | **성격이 바뀐다**: 계약 노출이 아니라 **좁은 실결함** |
| ⑤ | `triggerId` falsy 분기 미커버 | schedules spec 의 `remove` 케이스 4건 전부 `triggerId` 를 채운다(`trig-1`·`trig-del`·`trig-halt`·`trig-2`). **falsy 0건** | 확인 |

### ④ — **Trigger 행을 지우는 경로는 둘이 아니라 셋이다**

`#1334` 의 CHANGELOG·RESOLUTION 에 *"삭제 경로 2곳이 같은 advisory lock 을 공유해 실무적으로
닫혀 있다"* 고 적었다. 전수로 다시 세니 **세 번째가 있다**:

| 경로 | 락 | 비고 |
|---|---|---|
| `TriggersService.remove()` — `m.remove(trigger)` | ✅ | 상한 5초 |
| `SchedulesService.remove()` — `m.delete(Trigger, id)` | ✅ | 상한 5초 |
| **`Workflow`·`Workspace` 삭제의 FK `onDelete: 'CASCADE'`** | ❌ | `trigger.entity.ts:39,46`. **DB 레벨이라 애초에 advisory lock 을 잡을 수 없다.** 진입점은 `workflows.service.ts:259` 의 `workflowRepository.remove(workflow)` |

그래서 `rewriteTriggerConfigLocked` 안에서:

1. 락 획득 → `findOne` (**행 잠금이 아니라 평범한 SELECT** 다)
2. 그 사이 다른 트랜잭션이 워크플로를 지우면 **FK CASCADE 가 이 행을 지우고 커밋**한다 —
   advisory lock 을 안 잡으므로 우리가 막지 못한다
3. `m.update(...)` 가 **0행**에 매치되는데 함수는 `true` 를 돌려준다

호출부는 그 `true` 를 «썼다» 로 읽는다. 예컨대 `rotateBotToken` 은 `if (!wrote)` 로 404 를
던지는데, 여기서는 던지지 않고 **성공 응답을 주면서 secret store 에는 새 토큰만 남는다**.

> **같은 클래스의 여섯 번째다.** 「전수로 셌다」는 주장이 또 좁았고, 이번엔 주어를
> «`TriggersService` 가 지우는 경로» 도 아니고 «**애플리케이션 코드가** 지우는 경로» 로
> 잡은 것이 원인이다 — DB 가 지우는 경로를 세지 않았다. 판정 질문은
> **「이 행이 사라질 수 있는 모든 방법」**이어야 했다.
>
> 그래서 ④ 는 «계약을 코드로 드러내는» 정리가 아니라 **좁은 실결함 수정**이고, 이 PR 의
> 성격도 «후속 정리 5건» 에서 **«실결함 1 + 정리 4»** 로 바뀐다. `#1334` 의 그 문장도
> 이 PR 에서 정정한다(CHANGELOG 는 루트라 자유, `codebase/**` JSDoc 은 ② 와 함께).

## `--impl-prep` 처분 (`review/consistency/2026/09/15/08_58_18` — **BLOCK: NO** · W4)

| # | 처분 |
|---|---|
| W1 `11-workflow.md §3.1` CASCADE 열거에 `trigger` 누락 | **planner 등재** — 내가 원저작자가 아니라 자기-반증형 소정정 조건 1 을 못 넘는다. 트래커 planner 항목에 `5b` 로 추가했다. **이 문서 갭이 위 ④ 결함의 근거이기도 하다** — 상류 CASCADE 가 어디에도 안 적혀 있으니 아무도 그 경로를 세지 않았다 |
| W2 `trigger-config-lock.ts`·`schedules.service.ts` 가 어느 `code:` glob 에도 없다 | **기등재 항목과 동일**(트래커 planner 항목 1, R-CC-22 네 번째 재발). 이 PR 은 `triggers.service.ts`(spec-linked)도 만지므로 `--impl-done` 번들이 0건이 되지는 않는다 — 그래도 **0건이면 BYPASS + 근거 기록**을 체크리스트에 박아 둔다 |
| W3 **반증된 문장이 살아 있는 트래커에 남아 있다** | **수용·수정** — 지적이 정확하다. 내 정정 대상 목록에 CHANGELOG 와 `codebase/**` JSDoc 만 적고 트래커를 빠뜨렸다. 취소선으로 원문을 남기고 실측을 덧붙였다 |
| W4 대체 식별자에 `Lock` 계열 어휘를 쓰면 원 결함이 재발한다 | **수용** — 아래 §명명 결정 |
| INFO#10 새 실패 분기는 `throwTriggerNotFound()` 재사용, 인라인 리터럴 금지 | **수용** — ④ 구현 제약으로 채택 |
| INFO#3 `#1334` CHANGELOG 정정을 ④ 커밋에 동반 | **수용** |

### 명명 결정 — `findByIdForPatchValidation`

체커는 `findByIdForPatchPrecheck` 를 제안했다. **후보 토큰을 먼저 세니 그쪽이 다른 계열과
충돌한다**:

| 후보 | 식별자 충돌 | 어휘 계열 |
|---|---|---|
| `findByIdForPatchPrecheck` | 0건 | ❌ `Precheck` 은 이 저장소에서 **Cafe24/MakeShop mall-id 사전검증 전용** 어휘다 — `precheck` 48 · `PrecheckResultDto` · `MallIdPrecheck` · `MakeshopPrecheckQueryDto` 등. 트리거의 private 메서드에 붙이면 그 가족으로 읽힌다 |
| **`findByIdForPatchValidation`** | 0건 | ✅ 특정 도메인 가족이 없는 일반 어휘 |

선례는 `AuthConfigsService.findByIdForResponse`(6회) — `findByIdFor<목적>` 패턴은 그대로
쓰고 목적어만 새로 짓는다. `Lock`·`Locked`·`Unlocked` 는 배제한다.

> **W4 가 경고한 것이 정확히 이것이다** — "잠금 아님" 을 강조하려다 다른 거짓 연상을
> 만드는 것. 다만 체커가 제시한 대안 자체가 그 함정에 빠져 있었다. **제안받은 이름도
> 후보 토큰을 세고 나서 채택한다.**

## 1라운드 리뷰 처분 (`review/code/2026/09/15/09_30_03` — **C0 · W2 · LOW**)

forced 7/7, 11명 전원 리포트, `unfinished: []`. router 가 5명을 skip 했고 전부 강제 목록 밖이다.

| # | 처분 |
|---|---|
| W1 (documentation) CHANGELOG 의 «아래 항목» 이 가리킬 대상이 없다 | **수용·수정** — 새 항목은 prepend 되므로 방향이 반대였다. 항목명을 직접 인용하도록 고쳤고, 같은 자리에 **창 1 은 범위 밖**임을 함께 적었다. 루트 파일이라 리뷰 freshness 를 안 깬다 |
| W2 (security·concurrency) 창 1 의 인라인 `save()` 가 FK CASCADE 창에 대해 미검증 | **후속 등재 — 그리고 «추정» 임을 명시한다.** 리뷰어 자신이 *"(추정, 미확정)"* 으로 적었고, 나도 재지 못했다: **재읽기와 저장 사이를 멈추는 프로세스 내부 훅**이 있어야 그 창이 열린다(락은 읽기 *전에* 잡히므로 바깥에서 못 연다). 추정은 «FK 위반으로 시끄럽게 실패» 이지만 **그 추정을 근거로 «안전하다» 고 쓰지 않는다** |
| INFO#3·#4·#7·#10·#11·#12 | **후속 등재** — 트래커 developer 항목 7~11 |
| INFO#1·#2·#5 | 긍정 확인(조치 불요) — `affected` 판정 · clamp · 개명이 의도대로 닫혔다는 확인 |
| INFO#13 `11-workflow.md §3.1` CASCADE 누락 | 이미 planner 인계됨(`--impl-prep` W1) |
| INFO#15 리뷰 도중 워킹트리 일시 변화 관측 | 병렬 뮤테이션 세션의 흔적 — `git status` clean 확인됨. **리뷰 in-flight 중 같은 워크트리에서 뮤테이션을 돌리지 않는다**(트래커 기등재 프로세스 항목)를 이번에 내가 어겼다 |

> **정지 규칙 충족**: 이 라운드의 대응은 `CHANGELOG.md`(루트) · `plan/**` · 트래커뿐 —
> **`codebase/**` 수정 0** 이다. 선언한 대로 여기서 닫는다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system/` — `review/consistency/2026/09/15/08_58_18`
      **BLOCK: NO** (5 checker 전원 success · Critical 0 · WARNING 4). 처분은 위 표.
- [x] `--impl-done` 번들이 spec 0건이면 **BYPASS + 근거 기록** — **발동하지 않았다.**
      spec 번들이 5개 프롬프트 전부에 실렸다. 다만 **코드 diff 번들에는 5파일 중
      `triggers.service.ts` 하나만** 실렸다(나머지는 어느 `code:` glob 에도 안 걸린다 —
      트래커 planner 항목 1). 그래도 checker 들이 `git diff origin/main...HEAD` 를 **직접**
      돌려 5파일 346줄을 모두 봤고, cross_spec 은 ④를 `15-chat-channel.md §5.4` 의 404
      계약과 대조했다(INFO#1). 번들 범위만 보고 «④는 검사 대상이 아니다» 라고 판단했던 것은
      **과소 서술**이었다.
- [x] 다섯 항목 각각: 전제 실측 → 수정 → 뮤턴트 RED

      | 뮤턴트 | 결과 (367건 표면, 종결 시점 재측정) |
      |---|---|
      | M3a 유한성 검사 제거 | **1 RED** — `유한하지 않으면 던진다` |
      | M3b clamp 제거 | **1 RED** — `범위를 벗어난 유한 값은 clamp 한다` |
      | M4a `affected` 검사 제거 | **1 RED** — `UPDATE 가 0행에 매치되면 false` |
      | M4b `!result.affected` 로 바꿈 | **1 RED** — `affected 를 보고하지 않는 드라이버` |
      | M5 `triggerId` 가드 제거 | **1 RED** — `triggerId 가 없으면 락도 안 잡는다` |

      생존 0 · 교차 오염 0(각 뮤턴트가 자기 테스트 하나씩만 죽인다).

      > **①②는 뮤턴트가 존재하지 않는다.** 개명과 주석 일반화라 행동을 바꾸지 않으므로
      > «지우면 RED» 를 만들 수 없다. 대신 기계적 확인을 적어 둔다: 옛 이름
      > `findByIdForUpdate` 는 저장소에 **1건**만 남았고 그것은 개명 근거를 설명하는
      > JSDoc 본문이다(`grep -rn` 실측). 뮤테이션으로 못 덮는 변경을 «덮었다» 고 적지 않는다.

- [x] `run-test-all.sh` + 백엔드 타입 진단 ratchet — 4단계 **ALL PASS**
      (lint · unit 14 · build · e2e 308) · ratchet **197/36 baseline 일치**.

      부수 발견: `withTransactionMock` 의 `m.update` 가 `undefined` 를 돌려주고 있어
      ④ 변경이 **서비스 테스트 전부를 `TypeError` 로** 깨뜨렸다. 프로덕션을
      `result?.affected` 로 느슨하게 만드는 대신 **대역을 충실하게** 고쳤다(`{ affected: 1 }`
      기본). 0행·미보고 분기는 전용 대역을 쓰는 `trigger-config-lock.spec.ts` 가 따로 본다 —
      공용 대역에서 흉내내면 모든 호출부가 그 분기를 우연히 지난다.
- [x] 트래커 갱신 + plan → `complete/` — 트래커 developer 항목의 **2~6 에 완료 표시**.
      항목은 **열린 채로 둔다**: 1 은 조건부 유예(«세 번째 호출부가 생길 때»)가 유지되고
      7~11 이 이번 라운드에서 새로 등재됐다. **체크박스를 닫으면 그것들이 사라진다.**
- [x] `/ai-review` + `--impl-done` — **1라운드로 종결.**

      - `/ai-review` `review/code/2026/09/15/09_30_03` — **Critical 0 · Warning 2 · LOW**,
        forced 7/7, `unfinished: []`. 처분 전문은 같은 디렉토리의 `RESOLUTION.md`.
      - `--impl-prep` `review/consistency/2026/09/15/08_58_18` — **BLOCK: NO**.
      - `--impl-done` `review/consistency/2026/09/15/09_47_02` — **BLOCK: NO**
        (5 checker 전원 success · Critical 0 · WARNING 1). 첫 실행은 **주간 사용 한도**로
        6개 에이전트가 전부 즉시 실패했고(SUMMARY 없음), 한도 해제 뒤 **같은 세션**을 다시
        돌렸다 — 새 세션을 만들면 SUMMARY 없는 빈 디렉터리가 하나 더 남는다. 그 사이 main 에
        dependabot 4건(겹침 0)이 들어와 rebase 했다.

        | # | 처분 |
        |---|---|
        | W1 `11-workflow.md §3.1` CASCADE 열거 누락 | 이미 트래커 planner 항목 5b |
        | INFO#1 `rotateBotToken` 404 근거가 두 갈래인데 spec 은 하나만 | 급하지 않음 — planner 5b 와 같은 정비 때 |
        | INFO#2 CHANGELOG «아래 각주 참조» 방향 오류 | **수용·수정** — **W1 의 방향 오류를 고치면서 같은 자리에 같은 오류를 다시 넣었다.** 이번엔 방향어를 쓰지 않고 항목명·문단명으로 인용했다 |
        | INFO#3·#8 `plan/complete/…` 선참조 | 이 마무리 커밋에서 plan 을 옮겨 해소 |
        | INFO#4 `redis-keys.md §4` 미등재 | 이미 트래커 planner 항목 2 |
        | INFO#5·#6·#7·#9·#10 | 긍정 확인(조치 불요) |

      **정지 규칙**(결과를 보기 전에 선언, **하나만** 적는다):
      **`codebase/**` 수정 0 으로 끝나는 라운드가 나오면 종료.** 남은 발견은 처분으로
      기록한다. — 전신 PR 에서 정지 규칙을 두 개 적었다가 마지막에 갈려서 «결과를 보고
      고른» 꼴이 됐다. 그 재발을 막으려고 하나로 적는다.
