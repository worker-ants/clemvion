# 보안(Security) 리뷰

## 검토 범위 요약

이번 변경은 워크플로 편집기(React/Next.js 프런트엔드) 캔버스에서 "엣지 위에 노드를 드롭하면 엣지를 분할(split)하고 중간에 노드를 삽입"하는 기능(§4.1)이다. 대상은:

- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onDrop` 확장)
- `codebase/frontend/src/lib/utils/edge-utils.ts` (`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint` 순수 헬퍼 추가)
- `codebase/frontend/src/lib/stores/editor-store.ts` (`removeEdge` 에 `{skipUndo}` 옵션 추가)
- 나머지(CHANGELOG.md, 각종 테스트, `plan/complete/spec-sync-edge-gaps.md`, `review/consistency/...` 산출물, `spec/3-workflow-editor/2-edge.md`)는 문서/테스트/리뷰 산출물이며 실행 코드 변경이 없다.

신규 백엔드 엔드포인트, 신규 네트워크 호출, 신규 인증/인가 로직, 신규 의존성, 암호화/해시 관련 코드는 없다. 순수 클라이언트 측 캔버스 상태(Zustand store) 조작이며, 최종적으로 만들어지는 엣지 2개는 기존 `onConnect`(`evaluateConnection`) 경로를 그대로 재사용해 기존 유효성 검사(자기연결/중복/컨테이너 충돌)를 그대로 통과해야 한다.

## 항목별 점검

1. **인젝션 취약점**
   - `findEdgeIdAtPoint(clientX, clientY, doc)` 는 `doc.elementFromPoint(x, y)` 결과에 `.closest(".react-flow__edge")` 를 호출한다. CSS 셀렉터는 리터럴 상수(`".react-flow__edge"`)이며 사용자 입력으로 조립되지 않아 셀렉터 인젝션 여지가 없다.
   - 반환값은 `getAttribute("data-id")` 로 얻은 문자열이며, 이후 `edges.find((e) => e.id === droppedEdgeId)` 로 **애플리케이션이 이미 알고 있는 edge id 집합**에 대해서만 조회한다. 매칭 실패 시 `targetEdge` 는 `undefined` 가 되어 분할 없이 안전하게 폴백(노드만 추가)한다 — 임의 id 주입으로 얻을 수 있는 이득이 없다(fail-safe).
   - `event.dataTransfer.getData("application/reactflow-type")` 로 얻는 `nodeType` 은 `getNodeDefinition(nodeType)` 이 정적 레지스트리에 없으면 `undefined` 를 반환해 조용히 무시하는 기존 패턴을 그대로 재사용한다(이번 diff 로 새로 생긴 검증 로직 아님, 기존 `buildAndAddNode` 확인됨). SQL/커맨드/경로 조작 등 서버 자원에 닿는 경로가 없다.
   - DOM API(`elementFromPoint`)를 쓰지만 `innerHTML`/`dangerouslySetInnerHTML`/`eval` 류는 이번 diff 에 없다.

2. **하드코딩된 시크릿**: 없음. diff 전체에 API 키/토큰/자격증명 문자열 없음.

3. **인증/인가**: 변경 없음. 이 기능은 이미 인증된 사용자가 워크플로 편집기 캔버스 내에서 로컬 상태(저장 전 undo 가능 상태)를 조작하는 것으로, 서버 저장/실행 API 호출을 새로 추가하지 않는다. 최종 저장 시 기존 백엔드 검증(및 spec 이 명시하는 DB UNIQUE/CHECK 제약, `source_node_id != target_node_id` 등)이 최종 방어선으로 남아있다.

4. **입력 검증**: 새 노드의 포트 존재 여부(`firstInputHandleId`/`firstOutputHandleId`)와 컨테이너 경계 엣지 여부(`isContainerBoundaryEdge`)를 검사해 정의되지 않은 케이스는 `null` 을 반환하고 분할을 생략하는 명시적 화이트리스트 방식이라 안전하다. 원본 엣지의 `sourceHandle`/`targetHandle` 을 그대로 보존해 새로 만든 두 Connection 도 결국 `onConnect`/`evaluateConnection` 의 기존 검증(자기연결, 중복, 컨테이너 충돌)을 거친다.

5. **OWASP Top 10**: 해당 사항 없음(A03 Injection, A01 Broken Access Control 등 관련 신규 표면 없음). 순수 UI 상태 편집 기능.

6. **암호화**: 새 노드 id 생성에 기존과 동일하게 `crypto.randomUUID()` 를 사용(이번 diff 신규 아님, 기존 `buildAndAddNode` 재사용). 보안 목적의 난수가 아니라 UI 엔티티 id 용도로 적절.

7. **에러 처리**: 이번 diff 는 사용자에게 노출되는 에러 메시지를 추가하지 않는다(실패 시 조용히 폴백). 민감정보 노출 경로 없음.

8. **의존성 보안**: 신규 패키지/버전 변경 없음.

## 발견사항

- 없음 (CRITICAL/WARNING 없음). 특기할 INFO 성격의 관찰은 아래와 같으나 조치 불요.
  - **[INFO]** DOM 클래스 기반 hit-test 는 같은 신뢰 경계(same-origin, React Flow 가 렌더한 DOM) 안에서만 유효하다는 전제
    - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint`
    - 상세: `.react-flow__edge` 클래스를 가진 임의 DOM 엘리먼트가 (다른 경로의 XSS 등으로) 주입된다면 `data-id` 값을 조작해 다른 엣지를 분할 대상으로 오인시킬 수 있다. 다만 이는 이 기능이 새로 만든 공격 표면이 아니라, 이미 XSS 가 성립한 이후에나 의미 있는 시나리오이며 결과도 "엣지 재배선"에 그쳐(서버측 재검증 존재) 심각도가 낮다.
    - 제안: 별도 조치 불요. 현재 애플리케이션에 DOM 기반 XSS 가 없다는 전제가 유지되는 한 안전하다.

## 요약

이번 PR 은 워크플로 편집기 캔버스의 순수 프런트엔드 UX 기능(엣지 위 노드 드롭 시 분할·삽입)으로, 신규 서버 API·인증/인가 로직·시크릿·암호화 코드가 없고 사용자 입력(드롭된 노드 타입, hit-test 로 얻은 edge id)은 모두 기존 화이트리스트/폴백 패턴으로 안전하게 처리된다. 최종적으로 생성되는 엣지는 기존에 검증된 `onConnect`/`evaluateConnection` 경로를 그대로 재사용하므로 자기연결·중복·컨테이너 충돌 등 기존 불변식이 우회되지 않는다. 보안 관점에서 실질적 위험은 발견되지 않았다.

## 위험도
NONE
