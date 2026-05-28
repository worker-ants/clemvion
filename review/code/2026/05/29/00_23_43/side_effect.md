# 부작용(Side Effect) 리뷰

검토 대상: triggers-auth-column 변경 세트 (파일 1~11)
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] `mockTriggersResponse` 시그니처 변경 — 기존 호출자 영향 없음
- 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` — `mockTriggersResponse` 함수 정의
- 상세: `body: unknown` 단일 파라미터에서 `(body: unknown, authConfigs: unknown[] = [])` 로 확장됐다. 두 번째 인자에 기본값 `= []` 가 설정되어 있으므로 기존의 모든 단일 인자 호출(`pagination`, `RBAC` describe 블록)은 동작 변경 없이 그대로 유효하다. 단, `apiGetMock.mockImplementation` 내부에 `/auth-configs` 분기가 추가되어 기존 테스트에서도 `/auth-configs` 요청이 발생할 경우 빈 배열(`[]`)을 반환하게 된다. 기존 테스트가 `/auth-configs` 응답을 검증하지 않으므로 실질적 영향은 없다.
- 제안: 현 구조 유지 가능. 다만 향후 단일 인자로 호출하는 테스트에서 `/auth-configs` 가 `[]`로 mock 된다는 점을 주석으로 명시하면 유지보수 시 의도가 명확해진다.

### [INFO] `useAuthConfigs` 훅을 `auth-config-select.tsx` 에서 재사용 — 공유 queryKey 캐시 부작용
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 ~524 (`const { data: authConfigs = [] } = useAuthConfigs();`)
- 상세: `useAuthConfigs` 는 `queryKey: ["auth-configs"]` 를 사용한다. `page.tsx` 가 동일 훅을 호출하므로 React Query 공유 캐시에 의해 `AuthConfigSelect` 컴포넌트가 이미 로드한 데이터를 재사용하거나, 반대로 page 레벨에서 먼저 fetch 된 캐시를 `AuthConfigSelect` 가 소비한다. 이는 의도된 동작(stale-while-revalidate 공유)이며 부정적 부작용이 아니다. 단, 캐시가 만료(stale)된 상태에서 두 컴포넌트가 동시에 마운트되면 단일 네트워크 요청만 발생하므로(React Query deduplication) 예상치 못한 이중 요청도 발생하지 않는다.
- 제안: 부작용 없음. 현 설계 적절.

### [INFO] `authConfigById` Map 이 렌더 사이클마다 재생성
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 ~524 (`const authConfigById = new Map(authConfigs.map((c) => [c.id, c]));`)
- 상세: `authConfigs` 배열이 변경되지 않아도 컴포넌트가 리렌더링될 때마다 새 `Map` 인스턴스가 생성된다. 이는 전역 상태나 공유 상태를 변경하는 부작용이 아니고 렌더 스코프 지역 변수이므로 의도치 않은 상태 변경에 해당하지 않는다. 성능상으로도 `authConfigs` 가 수십~수백 개 수준이면 영향이 미미하다.
- 제안: 엄격한 최적화를 원한다면 `useMemo(() => new Map(...), [authConfigs])` 를 적용할 수 있으나 부작용 관점의 수정 필요사항은 아니다.

### [INFO] i18n 딕셔너리 키 추가 — 다른 로케일 딕셔너리 영향 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`, `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: `authConfigured`·`authUnauthenticatedWarning` 두 키가 `en`·`ko` 양쪽에 모두 추가됐다. 추가(append)이며 기존 키 변경·제거가 없으므로 기존 소비자에게 영향이 없다. TypeScript `Dict` 타입이 `en` 딕셔너리를 기준으로 타입을 도출한다면 `ko` 누락 시 컴파일 오류가 발생하는 구조인데, 양쪽 모두 동일 키를 추가하여 타입 정합성이 유지된다.
- 제안: 현 구조 문제없음.

### [INFO] 새 `<th>` 컬럼 삽입 — 테이블 레이아웃 열 수 변경
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 ~533 (`<th>` Authentication 추가), 라인 ~655 (`<td>` 인증 셀 추가)
- 상세: `<th>` 와 `<td>` 가 동일 행 위치에 함께 추가되어 열 수가 일치한다. `colSpan` 을 사용하는 "빈 상태(empty)" 셀이 있는 경우 해당 값 갱신 여부를 확인해야 한다.
- 제안: 실제 `colSpan` 사용 여부 확인이 필요하다. 만약 "No triggers" 같은 `<td colSpan={N}>` 셀이 page.tsx 에 있다면 N 값이 기존 열 수를 가리키므로 새 열 추가 후 N+1 로 갱신해야 한다. 아래 별도 항목으로 분류.

### [WARNING] `colSpan` 미갱신 가능성 — 빈 상태 행 레이아웃 깨짐
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — 빈 상태(empty state) `<td colSpan>` 셀 (diff에 미포함된 기존 영역)
- 상세: 테이블에 열을 추가할 때 빈 상태를 표시하는 `<td colSpan={기존 열 수}>` 가 업데이트되지 않으면 빈 상태 행이 전체 테이블 너비를 채우지 못한다. 이는 렌더링 부작용(의도치 않은 레이아웃 변경)이다. diff 에 해당 행 수정이 포함되어 있지 않아 누락됐을 가능성이 있다.
- 제안: page.tsx 내 `colSpan` 이 사용된 모든 위치를 검색하여 새 열 수(기존 +1)로 갱신되었는지 확인한다.

### [INFO] plan·review 산출물 파일 추가 — 애플리케이션 런타임 부작용 없음
- 위치: `plan/in-progress/spec-draft-triggers-auth-column.md`, `plan/in-progress/triggers-auth-column.md`, `review/consistency/2026/05/29/00_03_34/` 하위 파일들
- 상세: 이 파일들은 순수 문서·메타데이터로서 애플리케이션 빌드·런타임·테스트에 포함되지 않는다. 파일시스템에 생성되는 부작용이지만 의도된 산출물이다. `_retry_state.json` 의 절대경로 하드코딩(`/Volumes/project/private/clemvion/...`)은 다른 개발 환경에서 해당 파일을 읽을 경우 경로 불일치가 발생할 수 있으나, 이 파일은 orchestrator 내부 상태 추적용으로 다른 환경에서 재사용되지 않는다.
- 제안: 부작용 없음.

---

## 요약

이번 변경은 프론트엔드 트리거 목록 페이지에 "인증" 열을 추가하는 순수 UI 증분이다. 핵심 상태 변경은 `Trigger` 인터페이스에 `authConfigId` 필드가 추가되고, 기존 `useAuthConfigs` 훅이 page 컴포넌트 레벨에서 재사용되는 두 가지이며, 두 변경 모두 공유 상태를 오염시키거나 예상 외 네트워크 호출을 유발하지 않는다. `mockTriggersResponse` 시그니처 확장은 기본값 처리가 올바르게 설정되어 기존 테스트에 영향을 주지 않는다. 유일하게 실질적 위험은 테이블에 열이 추가될 때 빈 상태 행의 `colSpan` 이 함께 갱신되지 않았을 가능성(WARNING)이며, 이 부분은 diff 외 영역이라 직접 확인이 필요하다. 그 외 전역 변수 도입, 환경 변수 읽기/쓰기, 의도치 않은 외부 서비스 호출, 이벤트/콜백 변경은 발견되지 않았다.

---

## 위험도

LOW
