# Plan 정합성 검토 — `spec-draft-schedule-trigger-ref-nav.md`

## 대상

- target: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md`
- 근거 tracker: `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-05 등재 W1, 대상 확장 2026-09-06 W2)

## 발견사항

### [INFO] tracker 항목 원문과 draft 스코프 대조 — 일치 (누락·과잉 없음)

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` 전체 (D-1, D-2)
- 관련 plan: `spec-draft-nullable-notation-followups.md` L1844-1855

tracker 원문(정확 인용):

> `[ ]` **`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화** (planner, 2026-09-05 등재,
> `21_40_38` W1). §5.4 는 **키 생략형에 사유 문서화**를 요구한다. 코드 쪽은 이번에
> 정리했다 — `trigger` 는 상시 존재라 **기본형으로 바꿨고**, `workflow` 는 기준 (b)
> (선택적 부가 컨텍스트)에 해당해 사유를 필드 주석에 적었다. 남은 것은 그 사유를
> `spec/2-navigation/3-schedule.md §4`(또는 `1-data-model.md §2.9.1`)에 옮기는 것이다.
> `IntegrationDto` 포인터 항목과 대칭으로 처리한다.
>
> **`TriggerDto.workflow` 도 같은 항목이다** (`22_25_00` W2). 같은 라운드에 신설된
> 자매 키-생략 필드인데 이 bullet 이 스케줄 쪽만 적고 있었다 — 두 DTO 의
> `trigger`/`workflow` 참조 필드를 한 묶음으로 다룬다. 반영 대상 spec 은
> `2-navigation/2-trigger-list.md` 와 `3-schedule.md §4` 둘이다.

draft 의 D-1(`3-schedule.md §4`)은 `ScheduleDto.trigger`(상시 존재, 기본형)와
`ScheduleTriggerRefDto.workflow`(키 생략, 근거 (b))를 **둘 다** 한 표에 문서화한다 —
title 자체가 "`ScheduleDto.trigger`/`workflow`" 이므로 이는 항목이 요구한 정확히 그
쌍이다. D-2(`2-trigger-list.md §3`)는 `TriggerDto.workflow`(키 생략)를 문서화해
target-expansion(W2)이 지목한 자매 필드를 커버한다. 코드 실측(`schedule-response.dto.ts`
L20-56, `trigger-response.dto.ts` L23-102)으로 draft 의 각 서술(생성 응답에만 부재·
`findById`/`findAll`/`update` 경로에서 로드·id/name 비대칭)을 대조했고 전부 일치한다.
"무엇을 하지 않나" 절이 명시하는 비-스코프(`ScheduleDto`/`TriggerDto` 전 필드 인벤토리
이관 금지)도 §5.4 가 요구하는 범위(키 생략 필드의 사유)를 벗어나지 않는다 — 스코프는
narrower 도 wider 도 아니다.

### [INFO] D-3 은 tracker 가 명시적으로 요구한 것은 아니다 — 단, draft 가 그 사실을 스스로 밝히고 근거를 댐

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` D-3 (`2-trigger-list.md §2.1`)
- 관련 plan: 없음(신규 판단)
- 상세: tracker 항목은 §5.4 의 "키 생략 사유 문서화" 만 요구하고, §2.1 "연결된 워크플로우"
  행에 데이터 출처를 명시하라는 요구는 없다. draft 는 이를 "왜 넣나" 절에서 **§5.4 요구는
  D-1·D-2 로 이미 충족**되며 D-3 은 자매 행(인증/AuthConfig)과의 비대칭 해소를 위한 별도
  판단이라고 명시적으로 구분해 적었다. 실측(§2.1 L62 인증 행에 이미 "데이터 출처: …" 패턴
  존재, L63 워크플로우 행에는 없음)도 그 비대칭 주장과 일치한다.
- 제안: 코드 변경 없음, 조치 불요 — target 이 스스로 스코프 경계를 밝히고 있어 "일방적
  결정 은폐" 에 해당하지 않는다. 기록 목적의 INFO.

### [INFO] 미선택 대안(`1-data-model.md §2.9.1`)은 닫혀 있다 — dangling 아님

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` "무엇을 하지 않나" 절 + D-1 표 `trigger` 행
- 관련 plan: `spec-draft-nullable-notation-followups.md` L1848 (택일 제시)
- 상세: tracker 는 `3-schedule.md §4` 또는 `1-data-model.md §2.9.1` 중 택일을 열어 뒀다.
  draft 는 "키 생략은 wire 표현, §2.9.1 은 DB 관계" 라는 근거로 §4 를 택하고, §2.9.1 은
  **건드리지 않는다고 명시**한다. 그런데 이 선택이 §2.9.1 을 방치하는 것이 아니라 —
  D-1 의 `trigger` 행이 §2.9.1 을 `Schedule.trigger_id` NOT NULL 근거로 **인용**한다
  (`../1-data-model.md#291-trigger--schedule-동기화-규칙`). 실제 §2.9.1 L290 에
  "Schedule.trigger_id는 NOT NULL" 문장이 존재함을 확인했고, 앵커 슬러그도 GFM 규칙과
  기존 3건의 동일 앵커 인용(`2-trigger-list.md:170,198`, `3-schedule.md:112`,
  `12-webhook.md:514`)과 일치한다(draft 는 "기존 인용 2건" 이라고 적어 실제보다 1건 적게
  세었으나, 앵커 정확성 자체에는 영향 없음 — plan-coherence 범위 밖의 사소한 수치 오차라
  별도 항목으로 올리지 않는다). 결론: 미선택 대안은 dangling 이 아니라 **참조로 닫혀 있다**.

### [INFO] 자매 항목(`TriggerDto.workflow`) — half-open 아님, D-2 로 완전 커버

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` D-2
- 관련 plan: `spec-draft-nullable-notation-followups.md` L1851-1854 (target-expansion W2)
- 상세: target-expansion 이 요구하는 반영 대상은 `2-trigger-list.md` 와 `3-schedule.md §4`
  둘이다. draft 의 D-1 이 스케줄 쪽(`3-schedule.md §4`)을, D-2 가 트리거 쪽
  (`2-trigger-list.md §3`)을 각각 커버해 두 반영 대상 모두 처리된다. 코드 대조
  (`TriggerWorkflowRefDto` id+name, `ScheduleTriggerWorkflowRefDto` name-only, 양쪽 다
  "생성 응답에만 없음") 결과 draft 서술과 실제 DTO 선언이 정확히 일치한다. 한쪽만 닫고
  한쪽을 열어 둔 상태가 아니다.

### [INFO] `--impl-done` 발화 여부를 게이트에 위임하는 disposition — 상충하는 plan 없음

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` 체크리스트 마지막 항목
- 관련 plan: 전체 `plan/in-progress/**` 검색 결과 없음
- 상세: `.claude/skills/project-planner/SKILL.md` 는 `spec/` 쓰기 직전 `--spec` 만 의무로
  규정하고 `--impl-done` 은 언급하지 않는다(그 게이트는 코드 구현 후 developer 트랙에
  결속). `plan/in-progress/**` 전체를 grep 한 결과 "spec-only planner 턴은 `--impl-done`
  을 반드시/반드시 안 돌린다" 는 식으로 다른 규칙을 이미 확정해 둔 in-progress plan 은
  없다. 오히려 같은 tracker(`nullable-notation-followups.md`) 안의 다수 완료 항목이
  "정본 게이트에 직접 물었다" 는 동일 패턴을 선례로 남기고 있다(예: L1797-1799 C-4 항목).
  draft 의 disposition 은 이 선례와 일치하며 다른 plan 과 충돌하지 않는다.

### [INFO] 같은 spec 파일을 건드리는 다른 in-progress plan — 검색 결과 실질 충돌 없음

- target 위치: 해당 없음(횡단 확인)
- 관련 plan: `spec-sync-auth-gaps.md` L15-36
- 상세: `2-navigation/2-trigger-list.md`/`3-schedule.md` 를 참조하는 다른 in-progress
  plan 은 `spec-sync-auth-gaps.md` 뿐이다. 거기서 인용하는 위치(당시 L182, L252 —
  audit action 명칭 오기 `trigger.delete`→`trigger.deleted`, `permission` 오기)는
  draft 가 건드리는 절(§2.1, §3)과 다른 절(§4.1 삭제 정책)이고, 무엇보다 그 항목 자체가
  이미 `[x]` **완료(2026-08-06, planner 턴)** 로 표시돼 있다. 현재 spec 실측
  (`2-trigger-list.md:189`)도 이미 `trigger.deleted` + 역할 기반 인가 서술로 정정돼 있어
  그 defect 는 더 이상 존재하지 않는다. 즉 라인 번호는 옛 스냅샷의 잔존 인용일 뿐이며
  draft 와 실질적으로 겹치는 편집 지점이 없다.

### [INFO] Gate C — `spec_impact` 두 경로 모두 실재, 제3의 spec 파일 미편집

- target 위치: `spec-draft-schedule-trigger-ref-nav.md` frontmatter
- 상세: `spec_impact: [spec/2-navigation/2-trigger-list.md, spec/2-navigation/3-schedule.md]`
  두 파일 모두 실재 확인(`ls` 성공). draft 본문의 실제 변경안(D-1, D-2, D-3)은 이 두
  파일 안의 절(§4, §3, §2.1)만 편집 대상으로 삼고, `1-data-model.md §2.9.1` 은 "건드리지
  않는다" 고 명시적으로 배제했으며 `5-system/2-api-convention.md` 는 링크만 걸고 편집
  대상이 아니다. 제3의 spec 파일이 실제로 편집되는 정황은 없다 — Gate C 요건 충족.

### 참고 — 별개 관찰(coherence 등급 밖)

`2-trigger-list.md` frontmatter 는 현재 `status: partial` + `pending_plans:
[spec-draft-nullable-notation-followups.md]` 상태다(같은 tracker 안의 다른 미해결 항목 —
`GET /api/triggers` sort/order whitelist 구현, developer 담당, L720 `- [ ]`). draft 의
D-2/D-3 은 이 pending 사유(정렬 미구현)와 무관한 §3/§2.1 자리를 건드리므로 선행 조건
미해소 문제는 아니다. 다만 이 tracker 가 닫히기 전까지 해당 spec 파일은 `status: partial`
로 남는다는 점만 기록해 둔다 — draft 의 편집 범위와는 무관.

## 요약

target draft(`spec-draft-schedule-trigger-ref-nav.md`)는 `spec-draft-nullable-notation-followups.md`
가 등재한 단일 항목(W1) 및 그 target-expansion(W2)이 요구하는 스코프를 정확히 재현한다 —
`ScheduleDto.trigger`/`workflow` 와 `TriggerDto.workflow` 두 DTO 의 참조 필드를 한 묶음으로
다뤄야 한다는 tracker 의 명시적 지시를 D-1·D-2 가 각각 나눠 커버하며 어느 한쪽도 half-open
으로 남기지 않는다. 택일 대상이던 `1-data-model.md §2.9.1` 은 미편집으로 명시하되 NOT NULL
근거 인용으로 연결해 dangling 이 아니다. D-3 은 tracker 가 요구하지 않은 추가 판단이지만
draft 스스로 그 경계를 밝히고 근거(자매 행 비대칭 해소)를 댔으므로 "일방적 결정" 성격이
아니다. `--impl-done` 발화 여부를 게이트에 위임하는 disposition 은 project-planner SKILL 및
이 저장소의 기존 선례와 상충하지 않는다. 동일 spec 파일을 건드리는 다른 in-progress plan
(`spec-sync-auth-gaps.md`)은 있으나 그 항목은 이미 완료됐고 다른 절을 겨냥해 실질적 충돌이
없다. `spec_impact` 두 경로는 모두 실재하며 draft 의 실제 편집 범위와 정확히 일치한다.
전반적으로 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 중 어느 것도 발견되지 않았다.

## 위험도

LOW
