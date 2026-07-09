# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `buildWorkspaceHref` 내부 동작 변경(선두 슬래시 정규화) — 시그니처는 불변이나 반환값 계산 로직이 바뀜
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:15` (`const clean = \`/${String(path).replace(/^\/+/, "")}\`;`)
  - 상세: 기존 `path.startsWith("/") ? path : \`/${path}\`` 대신 선두의 연속 슬래시를 전부 제거 후 단일 슬래시를 재부착. 함수 시그니처(`(slug, path) => string`)는 유지되어 호출자 코드 변경은 불필요하지만, `//host/x` 같은 protocol-relative 입력의 반환값이 이전엔 그대로 통과(`//host/x`)했다면 이제 `/host/x`로 바뀐다 — 의도된 open-redirect 방어(W4)이므로 이 자체는 문제 아님. 저장소 내 `buildWorkspaceHref(` 호출부 약 50곳을 전수 확인한 결과 전부 단일 선두 슬래시를 가진 정적/템플릿 경로만 전달하고 있어(예: `` `/integrations/${id}` ``, `` `/schedules?triggerId=${id}` ``) 기존 호출자 어디에도 회귀가 없음을 확인함.
  - 제안: 조치 불필요(이미 검증됨). 향후 이 함수에 사용자 제어 문자열(예: 외부 redirect 파라미터)을 그대로 넘기는 새 호출부가 생기면 이번 정규화가 유일한 방어선이 되므로 회귀 테스트(`href.test.ts`)를 계속 최신 상태로 유지할 것.

- **[INFO]** 테스트가 실제(비-mock) zustand 싱글턴 store 를 직접 조작
  - 위치: `codebase/frontend/src/lib/integrations/__tests__/use-cafe24-pending-polling.test.tsx:73-75, 423-430`, `use-makeshop-pending-polling.test.tsx:85-87, 559-566`
  - 상세: 두 테스트 파일 모두 `@/lib/stores/workspace-store` 를 mock 하지 않고 프로덕션 싱글턴 `useWorkspaceStore` 를 `beforeEach` 에서 `.getState().reset()` 하고, 신규 케이스에서 `setState({...})` 로 전역 상태를 직접 덮어씀. 파일 내부에서는 매 테스트 전 리셋이 적용되어 누수가 없음을 확인했으나(주석에도 명시), Vitest 가 동일 워커/스레드에서 여러 테스트 파일을 순차 실행하는 구성일 경우 이 파일의 마지막 테스트가 `afterEach` 없이 `setState` 된 값을 남기고 종료하면(예: workspaces 배열이 비지 않은 채) 다음에 로드되는 다른 테스트 파일이 store 를 import 하는 시점의 초기값에 영향을 줄 여지가 이론상 존재. 단, 각 테스트 파일이 자체 `beforeEach` 에서 `reset()` 을 호출하므로 실질 위험은 낮음.
  - 제안: 현재 조치로 충분. 추가 안전판이 필요하면 `afterEach` 에도 `useWorkspaceStore.getState().reset()` 을 넣어 파일 종료 후 상태를 정리해 두는 것을 권장(낮은 우선순위).

- **[INFO]** 리뷰 산출물(비-코드 파일)이 기능 커밋에 동봉되어 파일시스템에 신규 생성됨
  - 위치: `review/code/2026/07/08/18_24_41/{RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json, architecture.md, maintainability.md, requirement.md, security.md, testing.md}` (파일 10~18)
  - 상세: 실제 애플리케이션 동작에는 영향 없는 이전 ai-review 세션의 산출물이며, 프로젝트 컨벤션상 `review/` 는 git-tracked 디렉터리이므로 커밋에 포함되는 것 자체는 정상 워크플로. side-effect 관점에서 "예상치 못한 파일 생성"은 아니나, 코드 변경 diff 를 읽는 리뷰어 입장에서 노이즈가 크므로 명시적으로 구분해 기록.
  - 제안: 조치 불필요.

- **[정상]** `resolveFallbackWorkspace` 추출은 순수 함수이며 기존 인라인 로직과 동일한 반환값을 산출
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts`, 소비처 `app/(main)/[...rest]/page.tsx:34`, `app/(main)/w/[slug]/layout.tsx:57`
  - 상세: 기존 `workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]` (결과가 `undefined` 일 수 있음)를 `... ?? workspaces[0] ?? null` 로 명시적 `null` 반환하도록 정리했을 뿐, 두 호출부 모두 `if (!active) return;` / `if (fallback) {...}` 로 falsy 값을 동일하게 처리하므로 동작 변화 없음. 외부 상태를 읽기만 하고 어떤 것도 변경하지 않는 순수 함수 — 전역 상태·부수효과 없음.
  - 제안: 없음(양호).

- **[정상]** 시그니처/공개 인터페이스 변경 없음
  - 상세: `buildWorkspaceHref(slug, path)` 시그니처 불변, 신규 export `resolveFallbackWorkspace(workspaces, currentWorkspaceId)` 는 addition-only(기존 호출자에 영향 없음). 전역 변수 신규 도입 없음(기존 `workspace-store.ts` 의 모듈 스코프 `latestSwitchTarget` 은 이번 diff 밖, 미변경). 환경 변수·네트워크 호출·이벤트/콜백 발생 지점 변경 없음.

## 요약
이번 diff 는 순수 프론트엔드 라우팅 리팩터(폴백 로직 추출)와 보안 강화(open-redirect 방어), 그리고 신규/보강 단위테스트로 구성되어 있으며, 실질적인 부작용 위험은 낮다. `buildWorkspaceHref` 의 동작 변경은 전체 호출부(약 50곳)를 대조한 결과 회귀 없이 안전하게 적용되었고, `resolveFallbackWorkspace` 추출은 기존 인라인 로직과 완전히 동등한 순수 함수다. 유일하게 주의할 지점은 신규 테스트가 mock 이 아닌 실제 zustand 싱글턴 store 를 직접 `reset`/`setState` 한다는 점인데, 각 파일이 `beforeEach` 에서 스스로 리셋하므로 실질적인 교차 오염 위험은 낮다. 함께 커밋된 리뷰 산출물 파일들은 코드 동작과 무관한 문서성 파일로 프로젝트 컨벤션상 정상 범위다.

## 위험도
LOW
