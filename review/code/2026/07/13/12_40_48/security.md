# 보안(Security) Review

## 발견사항

- **[INFO]** 재연결(`onReconnect`)·detach(`deleteEdge`) 는 클라이언트 상태만 변경 — 서버 측 불변식은 그대로 최종 안전망
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` (`onReconnect`, `deleteEdge`), `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: 신규 `onReconnect`/`deleteEdge` 는 Zustand 로컬 상태(`edges`/`nodes`)만 갱신한다. 자기연결·중복·컨테이너 충돌 검사(`isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict`)는 `onConnect` 과 동일한 로직을 재사용하므로 우회 신설 경로가 아니다. 조작된 클라이언트(예: devtools 로 스토어 직접 mutate)가 이 검증을 건너뛰어도, spec(`2-edge.md` §2.2)에 명시된 DB 레벨 `source_node_id != target_node_id` 및 UNIQUE 제약이 저장 시점의 최종 방어선으로 이미 존재한다고 문서화되어 있다 — 이번 diff 로 이 이중 방어 구조가 약화되지 않았다.
  - 제안: 없음(확인 목적의 기록). 향후 백엔드 엣지 저장 API 변경 시 이 불변식이 실제로 강제되는지(마이그레이션/제약 존재 여부) 별도 검증 권장.

- **[INFO]** `toast.error` 메시지는 정적 문자열 — 사용자 입력 반영 없음(XSS 벡터 없음)
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` (`toast.error("These nodes are already connected.")`, `toast.error(conflict)`)
  - 상세: `conflict` 는 `detectContainerConflict` 반환값으로 노드/포트 메타데이터 기반 사전 정의 메시지이지 임의 사용자 입력을 그대로 렌더링하지 않는다. `sonner` toast 는 기본적으로 텍스트를 innerHTML 로 주입하지 않으므로 인젝션 경로 없음.
  - 제안: 해당 없음.

- **[INFO]** 신규 코드에 `dangerouslySetInnerHTML`/`eval`/동적 `Function`/직접 DOM `innerHTML` 조작 없음
  - 위치: `use-edge-reconnect.ts`, `workflow-canvas.tsx`, `edge-utils.ts` 전체
  - 상세: 모든 신규 로직이 순수 함수(핸들 id 비교, Connection 조립) 또는 React 상태 갱신으로 구성되어 있어 XSS/커맨드 인젝션 표면이 없다.
  - 제안: 해당 없음.

## 요약
이번 변경은 워크플로 에디터(React Flow 캔버스)의 엣지 재연결/분리(detach) 기능과 관련 문서·spec·plan 갱신으로, 백엔드 API·인증/인가·시크릿·암호화·의존성에는 영향이 없는 순수 프런트엔드 UI 상태 관리 변경이다. 새로 추가된 `useEdgeReconnect` 훅과 store `onReconnect`/`deleteEdge` 는 로컬 캔버스 상태만 조작하며, 기존 `onConnect` 과 동일한 자기연결/중복/컨테이너 충돌 검증을 재사용하고, 최종 방어선인 DB 레벨 제약(spec 문서화)은 변경되지 않았다. 사용자 입력이 HTML/DOM 에 그대로 삽입되는 경로, 하드코딩된 시크릿, 안전하지 않은 암호화, 민감정보 노출 에러 처리 등 OWASP Top 10 관련 취약점은 발견되지 않았다.

## 위험도
NONE
