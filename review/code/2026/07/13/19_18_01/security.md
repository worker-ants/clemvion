# 보안(Security) 리뷰

## 검토 범위

워크플로 편집기(React/Next.js 프런트엔드)에서 "팔레트 노드를 기존 엣지 위에 드롭하면 엣지를 분할(split)하고 중간에 노드를 삽입" 하는 §4.1 기능 (spec `3-workflow-editor/2-edge.md` §4.1, R-3). 코드 변경은 3개 파일에 한정된다.

- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` — `onDrop` 이 `findEdgeIdAtPoint` 로 드롭 지점의 엣지를 찾고, `buildEdgeSplitPlan` 이 만든 계획을 `removeEdge`+`onConnect`×2 로 적용.
- `codebase/frontend/src/lib/utils/edge-utils.ts` — 신규 순수 헬퍼 `firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`.
- `codebase/frontend/src/lib/stores/editor-store.ts` — `removeEdge` 에 `{skipUndo}` 옵션 추가(로직 변경 없음).

나머지(CHANGELOG.md, `*.mdx` 유저 가이드, 테스트, `spec/3-workflow-editor/2-edge.md`, `plan/complete/spec-sync-edge-gaps.md`, `review/**` 산출물)는 문서·테스트·이전 리뷰 라운드(18_32_28, 18_59_13) 산출물이며 실행 코드 변경이 없다. 신규 백엔드 엔드포인트, 신규 네트워크 호출, 신규 인증/인가 로직, 신규 의존성, 암호화/해시 관련 코드는 diff 어디에도 없다 — 순수 클라이언트 측 Zustand store 상태 조작이고, 최종적으로 만들어지는 두 엣지는 기존 `onConnect`(→`evaluateConnection`) 경로를 그대로 재사용해 기존 유효성 검사(자기연결/중복/컨테이너 충돌)를 그대로 통과해야 한다.

## 항목별 점검

1. **인젝션 취약점**
   - `findEdgeIdAtPoint(clientX, clientY, doc)` 는 `doc.elementFromPoint(x, y)` 결과에 `.closest(".react-flow__edge")` 를 호출한다. CSS 셀렉터는 리터럴 상수이며 사용자 입력으로 조립되지 않아 셀렉터 인젝션 여지가 없다.
   - 반환값(`getAttribute("data-id")`)은 이후 `edges.find((e) => e.id === droppedEdgeId)` 로 애플리케이션이 이미 알고 있는 edge id 집합에 대해서만 조회된다. 매칭 실패 시 `targetEdge` 는 `undefined` 가 되어 분할 없이 노드만 추가하는 방향으로 안전하게 폴백한다 — 임의 id 로 얻을 수 있는 이득이 없다.
   - `buildEdgeSplitPlan` 은 `edge.source`/`edge.target`/`edge.sourceHandle`/`edge.targetHandle` 을 그대로 복사해 새 `Connection` 객체 필드로 조립할 뿐 문자열 결합·템플릿 실행·`eval`/`Function`/`innerHTML` 계열 호출이 없다. SQL/커맨드/경로 조작 등 서버 자원에 닿는 경로도 없다(이 기능은 서버 API 를 새로 호출하지 않음).
   - `getNodeDefinition(nodeType)` 이 정적 레지스트리에 없는 타입은 `undefined` 를 반환해 조용히 무시하는 기존 패턴(이번 diff 로 신설된 로직 아님)을 그대로 재사용한다.

2. **하드코딩된 시크릿**: 없음. diff 전체에 API 키/토큰/자격증명/인증서 문자열 없음.

3. **인증/인가**: 변경 없음. 이미 인증된 사용자가 워크플로 편집기 캔버스에서 로컬(저장 전, undo 가능) 상태를 조작하는 기능으로, 서버 저장/실행 API 를 새로 추가하지 않는다. 최종 저장 시 기존 백엔드 검증(엣지 UNIQUE/CHECK 제약, `source_node_id != target_node_id` 등)이 최종 방어선으로 그대로 남는다. `removeEdge`/`onConnect` 는 모두 클라이언트 로컬 store 액션이며 원격 권한 경계를 넘지 않는다.

4. **입력 검증**: 새 노드의 입출력 포트 존재 여부(`firstInputHandleId`/`firstOutputHandleId`)와 컨테이너 경계 엣지 여부(`isContainerBoundaryEdge`)·컨테이너 신규 노드 여부(`definition?.isContainer`)를 검사해 정의되지 않은 조합은 전부 `null` 을 반환하고 분할을 생략하는 화이트리스트 방식이다(1회차 ai-review CRITICAL이었던 "컨테이너 새 노드 body 재편입" 케이스는 `if (definition?.isContainer) return null` 가드로 해소되어 있음, 코드 확인 완료). 원본 엣지의 `sourceHandle`/`targetHandle` 을 그대로 보존해 새로 만든 두 Connection 도 결국 `onConnect`/`evaluateConnection` 의 기존 검증(자기연결, 중복, `detectContainerConflict`)을 거친다.

5. **OWASP Top 10**: 해당 사항 없음. 신규 인증/인가·서버측 신뢰 경계·직렬화 역직렬화·SSRF 관련 표면이 이 changeset 에 없다.

6. **암호화**: 새 노드 id 생성은 기존 `buildAndAddNode` 경로(이번 diff 무변경)를 그대로 재사용. 이번 diff 자체에 신규 해시/암호화/평문 전송 코드 없음.

7. **에러 처리**: 이번 diff 는 사용자에게 노출되는 신규 에러 메시지를 추가하지 않는다. 분할 불가 케이스는 조용히 "노드만 추가" 로 폴백하며 스택트레이스·내부 경로·민감정보를 노출하는 경로가 없다.

8. **의존성 보안**: 신규 패키지·버전 변경 없음(diff 는 기존 파일 내부 함수 추가/옵션 확장뿐).

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** DOM 클래스 기반 hit-test(`findEdgeIdAtPoint`)는 "React Flow 가 렌더한 DOM 안에 신뢰할 수 없는 `.react-flow__edge` 요소가 주입되지 않는다"는 same-origin 전제에 의존한다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`findEdgeIdAtPoint`)
  - 상세: 이론상 (다른 경로의 XSS 등으로) `.react-flow__edge[data-id]` 형태의 임의 엘리먼트가 DOM 에 주입된다면 `data-id` 값을 조작해 엉뚱한 엣지를 분할 대상으로 오인시킬 수 있다. 다만 이는 이 기능이 새로 만든 공격 표면이 아니며, XSS 가 이미 성립한 이후에나 의미 있는 시나리오이고 결과도 "로컬 캔버스에서 엣지 재배선"에 그친다(서버 저장 시 기존 백엔드 재검증 존재, 원격 코드 실행·데이터 유출 경로 아님).
  - 제안: 별도 조치 불요. 현재 애플리케이션에 DOM 기반 XSS 가 없다는 전제가 유지되는 한 안전.

## 확인된 양호 사항 (참고)

- `removeEdge` 의 `{skipUndo}` 옵션 추가는 기존 로직(엣지 필터링, containerId 재도출)을 변경하지 않고 `pushUndo` 호출 여부만 조건화한 순수 확장이라 회귀 위험이 낮다.
- 이전 두 차례 ai-review(`review/code/2026/07/13/18_32_28/security.md` 위험도 NONE, `review/code/2026/07/13/18_59_13/security.md` 라운드는 security 재검토 대상 아니었으나 architecture/requirement 가 컨테이너 새 노드 가드를 코드 대조로 재확인)의 결론을 본 3회차에서 diff 를 직접 재확인해 동일하게 재현했다 — 회귀 없음.

## 요약

이번 변경은 워크플로 편집기 캔버스의 순수 프런트엔드 UX 기능(엣지 위 노드 드롭 시 분할·삽입)으로, 신규 서버 API·인증/인가 로직·시크릿·암호화 코드가 없고, 유일한 "외부 입력"인 DOM hit-test 결과(edge id)와 드롭된 노드 타입은 모두 기존 화이트리스트/폴백 패턴으로 안전하게 처리된다. 분할로 생성되는 두 엣지는 기존에 검증된 `onConnect`/`evaluateConnection` 경로를 그대로 재사용하므로 자기연결·중복·컨테이너 충돌 등 기존 불변식이 우회되지 않으며, 1회차 리뷰에서 지적된 "컨테이너 새 노드 body 재편입" CRITICAL 은 `isContainer` 가드로 해소된 상태가 코드에 반영되어 있음을 확인했다. 보안 관점에서 실질적 위험은 발견되지 않았다.

## 위험도

NONE
