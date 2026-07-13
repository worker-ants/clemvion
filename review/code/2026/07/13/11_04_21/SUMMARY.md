# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 기능 구현(§1.2 출력 포트 드래그 → 빈 영역 드롭 → 자동 노드 추가+연결) 자체는 정확하고 안전하지만, SoT 스펙 문서(`spec/3-workflow-editor/2-edge.md` §1.2)가 "미구현 · Planned" 로 stale 방치되어 있어 CRITICAL 로 분류되었고, undo 스냅샷 중복·테스트 커버리지 부재 등 WARNING 다수가 함께 존재한다. 또한 `user_guide_sync` 리뷰는 manifest 상 성공(success)으로 보고되었으나 출력 파일이 디스크에 존재하지 않아(disk-write gap) 내용 확인이 불가능하다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | SoT 스펙 `spec/3-workflow-editor/2-edge.md` §1.2 가 "미구현 · Planned" 라벨과 "…아직 없다" 각주를 그대로 유지한 채, 구현은 이미 완료(`workflow-canvas.tsx` `onConnectEnd` + `edge-utils.ts` 신규 헬퍼)되어 코드-스펙 불일치. 같은 spec 파일의 자매 항목(§2.2/§2.3)이 구현될 때 spec 본문 동기화가 확립된 관례였음에도 이번엔 지키지 않음(plan 체크박스만 `[x]` 갱신) | `spec/3-workflow-editor/2-edge.md` §1.2 | §1.2 헤더에서 "(미구현 · Planned)" 제거, "현재 구현" 각주를 실제 구현(React Flow v12 `connectionState`, `NodeSearchPopupState.source`, `buildAndAddNode` 반환값 활용 등)으로 갱신. `status: partial` 은 §1.3/§3.2/§4/§5 남아있어 유지 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | side_effect | 신규 `onConnect(...)` 호출이 내부에서 `pushUndo()` 를 또 실행해, "드래그→드롭→노드선택" 이라는 하나의 사용자 제스처가 undo 스택에 최소 2회(기존 이중 push 까지 합치면 최대 3회) 스냅샷을 남김. Ctrl+Z 1회 시 방금 만든 엣지만 사라지고 고아 노드가 캔버스에 잔존 | `workflow-canvas.tsx` `handleAddNodeFromSearch`→`buildAndAddNode`/`onConnect`, `editor-store.ts` `addNode`(L745-756)/`onConnect`(L700-737) | "노드 생성+자동연결"을 단일 pushUndo 체크포인트로 묶는 전용 store 액션(예: `addNodeWithConnection`) 추가 또는 `onConnect` 를 pushUndo 없는 내부 헬퍼로 재사용. "자동연결 후 Ctrl+Z 1회" 시나리오 QA 체크리스트 추가 |
| 3 | testing | §1.2 실제 배선(`onConnectEnd`/`handleAddNodeFromSearch`)이 어떤 테스트로도 검증되지 않음 — `edge-utils.ts` 순수 함수만 unit 테스트되고, `workflow-canvas.tsx` 자체엔 컴포넌트 테스트 파일이 없으며 e2e 스펙도 없음. `onConnect` 인자 뒤바뀜 등 회귀가 CI 로 잡히지 않음 | `workflow-canvas.tsx:326-346`(`onConnectEnd`), `:597-611`(`handleAddNodeFromSearch`) | 분기 조건(source-handle 타입 필터, touch/mouse 좌표 추출, targetHandle 부재 시 생략)을 순수 함수로 추가 추출해 단위 테스트 가능하게 하거나, RTL + `@xyflow/react` mock 으로 최소 통합 테스트 추가 |
| 4 | documentation | CHANGELOG.md 미갱신 — 동일 spec 파일 자매 항목(§2.2/§2.3) 등 "Planned→구현" 전환 시 예외 없이 CHANGELOG `## Unreleased` 항목을 추가해온 저장소 관례와 불일치 | `CHANGELOG.md`(변경 없음) | "출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결 (§1.2)" Unreleased 항목 추가, SoT 를 `spec/3-workflow-editor/2-edge.md §1.2` 로 명시 |
| 5 | architecture | `workflow-canvas.tsx`(1150줄)의 책임 팽창(God Component 경향) 지속 — 컨텍스트 메뉴 3종, 검색 팝업, 단축키, DnD, undo 등 다수 관심사에 이번 오케스트레이션(팝업 상태 전이+자동연결)까지 추가됨. §1.3(역방향 드래그)이 다음 순서로 예정돼 유사 코드가 더 누적될 가능성 | `workflow-canvas.tsx` 전체, 신규 `onConnectEnd`(L318-345), `NodeSearchPopupState.source`(L104-107) | §1.3 착수 전 "드래그종료→팝업오픈→자동연결" 오케스트레이션을 전용 훅(`useConnectionDragToCreate` 류)으로 추출해 분리 고려 |
| 6 | maintainability | "노드 검색 팝업 열기" 시퀀스(좌표변환→메뉴닫기→상태세팅)가 `onPaneClick`(더블클릭)·`handleCanvasMenuAction`(우클릭)에 이어 신규 `onConnectEnd` 로 세 번째 중복 발생 | `workflow-canvas.tsx` `onPaneClick`, `handleCanvasMenuAction`, 신규 `onConnectEnd` | `openNodeSearchPopupAt(clientX, clientY, source?)` 공용 헬퍼로 통합해 세 경로가 공유하도록 정리 |
| 7 | requirement | `firstInputHandleId` 가 "source→새 노드 조합은 자기연결/중복 불가하므로 항상 통과" 라고 주석에서 단언하나, 실제로는 컨테이너 노드의 포트 순서 관례(`in` 이 항상 첫 입력)에 암묵적 의존. 신규 컨테이너/스키마 추가로 첫 입력 포트가 `'emit'` 이 되면 `detectContainerConflict` 에 걸려 새 노드가 엣지 없이 orphan 상태로 남고 사용자는 이유를 알기 어려운 에러 토스트만 봄(현재 데이터로는 미발생) | `workflow-canvas.tsx` L777-779, `edge-utils.ts` `firstInputHandleId` | 주석에 "포트 정의 관례(`in` 이 항상 첫 입력)에 의존" 명시하거나, 예약 포트 id(`'emit'` 등) 명시적 제외 로직 강화. 최소한 가정이 깨졌을 때 orphan 노드 방지책(롤백 또는 안내 메시지) 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 8 | security | `handleAddNodeFromSearch` 가 store `onConnect` 을 직접 호출해 ReactFlow `isValidConnection` UI 게이트를 우회하지만, 실제 연결 유효성(자기연결/중복/컨테이너 충돌)은 `onConnect` 내부에서 재검증되어 실질 위험 없음(레이어 분리 정상) | `workflow-canvas.tsx` `handleAddNodeFromSearch`, `editor-store.ts` `onConnect` | 필요 시 `isSelfConnection`/`isDuplicateConnection` 헬퍼를 이 경로에도 명시적으로 통과시켜 두 경로(드래그 vs 자동생성) 검증 로직 수렴 고려 |
| 9 | architecture/performance | `getNodeDefinition(nodeType)` 을 `buildAndAddNode` 내부와 `handleAddNodeFromSearch` 에서 각각 재조회하는 DRY 위반(경미) — Map 조회라 실질 성능 영향은 없음 | `workflow-canvas.tsx` `buildAndAddNode`/`handleAddNodeFromSearch` | `buildAndAddNode` 가 `{id, definition}` 반환하도록 정리하거나 상단에서 1회만 조회해 전달 |
| 10 | architecture | `NodeSearchPopupState.source` 필드가 현재 단방향("출력→새 노드 입력")만 인코딩 — §1.3(역방향 드래그) 구현 시 `role: 'source'|'target'` 등 재설계 필요 가능성 | `workflow-canvas.tsx` L104-107 | §1.3 착수 시 방향 태그 있는 유니온으로 선재설계 고려(지금은 선반영 불필요) |
| 11 | requirement | `isConnectionDroppedOnPane` 함수명은 "빈 pane 드롭"을 시사하나 실제로는 `!connectionState.isValid` 만 판정 — 기존 노드 위 등 유효하지 않은 임의 위치 드롭도 동일하게 "pane 드롭" 취급(React Flow 공식 패턴과 동일, spec 도 구분 안 함) | `edge-utils.ts` `isConnectionDroppedOnPane` | 필요 시 spec §1.2 에 "유효하지 않은 target 드롭"도 포함됨을 명시(선택) |
| 12 | maintainability | `onConnectEnd` 내 `"changedTouches" in event ? ... : event` 타입 분기에 설명 주석 없음(React Flow `MouseEvent | TouchEvent` 유니온 지식 필요) | `workflow-canvas.tsx` `onConnectEnd` | 짧은 인라인 주석 추가 권장 |
| 13 | maintainability | `NodeSearchPopupState.source`(객체 `{nodeId, handleId}`)가 코드베이스 관례상 문자열 노드 ID 를 뜻하는 `source`/`target` 네이밍과 겹쳐 혼동 여지 | `workflow-canvas.tsx` `NodeSearchPopupState.source`, `handleAddNodeFromSearch` | `connectionOrigin`/`dragSource` 등으로 개명 고려(강제 아님) |
| 14 | maintainability | 신규 헬퍼 2종(`isConnectionDroppedOnPane`/`firstInputHandleId`)의 `edge-utils.ts` 내 배치 위치가 "연결 유효성" 그룹과 성격이 약간 다름 | `edge-utils.ts` | §1.3 헬퍼 추가 시 섹션 주석 정리 권장 |
| 15 | side_effect | `onReconnect`/`reconnectable` 미배선 상태라 현재는 무관하나, §1.3(기존 엣지 재연결) 구현 시 동일 `onConnectEnd`/`fromHandle.type==='source'` 분기를 재사용하면 "연결 해제" 의도가 "신규 노드 생성" 팝업으로 오작동할 잠재 위험 | `workflow-canvas.tsx` L503-523 `onConnectEnd` | §1.3 구현 착수 시 `connectionState` 로 "기존 엣지 detach" vs "신규 드래그" 구분 가능한지 확인, 필요 시 재연결 제외 가드 추가 |
| 16 | testing | `buildAndAddNode` 반환 타입 변경(`void`→`string|undefined`)이 직접 단언되지 않음 — `handleAddNodeFromSearch` 가 이 반환값 truthy/falsy 로 자동연결 여부를 분기하므로 회귀 시 자동연결이 조용히 스킵될 수 있음 | `workflow-canvas.tsx` L588-621 | WARNING #3(테스트 추가) 해소 시 자연히 커버됨, 별도 조치 불필요 |
| 17 | documentation | spec `## Rationale` 섹션(R-1, R-2)에 §1.2 "대상 노드에 입력 포트 없으면 연결 생략" 등 엣지 케이스 설계 근거 미등재 | `spec/3-workflow-editor/2-edge.md` `## Rationale` | spec 갱신 시 짧은 Rationale 단락 추가 고려(선택) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | HIGH | SoT spec §1.2 stale 방치(CRITICAL), CHANGELOG 미갱신(WARNING) |
| side_effect | MEDIUM | undo 스냅샷 중복 push → Ctrl+Z 시 고아 노드 |
| testing | MEDIUM | §1.2 배선 로직 테스트/e2e 전무 |
| architecture | LOW | God Component 팽창 지속, `source` 필드 방향성 비대칭 |
| requirement | LOW | spec 동기화 누락(중복 지적), 컨테이너 포트 순서 암묵 의존 |
| maintainability | LOW | 팝업 오픈 로직 3중 중복, 네이밍/주석 사소한 개선 여지 |
| security | NONE | 실질 위험 없음(레이어 분리 정상) |
| performance | NONE | 신규 로직 전부 O(1), 렌더링 영향 없음 |
| scope | NONE | 4개 파일 변경 전부 §1.2 단일 의도에 정확히 대응 |
| user_guide_sync | 확인불가(재시도 필요) | manifest 상 success 이나 출력 파일이 디스크에 존재하지 않음(disk-write gap) |

## 발견 없는 에이전트

- **security** — 신규 API·인증/인가·시크릿·암호화·서버측 입력 처리 없음. 실질 취약점 없음.
- **performance** — 신규 로직은 전부 O(1) 순수 함수 + 저빈도 이벤트, N+1/블로킹 I/O/캐시 이슈 없음.
- **scope** — 4개 파일 변경 전부 plan §1.2 단일 의도에 정확히 대응, 범위 이탈 없음.

## 권장 조치사항
1. `spec/3-workflow-editor/2-edge.md` §1.2 본문을 "구현됨"으로 갱신 — 헤더의 "(미구현 · Planned)" 제거, "현재 구현" 각주를 실제 구현으로 교체 (CRITICAL, documentation+requirement 중복 지적)
2. §1.2 배선(`onConnectEnd`/`handleAddNodeFromSearch`)에 대한 최소 단위/통합 테스트 추가 — 현재 CI 로 회귀 감지 불가 (WARNING, testing)
3. 자동 연결로 인한 undo 스냅샷 중복 push 문제 해결 — "노드 생성+연결"을 단일 pushUndo 체크포인트로 묶는 전용 액션 도입 (WARNING, side_effect)
4. CHANGELOG.md 에 §1.2 Unreleased 항목 추가 (WARNING, documentation)
5. §1.3(역방향 드래그) 착수 전 `workflow-canvas.tsx` 오케스트레이션을 전용 훅으로 분리하고 `NodeSearchPopupState.source` 방향성 재설계 검토 (WARNING/INFO, architecture)
6. "노드 검색 팝업 열기" 3중 중복 시퀀스를 공용 헬퍼로 통합 (WARNING, maintainability)
7. `firstInputHandleId` 의 "첫 입력 포트=안전 target" 가정을 주석에 명시하거나 방어적 처리 추가 (WARNING, requirement)
8. `user_guide_sync` 리뷰 결과 재확인 필요 — manifest 상 success 로 보고되었으나 출력 파일(`user_guide_sync.md`)이 디스크에 존재하지 않아 내용 미확인 (disk-write gap, 재실행 또는 별도 확인 권장)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단 — 이번 diff(프런트엔드 UI 이벤트 핸들러+순수 헬퍼) 범위에 의존성 변경 없음(구체 사유 상세 비제공) |
  | database | 라우터 판단 — DB/쿼리 관련 변경 없음(구체 사유 상세 비제공) |
  | concurrency | 라우터 판단 — 동시성/레이스 관련 서버측 변경 없음(구체 사유 상세 비제공) |
  | api_contract | 라우터 판단 — API 계약/DTO 변경 없음(구체 사유 상세 비제공) |