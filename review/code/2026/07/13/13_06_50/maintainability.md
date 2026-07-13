# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** CHANGELOG·spec 문서가 이미 제거된 `onReconnectStart` 배선을 계속 서술
  - 위치: `CHANGELOG.md` (§1.3 신규 엔트리, "workflow-canvas.tsx 가 `onReconnectStart`/`onReconnect`/`onReconnectEnd` 를 배선하고..."), `spec/3-workflow-editor/2-edge.md` §1.3 ("기존 엣지 재연결 — `workflow-canvas.tsx` 가 `onReconnectStart`/`onReconnect`/`onReconnectEnd` 를 배선한다")
  - 상세: 직전 리뷰 사이클(`review/code/2026/07/13/12_40_48/RESOLUTION.md` Critical #1)에서 자기연결 드롭 오삭제 버그를 고치며 "success 플래그" 방식(`onReconnectStart` 로 세팅하는 ref)을 "드롭 위치"(`connectionState.toNode`) 판정으로 교체하고 `onReconnectStart`/ref 를 제거했다고 명시(RESOLUTION.md: "`onReconnectStart`/ref 제거"). 실제로 현재 `use-edge-reconnect.ts` 는 `onReconnect`/`onReconnectEnd` 두 콜백만 반환하고, `workflow-canvas.tsx` 도 `<ReactFlow onReconnect={handleReconnect} onReconnectEnd={onReconnectEnd} .../>` 두 개만 배선한다. 그런데 이번 diff 로 새로 작성된 CHANGELOG 엔트리와 spec 본문은 여전히 "3개 콜백 배선"으로 서술해 실제 코드와 어긋난다. CHANGELOG/spec 은 이 기능의 최종 SoT 서술이라, 이를 근거로 코드를 이해하려는 향후 독자가 존재하지 않는 `onReconnectStart` 배선을 찾다 혼란을 겪을 수 있다.
  - 제안: 두 문서 모두 "`onReconnect`/`onReconnectEnd` 두 콜백을 배선"으로 정정.

- **[WARNING]** `evaluateConnectionRejection` 의 3중 상태(`null`/`""`/문자열) 반환 규약이 암묵적 sentinel 에 의존
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `evaluateConnectionRejection`(함수 선언부 및 JSDoc), 호출부 `onConnect`/`onReconnect`
  - 상세: 반환값이 `null`(유효) / `""`(자기연결이라 조용히 거부, toast 없음) / 비어있지 않은 문자열(거부+toast 메시지) 세 가지 의미를 오버로드한다. 두 호출부 모두 현재는 `if (rejection !== null) { if (rejection) toast.error(rejection); return; }` 로 정확히 구분하고 있으나, 이는 "`!== null`" 과 "truthy" 를 함께 정확히 조합해야만 성립하는 규약이라 향후 편집(예: 새 호출부에서 `if (rejection)` 만으로 단축)이 자기연결 케이스를 "유효"로 오판하게 만들 위험이 있다. JSDoc 으로 문서화돼 있지만 타입 시스템이 강제하지 않는 특수값 프로토콜이다.
  - 제안: `null | { silent: true } | { message: string }` 같은 판별 유니온이나 `{ ok: boolean; message?: string }` 형태로 바꿔 truthy 단축 실수를 컴파일 타임에 막을 수 있게 하면 더 안전하다. (기능 결함은 아니며 현재 두 호출부는 올바르게 구현돼 있음.)

- **[INFO, 긍정]** 이전 리뷰(12_40_48) WARNING #2 — onConnect/onReconnect 검증·엣지데이터 파생 중복 — 해소
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `evaluateConnectionRejection`, `buildEdgeDataForConnection`
  - 상세: 자기연결/중복/컨테이너 충돌 판정과 "sourceNode 조회→sourceNodeType 추출→buildEdgeData" 파생 로직을 공용 헬퍼로 추출해 `onConnect`/`onReconnect` 양쪽에서 재사용하도록 리팩터했다. 재연결은 중복 검사에서 자기 자신을 제외한 edges 목록을 넘겨 "제자리 재연결" 오탐도 함께 해소(신규 테스트로 커버). 향후 새 검증 규칙 추가 시 drift 위험이 사라졌다.

- **[INFO, 긍정]** 이전 리뷰 INFO — `reconnectEdgeInStore` 네이밍 비일관 — 주석으로 해소
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (셀렉터 선언부)
  - 상세: 인접 `onConnect` 셀렉터와 다르게 `reconnectEdgeInStore` 로 명명한 이유(캔버스 콜백 `handleReconnect` 와의 혼동 회피)를 한 줄 주석으로 명시해, 이전 리뷰가 지적한 "왜 이 줄만 다른 컨벤션인지 코드만으론 안 드러남" 문제가 해소됐다.

- **[INFO, 긍정]** `useEdgeReconnect` 훅 분리 및 테스트 품질
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `.../__tests__/use-edge-reconnect.test.ts`
  - 상세: 재연결/detach 판정을 순수 훅으로 분리해 993줄 규모의 `workflow-canvas.tsx` 를 더 비대하게 만들지 않았다. JSDoc 이 "success 플래그가 아니라 드롭 위치로 판정해야 하는 이유"를 명확히 서술하고, renderHook 테스트 4건이 CRITICAL 회귀 케이스(무효 핸들 드롭 시 원상 유지)까지 포함해 커버한다.

- **[INFO, 긍정]** `firstInputHandleId` 매직 스트링을 명명된 상수로 정리
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`RESERVED_INPUT_HANDLE_IDS`)
  - 상세: 예약 입력 포트 판정용 하드코딩 문자열 대신 `Set` 상수로 도입하고 backend SoT(`shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`)를 주석으로 근거 명시했으며, 테스트 2건(예약 포트 skip / 예약 포트만 있을 때 null)도 함께 추가돼 있다.

## 요약

이번 diff 는 직전 사이클에서 지적된 CRITICAL(자기연결 드롭 시 엣지 오삭제)과 WARNING(onConnect/onReconnect 중복, deleteEdge 네이밍 충돌, 셀렉터 네이밍 비일관)을 모두 실제로 반영해 코드 품질이 개선됐다 — 판정 로직을 성공 플래그가 아닌 드롭 위치 기준으로 재설계하고, 검증·데이터파생을 공용 헬퍼로 추출했으며, 훅 분리와 테스트로 회귀 취약 지점을 촘촘히 커버했다. 다만 이번에 새로 작성된 CHANGELOG·spec 문서가 이미 제거된 `onReconnectStart` 배선을 여전히 서술해 문서-코드 불일치가 남아 있고, `evaluateConnectionRejection` 의 `null`/`""`/문자열 3중 반환 규약은 타입으로 강제되지 않는 암묵적 프로토콜이라 향후 편집 시 실수 여지가 있다. 둘 다 즉시 차단 사유는 아니며 조치 권장 수준이다.

## 위험도
LOW
