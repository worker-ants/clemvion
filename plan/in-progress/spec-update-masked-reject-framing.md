---
title: "spec 정정 — 마커 거부의 범위 서술과 검사 시점을 구현에 맞춘다"
worktree: eia-inputoverride-reject-a3f1c9
started: 2026-08-21
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/4-nodes/7-trigger/1-manual-trigger.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/12-webhook.md
  - spec/1-data-model.md
  - spec/5-system/14-external-interaction-api.md
---

# 마커 거부 — 범위 서술·검사 시점 정정

`00_39_27` 리뷰가 spec 3건을 짚었다. 전부 **내가 앞선 턴에 쓴 문장**이 뒤이은 정정을 못
따라간 것이다. `developer` 는 `spec/` read-only 라 planner 턴으로 처리한다.

## ⚠️ 절차 위반을 먼저 적는다 (W3)

`fix(security)` 커밋(`50f799efd`, **developer 턴**)이 `spec/5-system/14-external-interaction-api.md`
표 행을 직접 고쳤다. `git log -S` 로 확인했다 — 그 라벨 변경은 planner 커밋이 아니라 그
커밋에서 처음 나타난다.

**내용은 문제가 없다** — planner 턴이 이미 확정한 캐비엇("Manual 실행 경로 전체다")을 표
행에 동기화한 것뿐이고, 리뷰어도 *"실질 리스크 낮음"* 으로 적었다. 문제는 **경로**다.
CLAUDE.md 는 `developer` 의 `spec/` 을 read-only 로 두고 변경을 planner 위임으로 규정한다.

내가 그 순간 "표 행과 캐비엇이 어긋난다" 는 리뷰 지적을 고치는 데만 집중해서, 그 파일이
어느 권한에 속하는지를 안 봤다. **고칠 내용이 옳다는 것과 고칠 자격이 있다는 것은 다르다.**

이 드래프트가 사후 정규 경로다 — 남은 spec 편집을 여기서 묶어 처리하고, 이미 들어간 표 행도
이 문서의 승인 범위 안에 명시적으로 편입한다.

## 정정 1 — `1-manual-trigger.md` §6: 검사 시점이 낡았다 (W1, SPEC-DRIFT)

§6 reason 표가 `masked_value_resubmitted` 의 시점을 *"adapter `resolveTriggerParameters`
**직후**"* 라고 적는다. **실제 구현은 2단계**다 — raw(coerce 전) 검사 → resolve → resolve 후
재검사.

그 순서 자체가 `00_03_57` CRITICAL 의 수정 내용이다. `coerceToType('***','boolean')` 은
`Boolean('***')` → `true` 라, resolve **직후**에만 보면 boolean 파라미터가 통째로 우회된다.

> **이 문장을 그대로 두면 다음 사람이 이것만 보고 검사를 "직후" 한 곳으로 되돌린다** —
> 같은 CRITICAL 이 재발한다. spec 이 구현보다 낡은 게 아니라, **spec 이 폐기된 설계를
> 지시하고 있는** 상태다.

→ 시점을 *"adapter `resolveTriggerParameters` **전후**(raw 우선 검사 → resolve → 재검사)"*
로 정정하고, 왜 2단계인지 한 줄 근거를 단다.

## 정정 2 — 자매 두 곳의 "재제출 경로 한정" (W5)

`3-error-handling.md:193` 과 `12-webhook.md:312` 가 `MASKED_VALUE_RESUBMITTED` 를
*"재제출 경로 한정"* 이라 서술한다. **그 프레이밍은 이미 폐기됐다** — `23_33_00` 게이트가
`POST /workflows/:id/execute` 는 재제출 전용이 아니라 Manual 실행 전체의 진입점이고 출처를
구분할 플래그가 없다고 짚었고, §R17·CHANGELOG·코드 docstring 세 곳을 *"Manual 실행 경로
전체, 저작 주체 기준"* 으로 정정했다. 이 둘만 안 따라갔다.

**이 문구만 읽으면 폼에 직접 `***` 를 입력하면 통과한다고 오독한다 — 실제로는 거부된다.**

→ 둘 다 *"Manual 실행 경로 한정(저작 주체 기준) — webhook·schedule 은 외부 시스템이 저작해
대상이 아니다"* 로 교체.

**세 번째 자매가 더 있었다** — `1-data-model.md:471` 도 *"재제출 경로에서"* 로 적는다.
`--spec` 게이트(`00_55_25` W1)가 잡았다.

> **자매 발산을 경고하는 문서를 쓰면서 자매를 놓쳤다.** 이 드래프트 초판은 정정 대상을 두
> 곳으로 셌는데 실제로는 셋이었다. 리뷰가 짚은 두 곳을 그대로 옮겨 적었을 뿐 **내가 직접
> 전수로 세지 않았다** — 바로 그 문서에서 *"grep 으로 전수로 세는 게 유일하게 통한 방법"*
> 이라고 써 놓고서.
>
> 이번엔 **변형 포함 패턴**(`재제출`)으로 spec 전체를 훑고, 폼 재제출 UX 같은 무관 도메인을
> 손으로 걸러 4곳(위 셋 + 이미 고친 §R17 표 행)으로 확정했다.

## Rationale

**왜 "재제출 한정" 이 틀린 서술인가**: 판정 기준이 값의 출처가 아니라 **페이로드의 저작
주체**이기 때문이다. Manual 트리거 파라미터는 워크플로 작성자가 정의한 값 슬롯이고, 프런트가
이미 출처와 무관하게 마커를 막는다. 서버는 그 규칙을 API 레벨로 옮길 뿐이다. webhook·schedule
의 body 는 외부 시스템이 저작하는 임의 페이로드라 리터럴 `'***'` 가 정상 값일 수 있다.

**왜 §6 의 시점 서술이 위험한가**: 다른 stale 서술과 달리 이것은 **폐기된 설계를 지시**한다.
"직후" 로 되돌리면 boolean 우회가 그대로 살아나고, 그 우회는 리뷰 세 명이 독립적으로 잡을
만큼 눈에 띄지 않았다.

**기각한 대안 — 표 행만 고치고 근거는 생략**: 시점만 "전후" 로 바꾸면 다음 사람이 *"왜 두
번 보나"* 를 모른 채 한쪽을 지운다. 한 줄이라도 이유를 남긴다.
