### 발견사항

---

**[INFO]** 리뷰 대상 파일이 전부 문서(Spec, Review `.md`) 및 메타데이터(`.json`)로, 실제 `package.json` 변경이 없음
- 위치: 전체 파일 세트
- 상세: 의존성 추가·삭제·버전 변경이 없음. 의존성 직접 변경 리스크는 없음
- 제안: 해당 없음

---

**[WARNING]** `(data as any).data ?? data` 패턴이 여러 `queryFn`에 반복 — 런타임 타입 검증 라이브러리 부재
- 위치: `[executionId]/page.tsx` L105-109, L117-124 / `executions/page.tsx` L152-156 (maintainability/review.md, security/review.md 공통 지적)
- 상세: API 응답 구조 불일치를 `as any` 캐스팅으로 임시 처리하고 있음. 이는 런타임 타입 검증 라이브러리(`zod`, `valibot` 등)가 없거나, 있어도 API 레이어에서 활용되지 않고 있다는 신호. `zod`가 이미 프로젝트에 포함되어 있다면 중복 의존성 없이 해결 가능하나, 없다면 추가 여부를 검토해야 함
- 제안: 먼저 `frontend/package.json`에 `zod`가 이미 존재하는지 확인. 존재하면 API 응답 스키마를 정의하여 `queryFn` 내에서 `schema.parse(data)`로 검증. 없으면 도입 비용 대비 효과를 평가 후 결정

---

**[INFO]** `vi.clearAllMocks()` 후 모듈 레벨 mock 구현 소실 — 테스트 유틸 의존 패턴 문제
- 위치: `execution-detail-page.test.tsx` / `execution-list-page.test.tsx` (testing/review.md, side_effect/review.md 공통 지적)
- 상세: `vitest`의 `vi.clearAllMocks()`는 mock 호출 이력과 구현을 함께 초기화함. `vi.mock()`으로 모듈 레벨에서 `mockResolvedValue`를 설정한 경우 `clearAllMocks` 이후 구현이 사라져 테스트 순서 의존성이 발생. 이는 `vitest` API 의존 방식의 오해에서 비롯된 것으로, `vi.resetAllMocks()` 혹은 `vi.restoreAllMocks()`와 혼동한 사례
- 제안: `beforeEach`에서 mock 구현을 명시적으로 재설정하거나, `vi.clearAllMocks()` 대신 호출 이력만 초기화하는 `vi.clearAllMocks()`의 범위를 제한

---

**[INFO]** `Array.from({ length: totalPages })` — 서버 응답값을 검증 없이 DOM 생성에 직접 사용
- 위치: `executions/page.tsx` Pagination 섹션 (security/review.md 지적)
- 상세: `totalPages`가 서버 응답에서 오므로 비정상적으로 큰 값이 들어오면 DOM 노드 폭증. 별도 상한선 클램핑 유틸 없이 인라인 처리 중
- 제안: `Math.min(totalPages, MAX_PAGE_COUNT)` 인라인 처리로 충분하며, 별도 라이브러리 도입 불필요

---

**[INFO]** `JsonViewer` 컴포넌트에 `React.memo` 미적용 — React 내장 최적화 미활용
- 위치: `[executionId]/page.tsx` JsonViewer 컴포넌트 (performance/review.md 지적)
- 상세: `JSON.stringify` 비용을 매 렌더마다 부담. `React.memo` 또는 `useMemo`는 이미 프로젝트 의존성에 포함된 React 내장 기능으로, 추가 라이브러리 없이 해결 가능
- 제안: 별도 의존성 추가 없이 `React.memo(JsonViewer)` 또는 `useMemo(() => JSON.stringify(data, null, 2), [data])` 적용

---

### 요약

이번 변경 세트는 전부 문서(Spec, Review)와 메타데이터로 구성되어 있어, `package.json`에 신규 외부 의존성이 추가되거나 버전이 변경된 사항은 없다. 의존성 관점에서 주목할 이슈는 코드 리뷰들이 공통으로 지적한 **API 응답 타입 불일치 처리**로, 현재 `as any` 캐스팅으로 임시 처리되는 구간에 `zod` 같은 런타임 검증 라이브러리 도입 여부가 유일한 의존성 의사결정 포인트다. 나머지 발견사항(React.memo, Math.min 클램핑, vitest mock 패턴)은 모두 기존 의존성 내에서 해결 가능하며 신규 패키지 추가를 요구하지 않는다.

### 위험도

**LOW**