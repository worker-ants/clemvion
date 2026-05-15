# Code Review 조치 내역 — 2026-05-05_23-23-07

> 대상: `0a47fe70..859cf7dc` (스케줄 cron ↔ 시각 편집 양방향 자동 변환)
> 리뷰 결과: Critical 0 · Warning 9 · Info 17

## Warning 조치 결과

| # | 카테고리 | 발견 | 조치 | 결과 |
|---|----------|------|------|------|
| W1 | Side Effect | `DEFAULT_VISUAL_STATE.selectedDays` 공유 배열 참조 노출 — 호출자가 변이 시 전역 오염 | `Object.freeze(DEFAULT_VISUAL_STATE)` + `Object.freeze(selectedDays)` deep freeze. 파서는 `cloneDefault()` 헬퍼로 새 배열을 emit. 단위 테스트(freeze 불변성, 호출자 mutate 안전성) 추가. | 조치 완료 |
| W2 | Testing | "Mon 만 선택" 시나리오에서 `selectedDays` 동기화 미검증 — frequency 만 보면 weekly 분기 진입은 알지만 `[1]` 로 정확히 동기화됐는지는 누락 | 요일 버튼 클래스 검증 추가 — Mon 버튼만 `bg-[hsl(var(--primary))]` (selected style), Tue 등은 미선택. | 조치 완료 |
| W3 | Testing | `openEdit` 경로 통합 테스트 부재 | `cronExpression: "30 14 15 * *"` schedule 의 edit 다이얼로그 → visual 탭 → frequency=monthly · day=15 · hour=14 단언 케이스 추가. | 조치 완료 |
| W4 | Testing | `cronCannotRepresent=false` 음성 경로 미검증 | "expression 입력 → visual 전환" 테스트에 `queryByText(/cannot be represented/i)` 가 `null` 임을 단언하여 변환 가능한 cron 시 안내 미노출 검증. | 조치 완료 |
| W5 | Requirement | `weekly + selectedDays: []` 라운드트립 깨짐 (build → daily 패턴, parser → daily 분류) | build 함수의 의도된 fallback 으로, JSDoc 에 round-trip 비대칭을 명시. UI 에서 모든 요일 해제를 차단하는 것이 더 사용자 친화적이나 본 PR 범위 외 — 별도 작업으로 분리. | 의도된 동작으로 명시 |
| W6 | Documentation | "6개 패턴" 오기 (실제 5개) | `cron-to-visual.ts` JSDoc, `spec/2-navigation/3-schedule.md` §2.2.1, `plan/in-progress/schedule-cron-visual-bidirectional.md` 3곳 모두 "5개"로 정정. | 조치 완료 |
| W7 | Process | Plan 체크리스트 미갱신 | 모든 완료 항목 `[x]` 전환 + 결과 요약 섹션 추가. REVIEW WORKFLOW 종료 후 `git mv` 로 `plan/complete/` 이동. | 조치 완료 |
| W8 | Architecture | `SchedulesPage` 폼 상태 12개 집중 — 본 PR 로 +1 (`formVisualState`) | `useScheduleDialogForm()` 훅 또는 `ScheduleFormDialog` 컴포넌트 추출은 더 큰 리팩토링이라 본 PR 범위 외. 별도 작업으로 분리 권장. | 본 PR 범위 외 — 별도 작업 |
| W9 | Maintainability | 테스트 setup 4회 중복 (`setRole` → `mockSchedulesResponse` → `renderPage` → 버튼 클릭) | `EMPTY_RESPONSE` 상수 + `openAddDialog()` / `clickTab(name)` 헬퍼 추출. 기존 4 케이스를 헬퍼 사용으로 마이그레이션. | 조치 완료 |

## Info 조치 결과

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| I1 | Performance | `parseCronToVisualOrNull` 렌더당 2회 호출 | `cronCannotRepresent` 를 `useMemo([formCron])` 로 캐싱. 입력 핸들러에서 1회 + 렌더에서 1회 → 렌더당 2회 → 1회로 감소. |
| I2 | Performance | `getCronDescription` 동일 인자 2회 호출 | VisualCronEditor JSX 내부에 `const description = getCronDescription(cronExpression)` 로 1회 호출 후 재사용. |
| I3 | Performance | weekly 분기 매번 sort | INFO — 외부 호출자가 비정렬 selectedDays 를 줄 가능성을 고려해 방어적 sort 유지. 단위 테스트로 비정렬 입력 동작 명시. |
| I4 | Concurrency | `handleSetCronTab` stale closure 잠재 가능성 | `setFormCron(prev => prev.trim() ? prev : buildCronFromVisual(formVisualState))` 함수형 업데이트로 변환. |
| I5 | Testing | `buildCronFromVisual` 비정렬 입력 미검증 | `selectedDays: [5,1,3]` → `"0 9 * * 1,3,5"` 케이스 추가. |
| I6 | Testing | Sunday(0) 단독 build 케이스 부재 | `selectedDays: [0]` → `"0 9 * * 0"` 케이스 추가. |
| I7 | Testing | 잘못된 cron 입력 시 visual state 보존 미검증 | "표현 불가 cron 진입 시 직전 visual state 보존 + 안내 노출" 시나리오 추가 — visual monthly/15 설정 후 `0 9-17 * * *` 으로 expression 덮어쓴 뒤 visual 로 돌아오면 monthly/15 그대로 유지. |
| I8 | Testing | `resetForm` 후 visual state 리셋 검증 | INFO — 본 PR 의 핵심 동작(양방향 변환)이 아니므로 보류. 기능 정상 동작은 코드상 자명. |
| I9 | Maintainability | 다중 행 주석 — WHAT 설명 위주 | 핸들러 앞 주석을 한 줄(WHY 만) 로 압축하거나 자명한 부분은 삭제. |
| I10 | Maintainability | `toInt` 가 `Number()` trivial wrapper | `parseInt(token, 10)` 로 교체하고 `toInt` 헬퍼 제거. |
| I11 | Documentation | Plan 파일명 불일치 (`cron-to-visual.spec.ts` vs 실제 `cron-to-visual.test.ts`) | Plan 문서를 `cron-to-visual.test.ts` 로 정정. |
| I12 | Documentation | Spec §2.2.1 이 구현 경로 직접 참조 | INFO — 구현 진실의 단일 진실 원천을 명시하는 의도적 패턴. 기존 spec 의 다른 절들도 같은 스타일을 사용. 그대로 유지. |
| I13 | Documentation | `buildCronFromVisual` 함수 레벨 JSDoc 부재 | 주석 추가 — `parseCronToVisualOrNull` 의 역함수 + weekly 빈 selectedDays fallback 명시. |
| I14 | Documentation | `DEFAULT_VISUAL_STATE` 기본값 근거 미문서화 | "평일(월~금) 오전 9시 — 가장 흔한 업무용 cron" 한 줄 주석 추가. |
| I15 | Side Effect | `openEdit` 에서 `cronTab` 미리셋 | `setCronTab("expression")` 추가 — 다른 schedule 편집 시 직전 visual 탭 상태가 유지되어 사용자 혼란이 발생하지 않게. |
| I16 | Security | `buildCronFromVisual` 입력값 범위 검증 부재 (UI 강제로 현재 공격 경로 없음) | INFO — 현재 공격 경로 없음, 함수가 외부 입력을 받지 않아 보류. 향후 public API 노출 시 재검토. |
| I17 | Security | 클라이언트 전용 RBAC | INFO — 본 PR 변경 무관. 백엔드 가드는 별도 영역. |

## 최종 결과

- **Critical**: 0
- **Warning 처리**: 9/9 (조치 6건 + 의도된 동작으로 명시 1건 + 별도 작업 분리 1건 + 문서 정정 1건)
- **Info 처리**: 11/17 (즉시 가능한 코드 품질 개선은 모두 반영)
- **TEST WORKFLOW 재수행**: lint OK · 103 suites / 1198 tests OK · build OK
- 변환 가능 cron 패턴은 expression ↔ visual 양방향 자동 변환되어 손실 없고, 표현 불가 cron 은 안내 메시지 + 직전 visual state 보존.

## 변경 파일

- `frontend/src/lib/utils/cron-to-visual.ts` — DEFAULT freeze, JSDoc, parseInt(token, 10) 사용
- `frontend/src/lib/utils/__tests__/cron-to-visual.test.ts` — 비정렬·Sunday build / freeze 불변성 / 호출자 mutate 안전성 케이스
- `frontend/src/app/(main)/schedules/page.tsx` — useMemo cronCannotRepresent / description 로컬 변수 / handleSetCronTab functional update / 주석 정리 / openEdit cronTab 리셋
- `frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` — EMPTY_RESPONSE / openAddDialog / clickTab 헬퍼 + Mon 버튼 클래스 단언 / 음성 경로 / 표현 불가 cron 진입 시 visual state 보존 / openEdit 경로
- `spec/2-navigation/3-schedule.md` — "5개 패턴" 정정
- `plan/in-progress/schedule-cron-visual-bidirectional.md` — 체크리스트 갱신, 파일명 정정
