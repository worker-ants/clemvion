파일 저장 권한이 필요합니다. 아래에 통합 보고서를 출력합니다.

---

# Code Review 통합 보고서

> 대상 커밋: `859cf7dc` — fix(schedule): cron 표현식 ↔ 시각 편집 양방향 자동 변환 + 시각 state lift

## 전체 위험도
**LOW** — 치명적 결함 없음. 핵심 아키텍처 결정(cron 유틸 분리, VisualCronEditor controlled 전환)은 올바른 방향이며, 발견된 문제는 문서 정합성·테스트 커버리지 보완·경미한 코드 품질 개선에 집중됨.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `DEFAULT_VISUAL_STATE.selectedDays` 공유 배열 참조 노출 — shallow spread 반환 시 전역 상수와 동일 배열 참조를 공유해 미래 호출자가 직접 변이 시 전역 오염 가능 | `cron-to-visual.ts:36`, `parseCronToVisualOrNull` 반환부 | `DEFAULT_VISUAL_STATE`를 `Object.freeze`하거나 반환 시 `selectedDays: [...DEFAULT_VISUAL_STATE.selectedDays]`로 복사 |
| 2 | Testing | `selectedDays` 단언 누락 — "Mon 만 선택" 시나리오에서 `frequency === "weekly"` 만 검증, 요일 버튼 선택 상태 미확인으로 `selectedDays` 동기화 버그를 통과시킬 수 있음 | `schedules-page.test.tsx` — expression→visual 전환 테스트 | `screen.getByRole("button", { name: /^mon$/i })` 선택 상태(aria-pressed) 단언 추가 |
| 3 | Testing | 편집(openEdit) 경로 통합 테스트 부재 — 기존 스케줄 `cronExpression` 파싱 → `formVisualState` 세팅 경로 전혀 미검증 | `schedules-page.test.tsx` | 표현 가능/불가 cron 각각에 대해 edit 다이얼로그 열기 → visual 탭 → 상태 단언 테스트 추가 |
| 4 | Testing | `cronCannotRepresent = false` 음성 경로 미검증 — 변환 가능한 cron 입력 시 안내 문구가 나타나지 않음을 확인하는 케이스 없음 | `schedules-page.test.tsx` | `"0 9 * * *"` 입력 → visual 탭 → `queryByText(/cannot be represented/i)` 가 `null`임을 단언 |
| 5 | Testing | `weekly + selectedDays: []` 라운드트립 손실 — 요일 전체 해제 시 `buildCronFromVisual`이 daily 패턴 cron 반환, `weekly` frequency 유실 | `cron-to-visual.ts` `buildCronFromVisual` weekly 분기 | (a) 빈 `selectedDays` validation으로 차단, 또는 (b) 현재 동작을 round-trip 테스트에 명시적 문서화 |
| 6 | Documentation | "6개 패턴" 오기 — 실제 구현은 5개 패턴(every-minute/hourly/daily/weekly/monthly)임에도 3개 파일 모두 "6개"로 기술 | `cron-to-visual.ts` JSDoc, `plan/in-progress/schedule-cron-visual-bidirectional.md`, `spec/2-navigation/3-schedule.md` §2.2.1 | 3곳 모두 "5개 단순 패턴"으로 정정 |
| 7 | Process | Plan 체크리스트 미갱신 — 구현 완료된 항목 전부 `[ ]` 상태, CLAUDE.md 규약 위반 | `plan/in-progress/schedule-cron-visual-bidirectional.md` | 완료 항목 `[x]` 전환, REVIEW WORKFLOW 완료 후 `git mv plan/complete/`로 이동 |
| 8 | Architecture | `SchedulesPage` 폼 상태 과잉 집중 — 12개 state 단일 컴포넌트 집중, 이번 PR로 `formVisualState` 추가 | `page.tsx:460–480` | `useScheduleDialogForm()` 훅 또는 `ScheduleFormDialog` 컴포넌트로 분리 권장 |
| 9 | Maintainability | 테스트 setup 4회 중복 — `setRole` → `mockSchedulesResponse` → `renderPage` → 버튼 클릭 동일 패턴 반복 | `schedules-page.test.tsx` | `async function openAddDialog()` 헬퍼 + `EMPTY_RESPONSE` 상수로 추출 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `parseCronToVisualOrNull` 렌더마다 2회 호출 — `handleCronInputChange` 1회 + `cronCannotRepresent` prop 계산 1회 | `page.tsx:863–866` | `useMemo(() => parseCronToVisualOrNull(formCron), [formCron])`으로 캐싱 |
| 2 | Performance | `getCronDescription` 동일 인자로 2회 호출 | `page.tsx` VisualCronEditor JSX | `const desc = getCronDescription(cronExpression)` 로컬 변수로 할당 후 재사용 |
| 3 | Performance | `buildCronFromVisual` weekly 분기에서 이미 정렬된 `selectedDays`를 매번 방어적 복사+정렬 | `cron-to-visual.ts:141` | `selectedDays.join(",")` 단순화 또는 sort 제거 |
| 4 | Concurrency | `handleSetCronTab` 클로저 상태 읽기 — stale closure 잠재 가능성 | `page.tsx` `handleSetCronTab` | `setFormCron(prev => prev.trim() ? prev : buildCronFromVisual(formVisualState))` 함수형 업데이트 사용 |
| 5 | Testing | `buildCronFromVisual` 비정렬 `selectedDays` 입력 케이스 미검증 | `cron-to-visual.test.ts` | `selectedDays: [5,1,3]` → `"0 9 * * 1,3,5"` 케이스 추가 |
| 6 | Testing | `buildCronFromVisual` Sunday(0) 단독 선택 경계값 미검증 | `cron-to-visual.test.ts` | `{ ...DEFAULT_VISUAL_STATE, frequency: "weekly", selectedDays: [0] }` → `"0 9 * * 0"` 케이스 추가 |
| 7 | Testing | 불완전한 cron 입력 시 크래시 방지 및 visual state 보존 테스트 없음 | `schedules-page.test.tsx` | 잘못된 cron 입력 후 `formVisualState` 불변 확인 케이스 추가 |
| 8 | Testing | `resetForm` 후 `formVisualState` 리셋 검증 없음 | `schedules-page.test.tsx` | 생성 성공 → 재오픈 → visual 탭 → 기본값 단언 |
| 9 | Maintainability | `page.tsx` 핸들러 앞 다중 행 주석 — CLAUDE.md "WHAT 설명 주석 금지" 규약 위반 | `handleCronInputChange`, `handleVisualStateChange`, `handleSetCronTab` 앞 | 삭제 또는 비자명한 WHY만 한 줄로 압축 |
| 10 | Maintainability | `toInt`가 `Number()`의 trivial wrapper | `cron-to-visual.ts:53` | `parseInt(token, 10)` 교체 또는 `toInt` 제거 |
| 11 | Documentation | Plan 파일명 불일치 — `cron-to-visual.spec.ts` 명시, 실제는 `cron-to-visual.test.ts` | `plan/in-progress/schedule-cron-visual-bidirectional.md` 핵심 파일 섹션 | `cron-to-visual.test.ts`로 정정 |
| 12 | Documentation | Spec §2.2.1이 내부 파일 경로·함수명 직접 참조 — 리팩토링 시 즉시 stale 위험 | `spec/2-navigation/3-schedule.md` §2.2.1 | 구현 경로 참조 제거, 동작(behavior) 중심으로 재서술 |
| 13 | Documentation | `buildCronFromVisual` 함수 레벨 JSDoc 부재 | `cron-to-visual.ts:130` | `/** parseCronToVisualOrNull의 역함수. VisualState → 5개 표준 패턴 cron 문자열 반환. */` 추가 |
| 14 | Documentation | `DEFAULT_VISUAL_STATE` 기본값 근거 미문서화 | `cron-to-visual.ts:40` | `// 새 스케줄 기본값: 평일 오전 9시` 한 줄 주석 추가 |
| 15 | Side Effect | `openEdit`에서 `cronTab` 미리셋 없음 — visual 탭 열린 채 다른 스케줄 edit 시 탭 상태 유지 | `page.tsx` `openEdit` | `setCronTab("expression")` 추가 고려 (필수 아님) |
| 16 | Security | `buildCronFromVisual` 입력값 범위 검증 없음 (UI 강제로 현재 공격 경로 없음) | `cron-to-visual.ts:131–155` | 퍼블릭 API 노출 확대 시 `Math.min/max` 클램핑 또는 assert 추가 |
| 17 | Security | 클라이언트 전용 RBAC — `RoleGate` UI 렌더만 제어, API 호출 자체는 미차단 (기존 패턴) | `page.tsx` `<RoleGate minRole="editor">` | 백엔드 API 레이어 역할 기반 인가 검증 (이번 변경 미도입) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `buildCronFromVisual` 범위 검증 없음, 클라이언트 전용 RBAC — 신규 취약점 없음 |
| Performance | LOW | `parseCronToVisualOrNull` 렌더마다 2회 호출, `getCronDescription` 이중 호출 |
| Architecture | LOW | `SchedulesPage` 폼 상태 과잉 집중(12개), `cronCannotRepresent` 중복 파싱 |
| Concurrency | LOW | `handleSetCronTab` stale closure 잠재 가능성 |
| Dependency | NONE | 신규 외부 의존성 없음, 내부 타입 단일 진실 원천 정립 |
| Documentation | LOW | "6개 패턴" 오기(실제 5개), Plan 체크리스트 미갱신, Spec 구현 경로 직접 참조 |
| Maintainability | LOW | 테스트 setup 4회 중복, `parseCronToVisualOrNull` 이중 호출, 불필요한 다중 행 주석 |
| Testing | LOW | `selectedDays` 단언 누락, edit 경로 미커버, 음성 경로 미검증, `buildCronFromVisual` 경계값 부족 |
| Side Effect | LOW | `DEFAULT_VISUAL_STATE.selectedDays` 공유 배열 참조 노출 |
| Requirement | LOW | `weekly + selectedDays: []` 라운드트립 손실, edit 경로 테스트 부재, Plan 미갱신 |
| Scope | LOW | 다중 행 주석 규약 위반, Plan 체크리스트 미갱신 |
| API Contract | NONE | 백엔드 엔드포인트·요청 스키마 변경 없음 |
| Database | NONE | 데이터베이스 레이어 영향 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 순수 프론트엔드 변경, DB 레이어 접촉 없음 |
| API Contract | 백엔드 API 경로·페이로드 변경 없음 |
| Dependency | 신규 외부 패키지 없음, 내부 의존성 방향 올바름 |

---

## 권장 조치사항

1. **[즉시] `DEFAULT_VISUAL_STATE` 불변 보장** — `Object.freeze` 적용 또는 `parseCronToVisualOrNull` 반환 시 `selectedDays` 복사 (`cron-to-visual.ts:36`)
2. **[즉시] "6개 패턴" 오기 3곳 일괄 수정** — `cron-to-visual.ts` JSDoc, `spec/2-navigation/3-schedule.md` §2.2.1, `plan/in-progress/schedule-cron-visual-bidirectional.md` 모두 "5개"로 정정
3. **[즉시] Plan 체크리스트 갱신** — 완료 항목 `[x]` 전환, 파일명 `cron-to-visual.test.ts`로 정정, REVIEW WORKFLOW 완료 후 `git mv`로 `plan/complete/`로 이동
4. **[단기] 누락 테스트 추가** — `selectedDays` 요일 버튼 단언 / `openEdit` 경로 각 1케이스 / `cronCannotRepresent=false` 음성 경로 / `buildCronFromVisual` 비정렬 입력·Sunday 경계값
5. **[단기] `parseCronToVisualOrNull` 중복 호출 제거** — `useMemo`로 렌더당 1회 단축 (`page.tsx:863`)
6. **[단기] 다중 행 주석 정리** — WHAT 설명 주석 삭제, 비자명한 WHY만 한 줄로 유지
7. **[중기] 다이얼로그 폼 상태 분리** — `useScheduleDialogForm()` 훅 또는 `ScheduleFormDialog` 컴포넌트로 추출
8. **[중기] 테스트 setup 헬퍼 추출** — `openAddDialog()` 헬퍼 + `EMPTY_RESPONSE` 상수로 4회 중복 제거