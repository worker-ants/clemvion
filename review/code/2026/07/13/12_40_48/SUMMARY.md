# Code Review 통합 보고서

## 전체 위험도
**HIGH** — reconnect 드래그가 자기연결(self-connection) 대상에 드롭되면 "onConnect 과 동일한 유효성 하드 차단(no-op)" 이라는 명시된 의도와 달리 **기존 엣지가 조용히 삭제**되는 CRITICAL 결함이 requirement 리뷰어에서 확인됨(Undo 로 복구는 가능). 추가로 4개 리뷰어(scope/testing/documentation/user_guide_sync)의 산출 파일이 디스크에 실제로 기록되지 않아(disk-write gap) 해당 관점의 검토 결과가 누락된 상태 — 재실행 전까지는 통합 보고서가 불완전함에 유의.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | reconnect 드래그가 자기연결 대상에 드롭되면 React Flow 의 `isValidConnection`(자기연결만 하드 차단) 이 `isValid=false` 를 반환해 `onReconnect` 콜백 자체가 호출되지 않는다. 그런데 `onReconnectEnd` 는 항상 호출되고, `useEdgeReconnect` 훅은 "onReconnect 미호출 = successful 여전히 false" 로 판정해 `deleteEdge(edge.id)` 를 실행 — 즉 자기연결 드롭이 빈 영역 드롭과 동일하게 취급돼 **기존 엣지가 삭제**된다. `editor-store.ts` `onReconnect` 내부의 `isSelfConnection` 방어 코드(758-759행)는 이 경로에 실제로 도달하지 않는 dead code 이며, 관련 스토어 테스트도 `onReconnect` 를 직접 호출해 통과하므로 거짓 안심(false confidence)을 준다. "onConnect 과 동일한 유효성" 이라는 JSDoc·CHANGELOG·spec 서술과 어긋나는 비대칭 결함 | `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`(`onReconnectStart`/`onReconnect`/`onReconnectEnd`), `codebase/frontend/src/lib/stores/editor-store.ts` `isValidConnection`(808-812)/`onReconnect`(757-800) | `useEdgeReconnect` 가 "새 연결로 성공적으로 갱신됐는가" 와 "유효 핸들에 드롭됐지만 앱 레벨 사유로 거부됐는가" 를 구분하도록 `onReconnect` 콜백에서 store 의 수락/거부 반환값을 훅에 전달하거나, 자기연결 검사를 `isValidConnection` 레벨이 아닌 reconnect 전용 판정으로 분리해 "자기연결 드롭=원상 유지" 를 실제로 달성. 최소한 실제 `isValidConnection` 게이트를 포함한 통합 테스트로 회귀 방지 필요 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | architecture / maintainability | `onConnect`/`onReconnect` 간 검증 오케스트레이션(자기연결→중복→컨테이너 충돌 체크 + toast) 및 엣지데이터 파생 로직("sourceNode 조회→sourceNodeType 추출→buildEdgeData" 3줄)이 리터럴 그대로 중복. 두 리뷰어(architecture, maintainability) 가 동일 이슈를 지적. 향후 한쪽에만 새 검증 규칙이 추가되고 반대쪽이 누락되는 drift 위험(현재 리스크 자체는 낮음 — 두 곳 로직은 현재 일치) | `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(L710-747) vs `onReconnect`(L749-792/757-800) | `validateConnectionOrToast(nodes, edges, connection, { excludeEdgeId? })` 형태의 공용 가드 함수 + `buildEdgeDataForConnection(nodes, connection)` 헬퍼로 추출해 양쪽에서 호출 |
| 3 | requirement | 신규 테스트 파일에 `Connection` 타입이 미-import 상태로 사용되어 TS2304 컴파일 오류가 실재하나, (a) tsconfig `exclude` 의 `__tests__` 패턴과 (b) `vitest run` 의 타입 strip 이중 가드로 어떤 CI 단계에서도 검출되지 않음(121건 런타임 테스트는 모두 통과) | `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts:181` | `import type { Connection } from "@xyflow/react";` 추가 |
| 4 | side_effect | 신규 store 메서드 `deleteEdge`(로컬 zustand 상태만 변경, undo 가능, 즉시 서버 미반영)가 기존 `workflowsApi.deleteEdge`(`/edges/:id` 즉시 네트워크 DELETE, 현재 미호출 dead code)와 이름이 동일 — 부작용 프로파일이 정반대라 향후 오배선 시 저장/undo 관례를 건너뛰고 실수로 즉시 서버 삭제를 트리거할 위험 | `codebase/frontend/src/lib/stores/editor-store.ts:99,794` vs `codebase/frontend/src/lib/api/workflows.ts:147` | store 메서드를 `removeEdge` 등으로 개명하거나, 미사용 `workflowsApi.deleteEdge`/`createEdge`(개별 엣지 REST) 를 제거해 혼동 소지 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | security | `onReconnect`/`deleteEdge` 는 클라이언트 상태만 변경 — DB 레벨 제약(`source_node_id != target_node_id`, UNIQUE)이 최종 안전망으로 그대로 존재, 이번 diff 로 이중 방어 약화 없음 | `editor-store.ts`, `use-edge-reconnect.ts` | 없음(확인 목적) |
| 6 | security | `toast.error` 메시지는 정적/사전정의 문자열 — 사용자 입력 미반영, XSS 벡터 없음 | `editor-store.ts` `onReconnect` | 해당 없음 |
| 7 | security | 신규 코드에 `dangerouslySetInnerHTML`/`eval`/동적 `Function` 없음 | `use-edge-reconnect.ts`, `workflow-canvas.tsx`, `edge-utils.ts` | 해당 없음 |
| 8 | architecture | `workflow-canvas.tsx` 책임 팽창은 이번 PR 로 일부 완화(재연결 글루를 훅으로 분리)됐고, 잔여(팝업 오케스트레이션)는 plan §1.2 이월 항목 (a)/(d) 로 이미 의도적으로 추적 중 — 신규 결함 아님 | `workflow-canvas.tsx` | 별도 조치 불요, §4 오케스트레이션 정리 시점에 함께 처리 |
| 9 | architecture | 예약 입력 포트 집합(`emit`)이 FE(`RESERVED_INPUT_HANDLE_IDS`)/BE(`CONTAINER_LOOPBACK_PORTS`) 양쪽에 독립 리터럴로 존재 — latent drift 위험(현재 원소 1개라 실용적 선택) | `edge-utils.ts` | 예약 포트 2개 이상 증가 시 공유 상수/패키지 승격 검토 |
| 10 | requirement | `onReconnect`/`deleteEdge` 는 재연결 결과가 기존 엣지와 동일해도 무조건 `pushUndo()` 실행 — 변화 없는 undo 스냅샷 하나 남음(영향 미미) | `editor-store.ts` `onReconnect`(776), `deleteEdge`(~1802) | 우선순위 낮음, 필요 시 "실제 변경 시에만 pushUndo" 최적화 |
| 11 | side_effect | `<ReactFlow>` 에 `onReconnect*` 배선 시 구조적 엣지(컨테이너 `body`/`emit`)도 기본적으로 드래그 재연결/분리 대상이 됨(`reconnectable:false` opt-out 없음) — Delete 로 지우는 것은 기존에도 가능했던 동작이라 완전히 새로운 무결성 위험은 아님 | `workflow-canvas.tsx` (`onReconnectStart`/`onReconnect`/`onReconnectEnd` 배선) | 의도된 동작이면 무시 가능. 컨테이너 필수 배선을 재연결 대상에서 제외하려면 `reconnectable:false` 부여 검토 |
| 12 | side_effect | `firstInputHandleId` 동작 변경(첫 입력이 예약 포트면 skip) — 시그니처 동일, 유일 호출부(`buildAutoConnectConnection`)에 현재 회귀 없음, 신규 테스트 2건 커버 | `edge-utils.ts` | 없음, 신규 컨테이너 노드 추가 시 계약 유지만 유의 |
| 13 | side_effect | `EditorState` 인터페이스에 `onReconnect`/`deleteEdge` 추가 — additive, 하위 호환, 기존 소비자 영향 없음 | `editor-store.ts` (`interface EditorState`) | 없음 |
| 14 | side_effect | `useEdgeReconnect` 의 `successful` ref 는 컴포넌트 인스턴스 스코프(전역 아님) — 단일 포인터 드래그 모델과 일치 | `use-edge-reconnect.ts` | 없음 |
| 15 | side_effect | store `onReconnect`/`deleteEdge` 는 저장 전까지 로컬 상태만 변경 — 기존 `onConnect`/`removeNode` 패턴과 일관, 신규 네트워크 호출 없음 | `editor-store.ts` | 없음 |
| 16 | maintainability | `workflow-canvas.tsx`(993줄 God Component)에 로직을 더 얹지 않고 `useEdgeReconnect` 훅으로 순수 분리, 회귀 취약 케이스(직전 제스처 성공 플래그 이월 없음)까지 `renderHook` 으로 커버 — 긍정 | `use-edge-reconnect.ts`, `__tests__/use-edge-reconnect.test.ts` | 없음(모범 사례) |
| 17 | maintainability | `firstInputHandleId` 매직 스트링을 명명된 `RESERVED_INPUT_HANDLE_IDS` 상수로 정리, BE SoT 주석 명시, 테스트 2건 추가 — 긍정 | `edge-utils.ts` | 없음 |
| 18 | maintainability | 셀렉터 변수명 `reconnectEdgeInStore` 가 인접 코드의 `onConnect = useEditorStore(...)` 네이밍 컨벤션과 국소적으로 다름(이름 충돌 회피 목적, 타당하나 이유가 코드만으론 안 드러남) | `workflow-canvas.tsx` L347-349 | 한 줄 주석으로 이유 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프런트엔드 상태 변경, DB 제약이 최종 안전망 그대로 유지, XSS/인젝션 벡터 없음 |
| architecture | LOW | onConnect/onReconnect 오케스트레이션 중복(WARNING), 나머지는 레이어 경계 명확·이월 항목 의도적 |
| requirement | MEDIUM | **CRITICAL**: 자기연결 reconnect 드롭이 엣지 삭제로 오귀결(dead-code 방어, 거짓 안심 테스트) + TS 컴파일 오류 은닉(WARNING) |
| side_effect | LOW | `deleteEdge` 네이밍 충돌(WARNING, 부작용 프로파일 정반대), 구조적 엣지 드래그 재연결 표면 확대(INFO) |
| maintainability | LOW | onConnect/onReconnect 검증+데이터파생 5단계 중복(WARNING), 훅 분리·테스트 품질은 긍정 |

## 발견 없는 에이전트

- (해당 리뷰어 없음 — 실행된 5개 리뷰어 모두 최소 INFO 이상 발견사항 보고)

## 출력 유실 — 재시도 필요 (disk-write gap)

아래 4개 리뷰어는 `ran` 목록에 `status=success` 로 보고되었으나, 지정된 `output_file` 이 세션 디렉터리에 실제로 존재하지 않아(`ls` 확인) 내용을 읽을 수 없었다. 이는 과거 확인된 "sub-agent 반환 성공 vs 디스크 미기록" 갭 패턴과 일치하며, 이 상태로는 아래 리뷰어의 실제 발견사항(WARNING 포함 여부)을 **알 수 없다** — 클린으로 간주해서는 안 됨.

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | 재시도 필요 | 출력 파일(`scope.md`) 디스크 미기록 — 내용 확인 불가 |
| testing | 재시도 필요 | 출력 파일(`testing.md`) 디스크 미기록 — 내용 확인 불가 |
| documentation | 재시도 필요 | 출력 파일(`documentation.md`) 디스크 미기록 — 내용 확인 불가 |
| user_guide_sync | 재시도 필요 | 출력 파일(`user_guide_sync.md`) 디스크 미기록 — 내용 확인 불가 |

## 권장 조치사항

1. **[최우선]** requirement CRITICAL 수정: reconnect 드래그의 자기연결 드롭이 엣지를 삭제하지 않고 "onConnect 과 동일하게 no-op(원상 유지)" 되도록 `useEdgeReconnect`/`onReconnect` 판정 로직을 재구성하고, 실제 `isValidConnection` 게이트를 통과하는 통합 테스트로 회귀 방지.
2. scope/testing/documentation/user_guide_sync 4개 리뷰어를 재실행해 출력 파일이 실제로 기록되는지 확인하고, 그 결과를 이 요약에 반영.
3. `deleteEdge` 이름 충돌 해소(개명 또는 미사용 `workflowsApi.deleteEdge`/`createEdge` 제거) — 향후 오배선에 의한 의도치 않은 즉시 서버 삭제 방지.
4. 신규 테스트 파일의 `Connection` 타입 import 추가(TS2304 은닉 오류 해소).
5. (선택) `onConnect`/`onReconnect` 검증+데이터파생 로직을 공용 헬퍼로 추출해 향후 drift 방지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` (8명 — 소스/spec 문서 변경에 따른 강제, `architecture` 만 router 자체 선별)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 프런트엔드 UI 상태 관리 변경, 성능 민감 경로(대량 루프/쿼리) 없음으로 판단 |
  | dependency | 의존성(패키지) 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/락/레이스 관련 변경 없음 |
  | api_contract | 백엔드 API 계약 변경 없음(순수 클라이언트 상태 변경) |