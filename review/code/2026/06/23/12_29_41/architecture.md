# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 레이어 책임 분리 — 올바른 방향의 리팩터링
- 위치: `codebase/frontend/src/lib/api/dashboard.ts`, `statistics.ts`, `schedules.ts` (신규)
- 상세: 기존 페이지 컴포넌트(`dashboard/page.tsx`, `statistics/page.tsx`, `schedules/page.tsx`)가 `apiClient`를 직접 호출해 응답 envelope 언래핑까지 담당하던 구조에서, 데이터 접근 로직을 `lib/api/*` 카탈로그 레이어로 분리했다. 프레젠테이션 레이어(페이지)는 도메인 함수 호출만 남고, envelope 처리 규칙(`unwrap`, `normalizePagedResponse`)은 데이터 레이어에 집중된다. 레이어 책임 분리 관점에서 긍정적인 변경이다.
- 제안: 없음.

### [INFO] SOLID — 단일 책임 원칙 준수
- 위치: `lib/api/dashboard.ts`, `lib/api/statistics.ts`, `lib/api/schedules.ts`
- 상세: 각 파일이 단일 도메인(dashboard/statistics/schedules)의 API 호출만 담당하며 타입 정의도 동일 파일에 응집되어 있다. 뷰모델 매핑(`mapSchedule`)은 페이지에 남겨 데이터 계층과 표현 계층의 책임을 명시적으로 분리했다. `RawSchedule`을 카탈로그에 두고 `Schedule`(뷰모델)을 페이지에 남긴 설계는 DIP 관점에서도 적절하다.
- 제안: 없음.

### [WARNING] `executions.ts` 내 로컬 `unwrap` 함수와 `lib/api/unwrap.ts` 간 중복
- 위치: `codebase/frontend/src/lib/api/executions.ts` lines 107–111 (기존 코드, 이번 변경에서 수정되지 않음)
- 상세: `executions.ts`에 로컬 `unwrap<T>` 함수가 정의되어 있고, 이번 변경에서 신설된 `unwrap.ts`가 동일한 동작을 하는 공유 유틸로 도입되었다. `dashboard.ts`와 `statistics.ts`는 `unwrap.ts`를 임포트하지만 `executions.ts`는 여전히 자체 복사본을 사용한다. 이 불일치는 이번 PR 에서 직접 생성된 것이 아닌 기존 기술 부채이나, 새로운 카탈로그 파일들이 `unwrap.ts`를 SoT 로 확립한 시점에서 `executions.ts` 의 로컬 복사본이 명시적으로 제거되지 않으면 향후 두 구현이 발산할 위험이 있다.
- 제안: 별도 PR 에서 `executions.ts` 의 로컬 `unwrap` 를 `import { unwrap } from "./unwrap"` 로 교체한다. 이번 PR 범위(`behavior-preserving` 리팩터) 외이므로 defer 가능하나 기술 부채 등록 권장.

### [INFO] `StatisticsQueryParams` 타입의 느슨한 타이핑
- 위치: `codebase/frontend/src/lib/api/statistics.ts` lines 1679–1682
- 상세: `StatisticsQueryParams = Record<string, string | number | undefined>` 는 통계 API가 받는 실제 파라미터(`period`, `workflowId`, `startDate`, `endDate`, `format`)를 타입 수준에서 표현하지 않는다. 현재 6개 메서드가 동일한 제네릭 타입을 사용해 각 엔드포인트에 불필요한 키가 전달되어도 컴파일 시점에 감지되지 않는다. 이것은 아키텍처 문제라기보다 타입 정밀도 trade-off 로, 호출 사이트의 spread 패턴(`{ period, workflowId, ...rangeParams }`)과 결합하면 실용적인 선택이다.
- 제안: 이번 behavior-preserving 리팩터 범위에서는 현상 유지가 적절하다. 향후 통계 API 변경 시 per-method 파라미터 타입으로 세분화 고려.

### [INFO] `schedules.ts` — `update` 메서드의 과부하된 파라미터 타입
- 위치: `codebase/frontend/src/lib/api/schedules.ts`, `UpdateScheduleBody` 인터페이스
- 상세: `update(id, body: UpdateScheduleBody)`는 "전체 편집"과 "isActive 토글"이라는 의미상 다른 두 유스케이스를 하나의 메서드로 처리한다. 현재는 `UpdateScheduleBody`의 모든 필드가 optional이어서 `{ isActive: false }` 도 `{ name, cronExpression, timezone, parameterValues }` 도 동일한 시그니처로 전달된다. 두 유스케이스를 같은 PATCH 엔드포인트로 처리하는 백엔드 API 계약을 그대로 반영한 구조이므로 프론트 카탈로그의 책임 범위 내 결정이다.
- 제안: 없음 — 백엔드 API 계약 반영 의도적 설계. 이후 두 유스케이스가 다른 엔드포인트로 분리될 경우 `toggle(id, isActive)` / `edit(id, body)` 로 분리하면 된다.

### [WARNING] cross-domain `/workflows` 호출 잔류 — 모듈 경계 미완
- 위치: `codebase/frontend/src/app/(main)/statistics/page.tsx` line 438, `schedules/page.tsx` line 256
- 상세: `statistics/page.tsx`와 `schedules/page.tsx`가 각각 `/workflows` 엔드포인트를 `apiClient` 직접 호출로 남겨두고 있다. 이번 커밋은 의도적으로 "workflows 트랙으로 이전 예정"이라는 주석과 함께 defer 했으나, 이 잔류 호출은 "페이지 컴포넌트는 도메인 카탈로그만 사용한다"는 아키텍처 목표의 예외 상태를 지속시킨다. 특히 두 페이지가 동일한 `apiClient.get("/workflows")` 호출을 각자 보유해 동일 cross-domain 호출이 두 곳에 복제된 상태다.
- 제안: workflows 트랙 PR 에서 `workflowsApi.list()` 또는 동등한 카탈로그 함수로 통합. 현 PR 범위는 behavior-preserving 이므로 defer 적절하나 plan 에 명시적 추적 항목으로 등록 권장.

### [INFO] 순환 의존성 없음 — 확인
- 위치: `lib/api/*` 파일 전체
- 상세: `dashboard.ts`가 `executions.ts`의 `ExecutionTriggerSource`를 `import type`으로만 참조하며, 역방향 참조는 없다. `statistics.ts`, `schedules.ts`는 `client.ts`, `unwrap.ts`, `paginated.ts`만 참조. 순환 의존성 없음.
- 제안: 없음.

### [INFO] 확장성 — 개방-폐쇄 원칙 준수
- 위치: `lib/api/statistics.ts` (7개 메서드), `lib/api/schedules.ts` (5개 메서드)
- 상세: 각 카탈로그 파일은 새로운 엔드포인트를 메서드 추가로만 확장할 수 있는 구조다. `unwrap` / `normalizePagedResponse` 유틸을 공유하므로 envelope 처리 방식 변경 시 단일 지점만 수정하면 된다. `exportStats`가 blob 응답을 분기 처리하는 방식도 동일 파일 내에서 자연스럽게 확장 가능하다.
- 제안: 없음.

## 요약

이번 변경은 페이지 컴포넌트가 직접 담당하던 API 호출 및 응답 언래핑 로직을 `lib/api/*` 도메인 카탈로그로 추출하는 명확한 레이어 책임 분리 작업으로, 아키텍처 방향성이 올바르다. `unwrap` / `normalizePagedResponse` 공유 유틸을 통해 envelope 처리 일관성을 확보했으며 순환 의존성도 없다. 주요 잔류 이슈는 두 가지다: `executions.ts` 내 로컬 `unwrap` 복사본이 `unwrap.ts`와 이중화되어 발산 위험이 있고(Warning, defer 가능), statistics/schedules 페이지의 cross-domain `/workflows` 직접 호출이 아키텍처 목표의 예외 상태로 남아 있다(Warning, workflows 트랙에서 해소 예정). 두 건 모두 이번 PR 의 behavior-preserving 범위를 벗어나므로 차단 사유가 아니며, 후속 트랙에서 추적하면 충분하다.

## 위험도

LOW
