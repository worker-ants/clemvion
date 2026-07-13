# 요구사항(Requirement) Review — §1.3 역방향 연결 + 엣지 재연결/분리

## 발견사항

- **[CRITICAL]** reconnect 드래그가 **자기연결(self-connection)** 대상에 드롭되면, 의도한 "onConnect 과 동일한 유효성 하드 차단(no-op)" 이 아니라 **기존 엣지가 삭제**된다.
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts` (`onReconnectStart`/`onReconnect`/`onReconnectEnd`) + `codebase/frontend/src/lib/stores/editor-store.ts` `isValidConnection`(808-812)/`onReconnect`(757-800)
  - 상세: `editor-store.ts` 의 `isValidConnection` 은 `!isSelfConnection(connection)` 만 반환한다(자기연결만 하드 차단, §2.2). React Flow 의 실제 커넥션 파이프라인(`@xyflow/system` `isValidHandle`/`onPointerUp`, 확인 완료: `node_modules/@xyflow/system/dist/esm/index.js:2582-2587,2505-2516`)은 `result.isValid = isValid && isValidConnection(connection)` 로 계산하고, `onPointerUp` 은 `if ((closestHandle || resultHandleDomNode) && connection && isValid) onConnect?.(connection)` 로만 `onConnect`(재연결 시 `EdgeUpdateAnchors` 의 `onConnectEdge` → `onReconnect?.(edge, connection)`, `node_modules/@xyflow/react/dist/esm/index.js:2823`)를 호출한다. 즉 **자기연결로 드롭되면 `isValid=false` 라 `onReconnect` 콜백 자체가 호출되지 않는다.** 그런데 `onReconnectEnd` 는 (React Flow 표준 recipe 대로) 항상 호출되고, `useEdgeReconnect` 훅은 "onReconnect 가 불리지 않았다 = successful 이 여전히 false" 로 판정해 `deleteEdge(edge.id)` 를 실행한다 — 즉 **자기연결 드롭 = 빈 영역 드롭과 동일하게 "detach(삭제)" 로 오판**된다.
    - `editor-store.ts` `onReconnect` 내부의 `if (isSelfConnection(newConnection)) return;` (라인 758-759, PR 신규 코드) 는 정확히 이 시나리오를 막으려는 방어 코드이지만, 위 파이프라인 분석대로 **실제로는 절대 도달하지 않는 dead code** 다(같은 패턴이 기존 `onConnect`(라인 711-713)에도 있고 그쪽은 주석에서 "isValidConnection 이 이미 커서로 차단하지만 방어적으로도 확인" 이라 스스로 인정한다 — 다만 `onConnect` 는 "새로 아무것도 안 만든다"가 최종 결과라 무해하지만, `onReconnect` 는 **기존에 존재하던 엣지를 없앤다**는 점에서 결과가 질적으로 다르다).
    - 인터페이스 JSDoc(`editor-store.ts` 92-96): "onConnect 과 동일한 유효성(자기연결/중복/컨테이너 충돌)을 적용" 이라고 명시하지만, 중복·컨테이너 충돌은 (client-side `isValidConnection` 게이트를 통과하므로) `onReconnect` 콜백이 정상 호출되어 "토스트 + 원상 유지" 로 동작하는 반면, 자기연결만 유일하게 "삭제" 로 이어지는 **비대칭**이 발생한다. 이는 spec §1.3 신규 서술("끝점을 빈 영역에 놓으면 삭제") 및 CHANGELOG 의 "onConnect 과 동일한 유효성" 주장과도 어긋난다.
    - `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` 의 "자기연결로의 재연결은 거부한다(변경 없음)" 테스트(라인 1668-1677)는 `useEditorStore.getState().onReconnect(...)` 를 **직접** 호출해 통과하지만, 이는 프로덕션에서 실제로 도달 불가능한 경로를 검증하는 것이라 **거짓 안심(false confidence)** 을 준다 — 실제 배선(훅 + React Flow `isValidConnection` 게이트)을 거치면 반대 결과(삭제)가 나온다. `use-edge-reconnect.test.ts` 도 이 상호작용을 커버하지 않는다(순수하게 `reconnect`/`deleteEdge` mock 을 직접 호출하는 시나리오만 검증).
  - 제안: `useEdgeReconnect` 가 "성공적으로 새 연결로 갱신됐는가" 뿐 아니라 "유효 핸들에 드롭됐지만 앱 레벨 사유로 거부됐는가"를 구분하도록 `onReconnect` 콜백에서 store 의 반환값(수락/거부)을 훅에 전달하거나, 자기연결 검사를 `isValidConnection` 레벨이 아니라 **reconnect 전용 판정**으로 분리해 "자기연결 드롭 = no-op(원상 유지)" 를 실제로 달성해야 한다. 최소한 회귀 방지를 위해 `useEdgeReconnect` 를 실제 `isValidConnection` 게이트와 함께(mock 이 아니라) 검증하는 통합 테스트 또는 이 사실을 명시한 plan 잔여 항목으로 기록. Undo 로 복구 가능하다는 점이 유일한 완화 요인이나, 사용자가 삭제 사실을 인지하지 못하면 워크플로우가 조용히 깨질 수 있다.

- **[WARNING]** 신규 테스트 파일에 `Connection` 타입이 미-import 상태로 사용돼 TypeScript 컴파일 오류(TS2304)가 존재하나, 두 가드(vitest 타입 strip + tsconfig exclude) 로 가려져 있다.
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts:181` (`const toNode3: Connection = {...}`)
  - 상세: 이 파일은 `Connection` 을 import 하지 않는다(`import type { Node, Edge } from "@xyflow/react";` 만 존재). 직접 `tsc` 로 확인: `error TS2304: Cannot find name 'Connection'.` 그러나 (a) `codebase/frontend/tsconfig.json` 의 `exclude` 에 `src/**/__tests__/**` 가 있어 프로젝트 전체 `tsc --noEmit`/`next build` 에서 이 파일이 제외되고, (b) `vitest run` 은 esbuild/vite 로 타입을 strip 만 하므로(타입 전용 애노테이션은 검사 없이 삭제) 런타임 테스트는 121건 모두 통과한다(직접 실행 확인). 즉 이 오류는 **CI 어디서도 잡히지 않는다** — 기존 메모(`vitest run=타입 strip`, `__tests__ 는 tsc exclude`)와 정확히 일치하는 패턴.
  - 제안: `import type { Connection } from "@xyflow/react";` 추가.

- **[INFO]** `onReconnect`/`deleteEdge` 는 재연결 결과가 기존 엣지와 완전히 동일한 경우(예: 끝점을 원래 위치로 되돌린 재연결)에도 `pushUndo()` 를 무조건 실행해, 상태 변화가 없는 undo 스냅샷이 하나 남는다. 기능적 결함은 아니며 Ctrl+Z 1회가 "아무 변화 없는" 되돌리기가 될 뿐이라 영향은 미미하다.
  - 위치: `editor-store.ts` `onReconnect`(776), `deleteEdge`(1802-1803 부근)
  - 제안: 우선순위 낮음, 필요 시 "실제 변경 발생 시에만 pushUndo" 최적화 고려.

- **[INFO]** spec fidelity — `spec/3-workflow-editor/2-edge.md` §1.3 은 이번 diff에서 함께 갱신되어 CHANGELOG·plan·구현과 line-level 로 일치한다(§1.3 "미구현 Planned" → 구현 서술, `use-edge-reconnect.ts` code 인벤토리에 등재, R rationale 불필요). 위 CRITICAL 항목이 지적하는 "자기연결 드롭 시 삭제" 케이스만 spec 본문(§1.3 "빈 영역에 놓으면 삭제")에 명시되지 않은 채 실제로는 더 넓게(자기연결 포함) 적용되므로, spec 이 실제 동작보다 좁게 서술돼 있다 — 코드가 옳고 spec 이 낡은 SPEC-DRIFT 가 아니라 **코드(검증 규칙)가 의도와 다르게 동작하는 결함**이므로 위 CRITICAL 항목으로 이미 반영.

## 요약

§1.3 의 "역방향 연결"(React Flow 기본 동작 확인, 커스텀 코드 불요)과 "기존 엣지 재연결/분리" 두 축 중, 전자는 라이브러리 소스(`@xyflow/system`/`@xyflow/react`, `connectionMode: Strict` 기본값 확인)와 정확히 일치하는 타당한 결론이다. 후자(재연결/detach) 는 React Flow 공식 recipe 를 그대로 구현했고 `onConnect`·중복·컨테이너 충돌 케이스는 훅+스토어 배선을 통해 실제로 의도대로 동작(토스트 후 원상 유지)함을 소스 추적으로 확인했다. 다만 **자기연결로의 재연결 드롭만은 `isValidConnection` 게이트가 `onReconnect` 콜백 자체를 막아 "성공 플래그 false → 빈 영역 드롭과 동일 취급 → 엣지 삭제" 로 귀결**되며, 이는 "onConnect 과 동일한 유효성" 이라는 명시적 의도·주석·spec 서술과 어긋나는 실질적 결함이다(Undo 로 복구는 가능). 부수적으로 신규 스토어 테스트 파일에 `Connection` 미-import TS 오류가 있으나 vitest 타입 strip + tsconfig exclude 이중 가드로 어떤 CI 단계에서도 검출되지 않는다. 나머지(예약 입력 포트 `emit` 제외, undo 체크포인트 단일화, mdx 문서·plan·CHANGELOG 동기화, 테스트 케이스 수 claim)는 코드·spec·문서가 서로 line-level 로 정합하고 있음을 확인했다.

## 위험도

MEDIUM
