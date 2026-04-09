### 발견사항

---

**[INFO]** 변경된 파일 전체가 스펙 문서 및 리뷰 마크다운으로, 실제 코드 의존성 변경 없음
- 위치: 전 파일
- 상세: `package.json`, `import` 구문, 외부 라이브러리 추가가 전혀 없음. 의존성 관점에서 직접적인 위험은 없음

---

**[WARNING]** 내부 모듈 의존성 분산 — 공유 유틸 부재로 인한 중복 의존
- 위치: `documentation/review.md`, `maintainability/review.md`
- 상세: `formatDuration`, `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`이 두 파일에 복사됨. 공유 모듈(`@/lib/utils/execution-status.ts`, `@/lib/utils/duration.ts`)로 추출되지 않아 두 파일이 동일 로직에 **암묵적으로 의존**하지만 동기화 메커니즘 없음. 상태값 추가 시 한쪽만 업데이트될 경우 런타임 불일치 발생
- 제안: 공유 모듈로 추출하여 단방향 의존 구조로 정리

---

**[WARNING]** API 클라이언트 레이어 미추상화로 인한 분산 의존
- 위치: `maintainability/review.md`, `side_effect/review.md`
- 상세: `(data as any).data ?? data` 패턴이 각 `queryFn`마다 반복됨. `executionsApi`, `workflowsApi` 클라이언트가 응답 정규화를 책임지지 않아, 페이지 컴포넌트들이 API 응답 구조에 직접 의존함. axios interceptor 또는 API 클라이언트 내부에서 한 번만 처리해야 할 로직이 UI 레이어에 산재
- 제안: API 클라이언트 레이어(`executionsApi`, `workflowsApi`)에서 `data.data ?? data` unwrapping을 처리하여 컴포넌트가 정규화된 타입에만 의존하도록 분리

---

**[INFO]** `zod` 미도입으로 인한 런타임 타입 검증 부재
- 위치: `security/review.md`
- 상세: 보안 리뷰에서 `zod` 도입을 제안하고 있으나 현재 의존성에 없음. `as any` 캐스팅이 API 응답의 타입 안전성을 우회하고 있어 예상치 못한 구조의 응답 시 런타임 오류 위험. 신규 외부 의존성 추가 여부 결정 필요
- 제안: `zod` 도입 여부를 명시적으로 결정하거나, 기존 TypeScript 타입만으로 충분한 수준의 타입 정의를 API 클라이언트에서 제공

---

**[INFO]** `adjacentQuery`의 `limit: 100` — 내부 API 의존 구조 문제
- 위치: `performance/review.md`, `requirement/review.md`
- 상세: prev/next 탐색을 위해 목록 API(`/api/executions/workflow/:workflowId`)에 `limit: 100`으로 의존함. 현재 백엔드 API 스펙에 adjacent 전용 엔드포인트가 없어 클라이언트가 불필요하게 대량 데이터를 요청하는 구조. 내부 API 계약의 불완전함이 프론트엔드 구현에 영향을 미치는 사례

---

### 요약

이번 변경은 스펙 문서와 코드 리뷰 마크다운으로만 구성되어 외부 패키지 의존성 추가, 버전 충돌, 라이선스 문제는 전혀 없다. 의존성 관점에서 주목할 이슈는 **내부 모듈 의존 구조**에 있다: `formatDuration`과 상태 상수의 중복이 두 컴포넌트 간 암묵적 중복 의존을 형성하고, API 응답 정규화 로직이 클라이언트 레이어가 아닌 UI 컴포넌트에 분산되어 의존 방향이 역전되어 있다. `adjacentQuery`의 `limit: 100` 패턴은 현재 API 스펙의 공백에서 비롯된 불가피한 의존이지만, 백엔드에 adjacent 전용 엔드포인트가 추가되면 즉시 교체가 필요한 기술 부채다.

### 위험도

**LOW**