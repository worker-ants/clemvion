---
worktree: triggers-edit-delete-suite-a1548c
started: 2026-05-22
owner: resolution-applier
---

# Spec Fix Draft — trigger-schedule-interp

## 원본 발견사항

SUMMARY#6 (W6): spec `§4.2` schedule 확인 다이얼로그 interp 변수 불일치 (`{scheduleId}` → `{cron}`)

> `spec/2-navigation/2-trigger-list.md §4.2` L146 은 schedule 타입 확인 다이얼로그 본문의
> interpolation 변수를 `{scheduleId}` 와 `{nextRunAt}` 으로 정의한다.
> 그러나 코드(trigger-delete-dialog.tsx L152-159) 및 i18n EN 키는 `{scheduleId}` 대신
> `{cron}` (= `cronExpression`) 을 사용한다.
> cron 표현식이 사용자에게 scheduleId 보다 직관적이므로 spec 결함으로 판단.

## 제안 변경

`spec/2-navigation/2-trigger-list.md §4.2` 의 schedule 타입 다이얼로그 본문 설명을 다음과 같이 수정:

```diff
-연결된 스케줄도 함께 삭제됩니다 (스케줄 ID `{scheduleId}`). 다음 실행 예정 시각: `{nextRunAt}`.
+연결된 스케줄도 함께 삭제됩니다 (cron `{cron}`). 다음 실행 예정 시각: `{nextRunAt}`.
```

## 근거

- cron 표현식(`0 9 * * *` 등)은 사용자가 어떤 스케줄인지 즉시 식별 가능.
- scheduleId 는 내부 UUID 로 사용자에게 의미 없음.
- 코드·i18n 이미 `{cron}` 으로 구현되어 있어 spec 을 코드에 맞추는 방향이 변경 최소화.
- 관련 plan 근거: `plan/in-progress/trigger-list-row-actions.md §3 i18n` 섹션 주석.

## 검토 요청

`project-planner` 가 spec `§4.2` 를 검토하고:
1. `{scheduleId}` → `{cron}` 변경 반영
2. Rationale 에 "cron 이 사용자에게 더 직관적 — UX 우선" 추가
