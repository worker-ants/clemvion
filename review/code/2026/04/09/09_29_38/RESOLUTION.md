# 코드 리뷰 이슈 조치 내용

## 조치 완료

### Warning #1: 버튼 ID `__item_` 포함 검증
- `validateButtons()` (button.types.ts)와 `validateItemButtons()` (carousel.handler.ts) 모두에 `__item_` 포함 시 에러 반환 추가
- 포트 라우팅 조작 방지

### Warning #2: link 타입 버튼 URL 스킴 검증
- `validateItemButtons()` (carousel.handler.ts)와 `validateButtons()` (button.types.ts)에 `javascript:`, `data:`, `vbscript:` 스킴 차단 추가

### Warning #4: `unwrap()` null 안전성
- `data?.data !== undefined` → `data?.data != null` 조건 강화 (`{ data: null }` 응답 시 null 반환 방지)

### Warning #10: 이중 상태 변경 정리
- `run-results-drawer.tsx`의 `waitingNodeId` useEffect 제거
- store action(`pauseForForm`, `pauseForButtons`, `pauseForConversation`)에서 `selectedResultNodeId`를 원자적으로 설정하므로 중복 불필요

### SPEC 불일치 수정
- `spec/2-navigation/14-execution-history.md` §2.1: 와이어프레임의 `Trigger` 열 → `Nodes`로, `[Waiting]` 필터 버튼 추가
- `spec/4-nodes/6-presentation-nodes.md` §1.1: `source` 필드 "dynamic 모드 시 필수" → "선택" (하위호환)

## 의도적 미조치

### Warning #3: `buttonConfig` 다운스트림 전달
- 의도적 설계: 실행 상세 페이지에서 버튼 목록 렌더링에 필요. 민감 데이터가 아님.

### Warning #5-6: 아키텍처 개선 (`__item_` 공유 상수, 핸들러 인터페이스)
- 현재 carousel만 사용하는 패턴. 다른 노드에 확장 시 리팩토링 예정.

### Warning #7-8: 코드 구조 개선 (validateButtons 통합, ConversationInspector 분리)
- 향후 리팩토링 스코프. 현재 기능에 영향 없음.

## 검증 결과
- Backend: 648/648 tests passed
- Frontend: lint 0 errors, 396/396 tests passed, build 성공
