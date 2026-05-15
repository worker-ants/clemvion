## 발견사항

### WARNING: 패턴 수 불일치 — "6개" vs 실제 5개

- **위치**: `cron-to-visual.ts` 모듈 상단 JSDoc, `plan/in-progress/schedule-cron-visual-bidirectional.md` (작업 항목), `spec/2-navigation/3-schedule.md` §2.2.1
- **상세**: 세 파일 모두 "6개 단순 패턴/형태"라고 서술하지만, 실제로 나열된 패턴은 5개(every-minute, hourly, daily, weekly, monthly)다. `cron-to-visual.ts`의 구현도 5-branch switch 다.
- **제안**: 세 파일 모두 "6개" → "5개"로 정정.

---

### WARNING: Plan 문서 체크리스트가 미갱신 상태

- **위치**: `plan/in-progress/schedule-cron-visual-bidirectional.md`
- **상세**: 모든 작업 항목이 `[ ]`(미완) 표기이나, 해당 유틸·테스트·컴포넌트 리팩터링이 이미 커밋된 상태다. CLAUDE.md 규약상 작업 완료 시 체크박스를 체결하고, 모든 항목 완료 시 `plan/complete/`로 이동해야 한다.
- **제안**: 완료된 항목을 `[x]`로 갱신하고, TEST/REVIEW WORKFLOW 항목도 완료 여부에 따라 처리 후 `git mv`로 `plan/complete/`로 이동.

---

### INFO: Plan 문서 파일명 불일치

- **위치**: `plan/in-progress/schedule-cron-visual-bidirectional.md` — "핵심 파일" 섹션
- **상세**: `frontend/src/lib/utils/cron-to-visual.spec.ts`라고 명시했으나 실제 생성된 파일은 `cron-to-visual.test.ts`다.
- **제안**: Plan 문서의 경로를 `cron-to-visual.test.ts`로 정정.

---

### INFO: `buildCronFromVisual` 함수 레벨 문서 부재

- **위치**: `cron-to-visual.ts:130`
- **상세**: 모듈 상단 JSDoc이 전체 맥락을 설명하지만, `buildCronFromVisual`은 별도 주석 없이 `parseCronToVisualOrNull`의 역함수임을 알 수 없다. IDE에서 함수만 임포트해 사용할 때 컨텍스트가 없다.
- **제안**: 한 줄 JSDoc 추가 — `/** `parseCronToVisualOrNull`의 역함수. VisualState → 5개 표준 패턴 중 하나의 cron 문자열 반환. */`

---

### INFO: `DEFAULT_VISUAL_STATE` 기본값 근거 미문서화

- **위치**: `cron-to-visual.ts:40`
- **상세**: `daily / 09:00 / Mon-Fri` 선택 근거(업무 시간대 기본값)가 코드에 기록되지 않았다. 다른 개발자가 `hour: 9`, `selectedDays: [1,2,3,4,5]`를 임의값으로 오해하고 변경할 수 있다.
- **제안**: 상수 위에 한 줄 주석 추가 — `// 새 스케줄의 합리적 기본값: 평일 오전 9시`

---

### INFO: Spec §2.2.1이 구현 경로를 직접 참조

- **위치**: `spec/2-navigation/3-schedule.md` §2.2.1 끝 블록쿼트
- **상세**: `> 변환 유틸: frontend/src/lib/utils/cron-to-visual.ts 의 parseCronToVisualOrNull / buildCronFromVisual.` — Spec 문서가 내부 파일 경로와 함수명을 노출한다. 파일이 리팩터링되면 Spec이 즉시 stale해진다.
- **제안**: 구현 경로 참조를 제거하고 동작(behavior) 중심으로 서술. 구현 상세는 코드 내 JSDoc이나 ADR로 위임.

---

## 요약

전반적으로 문서화 수준이 양호하다. `cron-to-visual.ts` 모듈 JSDoc은 지원 패턴과 null 반환 조건을 명확히 기술하고, `page.tsx`의 인라인 주석은 state lift 결정 이유를 잘 설명한다. i18n 키도 두 언어 모두 추가되었다. 주요 개선 포인트는 세 파일에 걸쳐 일관되게 발생한 **"6개 패턴" 오류**(실제 5개)와, **Plan 문서의 체크박스·파일명 불일치**다. Spec 문서가 내부 구현 경로를 참조하는 점은 장기 유지보수에서 잠재적 stale 위험이다.

## 위험도

**LOW**