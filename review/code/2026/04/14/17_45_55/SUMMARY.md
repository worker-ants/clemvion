# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 렌더 단계 setState, 이중 폴링, URL 검증 누락, 전역 스토어 경쟁 조건 등 복수의 런타임 위험 요소가 존재하나, 즉각적인 보안 취약점은 제한적

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `window.open(url)` 호출 시 URL 프로토콜 검증 없음 — `javascript:` / `data:` 프로토콜이 혼입되면 XSS 실행 가능 | `page.tsx` `handleLinkButtonClick`, `result-detail.tsx` `handleLinkButtonClick` | `new URL(url).protocol`로 `https:`/`http:` 여부를 검증한 뒤 `window.open` 호출 |
| 2 | 보안 | `waitingButtonConfig`를 런타임 검증 없이 `as Record<string, unknown>`으로 단언 후 buttons 배열로 캐스팅 — 악성 payload 유입 시 `handleLinkButtonClick`에 전달 가능 | `page.tsx:541–568`, `result-detail.tsx:408–435` | zod 스키마 또는 타입 가드로 파싱 후 사용; `ButtonConfig` 인터페이스를 공유 타입으로 정의 |
| 3 | 동시성 | 전역 싱글턴 `useExecutionStore`의 `reset()` 호출이 다른 소비자(편집기 드로어 등) 상태를 덮어씀 — 빠른 실행 전환 시 경쟁 조건 발생 가능 | `page.tsx:80–83` | 실행 ID별 격리 스토어(`createStore` + Context) 사용 또는 `resetForExecution(executionId)` 형태의 조건부 초기화 |
| 4 | 동시성 | `sendMessage` 낙관적 업데이트 후 WebSocket 전송 실패 시 롤백 없음 — 전송되지 않은 유령 메시지가 UI에 잔류 | `use-execution-interaction-commands.ts:46–59` | `emit` ACK 콜백 또는 오류 이벤트에서 마지막 메시지 제거 및 `isWaitingAiResponse` 복원 |
| 5 | 아키텍처/성능 | 렌더 함수 본문에서 직접 `setState` 3회 호출 — React Concurrent Mode에서 중복 렌더 및 무한 루프 위험 | `page.tsx:352–360` | `useEffect(() => { ... }, [waitingNodeId])` 로 전환 또는 세 상태를 `useReducer`로 원자적 처리 |
| 6 | 동시성/성능 | `executionQuery` 2초 폴링과 `useExecutionEvents` 내부 REST 폴링이 이중으로 동작 — 실행 상태 전환 시점에 비결정적 스토어 업데이트 위험 | `page.tsx:96–103`, `useExecutionEvents` | 폴링 책임을 단일 지점으로 통합하거나, 타임스탬프 기반 낙관적 잠금 적용 |
| 7 | 테스팅 | `onSendMessage` prop 제거로 해당 코드 경로 테스트 커버리지 공백 — 대화 메시지 전송 시나리오 테스트 전무 | `result-detail.test.tsx` | `"emits submit_message via ws when conversation message is sent"` 테스트 추가 |
| 8 | 테스팅 | `sendMessage` `turnIndex` 계산이 초기 상태(메시지 0개)에서만 검증됨 — 누적 증가 로직 미검증 | `use-execution-interaction-commands.test.ts:53–68` | 연속 `sendMessage` 호출 후 `turnIndex`가 올바르게 누적되는지 검증 테스트 추가 |
| 9 | 테스팅 | 렌더 중 파생 상태 업데이트 패턴의 경계 케이스 미검증 — 동일 `waitingNodeId`로 재렌더 시 불필요한 재선택 방지 로직 검증 없음 | `execution-detail-waiting.test.tsx` | `"does not re-auto-select when waitingNodeId is unchanged on re-render"` 테스트 추가 |
| 10 | 아키텍처 | `waiting` 상태 파생 및 렌더 분기 로직이 `page.tsx`와 `run-results-drawer.tsx` 양쪽에 중복 — interaction type 추가 시 두 곳 수정 필요 | `page.tsx:372–416`, `run-results-drawer.tsx` | `useWaitingInteractionState(executionId)` 훅 추출하여 공유 |
| 11 | 성능 | `useExecutionStore` 셀렉터가 9개 독립 구독으로 분산 — 관련 필드 동시 업데이트 시 다중 리렌더 트리거 가능 | `page.tsx:318–362`, `run-results-drawer.tsx:90–130` | `useShallow`로 관련 waiting 상태를 단일 구독으로 묶기 |
| 12 | API 계약 | 실행 종료 상태가 `"completed"`, `"failed"`, `"cancelled"` 하드코딩 — 서버에 신규 종료 상태 추가 시 클라이언트가 폴링 지속 | `page.tsx:99–103` | `TerminalExecutionStatus` 유니온 타입을 서버-클라이언트 공유 타입으로 정의 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스팅 | `endConversation` (`execution.end_conversation` 이벤트) 통합 테스트 없음 | `execution-detail-waiting.test.tsx` ai_conversation 블록 | `"emits end_conversation when end conversation button is clicked"` 테스트 추가 |
| 2 | 테스팅 | `refetchInterval` 폴링 중단 로직 테스트 없음 | `page.tsx:100–107` | `status` 별 `refetchInterval` 반환값 단위 테스트 추가 (함수 분리 권장) |
| 3 | 테스팅 | submit/click 후 `waitingNodeId`가 null로 초기화되는지 검증 없음 | `execution-detail-waiting.test.tsx` | `useExecutionStore.getState().waitingNodeId === null` 단언 추가 |
| 4 | 아키텍처 | `useExecutionStore.getState()` 직접 접근으로 리액티브 흐름 우회 | `use-execution-interaction-commands.ts:49` | `addConversationMessage` 액션 내부에서 턴 인덱스 계산하도록 스토어 액션 확장 |
| 5 | 유지보수성 | `"__continue__"` 매직 문자열 하드코딩 | `use-execution-interaction-commands.ts:46` | `const CONTINUE_BUTTON_ID = "__continue__"` 상수로 추출 |
| 6 | 유지보수성 | `waitingButtonConfig` 타입 캐스팅 코드가 `page.tsx`와 `result-detail.tsx` 두 곳에 복제 | `page.tsx:541–568`, `result-detail.tsx:408–435` | `ButtonConfig` 인터페이스를 공유 타입 파일에 정의 |
| 7 | 문서화 | `ExecutionInteractionCommands` 인터페이스 필드 JSDoc 미작성 — `nodeId` 파라미터 의미 불명확 | `use-execution-interaction-commands.ts:7–13` | 각 메서드에 JSDoc 설명 및 `@param`/`@returns` 태그 추가 |
| 8 | 문서화 | `waiting_for_input` 상태에서도 폴링하는 이유 주석 없음 | `page.tsx:100–105` | 인라인 주석으로 의도 명시 |
| 9 | 보안 | 전역 스토어 싱글턴으로 인한 다중 탭 간 상태 오염 가능성 | `page.tsx` `resetStore` useEffect | 스토어에 `activeExecutionId` 추가 후 불일치 이벤트 무시 guard 적용 |
| 10 | 보안 | 백엔드 에러 메시지가 UI에 직접 노출 — 스택 트레이스 등 내부 정보 노출 위험 | `page.tsx` `execution.error.message` 렌더링 | 서버에서 클라이언트 노출용 정제된 메시지 필드 분리 |
| 11 | 의존성 | `@emnapi/core`, `@emnapi/runtime` lockfile 신규 추가 — optional MIT 패키지로 번들 미포함 | `package-lock.json` | 조치 불필요. 기존 WASI 체인의 optional 의존성 |
| 12 | 의존성 | `executionId` null guard가 훅 내부와 컴포넌트 내부에 중복 존재 | `result-detail.tsx:261`, `use-execution-interaction-commands.ts:21` | 한 계층에서만 guard 처리하도록 일관성 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | MEDIUM | 전역 스토어 reset 경쟁 조건, 이중 폴링, sendMessage 롤백 없음 |
| security | MEDIUM | window.open URL 검증 누락, buttonConfig 타입 단언 무검증 |
| performance | MEDIUM | 렌더 중 setState, 9개 분리 셀렉터, adjacentQuery limit:100 전체 조회 |
| testing | MEDIUM | onSendMessage 제거 후 커버리지 공백, turnIndex 누적 검증 미흡 |
| side_effect | MEDIUM | 렌더 중 setState anti-pattern, resetStore/useExecutionEvents 순서 경쟁 |
| requirement | MEDIUM | 렌더 중 setState React 규칙 위반, waitingNodeId 미존재 시 폴백 없음 |
| architecture | MEDIUM | waiting 상태 로직 중복, NodeResultsTab 글로벌 스토어 직접 의존 |
| maintainability | LOW | NodeResultsTab 과도한 책임, 타입 캐스팅 코드 중복, 셀렉터 보일러플레이트 |
| api_contract | LOW | 종료 상태 하드코딩으로 서버 변경에 취약 |
| dependency | LOW | executionId null guard 중복, 내부 의존성 구조 개선 방향 긍정적 |
| scope | LOW | 렌더 중 setState, package-lock.json 변경 의도 확인 필요 |
| documentation | LOW | JSDoc @param/@returns 누락, 테스트 파일 스코프 주석 없음 |
| database | NONE | 해당 없음 (프론트엔드 변경) |

---

## 발견 없는 에이전트

- **database** — 프론트엔드 전용 변경으로 데이터베이스 관련 코드 없음

---

## 권장 조치사항

1. **[보안 즉시 조치]** `handleLinkButtonClick`에 URL 프로토콜 검증 추가 (`https:`/`http:` 허용 목록) — `page.tsx`, `result-detail.tsx`
2. **[보안 즉시 조치]** `waitingButtonConfig`를 zod 스키마 또는 타입 가드로 런타임 파싱 후 사용; `ButtonConfig` 인터페이스 공유 타입으로 정의
3. **[렌더링 안정성]** `NodeResultsTab` 렌더 중 `setState` 3회 호출을 `useEffect`로 이전 — Concurrent Mode 무한 루프 방지
4. **[테스트 커버리지]** `result-detail.test.tsx`에 대화 메시지 전송 시나리오 추가 (`sendMessage` via WebSocket 검증)
5. **[테스트 커버리지]** `use-execution-interaction-commands.test.ts`에 `sendMessage` 연속 호출 시 `turnIndex` 누적 증가 검증 추가
6. **[테스트 커버리지]** `execution-detail-waiting.test.tsx`에 `endConversation` 이벤트 발생 및 submit 후 스토어 상태 초기화 검증 추가
7. **[성능]** `useExecutionStore` 9개 분리 셀렉터를 `useShallow`로 단일 구독으로 통합 — `page.tsx`, `run-results-drawer.tsx`
8. **[아키텍처]** 이중 폴링(`executionQuery` + `useExecutionEvents`) 책임을 단일 지점으로 통합
9. **[아키텍처]** waiting 상태 파생 + 핸들러 로직을 `useWaitingInteractionState` 훅으로 추출하여 `page.tsx`와 `run-results-drawer.tsx` 중복 제거
10. **[유지보수]** `"__continue__"` 상수화, 종료 상태 `TerminalExecutionStatus` 유니온 타입으로 공유화