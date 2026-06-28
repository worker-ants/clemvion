# Code Review 통합 보고서

## 전체 위험도
**LOW** — 단일 테스트 파일(schedules-page.test.tsx)의 flaky 수정 변경. Critical 발견 없음. 전체 발견은 INFO 수준이며 기능 동작에 즉각적 영향 없음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 품질 | `viewer` RBAC 테스트에서 `queryByTitle` 사용 — `page.tsx`는 `title` attribute 없이 `aria-label`만 사용하므로 항상 `null` 반환하는 false-negative 상태. 실제 버튼이 렌더되어도 테스트 통과 | `schedules-page.test.tsx` L441–442 | `queryByTitle(/^edit$/i)` → `queryByRole("button", { name: /^edit$/i })` 로 교정 |
| 2 | 테스트 견고성 | `findAllByRole[0]` 인덱스 기반 접근 — 헤더 버튼이 DOM 첫 번째라는 암묵적 순서 가정에 의존. 현재 동작은 올바르나 헤더 레이아웃 변경 시 인덱스 깨짐 위험 | `openAddDialog()`, L42–47 | `within(header element).getByRole(...)` 방식으로 스코프 한정 권고 (즉시 필수 아님) |
| 3 | 테스트 정리 | `afterEach(cleanup)` 와 각 `describe` 블록의 `beforeEach` 내 `cleanup()` 중복 호출. 동작 상 무해하나 cleanup 책임 위치가 불명확 | `afterEach` L89–91, `beforeEach` L105, L149 | `beforeEach` 내 `cleanup()` 제거하고 전역 `afterEach` 로 일원화 |
| 4 | 테스트 커버리지 | Calendar 뷰 모드(`viewMode === "calendar"`) 전환·CalendarView·`calendarSchedulesQuery`·월 이동 경로가 테스트 전혀 없음 | `page.tsx` 전반 (기존 코드) | 캘린더 뷰 전환 시 `/schedules?limit=200` 호출 여부, 뷰 전환 버튼 렌더링 단위 테스트 추가 권고 |
| 5 | 테스트 커버리지 | `handleSubmit` 내 유효성 검사 분기(필수 필드 누락 toast·JSON 파싱 실패·배열/null 오류) 테스트 없음 | `page.tsx` L685–718 (기존 코드) | submit 후 필수 필드 누락·잘못된 JSON 입력 케이스 각 1개 이상 추가 |
| 6 | 유지보수성 | 테스트 픽스처 중복 — `row()` 함수와 pagination 테스트 인라인에서 동일 스케줄 행 오브젝트 구조 반복 | `schedules-page.test.tsx` L176–226 | 파일 수준 `SCHEDULE_ROW_FIXTURE` 상수로 추출 |
| 7 | 유지보수성 | `openEdit` 케이스에서 `apiGetMock.mockImplementation` 인라인 재구현 — `mockSchedulesResponse` 헬퍼 미사용 | `schedules-page.test.tsx` L389–411 | `mockSchedulesResponse`에 workflows 응답 선택적 지원 추가 또는 통합 헬퍼로 리팩터 |
| 8 | 요구사항 추적 | `deleteMessage` 텍스트에 spec §3 "연결된 트리거도 함께 삭제됩니다" 안내 포함 여부 미검증 (기존 코드) | `page.tsx` L928 | 후속 개선 대상으로 기록 |
| 9 | 테스트 커버리지 | EmptyState(빈 목록) + Editor 역할 조합에서 "Add schedule" 버튼 2개 동시 렌더 케이스에 대한 명시적 테스트 없음 | RBAC describe 블록 | `EMPTY_RESPONSE` + `editor` 역할 조합으로 `findAllByRole(...).length === 2` assert 테스트 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | INFO만: `openAddDialog` 수정 의도 정확, spec §2.2.1 fidelity 이상 없음. `queryByTitle` false-positive 기존 코드 문제 |
| scope | NONE | 변경 범위 이탈 없음. 단일 함수 최소 침습 수정 |
| maintainability | LOW | INFO만: 인덱스 의도 표현 부족·`cleanup()` 중복·픽스처 중복·`apiGetMock` 인라인 재구현·쿼리 전략 혼용 |
| testing | LOW | INFO만: `queryByTitle` false-negative, 캘린더 뷰·handleSubmit 커버리지 갭, EmptyState+Editor 조합 테스트 부재 |
| security | success (output 파일 미생성 — 발견 없음으로 간주) | 테스트 전용 변경, 보안 표면 없음 |
| side_effect | success (output 파일 미생성 — 발견 없음으로 간주) | 테스트 전용 변경, 부작용 없음 |

## 발견 없는 에이전트

- **scope**: 변경 범위 이탈 없음. NONE 위험도.

## 권장 조치사항
1. **[즉시 권고]** `viewer` RBAC 테스트의 `queryByTitle` → `queryByRole("button", { name: /^edit$/i })` 교정 (INFO #1) — false-negative로 실제 RBAC 차단을 검증하지 못하는 구조적 결함 (기존 코드, flaky 수정과 무관)
2. **[단기]** `afterEach(cleanup)` 일원화 — `beforeEach` 내 `cleanup()` 중복 제거 (INFO #3)
3. **[단기]** `addBtns[0]` 를 `within(header)` 스코프 한정 방식으로 개선 (INFO #2)
4. **[중기]** 픽스처 `SCHEDULE_ROW_FIXTURE` 상수 추출 및 `mockSchedulesResponse` 헬퍼 통합 (INFO #6, #7)
5. **[중기]** EmptyState + Editor 역할 조합 버튼 2개 렌더 assertion 테스트 추가 (INFO #9)
6. **[향후]** Calendar 뷰·handleSubmit 유효성 검사 커버리지 갭 보완 (INFO #4, #5)

## 라우터 결정

- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (소스 코드 변경 시 항상 적용) — 전부 success
- **제외(router decision)**: `performance`, `architecture`, `documentation`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (8명) — 변경 성격(테스트 전용 단일 함수 수정)에 무관

## 결론
Critical 0 / Warning 0. 자동 후속(resolution-applier) 불필요. INFO 발견은 모두 비차단이며 대부분 기존 코드(flaky 수정 범위 밖) 대상. flaky 수정 자체는 reviewer 전원이 의도 정확·범위 최소로 평가.
