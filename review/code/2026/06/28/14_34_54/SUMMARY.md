# Code Review 통합 보고서

## 전체 위험도
**LOW** — 테스트 전용 flaky 수정 변경. 프로덕션 코드 변경 없음. 기존 코드에 spec §2.4·§11.4 위반 상태 잔존(autoRefresh 가드 미구현 TODO) 및 테스트 내 DOM 순서 의존성 취약점이 WARNING 수준으로 존재.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 처리 |
|---|----------|----------|------|------|------|
| 1 | REQUIREMENT | `needsAttention`의 `autoRefresh` 가드 미구현 — spec §2.4·§11.4 위반 상태 잔존(기존 코드의 명시적 `TODO(autoRefresh 가드)`). `autoRefresh=true` 통합도 `isExpiringSoon` 분기에서 `true` 반환. | `status-badge.tsx` L148–161 | `needsAttention` 에 `!autoRefresh &&` 가드 + 테스트 케이스 추가 | **본 PR 범위 밖 / 보류** — 프로덕션 동작 변경 + spec·backend(`EXPIRING_SOON_INTERVAL`) 동기 필요. 기존 TODO 가 `plan/in-progress/integration-token-ui-autorefresh.md` 후속 PR 로 의도적 deferral 명시. flaky 테스트 PR 에서 처리 부적절. |
| 2 | TESTING | `addBtns[0]` 인덱스 기반 접근 — DOM 순서 의존으로 레이아웃 변경 시 silent breakage 우려 | `schedules-page.test.tsx` `openAddDialog` | `within(banner)` 스코프 한정 | **기능 리스크 없음으로 판단** — 헤더·EmptyState 두 버튼 모두 `onClick={() => setShowDialog(true)}` 로 **동일 다이얼로그**를 연다. 따라서 어느 쪽을 클릭해도 테스트 의도(다이얼로그 오픈)는 충족되어 순서 변경이 silent breakage 를 일으키지 않는다. 또한 격리 렌더에는 app-shell `<header>`(banner role)가 없어 제안된 `getByRole("banner")` 가 적용 불가. 주석으로 근거 보강. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 처리 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `subLabel` 포맷이 spec §4.1 `"Auto-renews · next in <duration>"` 과 불일치(구현 `"· in"`, `next` 누락) | `status-badge.tsx` L92 | 기존 코드, 본 PR 범위 밖 — spec-planner 위임 대상 |
| 2 | REQUIREMENT | 스케줄 spec §2.1 "Run now" 권한 규정 부재(viewer 접근 침묵 영역) | spec | spec-planner 위임 |
| 3–9 | MAINTAINABILITY | 헬퍼/픽스처 중복, `cleanup()` 이중 호출, 상수 미명명 등 | 양 파일 | 비차단 정리 — 후속 |
| 10–11 | DOCUMENTATION | `openAddDialog` DOM 순서 근거·"Stage 10 a11y" 주석 명확화 | `schedules-page.test.tsx` | #2 주석 보강으로 일부 해소 |
| 12 | SCOPE | 이전 리뷰 산출물(13_47_12/) 7개 파일이 changeset 포함 | `review/code/2026/06/28/13_47_12/` | 동작 영향 없음. 리뷰 산출물 커밋 컨벤션상 정상 |
| 13 | TESTING | EmptyState+Editor 버튼 2개 렌더 명시 어서션 없음 | RBAC describe | 후속 보강 후보 |
| 14–15 | TESTING | Calendar 뷰·`handleSubmit` 커버리지 갭(기존 코드) | `schedules/page.tsx` | 기존 코드, 본 PR 범위 밖 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테스트 전용 변경, 공격 표면·시크릿 없음 |
| requirement | LOW | autoRefresh 가드 미구현(기존 TODO), subLabel 포맷 불일치, Run now 권한 침묵 — 모두 기존 코드 |
| scope | NONE | 실질 코드 범위 이탈 없음 |
| side_effect | NONE | 프로덕션 코드 변경 없음, fake timers 정확 격리 |
| maintainability | LOW | 헬퍼/픽스처 중복, cleanup 이중 호출 등 INFO |
| testing | LOW | `addBtns[0]` DOM 순서 의존(기능 리스크 없음), 기존 코드 커버리지 갭 |
| documentation | NONE | 주석 명확화 INFO 만 |

## 결론
Critical 0 / Warning 2. 두 WARNING 모두 **본 flaky-수정 PR 의 변경 자체 결함이 아님**:
- #1 은 기존 코드의 의도적 deferral TODO(spec+backend 동기 필요, 별도 in-progress plan 추적 중) → 본 PR 미반영.
- #2 는 동일 다이얼로그를 여는 두 버튼이라 순서 무관 → 기능 리스크 없음, 주석 보강으로 해소.

flaky 3건(visual↔expression 왕복, humanizeUntil 경계, viewer RBAC false-negative) 수정 자체는 reviewer 전원이 의도 정확·범위 최소로 평가.
