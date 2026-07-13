# Code Review 통합 보고서

## 전체 위험도

**LOW** — spec §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리)에 대한 4회차(수렴 확인) 리뷰. 실제로 Read 가능했던 8개 reviewer(security/performance/architecture/requirement/scope/side_effect/testing/documentation) 는 전원 NONE 또는 LOW 위험도를 보고했고, CRITICAL/WARNING 은 0건, 전 발견사항이 INFO 수준이었다. 1차 라운드(`12_40_48`)에서 지적된 CRITICAL(자기연결 드롭 시 엣지 오삭제)은 드롭 위치(`connectionState.toNode`) 기반 판정으로 재설계되어 이후 2개 라운드와 이번 라운드 전원이 재확인한 결과 재현되지 않는다. 다만 `maintainability`, `user_guide_sync` 두 reviewer 는 manifest 상 `status=success` 로 보고됐음에도 **출력 파일이 디스크에 실재하지 않아**(`ls` 로 직접 확인, 세션 디렉터리에 두 파일 부재) 내용을 통합할 수 없었다 — 알려진 workflow disk-write gap 패턴과 일치하며, 이 2건에 대해서만 위험도를 LOW 로 유지하고 수동 재확인을 권고한다(§권장 조치사항 참조).

## Critical 발견사항

없음 (통합 가능했던 8개 reviewer 전원 CRITICAL 0건 보고)

## 경고 (WARNING)

없음 (통합 가능했던 8개 reviewer 전원 WARNING 0건 보고)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 순수 프런트엔드 zustand 상태 갱신 + React Flow 콜백 배선뿐 — 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회 패턴 없음 | `use-edge-reconnect.ts`, `workflow-canvas.tsx`, `editor-store.ts`, `edge-utils.ts` | 없음(확인 목적) |
| 2 | 보안/이력 | 1차 라운드 CRITICAL(자기연결 드롭 시 기존 엣지 오삭제)이 성공 플래그가 아닌 드롭 위치(`connectionState.toNode === null`) 기준 판정으로 재설계 — 이후 2라운드+금회 재확인 모두 미재현. 클라이언트 검증 우회 시에도 DB 레벨 제약(`source_node_id != target_node_id`, UNIQUE)이 최종 방어선 | `use-edge-reconnect.ts` `onReconnectEnd`, `editor-store.ts` `onReconnect` | 없음(확인 목적) |
| 3 | 성능 | `evaluateConnection`/`detectContainerConflict`/`buildEdgeDataForConnection` 이 각각 독립적으로 `nodes.find()`(O(N)) 를 수행 — 사용자 제스처 1회당 1회 호출이라 현재 규모에서 체감 지연 없음 | `editor-store.ts` `onConnect`/`onReconnect` | 노드 수천 개 규모 대량 연결 시나리오에서 store 레벨 `Map` 공유 리팩터링 고려(현재는 조치 불요) |
| 4 | 성능 | `onReconnect` 가 `get().edges.filter(...)` 로 매 호출마다 새 배열 할당 | `editor-store.ts` `onReconnect` | 조치 불요(과최적화 리스크가 더 큼) |
| 5 | 아키텍처(긍정) | `useEdgeReconnect` 훅이 콜백 주입(DIP)으로 store 구현에 의존하지 않음 — canvas→hook→store→utils 4계층 경계 일관 유지 | `use-edge-reconnect.ts` | 없음(모범 사례 유지 권장) |
| 6 | 아키텍처(긍정) | `evaluateConnection` 판별 유니온(`{ok:true}|{ok:false;message?}`) 추출로 `onConnect`/`onReconnect` 검증·데이터파생 중복 해소, OCP 충족 | `editor-store.ts:610-640`, `onConnect`/`onReconnect` | 없음 |
| 7 | 아키텍처 | `RESERVED_INPUT_HANDLE_IDS`(FE, 리터럴 `Set(["emit"])`)와 backend `CONTAINER_LOOPBACK_PORTS` 가 주석 SoT 참조만으로 동기화되는 독립 리터럴 — latent drift 위험(원소 1개, 즉시 위험 낮음) | `edge-utils.ts`, backend `shadow-workflow.ts:220` | 예약 포트가 늘거나 참조처가 늘면 공유 상수/패키지 승격 검토(plan 이월 완료) |
| 8 | 아키텍처 | `workflow-canvas.tsx` God Component(993줄) — 기존 부채이며 이번 diff 로 악화되지 않음(오히려 `use-edge-reconnect.ts` 순수 훅 추출로 완화 방향) | `workflow-canvas.tsx` | §1.2 팝업 글루 정리 시 동일 패턴(순수 훅+콜백 주입) 적용 권장 |
| 9 | 아키텍처/부작용 | 구조적 엣지(컨테이너 `body`/`emit`)가 `reconnectable` opt-out 없이 일반 데이터 엣지와 동일하게 드래그 재연결/detach 가능 — 서버측 `CONTAINER_MISSING_EMIT` 검증이 최종 방어선으로 남아 즉각 위험 아님 | `workflow-canvas.tsx` `<ReactFlow onReconnect=.../>` | 구조적 배선 보호 필요 시 엣지 data `reconnectable:false`/`structural:true` 필드 승격 검토 |
| 10 | 요구사항 | 이전 3라운드(CRITICAL 1건→SPEC-DRIFT 1건+WARNING 다수→WARNING 2건) 전건이 소스 대조·`tsc --noEmit`(clean)·`eslint`(0 errors)·`vitest run`(125 passed) 로 재검증 시 실제 해소 확인 | 변경 4개 소스 파일 + 테스트 3파일 | 없음(확인 목적) |
| 11 | 요구사항/문서화 | `spec/3-workflow-editor/2-edge.md` §1.3 이 현재 코드와 line-level 로 일치(`onReconnect`/`onReconnectEnd` 두 콜백, `evaluateConnection` 개명, `connectionState.toNode` 판정 등) | spec §1.3, CHANGELOG, plan | 없음 |
| 12 | 범위 | `onConnect` 리팩토링(`evaluateConnection` 추출)·`deleteEdge→removeEdge` 개명·`RESERVED_INPUT_HANDLE_IDS` 추가 3건 모두 표면적으로 "요청 밖" 변경처럼 보이나, 동일 PR 사이클 리뷰 피드백 반영 또는 plan/CHANGELOG 에 사전 문서화된 계획된 변경으로 확인됨 | `editor-store.ts`, `use-edge-reconnect.ts`, `workflow-canvas.tsx`, `edge-utils.ts` | 조치 불요 |
| 13 | 부작용 | `onReconnect`/`removeEdge` 는 로컬 zustand 상태(`edges`/`nodes`/`isDirty`)만 변경 — `fetch`/`apiClient`/`workflowsApi` 호출 없음(저장 전까지 서버 미반영) | `editor-store.ts` `onReconnect`/`removeEdge` | 없음 |
| 14 | 부작용 | 신규 store 메서드명을 `removeEdge` 로 명명해 기존 `workflowsApi.deleteEdge`(즉시 REST DELETE)와의 명명 충돌·부작용 프로파일 혼동을 해소 | `editor-store.ts`, `workflows.ts:147` | 없음(확인 목적) |
| 15 | 부작용 | `EditorState` 인터페이스에 `onReconnect`/`removeEdge` 추가 — additive, 기존 소비자 영향 없음 | `editor-store.ts` `interface EditorState` | 없음 |
| 16 | 부작용 | 상태 무변화(제자리 재연결, 존재하지 않는 `edgeId` 대상 `removeEdge`)에도 무조건 `pushUndo()` 실행 — 기능 영향 미미 | `editor-store.ts` `onReconnect`/`removeEdge` | 우선순위 낮음, 조치 불요 |
| 17 | 테스트 | `onReconnect` 성공 경로(컨테이너 충돌 미발생, 끝점 변경)에서 `containerId` 가 실제로 재도출되는지 검증하는 양성 테스트 부재 | `editor-store.test.ts` `describe("onReconnect (§1.3)")` | (선택) "body 엣지 재연결 시 새 타깃이 컨테이너 자식이 된다" 케이스 1건 추가 |
| 18 | 테스트 | `onConnect` 자체 스위트에는 컨테이너 충돌 거부 테스트 없음(대칭성 관점, 기존 라운드에서 이미 저위험 트리아지) | `editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")` | 조치 불요(재발 방지 목적이면 대칭 케이스 1건 고려) |
| 19 | 테스트 | `workflow-canvas.tsx` → `onReconnect`/`onReconnectEnd` prop 실배선을 검증하는 RTL/e2e 없음(plan §1.2 이월 항목 (d) 에 근거 기록) | `workflow-canvas.tsx`, `e2e/` | 조치 불요(canvas 테스트 하네스 도입 시 함께 편입 권장) |
| 20 | 문서화(긍정) | 신규 공개 함수(JSDoc)가 판정 근거("왜 드롭 위치 기준인지" 등)를 명확히 설명하며 실제 구현과 line-level 일치. ko/en 유저가이드(mdx) 대칭 갱신, frontmatter `code:` 인벤토리도 spec 과 정합 | `use-edge-reconnect.ts`, `editor-store.ts`, `edge-utils.ts`, `connecting-nodes(.en).mdx`, `containers-and-tools(.en).mdx` | 없음 |
| 21 | 문서화 | `editor-store.test.ts` 의 `Connection` 타입 미-import(TS2304) 결함 해소 확인. 단, `__tests__` 가 `tsconfig.json` exclude 대상이라 `tsc --noEmit` 가 애초에 이 파일을 검사하지 않는 구조적 사각지대는 기존 별도 트랙 이월 항목(이번 diff 신규 아님) | `editor-store.test.ts:2` | 없음(확인 목적) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿 패턴 없음, 1차 CRITICAL 재확인 결과 해소 유지 |
| performance | NONE | O(N) 선형 스캔뿐, N+1/블로킹 I/O 없음 |
| architecture | LOW | DIP/계층 경계 유지, 검증 중복 해소; latent FE/BE 리터럴 drift·God Component 는 기존 부채 |
| requirement | NONE | 3라운드 전건 실제 해소를 tsc/eslint/vitest 로 재검증, spec 과 line-level 일치 |
| scope | NONE | "범위 밖처럼 보이는" 3건 모두 계획된/피드백 반영 변경으로 확인 |
| side_effect | NONE | 로컬 상태만 변경, 네트워크 호출 없음, 명명 충돌 해소 |
| testing | LOW | 125 tests passed, 0 lint errors; 잔여 갭은 전부 저위험 INFO(양성 테스트 1건, 대칭 테스트, RTL/e2e 부재) |
| documentation | NONE | CHANGELOG/spec/plan/mdx 전 문서 line-level 일치, JSDoc 품질 양호 |
| maintainability | 확인 불가 | **manifest 상 success 이나 출력 파일이 디스크에 부재 — 재시도 필요** |
| user_guide_sync | 확인 불가 | **manifest 상 success 이나 출력 파일이 디스크에 부재 — 재시도 필요** |

## 발견 없는 에이전트

- security, performance, requirement, scope, side_effect, documentation — CRITICAL/WARNING 없음(INFO 만 존재)

## 권장 조치사항

1. **(우선)** `maintainability`, `user_guide_sync` 두 reviewer 는 manifest 상 `status=success` 이나 세션 디렉터리(`review/code/2026/07/13/13_40_15/`)에 `maintainability.md`/`user_guide_sync.md` 파일이 실재하지 않음을 `ls` 로 직접 확인했다. 알려진 workflow disk-write gap 패턴(성공 보고 + 파일 유실 → 실제 발견사항이 clean 으로 오집계될 위험)과 일치하므로, 두 reviewer 를 재실행하거나 원본 세션 로그(journal 등)에서 복구해 통합 재확인 필요. 두 reviewer 중 `maintainability` 는 router_safety 강제 포함 대상이었다는 점에서 우선순위를 높게 둔다.
2. (선택, 낮은 우선순위) `onReconnect` 성공 경로에서 `containerId` 실제 재도출을 검증하는 양성 테스트 1건 추가 검토(#17).
3. (선택) 구조적 엣지(`body`/`emit`)의 드래그 재연결/detach 를 막고 싶다면 `reconnectable:false` 필드 승격 검토(#9) — 현재는 서버측 `CONTAINER_MISSING_EMIT` 검증이 최종 방어선이라 긴급하지 않음.
4. (선택) `RESERVED_INPUT_HANDLE_IDS`(FE)/`CONTAINER_LOOPBACK_PORTS`(BE) latent drift 는 예약 포트 수가 늘어날 때 공유 상수/패키지로 승격 고려(#7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(개별 사유는 manifest 에 미기재) — 이번 diff 는 신규 의존성 추가/버전 변경 없이 기존 패키지(zustand/React Flow) 활용에 한정되어 판단상 배제된 것으로 추정 |
  | database | 순수 프런트엔드 상태 변경으로 DB 스키마/쿼리 영향 없음 |
  | concurrency | 클라이언트 단일 스레드 UI 상태 갱신으로 동시성 이슈 표면 없음 |
  | api_contract | 백엔드·wire(REST/SSE) 무변경(순수 클라이언트 상태 관리) |