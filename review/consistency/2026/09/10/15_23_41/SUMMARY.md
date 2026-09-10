# Consistency Check 통합 보고서 — `--impl-done spec/2-navigation/`

**BLOCK: NO** (Critical **0건**, Warning 4건 — 그중 **1건은 이 턴에 코드로 반영**, 3건은 planner 권한)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상**: `spec/2-navigation/` · diff-base `origin/main` · 예산 `CONSISTENCY_MAX_CONTEXT_SIZE=900000`
**구현 diff**: 신규 3파일(`shared/testing/trigger-workflow-ref.{ts,spec.ts}` ·
`test/trigger-workflow-ref.e2e-spec.ts`) — **프로덕션 코드 변경 0건**
**scope 델타**: **0개 파일** — 이 브랜치는 `spec/2-navigation/` 을 바꾸지 않는다(`spec_impact: none`).
코드 전용 PR 이므로 정상이며, 다섯 checker 모두 그 사실을 CRITICAL 근거로 쓰지 않았다.

## 집계 (5개 리포트 원문을 파싱해 산출)

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `cross_spec` | LOW | 0 | 1 | 2 |
| `rationale_continuity` | LOW | 0 | 1 | 3 |
| `convention_compliance` | LOW | 0 | 2 | 0 |
| `plan_coherence` | LOW | 0 | 0 | 2 |
| `naming_collision` | **NONE** | 0 | 0 | 2 |
| **합계** | — | **0** | **4** | **9** |

## Warning 1 — 이 턴에 코드로 반영했다

**`rationale_continuity` W1: 캐너리 case E 가 R-CC-10 위반 응답을 참조 없이 200 으로 고정한다.**

case E 는 `chatChannel: {provider, botToken, uiMapping}` 을 PATCH 하고 `200` 을 단언한다. 그 `botToken`
은 편의가 아니라 **`ChatChannelConfigDto` 가 필수로 요구해서** 넣은 것이고, 그 필수 요구 자체가
`spec/5-system/15-chat-channel.md` R-CC-10(bot token 변경은 rotate 단일 경로)을 우회한다 — 같은 세션의
`/ai-review` 가 CRITICAL 로 판정한 그 결함이다.

checker 가 `grep -n "R-CC-10\|rotate-bot-token\|우회"` 로 **0건**임을 실측했다. 즉 그 맥락이 plan
문서에만 있고 **코드에는 없었다.** 그 상태의 위험은 두 방향이다 — ① 다음 사람이 이 200 을 *"PATCH +
`botToken` 은 정상 계약"* 으로 읽는다, ② 후속 처방(PATCH 전용 DTO 로 `botToken` 제외)이 들어오면 이
요청이 400 이 되는데 **왜 이 바디를 바꿔야 하는지**를 코드만 보고 추적할 수 없다.

**반영**: case E docstring 에 경고 블록을 넣고 인라인 주석도 그 축을 가리키게 했다 — R-CC-10 위반
재현임을 명시, 건너뛰는 세 단계 열거, 처방이 오면 **이 바디도 같은 PR 에서 바뀌어야 한다**는 지시,
추적 항목 경로. 마지막 문장이 이 Warning 의 핵심이다: 참조가 없으면 **캐너리가 고쳐야 할 동작을
지키는 쪽으로 작동한다.**

> `consistency` WARNING 은 `BLOCK: NO` 여도 반영한다 — 이 저장소의 규율이고, 이번 건은 특히
> 반영 비용이 주석 한 블록인데 방치 비용은 "캐너리가 결함을 화석화" 다.

## Warning 3 — planner 권한 (developer 가 `spec/`·거버넌스 문서를 못 쓴다)

| Checker | 지적 | 처분 |
|---|---|---|
| `cross_spec` W1 · `requirement` W3(코드리뷰) | `2-trigger-list.md §3` 의 *"이 축에는 캐너리가 아직 없다"* 가 이 PR 로 **사실이 아니게 됐다.** 전제가 무너지면 그 위에 얹힌 근거절(*"보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다"*)까지 한 단위로 낡는다 | planner 후속 **1번**(기등재). 자기-반증형 소정정 조건 1 불성립 — `git blame` 으로 확인하니 `dc77317cd` 즉 **planner 턴**이 등재한 문장이다 |
| `convention_compliance` W1 | `2-trigger-list.md` frontmatter `code:` 에 신규 캐너리 미등재. `3-schedule.md` 가 세운 선례 위반 — *"註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가"* | planner 후속 **2번** — 이 지적으로 **범위를 넓혔다.** 원래 e2e 파일만 적었는데 checker 가 헬퍼(`shared/testing/trigger-workflow-ref*.ts`)도 지목했다. e2e 만 넣으면 **단언의 정본(키셋·비밀 컬럼 목록)이 `code:` 밖에 남는다** |
| `convention_compliance` W2 | `PROJECT.md` §e2e 헬퍼 배치 문면(`test/helpers/`)이 실제 jest 구조와 어긋난다 — 그 자리에 두면 self-spec 이 영구히 안 돈다 | planner 후속 **3번**(기등재). 코드 쪽 대응(헬퍼 docstring 에 근거 명시)은 완료 |

## INFO 중 새 재료 — planner 후속에 5번을 추가했다

**`cross_spec` INFO: `spec/5-system/14-external-interaction-api.md` §7.1 의 인벤토리가 낡았다.**
그 절의 2026-09-08 정정 문단은 *"`#1291` 이 응답 경계 스트립을 세웠고, 스케줄 조인 축은
`schedule-trigger-ref.ts` 가 같은 목록으로 단언한다"* 로 **단언 자리를 하나만 열거**한다. 이제 트리거
직접 축에도 같은 두 컬럼의 부재를 무는 캐너리가 생겼다. 모순은 아니다 — 그 문단이 *"런타임 캐너리는
없다"* 고 단언한 적은 없다. 그러나 **열거가 불완전하면 다음 사람이 직접 축엔 정적 스트립만 있다고
읽는다.** planner 후속 5번으로 등재.

`plan_coherence` INFO 하나는 처분이 아니라 **비용의 이름을 붙였다** — 이 PR 이 머지되고 planner 후속이
착지하기 전까지 §3 문장이 실제로 거짓인 **일시적 진실성 창**이 열린다. 그 창은 조건 1 불성립에서 나오는
불가피한 비용이고(우회하면 조항을 어긴다), checker 는 후속 5건을 **머지 직후 우선 처리**하라고 권고했다.

## 다섯 checker 가 대조해 **일치**를 확인한 것 (근거 있는 음성)

`cross_spec` 이 새 코드의 하드코딩된 계약 주장을 spec 과 한 줄씩 맞췄다 — `WORKFLOW_REF_KEYS =
['id','name']` vs §3 + `TriggerWorkflowRefDto` · *"자매는 `name` 하나만"* vs `3-schedule.md §4` ·
`TRIGGER_SECRET_COLUMNS` vs `1-data-model.md` §2.8 두 컬럼 + 프로덕션 `TRIGGER_RESPONSE_STRIP_COLUMNS` ·
부재 판정 vs `2-api-convention.md` §5.4 · `chatChannelHealth=degraded` vs CCH-SE-01. **전부 일치.**
`naming_collision` 은 신규 공개 심볼이 `expectTriggerWorkflowRef` 하나뿐이고 저장소 전체에서 유일함을,
그리고 한때 `common/utils/uuid.ts` 의 `UUID_PATTERN` 과 **동명이의**였던 로컬 상수가 현재 워킹트리에서
이미 정본 import 로 해소됐음을 확인했다.

## 검증 절차 기록 — 번들이 내 델타의 26%를 안 실었다

이 세션의 가장 중요한 부수 발견이다. **checker 두 명이 독립적으로** 프롬프트의 diff 가 stale 이라고
적었고(`naming_collision`: *"세션 시작 시점의 것"*, `rationale_continuity`: 해시까지 열거), 실측으로
확인했다:

| 잰 것 | 값 |
|---|---|
| 번들이 실은 diff (세-점 `origin/main...HEAD`) | 3파일 / **402 insertions** |
| 같은 번들의 census 문장 | *"구현 diff: 3개 파일 / **420줄**"* |
| 실제 워킹트리 (두-점) | 3파일 / **541 insertions** |
| 번들에 안 보인 양 | **139 insertions (26%)** — `/ai-review` 수정 12건이 만든 줄들 |

세-점은 **의도적**이고(fork point 를 지나 전진한 base 의 남의 커밋을 배제) 그 판단은 옳다. 틀린 것은
**기준을 말하는 문장**이다 — 같은 프롬프트의 preamble 이 *"신규·변경 코드가 모두 반영된 working tree"*
를 SoT 라 선언하는데 census 와 diff 본문은 커밋된 HEAD 만 담는다. 이번엔 checker 둘이 preamble 의
절대경로 재확인 지시를 따라 스스로 복구했지만 **셋은 그 불일치를 언급하지 않았다** — 복구가 성실성에
의존했고, 그 지시는 애초에 **다른 결함**(checker CWD 가 변경 전 체크아웃일 수 있음)을 위한 것이었다.
`harness-review-gate-followups.md` **§M** 으로 등재했다(처방 (a) = census 가 기준을 정직하게 말하게
한다, 캐너리 포함).

번들 자체는 target 두 문서(`2-trigger-list.md`·`3-schedule.md`)를 5개 프롬프트 전부에 **전문 적재**했다.
이 브랜치는 큰 트래커를 **게이트 준비 전에** 편집했는데도 예산 900k 로 tier 1 폭증을 흡수했다.
