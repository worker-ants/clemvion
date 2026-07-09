# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** "활성 워크스페이스(slug 존재)" fixture 객체 리터럴이 2개 테스트 파일에 사실상 동일하게 중복
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx:133-138` 및 `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-list-page.test.tsx:842-847`
  - 상세: 두 파일 모두 `useWorkspaceStore.setState({ workspaces: [{ id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" }], currentWorkspaceId: "ws-1", loaded: true })` 를 그대로 복사해 사용하고, 설명 주석("slug-누락 회귀 가드: …")도 문구가 거의 동일하다. `execution-detail-page.test.tsx` 는 같은 목적의 로직을 `setupAuth(role)` 헬퍼로 이미 추상화해뒀는데(다만 fixture 값은 `slug: "ws"` 로 다름), 나머지 두 파일은 그 패턴을 따르지 않았다. 각 페이지가 독립적으로 store→href 배선을 검증해야 한다는 취지(사이트별 누락을 각각 잡아야 함)는 타당하므로 테스트 자체를 병합하라는 뜻은 아니지만, fixture 생성 보일러플레이트는 공유 가능하다.
  - 제안: `test-utils` 류 공용 모듈에 `activeWorkspaceFixture(slug = "team-x", role = "editor")` 같은 헬퍼를 두고 3개 파일(dashboard, execution-list, 필요시 execution-detail 의 setupAuth 도)이 이를 재사용하면, WorkspaceSummary 타입에 필드가 추가/변경될 때 갱신 지점이 하나로 줄어든다. 필수 조치는 아니며 우선순위 낮음.

- **[INFO]** self-test sanity 임계값 `50` 이 매직 넘버로 설명 근거 없이 하드코딩
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:1231-1234` (`resolves SRC correctly` 테스트의 `expect(collectSourceFiles(SRC).length).toBeGreaterThan(50)`)
  - 상세: 이 값은 "SRC 경로가 잘못 잡혀 스캔이 텅 비는 fail-open"을 막기 위한 sanity 하한선인데, 왜 하필 50인지(현재 소스 파일 수 대비 여유치 등) 주석에 설명이 없다. 코드 자체는 정상 동작하며 회귀 시 빠르게 실패 이유를 알 수 있는 수준이라 심각하지 않음.
  - 제안: 주석에 "현재 src 트리 파일 수가 N개 이상이므로 50 은 충분한 하한"이라는 근거 한 줄만 추가하면 향후 유지보수자가 임계값 조정 여부를 판단하기 쉬워진다.

- **[INFO]** `it.each` 안전형(false-positive) 목록에서 라벨(`_label`)이 테스트 타이틀(`%s`) 용도로만 쓰이고 비구조화 변수명에 언더스코어 프리픽스를 사용 — 기존 컨벤션과 일치
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:1210-1226`
  - 상세: 문제라기보다 확인 사항. lint 룰(unused-var allow underscore prefix)과 일관되며 가독성에도 문제 없음. 별도 조치 불필요.

## 요약

이번 변경은 이전 리뷰 WARNING 3건(회귀 테스트 보강, guard self-test, JSDoc 정정)에 대한 후속 조치로, 신규 프로덕션 로직 추가 없이 테스트 파일 4개와 주석/JSDoc 1건만 건드린 저위험 변경이다. 각 테스트는 짧고 목적이 명확하며(`describe`/`it` 이름이 시나리오를 정확히 서술), 중첩 깊이·함수 길이·순환 복잡도 모두 양호하다. `href.ts` 의 JSDoc 정정은 실제 메커니즘(ESLint 대신 vitest 소스텍스트 guard)을 정확히 반영해 문서-코드 불일치를 해소했다. 유일한 개선 여지는 "활성 워크스페이스 slug" fixture 가 2개 파일에 리터럴로 복제된 점과 self-test 임계값 50의 근거 미문서화인데, 둘 다 기능적 결함이 아니라 향후 유지보수 편의를 위한 선택적 개선(INFO)에 그친다.

## 위험도
LOW
