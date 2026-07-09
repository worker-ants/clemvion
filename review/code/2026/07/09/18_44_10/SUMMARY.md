# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. `endConversation()` 이 명령 전송을 await 한 뒤 optimistic 종료를 수행하는 신규
패턴이 SSE terminal 이벤트와 경합해 host 로 `conversationEnded` 콜백이 서로 다른 `reason` 으로 중복 발사될 수
있는 회귀 가능 지점(WARNING #1)이며, 그 실패 경로가 unit 테스트로 미검증. 그 외 유지보수성·문서화 WARNING 다수.

## Critical 발견사항
없음.

## 경고 (WARNING) 및 처리

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | 부작용 | `endConversation()` await-후-teardown 순서 → SSE terminal 과 경합해 `conversationEnded` 2회 발사 | **수정** — teardown(closeStream)을 명령 전송 이전으로 이동 + `guardEnded` 로 중복 종료 차단 |
| 2 | 아키텍처 | `ACTIVE_PHASES`/`showSessionControls` 가 panel.tsx 하드코딩(phase 파생은 widget-state SoT) | **수정** — `isActiveConversationPhase(phase)` 를 widget-state.ts 로 이관 |
| 3 | 유지보수성 | newChat/endConversation 세션정리 4줄 중복 | **수정** — `resetSessionRefs()` 헬퍼 추출 |
| 4 | 유지보수성/테스트 | 헤더 "대화 종료" 와 confirm 확정 버튼 동일 접근성 이름 → CSS selector 결합 | **수정** — confirm 버튼에 `aria-label` 부여, 테스트 `within(dialog).getByRole` 전환 |
| 5 | 유지보수성 | `confirming` 3항 분기 3곳 반복 | **수정** — `CONFIRM_COPY` 조회 테이블 통합 |
| 6 | 테스트 | endConversation 명령 실패(catch) 경로 미검증 | **수정** — interact 실패 시뮬 테스트 추가 |
| 7 | 테스트 | graceful/cancel 라우팅 경계(buttons/form) 미검증 | **수정** — buttons pending → cancel 테스트 추가 |
| 8 | 문서화 | CHANGELOG.md 미갱신 | **수정** — Unreleased 항목 추가 |

## 참고 (INFO) 및 처리
- #1 (미커밋 startGenRef): **동일 PR 포함** — fresh review 로 재검토.
- #2 (`"user"` 리터럴 dead value): **수정** — 제거(타입/구현 일치).
- #3 (durable thread redaction): 백로그(spec R17 에 이미 노드 핸들러 제약 명문). defer.
- #4 (새 대화 orphan 축적): spec WARNING 으로 추적 중. defer(백로그).
- #5 (409 낙관 전이 Rationale 미기재): **수정** — spec 한 줄 병기.
- #6 (getStatus 조건부 spread 반복): **수정** — 공통 필드 선조립.
- #7 (booting/streaming showSessionControls 테스트): **수정** — it.each 추가.
- #8 (COMPLETED+thread → context null 회귀 테스트): **수정** — 추가.
- #9 (대화 종료 취소 경로 테스트): **수정** — 추가.
- #10 (README 상태 stale): **수정**.
- #11 (다이어그램 종료 전이): §3 보완 문장 이미 추가(bullet).
- #12 (endConversation JSDoc nodeId 조건): **수정**.
- #13 (conversationThread 부재=키 생략 vs null): **수정** — spec §5.3 에 "부재 시 키 생략" 명시.
- #14 (payload 크기 ETag): 백로그. defer.
- #15 (thread clone 없이 embed): 읽기전용이라 저위험. defer(RESOLUTION 명시).
- #16 (TurnSource Backend/Local 분리): 타입 nicety. defer.

## 라우터 결정
- 실행(9): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract
- 제외(5): performance, dependency, database, concurrency, user_guide_sync (해당 표면 없음)

## 결론
Critical 0. WARNING 8건 전부 + 실행 가치 높은 INFO 다수 반영. gen guard(INFO#1) 동일 PR 포함 → fresh review 로 재검증.
