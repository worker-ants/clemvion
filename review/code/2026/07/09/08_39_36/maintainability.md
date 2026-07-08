# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 실행 상세 경로 템플릿(`/workflows/${workflowId}/executions/${id}`)이 동일 파일 내 2곳에 리터럴 중복 — 이번 버그의 재발 소지
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` — 원본 링크(약 1003-1007행) `buildWorkspaceHref(slug, \`/workflows/${original.workflowId}/executions/${original.id}\`)` 와, 이번에 수정한 재실행 성공 라우팅(약 971-975행) `buildWorkspaceHref(slug, \`/workflows/${original.workflowId}/executions/${result.id}\`)`.
  - 상세: 커밋 메시지 자체가 밝히듯 이번 real bug 는 "동일 URL 패턴의 두 번째 인스턴스를 멀티라인 표기 때문에 grep 이 놓쳐서" 발생했다. 즉 이 파일은 같은 경로 템플릿을 두 곳에 하드코딩해두는 구조이고, 향후 경로 형식이 바뀌거나(예: 쿼리 파라미터 추가) 세 번째 사용처가 늘어나면 동일한 종류의 누락이 재발할 여지가 그대로 남아있다. 이번 수정은 증상(누락된 한 곳)만 고쳤을 뿐 구조적 원인(중복 리터럴)은 그대로다.
  - 제안: `buildExecutionHref(slug, workflowId, executionId)` 같은 작은 헬퍼로 두 호출부를 통합하면 향후 경로 형식 변경이 단일 지점 수정으로 끝나고, "누락된 인스턴스"라는 버그 클래스 자체가 구조적으로 제거된다. RESOLUTION 에 defer 로 기록된 W3(open-redirect 유틸 통합)와는 별개로, 이 파일 내부 지역적 중복은 낮은 비용으로 지금 해소 가능한 항목이다.

- **[INFO]** 신규 slug 라우팅 테스트가 인접 테스트와 셋업 코드를 거의 그대로 반복
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` — "Re-run 버튼 → reRun API 호출 후 새 실행 상세로 라우팅"(약 290-309행)과 바로 다음 "re-run 성공 후 활성 워크스페이스가 있으면 slug 경로로 라우팅한다"(약 311-329행)가 `apiGetMock`/`apiPostMock`/`seedDefinitions`/`renderModal`/클릭/`waitFor` 시퀀스를 동일하게 반복하고, 차이는 `useWorkspaceStore.setState(...)` 유무와 기대 경로뿐.
  - 상세: 두 테스트가 나란히 배치되어 있어 "bare path vs slug path" 대비를 읽기는 쉽지만, 반복되는 5줄가량의 mock 셋업이 공용 헬퍼로 추출되지 않아 향후 API 응답 형태가 바뀌면 두 곳을 함께 고쳐야 한다.
  - 제안: 필수 수정 사항은 아님(테스트 코드의 명시성을 위해 의도적 반복을 허용하는 스타일도 흔함). 다만 같은 파일에 유사 셋업이 3곳 이상으로 늘어나면 `renderAndSubmit()` 류의 작은 헬퍼 추출을 권장.

- **[INFO]** `it.each` 테이블의 튜플 타입이 넓혀져 콜백 내부에서 수동 캐스팅 필요
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` 약 1353-1368행.
  - 상세: 배열 리터럴 `["label", slug, input, expected]` 의 각 원소 타입이 `string | null` 로 유니온 추론되어, 콜백 파라미터에 `(slug as string | null, input as string)` 캐스트가 필요하다. 기능상 문제는 없으나 타입 안전성이 약간 느슨해진다.
  - 제안: 필요 시 `as const` 튜플 배열이나 명시적 타입 파라미터(`it.each<[string, string | null, string, string]>`)로 캐스트 없이 타입을 좁힐 수 있음. 저비용 개선이라 우선순위는 낮음.

## 요약

핵심 변경(`rerun-modal.tsx` 의 `buildWorkspaceHref` 적용)은 최소 diff 로 파일 내 기존 패턴(원본 실행 ID 링크)과 완전히 일관된 방식으로 수정되어 가독성·일관성 면에서 우수하다. 테스트 추가(슬러그 라우팅 회귀, `workspace-store.setWorkspaces` 4케이스, `href.test.ts` 의 `it.each` 테이블화)도 기존 서술 스타일(한국어 테스트명, 상수 재사용)과 잘 맞고 오히려 `it.each` 전환은 이전보다 중복을 줄여 개선에 해당한다. 다만 이번 버그의 근본 원인이 "같은 URL 템플릿이 파일 내 두 곳에 하드코딩되어 grep 기반 점검에서 한쪽이 누락됨"이라는 점을 감안하면, 증상만 고치고 구조적 중복(경로 템플릿 리터럴)은 남아있어 동일 클래스의 회귀가 재발할 여지가 있다 — 작은 헬퍼 추출로 해소 가능한 저비용 개선이다. 나머지는 테스트 코드 수준의 사소한 개선 여지(INFO)뿐이며, 전체적으로 유지보수성 관점의 리스크는 낮다.

## 위험도
LOW
