# Code Review Resolution

## Critical 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `isLiveNode` 선언 전 참조 (TDZ ReferenceError) | `isLiveNode` 선언을 `isExpanded` 앞으로 이동 |

## Warning 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `updateConversationConfig`에서 config 데이터 손실 (maxTurns 등 소실) | merge 방식으로 변경: `{ ...existing, ...incoming }` |
| 2 | 메시지 파싱 로직 중복 (DRY 위반) | `conversation-utils.ts`에 `parseHistoryMessages()` 유틸 함수 추출, `result-timeline.tsx`와 `result-detail.tsx`에서 재사용 |
| 3 | `conversationConfig` 페이로드 접근 불일치 | 현재 `nodeOutput.conversationConfig` 접근 방식 유지 (서버에서 nodeOutput 내부에 포함하여 전송하므로 동작 정상) |
| 4 | 중복 메시지 방지 로직 취약 | `conversationMessages.length === 0` 조건 유지, 향후 turnCount 기반 비교로 강화 예정 |
| 5 | `ResultDetailProps` 인터페이스 과다 확장 | 현재 범위에서 유지, 향후 판별 유니온 패턴으로 리팩토링 예정 |
| 6 | `unknown` 타입 남용 | 현재 범위에서 유지, 향후 `ConversationConfig` 인터페이스 정의 예정 |
| 7 | `turnIndex` 계산 로직 컴포넌트에 위치 | 현재 범위에서 유지 |

## 최종 검증 결과

- Lint 에러: 0
- 백엔드 테스트: 48 suites, 596 tests 전부 통과
- 빌드: OK
