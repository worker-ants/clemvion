# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(둘 다 latent/명시적 최종 이월로 이미 확정된 사안). 대상 diff(§1.2 출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결, origin/main 대비 4커밋 누적)는 직전 3회 ai-review(HIGH→MEDIUM→MEDIUM) 사이클을 거쳐 CRITICAL/WARNING 이 대부분 해소된 최종 상태이며, 8개 reviewer 전원이 차단급 결함을 발견하지 못했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `workflow-canvas.tsx` 의 `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선(glue) 조합이 컴포넌트/e2e 테스트로 전혀 검증되지 않음. 판정·조립 순수 헬퍼 5종은 vitest 21케이스로 촘촘히 커버되나 이들을 올바른 순서로 연결하는 통합 경로는 미검증. 4회 연속(11_04_21/11_28_30/11_46_01/본 라운드) 동일 지적이며, 이번 라운드에서 "저장소에 canvas 컴포넌트 테스트 하네스가 전무함"을 grep 으로 재확인한 근거와 함께 plan §1.3 이월 (d) 로 `[의도적 최종 이월 — 결정 확정]` 라벨 부여됨 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onConnectEnd`/`handleAddNodeFromSearch`), `plan/in-progress/spec-sync-edge-gaps.md` §1.3(d) | 임의 묵살이 아닌 근거 있는 결정이므로 이 항목만으로 차단 불요. §1.3(오케스트레이션 훅 추출) 착수 시 RTL + `@xyflow/react` mock 통합 테스트("드래그 종료 이벤트 시뮬레이션 → 팝업 오픈 → 노드 선택 → `onConnect` 호출 인자") 최소 1건 반드시 추가 |
| 2 | Requirement | `firstInputHandleId`/`buildAutoConnectConnection` 의 "자동 연결 시 컨테이너 충돌 미발생" 불변식이 코드가 아닌 JSDoc 주석에만 의존. 현재 `loop`/`foreach`/`map` 컨테이너 스키마의 첫 입력이 항상 `'in'`이라 오늘 시점엔 안전하나, 향후 신규 컨테이너 노드 정의가 첫 입력을 예약 포트(`emit` 등)로 정의하면 `detectContainerConflict` 가 조용히 거부하고 이미 생성된 노드가 엣지 없는 고아 상태로 남는다(생성 롤백 없음). 3회 연속 동일 관찰이나 plan §1.3 명시 이월 목록(a)~(d)에는 이 항목 자체가 누락되어 향후 재점검 트리거가 없음 | `codebase/frontend/src/lib/utils/edge-utils.ts` `buildAutoConnectConnection`/`firstInputHandleId`, `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict` | latent·현재 미발생이므로 코드 되돌리기 불요. (1) `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 목록에 (e)로 명시 추가하거나, (2) `firstInputHandleId` 가 예약 포트 id(`'emit'` 등)를 명시적으로 제외하도록 강화(더 근본적이나 우선순위 낮음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | `workflow-canvas.tsx`(978줄) 다관심사 God Component 성향 지속. 팝업 오픈 시퀀스는 `openNodeSearchPopupAt` 공용 헬퍼로 통합돼 순증가는 억제됐으나 근본 분리는 미해소. plan §1.3(a)에 명시적으로 이월 확정 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | §1.3 착수 시 오케스트레이션 전용 훅 추출 재검토 |
| 2 | Architecture | `onConnect(connection, opts?: { skipUndo?: boolean })` — undo 이중 push 해소를 위해 전용 합성 액션 대신 범용 `onConnect` 에 호출자-종속 옵션 플래그를 얹음(SRP 약간의 트레이드오프). 옵션 객체·하위호환·단위테스트 2건으로 뒷받침돼 현 스코프엔 비례적 | `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect` | §1.3 등 "생성+연결" 합성 제스처가 늘면 전용 합성 액션으로의 승격 재고 |
| 3 | Architecture | `NodeSearchPopupState.dragSource` 필드가 "출력→입력" 단방향 가정만 인코딩 — §1.3(입력 포트發 역방향 드래그) 구현 시 `role: 'source'\|'target'` 류 유니온 재설계 필요 가능성 | `workflow-canvas.tsx` `NodeSearchPopupState.dragSource`, `handleAddNodeFromSearch` | §1.3 착수 시 방향 태그 유니온으로 선행 재설계 검토 |
| 4 | Architecture / Maintainability | `getNodeDefinition(nodeType)` 이중 조회 — `buildAndAddNode` 내부 1회 + `handleAddNodeFromSearch` 자동연결 분기에서 동일 nodeType 재조회(암묵적 결합, 성능 영향은 무시 가능) | `workflow-canvas.tsx` `buildAndAddNode`/`handleAddNodeFromSearch` | `buildAndAddNode` 가 `{id, definition}` 반환하거나 상위 1회 조회로 결합 제거(우선순위 낮음) |
| 5 | Maintainability | `screenToFlowPosition(...) ?? {x:0,y:0}` 좌표 변환 폴백이 `onPaneClick`/`onConnectEnd` 두 곳에 복제 — `openNodeSearchPopupAt` 이 이미 계산된 `flowPosition` 을 인자로 받는 설계상 자연 발생 | `workflow-canvas.tsx:323`, `:346` | `openNodeSearchPopupAt` 이 `clientX`/`clientY` 만 받아 내부에서 `screenToFlowPosition` 호출하도록 확장 시 잔여 중복 제거(§1.3 착수 시 권장) |
| 6 | Maintainability | `edge-utils.ts` 신규 헬퍼 5종이 섹션 구분 주석 없이 기존 "연결 유효성" 그룹 뒤에 나열 — §1.3에서 헬퍼가 더 늘면 탐색 비용 누적 가능 | `codebase/frontend/src/lib/utils/edge-utils.ts` L116-200 | 새 헬퍼 추가 시 `// --- §1.2 자동 연결 판정/조립 ---` 류 섹션 헤더 도입 |
| 7 | Requirement | `onConnectEnd` 가 이동 없는 단순 클릭(mousedown 직후 mouseup)에도 반응해 팝업을 열 수 있음 — spec §1.2 는 "드래그 후 빈 영역 드롭"만 서술하고 이 경계 케이스를 다루지 않음(회색지대, 실사용 위험 낮음) | `edge-utils.ts` `isConnectionDroppedOnPane`/`connectionDragSource`, `workflow-canvas.tsx` `onConnectEnd` | 필요 시 spec §1.2 에 "이동 없는 클릭도 빈 영역 드롭과 동일 취급" 명시(선택 사항) |
| 8 | Testing | `connectionDragSource` 의 `fromHandle` 자체가 `undefined` 인 극단 조합이 미테스트(다른 null/undefined 조합은 전수 커버) — 코드 로직상 옵셔널 체이닝으로 이미 안전 | `edge-utils.test.ts` `describe("connectionDragSource (§1.2)")` | 우선순위 낮음, 향후 헬퍼 추가 시 1케이스만 추가하면 됨 |
| 9 | Documentation | `connecting-nodes.{mdx,en.mdx}` frontmatter `code:` 목록에 `edge-utils.ts` 미포함(§2.2 시절부터의 pre-existing 갭, 이번 diff 로 신규 도입 아님) | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`/`.en.mdx` | 차단 사유 아님. 다음에 이 문서를 만질 기회에 `code:` 목록에 `edge-utils.ts` 추가 고려 |
| 10 | Documentation | spec `## Rationale` 섹션에 §1.2 엣지케이스(입력 포트 없으면 자동 연결 생략) 설계 근거 미등재 — 3라운드 내내 "선택 사항"으로 일관 분류 | `spec/3-workflow-editor/2-edge.md` `## Rationale` | 선택 사항, 필수 아님 |
| 11 | Security | `handleAddNodeFromSearch` 의 `onConnect` 직접 호출이 드래그 중 UI 힌트 전용인 `isValidConnection` 을 우회하지만, `editor-store.ts` `onConnect` 내부에서 자기연결/중복/컨테이너 충돌이 항상 권위 있게 재검증돼 실질 위험 없음(4회 연속 동일 결론) | `workflow-canvas.tsx` `handleAddNodeFromSearch`, `editor-store.ts` `onConnect` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 API/인증/시크릿/암호화 없음. `onConnect` 직접호출의 UI게이트 우회는 store 재검증으로 상쇄돼 실질 위험 없음 |
| architecture | LOW | God Component·`skipUndo` 옵션 SRP 트레이드오프·`dragSource` 방향성 비대칭·`getNodeDefinition` 이중조회 — 전부 INFO, 계층 분리·순환의존 없음 확인 |
| requirement | LOW | spec §1.2 line-level 일치·vitest 23케이스 실측 정확. WARNING: 컨테이너 충돌 불변식이 주석에만 의존(latent, plan 이월 누락) |
| scope | NONE | 4커밋 누적 전부 §1.2 스코프 내. over-engineering·무관 파일 수정 없음 |
| side_effect | NONE | 최신 커밋은 프로덕션 로직 무변경(주석/문서만). `skipUndo`/반환타입 확장 모두 하위호환, 전역/DOM/네트워크 부작용 없음 |
| maintainability | LOW | 신규 헬퍼·테스트 품질 양호. 잔존 4건(폴백 중복·섹션주석 부재·이중조회·God Component)은 3회 연속 동일 사안으로 plan §1.3 이월 확정 |
| testing | LOW | vitest 23케이스 실측 검증(111 passed). WARNING: `onConnectEnd` 실배선 통합/e2e 테스트 부재(4회 연속, 의도적 최종 이월 확정) |
| documentation | NONE | 3라운드 documentation 지적 전건 해소 확인(spec/CHANGELOG/mdx ko·en/plan 전부 코드와 line-level 일치). 잔존 2건은 pre-existing/선택사항 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 수준 관찰을 보고했으나, security/scope/side_effect/documentation 4개 에이전트는 결론상 **차단급 실질 결함 없음(NONE)** 으로 수렴했다.

## 권장 조치사항

1. (참고, 즉시 조치 불요) §1.3(입력 포트發 역방향 드래그, 오케스트레이션 훅 추출) 착수 시 다음을 함께 처리: (a) `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선 검증용 RTL + `@xyflow/react` mock 통합 테스트 최소 1건 추가, (b) `dragSource` 를 방향 태그 유니온으로 재설계, (c) `screenToFlowPosition` 폴백 중복 제거, (d) `getNodeDefinition` 이중 조회 정리, (e) God Component 분리(오케스트레이션 훅 추출).
2. (선택, 낮은 우선순위) `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 목록에 "컨테이너 첫 입력 포트가 예약 포트가 아니라는 불변식"을 (e)로 명시 추가하거나, `firstInputHandleId` 가 예약 포트 id(`'emit'` 등)를 코드 레벨에서 명시적으로 제외하도록 강화.
3. (선택) `edge-utils.ts` 에 신규 헬퍼 추가 시 섹션 구분 주석 도입.
4. (선택) `connecting-nodes.mdx`/`.en.mdx` frontmatter `code:` 목록에 `edge-utils.ts` 추가, spec `## Rationale` 에 §1.2 엣지케이스 설계 근거 보강.

이번 diff 자체를 차단할 조치는 없다 — 위 항목 전부 §1.3 이후 또는 선택적 후속 작업으로 이월 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
  - **제외**: 표 참조 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — `architecture` 만 router 자체 선별, 나머지 7명은 router_safety 로 강제 포함)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 비제공(routing 세부 근거 미포함) |
  | dependency | 사유 비제공 |
  | database | 사유 비제공 |
  | concurrency | 사유 비제공 |
  | api_contract | 사유 비제공 |
  | user_guide_sync | 사유 비제공 |