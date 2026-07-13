# 보안(Security) Review — spec-sync-edge-gaps §1.3 (엣지 역방향 연결 확인 + 재연결/분리, 4회차 수렴 확인)

## 발견사항

- **[INFO]** 순수 프런트엔드 클라이언트 상태 변경 — 인젝션/시크릿/암호화 관련 취약 패턴 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(`onReconnect`/`removeEdge`/`evaluateConnection`/`buildEdgeDataForConnection`), `codebase/frontend/src/lib/utils/edge-utils.ts`(`firstInputHandleId`/`RESERVED_INPUT_HANDLE_IDS`)
  - 상세: 신규 로직은 전부 Zustand 로컬 상태(`nodes`/`edges`) 갱신과 React Flow 콜백 배선이다(직접 diff 확인: `reconnectEdge`/`addEdge` 임포트, `set()` 갱신, `useCallback` 훅 조합뿐). `dangerouslySetInnerHTML`/`eval`/동적 `Function`/원시 SQL·셸 명령 조합/경로 조작 문자열이 없다. `connection`/`edge` 객체는 자유 텍스트가 아니라 React Flow 드래그 상태에서 파생된 구조화 데이터이고, `source`/`target`은 이미 캔버스에 존재하는 노드 id 집합 내에서만 결정된다. 하드코딩된 API 키·비밀번호·토큰·인증서도 없다.
  - 제안: 없음(확인 목적).

- **[INFO]** 재연결 검증은 `onConnect`과 공용 헬퍼(`evaluateConnection`)로 통합 — 우회 신설 경로 없음, 이전 라운드 CRITICAL(자기연결 드롭 시 엣지 오삭제)도 재확인 결과 해소 유지
  - 위치: `editor-store.ts` `evaluateConnection`(판별 유니온 `{ok:true}`/`{ok:false; message?}`), `onReconnect`(중복 검사 시 재연결 중인 엣지 자신만 제외), `use-edge-reconnect.ts` `onReconnectEnd`
  - 상세: detach 판정은 "onReconnect 콜백 호출 성공 여부"가 아니라 `connectionState.toNode === null`(드롭 위치가 pane 인지)로 되어 있어, 무효 핸들(자기연결 등) 위 드롭은 `toNode`가 존재하므로 삭제되지 않고 원상 유지된다 — `review/code/2026/07/13/12_40_48` 세션이 지적한 CRITICAL(자기연결 드롭 시 기존 엣지 오삭제, 데이터 무결성 이슈이자 잠재적 DoS성 워크플로 파손)이 이후 두 라운드(`13_06_50`, `13_27_36`)와 이번 재확인 모두에서 재현되지 않는다. 클라이언트 측 검증(`isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict`)이 조작된 클라이언트(devtools 로 스토어 직접 mutate)에 의해 우회되더라도, spec(`spec/3-workflow-editor/2-edge.md` §2.2)에 문서화된 DB 레벨 제약(`source_node_id != target_node_id`, UNIQUE)이 최종 저장 시점 방어선으로 남아 있으며 이번 diff 는 백엔드/DB 스키마를 건드리지 않는다.
  - 제안: 없음(확인 목적).

- **[INFO]** `toast.error` 메시지는 정적 리터럴 — 사용자 입력 미반영(XSS 벡터 없음)
  - 위치: `editor-store.ts` `evaluateConnection`(`"These nodes are already connected."`), `detectContainerConflict` 반환 메시지
  - 상세: 두 문자열 모두 노드/포트 메타데이터 기반 사전 정의 값이며 임의 사용자 자유 입력을 그대로 렌더링하지 않는다. `sonner` toast 는 텍스트를 innerHTML 로 주입하지 않는다.
  - 제안: 없음.

- **[INFO]** 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결/detach 대상에 포함됨(신규 취약점 아님, 상호작용 표면의 기존 확대)
  - 위치: `workflow-canvas.tsx`(`onReconnect`/`onReconnectEnd` 배선)
  - 상세: `<ReactFlow>`에 `onReconnect*`를 배선하면서 개별 엣지에 `reconnectable:false`를 부여하지 않아, 컨테이너 진입(`body`)·loopback(`emit`) 같은 구조적 배선도 일반 엣지와 동일하게 드래그로 재연결/분리 가능해진다. 다만 `Delete`/`Backspace`로 임의 엣지를 지우는 것은 이전부터 가능했던 동작이고, `onReconnect` 경로도 `evaluateConnection`(컨테이너 충돌 검사 포함)을 동일 적용하며, 로컬 상태 변경 후 저장 시점의 서버측 구조 검증(엔진 `CONTAINER_MISSING_EMIT` 등)이 최종 게이트로 남아 즉각적 보안·데이터 무결성 침해로 이어지지 않는다.
  - 제안: 보안 관점 조치 불요(UX/무결성 백로그 성격, 이미 3개 라운드에서 동일 결론).

- **[INFO]** 함께 커밋된 이전 리뷰 산출물(`review/code/2026/07/13/{12_40_48,13_06_50,13_27_36}/*`)에 시크릿·자격증명·내부 인프라 세부사항 없음
  - 위치: 각 디렉터리의 `RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/개별 리뷰어 `.md`
  - 상세: `_retry_state.json` 3개 파일 내용을 직접 확인 — 리뷰 세션 메타데이터(경로·타임스탬프·에이전트 목록·재시도 카운터)뿐이며 API 키/토큰/비밀번호/DB 연결 문자열/개인정보는 포함되어 있지 않다. `session_dir` 등 경로 값도 로컬 워크트리 절대경로로, 배포 인프라 정보 노출이 아니다.
  - 제안: 없음.

- **[INFO]** 백엔드/DB 레벨 최종 방어선 무변경
  - 위치: 전체 changeset(`codebase/backend` 비포함, `git diff origin/main...HEAD` 로 확인)
  - 상세: CHANGELOG·spec 이 "백엔드·wire 무변경"을 명시하고 실제로 이번 changeset 은 `codebase/frontend`, 문서(mdx), spec/plan, 리뷰 산출물에 한정된다. DB 스키마 제약, 인증/인가 미들웨어, 세션 관리 로직에 대한 변경이 없다.
  - 제안: 없음.

## 요약

이번 changeset 은 워크플로 편집기 캔버스의 엣지 역방향 연결 확인(§1.3 전반부, React Flow 네이티브 동작 확인이라 커스텀 코드 불요) 및 기존 엣지 재연결/분리(§1.3 후반부, 순수 프런트엔드 상태 `zustand editor-store.ts` + React Flow 콜백 배선 `use-edge-reconnect.ts`/`workflow-canvas.tsx`)를 구현하고, 관련 mdx 문서·spec·plan·3회분 이전 ai-review 산출물을 함께 커밋한 4회차(수렴 확인) 리뷰 대상이다. 인젝션(SQL/XSS/커맨드/경로 탐색), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 취약 의존성 등 OWASP Top 10 관련 취약점은 발견되지 않았다. 재연결 검증은 기존 `onConnect`과 `evaluateConnection` 공용 헬퍼로 통합되어 우회 경로가 없으며, 1회차(`12_40_48`)에서 지적된 CRITICAL(자기연결 드롭 시 엣지 오삭제 — 데이터 무결성 결함)도 드롭 위치(`connectionState.toNode`) 기준 판정으로 재설계되어 이후 2개 라운드와 이번 재확인 모두에서 재현되지 않았다. 이 CRITICAL 은 보안 카테고리(인증/인가/인젝션/시크릿)에 해당하는 결함은 아니었고 클라이언트 로컬 상태의 데이터 무결성 문제였다는 점도 재확인했다. 백엔드·DB 레벨 제약은 이번 diff 대상 밖으로 최종 방어선이 그대로 유지된다. 구조적 엣지(body/emit)가 드래그 재연결/삭제 대상에서 제외되지 않는 점은 참고(INFO) 수준의 UX/무결성 관찰로, 3개 라운드 연속 동일하게 보안 위험으로 분류하지 않는다.

## 위험도
NONE
