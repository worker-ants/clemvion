# Presentation Node 버튼 기능 — 완료

## 구현 완료 사항
- Carousel, Table, Chart, Template 4개 노드에 버튼(link/port) 지원 추가
- 버튼 설정 시 Blocking Mode (waiting_for_input) 동작
- 동적 출력 포트: port 버튼별 포트 + link 전용 시 continue 포트
- `_selectedPort` 패턴으로 포트 기반 라우팅 (gatherNodeInput 확장)
- WS `execution.click_button` 명령 + `execution.click_button.ack` 응답
- DB: node_execution.interaction_data JSONB 컬럼 추가
- Frontend: 버튼 설정 UI, 동적 포트, 버튼 바, 실행 스토어 확장

## 검증
- Backend lint: 통과
- Backend tests: 454 전체 통과 (버튼 관련 41개 포함)
- Frontend lint: 통과
- Frontend build: 통과
- AI 코드 리뷰 완료 + Critical/Warning 이슈 조치 완료
