### 발견사항

---

- **[INFO]** JSDoc 주석의 패턴 수 불일치
  - 위치: `cron-to-visual.ts` 파일 상단 JSDoc ("6개 단순 패턴")
  - 상세: every-minute / hourly / daily / weekly / monthly 로 실제로는 5개 패턴인데 "6개"라고 기술.
  - 제안: "5개 단순 패턴" 으로 수정.

---

- **[WARNING]** `weekly + selectedDays: []` 라운드트립 손실
  - 위치: `cron-to-visual.ts` `buildCronFromVisual` weekly 분기 / `cron-to-visual.test.ts` round-trip 케이스 목록
  - 상세: `selectedDays: []` 이면 `buildCronFromVisual` 이 `"M H * * *"` (daily 패턴)을 반환한다. 이를 `parseCronToVisualOrNull` 로 다시 분해하면 `frequency: "daily"` 로 돌아와 `weekly` 가 사라진다. UI 상 요일을 모두 해제하는 건 가능하며, 해제 후 expression → visual 왕복 시 frequency 가 `daily` 로 변경된다.
  - 제안: (a) 빈 selectedDays 를 fallback `*` 대신 다이얼로그 레이어에서 validation 으로 막거나, (b) round-trip 테스트에 `weekly + selectedDays: []` 케이스를 추가해 현재 동작을 명시적으로 문서화.

---

- **[WARNING]** 통합 테스트: 기존 스케줄 수정 시 표현 불가 cron 흐름 미검증
  - 위치: `schedules-page.test.tsx`
  - 상세: `openEdit` 에서 `parseCronToVisualOrNull(schedule.cronExpression) ?? DEFAULT_VISUAL_STATE` 로 분기하는 경로가 있다. 그런데 "기존 스케줄(cron = `*/5 * * * *`)을 편집 오픈 → visual 탭 클릭 → 안내 메시지 표시 + expression 보존" 시나리오가 테스트되지 않았다. 새 스케줄의 표현 불가 흐름만 다루고 있어 edit 경로에서 `DEFAULT_VISUAL_STATE` 폴백이 의도대로 동작하는지 확인되지 않는다.
  - 제안: 편집 다이얼로그를 대상으로 하는 동일 흐름 테스트 1개 추가.

---

- **[WARNING]** Plan 문서의 체크리스트가 모두 미체크 상태
  - 위치: `plan/in-progress/schedule-cron-visual-bidirectional.md`
  - 상세: 구현이 완료된 상태임에도 모든 항목이 `[ ]` 로 남아 있다. CLAUDE.md 규약("작업 단계가 끝날 때마다 plan 문서를 갱신하고, 모든 항목이 완료된 순간에 `complete/`로 이동")을 위반한다.
  - 제안: 완료된 항목을 `[x]` 로 갱신하고, 실제 완료된 경우 `plan/complete/` 로 `git mv` 이동.

---

- **[INFO]** Plan 문서와 실제 파일명 불일치
  - 위치: `plan/in-progress/schedule-cron-visual-bidirectional.md` 항목 `cron-to-visual.spec.ts (신규)`
  - 상세: 계획에는 `cron-to-visual.spec.ts` 로 명시했으나 실제 생성된 파일은 `cron-to-visual.test.ts`. 사소한 불일치지만 추후 grep 오탐 가능.
  - 제안: plan 문서의 파일명을 `cron-to-visual.test.ts` 로 수정.

---

- **[INFO]** `parseCronToVisualOrNull` 이중 호출 (성능 소모)
  - 위치: `page.tsx` — `handleCronInputChange` (입력 시 1회) + JSX `cronCannotRepresent` prop 계산 (렌더마다 1회)
  - 상세: 같은 `formCron` 값으로 `parseCronToVisualOrNull` 을 두 번 호출한다. 현재 파서가 경량이라 실용적 문제는 없으나, `useMemo` 로 한 번만 계산하면 코드 의도가 더 명확해진다.
  - 제안: `const parsedVisual = useMemo(() => parseCronToVisualOrNull(formCron), [formCron])` 로 추출하여 두 곳에서 재사용.

---

### 요약

cron ↔ 시각 편집 양방향 보존 기능의 핵심 요구사항(parseCronToVisualOrNull/buildCronFromVisual 유틸 분리, VisualCronEditor state lift, 표현 불가 cron 안내, expression 탭 ↔ visual 탭 왕복 보존, spec 문서 갱신)은 모두 충실히 구현되어 있다. 파서의 경계값 검증도 단위 테스트로 촘촘히 다루고 있다. 다만 `weekly + selectedDays: []` 라운드트립 시 `daily` 로 되돌아오는 미묘한 정합성 손실, 편집 다이얼로그 경로에서 표현 불가 cron 시나리오의 통합 테스트 부재, Plan 체크리스트 미갱신이 요구사항 완전성 관점의 주요 결함이다.

### 위험도

**LOW**