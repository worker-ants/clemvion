# RESOLUTION — 12_36_58

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (W1)   | 코드 | daedc198    | trigger-delete-dialog.test.tsx 에 404 + 5xx 에러 경로 테스트 2건 추가 |
| #2 (W2)   | 코드 | daedc198    | 삭제 성공 케이스에 toastSuccess + onClose 검증 추가 |
| #3 (W3)   | 코드 | daedc198    | Promise.resolve() drain → waitFor 패턴 교체 |
| #4 (W4)   | 코드 | daedc198    | viewer 메뉴 열었을 때 Delete/Activate 비노출 검증 추가 (PointerEventsCheckLevel.Never) |
| #5 (W5)   | 코드 | daedc198    | manual 타입 본문 분기 테스트 추가 |
| #6 (W6)   | spec | (draft 위임) | `plan/in-progress/spec-fix-trigger-schedule-interp.md` |
| #7 (W7)   | 코드 | daedc198    | viewHistory TODO 인라인 주석 추가 + plan 에 수정 항목 Plan B 처리 명시 |
| #8 (W8)   | —    | (별 plan)   | getWebhookUrl 포트 하드코딩 — 기존 패턴, 별도 리팩터링 plan 권장 |
| #9 (W9)   | 코드 | daedc198    | TriggerDeleteDialog invalidate 책임 JSDoc 명시 |
| #10 (W10) | —    | (별 plan)   | page.tsx 590줄 TriggerRowActions 추출 — 큰 리팩터링, 별 plan 권장 |
| #11 (W11) | —    | (별 plan)   | DropdownMenu JSX 중첩 해소 — W10 과 동일 리팩터링으로 해결 가능 |
| #12 (W12) | 코드 | daedc198    | viewDetails/viewHistory TODO 주석 (W7 과 동일 fix) |
| #13 (W13) | —    | (별 plan)   | DropdownMenu 카탈로그 등재 — docs convention 후속 plan |
| security-INFO-1 | 코드 | daedc198 | confirmText.trim() === trigger.name.trim() 양쪽 trim 적용 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4381 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

- spec draft 위임: `plan/in-progress/spec-fix-trigger-schedule-interp.md`
  — spec §4.2 `{scheduleId}` → `{cron}` 정정, project-planner 검토 필요
- W8: getWebhookUrl 포트 하드코딩 (`window.location.origin.replace(/:\d+$/, ":3011")`)
  — 기존 패턴이나 프로덕션 노출 범위 확대. NEXT_PUBLIC_WEBHOOK_BASE_URL 환경변수 도입 별 plan 권장
- W10/W11: page.tsx 590줄 → TriggerRowActions 컴포넌트 추출 별 plan 권장
- W13: DropdownMenu UI 프리미티브 카탈로그 등재 — docs convention 후속 plan
