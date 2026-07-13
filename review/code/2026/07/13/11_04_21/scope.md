# 변경 범위(Scope) 리뷰 결과

## 대상
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
- `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`
- `codebase/frontend/src/lib/utils/edge-utils.ts`
- `plan/in-progress/spec-sync-edge-gaps.md`

## 의도된 작업
`plan/in-progress/spec-sync-edge-gaps.md` §1.2 — "출력 포트 드래그 → 빈 영역 드롭 시 노드 추가
검색 팝업 + 자동 엣지 연결" 구현. 변경분은 이 항목 하나에 정확히 대응한다.

### 발견사항

- **[INFO]** `buildAndAddNode` 반환 타입 변경(`void` → `string | undefined`)
  - 위치: `workflow-canvas.tsx` `buildAndAddNode` 정의부(구 101-133행 부근)
  - 상세: 기존 3개 호출부(`handleAddNodeFromSearch`, `handleAddNodeAtCenter`, `onDrop`) 중 앞의
    하나만 반환값을 소비하고 나머지 둘은 무시한다. §1.2 의 자동 연결 기능이 신규 노드 id 를
    필요로 하므로 시그니처 변경은 기능 요구에서 직접 파생된 것으로, 범위 이탈이 아니라
    필수 변경이다.
  - 제안: 없음(정상 범위).

- **[INFO]** `edge-utils.ts` 신규 헬퍼 2종(`isConnectionDroppedOnPane`, `firstInputHandleId`)
  - 위치: `edge-utils.ts` 113행 이후 추가분
  - 상세: 기존 `isSelfConnection`/`isDuplicateConnection` 과 동일한 "순수 함수로 분리해
    단위 테스트" 패턴을 따른다. §1.2 구현에만 쓰이며 다른 로직에 개입하지 않는다.
  - 제안: 없음(정상 범위).

- **[INFO]** `edge-utils.test.ts` 는 신규 헬퍼 2종에 대한 테스트만 추가(각 5케이스, 4케이스)
  - 상세: 기존 describe 블록·픽스처는 무변경. 테스트 추가 범위가 신규 함수에 정확히 국한됨.

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 갱신(`[ ]` → `[x]`) + 구현 요약 서술
  - 상세: 해당 저장소 관례상(§1.2 항목 자체가 이 plan 파일에 있고, 완료 시 체크박스+구현 노트를
    같은 커밋에서 갱신하는 패턴이 다수 선례에서 확인됨) 구현과 동일 스코프의 문서 동기화이며
    범위 이탈이 아니다. 수정된 라인은 §1.2 항목 1줄뿐이고 다른 항목(§1.3, §3.2 등)은 손대지
    않았다.

- **[INFO]** `onConnectEnd` 의 `useCallback` 의존성 배열이 `[]`(빈 배열)
  - 위치: `workflow-canvas.tsx` `onConnectEnd` 정의부
  - 상세: `reactFlowInstance`(ref)·`setNodeContextMenu`/`setCanvasContextMenu`/
    `setNodeSearchPopup`/`setSearchQuery`(setState 함수) 모두 안정적 참조라 의존성 누락은
    실질적 버그가 아니다. 다만 이는 스코프 문제가 아니라 별도 관점(정확성) 소관이라 여기서는
    참고용으로만 기록.

불필요한 리팩토링, 무관한 파일 수정, 포맷팅만의 변경, 사용하지 않는 임포트, 설정 파일 변경은
발견되지 않았다. 추가된 주석은 모두 §1.2 구현 의도(연결원 기록·자동 연결 생략 조건 등)를
설명하는 데 국한되며, 무관한 코드에 대한 주석 추가/삭제도 없다.

## 요약
4개 파일의 변경분은 모두 plan §1.2("출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 + 자동
엣지 연결") 구현이라는 단일 의도에 정확히 대응한다. `buildAndAddNode` 반환 타입 변경은 자동
연결에 필요한 신규 노드 id 획득을 위한 필수 변경이고, `edge-utils.ts` 의 신규 순수 헬퍼 2종과
그에 대한 테스트는 기존 패턴(`isSelfConnection`/`isDuplicateConnection`)을 그대로 따른다. plan
문서 체크박스 갱신도 해당 항목 1줄에 국한된다. 요청 범위를 벗어나는 리팩토링, 기능 확장,
무관한 파일·설정 수정, 포맷팅/주석/임포트 잡음은 발견되지 않았다.

## 위험도
NONE
