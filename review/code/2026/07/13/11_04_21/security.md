# 보안(Security) Review

## 발견사항

- **[INFO]** `onConnect` 직접 호출이 `isValidConnection` 게이트를 우회
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch` (신규 `onConnect({ source, sourceHandle, target, targetHandle })` 호출부, §1.2)
  - 상세: 기존 드래그 경로는 ReactFlow 가 `isValidConnection` 으로 커서 유효성을 먼저 검사한 뒤 `onConnect` 을 호출한다. 이번 자동 연결은 그 경로를 거치지 않고 store 의 `onConnect` 액션을 직접 호출한다. 주석은 "source→신규 노드 조합은 자기연결·중복이 될 수 없어 검증을 항상 통과한다" 고 정당화하는데, `source.nodeId` 가 실제로 (팝업 오픈 시점의) 드래그 시작 노드이고 `target` 이 방금 생성된 새 UUID 라는 함수 내부 불변식에 의존한다. 이 값들은 사용자 입력이 아니라 내부 상태(React state, `crypto.randomUUID()`)에서 오므로 인젝션·권한 우회로 이어지는 공격 표면은 아니며, 그래프 데이터는 클라이언트 로컬 편집 상태일 뿐 서버측 신뢰 경계를 넘지 않는다(저장 시 별도 백엔드 검증 경로가 있다면 그쪽이 최종 방어선). 보안 취약점이라기보다 "검증 로직 중복 경로" 성격의 입력검증 완결성 노트.
  - 제안: 실질적 위험은 없음(defense-in-depth 관점의 참고). 필요 시 `isSelfConnection`/`isDuplicateConnection` 헬퍼를 이 경로에도 명시적으로 통과시켜 두 경로(드래그 vs 자동생성)의 검증 로직을 하나로 수렴시키는 정도의 유지보수성 개선만 고려.

- **[INFO]** 렌더링 데이터는 전부 신뢰된 소스
  - 위치: `workflow-canvas.tsx` 노드 검색 팝업 렌더 (`def.label`, `def.category`, `def.color` 등)
  - 상세: 팝업에 표시되는 문자열은 정적 노드 레지스트리(`useNodeDefinitionsStore`)와 i18n 번역 함수(`translateNodeLabel`/`translateNodeCategory`)에서만 오며, `dangerouslySetInnerHTML` 이나 사용자 입력 문자열의 직접 HTML 삽입은 없다. `searchQuery` 는 `<input value=...>` 로만 소비되어 XSS 표면이 없다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 워크플로우 편집기 캔버스에서 출력 포트 드래그를 빈 캔버스에 드롭했을 때 노드 검색 팝업을 띄우고 선택한 노드를 자동으로 연결하는 순수 프런트엔드 UX 기능이며, 신규 API 호출·인증/인가 로직·시크릿·암호화·서버측 입력 처리는 전혀 포함하지 않는다. `nodeType`/`nodeId`/좌표 등 모든 값은 사용자가 직접 타이핑한 임의 문자열이 아니라 내부 상태(정적 노드 레지스트리 키, `crypto.randomUUID()`, ReactFlow 내부 `connectionState`)에서 파생되므로 인젝션·프로토타입 오염·권한 우회로 이어질 경로가 없다. 유일한 참고 사항은 자동 연결이 ReactFlow 의 `isValidConnection` UI 게이트를 우회해 store 의 `onConnect` 을 직접 호출한다는 점인데, 이는 클라이언트 로컬 편집 상태에 국한되고 함수 내부 불변식(신규 노드 대상이라 자기연결/중복 불가)에 의해 안전하므로 보안 결함으로 분류하지 않는다. 함께 변경된 `edge-utils.ts` 두 순수 헬퍼(`isConnectionDroppedOnPane`, `firstInputHandleId`)와 대응 vitest 는 boolean/문자열 파생 로직뿐이라 보안 관점에서 특기할 사항이 없고, plan 문서 갱신은 체크박스 상태 변경뿐이다.

## 위험도
NONE
