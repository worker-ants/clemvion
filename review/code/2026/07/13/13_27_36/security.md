# 보안(Security) Review — spec-sync-edge-gaps §1.3 (엣지 재연결/역방향 연결, 3rd round)

## 발견사항

- **[INFO]** 순수 프런트엔드 클라이언트 상태 변경 — 인젝션/시크릿/암호화 관련 취약 패턴 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts` (`onReconnect`/`removeEdge`/`evaluateConnection`/`buildEdgeDataForConnection`), `codebase/frontend/src/lib/utils/edge-utils.ts` (`firstInputHandleId`/`RESERVED_INPUT_HANDLE_IDS`)
  - 상세: 신규 로직은 모두 Zustand 로컬 상태(`nodes`/`edges`) 갱신 및 React Flow 콜백 배선으로 구성되며, `dangerouslySetInnerHTML`/`eval`/동적 `Function`/원시 SQL·커맨드 문자열 조합·경로 조작이 없다. `connection`/`edge` 객체는 자유 텍스트가 아니라 React Flow 드래그 상태에서 파생된 구조화 데이터이고 source/target 은 기존 노드 id 집합 내에서만 결정된다. 하드코딩된 API 키·비밀번호·토큰도 없다.
  - 제안: 없음(확인 목적).

- **[INFO]** 재연결 검증은 `onConnect` 과 공용화(`evaluateConnection`)되어 우회 경로 없음, 자기연결 오삭제 CRITICAL(이전 라운드 지적)도 해소 확인
  - 위치: `editor-store.ts` `onReconnect`(`evaluateConnection` 재사용, 중복검사는 재연결 중인 엣지 자신만 제외), `use-edge-reconnect.ts` `onReconnectEnd`
  - 상세: detach 판정이 "onReconnect 호출 성공 여부" 가 아니라 `connectionState.toNode === null`(드롭 위치, pane 여부)로 되어 있어, 무효 핸들(자기연결 등) 위 드롭은 `toNode` 존재로 삭제되지 않고 원상 유지된다 — `review/code/2026/07/13/12_40_48` 세션이 지적한 CRITICAL(자기연결 드롭 시 기존 엣지 오삭제)이 diff 상 재현되지 않음을 재확인. 클라이언트 측 검증(`isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict`)이 조작된 클라이언트(devtools 직접 mutate)에 우회당해도, spec(`2-edge.md`)에 명시된 DB 레벨 제약(`source_node_id != target_node_id`, UNIQUE)이 최종 방어선으로 그대로 남아 있다.
  - 제안: 없음(확인 목적). 백엔드 엣지 저장 API 자체는 이번 diff 대상이 아니므로 별도 검증 불요.

- **[INFO]** `toast.error` 메시지는 정적 리터럴 — 사용자 입력 미반영(XSS 벡터 없음)
  - 위치: `editor-store.ts` `evaluateConnection`("These nodes are already connected.", `detectContainerConflict` 반환 메시지)
  - 상세: 두 문자열 모두 노드/포트 메타데이터 기반 사전 정의 값이며 임의 사용자 자유 입력을 그대로 렌더링하지 않는다. `sonner` toast 는 텍스트를 innerHTML 로 주입하지 않는다.
  - 제안: 없음.

- **[INFO]** 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결/detach 대상에 포함됨(신규 취약점 아님, 기존 확대)
  - 위치: `workflow-canvas.tsx` (`onReconnect`/`onReconnectEnd` 배선), `use-edge-reconnect.ts`
  - 상세: `<ReactFlow>` 에 `onReconnect*` 를 배선하면서 개별 엣지에 `reconnectable:false` 를 부여하지 않아 구조적 엣지도 일반 엣지와 동일하게 재연결/분리 가능. `Delete`/`Backspace` 로 임의 엣지를 지우는 것은 이전부터 가능했고, 로컬 상태 변경 후 저장 시점의 서버측 구조 검증(엔진 `CONTAINER_MISSING_EMIT` 등)이 최종 게이트로 남아 즉각적 보안·무결성 침해로 이어지지 않는다. `onReconnect` 경로도 `evaluateConnection`(컨테이너 충돌 검사 포함)을 동일 적용한다.
  - 제안: 보안 관점 조치 불요(UX/무결성 백로그 성격).

- **[INFO]** 이번 diff 에 함께 커밋된 이전 리뷰 산출물(`review/code/2026/07/13/12_40_48/*`, `review/code/2026/07/13/13_06_50/*`)에 시크릿·자격증명·내부 인프라 세부사항 없음
  - 위치: 해당 디렉터리의 `RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/각 리뷰어 `.md`
  - 상세: 내용은 리뷰 메타데이터·발견사항·경로·타임스탬프뿐이며 API 키/토큰/비밀번호/DB 연결 문자열 등은 포함되어 있지 않다.
  - 제안: 없음.

- **[INFO]** 백엔드/DB 레벨 최종 방어선 무변경
  - 위치: 전체 changeset (`codebase/backend` 비포함)
  - 상세: CHANGELOG·spec 이 "백엔드·wire 무변경"을 명시하며 실제로 이번 changeset 은 `codebase/frontend`, 문서(mdx), spec/plan, 리뷰 산출물에 한정된다. DB 스키마 제약, 인증/인가 미들웨어, 세션 관리 로직에 대한 변경이 없다.
  - 제안: 없음.

## 요약
이번 변경은 워크플로 편집기 캔버스의 엣지 재연결(§1.3)·detach(빈 영역 드롭 삭제) 기능을 순수 프런트엔드 상태(zustand `editor-store.ts`)와 React Flow 콜백 배선(`use-edge-reconnect.ts`, `workflow-canvas.tsx`)으로 구현하고, 관련 문서(mdx)·spec·plan·이전 리뷰 산출물을 함께 커밋한 것이다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리 등 OWASP Top 10 관련 취약점은 발견되지 않았다. 재연결 검증은 기존 `onConnect` 과 `evaluateConnection` 으로 공용화되어 우회 경로가 없고, 이전 라운드(12_40_48)에서 지적된 CRITICAL(자기연결 드롭 시 엣지 오삭제)도 드롭 위치(`toNode`) 기준 판정으로 이미 해소되어 재현되지 않는다. 백엔드·DB 레벨 제약은 이번 diff 대상 밖으로 최종 방어선이 그대로 유지된다. 구조적 엣지(body/emit)가 드래그 재연결/삭제 대상에서 제외되지 않는 점은 참고(INFO) 수준의 UX/무결성 관찰이며 보안 위험으로 보지 않는다.

## 위험도
NONE
