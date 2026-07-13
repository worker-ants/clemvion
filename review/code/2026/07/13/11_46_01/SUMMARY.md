# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. §1.2(출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결)에 대한 3회차 fresh 리뷰로, 이전 2라운드(11_04_21 HIGH, 11_28_30 MEDIUM)가 지적한 CRITICAL/WARNING 은 모두 해소 확인됐으나 **동일한 컴포넌트 실배선 테스트 부재가 3회 연속 재부상**(testing MEDIUM)하고, 신규로 stale 주석(documentation WARNING)·plan 케이스 수 오기재(requirement WARNING)가 발견됨. 기능 자체는 순수 프런트엔드 UI 로직으로 보안/DB/동시성 위험 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선(컴포넌트 조합)이 어떤 테스트로도 검증되지 않음 — 11_04_21/11_28_30/본 라운드까지 **3회 연속 동일 지적**. 순수 헬퍼는 vitest 111 passed 로 전수 커버되나 "올바른 순서·인자로 호출→결과 전달"의 조합 자체는 미검증(RTL/e2e 부재) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onConnectEnd`/`handleAddNodeFromSearch` | plan §1.3 착수 전 최소 1개 RTL+`@xyflow/react` mock 통합 테스트 추가, 또는 이월 결정을 "의도적 미해결"로 최종 확정 문서화하여 재지적 방지(현재처럼 매 라운드 WARNING 재부상은 리뷰 사이클 미수렴) |
| 2 | documentation | `onConnectEnd` 위 블록 주석이 2회차에 이미 개명된 필드명(`source`→`dragSource`) 대신 폐기된 `popup.source` 를 그대로 참조 — 리네임이 코드 전체에 완전히 전파되지 못한 stale 주석(실제 코드에 `popup` 변수/필드 없음, 정확한 참조는 `nodeSearchPopup.dragSource`) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:336` | `// 연결한다(popup.source 에 연결원 기록 ...)` → `// 연결한다(NodeSearchPopupState.dragSource 에 연결원 기록 ...)` 로 정정 |
| 3 | requirement | `plan/in-progress/spec-sync-edge-gaps.md` §1.2 완료 서술의 vitest 케이스 수가 "27개" 로 기재됐으나 실측(diff `it(` 카운트)은 **21개**(1회차 9 + RESOLUTION 12 = 21). 합산 과정에서 6개 부풀려짐. 기능 결함 아닌 audit-trail 부정확 | `plan/in-progress/spec-sync-edge-gaps.md` §1.2 체크박스 완료 서술 | "vitest 27케이스" → "vitest 21케이스"로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `onConnectEnd` 배선으로 "드래그 없는 단순 클릭"도 무효 연결로 처리되어 노드 추가 팝업이 열릴 수 있음(React Flow mousedown→즉시 mouseup 케이스) — 이 PR 이 실제 배선하면서 새로 생긴 부작용 | `workflow-canvas.tsx` `onConnectEnd`, `edge-utils.ts` `isConnectionDroppedOnPane`/`connectionDragSource` | 데이터 손상 없음(Escape 로 닫힘). QA 소음 보고 시 드래그 거리/이동량 임계값 가드 고려 |
| 2 | requirement / side_effect / maintainability | `buildAndAddNode`(자체 pushUndo) → store `addNode`(내부 pushUndo) 의 pre-existing 이중 push 잔존. `skipUndo` 로 세 번째 push 만 차단됐을 뿐 두 번째는 남아 undoStack 슬롯 낭비 → 그 다음 별개 Ctrl+Z 가 no-op. CHANGELOG/spec "단일 pushUndo" 서술이 근사치 | `workflow-canvas.tsx` `buildAndAddNode`, `editor-store.ts:747-748` `addNode` | 스코프 밖(pre-existing, 2회 이월 확인됨). 주석/CHANGELOG 표현 완화 또는 별도 hygiene 백로그로 명시 |
| 3 | maintainability | `screenToFlowPosition(...) ?? {x:0,y:0}` 좌표 변환 폴백이 `onPaneClick`/`onConnectEnd` 두 곳에 복제(팝업 열기 시퀀스는 `openNodeSearchPopupAt` 로 단일화됐으나 변환 자체는 미흡수) | `workflow-canvas.tsx:323, :346` | `openNodeSearchPopupAt` 이 `clientX`/`clientY` 를 받아 내부에서 변환하도록 확장(§1.3 이월 기록됨, 즉시 조치 불요) |
| 4 | maintainability | `edge-utils.ts` 에 §1.2 전용 헬퍼 5종이 섹션 구분 주석 없이 계속 나열 | `edge-utils.ts` L116-200 | 신규 헬퍼 추가 시 섹션 헤더 도입 고려(§1.3 이월 기록됨) |
| 5 | maintainability | `getNodeDefinition(nodeType)` 이중 조회(같은 nodeType 정보를 두 협력 함수가 각자 재조회) | `workflow-canvas.tsx` `handleAddNodeFromSearch` | `buildAndAddNode` 가 `{id, definition}` 반환하도록 정리 고려(스코프 밖) |
| 6 | maintainability | `workflow-canvas.tsx`(978줄) God Component 성향 지속 — 단 이번 diff 는 응집도 개선(3중 팝업 오픈 중복 흡수) | `workflow-canvas.tsx` 전체 | §1.3 착수 시 오케스트레이션 훅 추출 재검토(plan §1.3(a) 로 이미 추적됨) |
| 7 | testing | `connectionDragSource` 의 `fromHandle` 자체가 `undefined` 인 극단 케이스 미테스트(옵셔널 체이닝으로 안전 처리되어 실사용 리스크 낮음) | `edge-utils.test.ts` `describe("connectionDragSource (§1.2)")` | §1.3 헬퍼 추가 시 케이스 보강 고려 |
| 8 | requirement | 컨테이너 노드(loop/foreach/map) 첫 입력 포트가 예약 포트(`emit`) 아님을 backend schema 로 재검증 — 현재 데이터로는 `detectContainerConflict` 미트리거, 신규 컨테이너 타입 추가 시에만 잠재 위험 | `codebase/backend/src/nodes/logic/{loop,foreach,map}.schema.ts`, `editor-store.ts` `detectContainerConflict` | 없음(§1.3 이월 추적 중) |
| 9 | documentation | `connecting-nodes.mdx`/`.en.mdx` frontmatter `code:` 목록에 `edge-utils.ts` 미포함(pre-existing, 이번 diff 회귀 아님) | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` frontmatter | 차단 사유 아님. 문서 재편집 기회에 추가 고려 |
| 10 | documentation | spec `## Rationale` 섹션에 §1.2 엣지 케이스 설계 근거 미등재 — 2라운드 전부터 선택 사항으로 분류, 변화 없음 | `spec/3-workflow-editor/2-edge.md` `## Rationale` | 선택 사항, 필수 아님 |
| 11 | requirement | `handleAddNodeFromSearch` 주석의 "유일한 체크포인트" 표현이 pre-existing 이중 pushUndo 를 감안하면 미세 과장 | `workflow-canvas.tsx` `handleAddNodeFromSearch` 인라인 주석 | 표현 미세 조정 또는 이중 push 정리와 함께 처리(스코프 밖) |
| 12 | scope | `openNodeSearchPopupAt` 추출이 §1.2 신규 진입점과 함께 기존 두 경로(`onPaneClick`, `handleCanvasMenuAction`)도 리팩터(behavior-preserving 확인) | `workflow-canvas.tsx` | 문제 삼을 사안 아님(신규 중복의 즉시 해소) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프런트엔드 UI 변경, 인젝션/시크릿/인증우회/암호화 해당 없음. `isValidConnection` 우회는 store `onConnect` 내부 재검증으로 실질 위험 상쇄 |
| requirement | LOW | spec/CHANGELOG/유저가이드 line-level 일치 재확인(1회차 CRITICAL 완전 해소). plan vitest 케이스 수 오기재(27→21) 신규 발견 |
| scope | NONE | 37개 파일 전부 §1.2 구현 또는 그 리뷰 사이클 반영으로 설명됨. 요청 범위 밖 리팩터/기능 확장 없음 |
| side_effect | LOW | undo 이중 push 잔존(pre-existing), `onConnectEnd` 배선이 만든 신규 "단순 클릭도 팝업" 부작용 발견 |
| maintainability | LOW | 신규 헬퍼/테스트 품질 양호, 컨벤션 일관. 잔존 경미 이슈 4건(좌표변환 중복·섹션주석 부재·이중조회·God Component) 모두 §1.3 이월 추적됨 |
| testing | MEDIUM | skipUndo 회귀 테스트는 정확히 추가됐으나, 컴포넌트 실배선 조합 테스트 부재가 **3회 연속** 미해소 |
| documentation | LOW | 직전 2라운드 지적 전건 해소 확인. 신규 stale 주석(`popup.source`) 발견 |
| user_guide_sync | NONE | 매트릭스 19행 대조 결과 미반영 갭 0건. ko/en parity 확인 |

## 발견 없는 에이전트

- **security** — CRITICAL/WARNING 해당 사항 없음(NONE)
- **user_guide_sync** — 유저 가이드 동반 갱신 매트릭스 대조 결과 미반영 갭 0건(NONE)

## 권장 조치사항

1. **(testing WARNING, 3회 연속 재부상)** `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 컴포넌트 실배선에 대해 지금 최소 1개 RTL+`@xyflow/react` mock 통합 테스트를 추가하거나, plan 에 "§1.3 훅 추출 시점까지 의도적으로 미해결" 로 최종 확정 문구를 못박아 재지적을 방지할 것 — 현재처럼 매 라운드 WARNING 으로만 이월되면 리뷰 사이클이 수렴하지 않는다.
2. **(documentation WARNING)** `workflow-canvas.tsx:336` 의 `popup.source` stale 주석을 `NodeSearchPopupState.dragSource` 로 정정.
3. **(requirement WARNING)** `plan/in-progress/spec-sync-edge-gaps.md` §1.2 완료 서술의 "vitest 27케이스" 를 실측치 "21케이스"로 정정.
4. (선택) undo 이중 push(`buildAndAddNode`+`addNode` 양쪽 pushUndo), 좌표 변환 폴백 중복, `getNodeDefinition` 이중 조회는 이미 §1.3 이월로 추적 중이므로 §1.3 착수 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` — 실행된 8명 전원이 router_safety 에 의해 강제 포함됨(router 자체 선택분 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 명시 안 됨(순수 클라이언트 UI 상호작용 변경으로 성능 영향 낮다고 router 판단 추정) |
  | architecture | 명시 안 됨 |
  | dependency | 명시 안 됨(신규 의존성 추가 없음) |
  | database | 명시 안 됨(DB 접근 코드 변경 없음) |
  | concurrency | 명시 안 됨(서버측 동시성 로직 변경 없음) |
  | api_contract | 명시 안 됨(신규/변경 API 엔드포인트 없음) |