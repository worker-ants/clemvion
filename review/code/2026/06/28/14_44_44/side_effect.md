### 발견사항

- **[INFO]** `vi.useFakeTimers()` — 테스트 파일 범위 전역 타이머 교체
  - 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L47–53
  - 상세: `beforeEach`에서 `vi.useFakeTimers()` + `vi.setSystemTime()`을 호출하고 `afterEach`에서 `vi.useRealTimers()`로 복원한다. 이는 Vitest 글로벌 타이머 상태(`Date`, `setTimeout` 등)를 변경한다. `afterEach`에서 복원이 보장되어 다른 테스트 파일에 누출되지 않는다. 단, 이 `describe` 블록 안에 타이머 기반 비동기(setTimeout/setInterval)가 있는 경우 fake timer에 의해 동작이 달라질 수 있다. 현재 테스트 대상(`computeStatus`, `humanizeUntil`, `computeAttentionBreakdown`)은 모두 순수 함수이며 타이머 비동기를 사용하지 않으므로 의도치 않은 side effect 없음.
  - 제안: 현재 구현 무방. 다만 미래에 비동기 콜백을 검증하는 테스트가 같은 파일에 추가되면 fake timer와 충돌할 수 있으므로 `vi.useFakeTimers({ shouldAdvanceTime: false })`로 명시적 옵션을 지정하는 것을 검토할 수 있다.

- **[INFO]** `vi.setSystemTime` 고정값 하드코딩
  - 위치: `status-badge.test.tsx` L49
  - 상세: `"2026-06-28T00:00:00Z"` 라는 절대 날짜로 시스템 시간을 고정한다. 이 날짜는 미래 날짜이므로 현재 시점(2026-06-28)에 일치하지만, 이후 실행 시각이 이 고정값과 비교하는 어떤 외부 로직이 없는 한 의도치 않은 부작용은 없다. `afterEach`에서 실시간으로 복원되므로 전역 상태 오염 없음.
  - 제안: 현재 구현 무방.

### 요약

변경된 두 소스 파일(`status-badge.test.tsx`, `schedules-page.test.tsx`)은 모두 테스트 전용 코드이며, 프로덕션 상태·전역 변수·파일시스템·네트워크·API 시그니처에 영향을 주지 않는다. `status-badge.test.tsx`의 `vi.useFakeTimers()` 도입은 Vitest 글로벌 타이머 상태를 일시적으로 변경하지만 `afterEach`에서 완전히 복원된다. `schedules-page.test.tsx`의 `findAllByRole`/`queryByRole` 변경은 DOM 쿼리 전략만 바꾸는 것으로 어떤 외부 상태도 변경하지 않는다. 나머지 변경 파일(review artifacts)은 메타데이터·리뷰 산출물로 코드 런타임 부작용이 없다. 의도치 않은 부작용은 발견되지 않았다.

### 위험도
NONE
