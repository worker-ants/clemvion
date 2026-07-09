## 부작용(Side Effect) 리뷰

대상: dashboard-page.test.tsx(신규), execution-detail-page.test.tsx, execution-list-page.test.tsx, no-raw-execution-href.test.ts, href.ts (JSDoc only)

### 발견사항

- **[INFO]** 테스트가 실제(zustand) 전역 싱글턴 스토어를 직접 mutate
  - 위치: 4개 테스트 파일 전체 — `useWorkspaceStore.setState(...)`, `useLocaleStore.setState(...)` 호출 다수 (예: `dashboard-page.test.tsx:120-125`, `execution-list-page.test.tsx:824-829`, `execution-detail-page.test.tsx` 신규 `describe` 블록의 `setupAuth("editor")`)
  - 상세: 이 테스트들은 mock 스토어가 아니라 앱이 실제로 사용하는 zustand 스토어 모듈(`useWorkspaceStore`, `useLocaleStore`)의 싱글턴 인스턴스를 `setState` 로 직접 변경한다. 이는 프로세스 전역 공유 상태에 대한 부작용이며, 각 `it` 실행 순서와 `beforeEach` 리셋 시점에 결과가 의존하는 구조다. 확인한 바로는 이번 diff 의 모든 신규/변경 테스트가 해당 `describe` 블록의 `beforeEach` 에서 스토어를 알려진 초기값(`workspaces: [] / currentWorkspaceId: null` 또는 `setupAuth(role)`)으로 매 테스트 전에 리셋하고 있어 테스트 간 누수는 없어 보인다. 다만 이는 신규 도입 패턴이 아니라 기존 코드베이스의 기존 관례를 그대로 따른 것이며, 새로 추가된 `describe("ExecutionDetailPage - prev/next navigation (slug-aware)")` 블록도 자체 `beforeEach`(`setupAuth("editor")`)로 상태를 명시적으로 재설정하므로 이후 `describe("... Re-run entry point ...")` 블록으로의 누수 위험은 없다.
  - 제안: 현 상태로 문제 없음. 다만 향후 이 패턴을 유지·확장할 때는 (a) 신규 `describe`/`it` 추가 시 반드시 자체 `beforeEach` 에서 스토어를 초기화할 것, (b) 가능하면 `vi.mock` 으로 스토어 자체를 모킹해 전역 싱글턴 변경을 피하는 방향을 장기적으로 고려.

- **[INFO]** `no-raw-execution-href.test.ts` — 파일시스템 read-only 스캔 확대
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts` 신규 `it("resolves SRC correctly...")` 및 self-test `describe` 블록
  - 상세: 신규 테스트는 `fs.existsSync`/기존 `collectSourceFiles`(내부적으로 `fs.readdirSync`/`fs.readFileSync`) 를 재사용하는 read-only 검증만 추가한다. 파일 생성·수정·삭제는 없다. `src` 트리 전체를 매 테스트 실행마다 재귀 스캔하는 기존 동작이 self-test 추가로 인해 반복 호출되지는 않음(동일 `collectSourceFiles(SRC)` 를 한 번 더 호출하는 정도) — 부작용 관점에서 안전. 다만 이 가드가 " fail-open(빈 배열이면 통과)" 케이스를 스스로 검증하도록 설계된 점은 의도된 방어 로직이라 문제 없음.
  - 제안: 없음 (현행 유지).

- **[INFO]** `href.ts` — JSDoc 주석만 변경, 런타임 동작 불변
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:26-31` 부근 (`buildExecutionHref` JSDoc)
  - 상세: `buildWorkspaceHref`/`buildExecutionHref` 두 함수 모두 시그니처·내부 로직 변경 없음. ESLint 룰 존재를 주장하던 부정확한 서술을 실제 메커니즘(vitest 소스텍스트 guard)으로 정정한 문서 수정뿐이다. 공개 API·호출자 영향 없음.
  - 제안: 없음.

- **[NONE]** 시그니처/인터페이스 변경, 환경 변수, 네트워크 호출, 이벤트/콜백 변경
  - 상세: 모든 API 클라이언트(`dashboardApi`, `workflowsApi`, `executionsApi`)는 기존과 동일하게 `vi.mock` 으로 전량 모킹되어 실제 네트워크 호출은 발생하지 않는다. `mockPush`/`mockBack`/`getSummary` 등 신규 mock 함수는 각 테스트 파일 모듈 스코프에 한정되며 애플리케이션 전역으로 유출되지 않는다. 환경 변수 read/write 없음. 프로덕션 함수 시그니처 변경 없음.

### 요약
이번 변경은 신규 회귀 테스트 3건 추가, 정규식 self-test 추가, JSDoc 정정으로 구성된 test-only + comment-only diff이며, 프로덕션 런타임 동작·공개 API·시그니처·환경 변수·네트워크 호출에는 어떠한 변경도 없다. 유일하게 주목할 점은 다수 테스트가 zustand 전역 싱글턴 스토어(`useWorkspaceStore`, `useLocaleStore`)를 직접 `setState` 하는 기존 관례를 그대로 확장한다는 것인데, 신규/변경된 모든 `describe` 블록이 자체 `beforeEach` 로 상태를 명시적으로 리셋하고 있어 테스트 간 상태 누수는 확인되지 않았다. `no-raw-execution-href.test.ts` 의 파일시스템 접근도 read-only 스캔에 그쳐 부작용이 없다.

### 위험도
NONE
