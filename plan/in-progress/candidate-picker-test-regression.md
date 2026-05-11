# candidate-picker 회귀 테스트 실패

> 발견 시점: 2026-05-12 (feature/auth-sessions 작업 중 TEST WORKFLOW 단계)
> 영향 범위: `frontend/src/components/editor/assistant-panel/candidate-picker.test.tsx`

## 증상

`renders an amber guidance box when there are no candidates` 테스트가 안정적으로 실패한다.

```
expect(screen.getByText(/사용 가능한 Integration 이\(가\) 없어요/))
→ DOM 상에 해당 텍스트 없음. 대신 chevron-right SVG 만 렌더링됨.
```

## 원인 추정

- 컴포넌트는 main 의 `0f1dbe5f refactor(workflow-assistant): ai-review 조치` 또는 `637ac783 feat(workflow-assistant): MCP 서버 picker 추가` 에서 변경됨.
- 테스트는 "Integration 후보가 없을 때 안내 박스가 보인다" 를 검증하나, 실제 컴포넌트는 안내 박스 대신 navigation 화살표만 그리는 듯.
- 테스트와 구현 중 한 쪽이 갱신 누락된 회귀로 추정.

## 본 plan 과의 관계

`feature/auth-sessions` 브랜치(활성 세션·로그인 이력) 와 무관. main 에서 이미 깨진 상태로 분기됨을 확인 (해당 컴포넌트·테스트 우리가 건드린 적 없음).

## 후속 처리

- 우선 본 회귀를 별도 plan 으로 추적해 메인 작업 진행을 가로막지 않는다.
- workflow-assistant 책임자가 컴포넌트 또는 테스트 한 쪽을 갱신해야 한다.
- 본 plan 은 작업이 시작되면 `in-progress/` 안에서 owner 와 함께 갱신, 완료 시 `complete/` 로 이동한다.
