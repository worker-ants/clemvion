# Security Review — spec-sync-edge-gaps §1.3 (엣지 재연결/역방향 연결)

## 발견사항

- **[INFO]** 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결/detach 대상에 포함됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onReconnect`/`onReconnectStart`/`onReconnectEnd` 배선), `use-edge-reconnect.ts`
  - 상세: `<ReactFlow>` 에 `onReconnect*` 를 배선하면서 개별 엣지에 `reconnectable:false` 를 부여하지 않아, 컨테이너 진입(`body`)·loopback(`emit`) 같은 구조적 엣지도 일반 엣지와 동일하게 드래그로 재연결/분리(detach)할 수 있게 된다. 다만 `Delete`/`Backspace` 로 임의 엣지를 지우는 것은 이번 변경 이전에도 가능했던 동작이고, 삭제·재연결 모두 저장(`Ctrl+S`) 전까지는 로컬 상태만 변경되며 서버 저장 시 별도 구조 검증(및 워크플로 실행 엔진의 `CONTAINER_MISSING_EMIT` 등 런타임 검증)이 최종 게이트로 남아 있어 즉각적 보안·데이터 무결성 침해로 이어지지는 않는다. 새 취약점이라기보다는 UX/무결성 관점의 기존 확대(§2.2 컨테이너 충돌 검사가 `onReconnect` 경로에도 동일 적용되므로 잘못된 재배선은 어차피 `evaluateConnectionRejection` 이 거부한다).
  - 제안: 보안 관점 조치 불요. 구조적 필수 배선을 사용자 실수로부터 보호하고 싶다면 `reconnectable:false`(구조 엣지 한정) 부여를 UX 개선 백로그로 고려.

- **[INFO]** 이전 리뷰(12_40_48 세션)가 지적한 CRITICAL(자기연결 드롭 시 엣지 오삭제)은 본 diff 에서 이미 해소됨을 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts` `onReconnectEnd`
  - 상세: detach 판정이 "onReconnect 호출 여부(success 플래그)" 가 아니라 `connectionState.toNode === null`(드롭 위치, pane 여부)로 바뀌어, 무효 핸들(예: 자기연결) 위 드롭은 `toNode` 가 존재하므로 삭제되지 않고 원상 유지된다 — 데이터 무결성(엣지 유실) 회귀가 재현되지 않음을 diff 상으로 확인. 보안 카테고리는 아니지만 이전 리뷰에서 CRITICAL 로 제기된 항목이라 확인 결과를 기록.
  - 제안: 없음(확인 목적).

- **[INFO]** 신규 코드에 인젝션/시크릿/암호화 관련 취약 패턴 없음
  - 위치: `use-edge-reconnect.ts`, `use-edge-reconnect.test.ts`, `workflow-canvas.tsx`, `editor-store.ts`, `edge-utils.ts`, `edge-utils.test.ts`
  - 상세: 순수 프런트엔드 클라이언트 상태(zustand) 변경 및 React Flow 콜백 배선. `dangerouslySetInnerHTML`, `eval`, 동적 `Function`, 원시 SQL/커맨드 문자열 조합, 하드코딩된 자격증명·API 키·토큰 없음. `toast.error` 메시지("These nodes are already connected.")는 정적 리터럴이며 사용자 입력을 반영하지 않아 XSS 벡터가 없다. `connection`/`edge` 객체는 사용자 자유 텍스트가 아니라 React Flow 내부 드래그 상태에서 파생된 구조화 데이터이며, source/target 은 기존 노드 id 집합 내에서만 결정된다.
  - 제안: 없음.

- **[INFO]** 서버 측 최종 방어선 변경 없음
  - 위치: (변경 파일 전체 — 백엔드 미변경 확인)
  - 상세: 이번 diff 는 프런트엔드 편집기 상태 관리에 한정되며(CHANGELOG 도 "백엔드·wire 무변경" 명시), `codebase/backend` 는 이번 변경셋에 포함되어 있지 않다. DB 레벨 제약(`V001__initial_schema.sql`/`V002__indexes.sql` 의 엣지 FK/유니크 제약)과 `shadow-workflow.ts` 의 `CONTAINER_LOOPBACK_PORTS` 런타임 검증이 그대로 유지되어, 프런트엔드에서 임의로 만든 재연결·detach 결과라도 최종 저장·실행 시점 검증이 이중 방어로 남아 있다.
  - 제안: 없음(확인 목적).

- **[INFO]** 이번 diff 에는 `review/code/2026/07/13/12_40_48/*` 이전 리뷰 산출물(RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json 등)이 신규 파일로 함께 커밋됨
  - 위치: `review/code/2026/07/13/12_40_48/*.md`, `*.json`
  - 상세: 프로젝트 관례상 리뷰 산출물은 git-ignore 대상이 아니며(레포 컨벤션), 내용은 리뷰 메타데이터·발견사항 요약일 뿐 시크릿·인증정보·내부 인프라 세부사항이 포함되어 있지 않음을 확인했다.
  - 제안: 없음(확인 목적).

## 요약
이번 변경은 워크플로 편집기 캔버스의 엣지 재연결(§1.3)·detach 기능을 순수 프런트엔드 상태(zustand `editor-store.ts`)와 React Flow 콜백 배선(`use-edge-reconnect.ts`, `workflow-canvas.tsx`)으로 구현한 것으로, 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 등 보안 관점의 공격 표면을 새로 만들지 않는다. 재연결 검증은 기존 `onConnect` 과 동일한 규칙(`evaluateConnectionRejection` — 자기연결/중복/컨테이너 충돌)을 공용화해 적용하므로 우회 경로가 없고, 이전 리뷰 세션에서 지적된 CRITICAL(자기연결 드롭 시 엣지 오삭제)도 드롭 위치(`toNode`) 기준 판정으로 이미 해소되어 있다. 백엔드·DB 레벨 제약은 변경되지 않아 최종 방어선이 그대로 유지된다. 구조적 엣지(컨테이너 body/emit)가 드래그 재연결/삭제 대상에서 제외되지 않는 점은 참고(INFO) 수준의 UX/무결성 관찰이며 보안 위험으로 보지 않는다.

## 위험도
NONE
