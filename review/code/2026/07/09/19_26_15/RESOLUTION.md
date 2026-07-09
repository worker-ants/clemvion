# RESOLUTION — 2026/07/09 19_26_15 code review (round 3, fresh)

LOW risk, Critical 0, WARNING 1. 8→3→1 수렴. WARNING + 값진 저비용 INFO 반영, 나머지 backlog defer.

## WARNING — 반영
- #1 testing (`isActiveConversationPhase` 직접 테스트 부재): `widget-state.test.ts` 에 `describe` +
  `WidgetPhase` 7값 진리표 `it.each` 추가(booting=false 핵심 케이스 고정).

## INFO — 반영
- #1 maintainability: `state.pending!.nodeId` → `state.pending?.nodeId`(불필요 non-null 단언 제거).
- #2 testing: endConversation 2회 연속 호출 → 재진입 가드 no-op(명령 미중복) 테스트 추가.
- #7 plan-lifecycle(3인 지적): complete/ plan frontmatter `status: in-progress` → `complete`.
- #8 side_effect: 2-sdk.md `conversationEnded.reason` 이 열린 문자열(닫힌 enum 아님)임을 명시.
- #13 requirement: execution.entity.ts 주석에 EIA getStatus read-only 노출 교차참조 추가.

## INFO — defer (backlog/저위험)
- #3 backend node-null+thread 조합 테스트, #4 confirming/isEnded 동시노출 테스트: 저우선.
- #5 SSE/REST waiting wire-shape 공용 빌더(`buildWaitingForInputWirePayload`): backlog.
- #6 widget-app 헤더클릭 통합 스모크: pre-existing 패턴(submitMessage/clickButton 동일), 본 PR 결함 아님.
- #9 TurnSource Backend/Local 분리, #10 useWidget ref 캡슐화, #11 헬퍼 네이밍: backlog.
- #12 conversationThread 키 생략 비대칭: spec §5.3 명문화됨, 공개 SDK 문서화 시 강조.

## 검증
- web-chat 277 passed(신규: isActiveConversationPhase 진리표 7건, re-entry no-op, nodeId부재→cancel 등).
- build/lint clean. backend entity 변경은 주석-only.
- 반영분 커버 위해 최종 수렴 fresh review 1회.
