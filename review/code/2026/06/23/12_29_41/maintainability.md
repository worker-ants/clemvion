# 유지보수성(Maintainability) 리뷰

## 발견사항

### 가독성 / 네이밍

- **[INFO]** `statisticsApi` 의 모든 메서드가 `StatisticsQueryParams`(`Record<string, string | number | undefined>`) 를 받는다. 타입이 너무 넓어 어떤 파라미터가 필수인지 호출 지점에서 알 수 없다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts` (line 1679)
  - 상세: `getSummary`·`getExecutions`·`getErrors` 는 `period`, `workflowId?`, `startDate?`, `endDate?` 를 받고, `getTopWorkflows` 는 `workflowId` 없이 `period` 만 받는다. 현재 타입은 이 차이를 표현하지 않는다. `executions.ts`·`triggers.ts` 관례에서도 명시적 interface 를 사용하는 패턴이 있다면 일관성이 더 높다.
  - 제안: 점진적 개선(현 PR 범위 밖 가능). `StatisticsQueryParams` 를 공유하되 각 메서드에 `period: string` 필드를 필수로 두는 구체화된 서브타입을 선택적으로 추가하는 것을 고려. 현재도 `lib/api/executions.ts` 관례와 큰 방향은 일치하므로 INFO 수준.

- **[INFO]** `schedules/page.tsx` 의 `calendarSchedulesQuery`에서 하드코딩된 `limit: 200`.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/schedules/page.tsx` (line 247, 구 246)
  - 상세: `{ page: 1, limit: 200 }` 에서 `200` 은 "캘린더 뷰에서 모든 스케줄을 한 번에 가져오기 위한 상한" 이라는 의도가 숫자만으로는 드러나지 않는다. 이 값은 리팩터 이전에도 동일하게 존재했으나 새 API 레이어 도입 이후에도 상수화되지 않았다.
  - 제안: 페이지 내 `const CALENDAR_MAX_SCHEDULES = 200` 으로 명명하거나, `ScheduleListParams` 에 named 기본값/옵션으로 이동. 현재 동작에는 영향 없으므로 INFO.

### 함수 길이 / 코드 복잡도

- **[INFO]** 신규 API 카탈로그 파일들(`dashboard.ts` 63줄, `schedules.ts` 81줄, `statistics.ts` 142줄)은 함수 길이나 복잡도 면에서 모두 양호하다. 각 메서드가 단일 책임(HTTP 호출 + envelope 언래핑)을 갖고, 중첩 깊이 최대 1로 간결하다.

### 중복 코드

- **[INFO]** `dashboard.test.ts`, `schedules.test.ts`, `statistics.test.ts` 세 파일 모두 동일한 `fakeAxios<T>` 헬퍼 함수를 각자 복사해 포함한다.
  - 위치:
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/__tests__/dashboard.test.ts` (line 627)
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/__tests__/schedules.test.ts` (line 807)
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/__tests__/statistics.test.ts` (line 1059)
  - 상세: 동일 시그니처·동일 구현체가 3곳 복제된다. 기존 `executions.test.ts` 등도 동일 패턴을 따른다면 프로젝트 전체 관행이나, 테스트 파일이 늘어날수록 변경 비용이 누적된다.
  - 제안: `__tests__/helpers/fake-axios.ts` 공통 파일로 추출 가능. 현 PR 내 기존 파일(`executions.test.ts` 등)과 패턴 일치 여부 확인 후 판단. INFO 수준.

### 일관성

- **[INFO]** `statistics/page.tsx` 에는 `apiClient` import 가 cross-domain `/workflows` 호출을 위해 잔류한다. 파일 상단에서 두 소스(`apiClient` 직접 + `statisticsApi`)를 혼용하는 형태가 되어 리팩터 의도가 부분적으로 드러난다. 주석으로 "cross-domain — workflows 트랙에서 이전 예정"이 명시되어 있어 의도는 전달되나, 미래 유지보수자가 `apiClient` 잔류를 실수로 오해할 수 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/statistics/page.tsx` (line 354)
  - 제안: 주석 표기로 충분히 완화됨. workflows 트랙 PR 시 제거 예정이므로 현재 조치 불필요. INFO.

- **[INFO]** `schedules/page.tsx` 에서 `// Raw row shape from /schedules lives in lib/api/schedules (RawSchedule).` 단독 주석 줄이 `mapSchedule` 함수 직전에 남는다. 타입 정의가 제거된 후 이 안내 주석이 약간 어색하게 위치한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/schedules/page.tsx` (line 218)
  - 제안: 주석을 `mapSchedule` 함수 JSDoc으로 흡수하거나 제거해도 무방. 미관적 수준, INFO.

## 요약

이번 변경은 페이지별로 산재하던 `apiClient` 직접 호출을 `lib/api/{dashboard,statistics,schedules}.ts` 카탈로그로 집중시키는 전형적인 extract-layer 리팩터로, 유지보수성 관점에서 명확히 긍정적인 방향이다. 각 API 모듈은 단일 책임을 갖고, JSDoc 주석·타입 export 가 갖춰져 있으며, 기존 `executions.ts`·`triggers.ts` 관례를 일관되게 답습하고 있다. 유닛 테스트 17건 신규 추가로 회귀 커버리지도 증가했다. 지적 사항은 전부 INFO 수준으로, `StatisticsQueryParams` 의 넓은 타입·`fakeAxios` 3중 복제·매직 넘버 `200`·잔류 `apiClient` import 혼용이다. 이 중 어느 것도 차단 사유가 아니며, `fakeAxios` 중복은 기존 테스트 관행이 같다면 현 PR 범위에서 해소를 강제할 이유가 없다.

## 위험도

NONE
