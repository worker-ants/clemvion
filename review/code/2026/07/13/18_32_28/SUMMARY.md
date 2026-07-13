# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 컨테이너 타입 노드(Loop/ForEach/Map)를 기존 엣지 위에 드롭하면 대상 노드가 새 컨테이너의 body 자식으로 조용히 재편입되거나 그래프가 반쪽만 이어진 채 깨지는 실질 결함을, `side_effect`·`testing` 두 reviewer 가 독립된 방법(코드 추적 vs 테스트 추적)으로 각각 확인함. 그 외 문서 동기화 누락·비원자적 mutation·중복 판정 로직 등 WARNING 다수.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/테스트 | 새로 삽입되는 노드가 컨테이너 타입(Loop/ForEach/Map, `outputs:[{id:'body'},{id:'done'}]`)일 때 `firstOutputHandleId` 가 예약 출력 `body` 를 걸러내지 않아, `newToTarget.sourceHandle`이 `body`로 선택된다. 이 연결은 `onConnect`→`evaluateConnection`→`propagateContainerOnConnect` Rule 1을 발동시켜 대상(target) 노드가 새 컨테이너의 body 첫 자식으로 조용히 재편입되거나(가장 흔함), 대상이 이미 다른 컨테이너 소속이면 `detectContainerConflict`가 연결을 거부해 원본 엣지가 이미 삭제된 채 그래프가 반쪽만 이어진 파손 상태로 남는다(Undo로만 복구). 팔레트가 Loop/ForEach/Map을 다른 노드와 동일하게 노출해 재현이 쉽고, `edge-utils.test.ts`의 모든 `buildEdgeSplitPlan` 테스트가 단일 입출력(`in`/`out`) 정의만 사용해 이 경로를 전혀 커버하지 못한다(150개 테스트 전부 green이어도 결함 재현됨). spec §4.1/R-3("컨테이너 경계 엣지만 제외")는 "원본 엣지"만 걸렀지 "삽입되는 새 노드 자신이 컨테이너인가"는 걸러지지 않는다. | `codebase/frontend/src/lib/utils/edge-utils.ts` `firstOutputHandleId`(:155-158), `buildEdgeSplitPlan`(:263-292); `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`(L707-741); 참고 `codebase/backend/src/nodes/logic/{loop,foreach,map}.schema.ts`; 테스트 `edge-utils.test.ts:234-306` | `buildEdgeSplitPlan` 진입 시 새로 삽입될 노드의 `definition?.isContainer` 여부(또는 결과 커넥션의 `sourceHandle`이 `body`/`done` 등 예약 핸들에 속하는지)를 검사해 컨테이너 타입 노드는 분할 대상에서 제외(null 반환, 노드만 추가)하도록 R-3 스코프를 확장. 최소한 "새 노드가 컨테이너면 firstOutputHandleId는 done을 선택하거나 buildEdgeSplitPlan이 null을 반환한다" 회귀 테스트 추가. spec §4.1/R-3에도 이 예외 명시. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 아키텍처/부작용 | 엣지 분할이 store 단일 원자 액션이 아니라 컴포넌트가 오케스트레이션하는 3단계 독립 mutation(`removeEdge(skipUndo)`→`onConnect`×2)으로 구현됨. `removeEdge`는 무조건 실행되는 파괴적 연산인데 뒤이은 `onConnect`는 `evaluateConnection` 실패 시(자기연결/중복/컨테이너 충돌) 조용히 toast만 띄우고 무시하는 best-effort라, 원본 엣지 삭제 후 신규 연결 중 하나만(또는 둘 다) 누락된 파손 그래프가 남을 수 있다(Critical #1이 그 구체적 트리거 사례). 현재 스코프에선 우연히 항상 성공하지만 `evaluateConnection` 규칙이 향후 확장되면 구조적으로 보장되지 않는 원자성이 드러난다. | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:726-738` (L733-737) | "원본 엣지 제거 + 신규 엣지 2개 생성"을 store 단일 액션(예: `splitEdge`)으로 캡슐화해 두 Connection을 먼저 검증 후 모두 유효할 때만 하나의 `set()` 트랜잭션으로 커밋. 최소한 `onConnect` 호출 전에 `evaluateConnection` dry-run으로 실패 시 `removeEdge` 자체를 건너뛰는 사전 가드 추가. |
| 3 | 유지보수성 | `isContainerBoundaryEdge`가 핸들 이름(`sourceHandle ∈ {body,done}` 또는 `targetHandle===emit`)만으로 컨테이너 경계를 판정하고 노드가 실제 컨테이너인지는 보지 않아, 같은 파일의 `resolvePortType`·`editor-store.ts`의 `detectContainerConflict`/`propagateContainerOnConnect`(둘 다 "핸들 이름 + 실제 컨테이너 노드 여부" 함께 검사)보다 정밀도가 낮은 중복 구현이다. Parallel Branch 노드(컨테이너 아님)의 `done` 출력이 평범한 데이터 포트(`type:"data"`)인데도 핸들 이름만으로 컨테이너 경계 오판되어, 이 포트에서 나가는 일반 데이터 엣지 위에 노드를 드롭하면 `buildEdgeSplitPlan`이 null을 반환해 분할이 조용히 생략된다(사용자는 이유 모른 채 "가끔 분할이 안 되는" 엣지를 겪음). | `codebase/frontend/src/lib/utils/edge-utils.ts:230-243`(`CONTAINER_SOURCE_HANDLES`/`isContainerBoundaryEdge`); 대조 `codebase/frontend/src/lib/stores/editor-store.ts:259-260,273-274,323-325,331-333`; 관련 `resolve-dynamic-ports.ts:46`(`parallelBranchPorts`) | `isContainerBoundaryEdge`/`buildEdgeSplitPlan`에 source/target 노드(또는 `isContainer` 여부)를 함께 넘겨 `isContainerNode(node)&&handle===...` 패턴과 동일한 정밀도로 맞춘다. 최소한 이 근사의 한계(Parallel Branch `done`)를 spec R-3/함수 주석에 명시. |
| 4 | 테스트 | `onDrop`의 실제 통합 배선(hit-test→buildAndAddNode→buildEdgeSplitPlan→removeEdge/onConnect 연쇄)이 어떤 테스트로도 실행되지 않는다. 이번 PR 테스트는 순수 헬퍼와 `removeEdge` skipUndo뿐이며 `workflow-canvas.tsx` 자체를 렌더링하는 canvas RTL 하네스가 없다(§1.2/§1.3 때부터 알려진 갭). Critical #1이 정확히 이 통합 지점에서 발생하듯, glue 코드 결함은 순수 함수 단위 테스트만으로 발견되지 않는다. | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:707-741` | canvas RTL 하네스 부재는 기존 제약이나, `onDrop`을 "사이드이펙트 목록을 반환하는 순수 오케스트레이션 함수"(예: `planEdgeSplitOnDrop`)로 추출하면 vitest로 전수 테스트 가능. 최소한 Critical #1 시나리오(컨테이너 노드 드롭) 재현 단위 테스트 추가 권장. |
| 5 | 테스트 | 다중 출력 비-컨테이너 노드(If/Else `true`/`false`, Switch `case_0..N`)를 새 노드로 삽입할 때 `outputs[0]` 선택(`newToTarget.sourceHandle`이 항상 첫 출력으로 고정)의 타당성이 spec·테스트 어디에도 검증되지 않는다. If/Else를 mid-insert하면 `true` 분기만 연결되고 `false` 분기는 미연결 상태가 되는데, 의도된 fallback인지 spec §4.1이 명시하지 않는다. | `codebase/frontend/src/lib/utils/edge-utils.ts:155-158`; 테스트 `edge-utils.test.ts:234-243` | `buildEdgeSplitPlan`에 다중 출력 정의(`def.outputs.length>1`) 케이스 최소 1개 테스트 추가. spec §4.1에도 "새 노드가 다중 출력이면 첫 데이터 출력만 연결, 나머지는 수동 연결 필요" 등 명시 여부를 project-planner와 협의. |
| 6 | 문서화/유저가이드 | 유저 가이드 `03-workflow-editor/connecting-nodes.mdx`(+`.en.mdx`)와 `canvas-basics.mdx`(+`.en.mdx`)가 신규 §4.1(엣지 위 드롭→분할·삽입) 동작을 서술하지 않는다. `connecting-nodes.mdx`의 frontmatter `code:`/`spec:`가 이번 diff의 핵심 파일(`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`, `spec/3-workflow-editor/2-edge.md`)을 정확히 가리켜 이 문서가 §4.1의 지정된 갱신 대상임이 명시돼 있음에도 "엣지 위에 놓으면"의 분할 동작이 어디에도 없다(`docs/` 전체 grep 매치 0건). `03-workflow-editor/**`는 build-time reverse-coverage 가드 스코프 밖(`02-nodes/**`, `06-integrations-and-config/**`만 강제)이라 CI로 검출되지 않는 회색지대다. | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`, `canvas-basics.mdx` (+`.en.mdx` 각각) | 같은 PR 안에서 connecting-nodes.mdx에 §4.1 절 추가(컨테이너 경계/무입출력 노드 제외 한계 안내 포함) + canvas-basics.mdx "팔레트에서 캔버스로 드래그해요" 절에 한 문장 + 상호링크 추가. `i18n-userguide.md` 관례(해요체) 준수. |
| 7 | 문서화 | spec §4.1 "적용 범위" 불릿의 "(§4.2 일반 팔레트 드롭과 동일 fallback)" 참조가 문서명 없이 쓰여, 자기 문서(`2-edge.md`) 내에 §4.2가 실재하지 않는데도 존재하는 것처럼 오독된다(실제로는 `0-canvas.md` §4.2를 가리키는 타 문서 참조이며, 같은 불릿의 다음 항목은 문서명을 명시하고 있어 일관성도 깨짐). | `spec/3-workflow-editor/2-edge.md` §4.1 "적용 범위" 불릿 | "(0-canvas.md §4.2 일반 팔레트 드롭과 동일 fallback)"으로 문서명 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 8 | 보안 | DOM 클래스 기반 hit-test(`findEdgeIdAtPoint`)는 same-origin·React Flow 렌더 DOM이라는 신뢰 전제 위에서만 안전(이미 XSS가 성립한 이후에나 의미 있는 시나리오, 서버측 재검증 존재) | `edge-utils.ts` `findEdgeIdAtPoint` | 조치 불요 |
| 9 | 아키텍처 | `onDrop`에 서브피처별 분기(일반 추가/자동 연결/엣지 분할)가 인라인으로 계속 누적되는 추세. §1.3/§3.2는 전용 훅으로 추출했으나 이번 §4.1 오케스트레이션은 인라인 유지 | `workflow-canvas.tsx:707-741` | 다음 엣지 조작 기능 추가 시 `use-edge-drop-insert.ts` 류 훅 추출 고려 |
| 10 | 아키텍처 | `findEdgeIdAtPoint`가 React Flow 내부 DOM 클래스명(`.react-flow__edge`)에 문자열로 결합 — 메이저 버전 업그레이드 시 조용히 no-op화 가능 | `edge-utils.ts:455-465` | 향후 회귀 대비 e2e 스모크 테스트 1개 고려 |
| 11 | 유지보수성 | `SplitConnection` 인터페이스가 `@xyflow/react`의 `Connection`과 구조적으로 동일한 필드를 재선언(기존 파일 패턴 답습, 이번 diff만의 문제 아님) | `edge-utils.ts:245-250` | 후속 정리 시 `Connection` import 통일 |
| 12 | 테스트 | `findEdgeIdAtPoint` 테스트에 `data-id` 속성 부재(coalesce) 케이스 미포함(`?? null`로 이미 안전 처리돼 실질 리스크 낮음) | `edge-utils.test.ts:308-336` | 선택적으로 케이스 1개 추가 |
| 13 | 테스트 | `buildEdgeSplitPlan`의 null 반환 조건(트리거/sink/컨테이너 경계)이 각각 단독으로만 테스트되고 조합 케이스 없음(early-return 순서상 실질 리스크 낮음) | `edge-utils.test.ts:260-305` | 우선순위 낮음, 조합 케이스 1개 추가 고려 |
| 14 | 문서화 | CHANGELOG/plan 항목이 이번 §4.1 테스트 개수를 명시하지 않아 같은 계열 선행 항목(§1.2/§3.2/§4·5)의 "정확한 개수 명시" 관행과 다름 | `CHANGELOG.md`, `plan/complete/spec-sync-edge-gaps.md` | 필수 아님, 일관성을 위해 개수 표기 권장 |
| 15 | 범위 | CHANGELOG 항목 장문, plan/spec frontmatter 이동, consistency 리뷰 산출물 포함, `onDrop` useCallback 의존성 배열 갱신 — 전부 이 작업의 필수 프로세스 산출물/종속 변경으로 스코프 이탈 아님 | 다수 파일 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 서버 API·인증/시크릿 없음, 기존 화이트리스트/폴백 패턴으로 안전 |
| architecture | LOW | 3단계 mutation 비원자성(WARNING #2 기여), 인라인 오케스트레이션 누적 추세(INFO) |
| requirement | **파일 유실 — 재시도 필요** | 아래 "재시도 필요" 참고 |
| scope | NONE | 16개 파일 전부 §4.1 기능·필수 프로세스 산출물에 정확히 귀속, 위반 없음 |
| side_effect | CRITICAL | Critical #1 원저자(컨테이너 노드 mid-insert 시 body 재편입), WARNING #2 기여 |
| maintainability | MEDIUM | WARNING #3 원저자(`isContainerBoundaryEdge` 중복·정밀도 저하) |
| testing | CRITICAL | Critical #1 독립 재확인(테스트 추적), WARNING #4·#5 원저자 |
| documentation | LOW | WARNING #6·#7 기여(유저가이드/spec 상호참조) |
| user_guide_sync | MEDIUM | WARNING #6 원저자(connecting-nodes.mdx + canvas-basics.mdx 갱신 누락) |

## 발견 없는 에이전트

- security — CRITICAL/WARNING 없음 (INFO 1건만)
- scope — CRITICAL/WARNING 없음 (INFO 다수, 전부 조치 불요)

## 재시도 필요

- **requirement** — manifest 상 `status=success`이나 `requirement.md` 산출 파일이 디스크에 실재하지 않음(disk-write gap, `ls` 확인 결과 부재). 내용을 통합에 반영할 수 없음. **재실행 필요** — 특히 `[SPEC-DRIFT]` 태깅 여부(spec R-3가 실제 구현 스코프를 정확히 반영하는지, 또는 위 Critical #1처럼 구현이 spec 범위를 벗어난 결함인지)를 requirement-reviewer 관점에서 재확인해야 함.

## 권장 조치사항

1. **[최우선/Critical #1]** `buildEdgeSplitPlan`/`firstOutputHandleId`가 새로 삽입되는 노드의 컨테이너 여부(Loop/ForEach/Map)를 검사해 컨테이너 타입은 분할 대상에서 제외(또는 `body`를 건너뛰고 `done` 선택)하도록 수정하고, 회귀 테스트 및 spec R-3 갱신.
2. requirement reviewer 재실행(disk-write gap 복구) — 특히 spec R-3 스코프가 Critical #1을 커버하지 못하는 점에 대한 SPEC-DRIFT/버그 판정.
3. `onDrop`의 3단계 mutation(removeEdge→onConnect×2)을 원자적 store 액션으로 캡슐화하거나 사전 dry-run 가드 추가(WARNING #2).
4. `isContainerBoundaryEdge`가 노드 타입을 검사하지 않아 Parallel Branch `done` 데이터 포트를 오탐하는 문제 수정(WARNING #3).
5. `connecting-nodes.mdx`/`canvas-basics.mdx`(+`.en.mdx`)에 §4.1 신규 동작 반영(WARNING #6).
6. spec §4.1 "§4.2" 참조에 `0-canvas.md` 문서명 명시(WARNING #7).
7. `onDrop` 통합 배선에 대한 최소 e2e/통합 테스트 검토, 다중 출력 노드(If/Else/Switch) mid-insert 시 outputs[0] 선택 근거를 spec에 명시(WARNING #4·#5).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드 변경 시 항상 적용 규칙 + 문서 파일 변경 트리거)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 프런트엔드 캔버스 상태(Zustand) 조작, 신규 네트워크 호출/쿼리 없음 — 성능 특이 표면 없음(router 판단, scope 리뷰의 "백엔드/네트워크 무변경" 확인과 정합) |
  | dependency | 신규 패키지/버전 변경 없음 |
  | database | 이번 changeset에 DB 스키마/쿼리 변경 없음(순수 클라이언트 상태) |
  | concurrency | 신규 동시성/락/큐 로직 없음 |
  | api_contract | 신규 백엔드 엔드포인트·DTO·wire 변경 없음(CHANGELOG가 "순수 프런트엔드, 백엔드·wire 무변경"을 스스로 명시) |