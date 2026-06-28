### 발견사항

- **[INFO]** `vi.useFakeTimers()` / `vi.useRealTimers()` — 테스트 파일 전체 타이머 교체
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/frosty-hawking-b08718/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L47-53
  - 상세: `beforeEach`에서 vitest의 전역 타이머를 Fake로 교체하고 `afterEach`에서 Real로 복원한다. 이 패턴은 vitest 설계상 의도된 용도이며, `afterEach`에서 반드시 `vi.useRealTimers()`를 호출하므로 다른 테스트 파일로 타이머 상태가 누수되지 않는다. 단, 동일 파일 내에서 `vi.useFakeTimers()`가 `beforeEach` 스코프 밖(예: 파일 최상위 `describe` 바깥)에 있으면 누수 위험이 있으나, 이 변경은 `beforeEach`/`afterEach` 쌍으로 정확히 감싸져 있어 안전하다.
  - 제안: 현 구조 유지. afterEach 복원이 빠진 경우에만 위험하며 이 코드는 올바르게 작성됨.

- **[INFO]** `vi.setSystemTime(new Date("2026-06-28T00:00:00Z"))` — 하드코딩된 고정 시각
  - 위치: 동일 파일 L49
  - 상세: 시스템 시각을 특정 날짜(2026-06-28)로 고정한다. 이는 테스트 결정성(determinism)을 위한 의도된 부작용이며, `afterEach`에서 복원되므로 다른 테스트에 영향을 주지 않는다. 테스트 자체 내의 `inMinutes`·`inDaysIso` 헬퍼도 동일한 `Date.now()` 기반으로 계산하므로 일관성이 유지된다.
  - 제안: 무해. 추가 조치 불필요.

- **[INFO]** `schedules-page.test.tsx` — 파일 수준 `afterEach(cleanup)` 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/frosty-hawking-b08718/codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` L520-522
  - 상세: 파일 수준에 `afterEach(() => { cleanup(); })`가 추가되었다(기존 코드에 이미 존재하는 형태). `cleanup()`은 Testing Library의 표준 DOM 정리 함수로, React 렌더 트리를 언마운트하고 DOM을 초기 상태로 되돌린다. 이는 테스트 간 DOM 누수를 방지하기 위한 의도된 부작용 제어이며, 부작용을 일으키는 것이 아니라 방지하는 코드다. 각 `describe` 블록의 `beforeEach`에서도 `cleanup()`을 중복 호출하지만(기존 코드), 이는 무해하다.
  - 제안: 의도대로 동작함. 중복 cleanup 제거(유지보수성 관점 별도 권고사항)는 부작용 위험 아님.

- **[INFO]** `queryByTitle` → `queryByRole("button", { name: ... })` 쿼리 방식 변경
  - 위치: 동일 파일 L384-390 (diff 기준)
  - 상세: 테스트 쿼리 전략을 `queryByTitle`에서 `queryByRole`로 변경한다. 이는 테스트 내부 동작 변경이며 프로덕션 코드의 시그니처, 전역 상태, 네트워크 호출 등 어떤 외부 상태에도 영향을 주지 않는다.
  - 제안: 부작용 없음.

- **[INFO]** `review/` 경로 산출물 파일 신규 생성 (SUMMARY.md, _retry_state.json, maintainability.md)
  - 위치: `review/code/2026/06/28/13_47_12/` 하위 다수 파일
  - 상세: 이 파일들은 코드 리뷰 파이프라인의 산출물로 의도적으로 생성된 것이다. 프로젝트 규약(`CLAUDE.md`)상 `review/code/<YYYY>/<MM>/<DD>/…`가 정해진 저장 위치이며, 예기치 않은 파일시스템 부작용이 아니다.
  - 제안: 부작용 없음.

### 요약

이번 변경은 순수 테스트 파일 2개(status-badge.test.tsx, schedules-page.test.tsx)와 리뷰 산출물 파일 3개로 구성된다. 프로덕션 코드 변경이 전혀 없으므로 전역 변수·함수 시그니처·공개 API·환경 변수·네트워크 호출·이벤트/콜백 관련 부작용은 발생하지 않는다. `vi.useFakeTimers()`를 통한 전역 타이머 교체는 `beforeEach`/`afterEach` 쌍으로 정확히 격리되어 있어 테스트 간 상태 누수가 없으며, Testing Library의 `cleanup()` 추가도 DOM 누수 방지를 위한 의도된 정리 코드다. 모든 변경은 테스트 결정성 확보와 flaky 제거를 목적으로 한 최소 침습 수정이며, 의도치 않은 부작용이 없다.

### 위험도
NONE
