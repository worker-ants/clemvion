# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 변경은 테스트 전용 flaky 수정 2건 및 false-negative RBAC 단언 교정이 핵심이다. 프로덕션 코드 변경 없음. 기존 코드에 잔존하는 spec 위반(autoRefresh 가드 미구현, subLabel 포맷 불일치) 2건이 WARNING 수준으로 식별됐으나, 이번 PR 에 의해 발생한 것이 아닌 기존 TODO 상태다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 처리 |
|---|----------|----------|------|------|------|
| 1 | Requirement / Spec 위반 | `needsAttention` 에 `autoRefresh` 가드 미구현 — spec §2.4·§11.4 위반 상태 잔존. `autoRefresh=true` 통합이 `expiresSoon=true` 일 때 `needsAttention=true` 반환. 이번 PR 원인 아닌 기존 TODO 명시 결함 | `status-badge.tsx` L149–157 | 후속 PR `!autoRefresh &&` 가드 + 회귀 테스트 | **본 PR 범위 밖 / 보류** — 프로덕션 동작 변경 + backend `EXPIRING_SOON_INTERVAL` 동기 필요. 기존 코드의 `TODO(autoRefresh 가드)` 가 `plan/in-progress/integration-token-ui-autorefresh.md` 후속 PR 로 의도적 deferral 명시. flaky 테스트 PR 에서 처리 부적절 |
| 2 | Requirement / Spec 불일치 | `subLabel` 포맷이 spec §4.1 과 불일치(구현 `"· in"`, spec `"· next in"` — `next` 누락) | `status-badge.tsx` L90–92 | 코드 또는 spec 단방향 정합 | **본 PR 범위 밖 / 보류** — 기존 프로덕션 코드 결함. 코드 fix vs spec 갱신 결정은 project-planner 위임 대상. 본 flaky-수정 PR 에서 프로덕션 동작/spec 변경 부적절 |
| 3 | Testing | viewer RBAC `queryByTitle` false-negative — 이번 diff 에서 `queryByRole` 로 교정 완료 | `schedules-page.test.tsx` viewer describe | — | **이번 diff 로 해소됨** |

> 실질 미해소 WARNING(W1·W2)은 모두 본 PR 변경과 무관한 기존 코드 결함 → RESOLUTION.md 참조.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | Testing | 최상위 `beforeEach/afterEach` 적용 범위 암묵적 | `status-badge.test.tsx` L47–53 |
| 2 | Maintainability | `inMinutes`/`inDaysIso`/`minutesFromNow`/`inDays` 중복·이름 비일관 | `status-badge.test.tsx` |
| 3 | Maintainability | 고정 시각 하드코딩 근거 미명시 | `status-badge.test.tsx` L49 |
| 4 | Maintainability | `EXPIRING_SOON_MS` 인라인 반복 | `status-badge.test.tsx` |
| 5 | Maintainability | `addBtns[0]` 의도 표현(구조분해 권고) | `schedules-page.test.tsx` `openAddDialog` |
| 6 | Maintainability | `cleanup()` 이중 호출 | `schedules-page.test.tsx` |
| 7 | Maintainability | 픽스처 `row()` 중복 | `schedules-page.test.tsx` |
| 8–10 | Testing | autoRefresh 회귀·needsAttention 단위·EmptyState+Editor 2버튼 케이스 부재 | 양 파일 |
| 11–12 | Testing | Calendar 뷰·handleSubmit 커버리지 갭(기존 코드) | `schedules/page.tsx` |
| 13 | Scope | flaky 수정 + false-negative 교정 혼재(무해, 커밋 메시지로 구분됨) | `schedules-page.test.tsx` |
| 14 | Requirement | viewer "Run now" 접근 spec §2.1 침묵 영역 | spec |
| 15 | Side Effect | `useFakeTimers` 옵션 명시 검토 | `status-badge.test.tsx` |
| 16 | Documentation | `openAddDialog` 한 줄 JSDoc(비차단) | `schedules-page.test.tsx` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테스트 전용, 공격 표면 없음 |
| requirement | LOW | W1 autoRefresh 가드 미구현, W2 subLabel 포맷 불일치 — 모두 기존 코드 |
| scope | NONE | 실질 범위 이탈 없음 |
| side_effect | NONE | afterEach 복원 보장, 프로덕션 영향 없음 |
| maintainability | LOW | 정리성 INFO 다수 |
| testing | LOW | 커버리지 갭 INFO 다수 |
| documentation | NONE | 주석 충분 |

---

## 결론
Critical 0 / Warning 2. 미해소 WARNING(W1·W2)은 **본 flaky-수정 PR 의 변경과 무관한 `status-badge.tsx` 기존 코드/spec 결함**으로, 프로덕션 동작·spec 변경 + backend 동기 또는 project-planner 결정을 요해 본 PR 범위 밖. 처리 내역은 RESOLUTION.md 참조. W3(viewer RBAC)은 이번 diff 로 해소. flaky 3건 수정 자체는 reviewer 전원 의도 정확·범위 최소 평가.
